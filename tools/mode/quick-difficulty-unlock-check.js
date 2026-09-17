// クイックモードの難易度解放の条件。
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const pick = (pattern, name) => {
  const found = source.match(pattern);
  if (!found) throw new Error(`${name}が見つかりません`);
  return found[0];
};
// 難易度の並び(弱い→強い)は QUICK_DIFFICULTY_SETTINGS のキー順が正本。
// 実装が「上の難易度をクリアしていれば下も開く」を正しく判定できているかを見るため、
// 表そのものをソースから作って渡す(手で並びを書き写すと、難易度が増えたとき検査だけ古くなる)。
const settingKeys = (pattern, name) => {
  const body = pick(pattern, name);
  return [...body.matchAll(/^ {2}([A-Za-z_]\w*):/gm)].map(hit => hit[1]);
};
const difficultyOrder = [
  ...settingKeys(/const DIFFICULTY_SETTINGS = \{[\s\S]*?\n\};\n/, '通常難易度の一覧'),
  ...settingKeys(/const QUICK_EXTREME_SETTINGS = Object\.freeze\(\{[\s\S]*?\n\}\);\n/, 'クイックの極限難易度の一覧'),
];
assert(difficultyOrder[0] === 'Beginner' && difficultyOrder[difficultyOrder.length - 1] === 'GOD',
  '難易度の並びが Beginner で始まり GOD で終わる');
assert(difficultyOrder.indexOf('Easy') < difficultyOrder.indexOf('Master')
  && difficultyOrder.indexOf('Master') < difficultyOrder.indexOf('Legend')
  && difficultyOrder.indexOf('Legend') < difficultyOrder.indexOf('EXTREME'),
  '難易度の並びが弱い順になっている');
const context = { QUICK_DIFFICULTY_SETTINGS:Object.fromEntries(difficultyOrder.map(id => [id, {}])) };
vm.createContext(context);
vm.runInContext([
  pick(/const isQuickDifficultyCleared = [\s\S]*?;\n/, 'クイック難易度のクリア判定'),
  pick(/const quickDifficultiesAtOrAbove = [\s\S]*?\n\};\n/, 'クイック難易度の並び取り出し'),
  pick(/const isQuickDifficultyUnlocked = [\s\S]*?;\n/, 'クイック難易度の解放判定'),
  'globalThis.checkUnlock=isQuickDifficultyUnlocked;',
].join(''), context);
const unlocked = context.checkUnlock;
const empty = {};

assert(unlocked('Master', { Master: 1 }, empty, empty), 'チャレンジのみの同難易度クリアで解放される');
assert(unlocked('Master', empty, { Master: 1 }, empty), 'プロのみの同難易度クリアで解放される');
assert(unlocked('Master', empty, empty, { Master: 1 }), '極限のみの同難易度クリアで解放される');
assert(!unlocked('Master', empty, empty, empty), '全モード未クリアなら未解放になる');
assert(!unlocked('Master', { Hard: 1 }, { Expert: 1 }, empty), '下の難易度のクリアでは上の難易度が解放されない');
// 上をクリアした人に、下をわざわざ踏ませない(2026-09-12・ユーザー指摘)
assert(unlocked('Easy', { Master: 1 }, empty, empty), '上の難易度をクリアしていれば下の難易度も解放される');
assert(unlocked('Beginner', empty, { Legend: 1 }, empty), 'プロの上位クリアでも下の難易度が解放される');
assert(unlocked('Legend', empty, empty, { ULTIMATE: 1 }), '極限の最上位クリアで通常難易度も解放される');
assert(!unlocked('Legend', { Master: 1 }, { Expert: 1 }, empty), 'Legendは下の難易度のクリアでは解放されない');
assert(!unlocked('NoSuchDifficulty', { Legend: 1 }, empty, empty), '表に無い難易度は自分自身のクリアだけを見る');
assert(unlocked('NoSuchDifficulty', { NoSuchDifficulty: 1 }, empty, empty), '表に無い難易度も同難易度クリアなら解放される');
assert(unlocked('Legend', { Legend: '2' }, empty, empty), '保存値を数値として正規化して判定する');
assert(!unlocked('Legend', { Legend: 'broken' }, empty, empty), '壊れた保存値では解放されない');
assert(unlocked('EXTREME', { EXTREME: 1 }, empty, empty), 'チャレンジのEXTREMEクリアでクイックEXTREMEが解放される');
assert(unlocked('EXTREME', empty, { EXTREME: 1 }, empty), 'プロのEXTREMEクリアでクイックEXTREMEが解放される');
assert(unlocked('EXTREME', empty, empty, { EXTREME: 1 }), '極限のEXTREMEクリアでクイックEXTREMEが解放される');
assert(unlocked('NIGHTMARE', empty, empty, { NIGHTMARE: 1 }), '極限のNIGHTMAREクリアでクイックNIGHTMAREが解放される');
assert(!unlocked('NIGHTMARE', { EXTREME: 1 }, { EXTREME: 1 }, { EXTREME: 1 }), 'EXTREMEクリアではNIGHTMAREが解放されない');
assert(unlocked('EXTREME', empty, empty, { CHAOS: 1 }), 'CHAOSクリアで下のEXTREMEも解放される');
assert(unlocked('CHAOS', empty, empty, { CHAOS: 1 }), '極限のCHAOSクリアでクイックCHAOSが解放される');
assert(!unlocked('CHAOS', empty, empty, { NIGHTMARE: 1 }), 'NIGHTMAREクリアではクイックCHAOSが解放されない');
assert(unlocked('ULTIMATE', empty, empty, { ULTIMATE: 1 }), '極限の同難易度ULTIMATEクリアでクイックULTIMATEが解放される');
assert(!unlocked('ULTIMATE', empty, empty, { CHAOS: 1 }), 'CHAOSクリアだけではクイックULTIMATEが解放されない');
assert(unlocked('INFINITY', empty, empty, { INFINITY: 1 }), '極限の同難易度INFINITYクリアでクイックINFINITYが解放される');
assert(!unlocked('INFINITY', empty, empty, { ULTIMATE: 1 }), 'ULTIMATEクリアだけではクイックINFINITYが解放されない');
assert(unlocked('GOD', empty, empty, { GOD: 1 }), '極限の同難易度GODクリアでクイックGODが解放される');
assert(!unlocked('GOD', empty, empty, { INFINITY: 1 }), 'INFINITYクリアだけではクイックGODが解放されない');
assert(unlocked('ULTIMATE', empty, empty, { GOD: 1 }), '上位のGODクリアで下のクイックULTIMATEも解放される');
assert(source.includes('extremeDifficultyClears[d] = await storeGet(extremeClearCountKey(d), 0, false);'), '既存の極限クリア保存キーを読む');
assert(source.includes('Object.keys(QUICK_DIFFICULTY_SETTINGS).map(async d =>'), '極限2難易度を含む既存クリア記録を読む');
assert(source.includes("EXTREME: { label:'EXTREME', power:EXTREME_SETTING.power, xp:20, gold:4.5, psyche:30"), 'EXTREMEのクイック基準報酬が正しい');
assert(source.includes("NIGHTMARE: { label:'NIGHTMARE', power:NIGHTMARE_SETTING.power, xp:25, gold:6, psyche:40"), 'NIGHTMAREのクイック基準報酬が正しい');
assert(source.includes("CHAOS: { label:'CHAOS', power:CHAOS_SETTING.power, xp:30, gold:9, psyche:50"), 'CHAOSのクイック基準報酬が正しい');
assert(source.includes("label:'ULTIMATE', power:ULTIMATE_SETTING.power, xp:35, gold:12, psyche:60"), 'ULTIMATEのクイック基準報酬が正しい');
// INFINITY・GOD(2026-09-13・ユーザーが決めた案A)。経験値は+5刻み、ダイヤは極限本体の0.6倍、
// 虹のプシュケーは極限本体と同値。クイックの1.5倍補正は実装側でかかる。
assert(source.includes("INFINITY: { label:'INFINITY', power:INFINITY_SETTING.power, xp:40, gold:18, psyche:80"), 'INFINITYのクイック基準報酬が正しい');
assert(source.includes("GOD: { label:'GOD', power:GOD_SETTING.power, xp:45, gold:24, psyche:100"), 'GODのクイック基準報酬が正しい');
// 極限本体の定義を引くだけにして、敵強度をクイック側へ書き写さない
assert(!/QUICK_EXTREME_SETTINGS[\s\S]{0,700}power:\s*\d/.test(source), 'クイックの敵強度は極限本体の定義を参照する');
assert(source.includes("key==='EXTREME'?'―― 極限難易度 ――':'BATTLE DIFFICULTY'"), 'Legendの次のEXTREMEカードに極限難易度の区切りを表示する');
assert(source.includes('disabled={(pro&&!proReady)||!quickUnlocked'), 'クイックだけに解放条件を適用する');

// ===== AUTO設定「モンヒロビート中に回すクイック周回」の難易度 =====
// 2026-09-14・ユーザー指摘「モンビーとのクイック連携でオート難易度設定の条件が
//   チャレンジや極限クリアになってない？ これの条件はクイックのその難易度を
//   クリアしないと選べない仕様にしたはず」。
// 直す前は上の isQuickDifficultyUnlocked(チャレンジ・プロ・極限)を使っていたため、
// 「AUTO設定では選べるのに、演奏しても周回クリアが入らない」難易度を作れてしまっていた。
// ★この検査の値打ちは、演奏側(rhythmPlayRunLoopsAllowed)と答えが必ず一致することを
//   実際に動かして確かめる点にある。片方だけ条件を変えると落ちる。
const autoContext = { QUICK_DIFFICULTY_SETTINGS:Object.fromEntries(difficultyOrder.map(id => [id, {}])) };
vm.createContext(autoContext);
vm.runInContext([
  pick(/const quickDifficultiesAtOrAbove = [\s\S]*?\n\};\n/, 'クイック難易度の並び取り出し'),
  pick(/const isQuickModeClearedAtOrAbove = [\s\S]*?;\n/, 'クイックのクリア判定(その難易度以上)'),
  pick(/const rhythmPlayRunLoopsAllowed = [\s\S]*?;\n/, '演奏を周回クリア扱いにしてよいかの判定'),
  pick(/const isAutoQuickRunDifficultyAllowed = [\s\S]*?;\n/, 'AUTO設定で選べる難易度の判定'),
  'globalThis.checkAuto=isAutoQuickRunDifficultyAllowed;globalThis.checkPlay=rhythmPlayRunLoopsAllowed;',
].join(''), autoContext);
const autoAllowed = autoContext.checkAuto;
const playAllowed = autoContext.checkPlay;

assert(autoAllowed('Master', { Master: 1 }), 'クイックでその難易度をクリアしていれば選べる');
assert(!autoAllowed('Master', {}), 'クイック未クリアなら選べない');
// ここが今回の核心。チャレンジ・極限の記録はもう見ない
assert(!autoAllowed('Master', { Hard: 3 }), '下の難易度をクイックでクリアしても上は選べない');
assert(autoAllowed('Easy', { Master: 1 }), '上の難易度をクイックでクリアしていれば下も選べる');
assert(!autoAllowed('Master', { Master: 0 }), 'クリア回数0は未クリア扱い');
assert(!autoAllowed('Master', null) && !autoAllowed(null, {}), '壊れた入力でも落ちずに false');
assert(!autoAllowed('Master', { Master: 'たくさん' }) && !autoAllowed('Master', { Master: -2 }),
  '数でない値・負の数はクリアとして数えない');
// AUTO設定で選べる＝演奏ぶんが入る、が全難易度で一致する(条件が2つに割れない)
difficultyOrder.forEach(id => {
  [{}, { [id]: 1 }, { Master: 1 }, { Beginner: 1 }].forEach(clears => {
    assert(autoAllowed(id, clears) === playAllowed(id, clears),
      `AUTO設定と演奏の条件が${id}で食い違っている`);
  });
});
// 本体の呼び出しもクイックのクリア記録を渡しているか(引数を取り違えると静かに全部通る)
const app = fs.readFileSync('monster-hero/src/parts/60-app.jsx', 'utf8');
assert(app.includes('isAutoQuickRunDifficultyAllowed(quick.difficulty, quickClearCounts)'),
  'AUTO設定から周回を始めるときにクイックのクリア記録で判定している');
assert(app.includes('const unlocked=isAutoQuickRunDifficultyAllowed(key,quickClearCounts);'),
  'AUTO設定の難易度一覧がクイックのクリア記録で判定している');

console.log('quick difficulty unlock checks passed');
