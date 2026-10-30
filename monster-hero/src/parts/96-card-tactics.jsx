// ==================== 戦術カード(持ち物・枠)と MFバトルカードのレベル・戦術カードのガチャ ====================
// 2026-10-29 社長: 戦術カードはガンビット型(中身は 82-card-tactics-core)。ガチャ(1回300ビートPで8枚。パックと同じ)で集め、
//   MFバトルカード用のレベル(上限なし・全員 Lv1 から)で枠が開く。
// ★保存は新しいキーだけ(mh_card_tactics_v1・mh_card_level_v1)。今のキーには触らない。
//   どちらも CARD_SAVE_KEYS には入れない(デバッグの「記録を消す」で、ビートPで引いたカードやレベルを消さないように)
// 公開の印: cardTacticsOpen()。false のあいだは経験値も入れない(公開のときに全員 Lv1 から)。デバッグの人は見える・入る
const CARD_TACTICS_KEY = 'mh_card_tactics_v1';
const CARD_LEVEL_KEY = 'mh_card_level_v1';
const cardTacticsOpen = () => true;

// ---- レベル ----
// 2026-10-29 社長: 画面の名前は「カードランク」(モンヒロビートの「ビートランク」と対)。保存キー・中の名前(level)はそのまま。
// 次のランクまでに要る経験値は、ビートランクと同じ式(18-player-rank の playerRankNeed。20+3×ランク・上限なし)
const cardLevelNeed = (lv) => playerRankNeed(lv);
// 1試合の経験値(2026-10-29 社長「経験値のベースをビートに合わせる。マルチはビートのヘルに」)。
//   勝ち … ビートの難易度と同じ数。負け … 勝ちの3分の1(切り上げ)。投了・切断・練習は 0。その日はじめての勝ちは +30
const CARD_LEVEL_XP = Object.freeze({
  easy: { win: 6, lose: 2 }, normal: { win: 8, lose: 3 }, hard: { win: 10, lose: 4 }, expert: { win: 14, lose: 5 }, master: { win: 18, lose: 6 },
  pvp: { win: 60, lose: 20 }, firstWin: 30,
});
// 枠が開くレベル(2026-10-29 社長の決め・ツナグ案)。{ base(基本カード), breeder(ブリーダーの行), mon(モンスター1体ごとの行) }
const CARD_LEVEL_FRAMES = Object.freeze([
  { at: 1, base: 1, breeder: 1, mon: 2 }, { at: 5, mon: 3 }, { at: 10, base: 2 }, { at: 15, breeder: 2, mon: 4 },
  { at: 20, breeder: 3 }, { at: 25, mon: 5 }, { at: 30, base: 3 },
]);
const cardLevelFrames = (lv) => CARD_LEVEL_FRAMES.filter((x) => lv >= x.at).reduce((a, x) => ({ ...a, ...Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'at')) }), {});
// ランクで増える分を、ふだんの言葉で(ランクアップの演出・これからもらえる物)。done … 「なった」/「なる」
//   2026-10-30 社長「文言おかしい」(前は「戦術カードを置ける所が増えた」)。「置ける所」「枠」「行」は使わない
const cardLevelFrameText = (f, done = true) => {
  const parts = [];
  if (f.base) parts.push(`基本カードを${f.base}枚`);
  if (f.breeder) parts.push(`ブリーダーの戦術カードを${f.breeder}枚`);
  if (f.mon) parts.push(f.breeder ? `モンスターごとに${f.mon}枚まで` : `モンスターごとに戦術カードを${f.mon}枚まで`);
  return `${parts.join('・')}セットできるように${done ? 'なった' : 'なる'}`;
};
// 次に開く枠(画面に「次は Lv◯ で…」と出す)。無ければ null
const cardLevelNextFrame = (lv) => CARD_LEVEL_FRAMES.find((x) => x.at > lv) || null;
// ランクが上がったときのごほうび(2026-10-29 社長の作り直し。前の「Lv3・10・20から5ごとに引く券」はやめた)。
//   1つ上がるたび ビートP「ランク×100」、5ランクごとに さらに ビートP「ランク×200」+カードパック券1枚
//   ビートPの数はビートランクと同じ式(playerRankBeatPointsFor)。カードパック券は tactics の tickets に足す
//   (バトルカードのパックにも戦術カードのパックにも使える券。以前の「引く券」もそのままこの券として使える)
const CARD_RANK_PACK_TICKETS = 1;
const cardRankRewardOf = (lv) => ({ point: playerRankBeatPointsFor(lv), tickets: lv % 5 === 0 ? CARD_RANK_PACK_TICKETS : 0 });
const cardRankRewardText = (lv) => { const r = cardRankRewardOf(lv); return `ビートP ${r.point.toLocaleString()}${r.tickets ? `・カードパック券 ${r.tickets}枚` : ''}`; };
// 壊れた経験値(数でない・無限・負)は0として数える(ブリーダーレベルと同じ守り方。ループが止まらなくならない)
const cardLevelSafeXp = (xp) => { const n = Number(xp); return Number.isFinite(n) ? Math.min(Math.max(0, Math.floor(n)), Number.MAX_SAFE_INTEGER) : 0; };
const cardLevelInfo = (xp) => { const r = playerRankInfo(cardLevelSafeXp(xp)); return { level: r.rank, into: r.into, need: r.need }; };
// { v:1, xp, day(その日はじめての勝ちを数えた日 JST), dayWin, got:[ごほうびを配ったランク] }
//   got には、以前の「引く券」を配ったレベル(3 など)も入っている。同じランクのごほうびを2回配らないための印として続けて使う
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
// 経験値を足した次の値と、新しくもらうごほうび(ビートP・カードパック券)。
//   ごほうびは、この試合で上がったランク(from より上・to まで)の分だけ。前に上がったランクの分はさかのぼって配らない
//   parts は結果に出す内わけ、gains はランクアップの演出に出す「もらった物」
const cardLevelAfter = (prev, { kind, level, outcome, today }) => {
  const cur = cardNormalizeLevel(prev);
  const lv0 = cardLevelInfo(cur.xp).level;
  const base = cardLevelXpOf({ kind, level, outcome });
  if (!base) return { next: cur, tickets: 0, points: 0, add: 0, from: lv0, to: lv0, xp: cur.xp, parts: [], gains: [] };
  const sameDay = cur.day === today;
  const first = outcome === 'win' && !(sameDay && cur.dayWin);
  const add = base + (first ? CARD_LEVEL_XP.firstWin : 0);
  const parts = [{ label: outcome === 'win' ? '勝ち' : '負け', xp: base }, ...(first ? [{ label: 'その日はじめての勝ち', xp: CARD_LEVEL_XP.firstWin }] : [])];
  const xp = cardLevelSafeXp(cur.xp + add);
  const to = cardLevelInfo(xp).level;
  const got = [...cur.got];
  let tickets = 0, points = 0;
  for (let lv = lv0 + 1; lv <= to; lv++) {
    if (got.includes(lv)) continue;
    const r = cardRankRewardOf(lv);
    got.push(lv); points += r.point; tickets += r.tickets;
  }
  const gains = [...(points ? [{ icon: '💰', text: `ビートP ${points.toLocaleString()}` }] : []), ...(tickets ? [{ icon: '🎟️', text: `カードパック券 ×${tickets}` }] : []),
    ...CARD_LEVEL_FRAMES.filter((f) => f.at > lv0 && f.at <= to).map((f) => ({ icon: '🧠', text: cardLevelFrameText(f) }))];
  return { next: { ...cur, xp, day: today, dayWin: (sameDay && cur.dayWin) || outcome === 'win', got }, tickets, points, add, from: lv0, to, xp, parts, gains };
};

// ---- 持ち物と枠 ----
// { v:1, own:{ カードid: 枚数 }, frames(82 の cardTacticNormalizeFrames の形), shards(かけら), tickets(カードパック券。以前の「引く券」), pulls(引いた回数), dry(SR が出ないまま引いた回数) }
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

// ---- ガチャ(1回300ビートPで8枚・5回まとめて1,350。N70%・R25%・SR5%)・かけら・カードパック券 ----
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
// count 回引く。payWith … 'point'(ビートP)か 'ticket'(カードパック券。1枚=1回)。足りなければ null
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

// ---- カードランクのランキング(card_ranks。2026-10-29 社長「バトルカードのランクのランキングも」) ----
// 書くのは card_rank_put だけ(39 の sbPutPlayerRank)。鍵はデッキ登録の「持ち主の鍵」(95 の mh_card_deck_owner_key_v1)をそのまま使う
//   (新しい保存キーを増やさない)。送るのは経験値の合計だけで、ランクはサーバが数える。少ない値が来てもサーバは下げない。
// 送るきっかけ: ランクが上がった試合のあと・MFバトルカードを開いたとき(1回)。経験値0の人は送らない。送れなくても遊びは止めない
const cardRankPut = async (profile) => {
  try {
    if (typeof sbPutPlayerRank !== 'function' || typeof ensureBreederId !== 'function' || typeof cardShareOwnerKey !== 'function') return null;
    const level = cardNormalizeLevel(await storeGet(CARD_LEVEL_KEY, null));
    if (level.xp <= 0) return null;
    const breederId = await ensureBreederId().catch(() => null);
    if (typeof breederId !== 'string' || !breederId) return null;
    const key = await cardShareOwnerKey(true);
    if (!key) return null;
    const p = profile || {};
    return await sbPutPlayerRank('card', { breederId, key, name: p.name, icon: p.icon ?? null, profileFrame: p.frame ?? null, xp: level.xp });
  } catch (_) { return null; }
};
