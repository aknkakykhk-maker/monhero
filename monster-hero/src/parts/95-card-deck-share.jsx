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
  return { habit, tilt, aces, name };
};
// 戦い方から、助手の打ち方(cardAiPolicy の形)を作る。強さは戦う人が選ぶ
const cardSharePolicy = (tactics, levelId, opts = {}) => {
  const t = cardShareNormalizeTactics(tactics);
  const base = cardAiPolicy(t.habit, levelId, opts);
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

// ---- 画面: みんなのデッキ(区切り② 登録・③ 戦う) ----
// db … カードの表 / decks … 自分のデッキ(cardNormalizeDecks の形)/ collection … 持っているカード / frame … プロフィールのフレーム / onBack … 対戦えらびへ
// unlocked … 助手と対戦で開いた強さ(cardLevelOpen)/ debug … デバッグから入った(強さを全部選べる)/ onFight(entry, level) … 登録デッキと戦う(84 の startBattle へ)
const CardDeckShare = ({ db, decks, collection, frame = null, onBack, unlocked = null, debug = false, onFight = null }) => {
  const [tab, setTab] = useState(onFight ? 'fight' : 'mine');
  const [foes, setFoes] = useState(null);             // { picks, friends, popular } … 戦う相手の3つの並び
  const [level, setLevel] = useState('normal');
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
  const habits = Object.keys(CARD_AI_HABITS).filter((id) => cardFoeReleased(id));
  const habitName = (id) => ((typeof ASSISTANTS !== 'undefined' && ASSISTANTS.find((a) => a.id === id)) || {}).name || id;
  const uniqueCards = picked ? [...new Set(picked.cards)] : [];
  const cardName = (no) => ((cardOf(db, no) || {}).name) || no;
  const setTilt = (id, n) => setTactics((t) => ({ ...t, tilt: { ...t.tilt, [id]: n } }));
  const toggleAce = (no) => setTactics((t) => (t.aces.includes(no) ? { ...t, aces: t.aces.filter((x) => x !== no) } : t.aces.length >= CARD_SHARE_ACES_MAX ? t : { ...t, aces: [...t.aces, no] }));
  const issues = issuesOf(picked);
  const register = async () => {
    if (!picked || issues.length || !selfId || busy) return;
    setBusy(true); setMsg('');
    const r = await cardShareRegister({ ownerId: selfId, name: profile.name, icon: profile.icon, frame, deck: picked, tactics: { ...cardShareNormalizeTactics(tactics, picked), name: picked.name } });
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
  const levels = CARD_LEVEL_ORDER.filter((lv) => debug || cardLevelOpen(unlocked, lv));
  const fightIssues = issuesOf(list.find((d) => d.id === (decks && decks.active)) || list[0] || null);
  const foeRow = (e) => (
    <li key={e.ownerId} data-card-share-foe={e.ownerId} className="flex items-center gap-2 rounded-xl bg-black/30 px-2 py-2">
      {typeof CardPvpAvatar === 'function' && <CardPvpAvatar icon={e.icon} frame={e.frame} className="h-9 w-9"/>}
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[13px] font-black text-white">{e.name}</b>
        <small className="block truncate text-[11px] font-bold text-slate-300">{e.tactics.name || 'デッキ'}・{e.deck.monsters.map((no) => ((cardMonsterOf(db, no) || {}).name) || no).join('・')}</small>
        <small className="block text-[10px] font-bold text-sky-200 tabular-nums">{e.battles ? `戦われた ${e.battles}回・デッキの勝ち ${Math.round((e.deckWins / e.battles) * 100)}%` : 'まだ戦われていません'}</small>
      </span>
      <button type="button" data-card-share-fight={e.ownerId} disabled={!onFight || fightIssues.length > 0} className="mh-button mh-button-primary min-h-[40px] shrink-0 rounded-lg px-3 text-[12px] font-black disabled:opacity-50"
        onClick={() => { Audio_.fgSe.tap(); if (onFight) onFight(e, level); }}>戦う</button>
    </li>
  );
  const foeList = (title, rows, key) => (
    <div className={SCREEN_PANEL_CLASS} data-card-share-list={key}>
      <div className="text-[12px] font-bold text-slate-400">{title}</div>
      {rows.length ? <ul className="mt-1 space-y-1">{rows.map(foeRow)}</ul> : <p className="mt-1 text-[12px] font-bold text-slate-400">{key === 'friends' ? 'デッキを登録しているフレンドはいません' : 'まだだれも登録していません'}</p>}
    </div>
  );
  return (
    <div data-mh-screen data-card-share className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="みんなのデッキ" accent="text-amber-200" onBack={onBack} note="自分のデッキを1組登録すると、ほかのブリーダーが戦えます"/>
      <div className={`${SCREEN_LIST_CLASS} space-y-3 pb-4`}>
        {mine === undefined && <p className="text-[13px] font-bold text-slate-300">読み込み中…</p>}
        {mine !== undefined && off && <p data-card-share-off className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-3 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap('いまは準備中です。しばらくしてから、もう一度開いてください')}</p>}
        {mine !== undefined && !off && onFight && (
          <div className="flex gap-1.5" role="tablist">
            {[['fight', '戦う'], ['mine', '自分のデッキを登録']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} data-card-share-tab={id} className={`flex-1 ${chip(tab === id)} py-2`} onClick={() => { Audio_.fgSe.tap(); setTab(id); }}>{label}</button>)}
          </div>
        )}
        {mine !== undefined && !off && tab === 'fight' && (<>
          <div className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">強さ(読みの深さ。もらえるビートPは助手と対戦と同じ)</div>
            <div className="mt-1 flex flex-wrap gap-1.5">{levels.map((lv) => <button key={lv} type="button" data-card-share-level={lv} className={chip(level === lv)} onClick={() => setLevel(lv)}>{(typeof CARD_LEVEL_LABEL !== 'undefined' && CARD_LEVEL_LABEL[lv]) || lv.toUpperCase()}</button>)}</div>
            {fightIssues.length > 0 && <p className="mt-1 text-[12px] font-bold text-rose-200" style={JA_WRAP_STYLE}>{jaWrap(`使うデッキ: ${fightIssues[0]}`)}</p>}
          </div>
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
              <div className="text-[15px] font-black text-white">{mine.tactics.name || 'デッキ'}<small className="ml-2 text-[11px] text-slate-300">{habitName(mine.tactics.habit)}の打ち方</small></div>
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
            <div className="mt-1 text-[12px] font-bold text-slate-300">土台の打ち方</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {habits.map((id) => <button key={id} type="button" data-card-share-habit={id} className={chip(tactics.habit === id)} onClick={() => { Audio_.fgSe.tap(); setTactics((t) => ({ ...t, habit: id })); }}>{habitName(id)}</button>)}
            </div>
            <div className="mt-2 space-y-1">
              {CARD_SHARE_TILTS.map((x) => (
                <div key={x.id} data-card-share-tilt={x.id} className="flex items-center gap-2">
                  <span className="w-[6.5em] shrink-0 text-[12px] font-bold text-slate-200">{x.label}</span>
                  {[[-1, '控えめ'], [0, 'ふつう'], [1, '強め']].map(([n, label]) => <button key={n} type="button" className={chip(tactics.tilt[x.id] === n)} onClick={() => setTilt(x.id, n)}>{label}</button>)}
                </div>
              ))}
            </div>
            <div className="mt-2 text-[12px] font-bold text-slate-300">切り札(出せるときは優先して使う・{CARD_SHARE_ACES_MAX}枚まで)</div>
            <div data-card-share-aces className="mt-1 flex max-h-[30vh] flex-wrap gap-1.5 overflow-y-auto">
              {uniqueCards.map((no) => <button key={no} type="button" data-card-share-ace={no} className={chip(tactics.aces.includes(no))} onClick={() => toggleAce(no)}>{cardName(no)}</button>)}
            </div>
          </div>
          <p className="px-1 text-[11px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('登録できるのは1組だけです。登録し直すと、前の登録と入れかわります。登録した端末でだけ、書きかえ・やめる・報酬の受け取りができます(端末を変えるときは、バックアップで引き継げます)')}</p>
          {msg && <p data-card-share-msg className="rounded-xl bg-slate-900 p-2 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(msg)}</p>}
        </>)}
      </div>
      {mine !== undefined && !off && tab === 'mine' && (
        <div className={SCREEN_FOOTER_CLASS}>
          <button type="button" data-card-share-register disabled={busy || !picked || issues.length > 0 || !selfId} className="mh-button mh-button-primary min-h-[52px] w-full rounded-2xl font-black disabled:opacity-40" onClick={() => { Audio_.fgSe.tap(); void register(); }}>{mine ? 'このデッキで登録し直す' : 'このデッキを登録する'}</button>
        </div>
      )}
    </div>
  );
};
