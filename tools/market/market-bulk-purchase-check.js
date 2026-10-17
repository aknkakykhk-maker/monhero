// マーケットのまとめ買い(2026-10-17 社長依頼「勇者のかけらとか証とか、その他まとめ買いできるようにして」)を確かめる。
//
//   node tools/market/market-bulk-purchase-check.js
//
//   ① 何度も買う品(ダイヤショップ・プシュケー交換の消耗品 / ビートP交換所のアイテム・強化素材 /
//      勇者の証片→勇者の証 / 勇者の証→魂格再編の書)は、N個まとめて買った結果が、1個ずつN回買った結果と
//      ぴったり同じ(残高・所持数・合計の値段)。いまのマーケットに1日の上限・在庫・持ち数の上限・
//      段々上がる値段は無いので、単価×個数になっていることも見る
//   ② 足りない個数では何も変わらない(引かれない・もらえない)
//   ③ 画面: 勇者の証と魂格再編の書の交換も、窓で個数を選べる(stackable)。選んだ個数が本体の交換へ渡る
//   ④ 二重に引かれない: 窓の「買う」を同じ描画のうちに2回押しても1回だけ通す(sheetBusyRef)。
//      本体の購入・交換も、処理中の印(marketPurchaseProcessingRef)を待ちの前に立てる
//   実際の画面(iPhone幅・二度押し)は market-bulk-purchase-browser-check.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { REPO_ROOT, loadDyeModule } = require('../harness');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const N = 7;

const api = loadDyeModule();
const { BREEDER_MARKET_ITEMS, buildMarketItemPurchase, buildHeroProofShardExchange, buildSoulRankRespecProofExchange,
  HERO_PROOF_SHARD_PER_PROOF, BREAKTHROUGH_ITEM_ID } = api;

// --- ① ダイヤショップ・プシュケー交換の消耗品 ---
const stackItems = BREEDER_MARKET_ITEMS.filter(item => item.shop !== false && item.type === 'item' && item.available !== false && item.cost > 0);
check('まとめ買いできる消耗品が並んでいる', stackItems.length >= 10, stackItems.map(i => i.name).join('・'));
for (const item of stackItems) {
  const start = { gold: item.cost * N + 3, breederPoints: 0, ownedItems: { [item.id]: 2, [BREAKTHROUGH_ITEM_ID]: item.cost * N + 3 } };
  let one = { ...start };
  let allOk = true;
  for (let i = 0; i < N; i++) {
    const p = buildMarketItemPurchase({ item, gold: one.gold, breederPoints: one.breederPoints, ownedItems: one.ownedItems, quantity: 1 });
    if (!p.ok) { allOk = false; break; }
    one = { gold: p.gold, breederPoints: p.breederPoints, ownedItems: p.ownedItems };
  }
  const bulk = buildMarketItemPurchase({ item, ...start, quantity: N });
  check(`${item.name}: ${N}個まとめ買い = 1個ずつ${N}回`,
    allOk && bulk.ok && bulk.cost === item.cost * N && bulk.gold === one.gold && same(bulk.ownedItems, one.ownedItems)
      && bulk.ownedItems[item.id] === 2 + N,
    `合計${bulk.cost} / 所持${bulk.ownedItems?.[item.id]}`);
  const short = buildMarketItemPurchase({ item, ...start, quantity: N + 1 });
  check(`${item.name}: 足りない個数では何も変わらない`, !short.ok && short.gold === start.gold && short.ownedItems === start.ownedItems);
}

// --- ① 勇者の証片 → 勇者の証 / 勇者の証 → 魂格再編の書 ---
{
  const start = { hero_proof_shard: HERO_PROOF_SHARD_PER_PROOF * N + 5, hero_proof: 1 };
  let one = start;
  for (let i = 0; i < N; i++) one = buildHeroProofShardExchange(one, 1).ownedItems;
  const bulk = buildHeroProofShardExchange(start, N);
  check(`勇者の証: ${N}個まとめ交換 = 1個ずつ${N}回`, bulk.ok && bulk.shardCost === HERO_PROOF_SHARD_PER_PROOF * N && same(bulk.ownedItems, one)
    && bulk.ownedItems.hero_proof === 1 + N && bulk.ownedItems.hero_proof_shard === 5, JSON.stringify(bulk.ownedItems));
  const short = buildHeroProofShardExchange(start, N + 1);
  check('勇者の証: 証片が足りない個数では何も変わらない', !short.ok && short.ownedItems === start);
}
{
  const start = { hero_proof: N + 1, soul_rank_respec_scroll: 1 };
  let one = start;
  for (let i = 0; i < N; i++) one = buildSoulRankRespecProofExchange(one, 1).ownedItems;
  const bulk = buildSoulRankRespecProofExchange(start, N);
  check(`魂格再編の書: ${N}冊まとめ交換 = 1冊ずつ${N}回`, bulk.ok && same(bulk.ownedItems, one)
    && bulk.ownedItems.hero_proof === 1 && bulk.ownedItems.soul_rank_respec_scroll === 1 + N, JSON.stringify(bulk.ownedItems));
  const short = buildSoulRankRespecProofExchange(start, N + 2);
  check('魂格再編の書: 勇者の証が足りない個数では何も変わらない', !short.ok && short.ownedItems === start);
}

// --- ① ビートP交換所のアイテム・強化素材 ---
{
  const ctx = { console, Date, Math, JSON, Number, Object, Array, String, Set, Map };
  vm.createContext(ctx);
  vm.runInContext(`${read('monster-hero/data/rhythm-event.js')}\nthis.out={rhythmEventPointExchangePreview,RHYTHM_EVENT_POINT_SHOP_OFFERS};`, ctx);
  const { rhythmEventPointExchangePreview: preview, RHYTHM_EVENT_POINT_SHOP_OFFERS: offers } = ctx.out;
  check('ビートP交換所の何度も買える品が並んでいる', offers.length >= 10 && offers.some(o => o.itemId === 'hero_proof_shard') && offers.some(o => o.itemId === 'hero_proof'));
  for (const offer of offers) {
    const start = { eventPoints: offer.cost * N + 4, gold: 100, ownedItems: { [offer.itemId || 'x']: 3 } };
    let one = start;
    for (let i = 0; i < N; i++) {
      const p = preview({ offer, ...one, quantity: 1 });
      one = { eventPoints: p.eventPoints, gold: p.gold, ownedItems: p.ownedItems };
    }
    const bulk = preview({ offer, ...start, quantity: N });
    check(`ビートP「${offer.name}」: ${N}回まとめ交換 = 1回ずつ${N}回`,
      bulk.ok && bulk.eventPoints === one.eventPoints && bulk.eventPoints === 4 && bulk.gold === one.gold && same(bulk.ownedItems, one.ownedItems),
      `残り${bulk.eventPoints}P / ダイヤ${bulk.gold}`);
    const short = preview({ offer, ...start, quantity: N + 1 });
    check(`ビートP「${offer.name}」: 足りない回数では何も変わらない`, !short.ok && short.eventPoints === start.eventPoints && short.gold === start.gold && short.ownedItems === start.ownedItems);
  }
}

// --- ③ 画面と本体のつなぎ ---
const screen = read('monster-hero/src/parts/55-screen-breeder-market.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
check('勇者の証(証片で交換)の窓で個数を選べ、選んだ個数が交換へ渡る',
  screen.includes("openSheet({ item:shardExchange, stackable:true, confirm:(count)=>onExchangeHeroProof(count) })")
  && /const exchangeHeroProofByShard = async \(quantity=1\) => \{[\s\S]{0,200}?buildHeroProofShardExchange\(before, quantity\)/.test(app));
check('魂格再編の書(勇者の証で交換)の窓で個数を選べ、選んだ個数が交換へ渡る',
  screen.includes("openSheet({ item:exchangeItem, stackable:true, confirm:(count)=>onExchangeSoulRankRespec(count) })")
  && /const exchangeSoulRankRespecByProof = async \(quantity=1\) => \{[\s\S]{0,200}?buildSoulRankRespecProofExchange\(before, quantity\)/.test(app));
check('消耗品とビートPの品も、窓で選んだ個数が本体へ渡る',
  screen.includes("stackable:item.type==='item', confirm:(count)=>onBuy(item,count)")
  && screen.includes("confirm:(count)=>onExchangeEventPoints?onExchangeEventPoints(offer,count):false"));

// --- ④ 二重に引かれない ---
check('窓の「買う」は同じ描画のうちの2回目を止める(sheetBusyRef)',
  /if\(!sheet\|\|sheetPending\|\|sheetBusyRef\.current\) return;\s*sheetBusyRef\.current = true;/.test(screen)
  && /finally \{ sheetBusyRef\.current = false; setSheetPending\(false\); \}/.test(screen));
for (const name of ['exchangeHeroProofByShard', 'exchangeSoulRankRespecByProof', 'exchangeRhythmEventPoints', 'buyMarketItem']) {
  const m = app.match(new RegExp(`const ${name} = async \\([^)]*\\) => \\{\\n\\s*if \\(marketPurchaseProcessingRef\\.current\\) return`));
  check(`${name}: 処理中なら最初に断る`, !!m);
}
// 証の交換は「処理中」の印を、保存を待つ前に立てる(待っているあいだに2回目が来ても通さない)
for (const name of ['exchangeHeroProofByShard', 'exchangeSoulRankRespecByProof']) {
  const body = (app.split(`const ${name} = async`)[1] || '').split('\n  };')[0];
  check(`${name}: 印を立ててから保存を待つ`, body.indexOf('marketPurchaseProcessingRef.current = true') > 0
    && body.indexOf('marketPurchaseProcessingRef.current = true') < body.indexOf('await '));
}

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
