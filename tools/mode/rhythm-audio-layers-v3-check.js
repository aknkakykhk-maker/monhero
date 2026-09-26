#!/usr/bin/env node
// 音の層の解析(rhythm-audio-layers-v3.js)を、正解の分かっている音で確かめる(2026-09-26・段2)。
//   ・中央値のならしが正しい
//   ・打楽器と音程楽器の分離: 伸びる和音は音程楽器の側、クリック音は打楽器の側へ行く
//   ・打楽器の種類: キック・スネア・ハイハットだけの音では全部正しく名乗る
//   ・裏拍のベースと伸びる和音を足しても、ベースをキックと呼ばない・ハイハットとスネアを取りこぼさない
//   ・同じ音なら2回とも同じ結果・既存の解析ファイル(*-v3-audio.json)へは書かない
// 実際の曲での分類は正解が無いので、ここでは見ない(参考値。ROADMAP の段2)。
'use strict';
const fs=require('fs');
const path=require('path');
const L=require('./rhythm-audio-layers-v3.js');

let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// --- 正解の分かっている32kHzの音 ---
const SR=32000;
const makeNoise=()=>{let s=12345;return ()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff*2-1;};};
const build=({bpm=128,bars=16,bass=true,pad=true}={})=>{
  const rnd=makeNoise();
  const beat=60/bpm,len=Math.ceil((bars*4*beat+1)*SR),buf=new Float32Array(len),truth=[];
  const add=(at,fn,dur)=>{const s=Math.round(at*SR);for(let i=0;i<dur*SR;i++){const k=s+i;if(k<len)buf[k]+=fn(i/SR);}};
  const kick=t=>Math.sin(2*Math.PI*(50+80*Math.exp(-t*30))*t)*Math.exp(-t*14)*.9;
  const snare=t=>(rnd()*.5+Math.sin(2*Math.PI*190*t)*.3)*Math.exp(-t*22);
  let prev=0;const hat=t=>{const n=rnd();const hp=n-prev;prev=n;return hp*.25*Math.exp(-t*80);};
  const bassNote=f=>t=>Math.sin(2*Math.PI*f*t)*.5*Math.min(1,t*200)*Math.exp(-t*3);
  for(let b=0;b<bars;b++)for(let q=0;q<4;q++){
    const t0=(b*4+q)*beat+.5;
    add(t0,kick,.4);truth.push({timeMs:t0*1000,kind:'kick'});
    if(q===1||q===3){add(t0,snare,.25);truth.push({timeMs:t0*1000,kind:'snare'});}
    add(t0+beat/2,hat,.08);truth.push({timeMs:(t0+beat/2)*1000,kind:'hat'});
    if(bass){const f=[55,65.4,73.4,49][b%4];add(t0+beat*.75,bassNote(f),beat*.25);truth.push({timeMs:(t0+beat*.75)*1000,kind:'bass'});}
  }
  if(pad)for(let b=0;b<bars;b++){const t0=b*4*beat+.5;add(t0,t=>[261.6,329.6,392].reduce((s,f)=>s+Math.sin(2*Math.PI*f*t),0)*.08*Math.min(1,t*20),4*beat);}
  for(let i=0;i<len;i++)buf[i]+=rnd()*.003;
  const timing={bpm,beatMs:beat*1000,beatZeroMs:500,subdivisionsPerBeat:4,gridMs:beat*250,beatsPerBar:4};
  return {samples:buf,truth,timing};
};
const analyze=options=>{
  const s=build(options);
  const onsets=[...new Set(s.truth.map(t=>t.timeMs))].map(timeMs=>({timeMs}));
  const result=L.analyzeLayers(s.samples,SR,{timing:s.timing,onsets});
  const kinds=ms=>s.truth.filter(t=>t.timeMs===ms).map(t=>t.kind);
  return {result,rows:result.onsets.map(o=>({want:kinds(o.timeMs),got:o.drums}))};
};

// ── 1. 中央値のならし ──
{
  const out=L.slidingMedian(Float32Array.from([1,9,2,8,3,7,4]),3,new Float32Array(7));
  ok('中央値のならし(幅3・端は端の値で埋める)',[1,2,8,3,7,4,4].every((v,i)=>out[i]===v),Array.from(out).join(','));
}

// ── 2. 打楽器と音程楽器の分離 ──
{
  const {spectrogram}=require('./rhythm-audio-dsp.js');
  const len=SR*2,tone=new Float32Array(len),clicks=new Float32Array(len);
  for(let i=0;i<len;i++)tone[i]=Math.sin(2*Math.PI*440*i/SR)*.3;
  for(let k=0;k<16;k++)clicks[Math.round((k+.5)*SR/8)]=1;
  const share=samples=>{
    const spec=spectrogram(samples,1024,256),{harmonic,percussive}=L.hpss(spec);
    let h=0,p=0;for(let i=0;i<harmonic.length;i++){h+=harmonic[i]**2;p+=percussive[i]**2;}
    return p/(h+p);
  };
  const toneShare=share(tone),clickShare=share(clicks);
  ok('伸びる音は音程楽器の側へ行く',toneShare<.1,`打楽器の割合 ${toneShare.toFixed(3)}`);
  ok('クリック音は打楽器の側へ行く',clickShare>.9,`打楽器の割合 ${clickShare.toFixed(3)}`);
}

// ── 3. 打楽器の種類 ──
{
  const {rows}=analyze({bass:false,pad:false});
  const exact=rows.every(r=>r.want.slice().sort().join('+')===r.got.slice().sort().join('+'));
  ok('キック・スネア・ハイハットだけの音では全部正しく名乗る',exact,`${rows.filter(r=>r.want.slice().sort().join('+')===r.got.slice().sort().join('+')).length}/${rows.length}`);
  const mixed=analyze({});
  const bassRows=mixed.rows.filter(r=>r.want.length===1&&r.want[0]==='bass');
  ok('裏拍のベースをキックと呼ばない',bassRows.length>0&&bassRows.every(r=>!r.got.includes('kick')),`${bassRows.filter(r=>r.got.includes('kick')).length}/${bassRows.length}件をキックと呼んだ`);
  const recall=kind=>{const list=mixed.rows.filter(r=>r.want.includes(kind));return list.filter(r=>r.got.includes(kind)).length/list.length;};
  ok('ベースと和音を足しても、キック・スネア・ハイハットを取りこぼさない',recall('kick')===1&&recall('snare')===1&&recall('hat')===1,
    `キック ${recall('kick')} / スネア ${recall('snare')} / ハイハット ${recall('hat')}`);
  const hatAsSnare=mixed.rows.filter(r=>r.want.length===1&&r.want[0]==='hat'&&r.got.includes('snare')).length;
  ok('ハイハットだけの打点をスネアと呼ばない',hatAsSnare===0,`${hatAsSnare}件`);
  ok('2回とも同じ結果',JSON.stringify(analyze({}).result)===JSON.stringify(mixed.result));
  const series=mixed.result.series;
  ok('16分ごとの層の強さが 0〜1 で出る',['harmonic','percussive','lead','high'].every(key=>series[key].length===mixed.result.grid.count&&series[key].every(v=>v>=0&&v<=1)));
}

// ── 4. 既存の解析ファイルへは書かない ──
{
  const source=fs.readFileSync(path.join(__dirname,'rhythm-audio-layers-v3.js'),'utf8');
  const writes=source.match(/writeFileSync\([^)]*\)/g)||[];
  ok('書き出すのは *-v3-layers.json だけ',writes.length===1&&/-v3-layers\.json/.test(source)&&!/-v3-audio\.json`\)\s*,\s*JSON/.test(source),writes.join(' '));
}

console.log(failed?`\n✗ ${failed}件NG`:'\n✓ 音の層の解析は期待どおり');
process.exit(failed?1:0);
