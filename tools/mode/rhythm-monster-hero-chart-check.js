#!/usr/bin/env node
// 体験版の曲「Monster Hero」の譜面候補（EASY / NORMAL / HARD）が、
// 難易度ごとの制作方針どおりに作られているかを見る。
//
// ここで見るのは「機械的に確かめられること」だけで、曲に合っているかは含まない。
// 音ハメ・フレーズ感はiPhone実機の耳確認でしか決められないため、
// この検査が全部通っても正式完成譜面にはならない（reviewRequired=true のまま）。
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const runtimeSource=read('monster-hero/data/rhythm-mode.js');
const onsets={
  normal:JSON.parse(read('tools/mode/authoring/monster-hero-theme-onset-candidates.json')),
  dense:JSON.parse(read('tools/mode/authoring/monster-hero-theme-onset-candidates-dense.json')),
};
const gridMapOf=file=>{
  const map=new Map();
  for(const [grid,strength,offsetMs] of file.candidates){
    const prev=map.get(grid);
    if(!prev||strength>prev.strength)map.set(grid,{strength,offsetMs});
  }
  return map;
};
const maps={normal:gridMapOf(onsets.normal),dense:gridMapOf(onsets.dense)};

const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${read('monster-hero/data/rhythm-timing.js')}\nthis.__t=RHYTHM_TIMING_DATA.monster_hero_theme;`,timingContext);
const timing=timingContext.__t;
ok('Monster Heroのタイミング基準がデータにある',!!timing&&timing.trackId==='monster_hero_theme',
  timing?`BPM=${timing.bpm} beatZero=${timing.beatZeroMs}ms 16分=${(timing.beatMs/timing.subdivisionsPerBeat).toFixed(2)}ms`:'');
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const gridTimeMs=g=>timing.beatZeroMs+g*gridMs;
const BEAT=timing.subdivisionsPerBeat;

ok('候補を増やしたファイルは、元のファイルの強い側をほぼそのまま含む',(()=>{
  const dense=maps.dense;
  const missing=[...maps.normal.entries()].filter(([grid])=>!dense.has(grid));
  return missing.length===0;
})(),`元${onsets.normal.candidateCount}件 / dense${onsets.dense.candidateCount}件`);

const EXPECTED={
  EASY:{source:'normal',lattice:2,types:['TAP','HOLD'],widths:[2],laneStep:1,simultaneous:false},
  NORMAL:{source:'dense',lattice:2,types:['TAP','HOLD','FLICK'],widths:[1,2,3],laneStep:2,simultaneous:false},
  HARD:{source:'dense',lattice:1,types:['TAP','HOLD','FLICK','SLIDE'],widths:[1,2,3,4],laneStep:3,simultaneous:true},
};
const charts={};

for(const difficulty of ['EASY','NORMAL','HARD']){
  const expect=EXPECTED[difficulty];
  console.log(`\n--- ${difficulty} ---`);
  const candidate=JSON.parse(read(`monster-hero/debug/monster-hero-theme-${difficulty.toLowerCase()}-formal-candidate-v1.json`));
  charts[difficulty]=candidate;
  const notes=candidate.notes;
  const byGrid=maps[expect.source];

  ok('同じタイミング基準で作られている',
    candidate.bpm===timing.bpm&&candidate.beatZeroMs===timing.beatZeroMs&&candidate.subdivisionsPerBeat===timing.subdivisionsPerBeat);
  ok('未完成のレビュー状態のまま',
    candidate.status==='FORMAL_CANDIDATE'&&candidate.reviewRequired===true&&candidate.runtimeConnected===false);
  ok('耳確認へ回したグリッドを持っている',Array.isArray(candidate.earReviewGrids)&&candidate.earReviewGrids.length>0,
    `${candidate.earReviewGrids.length}件`);
  ok('ノーツ数と種別の内訳が一致する',
    candidate.noteCount===notes.length
    &&Object.entries(candidate.typeCounts).every(([type,count])=>notes.filter(n=>n.type===type).length===count),
    `${notes.length}ノーツ / ${Object.entries(candidate.typeCounts).map(([k,v])=>`${k}${v}`).join(' ')}`);
  ok('この難易度で決めた種別だけを使う',
    notes.every(n=>expect.types.includes(n.type))
    &&candidate.policy.types.join()===expect.types.join());
  ok('時系列に並んでいる',notes.every((n,i)=>i===0||n.grid>=notes[i-1].grid));
  ok('置き場所は決めた格子の上だけ',notes.every(n=>n.grid%expect.lattice===0),
    `格子=16分×${expect.lattice}`);
  ok('この難易度で決めた幅だけを使う',
    notes.every(n=>expect.widths.includes(n.subLaneWidth))
    &&candidate.policy.widths.join()===expect.widths.join());
  ok('10サブレーンからはみ出さない',
    notes.every(n=>n.type==='SLIDE'||(n.subLane>=0&&n.subLane+n.subLaneWidth<=10)));

  const laneOf=n=>n.type==='SLIDE'?n.lane:n.subLane/2;
  // 長押し中へ重ねるTAPは別の指で押すので、片手の移動量としては数えない。
  const oneFinger=notes.filter(n=>n.overlapWithGrid===undefined);
  const steps=oneFinger.slice(1).map((n,i)=>Math.abs(laneOf(n)-laneOf(oneFinger[i])));
  ok('レーンの移動量が決めた範囲に収まる',steps.every(s=>s<=expect.laneStep),
    `最大移動量 ${Math.max(...steps)} / 上限 ${expect.laneStep}`);

  // --- 同時押し ---
  const sameGrid=new Map();
  for(const n of notes){
    if(!sameGrid.has(n.grid))sameGrid.set(n.grid,[]);
    sameGrid.get(n.grid).push(n);
  }
  const chords=[...sameGrid.values()].filter(list=>list.length>1);
  ok('隣り合う同時押しを作らない（作るなら2サブレーン以上あける）',chords.every(list=>{
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j];
      if(a.type==='SLIDE'||b.type==='SLIDE')continue;
      const left=a.subLane<b.subLane?a:b,right=a.subLane<b.subLane?b:a;
      if(right.subLane-(left.subLane+left.subLaneWidth)<2)return false;
    }
    return true;
  }),`同時刻の組 ${chords.length}件`);
  if(!expect.simultaneous)ok('この難易度では同時押しを作らない',chords.length===0);

  // --- HOLD ---
  const holds=notes.filter(n=>n.type==='HOLD');
  ok('HOLDの長さは4か8グリッド',holds.every(n=>candidate.policy.holdGrids.includes(n.durationGrids)));
  ok('HOLDは曲の前半と後半の両方にある',(()=>{
    const mid=(notes[0].grid+notes[notes.length-1].grid)/2;
    return holds.some(n=>n.grid<mid)&&holds.some(n=>n.grid>=mid);
  })(),`${holds.length}件`);
  ok('HOLDを隣り合わせない',(()=>{
    for(let i=0;i<notes.length-1;i++)if(notes[i].type==='HOLD'&&notes[i+1].type==='HOLD')return false;
    return true;
  })());

  // --- FLICK ---
  const flicks=notes.filter(n=>n.type==='FLICK');
  if(expect.types.includes('FLICK')){
    ok('FLICKを入れている',flicks.length>0,`${flicks.length}件`);
    ok('FLICKは狙いを絞れるよう幅1で置く',flicks.every(n=>n.subLaneWidth===1));
  }else ok('この難易度ではFLICKを使わない',flicks.length===0);

  // --- SLIDE ---
  const slides=notes.filter(n=>n.type==='SLIDE');
  if(expect.types.includes('SLIDE')){
    ok('SLIDEを入れている',slides.length>0,`${slides.length}件`);
    ok('SLIDEの経路は2点以上・時刻順',slides.every(n=>
      Array.isArray(n.slidePoints)&&n.slidePoints.length>=2
      &&n.slidePoints.every((p,i)=>i===0||p.grid>n.slidePoints[i-1].grid)));
    ok('SLIDEのレーンは0.5刻み',slides.every(n=>n.slidePoints.every(p=>Math.abs(p.lane*2-Math.round(p.lane*2))<1e-6)));
    ok('SLIDEの始点・終点が経路の端と一致する',slides.every(n=>
      n.lane===n.slidePoints[0].lane&&n.endLane===n.slidePoints[n.slidePoints.length-1].lane
      &&n.grid===n.slidePoints[0].grid&&n.grid+n.durationGrids===n.slidePoints[n.slidePoints.length-1].grid));
    ok('SLIDEは幅が途中で変わる（可変幅を使っている）',slides.every(n=>new Set(n.slidePoints.map(p=>p.subLaneWidth)).size>=2));
    ok('SLIDEの長さは1〜128グリッド',slides.every(n=>n.durationGrids>=1&&n.durationGrids<=128));
    ok('SLIDEの経路の内側に別のノーツを置かない',slides.every(n=>
      !notes.some(o=>o!==n&&o.type!=='TAP'&&o.grid>n.grid&&o.grid<n.grid+n.durationGrids)));
  }else ok('この難易度ではSLIDEを使わない',slides.length===0);

  // --- 複合操作 ---
  const longNotes=notes.filter(n=>n.type==='HOLD'||n.type==='SLIDE');
  const overlapped=longNotes.filter(n=>notes.some(o=>o!==n&&o.grid>n.grid&&o.grid<n.grid+n.durationGrids));
  if(expect.simultaneous){
    ok('HOLD/SLIDEの最中に別のTAPを重ねる複合操作がある',overlapped.length>0,`${overlapped.length}件`);
    const overlapTaps=notes.filter(n=>n.overlapWithGrid!==undefined);
    ok('重ねるTAPがどの長押しへ乗るか記録している',overlapTaps.length>0&&overlapTaps.every(n=>notes.some(o=>o.grid===n.overlapWithGrid)),
      `${overlapTaps.length}件`);
    ok('重ねるTAPは長押ししている指から離す',overlapTaps.every(n=>{
      const base=notes.find(o=>o.grid===n.overlapWithGrid);
      if(!base)return false;
      const baseSub=base.type==='SLIDE'?Math.round(base.lane*2):base.subLane;
      return Math.abs(n.subLane-baseSub)>=4;
    }));
  }else ok('この難易度では長押し中に別のノーツを重ねない',overlapped.length===0);

  // --- 音源解析との対応 ---
  ok('採用したノーツはすべて元のオンセット候補に在る',notes.every(n=>byGrid.has(n.grid)));
  ok('採用点の音ピーク差は±30ms以内',
    notes.every(n=>Math.abs(n.sourcePeakOffsetMs)<=candidate.policy.maxAbsPeakOffsetMs),
    `最大 ${Math.max(...notes.map(n=>Math.abs(n.sourcePeakOffsetMs)))}ms`);
  ok('採用点の強さ・ずれは元候補と一致する',
    notes.every(n=>byGrid.get(n.grid).offsetMs===n.sourcePeakOffsetMs
      &&Math.round(byGrid.get(n.grid).strength*100)/100===n.sourceStrength));
  ok('耳確認へ回したグリッドは採用ノーツと重ならない',
    candidate.earReviewGrids.every(g=>!notes.some(n=>n.grid===g)));

  // --- モンスターノーツ ---
  const monsters=notes.filter(n=>n.monsterSlot);
  ok('モンスターノーツは4体ぶんでTAPだけ',monsters.length===4&&monsters.every(n=>n.type==='TAP'));
  ok('枠は1〜4で、時刻の順と枠の順が一致する',monsters.every((n,i)=>n.monsterSlot===i+1));
  ok('曲の頭と終わりを避け、前後を空けて置く',(()=>{
    const first=notes[0].grid,last=notes[notes.length-1].grid,span=last-first;
    return notes.every((n,i)=>{
      if(!n.monsterSlot)return true;
      if(n.grid<=first+span*.1||n.grid>=last-span*.1)return false;
      const before=i>0?n.grid-notes[i-1].grid:Infinity;
      const after=i<notes.length-1?notes[i+1].grid-n.grid:Infinity;
      return before>=4&&after>=4;
    });
  })(),monsters.map(n=>`${(gridTimeMs(n.grid)/1000).toFixed(0)}s`).join(' '));

  // --- 密度と空白 ---
  const spanMs=gridTimeMs(notes[notes.length-1].grid)-gridTimeMs(notes[0].grid);
  ok('候補に書いた密度が実際と合っている',
    Math.abs(candidate.densityPerSecond-notes.length/(spanMs/1000))<.01,`${candidate.densityPerSecond}ノーツ毎秒`);
  const gaps=notes.slice(1).map((n,i)=>(n.grid-notes[i].grid)*gridMs);
  ok('手が止まる長い空白を作らない',Math.max(...gaps)<=5000,`最大 ${(Math.max(...gaps)/1000).toFixed(1)}秒`);

  // --- runtimeへの反映 ---
  const key=difficulty.toLowerCase();
  const begin=runtimeSource.indexOf(`// <monster-hero-${key}-notes>`);
  const end=runtimeSource.indexOf(`// </monster-hero-${key}-notes>`);
  ok('runtimeの譜面ブロックが生成ツールのマーカーで囲まれている',begin>=0&&end>begin);
  const block=runtimeSource.slice(begin,end);
  const rows=[...block.matchAll(/([thfs])\(([^()]*(?:\[[^\]]*\][^()]*)*)\)/g)].map(m=>({fn:m[1],args:m[2]}));
  ok('runtimeの行数が候補と一致する',rows.length===notes.length,`${rows.length}行 / ${notes.length}ノーツ`);
  ok('runtimeの1行1行が候補と一致する（手で書き換えていない）',(()=>notes.every((n,i)=>{
    const row=rows[i];
    if(!row)return false;
    const timeMs=Math.round(gridTimeMs(n.grid));
    if(n.type==='SLIDE'){
      if(row.fn!=='s')return false;
      const points=n.slidePoints.map(p=>`[${Math.round(gridTimeMs(p.grid))},${p.lane},${p.subLaneWidth}]`).join(',');
      return row.args===`${timeMs},${Math.round(gridTimeMs(n.grid+n.durationGrids))},[${points}]`;
    }
    if(n.type==='HOLD')return row.fn==='h'&&row.args===`${timeMs},${n.subLane},${n.subLaneWidth},${Math.round(gridTimeMs(n.grid+n.durationGrids))}`;
    if(n.type==='FLICK')return row.fn==='f'&&row.args===`${timeMs},${n.subLane},${n.subLaneWidth}`;
    return row.fn==='t'&&row.args===`${timeMs},${n.subLane},${n.subLaneWidth},${n.monsterSlot||0}`;
  }))());
}

// --- 難易度の並び ---
console.log('\n--- 3難易度の関係 ---');
ok('ノーツ数が EASY < NORMAL < HARD の順に増える',
  charts.EASY.noteCount<charts.NORMAL.noteCount&&charts.NORMAL.noteCount<charts.HARD.noteCount,
  `${charts.EASY.noteCount} / ${charts.NORMAL.noteCount} / ${charts.HARD.noteCount}`);
ok('密度も同じ順に上がる',
  charts.EASY.densityPerSecond<charts.NORMAL.densityPerSecond&&charts.NORMAL.densityPerSecond<charts.HARD.densityPerSecond,
  `${charts.EASY.densityPerSecond} / ${charts.NORMAL.densityPerSecond} / ${charts.HARD.densityPerSecond} ノーツ毎秒`);
ok('使える種別が上の難易度ほど広がる',
  Object.keys(charts.EASY.typeCounts).length<Object.keys(charts.NORMAL.typeCounts).length
  &&Object.keys(charts.NORMAL.typeCounts).length<Object.keys(charts.HARD.typeCounts).length);
ok('レーンの移動量の上限も上の難易度ほど大きい',
  charts.EASY.policy.maxLaneStep<charts.NORMAL.policy.maxLaneStep
  &&charts.NORMAL.policy.maxLaneStep<charts.HARD.policy.maxLaneStep);

// --- 公開状態 ---
console.log('\n--- 公開状態 ---');
ok('デバッグ専用の曲として登録している',
  runtimeSource.includes("songId:'monster_hero_theme_candidate'")
  &&runtimeSource.includes("bgmTrackId:'monster_hero_theme'")
  &&runtimeSource.includes('debugDescription'));
ok('EASY / NORMAL / HARD の3難易度だけを割り当てている',
  runtimeSource.includes("id==='EASY'?monsterHeroEasyChart:id==='NORMAL'?monsterHeroNormalChart:id==='HARD'?monsterHeroHardChart:emptyRhythmChart()"));
ok('既存BGMを使い回し、体験版のために音源を複製していない',
  fs.existsSync(path.join(ROOT,'monster-hero/audio/bgm-monster-hero-theme.mp3'))
  &&!fs.readdirSync(path.join(ROOT,'monster-hero/audio')).some(f=>/monster-hero-theme.*(copy|easy|normal|hard|rhythm)/i.test(f)));
ok('短縮再生の指定は持たない（全尺で遊ぶ）',(()=>{
  // 曲の定義は Object.freeze({...}) の1ブロック。次の songId までを自分の範囲として見る。
  const start=runtimeSource.indexOf("songId:'monster_hero_theme_candidate'");
  if(start<0)return false;
  const next=runtimeSource.indexOf('songId:',start+10);
  // コメントで名前に触れているだけの行に引っかからないよう、実際の指定(コロン付き)だけを見る。
  return !runtimeSource.slice(start,next<0?runtimeSource.length:next).includes('playDurationMs:');
})());

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
