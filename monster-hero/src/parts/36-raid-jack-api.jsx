// ===== イベント・レイドボス「ジャック」の通信層(Supabase の raid_jack_hits とビュー3つ) =====
// 設計の正本: docs/spec/RAID_BOSS_JACK.md / SQL: docs/sql/raid/
//
// 決めごと:
//  ・既存の保存データ(mh_*)・ランキング(rankings 等)・breeder_profiles には一度も書き込まない。
//    書くのは新設の raid_jack_hits(1戦の与ダメージを1行)だけ。端末の保存も新しいキー mh_raid_jack_v1 だけ。
//  ・同じ hit_id を2回送っても1行しか入らない(on_conflict=hit_id・ignore-duplicates)。だから再送してよい。
//  ・送れなかった与ダメージは mh_raid_jack_v1 の pending に残し、あとで送り直す(最大30件)。
//  ・表がまだ無い環境(SQL未適用)は「準備中」として扱う。エラー扱いにして画面を壊さない。
//  ・このファイルは公開フラグ(RELEASE_FLAGS.raidJack)を見ない。呼ぶ側が見る。
const RAID_JACK_TIMEOUT_MS = 8000;
let _raidJackUnavailable = false;                  // 表が無いと分かったら、ページを閉じるまで使わない
const raidJackUnavailable = () => _raidJackUnavailable;

const raidJackSafeId = (value) => (typeof value === 'string' && /^[0-9A-Za-z_-]{8,100}$/.test(value)) ? value : '';
// 端末が作る一意のID(8〜64文字の英数字と - _)。同じ1戦の再送には同じIDを使い回す
const raidJackMakeHitId = (nowMs = Date.now()) => {
  const rand = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `rj${Math.floor(nowMs).toString(36)}${rand}`.slice(0, 64);
};
// デバッグ画面は別のイベントID(RAID_JACK_DEBUG_EVENT_ID)で送り、本番の集計(raid_jack_2026)を汚さない
const RAID_JACK_DEBUG_EVENT_ID = 'raid_jack_debug';
const raidJackSafeEventId = (id) => (typeof id === 'string' && /^[0-9A-Za-z_-]{1,40}$/.test(id)) ? id : RAID_JACK_EVENT.id;
const raidJackEventParam = (eventId) => `event_id=eq.${encodeURIComponent(raidJackSafeEventId(eventId))}`;

// 通信の共通部分。返り値 { ok, status, body, notReady, error }
const raidJackRequest = async (pathAndQuery, init = {}) => {
  if (_raidJackUnavailable) return { ok: false, status: 0, body: '', notReady: true, error: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAID_JACK_TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
      cache: 'no-store', ...init, headers: { ...SB_HEADERS, ...(init.headers || {}) }, signal: controller.signal,
    });
    const body = await res.text();
    if (!res.ok && (_isMissingTableError(res.status, body) || res.status === 404)) {
      _raidJackUnavailable = true;
      return { ok: false, status: res.status, body, notReady: true, error: null };
    }
    return { ok: res.ok, status: res.status, body, notReady: false, error: null, headers: res.headers };
  } catch (error) {
    return { ok: false, status: 0, body: '', notReady: false, error };
  } finally {
    clearTimeout(timer);
  }
};
const raidJackParseRows = (result) => {
  if (!result || !result.ok) return null;
  try { const rows = JSON.parse(result.body); return Array.isArray(rows) ? rows : null; } catch (e) { return null; }
};

// 1戦の与ダメージを送る。hit = { hitId, kind, tier, damage, defeated }
// 返り値: 'sent' / 'notready'(表が無い) / 'invalid'(形が違う・送らない) / 'error'(あとで送り直す)
const sbSendRaidJackHit = async (hit, breederId, eventId) => {
  const id = raidJackSafeId(breederId);
  const [clean] = raidJackNormalizePending([hit]);
  if (!id || !clean) return 'invalid';
  const row = {
    hit_id: clean.hitId, event_id: raidJackSafeEventId(eventId), kind: clean.kind, tier: clean.tier,
    breeder_id: id, damage: clean.damage, defeated: clean.defeated,
    app_build: typeof BUILD_DATE === 'string' ? BUILD_DATE.replace(/[^0-9]/g, '').slice(0, 12) : '',
  };
  const result = await raidJackRequest('raid_jack_hits?on_conflict=hit_id', {
    method: 'POST', headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(row),
  });
  if (result.ok) return 'sent';
  if (result.notReady) return 'notready';
  // 形がサーバーの決まりに合わない(400・409・422)は、何度送っても通らないので捨てる
  if ([400, 409, 422].includes(result.status)) return 'invalid';
  return 'error';
};

const raidJackLoadState = async () => {
  try { return raidJackNormalizeState(await storeGet(RAID_JACK_STORAGE_KEY, null, false)); } catch (e) { return raidJackDefaultState(); }
};
const raidJackSaveState = async (state) => {
  try { await storeSet(RAID_JACK_STORAGE_KEY, raidJackNormalizeState(state), false); return true; } catch (e) { return false; }
};

// 送る。送れなければ pending に残す(戻り値は送れたかどうか)。state は呼び出し側が持つ最新を渡し、更新後を返す
const raidJackSubmitHit = async (state, hit, breederId, eventId) => {
  const next = raidJackNormalizeState(state);
  const outcome = await sbSendRaidJackHit(hit, breederId, eventId);
  if (outcome === 'error' || outcome === 'notready') {
    const [clean] = raidJackNormalizePending([hit]);
    if (clean && !next.pending.some((p) => p.hitId === clean.hitId)) next.pending = [...next.pending, clean].slice(-30);
  }
  return { state: next, outcome };
};
// 再送待ちを送り直す。送れた・捨てるべきものを取り除いた状態を返す
const raidJackFlushPending = async (state, breederId, eventId) => {
  const next = raidJackNormalizeState(state);
  if (!next.pending.length || !raidJackSafeId(breederId)) return next;
  const keep = [];
  for (const hit of next.pending) {
    const outcome = await sbSendRaidJackHit(hit, breederId, eventId);
    if (outcome === 'error' || outcome === 'notready') keep.push(hit);
  }
  next.pending = keep;
  return next;
};

// ---- 読み出し(失敗は null を返し、画面は「準備中」にする) ----
// 段階ごとの合計。返り値 { a: { 1: {total, players, defeated}, ... }, b: {...} } か null
const sbFetchRaidJackTierTotals = async (eventId) => {
  const rows = raidJackParseRows(await raidJackRequest(`raid_jack_tier_totals?${raidJackEventParam(eventId)}&select=kind,tier,total_damage,player_count,any_defeated`));
  if (!rows) return null;
  const out = { a: {}, b: {} };
  rows.forEach((r) => {
    if ((r.kind !== 'a' && r.kind !== 'b') || !Number.isFinite(Number(r.tier))) return;
    out[r.kind][Number(r.tier)] = { total: Number(r.total_damage) || 0, players: Number(r.player_count) || 0, defeated: r.any_defeated === true };
  });
  return out;
};
// A: 段階ごとの貢献ランキング(上位 limit)
const sbFetchRaidJackContributions = async (tier, limit = 100, eventId) => {
  const n = Math.min(Math.max(Math.floor(Number(limit)) || 100, 1), 200);
  const t = Math.min(Math.max(Math.floor(Number(tier)) || 1, 1), 5);
  const rows = raidJackParseRows(await raidJackRequest(`raid_jack_contributions?${raidJackEventParam(eventId)}&kind=eq.a&tier=eq.${t}&select=breeder_id,total_damage,last_hit_at&order=total_damage.desc,last_hit_at.asc&limit=${n}`));
  return rows ? rows.map((r) => ({ breederId: String(r.breeder_id), total: Number(r.total_damage) || 0 })) : null;
};
// B: 累計ダメージのランキング(上位 limit。既定100)
const sbFetchRaidJackBRanking = async (limit = 100, eventId) => {
  const n = Math.min(Math.max(Math.floor(Number(limit)) || 100, 1), 200);
  const rows = raidJackParseRows(await raidJackRequest(`raid_jack_b_ranking?${raidJackEventParam(eventId)}&select=breeder_id,total_damage,last_hit_at&order=total_damage.desc,last_hit_at.asc&limit=${n}`));
  return rows ? rows.map((r) => ({ breederId: String(r.breeder_id), total: Number(r.total_damage) || 0 })) : null;
};
// 自分の貢献(A: 段階ごと / B: 累計)。圏外でも自分の数字と順位(=自分より多い人数+1)が出せる
const sbFetchRaidJackSelf = async (breederId, eventId) => {
  const id = raidJackSafeId(breederId);
  if (!id) return null;
  const rows = raidJackParseRows(await raidJackRequest(`raid_jack_contributions?${raidJackEventParam(eventId)}&breeder_id=eq.${id}&select=kind,tier,total_damage`));
  if (!rows) return null;
  const out = { a: {}, bTotal: 0 };
  rows.forEach((r) => {
    const total = Number(r.total_damage) || 0;
    if (r.kind === 'a') out.a[Number(r.tier)] = total; else if (r.kind === 'b') out.bTotal += total;
  });
  return out;
};
// 自分より多い人数(順位 = これ + 1)。Content-Range の総数を使う
const sbCountRaidJackAhead = async (kind, tier, myTotal, eventId) => {
  const mine = Math.max(0, Math.floor(Number(myTotal)) || 0);
  const view = kind === 'b' ? 'raid_jack_b_ranking' : 'raid_jack_contributions';
  const extra = kind === 'b' ? '' : `&kind=eq.a&tier=eq.${Math.min(Math.max(Math.floor(Number(tier)) || 1, 1), 5)}`;
  const result = await raidJackRequest(`${view}?${raidJackEventParam(eventId)}${extra}&total_damage=gt.${mine}&select=breeder_id&limit=1`, { headers: { 'Prefer': 'count=exact' } });
  if (!result.ok) return null;
  const range = result.headers && result.headers.get ? result.headers.get('content-range') : '';
  const m = /\/(\d+)$/.exec(String(range || ''));
  return m ? Number(m[1]) : null;
};
