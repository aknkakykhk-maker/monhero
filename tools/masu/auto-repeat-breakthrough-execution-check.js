#!/usr/bin/env node
'use strict';

const assert = require('assert');
const m = require('../harness').loadDyeModule();

const makeMasu = ({ id, cap = 95, count = 13, enabled = true, level = cap }) => ({
  id, baseId:'Golem', name:id, levelCap:cap, rebirthCount:count,
  bondXp:m.totalBondXpForLevel(level), autoRepeatBreakthrough:enabled,
  distAptPoints:0, statPoints:{}, uniqueSkillLevels:{ own:0 }, uniqueSkillPoints:0,
});
const run = (masuMons, ids, gold = 100000, psyche = 1000) => m.buildAutoRepeatBreakthroughs({
  masuIds:ids, masuMons, gold, ownedItems:{ [m.BREAKTHROUGH_ITEM_ID]:psyche },
});
const unchanged = (before, after, gold, psyche) =>
  JSON.stringify(after.nextMasuMons) === JSON.stringify(before)
    && after.nextGold === gold
    && after.nextOwnedItems[m.BREAKTHROUGH_ITEM_ID] === psyche;

const ready = makeMasu({ id:'ready' });
let result = run([ready], ['ready']);
assert.strictEqual(JSON.stringify(result.succeededMasuIds), JSON.stringify(['ready']), 'ON＋カンスト＋素材ありで成功');
assert.strictEqual(result.nextMasuMons[0].levelCap, 100, '95→100は成功');
assert.strictEqual(result.nextMasuMons[0].uniqueSkillPoints, 1, "skillKey:''で固有技Pを残す");
assert.strictEqual(result.nextMasuMons[0].uniqueSkillLevels.own, 0, '固有技は上げない');

for (const [label, masu, gold, psyche] of [
  ['OFF', makeMasu({ id:'off', enabled:false }), 100000, 1000],
  ['Lv未到達', makeMasu({ id:'low', level:94 }), 100000, 1000],
  ['ダイヤ不足', ready, 4749, 1000],
  ['虹プシュケー不足', ready, 100000, 17],
  ['100→105', makeMasu({ id:'over', cap:100, count:14 }), 100000, 1000],
]) {
  const before = [masu];
  const after = run(before, [masu.id], gold, psyche);
  assert.ok(unchanged(before, after, gold, psyche), `${label}は実行・消費なし`);
}

result = run([ready], ['ready', 'ready']);
assert.strictEqual(result.succeededMasuIds.length, 1, '同一masuIdは1回だけ');

const first = makeMasu({ id:'first' });
const second = makeMasu({ id:'second' });
result = run([first, second], ['first', 'second'], 9500, 35);
assert.strictEqual(JSON.stringify(result.succeededMasuIds), JSON.stringify(['first']), '1体目の消費後の最新残高で2体目をスキップ');
assert.strictEqual(result.nextMasuMons[1].levelCap, 95, '2体目は未変更');

const manualOver = m.buildMasuBreakthrough({
  masu:makeMasu({ id:'manual', cap:100, count:14 }), skillKey:'own', gold:100000, psycheOwned:1000,
});
assert.ok(manualOver.ok && manualOver.nextMasu.levelCap === 105, '手動限界突破にLv100制限なし');

console.log('✅ AUTO∞自動限界突破の判定・順次実行チェックOK');
