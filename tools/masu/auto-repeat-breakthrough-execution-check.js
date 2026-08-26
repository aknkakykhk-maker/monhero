#!/usr/bin/env node
'use strict';

const assert = require('assert');
const m = require('../harness').loadDyeModule();
const makeXp = level => m.totalBondXpForLevel(level);
const makeBreederXp = level => Array.from({ length:Math.max(0, level - 1) }, (_, index) => m.xpForBreederLevel(index + 1)).reduce((sum, xp) => sum + xp, 0);
const makeMasu = ({ id, cap = 45, count = 3, setting = 50, level = cap, legacy = false }) => ({
  id, baseId:'Golem', name:id, levelCap:cap, rebirthCount:count,
  bondXp:makeXp(level), ...(legacy ? { autoRepeatBreakthrough:true } : { autoRepeatBreakthroughLevel:setting }),
  distAptPoints:0, statPoints:{}, uniqueSkillLevels:{ own:0 }, uniqueSkillPoints:0,
});
const run = (masuMons, ids, breederLevel = 100, gold = 100000, psyche = 1000) => m.buildAutoRepeatBreakthroughs({
  masuIds:ids, masuMons, gold, ownedItems:{ [m.BREAKTHROUGH_ITEM_ID]:psyche }, breederXp:makeBreederXp(breederLevel),
});

let result = run([makeMasu({ id:'ready' })], ['ready']);
assert.deepStrictEqual(Array.from(result.succeededMasuIds), ['ready'], '設定Lv・ブリーダーLv半分以内なら候補');
assert.strictEqual(result.nextMasuMons[0].levelCap, 50, '既存の正規levelCapへ進む');

for (const [label, masu, breederLevel] of [
  ['OFF', makeMasu({ id:'off', setting:0 }), 100],
  ['旧boolean', makeMasu({ id:'legacy', legacy:true }), 200],
  ['設定超過', makeMasu({ id:'setting', setting:45 }), 100],
  ['ブリーダー半分超過', makeMasu({ id:'breeder', setting:50 }), 99],
  ['Lv未到達', makeMasu({ id:'low', level:44 }), 100],
]) {
  const after = run([masu], [masu.id], breederLevel);
  assert.strictEqual(after.succeededMasuIds.length, 0, `${label}は候補外`);
  assert.strictEqual(after.nextMasuMons[0].levelCap, masu.levelCap, `${label}は変更なし`);
}

const manual = m.buildMasuBreakthrough({
  masu:makeMasu({ id:'manual', cap:100, count:14, setting:0, level:100 }), skillKey:'own', gold:100000, psycheOwned:1000,
});
assert.ok(manual.ok && manual.nextMasu.levelCap === 105, '手動限界突破は変更なし');
console.log('✅ AUTO∞自動限界突破の候補判定チェックOK');
