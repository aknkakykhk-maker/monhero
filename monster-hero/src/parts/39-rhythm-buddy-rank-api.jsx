// ==================== マスモンランキング(モンヒロビート)の通信層(2026-10-07) ====================
// マスモン1体ごとの「ビートLv」と「難易度ごとの最高スコア」を、専用テーブル rhythm_buddy_ranks へ上書き保存する。
// 絆Lvランキング(bond_levels)と同じ作り: 1人 × 1個体で必ず1行・血統は関係なく、そのマスモンの名前と見た目で並べる。
// 既存の rankings / bond_levels には一切書かない。テーブルがまだ無い環境でも壊れない(無いと分かったら以後アクセスしない)。
// 仕様の正本: docs/spec/RHYTHM_BUDDY.md「マスモンランキング」/ SQL: docs/sql/rhythm-buddy-ranks/
const RHYTHM_BUDDY_RANK_TABLE = 'rhythm_buddy_ranks';
const RHYTHM_BUDDY_RANK_SELECT = 'user_name,breeder_id,individual_id,monster_id,mon_name,icon,profile_frame,colors,beat_level,beat_exp,lives,'
  + 'score_easy,score_normal,score_hard,score_expert,score_master,best_songs,updated_at';
// 並べる順に取る件数(1行が小さいので、同じ人の古い行の整理ぶんを含めて多めに取る)
const RHYTHM_BUDDY_RANK_FETCH_LIMIT = 150;
const RHYTHM_BUDDY_RANK_SHOW_LIMIT = 50;
// 保存した指紋(送った行の内容)。起動のたびに全員を送り直さないための新しいキー
const RHYTHM_BUDDY_RANK_SYNC_KEY = 'mh_rhythm_buddy_rank_sync_v1';
const RHYTHM_BUDDY_RANK_SYNC_DELAY_MS = 4000;
const RHYTHM_BUDDY_RANK_SYNC_MIN_INTERVAL_MS = 20000;
const RHYTHM_BUDDY_RANK_SYNC_CHUNK = 50;
const rhythmBuddyScoreColumn = (diffId) => `score_${String(diffId || '').toLowerCase()}`;

let _buddyRanksUnavailable = false;
const buddyRanksUnavailable = () => _buddyRanksUnavailable;

// 手持ちのマスモンと育ちの保存から、送る行を作る。遊んだことのある子だけ(育っていない子は載せない)
const rhythmBuddyRankRows = (userName, icon, masuMons, store, profileFrame = null, breederId = null) => {
  const mons = store && store.mons && typeof store.mons === 'object' ? store.mons : {};
  const rows = [];
  (Array.isArray(masuMons) ? masuMons : []).forEach((masu) => {
    if (!masu || masu.id == null) return;
    const base = ALL_PLAYER_MONSTERS[masu.baseId];
    if (!base || !mons[String(masu.id)]) return;
    const m = rhythmBuddyNormalizeMon(mons[String(masu.id)]);
    if (m.lives <= 0 && m.exp <= 0) return;
    const colors = rankingPartyColors(masu.baseId, getMasuColors(masu));
    const frame = rankingProfileFrameValue(profileFrame);
    const row = {
      user_name: userName || '名無しのブリーダー',
      ...(typeof breederId === 'string' && breederId ? { breeder_id: breederId } : {}),
      individual_id: String(masu.id),
      monster_id: masu.baseId,
      mon_name: String(masu.name || base.name || '').slice(0, 40) || null,
      icon: icon ?? null,
      ...(frame ? { profile_frame: frame } : {}),
      colors: colors.some(Boolean) ? colors : null,
      beat_level: rhythmBuddyLevelInfo(m.exp).level,
      beat_exp: Math.floor(m.exp),
      lives: Math.floor(m.lives),
    };
    const songs = {};
    RHYTHM_BUDDY_DIFF_IDS.forEach((id) => {
      const b = m.best[id];
      row[rhythmBuddyScoreColumn(id)] = b ? Math.floor(b.score) : null;
      if (b && b.songId) songs[id] = b.songId;
    });
    row.best_songs = songs;
    rows.push(row);
  });
  return rows;
};
const rhythmBuddyRankSyncKeyOf = (row) => `${row.user_name}\u001f${row.individual_id}`;
const rhythmBuddyRankRowsToSync = (rows, sent) =>
  (Array.isArray(rows) ? rows : []).filter((row) => (sent || {})[rhythmBuddyRankSyncKeyOf(row)] !== bondLevelRowSignature(row));
const normalizeRhythmBuddyRankSync = (raw) => {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) && raw.sent && typeof raw.sent === 'object' && !Array.isArray(raw.sent) ? raw.sent : {};
  const sent = {};
  Object.keys(src).forEach((key) => { if (typeof src[key] === 'string') sent[key] = src[key]; });
  return { version: 1, sent };
};

// 1行を画面で使う形へ。壊れた値は捨てる
const rhythmBuddyRankEntryFromRow = (row) => {
  if (!row || typeof row !== 'object' || !row.individual_id || !ALL_PLAYER_MONSTERS[row.monster_id]) return null;
  const scores = {};
  RHYTHM_BUDDY_DIFF_IDS.forEach((id) => {
    const n = Number(row[rhythmBuddyScoreColumn(id)]);
    if (Number.isFinite(n) && n > 0) scores[id] = Math.floor(n);
  });
  const songs = row.best_songs && typeof row.best_songs === 'object' && !Array.isArray(row.best_songs) ? row.best_songs : {};
  const level = Number(row.beat_level);
  return {
    userName: String(row.user_name || '名無しのブリーダー'),
    breederId: typeof row.breeder_id === 'string' ? row.breeder_id : '',
    icon: row.icon || null,
    profileFrame: normalizeProfileFrameId(row.profile_frame),
    individualId: String(row.individual_id),
    monsterId: row.monster_id,
    monName: String(row.mon_name || ALL_PLAYER_MONSTERS[row.monster_id].name || ''),
    colors: Array.isArray(row.colors) ? row.colors : [],
    beatLevel: Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0,
    beatExp: Math.max(0, Math.floor(Number(row.beat_exp) || 0)),
    lives: Math.max(0, Math.floor(Number(row.lives) || 0)),
    scores, songs,
    updatedAt: String(row.updated_at || ''),
  };
};
// 改名で同じ個体が2行になっていたら、新しい方だけ見せる(ブリーダーIDがあればIDで、無ければ名前で同じ人とみなす)
const rhythmBuddyRankMerge = (entries) => {
  const byKey = new Map();
  (Array.isArray(entries) ? entries : []).forEach((e) => {
    if (!e) return;
    const key = `${e.breederId || `name:${e.userName}`}\u001f${e.individualId}`;
    const cur = byKey.get(key);
    if (!cur || e.updatedAt > cur.updatedAt) byKey.set(key, e);
  });
  return [...byKey.values()];
};
// kind: 'level'(ビートLv)/ 'score'(diffId の最高スコア)。テーブルが無ければ null
const sbFetchRhythmBuddyRanks = async (kind, diffId = 'MASTER') => {
  if (_buddyRanksUnavailable) return null;
  const column = rhythmBuddyScoreColumn(diffId);
  const order = kind === 'score' ? `${column}.desc.nullslast,updated_at.asc`
    : 'beat_level.desc.nullslast,beat_exp.desc.nullslast,updated_at.asc';
  const filter = kind === 'score' ? `&${column}=gt.0` : '&beat_level=gt.0';
  const url = `${SUPABASE_URL}/rest/v1/${RHYTHM_BUDDY_RANK_TABLE}?select=${RHYTHM_BUDDY_RANK_SELECT}${filter}`
    + `&order=${order}&limit=${RHYTHM_BUDDY_RANK_FETCH_LIMIT}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { headers: SB_HEADERS, cache: 'no-store', signal: controller.signal });
    const body = await res.text();
    if (!res.ok) {
      if (_isMissingTableError(res.status, body)) { _buddyRanksUnavailable = true; return null; }
      throw new Error(`rhythm_buddy_ranks ${res.status}: ${body || res.statusText}`);
    }
    const rows = JSON.parse(body || '[]');
    const entries = rhythmBuddyRankMerge((Array.isArray(rows) ? rows : []).map(rhythmBuddyRankEntryFromRow));
    entries.sort(kind === 'score'
      ? (a, b) => (b.scores[diffId] || 0) - (a.scores[diffId] || 0)
      : (a, b) => b.beatLevel - a.beatLevel || b.beatExp - a.beatExp);
    // 並べたまま全部返す(画面が上位50に切る。フレンドだけに絞るときは、絞ってから50に切る)
    return entries;
  } finally {
    clearTimeout(timer);
  }
};
// 上書き保存。同じ個体は何度書いても1行のまま、最新の値になる
const sbUpsertRhythmBuddyRanks = async (rows) => {
  if (_buddyRanksUnavailable || !Array.isArray(rows) || rows.length === 0) return false;
  const url = `${SUPABASE_URL}/rest/v1/${RHYTHM_BUDDY_RANK_TABLE}?on_conflict=user_name,individual_id`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...SB_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows), signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      if (_isMissingTableError(res.status, body)) { _buddyRanksUnavailable = true; return false; }
      throw new Error(`rhythm_buddy_ranks upsert ${res.status}: ${body || res.statusText}`);
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
};
