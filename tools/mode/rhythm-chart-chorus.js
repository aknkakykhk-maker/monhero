#!/usr/bin/env node
// サビを見つける(2026-11-11・MHB CHART ENGINE Rev.38。社長「1→2→3 の順で」=サビ見つけ → 盛り上がりに合わせた配り → 同じ動機は同じ手)。
//
//   node tools/mode/rhythm-chart-chorus.js --track <曲>     # 区切りごとの「サビらしさ」と、サビ・サビ前と見た区切りを出す
//   node tools/mode/rhythm-chart-chorus.js --all            # 一覧の全曲の要約(サビの数・曲に占める割合)
//
// 【なぜ要るか】それまでの生成器は「盛り上がり」を音の大きさの順位(解析の intensity)だけで見ていた。
//   大きさだけだと、音数の多い静かな入り(ヒューマノイドの頭)や、音が大きいだけの間奏を取り違える。人が譜面を作るときは「ここがサビ」と分かったうえで、
//   見せ場をサビへ集め、サビの前で一度引いて溜めを作る。
// 【決め方】解析ファイル(<曲>-v3-audio.json)と音の層の解析(<曲>-v3-layers.json・あれば)だけを読む。解析は作り直さない。
//   区切り(structure.sections)ごとに、5つの手がかりを曲の中の順位(0〜1)にして重みを付けて足す:
//     大きさ(intensity)                .30 … サビは曲の中で大きい
//     繰り返し(同じ材料が別の所にもある) .25 … サビは2回以上出る(4小節ずつの見分け rhythm-chart-repeats.js と区切りの名札の両方)
//     歌・主旋律の帯の強さ(lead)        .20 … サビは歌が前に出る(層の解析が無ければ使わず、ほかの重みを広げる)
//     音の厚み(大きな一発 FULL の割合+高い帯) .15 … シンバル・厚い伴奏
//     位置                             .10 … 曲の頭の区切りはサビではない。最後の3割は少し足す(ラスサビ)
//   いちばん高い点の 85% 以上で、長さが4小節以上・入りではない区切りを「サビ」とする。サビの直前の区切りの最後の2小節を「サビ前(溜め)」とする。
//   名札(サビ・Aメロ)を外へ出して決めつけない。使う側は小節ごとの点数(0〜1)を読む。
// 【外れたとき】点数の差が小さい曲(はっきりしたサビの無い曲・ずっと同じ調子の曲)は confident:false を返す。使う側はそのとき大きさだけの今までの見方へ戻る。
// 乱数を使わない。同じ入力なら毎回同じ結果。
'use strict';
const fs=require('fs'),path=require('path');
const {detectRepeats}=require('./rhythm-chart-repeats.js');

const W={loud:.30,repeat:.25,lead:.20,thick:.15,place:.10};
const CHORUS_RATIO=.85,MIN_BARS=4,PRE_BARS=2,CONFIDENT_SPREAD=.2;
const rankOf=values=>{const sorted=values.slice().sort((a,b)=>a-b),n=values.length;return values.map(v=>n>1?(sorted.filter(x=>x<v).length+sorted.filter(x=>x<=v).length-1)/2/(n-1):.5);};

const detectChorus=(audio,layers=null)=>{
  const sections=(audio.structure&&audio.structure.sections)||[],timing=audio.timing,BAR=timing.subdivisionsPerBeat*timing.beatsPerBar;
  const none={confident:false,sections:[],chorusBars:new Set(),preBars:new Set(),scoreByBar:new Map(),reason:'区切りが3つ未満'};
  if(sections.length<3)return none;
  const repeats=detectRepeats(audio,layers).sourceByBar,sources=new Set(repeats.values());
  const labelCount=new Map();for(const s of sections)labelCount.set(s.label,(labelCount.get(s.label)||0)+1);
  const layerMean=(key,s)=>{if(!layers||!layers.series||!Array.isArray(layers.series[key]))return null;const list=layers.series[key],first=layers.grid.firstGrid;let sum=0,n=0;
    for(let g=s.startBar*BAR;g<s.endBarExclusive*BAR;g++){const i=g-first;if(i>=0&&i<list.length){sum+=list[i];n++;}}return n?sum/n:null;};
  const onsets=audio.onsets||[],total=sections.reduce((a,s)=>a+s.bars,0);let before=0;
  const raw=sections.map((s,index)=>{
    const inside=onsets.filter(o=>o.grid>=s.startBar*BAR&&o.grid<s.endBarExclusive*BAR);
    let rep=0;for(let b=s.startBar;b<s.endBarExclusive;b++)if(repeats.has(b)||sources.has(b))rep++;
    const start=before/total;before+=s.bars;
    return {index,loud:Number(s.intensity)||0,repeat:Math.max(rep/Math.max(1,s.bars),labelCount.get(s.label)>1?.6:0),lead:layerMean('lead',s),
      thick:(inside.length?inside.filter(o=>o.character==='FULL').length/inside.length:0)+(layerMean('high',s)||0)*.5,
      place:index===0?0:start>=.7?1:.6};});
  const hasLead=raw.every(r=>r.lead!=null),weights={...W};
  if(!hasLead){const spread=W.lead/(1-W.lead);for(const k of ['loud','repeat','thick','place'])weights[k]=W[k]*(1+spread);weights.lead=0;}
  const ranks={loud:rankOf(raw.map(r=>r.loud)),lead:hasLead?rankOf(raw.map(r=>r.lead)):raw.map(()=>0),thick:rankOf(raw.map(r=>r.thick))};
  const scored=sections.map((s,i)=>({label:s.label,startBar:s.startBar,endBarExclusive:s.endBarExclusive,startMs:s.startMs,endMs:s.endMs,bars:s.bars,intensity:s.intensity,
    parts:{loud:ranks.loud[i],repeat:raw[i].repeat,lead:hasLead?ranks.lead[i]:null,thick:ranks.thick[i],place:raw[i].place},
    score:weights.loud*ranks.loud[i]+weights.repeat*raw[i].repeat+weights.lead*ranks.lead[i]+weights.thick*ranks.thick[i]+weights.place*raw[i].place}));
  const max=Math.max(...scored.map(s=>s.score)),min=Math.min(...scored.map(s=>s.score));
  for(const s of scored){s.score=Math.round(s.score*1000)/1000;s.chorus=s.score>=max*CHORUS_RATIO&&s.bars>=MIN_BARS&&s.startBar!==sections[0].startBar;}
  // はっきりしているか: いちばん高い点と、サビでない区切りの平均の点の差。差が小さい曲は、サビを決めつけない
  const rest=scored.filter(s=>!s.chorus),median=rest.length?rest.reduce((a,s)=>a+s.score,0)/rest.length:max;// サビでない区切りの平均
  const chorusShare=scored.filter(s=>s.chorus).reduce((a,s)=>a+s.bars,0)/total;
  const confident=max-median>=CONFIDENT_SPREAD&&scored.some(s=>s.chorus)&&chorusShare<=.6;
  const chorusBars=new Set(),preBars=new Set(),scoreByBar=new Map();
  scored.forEach((s,i)=>{const norm=max>min?(s.score-min)/(max-min):.5;for(let b=s.startBar;b<s.endBarExclusive;b++){scoreByBar.set(b,norm);if(s.chorus)chorusBars.add(b);}
    // サビ前: サビでない区切りがサビの直前にあるとき、その最後の2小節
    if(s.chorus&&i>0&&!scored[i-1].chorus){s.preOf=true;for(let b=Math.max(scored[i-1].startBar,s.startBar-PRE_BARS);b<s.startBar;b++)preBars.add(b);}});
  return {confident,sections:scored,chorusBars,preBars,scoreByBar,chorusShare:Math.round(chorusShare*100)/100,spread:Math.round((max-median)*100)/100,usedLead:hasLead,
    reason:confident?'':(chorusShare>.6?'サビと見た区切りが曲の6割を超える(ずっと同じ調子)':'点数の差が小さい(はっきりしたサビが無い)')};
};

// 解析ファイルと層の解析を読んで見つける(層の解析は、いまの解析ファイルに合うものだけ使う。生成器と同じ決まり)
const chorusForTrack=(track,dir=path.join(__dirname,'authoring'))=>{
  const dashed=String(track).replace(/_/g,'-'),audioFile=path.join(dir,`${dashed}-v3-audio.json`),layersFile=path.join(dir,`${dashed}-v3-layers.json`);
  const audio=JSON.parse(fs.readFileSync(audioFile,'utf8'));let layers=null;
  try{const data=JSON.parse(fs.readFileSync(layersFile,'utf8')),sha=require('crypto').createHash('sha256').update(fs.readFileSync(audioFile)).digest('hex');if(data.basedOn&&data.basedOn.sha256===sha)layers=data;}catch(e){layers=null;}
  return {audio,layers,chorus:detectChorus(audio,layers)};
};
module.exports={detectChorus,chorusForTrack,CHORUS_RATIO,PRE_BARS};

if(require.main===module){
  const args=process.argv.slice(2),argOf=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:null;};
  const fmt=ms=>{const s=ms/1000;return `${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,'0')}`;};
  if(args.includes('--all')){const songs=JSON.parse(fs.readFileSync(path.join(__dirname,'authoring','rhythm-song-registry.json'),'utf8')).songs;
    for(const track of Object.keys(songs)){try{const {chorus:c}=chorusForTrack(track);console.log(`${track.padEnd(30)} ${c.confident?'○':'×'} 区切り${String(c.sections.length).padStart(2)} サビ${String(c.sections.filter(s=>s.chorus).length).padStart(2)} 割合${String(c.chorusShare??'-').padStart(5)} 差${String(c.spread??'-').padStart(5)} ${c.sections.filter(s=>s.chorus).map(s=>fmt(s.startMs)).join(' ')} ${c.reason}`);}catch(e){console.log(`${track.padEnd(30)} 読めない: ${e.message.slice(0,60)}`);}}
  }else{const track=argOf('--track');if(!track){console.error('--track <曲> か --all');process.exit(1);}
    const {chorus:c}=chorusForTrack(track);
    console.log(`${track}: ${c.confident?'サビがはっきりしている':`サビを決めつけない(${c.reason})`}・サビの割合 ${c.chorusShare}・点数の差 ${c.spread}・歌の帯 ${c.usedLead?'使った':'層の解析が無いので使わない'}`);
    for(const s of c.sections)console.log(`  ${s.chorus?'★サビ':s.preOf?'    ':'    '} ${s.label} ${fmt(s.startMs)}〜${fmt(s.endMs)} ${String(s.bars).padStart(2)}小節  点 ${s.score.toFixed(3)}  大きさ ${s.parts.loud.toFixed(2)} 繰り返し ${s.parts.repeat.toFixed(2)} 歌 ${s.parts.lead==null?' - ':s.parts.lead.toFixed(2)} 厚み ${s.parts.thick.toFixed(2)} 位置 ${s.parts.place}`);
    if(c.preBars.size)console.log(`  サビ前(溜め)の小節: ${[...c.preBars].join(' ')}`);}
}
