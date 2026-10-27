// ==================== MFバトルカードのランキング(社長 台帳 #3513) ====================
// 競うもの: 助手と対戦の勝ち数(難易度ごと・今週と通算)/ 連勝の数 / カード図鑑の集めた数 / マルチ対戦の強さ(マルチができてから。いまは「準備中」の札だけ)
// 作り: マスモンランキング(39-rhythm-buddy-rank-api.jsx)と同じ。新しい表 card_battle_ranks へ「1人1行」を上書き保存し、並べ替えは表の側で行う。
//   既存の rankings / bond_levels / rhythm_buddy_ranks には一切書かない。表がまだ無い環境でも壊れない(無いと分かったら以後アクセスしない)。
//   SQL: docs/sql/card-battle-ranks/CARD_BATTLE_RANKS_APPLY.sql
// 送ってよいのは、本当に対戦して勝った記録だけ(cardRecordAfter の rankable。公開前・デバッグの入口からの対戦は数えない・送らない)。
// デバッグの合言葉を入れた端末でも、HOME の入口から遊んだ分は送る(2026-10-26 社長「ふつうの入口の対戦はのせる」)
const CARD_RANK_TABLE = 'card_battle_ranks';
// 2026-10-26 社長「ブリーダーIDで数える形に直す」: これからは一人ひとりの ID(breeder_id)で上書きする新しい表へ書く。
// 古い表(名前で1行)は消さず書き換えず、まだ新しい表に来ていない人の行として読むだけ。SQL: docs/sql/card-battle-ranks/CARD_BATTLE_RANKS_V2_APPLY.sql
// 新しい表がまだ無い環境では、今までどおり古い表へ書く
const CARD_RANK_TABLE_V2 = 'card_battle_ranks_v2';
const CARD_RANK_SELECT = 'user_name,breeder_id,icon,profile_frame,week_key,'
  + CARD_LEVEL_ORDER.map((lv) => `wins_${lv},week_wins_${lv}`).join(',') + ',best_streak,current_streak,dex_count,dex_total,updated_at';
const CARD_RANK_FETCH_LIMIT = 150;
const CARD_RANK_SHOW_LIMIT = 50;
const CARD_RANK_CACHE_MS = 60 * 1000;
let _cardRanksUnavailable = false;   // 古い表(card_battle_ranks)が無い
let _cardRanksV2Unavailable = false; // 新しい表(card_battle_ranks_v2)が無い
const cardRanksUnavailable = () => _cardRanksUnavailable && _cardRanksV2Unavailable;
const cardRankCache = new Map();

// カード図鑑の集めた種類(図鑑の「集めた種類」と同じ数え方: 全モンスター＋技・ブリーダー)
const cardDexCounts = (db, collection) => {
  const all = [...Object.values(db.monsters).map((m) => m.no), ...Object.values(db.cards).map((c) => c.no)];
  const col = collection || {};
  return { count: all.filter((no) => col[no] > 0).length, total: all.length };
};

// 1行を画面で使う形へ。壊れた値は捨てる
const cardRankEntryFromRow = (row) => {
  if (!row || typeof row !== 'object') return null;
  const n = (k) => { const x = Number(row[k]); return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0; };
  return {
    userName: String(row.user_name || '名無しのブリーダー'),
    breederId: typeof row.breeder_id === 'string' ? row.breeder_id : '',
    icon: row.icon || null,
    profileFrame: typeof normalizeProfileFrameId === 'function' ? normalizeProfileFrameId(row.profile_frame) : null,
    weekKey: typeof row.week_key === 'string' ? row.week_key : '',
    wins: Object.fromEntries(CARD_LEVEL_ORDER.map((lv) => [lv, n(`wins_${lv}`)])),
    weekWins: Object.fromEntries(CARD_LEVEL_ORDER.map((lv) => [lv, n(`week_wins_${lv}`)])),
    bestStreak: n('best_streak'),
    dexCount: n('dex_count'),
    dexTotal: n('dex_total'),
    updatedAt: String(row.updated_at || ''),
  };
};
// 改名で同じ人が2行になっていたら、新しい方だけ見せる(ブリーダーIDがあればIDで、無ければ名前で同じ人とみなす)。
// 新しい表の行(e.v2)は、古い表の同じ人の行より先に選ぶ。ID の無い古い行は、同じ名前の人が新しい表にいれば出さない(IDができる前の同じ人)
const cardRankMerge = (entries) => {
  const byKey = new Map();
  const list = (Array.isArray(entries) ? entries : []).filter(Boolean);
  list.forEach((e) => {
    const key = e.breederId || `name:${e.userName}`;
    const cur = byKey.get(key);
    if (!cur || (e.v2 && !cur.v2) || (!!e.v2 === !!cur.v2 && e.updatedAt > cur.updatedAt)) byKey.set(key, e);
  });
  const v2Names = new Set(list.filter((e) => e.v2).map((e) => e.userName));
  return [...byKey.values()].filter((e) => e.v2 || e.breederId || !v2Names.has(e.userName));
};
// 何で並べるか。kind: 'wins'(period: 'week' | 'total', level)/ 'streak' / 'dex'
const cardRankColumn = ({ kind, period, level }) => (kind === 'streak' ? 'best_streak' : kind === 'dex' ? 'dex_count'
  : `${period === 'week' ? 'week_wins' : 'wins'}_${level}`);
const cardRankValue = (e, { kind, period, level }) => (kind === 'streak' ? e.bestStreak : kind === 'dex' ? e.dexCount
  : (period === 'week' ? e.weekWins : e.wins)[level] || 0);

// 1つの表から上位を取る。表が無ければ null(以後その表へはアクセスしない)
const sbFetchCardRankRows = async (table, q, now) => {
  const column = cardRankColumn(q);
  const week = q.kind === 'wins' && q.period === 'week' ? `&week_key=eq.${cardWeekKeyJst(now)}` : '';
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${CARD_RANK_SELECT}&${column}=gt.0${week}`
    + `&order=${column}.desc.nullslast,updated_at.asc&limit=${CARD_RANK_FETCH_LIMIT}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { headers: SB_HEADERS, cache: 'no-store', signal: controller.signal });
    const body = await res.text();
    if (!res.ok) {
      if (_isMissingTableError(res.status, body)) return null;
      throw new Error(`${table} ${res.status}: ${body || res.statusText}`);
    }
    const rows = JSON.parse(body || '[]');
    return Array.isArray(rows) ? rows : [];
  } finally {
    clearTimeout(timer);
  }
};
// 表から上位を取る(新しい表と古い表を合わせて、同じ人は1行に)。どちらの表も無ければ null
const sbFetchCardRanks = async (q, now = Date.now()) => {
  if (cardRanksUnavailable()) return null;
  const [v2Rows, oldRows] = await Promise.all([
    _cardRanksV2Unavailable ? Promise.resolve(null) : sbFetchCardRankRows(CARD_RANK_TABLE_V2, q, now),
    _cardRanksUnavailable ? Promise.resolve(null) : sbFetchCardRankRows(CARD_RANK_TABLE, q, now),
  ]);
  if (v2Rows === null) _cardRanksV2Unavailable = true;
  if (oldRows === null) _cardRanksUnavailable = true;
  if (v2Rows === null && oldRows === null) return null;
  const entries = cardRankMerge([
    ...(v2Rows || []).map((r) => { const e = cardRankEntryFromRow(r); return e ? { ...e, v2: true } : null; }),
    ...(oldRows || []).map(cardRankEntryFromRow),
  ]);
  entries.sort((a, b) => cardRankValue(b, q) - cardRankValue(a, q));
  return entries;
};
// 上書き保存。ID があれば新しい表へ ID で(同じ人は何度書いても1行)。ID が無い・新しい表が無いときは、今までどおり古い表へ名前で
const sbUpsertCardRank = async (row) => {
  if (!row) return false;
  if (typeof row.breeder_id === 'string' && row.breeder_id && !_cardRanksV2Unavailable) {
    const r = await sbUpsertCardRankTo(CARD_RANK_TABLE_V2, 'breeder_id', row);
    if (r !== null) return r;
    _cardRanksV2Unavailable = true; // 新しい表がまだ無い(SQL を流す前)。古い表へ書く
  }
  if (_cardRanksUnavailable) return false;
  const r = await sbUpsertCardRankTo(CARD_RANK_TABLE, 'user_name', row);
  if (r === null) { _cardRanksUnavailable = true; return false; }
  return r;
};
// 1つの表へ上書き。表が無ければ null
const sbUpsertCardRankTo = async (table, conflict, row) => {
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflict}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...SB_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([row]), signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      if (_isMissingTableError(res.status, body)) return null;
      throw new Error(`${table} upsert ${res.status}: ${body || res.statusText}`);
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
};
// 記録から1行を作って送る(前に送った中身と同じなら送らない)。呼ぶのは「ランキングに数えてよい対戦」のあとだけ
const cardRankSync = async (db, { record, collection, profile }) => {
  try {
    if (cardRanksUnavailable() || !profile) return false;
    const breederId = typeof ensureBreederId === 'function' ? await ensureBreederId() : null;
    const dex = cardDexCounts(db, collection);
    const row = cardRankRow(record, { dexCount: dex.count, dexTotal: dex.total, userName: profile.name, icon: profile.icon, profileFrame: profile.frame, breederId, now: Date.now() });
    const sign = JSON.stringify(row);
    if ((await storeGet(CARD_SAVE_KEYS.rankSync, null)) === sign) return true;
    const ok = await sbUpsertCardRank(row);
    if (ok) { await storeSet(CARD_SAVE_KEYS.rankSync, sign); cardRankCache.clear(); }
    return ok;
  } catch (err) {
    console.error('[ranking] card_battle_ranks sync failed:', err && err.message ? err.message : err);
    return false;
  }
};

// 同じ数は同じ順位(5・5・3 → 1位・1位・3位)。entries は多い順に並んでいる(2026-10-26 社長「全部入れる」の改善)
const cardRankPlaces = (entries, valueOf) => {
  let place = 0;
  let prev = null;
  return entries.map((e, i) => { const v = valueOf(e); if (prev === null || v !== prev) { place = i + 1; prev = v; } return place; });
};
// 自分より多い人(自分を除く)を、表から名前とIDだけ読んで数える。上位に入っていないときの順位に使う。
// 新しい表と古い表を合わせ、同じ人(同じID・IDが無ければ同じ名前)は1人と数える。読めた数が上限なら capped
const CARD_RANK_COUNT_LIMIT = 1000;
const sbCardRankAbove = async (q, value, selfId, now = Date.now()) => {
  const column = cardRankColumn(q);
  const week = q.kind === 'wins' && q.period === 'week' ? `&week_key=eq.${cardWeekKeyJst(now)}` : '';
  const keys = new Set();
  let capped = false;
  let any = false;
  for (const [table, off] of [[CARD_RANK_TABLE_V2, _cardRanksV2Unavailable], [CARD_RANK_TABLE, _cardRanksUnavailable]]) {
    if (off) continue;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=breeder_id,user_name&${column}=gt.${Math.max(0, Math.floor(value))}${week}&limit=${CARD_RANK_COUNT_LIMIT}`, { headers: SB_HEADERS, cache: 'no-store', signal: controller.signal });
      const body = await res.text();
      if (!res.ok) { if (_isMissingTableError(res.status, body)) continue; throw new Error(`${table} ${res.status}`); }
      const rows = JSON.parse(body || '[]');
      if (!Array.isArray(rows)) continue;
      any = true;
      if (rows.length >= CARD_RANK_COUNT_LIMIT) capped = true;
      rows.forEach((r) => { const id = r && typeof r.breeder_id === 'string' && r.breeder_id ? r.breeder_id : ''; if (id && id === selfId) return; keys.add(id || `name:${r && r.user_name}`); });
    } finally { clearTimeout(timer); }
  }
  return any ? { above: keys.size, capped } : null;
};
// いまの記録から作る行が、前に送った中身と違えば「まだ送れていない」(週が変わった・パックで図鑑が増えた・送るのに失敗した など)
const cardRankPending = async (db, { record, collection, profile }) => {
  if (cardRanksUnavailable() || !profile) return false;
  const breederId = typeof ensureBreederId === 'function' ? await ensureBreederId() : null;
  const dex = cardDexCounts(db, collection);
  const row = cardRankRow(record, { dexCount: dex.count, dexTotal: dex.total, userName: profile.name, icon: profile.icon, profileFrame: profile.frame, breederId, now: Date.now() });
  return (await storeGet(CARD_SAVE_KEYS.rankSync, null)) !== JSON.stringify(row);
};
// ---- プロフィール・フレンドの MFバトルカードの戦績(2026-10-26 社長「プロフィールやフレンドでバトルカードの戦績も追加」) ----
// 中身: 助手と対戦の強さごとの勝ち数・いちばん長い連勝・マルチ対戦の勝ち負けと強さの点数・カード図鑑で集めた数。
// 自分: 端末の保存(mh_card_record_v1・mh_card_collection_v1)を読むだけ(書かない)。強さの点数は表から読む
// フレンド: ランキングの表 card_battle_ranks_v2(無ければ card_battle_ranks)・card_battle_pvp_ratings を、その人のブリーダーの番号で読むだけ(表は変えない)
const cardStatsGet = async (path) => {
  if (typeof SUPABASE_URL === 'undefined') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB_HEADERS, cache: 'no-store', signal: controller.signal });
    if (!res.ok) return null;
    const rows = JSON.parse((await res.text()) || '[]');
    return Array.isArray(rows) ? rows : null;
  } catch (_) { return null; } finally { clearTimeout(timer); }
};
const CARD_STATS_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
// その人の強さの点数の行(マルチ対戦)。無ければ null
const sbFetchCardPvpRatingOf = async (breederId) => {
  if (!CARD_STATS_ID_RE.test(String(breederId || ''))) return null;
  const rows = await cardStatsGet(`card_battle_pvp_ratings?select=rating,wins,loses&breeder_id=eq.${breederId}&limit=1`);
  const r = rows && rows[0];
  if (!r) return null;
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
  return { rating: Number.isFinite(Number(r.rating)) ? Math.floor(Number(r.rating)) : null, win: n(r.wins), lose: n(r.loses) };
};
// いまのカードの種類数(図鑑の分母。cardDexCounts と同じ数え方)
const cardStatsDexTotal = () => { try { return cardDexCounts(CARD_BATTLE_DATA, {}).total; } catch (_) { return 0; } };
// 自分の戦績(保存から)。何も遊んでいなければ played が 0
const cardStatsOfSelf = async () => {
  const db = typeof CARD_BATTLE_DATA !== 'undefined' ? CARD_BATTLE_DATA : null;
  if (!db) return null;
  const record = cardNormalizeRecord(await storeGet(CARD_SAVE_KEYS.record, null));
  const rawCol = await storeGet(CARD_SAVE_KEYS.collection, null);
  const dex = cardDexCounts(db, cardIsPlainObject(rawCol) ? rawCol : {});
  const id = typeof ensureBreederId === 'function' ? await ensureBreederId().catch(() => null) : null;
  const rating = await sbFetchCardPvpRatingOf(id).catch(() => null);
  return {
    wins: record.rank.total, bestStreak: record.rank.streak.best, dex,
    pvp: { win: record.pvp.win, lose: record.pvp.lose, rating: rating ? rating.rating : null },
    played: record.cpu.win + record.cpu.lose + record.cpu.surrender + record.pvp.win + record.pvp.lose,
  };
};
// フレンドの戦績(表から)。表に行が無ければ null
const cardStatsOfFriend = async (breederId) => {
  if (!CARD_STATS_ID_RE.test(String(breederId || ''))) return null;
  // 新しい表(ID で1行)を先に見て、まだ移っていない人は古い表の行を読む(2026-10-26 ブリーダーIDで数える形)
  const v2 = _cardRanksV2Unavailable ? null : await cardStatsGet(`${CARD_RANK_TABLE_V2}?select=${CARD_RANK_SELECT}&breeder_id=eq.${breederId}&limit=1`);
  const rows = v2 && v2.length ? v2 : await cardStatsGet(`${CARD_RANK_TABLE}?select=${CARD_RANK_SELECT}&breeder_id=eq.${breederId}&order=updated_at.desc&limit=1`);
  const e = rows && rows[0] ? cardRankEntryFromRow(rows[0]) : null;
  const pvp = await sbFetchCardPvpRatingOf(breederId);
  if (!e && !pvp) return null;
  const wins = e ? e.wins : Object.fromEntries(CARD_LEVEL_ORDER.map((lv) => [lv, 0]));
  return {
    // 図鑑の分母は、表の dex_total(その人が最後に送ったときの数で、古いことがある)ではなく、いまのカードの種類数にそろえる(自分と同じ数え方)
    wins, bestStreak: e ? e.bestStreak : 0, dex: e ? { count: e.dexCount, total: cardStatsDexTotal() || e.dexTotal } : null,
    pvp: pvp ? { win: pvp.win, lose: pvp.lose, rating: pvp.rating } : { win: 0, lose: 0, rating: null },
    played: CARD_LEVEL_ORDER.reduce((a, lv) => a + wins[lv], 0) + (pvp ? pvp.win + pvp.lose : 0) + (e && e.dexCount > 0 ? 1 : 0),
  };
};
// 戦績の表(自分のプロフィールとフレンドのプロフィールで共用。見た目はモンヒロビートの実績の表にそろえる)
const CardBattleStatsPanel = ({ stats, who = 'self' }) => {
  if (!stats || !stats.played) return null;
  const cell = 'rounded-lg bg-black/30 px-1 py-1';
  const val = (n) => `text-[13px] font-black tabular-nums ${n > 0 ? 'text-white' : 'text-slate-500'}`;
  return (
    <section data-card-stats={who} className={`${SCREEN_PANEL_FLAT_CLASS} mb-3`}>
      <b className="block text-[12px] font-black text-amber-100">MFバトルカードの戦績</b>
      <small className="mb-2 block text-[9px] font-bold text-slate-400">助手と対戦の、強さごとの勝ち数</small>
      <div className="grid grid-cols-5 gap-1 text-center">
        {CARD_LEVEL_ORDER.map((lv) => (
          <div key={lv} data-card-stats-level={lv} className={cell}>
            <span className="block whitespace-nowrap text-[9px] font-black text-slate-300">{CARD_LEVEL_LABEL[lv]}</span>
            <b className={`block ${val(stats.wins[lv] || 0)}`}>{stats.wins[lv] || 0}</b>
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1 text-center">
        <div data-card-stats-streak className={cell}>
          <span className="block whitespace-nowrap text-[9px] font-black text-orange-200">いちばん長い連勝</span>
          <b className={`block ${val(stats.bestStreak)}`}>{stats.bestStreak}</b>
        </div>
        <div data-card-stats-pvp className={cell}>
          <span className="block whitespace-nowrap text-[9px] font-black text-sky-200">マルチ対戦</span>
          <b className={`block ${val(stats.pvp.win + stats.pvp.lose)}`}>{stats.pvp.win}勝{stats.pvp.lose}敗</b>
          {Number.isFinite(stats.pvp.rating) && <span className="block text-[9px] font-bold text-sky-100">強さ {stats.pvp.rating}</span>}
        </div>
        <div data-card-stats-dex className={cell}>
          <span className="block whitespace-nowrap text-[9px] font-black text-emerald-200">カード図鑑</span>
          {stats.dex ? <b className={`block ${val(stats.dex.count)}`}>{stats.dex.count}<span className="text-[9px] font-bold text-slate-400">/{stats.dex.total}</span></b> : <b className="block text-[13px] font-black text-slate-500">-</b>}
        </div>
      </div>
    </section>
  );
};
// 自分のプロフィールに置く版(読み込みまで含む)。MFバトルカードを一度も遊んでいなければ出さない
const CardBattleStatsSelf = () => {
  const [stats, setStats] = useState(null);
  useEffect(() => { let alive = true; cardStatsOfSelf().then((x) => { if (alive) setStats(x); }).catch(() => {}); return () => { alive = false; }; }, []);
  return <CardBattleStatsPanel stats={stats} who="self"/>;
};
// フレンドのプロフィールに置く版。表に記録が無ければ出さない
const CardBattleStatsFriend = ({ breederId }) => {
  const [stats, setStats] = useState(null);
  useEffect(() => { let alive = true; setStats(null); cardStatsOfFriend(breederId).then((x) => { if (alive) setStats(x); }).catch(() => {}); return () => { alive = false; }; }, [breederId]);
  return <CardBattleStatsPanel stats={stats} who="friend"/>;
};

// ---- 画面: ランキング(トップの「ランキング」から) ----
const CARD_RANK_KINDS = Object.freeze([
  { id: 'wins', label: '勝ち数', emoji: '🏆' }, { id: 'streak', label: '連勝', emoji: '🔥' },
  { id: 'dex', label: '図鑑', emoji: '📖' }, { id: 'multi', label: 'マルチ', emoji: '🎮' },
]);
// syncArgs … 送れていない記録を送るための材料({ db, collection, profile })。開いたときに、送れていなければ自動で送る(モンヒロビートのランキングと同じ考え)
const CardRankingBoard = ({ onBack, renderBreederIcon = null, selfName = '', record = null, dex = null, sendOn = false, syncArgs = null }) => {
  const [kind, setKind] = useState('wins');
  const [period, setPeriod] = useState('week');
  const [level, setLevel] = useState('normal');
  const [state, setState] = useState({ status: 'loading', entries: [] });
  const [selfId, setSelfId] = useState('');
  const [retry, setRetry] = useState(0);
  const [sendState, setSendState] = useState('idle'); // 送れていない記録: idle / sending / failed
  const [above, setAbove] = useState(null);           // 上位に入っていないときの、自分より多い人の数 { key, above, capped }
  const q = { kind, period, level };
  // 送れていない記録があれば送る(開いたとき・「送る」を押したとき)。送れたら読み直す
  const resend = async (force = false) => {
    if (!sendOn || !syncArgs || !syncArgs.db) return;
    try {
      if (!force && !(await cardRankPending(syncArgs.db, syncArgs))) return;
      setSendState('sending');
      const ok = await cardRankSync(syncArgs.db, syncArgs);
      setSendState(ok ? 'idle' : 'failed');
      if (ok) { cardRankCache.clear(); setRetry((n) => n + 1); }
    } catch (_) { setSendState('failed'); }
  };
  useEffect(() => { void resend(); }, []);
  const refresh = () => { Audio_.fgSe.tap(); cardRankCache.clear(); setAbove(null); setRetry((n) => n + 1); };
  const cacheKey = kind === 'wins' ? `wins:${period}:${level}` : kind;
  useEffect(() => { let alive = true; if (typeof ensureBreederId === 'function') ensureBreederId().then((id) => { if (alive && typeof id === 'string') setSelfId(id); }).catch(() => {}); return () => { alive = false; }; }, []);
  useEffect(() => {
    if (kind === 'multi') return undefined;
    let alive = true;
    const hit = cardRankCache.get(cacheKey);
    setState(hit ? { status: 'ready', entries: hit.entries } : { status: 'loading', entries: [] });
    if (hit && Date.now() - hit.at < CARD_RANK_CACHE_MS) return () => { alive = false; };
    sbFetchCardRanks(q).then((entries) => {
      if (!alive) return;
      if (entries == null) { setState({ status: 'missing', entries: [] }); return; }
      cardRankCache.set(cacheKey, { at: Date.now(), entries });
      setState({ status: 'ready', entries });
    }).catch(() => { if (alive && !hit) setState({ status: 'error', entries: [] }); });
    return () => { alive = false; };
  }, [cacheKey, retry]);
  const rec = cardNormalizeRecord(record);
  const weekNow = cardWeekKeyJst(Date.now());
  const mineValue = kind === 'streak' ? rec.rank.streak.best : kind === 'dex' ? (dex ? dex.count : 0)
    : (period === 'week' ? (rec.rank.week.key === weekNow ? rec.rank.week.wins : {}) : rec.rank.total)[level] || 0;
  const unit = kind === 'dex' ? '種類' : kind === 'streak' ? '連勝' : '勝';
  const shown = state.entries.slice(0, CARD_RANK_SHOW_LIMIT);
  const places = cardRankPlaces(state.entries, (e) => cardRankValue(e, q));
  // 自分の順位: 自分より多い人の数 + 1(同じ数は同じ順位)。読んだ一覧の外(一覧が上限まで全部自分より多い)なら、表から数を読む
  const isMine = (e) => (selfId && e.breederId === selfId) || (!e.breederId && !!selfName && e.userName === selfName);
  const othersAbove = state.entries.filter((e) => !isMine(e) && cardRankValue(e, q) > mineValue).length;
  const listFull = state.entries.length >= CARD_RANK_FETCH_LIMIT && state.entries.filter((e) => !isMine(e)).every((e) => cardRankValue(e, q) > mineValue);
  const aboveKey = `${cacheKey}:${mineValue}:${retry}`;
  useEffect(() => {
    if (kind === 'multi' || state.status !== 'ready' || !listFull || mineValue <= 0) return undefined;
    let alive = true;
    sbCardRankAbove(q, mineValue, selfId).then((r) => { if (alive && r) setAbove({ key: aboveKey, ...r }); }).catch(() => {});
    return () => { alive = false; };
  }, [aboveKey, state.status, listFull]);
  const myPlace = mineValue <= 0 || state.status !== 'ready' ? null
    : !listFull ? { place: othersAbove + 1, capped: false }
    : above && above.key === aboveKey ? { place: above.above + 1, capped: above.capped } : null;
  const chip = (on) => `min-h-[36px] shrink-0 rounded-full border px-3 text-[11px] font-black ${on ? 'border-amber-300 bg-amber-500/25 text-amber-100' : 'border-white/10 bg-slate-900 text-slate-400'}`;
  const medal = (place) => (place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : String(place));
  const levelLabel = (lv) => CARD_LEVEL_LABEL[lv] || lv.toUpperCase();
  return (
    <div data-mh-screen data-card-ranking={kind} className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="ランキング" accent="text-amber-200" onBack={onBack} note="MFバトルカード"
        right={<button type="button" data-card-ranking-refresh aria-label="更新" onClick={refresh} className="min-h-[44px] shrink-0 rounded-xl border border-amber-300/40 px-3 text-[12px] font-black text-amber-200 active:scale-95">更新</button>}/>
      {/* 送れていない記録(電波が弱かった など)。開いたときに自動で送り、送れなかったときだけ出す(モンヒロビートのランキングと同じ) */}
      {sendState === 'failed' && (
        <div data-card-ranking-pending className="mb-1.5 flex shrink-0 items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-500/10 px-2 py-1.5">
          <span className="min-w-0 flex-1 text-[11px] font-bold text-amber-100" style={JA_LABEL_STYLE}>{jaWrap('あなたの記録を、まだランキングへ送れていません')}</span>
          <button type="button" data-card-ranking-pending-send onClick={() => { Audio_.fgSe.tap(); void resend(true); }} className="min-h-[36px] shrink-0 rounded-lg bg-amber-400 px-3 text-[12px] font-black text-slate-950 active:scale-95">送る</button>
        </div>
      )}
      <div className="mb-2 grid shrink-0 grid-cols-4 gap-1">
        {CARD_RANK_KINDS.map((k) => (
          <button key={k.id} type="button" data-card-ranking-tab={k.id} aria-pressed={kind === k.id} onClick={() => { Audio_.fgSe.tap(); setKind(k.id); }}
            className={`min-h-[44px] rounded-xl border text-[11px] font-black ${kind === k.id ? 'border-amber-300 bg-amber-500/25 text-amber-100' : 'border-white/10 bg-slate-900/80 text-slate-300'}`}>
            <span aria-hidden="true" className="block text-base leading-none">{k.emoji}</span>{k.label}
          </button>
        ))}
      </div>
      {kind === 'wins' && (
        <div className="mb-1.5 shrink-0 space-y-1.5">
          <div className="flex gap-1.5">
            {[['week', '今週'], ['total', '通算']].map(([id, label]) => <button key={id} type="button" data-card-ranking-period={id} onClick={() => setPeriod(id)} className={chip(period === id)}>{label}</button>)}
            <small className="ml-auto self-center text-[10px] font-bold text-slate-400">{period === 'week' ? '月曜 5:00 から' : '助手と対戦で勝った数'}</small>
          </div>
          {/* 5つを等分に並べる(横にすべらせる形だと、320幅で MASTER が画面の外・375幅で「MASTEF」と切れていた。2026-10-26 見回り #5) */}
          <div className="grid grid-cols-5 gap-1">
            {CARD_LEVEL_ORDER.map((lv) => <button key={lv} type="button" data-card-ranking-level={lv} onClick={() => setLevel(lv)} className={`${chip(level === lv)} min-w-0 !px-0.5 max-[359px]:text-[10px]`}>{levelLabel(lv)}</button>)}
          </div>
        </div>
      )}
      {kind !== 'multi' && (
        <div data-card-ranking-mine className={`${SCREEN_PANEL_FLAT_CLASS} mb-1.5 flex shrink-0 items-center gap-2 text-[12px] font-bold`}>
          <span className="text-slate-300">あなたの記録</span>
          {/* 自分の順位(同じ数は同じ順位)。記録が無いときは出さない */}
          {myPlace && <b data-card-ranking-mine-place className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[12px] font-black text-amber-100">{myPlace.place.toLocaleString()}位{myPlace.capped ? '以下' : ''}</b>}
          <b className="ml-auto text-base font-black text-amber-200">{mineValue.toLocaleString()}<small className="ml-0.5 text-[10px] text-slate-400">{unit}</small></b>
        </div>
      )}
      {kind !== 'multi' && !sendOn && <p data-card-ranking-preview className="mb-1.5 shrink-0 text-[10px] font-bold leading-snug text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('いまは見本です。ランキングへ送るのは、公開してからのふつうの対戦の記録だけです')}</p>}
      <div className={`${SCREEN_LIST_CLASS} space-y-1.5 pb-3`}>
        {/* 「準備中」はマルチ対戦を開ける(MFバトルカードの公開の印・91 の cardPvpOpen)まで */}
        {kind === 'multi' && !cardPvpOpen() && (
          <div data-card-ranking-multi className="mt-6 rounded-2xl border border-white/10 bg-slate-900/80 p-5 text-center">
            <div aria-hidden="true" className="text-3xl">🎮</div>
            <b className="mt-1 block text-[15px] font-black text-white">マルチ対戦の強さ</b>
            {!cardPvpOpen() && <span className="mt-1 inline-block rounded border border-slate-500 px-2 py-0.5 text-[11px] font-black text-slate-300">準備中</span>}
            {!cardPvpOpen() && <p className="mt-2 text-[12px] font-bold text-slate-400" style={JA_LABEL_STYLE}>{jaWrap('マルチ対戦ができるようになったら、ここに順位が出ます')}</p>}
          </div>
        )}
        {/* 勝つと上がる強さの点数の順(91-card-battle-multi.jsx・表 card_battle_pvp_ratings)。ほかのタブと同じ見た目(あなたの欄・メダル・同じ点数は同じ順位) */}
        {kind === 'multi' && cardPvpOpen() && (
          <div data-card-ranking-multi>
            <CardPvpRankingList renderBreederIcon={renderBreederIcon} selfId={selfId} reloadKey={retry}/>
          </div>
        )}
        {kind !== 'multi' && state.status === 'loading' && <p className="py-8 text-center text-sm font-bold text-slate-400">読み込み中…</p>}
        {kind !== 'multi' && state.status === 'missing' && <p data-card-ranking-missing className="py-8 text-center text-sm font-bold text-amber-200">ランキングは準備中です</p>}
        {kind !== 'multi' && state.status === 'error' && (
          <div className="py-8 text-center">
            <p className="text-sm font-bold text-amber-200">ランキングを読み込めませんでした</p>
            <button type="button" onClick={() => { cardRankCache.delete(cacheKey); setRetry((n) => n + 1); }} className="mt-2 min-h-[44px] rounded-xl bg-slate-800 px-4 text-sm font-black">もう一度読み込む</button>
          </div>
        )}
        {kind !== 'multi' && state.status === 'ready' && shown.length === 0 && <p data-card-ranking-empty className="py-8 text-center text-sm font-bold text-slate-400">まだ記録がありません</p>}
        {kind !== 'multi' && state.status === 'ready' && shown.map((e, i) => {
          const mine = isMine(e);
          const v = cardRankValue(e, q);
          return (
            <article key={e.breederId || e.userName} data-card-ranking-row={i + 1} data-card-ranking-place={places[i]} data-mine={mine ? '1' : undefined}
              className={`grid grid-cols-[28px_32px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border p-2 ${mine ? 'border-amber-300/70 bg-amber-500/10' : places[i] === 1 ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 bg-slate-900/80'}`}>
              <b className="text-center text-sm font-black text-slate-200">{medal(places[i])}</b>
              {renderBreederIcon ? renderBreederIcon({ userName: e.userName, icon: e.icon, profileFrame: e.profileFrame, breederId: e.breederId }) : <span aria-hidden="true" className="text-lg">👤</span>}
              <span className="min-w-0 leading-tight">
                <b className="block truncate text-[13px] font-black text-white">{e.userName}{mine ? '(あなた)' : ''}</b>
                {kind === 'dex' && e.dexTotal > 0 && <small className="block text-[10px] font-bold text-slate-400">{e.dexTotal}種類のうち</small>}
              </span>
              <b className="text-right text-base font-black leading-tight text-amber-200">{v.toLocaleString()}<small className="ml-0.5 text-[10px] font-bold text-slate-400">{unit}</small></b>
            </article>
          );
        })}
      </div>
    </div>
  );
};

// ---- 記録をくわしく(2026-10-27 社長: 「全体」「助手ごと」「マルチ」の3つのタブ・よく使う技まで数える・これから遊んだ分から) ----
// 保存は新しいキー mh_card_record_detail_v1 だけ(mh_card_record_v1 は書き換えない。Supabase へは何も送らない)。
//   foes  … 助手ごと { win, lose, surrender, now(いまの連勝), best(最高の連勝), fastest(いちばん早い勝ちの自分の番。0=まだ), levels(難易度ごとの勝ち) }
//   wins  … 助手と対戦の勝ち { n, turns(自分の番の合計), fastest }。勝つまでの平均に使う
//   day   … 今日の勝ち { key(日本時間の日付), win }
//   decks … 使ったデッキ { id: { name, n } }(多い順に20まで) / mons … 場に出したモンスター { 番号: 戦った数 } / moves … 使った技 { 番号: 回数 }
//   quick … MFバトルカードから足したクイック周回の合計 / pvpBest … マルチのいちばん高かった強さ
//   seeded … 前からの記録(mh_card_record_v1 の最近の30戦)から助手ごとの数を1回だけ起こした印。二度は足さない
// デッキ・モンスター・技は助手と対戦だけ数える(マルチは「マルチの履歴」に試合ごとのデッキが残る)
const CARD_RECORD_DETAIL_KEY = 'mh_card_record_detail_v1';
const CARD_RECORD_DETAIL_DECKS_MAX = 20;
const cardRecN = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const cardRecCounts = (v, max = 600) => {
  if (!cardIsPlainObject(v)) return {};
  return Object.fromEntries(Object.entries(v).filter(([k, n]) => k && k.length <= 40 && cardRecN(n) > 0).slice(0, max).map(([k, n]) => [k, cardRecN(n)]));
};
const cardRecFoe = (v) => {
  const f = cardIsPlainObject(v) ? v : {};
  return { win: cardRecN(f.win), lose: cardRecN(f.lose), surrender: cardRecN(f.surrender), now: cardRecN(f.now), best: cardRecN(f.best), fastest: cardRecN(f.fastest), levels: cardNormalizeLevelCounts(f.levels) };
};
const cardNormalizeRecordDetail = (v) => {
  const r = cardIsPlainObject(v) ? v : {};
  const foes = cardIsPlainObject(r.foes) ? r.foes : {};
  const wins = cardIsPlainObject(r.wins) ? r.wins : {};
  const day = cardIsPlainObject(r.day) ? r.day : {};
  const decks = cardIsPlainObject(r.decks) ? r.decks : {};
  return {
    v: 1, seeded: r.seeded === true,
    foes: Object.fromEntries(Object.entries(foes).filter(([who]) => who && who.length <= 32).slice(0, 64).map(([who, f]) => [who, cardRecFoe(f)])),
    wins: { n: cardRecN(wins.n), turns: cardRecN(wins.turns), fastest: cardRecN(wins.fastest) },
    day: { key: typeof day.key === 'string' ? day.key.slice(0, 10) : '', win: cardRecN(day.win) },
    decks: Object.fromEntries(Object.entries(decks).filter(([id, d]) => id && id.length <= 40 && cardIsPlainObject(d) && cardRecN(d.n) > 0).slice(0, CARD_RECORD_DETAIL_DECKS_MAX)
      .map(([id, d]) => [id, { name: typeof d.name === 'string' ? d.name.slice(0, 40) : '', n: cardRecN(d.n) }])),
    mons: cardRecCounts(r.mons), moves: cardRecCounts(r.moves),
    quick: cardRecN(r.quick), pvpBest: cardRecN(r.pvpBest),
  };
};
// 前からの記録の「最近の30戦」(新しい順)から、助手ごとの勝ち負けと連勝を起こす(1回だけ。seeded の印を付ける)
const cardRecordDetailSeed = (d, record) => {
  if (d.seeded) return d;
  const foes = { ...d.foes };
  const recent = (record && Array.isArray(record.recent) ? record.recent : []).filter((x) => x && typeof x.who === 'string' && x.who && x.who.length <= 32).slice().reverse();
  recent.forEach((x) => {
    const f = foes[x.who] ? { ...foes[x.who], levels: { ...foes[x.who].levels } } : cardRecFoe(null);
    if (x.outcome === 'win') { f.win += 1; f.now += 1; f.best = Math.max(f.best, f.now); if (x.level in f.levels) f.levels[x.level] += 1; }
    else if (x.outcome === 'surrender') { f.surrender += 1; f.now = 0; }
    else if (x.outcome === 'lose') { f.lose += 1; f.now = 0; }
    foes[x.who] = f;
  });
  return { ...d, foes, seeded: true };
};
// 助手と対戦を1試合足す。turns … 自分の番の数 / deck … { id, name } / mons … 場の3体の番号 / moves … { 番号: 回数 } / today … cardTodayJst()
const cardRecordDetailAfter = (d0, { who, level, outcome, turns = 0, deck = null, mons = [], moves = {}, today = '' }) => {
  const d = { ...d0, foes: { ...d0.foes } };
  if (typeof who === 'string' && who && who.length <= 32) {
    const f = d.foes[who] ? { ...d.foes[who], levels: { ...d.foes[who].levels } } : cardRecFoe(null);
    const t = cardRecN(turns);
    if (outcome === 'win') {
      f.win += 1; f.now += 1; f.best = Math.max(f.best, f.now);
      if (level in f.levels) f.levels[level] += 1;
      if (t > 0) f.fastest = f.fastest ? Math.min(f.fastest, t) : t;
      d.wins = { n: d.wins.n + 1, turns: d.wins.turns + t, fastest: t > 0 ? (d.wins.fastest ? Math.min(d.wins.fastest, t) : t) : d.wins.fastest };
      d.day = { key: today, win: (d.day.key === today ? d.day.win : 0) + 1 };
    } else if (outcome === 'surrender') { f.surrender += 1; f.now = 0; }
    else { f.lose += 1; f.now = 0; }
    d.foes[who] = f;
  }
  if (deck && typeof deck.id === 'string' && deck.id) {
    // 20を超えたら少ないものから捨てる。いま使ったデッキは必ず残す(同じ数の古いデッキに押し出されないように)
    const cur = { name: typeof deck.name === 'string' ? deck.name.slice(0, 40) : '', n: ((d.decks[deck.id] && d.decks[deck.id].n) || 0) + 1 };
    const others = Object.entries(d.decks).filter(([id]) => id !== deck.id).sort((a, b) => b[1].n - a[1].n).slice(0, CARD_RECORD_DETAIL_DECKS_MAX - 1);
    d.decks = Object.fromEntries([[deck.id, cur], ...others]);
  }
  const monCount = { ...d.mons };
  (Array.isArray(mons) ? mons : []).forEach((no) => { if (typeof no === 'string' && no && no.length <= 40) monCount[no] = (monCount[no] || 0) + 1; });
  d.mons = monCount;
  const mv = { ...d.moves };
  Object.entries(cardIsPlainObject(moves) ? moves : {}).forEach(([no, n]) => { if (cardRecN(n) > 0) mv[no] = (mv[no] || 0) + cardRecN(n); });
  d.moves = mv;
  return d;
};
// 1試合で自分(なぞり直しの 0 番)が使った技を数える。rec … 93 の試合の記録(cardReplayFromCpu)。技 = ちから・かしこさ・特殊のカード
const CARD_RECORD_MOVE_KINDS = new Set(['pow', 'int', 'spe']);
const cardRecordMovesOf = (db, rec) => {
  const out = {};
  if (!rec || typeof cardReplayBuild !== 'function') return out;
  let built;
  try { built = cardReplayBuild(db, rec); } catch (_) { return out; }
  const states = built.states || [];
  for (let i = 1; i < states.length; i++) {
    const prev = states[i - 1].log || [];
    const next = states[i].log || [];
    // 場の記録(log)は古いものから捨てられるので、前の場の最後の1行より後ろを、この手で足された行とみる
    const last = prev.length ? JSON.stringify(prev[prev.length - 1]) : null;
    let from = 0;
    if (last !== null) { for (let k = next.length - 1; k >= 0; k--) { if (JSON.stringify(next[k]) === last) { from = k + 1; break; } } }
    next.slice(from).forEach((e) => {
      if (!e || e.kind !== 'use' || e.p !== 0 || !Array.isArray(e.cards)) return;
      e.cards.forEach((no) => { const c = cardOf(db, no); if (c && CARD_RECORD_MOVE_KINDS.has(c.kind)) out[no] = (out[no] || 0) + 1; });
    });
  }
  return out;
};
// 保存の1件(84 の persist の extra へ渡す形 { key, next, before })。fn … 起こした記録を受け取って、次の記録を返す
const cardRecordDetailEntry = async (record, fn) => {
  let raw = null;
  try { raw = await storeGet(CARD_RECORD_DETAIL_KEY, null); } catch (_) { raw = null; }
  return { key: CARD_RECORD_DETAIL_KEY, before: raw, next: fn(cardRecordDetailSeed(cardNormalizeRecordDetail(raw), record)) };
};

// ---- 画面: 記録(トップの「記録」から。84 の view 'record') ----
// 「全体」… 前からの表(助手と対戦・難易度ごと・ランキングの記録)＋勝ち方・よく使う・ほか / 「助手ごと」… 押すと開く / 「マルチ」… 強さ・移り・最近の試合
// 新しく数えるものは「この記録ができてからのぶん」と書く(前の試合は数えられない)
const CARD_RECORD_TABS = Object.freeze([{ id: 'all', label: '全体' }, { id: 'foe', label: '助手ごと' }, { id: 'multi', label: 'マルチ' }]);
const cardRecordTop = (counts, n) => Object.entries(counts || {}).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n);
const CardRecordScreen = ({ db = CARD_BATTLE_DATA, save, foes = [], levelLabel = {}, onBack, onOpenReplays = null, onOpenPvpHistory = null }) => {
  const [tab, setTab] = useState('all');
  const [detail, setDetail] = useState(null);
  const [openFoe, setOpenFoe] = useState(null);
  const [multi, setMulti] = useState(null); // { history, rating, place } 
  const rec = save.record;
  useEffect(() => {
    let alive = true;
    storeGet(CARD_RECORD_DETAIL_KEY, null).then((raw) => { if (alive) setDetail(cardRecordDetailSeed(cardNormalizeRecordDetail(raw), rec)); }).catch(() => { if (alive) setDetail(cardRecordDetailSeed(cardNormalizeRecordDetail(null), rec)); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (tab !== 'multi' || multi) return undefined;
    let alive = true;
    (async () => {
      const history = typeof cardPvpHistoryLoad === 'function' ? await cardPvpHistoryLoad() : [];
      let rating = null;
      let place = null;
      try {
        const bid = typeof ensureBreederId === 'function' ? await ensureBreederId() : null;
        const e = bid && typeof sbFetchCardPvpOwnRating === 'function' ? await sbFetchCardPvpOwnRating(bid) : null;
        if (e) {
          rating = e.rating;
          const above = typeof sbCountCardPvpAbove === 'function' ? await sbCountCardPvpAbove(e.rating) : null;
          if (above) place = { n: above.above + 1, capped: above.capped };
        }
      } catch (_) { /* 読めなければ点数は出さない */ }
      if (!alive) return;
      setMulti({ history, rating, place });
      // いちばん高かった強さ: 履歴の点数・いまの点数のうち大きいほうを残す(大きくなったときだけ書く。新しいキーだけ)
      const best = Math.max(0, ...history.map((h) => (h.rating ? h.rating.after : 0)), Number.isFinite(rating) ? rating : 0);
      try {
        const raw = await storeGet(CARD_RECORD_DETAIL_KEY, null);
        const d = cardNormalizeRecordDetail(raw);
        if (best > d.pvpBest) {
          const next = { ...d, pvpBest: best };
          if (await saveStoredValuesOrRollback([{ key: CARD_RECORD_DETAIL_KEY, before: raw, next }], storeGet, storeSet) && alive) setDetail((cur) => (cur ? { ...cur, pvpBest: best } : cur));
        }
      } catch (_) { /* 次に開いたときにやり直す */ }
    })();
    return () => { alive = false; };
  }, [tab]);
  const d = detail || cardRecordDetailSeed(cardNormalizeRecordDetail(null), rec);
  const r = rec.rank;
  const weekNow = cardWeekKeyJst(Date.now());
  const today = cardTodayJst();
  const dex = cardDexCounts(db, save.collection);
  const small = 'mt-1 text-[10px] font-bold leading-snug text-slate-500';
  const cell = (label, v, u, key) => (
    <div key={key || label} className="min-w-0 rounded-xl bg-black/30 px-1 py-1.5"><small className="block text-[10px] font-bold text-slate-400" style={JA_LABEL_STYLE}>{jaWrap(label)}</small><b className="text-[16px] font-black text-amber-200">{v}</b><small className="text-[10px] font-bold text-slate-400">{u}</small></div>
  );
  const row = (label, value, key) => (
    <div key={key || label} className="flex items-start justify-between gap-2 border-t border-white/10 py-1 text-[12px] font-bold first:border-t-0"><span className="shrink-0 text-slate-300">{label}</span><span className="min-w-0 text-right text-slate-100" style={JA_WRAP_STYLE}>{value}</span></div>
  );
  const nameOf = (no) => ((cardOf(db, no) || cardMonsterOf(db, no) || {}).name) || no;
  const deckTop = Object.entries(d.decks).sort((a, b) => b[1].n - a[1].n)[0] || null;
  const monTop = cardRecordTop(d.mons, 2);
  const moveTop = cardRecordTop(d.moves, 3);
  const winAvg = d.wins.n ? Math.round((d.wins.turns / d.wins.n) * 10) / 10 : null;
  const foeList = foes.filter((a) => a && a.id);
  const pvpGames = rec.pvp.win + rec.pvp.lose;
  const hist = multi ? multi.history : [];
  const chart = hist.filter((h) => h.rating).slice(0, 20).reverse();
  const chartMin = chart.length ? Math.min(...chart.map((h) => Math.min(h.rating.before, h.rating.after))) : 0;
  const chartMax = chart.length ? Math.max(...chart.map((h) => Math.max(h.rating.before, h.rating.after))) : 0;
  return (
    <div data-mh-screen data-card-record-view className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="記録" accent="text-amber-200" onBack={onBack} note="MFバトルカード"/>
      <div role="tablist" aria-label="記録の種類" className="grid grid-cols-3 gap-1.5 pb-2">
        {CARD_RECORD_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} data-card-record-tab={t.id} onClick={() => { Audio_.fgSe.tap(); setTab(t.id); }}
            className={`min-h-[40px] rounded-xl border text-[12px] font-black ${tab === t.id ? 'border-amber-300 bg-amber-500/25 text-amber-50' : 'border-white/10 bg-slate-900/80 text-slate-300'}`}>{t.label}</button>
        ))}
      </div>
      {/* 横画面だけ: 一覧の外(タブの下)は左の列に積まれる。左が見出しとタブだけで空かないよう、過去の対戦の入口と成績の要約を置く
          (2026-10-27 ツナグくんの見回り・部長ソランドくん OK)。縦では出さない(一覧の高さを減らさない。入口は一覧の先頭にある) */}
      <div data-card-record-side className="mb-2 hidden shrink-0 space-y-2 landscape:block">
        {onOpenReplays && (
          <button type="button" data-card-replays-open-side onClick={() => { Audio_.fgSe.tap(); onOpenReplays(); }}
            className="mh-button mh-button-secondary flex min-h-[44px] w-full items-center justify-between rounded-2xl border border-sky-300/40 bg-slate-800 px-3 text-left">
            <span><b className="block text-[13px] font-black text-sky-100">▶ 過去の対戦</b><small className="block text-[10px] font-bold text-slate-400">遊んだ試合を、はじめから見返せます</small></span>
            <span className="text-[18px] text-slate-400">›</span>
          </button>
        )}
        <div className={`${SCREEN_PANEL_CLASS} grid grid-cols-2 gap-1.5 text-center`}>
          {cell('助手と対戦', `${rec.cpu.win}勝 ${rec.cpu.lose + rec.cpu.surrender}敗`, '', 'side-cpu')}
          {cell('マルチ対戦', `${rec.pvp.win}勝 ${rec.pvp.lose}敗`, '', 'side-pvp')}
          {cell('いまの連勝', r.streak.now, '連勝', 'side-now')}
          {cell('最高の連勝', r.streak.best, '連勝', 'side-best')}
        </div>
      </div>
      <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>
        {tab === 'all' && (<>
          {onOpenReplays && (
            <button type="button" data-card-replays-open onClick={() => { Audio_.fgSe.tap(); onOpenReplays(); }}
              className="mh-button mh-button-secondary flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-sky-300/40 bg-slate-800 px-3 text-left landscape:hidden">
              <span><b className="block text-[14px] font-black text-sky-100">▶ 過去の対戦</b><small className="block text-[11px] font-bold text-slate-400">遊んだ試合を、はじめから見返せます</small></span>
              <span className="text-[18px] text-slate-400">›</span>
            </button>
          )}
          {/* 投了は負けに数える(カゲあつくんの確認)。保存の形(cpu.lose と cpu.surrender を別に持つ)はそのまま、見せるときに足す */}
          <div className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">助手と対戦</div>
            <div data-card-record className="text-[16px] font-black text-white">{rec.cpu.win}勝 {rec.cpu.lose + rec.cpu.surrender}敗{rec.cpu.surrender ? `(うち投了${rec.cpu.surrender})` : ''}</div>
            <table data-card-record-levels className="mt-2 w-full text-[12px] font-bold">
              <thead><tr className="text-slate-400"><th className="py-1 text-left font-bold">難易度</th><th className="py-1 text-right font-bold">勝ち</th><th className="py-1 text-right font-bold">負け</th></tr></thead>
              <tbody>{CARD_LEVEL_ORDER.map((lv) => <tr key={lv} className="border-t border-white/10"><td className="py-1 text-slate-200">{levelLabel[lv] || lv}</td><td className="py-1 text-right text-amber-200">{rec.byLevel.win[lv]}</td><td className="py-1 text-right text-slate-300">{rec.byLevel.lose[lv]}</td></tr>)}</tbody>
            </table>
            {/* 難易度別は 2026-10-24 から数えている。それより前から遊んでいて、合計と合わない人にだけ断る(はじめての人には出さない) */}
            {CARD_LEVEL_ORDER.reduce((a, lv) => a + rec.byLevel.win[lv] + rec.byLevel.lose[lv], 0) !== rec.cpu.win + rec.cpu.lose + rec.cpu.surrender && <p data-card-record-levels-note className={small} style={JA_LABEL_STYLE}>{jaWrap('難易度別の数は、この表ができてからのぶんです')}</p>}
          </div>
          <div data-card-record-wins className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">勝ち方(助手と対戦)</div>
            <div className="mt-1 grid grid-cols-3 gap-1.5 text-center">
              {cell('勝つまでの平均', winAvg === null ? '—' : winAvg, '番')}
              {cell('いちばん早い勝ち', d.wins.fastest || '—', d.wins.fastest ? '番目' : '')}
              {cell('今日の勝ち', d.day.key === today ? d.day.win : 0, '勝')}
            </div>
            <p className={small} style={JA_WRAP_STYLE}>{jaWrap('「番」は自分の番の数です。この記録ができてからのぶんです')}</p>
          </div>
          <div data-card-record-often className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">よく使う(助手と対戦)</div>
            {row('デッキ', deckTop ? `${deckTop[1].name || 'デッキ'}(${deckTop[1].n}戦)` : 'まだありません', 'deck')}
            {row('モンスター', monTop.length ? monTop.map(([no, n]) => `${nameOf(no)}(${n}戦)`).join('・') : 'まだありません', 'mon')}
            {row('技', moveTop.length ? moveTop.map(([no, n]) => `${nameOf(no)}(${n}回)`).join('・') : 'まだありません', 'move')}
            <p className={small} style={JA_WRAP_STYLE}>{jaWrap('この記録ができてからのぶんです')}</p>
          </div>
          <div className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">ランキングの記録</div>
            <div className="mt-1 grid grid-cols-3 gap-1.5 text-center">
              {cell('今週の勝ち', CARD_LEVEL_ORDER.reduce((a, lv) => a + (r.week.key === weekNow ? r.week.wins[lv] : 0), 0), '勝')}
              {cell('いまの連勝', r.streak.now, '連勝')}
              {cell('最高の連勝', r.streak.best, '連勝')}
            </div>
            <p className={small} style={JA_WRAP_STYLE}>{jaWrap('ランキングに数えるのは、助手と対戦の勝ちと連勝です')}</p>
          </div>
          <div data-card-record-other className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">ほか</div>
            {row('カード図鑑', `${dex.count} / ${dex.total} 種類`, 'dex')}
            {row('クイック周回(MFバトルカードから)', `${d.quick}周`, 'quick')}
            <p className={small} style={JA_WRAP_STYLE}>{jaWrap('クイック周回の数は、この記録ができてからのぶんです')}</p>
          </div>
        </>)}
        {tab === 'foe' && (
          <div data-card-record-foes className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">助手ごとの勝ち負け</div>
            {foeList.map((a) => {
              const f = d.foes[a.id] || cardRecFoe(null);
              const played = f.win + f.lose + f.surrender;
              const open = openFoe === a.id;
              return (
                <div key={a.id} data-card-record-foe={a.id} className="border-t border-white/10 first:border-t-0">
                  <button type="button" aria-expanded={open} onClick={() => { Audio_.fgSe.tap(); setOpenFoe(open ? null : a.id); }} className="flex min-h-[48px] w-full items-center gap-2 py-1 text-left">
                    <img src={assistantFaceImage(a, 'normal')} alt="" className="h-[36px] w-[36px] shrink-0 rounded-lg border-2 bg-black object-cover object-top" style={{ borderColor: a.accent }}/>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-black text-white">{a.name}</span>
                    <span className="shrink-0 text-[12px] font-black text-slate-100">{played ? `${f.win}勝 ${f.lose + f.surrender}敗` : 'まだ'}</span>
                    <span aria-hidden="true" className="w-3 shrink-0 text-[11px] text-slate-400">{open ? '▼' : '▶'}</span>
                  </button>
                  {open && (
                    <div data-card-record-foe-open={a.id} className="mb-2 rounded-xl bg-amber-500/10 px-2 py-1.5">
                      {row('投了', `${f.surrender}`, 'sur')}
                      {row('いまの連勝', `${f.now}連勝`, 'now')}
                      {row('最高の連勝', `${f.best}連勝`, 'best')}
                      {row('いちばん早い勝ち', f.fastest ? `${f.fastest}番目` : '—', 'fast')}
                      <div className="mt-1 text-[10px] font-bold text-slate-400">難易度ごとの勝ち</div>
                      <div className="mt-0.5 grid grid-cols-5 gap-1 text-center text-[10px] font-bold">
                        {CARD_LEVEL_ORDER.map((lv) => <div key={lv} className="min-w-0 rounded-md bg-black/30 py-0.5"><span className="block truncate text-slate-400">{levelLabel[lv] || lv}</span><b className="text-[12px] text-amber-200">{f.levels[lv]}</b></div>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <p className={small} style={JA_WRAP_STYLE}>{jaWrap('助手ごとの数は、この記録ができてからのぶんです(それより前は、最近の30戦から分かる分だけ入っています)')}</p>
          </div>
        )}
        {tab === 'multi' && (<>
          <div data-card-record-multi className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">マルチ対戦</div>
            <div className="text-[16px] font-black text-white">{rec.pvp.win}勝 {rec.pvp.lose}敗</div>
            {row('いまの強さ', !multi ? '読み込み中…' : Number.isFinite(multi.rating) ? `${multi.rating}${multi.place ? `(${multi.place.capped ? `${multi.place.n}位より下` : `${multi.place.n}位`})` : ''}` : pvpGames ? '—' : 'まだ対戦していません', 'rating')}
            {row('いちばん高かった強さ', d.pvpBest ? `${d.pvpBest}` : '—', 'best')}
          </div>
          <div data-card-record-trend className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">強さの移り(最近20戦)</div>
            {chart.length ? (<>
              <div className="mt-1.5 flex h-[56px] items-end gap-[3px]" aria-label={`${chart[0].rating.before}から${chart[chart.length - 1].rating.after}`}>
                {chart.map((h) => {
                  const span = Math.max(1, chartMax - chartMin);
                  return <i key={h.match} className={`block min-w-0 flex-1 rounded-t-[3px] ${h.outcome === 'win' ? 'bg-sky-400' : 'bg-slate-500'}`} style={{ height: `${Math.round(20 + ((h.rating.after - chartMin) / span) * 80)}%` }}/>;
                })}
              </div>
              <p className="mt-1 text-[11px] font-bold text-slate-300">{chart[0].rating.before} → {chart[chart.length - 1].rating.after}</p>
            </>) : <p className="mt-1 text-[12px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap(multi ? '強さの点数が分かる試合が、まだありません' : '読み込み中…')}</p>}
          </div>
          <div data-card-record-recent className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">最近のマルチ</div>
            {hist.length ? hist.slice(0, 3).map((h) => row(h.foe.name, `${h.outcome === 'win' ? '勝ち' : '負け'}${h.rating ? ` ${h.rating.after - h.rating.before >= 0 ? '+' : '−'}${Math.abs(h.rating.after - h.rating.before)}` : ''}`, h.match))
              : <p className="mt-1 text-[12px] font-bold text-slate-400">{multi ? 'まだありません' : '読み込み中…'}</p>}
            {onOpenPvpHistory && (
              <button type="button" data-card-record-pvp-history onClick={() => { Audio_.fgSe.tap(); onOpenPvpHistory(); }}
                className="mh-button mh-button-secondary mt-2 flex min-h-[44px] w-full items-center justify-between rounded-xl border border-white/15 bg-slate-800 px-3 text-left text-[13px] font-black text-slate-100">
                <span>マルチの履歴(相手のデッキ)</span><span className="text-slate-400">›</span>
              </button>
            )}
          </div>
        </>)}
      </div>
    </div>
  );
};
