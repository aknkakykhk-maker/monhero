// 助手ライフ: フレンドの家との行き来(56-assistant-life-friend.jsx)の決まりを確かめる。ブラウザもサーバーも使わない。
//   node tools/assistant/assistant-life-friend-check.js
// 設計 docs/progress/assistant-peer/FRIEND-VISIT-PLAN.md。担当: 助手部オトズレ
//   ① 控えの正規化: 知らない id・種類・長い値を捨てる/壊れた控えは null
//   ② 1日の上限: 助手が行くのは on 3回・thin 1回/同じ家1日1回/1回に1〜2人/来るのは on 2人・thin 0人/プレイヤーが訪ねるのは on 3軒・thin 1軒
//   ③ 寝ている・けんか中(言い合いのあと)・距離をおいている助手は行かない/深夜は行かない/切・off のときは行かない
//   ④ 朝4時の区切りで今日の数が戻る(行き先・写真・見た置き手紙は残る)
//   ⑤ 保存: 新しいキーだけ。古い形・壊れた値でも既定値で読める/既存の mh_* に書かない
//   ⑥ 表が無い(404 PGRST205)ときは「準備中」にして、それ以後は通信しない。フレンドの通信の印(_friendsUnavailable)は立てない
//   ⑦ 台本: 8人ぶんがそろう/助手・マスモンを「子」と呼ばない/みゅあは「じゃん」「まじ」を使わない/あつの文の最後は笑・記号・顔文字/{name}・{f}・{h}・{v} 以外の穴が無い
//   ⑧ 公開の印 assistantLifeFriend が偽なら通信しない(2026-11-08 公開で真にした)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const mem = {};
const writes = [];
const calls = [];
let fakeServer = null; // (url, init) => { status, body }
const flags = { assistantPeer: true, assistantLife: true, assistantLifeFriend: true };
let dayNow = '2026-11-08';
const ctx = vm.createContext({
  console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Promise, RegExp, Infinity, AbortController, setTimeout, clearTimeout, encodeURIComponent,
  React: { useState: (v) => [v, () => {}], useEffect: () => {}, useRef: (v) => ({ current: v }), useCallback: (f) => f },
  storeGet: async (k, d) => (k in mem ? JSON.parse(JSON.stringify(mem[k])) : d),
  storeSet: (k, v) => { writes.push(k); mem[k] = JSON.parse(JSON.stringify(v)); },
  RELEASE_FLAGS: flags,
  SUPABASE_URL: 'https://example.supabase.co', SB_HEADERS: { apikey: 'test', 'Content-Type': 'application/json' },
  _isMissingTableError: (status, body) => status === 404 && /PGRST205/.test(String(body || '')),
  fetch: async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET' });
    const r = fakeServer ? fakeServer(String(url), init) : { status: 200, body: '[]' };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, statusText: '', text: async () => r.body, json: async () => JSON.parse(r.body) };
  },
  ensureBreederId: async () => 'self-0001',
  sbFetchFriendRoster: async () => [{ otherId: 'aoi-0001', userName: 'あおい' }, { otherId: 'yuto-0001', userName: 'ゆうと' }],
  __day: () => dayNow,
});
const load = (rel) => {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const code = rel.endsWith('.jsx') ? babel.transformSync(src, { presets: [require.resolve('@babel/preset-react')], babelrc: false, configFile: false }).code : src;
  vm.runInContext(code, ctx);
};
load('monster-hero/data/assistants.js');
vm.runInContext('var assistantBubbleDayKey = () => __day(); var assistantPeerDayKey = () => __day(); var jstDayKey4 = () => __day(); var assistantById = (id) => ASSISTANTS.find(a => a.id === id); var AssistantFace = () => null;', ctx);
load('monster-hero/src/parts/56-assistant-peer.jsx');
load('monster-hero/src/parts/56-assistant-life.jsx');
load('monster-hero/src/parts/56-assistant-life-house.jsx');
load('monster-hero/src/parts/56-assistant-life-rel.jsx');
load('monster-hero/src/parts/56-assistant-life-friend.jsx');
const G = (expr) => vm.runInContext(expr, ctx);
const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];

// ① 控えの正規化
{
  const norm = G('assistantLifeFriendNormalizeHouse');
  const h = norm({ ids: ['mua', 'kiki', 'evil<script>', 'dra', 'mua'], r: { mua: { at: 'home', d: 'snack', m: 'happy' }, kiki: { at: 'space', d: 'hack', m: 'xx' }, dra: { at: 'out', d: 'walk', m: 'eager', text: 'ひどい文' } }, msg: '自由な文' });
  check('① 知らない id は捨てる・同じ id は1つ', JSON.stringify(h.ids) === JSON.stringify(['mua', 'kiki', 'dra']), JSON.stringify(h.ids));
  check('① 知らない種類は既定に戻す(家にいる・のんびり・ごきげん)', h.r.kiki.at === 'home' && h.r.kiki.d === 'idle' && h.r.kiki.m === 'happy', JSON.stringify(h.r.kiki));
  check('① 控えの中の文は残さない', !JSON.stringify(h).includes('ひどい文') && !JSON.stringify(h).includes('自由な文'));
  check('① 長すぎる控え・形の違う控えは null', norm({ ids: ['mua'], pad: 'x'.repeat(2100) }) === null && norm([1, 2]) === null && norm('abc') === null && norm(null) === null);
  const mine = G('alfBuildHouse')({ abs: 5, moods: { mua: 'happy', kiki: 'sleepy' }, groups: [], solo: { mua: { doing: 'snack', place: 'home' }, kiki: { doing: 'read', place: 'library' } } }, ['mua', 'kiki', 'nobody']);
  check('① 自分の控えは小さい(id と種類の記号だけ・2,000字以内)', JSON.stringify(mine).length < 2000 && mine.r.kiki.at === 'out' && !mine.ids.includes('nobody'), JSON.stringify(mine));
}

// ② ③ 行き来の決め方(純粋な関数)
{
  const pick = G('assistantLifeFriendPickOuting');
  const st0 = G('alfDefaultState')();
  const settings = G('normalizeAssistantLifeFriendSettings')(null);
  const house = { v: 1, ids: ['dra', 'mua'], r: { dra: { at: 'home', d: 'idle', m: 'happy' }, mua: { at: 'home', d: 'snack', m: 'happy' } } };
  const houses = [{ id: 'aoi-0001', name: 'あおい', house }, { id: 'yuto-0001', name: 'ゆうと', house }];
  const lifeOf = (solo, slot = 'noon') => ({ slot, solo, groups: [], moods: {} });
  const allHome = Object.fromEntries(IDS.map(id => [id, { doing: 'idle', place: 'home', reason: 'mypace' }]));
  let got = 0; let maxPeople = 0; let anyHosts = new Set();
  for (let abs = 0; abs < 400; abs++) {
    const p = pick({ life: lifeOf(allHome), ids: IDS, houses, st: st0, settings, mode: 'on', abs, salt: 's' });
    if (p) { got++; maxPeople = Math.max(maxPeople, p.ids.length); anyHosts.add(p.host); if (!p.ids.every(id => IDS.includes(id))) maxPeople = 99; }
  }
  check('② 手の空いた助手は、ときどき行く(毎回ではない)', got > 20 && got < 300, `${got}/400`);
  check('② 1回に1〜2人', maxPeople >= 1 && maxPeople <= 2, `${maxPeople}`);
  const full = (mode) => pick({ life: lifeOf(allHome), ids: IDS, houses, st: { ...st0, go: mode === 'on' ? 3 : 1 }, settings, mode, abs: 7, salt: 's' });
  let blockedAll = true; for (let abs = 0; abs < 200; abs++) if (pick({ life: lifeOf(allHome), ids: IDS, houses, st: { ...st0, go: 3 }, settings, mode: 'on', abs, salt: 's' })) blockedAll = false;
  check('② on は1日3回まで', blockedAll && full('on') === null);
  let thinBlocked = true; for (let abs = 0; abs < 200; abs++) if (pick({ life: lifeOf(allHome), ids: IDS, houses, st: { ...st0, go: 1 }, settings, mode: 'thin', abs, salt: 's' })) thinBlocked = false;
  check('② thin は1日1回まで', thinBlocked);
  let sameHouse = false; for (let abs = 0; abs < 200; abs++) { const p = pick({ life: lifeOf(allHome), ids: IDS, houses, st: { ...st0, went: { 'aoi-0001': 1 } }, settings, mode: 'on', abs, salt: 's' }); if (p && p.host === 'aoi-0001') sameHouse = true; }
  check('② 同じ家へは1日1回', !sameHouse);
  const sleepy = Object.fromEntries(IDS.map(id => [id, { doing: 'sleep', place: 'home', reason: 'mypace' }]));
  const away = Object.fromEntries(IDS.map(id => [id, { doing: 'walk', place: 'plaza', reason: 'mypace' }]));
  const distance = Object.fromEntries(IDS.map(id => [id, { doing: 'idle', place: 'home', reason: 'distance' }]));
  let bad = []; let quarrelGo = false; let lateGo = false; let offGo = false; let closedGo = false;
  for (let abs = 0; abs < 300; abs++) {
    for (const [name, solo] of [['寝ている', sleepy], ['出かけている', away], ['距離をおいている', distance]]) if (pick({ life: lifeOf(solo), ids: IDS, houses, st: st0, settings, mode: 'on', abs, salt: 's' })) bad.push(name);
    const p = pick({ life: lifeOf(allHome), ids: IDS, houses, st: st0, settings, mode: 'on', pendingIds: ['mua', 'kiki'], abs, salt: 's' });
    if (p && p.ids.some(id => id === 'mua' || id === 'kiki')) quarrelGo = true;
    if (pick({ life: lifeOf(allHome, 'late'), ids: IDS, houses, st: st0, settings, mode: 'on', abs, salt: 's' })) lateGo = true;
    if (pick({ life: lifeOf(allHome), ids: IDS, houses, st: st0, settings, mode: 'off', abs, salt: 's' })) offGo = true;
    if (pick({ life: lifeOf(allHome), ids: IDS, houses, st: st0, settings: { ...settings, open: false }, mode: 'on', abs, salt: 's' })) closedGo = true;
  }
  check('③ 寝ている・出かけている・距離をおいている助手は行かない', !bad.length, [...new Set(bad)].join('・'));
  check('③ けんか中(assistantLifeRelPending)の助手は行かない', !quarrelGo);
  check('③ 深夜は行かない/off・行き来を切にしているときは行かない', !lateGo && !offGo && !closedGo, `深夜${lateGo} off${offGo} 切${closedGo}`);
  let mutedGo = false; for (let abs = 0; abs < 200; abs++) { const p = pick({ life: lifeOf(allHome), ids: IDS, houses, st: st0, settings: { ...settings, muted: ['aoi-0001'] }, mode: 'on', abs, salt: 's' }); if (p && p.host === 'aoi-0001') mutedGo = true; }
  check('③ 来ないようにした家へは行かない', !mutedGo);
  // 来る
  const come = G('assistantLifeFriendPickCome');
  let comeGot = 0; let comeThin = false; let comeMax = false; let comeSame = false;
  for (let i = 0; i < 200; i++) {
    const seed = `x${i}`;
    if (come({ houses, st: st0, settings, mode: 'on', myHome: ['kiki'], seed })) comeGot++;
    if (come({ houses, st: st0, settings, mode: 'thin', myHome: ['kiki'], seed })) comeThin = true;
    if (come({ houses, st: { ...st0, come: 2 }, settings, mode: 'on', myHome: ['kiki'], seed })) comeMax = true;
    const p = come({ houses, st: { ...st0, come: 1, came: [{ host: 'aoi-0001' }] }, settings, mode: 'on', myHome: ['kiki'], seed });
    if (p && p.host === 'aoi-0001') comeSame = true;
  }
  check('② フレンドの助手は、ときどき自分で来る', comeGot > 10 && comeGot < 200, `${comeGot}/200`);
  check('② 来るのは on で1日2人まで・thin では来ない・同じ家から1日1人', !comeThin && !comeMax && !comeSame, `thin${comeThin} 3人目${comeMax} 同じ家${comeSame}`);
}

// ④ 朝4時の区切り/⑤ 保存
{
  const roll = G('alfRollDay');
  const st = { ...G('alfDefaultState')(), day: '2026-11-07', go: 3, come: 2, look: 3, beatP: 300, went: { 'aoi-0001': 1 }, looked: { 'aoi-0001': 1 }, seen: [5, 6],
    photos: [{ host: 'aoi-0001', name: 'あおい', day: '2026-11-07', ids: ['mua'], theirs: [] }], came: [{ host: 'aoi-0001', name: 'あおい', aid: 'dra', mine: 'kiki', seen: true }] };
  const next = roll(st, '2026-11-08');
  check('④ 日が変わると今日の数・行った家・おみやげのPが戻る', next.go === 0 && next.come === 0 && next.look === 0 && next.beatP === 0 && !Object.keys(next.went).length && !Object.keys(next.looked).length && !next.came.length);
  check('④ 写真と見た置き手紙は残る・前の日に行った家を覚える(同じ家ばかりにしない)', next.photos.length === 1 && next.seen.length === 2 && next.lastHosts.includes('aoi-0001'));
  check('④ 同じ日なら何も変えない', roll(next, '2026-11-08') === next);
  check('④ 日の区切りは助手ライフと同じ(assistantLifeDayKey)', G('alfDay')(Date.now()) === G('assistantLifeDayKey')(Date.now()));
  const n = G('normalizeAssistantLifeFriend');
  const broken = [null, 'x', 42, [], { go: 'abc', went: 'zz', out: { ids: ['mua'], host: 'bad host!' }, photos: 'p', came: [{ host: 'a', aid: 'nobody' }] }];
  check('⑤ 壊れた値でも既定値で読める', broken.every(v => { const o = n(v); return o.go === 0 && o.out === null && Array.isArray(o.photos) && Array.isArray(o.came) && !o.came.length; }));
  const s = G('normalizeAssistantLifeFriendSettings');
  check('⑤ 設定は無ければ「入」・来ないようにした家は100軒まで', s(null).open && s(null).show && s(null).come && s({ muted: Array.from({ length: 150 }, (_, i) => `u${i}`) }).muted.length === 100 && s({ open: false }).open === false);
  const k = G('normalizeAssistantLifeFriendKnown');
  check('⑤ 顔なじみは正しい形の組だけ', JSON.stringify(k({ 'mua|aoi-0001|dra': 3, 'bad': 2, 'mua|aoi-0001|nobody': 1, 'kiki|aoi-0001|dra': -1 })) === JSON.stringify({ 'mua|aoi-0001|dra': 3 }));
}

// ⑥ 通信: 表が無いとき・ふつうのとき
(async () => {
  const ALF = () => G('ALF_STORE');
  await G('ALF_STORE.load()');
  // 表が無い環境
  fakeServer = () => ({ status: 404, body: '{"code":"PGRST205","message":"Could not find the table"}' });
  calls.length = 0;
  const mode = await G('alfLoadMode()');
  const life = { abs: 10, slot: 'noon', salt: 's', moods: {}, groups: [], solo: Object.fromEntries(IDS.map(id => [id, { doing: 'idle', place: 'home', reason: 'mypace' }])) };
  await G('assistantLifeFriendOnSlot')(life, { abs: 10 });
  await G('assistantLifeFriendOnOpen')(life);
  const after = calls.length;
  await G('alfFetchHouses(true)'); await G('alfFetchVisits(true)'); await G('assistantLifeFriendOnSlot')(life, { abs: 11 });
  check('⑥ 表が無いときは off(出さない)・準備中にする', mode === 'off' && ALF().state.ready === false);
  check('⑥ 準備中になったあとは通信しない', calls.length === after && after <= 1, `${after}回 → ${calls.length}回`);
  check('⑥ フレンドの通信の印は立てない(フレンドの画面は止まらない)', G('typeof _friendsUnavailable === "undefined" ? true : _friendsUnavailable === false'));
  check('⑤ 既存の mh_* に書かない(新しいキーだけ)', writes.every(k => k.startsWith('mh_assistant_life_friend_') || ['mh_assistant_life_v1', 'mh_assistant_life_diary_v1'].includes(k)), [...new Set(writes)].join(', '));

  // ふつうの環境(偽サーバー): スイッチ on・控え2軒・行き来は入る
  const fresh = new Date().toISOString();
  vm.runInContext('_alfUnavailable = false; _alfModeLoading = null; _alfRosterAt = 0; _alfHousesAt = 0; _alfHousesDay = null; _alfHousesMax = null; _alfVisitsAt = 0; ALF_STORE.set({ mode: null, ready: true });', ctx);
  const posted = [];
  fakeServer = (url, init) => {
    if (url.includes('assistant_life_friend_switch')) return { status: 200, body: '[{"mode":"on"}]' };
    if (url.includes('assistant_life_friend_houses') && (init.method || 'GET') === 'GET') return { status: 200, body: JSON.stringify([
      { breeder_id: 'aoi-0001', open: true, updated_at: fresh, house: { v: 1, ids: ['dra', 'mua'], r: { dra: { at: 'home', d: 'idle', m: 'happy' }, mua: { at: 'home', d: 'snack', m: 'happy' } } } },
      { breeder_id: 'yuto-0001', open: false, updated_at: fresh, house: { v: 1, ids: ['kiki'], r: { kiki: { at: 'home', d: 'idle', m: 'happy' } } } }]) };
    if (url.includes('assistant_life_friend_visits') && init.method === 'POST') { posted.push(JSON.parse(init.body)); return { status: 201, body: '' }; }
    return { status: 200, body: init.method === 'GET' || !init.method ? '[]' : '' };
  };
  calls.length = 0;
  const m2 = await G('alfLoadMode()');
  await G('alfFetchHouses(true)');
  const open = G('alfOpenHouses("look")');
  check('⑥ スイッチ on を読む・切にしている家は一覧に出さない', m2 === 'on' && open.length === 1 && open[0].id === 'aoi-0001', open.map(h => h.id).join(','));
  const houseCall = calls.find(c => c.url.includes('assistant_life_friend_houses'));
  check('⑥ 控えはフレンドの分だけまとめて1回で読む(breeder_id=in.)', houseCall && /breeder_id=in\./.test(houseCall.url));
  calls.length = 0; await G('alfFetchHouses()');
  check('⑥ 30分は読み直さない', !calls.some(c => c.url.includes('assistant_life_friend_houses')));
  calls.length = 0; await G('alfFetchHouses(true)');
  check('⑥ 読み直すときは前のあとで変わった家だけ(updated_at=gt.)', calls.some(c => /updated_at=gt\./.test(c.url)));
  // プレイヤーが訪ねる: 1日3軒(on)・同じ家1回
  // 本番の失敗(2026-11-08): 自分の控えが一度も送られていないまま訪ねると、表に断られた。置き手紙の前に必ず控えを送る
  G('alfSaveSt')({ ...G('alfToday()'), sentAt: 0, sentSig: '' });
  calls.length = 0;
  const r1 = await G('assistantLifeFriendLeaveNote("aoi-0001", { word: 1, talked: ["dra", "evil"], name: "あおい" })');
  const order = calls.filter(c => c.method === 'POST').map(c => (/houses/.test(c.url) ? 'house' : /visits/.test(c.url) ? 'visit' : 'x'));
  check('② 置き手紙の前に、自分の家の控えを先に送る(一度も送っていなくても)', order[0] === 'house' && order.includes('visit'), order.join(','));
  const r2 = await G('assistantLifeFriendLeaveNote("aoi-0001", { word: 2, talked: ["dra"], name: "あおい" })');
  const pl = posted.filter(p => p.kind === 'player');
  check('② プレイヤーが訪ねると置き手紙(player・話した助手だけ・一言の番号)を同じ家へは1日1回だけ残す', r1 && r1.ok && r2 && !r2.ok && /もう置き手紙/.test(r2.reason) && pl.length === 1 && JSON.stringify(pl[0].assistants) === '["dra"]' && pl[0].word === 1, JSON.stringify(pl));
  { const t = G('alfRefusalText');
    check('② 断られた理由を分かる文にする(切・上限・フレンドでない・お休み・重なり)', /切/.test(t({ body: '行き来を切にしています' })) && /朝4時/.test(t({ body: '今日はもう行けません' })) && /フレンドではなく/.test(t({ body: 'フレンドではありません' })) && /お休み/.test(t({ body: '行き来はいま止めています' })) && /もう置き手紙/.test(t({ status: 409, body: '' }))); }
  check('② 初めての家なら写真1枚', r1 && r1.photo === true && G('ALF_STORE.state.st.photos.length') === 1);
  check('② ビートPはギフトの渡し口が無いと0(勝手に増えない)', r1 && r1.beatP === 0);
  // ギフトの渡し口: 1日300Pまで
  const gifts = [];
  G('assistantLifeFriendSetGiftSender')(async (g) => { if (gifts.some(x => x.id === g.id)) return false; gifts.push(g); return true; });
  const st = G('alfToday()');
  G('alfSaveSt')({ ...st, beatP: 250 });
  const got = await G('alfGiveBeatP')('go', 'alf_go_test', G('alfToday()'));
  check('② おみやげのビートPは1日300Pまで(250Pのあとは50P)', got === 50 && gifts[0].rewards[0].amount === 50);
  const got2 = await G('alfGiveBeatP')('go', 'alf_go_test2', { ...G('alfToday()'), beatP: 300 });
  check('② 300Pに届いたら届けない', got2 === 0 && gifts.length === 1);
  // 控えを送る: 同じなら送らない
  G('alfSaveSt')({ ...G('alfToday()'), sentAt: 0, sentSig: '' });
  calls.length = 0;
  await G('alfPublish')(life, IDS, Date.now());
  const sent1 = calls.filter(c => c.url.includes('assistant_life_friend_houses') && c.method === 'POST').length;
  await G('alfPublish')(life, IDS, Date.now() + 20 * 60000);
  const sent2 = calls.filter(c => c.url.includes('assistant_life_friend_houses') && c.method === 'POST').length;
  check('⑥ 自分の控えを送る・中身が同じなら送り直さない', sent1 === 1 && sent2 === 1, `${sent1}・${sent2}`);

  // ⑦ 台本
  const sets = ['ALF_GO_LINES', 'ALF_REPLY_LINES', 'ALF_SAME_LINES', 'ALF_BACK_LINES', 'ALF_GUEST_LINES', 'ALF_WELCOME_LINES', 'ALF_TALK_LINES'];
  const all = [];
  for (const k of sets) { const t = G(k); const miss = IDS.filter(id => !t[id] || (Array.isArray(t[id]) && !t[id].length)); check(`⑦ ${k} に8人ぶんある`, !miss.length, miss.join(',')); for (const id of IDS) for (const line of [].concat(t[id] || [])) all.push({ id, line }); }
  check('⑦ 助手・マスモンを「子」と呼ばない', !all.some(x => /(この|あの|その|うちの|いい|かわいい)子(?!ども)|子たち/.test(x.line)), all.filter(x => /子たち|(この|あの|その)子/.test(x.line)).map(x => x.line).join(' / '));
  check('⑦ みゅあは「じゃん」「まじ」を使わない', !all.some(x => x.id === 'mua' && /じゃん|まじ/.test(x.line)));
  check('⑦ あつの文の最後は 笑・記号・顔文字', all.filter(x => x.id === 'atsu').every(x => /(笑|[！？!?…♪])$|\)$/.test(x.line.trim())), all.filter(x => x.id === 'atsu' && !/(笑|[！？!?…♪])$/.test(x.line.trim())).map(x => x.line).join(' / '));
  check('⑦ ドラは関西弁にしない', !all.some(x => x.id === 'dra' && /ほんま|やで|とる|とんだ/.test(x.line)));
  check('⑦ ききはタメ口にしない', !all.some(x => x.id === 'kiki' && /(だよ|だね|してよ)/.test(x.line)));
  const holes = all.flatMap(x => (x.line.match(/\{[^}]*\}/g) || [])).filter(h => !['{name}', '{f}', '{h}', '{v}'].includes(h));
  check('⑦ 穴は {name}・{f}・{h}・{v} だけ', !holes.length, [...new Set(holes)].join(','));
  check('⑦ 置き手紙の一言12・お礼6', G('ALF_WORD_TEXTS.length') === 12 && G('ALF_THANKS_TEXTS.length') === 6);
  const scene = G('assistantLifeFriendGoScene')({ ids: ['mua', 'dra'], theirs: ['mua'], name: 'あおい', host: 'aoi-0001' });
  check('⑦ 場面は2〜4行・同じ助手どうしが会うと「もうひとりの」', scene.lines.length >= 2 && scene.lines.length <= 4 && scene.lines.some(l => /もうひとり/.test(l.text)), scene.lines.map(l => l.text).join(' / '));
  check('⑦ 相手の助手は「あおいさんのみゅあ」の形で出す', G('alfTheirLabel')('あおい', 'mua') === 'あおいさんのみゅあ');

  // ⑨ Claude API の場面(friend_scenes): thin では頼まない・印が偽なら頼まない・作った文は穴を差しこむ・使えない文は台本へ
  vm.runInContext('var ASSISTANT_CHAT_URL = "https://example.supabase.co/functions/v1/assistant-chat";', ctx);
  flags.assistantLifeFriendApi = true;
  let asked = [];
  const base = fakeServer;
  fakeServer = (url, init) => {
    if (url.includes('functions/v1/assistant-chat')) { asked.push(JSON.parse(init.body)); return { status: 200, body: JSON.stringify({ ok: true, kind: 'friend_scenes', scenes: [
      { kind: 'go', a: 'mua', b: 'dra', lines: [{ side: 'a', e: 'happy', t: '{f}、来たよ♪ {h}さんの家まぢかわいい！' }, { side: 'b', e: 'happy', t: '{f}、よく来たな。{name}によろしくな' }] },
      { kind: 'go', a: 'kiki', b: 'dra', lines: [{ side: 'a', e: 'happy', t: '{bad}' }, { side: 'b', e: 'happy', t: 'はい' }] }] }) }; }
    return base(url, init);
  };
  const lifeApi = { ...life, solo: { ...life.solo } };
  G('ALF_STORE').set({ mode: 'thin' });
  asked = []; await G('assistantLifeFriendRequestScenes')(lifeApi);
  check('⑨ スイッチが thin のときは API を頼まない(台本だけ)', asked.length === 0);
  G('ALF_STORE').set({ mode: 'on' });
  G('alfSaveSt')({ ...G('alfToday()'), api: null });
  asked = []; const res = await G('assistantLifeFriendRequestScenes')(lifeApi);
  check('⑨ on のときは1回だけ頼み、送るのは組の id とブリーダーIDだけ(呼び名を送らない)', res === 'ok' && asked.length === 1 && !JSON.stringify(asked[0]).includes('あおい') && asked[0].kind === 'friend_scenes', JSON.stringify(asked[0]).slice(0, 200));
  check('⑨ 穴の崩れた場面は控えに残さない', G('ALF_STORE.state.st.api.list.length') === 1);
  asked = []; await G('assistantLifeFriendRequestScenes')(lifeApi);
  check('⑨ 使っていない場面があるあいだは頼み直さない', asked.length === 0);
  const sc = G('assistantLifeFriendGoScene')({ ids: ['mua'], theirs: ['dra'], name: 'あおい', host: 'aoi-0001' });
  check('⑨ 作った場面を使い、{f}・{h}・{name} を端末で差しこむ', sc.lines[0].text === 'あおいさんのドラ、来たよ♪ あおいさんの家まぢかわいい！' && sc.lines[1].guest && sc.lines[1].text.startsWith('みゅあ、') && !/[{}]/.test(sc.lines.map(l => l.text).join('')), sc.lines.map(l => l.text).join(' / '));
  const sc2 = G('assistantLifeFriendGoScene')({ ids: ['mua'], theirs: ['dra'], name: 'あおい', host: 'aoi-0001' });
  check('⑨ 同じ組の作った場面は1回だけ(2回目は台本)', sc2.lines[0].text !== sc.lines[0].text && sc2.lines[1].text === 'おやつ、半分こしような', sc2.lines.map(l => l.text).join(' / '));
  { const ok = G('alfApiLineOk');
    check('⑨ 作った文の口調: みゅあの「じゃん/まじ」は「ぢゃん/まぢ」へ', ok('mua', 'それ椅子あつかいじゃん、まじで') === 'それ椅子あつかいぢゃん、まぢで');
    check('⑨ 作った文の口調: 体に触れる言葉・あつの文末・ドラの関西弁・ききのタメ口・ほかの助手の「ぢゃん」は使わない',
      ok('dra', 'おでの膝、いまならあいてるぞ') === null && ok('atsu', 'いらっしゃい') === null && ok('atsu', 'いらっしゃい笑') === 'いらっしゃい笑'
      && ok('dra', 'ほんまによう来たな') === null && ok('kiki', '来てくれてうれしいよ。また遊ぼうだね') === null && ok('momosuke', 'かわいいぢゃん') === null && ok('kiki', 'いらっしゃいませ♪') === 'いらっしゃいませ♪'); }
  flags.assistantLifeFriendApi = false;
  G('alfSaveSt')({ ...G('alfToday()'), api: null });
  asked = []; await G('assistantLifeFriendRequestScenes')(lifeApi);
  check('⑨ 印 assistantLifeFriendApi が偽なら頼まない', asked.length === 0 && /\n\s*assistantLifeFriendApi:\s*(true|false),/.test(fs.readFileSync(path.join(root, 'monster-hero/src/parts/17-release-changelog-login-missions.jsx'), 'utf8')));
  fakeServer = base;

  // ⑧ 公開の印
  const rel = fs.readFileSync(path.join(root, 'monster-hero/src/parts/17-release-changelog-login-missions.jsx'), 'utf8');
  check('⑧ 公開の印 assistantLifeFriend がある(真/偽どちらでも、偽なら通信しないことを下で見る)', /\n\s*assistantLifeFriend:\s*(true|false),/.test(rel));
  flags.assistantLifeFriend = false;
  calls.length = 0;
  await G('assistantLifeFriendOnSlot')(life, { abs: 30 });
  check('⑧ 印が偽なら通信しない', calls.length === 0);

  console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
