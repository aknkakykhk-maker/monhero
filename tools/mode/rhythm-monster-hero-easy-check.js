#!/usr/bin/env node
// Monster Hero EASY 正式候補v1が、EASYの制作方針どおりに作られているかを見る。
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

const candidate=JSON.parse(read('monster-hero/debug/monster-hero-theme-easy-formal-candidate-v1.json'));
const onsets=JSON.parse(read('tools/mode/authoring/monster-hero-theme-onset-candidates.json'));
const runtimeSource=read('monster-hero/data/rhythm-mode.js');

// --- タイミング基準 ---
const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${read('monster-hero/data/rhythm-timing.js')}\nthis.__t=RHYTHM_TIMING_DATA.monster_hero_theme;`,timingContext);
const timing=timingContext.__t;
ok('Monster Heroのタイミング基準がデータにある',!!timing&&timing.trackId==='monster_hero_theme',
  timing?`BPM=${timing.bpm} beatZero=${timing.beatZeroMs}ms 16分=${(timing.beatMs/timing.subdivisionsPerBeat).toFixed(2)}ms`:'');
ok('候補は同じタイミング基準で作られている',
  candidate.bpm===timing.bpm&&candidate.beatZeroMs===timing.beatZeroMs&&candidate.subdivisionsPerBeat===timing.subdivisionsPerBeat);
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const gridTimeMs=g=>timing.beatZeroMs+g*gridMs;

// --- 未完成のレビュー状態であること（勝手に完成扱いしない） ---
ok('正式候補は未完成レビュー状態',
  candidate.status==='FORMAL_CANDIDATE'&&candidate.reviewRequired===true&&candidate.runtimeConnected===false);
ok('耳確認へ回したグリッドを持っている',Array.isArray(candidate.earReviewGrids)&&candidate.earReviewGrids.length>0,
  `${candidate.earReviewGrids.length}件`);

const notes=candidate.notes;
const taps=notes.filter(n=>n.type==='TAP'),holds=notes.filter(n=>n.type==='HOLD');
ok('ノーツ数と種別の内訳が一致する',
  candidate.noteCount===notes.length&&candidate.typeCounts.TAP===taps.length&&candidate.typeCounts.HOLD===holds.length,
  `${notes.length}ノーツ / TAP${taps.length} / HOLD${holds.length}`);
ok('EASYはTAPとHOLDだけ（FLICK/SLIDEを使わない）',notes.every(n=>n.type==='TAP'||n.type==='HOLD'));
ok('HOLDは少なめに保つ',holds.length<=notes.length*.1,`${holds.length}件 / 全体の${(holds.length/notes.length*100).toFixed(1)}%`);

// --- 置き場所 ---
ok('時系列に並び、同じグリッドへ重ねていない',
  notes.every((n,i)=>i===0||n.grid>notes[i-1].grid));
ok('同時押しを作っていない（同じ時刻に2つ置かない）',new Set(notes.map(n=>n.grid)).size===notes.length);
ok('16分裏へ置かず、8分の位置だけを使う',notes.every(n=>n.grid%candidate.policy.latticeGrids===0),
  `裏拍に乗ったノーツ ${notes.filter(n=>n.grid%2!==0).length}件`);
ok('メイン5レーン・幅2だけを使う',
  notes.every(n=>Number.isInteger(n.lane)&&n.lane>=0&&n.lane<=4&&n.subLane===n.lane*2&&n.subLaneWidth===2));
const laneSteps=notes.slice(1).map((n,i)=>Math.abs(n.lane-notes[i].lane));
ok('レーンは1つずつしか動かさない（激しい左右移動を作らない）',
  laneSteps.every(step=>step<=candidate.policy.maxLaneStep),`最大移動量 ${Math.max(...laneSteps)}`);
ok('中央寄りに配置し、端のレーンへ偏らせない',(()=>{
  const count=lane=>notes.filter(n=>n.lane===lane).length;
  return count(0)<=count(1)&&count(4)<=count(3);
})(),`レーン別 ${[0,1,2,3,4].map(l=>notes.filter(n=>n.lane===l).length).join(' / ')}`);

// --- HOLD ---
ok('HOLDの長さは4か8グリッドだけ',holds.every(n=>candidate.policy.holdGrids.includes(n.durationGrids)));
ok('HOLDの終端は次のノーツより前に収まる',(()=>notes.every((n,i)=>
  n.type!=='HOLD'||i===notes.length-1||n.grid+n.durationGrids<notes[i+1].grid))());
ok('HOLDを隣り合わせない',(()=>{
  for(let i=0;i<notes.length-1;i++)if(notes[i].type==='HOLD'&&notes[i+1].type==='HOLD')return false;
  return true;
})());
ok('HOLDが曲の前半と後半の両方にある（前半へ固まっていない）',(()=>{
  const mid=(notes[0].grid+notes[notes.length-1].grid)/2;
  return holds.some(n=>n.grid<mid)&&holds.some(n=>n.grid>=mid);
})(),holds.map(n=>`${(gridTimeMs(n.grid)/1000).toFixed(0)}s`).join(' '));

// --- モンスターノーツ ---
const monsters=notes.filter(n=>n.monsterSlot);
ok('モンスターノーツは4体ぶん',monsters.length===candidate.monsterSlotGrids.length&&monsters.length===4);
ok('モンスターノーツはTAPだけに付ける',monsters.every(n=>n.type==='TAP'));
ok('枠は1〜4で、時刻の順と枠の順が一致する',
  monsters.every((n,i)=>n.monsterSlot===i+1));
ok('曲の頭と終わりを避けて置く',(()=>{
  const first=notes[0].grid,last=notes[notes.length-1].grid,span=last-first;
  return monsters.every(n=>n.grid>first+span*.1&&n.grid<last-span*.1);
})(),monsters.map(n=>`${(gridTimeMs(n.grid)/1000).toFixed(0)}s`).join(' '));
ok('モンスターノーツの前後を空けて、狙って取れるようにしている',(()=>notes.every((n,i)=>{
  if(!n.monsterSlot)return true;
  const before=i>0?n.grid-notes[i-1].grid:Infinity;
  const after=i<notes.length-1?notes[i+1].grid-n.grid:Infinity;
  return before>=4&&after>=4;
}))());

// --- 音源解析との対応 ---
const byGrid=new Map();
for(const [grid,strength,offsetMs] of onsets.candidates){
  const prev=byGrid.get(grid);
  if(!prev||strength>prev.strength)byGrid.set(grid,{strength,offsetMs});
}
ok('採用したノーツはすべて元のオンセット候補に在る',notes.every(n=>byGrid.has(n.grid)));
ok('採用点の音ピーク差は±30ms以内',
  notes.every(n=>Math.abs(n.sourcePeakOffsetMs)<=candidate.policy.maxAbsPeakOffsetMs),
  `最大 ${Math.max(...notes.map(n=>Math.abs(n.sourcePeakOffsetMs)))}ms`);
ok('採用点の強さ・ずれは元候補と一致する',
  notes.every(n=>byGrid.get(n.grid).offsetMs===n.sourcePeakOffsetMs
    &&Math.round(byGrid.get(n.grid).strength*100)/100===n.sourceStrength));
ok('耳確認へ回したグリッドは採用ノーツと重ならない',
  candidate.earReviewGrids.every(g=>!notes.some(n=>n.grid===g)));

// --- 密度と空白 ---
const spanMs=gridTimeMs(notes[notes.length-1].grid)-gridTimeMs(notes[0].grid);
const density=notes.length/(spanMs/1000);
ok('EASYとして落ち着いた密度に収まっている',density<=1.6,`${density.toFixed(2)}ノーツ/秒`);
const gaps=notes.slice(1).map((n,i)=>(n.grid-notes[i].grid)*gridMs);
ok('手が止まる長い空白を作らない',Math.max(...gaps)<=5000,`最大 ${(Math.max(...gaps)/1000).toFixed(1)}秒`);

// --- runtimeへの反映 ---
const begin=runtimeSource.indexOf('// <monster-hero-easy-notes>');
const end=runtimeSource.indexOf('// </monster-hero-easy-notes>');
ok('runtimeの譜面ブロックが生成ツールのマーカーで囲まれている',begin>=0&&end>begin);
const rows=[...runtimeSource.slice(begin,end).matchAll(/\[(-?\d+),(\d+),(\d+),(\d+)\]/g)]
  .map(m=>m.slice(1).map(Number));
ok('runtimeの行数が候補と一致する',rows.length===notes.length,`${rows.length}行 / ${notes.length}ノーツ`);
ok('runtimeの1行1行が候補と一致する（手で書き換えていない）',(()=>notes.every((n,i)=>{
  const [timeMs,subLane,holdMs,monsterSlot]=rows[i]||[];
  return timeMs===Math.round(gridTimeMs(n.grid))
    &&subLane===n.subLane
    &&holdMs===(n.type==='HOLD'?Math.round(n.durationGrids*gridMs):0)
    &&monsterSlot===(n.monsterSlot||0);
}))());

// --- 公開状態 ---
ok('デバッグ専用の曲として登録している',
  runtimeSource.includes("songId:'monster_hero_theme_easy_candidate'")
  &&runtimeSource.includes("bgmTrackId:'monster_hero_theme'")
  &&runtimeSource.includes('debugDescription'));
ok('既存BGMを使い回し、体験版のために音源を複製していない',
  fs.existsSync(path.join(ROOT,'monster-hero/audio/bgm-monster-hero-theme.mp3'))
  &&!fs.readdirSync(path.join(ROOT,'monster-hero/audio')).some(f=>/monster-hero-theme.*(copy|easy|rhythm)/i.test(f)));
ok('EASY以外の難易度はまだ空のまま',
  runtimeSource.includes("id==='EASY'?monsterHeroEasyChart:emptyRhythmChart()"));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
