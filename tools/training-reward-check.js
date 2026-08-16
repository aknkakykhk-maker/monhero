// WAVEクリアごとの「トレーニング」(旧・能力覚醒)を確認する。
//
//   node tools/training-reward-check.js
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

const root = path.resolve(__dirname, '..');
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
${slice('const applyNightmareWaveEnhancement', 'const ultimateEnemyTurnMultiplier')}
${slice('const TRAINING_PICK_COUNT', '// 整数で扱うバトル値の特殊ルール倍率')}
module.exports={TRAINING_PICK_COUNT,TRAINING_OPTIONS,trainingOptionOf,resolveTrainingStep,resolveTrainingStats};`;
const mod = { exports: {} };
new Function('module', 'exports', calcSrc)(mod, mod.exports);
const T = mod.exports;

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

// ---- ULTIMATEのトレーニング低下(低下率・計算ルールは従来どおり) ----
// 割合は max(0, 効果 - ターン数×0.75%)、固定値は (1 - ターン数/20) で縮む
const ult = (id, t) => T.resolveTrainingStep(base, id, t, 'ULTIMATE');
check('ULTIMATE T=0 は低下しない',
  ult('hp', 0).hp === 600 && ult('atk', 0).atk === 105 && ult('def', 0).def === 120 && ult('guts', 0).guts === 110);
check('ULTIMATE T=10 走り込み 562 (20%→12.5%)', ult('hp', 10).hp === Math.floor(500 * 1.125), String(ult('hp', 10).hp));
check('ULTIMATE T=10 丸太うけ 112 (20%→12.5%)', ult('def', 10).def === Math.floor(100 * 1.125), String(ult('def', 10).def));
check('ULTIMATE T=10 ドミノ倒し 100 (5%→0%で頭打ち)', ult('atk', 10).atk === 100, String(ult('atk', 10).atk));
check('ULTIMATE T=10 猛勉強 102 (+5が半分の+2.5・割合0%)', ult('guts', 10).guts === 102, String(ult('guts', 10).guts));
check('ULTIMATE はターン数が増えるほど下がる(4項目すべて)', WANT.every(w => {
  const at0 = ult(w.id, 0)[w.stat], at20 = ult(w.id, 20)[w.stat];
  return at20 <= at0;
}));
check('ULTIMATE でも同一項目×2は複利',
  T.resolveTrainingStats(base, ['hp', 'hp'], 0, 'ULTIMATE').hp === 720);
check('ULTIMATEの低下率は0.0075のまま', has('awakeningPenaltyRate:0.0075'));

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
    + '  runMode, difficulty, extremeRun, extremeDifficulty, specialRuleDifficultyForRun, resolveTrainingStats, resolveTrainingStep,\n'
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
    specialRuleDifficultyForRun: () => null,
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

  // iPhone縦画面で見切れない作り
  check('縦画面ではみ出さない作りになっている',
    /overflow-y-auto/.test(jsx) && /flex-1 min-h-0/.test(jsx)
      && /env\(safe-area-inset-top\)/.test(jsx) && /env\(safe-area-inset-bottom\)/.test(jsx));
  check('タップ領域を十分にとる(項目・ボタンとも)',
    /min-h-\[112px\]/.test(jsx) && (jsx.match(/min-h-\[52px\]/g) || []).length >= 2);
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
