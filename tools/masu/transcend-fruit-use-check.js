const { loadDyeModule } = require('../harness');

const api = loadDyeModule();
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const baseIds = Object.keys(api.ALL_PLAYER_MONSTERS);
const [baseId, otherBaseId] = baseIds;
const speciesItemId = api.speciesTranscendFruitItemId(baseId);
const otherItemId = api.speciesTranscendFruitItemId(otherBaseId);
const rainbowItemId = api.RAINBOW_TRANSCEND_FRUIT_ITEM_ID;
const originalMasu = {
  id:'fruit-test', baseId, name:'低Lv未超越', bondXp:0, transcendPoints:3,
  transcended:false, levelCap:30, rebirthCount:0, distAptPoints:7,
  statPoints:{ hp:2, atk:1, def:0, guts:0 }, uniqueSkillPoints:4,
};
const originalItems = { legacy_item:8, [speciesItemId]:20, [otherItemId]:5, [rainbowItemId]:12 };

const one = api.useTranscendFruitOnMasu(originalMasu, originalItems, speciesItemId, 1);
assert(one.ok && one.nextMasu.transcendPoints === 4, '対応種族の実1個で超越ポイントが+1される');
assert(api.transcendFruitOwnedCount(one.nextOwnedItems, speciesItemId) === 19, '対応種族の実1個だけを消費する');
assert(same(originalMasu, { ...originalMasu }) && originalItems[speciesItemId] === 20, '入力を破壊しない');

const ten = api.useTranscendFruitOnMasu(originalMasu, originalItems, speciesItemId, 10);
assert(ten.ok && ten.nextMasu.transcendPoints === 13 && ten.nextOwnedItems[speciesItemId] === 10, '10個で+10 / -10になる');
const max = api.useTranscendFruitOnMasu(originalMasu, originalItems, speciesItemId, api.transcendFruitOwnedCount(originalItems, speciesItemId));
assert(max.ok && max.nextMasu.transcendPoints === 23 && max.nextOwnedItems[speciesItemId] === 0, 'MAXは選択した種族別の実を全消費する');
assert(max.nextOwnedItems[rainbowItemId] === 12 && max.nextOwnedItems[otherItemId] === 5, 'MAXは虹や別種族の実を消費しない');

const rainbowTen = api.useTranscendFruitOnMasu(originalMasu, originalItems, rainbowItemId, 10);
assert(rainbowTen.ok && rainbowTen.nextMasu.transcendPoints === 13 && rainbowTen.nextOwnedItems[rainbowItemId] === 2, '虹の実でも同じ処理になる');
assert(rainbowTen.nextOwnedItems[speciesItemId] === 20, '虹の実使用時に種族別の実を消費しない');

for (const [result, label] of [
  [api.useTranscendFruitOnMasu(originalMasu, originalItems, otherItemId, 1), '別種族'],
  [api.useTranscendFruitOnMasu(originalMasu, originalItems, speciesItemId, 21), '不足'],
]) {
  assert(!result.ok && result.nextMasu === originalMasu && result.nextOwnedItems === originalItems, `${label}時はマスモンと所持品を完全に変更しない`);
}

assert(one.nextMasu.transcended === false && one.nextMasu.levelCap === 30 && one.nextMasu.bondXp === 0, '未超越・低Lvで使えて超越状態・上限・Lvを変えない');
assert(one.nextMasu.rebirthCount === 0 && one.nextMasu.distAptPoints === 7 && same(one.nextMasu.statPoints, originalMasu.statPoints)
  && one.nextMasu.uniqueSkillPoints === 4, '限界突破数・通常強化ポイント等に影響しない');

console.log('transcend fruit use checks passed');
