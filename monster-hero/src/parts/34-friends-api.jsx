// ===== フレンド機能の通信層(Supabase の friend_codes / friend_links) =====
// 設計の正本: docs/spec/FRIENDS.md / SQL: docs/sql/friends/
//
// 決めごと:
//  ・保存データ(mh_*)・ランキング(rankings 等)・breeder_profiles には**一度も書き込まない**。
//    書くのは新設の friend_codes(自分のコードを1回だけ)と friend_links(関係)の2つだけ。
//  ・端末には何も保存しない。フレンドの正本はサーバー。新しい保存キーも作らない。
//  ・ログインが無いので、人は端末ごとのブリーダーID(ensureBreederId)で見分ける。
//  ・行は消さない。解除・断り・ブロックは status を変えるだけ(DELETE の権限が無い)。
//  ・1組(2人)は1行まで(SQLの一意索引)。逆向きに申請されていたら、その行を「承認」に変える。
//  ・表がまだ無い環境(SQL未適用)は「準備中」として扱う。エラー扱いにして画面を壊さない。
const FRIEND_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FRIEND_CODE_LENGTH = 8;
const FRIENDS_MAX = 50;            // フレンドになれる人数の上限(承認済みの数)
const FRIENDS_PENDING_MAX = 30;    // 申請中(送った・届いた、それぞれ)の上限
const FRIEND_STATUS = Object.freeze({
  PENDING: 'pending', ACCEPTED: 'accepted', DECLINED: 'declined', BLOCKED: 'blocked', REMOVED: 'removed',
});
const FRIENDS_TABLE_CODES = 'friend_codes';
const FRIENDS_TABLE_LINKS = 'friend_links';
const FRIENDS_TIMEOUT_MS = 8000;
const FRIENDS_ONLINE_MS = 5 * 60 * 1000;           // 最後に開いてから5分以内は「いま」
let _friendsUnavailable = false;                   // 表が無いと分かったら、ページを閉じるまで使わない
let _friendCodeCache = null;                       // { breederId, code }
const friendsUnavailable = () => _friendsUnavailable;

// 申請の結果。画面はこの語だけを見て文言を決める(通信の細部を画面へ持ち込まない)
//   sent / accepted(逆向きの申請があったので成立) / already(すでにフレンド) / pending(申請済み)
//   self / notfound / blocked-by-me / unavailable(断られている・ブロックされている等。理由は言わない)
//   full(自分の上限) / their-full(相手の上限) / limit(申請の上限) / notready(準備中) / error
const friendsMakeCode = () => {
  let code = '';
  for (let i = 0; i < FRIEND_CODE_LENGTH; i += 1) {
    code += FRIEND_CODE_CHARS[Math.floor(Math.random() * FRIEND_CODE_CHARS.length)];
  }
  return code;
};
// 入力されたコードを整える(空白・ハイフン・小文字を許す)。8文字にそろわなければ空文字
const friendsNormalizeCode = (text) => {
  const code = String(text == null ? '' : text).toUpperCase().split('')
    .filter((ch) => FRIEND_CODE_CHARS.includes(ch)).join('');
  return code.length === FRIEND_CODE_LENGTH ? code : '';
};
// 表示用に4文字ずつ区切る(ABCD-2345)
const friendsFormatCode = (code) => {
  const text = typeof code === 'string' ? code : '';
  return text.length === FRIEND_CODE_LENGTH ? `${text.slice(0, 4)}-${text.slice(4)}` : text;
};
// ブリーダーIDとして安全な形か。URLの絞り込み(or=(...))へ入れるので、区切り文字を含むものは通さない
const friendsSafeId = (value) => (typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value)) ? value : '';
// ランキングの1行から、フレンド申請の相手になれるブリーダーIDを取り出す(取れなければ空文字)。
// IDが付く前の古い記録(identityKey が name: で始まるもの)は、人を特定できないので申請できない
const friendsIdOfRankingEntry = (entry) => {
  const direct = friendsSafeId(entry?.breederId);
  if (direct) return direct;
  const key = typeof entry?.identityKey === 'string' ? entry.identityKey : '';
  return key.startsWith('name:') ? '' : friendsSafeId(key);
};
const friendsStatusOf = (value) => (Object.values(FRIEND_STATUS).includes(value) ? value : FRIEND_STATUS.REMOVED);

// 行(サーバーの形)を、自分から見た形へ。otherId が相手
const friendLinkView = (selfId, row) => {
  const requester = typeof row?.requester_id === 'string' ? row.requester_id : '';
  const target = typeof row?.target_id === 'string' ? row.target_id : '';
  if (!selfId || (requester !== selfId && target !== selfId)) return null;
  const outgoing = requester === selfId;
  const otherId = outgoing ? target : requester;
  if (!otherId) return null;
  const status = friendsStatusOf(row?.status);
  const updatedMs = Date.parse(row?.updated_at);
  return {
    otherId, status, outgoing,
    blockedByMe: status === FRIEND_STATUS.BLOCKED && row?.blocked_by === selfId,
    updatedAt: Number.isFinite(updatedMs) ? updatedMs : 0,
  };
};
// 関係の一覧を、画面のタブごとに仕分ける。ブロックされた側(相手が自分をブロック)には何も見せない
const friendsGroup = (selfId, rows) => {
  const groups = { friends: [], incoming: [], outgoing: [], blocked: [] };
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const view = friendLinkView(selfId, row);
    if (!view) return;
    if (view.status === FRIEND_STATUS.ACCEPTED) groups.friends.push(view);
    else if (view.status === FRIEND_STATUS.PENDING) (view.outgoing ? groups.outgoing : groups.incoming).push(view);
    else if (view.blockedByMe) groups.blocked.push(view);
  });
  Object.values(groups).forEach((list) => list.sort((a, b) => b.updatedAt - a.updatedAt));
  return groups;
};
// 最後に開いた時刻から「いま」「◯分前」「◯時間前」「◯日前」の文を作る(表示用の純粋な計算)
const friendsLastSeenText = (updatedAtMs, nowMs) => {
  if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) return 'さいごに開いた時間は不明';
  const diff = Math.max(0, nowMs - updatedAtMs);
  if (diff < FRIENDS_ONLINE_MS) return 'いま遊んでいるかも';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}分前に開きました`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前に開きました`;
  return `${Math.floor(hours / 24)}日前に開きました`;
};

// ---- 通信の下回り ----
// 失敗は throw、表が無いときだけ notReady を付けた Error を投げる。画面側はそれを「準備中」に変える
const friendsRequest = async (path, { method = 'GET', body = null, prefer = null } = {}) => {
  if (_friendsUnavailable) { const e = new Error('friends tables are not ready'); e.notReady = true; throw e; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FRIENDS_TIMEOUT_MS);
  try {
    const headers = prefer ? { ...SB_HEADERS, 'Prefer': prefer } : SB_HEADERS;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method, headers, cache: 'no-store', signal: controller.signal,
      body: body === null ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      if (_isMissingTableError(res.status, text)) {
        _friendsUnavailable = true;
        const e = new Error('friends tables are not ready'); e.notReady = true; throw e;
      }
      const e = new Error(`friends ${method} ${path.split('?')[0]} ${res.status}: ${text || res.statusText}`);
      e.status = res.status;
      throw e;
    }
    return text ? JSON.parse(text) : [];
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error(`friends request timed out after ${FRIENDS_TIMEOUT_MS}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
const friendsPairFilter = (a, b) =>
  `or=(and(requester_id.eq.${a},target_id.eq.${b}),and(requester_id.eq.${b},target_id.eq.${a}))`;
const friendsFetchPair = async (a, b) => {
  const rows = await friendsRequest(`${FRIENDS_TABLE_LINKS}?select=*&${friendsPairFilter(a, b)}&limit=1`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
};
// 行の書き換え(PATCH)。主キーの2列で1行だけを指す。向きを入れ替える場合も、いまの向きで指す
const friendsPatchLink = (row, changes) => friendsRequest(
  `${FRIENDS_TABLE_LINKS}?requester_id=eq.${row.requester_id}&target_id=eq.${row.target_id}`,
  { method: 'PATCH', body: changes, prefer: 'return=minimal' });

// ---- 自分のフレンドコード ----
// 初回だけ作って登録する。同じコードが取られていたら(409)作り直す。登録済みなら同じものを返す
const sbEnsureFriendCode = async (breederId) => {
  const id = friendsSafeId(breederId);
  if (!id) return null;
  if (_friendCodeCache && _friendCodeCache.breederId === id) return _friendCodeCache.code;
  const found = async () => {
    const rows = await friendsRequest(`${FRIENDS_TABLE_CODES}?select=friend_code&breeder_id=eq.${id}&limit=1`);
    const code = Array.isArray(rows) && rows.length ? friendsNormalizeCode(rows[0].friend_code) : '';
    if (code) _friendCodeCache = { breederId: id, code };
    return code || null;
  };
  const existing = await found();
  if (existing) return existing;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await friendsRequest(FRIENDS_TABLE_CODES, {
        method: 'POST', body: [{ breeder_id: id, friend_code: friendsMakeCode() }], prefer: 'return=minimal' });
      const created = await found();
      if (created) return created;
    } catch (error) {
      if (error && error.notReady) throw error;
      if (error && error.status === 409) {
        // 自分の行がもうある(別の画面から同時に作った)なら、それを使う。無ければコードの重なりなので作り直す
        const again = await found();
        if (again) return again;
        continue;
      }
      throw error;
    }
  }
  return null;
};
// コードから相手のブリーダーIDを引く
const sbFindBreederIdByCode = async (rawCode) => {
  const code = friendsNormalizeCode(rawCode);
  if (!code) return null;
  const rows = await friendsRequest(`${FRIENDS_TABLE_CODES}?select=breeder_id&friend_code=eq.${code}&limit=1`);
  return Array.isArray(rows) && rows.length ? friendsSafeId(rows[0].breeder_id) || null : null;
};

// ---- 関係の読み込み ----
const sbFetchFriendLinks = async (breederId) => {
  const id = friendsSafeId(breederId);
  if (!id) return [];
  const rows = await friendsRequest(
    `${FRIENDS_TABLE_LINKS}?select=*&or=(requester_id.eq.${id},target_id.eq.${id})&order=updated_at.desc&limit=300`);
  return Array.isArray(rows) ? rows : [];
};
// 相手たちの名前・アイコン・フレーム・最後に開いた時刻(breeder_profiles から。読むだけ)
const sbFetchFriendProfiles = async (ids) => {
  const safe = Array.from(new Set((Array.isArray(ids) ? ids : []).map(friendsSafeId).filter(Boolean))).slice(0, 100);
  const byId = {};
  if (!safe.length) return byId;
  const rows = await friendsRequest(
    `breeder_profiles?select=breeder_id,user_name,icon,profile_frame,updated_at&breeder_id=in.(${safe.join(',')})`);
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || typeof row.breeder_id !== 'string') return;
    const at = Date.parse(row.updated_at);
    byId[row.breeder_id] = {
      userName: row.user_name || '名無しのブリーダー',
      icon: row.icon ?? null,
      profileFrame: normalizeProfileFrameId(row.profile_frame),
      lastSeenAt: Number.isFinite(at) ? at : 0,
    };
  });
  return byId;
};
// プロフィールの中身(モンヒロビートの合計スコア・曲数・ブリーダーLv)。既存の総合ランキングの表から読むだけ
const sbFetchFriendRhythmSummary = async (breederId) => {
  const id = friendsSafeId(breederId);
  if (!id) return null;
  try {
    const rows = await sbFetchRhythmTotalRankings({ limit: 1, identityKeys: [id], requestId: 'friend-profile' });
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    return row ? rhythmTotalRankingEntryFromRow(row) : null;
  } catch (error) {
    return null;   // 総合ランキングが準備中・通信失敗でも、プロフィールそのものは出す
  }
};

// ---- 申請・承認・解除・ブロック ----
const friendsCountAccepted = (selfId, rows) =>
  (Array.isArray(rows) ? rows : []).filter((row) => friendLinkView(selfId, row)?.status === FRIEND_STATUS.ACCEPTED).length;
const friendsCountOutgoing = (selfId, rows) =>
  (Array.isArray(rows) ? rows : []).filter((row) => {
    const view = friendLinkView(selfId, row);
    return view && view.status === FRIEND_STATUS.PENDING && view.outgoing;
  }).length;
const friendsGuard = async (fn) => {
  try { return await fn(); } catch (error) {
    if (error && error.notReady) return 'notready';
    console.error('[friends]', error && error.message ? error.message : error);
    return 'error';
  }
};
// 相手の承認済みの数(上限の判定用)。取れなければ判定しない(通す)
const friendsAcceptedCountOf = async (id) => {
  try {
    const rows = await sbFetchFriendLinks(id);
    return friendsCountAccepted(id, rows);
  } catch (error) { return 0; }
};

const sbSendFriendRequest = (selfIdRaw, targetIdRaw) => friendsGuard(async () => {
  const selfId = friendsSafeId(selfIdRaw);
  const targetId = friendsSafeId(targetIdRaw);
  if (!selfId || !targetId) return 'error';
  if (selfId === targetId) return 'self';
  const mine = await sbFetchFriendLinks(selfId);
  if (friendsCountOutgoing(selfId, mine) >= FRIENDS_PENDING_MAX) return 'limit';
  const existing = mine.find((row) => friendLinkView(selfId, row)?.otherId === targetId) || null;
  if (!existing) {
    // 1組1行で、どちらの向きの行も自分の一覧に入る。ここに無ければ、この2人の行はまだ無い
    if (friendsCountAccepted(selfId, mine) >= FRIENDS_MAX) return 'full';
    try {
      await friendsRequest(FRIENDS_TABLE_LINKS, {
        method: 'POST', body: [{ requester_id: selfId, target_id: targetId, status: FRIEND_STATUS.PENDING }],
        prefer: 'return=minimal' });
      return 'sent';
    } catch (error) {
      if (error && error.status === 409) return 'pending';   // 同時に申請された。もう行がある
      throw error;
    }
  }
  const view = friendLinkView(selfId, existing);
  switch (view.status) {
    case FRIEND_STATUS.ACCEPTED: return 'already';
    case FRIEND_STATUS.PENDING:
      if (view.outgoing) return 'pending';
      // 相手からも申請が来ていた → そのまま成立させる
      if (friendsCountAccepted(selfId, mine) >= FRIENDS_MAX) return 'full';
      if (await friendsAcceptedCountOf(targetId) >= FRIENDS_MAX) return 'their-full';
      await friendsPatchLink(existing, { status: FRIEND_STATUS.ACCEPTED });
      return 'accepted';
    case FRIEND_STATUS.BLOCKED:
      return view.blockedByMe ? 'blocked-by-me' : 'unavailable';
    case FRIEND_STATUS.DECLINED:
      // 自分が断った相手へは申請できる。自分の申請を断られた場合は、理由を言わず申請できないことにする
      if (view.outgoing) return 'unavailable';
      // fallthrough
    default:   // removed / declined(自分が断った)
      if (friendsCountAccepted(selfId, mine) >= FRIENDS_MAX) return 'full';
      await friendsPatchLink(existing, {
        requester_id: selfId, target_id: targetId, status: FRIEND_STATUS.PENDING, blocked_by: null });
      return 'sent';
  }
});

// 届いた申請への返事。action: 'accept' | 'decline' | 'block'
const sbRespondFriendRequest = (selfIdRaw, otherIdRaw, action) => friendsGuard(async () => {
  const selfId = friendsSafeId(selfIdRaw);
  const otherId = friendsSafeId(otherIdRaw);
  if (!selfId || !otherId) return 'error';
  const row = await friendsFetchPair(selfId, otherId);
  const view = row ? friendLinkView(selfId, row) : null;
  if (!view || view.status !== FRIEND_STATUS.PENDING || view.outgoing) return 'gone';   // もう取り下げられた等
  if (action === 'accept') {
    const mine = await sbFetchFriendLinks(selfId);
    if (friendsCountAccepted(selfId, mine) >= FRIENDS_MAX) return 'full';
    if (await friendsAcceptedCountOf(otherId) >= FRIENDS_MAX) return 'their-full';
    await friendsPatchLink(row, { status: FRIEND_STATUS.ACCEPTED });
    return 'accepted';
  }
  if (action === 'block') {
    await friendsPatchLink(row, { status: FRIEND_STATUS.BLOCKED, blocked_by: selfId });
    return 'blocked';
  }
  await friendsPatchLink(row, { status: FRIEND_STATUS.DECLINED });
  return 'declined';
});
// 自分が送った申請の取り下げ(行は消さず、解除済みにする)
const sbCancelFriendRequest = (selfIdRaw, otherIdRaw) => friendsGuard(async () => {
  const selfId = friendsSafeId(selfIdRaw);
  const otherId = friendsSafeId(otherIdRaw);
  if (!selfId || !otherId) return 'error';
  const row = await friendsFetchPair(selfId, otherId);
  const view = row ? friendLinkView(selfId, row) : null;
  if (!view || view.status !== FRIEND_STATUS.PENDING || !view.outgoing) return 'gone';
  await friendsPatchLink(row, { status: FRIEND_STATUS.REMOVED });
  return 'cancelled';
});
const sbRemoveFriend = (selfIdRaw, otherIdRaw) => friendsGuard(async () => {
  const selfId = friendsSafeId(selfIdRaw);
  const otherId = friendsSafeId(otherIdRaw);
  if (!selfId || !otherId) return 'error';
  const row = await friendsFetchPair(selfId, otherId);
  const view = row ? friendLinkView(selfId, row) : null;
  if (!view || view.status !== FRIEND_STATUS.ACCEPTED) return 'gone';
  await friendsPatchLink(row, { status: FRIEND_STATUS.REMOVED });
  return 'removed';
});
const sbBlockFriendUser = (selfIdRaw, otherIdRaw) => friendsGuard(async () => {
  const selfId = friendsSafeId(selfIdRaw);
  const otherId = friendsSafeId(otherIdRaw);
  if (!selfId || !otherId || selfId === otherId) return 'error';
  const row = await friendsFetchPair(selfId, otherId);
  if (!row) {
    await friendsRequest(FRIENDS_TABLE_LINKS, {
      method: 'POST', body: [{ requester_id: selfId, target_id: otherId, status: FRIEND_STATUS.BLOCKED, blocked_by: selfId }],
      prefer: 'return=minimal' });
    return 'blocked';
  }
  await friendsPatchLink(row, { status: FRIEND_STATUS.BLOCKED, blocked_by: selfId });
  return 'blocked';
});
const sbUnblockFriendUser = (selfIdRaw, otherIdRaw) => friendsGuard(async () => {
  const selfId = friendsSafeId(selfIdRaw);
  const otherId = friendsSafeId(otherIdRaw);
  if (!selfId || !otherId) return 'error';
  const row = await friendsFetchPair(selfId, otherId);
  const view = row ? friendLinkView(selfId, row) : null;
  if (!view || !view.blockedByMe) return 'gone';
  await friendsPatchLink(row, { status: FRIEND_STATUS.REMOVED, blocked_by: null });
  return 'unblocked';
});

// ---- マルチへの招待(friend_invites) ----
// モンヒロビートのマルチ(プライベートルーム)の部屋コードを、フレンドへ渡す。
// 送る人→受ける人ごとに1行へ上書きされる(古い招待が残り続けない)。
// 受ける側は、マルチの入口画面で数秒ごとに読み、承認済みのフレンドからの3分以内の招待だけを出す。
const FRIEND_INVITE_TTL_MS = 3 * 60 * 1000;
const FRIEND_INVITE_POLL_MS = 8000;
const FRIEND_INVITE_CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;
// 招待を送る(送る相手が承認済みのフレンドかどうかは、画面が名簿から選ばせることで守る)
const sbSendRoomInvite = (selfIdRaw, targetIdRaw, roomCode) => friendsGuard(async () => {
  const selfId = friendsSafeId(selfIdRaw);
  const targetId = friendsSafeId(targetIdRaw);
  const code = typeof roomCode === 'string' ? roomCode.toUpperCase() : '';
  if (!selfId || !targetId || selfId === targetId || !FRIEND_INVITE_CODE_RE.test(code)) return 'error';
  await friendsRequest(`friend_invites?on_conflict=sender_id,target_id`, {
    method: 'POST', body: [{ sender_id: selfId, target_id: targetId, room_code: code }],
    prefer: 'resolution=merge-duplicates,return=minimal' });
  return 'invited';
});
// 自分に届いている、有効な招待を返す。[{ senderId, roomCode, createdAt }] (新しい順)
const sbFetchRoomInvites = async (selfIdRaw, nowMs) => {
  const selfId = friendsSafeId(selfIdRaw);
  if (!selfId) return [];
  const since = new Date(nowMs - FRIEND_INVITE_TTL_MS).toISOString();
  const rows = await friendsRequest(
    `friend_invites?select=sender_id,room_code,created_at&target_id=eq.${selfId}`
    + `&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=20`);
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const at = Date.parse(row?.created_at);
    const code = typeof row?.room_code === 'string' ? row.room_code.toUpperCase() : '';
    return { senderId: friendsSafeId(row?.sender_id), roomCode: code, createdAt: Number.isFinite(at) ? at : 0 };
  }).filter((invite) => invite.senderId && FRIEND_INVITE_CODE_RE.test(invite.roomCode)
    && nowMs - invite.createdAt <= FRIEND_INVITE_TTL_MS);
};
// 招待の相手を選ぶための名簿(承認済みのフレンドだけ)。最近開いた人を上に並べる
const sbFetchFriendRoster = async (selfIdRaw) => {
  const selfId = friendsSafeId(selfIdRaw);
  if (!selfId) return [];
  const groups = friendsGroup(selfId, await sbFetchFriendLinks(selfId));
  const looks = await sbFetchFriendProfiles(groups.friends.map((view) => view.otherId));
  return groups.friends.map((view) => ({
    otherId: view.otherId,
    userName: (looks[view.otherId] || {}).userName || '名無しのブリーダー',
    lastSeenAt: (looks[view.otherId] || {}).lastSeenAt || 0,
  })).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
};
