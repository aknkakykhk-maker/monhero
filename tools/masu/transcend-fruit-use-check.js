const { loadDyeModule } = require('../harness');

const api = loadDyeModule();
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// 「種族」はモンスター1体ではなく主血統(モッチー種・ピクシー種…)。実も血統ごとに1つで、
// その血統のどのモンスターのマスモンにも使える(2026年8月にこの単位へ移行した)
const baseIds = Object.keys(api.ALL_PLAYER_MONSTERS);
const baseId = baseIds[0];
const lineageId = api.monsterLineageOf(baseId).main.id;
const otherBaseId = baseIds.find(id => api.monsterLineageOf(id).main.id !== lineageId);
const speciesItemId = api.masuSpeciesTranscendFruitItemId(baseId);
const otherItemId = api.masuSpeciesTranscendFruitItemId(otherBaseId);
assert(speciesItemId && otherItemId && speciesItemId !== otherItemId, '別の血統の実を用意できる');
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

const checkSaveFlow = async () => {
  const beforeMasuMons = [originalMasu];
  const beforeOwnedItems = originalItems;
  const nextMasuMons = [one.nextMasu];
  const nextOwnedItems = one.nextOwnedItems;

  for (const mismatchKey of [null, 'mh_masu_mons', 'mh_owned_items']) {
    const storage = { mh_masu_mons:beforeMasuMons, mh_owned_items:beforeOwnedItems };
    let corruptNextWrite = mismatchKey;
    const setValue = async (key, value) => {
      storage[key] = corruptNextWrite === key ? { mismatched:true } : value;
      if (corruptNextWrite === key) corruptNextWrite = null;
    };
    const getValue = async (key, fallback) => Object.hasOwn(storage, key) ? storage[key] : fallback;
    const saved = await api.saveTranscendFruitPair(
      beforeMasuMons, beforeOwnedItems, nextMasuMons, nextOwnedItems, getValue, setValue
    );
    if (mismatchKey === null) {
      assert(saved, '両方の再読込結果が一致した場合だけ成功する');
      assert(same(storage.mh_masu_mons, nextMasuMons) && same(storage.mh_owned_items, nextOwnedItems), '正常時は実減少と超越ポイント増加を両方保存する');
    } else {
      assert(!saved, `${mismatchKey}の再読込不一致を失敗扱いにする`);
      assert(same(storage.mh_masu_mons, beforeMasuMons) && same(storage.mh_owned_items, beforeOwnedItems), `${mismatchKey}不一致時は更新前の2データへロールバックする`);
    }
  }
};

checkSaveFlow().then(() => console.log('transcend fruit use checks passed'));
