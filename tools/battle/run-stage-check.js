#!/usr/bin/env node
// ランの進行(runStage)と、いま描いている画面(gameState)の切り分けを検査する。
//
//   node tools/battle/run-stage-check.js
//
// 見ているもの:
//   ① runStage が画面(gameState)とは別のstateとして持たれていること
//   ② ランの段階を変える経路が advanceRunStage の1つだけであること(直接 setGameState しない)
//   ③ ランの進行を回す3つのループが gameState ではなく runStage を見ていること
//   ④ いまは runBackgroundAllowed が false なので、段階が変わると画面も必ず一緒に変わること
//
// docs/spec/QUICK_RHYTHM_LINK.md の PR2〜PR3。モンビーを開いたままクイック∞周回を続ける
// 連携は、runBackgroundAllowed を「モンビーの非演奏画面ならtrue」にするだけで実現する。
// ここが崩れると「別画面へ移ってもバトルが進む」「バトル画面なのに進まない」
// 「段階だけ進んで画面が置いていかれる」のどれかが静かに起きる。
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
const definition = slice('const RUN_PHASE_STATES =', 'const runProgressAllowed = runStage !== null && gameState === runStage;');
check('RUN_STAGE_SCREENS は RUN_PHASE_STATES を再利用している（画面の表を二重に持たない）',
  definition.includes("const RUN_STAGE_SCREENS = [...RUN_PHASE_STATES,'BATTLE'];"));
check('runStage を画面とは別のstateとして持っている',
  definition.includes('const [runStage, setRunStage] = useState(null);')
  && definition.includes('const runStageRef = useRef(null);'));
check('ランの段階を変える入口が advanceRunStage の1つだけある',
  definition.includes('const advanceRunStage = (stage) => {')
  && definition.includes('if (!runBackgroundAllowed) setGameState(stage);'));
check('ランから抜けるときに段階を捨てる helper がある',
  definition.includes('const clearRunStage = () => { runStageRef.current = null; setRunStage(null); };')
  && source.includes('    clearRunStage();'));
check('runProgressAllowed は「段階があり、その画面を描いている」ことを見る',
  definition.includes('const runProgressAllowed = runStage !== null && gameState === runStage;'));

// ---- ②④ 本体の式をそのまま動かして、段階と画面のかみ合わせを確かめる ----
// React の useState / useRef は「値をそのまま返す入れ物」に置き換える。
// 見たいのは advanceRunStage が何を書き換えるかで、Reactの再描画そのものではない。
const evaluateWith = (initialGameState) => {
  // gameState と setGameState は評価するコードの中で作る。
  // sandbox 側に置くと、本体が読む変数と書き換える先が別物になってしまう
  const sandbox = { console, useRef: () => ({ current: null }) };
  vm.createContext(sandbox);
  vm.runInContext(`let gameState=${JSON.stringify(initialGameState)}; const setGameState=(v)=>{gameState=v;};
${definition.replace('const [runStage, setRunStage] = useState(null);', 'let runStage=null; const setRunStage=(v)=>{runStage=v;};')}
this.api={ advanceRunStage, clearRunStage, isRunStage, screens:RUN_STAGE_SCREENS, backgroundAllowed:runBackgroundAllowed,
  setScreen:(v)=>{gameState=v;},
  read:()=>({ runStage, gameState, allowed: runStage !== null && gameState === runStage }) };`, sandbox);
  return { api: sandbox.api };
};
const base = evaluateWith('HOME');
const runScreens = base.api.screens;
const EXPECTED_RUN_SCREENS = ['PICK_HERO','PICK_ALLY','PICK_SLOT','PICK_TEACHING','PICK_PRO_ALLIES','REWARD_PICK','UPGRADE_SKILL','WAVE_RESULT','CHAMPION','QUICK_GROWTH','QUICK_JOIN','BATTLE'];
check('ランの画面がひととおり入っている',
  EXPECTED_RUN_SCREENS.every(screen => runScreens.includes(screen)) && runScreens.length === EXPECTED_RUN_SCREENS.length,
  runScreens.join(','));
check('ランを始める前は段階が無く、進行もしない', base.api.read().runStage === null && base.api.read().allowed === false);
check('段階を進めると、いまは画面も必ず一緒に変わる（裏回しはまだOFF）',
  base.api.backgroundAllowed === false
  && runScreens.every(stage => { const e = evaluateWith('HOME'); e.api.advanceRunStage(stage); const r = e.api.read(); return r.runStage === stage && r.gameState === stage && r.allowed === true; }));
check('段階を捨てると進行しなくなる',
  (() => { const e = evaluateWith('HOME'); e.api.advanceRunStage('BATTLE'); e.api.clearRunStage(); return e.api.read().runStage === null && e.api.read().allowed === false; })());
// ランの段階を持ったまま別画面(モンビー等)を描いても、いまは進行しない。
// ★PR4で runBackgroundAllowed を足したら、モンビーの非演奏画面だけがここから外れる。
const OTHER_SCREENS = ['HOME','BATTLE_MENU','PROFILE','MASU_LIST','RHYTHM_DEMO_HOME','RHYTHM_PLAY','RHYTHM_RANKING','EXTREME_DIFFICULTY_SELECT'];
check('ランを始めていない画面では進行しない',
  OTHER_SCREENS.every(screen => evaluateWith(screen).api.read().allowed === false));
// バトル中に別画面(モンビー等)を描いたら、いまは進行が止まる。
// ★PR4を入れたら、モンビーの非演奏画面だけは止まらなくなる
check('ランの段階を持ったまま別画面へ移ると、いまは進行が止まる',
  OTHER_SCREENS.every(screen => {
    const e = evaluateWith('BATTLE');
    e.api.advanceRunStage('BATTLE');
    if (e.api.read().allowed !== true) return false;
    e.api.setScreen(screen);
    return e.api.read().allowed === false;
  }));

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

// ---- ② ランの段階へ直接 setGameState していないこと ----
// ここを直接呼ぶと runStage が置いていかれ、別画面でランが進まなくなる
check('ランの段階へ直接 setGameState していない',
  EXPECTED_RUN_SCREENS.every(stage => !source.includes(`setGameState('${stage}')`)),
  EXPECTED_RUN_SCREENS.filter(stage => source.includes(`setGameState('${stage}')`)).join(','));
check('ランの段階の遷移はすべて advanceRunStage を通っている',
  EXPECTED_RUN_SCREENS.every(stage => source.includes(`advanceRunStage('${stage}')`)));

// ---- 連携(PR4)を入れる前は、裏回しがOFFのまま ----
// runBackgroundAllowed が固定の false でなくなったら連携が入った合図。
// そのときはこの検査を「モンビーの非演奏画面だけ true」へ直す。
check('裏回しはまだOFF（PR4を入れたらこの検査を更新する）',
  definition.includes('const runBackgroundAllowed = false;'));

if (failed) { console.error(`\n${failed}件のNGがあります`); process.exit(1); }
console.log('\nrun stage check passed.');
