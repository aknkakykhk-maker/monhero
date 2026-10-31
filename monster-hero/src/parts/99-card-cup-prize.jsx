// ===== MFバトルカード 個人杯: ごほうび・参加費・主催仲間の部品(2026-10-31 リプレイくん・社長の判断) =====
// 案: docs/progress/card-tournament/personal-cup/prize/README.md / SQL: docs/sql/card-cup/CARD_CUP_PRIZE_APPLY.sql / 仕様: docs/spec/CARD_CUP.md
//   ・主催・主催仲間が自分の持ち物から出す / 参加費(なしでもよい)。どちらもサーバで預かり、終わったら配る(ギフトボックスへ)
//   ・持ち物は端末にあるので、「端末で減らす」と「送っている途中の印」を同じ取引で書き、サーバは nonce ごとに1回だけ数える。
//     返事が来なければ、次に開いたとき同じ nonce で送り直す。受け取りもサーバが最初の nonce だけに中身を返す(二重に受け取れない)
//   ・本編の持ち物(ダイヤ・アイテム・ビートP)は本編の画面(60-app)が状態を持っているので、減らす・ギフトを足すのは 60-app の口(onCupItems)で。
//     カードの持ち物(かけら・パック券・カタログ)は 84 の保存(persist)で
// 保存: 新しいキー mh_card_cup_wallet_v1 だけ(下)。今のキーは、今の形のまま足す・引くだけ

const CARD_CUP_WALLET_KEY = 'mh_card_cup_wallet_v1';
const CARD_CUP_WALLET_MAX = 200;
// 出せる物(サーバの表 card_cup_prize_items と同じ名前)。label・emoji は画面の名前。上限はサーバの表が正(card_cup_prize_items_list)
//   main … 本編の持ち物(ギフトで配る)。card … カードの持ち物(84 で足す・引く)
const CARD_CUP_ITEMS = Object.freeze([
  { item: 'diamond', label: 'ダイヤ', emoji: '💎', main: true },
  { item: 'beatPoint', label: 'ビートP', emoji: '🎵', main: true },
  { item: 'rainbowPsyche', label: '虹のプシュケー', emoji: '🌈', main: true, owned: 'rainbow_psyche' },
  { item: 'rainbowTranscendFruit', label: '虹の超越の実', emoji: '🍑', main: true, owned: 'transcend_fruit_rainbow' },
  { item: 'gameItem:hero_proof', label: '勇者の証', emoji: '🏅', main: true, owned: 'hero_proof' },
  { item: 'gameItem:hero_proof_shard', label: '勇者の証片', emoji: '🔸', main: true, owned: 'hero_proof_shard' },
  { item: 'gameItem:session_ticket', label: 'セッション券', emoji: '🎫', main: true, owned: 'session_ticket' },
  { item: 'gameItem:skip_ticket_jo', label: 'スキップチケット・序', emoji: '⏩', main: true, owned: 'skip_ticket_jo' },
  { item: 'gameItem:skip_ticket_ha', label: 'スキップチケット・破', emoji: '⏩', main: true, owned: 'skip_ticket_ha' },
  { item: 'gameItem:skip_ticket_kyu', label: 'スキップチケット・急', emoji: '⏩', main: true, owned: 'skip_ticket_kyu' },
  { item: 'gameItem:training_ticket', label: 'トレーニングチケット', emoji: '🏋️', main: true, owned: 'training_ticket' },
  { item: 'dyeMock', label: '染色もどき', emoji: '🎨', main: true, owned: 'dye_mock' },
  { item: 'card:shard', label: '戦術カードのかけら', emoji: '🧩', card: 'shards' },
  { item: 'card:ticket', label: 'カードパック券', emoji: '🎟️', card: 'tickets' },
  { item: 'card:catalog', label: 'バトルカードカタログ', emoji: '📘', card: 'catalogs' },
]);
const cardCupItemOf = (item) => CARD_CUP_ITEMS.find((x) => x.item === item) || null;
const cardCupItemText = (item, amount) => { const it = cardCupItemOf(item); return `${it ? `${it.emoji} ${it.label}` : item} ${Number(amount || 0).toLocaleString()}`; };
// 出せない物(画面の一覧に理由つきで出す)
const CARD_CUP_ITEMS_NG = Object.freeze([
  ['ブリーダーP', '2度と手に入らない物'],
  ['マスモン・円盤石・アシストカード', 'ひとつずつの物で、育てた中身がある'],
  ['アイコン・フレーム・着替え', '一度手に入れたら外さない物'],
  ['バトルカード(1枚ずつ)', 'これから(番号ごとの預かりが要る)'],
  ['経験値・ランク・記録', '持ち物ではない'],
]);
// ギフトの報酬の形へ(本編の持ち物だけ。17 の normalizeGiftRewards が通す形)
const cardCupGiftReward = (item, amount) => {
  const n = Math.floor(Number(amount));
  if (!(n > 0)) return null;
  if (item === 'diamond' || item === 'beatPoint' || item === 'rainbowPsyche' || item === 'rainbowTranscendFruit' || item === 'dyeMock') return { type: item, amount: n };
  const m = /^gameItem:([a-z0-9_]{1,40})$/.exec(String(item || ''));
  return m ? { type: 'gameItem', itemId: m[1], amount: n } : null;
};
// 持っている数(本編の持ち物: { gold, ownedItems, beatPoints }。カードの持ち物: { shards, tickets, catalogs })
const cardCupHave = (item, main, card) => {
  const it = cardCupItemOf(item);
  if (!it) return 0;
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
  if (it.card) return n(card && card[it.card]);
  if (item === 'diamond') return n(main && main.gold);
  if (item === 'beatPoint') return n(main && main.beatPoints);
  return n(main && main.ownedItems && main.ownedItems[it.owned]);
};

// ---- 印(mh_card_cup_wallet_v1)----
// [{ cup, kind:'prize'|'fee'|'claim', item?, amount?, nonce, state, at, name?, icon?, card?:真偽(カードの分を足した), gift?:真偽(ギフトを足した), items? }]
//   state … 預ける: 'sending'(減らした・まだサーバの返事が無い)→ 'held'(預けた)/ 'returned'(戻した)
//           受け取る: 'claiming'(nonce を決めた)→ 'claimed'(足し終えた)/ 'elsewhere'(ほかの端末で受け取り済み)/ 'none'(もらう物が無い)
const cardCupNonce = () => {
  try { const b = new Uint8Array(16); crypto.getRandomValues(b); return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join(''); }
  catch (_) { return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); }
};
const cardCupNormalizeWallet = (raw) => {
  if (!Array.isArray(raw)) return [];
  const states = ['sending', 'held', 'returned', 'claiming', 'claimed', 'elsewhere', 'none'];
  return raw.filter((r) => r && typeof r.cup === 'string' && /^[a-z0-9_-]{1,32}$/.test(r.cup) && ['prize', 'fee', 'claim'].includes(r.kind)
    && typeof r.nonce === 'string' && /^[0-9a-f]{32,64}$/.test(r.nonce) && states.includes(r.state))
    .map((r) => ({ cup: r.cup, kind: r.kind, nonce: r.nonce, state: r.state, at: Number.isFinite(r.at) ? r.at : 0,
      ...(r.kind !== 'claim' ? { item: typeof r.item === 'string' ? r.item : '', amount: Number.isInteger(r.amount) && r.amount > 0 ? r.amount : 0 } : {}),
      ...(typeof r.name === 'string' ? { name: r.name.slice(0, 40) } : {}), ...(typeof r.icon === 'string' ? { icon: r.icon.slice(0, 64) } : {}),
      ...(r.card === true ? { card: true } : {}), ...(r.gift === true ? { gift: true } : {}),
      ...(Array.isArray(r.items) ? { items: r.items.filter((x) => x && typeof x.item === 'string' && Number.isInteger(x.amount) && x.amount > 0).slice(0, 20) } : {}) }))
    .slice(-CARD_CUP_WALLET_MAX);
};
// 1件を足す・置きかえる(nonce が同じ物を置きかえる)。古い物は、終わった物から落とす
const cardCupWalletPut = (list, rec) => {
  const rest = list.filter((r) => r.nonce !== rec.nonce);
  const next = [...rest, rec];
  if (next.length <= CARD_CUP_WALLET_MAX) return next;
  const done = ['held', 'returned', 'claimed', 'elsewhere', 'none'];
  const drop = next.findIndex((r) => done.includes(r.state) && r.nonce !== rec.nonce);
  return drop >= 0 ? next.filter((_, i) => i !== drop) : next.slice(-CARD_CUP_WALLET_MAX);
};
// 印を書く項目(保存の取引 saveStoredValuesOrRollback に足す形)。書く直前に読み直す
const cardCupWalletEntry = async (rec) => {
  const raw = await storeGet(CARD_CUP_WALLET_KEY, null, false);
  if (raw !== null && raw !== undefined && !Array.isArray(raw)) return null; // 壊れているときは書かない(何もしない)
  return { key: CARD_CUP_WALLET_KEY, before: raw === undefined ? null : raw, next: cardCupWalletPut(cardCupNormalizeWallet(raw), rec) };
};
const cardCupWalletLoad = async () => { try { return cardCupNormalizeWallet(await storeGet(CARD_CUP_WALLET_KEY, null, false)); } catch (_) { return []; } };
const cardCupWalletSet = async (rec) => {
  const e = await cardCupWalletEntry(rec);
  if (!e) return false;
  return saveStoredValuesOrRollback([e], storeGet, storeSet);
};

// ---- 通信(関数がまだ無い・通信できないときは null。ほかの個人杯の通信は止めない) ----
const cardCupPrizeRpc = async (fn, body) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: SB_HEADERS, body: JSON.stringify(body) });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) { return null; }
};
const cardCupPrizeItemsList = async () => {
  const r = await cardCupPrizeRpc('card_cup_prize_items_list', {});
  return Array.isArray(r) ? r.filter((x) => x && cardCupItemOf(x.item)).map((x) => ({ item: x.item, label: cardCupItemOf(x.item).label,
    giveMax: Math.max(0, Number(x.give_max) || 0), feeMax: Math.max(0, Number(x.fee_max) || 0), dayMax: Math.max(0, Number(x.day_max) || 0) })) : null;
};
// 杯のごほうび(画面に出す形)。無い・読めないときは null
const cardCupPrizeView = async (cup, owner) => {
  const v = await cardCupPrizeRpc('card_cup_prize_view', { p_cup: cup, p_owner: owner || null });
  if (!v || typeof v !== 'object') return null;
  const items = (a, k) => (Array.isArray(a) ? a.filter((x) => x && cardCupItemOf(x.item) && Number(x[k]) > 0).map((x) => ({ ...x, [k]: Math.floor(Number(x[k])) })) : []);
  const split = Array.isArray(v.split) && v.split.every((x) => Number.isInteger(x) && x > 0) ? v.split.slice(0, 8) : [70, 30];
  return {
    fee: v.fee && cardCupItemOf(v.fee.item) && Number(v.fee.amount) > 0 ? { item: v.fee.item, amount: Math.floor(Number(v.fee.amount)) } : null,
    split, pool: items(v.pool, 'total'),
    givers: items(v.givers, 'amount').map((g) => ({ name: cardCupText(g.name, 40) || 'ブリーダー', icon: typeof g.icon === 'string' ? g.icon : null, item: g.item, amount: g.amount, host: g.host === true })),
    hosts: Array.isArray(v.hosts) ? v.hosts.filter((h) => h && typeof h.id === 'string').map((h) => ({ id: h.id, name: cardCupText(h.name, 40) || 'ブリーダー', icon: typeof h.icon === 'string' ? h.icon : null, state: h.state === 'joined' ? 'joined' : 'invited' })) : [],
    me: { host: !!(v.me && v.me.host), invited: !!(v.me && v.me.invited), claimed: !!(v.me && v.me.claimed) },
    code: typeof v.code === 'string' && /^[0-9]{6}$/.test(v.code) ? v.code : null,
    payouts: Array.isArray(v.payouts) ? items(v.payouts, 'amount').filter((x) => typeof x.id === 'string') : null,
  };
};
// 配る割合から、1人ずつの見込み(画面の「8人そろったら」「1位 ◯〜」)。サーバの card_cup_payouts と同じ数え方(使わない順位の分は1位へ・端数は1位へ)
const cardCupShares = (total, split, ranks) => {
  const k = Math.max(1, Math.min(split.length, ranks));
  const pct = split.slice(0, k);
  for (let i = k; i < split.length; i++) pct[0] += split[i];
  const each = pct.map((p) => Math.floor((total * p) / 100));
  each[0] += total - each.reduce((a, b) => a + b, 0);
  return each;
};
const CARD_CUP_SPLITS = Object.freeze([
  { id: 'all', label: '優勝が全部', split: [100] },
  { id: '73', label: '7:3', split: [70, 30] },
  { id: '631', label: '6:3:1', split: [60, 30, 10] },
  { id: '532', label: '5:3:2', split: [50, 30, 20] },
]);

// ---- 預ける・参加する・受け取る(画面から呼ぶ。adapters は 84 が渡す) ----
// adapters: { main: async (delta:[{item, amount(±)}], extra:[保存の項目]) → 真偽(本編の持ち物を足し引きし、extra も同じ取引で書く)
//             card: async (delta, extra) → 真偽(カードの持ち物)
//             gift: async (gift, extra) → 真偽(本編のギフトボックスへ1件。同じ id は二度入れない)
//             owner, key, name, icon }
const cardCupApply = async (adapters, item, amount, extra) => {
  const it = cardCupItemOf(item);
  if (!it) return false;
  const fn = it.card ? adapters.card : adapters.main;
  return typeof fn === 'function' ? !!(await fn([{ item, amount }], extra)) : false;
};
// 預けたあとのサーバの返事で、印を進める。戻すときは、持ち物を戻すのと印を同じ取引で書く
const cardCupDepositSettle = async (adapters, rec, reply) => {
  const kept = reply === 'ok' || reply === 'dup';
  if (kept) { await cardCupWalletSet({ ...rec, state: 'held', at: Date.now() }); return 'ok'; }
  if (reply === null || reply === undefined) return 'pending'; // 返事が無い: 印は sending のまま(次に開いたとき送り直す)
  const e = await cardCupWalletEntry({ ...rec, state: 'returned', at: Date.now() });
  if (!e) return 'pending';
  const back = await cardCupApply(adapters, rec.item, rec.amount, [e]);
  return back ? reply : 'pending';
};
// 主催・主催仲間が出す。返り値 'ok' | 'short'(足りない)| 'save'(保存できない)| 'pending'(返事待ち)| サーバの返事('over' など。戻した)
const cardCupGive = async (adapters, cup, item, amount, have) => {
  if (!(amount > 0) || amount > have) return 'short';
  const rec = { cup, kind: 'prize', item, amount, nonce: cardCupNonce(), state: 'sending', at: Date.now() };
  const e = await cardCupWalletEntry(rec);
  if (!e || !(await cardCupApply(adapters, item, -amount, [e]))) return 'save';
  const reply = await cardCupPrizeRpc('card_cup_deposit', { p_cup: cup, p_owner: adapters.owner, p_key: adapters.key, p_item: item, p_amount: amount, p_nonce: rec.nonce });
  return cardCupDepositSettle(adapters, rec, reply);
};
// 参加(参加費のある杯は払って)。fee … { item, amount } か null。返り値 'ok' | 'short' | 'save' | 'pending' | サーバの返事
const cardCupJoinPaid = async (adapters, cup, fee, have) => {
  if (!fee) {
    const r = await cardCupPrizeRpc('card_cup_join_pay', { p_cup: cup, p_owner: adapters.owner, p_key: adapters.key, p_name: adapters.name, p_icon: adapters.icon, p_nonce: cardCupNonce() });
    return r === 'nofee' || r === 'ok' ? 'ok' : (r || 'off');
  }
  if (fee.amount > have) return 'short';
  const rec = { cup, kind: 'fee', item: fee.item, amount: fee.amount, nonce: cardCupNonce(), state: 'sending', at: Date.now(), name: adapters.name, icon: adapters.icon || undefined };
  const e = await cardCupWalletEntry(rec);
  if (!e || !(await cardCupApply(adapters, fee.item, -fee.amount, [e]))) return 'save';
  const reply = await cardCupPrizeRpc('card_cup_join_pay', { p_cup: cup, p_owner: adapters.owner, p_key: adapters.key, p_name: adapters.name, p_icon: adapters.icon, p_nonce: rec.nonce });
  // 'nofee'(参加費がなくなった・主催仲間になっていた)・'paid'(前に払った分のまま入り直した)は、払った分を戻して参加できた扱い
  if (reply === 'nofee' || reply === 'paid') { const r = await cardCupDepositSettle(adapters, rec, 'refund'); return r === 'pending' ? 'pending' : 'ok'; }
  return cardCupDepositSettle(adapters, rec, reply);
};
// 返事が来なかった預けを、同じ nonce で送り直す(MFバトルカードの個人杯を開いたとき)。返り値: 進めた数
const cardCupResume = async (adapters) => {
  const list = await cardCupWalletLoad();
  let n = 0;
  for (const rec of list.filter((r) => r.state === 'sending')) {
    const reply = rec.kind === 'prize'
      ? await cardCupPrizeRpc('card_cup_deposit', { p_cup: rec.cup, p_owner: adapters.owner, p_key: adapters.key, p_item: rec.item, p_amount: rec.amount, p_nonce: rec.nonce })
      : await cardCupPrizeRpc('card_cup_join_pay', { p_cup: rec.cup, p_owner: adapters.owner, p_key: adapters.key, p_name: rec.name || adapters.name, p_icon: rec.icon || adapters.icon, p_nonce: rec.nonce });
    const r = rec.kind === 'fee' && (reply === 'nofee' || reply === 'paid') ? await cardCupDepositSettle(adapters, rec, 'refund') : await cardCupDepositSettle(adapters, rec, reply);
    if (r !== 'pending') n += 1;
  }
  for (const rec of list.filter((r) => r.kind === 'claim' && r.state === 'claiming')) { if ((await cardCupClaim(adapters, rec.cup, '')).status === 'ok') n += 1; }
  return n;
};
// 受け取る・戻す。返り値 { status:'ok'|'wait'|'elsewhere'|'none'|'pending'|'off', items:[{item, amount}], reason }
const cardCupClaim = async (adapters, cup, cupName) => {
  const list = await cardCupWalletLoad();
  let rec = list.find((r) => r.kind === 'claim' && r.cup === cup);
  if (rec && rec.state !== 'claiming') return { status: rec.state === 'claimed' ? 'ok' : rec.state, items: rec.items || [], reason: 'done' };
  if (!rec) {
    rec = { cup, kind: 'claim', nonce: cardCupNonce(), state: 'claiming', at: Date.now() };
    if (!(await cardCupWalletSet(rec))) return { status: 'pending', items: [] };
  }
  const r = await cardCupPrizeRpc('card_cup_claim', { p_cup: cup, p_owner: adapters.owner, p_key: adapters.key, p_nonce: rec.nonce });
  if (!r || typeof r !== 'object') return { status: 'pending', items: [] };
  if (r.status === 'wait') return { status: 'wait', items: [] };
  if (r.status === 'claimed') { await cardCupWalletSet({ ...rec, state: 'elsewhere', at: Date.now() }); return { status: 'elsewhere', items: [] }; }
  if (r.status !== 'ok') return { status: r.status || 'off', items: [] };
  const items = (Array.isArray(r.items) ? r.items : []).filter((x) => x && cardCupItemOf(x.item) && Number.isInteger(x.amount) && x.amount > 0);
  rec = { ...rec, items };
  if (!items.length) { await cardCupWalletSet({ ...rec, state: 'none', at: Date.now() }); return { status: 'none', items: [], reason: r.reason }; }
  // カードの持ち物 → 84 の保存で足す(印の card を同じ取引で立てる)
  const cards = items.filter((x) => cardCupItemOf(x.item).card);
  if (cards.length && !rec.card) {
    const e = await cardCupWalletEntry({ ...rec, card: true });
    if (!e || typeof adapters.card !== 'function' || !(await adapters.card(cards, [e]))) return { status: 'pending', items };
    rec = { ...rec, card: true };
  }
  // 本編の持ち物 → ギフトボックスへ1件(id は杯ごとに1つ。印の gift を同じ取引で立てる)
  const mains = items.filter((x) => cardCupItemOf(x.item).main).map((x) => cardCupGiftReward(x.item, x.amount)).filter(Boolean);
  if (mains.length && !rec.gift) {
    const gift = { id: `card_cup_${cup}`, title: `個人杯「${cardCupText(cupName, 20) || '個人杯'}」の${r.reason === 'refund' ? '返却' : 'ごほうび'}`, source: 'cardCup', rewards: mains };
    const e = await cardCupWalletEntry({ ...rec, gift: true });
    if (!e || typeof adapters.gift !== 'function' || !(await adapters.gift(gift, [e]))) return { status: 'pending', items };
    rec = { ...rec, gift: true };
  }
  await cardCupWalletSet({ ...rec, state: 'claimed', at: Date.now() });
  return { status: 'ok', items, reason: r.reason };
};
