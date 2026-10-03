#!/usr/bin/env node
// MHB CHART ENGINE Rev.18(繰り返しの見分け・2026-09-28・rhythm-chart-repeats.js)を見張る。
//   ・作り物の曲で、わざと同じにした4小節を見つけ、ほかは繰り返しと言わない
//   ・生成器は Rev.18 から、解析の区切りの繰り返しが無い小節にだけ足す(Rev.17 までは足さない)
//   ・足した小節で、元の小節と同じ形(レーン)になる割合が Rev.17 より上がる。押せない配置を作らない
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const {detectRepeats}=require('./rhythm-chart-repeats.js');
const {measureFeel}=require('./rhythm-chart-feel-report.js');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.18 以上',CHART_REVISION_CODE_LATEST>=18);

// ── 1. 作り物の曲 ──
{
  const BAR=16,bars=24;
  let seed=5;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
  const onsets=[],pitchCurve=[];
  const barContent=[];
  for(let b=0;b<bars;b++){
    // 12〜15小節は 2〜5小節と同じ中身(1番と2番)。ほかはばらばら
    const copyOf=b>=12&&b<16?b-10:null;
    const content=copyOf!=null?barContent[copyOf]:Array.from({length:BAR},()=>({hit:rnd()<.5,strength:.3+rnd()*.7,low:rnd(),semi:rnd()<.8?Math.floor(rnd()*24)-12:null}));
    barContent.push(content);
    content.forEach((c,k)=>{
      const grid=b*BAR+k;
      if(c.hit)onsets.push({grid,timeMs:grid*125,strength:c.strength,share:{low:c.low},character:'BODY'});
      pitchCurve.push(c.semi==null?{grid,hz:0,clarity:.1}:{grid,hz:440*2**(c.semi/12),clarity:.9});
    });
  }
  const audio={timing:{subdivisionsPerBeat:4,beatsPerBar:4},structure:{bars:Array.from({length:bars},(_,bar)=>({bar}))},onsets,pitchCurve};
  const found=detectRepeats(audio,null);
  const bars12=[12,13,14,15].every(b=>found.sourceByBar.get(b)===b-10);
  const extra=[...found.sourceByBar.keys()].filter(b=>b<12||b>15);
  ok('わざと同じにした4小節を見つけ、元の小節を指す',bars12,JSON.stringify([...found.sourceByBar]));
  ok('ほかの小節は繰り返しと言わない',extra.length===0,`${extra.length}小節`);
  ok('間違いの見積もりは小さい(1%未満)',found.falsePositiveRate<.01,`${(found.falsePositiveRate*100).toFixed(2)}%`);
}

// ── 2. 生成器 ──
{
  const source=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-generate.js'),'utf8');
  ok('足すのは Rev.18 から、解析の区切りの繰り返しが無い小節だけ',/const rev18=chartRevision>=18;/.test(source)&&/if\(!rev18\)return \{sourceByBar:new Map\(\),falsePositiveRate:0\};/.test(source)
    &&/filter\(\(\[bar\]\)=>\{const section=sectionForBar\(bar\);return !section\|\|section\.repeatOf==null;\}\)/.test(source));
  const trackId='kaze_ga_soyogu',dashed='kaze-ga-soyogu';
  const audio=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-audio.json`),'utf8'));
  let layers=null;try{layers=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-layers.json`),'utf8'));}catch{}
  const sectionOf=bar=>audio.structure.sections.find(s=>bar>=s.startBar&&bar<s.endBarExclusive);
  const extra=[...detectRepeats(audio,layers).sourceByBar].filter(([bar])=>{const s=sectionOf(bar);return !s||s.repeatOf==null;});
  ok('風がそよぐ場所(解析の繰り返しが0)で繰り返しを見つける',extra.length>=8,`${extra.length}小節`);
  const BAR=audio.timing.subdivisionsPerBeat*audio.timing.beatsPerBar;
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev18-'));
  try{
    const generate=revision=>{
      const dir=path.join(tmp,`r${revision}`);fs.mkdirSync(dir);
      const r=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--chart-revision',String(revision),'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
      return {status:r.status,stdout:r.stdout||'',chart:d=>JSON.parse(fs.readFileSync(path.join(dir,`${dashed}-v3-chart-${d}.json`),'utf8'))};
    };
    const r17=generate(17),r18=generate(18);
    ok('Rev.17・Rev.18 とも作れる',r17.status===0&&r18.status===0);
    ok('Rev.18 だけが繰り返しを足したと出す',!/繰り返しの見分け/.test(r17.stdout)&&/繰り返しの見分け: 解析の繰り返しに [1-9]\d*小節を足した/.test(r18.stdout));
    const laneEcho=r=>{
      let same=0,both=0,impossible=0;
      for(const d of ['normal','hard','expert','master']){
        const chart=r.chart(d),byGrid=new Map();
        for(const note of chart.notes)if(!note.chord)byGrid.set(note.grid,note);
        for(const [bar,source] of extra)for(let k=0;k<BAR;k++){
          const x=byGrid.get(bar*BAR+k),y=byGrid.get(source*BAR+k);
          if(!x||!y)continue;both++;
          const mirrored=12-(y.subLane+(y.subLaneWidth||2));
          if(x.subLane===y.subLane||x.subLane===mirrored)same++;
        }
        impossible+=measureFeel(chart,audio,{withQuality:false}).impossible;
      }
      return {rate:both?same/both:0,both,impossible};
    };
    const e17=laneEcho(r17),e18=laneEcho(r18);
    ok('足した小節で、元の小節と同じ形になる割合が上がる(10ポイント以上)',e18.rate>=e17.rate+.10,`Rev.17 ${(e17.rate*100).toFixed(0)}% → Rev.18 ${(e18.rate*100).toFixed(0)}%`);
    ok('押せない配置を作らない',e18.impossible===0,`${e18.impossible}件`);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.18(繰り返しの見分け)は期待どおり');
process.exit(failed?1:0);
