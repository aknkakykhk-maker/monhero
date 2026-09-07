#!/usr/bin/env node
// 自動生成した譜面の品質を、1つの点数ではなく**6つの軸**で数値化する。
//
//   node tools/mode/rhythm-chart-quality-report.js --track <曲id>              # 1曲(v3自動修正後)を測る
//   node tools/mode/rhythm-chart-quality-report.js --track <曲id> --source v3   # 自動修正前を測る
//   node tools/mode/rhythm-chart-quality-report.js --track <曲id> --dir <dir>   # 別の場所に書き出した譜面を測る
//   node tools/mode/rhythm-chart-quality-report.js --all                        # 一覧にある曲を全部
//   node tools/mode/rhythm-chart-quality-report.js --all --write                # authoring/<曲>-v3-quality.json へ
//   node tools/mode/rhythm-chart-quality-report.js --all --baseline <dir>       # 変更前(同じ形のJSON)と比べる
//   node tools/mode/rhythm-chart-quality-report.js --track <曲id> --json        # JSONだけを出す
//
// 【なぜ要るか】(2026-09-07)
// 「バリエーションが少ない」「押しづらい場所がある」は、感じ方としては正しくても
// **何がどれだけ**かが無いと直しようがないし、直したあとに良くなったかも分からない。
// ここでは docs/spec/RHYTHM_CHART_DESIGN.md の順(押せる → 音と合う → 読める → 気持ちいい → 飽きない)
// をそのまま軸にし、加えて「その難易度として適切か」を見る。
//
//   Playability   … 押せるか。impossible が1件でもあれば**他がどれだけ良くても不合格**(ゲート)
//   Musicality    … 音と合っているか(鳴っている音の上か・大事な音を拾っているか・同じフレーズが同じ形か)
//   Readability   … 読めるか(形の予測可能性・急な跳び・同じ形の続きすぎ)
//   Flow          … 手の流れ(左右交互・忙しい区間の長さ・休符・難所の長さ)
//   Variety       … 飽きないか(語彙の数・偏り・つなぎの種類・左右反転・セクション差)
//   DifficultyFit … 難易度なりか(密度・跳び・忙しさ・語彙が難易度の帯に入っているか)
//
// 数字は「生成器の中身」ではなく**出来上がった譜面**から測る。生成器を変えても物差しは変わらない。
// 判定・スコア・ランタイム・保存データには一切関与しない。
'use strict';
const fs=require('fs');
const path=require('path');
const {HAND_MODEL,noteTouchLane,usableTouchSpan,heldTouchSpan,separationRange}=require('./rhythm-hand-model.js');
const {simulateNotes}=require('./rhythm-hand-simulate.js');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];
const round=(value,digits=3)=>Number.isFinite(value)?Math.round(value*10**digits)/10**digits:null;
const clamp01=value=>Math.max(0,Math.min(1,value));
const mean=list=>list.length?list.reduce((a,b)=>a+b,0)/list.length:0;

// --- 難易度ごとの「帯」。ここは生成器の定数ではなく**狙い**を書く ---
// (生成器の値をそのまま読むと、生成器が緩んだときに一緒に緩んでしまう)
const BANDS=Object.freeze({
  //                 毎秒の密度        忙しい率(strained)   跳びの上限  1拍以上の休符(毎分)  同じ形の連続  語彙(種類)
  EASY:  {density:[.6,2.1], strain:[0,.02],  maxStep:1, restsPerMinute:12, sameRun:3, vocab:6, types:['TAP','HOLD']},
  NORMAL:{density:[.8,2.5], strain:[0,.04],  maxStep:2, restsPerMinute:10, sameRun:3, vocab:7, types:['TAP','HOLD','FLICK']},
  HARD:  {density:[1.2,3.3],strain:[0,.08],  maxStep:2, restsPerMinute:8,  sameRun:3, vocab:8, types:['TAP','HOLD','FLICK','SLIDE']},
  EXPERT:{density:[1.6,4.1],strain:[0,.16],  maxStep:3, restsPerMinute:6,  sameRun:4, vocab:9, types:['TAP','HOLD','FLICK','SLIDE'],complex:['tapDuringHold','chordRuns','sweeps']},
  MASTER:{density:[1.9,4.8],strain:[0,.24],  maxStep:4, restsPerMinute:5,  sameRun:4, vocab:10,types:['TAP','HOLD','FLICK','SLIDE'],complex:['tapDuringHold','chordRuns','sweeps','crosses']},
});
// 「忙しい」が続いてよい長さ(ms)。これを超える連続は「難所が長すぎる」
const STRAIN_STREAK_LIMIT_MS=Object.freeze({EASY:0,NORMAL:400,HARD:900,EXPERT:1600,MASTER:2400});

// ============================================================================
// 測る
// ============================================================================
const measure=(chart,audio,options={})=>{
  const timing=audio.timing;
  const gridMs=timing.gridMs||timing.beatMs/timing.subdivisionsPerBeat;
  const BEAT=timing.subdivisionsPerBeat;
  const BAR=BEAT*(timing.beatsPerBar||4);
  const difficulty=chart.difficulty;
  const band=BANDS[difficulty]||BANDS.HARD;
  const notes=chart.notes.slice().sort((a,b)=>a.grid-b.grid||(Number(a.subLane)||0)-(Number(b.subLane)||0));
  const main=notes.filter(note=>!note.chord);
  const spanMs=notes.length>1?(notes[notes.length-1].grid-notes[0].grid)*gridMs:1;
  const seconds=Math.max(1,spanMs/1000);
  const minutes=seconds/60;

  // --- 音との一致 ---
  const onsetByGrid=new Map(audio.onsets.map(onset=>[onset.grid,onset]));
  const onNotes=main.filter(note=>onsetByGrid.has(note.grid));
  const onsetHitRate=main.length?onNotes.length/main.length:0;
  const ghostNotes=main.length-onNotes.length;
  const position=grid=>((grid%BEAT)+BEAT)%BEAT;
  const beatShare={beat:0,eighth:0,sixteenth:0};
  for(const note of main){const p=position(note.grid);if(p===0)beatShare.beat++;else if(p%2===0)beatShare.eighth++;else beatShare.sixteenth++;}
  for(const key of Object.keys(beatShare))beatShare[key]=round(main.length?beatShare[key]/main.length:0);
  // 大事な音: 大きな一発(FULL)と、拍の頭にある強めの重い打点。譜面の範囲の中だけを見る
  const firstGrid=notes.length?notes[0].grid:0,lastGrid=notes.length?notes[notes.length-1].grid:0;
  const inRange=audio.onsets.filter(onset=>onset.grid>=firstGrid&&onset.grid<=lastGrid);
  const strengths=inRange.map(onset=>onset.strength).sort((a,b)=>a-b);
  const strengthMedian=strengths.length?strengths[strengths.length>>1]:0;
  const important=inRange.filter(onset=>onset.character==='FULL'
    ||(onset.character==='PUNCH'&&position(onset.grid)===0&&onset.strength>=strengthMedian));
  const noteGrids=new Set(main.map(note=>note.grid));
  const importantHit=important.filter(onset=>noteGrids.has(onset.grid)).length;
  const importantCoverage=important.length?importantHit/important.length:1;
  // 音が抜けている場所(鳴っている音が無い1拍以上の区間)にノーツが無いか
  const silentGrids=new Set();
  {
    const onsetGrids=inRange.map(onset=>onset.grid).sort((a,b)=>a-b);
    for(let i=1;i<onsetGrids.length;i++){
      if(onsetGrids[i]-onsetGrids[i-1]>=BEAT*2)for(let g=onsetGrids[i-1]+1;g<onsetGrids[i];g++)silentGrids.add(g);
    }
  }
  const notesInSilence=main.filter(note=>silentGrids.has(note.grid)).length;

  // --- 形の語彙(生成器が残した shapes ログ) ---
  const shapes=(chart.shapes||[]).filter(entry=>entry&&entry.pattern);
  const patternCounts={};
  for(const entry of shapes)patternCounts[entry.pattern]=(patternCounts[entry.pattern]||0)+1;
  const patternTotal=shapes.length;
  const distinctPatterns=Object.keys(patternCounts).filter(id=>id!=='fallback').length;
  const topPattern=Object.entries(patternCounts).sort((a,b)=>b[1]-a[1])[0]||null;
  const topShare=patternTotal&&topPattern?topPattern[1]/patternTotal:0;
  const fallbackShare=patternTotal?(patternCounts.fallback||0)/patternTotal:0;
  let maxSameRun=0,sameRun=0;
  for(let i=0;i<shapes.length;i++){
    sameRun=i>0&&shapes[i].pattern===shapes[i-1].pattern?sameRun+1:1;
    maxSameRun=Math.max(maxSameRun,sameRun);
  }
  // 短い時間での偏り: 連続8かたまりの窓で、1つの形が占める最大の割合
  let localBias=0;
  for(let i=0;i+8<=shapes.length;i++){
    const counts={};
    for(let k=i;k<i+8;k++)counts[shapes[k].pattern]=(counts[shapes[k].pattern]||0)+1;
    localBias=Math.max(localBias,Math.max(...Object.values(counts))/8);
  }
  const transitions=new Set();
  const transitionCounts={};
  for(let i=1;i<shapes.length;i++){
    const key=`${shapes[i-1].pattern}>${shapes[i].pattern}`;
    transitions.add(key);transitionCounts[key]=(transitionCounts[key]||0)+1;
  }
  const transitionTotal=Math.max(0,shapes.length-1);
  const transitionEntropy=(()=>{
    if(!transitionTotal)return 0;
    let h=0;
    for(const count of Object.values(transitionCounts)){const p=count/transitionTotal;h-=p*Math.log2(p);}
    return h;
  })();
  const mirrored=shapes.filter(entry=>entry.mirrored).length;
  const mirrorRate=patternTotal?mirrored/patternTotal:0;

  // --- フレーズ(繰り返し区切り)の一貫性 ---
  const sections=Array.isArray(audio.structure?.sections)?audio.structure.sections:[];
  const sectionForBar=bar=>sections.find(s=>bar>=s.startBar&&bar<s.endBarExclusive)||null;
  const shapeAt=new Map();   // `${bar}:${offsetInBar}` → shape
  for(const entry of shapes){
    const bar=Math.floor(entry.fromGrid/BAR);
    shapeAt.set(`${bar}:${entry.fromGrid-bar*BAR}`,entry);
  }
  let phraseTotal=0,phraseSame=0,phraseVariations=0;
  for(const entry of shapes){
    const bar=Math.floor(entry.fromGrid/BAR);
    const section=sectionForBar(bar);
    if(!section||section.repeatOf==null)continue;
    const sourceBar=section.repeatOf+(bar-section.startBar);
    const source=shapeAt.get(`${sourceBar}:${entry.fromGrid-bar*BAR}`);
    if(!source)continue;
    phraseTotal++;
    if(source.pattern===entry.pattern)phraseSame++;
    if(source.pattern===entry.pattern&&source.mirrored!==entry.mirrored)phraseVariations++;
  }
  // 生成器が残したフレーズの指紋(motifKey)でも測る。区切りの繰り返しが取れない曲では
  // こちらが「同じフレーズが同じ形か」の本体になる
  // 指紋は譜面から測り直す(生成器が残した motifKey が無い古い譜面でも同じ物差しで比べられるように)。
  // 式は生成器(rhythm-chart-v3-generate.js の motifKeyOf)と同じ: 長さ|刻み|音の高さの上下
  const motifKeyFor=entry=>{
    const grids=main.filter(note=>note.grid>=entry.fromGrid&&note.grid<=entry.toGrid).map(note=>note.grid);
    const heights=Array.isArray(entry.heights)?entry.heights:[];
    if(grids.length<3||grids.length!==heights.length)return null;
    const gaps=grids.slice(1).map((g,i)=>g-grids[i]);
    const contour=[];
    for(let i=1;i<heights.length;i++){const a=heights[i-1],b=heights[i];contour.push(a==null||b==null?'?':(b-a>.04?'+':(a-b>.04?'-':'=')));}
    return `${grids.length}|${gaps.join(',')}|${contour.join('')}`;
  };
  let motifTotal=0,motifSame=0,motifGroups=0;
  {
    const groups=new Map();
    for(const entry of shapes){const key=motifKeyFor(entry);if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry);}
    for(const list of groups.values()){
      if(list.length<2)continue;
      motifGroups++;
      for(let i=1;i<list.length;i++){motifTotal++;if(list[i].pattern===list[0].pattern)motifSame++;}
    }
  }
  const phraseConsistency=(phraseTotal+motifTotal)?(phraseSame+motifSame)/(phraseTotal+motifTotal):1;

  // --- セクションごとの密度・語彙 ---
  const sectionStats=sections.map(section=>{
    const from=section.startBar*BAR,to=section.endBarExclusive*BAR;
    const inside=notes.filter(note=>note.grid>=from&&note.grid<to);
    const shapesInside=shapes.filter(entry=>entry.fromGrid>=from&&entry.fromGrid<to);
    const ms=(to-from)*gridMs;
    return {label:section.label,bars:section.bars,intensity:section.intensity,
      notes:inside.length,perSecond:round(ms>0?inside.length/(ms/1000):0,2),
      vocab:[...new Set(shapesInside.map(entry=>entry.pattern))].length,
      chords:new Set(inside.filter(note=>note.chord).map(note=>note.grid)).size,
      widths:round(mean(inside.map(note=>Number(note.subLaneWidth)||2)),2)};
  }).filter(entry=>entry.notes>0);
  const sectionDensities=sectionStats.map(entry=>entry.perSecond).filter(value=>value>0);
  const sectionDensitySpread=sectionDensities.length?Math.max(...sectionDensities)/Math.max(.01,Math.min(...sectionDensities)):1;
  const sectionVocabSpread=sectionStats.length?Math.max(...sectionStats.map(s=>s.vocab))-Math.min(...sectionStats.map(s=>s.vocab)):0;
  // 盛り上がりと密度が同じ向きか(順位相関の簡易版)
  const intensityDensityAgreement=(()=>{
    const pairs=sectionStats.filter(entry=>entry.bars>=2);
    if(pairs.length<3)return null;
    let agree=0,total=0;
    for(let i=0;i<pairs.length;i++)for(let j=i+1;j<pairs.length;j++){
      const di=pairs[i].intensity-pairs[j].intensity,dd=pairs[i].perSecond-pairs[j].perSecond;
      if(Math.abs(di)<.05)continue;
      total++;if(di*dd>0)agree++;
    }
    return total?agree/total:null;
  })();

  // --- レーン ---
  const laneUse=[0,0,0,0,0];
  for(const note of notes)laneUse[Math.max(0,Math.min(4,Math.floor(noteTouchLane(note))))]++;
  const laneShare=laneUse.map(count=>round(notes.length?count/notes.length:0));
  const left=laneUse[0]+laneUse[1],right=laneUse[3]+laneUse[4];
  const leftRightBias=left+right?Math.abs(left-right)/(left+right):0;
  const centerShare=notes.length?laneUse[2]/notes.length:0;
  const edgeShare=notes.length?(laneUse[0]+laneUse[4])/notes.length:0;
  const moves=[];
  let hardJumps=0,fastPairs=0;
  for(let i=1;i<main.length;i++){
    const gap=main[i].grid-main[i-1].grid;
    if(gap<=0||gap>=BEAT)continue;
    const move=separationRange(usableTouchSpan(main[i]),usableTouchSpan(main[i-1])).min;
    moves.push(move);
    fastPairs++;
    if(gap<BEAT/2&&move>=3)hardJumps++;
  }
  const meanMove=mean(moves),maxMove=moves.length?Math.max(...moves):0;
  const moveSpeed=moves.reduce((a,b)=>a+b,0)/seconds;

  // --- ノーツの種類 ---
  const typeCounts={TAP:0,HOLD:0,SLIDE:0,FLICK:0};
  for(const note of notes)typeCounts[note.type]=(typeCounts[note.type]||0)+1;
  const chordGrids=new Set(notes.filter(note=>note.chord).map(note=>note.grid));
  const chordRuns=new Set(notes.filter(note=>typeof note.chordRun==='string').map(note=>note.chordRun+':'+Math.floor(note.grid/BAR))).size;
  const sweeps=notes.filter(note=>note.sweep===true).length;
  const crosses=notes.filter(note=>note.cross===true).length;
  const accents=notes.filter(note=>note.sectionAccent===true).length;
  const endFlicks=notes.filter(note=>note.endFlick===true).length;
  const tapers=notes.filter(note=>Array.isArray(note.holdPoints)).length;
  const sustains=notes.filter(note=>note.type==='HOLD'||note.type==='SLIDE')
    .map(note=>({note,start:note.grid,end:note.grid+(Number(note.durationGrids)||0)}));
  let tapDuringHold=0,tapDuringSlide=0;
  for(const note of notes){
    if(note.type!=='TAP'&&note.type!=='FLICK')continue;
    const over=sustains.find(span=>span.start<note.grid&&note.grid<=span.end);
    if(!over)continue;
    if(over.note.type==='HOLD')tapDuringHold++;else tapDuringSlide++;
  }
  const expandCount=shapes.filter(entry=>entry.pattern==='expand'||entry.pattern==='out_in_out').length;
  const contractCount=shapes.filter(entry=>entry.pattern==='contract'||entry.pattern==='in_out_in').length;
  const chordShapes={};
  for(const grid of chordGrids){
    const group=notes.filter(note=>note.grid===grid);
    if(group.length<2)continue;
    const gap=round(separationRange(usableTouchSpan(group[0]),usableTouchSpan(group[1])).min,1);
    const key=`${Math.min(...group.map(n=>Number(n.subLaneWidth)||2))}w/${gap}`;
    chordShapes[key]=(chordShapes[key]||0)+1;
  }
  const slideShapes={};
  for(const note of notes){
    if(note.type!=='SLIDE'||!Array.isArray(note.slidePoints))continue;
    const lanes=note.slidePoints.map(p=>Number(p.lane));
    let turns=0;
    for(let i=2;i<lanes.length;i++)if((lanes[i]-lanes[i-1])*(lanes[i-1]-lanes[i-2])<0)turns++;
    const span=Math.max(...lanes)-Math.min(...lanes);
    const key=span<.5?'flat':turns===0?(span>=2.5?'sweep':'line'):turns===1?'fold':'wave';
    slideShapes[key]=(slideShapes[key]||0)+1;
  }

  // --- 休符・難所 ---
  const gaps=[];
  for(let i=1;i<main.length;i++)gaps.push((main[i].grid-main[i-1].grid)*gridMs);
  const rests=gaps.filter(gap=>gap>=BEAT*gridMs).length;
  const longRests=gaps.filter(gap=>gap>=BAR*gridMs).length;
  const longestRestMs=gaps.length?Math.max(...gaps):0;
  // 難所: 2秒の窓で密度が全体平均の1.6倍を超える区間。その長さと数
  const windowMs=2000;
  const avgPerWindow=notes.length/seconds*(windowMs/1000);
  const hardWindows=[];
  {
    const times=notes.map(note=>note.grid*gridMs);
    const startMs=times.length?times[0]:0,endMs=times.length?times[times.length-1]:0;
    let current=null;
    for(let t=startMs;t<=endMs;t+=500){
      const count=times.filter(value=>value>=t&&value<t+windowMs).length;
      const hard=count>avgPerWindow*1.6&&count>=6;
      if(hard){if(!current)current={fromMs:t,toMs:t+windowMs,peak:count};else{current.toMs=t+windowMs;current.peak=Math.max(current.peak,count);}}
      else if(current){hardWindows.push(current);current=null;}
    }
    if(current)hardWindows.push(current);
  }
  const hardSectionMaxMs=hardWindows.length?Math.max(...hardWindows.map(w=>w.toMs-w.fromMs)):0;
  // 難所のあとに休符があるか
  const restAfterHard=hardWindows.filter(window=>{
    const after=main.find(note=>note.grid*gridMs>=window.toMs);
    const last=main.filter(note=>note.grid*gridMs<window.toMs).pop();
    return after&&last&&(after.grid-last.grid)*gridMs>=BEAT*gridMs;
  }).length;
  const peakWindowNotes=hardWindows.length?Math.max(...hardWindows.map(w=>w.peak)):Math.round(avgPerWindow);

  // --- 手の負荷(両手のシミュレート) ---
  const sim=simulateNotes(notes,timing,{beam:options.beam});
  const impossible=sim.impossible,strained=sim.strained;
  const strainedRate=notes.length?strained/notes.length:0;
  const maxStrainStreakMs=sim.strainStreaks.length?Math.max(...sim.strainStreaks.map(s=>s.ms)):0;
  // 左右交互(1拍未満で並ぶノーツのうち、指が交互に使われている割合)
  const ordered=notes.map((note,index)=>({note,index})).sort((a,b)=>a.note.grid-b.note.grid);
  let alternation=0,alternationTotal=0,sameFingerMinMs=Infinity;
  const lastHitByFinger=[null,null];
  for(const {note,index} of ordered){
    const finger=sim.assignments.get(index);
    if(finger==null)continue;
    const previous=ordered.filter(entry=>entry.note.grid<note.grid).pop();
    if(previous){
      const previousFinger=sim.assignments.get(previous.index);
      // 見るのは16分(8分より細かい刻み)だけ。8分は親指1本で楽に追えるので、交互でなくてもよい
      if(previousFinger!=null&&(note.grid-previous.note.grid)<BEAT/2){
        alternationTotal++;
        if(previousFinger!==finger)alternation++;
      }
    }
    if(lastHitByFinger[finger]!=null)sameFingerMinMs=Math.min(sameFingerMinMs,(note.grid-lastHitByFinger[finger])*gridMs);
    lastHitByFinger[finger]=note.grid;
  }
  const alternationRate=alternationTotal?alternation/alternationTotal:1;
  // 同時押しの前後の余裕(ms)
  let chordClearMinMs=Infinity;
  for(const grid of chordGrids){
    const others=notes.filter(note=>note.grid!==grid).map(note=>Math.abs(note.grid-grid)*gridMs);
    if(others.length)chordClearMinMs=Math.min(chordClearMinMs,Math.min(...others));
  }
  // 押さえっぱなしの最中に、空いている手が自由か(押さえている帯と近すぎるTAPが無いか)
  let heldFreeOk=0,heldFreeTotal=0;
  for(const span of sustains){
    const during=notes.filter(note=>note!==span.note&&note.grid>span.start&&note.grid<=span.end&&(note.type==='TAP'||note.type==='FLICK'));
    for(const note of during){
      heldFreeTotal++;
      // 押さえている指は帯の中心からわずかしか寄せられない(heldTouchSpan)。叩く指をいちばん離して
      // 置いたときに指2本ぶん空くか(=空いている手が自由か)を見る
      if(separationRange(usableTouchSpan(note),heldTouchSpan(span.note)).max>=HAND_MODEL.fingerMinGapLanes-1e-9)heldFreeOk++;
    }
  }

  // ============================================================================
  // 6つの軸(0〜100)
  // ============================================================================
  const inBand=(value,[lo,hi],slack)=>value>=lo-slack&&value<=hi+slack?1:value<lo?clamp01(1-(lo-value)/Math.max(slack,1e-6)):clamp01(1-(value-hi)/Math.max(slack,1e-6));
  const density=notes.length/seconds;
  const scores={};
  scores.playability=impossible>0?0:Math.round(100*(
    .55*inBand(strainedRate,band.strain,.08)
    +.25*clamp01(1-Math.max(0,maxStrainStreakMs-STRAIN_STREAK_LIMIT_MS[difficulty])/2000)
    +.20*(heldFreeTotal?heldFreeOk/heldFreeTotal:1)));
  scores.musicality=Math.round(100*(
    .40*onsetHitRate
    +.25*clamp01(importantCoverage/{EASY:.35,NORMAL:.45,HARD:.6,EXPERT:.75,MASTER:.85}[difficulty])
    +.20*phraseConsistency
    +.15*clamp01(1-notesInSilence/Math.max(1,main.length)*20)));
  scores.readability=Math.round(100*(
    .35*clamp01(1-fallbackShare*4)
    +.25*clamp01(1-hardJumps/Math.max(1,fastPairs)*8)
    +.20*clamp01(1-Math.max(0,maxSameRun-band.sameRun)/3)
    +.20*clamp01(1-Math.max(0,localBias-.6)/.4)));
  scores.flow=Math.round(100*(
    .30*clamp01((alternationRate-.5)/.4)
    +.25*clamp01(rests/minutes/band.restsPerMinute)
    +.25*clamp01(1-Math.max(0,hardSectionMaxMs-8000)/8000)
    +.20*(hardWindows.length?restAfterHard/hardWindows.length:1)));
  scores.variety=Math.round(100*(
    .30*clamp01(distinctPatterns/band.vocab)
    +.20*clamp01(1-Math.max(0,topShare-.25)/.35)
    +.20*clamp01(transitionEntropy/4)
    +.15*clamp01(mirrorRate/.15)
    +.15*clamp01((sectionDensitySpread-1)/1.2)));
  scores.difficultyFit=Math.round(100*(
    .35*inBand(density,band.density,.6)
    +.25*inBand(strainedRate,band.strain,.06)
    +.20*(maxMove<=band.maxStep+1e-9?1:clamp01(1-(maxMove-band.maxStep)/2))
    +.10*(band.types.every(type=>typeCounts[type]>0||(type==='SLIDE'&&difficulty==='HARD'&&typeCounts.SLIDE===0&&sweeps===0))?1:.5)
    // 上位難易度は「物量」ではなく複合要素(押さえながら叩く・同時押しの連なり・スイープ・クロス)で難しくする
    +.10*(band.complex?mean(band.complex.map(key=>({tapDuringHold,chordRuns,sweeps,crosses})[key]>0?1:0)):1)));
  const pass=impossible===0;

  return {
    difficulty,noteCount:notes.length,seconds:round(seconds,1),density:round(density,2),
    pass,gate:{impossible},
    scores,
    musicality:{onsetHitRate:round(onsetHitRate),ghostNotes,importantOnsets:important.length,importantHit,importantCoverage:round(importantCoverage),
      beatShare,notesInSilence,phraseTotal,phraseSame,motifGroups,motifTotal,motifSame,phraseConsistency:round(phraseConsistency),phraseVariations,mirrorRate:round(mirrorRate),
      intensityDensityAgreement:round(intensityDensityAgreement),sectionDensitySpread:round(sectionDensitySpread,2),sectionVocabSpread,sections:sectionStats},
    vocabulary:{patternCounts,distinctPatterns,topPattern:topPattern?topPattern[0]:null,topShare:round(topShare),fallbackShare:round(fallbackShare),
      maxSameRun,localBias:round(localBias),transitionKinds:transitions.size,transitionTotal,transitionEntropy:round(transitionEntropy,2)},
    lanes:{laneShare,leftRightBias:round(leftRightBias),centerShare:round(centerShare),edgeShare:round(edgeShare),
      meanMove:round(meanMove,2),maxMove:round(maxMove,2),moveSpeedPerSecond:round(moveSpeed,2),hardJumps,fastPairs,
      fingerTravel:sim.fingerTravel.map(value=>round(value,1))},
    types:{...typeCounts,chords:chordGrids.size,chordRuns,sweeps,crosses,accents,endFlicks,tapers,tapDuringHold,tapDuringSlide,
      expandCount,contractCount,chordShapes,slideShapes,rests,longRests,longestRestMs:Math.round(longestRestMs),
      hardWindows:hardWindows.length,hardSectionMaxMs,restAfterHard,peakWindowNotes},
    hand:{impossible,strained,strainedRate:round(strainedRate),maxStrainStreakMs,strainStreaks:sim.strainStreaks.length,
      alternationRate:round(alternationRate),sameFingerMinMs:Number.isFinite(sameFingerMinMs)?Math.round(sameFingerMinMs):null,
      chordClearMinMs:Number.isFinite(chordClearMinMs)?Math.round(chordClearMinMs):null,
      heldFreeOk,heldFreeTotal,
      issues:sim.issues.slice(0,40).map(x=>({severity:x.severity,timeMs:x.timeMs,bar:x.bar,type:x.type,detail:x.detail}))},
  };
};

// ============================================================================
// 読み込み・表示
// ============================================================================
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const authoringDir=path.join(ROOT,'tools/mode/authoring');
const chartFileFor=(dir,dashed,source,difficulty)=>path.join(dir,`${dashed}-v3-${source==='v3'?'chart':'fixed'}-${difficulty.toLowerCase()}.json`);

const reportFor=(trackId,{source='v3fixed',dir=null,audioDir=null,beam}={})=>{
  const dashed=trackId.replace(/_/g,'-');
  const audioFile=path.join(audioDir||authoringDir,`${dashed}-v3-audio.json`);
  if(!fs.existsSync(audioFile))return null;
  const audio=readJson(audioFile);
  const out={trackId,source,generatedAt:null,difficulties:{}};
  for(const difficulty of DIFFICULTIES){
    const file=chartFileFor(dir||authoringDir,dashed,source,difficulty);
    if(!fs.existsSync(file))continue;
    out.difficulties[difficulty]=measure(readJson(file),audio,{beam});
  }
  return Object.keys(out.difficulties).length?out:null;
};

const AXES=['playability','musicality','readability','flow','variety','difficultyFit'];
const AXIS_LABEL={playability:'押せる',musicality:'音',readability:'読める',flow:'流れ',variety:'飽きない',difficultyFit:'難易度'};
const printReport=(report,baseline=null)=>{
  console.log(`\n■ ${report.trackId}（${report.source}）`);
  const header=['難易度','ノーツ','毎秒',...AXES.map(axis=>AXIS_LABEL[axis]),'押せない','忙しい','語彙','偏り','連続','反転','休符','跳び'];
  console.log('  '+header.map((h,i)=>String(h).padEnd(i===0?7:6)).join(''));
  for(const [difficulty,m] of Object.entries(report.difficulties)){
    const b=baseline?.difficulties?.[difficulty]||null;
    const diff=(value,before,digits=0)=>{
      if(!b||before==null||value==null)return String(value??'—');
      const delta=value-before;
      if(Math.abs(delta)<(digits?.5*10**-digits:.5))return String(value);
      return `${value}${delta>0?'↑':'↓'}`;
    };
    const cells=[difficulty,String(m.noteCount),String(m.density),
      ...AXES.map(axis=>diff(m.scores[axis],b?.scores?.[axis])),
      diff(m.hand.impossible,b?.hand?.impossible),
      diff(m.hand.strained,b?.hand?.strained),
      diff(m.vocabulary.distinctPatterns,b?.vocabulary?.distinctPatterns),
      `${Math.round(m.vocabulary.topShare*100)}%`,
      diff(m.vocabulary.maxSameRun,b?.vocabulary?.maxSameRun),
      `${Math.round(m.musicality.mirrorRate*100)}%`,
      diff(m.types.rests,b?.types?.rests),
      String(m.lanes.maxMove)];
    console.log('  '+cells.map((c,i)=>String(c).padEnd(i===0?7:6)).join('')+(m.pass?'':'  ✗ 不合格(押せない)'));
  }
};

const registryTracks=()=>{
  const file=path.join(authoringDir,'rhythm-song-registry.json');
  if(!fs.existsSync(file))return [];
  return Object.keys(readJson(file).songs||{});
};

module.exports={measure,reportFor,BANDS,AXES};

if(require.main===module){
  const all=process.argv.includes('--all');
  const write=process.argv.includes('--write');
  const json=process.argv.includes('--json');
  const source=arg('--source','v3fixed');
  const dir=arg('--dir',null)?path.resolve(ROOT,arg('--dir')):null;
  const baselineDir=arg('--baseline',null)?path.resolve(ROOT,arg('--baseline')):null;
  const outDir=arg('--out-dir',null)?path.resolve(ROOT,arg('--out-dir')):authoringDir;
  const beam=Number(arg('--beam',NaN));
  const tracks=all?registryTracks():[arg('--track','monster_hero_theme')];
  const reports=[];
  for(const trackId of tracks){
    const report=reportFor(trackId,{source,dir,beam:Number.isFinite(beam)?beam:undefined});
    if(!report)continue;
    report.generatedAt='deterministic';
    reports.push(report);
    let baseline=null;
    if(baselineDir){
      const file=path.join(baselineDir,`${trackId.replace(/_/g,'-')}-v3-quality.json`);
      if(fs.existsSync(file))baseline=readJson(file);
    }
    if(!json)printReport(report,baseline);
    if(write){
      fs.mkdirSync(outDir,{recursive:true});
      const out=path.join(outDir,`${trackId.replace(/_/g,'-')}-v3-quality.json`);
      fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
      if(!json)console.log(`  書き出し: ${path.relative(ROOT,out)}`);
    }
  }
  if(json)console.log(JSON.stringify(reports.length===1?reports[0]:reports,null,1));
  if(!json&&reports.length>1){
    // 全体のまとめ(難易度ごとの平均)
    console.log('\n■ まとめ（曲の平均）');
    for(const difficulty of DIFFICULTIES){
      const list=reports.map(r=>r.difficulties[difficulty]).filter(Boolean);
      if(!list.length)continue;
      const avg=key=>round(mean(list.map(m=>m.scores[key])),0);
      console.log(`  ${difficulty.padEnd(7)}${AXES.map(axis=>`${AXIS_LABEL[axis]}${String(avg(axis)).padStart(4)}`).join('  ')}`
        +`  押せない${list.reduce((a,m)=>a+m.hand.impossible,0)}  忙しい率${round(mean(list.map(m=>m.hand.strainedRate))*100,1)}%`
        +`  語彙${round(mean(list.map(m=>m.vocabulary.distinctPatterns)),1)}  反転${round(mean(list.map(m=>m.musicality.mirrorRate))*100,0)}%`);
    }
  }
  const failed=reports.some(report=>Object.values(report.difficulties).some(m=>!m.pass));
  process.exit(failed?1:0);
}
