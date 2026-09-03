#!/usr/bin/env node
// 体験版の曲「Monster Hero」の譜面候補を、オンセット解析から決定的に組み立てる。
//
//   node tools/mode/rhythm-monster-hero-chart-build.js                    # 内訳を表示するだけ
//   node tools/mode/rhythm-monster-hero-chart-build.js --write            # 3難易度を書き出す
//   node tools/mode/rhythm-monster-hero-chart-build.js --difficulty HARD  # 1つだけ
//
// 入力:  tools/mode/authoring/monster-hero-theme-onset-candidates.json（実音源解析の結果）
//        monster-hero/data/rhythm-timing.js（BPM・beatZero・16分グリッド）
// 出力:  monster-hero/debug/monster-hero-theme-<難易度>-formal-candidate-v1.json
//        monster-hero/data/rhythm-mode.js の各難易度ブロック（マーカーの内側だけ差し替え）
//
// 乱数を使わないので、同じ入力からは必ず同じ譜面になる。
// 解析だけで完成扱いにはしない。ここで作るのは耳確認前の「正式候補」であり、
// reviewRequired=true / runtimeConnected=false のまま、デバッグ導線でだけ遊べる状態にする。
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
const TRACK_ID='monster_hero_theme';
// 候補ファイルは2つある。
//  - 通常(しきい値0.60): EASYが使う。すでにユーザーのレビューへ出しているので動かさない。
//  - dense(しきい値0.30): NORMAL/HARDが使う。EASYと同じ音源・同じグリッドのまま、
//    弱い音（刻みやゴーストノート）まで拾って候補を増やしたもの。
//    強い側は通常ファイルとほぼ同じ集合になる（丸めの分だけ差が出る）。
const CANDIDATE_FILES=Object.freeze({
  normal:path.join(ROOT,'tools/mode/authoring/monster-hero-theme-onset-candidates.json'),
  dense:path.join(ROOT,'tools/mode/authoring/monster-hero-theme-onset-candidates-dense.json'),
});
const RUNTIME=path.join(ROOT,'monster-hero/data/rhythm-mode.js');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const write=process.argv.includes('--write');
const only=arg('--difficulty');

// 全難易度で共通の下地。曲・グリッド・採用基準はここで揃える。
const COMMON=Object.freeze({
  // 採用するのは実音源ピークとの差が±30ms以内のものだけ（あつ杯テーマ正式候補v1と同じ基準）。
  maxAbsPeakOffsetMs:30,
  // 30msを超えて42ms以内は「音は在るがグリッドから外れている」ため耳確認へ回す。
  earReviewMaxOffsetMs:42,
  minTimeMs:1800,
  endPaddingMs:1200,
  monsterSlots:4,
  monsterTargets:[.2,.4,.6,.8],
  monsterClearGrids:4,
});

// 難易度ごとの制作方針。ここを変えると譜面が変わる。値は根拠と一緒に残す。
const PROFILES=Object.freeze({
  EASY:Object.freeze({
    level:1,
    // すでにレビューへ出している譜面なので、候補ファイルも強さの下限も動かさない。
    candidateSource:'normal',
    minStrength:0,
    // この曲のオンセットは8分に集中しているため、置き場所も8分に限る。16分裏へは置かない。
    latticeGrids:2,
    // 1小節(16グリッド)あたりの上限。小節の強さで2〜4へ変える。
    perBarByIntensity:[2,3,4],
    // 8分の連続は2個まで。3個目からは1拍あける。
    maxConsecutiveEighths:2,
    // レーンは1つずつしか動かさない（激しい左右移動を避ける）。
    maxLaneStep:1,
    // 幅は2固定。同時押しを作らないので、隣接する幅1TAPが並ぶこともない。
    widths:[2],
    simultaneous:false,
    types:['TAP','HOLD'],
    holdMaxCount:10,
    holdMinGapGrids:12,
    flickMaxCount:0,
    slideMaxCount:0,
  }),
  NORMAL:Object.freeze({
    level:3,
    // 弱い音まで拾った候補から、中くらい以上の強さを使う。
    candidateSource:'dense',
    minStrength:.45,
    // EASYと同じ8分の土台のまま、密度と左右の動きを増やす。
    latticeGrids:2,
    perBarByIntensity:[3,4,6],
    maxConsecutiveEighths:4,
    maxLaneStep:2,
    // 可変幅を自然に使う。強い音ほど広く、速い連打は狭くする。
    widths:[1,2,3],
    simultaneous:false,
    types:['TAP','HOLD','FLICK'],
    holdMaxCount:14,
    holdMinGapGrids:10,
    flickMaxCount:12,
    slideMaxCount:0,
  }),
  HARD:Object.freeze({
    level:5,
    // 刻みまで拾って、いちばん密度を上げられるようにする。
    candidateSource:'dense',
    minStrength:.30,
    // 16分裏も使う。ただし音がある位置だけで、無い所へは置かない。
    latticeGrids:1,
    perBarByIntensity:[5,7,9],
    maxConsecutiveEighths:6,
    maxLaneStep:3,
    widths:[1,2,3,4],
    // HOLD/SLIDEの最中に別のTAPを重ねる複合操作を入れる（レーンは離す）。
    simultaneous:true,
    types:['TAP','HOLD','FLICK','SLIDE'],
    holdMaxCount:14,
    holdMinGapGrids:10,
    flickMaxCount:16,
    slideMaxCount:8,
  }),
});

const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-timing.js'),'utf8')}\nthis.__t=RHYTHM_TIMING_DATA[${JSON.stringify(TRACK_ID)}];`,timingContext);
const timing=timingContext.__t;
if(!timing)throw new Error(`${TRACK_ID} timing data is missing`);
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const gridTimeMs=g=>timing.beatZeroMs+g*gridMs;
const BEAT=timing.subdivisionsPerBeat;
const BAR=BEAT*4;

const loadCandidates=key=>{
  const source=JSON.parse(fs.readFileSync(CANDIDATE_FILES[key],'utf8'));
  if(source.trackId!==TRACK_ID)throw new Error('候補ファイルのtrackIdが一致しません');
  const map=new Map();
  for(const [grid,strength,offsetMs] of source.candidates){
    const prev=map.get(grid);
    if(!prev||strength>prev.strength)map.set(grid,{grid,strength,offsetMs});
  }
  return map;
};
const CANDIDATE_MAPS=Object.freeze({normal:loadCandidates('normal'),dense:loadCandidates('dense')});
const minGrid=Math.ceil((COMMON.minTimeMs-timing.beatZeroMs)/gridMs);
const maxGrid=Math.floor((timing.audioDurationMs-COMMON.endPaddingMs-timing.beatZeroMs)/gridMs);

const buildChart=(difficulty)=>{
  const P=PROFILES[difficulty];
  const byGrid=CANDIDATE_MAPS[P.candidateSource];
  const inRange=i=>i.grid>=minGrid&&i.grid<=maxGrid;
  const onLattice=i=>i.grid%P.latticeGrids===0;
  const pool=[...byGrid.values()].filter(i=>inRange(i)&&onLattice(i)&&i.strength>=P.minStrength);
  const adopted=pool.filter(i=>Math.abs(i.offsetMs)<=COMMON.maxAbsPeakOffsetMs);
  const earReview=pool
    .filter(i=>Math.abs(i.offsetMs)>COMMON.maxAbsPeakOffsetMs&&Math.abs(i.offsetMs)<=COMMON.earReviewMaxOffsetMs)
    .map(i=>i.grid).sort((a,b)=>a-b);

  // --- 小節ごとに、強さに応じた本数だけ選ぶ ---
  const bars=new Map();
  for(const item of adopted){
    const bar=Math.floor(item.grid/BAR);
    if(!bars.has(bar))bars.set(bar,[]);
    bars.get(bar).push(item);
  }
  const barTotals=[...bars.entries()].map(([bar,items])=>({bar,total:items.reduce((s,i)=>s+i.strength,0)}));
  const sortedTotals=barTotals.map(b=>b.total).sort((a,b)=>a-b);
  const q=r=>sortedTotals[Math.min(sortedTotals.length-1,Math.floor(sortedTotals.length*r))];
  const lowCut=q(1/3),midCut=q(2/3);
  const perBar=total=>total<=lowCut?P.perBarByIntensity[0]:total<=midCut?P.perBarByIntensity[1]:P.perBarByIntensity[2];

  const picked=[];
  for(const {bar,total} of barTotals.sort((a,b)=>a.bar-b.bar)){
    const items=bars.get(bar).slice();
    const limit=perBar(total);
    // 拍頭を優先し、そのあと強い順。同じ強さならグリッド順（毎回同じ結果にするため）。
    items.sort((a,b)=>{
      const beatA=a.grid%BEAT===0?0:1,beatB=b.grid%BEAT===0?0:1;
      if(beatA!==beatB)return beatA-beatB;
      if(b.strength!==a.strength)return b.strength-a.strength;
      return a.grid-b.grid;
    });
    let inBar=0;
    for(const item of items){
      if(inBar>=limit)break;
      const last=picked[picked.length-1];
      if(last&&item.grid-last.grid<P.latticeGrids)continue;
      picked.push(item);
      picked.sort((a,b)=>a.grid-b.grid);
      inBar=picked.filter(p=>Math.floor(p.grid/BAR)===bar).length;
    }
  }
  picked.sort((a,b)=>a.grid-b.grid);

  // --- 短い間隔が続きすぎないように間引く ---
  const spaced=[];
  let run=1;
  for(const item of picked){
    const last=spaced[spaced.length-1];
    if(!last){spaced.push(item);continue;}
    if(item.grid-last.grid<=P.latticeGrids){
      if(run>=P.maxConsecutiveEighths)continue;
      run++;
    }else run=1;
    spaced.push(item);
  }

  // --- 幅を決める（強い音ほど広く。速い連打は狭く） ---
  const strengths=spaced.map(i=>i.strength).sort((a,b)=>a-b);
  const pick=r=>strengths[Math.min(strengths.length-1,Math.floor(strengths.length*r))];
  const wideCut=pick(.80),midWideCut=pick(.45);
  const widthFor=(item,index)=>{
    if(P.widths.length===1)return P.widths[0];
    const prev=spaced[index-1];
    const fast=prev&&item.grid-prev.grid<=P.latticeGrids;
    if(fast&&P.widths.includes(1))return 1;
    if(item.strength>=wideCut)return P.widths[P.widths.length-1];
    if(item.strength>=midWideCut&&P.widths.includes(3))return 3;
    return 2;
  };

  // --- レーンを決める（決められた歩幅まで・中央から始める・端で折り返す） ---
  const notes=[];
  let lane=2,dir=1,prevBar=-1;
  spaced.forEach((item,index)=>{
    const bar=Math.floor(item.grid/BAR);
    const sameBar=bar===prevBar;
    if(!sameBar){dir=bar%2===0?1:-1;prevBar=bar;}
    const prev=spaced[index-1];
    // 短い間隔でつながる2個は同じレーンへ置く（左右へ振るより易しい）。
    const keepLane=prev&&item.grid-prev.grid<=P.latticeGrids&&sameBar;
    if(!keepLane){
      let next=lane+dir*P.maxLaneStep;
      if(next<0||next>4){dir=-dir;next=lane+dir*P.maxLaneStep;}
      lane=Math.max(0,Math.min(4,next));
    }
    const width=widthFor(item,index);
    // 幅を広げると10サブレーンからはみ出ることがあるので、収まる位置へ寄せる。
    const subLane=Math.max(0,Math.min(10-width,lane*2));
    notes.push({type:'TAP',grid:item.grid,lane:Math.floor(subLane/2),subLane,subLaneWidth:width,
      sourceStrength:Math.round(item.strength*100)/100,sourcePeakOffsetMs:item.offsetMs});
  });

  // --- HOLD（次のノーツまで十分空いている拍頭を、曲全体へ等間隔で散らす） ---
  const holdCandidates=[];
  for(let i=0;i<notes.length-1;i++){
    const note=notes[i],next=notes[i+1];
    if(note.grid%BEAT!==0)continue;
    const gap=next.grid-note.grid;
    if(gap<P.holdMinGapGrids)continue;
    const durationGrids=gap>=12?8:4;
    if(note.grid+durationGrids>=next.grid)continue;
    holdCandidates.push({index:i,durationGrids});
  }
  const spread=(candidates,count,minIndexGap)=>{
    const chosen=[],rest=candidates.slice();
    for(let k=0;k<count&&rest.length;k++){
      const first=rest[0].index,last=rest[rest.length-1].index;
      const target=first+(last-first)*(count>1?k/(count-1):0);
      let bestPos=-1,bestDistance=Infinity;
      rest.forEach((c,pos)=>{
        if(chosen.some(h=>Math.abs(h.index-c.index)<minIndexGap))return;
        const distance=Math.abs(c.index-target);
        if(distance<bestDistance){bestDistance=distance;bestPos=pos;}
      });
      if(bestPos<0)break;
      chosen.push(rest[bestPos]);
      rest.splice(bestPos,1);
    }
    return chosen.sort((a,b)=>a.index-b.index);
  };
  for(const {index,durationGrids} of spread(holdCandidates,P.holdMaxCount,2)){
    notes[index].type='HOLD';
    notes[index].durationGrids=durationGrids;
  }

  // --- FLICK（フレーズの切れ目＝次まで間があく強い音を、曲全体へ散らす） ---
  if(P.flickMaxCount>0){
    const flickCandidates=[];
    for(let i=1;i<notes.length-1;i++){
      if(notes[i].type!=='TAP')continue;
      if(notes[i].grid%BEAT!==0)continue;
      if(notes[i+1].grid-notes[i].grid<6)continue;
      if(notes[i].grid-notes[i-1].grid<4)continue;
      flickCandidates.push({index:i});
    }
    for(const {index} of spread(flickCandidates,P.flickMaxCount,3)){
      notes[index].type='FLICK';
      // FLICKは狙いを絞れるように幅を1へ寄せる。
      notes[index].subLaneWidth=1;
      notes[index].subLane=Math.max(0,Math.min(9,notes[index].lane*2));
      notes[index].lane=Math.floor(notes[index].subLane/2);
    }
  }

  // --- SLIDE（拍頭を起点に、その区間のノーツを1本の経路へ置き換える） ---
  // 空いている所を探すのではなく、区間ごと置き換える。密度を上げても必ず置けるようにするため。
  if(P.slideMaxCount>0){
    const SLIDE_GRIDS=12;
    const slideCandidates=[];
    for(let i=1;i<notes.length-1;i++){
      if(notes[i].type!=='TAP')continue;
      if(notes[i].grid%BEAT!==0)continue;
      // HOLD/FLICKを巻き込む区間は選ばない（作り分けた種別を消さないため）。
      if(notes.some(o=>o!==notes[i]&&o.grid>notes[i].grid&&o.grid<=notes[i].grid+SLIDE_GRIDS&&o.type!=='TAP'))continue;
      slideCandidates.push({index:i});
    }
    const chosen=spread(slideCandidates,P.slideMaxCount,8);
    const startGrids=chosen.map(c=>notes[c.index].grid);
    for(const startGrid of startGrids){
      const note=notes.find(n=>n.grid===startGrid);
      if(!note)continue;
      // 0.5レーン刻みで3点。中央へ寄せながら進む、押しやすい形にする。
      const startLane=note.lane<=2?note.lane:note.lane-1;
      const points=[0,.5,1].map((r,step)=>({
        grid:startGrid+Math.round(SLIDE_GRIDS*r),
        lane:startLane+step*.5,
        subLaneWidth:step===1?3:2,
      }));
      note.type='SLIDE';
      note.durationGrids=SLIDE_GRIDS;
      note.slidePoints=points;
      note.lane=points[0].lane;
      note.endLane=points[points.length-1].lane;
      note.subLaneWidth=2;
      delete note.subLane;
      // 経路の内側にあるノーツは消す（同じ指で追えなくなるため）。
      for(let i=notes.length-1;i>=0;i--){
        const other=notes[i];
        if(other===note)continue;
        if(other.grid>startGrid&&other.grid<=startGrid+SLIDE_GRIDS)notes.splice(i,1);
      }
    }
  }

  // --- 複合操作（HOLD/SLIDEの最中に、離れたレーンへTAPを1つ重ねる） ---
  const overlaps=[];
  if(P.simultaneous){
    const longNotes=notes.filter(n=>n.type==='HOLD'||n.type==='SLIDE');
    for(const n of longNotes){
      const midGrid=n.grid+Math.round(n.durationGrids/2);
      if(midGrid%P.latticeGrids!==0)continue;
      if(notes.some(o=>o.grid===midGrid))continue;
      const support=byGrid.get(midGrid);
      if(!support||Math.abs(support.offsetMs)>COMMON.maxAbsPeakOffsetMs)continue;
      // 長押ししている指から2サブレーン以上離す（隣接した同時押しを作らない）。
      const baseSub=n.type==='SLIDE'?Math.round(n.lane*2):n.subLane;
      const lane=baseSub<=4?4:0;
      // 並べ替えで位置が動くので、どのノーツへ重ねたかは添字ではなくグリッドで覚える。
      overlaps.push({type:'TAP',grid:midGrid,lane,subLane:lane*2,subLaneWidth:2,
        sourceStrength:Math.round(support.strength*100)/100,sourcePeakOffsetMs:support.offsetMs,overlapWithGrid:n.grid});
    }
    notes.push(...overlaps);
    notes.sort((a,b)=>a.grid-b.grid||a.subLane-b.subLane);
  }

  // --- モンスターノーツ（TAPのみ・前後を空けた拍頭・時刻順に1〜4枠） ---
  const firstGrid=notes[0].grid,lastGrid=notes[notes.length-1].grid;
  const span=lastGrid-firstGrid;
  const used=new Set();
  COMMON.monsterTargets.forEach((ratio,index)=>{
    const target=firstGrid+span*ratio;
    let bestIndex=-1,bestDistance=Infinity;
    notes.forEach((note,i)=>{
      if(note.type!=='TAP'||used.has(i))return;
      if(note.grid%BEAT!==0)return;
      const before=i>0?note.grid-notes[i-1].grid:Infinity;
      const after=i<notes.length-1?notes[i+1].grid-note.grid:Infinity;
      if(before<COMMON.monsterClearGrids||after<COMMON.monsterClearGrids)return;
      const distance=Math.abs(note.grid-target);
      if(distance<bestDistance){bestDistance=distance;bestIndex=i;}
    });
    if(bestIndex>=0){notes[bestIndex].monsterSlot=index+1;used.add(bestIndex);}
  });

  const typeCounts=notes.reduce((acc,n)=>{acc[n.type]=(acc[n.type]||0)+1;return acc;},{});
  const spanMs=gridTimeMs(lastGrid)-gridTimeMs(firstGrid);
  return {
    trackId:TRACK_ID,
    difficulty,
    candidateVersion:1,
    status:'FORMAL_CANDIDATE',
    reviewRequired:true,
    runtimeConnected:false,
    bpm:timing.bpm,
    beatZeroMs:timing.beatZeroMs,
    subdivisionsPerBeat:timing.subdivisionsPerBeat,
    source:'monster-hero-onset-selection-v1',
    policy:{
      maxAbsPeakOffsetMs:COMMON.maxAbsPeakOffsetMs,
      mainLaneOnly:P.slideMaxCount===0,
      latticeGrids:P.latticeGrids,
      types:[...P.types],
      widths:[...P.widths],
      holdGrids:[4,8],
      maxLaneStep:P.maxLaneStep,
      simultaneous:P.simultaneous,
      note:'耳確認前の制作候補。±30msを超えた候補は採用せず earReviewGrids へ保留する。正式完成譜面ではない。',
    },
    level:P.level,
    noteCount:notes.length,
    typeCounts,
    densityPerSecond:Math.round(notes.length/(spanMs/1000)*100)/100,
    monsterSlotGrids:notes.filter(n=>n.monsterSlot).map(n=>n.grid),
    earReviewGrids:earReview,
    notes,
  };
};

// --- runtimeの行へ変換する ---
const runtimeRows=candidate=>candidate.notes.map(n=>{
  const timeMs=Math.round(gridTimeMs(n.grid));
  if(n.type==='SLIDE'){
    const points=n.slidePoints.map(p=>`[${Math.round(gridTimeMs(p.grid))},${p.lane},${p.subLaneWidth}]`).join(',');
    return `s(${timeMs},${Math.round(gridTimeMs(n.grid+n.durationGrids))},[${points}])`;
  }
  if(n.type==='HOLD')return `h(${timeMs},${n.subLane},${n.subLaneWidth},${Math.round(gridTimeMs(n.grid+n.durationGrids))})`;
  if(n.type==='FLICK')return `f(${timeMs},${n.subLane},${n.subLaneWidth})`;
  return `t(${timeMs},${n.subLane},${n.subLaneWidth},${n.monsterSlot||0})`;
});

const DIFFICULTIES=only?[only]:['EASY','NORMAL','HARD'];
let runtimeSource=fs.readFileSync(RUNTIME,'utf8');
for(const difficulty of DIFFICULTIES){
  if(!PROFILES[difficulty])throw new Error(`未知の難易度: ${difficulty}`);
  const candidate=buildChart(difficulty);
  const first=candidate.notes[0],last=candidate.notes[candidate.notes.length-1];
  console.log(`${difficulty}: ${candidate.noteCount}ノーツ (${Object.entries(candidate.typeCounts).map(([k,v])=>`${k}${v}`).join(' / ')})`);
  console.log(`  ${(gridTimeMs(first.grid)/1000).toFixed(1)}s〜${(gridTimeMs(last.grid)/1000).toFixed(1)}s / ${candidate.densityPerSecond}ノーツ毎秒 / 耳確認${candidate.earReviewGrids.length}件`);
  if(!write)continue;
  const out=path.join(ROOT,`monster-hero/debug/monster-hero-theme-${difficulty.toLowerCase()}-formal-candidate-v1.json`);
  fs.writeFileSync(out,JSON.stringify(candidate,null,1)+'\n');
  const begin=`// <monster-hero-${difficulty.toLowerCase()}-notes>`;
  const end=`// </monster-hero-${difficulty.toLowerCase()}-notes>`;
  const b=runtimeSource.indexOf(begin),e=runtimeSource.indexOf(end);
  if(b<0||e<b)throw new Error(`rhythm-mode.js の ${difficulty} 譜面マーカーが見つかりません`);
  const rows=runtimeRows(candidate);
  const lines=[];
  for(let i=0;i<rows.length;i+=4)lines.push('  '+rows.slice(i,i+4).join(',')+',');
  runtimeSource=`${runtimeSource.slice(0,b+begin.length)}\n${lines.join('\n')}\n${runtimeSource.slice(e)}`;
  console.log(`  書き出し: ${path.relative(ROOT,out)}`);
}
if(write){
  fs.writeFileSync(RUNTIME,runtimeSource);
  console.log(`書き出し: ${path.relative(ROOT,RUNTIME)}`);
}else console.log('（--write を付けると書き出します）');
