// ===== 助手のマスモンのフレンド対戦(非同期PvP・第④段階)の端末の口(2026-11-11 タイセン) =====
// 画面は持たない(じゅんび・観戦・振り返り・ランキングの画面はミセカタ)。ここは「サーバの関数 masmon-pvp を呼ぶ」「表を読む」だけ。
//   サーバ: supabase/functions/masmon-pvp・表 supabase/migrations/202611110001_masmon_pvp.sql・設計 docs/spec/MASMON_PVP_SERVER.md
//   ★対戦はサーバだけが回す。端末は勝ち負けを送らない。返ってきた seed と編成を simulate に渡すと同じ試合を見返せる(digest が合う)
//   ★ブリーダーIDと持ち主の鍵はこの中に閉じる(画面に出さない・渡さない)
//   保存: 新しいキー mh_masmon_pvp_owner_key_v1(持ち主の鍵。はじめて登録するときに作る)だけ
//   公開の印: RELEASE_FLAGS.assistantMasmonBattlePvp が真のときだけ通信する(偽なら reason 'off')
// 返り値の reason は masmonPvpReasonText で日本語にできる
const MASMON_PVP_URL = `${typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : ''}/functions/v1/masmon-pvp`;
const MASMON_PVP_KEY = 'mh_masmon_pvp_owner_key_v1';
const MASMON_PVP_TIMEOUT_MS = 12000;
const MASMON_PVP_CHALLENGE_DAILY = 20;      // サーバの CHALLENGE_DAILY_LIMIT と同じ(残りの目安に使う。決めるのはサーバ)
const MASMON_PVP_REASON_TEXT = Object.freeze({
  off: 'フレンド対戦は準備中です',
  network: 'つながりませんでした。少し待ってからもう一度ためしてね',
  server: 'サーバーが混んでいるみたい。少し待ってからもう一度ためしてね',
  no_id: 'この端末ではまだ登録できません',
  locked: 'この登録は別の端末で作られています',
  over_cap: '育った量が、日数から考えられる上限を超えています',
  team: '編成の中に、登録できないところがあります',
  no_entry: '先に自分の助手の編成を登録してね',
  no_opponent: 'その助手の編成は、まだ登録されていません',
  not_friend: 'フレンドどうしだけが対戦できます',
  size_short: '編成の体数が足りません',
  limit: '今日の対戦はここまで。また明日ね',
  self: '自分とは対戦できません',
});
const masmonPvpReasonText = (reason) => MASMON_PVP_REASON_TEXT[reason] || MASMON_PVP_REASON_TEXT.server;
const masmonPvpOn = () => typeof RELEASE_FLAGS !== 'undefined' && !!RELEASE_FLAGS && RELEASE_FLAGS.assistantMasmonBattlePvp === true;
const masmonPvpSafeId = (v) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null);

// 持ち主の鍵(16進48字)。無ければ create のときだけ作る
const masmonPvpOwnerKey = async (create = false) => {
  let key = null;
  try { key = await storeGet(MASMON_PVP_KEY, null, false); } catch (_) { key = null; }
  if (typeof key === 'string' && /^[0-9a-f]{48}$/.test(key)) return key;
  if (!create) return null;
  try {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const made = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    if (!(await storeSet(MASMON_PVP_KEY, made, false))) return null;
    return made;
  } catch (_) { return null; }
};
const masmonPvpSelf = async (createKey) => {
  const owner = masmonPvpSafeId(typeof ensureBreederId === 'function' ? await ensureBreederId() : null);
  const key = owner ? await masmonPvpOwnerKey(createKey) : null;
  return owner && key ? { owner, key } : null;
};

// サーバの関数を呼ぶ。落ちない(失敗は { ok:false, reason })
const masmonPvpPost = async (body) => {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), MASMON_PVP_TIMEOUT_MS) : null;
  try {
    const r = await fetch(MASMON_PVP_URL, {
      method: 'POST', headers: typeof SB_HEADERS !== 'undefined' ? SB_HEADERS : { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ac ? ac.signal : undefined,
    });
    let j = null;
    try { j = await r.json(); } catch (_) { j = null; }
    if (j && j.ok) return j;
    const e = j && typeof j.error === 'string' ? j.error : (r.status >= 500 ? 'server' : 'network');
    return { ok: false, reason: MASMON_PVP_REASON_TEXT[e] ? e : 'server', detail: j && (j.detail || j.problems) || null };
  } catch (_) {
    return { ok: false, reason: 'network' };
  } finally { if (timer) clearTimeout(timer); }
};
// 表を読む(読むだけ)。失敗は null
const masmonPvpRead = async (path) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB_HEADERS, cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
};

// 自分の助手の編成を登録する(登録し直しも同じ)。members は出る順。1体 = { slot, species, name, lv(育成の Lv・1〜99), stats, techs?, mastery? }
//   plan は作戦('attack'|'guard'|'range'|'big')・swapPace は交代の早さ('early'|'late')。無くてよい(計算の表 PLANS・SWAP_PACES の名前)。size は登録する体数(1〜3。members の先頭から)
const masmonPvpRegister = async ({ assistantId, size, members, plan, swapPace, tactics, userName, icon } = {}) => {
  if (!masmonPvpOn()) return { ok: false, reason: 'off' };
  const me = await masmonPvpSelf(true);
  if (!me) return { ok: false, reason: 'no_id' };
  const n = Math.max(1, Math.min(3, Number.isInteger(size) ? size : 3));
  const list = (Array.isArray(members) ? members : []).slice(0, n);
  const team = { tactics: Number.isInteger(tactics) ? Math.max(0, Math.min(100, tactics)) : 0, members: list };
  if (typeof plan === 'string' && plan) team.plan = plan;
  if (typeof swapPace === 'string' && swapPace) team.swapPace = swapPace;
  const r = await masmonPvpPost({ action: 'register', owner: me.owner, key: me.key, assistant: assistantId,
    name: typeof userName === 'string' ? userName : '', icon: typeof icon === 'string' ? icon : null, team });
  return r.ok ? { ok: true } : { ok: false, reason: r.reason, detail: r.detail };
};

// 登録をやめる(みんなに見せない)
const masmonPvpUnregister = async ({ assistantId } = {}) => {
  if (!masmonPvpOn()) return { ok: false, reason: 'off' };
  const me = await masmonPvpSelf(false);
  if (!me) return { ok: false, reason: 'no_entry' };
  const r = await masmonPvpPost({ action: 'unregister', owner: me.owner, key: me.key, assistant: assistantId });
  return r.ok ? { ok: true } : { ok: false, reason: r.reason };
};

// フレンドの登録している編成(助手ごと)。新しく登録し直した順
const masmonPvpEntriesOf = async (ownerIds) => {
  const ids = (Array.isArray(ownerIds) ? ownerIds : []).map(masmonPvpSafeId).filter(Boolean).slice(0, 100);
  if (!ids.length) return [];
  const rows = await masmonPvpRead(`masmon_pvp_entries?select=owner_id,assistant_id,user_name,icon,team,team_total,updated_at&active=eq.true&owner_id=in.(${ids.join(',')})&order=updated_at.desc`);
  return rows || [];
};

// フレンドに挑む。friendAssistantId が無ければ、そのフレンドがいちばん新しく登録した助手。kind は 'raw'(育成値そのまま)|'fair'(公平)
//   返り: そのまま simulate({ seed, catalog, teamA, teamB, balance }) に渡せば見返せる形
const masmonPvpChallenge = async ({ assistantId, friendId, friendAssistantId, kind = 'raw', size = 3 } = {}) => {
  if (!masmonPvpOn()) return { ok: false, reason: 'off' };
  const me = await masmonPvpSelf(false);
  if (!me) return { ok: false, reason: 'no_entry' };
  const fid = masmonPvpSafeId(friendId);
  if (!fid) return { ok: false, reason: 'no_opponent' };
  let oppAssistant = typeof friendAssistantId === 'string' ? friendAssistantId : null;
  if (!oppAssistant) {
    const rows = await masmonPvpEntriesOf([fid]);
    if (!rows.length) return { ok: false, reason: 'no_opponent' };
    oppAssistant = rows[0].assistant_id;
  }
  const r = await masmonPvpPost({ action: 'challenge', owner: me.owner, key: me.key, assistant: assistantId,
    opp_owner: fid, opp_assistant: oppAssistant, division: kind === 'fair' ? 'fair' : 'raw', size });
  if (!r.ok) return { ok: false, reason: r.reason };
  const m = r.match || {};
  return {
    ok: true, id: m.id, seed: m.seed, teamA: m.teamA, teamB: m.teamB, engineVersion: m.version, techsVersion: m.techVersion,
    balance: m.balance, winner: m.winner, reason: m.reason, rounds: m.rounds, digest: m.digest, kind: m.division, size: m.size,
    rated: !!m.rated, rating: m.a || null, oppRating: m.b || null, remaining: m.remaining,
  };
};

// ランキング。kind 'raw'|'fair'・week を付けると週ごと(月曜4:00 始まりの日付 'YYYY-MM-DD')
//   返り: { rows:[{ rank, name, icon, assistantId, rating(週ごとは points), win, lose, draw, members(種族), me }], mine }(ブリーダーIDは出さない)
const masmonPvpRatings = async ({ kind = 'raw', limit = 50, week = null } = {}) => {
  const div = kind === 'fair' ? 'fair' : 'raw';
  const lim = Math.max(1, Math.min(200, Number(limit) || 50));
  const weekly = typeof week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(week);
  const rows = weekly
    ? await masmonPvpRead(`masmon_pvp_weekly?select=owner_id,assistant_id,points,wins,losses,draws&division=eq.${div}&week=eq.${week}&order=points.desc&limit=${lim}`)
    : await masmonPvpRead(`masmon_pvp_ratings?select=owner_id,assistant_id,user_name,icon,rating,wins,losses,draws&division=eq.${div}&order=rating.desc,matches.desc&limit=${lim}`);
  if (!rows) return { ok: false, reason: 'network', rows: [], mine: null };
  const self = masmonPvpSafeId(typeof ensureBreederId === 'function' ? await ensureBreederId() : null);
  const entries = await masmonPvpEntriesOf(rows.map((r) => r.owner_id));
  const teamOf = (o, a) => {
    const e = entries.find((x) => x.owner_id === o && x.assistant_id === a);
    return e && e.team && Array.isArray(e.team.members) ? e.team.members.map((u) => u.species) : [];
  };
  const nameOf = (o, a, r) => r.user_name || ((entries.find((x) => x.owner_id === o && x.assistant_id === a) || {}).user_name) || '名無しのブリーダー';
  const list = rows.map((r, i) => ({
    rank: i + 1, name: nameOf(r.owner_id, r.assistant_id, r), icon: r.icon ?? null, assistantId: r.assistant_id,
    rating: weekly ? r.points : r.rating, win: r.wins, lose: r.losses, draw: r.draws, members: teamOf(r.owner_id, r.assistant_id),
    me: !!self && r.owner_id === self,
  }));
  return { ok: true, rows: list, mine: list.filter((r) => r.me) };
};

// 挑めるフレンドの一覧(名前・アイコン・登録している助手・今日あと何回)
const masmonPvpFriends = async () => {
  if (!masmonPvpOn()) return { ok: false, reason: 'off', friends: [], remaining: 0 };
  const self = masmonPvpSafeId(typeof ensureBreederId === 'function' ? await ensureBreederId() : null);
  if (!self || typeof sbFetchFriendRoster !== 'function') return { ok: false, reason: 'no_id', friends: [], remaining: 0 };
  let roster = [];
  try { roster = await sbFetchFriendRoster(self); } catch (_) { return { ok: false, reason: 'network', friends: [], remaining: 0 }; }
  const entries = await masmonPvpEntriesOf(roster.map((f) => f.otherId));
  // 今日あと何回(対戦記録から数える。朝4:00 区切り。決めるのはサーバ)
  const day = new Date(Date.now() + 9 * 3600000 - 4 * 3600000).toISOString().slice(0, 10);
  const mine = await masmonPvpRead(`masmon_pvp_matches?select=id&a_owner=eq.${self}&day=eq.${day}&limit=100`);
  const remaining = Math.max(0, MASMON_PVP_CHALLENGE_DAILY - (mine ? mine.length : 0));
  const friends = roster.map((f) => ({
    friendId: f.otherId, name: f.userName, icon: f.icon ?? null, profileFrame: f.profileFrame || null,
    assistants: entries.filter((e) => e.owner_id === f.otherId).map((e) => ({
      assistantId: e.assistant_id, members: e.team && Array.isArray(e.team.members) ? e.team.members.map((u) => ({ species: u.species, name: u.name, lv: u.lv })) : [],
      total: e.team_total, updatedAt: Date.parse(e.updated_at) || 0,
    })),
  })).map((f) => ({ ...f, registered: f.assistants.length > 0 }));
  // 登録編成を持つフレンドがいれば、助手の修行の「練習相手」に数える(通信は増やさず、読んだ結果を使うだけ)
  try { if (friends.some((f) => f.registered) && typeof amgcNoteFriend === 'function') amgcNoteFriend(true); } catch (_) {}
  return { ok: true, friends, remaining };
};
