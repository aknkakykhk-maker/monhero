const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// WAVEクリアごとの「トレーニング」(旧・能力覚醒)を確認する。
//
//   node tools/run/training-reward-check.js
//
// 見ているもの:
//   ① 4項目の定義と効果量
//   ② 実際の計算関数を本体から取り出して動かし、4種すべての値・同一項目2回の複利・
//      異なる2項目・ULTIMATEのトレーニング低下・NIGHTMAREを数値で確かめる
//   ③ 画面(2回そろうまで決定できない・×1/×2の表示・選び直せる)をSSRで確かめる
//   ④ クイックモードがこの画面を通らないこと
//   ⑤ 旧名称がユーザー向け表示に残っていないこと
const fs = require('fs');
const path = require('path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const babel = require('@babel/core');
const PRESET_REACT = require.resolve('@babel/preset-react');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const help = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const assistants = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
const changelog = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const slice = (from, to) => {
  const i = source.indexOf(from);
  const j = source.indexOf(to, i);
  return i >= 0 && j > i ? source.slice(i, j) : '';
};

// ---- ② 本体の計算をそのまま動かす(式を書き写さないので、実装が変われば必ずここに出る) ----
const calcSrc = `
const ULTIMATE_SETTING={id:'ULTIMATE',specialRules:{awakeningPenaltyRate:0.0075}};
const extremeSpecialRule=(d,r)=>(d==='NIGHTMARE'&&r==='waveEnhancement')?0.5:1;
// トレーニング低下は難易度名ではなく「その難易度がawakeningZeroTurnsを持つか」で効く。
// ここではULTIMATE / INFINITYだけが持つ状態を再現する(本体の表と同じ20T)。
const extremeRuleNumber=(d,r)=>(['ULTIMATE','INFINITY'].includes(d)&&r==='awakeningZeroTurns')?20:null;
${slice('const applyNightmareWaveEnhancement', 'const ultimateEnemyTurnMultiplier')}
${slice('// トレーニングで「上がる量」へ掛かる倍率', '// 整数で扱うバトル値の特殊ルール倍率')}
module.exports={TRAINING_PICK_COUNT,TRAINING_OPTIONS,chooseAutoTrainingPicks,trainingOptionOf,resolveTrainingStep,resolveTrainingStats,trainingGainRate};`;
const mod = { exports: {} };
new Function('module', 'exports', calcSrc)(mod, mod.exports);
const T = mod.exports;

// ---- AUTO方針 ----
check('AUTO randomは固定rngで再現可能な2個を返す',
  JSON.stringify(T.chooseAutoTrainingPicks('random',()=>0.26))===JSON.stringify(['atk','atk']));
check('AUTO randomは同じ項目を2回選べる',
  JSON.stringify(T.chooseAutoTrainingPicks('invalid',()=>0.99))===JSON.stringify(['guts','guts']));
check('AUTO offenseは atk + guts', JSON.stringify(T.chooseAutoTrainingPicks('offense'))===JSON.stringify(['atk','guts']));
check('AUTO defenseは hp + def', JSON.stringify(T.chooseAutoTrainingPicks('defense'))===JSON.stringify(['hp','def']));
check('AUTO gutsは guts + guts', JSON.stringify(T.chooseAutoTrainingPicks('guts'))===JSON.stringify(['guts','guts']));
check('AUTO helperはReact stateや確定処理を呼ばない',
  !/setTrainingPicks|setGameState|handleTraining/.test(slice('const chooseAutoTrainingPicks', 'const trainingOptionOf')));

// ---- ① 定義 ----
check('4項目から2回選ぶ', T.TRAINING_PICK_COUNT === 2 && T.TRAINING_OPTIONS.length === 4,
  `${T.TRAINING_OPTIONS.length}項目 / ${T.TRAINING_PICK_COUNT}回`);
const WANT = [
  { id: 'hp', name: '走り込み', stat: 'hp', flat: 0, rate: 0.20 },
  { id: 'atk', name: 'ドミノ倒し', stat: 'atk', flat: 0, rate: 0.05 },
  { id: 'def', name: '丸太うけ', stat: 'def', flat: 0, rate: 0.20 },
  { id: 'guts', name: '猛勉強', stat: 'guts', flat: 5, rate: 0.05 },
];
for (const w of WANT) {
  const o = T.trainingOptionOf(w.id);
  check(`${w.name}: ${w.stat} +${w.rate * 100}%${w.flat ? ` (先に+${w.flat})` : ''}`,
    !!o && o.name === w.name && o.stat === w.stat && o.flat === w.flat && Math.abs(o.rate - w.rate) < 1e-9,
    o ? `${o.name} ${o.stat} flat=${o.flat} rate=${o.rate}` : '定義なし');
}

// ---- 4種すべての計算 ----
const base = { atk: 100, def: 100, hp: 500, guts: 100 };
const one = (id, d = null, t = 0) => T.resolveTrainingStep(base, id, t, d);
check('走り込み ライフ500→600', one('hp').hp === 600, String(one('hp').hp));
check('ドミノ倒し ちから100→105', one('atk').atk === 105, String(one('atk').atk));
check('丸太うけ 丈夫さ100→120', one('def').def === 120, String(one('def').def));
check('猛勉強 ガッツ100→110 (+5してから+5%)', one('guts').guts === 110, String(one('guts').guts));
check('選んだ項目以外は変わらない',
  one('hp').atk === 100 && one('hp').def === 100 && one('hp').guts === 100);

// ---- 同一項目×2 は複利(2回分の単純加算にしない) ----
const twice = (id, d = null, t = 0) => T.resolveTrainingStats(base, [id, id], t, d);
check('走り込み×2 は 500→600→720 (単純加算の700ではない)',
  twice('hp').hp === 720, `${twice('hp').hp} / 単純加算なら${Math.floor(500 * 1.4)}`);
check('丸太うけ×2 は 100→120→144',
  twice('def').def === 144, String(twice('def').def));
check('猛勉強×2 は 100→110→120 (毎回 +5 してから +5%)',
  twice('guts').guts === 120, String(twice('guts').guts));
check('ドミノ倒し×2 は 100→105→110',
  twice('atk').atk === 110, String(twice('atk').atk));

// ---- 異なる2項目 ----
const mixed = T.resolveTrainingStats(base, ['hp', 'atk'], 0, null);
check('異なる2項目はそれぞれに効く', mixed.hp === 600 && mixed.atk === 105, JSON.stringify(mixed));
check('別ステータスなら選ぶ順で結果が変わらない',
  JSON.stringify(T.resolveTrainingStats(base, ['atk', 'hp'], 0, null)) === JSON.stringify(mixed));

// ---- ULTIMATE / INFINITY のトレーニング低下 ----
// 低下は「増えるぶん」へ掛ける(率から引かない)。率から引いていたころは
// ちから+5%・ガッツ+5%だけが7ターンで増加0になり、+20%の2項目と差が開きすぎていた。
const ult = (id, t) => T.resolveTrainingStep(base, id, t, 'ULTIMATE');
const gainOf = (id, t, d) => T.resolveTrainingStep(base, id, t, d)[T.trainingOptionOf(id).stat] - base[T.trainingOptionOf(id).stat];
check('ULTIMATE T=0 は低下しない',
  ult('hp', 0).hp === 600 && ult('atk', 0).atk === 105 && ult('def', 0).def === 120 && ult('guts', 0).guts === 110);
check('低下倍率は 1 - ターン数/20（1Tごと-5%・20Tでちょうど0）', [[0, 1], [1, 0.95], [10, 0.5], [19, 0.05], [20, 0], [30, 0]]
  .every(([turns, want]) => Math.abs(T.trainingGainRate(turns, 'ULTIMATE') - want) < 1e-9),
  `10T=${T.trainingGainRate(10, 'ULTIMATE')} / 20T=${T.trainingGainRate(20, 'ULTIMATE')}`);
check('4項目すべてが同じ倍率で目減りする(率の小さい項目だけ先に0にならない)', WANT.every(w => {
  const normal = gainOf(w.id, 10, null), effective = gainOf(w.id, 10, 'ULTIMATE');
  return effective === Math.floor(normal * 0.5);
}), WANT.map(w => `${w.name} ${gainOf(w.id, 10, null)}→${gainOf(w.id, 10, 'ULTIMATE')}`).join(' / '));
check('ちから+5%が10ターンでも増える(以前は7ターンで0だった)', gainOf('atk', 10, 'ULTIMATE') > 0, `+${gainOf('atk', 10, 'ULTIMATE')}`);
check('ガッツ+5%が10ターンでも増える', gainOf('guts', 10, 'ULTIMATE') > 0, `+${gainOf('guts', 10, 'ULTIMATE')}`);
check('20ターンかかると4項目とも増えない', WANT.every(w => gainOf(w.id, 20, 'ULTIMATE') === 0));
check('INFINITYもULTIMATEと同じ低下になる',
  WANT.every(w => gainOf(w.id, 12, 'INFINITY') === gainOf(w.id, 12, 'ULTIMATE')));
check('ULTIMATE はターン数が増えるほど下がる(4項目すべて)', WANT.every(w => {
  const at0 = ult(w.id, 0)[w.stat], at20 = ult(w.id, 20)[w.stat];
  return at20 <= at0;
}));
check('ULTIMATE でも同一項目×2は複利',
  T.resolveTrainingStats(base, ['hp', 'hp'], 0, 'ULTIMATE').hp === 720);
check('トレーニングが0になるターン数は20', has('awakeningZeroTurns:20'));
// クイックの自動成長は成長率そのものから引く別計算。今回のトレーニング修正で巻き込まない
check('クイック自動成長の低下率0.0075はそのまま', has('awakeningPenaltyRate:0.0075'));

// ---- NIGHTMARE(増えたぶんが半分) ----
check('NIGHTMARE 走り込み 550 (増分100の半分)',
  T.resolveTrainingStep(base, 'hp', 0, 'NIGHTMARE').hp === 550,
  String(T.resolveTrainingStep(base, 'hp', 0, 'NIGHTMARE').hp));

// ---- ④ クイックモードは通らない ----
check('クイックはトレーニング画面へ行かず自動成長する',
  has('} else if (isQuickMode(runMode)) {') && has('beginQuickGrowth();'));
check('トレーニングを開くのはクイック以外の分岐だけ',
  (source.match(/setGameState\('REWARD_PICK'\)/g) || []).length === 1);
check('開くたびに前回の選択を空へ戻す', has('setTrainingPicks([]);\n      setGameState(\'REWARD_PICK\');'));
const rewardAuto = slice("    if(gameState==='REWARD_PICK'){", "    if(gameState==='PICK_ALLY'){");
check('AUTO OFFではREWARD_PICKを自動処理しない', rewardAuto.includes('if(!autoBattleRef.current)return;'));
check('AUTO ONのREWARD_PICKは専用ロックで1回だけ処理する',
  has('const autoPostWaveRunningRef = useRef(false);') && has('const autoPostWaveScheduledRef = useRef(false);')
    && rewardAuto.includes('autoPostWaveRunningRef.current=false;')
    && rewardAuto.includes('autoPostWaveScheduledRef.current=false;')
    && rewardAuto.includes('if(!autoBattleRef.current||autoPostWaveRunningRef.current)return;')
    && rewardAuto.includes('autoPostWaveRunningRef.current=true;'));
check('AUTOトレーニングは決めたpicksをhandleTrainingへ直接渡す',
  /const picks=chooseAutoTrainingPicks\(autoSettings\.strategy\);\s*handleTraining\(picks\);/.test(rewardAuto));
check('AUTO後も供モン等の既存遷移を自動選択しない',
  !slice('// AUTO中にREWARD_PICKへ入ったときだけ', 'const upgradeUnique').includes("setGameState('PICK_ALLY')"));

// ---- ③ 画面 ----
const START = "      {gameState==='REWARD_PICK'&&(()=>{";
const END = '      {/* HELP */}';
const from = source.indexOf(START), to = source.indexOf(END, from);
check('トレーニング画面のJSXを切り出せる', from >= 0 && to > from);
if (from >= 0 && to > from) {
  const jsx = source.slice(from, to);
  check('決定は2つそろうまで押せない作りになっている', /disabled=\{!ready\|\|!!effect\}/.test(jsx));
  check('確定するまで選び直せる', jsx.includes('setTrainingPicks([])') && jsx.includes('選び直す'));
  const transformed = babel.transformSync(
    'const Screen = ({ gameState, trainingPicks, setTrainingPicks, atk, def, maxHp, maxGuts, waveResult, effect,\n'
    + '  runMode, difficulty, extremeRun, extremeDifficulty, specialRuleDifficultyForRun, resolveTrainingStats, resolveTrainingStep, ULTIMATE_SETTING, extremeRuleNumber, trainingGainRate, compactPercent, specialRulePercent, extremeSpecialRule, quickGrowthRateForRun, isQuickMode,\n'
    + '  TRAINING_PICK_COUNT, TRAINING_OPTIONS, handleTraining, AssistantBubble, battleTutorialSpotClass,\n'
    + '  Trophy, Heart, Sword, ShieldCheck, Sparkles }) => (<>\n'
    + jsx + '\n</>);\nmodule.exports = { Screen };',
    { presets: [[PRESET_REACT, { runtime: 'classic' }]], filename: 'training-reward-check.jsx' });
  const scope = { exports: {} };
  new Function('module', 'exports', 'React', transformed.code)(scope, scope.exports, React);
  const Icon = (name) => () => React.createElement('i', { 'data-icon': name });
  const render = (picks) => ReactDOMServer.renderToStaticMarkup(React.createElement(scope.exports.Screen, {
    gameState: 'REWARD_PICK', trainingPicks: picks, setTrainingPicks: () => {},
    atk: 100, def: 100, maxHp: 500, maxGuts: 100, waveResult: { turn: 0 }, effect: null,
    runMode: 'challenge', difficulty: 'Normal', extremeRun: false, extremeDifficulty: null,
    specialRuleDifficultyForRun: () => null, ULTIMATE_SETTING: { id: 'ULTIMATE' }, compactPercent: value => `${Number((value*100).toFixed(1))}%`,
    // トレーニング低下は難易度名ではなく specialRules の有無で効く。通常チャレンジなので常にnull
    extremeRuleNumber: () => null, trainingGainRate: T.trainingGainRate, specialRulePercent: value => `${Math.round(value*100)}%`,
    extremeSpecialRule: () => 1, quickGrowthRateForRun: () => 0.1, isQuickMode: () => false,
    resolveTrainingStats: T.resolveTrainingStats, resolveTrainingStep: T.resolveTrainingStep,
    TRAINING_PICK_COUNT: T.TRAINING_PICK_COUNT, TRAINING_OPTIONS: T.TRAINING_OPTIONS,
    handleTraining: () => {}, AssistantBubble: () => null, battleTutorialSpotClass: () => '',
    Trophy: Icon('trophy'), Heart: Icon('heart'), Sword: Icon('sword'), ShieldCheck: Icon('shield'), Sparkles: Icon('sparkles'),
  }));
  const text = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const empty = render([]);
  check('画面が落ちずに描ける', empty.length > 0);
  check('タイトルがトレーニング', text(empty).includes('トレーニング'));
  check('「4種類から2つ選ぶ」と分かる', text(empty).includes('4種類から2つ選ぶ'));
  check('4項目すべてが並ぶ', WANT.every(w => text(empty).includes(w.name)));
  check('各項目に効果が出る', text(empty).includes('ライフ +20%') && text(empty).includes('ガッツ +5 ＆ +5%'));
  check('現在値→強化後の値が出る', text(empty).includes('500') && text(empty).includes('600'));
  check('0個のときは決定できない', /disabled=""[^>]*>あと2つ選ぶ|あと2つ選ぶ/.test(empty) && text(empty).includes('あと2つ選ぶ'));
  check('選んだ数が 0 / 2 と出る', text(empty).includes('0 / 2'));

  const onePick = render(['hp']);
  check('1個でもまだ決定できない', text(onePick).includes('あと1つ選ぶ') && !text(onePick).includes('決定する'));
  check('選んだ項目に ×1 が付く', text(onePick).includes('×1'));
  check('1個選ぶと次の予測が伸びた値からになる', text(onePick).includes('600') && text(onePick).includes('720'));

  const twoSame = render(['hp', 'hp']);
  check('同じ項目を2回選ぶと ×2 が付く', text(twoSame).includes('×2'));
  check('2個そろうと決定できる', text(twoSame).includes('決定する'));
  check('選んだ数が 2 / 2 と出る', text(twoSame).includes('2 / 2'));
  const twoMixed = render(['hp', 'atk']);
  check('異なる2項目でも決定できる', text(twoMixed).includes('決定する'));

  // 4ステータスの現在値と変動値を上部にまとめて出す(下に余白が余らないよう画面を埋める)
  check('4ステータスの現在値をまとめて出す欄がある', jsx.includes('data-training-status'));
  check('その欄に4項目すべてのステータス名が出る',
    ['ライフ', 'ちから', '丈夫さ', 'ガッツ'].every(n => text(render([])).includes(n)));
  check('選ぶ前は増減が ±0 と出る', text(render([])).includes('±0'));
  check('選ぶと増えた量が +n で出る', /\+\d/.test(text(render(['hp', 'hp']))));
  check('4項目は2列2行で画面を埋める(下に余白を残さない)',
    /grid-cols-2 grid-rows-2/.test(jsx) && !/content-start/.test(jsx));
  check('×2バッジは枠の内側に置く(スクロール上端で見切れない)',
    /absolute top-1\.5 right-1\.5/.test(jsx) && !/-top-2 -right-2/.test(jsx));

  // iPhone縦画面で見切れない作り
  check('縦画面ではみ出さない作りになっている',
    /overflow-y-auto/.test(jsx) && /flex-1 min-h-0/.test(jsx)
      && /env\(safe-area-inset-top\)/.test(jsx) && /env\(safe-area-inset-bottom\)/.test(jsx));
  check('タップ領域を十分にとる(項目・ボタンとも)',
    /min-h-\[112px\]/.test(jsx) && (jsx.match(/min-h-\[52px\]/g) || []).length >= 2);
  check('ULTIMATE補正の表示は実処理と同じ低下倍率を使う（別計算を作っていない）',
    jsx.includes('data-ultimate-training-status') && jsx.includes('trainingGainRate(turns,specialRule)')
    && !/強化効果 -\{[^}]*0\.0075/.test(jsx));
  check('各項目の通常値と実効値もresolveTrainingStepで比較する', jsx.includes('normalAfter=resolveTrainingStep') && jsx.includes('effectiveAfter=resolveTrainingStep'));
}

// ---- 「トレーニング完了」への遷移 ----
check('決定後は「トレーニング完了」を出す', has('"トレーニング完了"'));
check('旧「能力覚醒完了」が残っていない', !has('能力覚醒完了'));

// ---- ⑤ ユーザー向け表示に旧名称を残さない ----
for (const [label, text] of [['ヘルプ', help], ['助手コメント', assistants]]) {
  check(`${label}に旧名称(能力覚醒/攻撃覚醒/防御覚醒/精神強化)が残っていない`,
    !/能力覚醒|攻撃覚醒|防御覚醒|精神強化/.test(text));
}
check('本体のユーザー向け表示に旧名称が残っていない',
  !/能力覚醒低下|攻撃覚醒|防御覚醒|精神強化|覚醒完了/.test(source));
check('ヘルプがトレーニングの4項目を説明している',
  ['走り込み', 'ドミノ倒し', '丸太うけ', '猛勉強'].every(n => help.includes(n)));
check('ヘルプが同じ項目を2回選べることを説明している', help.includes('同じものを2回選べます'));
check('ヘルプがクイックには無いことを説明している', help.includes('クイックモードにはトレーニングがありません'));
check('更新履歴に書いてある', /トレーニング/.test(changelog) && changelog.includes('走り込み'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
