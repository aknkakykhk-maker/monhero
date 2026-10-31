// MFバトルカード個人杯のごほうび・参加費の、端末の預ける・送り直す・受け取る(99-card-cup-prize.jsx)を確かめる(2026-10-31 リプレイくん)。ブラウザなしで動かす。
//
//   node tools/card/card-cup-prize-wallet-check.js
//
// 偽のサーバ(nonce ごとに1回だけ数える・最初の nonce だけに中身を返す。docs/sql/card-cup/CARD_CUP_PRIZE_APPLY.sql と同じ決まり)と、
// 偽の持ち物(本編・カード。保存の取引は本物と同じ「全部書いて読み戻す・食い違えば全部戻す」)で回す。
//   A. 出す: 持ち物が減り、印が held、サーバは1回分。足りなければ何も変わらない
//   B. 返事が来ない: 持ち物は減ったまま印は sending → 送り直すと、サーバは1回分のまま held
//   C. サーバが断る(上限・締め切り): 持ち物を戻し、印は returned
//   D. 参加費: 払って参加 / 入り直し('paid')は払った分を戻して参加できた扱い
//   E. 受け取り: ギフトボックスへ1件・カードの持ち物は直接。2回押しても1回分。返事が切れても送り直して1回分
//   F. ギフトの保存に失敗しても、送り直すとカードの分を二重に足さずに受け取れる
//   G. ほかの端末で受け取り済み('claimed')なら何も足さない
//   H. 印が壊れているときは何もしない(持ち物を減らさない)
//   I. 配る見込みの数え方が、サーバ(card_cup_payouts)と同じ
const fs = require('fs'), path = require('path'), vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const src = fs.readFileSync(path.join(GAME, 'src/parts/99-card-cup-prize.jsx'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const J = (v) => JSON.stringify(v);

const world = () => {
  const store = new Map();
  let failKeys = new Set();
  const storeGet = async (k, d = null) => (store.has(k) ? JSON.parse(store.get(k)) : d);
  const storeSet = async (k, v) => { if (failKeys.has(k)) throw new Error('save'); store.set(k, JSON.stringify(v)); return true; };
  const saveStoredValuesOrRollback = async (entries, get, set) => {
    try { for (const e of entries) await set(e.key, e.next); const back = await Promise.all(entries.map((e) => get(e.key))); if (entries.every((e, i) => J(back[i]) === J(e.next))) return true; } catch (_) { /* 戻す */ }
    for (const e of entries) { try { store.set(e.key, JSON.stringify(e.before)); } catch (_) { /* */ } }
    return false;
  };
  // 偽のサーバ
  const server = { deposits: new Map(), claims: new Map(), reply: null, down: false, claimItems: [{ item: 'diamond', amount: 900 }, { item: 'card:shard', amount: 3 }] };
  const fetch = async (url, opt) => {
    if (server.down) throw new Error('offline');
    const fn = url.split('/rpc/')[1];
    const b = JSON.parse(opt.body);
    let out = null;
    if (fn === 'card_cup_deposit' || fn === 'card_cup_join_pay') {
      if (server.reply) out = server.reply;
      else if (server.deposits.has(b.p_nonce)) out = 'dup';
      else { server.deposits.set(b.p_nonce, b); out = 'ok'; }
    } else if (fn === 'card_cup_claim') {
      const k = `${b.p_cup}|${b.p_owner}`;
      if (server.claims.has(k)) out = server.claims.get(k).nonce === b.p_nonce ? { status: 'ok', reason: 'prize', items: server.claims.get(k).items } : { status: 'claimed' };
      else { server.claims.set(k, { nonce: b.p_nonce, items: server.claimItems }); out = { status: 'ok', reason: 'prize', items: server.claimItems }; }
      if (server.dropReply) { server.dropReply = false; throw new Error('cut'); }
    }
    return { ok: true, json: async () => out };
  };
  const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map, Date, Promise, crypto: require('crypto').webcrypto, fetch,
    storeGet, storeSet, saveStoredValuesOrRollback, SUPABASE_URL: 'https://example.supabase.co', SB_HEADERS: {}, cardCupText: (t) => String(t || '') });
  vm.runInContext(`${src}\nthis.E = { cardCupGive, cardCupJoinPaid, cardCupResume, cardCupClaim, cardCupWalletLoad, cardCupShares, cardCupHave, CARD_CUP_WALLET_KEY, cardCupGiftReward };`, ctx);
  // 偽の持ち物(本編: gold・beat・items / カード: shards)。足し引きは印(extra)と同じ取引
  const bag = { gold: 10000, beat: 500, items: { hero_proof: 2 }, shards: 5, gifts: [] };
  store.set('bag', J(bag));
  const readBag = () => JSON.parse(store.get('bag'));
  const apply = (b, delta) => {
    const n = { ...b, items: { ...b.items } };
    for (const d of delta) {
      if (d.item === 'diamond') n.gold += d.amount; else if (d.item === 'beatPoint') n.beat += d.amount;
      else if (d.item === 'card:shard') n.shards += d.amount; else { const id = d.item.split(':')[1]; n.items[id] = (n.items[id] || 0) + d.amount; }
    }
    return n.gold < 0 || n.beat < 0 || n.shards < 0 || Object.values(n.items).some((x) => x < 0) ? null : n;
  };
  const adapters = {
    owner: 'me', key: 'k'.repeat(30), name: 'わたし', icon: null,
    main: async (delta, extra) => { const b = readBag(); const n = apply(b, delta); if (!n) return false; return saveStoredValuesOrRollback([{ key: 'bag', before: b, next: n }, ...extra], storeGet, storeSet); },
    card: async (delta, extra) => { const b = readBag(); const n = apply(b, delta); if (!n) return false; return saveStoredValuesOrRollback([{ key: 'bag', before: b, next: n }, ...extra], storeGet, storeSet); },
    gift: async (gift, extra) => { const b = readBag(); if (b.gifts.some((g) => g.id === gift.id)) return saveStoredValuesOrRollback(extra, storeGet, storeSet); const n = { ...b, gifts: [...b.gifts, gift] }; return saveStoredValuesOrRollback([{ key: 'bag', before: b, next: n }, ...extra], storeGet, storeSet); },
  };
  return { E: ctx.E, store, server, adapters, readBag, failKeys };
};

(async () => {
  // A
  {
    const w = world();
    const r = await w.E.cardCupGive(w.adapters, 'cup1', 'diamond', 3000, 10000);
    const wal = await w.E.cardCupWalletLoad();
    check('A 出す: ダイヤが減り、印は held、サーバは1回分', r === 'ok' && w.readBag().gold === 7000 && wal.length === 1 && wal[0].state === 'held' && w.server.deposits.size === 1, `${r} ${w.readBag().gold} ${J(wal)}`);
    const s = await w.E.cardCupGive(w.adapters, 'cup1', 'gameItem:hero_proof', 3, 2);
    check('A 足りないときは何も変わらない', s === 'short' && w.readBag().items.hero_proof === 2 && (await w.E.cardCupWalletLoad()).length === 1);
  }
  // B
  {
    const w = world();
    w.server.down = true;
    const r = await w.E.cardCupGive(w.adapters, 'cup1', 'diamond', 1000, 10000);
    const wal1 = await w.E.cardCupWalletLoad();
    check('B 返事が来ない: 減ったまま印は sending', r === 'pending' && w.readBag().gold === 9000 && wal1[0].state === 'sending');
    w.server.down = false;
    // サーバには届いていた、という場合も試す(先に1回分を入れておく)
    w.server.deposits.set(wal1[0].nonce, {});
    const n = await w.E.cardCupResume(w.adapters);
    const wal2 = await w.E.cardCupWalletLoad();
    check('B 送り直すと held・サーバは1回分のまま・持ち物は二重に減らない', n === 1 && wal2[0].state === 'held' && w.server.deposits.size === 1 && w.readBag().gold === 9000, `${n} ${J(wal2)}`);
  }
  // C
  {
    const w = world();
    w.server.reply = 'over';
    const r = await w.E.cardCupGive(w.adapters, 'cup1', 'beatPoint', 200, 500);
    const wal = await w.E.cardCupWalletLoad();
    check('C サーバが断る: ビートPを戻し、印は returned', r === 'over' && w.readBag().beat === 500 && wal[0].state === 'returned', `${r} ${J(w.readBag())}`);
  }
  // D
  {
    const w = world();
    const r = await w.E.cardCupJoinPaid(w.adapters, 'cup1', { item: 'diamond', amount: 500 }, 10000);
    check('D 参加費を払って参加', r === 'ok' && w.readBag().gold === 9500 && (await w.E.cardCupWalletLoad())[0].state === 'held');
    w.server.reply = 'paid';
    const r2 = await w.E.cardCupJoinPaid(w.adapters, 'cup1', { item: 'diamond', amount: 500 }, 9500);
    const wal = await w.E.cardCupWalletLoad();
    check('D 入り直し(前に払った分のまま)は、払った分を戻して参加できた扱い', r2 === 'ok' && w.readBag().gold === 9500 && wal[1].state === 'returned', `${r2} ${w.readBag().gold}`);
    w.server.reply = 'full';
    const r3 = await w.E.cardCupJoinPaid(w.adapters, 'cup2', { item: 'diamond', amount: 500 }, 9500);
    check('D 満員なら戻す', r3 === 'full' && w.readBag().gold === 9500);
  }
  // E
  {
    const w = world();
    const r = await w.E.cardCupClaim(w.adapters, 'cupe', 'テスト杯');
    const bag = w.readBag();
    check('E 受け取り: ギフトボックスへ1件(ダイヤ)・かけらは直接', r.status === 'ok' && bag.gifts.length === 1 && J(bag.gifts[0].rewards) === J([{ type: 'diamond', amount: 900 }]) && bag.shards === 8 && bag.gifts[0].source === 'cardCup', J(bag));
    const r2 = await w.E.cardCupClaim(w.adapters, 'cupe', 'テスト杯');
    check('E 2回押しても1回分', r2.status === 'ok' && w.readBag().gifts.length === 1 && w.readBag().shards === 8);
    const w2 = world();
    w2.server.dropReply = true;
    const p = await w2.E.cardCupClaim(w2.adapters, 'cupe', 'テスト杯');
    const q = await w2.E.cardCupClaim(w2.adapters, 'cupe', 'テスト杯');
    check('E 返事が切れても、送り直して1回分', p.status === 'pending' && q.status === 'ok' && w2.readBag().gifts.length === 1 && w2.readBag().shards === 8, `${p.status} ${q.status} ${J(w2.readBag())}`);
  }
  // F
  {
    const w = world();
    const realGift = w.adapters.gift;
    w.adapters.gift = async () => false;
    const p = await w.E.cardCupClaim(w.adapters, 'cupf', 'テスト杯');
    check('F ギフトの保存に失敗: 待ち(カードの分は足した)', p.status === 'pending' && w.readBag().shards === 8 && w.readBag().gifts.length === 0);
    w.adapters.gift = realGift;
    const n = await w.E.cardCupResume(w.adapters);
    check('F 送り直すと、カードの分を二重に足さずにギフトが届く', n === 1 && w.readBag().shards === 8 && w.readBag().gifts.length === 1, J(w.readBag()));
  }
  // G
  {
    const w = world();
    w.server.claims.set('cupg|me', { nonce: 'f'.repeat(32), items: [{ item: 'diamond', amount: 900 }] });
    const r = await w.E.cardCupClaim(w.adapters, 'cupg', 'テスト杯');
    check('G ほかの端末で受け取り済みなら何も足さない', r.status === 'elsewhere' && w.readBag().gifts.length === 0 && w.readBag().gold === 10000);
  }
  // H
  {
    const w = world();
    w.store.set('mh_card_cup_wallet_v1', J({ broken: true }));
    const r = await w.E.cardCupGive(w.adapters, 'cup1', 'diamond', 100, 10000);
    check('H 印が壊れているときは減らさない', r === 'save' && w.readBag().gold === 10000 && w.server.deposits.size === 0);
  }
  // I
  {
    const w = world();
    check('I 見込み: 18,000 を 6:3:1・3人以上 → 10,800 / 5,400 / 1,800', J(w.E.cardCupShares(18000, [60, 30, 10], 5)) === J([10800, 5400, 1800]));
    check('I 見込み: 勇者の証 2 を 6:3:1 → 1位に端数ごと 2', J(w.E.cardCupShares(2, [60, 30, 10], 5)) === J([2, 0, 0]));
    check('I 見込み: 2人しかいないときは3位の分を1位へ(7:3)', J(w.E.cardCupShares(1000, [60, 30, 10], 2)) === J([700, 300]));
    check('I ギフトの形: ダイヤ・アイテム', J(w.E.cardCupGiftReward('diamond', 5)) === J({ type: 'diamond', amount: 5 }) && J(w.E.cardCupGiftReward('gameItem:hero_proof', 1)) === J({ type: 'gameItem', itemId: 'hero_proof', amount: 1 }) && w.E.cardCupGiftReward('breederPoint', 1) === null);
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
