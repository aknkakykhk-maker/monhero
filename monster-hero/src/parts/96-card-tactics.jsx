// ==================== 戦術カード(持ち物・枠)と MFバトルカードのレベル・戦術カードのガチャ ====================
// 2026-10-29 社長: 戦術カードはガンビット型(中身は 82-card-tactics-core)。ガチャ(1回300ビートPで8枚。パックと同じ)で集め、
//   MFバトルカード用のレベル(上限なし・全員 Lv1 から)で枠が開く。
// ★保存は新しいキーだけ(mh_card_tactics_v1・mh_card_level_v1)。今のキーには触らない。
//   どちらも CARD_SAVE_KEYS には入れない(デバッグの「記録を消す」で、ビートPで引いたカードやレベルを消さないように)
// 公開の印: cardTacticsOpen()。false のあいだは経験値も入れない(公開のときに全員 Lv1 から)。デバッグの人は見える・入る
const CARD_TACTICS_KEY = 'mh_card_tactics_v1';
const CARD_LEVEL_KEY = 'mh_card_level_v1';
const cardTacticsOpen = () => false;

// ---- レベル ----
// 次のレベルまでに要る経験値(2026-10-29 社長「20+3×Lv」・上限なし)。差し替えるのはここだけ
const cardLevelNeed = (lv) => 20 + 3 * lv;
// 1試合の経験値(助手と対戦・みんなのデッキは選んだ強さで。マルチは多め)。投了・切断・練習は 0。その日はじめての勝ちは +30
const CARD_LEVEL_XP = Object.freeze({
  easy: { win: 20, lose: 8 }, normal: { win: 30, lose: 12 }, hard: { win: 40, lose: 16 }, expert: { win: 50, lose: 20 }, master: { win: 60, lose: 24 },
  pvp: { win: 100, lose: 40 }, firstWin: 30,
});
// 枠が開くレベル(2026-10-29 社長の決め・ツナグ案)。{ base(基本カード), breeder(ブリーダーの行), mon(モンスター1体ごとの行) }
const CARD_LEVEL_FRAMES = Object.freeze([
  { at: 1, base: 1, breeder: 1, mon: 2 }, { at: 5, mon: 3 }, { at: 10, base: 2 }, { at: 15, breeder: 2, mon: 4 },
  { at: 20, breeder: 3 }, { at: 25, mon: 5 }, { at: 30, base: 3 },
]);
const cardLevelFrames = (lv) => CARD_LEVEL_FRAMES.filter((x) => lv >= x.at).reduce((a, x) => ({ ...a, ...Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'at')) }), {});
// 次に開く枠(画面に「次は Lv◯ で…」と出す)。無ければ null
const cardLevelNextFrame = (lv) => CARD_LEVEL_FRAMES.find((x) => x.at > lv) || null;
// 引く券をもらうレベル: Lv3・Lv10、Lv20 から先は5レベルごと(上限なし)。1枚 = ガチャ1回(8枚)。ビートPには換えられない
const cardLevelTicketAt = (lv) => lv === 3 || lv === 10 || (lv >= 20 && lv % 5 === 0);
// 壊れた経験値(数でない・無限・負)は0として数える(ブリーダーレベルと同じ守り方。ループが止まらなくならない)
const cardLevelSafeXp = (xp) => { const n = Number(xp); return Number.isFinite(n) ? Math.min(Math.max(0, Math.floor(n)), Number.MAX_SAFE_INTEGER) : 0; };
const cardLevelInfo = (xp) => {
  let left = cardLevelSafeXp(xp), level = 1;
  for (;;) { const need = cardLevelNeed(level); if (left < need) return { level, into: left, need }; left -= need; level += 1; }
};
// { v:1, xp, day(その日はじめての勝ちを数えた日 JST), dayWin, got:[引く券を配ったレベル] }
const cardNormalizeLevel = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const got = Array.isArray(r.got) ? [...new Set(r.got.filter((n) => Number.isInteger(n) && n > 1))].sort((a, b) => a - b) : [];
  return { v: 1, xp: cardLevelSafeXp(r.xp), day: typeof r.day === 'string' ? r.day.slice(0, 10) : '', dayWin: r.dayWin === true, got };
};
// kind … 'cpu'(助手と対戦・みんなのデッキ。level は選んだ強さ)/ 'pvp'
const cardLevelXpOf = ({ kind, level, outcome }) => {
  if (outcome !== 'win' && outcome !== 'lose') return 0;
  const t = kind === 'pvp' ? CARD_LEVEL_XP.pvp : CARD_LEVEL_XP[level];
  return t ? t[outcome] : 0;
};
// 経験値を足した次の値と、新しくもらう引く券の数
const cardLevelAfter = (prev, { kind, level, outcome, today }) => {
  const cur = cardNormalizeLevel(prev);
  const lv0 = cardLevelInfo(cur.xp).level;
  let add = cardLevelXpOf({ kind, level, outcome });
  if (!add) return { next: cur, tickets: 0, add: 0, from: lv0, to: lv0 };
  const sameDay = cur.day === today;
  if (outcome === 'win' && !(sameDay && cur.dayWin)) add += CARD_LEVEL_XP.firstWin;
  const xp = cardLevelSafeXp(cur.xp + add);
  const to = cardLevelInfo(xp).level;
  const got = [...cur.got];
  let tickets = 0;
  for (let lv = 2; lv <= to; lv++) if (cardLevelTicketAt(lv) && !got.includes(lv)) { got.push(lv); tickets += 1; }
  return { next: { ...cur, xp, day: today, dayWin: (sameDay && cur.dayWin) || outcome === 'win', got }, tickets, add, from: lv0, to };
};

// ---- 持ち物と枠 ----
// { v:1, own:{ カードid: 枚数 }, frames(82 の cardTacticNormalizeFrames の形), shards(かけら), tickets(引く券), pulls(引いた回数), dry(SR が出ないまま引いた回数) }
// はじめに配る10枚(CARD_TACTIC_START)は、保存に無くても持っている扱い(配る書き込みが要らない)。知らないカードidは消さずに残す
const cardTacticsInt = (n, max = 1e9) => (Number.isFinite(Number(n)) ? Math.min(max, Math.max(0, Math.floor(Number(n)))) : 0);
const cardNormalizeTactics = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const own = {};
  if (r.own && typeof r.own === 'object' && !Array.isArray(r.own)) Object.entries(r.own).forEach(([id, n]) => { const k = cardTacticsInt(n, 999); if (id && id.length <= 64 && k > 0) own[id] = k; });
  return { v: 1, own, frames: cardTacticNormalizeFrames(r.frames), shards: cardTacticsInt(r.shards), tickets: cardTacticsInt(r.tickets), pulls: cardTacticsInt(r.pulls), dry: cardTacticsInt(r.dry, 99) };
};
const cardTacticsOwns = (t, id) => CARD_TACTIC_START.includes(id) || ((t && t.own && t.own[id]) || 0) > 0;
// 戦いに使う枠: 持っていないカード・開いていない枠は外す(保存の値はそのまま。レベルが上がれば戻る)
const cardTacticsFramesForBattle = (t, lv) => {
  const f = cardTacticNormalizeFrames(t && t.frames);
  const n = cardLevelFrames(lv);
  const owns = (id) => cardTacticsOwns(t, id);
  const rows = (list, max) => list.filter((r) => owns(r.c) && owns(r.a)).slice(0, max);
  return { base: f.base.map((id, i) => (id && i < n.base && owns(id) ? id : null)), breeder: rows(f.breeder, n.breeder), mons: f.mons.map((list) => rows(list, n.mon)) };
};

// ---- ガチャ(1回300ビートPで8枚・5回まとめて1,350。N70%・R25%・SR5%)・かけら・引く券 ----
// パック(89)にそろえる: SR が出ないまま7回引いたら、8回目の最後の1枚は SR(天井)。はじめに配る10枚は出ない。
// だぶりは「かけら」1個(ビートPには戻さない)。かけら10個で、まだ持っていないカードを1枚えらべる
const CARD_TACTICS_PULL = Object.freeze({ n: 8, price: 300, bundle: Object.freeze({ n: 5, price: 1350 }), pityAt: 7 });
const CARD_TACTICS_RATE = Object.freeze([['N', 0.7], ['R', 0.25], ['SR', 0.05]]);
const CARD_TACTICS_SHARD_COST = 10;
const cardTacticsPool = (r) => CARD_TACTIC_CARDS.filter((c) => c.r === r && !c.start);
const cardTacticsPrice = (count) => (count === CARD_TACTICS_PULL.bundle.n ? CARD_TACTICS_PULL.bundle.price : CARD_TACTICS_PULL.price * count);
// 1回(8枚)引く。t は cardNormalizeTactics の形。{ next, cards:[{ id, r, dup, isNew }] }
const cardTacticsPullOnce = (t, rand = Math.random) => {
  let cur = t;
  const cards = [];
  const pity = cur.dry >= CARD_TACTICS_PULL.pityAt;
  for (let k = 0; k < CARD_TACTICS_PULL.n; k++) {
    let r = 'N';
    if (pity && k === CARD_TACTICS_PULL.n - 1) r = 'SR';
    else { const x = rand(); let acc = 0; for (const [q, p] of CARD_TACTICS_RATE) { acc += p; if (x < acc) { r = q; break; } } }
    const pool = cardTacticsPool(r);
    const card = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
    const dup = cardTacticsOwns(cur, card.id);
    cur = { ...cur, own: { ...cur.own, [card.id]: Math.min(999, (cur.own[card.id] || 0) + 1) }, shards: cur.shards + (dup ? 1 : 0) };
    cards.push({ id: card.id, r: card.r, dup });
  }
  const sr = cards.some((c) => c.r === 'SR');
  return { next: { ...cur, pulls: cur.pulls + 1, dry: sr ? 0 : cur.dry + 1 }, cards };
};
// count 回引く。payWith … 'point'(ビートP)か 'ticket'(引く券。1枚=1回)。足りなければ null
const cardTacticsPull = (t, count, { payWith = 'point', point = 0 } = {}, rand = Math.random) => {
  if (!Number.isInteger(count) || count < 1) return null;
  const cost = payWith === 'ticket' ? 0 : cardTacticsPrice(count);
  if (payWith === 'ticket' ? t.tickets < count : point < cost) return null;
  let cur = payWith === 'ticket' ? { ...t, tickets: t.tickets - count } : t;
  const packs = [];
  for (let i = 0; i < count; i++) { const one = cardTacticsPullOnce(cur, rand); cur = one.next; packs.push(one.cards); }
  return { next: cur, packs, cost };
};
// かけらで1枚えらぶ(持っていないカードだけ)。できなければ null
const cardTacticsExchange = (t, id) => {
  const c = cardTacticOf(id);
  if (!c || cardTacticsOwns(t, id) || t.shards < CARD_TACTICS_SHARD_COST) return null;
  return { ...t, own: { ...t.own, [id]: 1 }, shards: t.shards - CARD_TACTICS_SHARD_COST };
};

// ---- 保存(画面から呼ぶ) ----
const cardTacticsLoad = async () => {
  let rawT = null, rawL = null;
  try { [rawT, rawL] = await Promise.all([storeGet(CARD_TACTICS_KEY, null), storeGet(CARD_LEVEL_KEY, null)]); } catch (_) { /* 読めなければ空 */ }
  const level = cardNormalizeLevel(rawL);
  return { tactics: cardNormalizeTactics(rawT), level, info: cardLevelInfo(level.xp), rawT, rawL };
};
// 1試合ぶんの経験値の保存の項目(84 の結果の取引に足す)。経験値を入れない人(公開前・デバッグでない)は空
const cardLevelEntries = async ({ kind, level, outcome, debug = false }) => {
  if (!cardTacticsOpen() && !debug) return { entries: [], gain: null };
  let rawL = null, rawT = null;
  try { [rawL, rawT] = await Promise.all([storeGet(CARD_LEVEL_KEY, null), storeGet(CARD_TACTICS_KEY, null)]); } catch (_) { return { entries: [], gain: null }; }
  const gain = cardLevelAfter(rawL, { kind, level, outcome, today: typeof cardTodayJst === 'function' ? cardTodayJst() : '' });
  if (!gain.add) return { entries: [], gain };
  const entries = [{ key: CARD_LEVEL_KEY, before: rawL, next: gain.next }];
  if (gain.tickets) { const t = cardNormalizeTactics(rawT); entries.push({ key: CARD_TACTICS_KEY, before: rawT, next: { ...t, tickets: t.tickets + gain.tickets } }); }
  return { entries, gain };
};
