const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const match = source.match(/const isQuickDifficultyUnlocked = [\s\S]*?;\n/);
if (!match) throw new Error('クイック難易度の解放判定が見つかりません');
const context = {};
vm.createContext(context);
vm.runInContext(`${match[0]}globalThis.checkUnlock=isQuickDifficultyUnlocked;`, context);
const unlocked = context.checkUnlock;
const empty = {};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(unlocked('Master', { Master: 1 }, empty, empty), 'チャレンジのみの同難易度クリアで解放される');
assert(unlocked('Master', empty, { Master: 1 }, empty), 'プロのみの同難易度クリアで解放される');
assert(unlocked('Master', empty, empty, { Master: 1 }), '極限のみの同難易度クリアで解放される');
assert(!unlocked('Master', empty, empty, empty), '全モード未クリアなら未解放になる');
assert(!unlocked('Master', { Legend: 1 }, { Hard: 1 }, { Expert: 1 }), '別難易度では解放されない');
assert(unlocked('Legend', { Legend: '2' }, empty, empty), '保存値を数値として正規化して判定する');
assert(!unlocked('Legend', { Legend: 'broken' }, empty, empty), '壊れた保存値では解放されない');
assert(source.includes('extremeDifficultyClears[d] = await storeGet(extremeClearCountKey(d), 0, false);'), '既存の極限クリア保存キーを読む');
assert(source.includes('disabled={(pro&&!proReady)||!quickUnlocked'), 'クイックだけに解放条件を適用する');

console.log('quick difficulty unlock checks passed');
