// ===== MFバトルカード: みんなのデッキ(デッキ登録の対戦・デッキのレンタル) =====
// 2026-10-29 社長「デッキを1組登録して戦い方を決められる・ほかの人はそのデッキと戦える(CPU が動かす)・借りて使える・使われた数で次の日に報酬」
// 決めごと(ソランドくん経由・社長「この形で」): 報酬はビートP(戦われた1回 10・登録デッキが勝った回 +10・借りて使われた1回 15)、
//   同じ人からは1日3回まで・1人1日300まで、借りたデッキはマルチ対戦では使えない
//
// 作り
//   ・表と関数は docs/sql/card-deck-share/CARD_DECK_SHARE_APPLY.sql(流すのは統括部長)。表が無い間は「準備中」と出して何もしない
//   ・登録・登録し直し・やめる・報酬の受け取りには、登録した端末が作る「持ち主の鍵」(mh_card_deck_owner_key_v1)が要る
//     (ブリーダーの番号は人に見えるので、番号だけでは書きかえられない。表には鍵の指紋だけを置く)
//   ・戦い方(tactics)は、助手の打ち方(82 の cardAiPolicy)に乗せる: 土台のくせ(助手)+7つの向きの強め・控えめ+切り札(3枚まで)
//   ・この部品が持つ画面は「みんなのデッキ」(84 の view 'share')。区切り② 登録 → ③ 戦う → ④ 借りる → ⑤ 報酬 の順に足す

const CARD_SHARE_KEY = 'mh_card_deck_owner_key_v1';   // 持ち主の鍵(新しいキー。端末で作り、バックアップで引き継ぐ)
const CARD_SHARE_TABLE = 'card_deck_entries';
const CARD_RENTED_KEY = 'mh_card_rented_deck_v1';
const CARD_SHARE_REWARD_KEY = 'mh_card_deck_reward_v1'; // 報酬を端末のビートPに足した日の一覧(['2026-10-29', …]・新しい60日まで)     // 借りているデッキ(新しいキー。1組だけ・期限なし・返すと null)
let _cardShareUnavailable = false; // 表がまだ無い(SQL 未適用)と分かったら、その回は読みに行かない

// 戦い方の7つの向き・戦い方をきれいにする・賢さ・打ち方(cardSharePolicy)は 82-card-share-core へ移した(2026-10-30)

// 公開の印。区切り⑤(報酬)まで入るまでは、デバッグ設定から入ったときだけ押せる
const cardShareOpen = () => true;

// 登録デッキとの対戦でもらえる物(ビートP・クイック周回・カードランクの経験値)は、相手の賢さにかかわらずこの強さの表で数える(84 が使う。2026-10-30 社長)
const CARD_SHARE_REWARD_LEVEL = 'master';
// 賢さに数える戦術カードの枚数(場面が合わない・同じもの・ほとんど当たらないものは数えない。82 の cardTacticCountedRows)
const cardShareRowsCount = (frames) => cardTacticCountedRows(frames);
const cardShareSmartText = (tactics) => {
  const t = cardShareNormalizeTactics(tactics);
  const lv = cardShareSmartLevel(t);
  const label = `${CARD_SHARE_SMART_LABEL[lv] || lv.toUpperCase()} 相当`;
  if (!t.f) return label;
  const f = cardTacticUnpackFrames(t.f);
  return `${label}(基本${f.base.filter(Boolean).length}・戦術カード${cardShareRowsCount(f)}枚)`;
};

// 持ち主の鍵。create … 無ければ作って保存する(登録するときだけ)。作れない・保存できないときは null
const cardShareOwnerKey = async (create = false) => {
  let key = null;
  try { key = await storeGet(CARD_SHARE_KEY, null, false); } catch (_) { key = null; }
  if (typeof key === 'string' && /^[0-9a-f]{48}$/.test(key)) return key;
  if (!create) return null;
  try {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const made = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    if (!(await storeSet(CARD_SHARE_KEY, made, false))) return null;
    return made;
  } catch (_) { return null; }
};

// ---- 表との通信(表が無い・通信できないときは null。落ちない) ----
const cardShareRpc = async (fn, body) => {
  if (_cardShareUnavailable) return null;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => { if (controller) controller.abort(); }, 8000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: SB_HEADERS, signal: controller ? controller.signal : undefined, body: JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) { if (_isMissingTableError(res.status, text) || res.status === 404) _cardShareUnavailable = true; return null; }
    try { return JSON.parse(text); } catch (_) { return text; }
  } catch (_) { return null; } finally { clearTimeout(timer); }
};
const CARD_SHARE_COLS = 'owner_id,user_name,icon,profile_frame,deck,tactics,version,active,battles,deck_wins,rents,updated_at';
// 表の1行を、画面で使う形へ(壊れた行は null)
const cardShareRow = (row) => {
  if (!row || typeof row.owner_id !== 'string') return null;
  const deck = row.deck && typeof row.deck === 'object' ? row.deck : {};
  const monsters = Array.isArray(deck.monsters) ? deck.monsters.filter((x) => typeof x === 'string').slice(0, 3) : [];
  const cards = Array.isArray(deck.cards) ? deck.cards.filter((x) => typeof x === 'string').slice(0, 50) : [];
  if (monsters.length !== 3 || cards.length !== 50) return null;
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : 0);
  return { ownerId: row.owner_id, name: typeof row.user_name === 'string' && row.user_name ? row.user_name.slice(0, 40) : 'ブリーダー',
    icon: typeof row.icon === 'string' ? row.icon : null, frame: typeof row.profile_frame === 'string' ? row.profile_frame : null,
    deck: { monsters, cards }, tactics: cardShareNormalizeTactics(row.tactics, { cards }), version: n(row.version) || 1,
    battles: n(row.battles), deckWins: n(row.deck_wins), rents: n(row.rents), at: Date.parse(row.updated_at) || 0 };
};
// 自分の登録(やめた登録は表から読めないので null)
const cardShareFetchMine = async (ownerId) => {
  if (_cardShareUnavailable || typeof ownerId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ownerId)) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${CARD_SHARE_TABLE}?select=${CARD_SHARE_COLS}&owner_id=eq.${ownerId}&limit=1`, { headers: SB_HEADERS });
    const text = await res.text();
    if (!res.ok) { if (_isMissingTableError(res.status, text) || res.status === 404) _cardShareUnavailable = true; return null; }
    const rows = JSON.parse(text);
    return Array.isArray(rows) && rows[0] ? cardShareRow(rows[0]) : null;
  } catch (_) { return null; }
};
// 登録・登録し直し。返り値: 'ok' | 'locked'(鍵がちがう) | 'bad' | 'nokey' | 'off'(表が無い・通信できない)
// サーバが 'bad' を返したときの理由(2026-10-30 社長「このデッキは登録できませんでした」で登録できない → 理由を出す)。
//   サーバ(card_deck_register)と同じ決まりで、送る前の中身を確かめる。はじめのサーバはモンスターを C-数字3桁・カードを数字3桁だけ通していて、
//   色ちがい C-029S・場のカード F115 などが通らなかった。2026-10-30 にサーバを C-数字3桁+英字2つまで・英字1つ+数字3桁へ広げたので、ここも同じ形
const cardShareBadReason = (db, deck, tactics) => {
  const d = deck || {};
  const mons = Array.isArray(d.monsters) ? d.monsters.slice(0, 3) : [];
  const cards = Array.isArray(d.cards) ? d.cards.slice(0, 50) : [];
  const packed = cardShareNormalizeTactics(tactics, d);
  if (new TextEncoder().encode(JSON.stringify(packed)).length > 2000) return '戦術カードの中身が大きすぎます';
  if (cards.length !== 50) return 'デッキが50枚ではありません';
  const count = {};
  cards.forEach((n) => { count[n] = (count[n] || 0) + 1; });
  const over = Object.keys(count).find((n) => count[n] > 3);
  if (over) return `「${((db && cardOf(db, over)) || {}).name || over}」が4枚以上あります`;
  const oldMons = mons.filter((n) => !/^C-[0-9]{3}[A-Z]{0,2}$/.test(String(n)));
  const oldCards = [...new Set(cards.filter((n) => !/^[A-Z]?[0-9]{3}$/.test(String(n))))];
  const names = [...oldMons.map((n) => `${((db && cardMonsterOf(db, n)) || {}).name || ''}(${n})`), ...oldCards.map((n) => ((db && cardOf(db, n)) || {}).name || n)];
  if (names.length) return `「${names.slice(0, 3).join('」「')}」${names.length > 3 ? 'など' : ''}の番号を、登録で受け付けていません`;
  return 'サーバが受け付けませんでした';
};
const cardShareRegister = async ({ ownerId, name, icon, frame, deck, tactics }) => {
  const key = await cardShareOwnerKey(true);
  if (!key) return 'nokey';
  const r = await cardShareRpc('card_deck_register', { p_owner: ownerId, p_key: key, p_name: String(name || '').slice(0, 40), p_icon: icon || null, p_frame: frame || null,
    p_deck: { monsters: deck.monsters.slice(0, 3), cards: deck.cards.slice(0, 50) }, p_tactics: cardShareNormalizeTactics(tactics, deck) });
  return r === 'ok' || r === 'locked' || r === 'bad' ? r : 'off';
};
const cardShareUnregister = async (ownerId) => {
  const key = await cardShareOwnerKey(false);
  if (!key) return 'nokey';
  const r = await cardShareRpc('card_deck_unregister', { p_owner: ownerId, p_key: key });
  return r === 'ok' || r === 'locked' || r === 'none' ? r : 'off';
};

// 戦う相手の一覧(区切り③)。sort … 'new'(新しく登録した順)/'popular'(よく戦われた順)/ ids … その人たちだけ(フレンド)
const cardShareFetchList = async ({ sort = 'new', ids = null, limit = 30 } = {}) => {
  if (_cardShareUnavailable) return [];
  const safeIds = Array.isArray(ids) ? ids.filter((x) => typeof x === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 100) : null;
  if (safeIds && !safeIds.length) return [];
  const order = sort === 'popular' ? 'battles.desc,updated_at.desc' : 'updated_at.desc';
  const where = safeIds ? `&owner_id=in.(${safeIds.join(',')})` : '';
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${CARD_SHARE_TABLE}?select=${CARD_SHARE_COLS}&active=eq.true${where}&order=${order}&limit=${Math.max(1, Math.min(60, limit))}`, { headers: SB_HEADERS });
    const text = await res.text();
    if (!res.ok) { if (_isMissingTableError(res.status, text) || res.status === 404) _cardShareUnavailable = true; return []; }
    const rows = JSON.parse(text);
    return (Array.isArray(rows) ? rows : []).map(cardShareRow).filter(Boolean);
  } catch (_) { return []; }
};
// 「おすすめ」: 新しい順の一覧から、自分以外を n 組えらぶ(戦われた数の少ない人を少し出やすく)
const cardSharePickSome = (list, selfId, n = 3, rand = Math.random) => {
  const pool = (Array.isArray(list) ? list : []).filter((e) => e && e.ownerId !== selfId);
  const weighted = pool.map((e) => ({ e, w: rand() / (1 + Math.min(50, e.battles) / 10) })).sort((a, b) => b.w - a.w);
  return weighted.slice(0, n).map((x) => x.e);
};
// 戦った・借りて使ったを表へ知らせる(試合の番号ごとに1回だけ数えられる)。返り値は表の答え('ok' | 'dup' | 'self' | 'none' | 'bad')か null
const cardShareReportUse = async ({ match, ownerId, userId, kind, deckWon = false, version = 1 }) => {
  if (typeof match !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(match) || ownerId === userId) return null;
  return cardShareRpc('card_deck_use', { p_match_id: match, p_owner: ownerId, p_user: userId, p_kind: kind === 'rent' ? 'rent' : 'battle', p_deck_won: !!deckWon, p_version: Number.isInteger(version) ? version : 1 });
};
// 登録デッキの相手の、助手と同じ血統の子のまとまり(cardAiPolicy の opts.sameBlood と同じ見方)
// ---- 登録デッキが戦われた試合の見返し(2026-10-31 社長「案A・戦った人の名前は出す・新しい20試合」) ----
// 表 card_deck_replays(docs/sql/card-deck-share/CARD_DECK_REPLAYS_APPLY.sql)。持ち主ごとに20の枠を回して上書き(行は消さない)。
//   書くのは戦った人の端末(「戦った」の知らせ card_deck_use のあと)。読めるのは登録した本人だけ(持ち主の鍵)
//   表がまだ無いときは、この見返しだけを止める(みんなのデッキの通信 _cardShareUnavailable は巻き込まない)
let _cardShareReplayOff = false;
const cardShareReplayRpc = async (fn, body) => {
  if (_cardShareReplayOff || _cardShareUnavailable) return null;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => { if (controller) controller.abort(); }, 8000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: SB_HEADERS, signal: controller ? controller.signal : undefined, body: JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) { if (_isMissingTableError(res.status, text) || res.status === 404) _cardShareReplayOff = true; return null; }
    try { return JSON.parse(text); } catch (_) { return text; }
  } catch (_) { return null; } finally { clearTimeout(timer); }
};
const CARD_SHARE_REPLAY_SLOTS = 20;
// 戦った人の端末から送る。rec … 93 の cardReplayFromCpu で作った記録(なぞり直しが最後まで通った物だけ)。
//   decks[0] = 戦った人(下)・decks[1] = 登録デッキ(上。表へはサーバが登録から写す)。届かなくても対戦の結果はそのまま
const cardShareReplayPut = async ({ match, ownerId, userId, name, icon, frame, rec, deckWon }) => {
  if (!rec || !Array.isArray(rec.acts) || !rec.acts.length) return 'bad';
  const r = await cardShareReplayRpc('card_deck_replay_put', {
    p_match_id: match, p_owner: ownerId, p_user: userId, p_name: String(name || '').slice(0, 40), p_icon: icon || null, p_frame: frame || null,
    p_user_deck: { monsters: rec.decks[0].monsters.slice(), cards: rec.decks[0].cards.slice() }, p_seed: rec.seeds[0] >>> 0, p_first: rec.first,
    p_rules: rec.rules, p_acts: rec.acts, p_turns: Number.isInteger(rec.turn) ? rec.turn : null, p_deck_won: !!deckWon });
  return typeof r === 'string' ? r : 'off';
};
// 一覧(新しい順・見出しだけ)。表が無い・鍵が無い・通信できないときは null
const cardShareReplaysOf = async (ownerId) => {
  const key = await cardShareOwnerKey(false);
  if (!key || typeof ownerId !== 'string') return null;
  const rows = await cardShareReplayRpc('card_deck_replays_of', { p_owner: ownerId, p_key: key });
  if (!Array.isArray(rows)) return null;
  return rows.filter((r) => r && Number.isInteger(r.slot) && r.slot >= 0 && r.slot < CARD_SHARE_REPLAY_SLOTS).map((r) => ({
    slot: r.slot, at: Date.parse(r.at) || 0, name: typeof r.name === 'string' && r.name ? r.name.slice(0, 40) : 'ブリーダー',
    icon: typeof r.icon === 'string' ? r.icon : null, frame: typeof r.frame === 'string' ? r.frame : null,
    deckWon: r.deck_won === true, turns: Number.isInteger(r.turns) ? r.turns : null, old: r.old === true }));
};
// 登録デッキの最近の戦績(2026-10-31 社長「誰に挑まれてとか戦績も見たい」)。だれでも読める(docs/sql/card-deck-share/CARD_DECK_RECORD_APPLY.sql)。
//   返るのは「いつ・このデッキが勝ったか・何ターン」だけ(挑んだ人の名前は、本人だけが見返しの一覧で見る)。
//   関数がまだ無い・通信できないときは null。止め印は見返しとは別に持つ(この関数が無くても見返しは止めない)
let _cardShareRecordOff = false;
const cardShareRecordOf = async (ownerId) => {
  if (_cardShareRecordOff || _cardShareUnavailable || typeof ownerId !== 'string') return null;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => { if (controller) controller.abort(); }, 8000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/card_deck_record_of`, { method: 'POST', headers: SB_HEADERS, signal: controller ? controller.signal : undefined, body: JSON.stringify({ p_owner: ownerId }) });
    const text = await res.text();
    if (!res.ok) { if (_isMissingTableError(res.status, text) || res.status === 404) _cardShareRecordOff = true; return null; }
    const rows = JSON.parse(text);
    if (!Array.isArray(rows)) return null;
    return rows.filter((r) => r && typeof r.at === 'string').slice(0, CARD_SHARE_REPLAY_SLOTS)
      .map((r) => ({ at: Date.parse(r.at) || 0, deckWon: r.deck_won === true, turns: Number.isInteger(r.turns) ? r.turns : null, old: r.old === true }));
  } catch (_) { return null; } finally { clearTimeout(timer); }
};
// 1試合の中身(card_tournament_match と同じ形。93 の cardReplayFromTour で開く)
const cardShareReplayGet = async (ownerId, slot) => {
  const key = await cardShareOwnerKey(false);
  if (!key || typeof ownerId !== 'string' || !Number.isInteger(slot)) return null;
  const row = await cardShareReplayRpc('card_deck_replay_get', { p_owner: ownerId, p_key: key, p_slot: slot });
  return row && typeof row === 'object' && !Array.isArray(row) ? row : null;
};
const cardShareSameBlood = (db, deck) => {
  const ms = (deck && Array.isArray(deck.monsters) ? deck.monsters : []).map((no) => cardMonsterOf(db, no)).filter(Boolean);
  return ms.length > 0 && ms.filter((m) => cardAiBloodOf(m) === cardAiBloodOf(ms[0])).length >= 2;
};

// ---- 報酬の受け取り(区切り⑤)。前の日までの分を、カードのトップの帯で受け取る ----
// 端末に足した日の一覧。無ければ空・壊れていたら null(二重に足さないよう、壊れているときは何もしない)
const cardShareNormalizeClaims = (v) => {
  if (v === null || v === undefined) return [];
  if (!Array.isArray(v)) return null;
  return v.filter((x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-60);
};
// サーバで前の日までの報酬を確かめ(card_deck_claim・(人・日)で1回だけ)、サーバで受け取った日のうち、まだ端末に足していない日を返す。
//   [{ day, amount, uses }]。サーバで受け取ったあと端末の保存に失敗しても、次に開いたときにここからもう一度出る
const cardSharePendingRewards = async (ownerId, credited) => {
  const key = await cardShareOwnerKey(false);
  if (!key || typeof ownerId !== 'string' || !Array.isArray(credited)) return [];
  await cardShareRpc('card_deck_claim', { p_owner: ownerId, p_key: key });
  const rows = await cardShareRpc('card_deck_rewards_of', { p_owner: ownerId, p_key: key });
  const done = new Set(credited);
  return (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.day) && Number.isInteger(r.amount) && r.amount > 0 && !done.has(r.day))
    .map((r) => ({ day: r.day, amount: Math.min(300, r.amount), uses: Number.isInteger(r.uses) && r.uses > 0 ? r.uses : 0 }));
};

// ---- 借りたデッキ(区切り④)。助手と対戦で使える(マルチでは使えない・社長の決め)。持っているかは見ない(借り物) ----
const cardRentedNormalize = (v) => {
  const r = v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  if (!r || typeof r.ownerId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(r.ownerId)) return null;
  const d = r.deck && typeof r.deck === 'object' ? r.deck : {};
  const monsters = Array.isArray(d.monsters) ? d.monsters.filter((x) => typeof x === 'string').slice(0, 3) : [];
  const cards = Array.isArray(d.cards) ? d.cards.filter((x) => typeof x === 'string').slice(0, 50) : [];
  if (monsters.length !== 3 || cards.length !== 50) return null;
  return { ownerId: r.ownerId, name: typeof r.name === 'string' && r.name ? r.name.slice(0, 40) : 'ブリーダー', icon: typeof r.icon === 'string' ? r.icon : null,
    frame: typeof r.frame === 'string' ? r.frame : null, version: Number.isInteger(r.version) && r.version > 0 ? r.version : 1,
    deckName: typeof r.deckName === 'string' ? r.deckName.slice(0, 20) : '', deck: { monsters, cards }, at: Number.isFinite(r.at) ? r.at : 0 };
};
const cardRentedDeckGet = async () => { try { return cardRentedNormalize(await storeGet(CARD_RENTED_KEY, null, false)); } catch (_) { return null; } };
// entry … 表の1行(cardShareRow の形)・null で返す。保存できたら true
const cardRentedDeckSet = async (entry) => {
  const next = entry ? cardRentedNormalize({ ownerId: entry.ownerId, name: entry.name, icon: entry.icon, frame: entry.frame, version: entry.version, deckName: entry.tactics && entry.tactics.name, deck: entry.deck, at: Date.now() }) : null;
  if (entry && !next) return false;
  try { return !!(await storeSet(CARD_RENTED_KEY, next, false)); } catch (_) { return false; }
};

// ---- 画面: みんなのデッキ(区切り② 登録・③ 戦う・④ 借りる) ----
// db … カードの表 / decks … 自分のデッキ(cardNormalizeDecks の形)/ collection … 持っているカード / frame … プロフィールのフレーム / onBack … 対戦えらびへ
// unlocked … 助手と対戦で開いた強さ(cardLevelOpen)/ debug … デバッグから入った(強さを全部選べる)/ onFight(entry, level) … 登録デッキと戦う(84 の startBattle へ)
// onOpenTactics … 戦術カードの画面へ(97。84 が開く)
// part … 'all'(戦う+登録のタブ)/ 'fight'(フリー対戦の「ほかのブリーダー」タブ・2026-10-29 社長の作り直し)/ 'mine'(デッキ登録の「登録」タブ)
//   title・headExtra … part='fight' のときの見出しと、見出しの下に出すもの(84 の「助手/ほかのブリーダー」のタブ)
//   embedded … 外の画面(97 のデッキ登録)の中に入れる。殻と見出しを出さず、登録のボタンは中に置く
//   借りるのは対戦前のデッキを選ぶ画面(87)へ移したので、part='fight' では「借りる」を出さない
const CardDeckShare = ({ db, decks, collection, frame = null, onBack, unlocked = null, debug = false, onFight = null, onOpenTactics = null, part = 'all', title = 'デッキ登録', headExtra = null, embedded = false }) => {
  const [tab, setTab] = useState(part === 'mine' ? 'mine' : onFight ? 'fight' : 'mine');
  const [foes, setFoes] = useState(null);             // { picks, friends, popular } … 戦う相手の3つの並び
  const [foeDetail, setFoeDetail] = useState(null); // 一覧の「詳細」で開いている相手(2026-10-31 社長)
  const [foeFilter, setFoeFilter] = useState('all'); // 一覧の絞り込み(すべて/おすすめ/フレンド/人気。2026-10-30 社長・案C)
  // 戦術カード(96・97): 登録するときに載せる枠(レベルで開いている枠・持っているカードだけ)
  const [tacticsSave, setTacticsSave] = useState(null);
  useEffect(() => { if (typeof cardTacticsLoad === 'function') void cardTacticsLoad().then(setTacticsSave).catch(() => {}); }, []);
  const framesNow = tacticsSave && typeof cardTacticsFramesForBattle === 'function' ? cardTacticsFramesForBattle(tacticsSave.tactics, tacticsSave.info.level) : null;
  const [rented, setRented] = useState(null);         // 借りているデッキ(cardRentedDeckGet)
  useEffect(() => { void cardRentedDeckGet().then(setRented); }, []);
  const rent = async (e) => {
    if (busy) return;
    setBusy(true); setMsg('');
    if (await cardRentedDeckSet(e)) { setRented(await cardRentedDeckGet()); setMsg(`${e.name}さんのデッキを借りました。フリー対戦のデッキ選びで使えます`); }
    else setMsg('この端末に保存できなかったため、借りられませんでした');
    setBusy(false);
  };
  const giveBack = async () => {
    if (busy) return;
    setBusy(true);
    if (await cardRentedDeckSet(null)) { setRented(null); setMsg('借りていたデッキを返しました'); }
    setBusy(false);
  };
  const [selfId, setSelfId] = useState(null);
  const [mine, setMine] = useState(undefined);        // undefined … 読み込み中 / null … 登録なし
  const [off, setOff] = useState(false);               // 表が無い・通信できない
  const [pick, setPick] = useState(null);              // 選んだ自分のデッキの id
  const [tactics, setTactics] = useState(() => cardShareNormalizeTactics(null));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [profile, setProfile] = useState({ name: 'ブリーダー', icon: '🙂' });
  const list = decks && Array.isArray(decks.decks) ? decks.decks : [];
  const deckOf = (id) => list.find((d) => d.id === id) || null;
  const issuesOf = (d) => (d ? [...cardDeckProblems(db, d), ...cardDeckOwnProblems(db, d, collection)] : ['デッキがありません']);
  const picked = deckOf(pick);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [name, icon] = await Promise.all([storeGet('mh_breeder_name', 'ブリーダー', false), storeGet('mh_breeder_icon', '🙂', false)]).catch(() => ['ブリーダー', '🙂']);
      if (alive) setProfile({ name: typeof name === 'string' && name ? name : 'ブリーダー', icon: typeof icon === 'string' && icon ? icon : '🙂' });
      const id = typeof ensureBreederId === 'function' ? await ensureBreederId().catch(() => null) : null;
      if (!alive) return;
      setSelfId(typeof id === 'string' ? id : null);
      const row = typeof id === 'string' ? await cardShareFetchMine(id) : null;
      if (!alive) return;
      setOff(_cardShareUnavailable || typeof id !== 'string');
      setMine(row);
      if (row) setTactics(row.tactics);
      // はじめは、登録中のデッキと同じ中身の自分のデッキ・無ければ使えるデッキの先頭を選んでおく
      const same = row ? list.find((d) => JSON.stringify(d.monsters) === JSON.stringify(row.deck.monsters) && JSON.stringify(d.cards) === JSON.stringify(row.deck.cards)) : null;
      const firstOk = list.find((d) => issuesOf(d).length === 0);
      setPick((same || firstOk || list[0] || {}).id || null);
    })();
    return () => { alive = false; };
  }, []);
  const habitName = (id) => ((typeof ASSISTANTS !== 'undefined' && ASSISTANTS.find((a) => a.id === id)) || {}).name || id;
  const uniqueCards = picked ? [...new Set(picked.cards)] : [];
  const cardName = (no) => ((cardOf(db, no) || {}).name) || no;
  const toggleAce = (no) => setTactics((t) => (t.aces.includes(no) ? { ...t, aces: t.aces.filter((x) => x !== no) } : t.aces.length >= CARD_SHARE_ACES_MAX ? t : { ...t, aces: [...t.aces, no] }));
  const issues = issuesOf(picked);
  const register = async () => {
    if (!picked || issues.length || !selfId || busy) return;
    setBusy(true); setMsg('');
    const r = await cardShareRegister({ ownerId: selfId, name: profile.name, icon: profile.icon, frame, deck: picked, tactics: { ...cardShareNormalizeTactics(tactics, picked), name: picked.name, habit: cardShareMainHabit(framesNow, tactics.habit), ...(framesNow ? { f: cardTacticPackFrames(framesNow) } : {}) } });
    if (r === 'ok') { setMine(await cardShareFetchMine(selfId)); setMsg('登録しました。ほかのブリーダーが、このデッキと戦えます'); }
    else setMsg(r === 'locked' ? 'この端末では登録を書きかえられません(登録した端末で操作してください)' : r === 'bad' ? `このデッキは登録できませんでした(${cardShareBadReason(db, picked, tactics)})` : r === 'nokey' ? 'この端末に保存できなかったため、登録できませんでした' : '通信できませんでした。電波のよい所で、もう一度お試しください');
    setBusy(false);
  };
  const unregister = async () => {
    if (!selfId || busy) return;
    setBusy(true); setMsg('');
    const r = await cardShareUnregister(selfId);
    if (r === 'ok' || r === 'none') { setMine(null); setMsg('登録をやめました'); }
    else setMsg(r === 'locked' || r === 'nokey' ? 'この端末では登録をやめられません(登録した端末で操作してください)' : '通信できませんでした。もう一度お試しください');
    setBusy(false);
  };
  const chip = (on) => `rounded-lg px-2 py-1 text-[12px] font-black ${on ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-200'}`;
  // 戦う相手を読む(戦うタブを開いたとき・「ほかの人」で読み直す)
  const loadFoes = async () => {
    setFoes(null);
    const [fresh, popular, roster] = await Promise.all([cardShareFetchList({ sort: 'new', limit: 40 }), cardShareFetchList({ sort: 'popular', limit: 10 }),
      selfId && typeof sbFetchFriendRoster === 'function' ? sbFetchFriendRoster(selfId).catch(() => []) : Promise.resolve([])]);
    const friendIds = (Array.isArray(roster) ? roster : []).map((f) => f && f.otherId).filter(Boolean);
    const friends = friendIds.length ? await cardShareFetchList({ ids: friendIds, limit: 30 }) : [];
    setFoes({ picks: cardSharePickSome(fresh, selfId, 3), friends: friends.filter((e) => e.ownerId !== selfId), popular: popular.filter((e) => e.ownerId !== selfId) });
  };
  useEffect(() => { if (tab === 'fight' && selfId && !off && foes === null) void loadFoes(); }, [tab, selfId, off]);
  const fightIssues = issuesOf(list.find((d) => d.id === (decks && decks.active)) || list[0] || null);
  // 3つの並び(おすすめ・フレンド・人気)を1つの一覧にまとめる。同じ人は1回だけで、どの並びに入るかは印で出す(2026-10-30 社長・案C)
  const CARD_SHARE_FOE_TAGS = [['picks', 'おすすめ', 'bg-amber-400 text-slate-950'], ['friends', 'フレンド', 'bg-emerald-400 text-emerald-950'], ['popular', '人気', 'bg-pink-400 text-pink-950']];
  const foeMerged = (() => {
    if (!foes) return [];
    const byId = new Map();
    CARD_SHARE_FOE_TAGS.forEach(([key]) => (foes[key] || []).forEach((e) => {
      const cur = byId.get(e.ownerId);
      if (cur) { if (!cur.tags.includes(key)) cur.tags.push(key); } else byId.set(e.ownerId, { e, tags: [key] });
    }));
    return [...byId.values()];
  })();
  const foeShown = foeFilter === 'all' ? foeMerged : foeMerged.filter((x) => x.tags.includes(foeFilter));
  const foeRow = ({ e, tags }) => {
    const mons = e.deck.monsters.map((no) => cardMonsterOf(db, no) || { no, name: no, img: no });
    return (
      <li key={e.ownerId} data-card-share-foe={e.ownerId} data-card-share-foe-tags={tags.join(' ')} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-2 py-2">
        {/* 3体の丸い顔(カードの絵の上のほう)と、どの並びに入るかの印 */}
        <span className="flex shrink-0 flex-col items-center gap-1">
          <span className="flex">{mons.map((m, i) => <img key={i} src={CARD_IMG(m.img)} alt={m.name} loading="lazy" className={`h-9 w-9 rounded-full border-2 border-amber-200 bg-slate-900 object-cover ${i ? '-ml-2' : ''}`} style={{ objectPosition: '50% 18%' }}/>)}</span>
          <span data-card-share-foe-tag className="flex gap-0.5">{CARD_SHARE_FOE_TAGS.filter(([k]) => tags.includes(k)).map(([k, label, tone]) => <span key={k} className={`whitespace-nowrap rounded px-1 text-[9px] font-black ${tone}`}>{label}</span>)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[13px] font-black leading-tight text-white">{e.name}</b>
          <small data-card-share-deck-name className="block truncate text-[11.5px] font-black leading-tight text-amber-100">「{e.tactics.name || 'デッキ'}」</small>
          <small className="block truncate text-[10.5px] font-bold text-slate-300">{mons.map((m) => m.name).join('・')}</small>
          <small data-card-share-smart={cardShareSmartLevel(e.tactics)} className="block truncate whitespace-nowrap text-[11px] font-black text-amber-200">{`賢さ ${cardShareSmartText(e.tactics)}`}</small>
          <small className="block truncate text-[10.5px] font-bold text-sky-200 tabular-nums">{e.battles ? `戦われた ${e.battles}回・勝ち ${Math.round((e.deckWins / e.battles) * 100)}%` : 'まだ戦われていません'}</small>
        </span>
        <span className="flex shrink-0 flex-col gap-1">
          <button type="button" data-card-share-fight={e.ownerId} disabled={!onFight || fightIssues.length > 0} className="mh-button mh-button-primary min-h-[40px] rounded-lg px-2.5 text-[13px] font-black disabled:opacity-50"
            onClick={() => { Audio_.fgSe.tap(); if (onFight) onFight(e, cardShareFightLevel(e.tactics)); }}>戦う</button>
          {part !== 'fight' && <button type="button" data-card-share-rent={e.ownerId} disabled={busy || (rented && rented.ownerId === e.ownerId && rented.version === e.version)} className="min-h-[30px] rounded-lg border border-emerald-300/50 bg-slate-900 px-2 text-[11px] font-black text-emerald-100 disabled:opacity-50"
            onClick={() => { Audio_.fgSe.tap(); void rent(e); }}>{rented && rented.ownerId === e.ownerId && rented.version === e.version ? '借りています' : '借りる'}</button>}
          <button type="button" data-card-share-detail-open={e.ownerId} className="min-h-[30px] rounded-lg border border-sky-300/50 bg-slate-900 px-2 text-[11px] font-black text-sky-100"
            onClick={() => { Audio_.fgSe.tap(); setFoeDetail(e); }}>詳細</button>
        </span>
      </li>
    );
  };
  const foeEmptyText = foeFilter === 'friends' ? 'デッキを登録しているフレンドはいません' : 'まだだれも登録していません';
  const registerButton = (
    <button type="button" data-card-share-register disabled={busy || !picked || issues.length > 0 || !selfId} className="mh-button mh-button-primary min-h-[52px] w-full rounded-2xl font-black disabled:opacity-40" onClick={() => { Audio_.fgSe.tap(); void register(); }}>{mine ? 'このデッキで登録し直す' : 'このデッキを登録する'}</button>
  );
  const body = (
      <div className={embedded ? 'space-y-3 pb-2' : `${SCREEN_LIST_CLASS} space-y-3 pb-4`}>
        {mine === undefined && <p className="text-[13px] font-bold text-slate-300">読み込み中…</p>}
        {mine !== undefined && off && <p data-card-share-off className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-3 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap('いまは準備中です。しばらくしてから、もう一度開いてください')}</p>}
        {mine !== undefined && !off && onFight && part === 'all' && (
          <div className="flex gap-1.5" role="tablist">
            {[['fight', '戦う'], ['mine', '自分のデッキを登録']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} data-card-share-tab={id} className={`flex-1 ${chip(tab === id)} py-2`} onClick={() => { Audio_.fgSe.tap(); setTab(id); }}>{label}</button>)}
          </div>
        )}
        {mine !== undefined && !off && tab === 'fight' && (<>
          <div className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('相手の強さは、登録した人が入れた戦術カードで決まります(賢さ)。もらえるビートPや経験値は、賢さにかかわらず助手と対戦の MASTER と同じです')}</div>
            {fightIssues.length > 0 && <p className="mt-1 text-[12px] font-bold text-rose-200" style={JA_WRAP_STYLE}>{jaWrap(`使うデッキ: ${fightIssues[0]}`)}</p>}
          </div>
          {rented && part !== 'fight' && (
            <div data-card-share-rented className={`${SCREEN_PANEL_CLASS} flex items-center gap-2`}>
              <span className="min-w-0 flex-1 text-[12px] font-bold text-emerald-100" style={JA_WRAP_STYLE}>{jaWrap(`借りているデッキ: ${rented.name}さんの「${rented.deckName || 'デッキ'}」(フリー対戦のデッキ選びで使えます。マルチ対戦では使えません)`)}</span>
              <button type="button" data-card-share-giveback disabled={busy} className="shrink-0 rounded-lg border border-white/15 bg-slate-900 px-2 py-1 text-[11px] font-black text-slate-200 disabled:opacity-50" onClick={() => { Audio_.fgSe.tap(); void giveBack(); }}>返す</button>
            </div>
          )}
          {msg && tab === 'fight' && <p className="rounded-xl bg-slate-900 p-2 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(msg)}</p>}
          {foes === null ? <p className="text-[13px] font-bold text-slate-300">読み込み中…</p> : (<>
            <div data-card-share-filters className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist">
              {[['all', 'すべて'], ...CARD_SHARE_FOE_TAGS.map(([k, label]) => [k, label])].map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={foeFilter === k} data-card-share-filter={k} className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-black ${foeFilter === k ? 'bg-amber-300 text-slate-950' : 'border border-white/20 bg-slate-900 text-slate-200'}`} onClick={() => { Audio_.fgSe.tap(); setFoeFilter(k); }}>{label}</button>)}
            </div>
            <div data-card-share-list={foeFilter}>
              {foeShown.length ? <ul className="space-y-1.5">{foeShown.map(foeRow)}</ul> : <p className={`${SCREEN_PANEL_CLASS} text-[12px] font-bold text-slate-400`}>{foeEmptyText}</p>}
            </div>
            <p data-card-share-replay-note className="px-1 text-[11px] font-bold leading-snug text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('戦った試合は、デッキを登録した人があとから見返せます(あなたの名前とアイコンが出ます)')}</p>
            <button type="button" data-card-share-reload className="w-full rounded-xl border border-white/15 bg-slate-900 py-2 text-[12px] font-black text-slate-200" onClick={() => { Audio_.fgSe.tap(); void loadFoes(); }}>ほかの人をさがす</button>
          </>)}
        </>)}
        {mine !== undefined && !off && tab === 'mine' && (<>
          <div data-card-share-mine className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">登録中のデッキ</div>
            {mine ? (<>
              <div className="text-[15px] font-black text-white">{mine.tactics.name || 'デッキ'}<small className="ml-2 text-[11px] text-amber-200">{`賢さ ${cardShareSmartText(mine.tactics)}`}</small></div>
              <p data-card-share-counts className="mt-1 text-[12px] font-bold text-sky-100 tabular-nums">戦われた {mine.battles}回・そのうち勝った {mine.deckWins}回・借りられた {mine.rents}回</p>
              <button type="button" data-card-share-unregister disabled={busy} className="mt-2 rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-[12px] font-black text-slate-200 disabled:opacity-50" onClick={() => { Audio_.fgSe.tap(); void unregister(); }}>登録をやめる</button>
            </>) : <p className="text-[13px] font-bold text-slate-300">まだ登録していません</p>}
          </div>
          <div className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">登録するデッキ</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {list.map((d) => <button key={d.id} type="button" data-card-share-pick={d.id} className={chip(pick === d.id)} onClick={() => { Audio_.fgSe.tap(); setPick(d.id); setTactics((t) => cardShareNormalizeTactics(t, d)); }}>{d.name}</button>)}
            </div>
            {picked && issues.length > 0 && <p data-card-share-issues className="mt-1 text-[12px] font-bold text-rose-200" style={JA_WRAP_STYLE}>{jaWrap(issues[0])}</p>}
          </div>
          <div className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">戦い方(コンピューターが、この打ち方であなたのデッキを動かします)</div>
            <div data-card-share-tactics className="mt-1 rounded-lg bg-black/30 p-2 text-[12px] font-bold text-slate-200" style={JA_WRAP_STYLE}>
              {framesNow ? (<>
                <div>{`基本カード: ${framesNow.base.filter(Boolean).map((id) => (cardTacticOf(id) || {}).name).join('・') || 'なし'}`}</div>
                <div>{`セットした戦術カード: ${cardShareRowsCount(framesNow)}枚`}</div>
                <div className="text-amber-200">{`賢さ: ${cardShareSmartText({ f: cardTacticPackFrames(framesNow) })}`}</div>
              </>) : <div>読み込み中…</div>}
              {onOpenTactics && <button type="button" data-card-share-open-tactics className="mt-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-black text-slate-950" onClick={() => { Audio_.fgSe.tap(); onOpenTactics(); }}>戦術カードを組む</button>}
            </div>
            <div className="mt-2 text-[12px] font-bold text-slate-300">切り札(出せるときは優先して使う・{CARD_SHARE_ACES_MAX}枚まで)</div>
            <div data-card-share-aces className="mt-1 flex max-h-[30vh] flex-wrap gap-1.5 overflow-y-auto">
              {uniqueCards.map((no) => <button key={no} type="button" data-card-share-ace={no} className={chip(tactics.aces.includes(no))} onClick={() => toggleAce(no)}>{cardName(no)}</button>)}
            </div>
          </div>
          <p className="px-1 text-[11px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('登録できるのは1組だけです。登録し直すと、前の登録と入れかわります。登録した端末でだけ、書きかえ・やめる・報酬の受け取りができます(端末を変えるときは、バックアップで引き継げます)')}</p>
          {msg && <p data-card-share-msg className="rounded-xl bg-slate-900 p-2 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(msg)}</p>}
        </>)}
        {embedded && mine !== undefined && !off && tab === 'mine' && registerButton}
      </div>
  );
  // 「詳細」の窓。窓からも「戦う」「借りる」を押せる(一覧の行のボタンと同じ動き)
  const isRented = (e) => !!(rented && rented.ownerId === e.ownerId && rented.version === e.version);
  const detailNode = foeDetail ? (
    <CardShareDeckDetail entry={foeDetail} onClose={() => setFoeDetail(null)}
      fight={{ disabled: !onFight || fightIssues.length > 0, go: () => { if (onFight) onFight(foeDetail, cardShareFightLevel(foeDetail.tactics)); } }}
      rent={part !== 'fight' ? { disabled: busy || isRented(foeDetail), label: isRented(foeDetail) ? '借りています' : '借りる', go: () => { void rent(foeDetail); } } : null}/>
  ) : null;
  if (embedded) return <div data-card-share data-card-share-part={part}>{body}{detailNode}</div>;
  return (
    <div data-mh-screen data-card-share data-card-share-part={part} className={SCREEN_SHELL_CLASS}>
      <ScreenHead title={title} accent="text-amber-200" onBack={onBack} note={part === 'fight' ? 'だれと戦うかをえらびます' : '自分のデッキを1組登録すると、ほかのブリーダーが戦えます'}/>
      {headExtra}
      {body}
      {mine !== undefined && !off && tab === 'mine' && <div className={SCREEN_FOOTER_CLASS}>{registerButton}</div>}
      {detailNode}
    </div>
  );
};

// ==================== プロフィールの「MFバトルカードの登録デッキ」(2026-10-29 社長「設定してるデッキや戦術カードはプロフィールにリンクさせたい」) ====================
// 自分のプロフィール(56)とフレンドのプロフィール(75)に出す。登録していない人には出さない。
// 公開の印(cardShareOpen)までは、デバッグ設定の合言葉が合った端末(DEBUG_UNLOCK_KEY を読むだけ)にだけ出す
const cardShareVisible = () => {
  if (cardShareOpen()) return true;
  try { return typeof DEBUG_UNLOCK_KEY !== 'undefined' && localStorage.getItem(DEBUG_UNLOCK_KEY) === '1'; } catch (_) { return false; }
};
// プロフィールから MFバトルカードへ渡す頼み(1回だけ読む)。{ kind:'fight', entry } … そのデッキと戦う / { kind:'register' } … デッキ登録を開く
let _cardShareIntent = null;
const cardShareIntentSet = (v) => { _cardShareIntent = v || null; };
const cardShareIntentTake = () => { const v = _cardShareIntent; _cardShareIntent = null; return v; };
// ==================== プロフィールの「見せる札」: バトルカードのデッキ(2026-10-29 社長・プロフィールの整理 案B・開発部クラフトくんと分担) ====================
// 好きなモンスターの札と横に並べる。外枠はクラフトくんの好きなモンスターの札とそろえる(rounded-2xl border-2 border-amber-600/60 bg-indigo-950/50 p-2・幅は親まかせ)。
//   mode="self"   … 札だけ。未登録は「登録していません」。押すと onOpen(デッキ登録の画面へ。60-app の onCardShareGo({ kind:'register' }))
//   mode="friend" … 札だけ。未登録は null(欄ごと出さない)。「詳細 >」で中身の小さな窓
//   <CardShareDeckActions breederId onGo/> … フレンドの札の下(2枚並びの外・全幅)の「このデッキと戦う」「借りる」。戦うは onGo({ kind:'fight', entry })。未登録は null
// breederId が無いとき(自分)は、中で自分のブリーダーidを読む
const useCardShareEntry = (breederId, self = false) => {
  const [state, setState] = useState({ loading: true, entry: null });
  useEffect(() => {
    let alive = true;
    void (async () => {
      const id = typeof breederId === 'string' && breederId ? breederId : self && typeof ensureBreederId === 'function' ? await ensureBreederId().catch(() => null) : null;
      if (typeof id !== 'string' || !id) { if (alive) setState({ loading: false, entry: null }); return; }
      const r = await cardShareFetchMine(id).catch(() => null);
      if (alive) setState({ loading: false, entry: r || null });
    })();
    return () => { alive = false; };
  }, [breederId, self]);
  return state;
};
const CARD_SHARE_TILE_CLASS = 'rounded-2xl border-2 border-amber-600/60 bg-indigo-950/50 p-2';
// 3体のカード絵を少し重ねて並べる
const CardShareDeckThumbs = ({ entry }) => {
  const db = typeof CARD_BATTLE_DATA !== 'undefined' ? CARD_BATTLE_DATA : null;
  return (
    <span className="flex">{[0, 1, 2].map((i) => {
      const m = db && entry && cardMonsterOf(db, entry.deck.monsters[i]);
      return m ? <img key={i} src={CARD_IMG(m.img)} alt={m.name} className={`h-[46px] w-[33px] rounded-[4px] border border-white/70 object-cover shadow ${i ? '-ml-2' : ''}`}/>
        : <span key={i} className={`block h-[46px] w-[33px] rounded-[4px] bg-slate-700 ${i ? '-ml-2' : ''}`}/>;
    })}</span>
  );
};
// 中身の窓(3体・全カード・賢さと戦術カード・戦われた数)。2026-10-31 社長「各ブリーダーの詳細がわかりにくい。詳細ボタンつけて」で広げた。
//   プロフィールのタイルと、登録デッキの一覧(フリー対戦の「ほかのブリーダー」・デッキ登録)の「詳細」から開く。
//   一覧から開いたときは、ここからも「戦う」「借りる」を押せる(fight・rent。無ければ出さない)。
//   戦術カードは一文(CARD_TACTIC_LINE)まで見せる(プロフィールの窓は前から名前を見せていた。細かい効果の文は出さない)
const CardShareDeckDetail = ({ entry, onClose, fight = null, rent = null }) => {
  const db = typeof CARD_BATTLE_DATA !== 'undefined' ? CARD_BATTLE_DATA : null;
  const t = cardShareNormalizeTactics(entry.tactics);
  const f = t.f ? cardTacticUnpackFrames(t.f) : null;
  const monOf = (i) => (db && cardMonsterOf(db, entry.deck.monsters[i])) || null;
  const monName = (i) => (monOf(i) || {}).name || ['左のモンスター', '真ん中のモンスター', '右のモンスター'][i];
  const rareOf = (m) => (!m || !m.variant ? '' : /別絵/.test(m.variant) ? 'レアキラ' : /キラ/.test(m.variant) ? 'キラ' : '');
  const lineOf = (id) => { const c = cardTacticOf(id) || {}; return c.line || c.name || '?'; };
  const rowText = (r) => `${lineOf(r.c)} → ${lineOf(r.a)}${r.on ? '' : '(休み)'}`;
  // 全カード: 同じカードはまとめて「×枚」。種類の順(ちから・かしこさ・特殊・回避・防御・全体)→ 名前の順
  const kindOrder = ['pow', 'int', 'spe', 'dge', 'blk', 'fld'];
  const kindLabel = { pow: 'ちから', int: 'かしこさ', spe: '特殊', dge: '回避', blk: '防御', fld: '全体' };
  const counts = {};
  (entry.deck.cards || []).forEach((no) => { counts[no] = (counts[no] || 0) + 1; });
  const cardRows = Object.entries(counts).map(([no, n]) => ({ no, n, c: (db && cardOf(db, no)) || null }))
    .sort((a, b) => (kindOrder.indexOf((a.c || {}).kind) - kindOrder.indexOf((b.c || {}).kind)) || String((a.c || {}).name || a.no).localeCompare(String((b.c || {}).name || b.no), 'ja'));
  const who = (c) => (!c ? '' : c.user === 'breeder' ? 'ブリーダー' : c.user === 'any' ? '全員' : '');
  // 最近の戦績(開いたときに1回読む。読めなければ「まだ記録がありません」)
  const [record, setRecord] = useState(undefined);
  useEffect(() => { let alive = true; void cardShareRecordOf(entry.ownerId).then((r) => { if (alive) setRecord(r); }).catch(() => { if (alive) setRecord(null); }); return () => { alive = false; }; }, [entry.ownerId]);
  const losses = Math.max(0, (entry.battles || 0) - (entry.deckWins || 0));
  const dayText = (ms) => { const d = new Date(ms); return Number.isFinite(d.getTime()) ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ''; };
  return (
    <div data-card-share-deck-detail className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <div className="max-h-[86vh] w-full max-w-[440px] overflow-y-auto rounded-2xl border-2 border-amber-600/60 bg-slate-950 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {/* アイコンは絵文字のことも画像のことも(images/breeder-icons/…)ある。cardIconNode を通す(文字のまま出さない) */}
          {entry.icon ? <span className="shrink-0 text-[24px] leading-none">{cardIconNode(entry.icon, 28)}</span> : null}
          <span className="min-w-0 flex-1">
            <b data-card-share-detail-name className="block text-[15px] font-black leading-tight text-white" style={JA_WRAP_STYLE}>{jaWrap(entry.name || 'ブリーダー')}</b>
            <small data-card-share-detail-deck className="block text-[12px] font-black text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(`「${t.name || 'デッキ'}」`)}</small>
          </span>
        </div>
        {/* 3体: 絵と名前(省かない)とレア度 */}
        <div data-card-share-detail-mons className="mt-2 grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => { const m = monOf(i); const rare = rareOf(m); return (
            <div key={i} className="flex min-w-0 flex-col items-center rounded-lg bg-black/30 p-1">
              {m ? <img src={CARD_IMG(m.img)} alt={m.name} loading="lazy" className="aspect-[5/7] w-full rounded-[5px] object-cover"/> : <span className="block aspect-[5/7] w-full rounded-[5px] bg-slate-700"/>}
              <span className="mt-0.5 w-full text-center text-[11px] font-black leading-tight text-white" style={JA_WRAP_STYLE}>{jaWrap(monName(i))}</span>
              {rare && <span data-card-share-detail-rare={rare} className="mt-0.5 rounded bg-amber-300 px-1 text-[10px] font-black text-slate-950">{rare}</span>}
            </div>
          ); })}
        </div>
        {/* 戦績(戦われた回数・勝ち負け・勝ち率・借りられた数と、最近の試合) */}
        <div data-card-share-detail-stats className="mt-2 rounded-lg bg-black/30 p-2 text-[12px] font-bold text-sky-100 tabular-nums" style={JA_WRAP_STYLE}>
          <b className="block text-[12px] text-amber-100">戦績</b>
          {jaWrap(entry.battles ? `戦われた ${entry.battles}回・このデッキの ${entry.deckWins}勝${losses}敗(勝ち ${Math.round((entry.deckWins / entry.battles) * 100)}%)` : 'まだ戦われていません')}
          {entry.rents > 0 && <span className="block">{`借りられた ${entry.rents}回`}</span>}
          {entry.battles > 0 && (
            <div data-card-share-detail-record={record === undefined ? 'loading' : record ? record.length : 'none'} className="mt-1 text-[11px]">
              <span className="block text-slate-400">最近の試合(新しい順)</span>
              {record === undefined ? <span className="block text-slate-400">読み込み中…</span>
                : !record || !record.length ? <span className="block text-slate-400">まだ記録がありません</span>
                : <span className="mt-0.5 flex flex-wrap gap-1">{record.map((r, i) => (
                  <span key={i} data-card-share-detail-record-row={r.deckWon ? 'won' : 'lost'} className={`rounded px-1 py-0.5 font-black ${r.deckWon ? 'bg-emerald-500/25 text-emerald-100' : 'bg-rose-500/25 text-rose-100'}`}>
                    {`${dayText(r.at)} ${r.deckWon ? '勝ち' : '負け'}`}
                  </span>))}</span>}
            </div>
          )}
        </div>
        {/* 賢さと戦術カード */}
        <div className="mt-2 rounded-lg bg-black/30 p-2 text-[11.5px] text-slate-200" style={JA_WRAP_STYLE}>
          <b data-card-share-detail-smart={cardShareSmartLevel(t)} className="block text-[13px] text-amber-200">{jaWrap(`賢さ ${cardShareSmartText(t)}`)}</b>
          {f && <div className="mt-0.5">{jaWrap(`基本の型: ${f.base.filter(Boolean).map((id) => (cardTacticOf(id) || {}).name).join('・') || 'なし'}`)}</div>}
          {t.aces.length > 0 && <div className="mt-0.5">{jaWrap(`切り札: ${t.aces.map((no) => ((db && cardOf(db, no)) || {}).name || no).join('・')}`)}</div>}
          {f && (
            <div className="mt-1 space-y-1">
              <b className="block text-[12px] text-amber-100">セットした戦術カード(上から順に見て、当てはまったもの)</b>
              {[...f.mons.map((rows, i) => [monName(i), rows]), ['ブリーダー', f.breeder]].map(([label, rows]) => (
                <div key={label}><b className="text-amber-100">{label}</b>{rows.length ? rows.map((r, j) => <div key={j}>{jaWrap(`${j + 1}. ${rowText(r)}`)}</div>) : <div className="text-slate-400">(なし)</div>}</div>
              ))}
            </div>
          )}
        </div>
        {/* デッキの全カード */}
        <div data-card-share-detail-cards={entry.deck.cards.length} className="mt-2 rounded-lg bg-black/30 p-2">
          <b className="block text-[12px] font-black text-amber-100">{`デッキのカード(${entry.deck.cards.length}枚)`}</b>
          <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11.5px] font-bold text-slate-200">
            {cardRows.map(({ no, n, c }) => (
              <div key={no} data-card-share-detail-card={no} className="flex min-w-0 items-baseline gap-1">
                <span className="shrink-0 text-[10px] text-slate-400">{kindLabel[(c || {}).kind] || ''}</span>
                <span className="min-w-0 flex-1" style={JA_WRAP_STYLE}>{jaWrap(`${(c || {}).name || no}${who(c) ? `(${who(c)})` : ''}`)}</span>
                <span className="shrink-0 tabular-nums text-amber-200">{`×${n}`}</span>
              </div>
            ))}
          </div>
        </div>
        {(fight || rent) && (
          <div className="mt-3 flex gap-2">
            {fight && <button type="button" data-card-share-detail-fight disabled={fight.disabled} onClick={() => { onClose(); fight.go(); }} className="mh-button mh-button-primary min-h-[44px] flex-1 rounded-xl text-[14px] font-black disabled:opacity-50">戦う</button>}
            {rent && <button type="button" data-card-share-detail-rent disabled={rent.disabled} onClick={() => { onClose(); rent.go(); }} className="min-h-[44px] flex-1 rounded-xl border border-emerald-300/50 bg-slate-900 text-[13px] font-black text-emerald-100 disabled:opacity-50">{rent.label}</button>}
          </div>
        )}
        <button type="button" data-card-share-deck-detail-close onClick={onClose} className="mt-2 w-full rounded-xl bg-slate-800 py-2 text-[13px] font-black text-white">とじる</button>
      </div>
    </div>
  );
};
const CardShareDeckTile = ({ mode = 'self', breederId = null, onOpen = null }) => {
  const self = mode === 'self';
  const { loading, entry } = useCardShareEntry(breederId, self);
  const [detail, setDetail] = useState(false);
  if (!self && (loading || !entry)) return null;
  const t = entry ? cardShareNormalizeTactics(entry.tactics) : null;
  const head = <small className="block text-[10px] font-black text-amber-300">バトルカードのデッキ</small>;
  const tile = self ? (
    <button type="button" data-profile-show="card-deck" data-card-share-tile="self" onClick={() => { if (onOpen) { Audio_.fgSe.tap(); onOpen(); } }} className={`${CARD_SHARE_TILE_CLASS} block w-full text-left active:scale-[.98]`}>
      {head}
      {loading ? <span className="mt-2 block text-[12px] font-bold text-slate-400">読み込み中…</span> : entry ? (<>
        <span className="mt-1.5 block"><CardShareDeckThumbs entry={entry}/></span>
        <b className="mt-1 block truncate text-[14px] font-black text-white">{t.name || 'デッキ'}</b>
        <small className="block text-[11px] font-black text-pink-300">{(cardShareSmartText(t).split('(')[0])}</small>
      </>) : (<>
        <span className="mt-2 block text-[13px] font-black text-slate-300">登録していません</span>
        <small className="block text-[10px] font-bold text-slate-400">押すとデッキ登録へ</small>
      </>)}
    </button>
  ) : (
    <div data-profile-show="card-deck" data-card-share-tile="friend" className={CARD_SHARE_TILE_CLASS}>
      {head}
      <span className="mt-1.5 block"><CardShareDeckThumbs entry={entry}/></span>
      <b className="mt-1 block truncate text-[14px] font-black text-white">{t.name || 'デッキ'}</b>
      <small className="block text-[11px] font-black text-pink-300">{(cardShareSmartText(t).split('(')[0])}</small>
      <button type="button" data-card-share-tile-detail onClick={() => { Audio_.fgSe.tap(); setDetail(true); }} className="mt-0.5 text-[11px] font-black text-pink-200">
        {`${entry.battles}戦 ${entry.deckWins}勝 詳細 ›`}
      </button>
    </div>
  );
  if (self) return tile;
  return (
    <div data-card-share-tile-wrap>
      {tile}
      {detail && <CardShareDeckDetail entry={entry} onClose={() => setDetail(false)}/>}
    </div>
  );
};
// 札の下に出すボタン(フレンド)。横2枚並びの札の外、全幅に置けるように別の部品にする
const CardShareDeckActions = ({ breederId, onGo = null }) => {
  const { entry } = useCardShareEntry(breederId, false);
  const [msg, setMsg] = useState('');
  if (!entry) return null;
  const rent = async () => {
    if (typeof cardRentedDeckSet !== 'function') return;
    setMsg((await cardRentedDeckSet(entry)) ? 'このデッキを借りました。フリー対戦の前のデッキ選びで使えます' : 'この端末に保存できなかったため、借りられませんでした');
  };
  return (
    <div data-card-share-tile-actions>
      <div className="flex gap-2">
        {onGo && <button type="button" data-card-share-tile-fight onClick={() => { Audio_.fgSe.tap(); onGo({ kind: 'fight', entry }); }} className="mh-button mh-button-primary min-h-[44px] flex-1 rounded-xl text-[13px] font-black">このデッキと戦う</button>}
        <button type="button" data-card-share-tile-rent onClick={() => { Audio_.fgSe.tap(); void rent(); }} className="min-h-[44px] flex-1 rounded-xl border-2 border-amber-600/60 bg-indigo-950/50 text-[13px] font-black text-white">借りる</button>
      </div>
      {msg && <p data-card-share-tile-msg className="mt-1.5 rounded-lg bg-slate-950 p-1.5 text-[12px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{msg}</p>}
    </div>
  );
};

// ==================== 登録デッキが戦われた試合の一覧(2026-10-31 社長「案A・戦った人の名前は出す・新しい20試合」) ====================
// デッキ登録(98)の「戦われた試合を見る」から。タブ: ぜんぶ / フリー対戦(表 card_deck_replays)/ 大会(99 の表から、自分の席の試合)
// 「勝ち」「負け」は登録したデッキから見た結果。表がまだ無い・通信できないときは「まだ記録がありません」だけ(落ちない)
// onOpenDeck(ownerId, slot, { title }) / onOpenTour(matchId, title) … 見返しを開く(開けたら true)。known … 会った助手の id(大会の助手の名前を伏せる)
const CardDeckReplays = ({ onBack, onOpenDeck, onOpenTour, known = null }) => {
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState(null); // [{ key, kind:'free'|'tour', name, icon, frame, at, won, sub, old, open }]
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let alive = true;
    void (async () => {
      const selfId = typeof ensureBreederId === 'function' ? await ensureBreederId().catch(() => null) : null;
      const out = [];
      if (typeof selfId === 'string') {
        const rows = await cardShareReplaysOf(selfId).catch(() => null);
        (rows || []).forEach((r) => out.push({ key: `d${r.slot}-${r.at}`, kind: 'free', name: r.name, icon: r.icon, frame: r.frame, at: r.at, won: r.deckWon, old: r.old,
          sub: `${typeof cardReplayWhen === 'function' ? cardReplayWhen(r.at) : ''}${r.turns ? `・ターン${r.turns}まで` : ''}`,
          title: `フリー対戦 ${typeof cardReplayWhen === 'function' ? cardReplayWhen(r.at) : ''}`.trim(), open: (title) => onOpenDeck(selfId, r.slot, { title }) }));
        // 大会: 自分の席が入っている、結果の出た試合
        const tours = typeof cardTourFetchList === 'function' ? await cardTourFetchList().catch(() => null) : null;
        for (const t of (tours || []).filter((x) => x.status !== 'entry').slice(0, 6)) {
          const view = await cardTourFetchView(t.id, selfId).catch(() => null);
          if (!view) continue;
          const now = Date.now();
          view.matches.filter((m) => m.winner !== null && m.visibleAt <= now).forEach((m) => {
            const seats = cardTourStageSeats(view, m.stage, m.grp);
            const A = seats.find((e) => cardTourSeatKey(e, m.stage) === m.a), B = seats.find((e) => cardTourSeatKey(e, m.stage) === m.b);
            const side = A && A.mine ? 0 : B && B.mine ? 1 : -1;
            if (side < 0) return;
            const foe = side === 0 ? B : A;
            const label = `${t.name} ${m.stage === 'final' ? '頂上決戦' : `第${m.day + 1}試合`}`;
            out.push({ key: `t${m.id}`, kind: 'tour', name: foe ? cardTourNameOf(foe, known) : 'ブリーダー', icon: null, frame: null, at: m.visibleAt, won: m.winner === side, old: false,
              sub: label, title: label, open: (title) => onOpenTour(m.id, title) });
          });
        }
      }
      out.sort((x, y) => y.at - x.at);
      if (alive) setItems(out);
    })();
    return () => { alive = false; };
  }, []);
  const shown = (items || []).filter((x) => tab === 'all' || x.kind === tab);
  const open = async (x) => {
    if (busy) return;
    Audio_.fgSe.tap();
    setBusy(true);
    setMsg('');
    let ok = false;
    try { ok = await x.open(x.title); } catch (_) { ok = false; }
    setBusy(false);
    if (ok === false) setMsg('この試合は、いまは見返せません。時間をおいて開き直してください');
  };
  return (
    <div data-mh-screen data-card-deck-replays className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="戦われた試合" accent="text-amber-200" onBack={onBack} note={`登録中のデッキが戦った試合。フリー対戦は新しい${CARD_SHARE_REPLAY_SLOTS}試合まで`}/>
      <div className="mb-2 grid shrink-0 grid-cols-3 gap-1.5" role="tablist">
        {[['all', 'ぜんぶ'], ['free', 'フリー対戦'], ['tour', '大会']].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} data-card-deck-replays-tab={k} onClick={() => { Audio_.fgSe.tap(); setTab(k); }}
            className={`min-h-[40px] rounded-xl border text-[13px] font-black ${tab === k ? 'border-amber-300 bg-amber-500/25 text-amber-50' : 'border-white/10 bg-slate-900/80 text-slate-300'}`}>{label}</button>
        ))}
      </div>
      <div className={`${SCREEN_LIST_CLASS} space-y-1.5 pb-4`}>
        {msg && <p data-card-deck-replays-note className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-2 py-1.5 text-[12px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(msg)}</p>}
        {items === null && <div className="py-6 text-center text-[13px] font-bold text-slate-400">読み込み中…</div>}
        {/* 戦績のまとめ(2026-10-31 社長「誰に挑まれてとか戦績も見たい」): いま見ているタブの試合の、このデッキの勝ち負けと勝ち率 */}
        {items && shown.length > 0 && (() => {
          const won = shown.filter((x) => x.won).length;
          return <p data-card-deck-replays-total={`${won}-${shown.length - won}`} className="rounded-xl border border-white/10 bg-black/30 px-2 py-1.5 text-[12px] font-black text-sky-100 tabular-nums" style={JA_WRAP_STYLE}>
            {jaWrap(`このデッキの戦績: ${shown.length}試合 ${won}勝${shown.length - won}敗(勝ち ${Math.round((won / shown.length) * 100)}%)`)}</p>;
        })()}
        {items && !shown.length && <div data-card-deck-replays-empty className="py-6 text-center text-[13px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('まだ記録がありません。ほかのブリーダーがあなたのデッキと戦うと、ここに残ります')}</div>}
        {shown.map((x) => (
          <button key={x.key} type="button" data-card-deck-replays-row={x.kind} disabled={busy} onClick={() => { void open(x); }}
            className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-2 py-1.5 text-left disabled:opacity-60">
            <span className="block h-[38px] w-[38px] shrink-0 overflow-hidden rounded-xl bg-black/40">
              {x.kind === 'tour' ? <span className="grid h-full w-full place-items-center text-[20px]">🏆</span>
                : typeof CardPvpAvatar === 'function' ? <CardPvpAvatar icon={x.icon || '🙂'} frame={x.frame} className="h-full w-full"/> : <span className="text-[20px]">🙂</span>}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <b className="min-w-0 truncate text-[14px] font-black text-white">{x.name}</b>
                <span className={`shrink-0 rounded-md px-1.5 text-[10px] font-black ${x.kind === 'tour' ? 'bg-amber-500/30 text-amber-100' : 'bg-emerald-500/25 text-emerald-100'}`}>{x.kind === 'tour' ? '大会' : 'フリー'}</span>
                {x.old && <span className="shrink-0 rounded-md bg-slate-700 px-1.5 text-[10px] font-black text-slate-200">前の登録</span>}
              </span>
              <small className="block truncate text-[11px] font-bold text-slate-400">{x.sub}</small>
            </span>
            <span className="shrink-0 text-right">
              <b className={`block text-[13px] font-black ${x.won ? 'text-orange-400' : 'text-sky-400'}`}>{x.won ? '勝ち' : '負け'}</b>
              <small className="text-[10px] font-bold text-slate-400">見返す ›</small>
            </span>
          </button>
        ))}
        <p className="px-1 text-[11px] font-bold leading-snug text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('「勝ち」「負け」は、あなたの登録デッキから見た結果です。見返しは戦った人の画面と同じ並びで、上があなたのデッキです')}</p>
      </div>
    </div>
  );
};
