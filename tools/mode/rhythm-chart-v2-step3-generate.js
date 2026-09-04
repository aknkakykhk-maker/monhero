#!/usr/bin/env node
// 自動譜面制作システム V2 STEP3: 生成ルールへの構造反映。
//
//   node tools/mode/rhythm-chart-v2-step3-generate.js                    # 内訳を表示するだけ
//   node tools/mode/rhythm-chart-v2-step3-generate.js --write            # 3難易度をauthoring/へ書き出す
//   node tools/mode/rhythm-chart-v2-step3-generate.js --difficulty HARD  # 1つだけ
//
// 入力:  tools/mode/authoring/<track>-v2-features.json  （STEP1: 楽曲特徴・盛り上がり解析）
//        tools/mode/authoring/<track>-v2-structure.json （STEP2: セクション/フレーズ解析）
//        tools/mode/authoring/monster-hero-theme-onset-candidates(-dense).json（既存の実音源解析。V1と共用）
//        monster-hero/data/rhythm-timing.js（BPM・beatZero・16分グリッド。V1と共用）
// 出力:  tools/mode/authoring/<track>-v2-chart-<難易度>.json
//
// V1（tools/mode/rhythm-monster-hero-chart-build.js）は一切変更しない。
// V1は「小節ごとの採用オンセット強さ合計」の三分位だけで密度を決めていたが、
// V2 STEP3ではSTEP1のintensity（楽曲全体を通した盛り上がり推移）とSTEP2の
// section種別・フレーズ反復（motif）を使って密度・派手さを決める。
// それ以外（採用基準・幅・レーン移動・HOLD/FLICK/SLIDE・複合操作・モンスター配置）は
// V1と同じロジックを踏襲する（ここを差し替えるのはV2 STEP4以降の範囲）。
//
// 出力はreviewRequired=true / runtimeConnected=falseの設計資料であり、
// game-system.jsxやmonster-hero/data/rhythm-mode.jsのランタイムには一切接続しない。
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
const TRACKS=Object.freeze({
  monster_hero_theme:Object.freeze({
    featuresInput:'tools/mode/authoring/monster-hero-theme-v2-features.json',
    structureInput:'tools/mode/authoring/monster-hero-theme-v2-structure.json',
    candidateFiles:Object.freeze({
      normal:'tools/mode/authoring/monster-hero-theme-onset-candidates.json',
      dense:'tools/mode/authoring/monster-hero-theme-onset-candidates-dense.json',
    }),
    outputPrefix:'tools/mode/authoring/monster-hero-theme-v2-chart-',
  }),
});
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const write=process.argv.includes('--write');
const only=arg('--difficulty');
const trackId=arg('--track','monster_hero_theme');
const outputDir=arg('--output-dir',null);
const config=TRACKS[trackId];
if(!config){console.error(`STEP3未登録トラックです: ${trackId} (${Object.keys(TRACKS).join(', ')})`);process.exit(1);}

// --- 全難易度で共通の下地。V1と同じ値を使う（採用基準を変えると比較ができなくなるため） ---
const COMMON=Object.freeze({
  maxAbsPeakOffsetMs:30,
  earReviewMaxOffsetMs:42,
  minTimeMs:1800,
  endPaddingMs:1200,
  monsterSlots:4,
  monsterTargets:[.2,.4,.6,.8],
  monsterClearGrids:4,
});

// --- 難易度ごとの制作方針。widths/types/maxLaneStep等はV1と同じ値。perBarByIntensityの
//     選び方（どの段を使うか）だけがV2で変わる ---
const PROFILES=Object.freeze({
  EASY:Object.freeze({
    level:1,candidateSource:'normal',minStrength:0,latticeGrids:2,
    perBarByIntensity:[2,3,4],maxConsecutiveEighths:2,maxLaneStep:1,
    widths:[2],simultaneous:false,types:['TAP','HOLD'],
    holdMaxCount:10,holdMinGapGrids:12,flickMaxCount:0,slideMaxCount:0,
  }),
  NORMAL:Object.freeze({
    level:3,candidateSource:'dense',minStrength:.45,latticeGrids:2,
    perBarByIntensity:[3,4,6],maxConsecutiveEighths:4,maxLaneStep:2,
    widths:[1,2,3],simultaneous:false,types:['TAP','HOLD','FLICK'],
    holdMaxCount:14,holdMinGapGrids:10,flickMaxCount:12,slideMaxCount:0,
  }),
  HARD:Object.freeze({
    level:5,candidateSource:'dense',minStrength:.30,latticeGrids:1,
    perBarByIntensity:[5,7,9],maxConsecutiveEighths:6,maxLaneStep:3,
    widths:[1,2,3,4],simultaneous:true,types:['TAP','HOLD','FLICK','SLIDE'],
    holdMaxCount:14,holdMinGapGrids:10,flickMaxCount:16,slideMaxCount:8,
  }),
});

// セクション種別ごとの段調整。INTRO/BREAK/OUTROは1段下げて静けさを出し、
// BUILD系・CHORUS系は1段上げて盛り上げる。VERSE/BRIDGEは調整しない。
const SECTION_TIER_ADJUST=Object.freeze({
  INTRO:-1,OUTRO:-1,BREAK:-1,
  VERSE:0,BRIDGE:0,
  BUILD:1,PRE_CHORUS:1,CHORUS:1,FINAL_CHORUS:1,
});
const sectionTierAdjust=sectionType=>SECTION_TIER_ADJUST[sectionType]??0;

// --- 入力読み込み ---
const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-timing.js'),'utf8')}\nthis.__t=RHYTHM_TIMING_DATA[${JSON.stringify(trackId)}];`,timingContext);
const timing=timingContext.__t;
if(!timing)throw new Error(`${trackId} timing data is missing`);
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const gridTimeMs=g=>timing.beatZeroMs+g*gridMs;
const BEAT=timing.subdivisionsPerBeat;
const BAR=BEAT*4;

const features=JSON.parse(fs.readFileSync(path.join(ROOT,config.featuresInput),'utf8'));
if(features.analysisType!=='rhythm-chart-v2-step1-features')throw new Error('STEP1 V2 JSONではありません');
if(features.trackId!==trackId)throw new Error(`features trackId不一致: ${features.trackId} != ${trackId}`);

const structure=JSON.parse(fs.readFileSync(path.join(ROOT,config.structureInput),'utf8'));
if(structure.analysisType!=='rhythm-chart-v2-step2-structure')throw new Error('STEP2 V2 JSONではありません');
if(structure.trackId!==trackId)throw new Error(`structure trackId不一致: ${structure.trackId} != ${trackId}`);

const loadCandidates=key=>{
  const source=JSON.parse(fs.readFileSync(path.join(ROOT,config.candidateFiles[key]),'utf8'));
  if(source.trackId!==trackId)throw new Error('候補ファイルのtrackIdが一致しません');
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
const minBar=Math.floor(minGrid/BAR),maxBar=Math.floor(maxGrid/BAR);

// --- 構造ルックアップ ---
// bar(小節)ごとのintensityは、STEP1のtimeline(500ms窓)のうちその小節へ重なる窓の平均。
// 窓が無い小節（曲末尾の端数等）は最も近い窓のintensityで埋める。
const timeline=features.timeline;
const barIntensity=barIndex=>{
  const startMs=gridTimeMs(barIndex*BAR),endMs=gridTimeMs((barIndex+1)*BAR);
  const inRange=timeline.filter(w=>w.centerMs>=startMs&&w.centerMs<endMs);
  if(inRange.length)return inRange.reduce((s,w)=>s+w.intensity,0)/inRange.length;
  let nearest=timeline[0],bestDist=Infinity;
  for(const w of timeline){const d=Math.abs(w.centerMs-(startMs+endMs)/2);if(d<bestDist){bestDist=d;nearest=w;}}
  return nearest?nearest.intensity:.5;
};
const sections=structure.sections;
const sectionForMs=ms=>{
  for(const s of sections)if(ms>=s.startMs&&ms<s.endMs)return s;
  return sections[sections.length-1]||null;
};
const phrases=structure.phrases;
const phraseForBar=barIndex=>phrases.find(p=>barIndex>=p.startBar&&barIndex<p.endBarExclusive)||null;
const phraseById=id=>phrases.find(p=>p.id===id)||null;

// --- 小節ごとの基礎段（三分位）を、V1の「オンセット強さ合計」ではなくSTEP1 intensityから決める ---
const barIndices=[];
for(let b=minBar;b<=maxBar;b++)barIndices.push(b);
const intensities=barIndices.map(barIntensity);
const sortedIntensities=intensities.slice().sort((a,b)=>a-b);
const q=r=>sortedIntensities[Math.min(sortedIntensities.length-1,Math.floor(sortedIntensities.length*r))];
const lowCut=q(1/3),midCut=q(2/3);
const baseTier=value=>value<=lowCut?0:value<=midCut?1:2;

const tierForBar=barIndex=>{
  const raw=baseTier(barIntensity(barIndex));
  const section=sectionForMs(gridTimeMs(barIndex*BAR));
  const adjust=section?sectionTierAdjust(section.sectionTypeCandidate):0;
  return Math.max(0,Math.min(2,raw+adjust));
};

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

  // --- 構造反映の核心: 小節ごとの「採用のしやすさ」自体を段で変える ---
  // 実測すると、この曲は下地となるオンセット候補の本数（1小節あたり約4〜5件）が
  // 難易度側のperBarByIntensity上限を下回っており、上限だけを段で変えても
  // 実際の採用数はほぼ変化しない（=盛り上がりが譜面へ出ない）ことが分かった。
  // そのため段の実効差は、上限に加えて「格子の細かさ」と「採用に必要な強さ」でも作る。
  // 静かな段（tier0）は格子を粗く・必要な強さを高くして採用そのものを絞り、
  // 盛り上がる段（tier2）は格子・強さを難易度既定のまま（または僅かに緩め）にして
  // 実際に採用される本数を増やす。
  const effectiveLatticeGrids=tier=>tier===0?P.latticeGrids*2:P.latticeGrids;
  const effectiveMinStrength=tier=>tier===0?Math.min(1,P.minStrength+.15):tier===2?Math.max(0,P.minStrength-.05):P.minStrength;
  const admittedInBar=(bar,tier)=>{
    const lattice=effectiveLatticeGrids(tier),minStrength=effectiveMinStrength(tier);
    const start=bar*BAR,end=start+BAR;
    const items=[];
    for(const item of adopted){
      if(item.grid<start||item.grid>=end)continue;
      if(item.grid%lattice!==0)continue;
      if(item.strength<minStrength)continue;
      items.push(item);
    }
    return items;
  };

  // --- 小節ごとに、構造反映後の段に応じた採用基準・本数で選ぶ（V1と同じ拍頭優先→強い順） ---
  const picked=[];
  for(let bar=minBar;bar<=maxBar;bar++){
    const tier=tierForBar(bar);
    const items=admittedInBar(bar,tier);
    if(!items.length)continue;
    const limit=P.perBarByIntensity[tier];
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

  // --- フレーズmotif反映: 反復フレーズ(repeatedFromPhraseId)は、小節数が一致する場合だけ
  //     元フレーズと同じ拍位置（フレーズ先頭からの相対グリッド）に音を置く。
  //     ただし架空の音を作らない: 元と同じ相対位置の近傍(±2グリッド)に、そのフレーズ自身の
  //     実オンセット候補（採用基準を満たすもの）が実在する場合だけ採用する。無ければその1音は
  //     motifGapとして数え、無理に置かない。 ---
  let motifPhrasesTotal=0,motifPhrasesApplied=0,motifNotesAttempted=0,motifNotesGrounded=0;
  for(const phrase of phrases){
    if(!phrase.repeatedFromPhraseId)continue;
    if(phrase.startBar<minBar||phrase.endBarExclusive-1>maxBar)continue;
    motifPhrasesTotal++;
    const source=phraseById(phrase.repeatedFromPhraseId);
    if(!source)continue;
    const sourceBarCount=source.endBarExclusive-source.startBar;
    const repeatBarCount=phrase.endBarExclusive-phrase.startBar;
    if(sourceBarCount!==repeatBarCount)continue;
    if(source.startBar<minBar||source.endBarExclusive-1>maxBar)continue;
    motifPhrasesApplied++;
    const sourceStartGrid=source.startBar*BAR,repeatStartGrid=phrase.startBar*BAR;
    const sourcePicks=picked.filter(p=>p.grid>=sourceStartGrid&&p.grid<source.endBarExclusive*BAR);
    const grounded=[];
    for(const sourcePick of sourcePicks){
      motifNotesAttempted++;
      const targetGrid=repeatStartGrid+(sourcePick.grid-sourceStartGrid);
      const targetTier=tierForBar(Math.floor(targetGrid/BAR));
      const minStrength=effectiveMinStrength(targetTier);
      const lattice=effectiveLatticeGrids(targetTier);
      let best=null,bestDist=Infinity;
      for(let d=0;d<=2;d++){
        for(const g of d===0?[targetGrid]:[targetGrid-d,targetGrid+d]){
          const candidate=byGrid.get(g);
          if(!candidate)continue;
          if(!inRange(candidate))continue;
          if(candidate.grid%lattice!==0)continue;
          if(candidate.strength<minStrength)continue;
          if(Math.abs(candidate.offsetMs)>COMMON.maxAbsPeakOffsetMs)continue;
          if(Math.abs(g-targetGrid)<bestDist){bestDist=Math.abs(g-targetGrid);best=candidate;}
        }
        if(best)break;
      }
      if(best){grounded.push(best);motifNotesGrounded++;}
    }
    // このフレーズ範囲の独立選択結果を、motifで根拠づけられた選択へ置き換える。
    for(let i=picked.length-1;i>=0;i--){
      if(picked[i].grid>=repeatStartGrid&&picked[i].grid<phrase.endBarExclusive*BAR)picked.splice(i,1);
    }
    for(const item of grounded){
      if(!picked.some(p=>p.grid===item.grid))picked.push(item);
    }
  }
  picked.sort((a,b)=>a.grid-b.grid);

  // --- 以降はV1と同じ後処理（間引き・幅・レーン・HOLD/FLICK/SLIDE・複合操作・モンスター配置） ---
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

  const notes=[];
  let lane=2,dir=1,prevBar=-1;
  spaced.forEach((item,index)=>{
    const bar=Math.floor(item.grid/BAR);
    const sameBar=bar===prevBar;
    if(!sameBar){dir=bar%2===0?1:-1;prevBar=bar;}
    const prev=spaced[index-1];
    const keepLane=prev&&item.grid-prev.grid<=P.latticeGrids&&sameBar;
    if(!keepLane){
      let next=lane+dir*P.maxLaneStep;
      if(next<0||next>4){dir=-dir;next=lane+dir*P.maxLaneStep;}
      lane=Math.max(0,Math.min(4,next));
    }
    const width=widthFor(item,index);
    const subLane=Math.max(0,Math.min(10-width,lane*2));
    notes.push({type:'TAP',grid:item.grid,lane:Math.floor(subLane/2),subLane,subLaneWidth:width,
      sourceStrength:Math.round(item.strength*100)/100,sourcePeakOffsetMs:item.offsetMs});
  });

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
      notes[index].subLaneWidth=1;
      notes[index].subLane=Math.max(0,Math.min(9,notes[index].lane*2));
      notes[index].lane=Math.floor(notes[index].subLane/2);
    }
  }

  if(P.slideMaxCount>0){
    const SLIDE_GRIDS=12;
    const slideCandidates=[];
    for(let i=1;i<notes.length-1;i++){
      if(notes[i].type!=='TAP')continue;
      if(notes[i].grid%BEAT!==0)continue;
      if(notes.some(o=>o!==notes[i]&&o.grid>notes[i].grid&&o.grid<=notes[i].grid+SLIDE_GRIDS&&o.type!=='TAP'))continue;
      slideCandidates.push({index:i});
    }
    const chosen=spread(slideCandidates,P.slideMaxCount,8);
    const startGrids=chosen.map(c=>notes[c.index].grid);
    for(const startGrid of startGrids){
      const note=notes.find(n=>n.grid===startGrid);
      if(!note)continue;
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
      for(let i=notes.length-1;i>=0;i--){
        const other=notes[i];
        if(other===note)continue;
        if(other.grid>startGrid&&other.grid<=startGrid+SLIDE_GRIDS)notes.splice(i,1);
      }
    }
  }

  const overlaps=[];
  if(P.simultaneous){
    const longNotes=notes.filter(n=>n.type==='HOLD'||n.type==='SLIDE');
    for(const n of longNotes){
      const midGrid=n.grid+Math.round(n.durationGrids/2);
      if(midGrid%P.latticeGrids!==0)continue;
      if(notes.some(o=>o.grid===midGrid))continue;
      const support=byGrid.get(midGrid);
      if(!support||Math.abs(support.offsetMs)>COMMON.maxAbsPeakOffsetMs)continue;
      const baseSub=n.type==='SLIDE'?Math.round(n.lane*2):n.subLane;
      const lane=baseSub<=4?4:0;
      overlaps.push({type:'TAP',grid:midGrid,lane,subLane:lane*2,subLaneWidth:2,
        sourceStrength:Math.round(support.strength*100)/100,sourcePeakOffsetMs:support.offsetMs,overlapWithGrid:n.grid});
    }
    notes.push(...overlaps);
    notes.sort((a,b)=>a.grid-b.grid||a.subLane-b.subLane);
  }

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
    schemaVersion:1,
    analysisType:'rhythm-chart-v2-step3-chart',
    trackId,
    difficulty,
    candidateVersion:1,
    status:'V2_STRUCTURE_CANDIDATE',
    reviewRequired:true,
    runtimeConnected:false,
    bpm:timing.bpm,
    beatZeroMs:timing.beatZeroMs,
    subdivisionsPerBeat:timing.subdivisionsPerBeat,
    source:'rhythm-chart-v2-step3-generate',
    policy:{
      maxAbsPeakOffsetMs:COMMON.maxAbsPeakOffsetMs,
      mainLaneOnly:P.slideMaxCount===0,
      latticeGrids:P.latticeGrids,
      types:[...P.types],
      widths:[...P.widths],
      holdGrids:[4,8],
      maxLaneStep:P.maxLaneStep,
      simultaneous:P.simultaneous,
      structureSource:{features:config.featuresInput,structure:config.structureInput},
      note:'V2 STEP3: 小節の密度段はSTEP1のintensityとSTEP2のsection種別から決め、反復フレーズはmotifとして揃えている。耳確認前の設計資料であり、正式完成譜面ではない。',
    },
    level:P.level,
    noteCount:notes.length,
    typeCounts,
    densityPerSecond:Math.round(notes.length/(spanMs/1000)*100)/100,
    monsterSlotGrids:notes.filter(n=>n.monsterSlot).map(n=>n.grid),
    earReviewGrids:earReview,
    motif:{phrasesTotal:motifPhrasesTotal,phrasesApplied:motifPhrasesApplied,notesAttempted:motifNotesAttempted,notesGrounded:motifNotesGrounded},
    notes,
  };
};

const DIFFICULTIES=only?[only]:['EASY','NORMAL','HARD'];
for(const difficulty of DIFFICULTIES){
  if(!PROFILES[difficulty])throw new Error(`未知の難易度: ${difficulty}`);
  const candidate=buildChart(difficulty);
  const first=candidate.notes[0],last=candidate.notes[candidate.notes.length-1];
  console.log(`${difficulty}: ${candidate.noteCount}ノーツ (${Object.entries(candidate.typeCounts).map(([k,v])=>`${k}${v}`).join(' / ')})`);
  console.log(`  ${(gridTimeMs(first.grid)/1000).toFixed(1)}s〜${(gridTimeMs(last.grid)/1000).toFixed(1)}s / ${candidate.densityPerSecond}ノーツ毎秒 / 耳確認${candidate.earReviewGrids.length}件`);
  console.log(`  motif: 反復フレーズ${candidate.motif.phrasesTotal}件中${candidate.motif.phrasesApplied}件へ適用 / 音${candidate.motif.notesAttempted}件中${candidate.motif.notesGrounded}件を実オンセットへ接地`);
  if(!write)continue;
  const out=outputDir
    ?path.join(path.resolve(outputDir),`${trackId.replace(/_/g,'-')}-v2-chart-${difficulty.toLowerCase()}.json`)
    :path.join(ROOT,`${config.outputPrefix}${difficulty.toLowerCase()}.json`);
  fs.writeFileSync(out,JSON.stringify(candidate,null,1)+'\n');
  console.log(`  書き出し: ${outputDir?out:path.relative(ROOT,out)}`);
}
if(!write)console.log('（--write を付けると tools/mode/authoring/ へ書き出します。ランタイムへは接続しません）');
