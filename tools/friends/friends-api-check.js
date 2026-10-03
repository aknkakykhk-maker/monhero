// フレンドの通信層(34-friends-api.jsx)の「申請の状態の動き」を確かめる検査。
//
// 本物のサーバーへは一度もつながない。PostgREST のごく一部(絞り込み・POST・PATCH)を
// 真似た小さな偽サーバーを fetch の代わりに差し込み、2人のあいだで
// 申請 → 承認 → 解除 → 再申請 → ブロック … と進めて、行の状態がSQLの約束どおりに動くかを見る。
//   ・1組は1行まで(逆向きの申請は、新しい行ではなく既存の行を承認に変える)
//   ・行は消えない(DELETE を一度も使わない)。解除・断りは status を変えるだけ
//   ・ブロックされた側には何も見えず、申請も通らない
//   ・フレンドの上限と、ありえない形のIDの扱い
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS_DIR = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero/src/parts/34-friends-api.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- 偽サーバー(friend_codes / friend_links / breeder_profiles) ----
const { createFakeFriendsServer, pairKey } = require('./fake-friends-server');
const fake = createFakeFriendsServer();
const { db, calls, tick } = fake;
const fakeFetch = fake.fetch;

// ---- 通信層を読み込む(本体の他の定義は最小限の置き物にする) ----
const sandbox = {
  console, fetch: fakeFetch, URL, AbortController, setTimeout, clearTimeout, Date, Math, JSON, Object, Array, Number, String, Set,
  SUPABASE_URL: 'https://example.supabase.co',
  SB_HEADERS: { apikey: 'test' },
  _isMissingTableError: (status, body) => status === 404 && /PGRST205/.test(String(body || '')),
  normalizeProfileFrameId: (value) => (typeof value === 'string' && value ? value : 'none'),
  sbFetchRhythmTotalRankings: async () => [],
  rhythmTotalRankingEntryFromRow: (row) => row,
  // マスモンまわりの置き物(絆Lv=経験値の十の位、総合力=attack、詳細は名前だけ)
  ALL_PLAYER_MONSTERS: { Mocchi: { name: 'モッチー' }, Pixie: { name: 'ピクシー' } },
  masuBondLevelInfo: (masu) => ({ level: masu.lv }),
  masuPowerOf: (masu) => masu.power,
  rankingPartyColors: () => [], getMasuColors: () => [],
  rankingMasuDetail: (masu) => ({ v: 6, n: masu.baseId }),
};
vm.createContext(sandbox);
vm.runInContext(`${source}\n;globalThis.__api = { friendsMakeCode, friendsNormalizeCode, friendsFormatCode, friendsSafeId, friendLinkView, friendsGroup, friendsLastSeenText, friendsIdOfRankingEntry,
  sbEnsureFriendCode, sbFindBreederIdByCode, sbFetchFriendLinks, sbFetchFriendProfiles, sbSendFriendRequest, sbRespondFriendRequest, sbCancelFriendRequest,
  sbRemoveFriend, sbBlockFriendUser, sbUnblockFriendUser, sbSendRoomInvite, sbFetchRoomInvites, sbFetchFriendRoster, friendsPlaceOfScreen, friendsPresenceText, friendsPlaytimeText, friendsBuildSummary, friendsArrangeList, friendsNormalizeFavorites, sbUpsertFriendProfile, sbFetchFriendSummaries, sbCountIncomingFriendRequests, FRIEND_INVITE_TTL_MS, FRIENDS_MAX, FRIENDS_PENDING_MAX, friendsUnavailable };`, sandbox);
const api = sandbox.__api;

const statusOf = (a, b) => {
  const rows = db.friend_links.filter((r) => pairKey(r.requester_id, r.target_id) === pairKey(a, b));
  return rows.length === 0 ? 'none' : rows.length === 1 ? rows[0].status : `DUP(${rows.length})`;
};

(async () => {
  // ---- コード ----
  const code = api.friendsMakeCode();
  check('フレンドコードは8文字で、まぎらわしい文字を含まない', /^[A-HJ-NP-Z2-9]{8}$/.test(code), code);
  check('入力の小文字・ハイフン・空白を許す', api.friendsNormalizeCode(' abcd-2345 ') === 'ABCD2345');
  check('7文字や使えない文字だけのコードは空になる', api.friendsNormalizeCode('ABC1234') === '' && api.friendsNormalizeCode('0O1I0O1I') === '');
  check('表示用に4文字ずつ区切る', api.friendsFormatCode('ABCD2345') === 'ABCD-2345');
  check('IDに区切り文字を含むものは通さない(絞り込みの注入を防ぐ)',
    api.friendsSafeId('a,b') === '' && api.friendsSafeId('a)or(x') === '' && api.friendsSafeId('') === '' && api.friendsSafeId('ab-12_cd') === 'ab-12_cd');
  check('ランキングの行: breederId を優先し、name: の古い記録は申請の相手にならない',
    api.friendsIdOfRankingEntry({ breederId: 'xyz' }) === 'xyz'
    && api.friendsIdOfRankingEntry({ identityKey: 'name:たろう' }) === ''
    && api.friendsIdOfRankingEntry({ identityKey: 'uuid-1' }) === 'uuid-1'
    && api.friendsIdOfRankingEntry({}) === '');

  // ---- 自分のコード ----
  const codeA = await api.sbEnsureFriendCode('userA');
  check('自分のコードを作って登録できる', /^[A-HJ-NP-Z2-9]{8}$/.test(codeA) && db.friend_codes.length === 1);
  check('2回目は同じコードを返し、行も増えない', await api.sbEnsureFriendCode('userA') === codeA && db.friend_codes.length === 1);
  const codeB = await api.sbEnsureFriendCode('userB');
  check('コードから相手のIDを引ける', await api.sbFindBreederIdByCode(codeB) === 'userB' && await api.sbFindBreederIdByCode('AAAA2222') === null);
  // コードが重なったとき(409)は作り直して登録できる
  const realRandom = Math.random;
  const collide = db.friend_codes[0].friend_code;
  const seq = collide.split('').map((ch) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.indexOf(ch) / 32 + 0.001);
  let n = 0; Math.random = () => (n < 8 ? seq[n++] : realRandom());   // 最初の1回だけ、既にあるコードと同じ並びを出す
  const codeC = await api.sbEnsureFriendCode('userC');
  Math.random = realRandom;
  check('コードが他の人と重なっても、作り直して別のコードで登録できる', !!codeC && codeC !== collide && db.friend_codes.length === 3, `${codeC}`);

  // ---- 申請 → 承認 ----
  check('自分自身には申請できない', await api.sbSendFriendRequest('userA', 'userA') === 'self');
  check('形のおかしいIDは通信せずに失敗する', await api.sbSendFriendRequest('userA', 'a,b') === 'error');
  check('AからBへ申請できる', await api.sbSendFriendRequest('userA', 'userB') === 'sent' && statusOf('userA', 'userB') === 'pending');
  check('同じ申請を重ねても行は増えない', await api.sbSendFriendRequest('userA', 'userB') === 'pending' && db.friend_links.length === 1);
  const linksB = await api.sbFetchFriendLinks('userB');
  const groupsB = api.friendsGroup('userB', linksB);
  check('Bの「届いた申請」にAが出る', groupsB.incoming.length === 1 && groupsB.incoming[0].otherId === 'userA' && groupsB.friends.length === 0);
  check('Aの「送った申請」にBが出る', api.friendsGroup('userA', await api.sbFetchFriendLinks('userA')).outgoing.length === 1);
  check('申請した本人は、自分の申請を承認できない', await api.sbRespondFriendRequest('userA', 'userB', 'accept') === 'gone' && statusOf('userA', 'userB') === 'pending');
  check('Bが承認するとフレンドになる', await api.sbRespondFriendRequest('userB', 'userA', 'accept') === 'accepted' && statusOf('userA', 'userB') === 'accepted');
  check('すでにフレンドなら「already」', await api.sbSendFriendRequest('userA', 'userB') === 'already' && await api.sbSendFriendRequest('userB', 'userA') === 'already');
  check('どちらの一覧にもフレンドとして出る',
    api.friendsGroup('userA', await api.sbFetchFriendLinks('userA')).friends[0].otherId === 'userB'
    && api.friendsGroup('userB', await api.sbFetchFriendLinks('userB')).friends[0].otherId === 'userA');

  // ---- 解除 → 再申請 ----
  check('解除すると status が removed になり、行は残る', await api.sbRemoveFriend('userA', 'userB') === 'removed' && statusOf('userA', 'userB') === 'removed' && db.friend_links.length === 1);
  check('解除後はどちらの一覧にも出ない', api.friendsGroup('userA', await api.sbFetchFriendLinks('userA')).friends.length === 0);
  check('解除した相手へ、向きを変えて再申請できる(行は1つのまま)',
    await api.sbSendFriendRequest('userB', 'userA') === 'sent' && statusOf('userA', 'userB') === 'pending' && db.friend_links.length === 1
    && db.friend_links[0].requester_id === 'userB');

  // ---- 逆向きの申請があるとき: 申請 = 承認 ----
  check('相手から申請が来ているときに自分も申請すると、そのまま成立する',
    await api.sbSendFriendRequest('userA', 'userB') === 'accepted' && statusOf('userA', 'userB') === 'accepted');

  // ---- 断る・取り消す ----
  await api.sbSendFriendRequest('userA', 'userC');
  check('断ると declined になる', await api.sbRespondFriendRequest('userC', 'userA', 'decline') === 'declined' && statusOf('userA', 'userC') === 'declined');
  check('断られた側は、理由が分からない形で再申請できない', await api.sbSendFriendRequest('userA', 'userC') === 'unavailable');
  check('断った側からは申請できる(行は1つのまま)', await api.sbSendFriendRequest('userC', 'userA') === 'sent' && statusOf('userA', 'userC') === 'pending');
  check('申請の取り消しは申請した本人だけができる', await api.sbCancelFriendRequest('userA', 'userC') === 'gone' && await api.sbCancelFriendRequest('userC', 'userA') === 'cancelled' && statusOf('userA', 'userC') === 'removed');

  // ---- ブロック ----
  await api.sbSendFriendRequest('userA', 'userC');
  check('届いた申請をブロックできる', await api.sbRespondFriendRequest('userC', 'userA', 'block') === 'blocked'
    && statusOf('userA', 'userC') === 'blocked' && db.friend_links.find((r) => pairKey(r.requester_id, r.target_id) === pairKey('userA', 'userC')).blocked_by === 'userC');
  check('ブロックされた側には、その人が何も見えない', api.friendsGroup('userA', await api.sbFetchFriendLinks('userA')).blocked.length === 0
    && api.friendsGroup('userA', await api.sbFetchFriendLinks('userA')).outgoing.length === 0);
  check('ブロックされた側の申請は通らない', await api.sbSendFriendRequest('userA', 'userC') === 'unavailable');
  check('ブロックした本人には「ブロック中」に出る', api.friendsGroup('userC', await api.sbFetchFriendLinks('userC')).blocked.length === 1);
  check('ブロックした本人が申請するには、先に解除が要る', await api.sbSendFriendRequest('userC', 'userA') === 'blocked-by-me');
  check('ブロックしたのは本人だけが解除できる', await api.sbUnblockFriendUser('userA', 'userC') === 'gone' && await api.sbUnblockFriendUser('userC', 'userA') === 'unblocked' && statusOf('userA', 'userC') === 'removed');
  check('フレンドをブロックすると、フレンドではなくなる', await api.sbBlockFriendUser('userA', 'userB') === 'blocked' && statusOf('userA', 'userB') === 'blocked'
    && api.friendsGroup('userB', await api.sbFetchFriendLinks('userB')).friends.length === 0);
  check('関係の無い相手も、先にブロックできる(行が新しくできる)', await api.sbBlockFriendUser('userA', 'userZ') === 'blocked' && statusOf('userA', 'userZ') === 'blocked');

  // ---- 上限 ----
  for (let i = 0; i < api.FRIENDS_MAX; i += 1) {
    db.friend_links.push({ requester_id: 'userFull', target_id: `f${i}`, status: 'accepted', blocked_by: null, created_at: tick(), updated_at: tick() });
  }
  check('フレンドが上限なら申請できない', await api.sbSendFriendRequest('userFull', 'userNew') === 'full');
  db.friend_links.push({ requester_id: 'userNew', target_id: 'userFull', status: 'pending', blocked_by: null, created_at: tick(), updated_at: tick() });
  check('上限のとき、届いた申請の承認もできない', await api.sbRespondFriendRequest('userFull', 'userNew', 'accept') === 'full');
  const origLinks = db.friend_links.slice();
  db.friend_links.length = 0;
  for (let i = 0; i < api.FRIENDS_PENDING_MAX; i += 1) db.friend_links.push({ requester_id: 'userBusy', target_id: `p${i}`, status: 'pending', blocked_by: null, created_at: tick(), updated_at: tick() });
  check('申請中が多すぎると送れない', await api.sbSendFriendRequest('userBusy', 'userNew') === 'limit');
  db.friend_links.length = 0; origLinks.forEach((r) => db.friend_links.push(r));

  // ---- マルチへの招待 ----
  // ここまでで userA と userC は解除済み。userD を新しいフレンドにして試す
  await api.sbSendFriendRequest('userA', 'userD');
  await api.sbRespondFriendRequest('userD', 'userA', 'accept');
  db.breeder_profiles.push({ breeder_id: 'userD', user_name: 'ディー', icon: null, profile_frame: null, updated_at: tick() });
  const roster = await api.sbFetchFriendRoster('userA');
  check('招待の相手を選ぶ名簿に、承認済みのフレンドだけが出る', roster.length === 1 && roster[0].otherId === 'userD' && roster[0].userName === 'ディー',
    JSON.stringify(roster.map((r) => r.otherId)));
  check('部屋コードの形が違う招待は送らない', await api.sbSendRoomInvite('userA', 'userD', 'ab1') === 'error' && db.friend_invites.length === 0
    && await api.sbSendRoomInvite('userA', 'userA', 'AB23') === 'error');
  check('招待を送れる(小文字の部屋コードも大文字にそろえる)', await api.sbSendRoomInvite('userA', 'userD', 'ab23') === 'invited' && db.friend_invites.length === 1 && db.friend_invites[0].room_code === 'AB23');
  const invites = await api.sbFetchRoomInvites('userD', Date.now());
  check('招待された側に届く', invites.length === 1 && invites[0].senderId === 'userA' && invites[0].roomCode === 'AB23');
  check('招待していない人には届かない', (await api.sbFetchRoomInvites('userB', Date.now())).length === 0);
  await api.sbSendRoomInvite('userA', 'userD', 'CD45');
  const again = await api.sbFetchRoomInvites('userD', Date.now());
  check('同じ2人の招待は1行に上書きされ、新しい部屋コードになる', db.friend_invites.length === 1 && again.length === 1 && again[0].roomCode === 'CD45');
  check('3分より古い招待は届かない', (await api.sbFetchRoomInvites('userD', Date.now() + api.FRIEND_INVITE_TTL_MS + 10 * 60 * 1000)).length === 0);

  // ---- フレンドに見せる情報 ----
  check('画面から場所の大分類を引ける', api.friendsPlaceOfScreen('HOME') === 'home' && api.friendsPlaceOfScreen('RHYTHM_MULTI') === 'multi'
    && api.friendsPlaceOfScreen('RHYTHM_PLAY') === 'rhythm' && api.friendsPlaceOfScreen('BATTLE') === 'battle' && api.friendsPlaceOfScreen('BATTLE_MENU') === 'battle'
    && api.friendsPlaceOfScreen('MASU_ENHANCE') === 'masu' && api.friendsPlaceOfScreen('BREEDER_MARKET') === 'market'
    && api.friendsPlaceOfScreen('PROFILE') === 'other' && api.friendsPlaceOfScreen(undefined) === 'other');
  const t0 = 1700000000000;
  check('5分以内なら「いまの場所」、それより前なら「◯分前」', api.friendsPresenceText('rhythm', t0 - 60 * 1000, t0).online === true
    && api.friendsPresenceText('rhythm', t0 - 60 * 1000, t0).text === 'モンヒロビートで遊び中'
    && api.friendsPresenceText(null, t0 - 60 * 1000, t0).text === 'ログイン中'
    && api.friendsPresenceText('home', t0 - 20 * 60 * 1000, t0).online === false
    && api.friendsPresenceText('home', t0 - 20 * 60 * 1000, t0).text === '20分前に開きました');
  check('プレイ時間の文', api.friendsPlaytimeText(3 * 3600 + 5 * 60) === '3時間05分' && api.friendsPlaytimeText(90) === '1分' && api.friendsPlaytimeText(10) === '1分未満');
  const summary = api.friendsBuildSummary({
    place: 'battle', favoriteMasuId: 22, playtime: { totalMs: 7200000, since: '2026-09-01' },
    masuMons: [{ id: 11, baseId: 'Mocchi', lv: 8, power: 1200 }, { id: 22, baseId: 'Pixie', lv: 15, power: 900 }, { id: 33, baseId: 'Unknown', lv: 99, power: 99999 }, null],
  });
  check('最高絆Lvと最高総合力を、別々の子から選べる(知らない種類は数えない)', summary.bestBond === 15 && summary.bestBondMon === 'Pixie' && summary.bestPower === 1200 && summary.bestPowerMon === 'Mocchi');
  check('好きなモンスターの詳細が入る', summary.favorite && summary.favorite.monsterId === 'Pixie' && summary.favorite.bondLevel === 15 && summary.favorite.power === 900 && summary.favorite.detail.v === 6);
  check('遊びはじめとプレイ時間(秒)が入る', summary.startedOn === '2026-09-01' && summary.playSeconds === 7200 && summary.place === 'battle');
  const empty = api.friendsBuildSummary({ place: 'zzz', masuMons: [], favoriteMasuId: null, playtime: { totalMs: 'x', since: '昨日' } });
  check('壊れた値・空の持ち物でも落ちず、空欄へ倒れる', empty.place === 'other' && empty.startedOn === null && empty.playSeconds === null && empty.bestBond === null && empty.favorite === null);
  check('自分の分を送れる(1人1行のまま上書きされる)', await api.sbUpsertFriendProfile('userA', summary) === true
    && await api.sbUpsertFriendProfile('userA', { ...summary, place: 'home' }) === true && db.friend_profiles.length === 1 && db.friend_profiles[0].place === 'home');
  const sums = await api.sbFetchFriendSummaries(['userA', 'userB', 'a,b']);
  check('フレンドの情報を読める(無い人は含まれない)', sums.userA && sums.userA.bestBond === 15 && sums.userA.favorite.monsterId === 'Pixie' && !sums.userB && sums.userA.updatedAt > 0
    && sums.userA.startedOn === '2026-09-01' && sums.userA.playSeconds === 7200);
  check('知らない場所の値は送っても弾かれ、落ちない', await api.sbUpsertFriendProfile('userA', { ...summary, place: 'nowhere' }) === false && db.friend_profiles[0].place === 'home');
  // 届いている申請の件数
  await api.sbSendFriendRequest('userE', 'userA');
  const inc = await api.sbCountIncomingFriendRequests('userA');
  check('届いている申請の件数と相手の名前が分かる', inc.count === 1 && inc.ids[0] === 'userE' && inc.names.length === 1, JSON.stringify(inc));
  check('申請が無い人は0件', (await api.sbCountIncomingFriendRequests('userZZ')).count === 0);

  // ---- 全体の約束 ----
  check('どこにも DELETE を使っていない(行は消えない)', calls.deletes === 0 && !calls.methods.includes('DELETE'));
  check('1組が2行になったことは一度もない', (() => {
    const seen = new Set();
    return db.friend_links.every((r) => { const k = pairKey(r.requester_id, r.target_id); if (seen.has(k)) return false; seen.add(k); return true; });
  })());

  // ---- 一覧の並べ替え・絞り込み・お気に入り ----
  const tNow = 1700000000000;
  const mk = (id, name, agoMs, place) => ({ id, name, look: { userName: name, lastSeenAt: tNow - agoMs }, sum: place ? { place, updatedAt: tNow - agoMs } : null });
  const arrPeople = [mk('a', 'あおい', 3 * 3600 * 1000, null), mk('b', 'いちか', 60 * 1000, 'battle'), mk('c', 'うみ', 20 * 60 * 1000, null), mk('d', 'えり', 2 * 60 * 1000, 'home'), mk('e', 'おとは', 10 * 3600 * 1000, null)];
  const arrViews = arrPeople.map((p) => ({ otherId: p.id, status: 'accepted', outgoing: true, blockedByMe: false, updatedAt: 1 }));
  const arrLooks = Object.fromEntries(arrPeople.map((p) => [p.id, p.look]));
  const arrSums = Object.fromEntries(arrPeople.filter((p) => p.sum).map((p) => [p.id, p.sum]));
  const order = (extra) => api.friendsArrangeList({ views: arrViews, looks: arrLooks, summaries: arrSums, favorites: [], query: '', nowMs: tNow, ...(extra || {}) }).map((r) => r.view.otherId).join('');
  check('お気に入りが無ければ、ログイン中(新しい順)→最近開いた順', order() === 'bdcae', order());
  check('お気に入りは、ログイン中でなくても一番上に並ぶ', order({ favorites: ['e'] }) === 'ebdca' && order({ favorites: ['e', 'a'] }) === 'aebdc', order({ favorites: ['e', 'a'] }));
  check('名前の一部で絞り込める(大文字小文字は問わない)', order({ query: 'い' }) === 'ba' && order({ query: 'ZZZ' }) === '' && order({ query: '  う ' }) === 'c', order({ query: 'い' }));
  check('ログイン中の判定は5分以内', api.friendsArrangeList({ views: arrViews, looks: arrLooks, summaries: arrSums, favorites: [], query: '', nowMs: tNow }).filter((r) => r.online).length === 2);
  check('お気に入りの保存値は、壊れていても空へ倒れ、重複・不正なIDは除く', JSON.stringify(api.friendsNormalizeFavorites(['x', 'x', 'a,b', 5, null, 'y'])) === '["x","y"]'
    && api.friendsNormalizeFavorites('zzz').length === 0 && api.friendsNormalizeFavorites(null).length === 0
    && api.friendsNormalizeFavorites(Array.from({ length: 300 }, (_, i) => `id${i}`)).length === 100);

  // ---- friend_profiles だけが無い環境(第2弾のSQLが未適用) ----
  delete db.friend_profiles;
  check('friend_profiles だけ無くても、送信は静かに失敗し、フレンド全体は止まらない',
    await api.sbUpsertFriendProfile('userA', summary) === false && api.friendsUnavailable() === false
    && Object.keys(await api.sbFetchFriendSummaries(['userA'])).length === 0
    && await api.sbSendFriendRequest('userA', 'userF') === 'sent');

  // ---- 表が無い環境 ----
  const saved = { ...db };
  delete db.friend_links;
  let notReady = false;
  const result = await api.sbSendFriendRequest('userA', 'userB');
  notReady = result === 'notready';
  check('表が無い環境では「準備中(notready)」になり、例外を投げない', notReady && api.friendsUnavailable() === true);
  check('一度準備中と分かったら、以後は通信しない', await api.sbSendFriendRequest('userA', 'userB') === 'notready');

  // ---- 見た目の文言 ----
  const now = 1700000000000 + 10 * 24 * 3600 * 1000;
  check('最後に開いた時刻の文', api.friendsLastSeenText(now - 60 * 1000, now) === 'いま遊んでいるかも'
    && api.friendsLastSeenText(now - 30 * 60 * 1000, now) === '30分前に開きました'
    && api.friendsLastSeenText(now - 5 * 3600 * 1000, now) === '5時間前に開きました'
    && api.friendsLastSeenText(now - 3 * 24 * 3600 * 1000, now) === '3日前に開きました'
    && api.friendsLastSeenText(0, now).includes('不明'));

  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
