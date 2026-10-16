// 譜面づくりの「引き出し」(2026-10-16 社長の決定・参考動画 docs/playbot/reports/2026-10-16/floor3d/CHART_FROM_REF.md の R1〜R5)。
//
// 社長「曲によって変えてほしいから、参考として学習してほしいけど、全てを当てはめるわけではないからね」。
// どれも「決まり」として全曲に当てはめない。曲の解析(区切り・盛り上がり・テンポ・長さ)を見て、合う曲・合う区間にだけ使う。
// 使う/使わないと、その理由は生成の記録(生成器の書き出し・rhythm-hell-mix.js の表示)に残す。
// 学んだこと(参考ではこう・どういう曲なら使う・使わない曲の例)は tools/mode/CHART_DRAWERS.md
//
//   R1 密度の形を数える … 全曲で数えるだけ(densityShape・rhythm-density-shape.js)。譜面は変えない
//   R2 入りを軽く・後半を重く … 生成器(MASTER・HELL)。入りが静かで山が後半にある曲だけ。量は曲の盛り上がりの差から決める
//   R3 空中スライドの見せ場 … rhythm-hell-mix.js。いちばん盛り上がる区切りに、両手のスライドがそろっている曲だけ
//   R4 片手地上・片手空中の流れを長めに … rhythm-hell-mix.js。同じ盛り上がりが長く続く区切りだけ
//   R5 終わりを空中スライド2本で締める … rhythm-hell-mix.js。盛り上がったまま終わり、最後に両手のスライドがある曲だけ
'use strict';

const median=list=>{const s=list.slice().sort((a,b)=>a-b);if(!s.length)return 0;const m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const round=(x,k=2)=>Math.round(x*10**k)/10**k;

// 曲の形(解析ファイル *-v3-audio.json の structure.sections から)
const songShape=audio=>{
  const sections=((audio&&audio.structure&&audio.structure.sections)||[])
    .filter(s=>Number.isFinite(Number(s.startMs))&&Number.isFinite(Number(s.endMs))&&Number.isFinite(Number(s.intensity)))
    .slice().sort((a,b)=>a.startMs-b.startMs);
  if(!sections.length)return null;
  const startMs=sections[0].startMs,endMs=sections[sections.length-1].endMs,span=Math.max(1,endMs-startMs);
  const pos=ms=>(ms-startMs)/span;
  const intensities=sections.map(s=>Number(s.intensity));
  // 本編の目安: 最初と最後の区切りを除いた盛り上がりの中央(区切りが3つ未満なら全部)
  const body=sections.length>=3?intensities.slice(1,-1):intensities;
  const bodyMedian=median(body),maxI=Math.max(...intensities);
  const peak=sections[intensities.indexOf(maxI)];
  const beatMs=Number(audio.timing&&audio.timing.beatMs)||500;
  return {sections,startMs,endMs,span,pos,bodyMedian,maxI,peak,beatMs,first:sections[0],last:sections[sections.length-1]};
};

// R1: 密度の形(時刻の並び → 入り/本編/後半/いちばん濃い10秒)。入り=最初の15%・後半=最後の30%・本編=そのあいだ
const densityShape=times=>{
  const t=times.filter(Number.isFinite).slice().sort((a,b)=>a-b);
  if(t.length<10)return null;
  const a=t[0],b=t[t.length-1],span=Math.max(1,b-a);
  const rate=(from,to)=>t.filter(x=>x>=from&&x<to).length/Math.max(.001,(to-from)/1000);
  const intro=rate(a,a+span*.15),body=rate(a+span*.15,a+span*.7),late=rate(a+span*.7,b+1);
  let peak=0,peakAt=a;for(let i=0,j=0;i<t.length;i++){while(t[i]-t[j]>10000)j++;if(i-j+1>peak){peak=i-j+1;peakAt=t[j];}}
  return {notes:t.length,seconds:round(span/1000,1),intro:round(intro),body:round(body),late:round(late),
    peak10s:round(peak/Math.min(10,span/1000)),peakAtSec:round(peakAt/1000,1),
    introRatio:body>0?round(intro/body):null,lateRatio:body>0?round(late/body):null};
};
// 参考の形(10/16 の参考動画): 入りは本編の約0.4倍・後半が最も高い(後半/本編 約1.1)
const REFERENCE_SHAPE=Object.freeze({introRatio:.4,lateRatio:1.1});

// R2: 入りを軽く・後半を重く(生成器の小節の取り分に掛ける倍率。曲全体のノーツ数は変えない・配り方だけ)
//   使う: 最初の区切りが本編より十分静か(本編の中央の0.7倍以下)で、いちばん盛り上がる区切りが曲の後ろ半分にあり、
//         さらに今の取り分のままだと「入りが重い」か「後半が軽い」曲(もう参考の形に近い曲には掛けない)
//   量: 入りの狙いは本編の 0.4〜0.65倍(入りが静かな曲ほど 0.4 に近い)。後半(最後の30%)は本編の約1.1倍まで、
//       本編より盛り上がる区切りほど重く(1〜1.25倍)
//   weightRate(fromMs,toMs) … 生成器の今の取り分の重み(1秒あたり)
const R2_DIFFICULTIES=new Set(['MASTER','HELL']);
const chooseR2=(audio,difficulty,{weightRate=null}={})=>{
  if(!R2_DIFFICULTIES.has(difficulty))return {id:'R2',use:false,reason:`${difficulty} には使わない(MASTER・HELL だけ)`};
  const S=songShape(audio);if(!S||S.sections.length<3)return {id:'R2',use:false,reason:'区切りが3つ未満で、入りと本編を分けられない'};
  const introI=Number(S.first.intensity),peakPos=S.pos((S.peak.startMs+S.peak.endMs)/2);
  if(!(S.bodyMedian>0))return {id:'R2',use:false,reason:'本編の盛り上がりが読めない'};
  if(introI>S.bodyMedian*.7)return {id:'R2',use:false,reason:`入りから盛り上がっている(入り ${round(introI)}・本編 ${round(S.bodyMedian)})`};
  if(peakPos<.5)return {id:'R2',use:false,reason:`いちばんの山が前半にある(曲の ${Math.round(peakPos*100)}% あたり)`};
  const lateFrom=S.startMs+S.span*.7,introTo=Math.min(S.first.endMs,S.startMs+S.span*.2);
  const rate=weightRate||(()=>1);
  const bodyRate=rate(introTo,lateFrom);
  if(!(bodyRate>0))return {id:'R2',use:false,reason:'本編の取り分が読めない'};
  const introRatio=rate(S.startMs,introTo)/bodyRate,lateRatio=rate(lateFrom,S.endMs+1)/bodyRate;
  const introTarget=clamp(.4+.4*introI/S.bodyMedian,.4,.65);
  const introScale=introRatio>introTarget+.05?round(clamp(introTarget/introRatio,.5,1)):1;
  const lateGain=lateRatio<1.05?clamp(1.1/Math.max(.01,lateRatio),1,1.25):1;
  const lateScale=section=>{const i=Number(section.intensity);if(i<=S.bodyMedian||lateGain<=1)return 1;
    return round(1+(lateGain-1)*clamp((i-S.bodyMedian)/Math.max(.001,S.maxI-S.bodyMedian),0,1));};
  const lateSections=S.sections.filter(s=>s.endMs>lateFrom).map(s=>({startBar:s.startBar,endBarExclusive:s.endBarExclusive,scale:lateScale(s)})).filter(s=>s.scale>1);
  const now=`今の取り分は 入り/本編 ${round(introRatio)}・後半/本編 ${round(lateRatio)}`;
  if(introScale>=1&&!lateSections.length)return {id:'R2',use:false,reason:`入りが静かで山が後半の曲だが、もう参考の形に近い(${now})`};
  return {id:'R2',use:true,introScale,introToMs:Math.round(introTo),lateFromMs:Math.round(lateFrom),lateSections,
    reason:`入りが静か(入り ${round(introI)}・本編 ${round(S.bodyMedian)})で、山が後半(曲の ${Math.round(peakPos*100)}% あたり)。${now} → 入り ×${introScale}`
      +`・後半の盛り上がる区切り ${lateSections.length?'×'+lateSections.map(s=>s.scale).join('/'):'そのまま'}`};
};
// 小節の倍率(生成器の取り分に掛ける)。barStartMs は小節の始まりの時刻
const r2BarScale=(r2,bar,barStartMs)=>{
  if(!r2||!r2.use)return 1;
  if(barStartMs<r2.introToMs)return r2.introScale;
  const s=r2.lateSections.find(x=>bar>=x.startBar&&bar<x.endBarExclusive&&barStartMs>=r2.lateFromMs);
  return s?s.scale:1;
};

// R4: 片手地上・片手空中の流れを長めに(HELL)
//   使う区切り: 入りのあとの、8小節以上続き、盛り上がりが本編の中央以上(同じ勢いが続く所)。その中は2小節ごとに「左手が空 ⇄ 右手が空」だけを回す
//   使わない: 入門の HELL(gentle)・そういう区切りが無い曲
const chooseR4=(audio,{gentle=false}={})=>{
  if(gentle)return {id:'R4',use:false,reason:'空中の入門の HELL(片手の拍の頭だけ空にする作り)なので使わない'};
  const S=songShape(audio);if(!S)return {id:'R4',use:false,reason:'区切りが読めない'};
  // 最初の区切り(入り)は除く(参考でも入りは軽く、この流れは本編のもの)
  const steady=S.sections.filter(s=>s!==S.first&&(s.bars||s.endBarExclusive-s.startBar)>=8&&Number(s.intensity)>=S.bodyMedian);
  if(!steady.length)return {id:'R4',use:false,reason:'同じ勢いが8小節以上続く区切りが無い'};
  // 2小節(8拍)。ただし2小節が5秒を超える遅い曲は1小節半(6拍)
  const phraseBeats=S.beatMs*8>5000?6:8;
  return {id:'R4',use:true,phraseBeats,windows:steady.map(s=>[s.startMs,s.endMs]),
    reason:`同じ勢いが続く区切り ${steady.length}か所(${steady.map(s=>`${(s.startMs/1000).toFixed(0)}〜${(s.endMs/1000).toFixed(0)}秒`).join('・')})で、${phraseBeats}拍ごとに左右の空を入れ替える`};
};

// R3: 空中スライドの見せ場(HELL)。いちばん盛り上がる区切りで、左右の手のスライド(1拍以上)がそれぞれ2本以上あるときだけ
//   slides は {hand, start, end} の並び。見せ場の区間は区切りの中で最大16小節
const chooseR3=(audio,slides,{gentle=false}={})=>{
  if(gentle)return {id:'R3',use:false,reason:'空中の入門の HELL なので使わない'};
  const S=songShape(audio);if(!S)return {id:'R3',use:false,reason:'区切りが読めない'};
  const ranked=S.sections.filter(s=>s!==S.first&&Number(s.intensity)>=Math.max(.5,S.bodyMedian)).sort((a,b)=>b.intensity-a.intensity);
  if(!ranked.length)return {id:'R3',use:false,reason:'本編より盛り上がる区切りが無い'};
  const barMs=S.beatMs*4;
  for(const s of ranked){
    const to=Math.min(s.endMs,s.startMs+barMs*16);
    const inside=slides.filter(x=>x.end-x.start>=S.beatMs-2&&x.start>=s.startMs&&x.start<to);
    const L=inside.filter(x=>x.hand==='L').length,R=inside.filter(x=>x.hand==='R').length;
    if(L>=2&&R>=2)return {id:'R3',use:true,window:[Math.round(s.startMs),Math.round(to)],
      reason:`いちばん盛り上がる区切り(${(s.startMs/1000).toFixed(0)}〜${(to/1000).toFixed(0)}秒・盛り上がり ${round(Number(s.intensity))})に両手のスライドがある(左${L}・右${R})`};
  }
  return {id:'R3',use:false,reason:'盛り上がる区切りに、両手のスライドがそろっていない(足すとノーツが増えるので作らない)'};
};

// R5: 終わりを空中スライド2本で締める(HELL)。最後の区切りが盛り上がったまま(山の0.7倍以上)で、
//   曲の最後の2小節に左右の手のスライドが1本ずつあるときだけ(ノーツは足さない)
const chooseR5=(audio,slides,lastNoteMs,{gentle=false}={})=>{
  if(gentle)return {id:'R5',use:false,reason:'空中の入門の HELL なので使わない'};
  const S=songShape(audio);if(!S)return {id:'R5',use:false,reason:'区切りが読めない'};
  if(Number(S.last.intensity)<S.maxI*.7)return {id:'R5',use:false,reason:`静かに終わる曲(最後の区切り ${round(Number(S.last.intensity))}・山 ${round(S.maxI)})。余韻で締める`};
  const from=lastNoteMs-S.beatMs*8;
  const pick=hand=>slides.filter(x=>x.hand===hand&&x.end>=from).sort((a,b)=>b.end-a.end)[0]||null;
  const L=pick('L'),R=pick('R');
  if(!L||!R)return {id:'R5',use:false,reason:'最後の2小節に左右のスライドがそろっていない(足すとノーツが増えるので作らない)'};
  return {id:'R5',use:true,slides:[L,R],reason:`盛り上がったまま終わる(最後の区切り ${round(Number(S.last.intensity))}・山 ${round(S.maxI)})。最後の左右のスライドを空へ上げる`};
};

const drawerLine=d=>`${d.id} ${d.use?'使う':'使わない'}: ${d.reason}`;

module.exports={songShape,densityShape,REFERENCE_SHAPE,chooseR2,r2BarScale,chooseR3,chooseR4,chooseR5,drawerLine};
