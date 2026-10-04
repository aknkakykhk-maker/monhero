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
let _friendProfileExtraUnavailable = false;        // friend_profiles に message / records の列がまだ無いとき(第3弾のSQL未適用)。外して送り直す
let _friendProfilesUnavailable = false;           // friend_profiles だけ無いと分かったとき(SQL未適用)。フレンド本体は止めない
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
// モンスターの「顔アイコン」を、本番のプロフィールのアイコンとまったく同じ見え方で出すための材料(src と id)。
// プロフィールのアイコンは、BreederIcon が id で引く「拡大・位置の調整」を通して丸く切り抜いている。
// その id と絵の決め方は breederIconOptions と同じにする(ここで別の決め方を作らない):
//   ① 最初から使える8体 … モンスターidと、その顔アイコン(顔の専用絵が無ければ立ち絵)
//   ② それ以外 … マーケットで買えるプロフィールアイコン(type:'icon')。商品名は「◯◯のアイコン」
//      (スネグーラチカのように、顔アイコンとは別の絵を商品に使っている子もいるので、絵のファイルではなく名前で探す)
//   ③ 名前で見つからなければ、同じ絵のファイルの商品 → それも無ければモンスターidのまま(調整なし)
const friendsFaceIconOf = (baseId) => {
  const mon = ALL_PLAYER_MONSTERS[baseId];
  const faceSrc = mon ? (mon.faceIconUrl || mon.iconUrl) : null;
  if (!faceSrc) return null;
  const starters = typeof STARTER_MONSTER_IDS !== 'undefined' && Array.isArray(STARTER_MONSTER_IDS) ? STARTER_MONSTER_IDS : [];
  if (starters.includes(baseId)) return { src: faceSrc, id: baseId };
  const bare = (url) => String(url || '').split('?')[0];
  const items = (typeof BREEDER_MARKET_ITEMS !== 'undefined' && Array.isArray(BREEDER_MARKET_ITEMS) ? BREEDER_MARKET_ITEMS : [])
    .filter((entry) => entry && entry.type === 'icon');
  const byName = items.find((entry) => entry.name === `${mon.name}のアイコン`);
  if (byName) return { src: byName.icon, id: byName.id };
  const byPath = items.find((entry) => bare(entry.icon) === bare(faceSrc));
  return byPath ? { src: byPath.icon, id: byPath.id } : { src: faceSrc, id: baseId };
};
// ---- 最近いっしょに遊んだ人 / フレンドのメモ(どちらも端末だけに覚える。サーバーへは送らない) ----
const FRIEND_RECENT_KEY = 'mh_friend_recent_v1';
const FRIEND_RECENT_MAX = 30;
const FRIEND_NOTES_KEY = 'mh_friend_notes_v1';
const FRIEND_NOTE_MAX = 12;
const FRIEND_NOTES_COUNT_MAX = 200;
const friendsNormalizeRecent = (raw) => {
  const out = [];
  (Array.isArray(raw) ? raw : []).forEach((e) => {
    const id = friendsSafeId(e && e.id);
    const at = Number(e && e.at);
    if (id && !out.some((x) => x.id === id)) out.push({ id, name: String((e && e.name) || '').replace(/[\u0000-\u001f]/g, '').slice(0, 12) || '名無しのブリーダー', at: Number.isFinite(at) && at > 0 ? at : 0 });
  });
  return out.sort((a, b) => b.at - a.at).slice(0, FRIEND_RECENT_MAX);
};
// 覚えている一覧へ、いま同じ部屋にいる人を加える(新しい順・同じ人は1件・最大30人)。selfId は自分(覚えない)
const friendsMergeRecent = (existing, incoming, nowMs, selfId = '') => {
  const fresh = (Array.isArray(incoming) ? incoming : []).filter((e) => e && friendsSafeId(e.id) && e.id !== selfId).map((e) => ({ id: e.id, name: e.name, at: nowMs }));
  return friendsNormalizeRecent([...fresh, ...friendsNormalizeRecent(existing)]);
};
const friendsRememberRecent = async (incoming) => {
  try {
    const saved = friendsNormalizeRecent(await storeGet(FRIEND_RECENT_KEY, [], false));
    const next = friendsMergeRecent(saved, incoming, Date.now());
    if (JSON.stringify(next) !== JSON.stringify(saved)) await storeSet(FRIEND_RECENT_KEY, next, false);
  } catch (error) { /* 覚えられなくても、遊びには影響しない */ }
};
// フレンドごとのメモ(自分だけに見える。12文字まで)。{ ブリーダーID: メモ }。壊れていれば空へ倒す
const friendsCleanNote = (value) => String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, FRIEND_NOTE_MAX);
const friendsNormalizeNotes = (raw) => {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  Object.keys(raw).slice(0, FRIEND_NOTES_COUNT_MAX).forEach((id) => {
    const safe = friendsSafeId(id);
    const note = friendsCleanNote(raw[id]);
    if (safe && note) out[safe] = note;
  });
  return out;
};
// 招待リンク(コードを渡す): 開くとフレンド申請の確認が出る。base は今開いているページのURL(? 以降なし)
const friendsInviteLink = (base, code) => {
  const c = friendsNormalizeCode(code);
  const url = String(base || '').split('#')[0].split('?')[0];
  return c && url ? `${url}?friend=${c}` : '';
};
// いまのURLの検索部分(?friend=ABCD2345)から、フレンドコードを取り出す(無い・形が違えば空)
const friendsCodeFromSearch = (search) => {
  const m = String(search || '').match(/[?&]friend=([^&#]*)/);
  if (!m) return '';
  let raw = m[1];
  try { raw = decodeURIComponent(raw); } catch (error) { return ''; }
  return friendsNormalizeCode(raw);
};
// ---- スコア勝負: 相手の曲ごとのベストと、自分の記録を、同じ曲・同じ難易度で比べる ----
// friendSongs … 相手の records.rhythm.songs / myBest … normalizeRhythmBestRecords の形
const friendsCompareScores = (friendSongs, myBest) => (Array.isArray(friendSongs) ? friendSongs : []).map((e) => {
  const mine = myBest && myBest[e.s] && myBest[e.s][e.d] ? friendsInt(myBest[e.s][e.d].bestScore) : 0;
  const played = !!(myBest && myBest[e.s] && myBest[e.s][e.d] && myBest[e.s][e.d].played);
  const diff = mine - e.sc;
  return { ...e, mine, played, diff, result: !played ? 'none' : diff > 0 ? 'win' : diff < 0 ? 'lose' : 'draw' };
});
// ---- フレンド一覧の並べ替え・絞り込み・お気に入り(端末だけの設定。サーバーには送らない) ----
// お気に入りは新しい保存キーへ、ブリーダーIDの配列だけを覚える。壊れていても空へ倒す
const FRIEND_FAVORITES_KEY = 'mh_friend_favorites_v1';
const FRIEND_FAVORITES_MAX = 100;
const friendsNormalizeFavorites = (raw) => {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  list.forEach((id) => { const safe = friendsSafeId(id); if (safe && !out.includes(safe)) out.push(safe); });
  return out.slice(0, FRIEND_FAVORITES_MAX);
};
// 一覧に出す順に並べて返す。①お気に入り ②ログイン中 ③最近開いた順 ④名前。query(名前の一部)があれば絞り込む。
// views は friendsGroup の friends / looks は breeder_profiles / summaries は friend_profiles(どちらも無い人は空でよい)
const friendsArrangeList = ({ views, looks, summaries, favorites, query, nowMs, notes = null }) => {
  const fav = new Set(Array.isArray(favorites) ? favorites : []);
  const text = String(query == null ? '' : query).trim().toLowerCase();
  const rows = (Array.isArray(views) ? views : []).map((view) => {
    const look = (looks && looks[view.otherId]) || {};
    const sum = (summaries && summaries[view.otherId]) || null;
    const at = Math.max(sum ? sum.updatedAt || 0 : 0, look.lastSeenAt || 0);
    const seen = friendsPresenceText(sum ? sum.place : null, at, nowMs);
    const note = (notes && notes[view.otherId]) || '';
    return { view, name: look.userName || '名無しのブリーダー', note, favorite: fav.has(view.otherId), online: seen.online, seenAt: at };
  }).filter((row) => !text || row.name.toLowerCase().includes(text) || row.note.toLowerCase().includes(text));
  rows.sort((a, b) => (Number(b.favorite) - Number(a.favorite)) || (Number(b.online) - Number(a.online))
    || (b.seenAt - a.seenAt) || a.name.localeCompare(b.name, 'ja'));
  return rows;
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
// soft … friend_profiles のように「無くてもフレンドは動く」表。無いと分かっても全体は止めず、softMissing だけを付けて投げる
const friendsRequest = async (path, { method = 'GET', body = null, prefer = null, soft = false } = {}) => {
  if (_friendsUnavailable) { const e = new Error('friends tables are not ready'); e.notReady = true; throw e; }
  if (soft && _friendProfilesUnavailable) { const e = new Error('friend_profiles is not ready'); e.softMissing = true; throw e; }
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
        if (soft) { _friendProfilesUnavailable = true; const e = new Error('friend_profiles is not ready'); e.softMissing = true; throw e; }
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

// ---- フレンドに見せる情報(friend_profiles) ----
// 端末が自分で計算して、1人1行を上書きする。フレンドの画面で、フレンドにだけ見せる。
// 表がまだ無い環境(SQL未適用)でもフレンド本体は動く(softMissing を握りつぶすだけ)。
const FRIEND_PLACE_TEXT = Object.freeze({
  home: 'ホームにいます', battle: 'バトル中', rhythm: 'モンヒロビートで遊び中', multi: 'みんなで対戦中',
  masu: 'マスモンのお世話中', market: 'マーケットを見ています', other: 'ログイン中',
});
const FRIEND_HEARTBEAT_MS = 2 * 60 * 1000;   // 開いているあいだ、この間隔で「いま遊んでいる」と知らせる
const FRIEND_PUBLISH_MIN_MS = 15 * 1000;     // 場所や中身が変わっても、これより短い間隔では送らない
// 画面(gameState)から、見せる場所の大分類へ。細かい画面名や曲名は見せない
const friendsPlaceOfScreen = (gameState) => {
  const name = typeof gameState === 'string' ? gameState : '';
  if (name === 'HOME') return 'home';
  if (name === 'RHYTHM_MULTI') return 'multi';
  if (name.startsWith('RHYTHM')) return 'rhythm';
  if (name === 'BREEDER_MARKET') return 'market';
  if (/^(MASU_|MB_MANAGEMENT|PASTURE_|MONSTER_|OWNED_MONSTERS)/.test(name)) return 'masu';
  if (/^(BATTLE|PICK_|QUICK_|SKIP_|WAVE_|UPGRADE_|REWARD_|CHAMPION|DEFEAT|RETIRE|TRAINING|TEACHING|AUTO_)/.test(name)) return 'battle';
  return 'other';
};
// 「いまの場所」または「◯分前」の文。online は5分以内に知らせが来ているか
const friendsPresenceText = (place, updatedAtMs, nowMs) => {
  const online = Number.isFinite(updatedAtMs) && updatedAtMs > 0 && nowMs - updatedAtMs < FRIENDS_ONLINE_MS;
  if (online) return { online: true, text: FRIEND_PLACE_TEXT[place] || FRIEND_PLACE_TEXT.other };
  return { online: false, text: friendsLastSeenText(updatedAtMs, nowMs) };
};
// プレイ時間(ミリ秒)を「◯時間◯分」の文へ(プロフィールの表示と同じ書き方)
const friendsPlaytimeText = (seconds) => {
  const sec = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours > 0) return `${hours}時間${String(minutes).padStart(2, '0')}分`;
  return minutes > 0 ? `${minutes}分` : '1分未満';
};
const FRIEND_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
// ---- ひとこと / 記録のまとめ ----
const FRIEND_MESSAGE_MAX = 30;
// 自由入力のひとこと。制御文字を除き、空白を1つにまとめ、30文字までにする(表示は React が文字として出すので、HTMLとしては解釈されない)
const friendsCleanMessage = (value) => String(value == null ? '' : value)
  .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, FRIEND_MESSAGE_MAX);
const FRIEND_RECORD_SONG_MAX = 15;
// バトル記録の見出し(モードid → 絵文字と名前)。プロフィールの「バトル記録」と同じモードの並び
const friendsBattleModeLabels = () => {
  const modes = [...PUBLIC_BATTLE_MODES, EXTREME_MODE, SPECIES_CHALLENGE_MODE, TACTICS_MODE, TACTICS_SPECIES_MODE, TACTICS_PRO_MODE];
  return Object.fromEntries(modes.filter(Boolean).map((mode) => [mode.id, { emoji: mode.emoji || '⚔️', label: mode.label || mode.id }]));
};
const friendsInt = (value) => { const n = Math.floor(Number(value)); return Number.isFinite(n) && n > 0 ? n : 0; };
// プロフィールの「バトル記録」と同じ並び・同じ数字(代表の1つ)を、モードごとに数だけにして返す。[{ id, k:'s'(スコア)|'w'(WAVE), v }]
const friendsBattleSummary = (src) => {
  const s = src || {};
  const difficultyIds = Object.keys(DIFFICULTY_SETTINGS);
  const modes = [...PUBLIC_BATTLE_MODES, EXTREME_MODE, SPECIES_CHALLENGE_MODE,
    ...[TACTICS_MODE, TACTICS_SPECIES_MODE, TACTICS_PRO_MODE].filter((mode) => battleModePlayable(mode.id))];
  const out = [];
  modes.forEach((mode) => {
    try {
      let entry = null;
      if (isSpeciesChallengeMode(mode.id)) {
        const progress = typeof s.speciesProgressOf === 'function' ? s.speciesProgressOf(mode.id) : null;
        entry = { id: mode.id, k: 's', v: friendsInt(speciesChallengeProfileSummary(progress).bestScore) };
      } else if (isQuickMode(mode.id)) {
        entry = { id: mode.id, k: 'w', v: friendsInt(highestModeWave(s.quickHighestWaves, difficultyIds)) };
      } else {
        const tactics = isTacticsMode(mode.id);
        const scores = mode.id === EXTREME_MODE.id ? s.extremeBestScores
          : tactics ? (typeof s.tacticsHsOf === 'function' ? s.tacticsHsOf(mode.id) : {})
          : isProMode(mode.id) ? s.proHighScores : s.highScores;
        const ids = mode.id === EXTREME_MODE.id ? PUBLIC_EXTREME_DIFFICULTIES.map((item) => item.id)
          : tactics ? TACTICS_DIFFICULTY_IDS : difficultyIds;
        entry = { id: mode.id, k: 's', v: friendsInt(highestModeScore(scores, ids)) };
      }
      if (entry && entry.v > 0) out.push(entry);
    } catch (error) { /* 1モードの失敗で、ほかの記録まで送れなくならないようにする */ }
  });
  return out;
};
// モンヒロビートの曲ごとのベスト(曲ごとに、遊んだいちばん上の難易度の記録)。スコアの高い順に15曲まで。
// f … 0:なし 1:フルコンボ 2:オールエクセレント 3:オールマーベラス
const friendsRhythmSummary = (bestRecords) => {
  const songs = [];
  let played = 0;
  (typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : []).forEach((song) => {
    const byDifficulty = bestRecords && bestRecords[song.songId];
    if (!byDifficulty) return;
    let pick = null;
    RHYTHM_DIFFICULTIES.forEach(({ id }, index) => {
      const rec = byDifficulty[id];
      if (rec && rec.played) pick = { s: song.songId, d: id, sc: friendsInt(rec.bestScore), f: rec.allMarvelous ? 3 : rec.allExcellent ? 2 : rec.fullCombo ? 1 : 0, order: index };
    });
    if (pick) { played += 1; songs.push(pick); }
  });
  songs.sort((a, b) => b.sc - a.sc);
  return { played, songs: songs.slice(0, FRIEND_RECORD_SONG_MAX).map(({ order, ...rest }) => rest) };
};
// モンヒロビートの難易度別の実績。公開中の曲のうち、その難易度の譜面がある曲を分母に数える。
// 返す形: [{ d:難易度id, total:分母, clear, fc, ae, am }]。フルコンボ以上は上位の称号も数に含める(AM ⊂ AE ⊂ FC)
const friendsRhythmAchievements = (bestRecords) => {
  const songs = rhythmDemoSongs(RHYTHM_SONGS);
  const list = rhythmDemoDifficultyList(RHYTHM_DIFFICULTIES);
  return list.map(({ id }) => {
    const row = { d: id, total: 0, clear: 0, fc: 0, ae: 0, am: 0 };
    songs.forEach((song) => {
      if (!rhythmDemoDifficulties(song, RHYTHM_DIFFICULTIES).some((x) => x.id === id)) return;
      row.total += 1;
      const rec = bestRecords && bestRecords[song.songId] && bestRecords[song.songId][id];
      if (!rec) return;
      const am = rec.allMarvelous === true, ae = am || rec.allExcellent === true, fc = ae || rec.fullCombo === true;
      if (rec.clear === true || fc) row.clear += 1;
      if (fc) row.fc += 1;
      if (ae) row.ae += 1;
      if (am) row.am += 1;
    });
    return row;
  }).filter((row) => row.total > 0);
};
// 持っているもの・図鑑の進み(数だけ)
const friendsCollectionSummary = ({ masuMons, unlockedMonsterIds, ownedIconIds, ownedFrameIds }) => {
  const list = (Array.isArray(masuMons) ? masuMons : []).filter((m) => m && ALL_PLAYER_MONSTERS[m.baseId]);
  return {
    masu: list.length,
    dex: (Array.isArray(unlockedMonsterIds) ? unlockedMonsterIds : []).filter((id) => ALL_PLAYER_MONSTERS[id]).length,
    dexTotal: Object.keys(ALL_PLAYER_MONSTERS).length,
    transcended: list.filter((m) => m.transcended).length,
    reincarnated: list.filter((m) => friendsInt(m.reincarnateCount) > 0).length,
    icons: Array.isArray(ownedIconIds) ? ownedIconIds.length : 0,
    frames: Array.isArray(ownedFrameIds) ? ownedFrameIds.length : 0,
  };
};
// 送る記録のまとめ全体(サーバーの records 列へ入るJSON)
const friendsBuildRecords = (src) => ({
  v: 1,
  battle: friendsBattleSummary(src),
  rhythm: { ...friendsRhythmSummary(src && src.rhythmBest), ach: friendsRhythmAchievements(src && src.rhythmBest).map((r) => [r.d, r.total, r.clear, r.fc, r.ae, r.am]) },
  collection: friendsCollectionSummary(src || {}),
});
// 受け取った実績を整える。[難易度id, 分母, クリア, FC, AE, AM] の並び。分母を超える数は分母へ丸める
const friendsNormalizeAchievements = (raw) => (Array.isArray(raw) ? raw : []).map((e) => {
  if (!Array.isArray(e) || typeof e[0] !== 'string') return null;
  const total = Math.min(friendsInt(e[1]), 999);
  const n = (v) => Math.min(friendsInt(v), total);
  return { d: e[0].slice(0, 20), total, clear: n(e[2]), fc: n(e[3]), ae: n(e[4]), am: n(e[5]) };
}).filter((r) => r && r.total > 0).slice(0, 8);
// 受け取った records を、安全な形へ整える(型を確かめ、ありえない値は捨てる。未知のモード・曲は読まない)
const friendsNormalizeRecords = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const battle = (Array.isArray(raw.battle) ? raw.battle : []).map((e) => (e && typeof e.id === 'string' && (e.k === 's' || e.k === 'w') && friendsInt(e.v) > 0)
    ? { id: e.id.slice(0, 40), k: e.k, v: friendsInt(e.v) } : null).filter(Boolean).slice(0, 20);
  const songsRaw = raw.rhythm && Array.isArray(raw.rhythm.songs) ? raw.rhythm.songs : [];
  const songs = songsRaw.map((e) => (e && typeof e.s === 'string' && typeof e.d === 'string')
    ? { s: e.s.slice(0, 80), d: e.d.slice(0, 20), sc: friendsInt(e.sc), f: [0, 1, 2, 3].includes(e.f) ? e.f : 0 } : null).filter(Boolean).slice(0, FRIEND_RECORD_SONG_MAX);
  const c = raw.collection && typeof raw.collection === 'object' ? raw.collection : {};
  return {
    battle,
    rhythm: { played: friendsInt(raw.rhythm && raw.rhythm.played), songs, ach: friendsNormalizeAchievements(raw.rhythm && raw.rhythm.ach) },
    collection: { masu: friendsInt(c.masu), dex: friendsInt(c.dex), dexTotal: friendsInt(c.dexTotal), transcended: friendsInt(c.transcended),
      reincarnated: friendsInt(c.reincarnated), icons: friendsInt(c.icons), frames: friendsInt(c.frames) },
  };
};
// 端末の持ち物から、フレンドに見せる情報を作る(書く内容はここで決まる)
//  masuMons … 手持ちのマスモン / favoriteMasuId … 「好きなモンスター」に選んだ個体のid / playtime … normalizePlaytime の形
const friendsBuildSummary = ({ place, masuMons, favoriteMasuId, playtime, message = '', records = null }) => {
  let bestBond = 0, bestBondMon = '', bestPower = 0, bestPowerMon = '', favorite = null;
  (Array.isArray(masuMons) ? masuMons : []).forEach((masu) => {
    try {
      if (!masu || !ALL_PLAYER_MONSTERS[masu.baseId]) return;
      const level = masuBondLevelInfo(masu).level;
      const power = Math.round(Number(masuPowerOf(masu)) || 0);
      if (Number.isFinite(level) && level > bestBond) { bestBond = level; bestBondMon = masu.baseId; }
      if (power > bestPower) { bestPower = power; bestPowerMon = masu.baseId; }
      if (favoriteMasuId != null && String(masu.id) === String(favoriteMasuId)) {
        const colors = rankingPartyColors(masu.baseId, getMasuColors(masu));
        favorite = {
          monsterId: masu.baseId, name: ALL_PLAYER_MONSTERS[masu.baseId].name || null, bondLevel: level, power,
          detail: rankingMasuDetail(masu), ...(colors.some(Boolean) ? { colors } : {}),
        };
      }
    } catch (error) { /* 壊れた1体のために、ほかの情報まで送れなくならないようにする */ }
  });
  const span = playtime && typeof playtime === 'object' ? playtime : {};
  const totalMs = Number(span.totalMs);
  return {
    place: Object.prototype.hasOwnProperty.call(FRIEND_PLACE_TEXT, place) ? place : 'other',
    startedOn: (typeof span.since === 'string' && FRIEND_DAY_RE.test(span.since)) ? span.since : null,
    playSeconds: Number.isFinite(totalMs) && totalMs >= 0 ? Math.floor(totalMs / 1000) : null,
    bestBond: bestBond > 0 ? bestBond : null, bestBondMon: bestBondMon || null,
    bestPower: bestPower > 0 ? bestPower : null, bestPowerMon: bestPowerMon || null,
    favorite,
    message: friendsCleanMessage(message) || null,
    records: records && typeof records === 'object' ? records : null,
  };
};
// 自分の分を上書きする。失敗しても進行は止めない(呼ぶ側は結果を見なくてよい)
const sbUpsertFriendProfile = async (breederIdRaw, summary) => {
  const id = friendsSafeId(breederIdRaw);
  if (!id || !summary) return false;
  const base = {
    breeder_id: id, place: summary.place, started_on: summary.startedOn, play_seconds: summary.playSeconds,
    best_bond: summary.bestBond, best_bond_mon: summary.bestBondMon, best_power: summary.bestPower,
    best_power_mon: summary.bestPowerMon, favorite: summary.favorite,
  };
  const send = (row) => friendsRequest('friend_profiles?on_conflict=breeder_id', {
    method: 'POST', soft: true, prefer: 'resolution=merge-duplicates,return=minimal', body: [row] });
  try {
    // message / records の列がまだ無い環境(SQL未適用)では、その2つを外して送る。ほかの情報は今までどおり届く
    if (_friendProfileExtraUnavailable) await send(base);
    else {
      try { await send({ ...base, message: summary.message, records: summary.records }); }
      catch (error) {
        if (error && error.status === 400 && /message|records/i.test(String(error.message)) && /column|PGRST204/i.test(String(error.message))) {
          _friendProfileExtraUnavailable = true;
          await send(base);
        } else throw error;
      }
    }
    return true;
  } catch (error) {
    if (!(error && (error.softMissing || error.notReady))) console.error('[friends]', error && error.message ? error.message : error);
    return false;
  }
};
// フレンドたちの「見せる情報」を読む。表が無い・通信できないときは空(その場合、画面は名前と見た目だけを出す)
const sbFetchFriendSummaries = async (ids) => {
  const safe = Array.from(new Set((Array.isArray(ids) ? ids : []).map(friendsSafeId).filter(Boolean))).slice(0, 100);
  const byId = {};
  if (!safe.length) return byId;
  try {
    const baseCols = 'breeder_id,place,started_on,play_seconds,best_bond,best_bond_mon,best_power,best_power_mon,favorite,updated_at';
    const fetchRows = (cols) => friendsRequest(`friend_profiles?select=${cols}&breeder_id=in.(${safe.join(',')})`, { soft: true });
    let rows;
    if (_friendProfileExtraUnavailable) rows = await fetchRows(baseCols);
    else {
      try { rows = await fetchRows(`${baseCols},message,records`); }
      catch (error) {
        if (error && error.status === 400 && /message|records/i.test(String(error.message)) && /column|PGRST/i.test(String(error.message))) {
          _friendProfileExtraUnavailable = true;
          rows = await fetchRows(baseCols);
        } else throw error;
      }
    }
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row || typeof row.breeder_id !== 'string') return;
      const at = Date.parse(row.updated_at);
      const num = (value) => (Number.isFinite(Number(value)) && value !== null ? Number(value) : null);
      const fav = row.favorite && typeof row.favorite === 'object' && !Array.isArray(row.favorite) && typeof row.favorite.monsterId === 'string' ? row.favorite : null;
      byId[row.breeder_id] = {
        place: Object.prototype.hasOwnProperty.call(FRIEND_PLACE_TEXT, row.place) ? row.place : null,
        startedOn: (typeof row.started_on === 'string' && FRIEND_DAY_RE.test(row.started_on)) ? row.started_on : null,
        playSeconds: num(row.play_seconds),
        bestBond: num(row.best_bond), bestBondMon: typeof row.best_bond_mon === 'string' ? row.best_bond_mon : null,
        bestPower: num(row.best_power), bestPowerMon: typeof row.best_power_mon === 'string' ? row.best_power_mon : null,
        favorite: fav, updatedAt: Number.isFinite(at) ? at : 0,
        message: friendsCleanMessage(row.message), records: friendsNormalizeRecords(row.records),
      };
    });
  } catch (error) {
    if (!(error && (error.softMissing || error.notReady))) console.error('[friends]', error && error.message ? error.message : error);
  }
  return byId;
};
// 届いている申請の件数(HOME・プロフィールのバッジ用)。通信できない・準備中は 0
const sbCountIncomingFriendRequests = async (breederIdRaw) => {
  const id = friendsSafeId(breederIdRaw);
  if (!id) return { count: 0, names: [] };
  try {
    const rows = await sbFetchFriendLinks(id);
    const incoming = friendsGroup(id, rows).incoming;
    if (!incoming.length) return { count: 0, names: [] };
    const looks = await sbFetchFriendProfiles(incoming.slice(0, 3).map((view) => view.otherId));
    return { count: incoming.length, names: incoming.slice(0, 3).map((view) => (looks[view.otherId] || {}).userName || '名無しのブリーダー'), ids: incoming.map((view) => view.otherId) };
  } catch (error) {
    return { count: 0, names: [] };
  }
};
