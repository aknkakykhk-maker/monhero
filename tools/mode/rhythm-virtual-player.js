#!/usr/bin/env node
// 仮想プレイヤー(2026-09-28・MHB CHART ENGINE Rev.18 の区間の差し替えから使う)。
//
//   node tools/mode/rhythm-virtual-player.js --track <曲id> [--difficulty MASTER] [--runs 200]   # 作者用の譜面(-v3-fixed-)を遊ばせる
//
// 【なぜ要るか】遊んだ感覚は実際に遊ばれるまで分からない。人の反応のくせと指の動きを持った仮想プレイヤーに譜面を何百回も遊ばせ、
// ミスが集まる所・押す時刻がばらつく所を、公開前に見つけて直す(区間の差し替えが、つまずく区切りを別の候補に替える)。
// 仮想プレイヤーの「ばらつき」と「ミス」の大きさは、プレイヤーの遊んだ記録(rhythm-play-log.js --learn)が合わせ込む
// (rhythm-chart-play-tuning.js の virtualSigmaScale / virtualMissScale)。
//
// 【人のモデル】ノーツ1つごとに
//   ・狙う時刻 = ノーツの時刻と、耳に入る音(ノーツから45ms以内のいちばん強い打点)の時刻を ANCHOR_WEIGHT で混ぜたもの
//   ・ばらつき σ = 基本 × (1 + 詰まり具合(前後1秒のノーツ数/秒が3を超えた分)× a + 横の移動の速さ(レーン/秒)× b)。
//     音の鳴っていないノーツは SILENT_FACTOR 倍(音で時刻を合わせられない)。1回ごとの全体のずれ(人のくせ)も足す
//   ・ミスの確率 = 基本 + 詰まり具合(5を超えた分) × c + 手のシミュレートの「忙しい」「押せない」
//   ・判定はゲームと同じ窓(RHYTHM_JUDGMENTS: MARVELOUS ±55 / EXCELLENT ±100 / GREAT ±150 / GOOD ±170 / BAD ±185 / それより外は MISS)
// 乱数は曲と難易度から決めた種で作る。同じ譜面なら毎回同じ結果。
'use strict';
const {tempoWarpForChart}=require('./rhythm-chart-tempo-warp.js');
const fs=require('fs');
const path=require('path');
const {simulateNotes}=require('./rhythm-hand-simulate.js');
const {setHandModelFlags}=require('./rhythm-hand-model.js');
const {chartRevisionOf,handModelFlagsForRevision}=require('./rhythm-chart-v3-revision.js');

const ROOT=path.resolve(__dirname,'..','..');
const JUDGMENT_WINDOWS=Object.freeze([['MARVELOUS',55],['EXCELLENT',100],['GREAT',150],['GOOD',170],['BAD',185]]);
const DEFAULT_VIRTUAL_PLAYER=Object.freeze({
  sigmaBaseMs:16,densityA:.08,jumpB:.02,silentFactor:1.35,anchorWeight:.5,runBiasMs:8,
  missBase:.004,missDensityC:.012,missStrained:.12,missImpossible:.6,
  sigmaScale:1,missScale:1,
});
const HEAR_MS=45,SEGMENT_MS=8000;

const hash32=text=>{let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
const makeRandom=seed=>{let s=seed>>>0||1;return ()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};};
const gaussOf=rnd=>()=>{let u=0;for(let i=0;i<6;i++)u+=rnd();return (u-3)*Math.SQRT2;};
// レーンの中心(サブレーンが無いノーツは lane から)。どちらも無ければ null(横の移動を数えない)
const noteLane=note=>{
  const sub=Number(note.subLane);
  if(Number.isFinite(sub))return (sub+Number(note.subLaneWidth||2)/2)/2;
  const lane=Number(note.lane);
  return Number.isFinite(lane)?lane+.5:null;
};

// ノーツごとの「狙いのずれ・ばらつき・ミスの確率」を出す(乱数は使わない)
const noteModel=(chart,audio,params={})=>{
  const p={...DEFAULT_VIRTUAL_PLAYER,...params};
  const timing=audio.timing;
  const gridMs=Number(timing.gridMs)||timing.beatMs/timing.subdivisionsPerBeat;
  // Rev.21 の譜面は、テンポの揺れを足した時刻で書き出される(rhythm-chart-tempo-warp.js)。遊ぶ時刻もそれにそろえる
  const warp=tempoWarpForChart(chart,audio);
  const timeOf=grid=>timing.beatZeroMs+grid*gridMs+warp.at(grid);
  const notes=chart.notes;
  const times=notes.map(note=>timeOf(note.grid));
  const onsets=(audio.onsets||[]).filter(o=>Number.isFinite(o.timeMs)).sort((a,b)=>a.timeMs-b.timeMs);
  // 手のシミュレート(その譜面のリビジョンの読み方で)
  const previous=setHandModelFlags({...handModelFlagsForRevision(chartRevisionOf(chart)),runtimeSlideLanes:true});
  let issues;
  try{issues=simulateNotes(notes,timing).issues;}finally{setHandModelFlags(previous);}
  const strained=new Set(),impossible=new Set();
  for(const issue of issues){if(issue.severity==='impossible')impossible.add(issue.noteIndex);else if(issue.severity==='strained')strained.add(issue.noteIndex);}
  let lo=0;
  return notes.map((note,i)=>{
    const t=times[i];
    let dense=0;for(let k=Math.max(0,i-40);k<Math.min(notes.length,i+40);k++)if(Math.abs(times[k]-t)<=1000)dense++;
    const density=dense/2;
    let jump=0;
    for(let k=i-1;k>=0;k--){if(times[k]<t){const a=noteLane(note),b=noteLane(notes[k]);if(a!=null&&b!=null)jump=Math.abs(a-b)/Math.max(.06,(t-times[k])/1000);break;}}
    while(lo<onsets.length&&onsets[lo].timeMs<t-HEAR_MS)lo++;
    let heard=null;
    for(let k=lo;k<onsets.length&&onsets[k].timeMs<=t+HEAR_MS;k++)if(!heard||onsets[k].strength>heard.strength)heard=onsets[k];
    const sigma=p.sigmaBaseMs*p.sigmaScale*(1+Math.max(0,density-3)*p.densityA+jump*p.jumpB)*(heard?1:p.silentFactor);
    const miss=Math.min(.95,(p.missBase+Math.max(0,density-5)*p.missDensityC+(strained.has(i)?p.missStrained:0)+(impossible.has(i)?p.missImpossible:0))*p.missScale);
    return {timeMs:t,aimMs:heard?(heard.timeMs-t)*p.anchorWeight:0,sigma,miss};
  });
};

// 何回も遊ばせる。segmentStartsMs を渡すとその区切りごと、渡さなければ8秒ごとに数える
const playChart=(chart,audio,{runs=200,params={},segmentStartsMs=null,seed=null}={})=>{
  const p={...DEFAULT_VIRTUAL_PLAYER,...params};
  const model=noteModel(chart,audio,p);
  const rnd=makeRandom(seed??hash32(`${chart.trackId}:${chart.difficulty}:${chart.notes.length}`));
  const gauss=gaussOf(rnd);
  const segmentOf=ms=>{
    if(!segmentStartsMs)return Math.floor(ms/SEGMENT_MS);
    let lo=0,hi=segmentStartsMs.length-1;
    if(ms<segmentStartsMs[0])return 0;
    while(lo<hi){const mid=(lo+hi+1)>>1;if(segmentStartsMs[mid]<=ms)lo=mid;else hi=mid-1;}
    return lo;
  };
  const counts=Object.fromEntries(JUDGMENT_WINDOWS.map(([id])=>[id,0]).concat([['MISS',0]]));
  const perNote=model.map(()=>({miss:0,n:0,sq:0}));
  for(let run=0;run<runs;run++){
    const bias=gauss()*p.runBiasMs;
    model.forEach((m,i)=>{
      const stat=perNote[i];
      if(rnd()<m.miss){counts.MISS++;stat.miss++;return;}
      const delta=m.aimMs+bias+gauss()*m.sigma;
      const hit=JUDGMENT_WINDOWS.find(([,w])=>Math.abs(delta)<=w);
      if(!hit){counts.MISS++;stat.miss++;return;}
      counts[hit[0]]++;stat.n++;stat.sq+=(delta-bias)**2;
    });
  }
  const segments=new Map();
  model.forEach((m,i)=>{
    const index=segmentOf(m.timeMs),o=segments.get(index)||{index,notes:0,expectedMisses:0,sq:0,n:0};
    o.notes++;o.expectedMisses+=perNote[i].miss/runs;o.sq+=perNote[i].sq;o.n+=perNote[i].n;segments.set(index,o);
  });
  const total=Object.values(counts).reduce((a,b)=>a+b,0)||1;
  return {
    runs,params:p,
    judgments:Object.fromEntries(Object.entries(counts).map(([id,c])=>[id,c/total])),
    missRate:counts.MISS/total,
    spreadMs:Math.sqrt(perNote.reduce((a,s)=>a+s.sq,0)/Math.max(1,perNote.reduce((a,s)=>a+s.n,0))),
    segments:[...segments.values()].sort((a,b)=>a.index-b.index).map(o=>({index:o.index,notes:o.notes,expectedMisses:o.expectedMisses,rmsMs:o.n?Math.sqrt(o.sq/o.n):null})),
  };
};
// 区間の差し替えに足す費用: 見込みのミスの数 × MISS_COST + ばらつきが基本より大きい分(ms)÷ SPREAD_UNIT × ノーツ数の割合
const VIRTUAL_MISS_COST=3,VIRTUAL_SPREAD_UNIT=10;
const segmentCost=(segment,params={})=>{
  const p={...DEFAULT_VIRTUAL_PLAYER,...params};
  const excess=segment.rmsMs==null?0:Math.max(0,segment.rmsMs-p.sigmaBaseMs*p.sigmaScale);
  return segment.expectedMisses*VIRTUAL_MISS_COST+excess/VIRTUAL_SPREAD_UNIT*Math.min(1,segment.notes/20);
};

module.exports={DEFAULT_VIRTUAL_PLAYER,JUDGMENT_WINDOWS,VIRTUAL_MISS_COST,VIRTUAL_SPREAD_UNIT,noteModel,playChart,segmentCost};

if(require.main===module){
  const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
  const trackId=arg('--track','monster_hero_theme'),dashed=trackId.replace(/_/g,'-');
  const difficulties=arg('--difficulty',null)?[arg('--difficulty').toLowerCase()]:['easy','normal','hard','expert','master'];
  const audio=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-audio.json`),'utf8'));
  console.log(`仮想プレイヤー（${trackId}・${Number(arg('--runs',200))}回ずつ）`);
  for(const d of difficulties){
    const file=path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-fixed-${d}.json`);
    if(!fs.existsSync(file))continue;
    const chart=JSON.parse(fs.readFileSync(file,'utf8'));
    const result=playChart(chart,audio,{runs:Number(arg('--runs',200))});
    const worst=result.segments.slice().sort((a,b)=>b.expectedMisses-a.expectedMisses)[0];
    const clock=ms=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
    console.log(`  ${d.toUpperCase()}: ミス ${(result.missRate*100).toFixed(1)}% ／ ばらつき ${result.spreadMs.toFixed(1)}ms ／ MARVELOUS ${(result.judgments.MARVELOUS*100).toFixed(0)}%`
      +(worst&&worst.expectedMisses>=.5?` ／ いちばんつまずく区間 ${clock(worst.index*SEGMENT_MS)}（ミス見込み ${worst.expectedMisses.toFixed(1)}）`:''));
  }
}
