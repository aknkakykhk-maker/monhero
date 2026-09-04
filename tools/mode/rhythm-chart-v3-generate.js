#!/usr/bin/env node
// 自動譜面制作V3: 音の種類・音の高さ・形の語彙から譜面を組み立てる。
//
//   node tools/mode/rhythm-chart-v3-generate.js                     # 内訳を表示するだけ
//   node tools/mode/rhythm-chart-v3-generate.js --write             # authoring/ へ書き出す
//   node tools/mode/rhythm-chart-v3-generate.js --difficulty HARD
//   node tools/mode/rhythm-chart-v3-generate.js --explain HARD      # どう組み立てたかを並べて見る
//
// 入力: tools/mode/authoring/<track>-v3-audio.json     （V3音源解析: 音の性格・高さ・伸び）
//       tools/mode/authoring/<track>-v2-structure.json （セクション・フレーズ）
// 出力: tools/mode/authoring/<track>-v3-chart-<難易度>.json
//
// 作り方の根拠はすべて docs/spec/RHYTHM_CHART_DESIGN.md にある。
// V2（rhythm-chart-v2-step3-generate.js）は残したまま、別系統として作る。
//
// 【V2から変えた4つ】
// 1. 拾う音を「強さの順位」ではなく**音の種類**で決める（レイヤリング）
// 2. レーンを「使用回数が少ない順」ではなく**形の語彙**で決める（読める譜面にする）
// 3. HOLDの長さ・SLIDEの経路を**実際の音**（伸びている区間・音の高さの動き）から決める
// 4. 難易度を独立に作らず、**同じ優先順位の上位から何個取るか**だけで分ける
//    （EASYで覚えた形がそのまま上位難易度にも出る＝学習曲線になる）
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {HAND_MODEL,fingerPairFeasible,noteTouchLane}=require('./rhythm-hand-model.js');
const {LANES,PATTERN_BY_ID,mirror,fitToLanes,maxStepOf,shapeCandidatesFor}=require('./rhythm-chart-v3-patterns.js');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const write=process.argv.includes('--write');
const only=arg('--difficulty');
const explain=arg('--explain');
const trackId=arg('--track','monster_hero_theme');
const outputDir=arg('--output-dir',null);
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];

// ============================================================================
// 音の拾い方（レイヤリング）
// ============================================================================
// 音の種類ごとの重み。曲の背骨（大きな一発・重い打点）から先に拾い、
// 装飾（軽い音）は上の難易度でだけ拾われる。
// docs/spec/RHYTHM_CHART_DESIGN.md 7章「拾う音の選び方」。
const CHARACTER_WEIGHT=Object.freeze({FULL:1,PUNCH:.72,BODY:.66,LIGHT:.30});
// 拍の中のどこか。拍の頭がいちばん大事で、16分の裏はいちばん後回し。
const POSITION_WEIGHT=Object.freeze([.95,0,.5,0]);
const STRENGTH_WEIGHT=1.15;
const SUSTAIN_BONUS=.22;          // 伸びる音は「押さえる価値がある」ので少し優先する
// 音程のある音（メロディ・歌）は譜面の顔になる。打楽器ばかりの譜面にしないため少し優先する。
const PITCHED_BONUS=.18;

// 難易度ごとの方針。**拾う量（musicalShare）と、できることだけ**を持つ。
// 拾う順番はすべての難易度で同じなので、下の難易度は上の難易度の部分集合になる。
const PROFILES=Object.freeze({
  EASY:Object.freeze({level:1,musicalShare:.285,lattice:2,maxLaneStep:1,maxRun:2,
    types:['TAP','HOLD'],widths:[3,4,6],narrowRate:0,simultaneous:false,
    holdMax:14,slideMax:0,flickMax:0,endFlickMax:0,chordMax:0,accentWidth:10,accentMax:6}),
  NORMAL:Object.freeze({level:3,musicalShare:.318,lattice:2,maxLaneStep:2,maxRun:3,
    types:['TAP','HOLD','FLICK'],widths:[2,3,4,6],narrowRate:0,simultaneous:false,
    holdMax:16,slideMax:0,flickMax:14,endFlickMax:3,chordMax:0,accentWidth:10,accentMax:6}),
  HARD:Object.freeze({level:5,musicalShare:.443,lattice:1,maxLaneStep:2,maxRun:2,
    types:['TAP','HOLD','FLICK','SLIDE'],widths:[1,2,3,4,5],narrowRate:.04,simultaneous:false,
    holdMax:18,slideMax:10,flickMax:18,endFlickMax:5,chordMax:0,accentWidth:8,accentMax:7}),
  EXPERT:Object.freeze({level:7,musicalShare:.497,lattice:1,maxLaneStep:3,maxRun:5,
    types:['TAP','HOLD','FLICK','SLIDE'],widths:[1,2,3,4,5],narrowRate:.12,simultaneous:true,
    holdMax:20,slideMax:12,flickMax:22,endFlickMax:7,chordMax:12,accentWidth:8,accentMax:7}),
  MASTER:Object.freeze({level:9,musicalShare:.560,lattice:1,maxLaneStep:4,maxRun:8,
    types:['TAP','HOLD','FLICK','SLIDE'],widths:[1,2,3,4],narrowRate:.20,simultaneous:true,
    holdMax:22,slideMax:14,flickMax:26,endFlickMax:9,chordMax:18,accentWidth:6,accentMax:8}),
});
// 盛り上がりで小節あたりの上限を持ち上げる幅（V2で実機確認済みの考え方をそのまま使う）。
// 「その小節に実際にある音の数」を土台にし、音量だけで増やさない。
const MUSICAL_LIFT=Object.freeze([.45,1.35]);
const SECTION_POSITION_ADJUST=.2;
const SECTION_ADJUST=Object.freeze({INTRO:-1,OUTRO:-1,BREAK:-1,VERSE:0,BRIDGE:0,
  BUILD:1,PRE_CHORUS:1,CHORUS:1,FINAL_CHORUS:1});

const COMMON=Object.freeze({
  minTimeMs:1800,
  endPaddingMs:1200,
  maxAbsPeakOffsetMs:30,
  earReviewMaxOffsetMs:43,
  monsterSlots:4,
  monsterTargets:[.2,.4,.6,.8],
  monsterClearGrids:4,
  runGapGrids:9,          // これ以上あいたら別の「かたまり」にする（2拍ぶん）
  chunkFast:4,            // 16分が並ぶところは4個ずつの形にする（1拍ぶん）
  chunkMedium:6,          // 8分が並ぶところは6個まで
  chunkSlow:8,            // ゆっくりのところは8個まで
  slideMinGrids:6,
  slideMinMove:.10,       // 音の高さがこれだけ動いていればSLIDEにする
  holdMinGrids:4,
  laneStepFastMax:2,      // 8分より速い間隔では、歩幅いっぱいに跳ばない
});

// ============================================================================
// 読み込み
// ============================================================================
const readJson=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const dashed=trackId.replace(/_/g,'-');
const audio=readJson(`tools/mode/authoring/${dashed}-v3-audio.json`);
if(audio.analysisType!=='rhythm-audio-v3')throw new Error('V3音源解析のJSONではありません');
const structure=readJson(`tools/mode/authoring/${dashed}-v2-structure.json`);
const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-timing.js'),'utf8')}\nthis.__t=RHYTHM_TIMING_DATA[${JSON.stringify(trackId)}];`,timingContext);
const timing=timingContext.__t;
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const gridTimeMs=grid=>timing.beatZeroMs+grid*gridMs;
const BEAT=timing.subdivisionsPerBeat;
const BAR=BEAT*4;
const minGrid=Math.ceil((COMMON.minTimeMs-timing.beatZeroMs)/gridMs);
const maxGrid=Math.floor((timing.audioDurationMs-COMMON.endPaddingMs-timing.beatZeroMs)/gridMs);
const minBar=Math.floor(minGrid/BAR),maxBar=Math.floor(maxGrid/BAR);

// 打点をグリッドごとに1つへまとめる（同じ位置に2つ以上あれば強いほうを残す）
const onsetByGrid=new Map();
for(const onset of audio.onsets){
  if(onset.grid<minGrid||onset.grid>maxGrid)continue;
  if(Math.abs(onset.gridOffsetMs)>COMMON.earReviewMaxOffsetMs)continue;
  const prev=onsetByGrid.get(onset.grid);
  if(!prev||onset.strength>prev.strength)onsetByGrid.set(onset.grid,onset);
}
const allOnsets=[...onsetByGrid.values()].sort((a,b)=>a.grid-b.grid);
const heightByGrid=new Map();
for(const point of audio.pitchCurve)if(point.height!=null)heightByGrid.set(point.grid,point.height);

// セクション・フレーズ
const sectionForGrid=grid=>{
  const ms=gridTimeMs(grid);
  for(const section of structure.sections)if(ms>=section.startMs&&ms<section.endMs)return section;
  return structure.sections[structure.sections.length-1]||null;
};
const phraseForBar=bar=>structure.phrases.find(p=>bar>=p.startBar&&bar<p.endBarExclusive)||null;

// 盛り上がり（V2と同じ考え方: 小節ごとのintensityの順位＋セクション調整）
const features=readJson(`tools/mode/authoring/${dashed}-v2-features.json`);
const barIntensity=bar=>{
  const start=gridTimeMs(bar*BAR),end=gridTimeMs((bar+1)*BAR);
  const windows=features.timeline.filter(w=>w.centerMs>=start&&w.centerMs<end);
  if(windows.length)return windows.reduce((sum,w)=>sum+w.intensity,0)/windows.length;
  let nearest=features.timeline[0],best=Infinity;
  for(const w of features.timeline){const d=Math.abs(w.centerMs-(start+end)/2);if(d<best){best=d;nearest=w;}}
  return nearest?nearest.intensity:.5;
};
const barIndices=[];for(let bar=minBar;bar<=maxBar;bar++)barIndices.push(bar);
const intensitySorted=barIndices.map(barIntensity).sort((a,b)=>a-b);
const intensityRank=value=>{
  let below=0;
  while(below<intensitySorted.length&&intensitySorted[below]<value)below++;
  return intensitySorted.length>1?below/(intensitySorted.length-1):0;
};
const intensityPosition=bar=>{
  const section=sectionForGrid(bar*BAR);
  const adjust=section?(SECTION_ADJUST[section.sectionTypeCandidate]??0):0;
  return Math.max(0,Math.min(1,intensityRank(barIntensity(bar))+adjust*SECTION_POSITION_ADJUST));
};
const musicalOnsetsInBar=bar=>allOnsets.filter(o=>o.grid>=bar*BAR&&o.grid<(bar+1)*BAR).length;

// ============================================================================
// 優先順位（すべての難易度で共通。ここが「同じ骨格の濃淡」の土台）
// ============================================================================
const priorityOf=onset=>{
  const position=((onset.grid%BEAT)+BEAT)%BEAT;
  const sustained=onset.sustainMs>=140?SUSTAIN_BONUS:0;
  return (CHARACTER_WEIGHT[onset.character]??.4)
    +onset.strength*STRENGTH_WEIGHT
    +(POSITION_WEIGHT[position]??0)
    +sustained
    +(onset.pitchHz>0?PITCHED_BONUS:0);
};
const priorityByGrid=new Map(allOnsets.map(onset=>[onset.grid,priorityOf(onset)]));

// ============================================================================
// 1つの難易度を組み立てる
// ============================================================================
const buildChart=(difficulty,options={})=>{
  const P=PROFILES[difficulty];
  const notes=[];
  const log=[];

  // --- 1. 拾う音を決める（小節ごとに、優先順位の上位から） ---
  const pool=allOnsets.filter(onset=>
    onset.grid%P.lattice===0&&Math.abs(onset.gridOffsetMs)<=COMMON.maxAbsPeakOffsetMs);
  const [liftMin,liftMax]=MUSICAL_LIFT;
  const picked=[];
  let carry=0;
  for(let bar=minBar;bar<=maxBar;bar++){
    const position=intensityPosition(bar);
    carry+=musicalOnsetsInBar(bar)*P.musicalShare*(liftMin+(liftMax-liftMin)*position);
    const limit=Math.floor(carry+1e-9);
    carry-=limit;
    if(limit<=0)continue;
    const inBar=pool.filter(onset=>onset.grid>=bar*BAR&&onset.grid<(bar+1)*BAR)
      .sort((a,b)=>priorityByGrid.get(b.grid)-priorityByGrid.get(a.grid)||a.grid-b.grid);
    const taken=[];
    for(const onset of inBar){
      if(taken.length>=limit)break;
      // 同じ小節の中で近すぎる音は取らない
      if(taken.some(t=>Math.abs(t.grid-onset.grid)<P.lattice))continue;
      taken.push(onset);
    }
    picked.push(...taken);
  }
  picked.sort((a,b)=>a.grid-b.grid);

  // --- 2. 最短の刻みの連なりを難易度なりの長さで止める ---
  const spaced=[];
  let run=1;
  for(const onset of picked){
    const last=spaced[spaced.length-1];
    if(last&&onset.grid-last.grid<=P.lattice){
      if(run>=P.maxRun)continue;
      run++;
    }else run=1;
    spaced.push(onset);
  }

  // --- 3. 伸びる音・動く音を HOLD / SLIDE として先に確保する ---
  // 「音が伸びている長さぶん押さえる」「音の高さの動きに沿ってなぞる」を、実際の解析から作る。
  const reserved=[];
  const usedGrids=new Set();
  const spacedGrids=new Set(spaced.map(o=>o.grid));
  if(P.types.includes('HOLD')||P.types.includes('SLIDE')){
    const spans=audio.sustains
      .filter(span=>span.startGrid>=minGrid&&span.endGrid<=maxGrid&&span.grids>=COMMON.holdMinGrids)
      .filter(span=>[0,1,-1,2,-2].some(shift=>spacedGrids.has(span.startGrid+shift)))
      .sort((a,b)=>b.grids-a.grids);
    let holds=0,slides=0;
    for(const span of spans){
      // 始点は、採用済みの打点にいちばん近いところへ寄せる
      const startGrid=[0,-1,1,-2,2].map(shift=>span.startGrid+shift).find(g=>spacedGrids.has(g));
      if(startGrid==null)continue;
      const endGrid=Math.min(span.endGrid,startGrid+Math.round(BEAT*4));
      const grids=endGrid-startGrid;
      if(grids<COMMON.holdMinGrids)continue;
      if(reserved.some(r=>startGrid<=r.endGrid+1&&endGrid>=r.startGrid-1))continue;
      const moves=span.moves??0;
      const wantSlide=P.types.includes('SLIDE')&&moves>=COMMON.slideMinMove&&grids>=COMMON.slideMinGrids;
      if(wantSlide){
        if(slides>=P.slideMax)continue;
        reserved.push({type:'SLIDE',startGrid,endGrid,span});slides++;
      }else{
        if(!P.types.includes('HOLD')||holds>=P.holdMax)continue;
        reserved.push({type:'HOLD',startGrid,endGrid,span});holds++;
      }
    }
    reserved.sort((a,b)=>a.startGrid-b.startGrid);
    for(const item of reserved)for(let g=item.startGrid+1;g<=item.endGrid;g++)usedGrids.add(g);
  }
  // 押さえている最中の打点は落とす（低い難易度では指が足りない）
  const events=[];
  for(const onset of spaced){
    if(usedGrids.has(onset.grid)&&!P.simultaneous)continue;
    if(usedGrids.has(onset.grid)&&P.simultaneous){
      // 上位難易度でも「押さえながら別を叩く」は指が1本しか残らない。
      //   ・同時に押さえているHOLD/SLIDEが2本あるときは置かない（指が足りない）
      //   ・始点の直後と終点の直前は避ける（押さえ始め・離しに指を使うため）
      const covering=reserved.filter(r=>onset.grid>r.startGrid&&onset.grid<=r.endGrid);
      if(covering.length!==1)continue;
      const owner=covering[0];
      if(onset.grid-owner.startGrid<BEAT)continue;
      if(owner.endGrid-onset.grid<BEAT)continue;
    }
    events.push({kind:'TAP',grid:onset.grid,onset});
  }
  for(const item of reserved){
    const onset=onsetByGrid.get(item.startGrid);
    const index=events.findIndex(e=>e.grid===item.startGrid);
    if(index>=0)events.splice(index,1);
    events.push({kind:item.type,grid:item.startGrid,onset,reserved:item});
  }
  events.sort((a,b)=>a.grid-b.grid);

  // --- 4. かたまり（フレーズ）へ分ける ---
  // まず「間があいたところ」で切り、そのあと**長すぎるかたまりを形の単位へ割る**。
  // 16分が並ぶ区間を1つの形で塗ると、8個ぶんずっと同じ交互になって読み飽きる。
  // 本物の譜面は、長い連なりを4個ずつくらいの形（階段・折り返し・トリル）の並びで書く。
  const rawRuns=[];
  for(const event of events){
    const current=rawRuns[rawRuns.length-1];
    if(current&&event.grid-current[current.length-1].grid<COMMON.runGapGrids){
      current.push(event);
    }else{
      rawRuns.push([event]);
    }
  }
  const runs=[];
  for(const list of rawRuns){
    const gapsAll=list.slice(1).map((e,i)=>e.grid-list[i].grid);
    const shortest=gapsAll.length?Math.min(...gapsAll):Infinity;
    // 細かい刻みほど短く割る（16分なら1拍ぶん＝4個、8分なら2拍ぶん）
    const chunk=shortest<=P.lattice?COMMON.chunkFast
      :shortest<=BEAT/2?COMMON.chunkMedium:COMMON.chunkSlow;
    // 音の高さの向きが変わるところを優先して割る
    const turnAt=new Set();
    const heights=list.map(e=>heightByGrid.has(e.grid)?heightByGrid.get(e.grid):null);
    for(let i=1;i<list.length-1;i++){
      const before=heights[i-1],here=heights[i],after=heights[i+1];
      if(before==null||here==null||after==null)continue;
      const a=here-before,b=after-here;
      if(a*b<0&&Math.abs(a)>.04&&Math.abs(b)>.04)turnAt.add(i+1);
    }
    let start=0;
    while(start<list.length){
      let end=Math.min(list.length,start+chunk);
      for(let i=start+2;i<Math.min(list.length,start+chunk+2);i++){
        if(turnAt.has(i)&&i-start>=2){end=i;break;}
      }
      if(list.length-end===1&&end-start>2)end=list.length;   // 1個だけ余らせない
      runs.push({events:list.slice(start,end)});
      start=end;
    }
  }

  // --- 5. かたまりごとに形を当てる ---
  // 同じフレーズが繰り返されるときは同じ形を使い、2回目以降は左右を反転する。
  const shapeMemory=new Map();
  const laneUse=[0,0,0,0,0];
  let lastLane=2;
  const placed=[];
  const placeable=(subLane,width,grid)=>{
    const candidate={subLane,subLaneWidth:width};
    for(let i=placed.length-1;i>=0;i--){
      const before=placed[i];
      const deltaMs=(grid-before.grid)*gridMs;
      if(deltaMs>=HAND_MODEL.restrikeLimitMs)break;
      if(deltaMs<=0)continue;
      if(!fingerPairFeasible(candidate,before,deltaMs).ok)return false;
    }
    return true;
  };
  // 幅は「その難易度で使える幅の中の順位」で決める。狙いの数値で決めると、
  // 幅の種類が少ない難易度（MASTERは1〜4）で重い音と軽い音が同じ幅になってしまう。
  //   重い一発ほど太く、軽い音ほど細く（docs/spec/RHYTHM_CHART_DESIGN.md 2章）
  const widthFor=(onset,kind)=>{
    const available=[...P.widths].sort((a,b)=>a-b);
    const at=ratio=>available[Math.max(0,Math.min(available.length-1,Math.round(ratio*(available.length-1))))];
    if(!onset)return at(.5);
    if(kind==='SLIDE')return at(.4);
    switch(onset.character){
      case 'FULL':  return available[available.length-1];
      case 'PUNCH': return at(.66);
      case 'BODY':  return at(.4);
      case 'LIGHT': return available[0];
      default:      return at(.5);
    }
  };
  const centeredSubLane=(lane,width)=>Math.max(0,Math.min(10-width,lane*2+1-Math.ceil(width/2)));

  for(const runGroup of runs){
    const list=runGroup.events;
    const length=list.length;
    const grids=list.map(e=>e.grid);
    const heights=grids.map(g=>heightByGrid.has(g)?heightByGrid.get(g):null);
    const gaps=grids.slice(1).map((g,i)=>g-grids[i]);
    const minGap=gaps.length?Math.min(...gaps):Infinity;
    const fastest=minGap<=P.lattice;
    const allowJack=minGap===Infinity||minGap*gridMs>=HAND_MODEL.restrikeLimitMs;
    const maxStep=minGap<BEAT?Math.min(P.maxLaneStep,COMMON.laneStepFastMax):P.maxLaneStep;

    // 反復フレーズなら、前に使った形を思い出す
    const bar=Math.floor(grids[0]/BAR);
    const phrase=phraseForBar(bar);
    const memoryKey=phrase?`${phrase.repeatedFromPhraseId||phrase.id}:${grids[0]-phrase.startBar*BAR}:${length}`:null;
    const remembered=memoryKey?shapeMemory.get(memoryKey):null;

    let offsets=null,patternId=null,mirrored=false;
    if(remembered&&remembered.offsets.length===length){
      patternId=remembered.patternId;
      mirrored=!remembered.mirrored;
      offsets=mirrored?mirror(remembered.offsets):remembered.offsets.slice();
      if(maxStepOf(offsets)>maxStep){offsets=null;patternId=null;mirrored=false;}
    }
    if(!offsets){
      // 音の高さが取れないときは、刻みの細かさから形を選ぶ
      const rhythmShape=minGap<=P.lattice?'fast':(minGap<=BEAT?'beat':'slow');
      const candidates=shapeCandidatesFor({length,heights,maxStep,fastest,allowJack,
        rhythmShape,rotate:runs.indexOf(runGroup)});
      const chosen=candidates[0];
      if(chosen){offsets=chosen.offsets.slice();patternId=chosen.pattern.id;}
      else offsets=Array.from({length},()=>0);
      if(memoryKey&&!shapeMemory.has(memoryKey))shapeMemory.set(memoryKey,{patternId,offsets:offsets.slice(),mirrored:false});
    }

    // 起点を決める。前のノーツからの続き・レーンの偏り・指の条件で選ぶ。
    const pattern=patternId?PATTERN_BY_ID[patternId]:null;
    const min=Math.min(...offsets),max=Math.max(...offsets);
    const bases=[];
    for(let base=-min;base<=LANES-1-max;base++)bases.push(base);
    const widths=list.map(event=>widthFor(event.onset,event.kind));
    const score=base=>{
      const lanes=fitToLanes(offsets,base);
      if(!lanes)return null;
      let cost=0;
      // 前のかたまりからの続き（近いほどよい。ただし同じ場所に張り付かない）
      const step=Math.abs(lanes[0]-lastLane);
      cost+=Math.abs(step-1)*2;
      // 中央前提の形は中央へ
      if(pattern&&pattern.centered)cost+=Math.abs(base-2)*3;
      // レーンの偏りをならす
      for(const lane of lanes)cost+=laneUse[lane]*.05;
      return {lanes,cost};
    };
    let best=null;
    for(const base of bases){
      const scored=score(base);
      if(!scored)continue;
      // 指の条件を満たすか、置きながら確かめる
      let ok=true;
      const trial=[];
      for(let i=0;i<length;i++){
        const width=widths[i];
        const subLane=centeredSubLane(scored.lanes[i],width);
        const previous=placed.concat(trial);
        const candidate={subLane,subLaneWidth:width,grid:grids[i]};
        let feasible=true;
        for(let k=previous.length-1;k>=0;k--){
          const before=previous[k];
          const deltaMs=(grids[i]-before.grid)*gridMs;
          if(deltaMs>=HAND_MODEL.restrikeLimitMs)break;
          if(deltaMs<=0)continue;
          if(!fingerPairFeasible(candidate,before,deltaMs).ok){feasible=false;break;}
        }
        if(!feasible){ok=false;break;}
        trial.push(candidate);
      }
      if(!ok)continue;
      if(!best||scored.cost<best.cost)best={...scored,base,trial};
    }
    if(!best){
      // どの起点でも置けないときは、1つずつ逃がす（まれ）
      const lanes=[];
      for(let i=0;i<length;i++){
        const width=widths[i];
        let chosen=null;
        for(let sub=0;sub<=10-width;sub++){
          if(!placeable(sub,width,grids[i]))continue;
          chosen=sub;break;
        }
        if(chosen==null)chosen=centeredSubLane(2,width);
        lanes.push(chosen);
      }
      best={lanes:lanes.map(sub=>Math.floor(sub/2)),cost:0,base:null,
        trial:lanes.map((sub,i)=>({subLane:sub,subLaneWidth:widths[i],grid:grids[i]}))};
      patternId='fallback';
    }

    list.forEach((event,i)=>{
      const item=best.trial[i];
      const lane=Math.floor(item.subLane/2);
      laneUse[Math.max(0,Math.min(4,best.lanes?best.lanes[i]:lane))]++;
      lastLane=best.lanes?best.lanes[i]:lane;
      placed.push({grid:grids[i],subLane:item.subLane,subLaneWidth:item.subLaneWidth});
      const note={type:event.kind==='TAP'?'TAP':event.kind,grid:grids[i],
        lane:Math.floor(item.subLane/2),subLane:item.subLane,subLaneWidth:item.subLaneWidth,
        sourceStrength:event.onset?Math.round(event.onset.strength*100)/100:0,
        sourcePeakOffsetMs:event.onset?event.onset.gridOffsetMs:0,
        sourceCharacter:event.onset?event.onset.character:'NONE'};
      if(event.kind==='HOLD'){
        note.durationGrids=event.reserved.endGrid-event.reserved.startGrid;
      }else if(event.kind==='SLIDE'){
        note.durationGrids=event.reserved.endGrid-event.reserved.startGrid;
        note.slidePoints=slidePathFor(event.reserved,best.lanes?best.lanes[i]:lane,item.subLaneWidth,P);
        note.lane=note.slidePoints[0].lane;
        note.endLane=note.slidePoints[note.slidePoints.length-1].lane;
        delete note.subLane;
      }
      notes.push(note);
    });
    log.push({fromGrid:grids[0],toGrid:grids[length-1],length,pattern:patternId,mirrored,
      lanes:best.lanes?best.lanes.slice():null,
      heights:heights.map(h=>h==null?null:Math.round(h*100)/100)});
  }

  notes.sort((a,b)=>a.grid-b.grid);

  // --- 6. 区切りの一発（アクセント幅） ---
  // 大きな一発（FULL）のうち、いちばん強いものだけを幅広にする。
  // どこにでも出すと画面が幅広ノーツだらけになり、幅の段階が意味を失う。
  {
    const candidates=notes
      .map((note,index)=>({note,index}))
      .filter(({note})=>note.type==='TAP'&&note.sourceCharacter==='FULL'
        &&!notes.some(other=>other!==note&&other.grid===note.grid))
      .sort((a,b)=>b.note.sourceStrength-a.note.sourceStrength);
    const chosen=spreadPick(candidates.map(c=>c.index),P.accentMax,8);
    for(const index of chosen){
      const note=notes[index];
      const width=Math.max(1,Math.min(10,P.accentWidth));
      const center=(note.subLane+note.subLaneWidth/2);
      note.subLane=Math.max(0,Math.min(10-width,Math.round(center-width/2)));
      note.subLaneWidth=width;
      note.lane=Math.floor(note.subLane/2);
      note.sectionAccent=true;
    }
  }

  // --- 7. FLICK（切れる音・フレーズの終わり） ---
  // 本物の譜面は、歌の切れ目やしゃくりにフリックを置く。
  // ここでは「かたまりの最後で、そのあと1拍以上あく音」を選ぶ。
  if(P.flickMax>0&&P.types.includes('FLICK')){
    const candidates=[];
    notes.forEach((note,index)=>{
      if(note.type!=='TAP'||note.sectionAccent)return;
      const next=notes[index+1];
      if(next&&next.grid-note.grid<BEAT)return;
      if(note.sourceCharacter==='LIGHT')return;
      candidates.push(index);
    });
    for(const index of spreadPick(candidates,P.flickMax,4))notes[index].type='FLICK';
  }

  // --- 8. 終点フリック（HOLD/SLIDEの終わりで弾く） ---
  // 弾いたあと指を戻す時間が要るので、終わりの前後に1拍以上の余裕があるものだけ。
  if(P.endFlickMax>0){
    const candidates=[];
    notes.forEach((note,index)=>{
      if(note.type!=='HOLD'&&note.type!=='SLIDE')return;
      const endGrid=note.grid+(Number(note.durationGrids)||0);
      if(notes.some(other=>other!==note&&Math.abs(other.grid-endGrid)<BEAT))return;
      candidates.push(index);
    });
    for(const index of spreadPick(candidates,P.endFlickMax,3))notes[index].endFlick=true;
  }

  // --- 9. 同時押し（上位難易度だけ） ---
  // 新しい時刻は作らない。大きな一発を2レーンへ分けるだけ。
  let chordCount=0;
  if(P.simultaneous&&P.chordMax>0){
    const candidates=notes
      .map((note,index)=>({note,index}))
      .filter(({note})=>note.type==='TAP'&&note.sourceCharacter==='FULL'&&!note.sectionAccent
        &&note.subLaneWidth<=4&&!notes.some(other=>other!==note&&other.grid===note.grid))
      .map(c=>c.index);
    for(const index of spreadPick(candidates,P.chordMax,6)){
      const note=notes[index];
      const width=Math.min(3,note.subLaneWidth);
      // 指2本ぶん離した相方を作る
      const left=Math.max(0,note.subLane-4-width);
      const right=Math.min(10-width,note.subLane+note.subLaneWidth+4);
      const partnerSub=note.subLane>=5?left:right;
      if(partnerSub<0||partnerSub>10-width)continue;
      const partner={type:'TAP',grid:note.grid,lane:Math.floor(partnerSub/2),
        subLane:partnerSub,subLaneWidth:width,
        sourceStrength:note.sourceStrength,sourcePeakOffsetMs:note.sourcePeakOffsetMs,
        sourceCharacter:note.sourceCharacter,chord:true};
      if(!fingerPairFeasible(partner,note,1).ok)continue;
      notes.push(partner);
      chordCount++;
    }
    notes.sort((a,b)=>a.grid-b.grid);
  }

  // --- 10. HOLDの途中で太さが変わる形 ---
  if(P.types.includes('HOLD')){
    const shapes=[
      {id:'open', at:t=>t},
      {id:'close',at:t=>1-t},
      {id:'swell',at:t=>1-Math.abs(1-2*t)},
      {id:'pinch',at:t=>Math.abs(1-2*t)},
      {id:'pulse',at:t=>(1-Math.cos(t*Math.PI*4))/2},
    ];
    const widthsAsc=[...P.widths].sort((a,b)=>a-b);
    const candidates=notes.map((note,index)=>({note,index}))
      .filter(({note})=>note.type==='HOLD'&&Number(note.durationGrids)>=6).map(c=>c.index);
    spreadPick(candidates,Math.max(2,Math.round(P.holdMax/3)),2).forEach((index,ordinal)=>{
      const note=notes[index];
      const duration=Number(note.durationGrids);
      const shape=shapes[ordinal%shapes.length];
      const count=Math.max(3,Math.min(9,Math.round(duration/BEAT)+1));
      const center=note.subLane+note.subLaneWidth/2;
      const points=[];
      const seen=new Set();
      for(let i=0;i<count;i++){
        const t=i/(count-1);
        const grid=note.grid+Math.round(duration*t);
        if(seen.has(grid))continue;
        seen.add(grid);
        const width=widthsAsc[Math.max(0,Math.min(widthsAsc.length-1,
          Math.round(shape.at(t)*(widthsAsc.length-1))))];
        points.push({grid,subLane:Math.max(0,Math.min(10-width,Math.round(center-width/2))),subLaneWidth:width});
      }
      if(points.length<2)return;
      points[points.length-1].grid=note.grid+duration;
      if(new Set(points.map(p=>p.subLaneWidth)).size<2)return;
      note.subLaneWidth=points[0].subLaneWidth;
      note.subLane=points[0].subLane;
      note.lane=Math.floor(note.subLane/2);
      note.holdPoints=points;
      note.holdTaper=shape.id;
    });
  }

  // --- 11. モンスターノーツ（曲の20/40/60/80%あたりへ1体ずつ） ---
  const monsterSlotGrids=[];
  {
    const first=notes[0].grid,last=notes[notes.length-1].grid;
    const used=new Set();
    COMMON.monsterTargets.forEach((ratio,slot)=>{
      const target=first+(last-first)*ratio;
      let bestIndex=-1,bestDistance=Infinity;
      notes.forEach((note,index)=>{
        if(note.type!=='TAP'||used.has(index)||note.chord)return;
        if(note.grid%BEAT!==0)return;
        const before=index>0?note.grid-notes[index-1].grid:Infinity;
        const after=index<notes.length-1?notes[index+1].grid-note.grid:Infinity;
        if(before<COMMON.monsterClearGrids||after<COMMON.monsterClearGrids)return;
        const distance=Math.abs(note.grid-target);
        if(distance<bestDistance){bestDistance=distance;bestIndex=index;}
      });
      if(bestIndex>=0){notes[bestIndex].monsterSlot=slot+1;used.add(bestIndex);monsterSlotGrids.push(notes[bestIndex].grid);}
    });
  }

  // --- 12. 指の条件の最終確認 ---
  // アクセント幅・同時押し・太さの変わるHOLDは、レーンを決めたあとに中心を動かす。
  // 最後にもう一度全部を見て、「指が2本入らない近さなのに速すぎる」組み合わせが
  // 残っていたら、動かせるノーツ（TAP/FLICK）を左右へ寄せて直す。
  {
    const ordered=notes.slice().sort((a,b)=>a.grid-b.grid);
    const conflicts=(note,candidate)=>{
      for(const other of ordered){
        if(other===note)continue;
        const deltaMs=(note.grid-other.grid)*gridMs;
        if(Math.abs(deltaMs)>=HAND_MODEL.restrikeLimitMs)continue;
        if(deltaMs===0)continue;
        if(!fingerPairFeasible(candidate,other,Math.abs(deltaMs)).ok)return true;
      }
      return false;
    };
    for(const note of ordered){
      if(note.type!=='TAP'&&note.type!=='FLICK')continue;
      if(!conflicts(note,note))continue;
      const width=Number(note.subLaneWidth)||2;
      let bestSub=null,bestDistance=Infinity;
      for(let sub=0;sub<=10-width;sub++){
        if(conflicts(note,{subLane:sub,subLaneWidth:width}))continue;
        const distance=Math.abs(sub-Number(note.subLane));
        if(distance<bestDistance){bestDistance=distance;bestSub=sub;}
      }
      if(bestSub===null)continue;
      note.subLane=bestSub;
      note.lane=Math.floor(bestSub/2);
    }
  }

  return {notes,log,profile:P,runs:runs.length,chordCount,monsterSlotGrids};
};

// 候補を曲全体へ散らして選ぶ（かたまって出ないように）
function spreadPick(candidates,count,minGap){
  const chosen=[];
  const rest=candidates.slice().sort((a,b)=>a-b);
  if(!rest.length||count<=0)return chosen;
  for(let k=0;k<count&&rest.length;k++){
    const first=rest[0],last=rest[rest.length-1];
    const target=first+(last-first)*(count>1?k/(count-1):0);
    let bestPos=-1,bestDistance=Infinity;
    rest.forEach((index,pos)=>{
      if(chosen.some(taken=>Math.abs(taken-index)<minGap))return;
      const distance=Math.abs(index-target);
      if(distance<bestDistance){bestDistance=distance;bestPos=pos;}
    });
    if(bestPos<0)break;
    chosen.push(rest[bestPos]);
    rest.splice(bestPos,1);
  }
  return chosen.sort((a,b)=>a-b);
}

// --- SLIDEの経路を「音の高さの動き」から作る ---
function slidePathFor(reserved,startLane,width,P){
  const points=[];
  const {startGrid,endGrid}=reserved;
  const heights=[];
  for(let grid=startGrid;grid<=endGrid;grid++)heights.push(heightByGrid.has(grid)?heightByGrid.get(grid):null);
  // 取れなかった位置は前後から埋める
  for(let i=0;i<heights.length;i++){
    if(heights[i]!=null)continue;
    let before=null,after=null;
    for(let k=i-1;k>=0;k--)if(heights[k]!=null){before=heights[k];break;}
    for(let k=i+1;k<heights.length;k++)if(heights[k]!=null){after=heights[k];break;}
    heights[i]=before!=null&&after!=null?(before+after)/2:(before??after??.5);
  }
  const lo=Math.min(...heights),hi=Math.max(...heights);
  const range=Math.max(1e-6,hi-lo);
  // 音の動きの幅を、その難易度で許す歩幅ぶんのレーンへ写す
  const reach=Math.max(1,Math.min(2.5,P.maxLaneStep));
  const centerLane=Math.max(reach/2,Math.min(LANES-1-reach/2,startLane));
  const laneAt=height=>{
    const ratio=(height-lo)/range;      // 0〜1
    const lane=centerLane+(ratio-(heights[0]-lo)/range)*reach;
    return Math.max(0,Math.min(LANES-1,Math.round(lane*2)/2));
  };
  // 中継点は2グリッドおき（細かすぎると帯が波打って読めない）
  const step=Math.max(2,Math.round((endGrid-startGrid)/6));
  for(let i=0;i<heights.length;i+=step){
    points.push({grid:startGrid+i,lane:laneAt(heights[i]),subLaneWidth:width});
  }
  const lastPoint=points[points.length-1];
  if(!lastPoint||lastPoint.grid!==endGrid)points.push({grid:endGrid,lane:laneAt(heights[heights.length-1]),subLaneWidth:width});
  return points;
}

// ============================================================================
// 実行
// ============================================================================
const targets=only?[only]:DIFFICULTIES;
const results={};
for(const difficulty of targets){
  if(!PROFILES[difficulty]){console.error(`未知の難易度です: ${difficulty}`);process.exit(1);}
  results[difficulty]=buildChart(difficulty);
}

for(const difficulty of targets){
  const {notes,profile,runs}=results[difficulty];
  const typeCounts=notes.reduce((acc,n)=>{acc[n.type]=(acc[n.type]||0)+1;return acc;},{});
  const characterCounts=notes.reduce((acc,n)=>{acc[n.sourceCharacter]=(acc[n.sourceCharacter]||0)+1;return acc;},{});
  const spanMs=gridTimeMs(notes[notes.length-1].grid)-gridTimeMs(notes[0].grid);
  console.log(`${difficulty}: ${notes.length}ノーツ (${Object.entries(typeCounts).map(([k,v])=>`${k}${v}`).join(' / ')})`);
  console.log(`  ${(gridTimeMs(notes[0].grid)/1000).toFixed(1)}s〜${(gridTimeMs(notes[notes.length-1].grid)/1000).toFixed(1)}s / ${(notes.length/(spanMs/1000)).toFixed(2)}ノーツ毎秒 / かたまり${runs}個`);
  console.log(`  拾った音: ${Object.entries(characterCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}${v}`).join(' / ')}`);
  const patterns=results[difficulty].log.reduce((acc,entry)=>{acc[entry.pattern||'—']=(acc[entry.pattern||'—']||0)+1;return acc;},{});
  console.log(`  使った形: ${Object.entries(patterns).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}${v}`).join(' / ')}`);
}

if(explain&&results[explain]){
  console.log(`\n${explain} の組み立て（最初の24かたまり）:`);
  for(const entry of results[explain].log.slice(0,24)){
    console.log(`  grid${String(entry.fromGrid).padStart(4)}〜${String(entry.toGrid).padStart(4)} ${String(entry.length)}個 `
      +`${String(entry.pattern).padEnd(12)}${entry.mirrored?'(反転)':'      '} レーン ${entry.lanes?entry.lanes.join('→'):'—'}`
      +`   高さ ${entry.heights.map(h=>h==null?' — ':h.toFixed(2)).join(' ')}`);
  }
}

if(write){
  for(const difficulty of targets){
    const {notes,profile,log}=results[difficulty];
    const typeCounts=notes.reduce((acc,n)=>{acc[n.type]=(acc[n.type]||0)+1;return acc;},{});
    const spanMs=gridTimeMs(notes[notes.length-1].grid)-gridTimeMs(notes[0].grid);
    const report={
      schemaVersion:1,
      analysisType:'rhythm-chart-v3-chart',
      trackId,difficulty,
      candidateVersion:'v3',
      status:'draft',
      reviewRequired:true,
      runtimeConnected:false,
      bpm:timing.bpm,beatZeroMs:timing.beatZeroMs,subdivisionsPerBeat:timing.subdivisionsPerBeat,
      source:{audio:`tools/mode/authoring/${dashed}-v3-audio.json`,
        structure:`tools/mode/authoring/${dashed}-v2-structure.json`,
        design:'docs/spec/RHYTHM_CHART_DESIGN.md'},
      policy:{...profile,characterWeight:CHARACTER_WEIGHT,positionWeight:POSITION_WEIGHT,
        musicalLift:MUSICAL_LIFT},
      level:profile.level,
      noteCount:notes.length,
      typeCounts,
      densityPerSecond:Math.round(notes.length/(spanMs/1000)*100)/100,
      shapes:log,
      notes,
    };
    const dir=outputDir?path.resolve(ROOT,outputDir):path.join(ROOT,'tools/mode/authoring');
    const out=path.join(dir,`${dashed}-v3-chart-${difficulty.toLowerCase()}.json`);
    fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
    console.log(`書き出し: ${path.relative(ROOT,out)}`);
  }
}else{
  console.log('\n（--write を付けると tools/mode/authoring/ へ書き出します。ランタイムへは接続しません）');
}
