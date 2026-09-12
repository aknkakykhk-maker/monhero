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
  && definition.includes('if (!runBackgroundAllowedRef.current) setGameState(stage);'));
// ★ここを値で読むと、setTimeout や await の後から呼ばれたときに
//   「バトル画面で作られたときの古い値」を掴み、モンビーへ移った直後に敵を倒した瞬間
//   画面がバトルへ飛び戻る(2026-09-06に実際に出た不具合)
check('advanceRunStage は呼ばれた時点の値(ref)で画面を切り替えるか決める',
  definition.includes('const runBackgroundAllowedRef = useRef(false);')
  && definition.includes('runBackgroundAllowedRef.current = runBackgroundAllowed;')
  && !/if \(!runBackgroundAllowed\) setGameState/.test(definition));
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
  // useRef は「初期値を持つただの入れ物」。runStageRef には段階を、
  // runBackgroundAllowedRef には本体が描画のたびに入れ直す値がそのまま入る
  const sandbox = { console, useRef: (init) => ({ current: init === undefined ? initialRunStage : init }) };
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
// ★期待する画面は**この検査の側に書き下す**。実装の一覧(rhythmScreens)から作ると、
//   実装から漏れた画面はここでも漏れるので、漏れそのものを見つけられない。
//   実際に 2026-09-12 まで RHYTHM_OPTIONS が漏れていて、
//   「モンビー中にオプションに行くとたまに強制でバトルに飛ばされる」が起きていた。
const EXPECTED_RHYTHM_SCREENS = ['RHYTHM_DEMO_HOME','RHYTHM_DEMO_HELP','RHYTHM_DEMO_MONSTERS',
  'RHYTHM_RANKING','RHYTHM_OPTIONS','RHYTHM_PLAY','RHYTHM_INFO','RHYTHM_DEBUG'];
check('モンビーを開いている間は、ランが進んでも画面が切り替わらない',
  EXPECTED_RHYTHM_SCREENS.every(screen => {
    const e = withRunOn(screen);
    e.advanceRunStage('WAVE_RESULT');
    const r = e.read();
    return r.runStage === 'WAVE_RESULT' && r.gameState === screen;
  }),
  EXPECTED_RHYTHM_SCREENS.join(','));
// ★一覧ではなく頭文字で見る作りにしてある。これならモンビーへ画面を足しても漏れない
check('モンビーにいるかどうかは一覧ではなく gameState の頭で見る（画面を足しても漏れない）',
  definition.includes("const isRhythmScreen = state => typeof state === 'string' && state.startsWith('RHYTHM_');")
  && definition.includes('const rhythmScreenOpen = isRhythmScreen(gameState);'));
check('オプション(RHYTHM_OPTIONS)でも裏の周回が続く',
  rhythmScreens.includes('RHYTHM_OPTIONS')
  && withRunOn('RHYTHM_OPTIONS').read().allowed === true);

// ---- ③ 進行を回す3つのループが runStage を見ている ----
const hasBareGameState = (text) => /[^a-zA-Z]gameState[^a-zA-Z]/.test(text);
// effect の切り出しは「本文の先頭 → 依存配列の閉じ括弧」で行う。
// 依存名を終端に使うと、条件を1つ足しただけで切り出せなくなる(実際にそうなった)
const effectFrom = (head, depsHead) => {
  const start = source.indexOf(head);
  const deps = source.indexOf(depsHead, start);
  const end = source.indexOf(']);', deps);
  if (start < 0 || deps < 0 || end < 0) throw new Error(`本体から切り出せません: ${head.slice(0, 40)}`);
  return source.slice(start, end + 3);
};
const championLoop = effectFrom('    if(!runProgressAllowed||runStage!==\'CHAMPION\'', '},[runStage,');
// ★gameState を見てよいのは「その画面を描いているか」の判定だけ。
//   進行そのものの判定に使うと、別の画面へ移った瞬間にランが止まる。
//   CHAMPIONの報酬演出の完了は画面を描いたときしか立たないので、
//   「描いていれば演出を待ち、描いていなければ保存の完了を待つ」の1行だけ gameState を使う
//   (2026-09-07・モンビーを開いたままだと次の周へ入れなかった件の直し)。
//   その1行を外したうえで、進行の判定に gameState が残っていないことを見る
// 依存配列(`},[…]);`)は「何が変わったら考え直すか」の並びで、進行の判定ではない。
// 条件で使うものは必ずここへ書くので、本文だけを見る
const championLoopBody = championLoop.slice(0, championLoop.indexOf('},['));
const championLoopProgress = championLoopBody.replace(/\n\s*if\(gameState==='CHAMPION'\?[^\n]*/, '');
check('次周開始のループが runStage を見ている', !hasBareGameState(championLoopProgress),
  hasBareGameState(championLoopProgress) ? 'gameStateが残っています' : '');
check('演出の完了を待つのは、その画面を描いているときだけ',
  championLoop.includes("if(gameState==='CHAMPION'? !championPresentationComplete : resultProcessing)return;"));

const turnLoopStart = source.indexOf('    const blocked=!runProgressAllowed||runStage!==\'BATTLE\'');
// 終端は依存配列の閉じ括弧。中身に足す条件が増えても切り出しがずれないよう、
// 特定の依存名ではなく「最初に現れる ]);」で区切る
const turnLoopEnd = source.indexOf(']);', turnLoopStart);
const turnLoop = turnLoopStart > 0 && turnLoopEnd > turnLoopStart ? source.slice(turnLoopStart, turnLoopEnd + 3) : null;
check('ターン進行のループが runStage を見ている', turnLoop !== null && !hasBareGameState(turnLoop),
  turnLoop === null ? 'ループを切り出せません' : (hasBareGameState(turnLoop) ? 'gameStateが残っています' : ''));

const postWaveLoop = effectFrom('  // AUTO中にWAVE後の画面へ入ったときだけ、各画面の既存handlerを1回だけ呼んで進める。', '},[autoBattle,');
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
// 中身が増えても落ちないよう、1行そのままではなく「段階へ戻していること」を見る
check('モンビーからクイックのバトルへ戻れる',
  /const returnToBackgroundRun = \(\) => \{[\s\S]{0,300}?if \(runStageRef\.current\) setGameState\(runStageRef\.current\);/.test(source)
  && source.includes('data-rhythm-back') && source.includes('if(rhythmBackgroundRun){returnToBackgroundRun();return;}'));
check('モンビーを開いている間はバトルのSEを鳴らさない',
  source.includes('Audio_.setSeVolume((ultraEcoSession || rhythmScreenOpen) ? 0 : seVolume);'));

if (failed) { console.error(`\n${failed}件のNGがあります`); process.exit(1); }
console.log('\nrun stage check passed.');
