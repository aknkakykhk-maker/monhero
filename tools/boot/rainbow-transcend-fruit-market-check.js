const { loadDyeModule } = require('../harness');
const api = loadDyeModule();
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`OK: ${message}`); };

const fruit = api.BREEDER_MARKET_ITEMS.find(item => item.id === api.RAINBOW_TRANSCEND_FRUIT_ITEM_ID);
assert(fruit && fruit.type === 'item' && fruit.cost === 1000 && fruit.currency === 'psyche', '既存IDの虹の超越の実を1000プシュケーで販売する');
assert(fruit.available !== false && fruit.shop !== false, '常設かつ購入回数制限なしで表示する');
assert(fruit.desc === 'どの種族のマスモンにも使える。1個で超越ポイント+1', '指定された効果説明を表示する');

const before = { [api.BREAKTHROUGH_ITEM_ID]:2500, [api.RAINBOW_TRANSCEND_FRUIT_ITEM_ID]:2, legacy:7 };
const first = api.buildMarketItemPurchase({ item:fruit, gold:55, ownedItems:before });
assert(first.ok && first.gold === 55 && first.ownedItems[api.BREAKTHROUGH_ITEM_ID] === 1500 && first.ownedItems[fruit.id] === 3, '1購入でプシュケーだけ1000減り虹の実が1増える');
const second = api.buildMarketItemPurchase({ item:fruit, gold:55, ownedItems:first.ownedItems });
assert(second.ok && second.ownedItems[api.BREAKTHROUGH_ITEM_ID] === 500 && second.ownedItems[fruit.id] === 4, '購入済み扱いにせず連続購入できる');
const shortage = api.buildMarketItemPurchase({ item:fruit, gold:999999, ownedItems:second.ownedItems });
assert(!shortage.ok && shortage.gold === 999999 && shortage.ownedItems === second.ownedItems, '1000未満ではプシュケーも実も変更しない');
assert(second.ownedItems.legacy === 7 && before[api.BREAKTHROUGH_ITEM_ID] === 2500 && before[fruit.id] === 2, '既存所持品と入力データを壊さない');

const diamondItem = api.BREEDER_MARKET_ITEMS.find(item => item.id === 'unique_skill_reset_ticket');
const diamond = api.buildMarketItemPurchase({ item:diamondItem, gold:1500, ownedItems:before });
assert(diamond.ok && diamond.currency === 'diamond' && diamond.gold === 500 && diamond.ownedItems[diamondItem.id] === 1 && diamond.ownedItems[api.BREAKTHROUGH_ITEM_ID] === 2500, '既存ダイヤ商品は従来どおりダイヤを消費する');

(async () => {
  const storage = { mh_gold:55, mh_owned_items:before };
  let failItems = true;
  const setValue = async (key, value) => { if (key === 'mh_owned_items' && failItems) { failItems = false; return; } storage[key] = value; };
  const getValue = async key => storage[key];
  const saved = await api.saveMarketBalances(55, before, first.gold, first.ownedItems, getValue, setValue);
  assert(!saved && storage.mh_gold === 55 && storage.mh_owned_items === before, '片方の保存失敗時は両方を購入前へ戻す');
})().catch(error => { console.error(error); process.exitCode = 1; });
