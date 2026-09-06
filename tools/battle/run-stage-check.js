#!/usr/bin/env node
// ランの進行(runStage)と、いま描いている画面(gameState)の切り分けを検査する。
//
//   node tools/battle/run-stage-check.js
//
// 見ているもの:
//   ① runStage / runProgressAllowed が本体にあり、画面の一覧を二重に持っていないこと
//   ② いまは runStage が gameState と必ず同じ値・同じ条件になること(挙動が変わっていない)
//   ③ ランの進行を回す3つのループが gameState ではなく runStage を見ていること
//
// docs/spec/QUICK_RHYTHM_LINK.md の PR2。モンビーを開いたままクイック∞周回を続ける連携は、
// runStage / runProgressAllowed の2行だけを変えて実現する。ここが崩れると
// 「別画面へ移ってもバトルが進む」「バトル画面なのに進まない」のどちらかが静かに起きる。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const slice = (from, to) => {
  const a = source.indexOf(from), b = source.indexOf(to, a);
  if (a < 0 || b <= a) throw new Error(`本体から切り出せません: ${from}`);
  return source.slice(a, b + to.length);
};

// ---- ① 定義がある / 表を二重に持っていない ----
const definition = slice('const RUN_PHASE_STATES =', 'const runProgressAllowed = runStage !== null;');
check('RUN_STAGE_SCREENS は RUN_PHASE_STATES を再利用している（画面の表を二重に持たない）',
  definition.includes("const RUN_STAGE_SCREENS = [...RUN_PHASE_STATES,'BATTLE'];"));
check('runStage と runProgressAllowed が定義されている',
  definition.includes('const runStage = RUN_STAGE_SCREENS.includes(gameState) ? gameState : null;')
  && definition.includes('const runProgressAllowed = runStage !== null;'));

// ---- ② いまは gameState と必ず同じ値・同じ条件になる ----
// 本体の式をそのまま動かす。数式を検査へ書き写さない。
const evaluateFor = (gameState) => {
  const sandbox = { gameState, console };
  vm.createContext(sandbox);
  vm.runInContext(`${definition}\nthis.result={ runStage, runProgressAllowed, screens:RUN_STAGE_SCREENS };`, sandbox);
  return sandbox.result;
};
const runScreens = evaluateFor('HOME').screens;
const EXPECTED_RUN_SCREENS = ['PICK_HERO','PICK_ALLY','PICK_SLOT','PICK_TEACHING','PICK_PRO_ALLIES','REWARD_PICK','UPGRADE_SKILL','WAVE_RESULT','CHAMPION','QUICK_GROWTH','QUICK_JOIN','BATTLE'];
check('ランの画面がひととおり入っている',
  EXPECTED_RUN_SCREENS.every(screen => runScreens.includes(screen)) && runScreens.length === EXPECTED_RUN_SCREENS.length,
  runScreens.join(','));
check('ランの画面では runStage が gameState と同じ値になる',
  runScreens.every(screen => evaluateFor(screen).runStage === screen));
check('ランの画面では進行してよい',
  runScreens.every(screen => evaluateFor(screen).runProgressAllowed === true));
// ランでない画面(HOME・モンビー・設定など)では、いまは進行しない。
// ★モンビー連携(PR3)を入れたら、モンビーの非演奏画面だけがここから外れる。
const OTHER_SCREENS = ['HOME','BATTLE_MENU','PROFILE','MASU_LIST','RHYTHM_DEMO_HOME','RHYTHM_PLAY','RHYTHM_RANKING','EXTREME_DIFFICULTY_SELECT'];
check('ランでない画面では runStage が null で、進行しない',
  OTHER_SCREENS.every(screen => { const r = evaluateFor(screen); return r.runStage === null && r.runProgressAllowed === false; }));

// ---- ③ 進行を回す3つのループが runStage を見ている ----
const hasBareGameState = (text) => /[^a-zA-Z]gameState[^a-zA-Z]/.test(text);
const championLoop = slice('    if(!runProgressAllowed||runStage!==\'CHAMPION\'', '},[runStage,runProgressAllowed,championPresentationComplete,autoRepeat,autoBattle,runMode]);');
check('次周開始のループが runStage を見ている', !hasBareGameState(championLoop), hasBareGameState(championLoop) ? 'gameStateが残っています' : '');

const turnLoopStart = source.indexOf('    const blocked=!runProgressAllowed||runStage!==\'BATTLE\'');
const turnLoopEnd = source.indexOf('battleTutorialStep]);', turnLoopStart);
const turnLoop = turnLoopStart > 0 && turnLoopEnd > turnLoopStart ? source.slice(turnLoopStart, turnLoopEnd) : null;
check('ターン進行のループが runStage を見ている', turnLoop !== null && !hasBareGameState(turnLoop),
  turnLoop === null ? 'ループを切り出せません' : (hasBareGameState(turnLoop) ? 'gameStateが残っています' : ''));

const postWaveLoop = slice('  // AUTO中にWAVE後の画面へ入ったときだけ、各画面の既存handlerを1回だけ呼んで進める。', '},[autoBattle,runStage,runProgressAllowed]);');
check('WAVE後の進行が runStage を見ている', !hasBareGameState(postWaveLoop), hasBareGameState(postWaveLoop) ? 'gameStateが残っています' : '');
check('WAVE後の各段がすべて runStage で分岐している',
  ['WAVE_RESULT','REWARD_PICK','QUICK_GROWTH','PICK_ALLY','QUICK_JOIN','PICK_TEACHING','UPGRADE_SKILL']
    .every(stage => postWaveLoop.includes(`runStage==='${stage}'`)));

// ---- 連携(PR3)を入れる前は、モンビーの画面では進まない ----
// ここが true になったら連携が入った合図。そのときはこの検査を「非演奏画面だけ進む」へ直す。
check('モンビーの画面ではまだ進まない（PR3を入れたらこの検査を更新する）',
  ['RHYTHM_DEMO_HOME','RHYTHM_DEMO_HELP','RHYTHM_DEMO_MONSTERS','RHYTHM_RANKING','RHYTHM_PLAY']
    .every(screen => evaluateFor(screen).runProgressAllowed === false));

if (failed) { console.error(`\n${failed}件のNGがあります`); process.exit(1); }
console.log('\nrun stage check passed.');
