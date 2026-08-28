const fs = require('fs');
const { loadDyeModule } = require('../harness');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const api = loadDyeModule();
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`OK: ${message}`); };
// 「種族」はモンスター1体ではなく主血統(モッチー種・ピクシー種…)。
// 実は血統ごとに1つで、その血統のどのモンスターのマスモンにも使える(2026年8月に移行)
const lineages = api.dexMainLineages();
const itemIds = lineages.map(lineage => api.speciesTranscendFruitItemId(lineage.id));

assert(lineages.length > 0, 'プレイアブルな主血統が存在する');
assert(itemIds.every(Boolean) && new Set(itemIds).size === lineages.length, '全血統で固有itemIdが生成される');
assert(lineages.every(lineage => itemIds.includes(`${api.SPECIES_TRANSCEND_FRUIT_ITEM_ID_PREFIX}${lineage.id}`)), 'itemIdは表示名でなく血統idから生成される');
assert(lineages.every(lineage => api.speciesTranscendFruitItems()[lineage.id].lineageId === lineage.id
  && api.speciesTranscendFruitItems()[lineage.id].name === `超越の実（${lineage.name}種）`), '全種族別アイテムに表示名と血統idが対応する');
// 【後方互換】モンスター1体単位で配ってしまった旧実。もう配らないが、所持数は読めて使える
const legacyIds = Object.values(api.LEGACY_SPECIES_TRANSCEND_FRUIT_ITEMS).map(item => item.id);
assert(legacyIds.length === Object.keys(api.ALL_PLAYER_MONSTERS).length, '旧実は全プレイアブル種ぶん残してある');
assert(legacyIds.every(id => api.transcendFruitOwnedCount({ [id]:3 }, id) === 3), '旧実の所持数を読める');
assert(legacyIds.every(id => !itemIds.includes(id)), '旧実といまの血統単位の実は別のidになる');
assert(api.RAINBOW_TRANSCEND_FRUIT_ITEM.id === api.RAINBOW_TRANSCEND_FRUIT_ITEM_ID
  && api.RAINBOW_TRANSCEND_FRUIT_ITEM.name === '虹の超越の実', '虹の超越の実が独立定義される');

const firstId = itemIds[0], secondId = itemIds[1];
const original = { legacy_item:7, [firstId]:2, [secondId]:9, [api.RAINBOW_TRANSCEND_FRUIT_ITEM_ID]:4 };
const added = api.changeTranscendFruitOwnedCount(original, firstId, 3);
assert(added.ok && api.transcendFruitOwnedCount(added.ownedItems, firstId) === 5, '指定数を追加できる');
assert(api.transcendFruitOwnedCount(added.ownedItems, secondId) === 9, '種族ごとの所持数が独立する');
assert(api.transcendFruitOwnedCount(added.ownedItems, api.RAINBOW_TRANSCEND_FRUIT_ITEM_ID) === 4, '虹の実の所持数が独立する');
assert(original[firstId] === 2 && added.ownedItems !== original, '追加は入力データを破壊しない');
const consumed = api.consumeTranscendFruit(added.ownedItems, firstId, 4);
assert(consumed.ok && api.transcendFruitOwnedCount(consumed.ownedItems, firstId) === 1, '指定数を消費できる');
const shortage = api.consumeTranscendFruit(consumed.ownedItems, firstId, 2);
assert(!shortage.ok && shortage.ownedItems === consumed.ownedItems, '不足時は変更せず消費に失敗する');
const exact = api.consumeTranscendFruit(consumed.ownedItems, firstId, 1);
assert(exact.ok && api.transcendFruitOwnedCount(exact.ownedItems, firstId) === 0, '所持数は0未満にならない');

for (const invalid of [null, undefined, '', 'unknown', '__proto__', 123]) {
  assert(api.speciesTranscendFruitItemId(invalid) === null, `不正speciesIdを安全に拒否する: ${String(invalid)}`);
}
for (const amount of [0, -1, 1.5, NaN, Infinity, 'broken']) {
  const addResult = api.changeTranscendFruitOwnedCount(original, firstId, amount);
  const consumeResult = api.consumeTranscendFruit(original, firstId, amount);
  assert(!addResult.ok && addResult.ownedItems === original && !consumeResult.ok && consumeResult.ownedItems === original, `不正な増減数を安全に拒否する: ${String(amount)}`);
}
assert(!api.changeTranscendFruitOwnedCount(original, 'transcend_fruit_species_unknown', 1).ok, '未知の種族別itemIdを安全に拒否する');
assert(added.ownedItems.legacy_item === 7 && consumed.ownedItems.legacy_item === 7, '既存mh_owned_itemsの他アイテムを保持する');
assert(!/mh_(?:species_)?transcend_fruit|mh_transcend_fruit/.test(source)
  && source.includes("storeGet('mh_owned_items'") && source.includes("storeSet('mh_owned_items'"), '新しいmh_*保存キーを追加せずmh_owned_itemsを再利用する');
const broken = { [firstId]:-10, legacy_item:2 };
assert(!api.consumeTranscendFruit(broken, firstId, 1).ok && api.transcendFruitOwnedCount(broken, firstId) === 0, '壊れた負数所持から消費せず0個として判定する');
console.log('transcend fruit item checks passed');
