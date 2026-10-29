// ==================== ビートランク(モンヒロビート)の全国ランキングの通信層(2026-10-29) ====================
// 表 rhythm_beat_ranks(1人1行・breeder_id)。表へは直接書かず、持ち主の鍵を確かめる関数 rhythm_beat_rank_put だけで書く
// (ログインが無いので、みんなのデッキと同じ「持ち主の鍵」の形。鍵は mh_rhythm_rank_v1 の k に端末で作る)。
// 既存の rankings などには一切書かない。表や関数がまだ無い環境でも壊れない(無いと分かったら以後アクセスしない)。
// SQL: docs/sql/rhythm-beat-rank/RHYTHM_BEAT_RANK_APPLY.sql(カードランクの card_ranks も同じ形)
const BEAT_RANK_TABLE = 'rhythm_beat_ranks';
const BEAT_RANK_SELECT = 'breeder_id,user_name,icon,profile_frame,rank,xp_total,updated_at';
const BEAT_RANK_SHOW_LIMIT = 100;

let _beatRanksUnavailable = false;
const beatRanksUnavailable = () => _beatRanksUnavailable;
// 表が無い(PGRST205)・関数が無い(PGRST202)。権限や通信の失敗と取り違えない
const beatRankMissing = (status, body) => status === 404 && /PGRST20[25]|Could not find the (table|function)|does not exist/i.test(String(body || ''));

// 端末で作る持ち主の鍵(24〜128字・英数字と _-)
const beatRankNewKey = () => {
  const a = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const b = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${a}${b}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 96);
};

const beatRankEntryFromRow = (row) => ({
  breederId: typeof row.breeder_id === 'string' ? row.breeder_id : '',
  name: typeof row.user_name === 'string' && row.user_name ? row.user_name.slice(0, 40) : 'ブリーダー',
  icon: row.icon ?? null,
  profileFrame: row.profile_frame ?? null,
  rank: Math.max(1, Math.floor(Number(row.rank) || 1)),
  xp: playerRankSafeXp(row.xp_total),
});

const beatRankTimed = async (url, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); }
};

// 上位100人。表が無ければ null
const sbFetchBeatRanks = async () => {
  if (_beatRanksUnavailable) return null;
  const url = `${SUPABASE_URL}/rest/v1/${BEAT_RANK_TABLE}?select=${BEAT_RANK_SELECT}`
    + `&order=rank.desc,xp_total.desc,updated_at.asc&limit=${BEAT_RANK_SHOW_LIMIT}`;
  const res = await beatRankTimed(url, { headers: SB_HEADERS, cache: 'no-store' });
  const body = await res.text();
  if (!res.ok) {
    if (beatRankMissing(res.status, body)) { _beatRanksUnavailable = true; return null; }
    throw new Error(`rhythm_beat_ranks ${res.status}: ${body || res.statusText}`);
  }
  const rows = JSON.parse(body || '[]');
  return (Array.isArray(rows) ? rows : []).map(beatRankEntryFromRow);
};

// 自分の行と順位。行が無ければ null
const sbFetchBeatRankMine = async (breederId) => {
  if (_beatRanksUnavailable || typeof breederId !== 'string' || !breederId) return null;
  const rowRes = await beatRankTimed(`${SUPABASE_URL}/rest/v1/${BEAT_RANK_TABLE}?select=${BEAT_RANK_SELECT}&breeder_id=eq.${encodeURIComponent(breederId)}`,
    { headers: SB_HEADERS, cache: 'no-store' });
  const rowBody = await rowRes.text();
  if (!rowRes.ok) { if (beatRankMissing(rowRes.status, rowBody)) _beatRanksUnavailable = true; return null; }
  const rows = JSON.parse(rowBody || '[]');
  if (!Array.isArray(rows) || !rows[0]) return null;
  const placeRes = await beatRankTimed(`${SUPABASE_URL}/rest/v1/rpc/rhythm_beat_rank_place`,
    { method: 'POST', headers: SB_HEADERS, body: JSON.stringify({ p_id: breederId }) });
  const placeBody = await placeRes.text();
  const place = placeRes.ok ? Number(JSON.parse(placeBody || 'null')) : NaN;
  return { ...beatRankEntryFromRow(rows[0]), place: Number.isFinite(place) && place > 0 ? Math.floor(place) : null };
};

// 自分の行を書く。返り値: 'ok' | 'bad' | 'locked' | null(表が無い・送れなかった)
const sbPutBeatRank = async ({ breederId, key, name, icon, profileFrame, xp }) => {
  if (_beatRanksUnavailable || typeof breederId !== 'string' || !breederId || typeof key !== 'string' || !key) return null;
  const res = await beatRankTimed(`${SUPABASE_URL}/rest/v1/rpc/rhythm_beat_rank_put`, {
    method: 'POST', headers: SB_HEADERS,
    body: JSON.stringify({ p_id: breederId, p_key: key, p_name: String(name || '名無しのブリーダー').slice(0, 40), p_icon: icon ?? null,
      p_frame: profileFrame ?? null, p_xp: playerRankSafeXp(xp) }),
  });
  const body = await res.text();
  if (!res.ok) { if (beatRankMissing(res.status, body)) _beatRanksUnavailable = true; return null; }
  try { const v = JSON.parse(body); return typeof v === 'string' ? v : null; } catch (_) { return null; }
};
