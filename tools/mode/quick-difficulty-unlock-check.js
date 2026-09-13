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
assert(difficultyOrder[0] === 'Beginner' && difficultyOrder[difficultyOrder.length - 1] === 'ULTIMATE',
  '難易度の並びが Beginner で始まり ULTIMATE で終わる');
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
assert(source.includes('extremeDifficultyClears[d] = await storeGet(extremeClearCountKey(d), 0, false);'), '既存の極限クリア保存キーを読む');
assert(source.includes('Object.keys(QUICK_DIFFICULTY_SETTINGS).map(async d =>'), '極限2難易度を含む既存クリア記録を読む');
assert(source.includes("EXTREME: { label:'EXTREME', power:EXTREME_SETTING.power, xp:20, gold:4.5, psyche:30"), 'EXTREMEのクイック基準報酬が正しい');
assert(source.includes("NIGHTMARE: { label:'NIGHTMARE', power:NIGHTMARE_SETTING.power, xp:25, gold:6, psyche:40"), 'NIGHTMAREのクイック基準報酬が正しい');
assert(source.includes("CHAOS: { label:'CHAOS', power:CHAOS_SETTING.power, xp:30, gold:9, psyche:50"), 'CHAOSのクイック基準報酬が正しい');
assert(source.includes("label:'ULTIMATE', power:ULTIMATE_SETTING.power, xp:35, gold:12, psyche:60"), 'ULTIMATEの非公開クイック基準報酬が正しい');
const visibleQuickSettings=source.match(/const QUICK_DIFFICULTY_SETTINGS = Object\.freeze\(\{([\s\S]*?)\n\}\);/)?.[1]||'';
assert(visibleQuickSettings&&!visibleQuickSettings.includes('ULTIMATE'), '通常クイック難易度一覧へULTIMATEをまだ公開しない');
assert(source.includes("key==='EXTREME'?'―― 極限難易度 ――':'BATTLE DIFFICULTY'"), 'Legendの次のEXTREMEカードに極限難易度の区切りを表示する');
assert(source.includes('disabled={(pro&&!proReady)||!quickUnlocked'), 'クイックだけに解放条件を適用する');

console.log('quick difficulty unlock checks passed');
