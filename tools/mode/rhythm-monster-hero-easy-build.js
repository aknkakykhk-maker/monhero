#!/usr/bin/env node
// Monster Hero EASY 正式候補v1を、オンセット候補から決定的に組み立てる。
//
//   node tools/mode/rhythm-monster-hero-easy-build.js          # 差分を表示するだけ
//   node tools/mode/rhythm-monster-hero-easy-build.js --write  # 候補JSONとruntime譜面を書き出す
//
// 入力:  tools/mode/authoring/monster-hero-theme-onset-candidates.json（実音源解析の結果）
//        monster-hero/data/rhythm-timing.js（BPM・beatZero・16分グリッド）
// 出力:  monster-hero/debug/monster-hero-theme-easy-formal-candidate-v1.json
//        monster-hero/data/rhythm-mode.js の EASY譜面ブロック（マーカーの内側だけ差し替え）
//
// 解析だけで完成扱いにはしない。ここで作るのは耳確認前の「正式候補」であり、
// reviewRequired=true / runtimeConnected=false のまま、デバッグ導線でだけ遊べる状態にする。
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
const TRACK_ID='monster_hero_theme';
const CANDIDATES=path.join(ROOT,'tools/mode/authoring/monster-hero-theme-onset-candidates.json');
const CANDIDATE_OUT=path.join(ROOT,'monster-hero/debug/monster-hero-theme-easy-formal-candidate-v1.json');
const RUNTIME=path.join(ROOT,'monster-hero/data/rhythm-mode.js');
const BEGIN='// <monster-hero-easy-notes>';
const END='// </monster-hero-easy-notes>';
const write=process.argv.includes('--write');

// --- EASYの制作方針（ここを変えると譜面が変わる。値は根拠と一緒に残す） ---
const PROFILE=Object.freeze({
  // 採用するのは実音源ピークとの差が±30ms以内のものだけ。あつ杯テーマ正式候補v1と同じ基準。
  maxAbsPeakOffsetMs:30,
  // 30msを超えて42ms以内は「音は在るがグリッドから外れている」ため耳確認へ回す。
  earReviewMaxOffsetMs:42,
  // この曲のオンセットは8分（16分グリッドの偶数）に集中しているため、EASYの置き場所も8分に限る。
  // 16分裏へは置かない＝初めての人でも拍が取れる。
  latticeGrids:2,
  // 同時押しを作らない。隣接する幅1TAPを並べないので、可変幅1ノーツ化ルールにも自動的に従う。
  simultaneous:false,
  // 1小節(16グリッド)あたりの上限。小節の強さで2〜4へ変える。
  perBarByIntensity:Object.freeze([2,3,4]),
  // 8分の連続は2個まで。3個目からは1拍あける（EASYで指が追いつかなくなるのを防ぐ）。
  maxConsecutiveEighths:2,
  // 曲の頭と終わりは空ける。
  minTimeMs:1800,
  endPaddingMs:1200,
  // HOLDは少なめ。次のノーツまで十分空いている拍頭だけを、上限までHOLDへ変える。
  holdMaxCount:10,
  holdMinGapGrids:12,
  holdGrids:Object.freeze([4,8]),
  // レーンは1つずつしか動かさない（激しい左右移動を避ける）。
  maxLaneStep:1,
  // モンスターノーツは全体の20/40/60/80%付近へ、前後を空けた拍頭に置く。
  monsterSlots:4,
  monsterTargets:Object.freeze([.2,.4,.6,.8]),
  monsterClearGrids:4,
});

const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-timing.js'),'utf8')}\nthis.__t=RHYTHM_TIMING_DATA[${JSON.stringify(TRACK_ID)}];`,timingContext);
const timing=timingContext.__t;
if(!timing)throw new Error(`${TRACK_ID} timing data is missing`);
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const gridTimeMs=g=>timing.beatZeroMs+g*gridMs;
const lastGrid=Math.floor((timing.audioDurationMs-timing.endPaddingMs||timing.audioDurationMs)/gridMs);

const source=JSON.parse(fs.readFileSync(CANDIDATES,'utf8'));
if(source.trackId!==TRACK_ID)throw new Error('候補ファイルのtrackIdが一致しません');

// --- 採用できるグリッドと、耳確認へ回すグリッドを分ける ---
const byGrid=new Map();
for(const [grid,strength,offsetMs] of source.candidates){
  const prev=byGrid.get(grid);
  if(!prev||strength>prev.strength)byGrid.set(grid,{grid,strength,offsetMs});
}
const minGrid=Math.ceil((PROFILE.minTimeMs-timing.beatZeroMs)/gridMs);
const maxGrid=Math.floor((timing.audioDurationMs-PROFILE.endPaddingMs-timing.beatZeroMs)/gridMs);
const inRange=item=>item.grid>=minGrid&&item.grid<=maxGrid;
const onLattice=item=>item.grid%PROFILE.latticeGrids===0;
const adopted=[...byGrid.values()].filter(i=>inRange(i)&&onLattice(i)&&Math.abs(i.offsetMs)<=PROFILE.maxAbsPeakOffsetMs);
const earReview=[...byGrid.values()].filter(i=>inRange(i)&&onLattice(i)
  &&Math.abs(i.offsetMs)>PROFILE.maxAbsPeakOffsetMs&&Math.abs(i.offsetMs)<=PROFILE.earReviewMaxOffsetMs)
  .map(i=>i.grid).sort((a,b)=>a-b);

// --- 小節ごとに、強さに応じた本数だけ選ぶ ---
const BAR=timing.subdivisionsPerBeat*4;
const bars=new Map();
for(const item of adopted){
  const bar=Math.floor(item.grid/BAR);
  if(!bars.has(bar))bars.set(bar,[]);
  bars.get(bar).push(item);
}
const barStrength=[...bars.entries()].map(([bar,items])=>({bar,total:items.reduce((s,i)=>s+i.strength,0)}));
const sortedTotals=barStrength.map(b=>b.total).sort((a,b)=>a-b);
const q=r=>sortedTotals[Math.min(sortedTotals.length-1,Math.floor(sortedTotals.length*r))];
const lowCut=q(1/3),midCut=q(2/3);
const perBar=total=>total<=lowCut?PROFILE.perBarByIntensity[0]:total<=midCut?PROFILE.perBarByIntensity[1]:PROFILE.perBarByIntensity[2];

const picked=[];
for(const {bar,total} of barStrength.sort((a,b)=>a.bar-b.bar)){
  const items=bars.get(bar).slice();
  const limit=perBar(total);
  // 拍頭を優先し、そのあと強い順。同じ強さならグリッド順で決める（毎回同じ結果にするため）。
  items.sort((a,b)=>{
    const beatA=a.grid%timing.subdivisionsPerBeat===0?0:1,beatB=b.grid%timing.subdivisionsPerBeat===0?0:1;
    if(beatA!==beatB)return beatA-beatB;
    if(b.strength!==a.strength)return b.strength-a.strength;
    return a.grid-b.grid;
  });
  for(const item of items){
    if(picked.filter(p=>Math.floor(p.grid/BAR)===bar).length>=limit)break;
    const last=picked[picked.length-1];
    if(last&&item.grid-last.grid<PROFILE.latticeGrids)continue;
    picked.push(item);
    picked.sort((a,b)=>a.grid-b.grid);
  }
}
picked.sort((a,b)=>a.grid-b.grid);

// --- 8分の連続が続きすぎないように間引く ---
const spaced=[];
let run=1;
for(const item of picked){
  const last=spaced[spaced.length-1];
  if(!last){spaced.push(item);continue;}
  const gap=item.grid-last.grid;
  if(gap<=PROFILE.latticeGrids){
    if(run>=PROFILE.maxConsecutiveEighths)continue;
    run++;
  }else run=1;
  spaced.push(item);
}

// --- レーンを決める（1つずつしか動かさない・中央から始める） ---
// 小節ごとに向きを反転させ、端に着いたら折り返す。乱数を使わず、同じ入力から必ず同じ譜面になる。
const notes=[];
let lane=2,dir=1,prevBar=-1;
for(const item of spaced){
  const bar=Math.floor(item.grid/BAR);
  const prevBarOfNote=prevBar;
  if(bar!==prevBar){dir=bar%2===0?1:-1;prevBar=bar;}
  const prev=spaced[spaced.indexOf(item)-1];
  // 8分でつながる2個は同じレーンへ置く。EASYでは左右へ振るより同じ場所を2回叩くほうが易しい。
  const keepLane=prev&&item.grid-prev.grid<=PROFILE.latticeGrids&&bar===prevBarOfNote;
  if(!keepLane){
    let next=lane+dir*PROFILE.maxLaneStep;
    if(next<0||next>4){dir=-dir;next=lane+dir*PROFILE.maxLaneStep;}
    lane=Math.max(0,Math.min(4,next));
  }
  notes.push({type:'TAP',grid:item.grid,lane,subLane:lane*2,subLaneWidth:2,
    sourceStrength:Math.round(item.strength*100)/100,sourcePeakOffsetMs:item.offsetMs});
}

// --- HOLDを少しだけ足す（次のノーツまで十分空いている拍頭だけ） ---
// 先頭から順に上限まで取ると前半へ固まってしまうため、候補を集めてから曲全体へ等間隔で散らす。
const holdCandidates=[];
for(let i=0;i<notes.length-1;i++){
  const note=notes[i],next=notes[i+1];
  if(note.grid%timing.subdivisionsPerBeat!==0)continue;
  const gap=next.grid-note.grid;
  if(gap<PROFILE.holdMinGapGrids)continue;
  const durationGrids=gap>=PROFILE.holdGrids[1]+4?PROFILE.holdGrids[1]:PROFILE.holdGrids[0];
  if(note.grid+durationGrids>=next.grid)continue;
  holdCandidates.push({index:i,durationGrids});
}
const holdPicked=[];
for(let k=0;k<PROFILE.holdMaxCount&&holdCandidates.length;k++){
  const target=holdCandidates[0].index+(holdCandidates[holdCandidates.length-1].index-holdCandidates[0].index)*(k/(PROFILE.holdMaxCount-1||1));
  let bestPos=-1,bestDistance=Infinity;
  holdCandidates.forEach((c,pos)=>{
    if(holdPicked.some(h=>Math.abs(h.index-c.index)<=1))return; // HOLDを隣り合わせない
    const distance=Math.abs(c.index-target);
    if(distance<bestDistance){bestDistance=distance;bestPos=pos;}
  });
  if(bestPos<0)break;
  holdPicked.push(holdCandidates[bestPos]);
  holdCandidates.splice(bestPos,1);
}
for(const {index,durationGrids} of holdPicked){
  notes[index].type='HOLD';
  notes[index].durationGrids=durationGrids;
}

// --- モンスターノーツ（TAPのみ・前後を空けた拍頭・時刻順に1〜4枠） ---
const firstGrid=notes[0].grid,lastNoteGrid=notes[notes.length-1].grid;
const span=lastNoteGrid-firstGrid;
const usedIndexes=new Set();
PROFILE.monsterTargets.forEach((ratio,index)=>{
  const targetGrid=firstGrid+span*ratio;
  let bestIndex=-1,bestDistance=Infinity;
  notes.forEach((note,i)=>{
    if(note.type!=='TAP'||usedIndexes.has(i))return;
    if(note.grid%timing.subdivisionsPerBeat!==0)return;
    const before=i>0?note.grid-notes[i-1].grid:Infinity;
    const after=i<notes.length-1?notes[i+1].grid-note.grid:Infinity;
    if(before<PROFILE.monsterClearGrids||after<PROFILE.monsterClearGrids)return;
    const distance=Math.abs(note.grid-targetGrid);
    if(distance<bestDistance){bestDistance=distance;bestIndex=i;}
  });
  if(bestIndex>=0){notes[bestIndex].monsterSlot=index+1;usedIndexes.add(bestIndex);}
});

const typeCounts=notes.reduce((acc,n)=>{acc[n.type]=(acc[n.type]||0)+1;return acc;},{});
const candidate={
  trackId:TRACK_ID,
  difficulty:'EASY',
  candidateVersion:1,
  status:'FORMAL_CANDIDATE',
  reviewRequired:true,
  runtimeConnected:false,
  bpm:timing.bpm,
  beatZeroMs:timing.beatZeroMs,
  subdivisionsPerBeat:timing.subdivisionsPerBeat,
  source:'monster-hero-onset-selection-v1',
  policy:{
    maxAbsPeakOffsetMs:PROFILE.maxAbsPeakOffsetMs,
    mainLaneOnly:true,
    subLaneWidth:2,
    latticeGrids:PROFILE.latticeGrids,
    types:['TAP','HOLD'],
    holdGrids:[...PROFILE.holdGrids],
    maxLaneStep:PROFILE.maxLaneStep,
    simultaneous:false,
    note:'耳確認前の制作候補。±30msを超えた候補は採用せず earReviewGrids へ保留する。正式完成譜面ではない。',
  },
  noteCount:notes.length,
  typeCounts,
  monsterSlotGrids:notes.filter(n=>n.monsterSlot).map(n=>n.grid),
  earReviewGrids:earReview,
  notes,
};

// --- runtime用の並び（[timeMs, subLane, holdMs, monsterSlot]） ---
const runtimeRows=notes.map(n=>{
  const timeMs=Math.round(gridTimeMs(n.grid));
  const holdMs=n.type==='HOLD'?Math.round(n.durationGrids*gridMs):0;
  return `[${timeMs},${n.subLane},${holdMs},${n.monsterSlot||0}]`;
});
const lines=[];
for(let i=0;i<runtimeRows.length;i+=6)lines.push('  '+runtimeRows.slice(i,i+6).join(',')+',');
const runtimeBlock=lines.join('\n');

const durationMs=Math.round(gridTimeMs(lastNoteGrid))+2000;
console.log(`Monster Hero EASY 正式候補v1`);
console.log(`  ノーツ ${notes.length}件 (${Object.entries(typeCounts).map(([k,v])=>`${k}${v}`).join(' / ')})`);
console.log(`  範囲 ${(gridTimeMs(firstGrid)/1000).toFixed(1)}s 〜 ${(gridTimeMs(lastNoteGrid)/1000).toFixed(1)}s / 密度 ${(notes.length/((gridTimeMs(lastNoteGrid)-gridTimeMs(firstGrid))/1000)).toFixed(2)}ノーツ/秒`);
console.log(`  モンスターノーツ ${candidate.monsterSlotGrids.length}件 / 耳確認へ回すグリッド ${earReview.length}件`);
console.log(`  小節あたり本数のしきい値: 低${lowCut.toFixed(2)} 中${midCut.toFixed(2)}`);

if(!write){console.log('（--write を付けると書き出します）');process.exit(0);}

fs.writeFileSync(CANDIDATE_OUT,JSON.stringify(candidate,null,1)+'\n');
const runtimeSource=fs.readFileSync(RUNTIME,'utf8');
const begin=runtimeSource.indexOf(BEGIN),end=runtimeSource.indexOf(END);
if(begin<0||end<0||end<begin)throw new Error('rhythm-mode.js のEASY譜面マーカーが見つかりません');
const patched=`${runtimeSource.slice(0,begin+BEGIN.length)}\n${runtimeBlock}\n${runtimeSource.slice(end)}`;
fs.writeFileSync(RUNTIME,patched);
console.log(`書き出しました: ${path.relative(ROOT,CANDIDATE_OUT)} / ${path.relative(ROOT,RUNTIME)} (durationMs=${durationMs})`);
