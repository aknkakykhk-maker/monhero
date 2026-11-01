// ===== MFバトルカード 個人杯: ごほうび・参加費・主催仲間の部品(2026-10-31 リプレイくん・社長の判断) =====
// 案: docs/progress/card-tournament/personal-cup/prize/README.md / SQL: docs/sql/card-cup/CARD_CUP_PRIZE_APPLY.sql / 仕様: docs/spec/CARD_CUP.md
//   ・主催・主催仲間が自分の持ち物から出す / 参加費(なしでもよい)。どちらもサーバで預かり、終わったら配る(ギフトボックスへ)
//   ・持ち物は端末にあるので、「端末で減らす」と「送っている途中の印」を同じ取引で書き、サーバは nonce ごとに1回だけ数える。
//     返事が来なければ、次に開いたとき同じ nonce で送り直す。受け取りもサーバが最初の nonce だけに中身を返す(二重に受け取れない)
//   ・本編の持ち物(ダイヤ・アイテム・ビートP)は本編の画面(60-app)が状態を持っているので、減らす・ギフトを足すのは 60-app の口(onCupItems)で。
//     カードの持ち物(かけら・パック券・カタログ)は 84 の保存(persist)で
// 保存: 新しいキー mh_card_cup_wallet_v1 だけ(下)。今のキーは、今の形のまま足す・引くだけ

// 公開の印(ごほうび・参加費・主催仲間だけ)。個人杯の公開(99-card-cup の cardCupOpen)とは別。
// 2026-10-31 社長: 個人杯だけ先に公開し、ごほうび・参加費・主催仲間はまだ閉じる(出す日はあとで決める)。それまではデバッグ設定から入ったときだけ出る(84 が口 getAdapters を渡すかで決める)
// 2026-10-31 社長「個人杯のごほうび・参加費・主催仲間をすぐ使えるようにする」で true に
const cardCupPrizeOpen = () => true;
const CARD_CUP_WALLET_KEY = 'mh_card_cup_wallet_v1';
const CARD_CUP_WALLET_MAX = 200;
// 出せる物(サーバの表 card_cup_prize_items と同じ名前)。label・emoji は画面の名前。出す量・参加費の額に上限は無い(2026-10-31 社長「やっぱり上限はなしでいい」)
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
  return Array.isArray(r) ? r.filter((x) => x && cardCupItemOf(x.item)).map((x) => ({ item: x.item, label: cardCupItemOf(x.item).label })) : null;
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

// ==================== 画面: 杯のごほうびの欄(99-card-cup の CardCupDetail の中に出す) ====================
// 見せる: いまのごほうび(主催・主催仲間が出した物 + 集まった参加費)・参加費・配る割合と見込み
// 主催・主催仲間(受付中): 出す物を足す・参加費と割合を決める(参加費を払った人がいると変えられない)・主催仲間を誘う/外す・合言葉
// 誘われた人: 受ける・断る / 終わった・取り消された杯: 受け取る(1回だけ・ギフトボックスへ)
// getAdapters … 84 の cupAdapters(持ち物を足し引きする口と、持ち主の鍵)。prize・reload … 84 側で読んだごほうび(cardCupPrizeView)と読み直し
const CARD_CUP_PRIZE_MSG = Object.freeze({
  ok: 'できました', short: '持っている数が足りません', save: 'この端末に保存できませんでした', pending: '通信が途切れました。次に開いたとき、もう一度送ります(持ち物は預けたままです)',
  closed: '受付は終わりました', locked: 'デッキを登録した端末でだけできます', bad: '内容を確かめてください', paid: '参加費を払った人がいるので、もう変えられません',
  notfriend: 'フレンドだけ誘えます', host: '主催は外せません', none: 'もう返事をしています', full: '人数がいっぱいです', many: '出ている個人杯が3つあります', nodeck: 'デッキ登録をしてから参加してください', off: '通信できませんでした。もう一度お試しください',
  nothing: 'この個人杯で受け取る物はありません', elsewhere: 'ほかの端末で受け取り済みです', got: '受け取りました。本編の持ち物はギフトボックスから受け取ってください', wait: 'まだ受け取れません(結果が出てから)',
});
const CardCupPrizePanel = ({ c, v, now, selfId, prize, reload, getAdapters }) => {
  const [items, setItems] = useState(null);       // 出せる物(サーバの表)
  const [have, setHave] = useState(null);         // { main, card } いまの持ち物
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [pick, setPick] = useState(null);         // 出す物をえらぶ: { item, amount }
  const [feeItem, setFeeItem] = useState('');
  const [feeAmount, setFeeAmount] = useState(0);
  const [split, setSplit] = useState(null);
  const [friends, setFriends] = useState(null);
  const [claimed, setClaimed] = useState(null);   // 受け取った中身(この端末で)
  const open = c.status === 'entry' && now < c.entryUntil;
  const hostish = !!(prize && prize.me.host);
  useEffect(() => { void cardCupPrizeItemsList().then(setItems); }, []);
  const refreshHave = async () => { try { const a = await getAdapters(); setHave(a.have); return a; } catch (_) { return null; } };
  useEffect(() => { void (async () => { const a = await refreshHave(); if (a && a.owner && a.key) { const n = await cardCupResume(a); if (n) await reload(); } })(); }, [c.id]);
  useEffect(() => { void cardCupWalletLoad().then((w) => { const r = w.find((x) => x.kind === 'claim' && x.cup === c.id && x.state === 'claimed'); if (r) setClaimed(r.items || []); }); }, [c.id]);
  useEffect(() => { if (prize) { setFeeItem(prize.fee ? prize.fee.item : ''); setFeeAmount(prize.fee ? prize.fee.amount : 0); setSplit(prize.split); } }, [prize && JSON.stringify([prize.fee, prize.split])]);
  if (!prize) return null;
  const run = async (fn) => {
    if (busy) return;
    setBusy(true); setMsg('');
    try { const r = await fn(); setMsg(CARD_CUP_PRIZE_MSG[r] || CARD_CUP_PRIZE_MSG.off); await refreshHave(); await reload(); } finally { setBusy(false); }
  };
  const haveOf = (item) => cardCupHave(item, have && have.main, have && have.card);
  // 見込み: 参加者(主催・主催仲間を除く)が定員までそろったとき
  const hostIds = new Set([c.hostId, ...prize.hosts.filter((h) => h.state === 'joined').map((h) => h.id)]);
  const players = Math.max(1, c.max - v.entries.filter((e) => hostIds.has(e.ownerId)).length - (v.entries.some((e) => e.ownerId === c.hostId) ? 0 : 1));
  const poolFull = prize.pool.map((p) => ({ ...p, total: p.total + (prize.fee && prize.fee.item === p.item ? prize.fee.amount * Math.max(0, players - v.entries.filter((e) => !hostIds.has(e.ownerId)).length) : 0) }));
  if (prize.fee && !poolFull.some((p) => p.item === prize.fee.item)) poolFull.push({ item: prize.fee.item, total: prize.fee.amount * players });
  const shares = (total) => cardCupShares(total, prize.split, players);
  const giveOptions = items || [];
  const feeOptions = items || [];
  const chip = (on) => `rounded-full border px-2.5 py-1 text-[12px] font-black ${on ? 'border-amber-300 bg-amber-500/30 text-amber-50' : 'border-white/15 bg-slate-900 text-slate-300'}`;
  const shown = c.status === 'done' && (c.mode === 'live' || now >= c.startAt);
  const myPay = prize.payouts ? prize.payouts.filter((p) => p.id === selfId) : [];
  const canClaim = (shown || c.status === 'closed') && !claimed;
  return (
    <div data-card-cup-prize className="space-y-2 rounded-2xl border-2 border-amber-500/60 bg-slate-950/70 p-2.5">
      <b className="block text-[13px] font-black text-amber-200">ごほうび</b>
      {!prize.pool.length && !prize.fee && <p className="text-[12px] font-bold text-slate-400">この個人杯にはごほうびはありません(ランキングにも入りません)</p>}
      {prize.pool.map((p) => <div key={p.item} data-card-cup-pool={p.item} className="flex items-center justify-between text-[13px] font-black text-white"><span>{cardCupItemText(p.item, 0).replace(/ 0$/, '')}</span><span className="text-amber-200">{p.total.toLocaleString()}</span></div>)}
      {/* 出した人は1人1行(2026-11-01 点検。1行につなげると名前と品の切れ目が分かりにくかった) */}
      {prize.givers.length > 0 && <div data-card-cup-givers className="text-[11px] font-bold text-slate-400">
        <p>出した人</p>
        <ul className="mt-0.5 space-y-0.5">{prize.givers.map((g, i) => (
          <li key={i} data-card-cup-giver className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-4 shrink-0 text-center">{g.icon || '🙂'}</span>
            <span className="min-w-0 flex-1 truncate text-slate-300">{g.name}</span>
            {g.host && <span className="shrink-0 rounded bg-amber-400/20 px-1 text-[10px] text-amber-200">主催</span>}
            <span className="shrink-0 whitespace-nowrap text-slate-200">{cardCupItemText(g.item, g.amount)}</span>
          </li>))}</ul>
      </div>}
      {prize.fee && <p data-card-cup-fee className="text-[12px] font-black text-sky-100">{`参加費 ${cardCupItemText(prize.fee.item, prize.fee.amount)}(主催・主催仲間は払いません)`}</p>}
      {(prize.pool.length > 0 || prize.fee) && (
        <div data-card-cup-split className="space-y-0.5 text-[12px] font-bold text-slate-200">
          {prize.split.map((pct, i) => <div key={i} className="flex justify-between gap-2"><span className="shrink-0 whitespace-nowrap">{`${i + 1}位 ${pct}%`}</span><span className="min-w-0 text-right text-slate-300">{(() => { const t = poolFull.map((p) => { const s = shares(p.total)[i] || 0; return s > 0 ? cardCupItemText(p.item, s) : null; }).filter(Boolean); return t.length ? t.map((x, k) => <span key={k} className="whitespace-nowrap">{`${x}${k < t.length - 1 ? '・' : ''}`}</span>) : '−'; })()}</span></div>)}
          <p className="text-[11px] text-slate-400">{`${players}人そろったときの見込み。主催・主催仲間は受け取りません(その分は次の順位の人へ)`}</p>
        </div>
      )}
      {prize.me.invited && open && (
        <div data-card-cup-invited className="space-y-1.5 rounded-xl bg-amber-500/15 p-2">
          <p className="text-[12px] font-black text-amber-100">主催仲間に誘われています</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" data-card-cup-cohost-accept disabled={busy} onClick={() => run(async () => { const a = await getAdapters(); return cardCupPrizeRpc('card_cup_cohost_answer', { p_cup: c.id, p_owner: a.owner, p_key: a.key, p_accept: true, p_name: a.name, p_icon: a.icon }); })} className="rounded-xl bg-amber-400 py-2 text-[13px] font-black text-slate-950">受ける</button>
            <button type="button" data-card-cup-cohost-decline disabled={busy} onClick={() => run(async () => { const a = await getAdapters(); return cardCupPrizeRpc('card_cup_cohost_answer', { p_cup: c.id, p_owner: a.owner, p_key: a.key, p_accept: false, p_name: a.name, p_icon: a.icon }); })} className="rounded-xl border border-white/20 bg-slate-800 py-2 text-[13px] font-black text-slate-200">断る</button>
          </div>
        </div>
      )}
      {hostish && open && (<>
        {prize.code && !v.me && <p data-card-cup-cohost-code className="text-[13px] font-black text-amber-200">合言葉 <span className="text-[18px] tracking-[0.3em] text-amber-100">{prize.code}</span></p>}
        <div data-card-cup-give className="space-y-1.5 rounded-xl bg-white/5 p-2">
          <b className="block text-[12px] font-black text-slate-200">出す物を足す(あなたの持ち物から預ける)</b>
          <div className="flex flex-wrap gap-1">{giveOptions.map((x) => <button key={x.item} type="button" data-card-cup-give-item={x.item} onClick={() => setPick({ item: x.item, amount: haveOf(x.item) })} className={chip(pick && pick.item === x.item)}>{cardCupItemOf(x.item).emoji} {x.label}</button>)}</div>
          {pick && (
            <div className="flex items-center gap-1.5">
              <input data-card-cup-give-amount inputMode="numeric" value={pick.amount} onChange={(e) => setPick({ ...pick, amount: Math.max(0, Math.floor(Number(String(e.target.value).replace(/[^0-9]/g, '')) || 0)) })} className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-[14px] font-black text-white"/>
              <small className="min-w-0 flex-1 text-[11px] font-bold text-slate-400">{`持っている ${haveOf(pick.item).toLocaleString()}`}</small>
              <button type="button" data-card-cup-give-go disabled={busy || !(pick.amount > 0)} onClick={() => run(async () => { const a = await getAdapters(); if (!a.owner || !a.key) return 'locked'; return cardCupGive(a, c.id, pick.item, pick.amount, haveOf(pick.item)); })} className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-[13px] font-black text-slate-950 disabled:opacity-50">預ける</button>
            </div>
          )}
        </div>
        <div data-card-cup-fee-set className="space-y-1.5 rounded-xl bg-white/5 p-2">
          <b className="block text-[12px] font-black text-slate-200">参加費と配る割合</b>
          <div className="flex flex-wrap gap-1">
            <button type="button" data-card-cup-fee-item="" onClick={() => { setFeeItem(''); setFeeAmount(0); }} className={chip(!feeItem)}>なし</button>
            {feeOptions.map((x) => <button key={x.item} type="button" data-card-cup-fee-item={x.item} onClick={() => { setFeeItem(x.item); setFeeAmount(Math.max(1, feeAmount)); }} className={chip(feeItem === x.item)}>{cardCupItemOf(x.item).emoji} {x.label}</button>)}
          </div>
          {feeItem && <div className="flex items-center gap-1.5"><input data-card-cup-fee-amount inputMode="numeric" value={feeAmount} onChange={(e) => setFeeAmount(Math.max(0, Math.floor(Number(String(e.target.value).replace(/[^0-9]/g, '')) || 0)))} className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-[14px] font-black text-white"/><small className="text-[11px] font-bold text-slate-400">参加する人が払う量</small></div>}
          <div className="flex flex-wrap gap-1">{CARD_CUP_SPLITS.map((s) => <button key={s.id} type="button" data-card-cup-split-pick={s.id} onClick={() => setSplit(s.split)} className={chip(split && split.join() === s.split.join())}>{s.label}</button>)}</div>
          <input data-card-cup-split-custom value={(split || []).join(',')} onChange={(e) => setSplit(String(e.target.value).split(/[,、・\s]+/).map((x) => Math.floor(Number(x))).filter((x) => x > 0).slice(0, 8))} placeholder="自分で決める(例 60,30,10)" className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-[13px] font-bold text-white"/>
          <small className="block text-[11px] font-bold text-slate-400">{`1位から順に・合計100%(いま ${(split || []).reduce((a, b) => a + b, 0)}%)`}</small>
          <button type="button" data-card-cup-fee-go disabled={busy || !split || split.reduce((a, b) => a + b, 0) !== 100} onClick={() => run(async () => { const a = await getAdapters(); return cardCupPrizeRpc('card_cup_prize_set', { p_cup: c.id, p_owner: a.owner, p_key: a.key, p_fee_item: feeItem || null, p_fee_amount: feeItem ? feeAmount : 0, p_split: split }); })} className="w-full rounded-lg bg-amber-400 py-1.5 text-[13px] font-black text-slate-950 disabled:opacity-50">この内容で決める</button>
        </div>
        <div data-card-cup-cohosts className="space-y-1 rounded-xl bg-white/5 p-2">
          <b className="block text-[12px] font-black text-slate-200">主催仲間(フレンドから何人でも。杯の取り消しは主催だけ)</b>
          {prize.hosts.map((h) => <div key={h.id} data-card-cup-cohost={h.id} className="flex items-center gap-2 text-[12px] font-bold text-slate-200"><span className="min-w-0 flex-1 truncate">{`${h.name}${h.state === 'invited' ? '(返事待ち)' : ''}`}</span><button type="button" data-card-cup-cohost-remove={h.id} disabled={busy} onClick={() => run(async () => { const a = await getAdapters(); return cardCupPrizeRpc('card_cup_cohost_remove', { p_cup: c.id, p_owner: a.owner, p_key: a.key, p_target: h.id }); })} className="shrink-0 rounded-md border border-white/15 px-2 py-0.5 text-[11px] font-black text-slate-300">外す</button></div>)}
          {friends === null
            ? <button type="button" data-card-cup-friends onClick={() => { void (async () => { setFriends([]); setFriends(typeof sbFetchFriendRoster === 'function' ? await sbFetchFriendRoster(selfId).catch(() => []) : []); })(); }} className="w-full rounded-lg border border-sky-400/60 bg-sky-950 py-1.5 text-[12px] font-black text-sky-100">フレンドから誘う</button>
            : friends.filter((f) => f.otherId !== c.hostId && !prize.hosts.some((h) => h.id === f.otherId)).map((f) => <div key={f.otherId} className="flex items-center gap-2 text-[12px] font-bold text-slate-200"><span className="min-w-0 flex-1 truncate">{f.userName}</span><button type="button" data-card-cup-cohost-invite={f.otherId} disabled={busy} onClick={() => run(async () => { const a = await getAdapters(); return cardCupPrizeRpc('card_cup_cohost_invite', { p_cup: c.id, p_owner: a.owner, p_key: a.key, p_friend: f.otherId }); })} className="shrink-0 rounded-md bg-sky-500 px-2 py-0.5 text-[11px] font-black text-slate-950">誘う</button></div>)}
        </div>
      </>)}
      {shown && myPay.length > 0 && !claimed && <p data-card-cup-mypay className="text-[13px] font-black text-amber-100">{`あなたのごほうび: ${myPay.map((p) => cardCupItemText(p.item, p.amount)).join('・')}`}</p>}
      {canClaim && (prize.me.claimed ? <p className="text-[12px] font-bold text-slate-400">受け取り済みです</p> : (
        <button type="button" data-card-cup-claim disabled={busy} onClick={() => run(async () => { const a = await getAdapters(); if (!a.owner || !a.key) return 'locked'; const r = await cardCupClaim(a, c.id, c.name); if (r.status === 'ok' || r.status === 'none') setClaimed(r.items); return { ok: r.items.length ? 'got' : 'nothing', none: 'nothing', wait: 'wait', elsewhere: 'elsewhere', pending: 'pending' }[r.status] || 'off'; })}
          className="w-full rounded-xl bg-gradient-to-b from-amber-300 to-orange-500 py-2 text-[14px] font-black text-slate-950">{c.status === 'closed' ? '預けた物を戻す(ギフトボックスへ)' : 'ごほうびを受け取る(ギフトボックスへ)'}</button>
      ))}
      {claimed && <p data-card-cup-claimed className="text-[12px] font-black text-emerald-200" style={JA_WRAP_STYLE}>{jaWrap(claimed.length ? `受け取りました: ${claimed.map((x) => cardCupItemText(x.item, x.amount)).join('・')}(本編の持ち物はギフトボックスから)` : 'この個人杯で受け取る物はありません')}</p>}
      {msg && <p data-card-cup-prize-msg className="rounded-lg bg-slate-900 p-1.5 text-[12px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(msg)}</p>}
    </div>
  );
};
