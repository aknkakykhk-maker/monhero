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
// 戦い方の7つの向き(82 の CARD_AI_HABITS の項目と同じ名前)。-1 控えめ / 0 ふつう / 1 強め
const CARD_SHARE_TILTS = Object.freeze([
  { id: 'attack', label: '攻める' }, { id: 'keepGuard', label: '守りを残す' }, { id: 'saveGuts', label: 'ガッツをためる' },
  { id: 'big', label: '大技' }, { id: 'disrupt', label: '相手を崩す' }, { id: 'area', label: '全体技' }, { id: 'finish', label: 'とどめ' },
]);
const CARD_SHARE_TILT_MUL = Object.freeze({ '-1': 0.6, 0: 1, 1: 1.6 });
const CARD_SHARE_ACES_MAX = 3;
let _cardShareUnavailable = false; // 表がまだ無い(SQL 未適用)と分かったら、その回は読みに行かない

// 公開の印。区切り⑤(報酬)まで入るまでは、デバッグ設定から入ったときだけ押せる
const cardShareOpen = () => false;

// 戦い方をきれいにする(知らない項目は捨てる・無い人は既定で補う)。deck を渡すと、切り札はそのデッキに入っている札だけ残す
const cardShareNormalizeTactics = (v, deck = null) => {
  const r = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const habit = typeof r.habit === 'string' && Object.prototype.hasOwnProperty.call(CARD_AI_HABITS, r.habit) ? r.habit : 'kyuko';
  const tilt = {};
  CARD_SHARE_TILTS.forEach((t) => { const n = r.tilt && r.tilt[t.id]; tilt[t.id] = n === -1 || n === 1 ? n : 0; });
  const inDeck = deck && Array.isArray(deck.cards) ? new Set(deck.cards) : null;
  const aces = [...new Set((Array.isArray(r.aces) ? r.aces : []).filter((x) => typeof x === 'string' && /^[0-9]{3}$/.test(x) && (!inDeck || inDeck.has(x))))].slice(0, CARD_SHARE_ACES_MAX);
  const name = typeof r.name === 'string' ? r.name.slice(0, 20) : '';
  // f … 戦術カードの枠(82-card-tactics-core の短い形。2026-10-29 社長)。無い登録(前の形)は、くせと傾きで打つ
  const f = r.f && typeof r.f === 'object' && !Array.isArray(r.f) && typeof cardTacticPackFrames === 'function' ? cardTacticPackFrames(cardTacticUnpackFrames(r.f)) : null;
  return { habit, tilt, aces, name, ...(f ? { f } : {}) };
};
// 登録デッキの賢さ(戦術カードの枠から。2026-10-29 社長「デッキ側で決まる・戦う人は選ばない」)。前の形の登録は NORMAL
//   'random' … 何も入れていない(出せる手からランダム)。報酬と経験値は EASY で数える
const cardShareSmartLevel = (tactics) => {
  const t = cardShareNormalizeTactics(tactics);
  return t.f && typeof cardTacticSmartLevel === 'function' ? cardTacticSmartLevel(cardTacticUnpackFrames(t.f)) : 'normal';
};
const cardShareRowsCount = (frames) => frames.breeder.filter((x) => x.on).length + frames.mons.reduce((a, r) => a + r.filter((x) => x.on).length, 0);
const cardShareSmartText = (tactics) => {
  const t = cardShareNormalizeTactics(tactics);
  const lv = cardShareSmartLevel(t);
  const label = lv === 'random' ? 'でたらめ' : `${(typeof CARD_LEVEL_LABEL !== 'undefined' && CARD_LEVEL_LABEL[lv]) || lv.toUpperCase()} 相当`;
  if (!t.f) return label;
  const f = cardTacticUnpackFrames(t.f);
  return `${label}(基本${f.base.filter(Boolean).length}・行${cardShareRowsCount(f)})`;
};
// 土台のくせ(メインの基本カードが助手の型ならその助手。前の形の登録や画面の名前に使う)
const cardShareMainHabit = (frames, fallback = 'kyuko') => {
  const c = frames && typeof cardTacticOf === 'function' ? cardTacticOf(frames.base[0]) : null;
  const g = c && typeof CARD_TACTIC_GROUPS !== 'undefined' ? CARD_TACTIC_GROUPS.find((x) => x.id === c.g) : null;
  return (g && g.habit) || fallback || 'kyuko';
};
const cardShareFightLevel = (tactics) => { const lv = cardShareSmartLevel(tactics); return lv === 'random' ? 'easy' : lv; };
// 戦い方から、助手の打ち方(cardAiPolicy の形)を作る。戦術カードの枠があれば、その枠で打つ(強さは枠の賢さ)
const cardSharePolicy = (tactics, levelId, opts = {}) => {
  const t = cardShareNormalizeTactics(tactics);
  if (t.f) {
    const frames = cardTacticUnpackFrames(t.f);
    const base = cardAiPolicy(t.habit, cardShareFightLevel(t), { ...opts, noTactics: true });
    return { ...base, gambit: frames, gambitRandom: true, aces: t.aces.slice() };
  }
  const base = cardAiPolicy(t.habit, levelId, { ...opts, noTactics: true });
  const habit = { ...base.habit };
  CARD_SHARE_TILTS.forEach((x) => { if (Number.isFinite(habit[x.id])) habit[x.id] = habit[x.id] * CARD_SHARE_TILT_MUL[t.tilt[x.id]]; });
  return { ...base, habit, aces: t.aces.slice() };
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
const CardDeckShare = ({ db, decks, collection, frame = null, onBack, unlocked = null, debug = false, onFight = null, onOpenTactics = null, part = 'all', title = 'みんなのデッキ', headExtra = null, embedded = false }) => {
  const [tab, setTab] = useState(part === 'mine' ? 'mine' : onFight ? 'fight' : 'mine');
  const [foes, setFoes] = useState(null);             // { picks, friends, popular } … 戦う相手の3つの並び
  // 戦術カード(96・97): 登録するときに載せる枠(レベルで開いている枠・持っているカードだけ)
  const [tacticsSave, setTacticsSave] = useState(null);
  useEffect(() => { if (typeof cardTacticsLoad === 'function') void cardTacticsLoad().then(setTacticsSave).catch(() => {}); }, []);
  const framesNow = tacticsSave && typeof cardTacticsFramesForBattle === 'function' ? cardTacticsFramesForBattle(tacticsSave.tactics, tacticsSave.info.level) : null;
  const [rented, setRented] = useState(null);         // 借りているデッキ(cardRentedDeckGet)
  useEffect(() => { void cardRentedDeckGet().then(setRented); }, []);
  const rent = async (e) => {
    if (busy) return;
    setBusy(true); setMsg('');
    if (await cardRentedDeckSet(e)) { setRented(await cardRentedDeckGet()); setMsg(`${e.name}さんのデッキを借りました。助手と対戦のデッキ選びで使えます`); }
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
    else setMsg(r === 'locked' ? 'この端末では登録を書きかえられません(登録した端末で操作してください)' : r === 'bad' ? 'このデッキは登録できませんでした' : r === 'nokey' ? 'この端末に保存できなかったため、登録できませんでした' : '通信できませんでした。電波のよい所で、もう一度お試しください');
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
  const foeRow = (e) => (
    <li key={e.ownerId} data-card-share-foe={e.ownerId} className="flex items-center gap-2 rounded-xl bg-black/30 px-2 py-2">
      {typeof CardPvpAvatar === 'function' && <CardPvpAvatar icon={e.icon} frame={e.frame} className="h-9 w-9"/>}
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[13px] font-black text-white">{e.name}</b>
        <small className="block truncate text-[11px] font-bold text-slate-300">{e.tactics.name || 'デッキ'}・{e.deck.monsters.map((no) => ((cardMonsterOf(db, no) || {}).name) || no).join('・')}</small>
        <small data-card-share-smart={cardShareSmartLevel(e.tactics)} className="block text-[10px] font-black text-amber-200">{`賢さ ${cardShareSmartText(e.tactics)}`}</small>
        <small className="block text-[10px] font-bold text-sky-200 tabular-nums">{e.battles ? `戦われた ${e.battles}回・デッキの勝ち ${Math.round((e.deckWins / e.battles) * 100)}%` : 'まだ戦われていません'}</small>
      </span>
      <span className="flex shrink-0 flex-col gap-1">
        <button type="button" data-card-share-fight={e.ownerId} disabled={!onFight || fightIssues.length > 0} className="mh-button mh-button-primary min-h-[36px] rounded-lg px-3 text-[12px] font-black disabled:opacity-50"
          onClick={() => { Audio_.fgSe.tap(); if (onFight) onFight(e, cardShareFightLevel(e.tactics)); }}>戦う</button>
        {part !== 'fight' && <button type="button" data-card-share-rent={e.ownerId} disabled={busy || (rented && rented.ownerId === e.ownerId && rented.version === e.version)} className="min-h-[30px] rounded-lg border border-emerald-300/50 bg-slate-900 px-2 text-[11px] font-black text-emerald-100 disabled:opacity-50"
          onClick={() => { Audio_.fgSe.tap(); void rent(e); }}>{rented && rented.ownerId === e.ownerId && rented.version === e.version ? '借りています' : '借りる'}</button>}
      </span>
    </li>
  );
  const foeList = (title, rows, key) => (
    <div className={SCREEN_PANEL_CLASS} data-card-share-list={key}>
      <div className="text-[12px] font-bold text-slate-400">{title}</div>
      {rows.length ? <ul className="mt-1 space-y-1">{rows.map(foeRow)}</ul> : <p className="mt-1 text-[12px] font-bold text-slate-400">{key === 'friends' ? 'デッキを登録しているフレンドはいません' : 'まだだれも登録していません'}</p>}
    </div>
  );
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
            <div className="text-[12px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('相手の強さは、登録した人が入れた戦術カードで決まります(賢さ)。もらえるビートPは、その賢さの助手と対戦と同じです')}</div>
            {fightIssues.length > 0 && <p className="mt-1 text-[12px] font-bold text-rose-200" style={JA_WRAP_STYLE}>{jaWrap(`使うデッキ: ${fightIssues[0]}`)}</p>}
          </div>
          {rented && part !== 'fight' && (
            <div data-card-share-rented className={`${SCREEN_PANEL_CLASS} flex items-center gap-2`}>
              <span className="min-w-0 flex-1 text-[12px] font-bold text-emerald-100" style={JA_WRAP_STYLE}>{jaWrap(`借りているデッキ: ${rented.name}さんの「${rented.deckName || 'デッキ'}」(助手と対戦のデッキ選びで使えます。マルチ対戦では使えません)`)}</span>
              <button type="button" data-card-share-giveback disabled={busy} className="shrink-0 rounded-lg border border-white/15 bg-slate-900 px-2 py-1 text-[11px] font-black text-slate-200 disabled:opacity-50" onClick={() => { Audio_.fgSe.tap(); void giveBack(); }}>返す</button>
            </div>
          )}
          {msg && tab === 'fight' && <p className="rounded-xl bg-slate-900 p-2 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(msg)}</p>}
          {foes === null ? <p className="text-[13px] font-bold text-slate-300">読み込み中…</p> : (<>
            {foeList('おすすめ', foes.picks, 'picks')}
            <button type="button" data-card-share-reload className="w-full rounded-xl border border-white/15 bg-slate-900 py-2 text-[12px] font-black text-slate-200" onClick={() => { Audio_.fgSe.tap(); void loadFoes(); }}>ほかの人をさがす</button>
            {foeList('フレンドのデッキ', foes.friends, 'friends')}
            {foeList('よく戦われているデッキ', foes.popular, 'popular')}
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
                <div>{`行: ${cardShareRowsCount(framesNow)}`}</div>
                <div className="text-amber-200">{`賢さ: ${cardShareSmartText({ f: cardTacticPackFrames(framesNow) })}`}</div>
                {cardShareSmartLevel({ f: cardTacticPackFrames(framesNow) }) === 'random' && <div data-card-share-tactics-empty className="text-rose-200">{jaWrap('戦術カードが入っていません。このままだと、出せる手からでたらめに打ちます')}</div>}
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
  if (embedded) return <div data-card-share data-card-share-part={part}>{body}</div>;
  return (
    <div data-mh-screen data-card-share data-card-share-part={part} className={SCREEN_SHELL_CLASS}>
      <ScreenHead title={title} accent="text-amber-200" onBack={onBack} note={part === 'fight' ? 'だれと戦うかをえらびます' : '自分のデッキを1組登録すると、ほかのブリーダーが戦えます'}/>
      {headExtra}
      {body}
      {mine !== undefined && !off && tab === 'mine' && <div className={SCREEN_FOOTER_CLASS}>{registerButton}</div>}
    </div>
  );
};
