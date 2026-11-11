#!/usr/bin/env node
// HELL の「作り」の点検(2026-11-11・ジゴク)。押せるか・同じ親指の持ち替えが無理でないか・音に合っているか・曲の盛り上がりに沿っているかを数える。読むだけ。
//
//   node tools/mode/rhythm-hell-review.js                       # 公開中の HELL 全譜面を点検(気になる順に上位だけ。--top 20・--all で全部)
//   node tools/mode/rhythm-hell-review.js --song <曲id>         # 公開中の1譜面
//   node tools/mode/rhythm-hell-review.js --compare <曲id>[,…]  # その曲の HELL を「精度の強化」の入/切で作り比べる(書かない。1曲 約1分)
//   --json <ファイル>  表を JSON で書き出す
//
// 【見るもの】
//   速い持ち替え … 同じ側で150ms以内に高さが変わる(sw150)・押さえていない手の速い切り替え(heldSw)・同じ側の地上から250ms以内の空中(sky250)
//   音からの外れ … 押し始めが解析の音(onsets)から60msより離れているノーツの割合
//   盛り上がり   … 4小節ごとの盛り上がり(解析の intensity)と、ノーツの量・空中の量の順位の相関(1に近いほど沿っている・0は関係なし)
//   決まり       … 押せない・水平クロス・帯の中・見分けにくい所・指が同じ位置に来る形・モンスター(--compare のとき)
// 【2026-11-11 に数えたこと】公開中の HELL 56譜面: 音からの外れは平均 1%・量の合い方 0.52・**空中の量の合い方 0.01**(空中の回し方が順番だったため)。
//   → rhythm-hell-mix.js の precision(盛り上がりで回す・交差を盛り上がる所から・速い持ち替えを下ろす)。本文: docs/rules/CHART_ENGINE.md
'use strict';
const fs=require('fs'),path=require('path');
const HR=require('./rhythm-chart-hand-rules.js'),H=require('./rhythm-hell-level.js'),L=require('./rhythm-chart-level.js');
const AUTHORING=path.join(__dirname,'authoring');
const rank=v=>{const o=v.map((x,i)=>[x,i]).sort((p,q)=>p[0]-q[0]),r=[];o.forEach(([,i],k)=>r[i]=k);return r;};
const rankCorr=(a,b)=>{const n=a.length;if(n<4)return null;a=rank(a);b=rank(b);const m=(n-1)/2;let sab=0,sa=0,sb=0;for(let i=0;i<n;i++){sab+=(a[i]-m)*(b[i]-m);sa+=(a[i]-m)**2;sb+=(b[i]-m)**2;}return Math.round(sab/Math.sqrt(sa*sb||1)*100)/100;};
const isSky=n=>HR.levelAt(n,n.timeMs)>=.5;
const OFF_MS=60,BLOCK_BARS=4;

// ゲームが読む形のノーツと解析から数える
const measure=(notes,audio)=>{
  const rt=notes.slice().sort((a,b)=>a.timeMs-b.timeMs),res=HR.analyze(rt);
  const out={notes:rt.length,sky:rt.filter(isSky).length,sw150:res.sideHeightSwitch.length,heldSw:res.heldHandSwitch.length,sky250:res.skyAfterGround.length,
    flatCross:HR.flatCross(rt).length,heldBand:HR.heldBandBlocked(rt).length,confuse:HR.skyConfusable(rt).length,samePlace:HR.samePlace(rt).length,
    monsters:rt.filter(n=>n.monsterSlot).length,offSound:null,energyNotes:null,energySky:null};
  if(audio&&Array.isArray(audio.onsets)&&audio.structure&&Array.isArray(audio.structure.bars)){
    const on=audio.onsets.map(o=>o.timeMs),starts=[...new Set(rt.map(n=>n.timeMs))];let miss=0,j=0;
    for(const t of starts){while(j<on.length-1&&on[j+1]<=t)j++;const d=Math.min(Math.abs(on[j]-t),j+1<on.length?Math.abs(on[j+1]-t):Infinity);if(d>OFF_MS)miss++;}
    out.offSound=Math.round(miss/Math.max(1,starts.length)*100)/100;
    const bars=audio.structure.bars,xs=[],ns=[],ss=[];
    for(let i=0;i+BLOCK_BARS-1<bars.length;i+=BLOCK_BARS){const a=bars[i].startMs,b=bars[i+BLOCK_BARS-1].endMs,nn=rt.filter(n=>n.timeMs>=a&&n.timeMs<b);if(!nn.length)continue;
      xs.push(bars.slice(i,i+BLOCK_BARS).reduce((q,x)=>q+(Number(x.intensity)||0),0));ns.push(nn.length);ss.push(nn.filter(isSky).length);}
    out.energyNotes=rankCorr(xs,ns);out.energySky=rankCorr(xs,ss);
  }
  return out;
};
const trackOf=songId=>{const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');return RELEASED_TRACKS[songId]||songId;};
const readAudio=track=>{const f=path.join(AUTHORING,`${String(track).replace(/_/g,'-')}-v3-audio.json`);return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):null;};
const releasedRows=()=>H.hellCharts().map(c=>{const id=c.songId.replace(/_hell_debug$|_hell$/,'');return {songId:id,...measure(c.chart.notes,readAudio(trackOf(id)))};});
// 気になる順: 速い持ち替えの数 + 空中が盛り上がりに沿っていない分
const worry=r=>r.sw150*2+r.heldSw*2+r.sky250+(r.energySky==null?0:Math.max(0,.3-r.energySky)*20)+(r.offSound||0)*50;

// 精度の強化の入/切で作り比べる(rhythm-hell-mix.js の SONGS にある source:'audio' の曲)
const compare=songId=>{
  const M=require('./rhythm-hell-mix.js'),{thumbCheck}=require('./rhythm-ref-tiers.js'),conf=M.SONGS[songId];
  if(!conf||conf.source!=='audio')throw new Error(`${songId} は rhythm-hell-mix.js の SONGS に source:'audio' で無い`);
  const track=conf.track||songId,audio=readAudio(track),drawersOn=conf.drawers!==false;
  const draft=M.audioDraft(track,conf.variant||0,drawersOn,Number.isFinite(conf.hellDensity)?conf.hellDensity:null);
  const run=precision=>{const hell=M.mixBest(JSON.parse(JSON.stringify(draft)),{...conf,precision,mixedWindows:[],audio,drawersOn,drawerIds:null,keepMixed:false}),rt=M.toRuntime(hell);
    const th=thumbCheck(hell,M.HELL_LANDSCAPE,conf.beat).issues.filter(i=>!(hell.crossWindows||[]).some(([a,b])=>i.t>=a&&i.t<=b));
    const v4=H.hellLevel({notes:rt});
    return {...measure(rt,audio),impossible:th.filter(i=>i.kind==='impossible').length,cross:th.filter(i=>i.kind==='cross').length,crossWindows:(hell.crossWindows||[]).length,
      v3:L.chartLevel({notes:rt}).level,v4:v4?v4.level:null,settle:hell.settle||null};};
  return {songId,off:run(false),on:run(true)};
};

module.exports={measure,releasedRows,compare,worry,rankCorr,OFF_MS};

if(require.main===module){
  const args=process.argv.slice(2),argOf=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};
  const f=v=>v==null?'—':typeof v==='number'&&!Number.isInteger(v)?v.toFixed(2):String(v);
  const jsonOut=argOf('--json');
  if(argOf('--compare')){
    const KEYS=[['notes','ノーツ'],['sky','空中'],['v3','Lv.(v3)'],['v4','Lv.(v4)'],['impossible','押せない'],['cross','交差'],['sw150','150ms以内の持ち替え'],['heldSw','押さえていない手の速い切り替え'],['sky250','250ms以内の空中'],
      ['flatCross','水平クロス'],['heldBand','帯の中'],['confuse','見分けにくい'],['samePlace','同じ位置'],['monsters','モンスター'],['crossWindows','交差の見せ場'],['offSound','音からの外れ'],['energyNotes','量と盛り上がり'],['energySky','空中と盛り上がり']];
    const all=[];
    for(const id of argOf('--compare').split(',').filter(Boolean)){const r=compare(id);all.push(r);
      console.log(`■ ${id}(精度の強化 切 → 入)`);
      console.log('  '+KEYS.map(([k,label])=>`${label} ${f(r.off[k])}→${f(r.on[k])}`).join(' / '));
      if(r.on.settle)console.log(`  仕上げ: 速い持ち替え ${r.on.settle.before}→${r.on.settle.after}件(空中のタップ ${r.on.settle.lowered}個を地上へ)`);}
    if(jsonOut)fs.writeFileSync(path.resolve(jsonOut),JSON.stringify(all,null,1));
    process.exit(0);
  }
  let rows=releasedRows();const song=argOf('--song');if(song)rows=rows.filter(r=>r.songId===song);
  if(jsonOut)fs.writeFileSync(path.resolve(jsonOut),JSON.stringify(rows,null,1));
  const list=rows.slice().sort((a,b)=>worry(b)-worry(a)),show=args.includes('--all')||song?list:list.slice(0,Number(argOf('--top'))||12);
  console.log('曲'.padEnd(32)+'ノーツ 空中 sw150 heldSw sky250 音外れ 量の合い方 空中の合い方');
  for(const r of show)console.log(r.songId.padEnd(32)+[r.notes,r.sky,r.sw150,r.heldSw,r.sky250].map(v=>String(v).padStart(6)).join('')+f(r.offSound).padStart(7)+f(r.energyNotes).padStart(9)+f(r.energySky).padStart(11));
  const avg=k=>{const v=rows.map(r=>r[k]).filter(x=>x!=null);return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2):'—';};
  if(!song)console.log(`${rows.length}譜面の平均: 音からの外れ ${avg('offSound')}・量の合い方 ${avg('energyNotes')}・空中の合い方 ${avg('energySky')} / 速い持ち替えの合計 sw150 ${rows.reduce((a,r)=>a+r.sw150,0)}・heldSw ${rows.reduce((a,r)=>a+r.heldSw,0)}・sky250 ${rows.reduce((a,r)=>a+r.sky250,0)}`);
}
