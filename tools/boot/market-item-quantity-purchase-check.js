// マーケットの消耗アイテム(type:'item')は、価格タップで個数選択シートが開き、
// まとめ買いできるようにした(以前は虹の超越の実だけの専用対応だった)。
//
// 「超越の実と同じように他のアイテムも金額を押したら個数を選んでから買えるように」
// という依頼への対応。ここでは
//   ① 画面側で「価格タップ→個数選択シートを開く」対象が type:'item' 全体になっている
//   ② 個数選択シートがダイヤ商品でも通貨・所持数を正しく切り替える(プシュケー専用の
//      決め打ちだったコードを一般化したので、ダイヤ側が壊れていないか確認する)
//   ③ 複数個をまとめて購入する計算(buildMarketItemPurchase)がダイヤ商品でも正しい
// を機械的に確かめる。
const fs = require('fs');
const path = require('path');

const { REPO_ROOT, loadDyeModule } = require('../harness');
const source = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');

const api = loadDyeModule();
const { BREEDER_MARKET_ITEMS, buildMarketItemPurchase } = api;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- ① 画面側のトリガー条件 ---
// 2026-09-28「ショップの作りを全部統一して」から、価格タップはどの品でも確認の窓(MarketPurchaseSheet)を開く。
// 数を選べるのは type:'item' 全体(円盤石・アシスト・アイコンは1つずつ)。窓は画面(BreederMarketScreen)が持ち、
// 本体の buyMarketItem は買えたら true を返す。窓はそれを見て閉じる
check('価格タップで個数選択シートを開く対象が type:\'item\' 全体になっている',
  source.includes("onBuy={()=>openSheet({ item, stackable:item.type==='item', confirm:(count)=>onBuy(item,count),")
  && source.includes("onBuy={buyMarketItem}"));
check('購入できたら窓を閉じる(どの品でも)',
  /if\(result===true\|\|result\?\.ok\)\{[\s\S]{0,300}?setSheet\(null\);/.test(source)
  && /const buyMarketItem = async[\s\S]*?saveMissionProgress\('market'\);\n    return true;/.test(source));

// --- ② 個数選択シートの通貨切り替え ---
check('個数選択シートはプシュケー以外(ダイヤ)を選べる',
  source.includes("const balanceOf = (currency) => currency==='psyche' ? psycheHave :")
  && source.includes("balance={balanceOf(marketCurrencyOf(sheet.item))}"));
check('個数選択シートの単位表示もダイヤに切り替わる',
  api.marketPriceText ? api.marketPriceText(BREEDER_MARKET_ITEMS.find(i => i.id === 'unique_skill_reset_ticket')).endsWith('ダイヤ') : false);

// --- ③ ダイヤ商品でも複数個購入の計算が正しい ---
// スキルポイントリセット券(cost:1000・ダイヤ)を3個まとめ買いする想定
const item = BREEDER_MARKET_ITEMS.find(i => i.id === 'unique_skill_reset_ticket');
check('検証対象のダイヤ商品(スキルポイントリセット券)が見つかる', !!item && item.type === 'item' && item.currency !== 'psyche');

if (item) {
  const before = { unique_skill_reset_ticket: 2 };
  const purchase = buildMarketItemPurchase({ item, gold: 5000, ownedItems: before, quantity: 3 });
  check('ダイヤ商品を3個まとめ買いすると、コストが単価×3になる',
    purchase.ok && purchase.cost === 3000, `cost=${purchase.cost}`);
  check('ダイヤ商品を3個まとめ買いすると、ダイヤが3000だけ減る',
    purchase.ok && purchase.gold === 2000, `gold=${purchase.gold}`);
  check('ダイヤ商品を3個まとめ買いすると、所持数が3増える(既存の2個は消えない)',
    purchase.ok && purchase.ownedItems[item.id] === 5, `owned=${purchase.ownedItems?.[item.id]}`);
  check('まとめ買いしても消耗アイテムは「所持済み」扱いにならず、続けて買える',
    purchase.ok && purchase.ownedItems[item.id] !== undefined);

  const shortage = buildMarketItemPurchase({ item, gold: 2500, ownedItems: before, quantity: 3 });
  check('ダイヤが足りない個数では購入できず、所持数・残高も変わらない',
    !shortage.ok && shortage.ownedItems === before && shortage.gold === 2500);
}

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
