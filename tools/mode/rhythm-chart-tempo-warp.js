#!/usr/bin/env node
// テンポの揺れ(2026-09-29・MHB CHART ENGINE Rev.21・ユーザー判断「1と2を入れてから作り直す」)。
//
//   node tools/mode/rhythm-chart-tempo-warp.js            # 一覧の曲を全部見て、揺れに合わせる曲と揺れの幅を出す(読むだけ)
//
// 【なぜ要るか】
// 譜面は1曲を1つのテンポの格子で作る。人が演奏した音源や、テンポを少しずつ動かして作った曲では、
// 曲の途中で音が格子より前・後ろへゆっくりずれていく。たとえば SIX ÉTERNEL Remix(ビート版)は、4小節ごとに
// 強い打点のずれを測ると +19ms → -20ms → +28ms と曲の中でなめらかに動いていて、ノーツが音より最大20ms以上早い・遅い所があった。
//
// 【決め方】音源解析(*-v3-audio.json)は読むだけ(書き換えない)。
//   1. 強さがその曲の中央値以上で、低音が半分未満の打点(低音は解析の窓の長さで遅れて見える。rhythm-chart-low-lag.js)を使う
//   2. WARP_BARS 小節ごとに、格子からのずれを円の平均で出す(格子の間隔を1周とする。まとまり R が WARP_MIN_R 以上の区間だけ)
//   3. 隣の区間とつながるように位相をほどき、3つずつの中央値でならす
//   4. **なめらかな揺れのときだけ**使う。隣どうしの差の中央値が WARP_MAX_STEP_MS 以下・いちばん大きい差が WARP_MAX_JUMP_MS 以下
//      (途中で段差のように跳ぶのは、揺れではなく解析のぶれ)で、幅が WARP_MIN_RANGE_MS 以上。
//      ほとんどの曲の区間ごとのずれは、隣と関係なく跳ねる(解析の打点のぶれ)ので、そういう曲は1音も変わらない
//   5. 本物の揺れかを確かめる。8小節ずつ交互に半分へ分け、片方の半分から測った揺れを残りの半分の打点に当てて、
//      格子からのずれのばらつきが WARP_HOLDOUT_RATIO 以下に減るときだけ使う(解析のぶれなら、当てるとむしろ増える)。
//      実測: SIX ÉTERNEL Remix(ビート版) 13.9→6.9ms・The City Beneath the Comets 6.8→4.6ms。条件で外れた曲に当てると
//      eiki_boss 17.5→26.1ms・戦場の疾風 19.8→22.7ms と悪くなる
//   6. 曲全体の中央値を引く(拍の頭は人が決めた値のまま。直すのは「揺れ」だけ)
// 生成器は打点の時刻からこの揺れを引いてから格子に乗せ(候補の絞り込みが揺れで外れないように)、
// パイプラインは書き出すノーツの時刻に揺れを足す。仮想プレイヤーも同じ時刻で遊ぶ。
'use strict';
const fs=require('fs'),path=require('path');
const {lowLagOf}=require('./rhythm-chart-low-lag.js');

const WARP_REVISION=21;
// Rev.23: 読み方の v2(細かい区間・低音の遅れが小さい曲は低音も使う・動かす所だけで確かめる・残りのずれを格子で折り返す・揺れの上限)。
// v2 で当たらない曲は Rev.21 の読み方のまま(Rev.21 で揺れに合わせていた曲が外れないように)
const WARP_V2_REVISION=23;
const WARP_BARS=4,WARP_MIN_ONSETS=8,WARP_MIN_R=.6,WARP_MIN_WINDOWS=6,WARP_MAX_STEP_MS=8,WARP_MAX_JUMP_MS=20,WARP_MIN_RANGE_MS=20;
// 半分の区間から測った揺れで、残りの半分の打点のずれのばらつき(中央値からの差の中央値)がこの割合以下に減ること
const WARP_HOLDOUT_RATIO=.9;
// Rev.21 の設定(公開中の曲はこれで作ったので変えない)
const WARP_V1=Object.freeze({bars:WARP_BARS,minOnsets:WARP_MIN_ONSETS,minWindows:WARP_MIN_WINDOWS,maxStep:WARP_MAX_STEP_MS,maxJump:WARP_MAX_JUMP_MS,wrapResidual:false});
// Rev.23 の設定(下の WARP_V2_REVISION)。2小節ずつの細かい区間で見て、確かめの残りのずれを格子の間隔で折り返す
let WARP_V2=Object.freeze({bars:2,minOnsets:5,minWindows:8,maxStep:8,maxJump:30,wrapResidual:true,moveMs:8,minHoldout:30,lowLagMaxMs:15,maxAbsRatio:.45});

const round=(value,digits=1)=>Math.round(value*10**digits)/10**digits;
// Rev.26: 曲のつなぎ目の段差(2026-10-03)。元の曲の録音を切り貼りした版では、つなぎ目から先の拍が、つなぎ目の前の格子から
// 一定の量だけずれる(Stay With Me の short ver. は 89.0秒から先が -278.7ms、綺季一閃の short ver. は 101.0秒から先が -225.6ms。
// どちらも小節の頭をそろえたときのずれ)。なめらかな揺れ(下の tempoWarp)は段差を「解析のぶれ」として使わないので、
// 人が測ったつなぎ目を音源の一覧(rhythm-song-registry.json)の `splices:[{atMs,shiftMs}]` に書き、その曲だけ段差として使う。
// shiftMs は「本当の拍の時刻 − つなぎ目の前の格子を延ばした時刻」(テンポの揺れの at と同じ向き)
const SPLICE_REVISION=26;
const REGISTRY_FILE=path.join(__dirname,'authoring','rhythm-song-registry.json');
const splicesOf=trackId=>{
  try{
    const entry=JSON.parse(fs.readFileSync(REGISTRY_FILE,'utf8')).songs[trackId];
    const list=entry&&Array.isArray(entry.splices)?entry.splices:[];
    return list.map(s=>({atMs:Number(s.atMs),shiftMs:Number(s.shiftMs)})).filter(s=>Number.isFinite(s.atMs)&&Number.isFinite(s.shiftMs)).sort((a,b)=>a.atMs-b.atMs);
  }catch{return [];}
};
const spliceWarp=audio=>{
  const timing=audio&&audio.timing;
  const splices=audio&&audio.trackId?splicesOf(audio.trackId):[];
  if(!timing||!splices.length)return null;
  const gridMs=Number(timing.gridMs)||timing.beatMs/timing.subdivisionsPerBeat;
  const zero=Number(timing.beatZeroMs)||0;
  // 格子の番号から時刻を出し、その時刻より前で最後のつなぎ目のずれを返す
  const at=grid=>{const ms=zero+grid*gridMs;let shift=0;for(const s of splices)if(ms>=s.atMs)shift=s.shiftMs;return shift;};
  return {active:true,version:'splice',points:splices,rangeMs:round(Math.max(...splices.map(s=>Math.abs(s.shiftMs)))),
    reason:`曲のつなぎ目(${splices.map(s=>`${round(s.atMs/1000,1)}秒から ${s.shiftMs>0?'+':''}${round(s.shiftMs)}ms`).join('・')})`,at};
};
const median=list=>{const sorted=[...list].sort((a,b)=>a-b);return sorted.length?sorted[sorted.length>>1]:0;};

// options.force: なめらかさ・幅の条件を見ずに揺れを返す(検査で、半分の区間から測った揺れを残りの半分に当てて確かめるため)
const tempoWarp=(audio,options={})=>{
  const V=options.v2?WARP_V2:WARP_V1;
  const none=reason=>({active:false,reason,points:[],rangeMs:0,at:()=>0});
  const timing=audio&&audio.timing;
  if(!timing||!Array.isArray(audio.onsets))return none('解析が無い');
  const gridMs=Number(timing.gridMs)||timing.beatMs/timing.subdivisionsPerBeat;
  const bar=Number(timing.subdivisionsPerBeat)*Number(timing.beatsPerBar);
  if(!(gridMs>0)||!(bar>0))return none('格子が無い');
  const floor=median(audio.onsets.map(onset=>Number(onset.strength)||0));
  // v2: 低音の遅れ(rhythm-chart-low-lag.js・低音と他の音の位相の差)が小さい曲は、低音の打点も揺れの材料にする。
  //     ビッグブリッヂの死闘のイントロは強い打点のほとんどが低音で、低音を除くと小節に1〜2個しか残らなかった(遅れは -8.7ms)
  const useLow=!!(options.v2&&V.lowLagMaxMs&&Math.abs(Number(lowLagOf(audio,{beatZeroMs:Number(timing.beatZeroMs)||0,gridMs}).detectedMs)||0)<=V.lowLagMaxMs);
  const skipLow=onset=>!useLow&&onset.share&&onset.share.low>=.5;
  const windows=new Map();
  for(const onset of audio.onsets){
    const strength=Number(onset.strength)||0;
    if(strength<floor||skipLow(onset))continue;
    const index=Math.floor(onset.grid/bar/V.bars);
    const phase=2*Math.PI*Number(onset.gridOffsetMs)/gridMs;
    const entry=windows.get(index)||{c:0,s:0,weight:0,count:0};
    entry.c+=strength*Math.cos(phase);entry.s+=strength*Math.sin(phase);entry.weight+=strength;entry.count++;
    windows.set(index,entry);
  }
  let rows=[...windows].sort((a,b)=>a[0]-b[0])
    .filter(([,e])=>e.count>=V.minOnsets&&Math.hypot(e.c,e.s)/e.weight>=WARP_MIN_R)
    .map(([index,e])=>({grid:(index+.5)*V.bars*bar,ms:Math.atan2(e.s,e.c)*gridMs/2/Math.PI}));
  if(rows.length<V.minWindows)return none(`ずれを測れる区間が${rows.length}個しか無い`);
  // 位相をほどく(格子の間隔の半分より大きく跳ねたら、1周ぶん戻す)
  for(let i=1;i<rows.length;i++){
    while(rows[i].ms-rows[i-1].ms>gridMs/2)rows[i].ms-=gridMs;
    while(rows[i].ms-rows[i-1].ms<-gridMs/2)rows[i].ms+=gridMs;
  }
  rows=rows.map((row,i)=>({grid:row.grid,ms:median(rows.slice(Math.max(0,i-1),i+2).map(r=>r.ms))}));
  const steps=rows.slice(1).map((row,i)=>Math.abs(row.ms-rows[i].ms));
  const step=median(steps);
  const center=median(rows.map(row=>row.ms));
  const points=rows.map(row=>({grid:round(row.grid,1),ms:round(row.ms-center)}));
  const rangeMs=round(Math.max(...points.map(p=>p.ms))-Math.min(...points.map(p=>p.ms)));
  const at=grid=>{
    if(grid<=points[0].grid)return points[0].ms;
    const last=points[points.length-1];
    if(grid>=last.grid)return last.ms;
    let i=1;while(points[i].grid<grid)i++;
    const a=points[i-1],b=points[i];
    return a.ms+(b.ms-a.ms)*(grid-a.grid)/(b.grid-a.grid);
  };
  if(options.force)return {active:true,reason:'条件を見ない(検査用)',points,rangeMs,stepMs:round(step),at};
  if(step>V.maxStep)return {...none(`区間ごとのずれが隣と関係なく跳ねる(隣との差の中央値 ${round(step)}ms)`),rangeMs};
  const jump=Math.max(...steps);
  if(jump>V.maxJump)return {...none(`途中で段差のように跳ぶ(隣との差の最大 ${round(jump)}ms)`),rangeMs};
  if(rangeMs<WARP_MIN_RANGE_MS)return {...none(`揺れが小さい(幅 ${rangeMs}ms)`),rangeMs};
  // v2: 揺れは格子の間隔の V.maxAbsRatio 倍まで。それより大きいのは、格子の乗り換えを重ねて作った間違った坂か、
  //     曲全体のテンポの読み違い(揺れではない)。格子1つぶんずれても確かめの計算では同じに見えるので、ここで止める
  //     (Monster Hero -Another- で -153ms まで下がる坂を作った。打点のずれは8小節ごとに ±16ms しかない)
  const maxAbs=Math.max(...points.map(p=>Math.abs(p.ms)));
  if(V.maxAbsRatio&&maxAbs>gridMs*V.maxAbsRatio)return {...none(`揺れが格子の間隔に比べて大きすぎる(最大 ${round(maxAbs)}ms・格子 ${round(gridMs)}ms)`),rangeMs};
  const holdout=holdoutSpread(audio,floor,bar,V,gridMs,skipLow);
  if(!(holdout.after<=holdout.before*WARP_HOLDOUT_RATIO)||(V.minHoldout&&holdout.count<V.minHoldout))
    return {...none(`半分の区間から測った揺れが、残りの半分に当てはまらない(ばらつき ${holdout.before}→${holdout.after}ms)`),rangeMs};
  return {active:true,reason:`なめらかに揺れている(幅 ${rangeMs}ms・隣との差の中央値 ${round(step)}ms・残りの半分のばらつき ${holdout.before}→${holdout.after}ms)`,
    points,rangeMs,stepMs:round(step),holdout,at};
};

// 8小節ずつ交互に半分へ分け、片方から測った揺れを残りの打点に当てたときのばらつき(当てる前・後)
const holdoutSpread=(audio,floor,bar,V=WARP_V1,gridMs=0,skipLow=onset=>onset.share&&onset.share.low>=.5)=>{
  const spread=list=>{if(!list.length)return Infinity;const m=median(list);return round(median(list.map(x=>Math.abs(x-m))));};
  const block=onset=>Math.floor(onset.grid/bar/(V.bars*2))%2;
  // v2: 残りのずれを格子の間隔で折り返す(揺れが格子の半分を越えて隣の格子へ乗り換えた打点を、正しく数える)
  const wrap=value=>V.wrapResidual&&gridMs>0?((value%gridMs)+gridMs*1.5)%gridMs-gridMs/2:value;
  const before=[],after=[];
  for(const side of [0,1]){
    const learned=tempoWarp({...audio,onsets:audio.onsets.filter(onset=>block(onset)===side)},{force:true,v2:V===WARP_V2});
    for(const onset of audio.onsets){
      if(block(onset)===side||(Number(onset.strength)||0)<floor||skipLow(onset))continue;
      // v2: 揺れでノーツを動かす所(学んだ揺れが V.moveMs 以上)の打点だけで確かめる。揺れが曲の一部だけのとき、曲全体で平均すると効き目が薄まる
      if(V.moveMs&&!(learned.active&&Math.abs(learned.at(onset.grid))>=V.moveMs))continue;
      before.push(wrap(Number(onset.gridOffsetMs)));
      after.push(wrap(Number(onset.gridOffsetMs)-(learned.active?learned.at(onset.grid):0)));
    }
  }
  return {before:spread(before),after:spread(after),count:before.length};
};

// 譜面のリビジョンが Rev.21 以上のときだけ揺れを使う(それより前の譜面は0)
const tempoWarpForRevision=(revision,audio)=>{
  const rev=Number(revision)||0;
  if(rev<WARP_REVISION)return {active:false,at:()=>0,points:[],reason:'Rev.21 より前'};
  // Rev.26: つなぎ目を書いた曲は、その段差を使う(なめらかな揺れとは重ねない)
  if(rev>=SPLICE_REVISION){const splice=spliceWarp(audio);if(splice)return splice;}
  if(rev>=WARP_V2_REVISION){const v2=tempoWarp(audio,{v2:true});if(v2.active)return {...v2,version:2};}
  return tempoWarp(audio);
};
const tempoWarpForChart=(chart,audio)=>tempoWarpForRevision(chart&&chart.chartRevision,audio);

module.exports={WARP_REVISION,WARP_V2_REVISION,SPLICE_REVISION,spliceWarp,tempoWarp,tempoWarpForChart,tempoWarpForRevision,WARP_MAX_STEP_MS,WARP_MIN_RANGE_MS};

if(require.main===module){
  const dir=path.join(__dirname,'authoring');
  const registry=JSON.parse(fs.readFileSync(path.join(dir,'rhythm-song-registry.json'),'utf8')).songs;
  for(const trackId of Object.keys(registry)){
    const file=path.join(dir,`${trackId.replace(/_/g,'-')}-v3-audio.json`);
    if(!fs.existsSync(file))continue;
    const warp=tempoWarp(JSON.parse(fs.readFileSync(file,'utf8')));
    console.log(`${warp.active?'◎':'・'} ${trackId.padEnd(28)} ${warp.reason}${warp.active?`  ${warp.points.map(p=>Math.round(p.ms)).join(' ')}`:''}`);
  }
}
