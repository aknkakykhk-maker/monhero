#!/usr/bin/env node
// ランの進行(runStage)と、いま描いている画面(gameState)の切り分けを検査する。
//
//   node tools/battle/run-stage-check.js
//
// 見ているもの:
//   ① runStage が画面(gameState)とは別のstateとして持たれていること
//   ② ランの段階を変える経路が advanceRunStage の1つだけであること(直接 setGameState しない)
//   ③ ランの進行を回す3つのループが gameState ではなく runStage を見ていること
//   ④ モンビーの非演奏画面ではクイック∞周回が続き、演奏中は止まること
//   ⑤ モンビーを開いている間は、ランが進んでも画面が勝手に切り替わらないこと
//
// docs/spec/QUICK_RHYTHM_LINK.md の PR2〜PR4。ここが崩れると
// 「別画面へ移ってもチャレンジが進む」「バトル画面なのに進まない」
// 「演奏中に画面がバトルへ飛ぶ」「演奏中もバトルが動いてノーツを落とす」
// のどれかが静かに起きる。実際に進むかどうかは
// tools/mode/rhythm-background-run-check.js が実ブラウザで見る。
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
const DEFINITION_END = 'const runProgressAllowed = runStage !== null && (gameState === runStage || rhythmBackgroundRun);';
const definition = slice('const RUN_PHASE_STATES =', DEFINITION_END);
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
check('演奏中(RHYTHM_PLAY)は裏回しの対象に入れていない',
  /const RHYTHM_BACKGROUND_RUN_SCREENS = \[[^\]]*\];/.test(definition)
  && !/const RHYTHM_BACKGROUND_RUN_SCREENS = \[[^\]]*RHYTHM_PLAY/.test(definition));

// ---- ②〜⑤ 本体の式をそのまま動かす ----
// React の useState / useRef は「値をそのまま返す入れ物」に置き換える。
// 本体は1回の描画ぶんの式なので、「その画面・その段階のときにどうなるか」を見るには
// 画面と段階を与えて評価し直す(Reactが再描画で計算し直すのと同じ)。
// 数式を検査へ書き写さないため、read() は本体が作った値をそのまま返す。
const evaluateWith = (initialGameState, { runStage: initialRunStage = null, autoRepeat = true, quick = true } = {}) => {
  const sandbox = { console, useRef: () => ({ current: initialRunStage }) };
  vm.createContext(sandbox);
  vm.runInContext(`let gameState=${JSON.stringify(initialGameState)}; const setGameState=(v)=>{gameState=v;};
const autoRepeat=${autoRepeat}; const runMode=${JSON.stringify(quick ? 'quick' : 'challenge')}; const isQuickMode=(m)=>m==='quick';
${definition.replace('const [runStage, setRunStage] = useState(null);', `let runStage=${JSON.stringify(initialRunStage)}; const setRunStage=(v)=>{runStage=v;};`)}
this.api={ advanceRunStage, clearRunStage, isRunStage, screens:RUN_STAGE_SCREENS, rhythmScreens:RHYTHM_BACKGROUND_RUN_SCREENS,
  read:()=>({ runStage, gameState, allowed: runProgressAllowed,
              backgroundAllowed: runBackgroundAllowed, backgroundRun: rhythmBackgroundRun }) };`, sandbox);
  return sandbox.api;
};
const base = evaluateWith('HOME');
const runScreens = base.screens;
const rhythmScreens = base.rhythmScreens;
const EXPECTED_RUN_SCREENS = ['PICK_HERO','PICK_ALLY','PICK_SLOT','PICK_TEACHING','PICK_PRO_ALLIES','REWARD_PICK','UPGRADE_SKILL','WAVE_RESULT','CHAMPION','QUICK_GROWTH','QUICK_JOIN','BATTLE'];
check('ランの画面がひととおり入っている',
  EXPECTED_RUN_SCREENS.every(screen => runScreens.includes(screen)) && runScreens.length === EXPECTED_RUN_SCREENS.length,
  runScreens.join(','));
check('裏回しの対象はモンビーの非演奏画面だけ',
  rhythmScreens.length > 0 && rhythmScreens.every(screen => screen.startsWith('RHYTHM_') && screen !== 'RHYTHM_PLAY'),
  rhythmScreens.join(','));
check('ランを始める前は段階が無く、進行もしない', base.read().runStage === null && base.read().allowed === false);
// ランの画面を描いているあいだは、段階が変わると画面も一緒に変わる(これまでどおり)
check('ランの画面では、段階を進めると画面も一緒に変わる',
  runScreens.every(stage => { const e = evaluateWith('HOME'); e.advanceRunStage(stage); const r = e.read();
    return r.runStage === stage && r.gameState === stage; }));
// 上の遷移が終わった次の描画にあたる状態(画面=段階)で、進行してよいことを見る
check('ランの画面を描いていれば進行してよい',
  runScreens.every(stage => evaluateWith(stage, { runStage: stage }).read().allowed === true));
check('段階が無ければ進行しない（ランから抜けたあと）',
  runScreens.every(stage => evaluateWith(stage, { runStage: null }).read().allowed === false));

// ---- ④ モンビーの非演奏画面では続き、演奏中は止まる ----
// 「バトル中に、その画面を描いている」状態をそのまま作って評価する
const withRunOn = (screen, options = {}) => evaluateWith(screen, { runStage: 'BATTLE', ...options });
check('モンビーの非演奏画面ではクイック∞周回が続く',
  rhythmScreens.every(screen => withRunOn(screen).read().allowed === true), rhythmScreens.join(','));
check('演奏中(RHYTHM_PLAY)は止まる', withRunOn('RHYTHM_PLAY').read().allowed === false);
check('∞周回でなければ裏では回さない', withRunOn('RHYTHM_DEMO_HOME', { autoRepeat: false }).read().allowed === false);
check('クイック以外(チャレンジ・プロ・極限・種族)は裏では回さない',
  withRunOn('RHYTHM_DEMO_HOME', { quick: false }).read().allowed === false);
check('モンビー以外の画面(HOME・プロフィール等)では止まる',
  ['HOME','BATTLE_MENU','PROFILE','MASU_LIST','EXTREME_DIFFICULTY_SELECT']
    .every(screen => withRunOn(screen).read().allowed === false));

// ---- ⑤ モンビーを開いている間は画面が勝手に切り替わらない ----
check('モンビーを開いている間は、ランが進んでも画面が切り替わらない',
  [...rhythmScreens, 'RHYTHM_PLAY'].every(screen => {
    const e = withRunOn(screen);
    e.advanceRunStage('WAVE_RESULT');
    const r = e.read();
    return r.runStage === 'WAVE_RESULT' && r.gameState === screen;
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
check('ランの段階へ直接 setGameState していない',
  EXPECTED_RUN_SCREENS.every(stage => !source.includes(`setGameState('${stage}')`)),
  EXPECTED_RUN_SCREENS.filter(stage => source.includes(`setGameState('${stage}')`)).join(','));
check('ランの段階の遷移はすべて advanceRunStage を通っている',
  EXPECTED_RUN_SCREENS.every(stage => source.includes(`advanceRunStage('${stage}')`)));

// ---- 動線と音 ----
check('∞周回中のバトルからモンビーへ移れる（returnToHomeを通さない）',
  source.includes('data-quick-to-rhythm') && source.includes('onClick={openRhythmDemo}'));
check('モンビーからクイックのバトルへ戻れる',
  source.includes('const returnToBackgroundRun = () => { if (runStageRef.current) setGameState(runStageRef.current); };')
  && source.includes('data-rhythm-back') && source.includes('if(rhythmBackgroundRun){returnToBackgroundRun();return;}'));
check('モンビーを開いている間はバトルのSEを鳴らさない',
  source.includes('Audio_.setSeVolume((ultraEcoSession || rhythmScreenOpen) ? 0 : seVolume);'));

if (failed) { console.error(`\n${failed}件のNGがあります`); process.exit(1); }
console.log('\nrun stage check passed.');
