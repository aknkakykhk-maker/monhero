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
