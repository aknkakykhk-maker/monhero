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
//   auto … オートで挑んだ試合(2026-11-02 社長・案3): 手で戦うときの半分。その日はじめての勝ちは付けず、その日の勝ちの印も動かさない
const cardLevelAfter = (prev, { kind, level, outcome, today: today0, auto = false, mult = 1 }) => {
  const cur = cardNormalizeLevel(prev);
  const today = cardDayCarry(cur.day, today0);   // 切り替えの夜は、0時区切りで書いた次の日のまま数える
  const lv0 = cardLevelInfo(cur.xp).level;
  const base0 = auto ? Math.floor(cardLevelXpOf({ kind, level, outcome }) / 2) : cardLevelXpOf({ kind, level, outcome });
  // カード部屋にいる助手と対戦(82 の cardLifeUpApply・手で遊んだときだけ): 勝ち負けの分だけ 1.5倍。その日はじめての勝ちの +30 は倍にしない
  const base = !auto && Number.isFinite(mult) && mult > 1 && base0 > 0 ? Math.round(base0 * mult) : base0; // 82 の cardLifeUpApply と同じ(96 は単独でも読まれる)
  if (!base) return { next: cur, tickets: 0, points: 0, add: 0, from: lv0, to: lv0, xp: cur.xp, parts: [], gains: [] };
  const sameDay = cur.day === today;
  const first = !auto && outcome === 'win' && !(sameDay && cur.dayWin);
  const add = base + (first ? CARD_LEVEL_XP.firstWin : 0);
  const parts = [{ label: outcome === 'win' ? '勝ち' : '負け', xp: base0 }, ...(base > base0 ? [{ label: 'カード部屋の助手と対戦(1.5倍)', xp: base - base0 }] : []), ...(first ? [{ label: 'その日はじめての勝ち', xp: CARD_LEVEL_XP.firstWin }] : [])];
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
  const dayNext = auto ? { day: cur.day, dayWin: cur.dayWin } : { day: today, dayWin: (sameDay && cur.dayWin) || outcome === 'win' };
  return { next: { ...cur, xp, ...dayNext, got }, tickets, points, add, from: lv0, to, xp, parts, gains };
};

// ---- 持ち物と枠 ----
// { v:1, own:{ カードid: 枚数 }, frames(82 の cardTacticNormalizeFrames の形), shards(かけら), tickets(カードパック券。以前の「引く券」), pulls(引いた回数), dry(SR が出ないまま引いた回数) }
// はじめに配る10枚(CARD_TACTIC_START)は、保存に無くても持っている扱い(配る書き込みが要らない)。知らないカードidは消さずに残す
const cardTacticsInt = (n, max = 1e9) => (Number.isFinite(Number(n)) ? Math.min(max, Math.max(0, Math.floor(Number(n)))) : 0);
const cardNormalizeTactics = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const own = {};
  if (r.own && typeof r.own === 'object' && !Array.isArray(r.own)) Object.entries(r.own).forEach(([id, n]) => { const k = cardTacticsInt(n, 999); if (id && id.length <= 64 && k > 0) { const c = cardTacticCanonId(id); own[c] = Math.min(999, (own[c] || 0) + k); } });
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
// ---- デッキごとの戦術カード(2026-11-02 テスターさんの要望・社長「デッキごとに戦術カードを記憶させたい」) ----
//   新しいキー mh_card_tactics_by_deck_v1 = { v:1, decks: { デッキのid: { frames, aces, at } } }(新しい40組まで)
//   ・mh_card_tactics_v1 の frames は今までどおり「最後に使った戦術カード」。消さない・意味を変えない(書くときは両方に書く)
//   ・まだ覚えていないデッキは mh_card_tactics_v1 の frames から始める(今の組み合わせが消えないように)
//   ・はじめてこのキーを書くとき(キーがまだ無い=一度だけ)、ほかのデッキにも「書く前の共通の戦術カード」を入れておく。
//     入れないと、1つ目のデッキを組み直したとたん、ほかのデッキが組み直した物で始まってしまう。キーがあれば二度と走らない
//   ・オート(あとで作る)はデッキの id から cardTacticsFramesOfDeck で引く
const CARD_TACTICS_DECK_KEY = 'mh_card_tactics_by_deck_v1';
const CARD_TACTICS_DECK_MAX = 40;
const cardTacticsDeckIdOk = (id) => typeof id === 'string' && id.length > 0 && id.length <= 64;
const cardTacticsDeckNormalize = (raw) => {
  const decks = {};
  const src = raw && typeof raw === 'object' && raw.decks && typeof raw.decks === 'object' && !Array.isArray(raw.decks) ? raw.decks : {};
  Object.keys(src).filter(cardTacticsDeckIdOk).forEach((id) => {
    const e = src[id];
    if (!e || typeof e !== 'object' || !e.frames || typeof e.frames !== 'object') return;
    decks[id] = { frames: cardTacticNormalizeFrames(e.frames),
      aces: Array.isArray(e.aces) ? e.aces.filter((x) => typeof x === 'string' && x.length <= 16).slice(0, CARD_SHARE_ACES_MAX) : null,
      at: Number.isFinite(e.at) && e.at > 0 ? e.at : 0 };
  });
  return { v: 1, decks };
};
const cardTacticsDeckLoad = async () => {
  let raw = null;
  try { raw = await storeGet(CARD_TACTICS_DECK_KEY, null); } catch (_) { /* 読めなければ覚えていない扱い */ }
  return { raw, box: cardTacticsDeckNormalize(raw) };
};
// そのデッキの戦術カード(覚えていなければ共通の frames)
const cardTacticsFramesOfDeck = (box, tactics, deckId) => {
  const e = box && cardTacticsDeckIdOk(deckId) ? box.decks[deckId] : null;
  return cardTacticNormalizeFrames(e ? e.frames : tactics && tactics.frames);
};
// そのデッキの切り札(覚えていなければ null)
const cardTacticsAcesOfDeck = (box, deckId) => {
  const e = box && cardTacticsDeckIdOk(deckId) ? box.decks[deckId] : null;
  return e && Array.isArray(e.aces) ? e.aces.slice() : null;
};
// 書く項目(saveStoredValuesOrRollback へ渡す)。loaded … cardTacticsDeckLoad の値(書く直前に読み直したもの)
//   aces … 切り札(undefined なら前のまま)/ seed … { ids: いまあるデッキのid, frames: 書く前の共通の frames }(はじめて書くときだけ使う)
const cardTacticsDeckEntry = (loaded, deckId, frames, { aces, seed = null } = {}) => {
  if (!cardTacticsDeckIdOk(deckId)) return null;
  const box = cardTacticsDeckNormalize(loaded && loaded.raw);
  const decks = { ...box.decks };
  const now = Date.now();
  if (!(loaded && loaded.raw) && seed && Array.isArray(seed.ids)) {
    seed.ids.filter((id) => cardTacticsDeckIdOk(id) && id !== deckId && !decks[id]).forEach((id, i) => {
      decks[id] = { frames: cardTacticNormalizeFrames(seed.frames), aces: null, at: now - 1000 - i };
    });
  }
  const before = decks[deckId];
  decks[deckId] = { frames: cardTacticNormalizeFrames(frames), aces: aces === undefined ? (before ? before.aces : null) : (Array.isArray(aces) ? aces.slice(0, CARD_SHARE_ACES_MAX) : null), at: now };
  const keep = Object.keys(decks).sort((a, b) => decks[b].at - decks[a].at).slice(0, CARD_TACTICS_DECK_MAX);
  return { key: CARD_TACTICS_DECK_KEY, before: loaded ? loaded.raw : null, next: { v: 1, decks: Object.fromEntries(keep.map((id) => [id, decks[id]])) } };
};
// 選んだデッキの戦術カードを、登録デッキと同じ形(95 の cardShareNormalizeTactics)にする。オートで挑むときの自分の側の打ち方
//   戦術カード … そのデッキで最後に使った物(覚えていなければ共通)。持っていない・レベルで開いていない物は外す(登録と同じ)
//   切り札 … そのデッキで覚えている物。無ければおまかせ(98 の cardRegAutoAces)
const cardTacticsAutoOf = async (db, deck) => {
  if (!deck) return null;
  const [d, byDeck] = await Promise.all([cardTacticsLoad(), cardTacticsDeckLoad()]);
  const frames = cardTacticsFramesOfDeck(byDeck.box, d.tactics, deck.id);
  const f = cardTacticPackFrames(cardTacticsFramesForBattle({ ...d.tactics, frames }, d.info.level));
  const kept = cardTacticsAcesOfDeck(byDeck.box, deck.id);
  const aces = kept && kept.length ? kept : typeof cardRegAutoAces === 'function' ? cardRegAutoAces(db, deck) : [];
  return cardShareNormalizeTactics({ name: deck.name, habit: cardShareMainHabit(cardTacticUnpackFrames(f), 'kyuko'), aces, f }, deck);
};

// ---- オートで挑む(案B・2026-11-02 社長「部のおすすめ」・ごほうびは案3) ----
//   ほかのブリーダーの登録デッキに、自分の側も戦術カードで自動で挑む。ごほうびは1日はじめの3回だけ手の半分、4回目からは無し(何回でも挑める)
//   新しいキー mh_card_auto_reward_v1 = { v:1, day:'YYYY-MM-DD'(日本の日付), n: その日にごほうびをもらった回数, extra?: その日にセッション券でふやした回数, r?: 戻しの印 }。壊れていたら0回の扱い
const CARD_AUTO_REWARD_KEY = 'mh_card_auto_reward_v1';
const CARD_AUTO_REWARD_DAY_MAX = 3;
// 2026-11-07 の一度きりの戻し(社長「オートご褒美がリセットされてない。今日の分は全員リセットして」)。
//   4時そろえ(#4679)の前の0時区切りで、11/7 の0:00〜4:00 に使った分が「11/7」と保存され、4:00 を過ぎても今日の分として残っていた。
//   11/7(朝4時区切り)のあいだだけ、印 r:'20261107' の無い 11/7 の回数を0として読む。数えるときは印を付けて書くので、戻すのは1回きり。
//   ほかの日は何もしない。キーの名前・形はそのまま(項目 r を足しただけ。前からの読み方は r を見ない)
const CARD_AUTO_REWARD_RESET_DAY = '2026-11-07';
const CARD_AUTO_REWARD_RESET_MARK = '20261107';
// ★セッション券でふやした回数 extra(2026-11-07 社長「セッション券1枚でオートごほうび1回分を復活できるようにしたい」・1日20回まで)。
//   同じ値に項目 extra を足しただけ(n の意味は変えない)。残りは max(0, 3 + extra - n)。無い・壊れている・0〜20の整数でないときは0。
//   日が変わると n と同じく0に戻る。書くときは印 r を消さない(11/7 は印を付けて書く。付けないと n が0に戻って二重になる)
const CARD_AUTO_REWARD_EXTRA_MAX = 20;
const cardAutoRewardNormalize = (raw, today) => {
  const day = raw && typeof raw === 'object' && typeof raw.day === 'string' ? raw.day : '';
  // 切り替えの夜の持ち越し(cardDayCarry)はここでは使わない。上のとおり、持ち越した分が4:00 を過ぎても今日の分として残ったため
  let n = raw && Number.isInteger(raw.n) && raw.n >= 0 && raw.n < 10000 ? raw.n : 0;
  if (day === CARD_AUTO_REWARD_RESET_DAY && today === CARD_AUTO_REWARD_RESET_DAY && raw.r !== CARD_AUTO_REWARD_RESET_MARK) n = 0;
  const extra = raw && Number.isInteger(raw.extra) && raw.extra >= 0 && raw.extra <= CARD_AUTO_REWARD_EXTRA_MAX ? raw.extra : 0;
  return { day: today, n: day === today ? n : 0, extra: day === today ? extra : 0 };
};
const cardAutoRewardLoad = async () => {
  let raw = null;
  try { raw = await storeGet(CARD_AUTO_REWARD_KEY, null); } catch (_) { /* 読めなければ0回の扱い */ }
  const today = typeof cardTodayJst === 'function' ? cardTodayJst() : '';
  const c = cardAutoRewardNormalize(raw, today);
  return { raw, today: c.day, n: c.n, extra: c.extra, left: Math.max(0, CARD_AUTO_REWARD_DAY_MAX + c.extra - c.n), extraLeft: Math.max(0, CARD_AUTO_REWARD_EXTRA_MAX - c.extra) };
};
// 書く値(n・extra・印 r)。11/7 は印を付ける。ほかの日に前から付いている印もそのまま残す
const cardAutoRewardValue = (loaded, { n, extra }) => ({
  v: 1, day: loaded.today, n, ...(extra > 0 ? { extra } : {}),
  ...(loaded.today === CARD_AUTO_REWARD_RESET_DAY || (loaded.raw && typeof loaded.raw === 'object' && loaded.raw.r === CARD_AUTO_REWARD_RESET_MARK && loaded.raw.day === loaded.today) ? { r: CARD_AUTO_REWARD_RESET_MARK } : {}),
});
// ごほうびをもらった1回を数える項目(結果の取引に足す)。券でふやした回数(extra)はそのまま引き継ぐ
const cardAutoRewardEntry = (loaded) => ({ key: CARD_AUTO_REWARD_KEY, before: loaded.raw, next: cardAutoRewardValue(loaded, { n: loaded.n + 1, extra: loaded.extra || 0 }) });
// セッション券1枚でごほうびを1回ふやす。consume は券を1枚減らす関数(60 の consumeBuddyTicket。持っていなければ false)、
//   refund は返す関数(60 の refundBuddyTicket)。上限20は、画面の値ではなく、ここで読み直した保存の値で数える。
//   順番: 読み直す → 上限・残りを確かめる → 券を1枚減らす → extra+1 を書く。書けなければ券を返す(券だけ減ってごほうびが戻らない、を作らない)
//   返すのは { ok, why, loaded }。why … 'limit'(今日はもう20回ふやした)・'notEmpty'(まだごほうびが残っている)・'noTicket'(券が無い)・'save'(書けなかった。券は返した)
const cardAutoRewardAddExtra = async ({ consume, refund } = {}) => {
  const loaded = await cardAutoRewardLoad();
  if (loaded.extra >= CARD_AUTO_REWARD_EXTRA_MAX) return { ok: false, why: 'limit', loaded };
  if (loaded.left > 0) return { ok: false, why: 'notEmpty', loaded };
  if (typeof consume !== 'function' || !(await consume())) return { ok: false, why: 'noTicket', loaded };
  // storeSet は書けなかったとき false を返す(例外は出さない。25-storage.jsx)
  let saved = false;
  try { saved = (await storeSet(CARD_AUTO_REWARD_KEY, cardAutoRewardValue(loaded, { n: loaded.n, extra: loaded.extra + 1 }))) !== false; } catch (_) { saved = false; }
  if (!saved) {
    if (typeof refund === 'function') { try { await refund(); } catch (__) { /* 返せなくても遊びは止めない */ } }
    return { ok: false, why: 'save', loaded };
  }
  return { ok: true, why: '', loaded: await cardAutoRewardLoad() };
};
// 1試合ぶんの経験値の保存の項目(84 の結果の取引に足す)。経験値を入れない人(公開前・デバッグでない)は空
const cardLevelEntries = async ({ kind, level, outcome, debug = false, auto = false, mult = 1 }) => {
  if (!cardTacticsOpen() && !debug) return { entries: [], gain: null };
  let rawL = null, rawT = null;
  try { [rawL, rawT] = await Promise.all([storeGet(CARD_LEVEL_KEY, null), storeGet(CARD_TACTICS_KEY, null)]); } catch (_) { return { entries: [], gain: null }; }
  const gain = cardLevelAfter(rawL, { kind, level, outcome, auto, mult, today: typeof cardTodayJst === 'function' ? cardTodayJst() : '' });
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
