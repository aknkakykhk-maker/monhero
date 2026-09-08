#!/usr/bin/env node
'use strict';

const assert = require('assert');
const m = require('../harness').loadDyeModule();
const makeXp = level => m.totalBondXpForLevel(level);
const makeBreederXp = level => Array.from({ length:Math.max(0, level - 1) }, (_, index) => m.xpForBreederLevel(index + 1)).reduce((sum, xp) => sum + xp, 0);
const makeMasu = ({ id, cap = 45, count = 3, setting = 50, mode, level = cap, legacy = false }) => ({
  id, baseId:'Golem', name:id, levelCap:cap, rebirthCount:count,
  bondXp:makeXp(level),
  ...(legacy
    ? { autoRepeatBreakthrough:true }
    : { autoRepeatBreakthroughLevel:setting, ...(mode ? { autoRepeatBreakthroughMode:mode } : {}) }),
  distAptPoints:0, statPoints:{}, uniqueSkillLevels:{ own:0 }, uniqueSkillPoints:0,
});
const run = (masuMons, ids, breederLevel = 100, gold = 100000, psyche = 1000, reserves = {}) => m.buildAutoRepeatBreakthroughs({
  masuIds:ids, masuMons, gold, ownedItems:{ [m.BREAKTHROUGH_ITEM_ID]:psyche }, breederXp:makeBreederXp(breederLevel),
  reserveGold:reserves.gold || 0, reservePsyche:reserves.psyche || 0,
});

let result = run([makeMasu({ id:'ready' })], ['ready']);
assert.deepStrictEqual(Array.from(result.succeededMasuIds), ['ready'], '設定Lv・ブリーダーLv半分以内なら候補');
assert.strictEqual(result.nextMasuMons[0].levelCap, 50, '既存の正規levelCapへ進む');

const legacyNumeric = run([makeMasu({ id:'legacyNumeric', setting:50 })], ['legacyNumeric']);
assert.deepStrictEqual(Array.from(legacyNumeric.succeededMasuIds), ['legacyNumeric'], 'mode未保存の既存数値設定はfixedとして維持');

const follow = run([makeMasu({ id:'follow', setting:0, mode:'follow' })], ['follow'], 100);
assert.deepStrictEqual(Array.from(follow.succeededMasuIds), ['follow'], 'followは保存固定LvなしでもブリーダーLvから上限を求める');
assert.strictEqual(follow.nextMasuMons[0].levelCap, 50, 'Lv100のfollowはLv50まで進める');

const explicitOff = run([makeMasu({ id:'explicitOff', setting:50, mode:'off' })], ['explicitOff'], 100);
assert.strictEqual(explicitOff.succeededMasuIds.length, 0, 'mode=offは古い固定Lv値が残っていても実行しない');

const reserveBase = run([makeMasu({ id:'reserveBase' })], ['reserveBase'], 100, 100000, 1000);
const postGold = reserveBase.nextGold;
const postPsyche = reserveBase.nextOwnedItems[m.BREAKTHROUGH_ITEM_ID];
const reserveGoldBlocked = run([makeMasu({ id:'reserveGoldBlocked' })], ['reserveGoldBlocked'], 100, 100000, 1000, { gold:postGold + 1 });
assert.strictEqual(reserveGoldBlocked.succeededMasuIds.length, 0, '限凸後ダイヤが保護残高を1下回るなら見送る');
const reserveGoldExact = run([makeMasu({ id:'reserveGoldExact' })], ['reserveGoldExact'], 100, 100000, 1000, { gold:postGold });
assert.strictEqual(reserveGoldExact.succeededMasuIds.length, 1, '限凸後ダイヤが保護残高ちょうどなら実行する');
const reservePsycheBlocked = run([makeMasu({ id:'reservePsycheBlocked' })], ['reservePsycheBlocked'], 100, 100000, 1000, { psyche:postPsyche + 1 });
assert.strictEqual(reservePsycheBlocked.succeededMasuIds.length, 0, '限凸後プシュケーが保護残高を1下回るなら見送る');
const reservePsycheExact = run([makeMasu({ id:'reservePsycheExact' })], ['reservePsycheExact'], 100, 100000, 1000, { psyche:postPsyche });
assert.strictEqual(reservePsycheExact.succeededMasuIds.length, 1, '限凸後プシュケーが保護残高ちょうどなら実行する');

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
