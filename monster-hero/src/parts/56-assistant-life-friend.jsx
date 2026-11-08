// ===== 助手ライフ: フレンドの家との行き来(2026-11-08 社長・助手部オトズレ) =====
// 設計 docs/progress/assistant-peer/FRIEND-VISIT-PLAN.md / 引き継ぎ FRIEND-VISIT-BUILD.md
//   助手が自分でときどきフレンドの家(控え)へ遊びに行く(go)/フレンドの助手が自分で遊びに来る(come)/
//   プレイヤー自身もフレンドの家(控え)へ遊びに行く(look)。
// 公開の印 RELEASE_FLAGS.assistantLifeFriend(既定は偽)。助手ライフ(assistantLife)の後ろ。
// 保存は新しいキーだけ(既存の mh_* は読むだけ):
//   mh_assistant_life_friend_v1           今日の回数・行った家・おみやげのP・行き先・来ている助手・写真
//   mh_assistant_life_friend_settings_v1  行き来する(入/切)・家を見せる・来てもらう・来ないようにした家
//   mh_assistant_life_friend_known_v1     顔なじみの回数
//   mh_assistant_life_friend_intro_v1     はじめての案内を見たか
// 表(Supabase): assistant_life_friend_switch / _houses / _visits(docs/sql/assistant-life/FRIEND_VISIT_APPLY.sql)
// ★相手の端末・保存には何も書かない。表に残すのは自分がしたことだけ。
// ★画面に出す文はこの台本だけ。控え(相手が送ったもの)からは id と種類の記号しか使わない。自由な文は無い。
// ★フレンドの通信(friendsRequest)は表が無いとフレンド全体を止めるので、ここは専用の通信と「準備中」の印を持つ。

const ALF_KEY = 'mh_assistant_life_friend_v1';
const ALF_SETTINGS_KEY = 'mh_assistant_life_friend_settings_v1';
const ALF_KNOWN_KEY = 'mh_assistant_life_friend_known_v1';
const ALF_INTRO_KEY = 'mh_assistant_life_friend_intro_v1';
const ALF_TABLE_SWITCH = 'assistant_life_friend_switch';
const ALF_TABLE_HOUSES = 'assistant_life_friend_houses';
const ALF_TABLE_VISITS = 'assistant_life_friend_visits';
const ALF_IDS = (typeof ASSISTANT_LIFE_HOUSE_ORDER !== 'undefined' ? ASSISTANT_LIFE_HOUSE_ORDER : ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin']);
// 1日の上限(朝4時の区切り)。thin=間引く(送り出し量が分かるまでの最初の形)
const ALF_LIMITS = Object.freeze({
  on:   Object.freeze({ go: 3, come: 2, look: 3, readMs: 30 * 60000, sendMs: 10 * 60000 }),
  thin: Object.freeze({ go: 1, come: 0, look: 1, readMs: 30 * 60000, sendMs: 60 * 60000 }),
});
const ALF_BEAT_P = Object.freeze({ go: 100, look: 50, dayMax: 300 });
const ALF_FRESH_DAYS = Object.freeze({ go: 14, look: 14, come: 7 });
const ALF_HOUSE_MAX_CHARS = 2000;
const ALF_WORDS = 12;  // 置き手紙の決まった一言の数(番号 0〜11)
const ALF_THANKS = 6;  // お礼の決まった一言の数(番号 0〜5)

const alfEnabled = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantLifeFriend === true
  && typeof assistantLifeEnabled === 'function' && assistantLifeEnabled();
const alfValidId = (id) => typeof id === 'string' && ALF_IDS.includes(id);
const alfSafeOther = (v) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v) ? v : null);
const alfInt = (v, lo, hi, d = 0) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const alfStr = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const alfDay = (now = Date.now()) => (typeof assistantLifeDayKey === 'function' ? assistantLifeDayKey(now) : new Date(Number(now) + 5 * 3600000).toISOString().slice(0, 10));
const alfDayShift = (day, n) => { const t = Date.parse(`${day}T00:00:00Z`); return Number.isFinite(t) ? new Date(t + n * 86400000).toISOString().slice(0, 10) : day; };

// ---------- 保存の正規化(無い・壊れているときは既定値) ----------
const alfDefaultState = () => ({ day: null, go: 0, come: 0, look: 0, went: {}, looked: {}, beatP: 0, seen: [], sentAt: 0, sentSig: '', out: null, back: null, came: [], photos: [], lastHosts: [], api: null });
const alfNormalizeOut = (o) => {
  if (!o || typeof o !== 'object') return null;
  const ids = Array.isArray(o.ids) ? [...new Set(o.ids.filter(alfValidId))].slice(0, 2) : [];
  const host = alfSafeOther(o.host);
  if (!ids.length || !host || !Number.isFinite(o.abs)) return null;
  const theirs = Array.isArray(o.theirs) ? [...new Set(o.theirs.filter(alfValidId))].slice(0, 3) : [];
  return { abs: Math.floor(o.abs), ids, host, name: alfStr(o.name, 20) || 'フレンド', theirs, word: alfInt(o.word, 0, ALF_WORDS - 1), day: typeof o.day === 'string' ? o.day.slice(0, 10) : null,
    seen: o.seen === true, rewarded: o.rewarded === true };
};
// Claude API で作った場面(その日の分だけ)。{ day, asked, list: [{ kind, a, b, lines: [{ side, e, t }] }], used: [key] }
const alfNormalizeApi = (o) => {
  if (!o || typeof o !== 'object' || typeof o.day !== 'string') return null;
  const okLine = (l) => l && (l.side === 'a' || l.side === 'b') && typeof l.t === 'string' && l.t.length >= 2 && l.t.length <= 60 && !/[{}]/.test(l.t.replace(/\{f\}|\{h\}|\{name\}/g, ''));
  const list = Array.isArray(o.list) ? o.list.map(x => (x && (x.kind === 'go' || x.kind === 'come') && alfValidId(x.a) && alfValidId(x.b) && Array.isArray(x.lines) && x.lines.length >= 2 && x.lines.every(okLine)
    ? { kind: x.kind, a: x.a, b: x.b, lines: x.lines.slice(0, 4).map(l => ({ side: l.side, e: typeof l.e === 'string' ? l.e.slice(0, 12) : 'normal', t: l.t })) } : null)).filter(Boolean).slice(0, 6) : [];
  return { day: o.day.slice(0, 10), asked: alfInt(o.asked, 0, 9), list, used: Array.isArray(o.used) ? o.used.filter(k => typeof k === 'string').slice(-12) : [] };
};
const normalizeAssistantLifeFriend = (v) => {
  const d = alfDefaultState();
  if (!v || typeof v !== 'object') return d;
  const flags = (x) => { const o = {}; if (x && typeof x === 'object') for (const [k, val] of Object.entries(x)) if (alfSafeOther(k) && val) o[k] = 1; return o; };
  const came = Array.isArray(v.came) ? v.came.map(c => (c && alfSafeOther(c.host) && alfValidId(c.aid) ? { host: c.host, name: alfStr(c.name, 20) || 'フレンド', aid: c.aid, mine: alfValidId(c.mine) ? c.mine : null, seen: c.seen === true } : null)).filter(Boolean).slice(0, 2) : [];
  const photos = Array.isArray(v.photos) ? v.photos.map(p => (p && alfSafeOther(p.host) && typeof p.day === 'string' ? { host: p.host, name: alfStr(p.name, 20) || 'フレンド', day: p.day.slice(0, 10), ids: Array.isArray(p.ids) ? p.ids.filter(alfValidId).slice(0, 2) : [], theirs: Array.isArray(p.theirs) ? p.theirs.filter(alfValidId).slice(0, 3) : [] } : null)).filter(Boolean).slice(-60) : [];
  return {
    day: typeof v.day === 'string' ? v.day.slice(0, 10) : null,
    go: alfInt(v.go, 0, 99), come: alfInt(v.come, 0, 99), look: alfInt(v.look, 0, 99),
    went: flags(v.went), looked: flags(v.looked),
    beatP: alfInt(v.beatP, 0, ALF_BEAT_P.dayMax),
    seen: Array.isArray(v.seen) ? v.seen.filter(n => Number.isFinite(n)).slice(-200) : [],
    sentAt: Number.isFinite(v.sentAt) ? v.sentAt : 0, sentSig: alfStr(v.sentSig, 64),
    out: alfNormalizeOut(v.out), back: alfNormalizeOut(v.back), came, photos,
    lastHosts: Array.isArray(v.lastHosts) ? v.lastHosts.filter(alfSafeOther).slice(0, 10) : [],
    api: alfNormalizeApi(v.api),
  };
};
const normalizeAssistantLifeFriendSettings = (v) => {
  const o = v && typeof v === 'object' ? v : {};
  return { open: o.open !== false, show: o.show !== false, come: o.come !== false,
    muted: Array.isArray(o.muted) ? [...new Set(o.muted.filter(alfSafeOther))].slice(0, 100) : [],
    // 置き手紙の自由文(2026-11-08 社長): 見る(既定は入)・この人の自由文は見ない
    noteShow: o.noteShow !== false, noteOff: Array.isArray(o.noteOff) ? [...new Set(o.noteOff.filter(alfSafeOther))].slice(0, 100) : [],
    // 最近の遊びをフレンドに見せる(2026-11-08 社長 既定は入)
    act: o.act !== false };
};
const normalizeAssistantLifeFriendKnown = (v) => {
  const o = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, n] of Object.entries(v).slice(-300)) {
      const p = k.split('|');
      if (p.length === 3 && alfValidId(p[0]) && alfSafeOther(p[1]) && alfValidId(p[2]) && Number.isFinite(n) && n > 0) o[k] = Math.min(9999, Math.floor(n));
    }
  }
  return o;
};
// 日が変わったら今日の数を戻す(行き先・写真・見た置き手紙は残す)
const alfRollDay = (st, day) => {
  if (st.day === day) return st;
  return { ...st, day, go: 0, come: 0, look: 0, went: {}, looked: {}, beatP: 0, came: [], api: null, lastHosts: Object.keys(st.went || {}).slice(0, 10) };
};

// ---------- 家の控え ----------
// 自分の家の控え(会った助手・部屋の様子の種類だけ)。名前や文は入れない
const alfBuildHouse = (life, metIds) => {
  const ids = [...new Set((metIds || []).filter(alfValidId))].slice(0, 12);
  const r = {};
  for (const id of ids) {
    const w = typeof assistantLifeWhereOf === 'function' ? assistantLifeWhereOf(life, id) : null;
    if (!w) continue;
    const m = life && life.moods ? life.moods[id] : null;
    r[id] = { at: w.place === 'home' ? 'home' : 'out', d: ASSISTANT_LIFE_DOINGS[w.doing] ? w.doing : 'idle', m: ASSISTANT_LIFE_MOODS[m] ? m : 'happy' };
    // 出かけている先(2026-11-08 社長「8部屋とも留守なのはなぜ」→ 行き先を札に出す)。町の場所の id だけ
    if (w.place !== 'home' && typeof ASSISTANT_LIFE_PLACES !== 'undefined' && ASSISTANT_LIFE_PLACES[w.place]) r[id].p = w.place;
    // 部屋に置いている家具(key だけ)。2026-11-08 社長「その人の色々見れるように」
    try { const put = typeof assistantLifeRoomOf === 'function' ? assistantLifeRoomOf(id).put : null; const fu = {}; for (const [k, s] of [['c', 'ceil'], ['w', 'wall'], ['f', 'floor']]) if (put && typeof put[s] === 'string') fu[k] = put[s]; if (Object.keys(fu).length) r[id].fu = fu; } catch {}
  }
  const ac1 = _alfActCache && _alfActCache[0] && ALF_STORE.state.settings.act ? { k: _alfActCache[0].k, x: _alfActCache[0].x, at: _alfActCache[0].at } : null;
  return { v: 1, ids, r, ...(ac1 ? { ac1 } : {}) };
};
let _alfActCache = null;
// くわしい控え(2026-11-08 社長 F・表 assistant_life_friend_house_more。訪ねたときだけ読む)。
//   部屋ごとの家具(置いている3つ+押し入れ)・今日あったこと(8つ)。よその人の名前が入る行(フレンドの家との行き来)は写さない
const ALF_TABLE_MORE = 'assistant_life_friend_house_more';
// 最近の行(受け取る側)。種類・40字まで・時刻。知らない種類は捨てる
const alfNormalizeAc = (v) => (Array.isArray(v) ? v : []).slice(0, 6).map(a => (a && ['beat', 'card', 'masmon', 'furn'].includes(a.k) && typeof a.x === 'string' && Number.isFinite(a.at) ? { k: a.k, x: a.x.replace(/[{}<>]/g, '').slice(0, 40), at: a.at } : null)).filter(Boolean);
const ALF_MORE_MAX_CHARS = 6000;
const alfDiaryShare = (n) => {
  try {
    const d = typeof ASSISTANT_LIFE_DIARY !== 'undefined' ? ASSISTANT_LIFE_DIARY.state : null;
    return (d && Array.isArray(d.items) ? d.items : []).filter(x => x && x.kind !== 'friend' && !/さんの|さんち/.test(x.text)).slice(-n).reverse().map(x => ({ t: alfStr(x.t, 5), x: alfStr(x.text, 40) }));
  } catch { return []; }
};
const alfBuildMore = (ids) => {
  const fu = {};
  for (const id of (ids || []).filter(alfValidId)) {
    try {
      const room = typeof assistantLifeRoomOf === 'function' ? assistantLifeRoomOf(id) : null;
      if (!room) continue;
      const p = {}; for (const [k, sl] of [['c', 'ceil'], ['w', 'wall'], ['f', 'floor']]) if (typeof room.put[sl] === 'string') p[k] = room.put[sl];
      const k = (room.kept || []).filter(x => typeof x === 'string').slice(0, 12);
      if (Object.keys(p).length || k.length) fu[id] = { p, k };
    } catch {}
  }
  const dy = alfDiaryShare(8);
  return { v: 1, fu, dy };
};
// ---------- フレンドの最近(2026-11-08 社長「フレンドで相手の行動見えるバリエーションも増やして」・FRIEND-ACTIVITY-PLAN.md) ----------
// 端末の記録から組み立てる(曲名・勝ったこと・迎えたマスモンの種類・置いた家具だけ。スコア・数・相手の名前は入れない)。
//   モンヒロビートは遊び終わりに 30-rhythm-play が assistantLifeFriendNoteActivity('beat', 曲名) を呼ぶ(新しいキー mh_assistant_life_friend_activity_v1)
const ALF_ACT_KEY = 'mh_assistant_life_friend_activity_v1';
const ALF_ACT_MAX = 6;
const ALF_ACT_KINDS = Object.freeze({ beat: 'モンヒロビート', card: 'MFバトルカード', masmon: 'マスモン', furn: 'お部屋' });
const ALF_ACT_ICON = Object.freeze({ beat: '🎵', card: '🃏', masmon: '🐾', furn: '🪑' });
const normalizeAlfActivity = (v) => (Array.isArray(v) ? v : []).filter(x => x && x.k === 'beat' && typeof x.x === 'string' && x.x && Number.isFinite(x.at)).map(x => ({ k: 'beat', x: alfStr(x.x, 30), at: x.at })).slice(0, ALF_ACT_MAX);
const assistantLifeFriendNoteActivity = async (k, x) => {
  if (k !== 'beat' || typeof x !== 'string' || !x.trim() || typeof storeGet !== 'function') return;
  try {
    const cur = normalizeAlfActivity(await storeGet(ALF_ACT_KEY, []));
    const t = alfStr(x.trim(), 30);
    storeSet(ALF_ACT_KEY, [{ k, x: t, at: Date.now() }, ...cur.filter(y => y.x !== t)].slice(0, ALF_ACT_MAX), false);
  } catch {}
};
const alfCollectActivity = async (now = Date.now()) => {
  const out = []; const week = 7 * 86400000;
  const get = async (key, def) => { try { return typeof storeGet === 'function' ? await storeGet(key, def) : def; } catch { return def; } };
  for (const a of normalizeAlfActivity(await get(ALF_ACT_KEY, []))) out.push({ k: 'beat', x: `「${a.x}」を遊んだ`, at: a.at });
  const rec = await get('mh_card_record_v1', null);
  for (const r of (rec && Array.isArray(rec.recent) ? rec.recent : []).filter(r => r && r.outcome === 'win' && Number.isFinite(r.at)).slice(0, 2)) out.push({ k: 'card', x: alfValidId(r.who) ? `${assistantLifeName(r.who)}に対戦で勝った` : '対戦で勝った', at: r.at });
  const hist = await get('mh_card_pvp_history_v1', []);
  const w = (Array.isArray(hist) ? hist : []).find(m => m && m.outcome === 'win' && Number.isFinite(m.at));
  if (w) out.push({ k: 'card', x: 'マルチ対戦で勝った', at: w.at });
  const ms = await get('mh_masu_mons', []);
  const m = (Array.isArray(ms) ? ms : []).filter(x => x && Number.isFinite(x.createdAt)).sort((a, b) => b.createdAt - a.createdAt)[0];
  const mon = m && typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS[m.baseId] : null;
  if (mon && mon.name) out.push({ k: 'masmon', x: `新しいマスモン「${alfStr(mon.name, 16)}」を迎えた`, at: m.createdAt });
  for (const id of ALF_IDS) {
    try {
      const room = typeof assistantLifeRoomOf === 'function' ? assistantLifeRoomOf(id) : null;
      for (const key of Object.values((room && room.put) || {}).filter(Boolean)) {
        const day = room.got && room.got[key]; const f = typeof assistantLifeFurnOf === 'function' ? assistantLifeFurnOf(key) : null;
        const at = typeof day === 'string' ? Date.parse(`${day}T12:00:00+09:00`) : NaN;
        if (f && f.name && Number.isFinite(at)) out.push({ k: 'furn', x: `${assistantLifeName(id)}の部屋に「${f.name}」を置いた`, at });
      }
    } catch {}
  }
  return out.filter(a => now - a.at <= week && a.at <= now + 60000).sort((a, b) => b.at - a.at).slice(0, ALF_ACT_MAX).map(a => ({ k: a.k, x: alfStr(a.x, 40), at: a.at }));
};
const assistantLifeFriendNormalizeMore = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  try { if (JSON.stringify(raw).length > ALF_MORE_MAX_CHARS) return null; } catch { return null; }
  const furn = typeof ASSISTANT_LIFE_FURNITURE !== 'undefined' && Array.isArray(ASSISTANT_LIFE_FURNITURE) ? ASSISTANT_LIFE_FURNITURE : [];
  const fu = {};
  for (const id of ALF_IDS) {
    const x = raw.fu && typeof raw.fu === 'object' ? raw.fu[id] : null;
    if (!x || typeof x !== 'object') continue;
    const p = {}; for (const [k, sl] of [['c', 'ceil'], ['w', 'wall'], ['f', 'floor']]) { const f = x.p && furn.find(y => y.key === x.p[k]); if (f && f.slot === sl) p[k] = f.key; }
    const k = [...new Set((Array.isArray(x.k) ? x.k : []).filter(key => furn.some(y => y.key === key)))].slice(0, 12);
    fu[id] = { p, k };
  }
  const dy = (Array.isArray(raw.dy) ? raw.dy : []).slice(0, 8).map(d => (d && typeof d.x === 'string' ? { t: /^\d{1,2}:\d{2}$/.test(d.t) ? d.t : '', x: d.x.replace(/[{}<>]/g, '').slice(0, 40) } : null)).filter(d => d && d.x);
  return { v: 1, fu, dy, ac: alfNormalizeAc(raw.ac) };
};
// 相手の控えを読むとき(知らない id・種類・長い値は捨てる)
const assistantLifeFriendNormalizeHouse = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  try { if (JSON.stringify(raw).length > ALF_HOUSE_MAX_CHARS) return null; } catch { return null; }
  const ids = Array.isArray(raw.ids) ? [...new Set(raw.ids.filter(alfValidId))].slice(0, 12) : [];
  const r = {};
  for (const id of ids) {
    const x = raw.r && typeof raw.r === 'object' ? raw.r[id] : null;
    if (!x || typeof x !== 'object') continue;
    r[id] = { at: x.at === 'out' ? 'out' : 'home', d: typeof x.d === 'string' && ASSISTANT_LIFE_DOINGS[x.d] ? x.d : 'idle', m: typeof x.m === 'string' && ASSISTANT_LIFE_MOODS[x.m] ? x.m : 'happy' };
    if (r[id].at === 'out' && typeof x.p === 'string' && x.p !== 'home' && typeof ASSISTANT_LIFE_PLACES !== 'undefined' && ASSISTANT_LIFE_PLACES[x.p]) r[id].p = x.p;
    const furn = typeof ASSISTANT_LIFE_FURNITURE !== 'undefined' && Array.isArray(ASSISTANT_LIFE_FURNITURE) ? ASSISTANT_LIFE_FURNITURE : [];
    if (x.fu && typeof x.fu === 'object') { const fu = {}; for (const [k, slot] of [['c', 'ceil'], ['w', 'wall'], ['f', 'floor']]) { const f = furn.find(y => y.key === x.fu[k]); if (f && f.slot === slot) fu[k] = f.key; } if (Object.keys(fu).length) r[id].fu = fu; }
  }
  const dy = (Array.isArray(raw.dy) ? raw.dy : []).slice(0, 3).map(d => (d && typeof d.x === 'string' ? { t: /^\d{1,2}:\d{2}$/.test(d.t) ? d.t : '', x: d.x.replace(/[{}<>]/g, '').slice(0, 40) } : null)).filter(d => d && d.x);
  const ac1 = alfNormalizeAc(raw.ac1 ? [raw.ac1] : [])[0] || null;
  return { v: 1, ids, r, ...(dy.length ? { dy } : {}), ...(ac1 ? { ac1 } : {}) };
};
// 控えの中で、いま家にいる(会える)助手
const alfHomeIds = (house) => (house ? house.ids.filter(id => house.r[id] && house.r[id].at === 'home') : []);

// ---------- 入れ物 ----------
const ALF_STORE = {
  state: { loaded: false, st: alfDefaultState(), settings: normalizeAssistantLifeFriendSettings(null), known: {}, intro: false,
    mode: null, ready: true, selfId: null, roster: [], houses: {}, more: {}, visits: [], busy: false, scene: null },
  loading: null,
  listeners: new Set(),
  emit() { for (const fn of this.listeners) { try { fn(this.state); } catch {} } },
  set(patch) { this.state = { ...this.state, ...patch }; this.emit(); },
  load() {
    if (this.state.loaded) return Promise.resolve(this.state);
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const [a, b, c, d] = await Promise.all([ALF_KEY, ALF_SETTINGS_KEY, ALF_KNOWN_KEY, ALF_INTRO_KEY].map(k => storeGet(k, null, false).catch(() => null)));
      this.set({ loaded: true, st: alfRollDay(normalizeAssistantLifeFriend(a), alfDay()), settings: normalizeAssistantLifeFriendSettings(b), known: normalizeAssistantLifeFriendKnown(c), intro: d === true });
      return this.state;
    })();
    return this.loading;
  },
};
const alfSaveSt = (st) => { ALF_STORE.set({ st }); try { storeSet(ALF_KEY, st, false); } catch {} };
const alfSaveSettings = (settings) => { ALF_STORE.set({ settings }); try { storeSet(ALF_SETTINGS_KEY, settings, false); } catch {} };
const alfSaveKnown = (known) => { ALF_STORE.set({ known }); try { storeSet(ALF_KNOWN_KEY, known, false); } catch {} };
const alfToday = () => { const day = alfDay(); const cur = ALF_STORE.state.st; const st = alfRollDay(cur, day); if (st !== cur) alfSaveSt(st); return st; };
const useAssistantLifeFriendState = () => {
  const [s, setS] = React.useState(ALF_STORE.state);
  React.useEffect(() => { const fn = (x) => setS(x); ALF_STORE.listeners.add(fn); void ALF_STORE.load(); setS(ALF_STORE.state); return () => { ALF_STORE.listeners.delete(fn); }; }, []);
  return s;
};

// ---------- 通信(表が無いときは「準備中」にして、それ以後は通信しない) ----------
let _alfUnavailable = false;
// soft … 足した表(くわしい控え)用。その表が無くても、行き来ぜんぶを「準備中」にしない
const alfRequest = async (path, { method = 'GET', body = null, prefer = null, soft = false } = {}) => {
  if (_alfUnavailable) { const e = new Error('assistant life friend tables are not ready'); e.notReady = true; throw e; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), typeof FRIENDS_TIMEOUT_MS !== 'undefined' ? FRIENDS_TIMEOUT_MS : 8000);
  try {
    const headers = prefer ? { ...SB_HEADERS, 'Content-Type': 'application/json', 'Prefer': prefer } : { ...SB_HEADERS, 'Content-Type': 'application/json' };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, cache: 'no-store', signal: controller.signal, body: body === null ? undefined : JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) {
      if (soft && _isMissingTableError(res.status, text)) { const e = new Error('alf soft table missing'); e.missing = true; throw e; }
      if (_isMissingTableError(res.status, text)) { _alfUnavailable = true; ALF_STORE.set({ ready: false }); const e = new Error('assistant life friend tables are not ready'); e.notReady = true; throw e; }
      const e = new Error(`alf ${method} ${path.split('?')[0]} ${res.status}`); e.status = res.status; e.body = text; throw e;
    }
    return text ? JSON.parse(text) : [];
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error('alf request timed out');
    throw error;
  } finally { clearTimeout(timer); }
};
const alfQuoteIn = (ids) => ids.map(id => `"${id}"`).join(',');
// スイッチ(起動後1回。読めないときは thin=安全側。表が無いときは off=出さない)
let _alfModeLoading = null;
const alfLoadMode = () => {
  if (ALF_STORE.state.mode) return Promise.resolve(ALF_STORE.state.mode);
  if (_alfModeLoading) return _alfModeLoading;
  _alfModeLoading = (async () => {
    let mode = 'thin';
    try {
      const rows = await alfRequest(`${ALF_TABLE_SWITCH}?select=mode&id=eq.1`);
      const m = Array.isArray(rows) && rows[0] ? rows[0].mode : null;
      mode = ['on', 'thin', 'off'].includes(m) ? m : 'thin';
    } catch (e) { mode = e && e.notReady ? 'off' : 'thin'; }
    ALF_STORE.set({ mode });
    return mode;
  })();
  return _alfModeLoading;
};
const alfLimits = () => ALF_LIMITS[ALF_STORE.state.mode === 'on' ? 'on' : 'thin'];
const alfSelf = async () => {
  if (ALF_STORE.state.selfId) return ALF_STORE.state.selfId;
  const id = typeof ensureBreederId === 'function' ? await ensureBreederId() : null;
  const safe = alfSafeOther(id);
  if (safe) ALF_STORE.set({ selfId: safe });
  return safe;
};
// 承認済みのフレンド(今のフレンドの一覧の読み方)。30分は読み直さない
let _alfRosterAt = 0;
const alfRoster = async (force = false) => {
  const self = await alfSelf();
  if (!self || typeof sbFetchFriendRoster !== 'function') return [];
  if (!force && Date.now() - _alfRosterAt < alfLimits().readMs) return ALF_STORE.state.roster;
  try {
    const list = await sbFetchFriendRoster(self);
    const roster = (Array.isArray(list) ? list : []).map(f => (alfSafeOther(f.otherId) ? { id: f.otherId, name: alfStr(f.userName, 20) || '名無しのブリーダー' } : null)).filter(Boolean).slice(0, 60);
    _alfRosterAt = Date.now();
    ALF_STORE.set({ roster });
    return roster;
  } catch { return ALF_STORE.state.roster; }
};
// フレンドの控え。前に読んだあとで変わった家だけ読む(updated_at=gt.前回)。30分は読み直さない。thin は1日1回
let _alfHousesAt = 0; let _alfHousesDay = null; let _alfHousesMax = null;
const alfFetchHouses = async (force = false) => {
  if (_alfUnavailable) return ALF_STORE.state.houses;
  const mode = await alfLoadMode();
  if (mode === 'off') return {};
  const roster = await alfRoster();
  const muted = new Set(ALF_STORE.state.settings.muted);
  const ids = roster.map(f => f.id).filter(id => !muted.has(id));
  if (!ids.length) { ALF_STORE.set({ houses: {} }); return {}; }
  const day = alfDay();
  if (!force && Date.now() - _alfHousesAt < alfLimits().readMs) return ALF_STORE.state.houses;
  if (!force && mode === 'thin' && _alfHousesDay === day) return ALF_STORE.state.houses;
  try {
    const since = _alfHousesMax ? `&updated_at=gt.${encodeURIComponent(_alfHousesMax)}` : '';
    const rows = await alfRequest(`${ALF_TABLE_HOUSES}?select=breeder_id,open,house,updated_at&breeder_id=in.(${alfQuoteIn(ids)})${since}`);
    const houses = { ...ALF_STORE.state.houses };
    for (const row of Array.isArray(rows) ? rows : []) {
      const id = alfSafeOther(row && row.breeder_id);
      if (!id) continue;
      const at = Date.parse(row.updated_at);
      houses[id] = { open: row.open !== false, house: assistantLifeFriendNormalizeHouse(row.house), at: Number.isFinite(at) ? at : 0 };
      if (typeof row.updated_at === 'string' && (!_alfHousesMax || row.updated_at > _alfHousesMax)) _alfHousesMax = row.updated_at;
    }
    for (const id of Object.keys(houses)) if (!ids.includes(id)) delete houses[id]; // フレンドでなくなった・来ないようにした家は消す
    _alfHousesAt = Date.now(); _alfHousesDay = day;
    ALF_STORE.set({ houses });
    return houses;
  } catch { return ALF_STORE.state.houses; }
};
// 訪ねられる家(入にしている・控えが新しい・来ないようにしていない)。最近開いた順
const alfOpenHouses = (kind = 'go', now = Date.now()) => {
  const s = ALF_STORE.state;
  const muted = new Set(s.settings.muted);
  const fresh = ALF_FRESH_DAYS[kind] * 86400000;
  return s.roster.map(f => ({ ...f, ...(s.houses[f.id] || {}) }))
    .filter(f => f.open && f.house && f.house.ids.length && !muted.has(f.id) && now - (f.at || 0) <= fresh)
    .sort((a, b) => (b.at || 0) - (a.at || 0));
};
// 自分あての行き来(7日分)。30分は読み直さない
let _alfVisitsAt = 0;
const alfFetchVisits = async (force = false) => {
  if (_alfUnavailable) return ALF_STORE.state.visits;
  const mode = await alfLoadMode();
  if (mode === 'off') return [];
  const self = await alfSelf();
  if (!self) return [];
  if (!force && Date.now() - _alfVisitsAt < alfLimits().readMs) return ALF_STORE.state.visits;
  try {
    const from = alfDayShift(alfDay(), -7);
    const rows = await alfRequest(`${ALF_TABLE_VISITS}?select=id,kind,visitor_id,host_id,day,assistants,word,thanks,note,note_to,created_at&or=(host_id.eq.${self},visitor_id.eq.${self})&day=gte.${from}&order=created_at.desc&limit=60`);
    const visits = (Array.isArray(rows) ? rows : []).map(r => (r && Number.isFinite(r.id) && ['go', 'come', 'player'].includes(r.kind) && alfSafeOther(r.visitor_id) && alfSafeOther(r.host_id) ? {
      id: r.id, kind: r.kind, visitor: r.visitor_id, host: r.host_id, day: String(r.day || '').slice(0, 10),
      ids: Array.isArray(r.assistants) ? r.assistants.filter(alfValidId).slice(0, 2) : [], word: alfInt(r.word, 0, ALF_WORDS - 1),
      thanks: r.thanks == null ? null : alfInt(r.thanks, 0, ALF_THANKS - 1), at: Date.parse(r.created_at) || 0,
      note: typeof r.note === 'string' ? alfNoteShow(r.note) : '', noteTo: alfValidId(r.note_to) ? r.note_to : null } : null)).filter(Boolean);
    _alfVisitsAt = Date.now();
    ALF_STORE.set({ visits });
    return visits;
  } catch { return ALF_STORE.state.visits; }
};
// 表に断られた理由を、遊ぶ人に分かる文にする(表の見張り alf_visits_guard の文に合わせる)
const alfRefusalText = (e) => {
  const b = String((e && (e.body || e.message)) || '');
  if (e && e.notReady) return 'フレンドの家との行き来は、いま準備中です';
  if (/フレンドではありません/.test(b)) return 'フレンドではなくなったため、置き手紙を残せませんでした';
  if (/切にしています/.test(b)) return 'あなたか相手が行き来を「切」にしているため、置き手紙を残せませんでした';
  if (/今日はもう/.test(b)) return '今日はもう訪ねられません(朝4時に戻ります)';
  if (/止めています/.test(b)) return 'フレンドの家との行き来は、いまお休み中です';
  if (/日付/.test(b)) return '端末の日付と時刻がずれているようです。合わせてからもう一度';
  if (/連絡先/.test(b) || /alf_visits_note/.test(b)) return '連絡先のような文は置けません。ひとことを書き直してください';
  if ((e && e.status === 409) || /23505|duplicate/.test(b)) return '今日はこの家にもう置き手紙を残しました';
  return '通信がうまくいきませんでした(時間をおいてもう一度)';
};
// 行き来の行を足す(表の側でも上限・フレンドか・切かを見る)。{ ok, reason }
const alfPostVisitR = async ({ kind, visitor, host, ids = [], word = 0, note = '', noteTo = null }) => {
  try {
    const extra = { ...(note ? { note } : {}), ...(noteTo && alfValidId(noteTo) ? { note_to: noteTo } : {}) };
    await alfRequest(ALF_TABLE_VISITS, { method: 'POST', prefer: 'return=minimal', body: { kind, visitor_id: visitor, host_id: host, day: alfDay(), assistants: ids, word, ...extra } });
    return { ok: true, reason: '' };
  } catch (e) { return { ok: false, reason: alfRefusalText(e) }; }
};
const alfPostVisit = async (args) => (await alfPostVisitR(args)).ok;
// 自分の控えを送る(10分に1回まで・thin は1時間・中身が前と同じなら送らない。日が変わったら1回は送り直して「新しい控え」にする)
const alfSig = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const alfPublish = async (life, metIds, now = Date.now(), { force = false } = {}) => {
  if (_alfUnavailable) return false;
  const mode = await alfLoadMode();
  if (mode === 'off') return false;
  const self = await alfSelf();
  if (!self) return false;
  const st = alfToday();
  const settings = ALF_STORE.state.settings;
  try { _alfActCache = settings.act ? await alfCollectActivity(now) : []; } catch { _alfActCache = []; }
  const house = settings.show ? alfBuildHouse(life, metIds) : {};
  const sig = alfSig(`${alfDay(now)}|${settings.open ? 1 : 0}|${JSON.stringify(house)}`);
  // まだ一度も送れていない(sentAt 0)・force のときは、間隔と「同じ中身」を見ずに送る(2026-11-08 本番で、公開前に時間の様子が決まっていた人の控えが一度も届かず、行き来が断られた)
  if (!force && st.sentAt) {
    if (sig === st.sentSig) return false;
    if (now - st.sentAt < alfLimits().sendMs) return false;
  }
  try {
    await alfRequest(`${ALF_TABLE_HOUSES}?on_conflict=breeder_id`, { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { breeder_id: self, open: settings.open, house } });
    alfSaveSt({ ...alfToday(), sentAt: now, sentSig: sig });
    void alfPublishMore(self, settings.show ? { ...alfBuildMore(house.ids), ...(settings.act ? { ac: _alfActCache || [] } : {}) } : {});
    return true;
  } catch { return false; }
};
// くわしい控えを送る(表が無ければ、それ以後は送らない。中身が前と同じなら送らない)
let _alfMoreMissing = false; let _alfMoreSig = '';
const alfPublishMore = async (self, more) => {
  if (_alfMoreMissing || !self) return false;
  const sig = alfSig(JSON.stringify(more));
  if (sig === _alfMoreSig) return false;
  try {
    await alfRequest(`${ALF_TABLE_MORE}?on_conflict=breeder_id`, { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { breeder_id: self, more }, soft: true });
    _alfMoreSig = sig; return true;
  } catch (e) { if (e && e.missing) _alfMoreMissing = true; return false; }
};
// 訪ねた家のくわしい控えを読む(その家の1行だけ)。無い・読めないときは null(今の控えだけで描く)
const alfFetchMore = async (hostId) => {
  if (_alfMoreMissing || !alfSafeOther(hostId)) return null;
  try {
    const rows = await alfRequest(`${ALF_TABLE_MORE}?select=more,updated_at&breeder_id=eq.${encodeURIComponent(hostId)}&limit=1`, { soft: true });
    const m = Array.isArray(rows) && rows[0] ? assistantLifeFriendNormalizeMore(rows[0].more) : null;
    ALF_STORE.set({ more: { ...ALF_STORE.state.more, [hostId]: m } });
    return m;
  } catch (e) { if (e && e.missing) _alfMoreMissing = true; return null; }
};
// 自分の家の控えが表にあるようにする(「🏘 フレンド」を開いたとき・訪ねる前・行き来の前・HOME)。
//   今日まだ送れていなければ必ず送る。force は間隔も見ない。送れた/今日もう送ってある なら true
const alfEnsureHouse = async ({ force = false } = {}) => {
  if (typeof ASSISTANT_LIFE_STORE === 'undefined') return false;
  try { await ASSISTANT_LIFE_STORE.load(); } catch { return false; }
  const life = ASSISTANT_LIFE_STORE.state.life;
  const st = alfToday();
  const sentToday = st.sentAt && alfDay(st.sentAt) === st.day;
  if (sentToday && !force) return true;
  const metIds = [...new Set([...((life && life.groups) || []).flatMap(g => g.ids), ...Object.keys((life && life.solo) || {})])];
  return alfPublish(life, metIds, Date.now(), { force: true });
};

// ---------- 行き来の決め方(端末で数える。表の側でも同じ上限を数える) ----------
// 家にいて手が空いている助手から、ときどきフレンドの家へ行く人を選ぶ(純粋な関数。検査が直接呼ぶ)
//   上限: みんなで1日 go 回(on 3・thin 1)/同じ家1日1回/1回に1〜2人/寝ている・けんか中・距離をおいている助手は行かない/深夜は行かない
const assistantLifeFriendPickOuting = ({ life, ids, houses, st, settings, mode, pendingIds = [], abs, salt = '' }) => {
  if (!life || mode === 'off' || !settings || !settings.open) return null;
  const lim = ALF_LIMITS[mode === 'on' ? 'on' : 'thin'];
  if ((st.go || 0) >= lim.go) return null;
  if (life.slot === 'late') return null;
  const busy = new Set(pendingIds || []);
  const cand = (ids || []).filter(id => {
    const s = life.solo && life.solo[id];
    return alfValidId(id) && s && s.place === 'home' && s.doing !== 'sleep' && s.reason !== 'distance' && !busy.has(id);
  }).sort();
  if (!cand.length) return null;
  const rand = assistantLifeRng(`${salt}|friend|${abs}|${cand.join(',')}`);
  const social = cand.reduce((t, id) => t + ((ASSISTANT_LIFE_PREFS[id] && ASSISTANT_LIFE_PREFS[id].social) || 0.5), 0) / cand.length;
  const chance = Math.min(0.6, 0.15 + 0.3 * social) * (life.slot === 'night' ? 0.7 : 1);
  if (rand() >= chance) return null;
  const muted = new Set(settings.muted || []);
  const went = st.went || {};
  const last = new Set(st.lastHosts || []);
  const w = {};
  for (const h of houses || []) {
    if (!h || !alfSafeOther(h.id) || went[h.id] || muted.has(h.id) || !h.house || !alfHomeIds(h.house).length) continue;
    w[h.id] = (last.has(h.id) ? 0.3 : 1) * (1 + Math.min(1, (h.known || 0) / 10));
  }
  const host = assistantLifePickWeighted(w, rand);
  if (!host) return null;
  const order = [...cand];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const two = order.length >= 2 && rand() < 0.35;
  const h = houses.find(x => x.id === host);
  return { host, name: h.name, ids: order.slice(0, two ? 2 : 1).sort(), theirs: alfHomeIds(h.house).slice(0, 2), word: Math.floor(rand() * ALF_WORDS) };
};
// フレンドの助手が自分で来る(家を開いたとき・1日 come 人まで・同じ家から1日1人)
const assistantLifeFriendPickCome = ({ houses, st, settings, mode, myHome = [], seed = '' }) => {
  if (mode !== 'on' || !settings || !settings.open || !settings.come) return null;
  if ((st.come || 0) >= ALF_LIMITS.on.come) return null;
  const done = new Set((st.came || []).map(c => c.host));
  const muted = new Set(settings.muted || []);
  const list = (houses || []).filter(h => h && alfSafeOther(h.id) && !done.has(h.id) && !muted.has(h.id) && alfHomeIds(h.house).length);
  if (!list.length) return null;
  const rand = assistantLifeRng(`${seed}|come|${st.day}|${st.come}`);
  if (rand() >= 0.5) return null;
  const h = list[Math.floor(rand() * list.length)];
  const theirs = alfHomeIds(h.house);
  const aid = theirs[Math.floor(rand() * theirs.length)];
  const mine = myHome.length ? myHome[Math.floor(rand() * myHome.length)] : null;
  return { host: h.id, name: h.name, aid, mine };
};

// ---------- ごほうび(場面を見たとき) ----------
// 60-app.jsx が「ギフトを1回だけ届ける」関数を渡す(grantGiftOnce と同じ。id が同じなら二重にならない)
let _alfGiftSender = null;
const assistantLifeFriendSetGiftSender = (fn) => { _alfGiftSender = typeof fn === 'function' ? fn : null; };
const alfGiveBeatP = async (kind, giftId, st) => {
  const want = ALF_BEAT_P[kind] || 0;
  const amount = Math.max(0, Math.min(want, ALF_BEAT_P.dayMax - (st.beatP || 0)));
  if (!amount || !_alfGiftSender) return 0;
  let ok = false;
  try { ok = await _alfGiftSender({ id: giftId, title: kind === 'look' ? 'フレンドの家へ遊びに行ったおみやげ' : '助手のフレンドの家のおみやげ', source: 'assistantLifeFriend', rewards: [{ type: 'beatPoint', amount }] }); } catch { ok = false; }
  return ok ? amount : 0;
};
const alfAddKnown = (pairs) => {
  const known = { ...ALF_STORE.state.known };
  for (const k of pairs) known[k] = (known[k] || 0) + 1;
  alfSaveKnown(normalizeAssistantLifeFriendKnown(known));
};
const alfBond = (ids, action) => { if (typeof assistantPeerAddPlayerBond === 'function') { try { assistantPeerAddPlayerBond(ids, action); } catch {} } };
// 行った助手の場面を見た(その日のうちなら 仲良し度・友情Lv。写真とおみやげは見ないまま日が変わっても受け取れる)
const assistantLifeFriendSeeOuting = async (which = 'out') => {
  await ALF_STORE.load();
  let st = alfToday();
  const o = st[which];
  if (!o || o.rewarded) { if (o && !o.seen) alfSaveSt({ ...st, [which]: { ...o, seen: true } }); return null; }
  const sameDay = o.day === st.day;
  if (sameDay) {
    alfBond(o.ids, 'friendGo');
    if (o.ids.length === 2 && typeof assistantPeerGain === 'function') { try { await assistantPeerGain(o.ids[0], o.ids[1], 'friend'); } catch {} }
  }
  st = alfToday();
  const got = await alfGiveBeatP('go', `alf_go_${o.day || st.day}_${o.host.slice(0, 12)}`, st);
  const firstHere = !st.photos.some(p => p.host === o.host);
  const photos = firstHere ? [...st.photos, { host: o.host, name: o.name, day: o.day || st.day, ids: o.ids, theirs: o.theirs }].slice(-60) : st.photos;
  alfSaveSt({ ...st, beatP: st.beatP + got, photos, [which]: { ...o, seen: true, rewarded: true } });
  alfAddKnown(o.ids.flatMap(a => o.theirs.map(b => `${a}|${o.host}|${b}`)));
  return { beatP: got, photo: firstHere, bond: sameDay };
};
// 来てくれた助手を迎えた
const assistantLifeFriendSeeCome = async (i) => {
  await ALF_STORE.load();
  const st = alfToday();
  const c = st.came[i];
  if (!c || c.seen) return null;
  if (c.mine) alfBond([c.mine], 'friendWelcome');
  const came = st.came.map((x, j) => (j === i ? { ...x, seen: true } : x));
  alfSaveSt({ ...st, came });
  if (c.mine) alfAddKnown([`${c.mine}|${c.host}|${c.aid}`]);
  return { mine: c.mine };
};

// ---------- 時間の区切り(56-assistant-life.jsx の assistantLifeNow から呼ばれる) ----------
const assistantLifeFriendOnSlot = async (life, slot, now = Date.now()) => {
  if (!alfEnabled() || !life) return;
  await ALF_STORE.load();
  let st = alfToday();
  // 前の時間に行っていた助手は帰ってくる(家を開くと「おかえり！」)
  if (st.out && st.out.abs !== slot.abs) { st = { ...st, back: st.out, out: null }; alfSaveSt(st); }
  const metIds = [...new Set([...(life.groups || []).flatMap(g => g.ids), ...Object.keys(life.solo || {})])];
  void alfPublish(life, metIds, now);
  if (st.out) return;
  const mode = await alfLoadMode();
  if (mode === 'off' || _alfUnavailable) return;
  const self = await alfSelf();
  if (!self) return;
  await alfFetchHouses();
  const known = ALF_STORE.state.known;
  const houses = alfOpenHouses('go', now).map(h => ({ ...h, known: Object.entries(known).filter(([k]) => k.split('|')[1] === h.id).reduce((t, [, n]) => t + n, 0) }));
  const pending = typeof assistantLifeRelPending === 'function' ? ((assistantLifeRelPending() || {}).ids || []) : [];
  const pick = assistantLifeFriendPickOuting({ life, ids: metIds, houses, st: alfToday(), settings: ALF_STORE.state.settings, mode, pendingIds: pending, abs: slot.abs, salt: life.salt || '' });
  if (!pick) return;
  if (!(await alfEnsureHouse())) return;
  const ok = await alfPostVisit({ kind: 'go', visitor: self, host: pick.host, ids: pick.ids, word: pick.word });
  if (!ok) return;
  const cur = alfToday();
  alfSaveSt({ ...cur, go: cur.go + 1, went: { ...cur.went, [pick.host]: 1 }, out: { abs: slot.abs, day: cur.day, ...pick, seen: false, rewarded: false } });
  if (typeof assistantLifeDiaryAdd === 'function') { try { void assistantLifeDiaryAdd(`🏘 ${pick.ids.map(assistantLifeName).join('・')} ${pick.name}さんの家へ`, pick.ids, { kind: 'friend', now }); } catch {} }
};
// 家を開いたとき(フレンドの一覧を読む・来客を選ぶ)
const assistantLifeFriendOnOpen = async (life, now = Date.now()) => {
  if (!alfEnabled()) return;
  await ALF_STORE.load();
  const mode = await alfLoadMode();
  if (mode === 'off' || _alfUnavailable) return;
  const self = await alfSelf();
  if (!self) return;
  await alfEnsureHouse();
  await alfFetchHouses();
  void alfFetchVisits();
  void assistantLifeFriendRequestScenes(life);
  const st = alfToday();
  const myHome = life ? Object.entries(life.solo || {}).filter(([id, s]) => alfValidId(id) && s.place === 'home' && s.doing !== 'sleep').map(([id]) => id).filter(id => !(st.out && st.out.ids.includes(id))) : [];
  const pick = assistantLifeFriendPickCome({ houses: alfOpenHouses('come', now), st, settings: ALF_STORE.state.settings, mode, myHome, seed: `${self}|${life && life.abs}` });
  if (!pick) return;
  const ok = await alfPostVisit({ kind: 'come', visitor: pick.host, host: self, ids: [pick.aid] });
  if (!ok) return;
  const cur = alfToday();
  alfSaveSt({ ...cur, come: cur.come + 1, came: [...cur.came, { ...pick, seen: false }].slice(0, 2) });
  if (typeof assistantLifeDiaryAdd === 'function') { try { void assistantLifeDiaryAdd(`🏘 ${pick.name}さんの${assistantLifeName(pick.aid)}が来た`, pick.mine ? [pick.mine] : [], { kind: 'friend', now }); } catch {} }
};

// ---------- プレイヤーが訪ねる(look) ----------
const assistantLifeFriendCanLook = (hostId) => {
  const st = ALF_STORE.state.st;
  const lim = alfLimits();
  if (ALF_STORE.state.mode === 'off' || !ALF_STORE.state.settings.open) return 'off';
  if (st.looked && st.looked[hostId]) return 'done';
  if ((st.look || 0) >= lim.look) return 'max';
  return 'ok';
};
// 置き手紙を残して帰る(1日3軒・同じ家は1日1回。ビートP 50・初めての家なら写真1枚。助手の行き来のおみやげと合わせて1日300Pまで)
//   talked … 声をかけた相手の家の助手(置き手紙に「ドラと話した」と出る)。相手の端末・保存には何も書かない
const assistantLifeFriendLeaveNote = async (hostId, { word = 0, talked = [], name = '', note = '', noteTo = null } = {}) => {
  await ALF_STORE.load();
  alfToday();
  const can = assistantLifeFriendCanLook(hostId);
  if (can !== 'ok') return { ok: false, reason: can === 'done' ? '今日はこの家にもう置き手紙を残しました' : can === 'max' ? '今日はもう訪ねられません(朝4時に戻ります)' : 'フレンドの家との行き来が「切」になっています' };
  const self = await alfSelf();
  if (!self) return { ok: false, reason: 'この端末では、まだフレンドの機能が使えません' };
  if (!(await alfEnsureHouse())) return { ok: false, reason: 'あなたの家の様子をまだ届けられていません。電波のよい所でもう一度' };
  const ids = [...new Set((talked || []).filter(alfValidId))].slice(0, 2);
  const nc = alfNoteCheck(note);
  if (!nc.ok) return { ok: false, reason: nc.reason };
  const r = await alfPostVisitR({ kind: 'player', visitor: self, host: hostId, ids, word: alfInt(word, 0, ALF_WORDS - 1), note: nc.text, noteTo: alfValidId(noteTo) ? noteTo : null });
  if (!r.ok) return { ok: false, reason: r.reason };
  // ミッションの「フレンドの家へ行く」と「助手とふれあう」(2026-11-08)
  if (typeof missionNotify === 'function') { missionNotify('friendVisit'); missionNotify('assistantTouch'); }
  const cur = alfToday();
  const firstHere = !cur.photos.some(p => p.host === hostId);
  const photos = firstHere ? [...cur.photos, { host: hostId, name: alfStr(name, 20) || 'フレンド', day: cur.day, ids: [], theirs: ids }].slice(-60) : cur.photos;
  const marked = { ...cur, look: cur.look + 1, looked: { ...cur.looked, [hostId]: 1 }, photos };
  alfSaveSt(marked);
  const got = await alfGiveBeatP('look', `alf_player_${cur.day}_${hostId.slice(0, 12)}`, marked);
  if (got) { const now2 = alfToday(); alfSaveSt({ ...now2, beatP: now2.beatP + got }); }
    return { ok: true, beatP: got, photo: firstHere };
};

// ---------- 置き手紙の自由文(2026-11-08 社長「置き手紙は自由文もうてるようにしたい」) ----------
// MFバトルカードのチャットと同じ表(91-card-battle-multi の cardChatClean・cardChatContact・cardChatMask)。
//   連絡先らしいもの・住所や本名・学校は送れない(理由を出す)/悪い言葉は●。受け取る側でももう一度通す
const ALF_NOTE_MAX = 40;
const ALF_NOTE_PERSONAL = /〒|丁目|番地|住所|本名|学校|中学|高校|小学/;
const alfNoteClean = (raw) => (typeof cardChatClean === 'function' ? cardChatClean(raw, ALF_NOTE_MAX) : [...String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, ALF_NOTE_MAX).join(''));
const alfNoteCheck = (raw) => {
  const text = alfNoteClean(raw);
  if (!text) return { ok: true, text: '' };
  if ((typeof cardChatContact === 'function' && cardChatContact(text)) || /https?:|www\.|@[a-z0-9_]{3,}/i.test(text) || /[0-9０-９]{7,}/.test(text.replace(/[\s\-ー－]/g, ''))) return { ok: false, text, reason: '連絡先(ID・URL・電話番号など)は書けません' };
  if (ALF_NOTE_PERSONAL.test(text)) return { ok: false, text, reason: '住所・本名・学校など、自分のことが分かる言葉は書けません' };
  return { ok: true, text: typeof cardChatMask === 'function' ? cardChatMask(text) : text };
};
// 受け取った自由文を出す前に通す(はじくものは出さない)
const alfNoteShow = (raw) => { const c = alfNoteCheck(raw); return c.ok ? c.text : ''; };

// ---------- 置き手紙(自分あての行き来)・お礼 ----------
const assistantLifeFriendNotes = (s = ALF_STORE.state) => {
  const self = s.selfId;
  const names = Object.fromEntries((s.roster || []).map(f => [f.id, f.name]));
  const muted = new Set(s.settings.muted);
  return (s.visits || []).map(v => {
    if (v.host === self && (v.kind === 'go' || v.kind === 'player') && names[v.visitor] && !muted.has(v.visitor)) return { ...v, who: v.visitor, name: names[v.visitor], dir: 'in' };
    if (v.visitor === self && v.kind === 'come' && names[v.host]) return { ...v, who: v.host, name: names[v.host], dir: 'away' };
    return null;
  }).filter(Boolean);
};
const assistantLifeFriendUnseen = (s = ALF_STORE.state) => {
  const seen = new Set(s.st.seen);
  const notes = assistantLifeFriendNotes(s).filter(n => !seen.has(n.id)).length;
  return notes + s.st.came.filter(c => !c.seen).length + (s.st.back && !s.st.back.seen ? 1 : 0);
};
const assistantLifeFriendMarkSeen = () => {
  const st = alfToday();
  const ids = assistantLifeFriendNotes().map(n => n.id);
  const seen = [...new Set([...st.seen, ...ids])].slice(-200);
  if (seen.length !== st.seen.length) alfSaveSt({ ...st, seen });
};
const assistantLifeFriendThanks = async (visitId, k) => {
  const n = alfInt(k, 0, ALF_THANKS - 1);
  try {
    await alfRequest(`${ALF_TABLE_VISITS}?id=eq.${Math.floor(visitId)}`, { method: 'PATCH', prefer: 'return=minimal', body: { thanks: n } });
    ALF_STORE.set({ visits: ALF_STORE.state.visits.map(v => (v.id === visitId ? { ...v, thanks: n } : v)) });
    return true;
  } catch { return false; }
};
const assistantLifeFriendSetSettings = (patch) => {
  const settings = normalizeAssistantLifeFriendSettings({ ...ALF_STORE.state.settings, ...patch });
  alfSaveSettings(settings);
  const st = ALF_STORE.state.st;
  alfSaveSt({ ...st, sentSig: '', sentAt: 0 }); // 次の区切りで送り直す(見せないにしたら中身を空にして上書き)
  if (ALF_STORE.state.loaded && typeof ASSISTANT_LIFE_STORE !== 'undefined') { const life = ASSISTANT_LIFE_STORE.state.life; void alfPublish(life, [...new Set([...(life.groups || []).flatMap(g => g.ids), ...Object.keys(life.solo || {})])]); }
};
const assistantLifeFriendMute = (hostId, on) => {
  const muted = ALF_STORE.state.settings.muted.filter(x => x !== hostId);
  assistantLifeFriendSetSettings({ muted: on ? [...muted, hostId] : muted });
};
// いま、その助手がフレンドの家へ行っているか(部屋の札「🏘 〇〇さんの家へ」)
const assistantLifeFriendAwayOf = (id) => {
  if (!alfEnabled()) return null;
  const o = ALF_STORE.state.st.out;
  if (!o || !o.ids.includes(id)) return null;
  const cur = typeof assistantLifeCurrent === 'function' ? assistantLifeCurrent() : null;
  return cur && cur.abs === o.abs ? o : null;
};

// ---------- 台本(段階1の仮。本数はコトバ・ツムギへの注文書で増やす・FRIEND-VISIT-PLAN.md 8章) ----------
// {f} … 相手の家の助手(「あおいさんのドラ」)/{h} … 相手の呼び名(「あおい」)/{v} … 来た・訪ねた側の助手の名前/{name} … プレイヤーの呼び方
// ★助手やマスモンを「子」と呼ばない。よその家なので、けんか・言い合いは起こさない。えるびんは実在の人の私生活を書かない
const ALF_GO_LINES = Object.freeze({
  mua:       ['おじゃましまーす♪ {f}、遊びに来ちゃった！', '{h}さんの家、まぢかわいいぢゃん！'],
  kiki:      ['おじゃまします。{f}さん、今日はよろしくお願いしまつ♪', '{h}さんのお家、落ち着きますね。'],
  momosuke:  ['ももが遊びに来てあげたよ！！{f}、うれしいでしょw', '{h}さんの家、なかなかセンスいいじゃん♡'],
  dra:       ['よっ、{f}。遊びに来たからな、えへへ', '{h}さんの家、いい匂いするな。おやつあるか？'],
  atsu:      ['とりあえず来てみた笑 {f}、元気？', '{h}さんの家、居心地いいな笑'],
  kyuko:     ['ほい！{f}、遊びに来たよ〜', '{h}さんの家、片づいてて動きやすいねぇ。'],
  sorashido: ['うぉぉぉ！{f}、来たぜ・・・！', '{h}さんの家、でーじいい感じだな笑'],
  erubin:    ['こんにちは、{f}。おじゃまするね', '{h}さんの家、あったかい感じがするね。'],
});
// 相手の家の助手の返事(その助手の口調)。{v} … 来た助手の名前
const ALF_REPLY_LINES = Object.freeze({
  mua:       ['{v}ぢゃん！いらっしゃーい♪', 'ゆっくりしてってね！'],
  kiki:      ['{v}さん、いらっしゃいませ♪', 'お茶をいれますね。'],
  momosuke:  ['{v}！ももの家へようこそ！！', 'しかたないから遊んであげる♡'],
  dra:       ['おっ、{v}か。上がってけよな', 'おやつ、半分こしような'],
  atsu:      ['{v}じゃん、いらっしゃい笑', 'てか座って座って笑'],
  kyuko:     ['おけ〜、{v}いらっしゃい！', 'ちょうどひと息つくとこだったんだぁ。'],
  sorashido: ['{v}！よく来たぜ・・・！', 'なんくるないさ〜、くつろいでけ笑'],
  erubin:    ['{v}、来てくれたんだね', '寒くなかった？ゆっくりしてね'],
});
// 同じ助手どうしが会ったとき(❹ A)
const ALF_SAME_LINES = Object.freeze({
  mua: 'もうひとりのあたし！？まぢ！？', kiki: '私がもうひとり…ふしぎな気分でつ。', momosuke: 'ももが2人！？かわいさも2倍じゃん！！',
  dra: 'おでがもうひとりいるな…えへへ', atsu: '俺がいる笑 なんか照れるな笑', kyuko: 'え、俺？ぐぬぬぬ、どっちが本物だぁ',
  sorashido: 'うぉぉぉ！俺がもうひとりいるぜ・・・！', erubin: '自分と会うって、なんだかくすぐったいね',
});
// 帰ってきたとき(おかえり)
const ALF_BACK_LINES = Object.freeze({
  mua: 'ただいま〜！{h}さんの家、楽しかったぢゃん♪', kiki: 'ただいま戻りました。{h}さんのお家、素敵でしたよ。', momosuke: 'ただいま！！{name}、おみやげあるよ♡',
  dra: 'ただいまだな。{h}さんの家、また行きたいな', atsu: 'ただいま笑 {h}さんの家、よかったよ笑', kyuko: 'ただいまぁ。{h}さんの家で、いい話できたよ〜',
  sorashido: 'ただいまだぜ！{h}さんの家、でーじ楽しかった笑', erubin: 'ただいま。{h}さんの家の話、聞いてくれる？',
});
// フレンドの助手が来たとき: 来た助手のあいさつ/迎えた自分の助手
const ALF_GUEST_LINES = Object.freeze({
  mua: '{h}さんちから遊びに来たよ♪', kiki: '{h}さんのところから参りました。おじゃまします。', momosuke: '{h}さんちのももだよ！！遊びに来た！',
  dra: '{h}さんちから来たからな。おじゃまするぞ', atsu: '{h}さんちから来た笑 おじゃまします笑', kyuko: 'ほい！{h}さんちから来たよ〜',
  sorashido: '{h}さんちから来たぜ・・・！', erubin: '{h}さんの家から来たよ。おじゃまするね',
});
const ALF_WELCOME_LINES = Object.freeze({
  mua: 'いらっしゃーい♪ ゆっくりしてってね！', kiki: 'ようこそ。お茶をどうぞ♪', momosuke: 'いらっしゃい！！ももの家、すごいでしょ♡',
  dra: 'よく来たな。おやつあるぞ', atsu: 'いらっしゃい笑 座って座って笑', kyuko: 'いらっしゃ〜い！ちょうどお茶いれたとこ〜',
  sorashido: 'うぉぉぉ！いらっしゃいだぜ・・・！', erubin: 'いらっしゃい。来てくれてうれしいな',
});
// プレイヤーがフレンドの家で相手の助手に声をかけたとき(その助手の口調。{name} はプレイヤー)
const ALF_TALK_LINES = Object.freeze({
  mua:       ['あ、{h}さんのお友だちぢゃん！いらっしゃーい♪', 'あたしのこと、{h}さんから聞いてる？', 'また遊びに来てよ♪'],
  kiki:      ['いらっしゃいませ。{h}さんのお友だちですね。', 'ゆっくりしていってくださいね♪', 'またお会いできるとうれしいでつ。'],
  momosuke:  ['お客さん！？ももに会いに来たんでしょw', 'ももの家、かわいいでしょ♡', 'また来てもいいよ！！'],
  dra:       ['おっ、お客さんだな。いらっしゃい', 'おやつ食べてくか？えへへ', 'また来いよな'],
  atsu:      ['お、いらっしゃい笑', '{h}さんの友だちなら大歓迎笑', 'また来てね笑'],
  kyuko:     ['ほい！いらっしゃ〜い', '{h}さんの友だちかぁ、ありがとん笑', 'またねぇ〜'],
  sorashido: ['うぉぉぉ！お客さんだぜ・・・！', 'ちばりよー！応援してるぜ笑', 'また来いよ笑'],
  erubin:    ['いらっしゃい。来てくれてありがとう', '{h}さんの家、居心地いいでしょ', '気をつけて帰ってね'],
});
// 訪ねた家の台本(2026-11-08 コトバ・ツムギ。docs/progress/assistant-peer/lines/friend-*.txt・注文書 ORDER-FRIEND.md)
//   greet … {name}(訪ねてきたプレイヤー)を迎える/doing … 部屋でしていることごとの迎え/reply … 返事への答え/sleep … 寝ている部屋の寝言
const ALF_VISIT_LINES = Object.freeze({"mua": {"greet": ["はじめましてー！ {h}さんのお友だち？", "わ、お客さんだ！ ゆっくりしてってよー✨", "{name}って言うの？ よろしくね♪"], "doing": {"snack": "いま、おやつ食べてたとこー！ いっしょにどう？", "practice": "ちょうど練習してたの！ 見てってよー♪", "training": "モッチーのお世話中だったの！ かわいいでしょ？", "cards": "カード並べてたとこ！ どれがかわいいと思う？", "read": "雑誌見てたの！ コーデ決めてたとこ♪", "idle": "ちょうどヒマしてたの！ ナイスタイミングぢゃん👍"}, "reply": ["ありがとー！ 来てくれて、まぢうれしい♪", "うんうん(●ﾟｪﾟ))ｺｸｺｸ 楽しんでってね！", "そう言ってもらえると、照れるぢゃんｗ"], "sleep": ["…むにゃ…このリボン…かわいー…", "…すぅ…いらっしゃーい…むにゃ…"]}, "kiki": {"greet": ["まあ、お客さまでつね。ようこそいらっしゃいました", "はじめまして。{h}さんのところの、ききでつ", "{name}、どうぞお入りくださいな♪"], "doing": {"snack": "ちょうど、お茶菓子をいただいていたところでつ。おひとついかが？", "practice": "モンヒロビートの練習中でした。ちから全開でいきまつよ♪", "training": "ゴーレムさんのお世話をしていました。立派でしょう？", "cards": "カードを並べていたところでつ。攻撃のカードばかりですね♪", "read": "本を読んでいました。静かな時間は、いいものでつね", "idle": "ぼんやりお茶を飲んでいたところでした。ゆっくりしていってくださいね"}, "reply": ["ありがとうございます。くつろいでくださいね♪", "そう言っていただけると、うれしいでつ", "どうぞ、お茶でもいれましょうか"], "sleep": ["…すぅ…お茶が…さめてしまいまつ…", "…むにゃ…火力は…こちらに…"]}, "momosuke": {"greet": ["わ、お客さん！！ ももの部屋へようこそ♡", "はじめまして！！ {h}さんちの、ももだよ！！", "{name}、来てくれたの！？ うれしい！！"], "doing": {"snack": "おやつタイム中！！ ひと口あげるw", "practice": "いま練習中！！ ももの音、聞いてって♡", "training": "メタルナーみがいてたとこ！！ ぴかぴかでしょ？", "cards": "カード並べてた！！ かわいいのばっかでしょw", "read": "楽譜見てたの！！ 次の曲、どれにしよっかな", "idle": "ちょうどヒマだったの！！ 遊ぼ遊ぼ！！"}, "reply": ["でしょ！？ ももの自慢の部屋だもん♡", "ありがと！！ ゆっくりしてってねw", "えっへん！！ もっとほめていいよw"], "sleep": ["…すぅ…ライブ…まだ終わらない…", "…むにゃ…ぴかぴか…w"]}, "dra": {"greet": ["お、お客さんか。よく来たな", "はじめましてだな。{h}さんのところのドラだ", "{name}か。ゆっくりしていけよ"], "doing": {"snack": "ちょうどおやつ中だ。ひとつ食うか？", "practice": "モンビーの練習してたとこだ。リズムきざむぞ", "training": "グジラの世話してたんだ。でっかいだろ", "cards": "山札を確かめてたとこだ。見ていくか？", "read": "説明書きを読んでたんだ。わかりやすく書いてあるな", "idle": "ぼーっとしてたとこだ。ちょうどよかったな、えへへ"}, "reply": ["そうか、ありがとな。くつろいでいけ", "おでの部屋、気に入ったか？", "まあ、座ってくれ。おやつもあるぞ"], "sleep": ["…ぐぅ…グジラ…まだ食べるのか…", "…すぅ…いらっしゃい…むにゃ…"]}, "atsu": {"greet": ["お、いらっしゃい！ {h}さんの友だちだよね笑", "{name}、来てくれたんだ！ ゆっくりしてって笑", "おっ、お客さん笑 遠慮しないで入って！"], "doing": {"snack": "ちょうどおやつ食べてた笑 一個どう？", "practice": "いま一曲叩いてたとこ笑 {name}も聞いてく？", "training": "ドラゴンの世話してた笑 ちょっと待ってて！", "cards": "デッキ組み直してたとこ笑 見ていく？", "read": "本読んでたら、ちょっと寝そうだった笑 来てくれて助かる！", "idle": "ぼーっとしてた笑 ちょうど話し相手ほしかった！"}, "reply": ["ありがと笑 くつろいでって！", "そう言ってもらえると、うれしい笑", "いいって笑 {h}さんにも伝えとく！"], "sleep": ["……次の一曲、いける……", "……ドラゴン、えらいぞ……( *'ω'*)ノ"]}, "kyuko": {"greet": ["ほい、いらっしゃ〜い。{name}、ようこそだよぉ", "あ、お客さんだぁ。{h}さんの友だちかな？", "ちょうどひと休みしたかったんだぁ。どうぞどうぞ"], "doing": {"snack": "おやつ食べてたとこ〜。一緒にどう？", "practice": "いま練習してたんだぁ。ちょっと聞いてってよぉ", "training": "ニャーの世話してたとこ〜。かわいいでしょ笑", "cards": "新しい組み方、考えてたんだぁ。見る？", "read": "本読んでたとこ〜。いいところで来たねぇ笑", "idle": "ぼーっと音楽聞いてたんだぁ。座っていいよぉ"}, "reply": ["ありがとん笑 ゆっくりしてってねぇ", "そう言ってもらえると、うれしいなぁ", "ほい、どういたしまして〜。{h}さんも喜ぶよぉ"], "sleep": ["……むにゃ……あと一ページ……", "……ニャー、そこはだめだよぉ……"]}, "sorashido": {"greet": ["うぉぉぉ！ お客さんだ！ よく来てくれたな", "{name}、いらっしゃい！ くつろいでくれ笑", "{h}さんの友だちか。ゆっくりしていけよ"], "doing": {"snack": "ちょうどちんすこう食べてたんだ。一緒にどうだ？", "practice": "いま練習してたんだ！ 聞いていくか？", "training": "育成の記録をつけてたとこだ。ちょっと待っててくれ", "cards": "新しい表を作ってたんだぜ・・・！ 見ていくか？", "read": "本を読んでたんだ。いいところで来たな笑", "idle": "考えごとしてたんだ。話し相手ができてうれしいぞ"}, "reply": ["ありがとな！ でーじうれしいぞ笑", "そう言ってもらえると、表を作ったかいがあるな", "気をつかわなくていいぞ。ゆっくりしてくれ"], "sleep": ["……うぉぉ……むにゃ……表が……", "……なんくるないさ〜……すぅ……"]}, "erubin": {"greet": ["いらっしゃい。{name}、来てくれてありがとう", "はじめまして、かな。{h}さんのお友だちだね", "ようこそ。ゆっくりしていってね☺️"], "doing": {"snack": "ちょうどお茶とおやつの時間だったんだ。一緒にどうかな？", "practice": "いま練習してたところだよ。少し聞いていく？", "training": "デュラハンのお世話をしてたんだ。おとなしいでしょ", "cards": "カードの組み方を考えてたんだ。見ていく？", "read": "本を読んでたんだ。静かでいい時間だね", "idle": "窓の外をながめてたんだ。ちょうどよかったよ"}, "reply": ["ありがとう。そう言ってもらえるとうれしいな", "どういたしまして。気をつかわなくていいからね", "うん、{h}さんにも伝えておくね"], "sleep": ["……みんな、元気かな……", "……デュラハン、そこで守って……"]}});
// フレンドの家へ行ったとき・迎えるときに足す台本(前からの ALF_GO_LINES・ALF_WELCOME_LINES と合わせて選ぶ)
const ALF_GO_MORE = Object.freeze({"mua": ["{h}さんの家、おしゃれすぎぢゃない！？", "{f}の部屋、見せてもらってもいい？"], "kiki": ["{h}さんのお家、落ち着いたすてきなお部屋でつね", "{f}、おじゃましまつ。お茶をお持ちしました♪"], "momosuke": ["{h}さんちの部屋、かわいいじゃん！！", "{f}、遊びに来たよ！！ 練習見せて♡"], "dra": ["{h}さんの家か。いい部屋だな", "{f}、おじゃまするぞ。おやつ持ってきた"], "atsu": ["{f}、遊びに来た笑 なんかして遊ぼ！", "{h}さんの部屋、いい感じじゃん！ また来たいな笑"], "kyuko": ["{f}、遊びに来たよぉ。何してたの？", "{h}さんの部屋、本がありそうで落ち着くねぇ"], "sorashido": ["{f}、遊びに来たぞ！ 今日はなにする？", "{h}さんの部屋、でーじ落ち着くな笑"], "erubin": ["{f}、遊びに来たよ。元気だったかな？", "{h}さんの部屋、やさしい感じがするね"]});
const ALF_WELCOME_MORE = Object.freeze({"mua": ["{f}だ！ 来てくれたの、まぢうれしい♪", "あたしの部屋、こっちだよー！ ゆっくりしてってね✨"], "kiki": ["{f}、ようこそ。お茶をおいれしまつね", "遠いところ、ありがとうございまつ。ゆっくりしていってくださいな"], "momosuke": ["{f}だ！！ ももの部屋、案内するね♡", "いらっしゃい！！ おやつ用意してあるよw"], "dra": ["{f}か、よく来たな。ゆっくりしていけ", "おでの部屋はこっちだ。散らかってるけどな"], "atsu": ["いらっしゃい！ 来てくれたの、まじでうれしい笑", "{f}、よく来たじゃん笑 ゆっくりしてって！"], "kyuko": ["いらっしゃ〜い。{f}、待ってたよぉ", "ほい、上がって上がって〜。お茶いれるねぇ"], "sorashido": ["よく来たな！ {f}、待ってたぞ", "いらっしゃい！ ゆっくりしていけよ笑"], "erubin": ["いらっしゃい、{f}。ゆっくりしていってね", "来てくれてうれしいよ。お茶をいれるね"]});
// 置き手紙の決まった一言(番号は表に残す。0〜11)とお礼(0〜5)
const ALF_WORD_TEXTS = Object.freeze(['楽しかった！', 'また来るね', 'おじゃましました', 'おやつおいしかった', 'いい部屋だったよ', 'また遊ぼうね',
  'ゆっくりできた', 'ありがとう', 'お話しできてうれしかった', 'みんな元気そうだった', 'また会いたいな', 'お留守のあいだにおじゃましました']);
const ALF_THANKS_TEXTS = Object.freeze(['来てくれてありがとう！', 'またいつでも来てね', 'うれしかったよ', '今度はこっちから行くね', 'みんな喜んでたよ', 'おつかれさま！']);
const ALF_DOING_ROOM = Object.freeze({ snack: 'おやつ中', practice: '練習中', training: '育成中', cards: 'カード研究中', walk: '散歩中', idle: 'のんびり中', sleep: 'おやすみ中', read: '読書中' });
// name … {name} に入れる呼び方を決めて渡すとき(よその家の助手が、訪ねてきたプレイヤーを呼ぶ: 「◯◯さん」)
const alfFill = (text, { f = '', h = '', v = '', who = null, name = null } = {}) => String(text || '')
  .replace(/\{f\}/g, f).replace(/\{h\}/g, h).replace(/\{v\}/g, v)
  .replace(/\{name\}/g, () => (name != null ? name : typeof assistantPeerPlayerCall === 'function' ? assistantPeerPlayerCall(who) : 'あなた'));
const alfPickOne = (arr) => (Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : '');
const alfTheirLabel = (hostName, aid) => `${hostName}さんの${assistantLifeName(aid)}`;
// 行った場面(2〜4行)。lines: [{ who, guest, text }]。guest=true は相手の家の助手
const assistantLifeFriendGoScene = (o, n = 0) => {
  if (!o) return null;
  const viaApi = o.theirs.length ? alfApiSceneFor('go', o.ids[0], o.theirs.includes(o.ids[0]) ? o.ids[0] : o.theirs[0], o.name) : null;
  if (viaApi) return { kind: 'go', title: `🏘 ${o.name}さんの家`, lines: viaApi, host: o.name };
  const mine = o.ids; const theirs = o.theirs.length ? o.theirs : [];
  const lines = [];
  const t0 = theirs[0];
  const pick = (arr) => arr[(n + mine.length) % arr.length];
  lines.push({ who: mine[0], text: alfFill(pick([...(ALF_GO_LINES[mine[0]] || ['おじゃまします']), ...(ALF_GO_MORE[mine[0]] || [])]), { f: t0 ? alfTheirLabel(o.name, t0) : `${o.name}さん`, h: o.name, who: mine[0] }) });
  if (t0) lines.push({ who: t0, guest: true, text: alfFill(pick(ALF_REPLY_LINES[t0] || ['いらっしゃい']), { v: mine.map(assistantLifeName).join('と'), who: t0 }) });
  const same = mine.find(id => theirs.includes(id));
  if (same) lines.push({ who: same, text: alfFill(ALF_SAME_LINES[same] || '', { who: same }) });
  if (mine[1]) lines.push({ who: mine[1], text: alfFill((ALF_GO_LINES[mine[1]] || ['', ''])[1] || 'おじゃまします', { h: o.name, who: mine[1] }) });
  return { kind: 'go', title: `🏘 ${o.name}さんの家`, lines: lines.filter(l => l.text).slice(0, 4), host: o.name };
};
const assistantLifeFriendBackScene = (o) => (o ? { kind: 'back', title: 'おかえり！', host: o.name,
  lines: o.ids.map(id => ({ who: id, text: alfFill(ALF_BACK_LINES[id] || 'ただいま', { h: o.name, who: id }) })) } : null);
const assistantLifeFriendComeScene = (c) => {
  const viaApi = c && c.mine ? alfApiSceneFor('come', c.mine, c.aid, c.name) : null;
  if (viaApi) return { kind: 'come', title: `🏘 ${c.name}さんの${assistantLifeName(c.aid)}が来た`, host: c.name, lines: viaApi };
  return alfComeSceneScript(c);
};
const alfComeSceneScript = (c) => (c ? { kind: 'come', title: `🏘 ${c.name}さんの${assistantLifeName(c.aid)}が来た`, host: c.name,
  lines: [{ who: c.aid, guest: true, text: alfFill(ALF_GUEST_LINES[c.aid] || 'おじゃまします', { h: c.name, who: c.aid }) },
    ...(c.mine ? [{ who: c.mine, text: alfFill(c.mine === c.aid ? ALF_SAME_LINES[c.mine] : alfPickOne([ALF_WELCOME_LINES[c.mine], ...(ALF_WELCOME_MORE[c.mine] || [])].filter(Boolean)), { f: alfTheirLabel(c.name, c.aid), who: c.mine }) }] : [])] } : null);

// ---------- Claude API の場面(kind:'friend_scenes'・1日1回まとめて) ----------
// 送るのは助手の id の組だけ(フレンドの呼び名・プレイヤーの呼び名・ブリーダーID以外の情報は送らない)。
// 印 assistantLifeFriendApi が偽・スイッチが on でない(thin/off)・失敗・上限のときは頼まない/台本だけで出す
const ALF_API_ASK_MAX = 2;
let _alfApiBusy = false;
const alfApiEnabled = () => alfEnabled() && RELEASE_FLAGS.assistantLifeFriendApi === true && typeof ASSISTANT_CHAT_URL === 'string';
// 頼む組: 行けそうな家の助手 × 家にいる自分の助手(go)と、来そうな組(come)。同じ助手どうしも混ぜる
const alfApiPairs = (life, houses) => {
  const mine = Object.entries((life && life.solo) || {}).filter(([id, s]) => alfValidId(id) && s.place === 'home' && s.doing !== 'sleep').map(([id]) => id).sort();
  const pairs = []; const seen = new Set();
  const add = (kind, a, b) => { const k = `${kind}|${a}|${b}`; if (!seen.has(k) && pairs.length < 6) { seen.add(k); pairs.push({ kind, a, b }); } };
  for (const h of (houses || []).slice(0, 4)) {
    const theirs = alfHomeIds(h.house);
    if (!theirs.length || !mine.length) continue;
    const same = mine.find(id => theirs.includes(id));
    add('go', mine[pairs.length % mine.length], same || theirs[0]);
    add('come', mine[(pairs.length + 1) % mine.length], theirs[theirs.length - 1]);
  }
  return pairs;
};
const assistantLifeFriendRequestScenes = async (life) => {
  if (!alfApiEnabled() || _alfApiBusy || ALF_STORE.state.mode !== 'on') return 'skip';
  const st = alfToday();
  const api = st.api && st.api.day === st.day ? st.api : { day: st.day, asked: 0, list: [], used: [] };
  if (api.list.some(x => !api.used.includes(`${x.kind}|${x.a}|${x.b}`))) return 'cached';
  if (api.asked >= ALF_API_ASK_MAX) return 'skip';
  const pairs = alfApiPairs(life, alfOpenHouses('go'));
  if (!pairs.length) return 'skip';
  const self = await alfSelf();
  if (!self) return 'skip';
  _alfApiBusy = true;
  alfSaveSt({ ...alfToday(), api: { ...api, asked: api.asked + 1 } });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let res = null;
    try {
      const r = await fetch(ASSISTANT_CHAT_URL, { method: 'POST', headers: SB_HEADERS, signal: controller.signal, body: JSON.stringify({ kind: 'friend_scenes', breederId: self, pairs }) });
      res = r.ok ? await r.json() : null;
    } finally { clearTimeout(timer); }
    if (!res || res.ok !== true || !Array.isArray(res.scenes)) return 'failed';
    const cur = alfToday();
    const base = cur.api && cur.api.day === cur.day ? cur.api : { day: cur.day, asked: 1, list: [], used: [] };
    const next = alfNormalizeApi({ ...base, list: [...base.list, ...res.scenes] });
    alfSaveSt({ ...cur, api: next });
    return next && next.list.length ? 'ok' : 'failed';
  } catch { return 'failed'; } finally { _alfApiBusy = false; }
};
// 作った文を、助手ごとの口調の決まりに合わせる。合わせられない文は null(場面ごと台本へ)。
//   2026-11-08 本番の試しで「みゅあの じゃん」「膝に座る」が返ってきたため(docs/progress/assistant-peer/VOICE.md の決まり)
const ALF_API_BODY_WORDS = /膝|ひざ|抱き|だっこ|キス|ちゅー|添い寝|くっつ|手をつな|お風呂|ベッド|恋|デート|付き合|好きだよ|大好き/;
const alfApiLineOk = (who, t) => {
  let x = String(t || '');
  if (who === 'mua') x = x.replace(/じゃん/g, 'ぢゃん').replace(/まじ/g, 'まぢ').replace(/マジ/g, 'マヂ');
  if (ALF_API_BODY_WORDS.test(x) || /(この|あの|その)子|子たち/.test(x)) return null;
  if (who === 'atsu') { x = x.trim().replace(/。$/, '！'); if (!/(笑|[！？!?…♪w]|[)）][ノﾉｼ]?|[\u3000-\u303f]?[\uff08(][^)）]*[)）]|\p{Extended_Pictographic}\uFE0F?)$/u.test(x)) return null; }
  // ドラの関西弁(中継役の FRIEND_DRA_KANSAI と同じ。「やろう」「撮る」は通す・2026-11-08 オトズレ3)
  if (who === 'dra' && /ほんま|やで|っとる|っとん|とんだ|やろ(?!う)|あかん|へん[。、！]|ええ(な|で|やん|わ)|(草|くさ)[。！!w]*$/.test(x)) return null;
  if (who === 'kiki' && /(だよ|だね|してよ|じゃん)([。！!？?♪]|$)/.test(x)) return null;
  if (who !== 'mua' && /ぢゃん|まぢ/.test(x)) return null;
  return x;
};
// 作った場面があれば使う(その組で1回だけ)。無ければ null(台本へ)
const alfApiSceneFor = (kind, a, b, hostName) => {
  if (!alfApiEnabled()) return null;
  const st = ALF_STORE.state.st;
  const api = st.api && st.api.day === st.day ? st.api : null;
  if (!api) return null;
  const key = `${kind}|${a}|${b}`;
  const sc = api.list.find(x => `${x.kind}|${x.a}|${x.b}` === key && !api.used.includes(key));
  if (!sc) return null;
  const lines = sc.lines.map(l => {
    const who = l.side === 'a' ? a : b;
    const t = String(l.t).replace(/\{f\}/g, l.side === 'a' ? alfTheirLabel(hostName, b) : assistantLifeName(a)).replace(/\{h\}/g, hostName)
      .replace(/\{name\}/g, () => (l.side === 'a' && typeof assistantPeerPlayerCall === 'function' ? assistantPeerPlayerCall(a) : 'あなた'));
    const ok = alfApiLineOk(who, t);
    return !ok || /[{}]/.test(ok) || ok.length > 80 ? null : { who, guest: l.side === 'b', text: ok };
  });
  if (lines.some(x => !x)) return null;
  alfSaveSt({ ...st, api: { ...api, used: [...api.used, key].slice(-12) } });
  return lines;
};

// ---------- 画面 ----------
const alfAgoText = (at, now = Date.now()) => {
  if (!at) return '';
  const d = new Date(at + 9 * 3600000); const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  const days = Math.round((Date.parse(`${alfDay(now)}T00:00:00Z`) - Date.parse(`${alfDay(at)}T00:00:00Z`)) / 86400000);
  return days <= 0 ? `今日 ${hm}` : days === 1 ? `きのう ${hm}` : `${days}日前`;
};
// 窓と訪問の画面は、家の画面の器(data-assistant-life-screen)の直下へ出す(タブの中だと下のアイコンの列の下に隠れる)。器が無ければその場に出す
const alfLayer = (node) => {
  const host = typeof document !== 'undefined' ? document.querySelector('[data-assistant-life-screen]') : null;
  return host && typeof ReactDOM !== 'undefined' && ReactDOM.createPortal ? ReactDOM.createPortal(node, host) : node;
};
function AlfFace({ id, size = 30 }) {
  const who = typeof assistantById === 'function' ? assistantById(id) : null;
  return who ? <span className="inline-flex shrink-0" data-alf-face={id}><AssistantFace who={who} size={size} accent={who.accent}/></span> : null;
}
// 場面(行った・おかえり・来た)。下から出る小さな窓
function AlfSceneSheet({ scene, onClose }) {
  if (!scene) return null;
  return alfLayer(
    <div className="absolute inset-0 flex items-end justify-center bg-black/55 sm:items-center" style={{ zIndex: 45 }} data-alf-scene={scene.kind} onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-t-3xl border border-amber-300/40 bg-slate-950/95 p-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[13px] font-black text-amber-200" data-alf-scene-title>{scene.title}</p>
        <div className="mt-2 space-y-2">
          {scene.lines.map((l, i) => (
            <div key={i} className={`flex items-end gap-2 ${l.guest ? 'flex-row-reverse' : ''}`} data-alf-scene-line>
              <AlfFace id={l.who} size={36}/>
              <div className={`min-w-0 rounded-2xl border px-2.5 py-1.5 text-[12px] leading-snug ${l.guest ? 'border-sky-300/40 bg-sky-950/70 text-sky-50' : 'border-pink-300/40 bg-pink-950/60 text-pink-50'}`}>
                <p className="text-[9.5px] font-black opacity-80">{l.guest ? alfTheirLabel(scene.host, l.who) : assistantLifeName(l.who)}</p>
                <p>{l.text}</p>
              </div>
            </div>))}
        </div>
        {scene.reward && <p className="mt-2 text-[11px] font-black text-amber-200" data-alf-scene-reward>{scene.reward}</p>}
        <button type="button" className="mt-3 w-full rounded-2xl bg-amber-300 py-2 text-[13px] font-black text-slate-950" data-alf-scene-close data-mhl-sheet-close onClick={onClose}>とじる</button>
      </div>
    </div>);
}
// プレイヤーがフレンドの家(控え)を見て回る(P1 家の中/P2 声をかける→返事を3つから/P3 置き手紙を残して帰る)
const ALF_PLAYER_REPLIES = Object.freeze(['こんにちは！', 'おじゃましてます', 'すてきな部屋だね']);
// 訪ねた家(2026-11-08 社長「こんな文字だけ出されてもいみわかんない」「自分の画面と同じように」で作り直し)。
//   自分の助手ライフの家と同じ家の絵(56-assistant-life-house の AssistantLifeHouseArt)に、その人の家の控えを描く。
//   部屋を押すと、その助手のシート(話す・置き手紙)。おでかけ中・おやすみ中の部屋も見られる。
//   下(横は右)に「この家でできること」。置き手紙を残すと何が届くかを1行で出す
// 「。」で区切った文を、言葉の途中で折らずに並べる(ミハリ「部屋は見られ/ます」)
const alfNoBreak = (text) => { const parts = String(text || '').split('。').filter(Boolean); return parts.map((x, i) => <span key={i} className="whitespace-nowrap">{x}{i < parts.length - 1 || /。$/.test(text) ? '。' : ''}</span>); };
const alfRoomsOf = (house) => {
  const rooms = {};
  for (const id of ALF_IDS) {
    const r = house && house.r[id];
    if (!r) { rooms[id] = null; continue; }
    const doing = (ASSISTANT_LIFE_DOINGS[r.d] || {}).label || 'のんびり';
    if (r.at !== 'home') rooms[id] = r.p && typeof assistantLifePlaceShow === 'function'
      ? { tag: [`${(typeof ASSISTANT_LIFE_PLACE_ICON !== 'undefined' && ASSISTANT_LIFE_PLACE_ICON[r.p]) || '🚶'} ${assistantLifePlaceShow(r.p)}へ`, doing] }
      : { tag: ['🚶 おでかけ中', 'いまは家にいない'] };
    else if (r.d === 'sleep') rooms[id] = { in: [id], sleep: true, bub: ['💤 おやすみ中'] };
    else rooms[id] = { in: [id], bub: ['部屋で', doing] };
  }
  return rooms;
};
const alfFurnPutOf = (house) => {
  const o = {};
  for (const id of house ? house.ids : []) { const fu = house.r[id] && house.r[id].fu; if (fu) o[id] = { put: { ceil: fu.c || null, wall: fu.w || null, floor: fu.f || null } }; }
  return o;
};
function AlfFriendHouseView({ friend, onClose }) {
  const fs = useAssistantLifeFriendState();
  // 訪ねているあいだは、自分の「いまの状態」を「🏘 フレンドの家に遊びに行っている」にする(持ち主の名前は送らない・34-friends-api)
  React.useEffect(() => { if (typeof friendsSetLifeVisit !== 'function') return undefined; friendsSetLifeVisit(true); return () => friendsSetLifeVisit(false); }, []);
  const [roomId, setRoomId] = React.useState(null);
  const [noteText, setNoteText] = React.useState('');
  const [talk, setTalk] = React.useState(null); // { aid, text, step }  step 0=あいさつ(返事を選ぶ) 1=反応
  const [talked, setTalked] = React.useState([]);
  const [leaving, setLeaving] = React.useState(null); // 置き手紙のあて先(助手の id か '' = 家のみんなへ)
  const [done, setDone] = React.useState(null);
  const [noteWarn, setNoteWarn] = React.useState('');
  const [boardOpen, setBoardOpen] = React.useState(false);
  const [selfName, setSelfName] = React.useState('');
  React.useEffect(() => { let alive = true; (async () => { try { const n = typeof storeGet === 'function' ? await storeGet('mh_breeder_name', '') : ''; if (alive && typeof n === 'string' && n && n !== '名無しのブリーダー') setSelfName(n.slice(0, 10)); } catch {} })(); return () => { alive = false; }; }, []);
  const { w: vw, h: vh } = typeof useAssistantLifeViewSize === 'function' ? useAssistantLifeViewSize() : { w: 390, h: 844 }; // 🔄横では回した器の幅・高さ
  React.useEffect(() => { if (friend && friend.id) void alfFetchMore(friend.id); }, [friend && friend.id]);
  // その人のいまの状態(34-friends-api の friendsPresenceFor。訪ねたときに1回だけ読む)
  const [now, setNow] = React.useState(null);
  React.useEffect(() => { let alive = true; if (friend && friend.id && typeof friendsPresenceFor === 'function') void friendsPresenceFor([friend.id]).then(p => { if (alive) setNow((p || {})[friend.id] || null); }).catch(() => {}); return () => { alive = false; }; }, [friend && friend.id]);
  if (!friend || !friend.house) return null;
  const more = (fs.more || {})[friend.id] || null;
  const h = friend.house;
  const can = assistantLifeFriendCanLook(friend.id);
  const land = vw > vh;
  const look = typeof assistantLifeTimeLook === 'function' ? assistantLifeTimeLook() : 'day';
  const rooms = alfRoomsOf(h);
  const metSet = new Set(h.ids);
  const home = alfHomeIds(h).filter(id => h.r[id].d !== 'sleep');
  const pad = 12;
  const houseW = land ? Math.min(560, Math.round(vw * 0.64) - pad * 2) : Math.min(380, vw - pad * 2);
  const lines = (aid) => ALF_TALK_LINES[aid] || ['いらっしゃい', 'ありがとう', 'またね'];
  // よその家の助手が {name} と呼ぶのは、訪ねてきたあなたの表示名(「◯◯さん」)
  const visitor = `${selfName || 'お客'}さん`;
  const vl = (aid) => ALF_VISIT_LINES[aid] || { greet: [], doing: {}, reply: [], sleep: [] };
  const greet = (aid) => {
    const d = h.r[aid] && h.r[aid].d;
    const byDoing = vl(aid).doing[d];
    const text = byDoing && Math.random() < 0.6 ? byDoing : alfPickOne([lines(aid)[0], ...vl(aid).greet]);
    setRoomId(aid); setTalk({ aid, step: 0, text: alfFill(text, { h: friend.name, who: aid, name: visitor }) });
  };
  const reply = (i) => { if (!talk) return; setTalked(t => [...new Set([...t, talk.aid])]); setTalk({ ...talk, step: 1, mine: ALF_PLAYER_REPLIES[i], text: alfFill(alfPickOne([lines(talk.aid)[1 + (i % 2)], ...vl(talk.aid).reply]), { h: friend.name, who: talk.aid, name: visitor }) }); };
  const leave = async (word) => {
    const to = leaving || null;
    const r = await assistantLifeFriendLeaveNote(friend.id, { word, talked, name: friend.name, note: noteText, noteTo: to });
    if (!(r && r.ok) && r && /書けません|書き直/.test(r.reason || '')) { setDone(null); setNoteWarn(r.reason); return; }
    setLeaving(null); setRoomId(null); setTalk(null); setNoteText('');
    setDone(r && r.ok ? `✉️ 置き手紙「${ALF_WORD_TEXTS[word]}」を残しました${r.photo ? '・📷 写真1枚' : ''}${r.beatP ? `・🎁 ビートP ${r.beatP}(ギフトに届きます)` : ''}` : `⚠️ ${(r && r.reason) || '置き手紙を残せませんでした(時間をおいてもう一度)'}`);
  };
  // 置き手紙の1行(押す前に、何が届くか・今日できるかが分かるように)
  const noteLine = done ? done
    : can === 'ok' ? `✉️ 置き手紙を残すと、${friend.name}さんに「あなたが訪ねてくれた」と一言が届きます(ビートP 50)`
    : can === 'done' ? `✉️ この家には今日もう置き手紙を残しました。見て回るのは自由です`
    : `✉️ 今日はもう置き手紙を残せません(朝4時に戻ります)。見て回るのは自由です`;
  const r0 = roomId ? h.r[roomId] : null;
  const roomState = !r0 ? null : r0.at !== 'home' ? 'out' : r0.d === 'sleep' ? 'sleep' : 'home';
  // 家具: くわしい控えがあればそれ、無ければ今の控え
  const putOf = (id) => (more && more.fu[id] ? more.fu[id].p : (h.r[id] && h.r[id].fu) || null);
  const fname = (k) => { const f = typeof assistantLifeFurnOf === 'function' ? assistantLifeFurnOf(k) : null; return f ? `${f.emoji} ${f.name}` : null; };
  const furnNames = (id) => { const fu = putOf(id); return fu ? ['c', 'w', 'f'].map(k => fu[k] && fname(fu[k])).filter(Boolean) : []; };
  const keptNames = (id) => (more && more.fu[id] ? more.fu[id].k.map(fname).filter(Boolean) : []);
  const masmonOf = (id) => { const pl = typeof assistantMasmonPlanOf === 'function' ? assistantMasmonPlanOf(id) : null; return pl ? pl.team.slice(0, 3).map(t => { const m = typeof assistantMasmonMon === 'function' ? assistantMasmonMon(t.monster) : null; return m ? `${t.nick}(${m.name})` : null; }).filter(Boolean) : []; };
  const otherPut = (() => { const o = alfFurnPutOf(h); if (more) for (const id of Object.keys(more.fu)) o[id] = { put: { ceil: more.fu[id].p.c || null, wall: more.fu[id].p.w || null, floor: more.fu[id].p.f || null } }; return o; })();
  // 掲示板: 助手の今日(dy)と、その人の最近の遊び(ac)を混ぜる(最近は先に。時刻は「今日 10:10」などの形)
  const actItems = more && more.ac ? more.ac.map(a => ({ t: alfAgoText(a.at).replace(/^今日 /, ''), x: `${ALF_ACT_ICON[a.k] || '✨'} ${a.x}`, act: a.k })) : [];
  const diaryItems = [...actItems, ...(more && more.dy.length ? more.dy : (h.dy || []))].slice(0, 10);
  const header = (
    <div className="mhl-hdr flex items-start gap-2" style={{ paddingTop: land ? 6 : 'calc(8px + env(safe-area-inset-top))' }}>
      <button type="button" className="h-9 w-8 shrink-0 text-[19px] text-slate-100" aria-label="もどる" data-alf-visit-close onClick={onClose}>←</button>
      {/* 右上は「仲良し度 +10」などの知らせ(44-growth-fx の .mh-gfx-chips)が出る所なので、題は左に寄せて右を空ける */}
      <div className="min-w-0" style={{ maxWidth: land ? '100%' : '48%' }}>
        <p className="mhl-en whitespace-nowrap">VISIT · FRIEND HOUSE</p>
        <p className="truncate text-[17px] font-black text-amber-100" data-alf-visit-title>🏘 {friend.name}さんの家</p>
        <p className="text-[10px] font-bold text-slate-200"><span className="whitespace-nowrap">📷 {alfAgoText(friend.at)} の様子</span>・<span className="whitespace-nowrap">{friend.name}さんが最後に開いたとき</span></p>
        {now && now.online && <p className={`mt-0.5 inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10.5px] font-black ${now.auto ? 'bg-amber-950/80 text-amber-200' : 'bg-emerald-950/70 text-emerald-200'}`} data-alf-visit-now>いま {now.long || now.text}</p>}
      </div>
    </div>);
  const tiles = (
    <div data-alf-visit-acts>
      <p className="mb-1 text-[10px] font-black text-slate-200">この家でできること</p>
      <div className="grid grid-cols-3 gap-1.5">
        <button type="button" className="mhl-tile mhl-call" disabled={!home.length} data-alf-visit-act="talk" onClick={() => home[0] && greet(home[0])}><i>💬</i><b>話す</b><small>{home.length ? `家にいる ${home.length}人` : 'いまはだれも'}</small></button>
        <button type="button" className="mhl-tile mhl-watch" data-alf-visit-act="peek" onClick={() => setRoomId(h.ids[0] || null)}><i>👀</i><b>部屋を見る</b><small>部屋を押す</small></button>
        <button type="button" className="mhl-tile mhl-give" disabled={can !== 'ok' || !!done} data-alf-visit-leave onClick={() => { setRoomId(null); setNoteWarn(''); setLeaving(''); }}><i>✉️</i><b>置き手紙</b><small>{done ? '残した' : can === 'ok' ? '今日あと1回' : '今日は残した'}</small></button>
      </div>
      <p className="mt-1.5 rounded-xl bg-slate-950/85 px-2 py-1 text-[10.5px] font-bold leading-snug text-amber-100" data-alf-visit-note={done ? 'done' : can}>{noteLine}</p>
      <p className="mt-1 text-[9.5px] leading-snug text-slate-300">{friend.name}さんのセーブや、{friend.name}さんの助手の仲良し度は変わりません。</p>
    </div>);
  const board = diaryItems.length ? (
    <div className="mt-1 rounded-xl bg-amber-50/90 px-2 py-1 text-amber-950" data-alf-visit-diary>
      <p className="text-[10px] font-black">📌 {friend.name}さんの家の最近</p>
      {diaryItems.slice(0, land ? 5 : 3).map((d, i) => <p key={i} className="text-[10px] font-bold leading-snug"><b className="mr-1">{d.t}</b>{d.x}</p>)}
    </div>) : null;
  const houseView = (
    <div className="relative pt-1" style={{ paddingInline: pad }} data-alf-visit-house>
      <AssistantLifeHouseArt width={houseW} land={land} look={look} rooms={rooms} metSet={metSet} onOpen={(id) => { setTalk(null); setLeaving(null); setRoomId(id); }}
        diary={{ items: [...diaryItems].reverse().map(d => ({ t: d.t, text: d.x })) }} pop={false} onBoard={() => setBoardOpen(true)} hname={`🏡 ${friend.name}さんの家`} other={otherPut}/>
    </div>);
  const sheet = roomId && r0 ? (
    <div className="absolute inset-0" style={{ zIndex: 30 }} data-alf-visit-sheet={roomId}>
      <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/55" onClick={() => { setRoomId(null); setTalk(null); }}/>
      <div className="mhl-sheet" style={land ? { left: 'auto', width: '44%', top: 0, maxHeight: '100%', paddingTop: 92, borderRadius: '22px 0 0 22px' } : { maxHeight: 'calc(100% - 96px)' }}>
        <div className="flex items-center gap-2">
          <AlfFace id={roomId} size={46}/>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-black text-white">{alfTheirLabel(friend.name, roomId)}の部屋</p>
            <p className="text-[11px] font-bold text-slate-200" data-alf-visit-room-state={roomState}>{alfNoBreak(roomState === 'out' ? (r0.p && typeof assistantLifePlaceShow === 'function' ? `${(typeof ASSISTANT_LIFE_PLACE_ICON !== 'undefined' && ASSISTANT_LIFE_PLACE_ICON[r0.p]) || '🚶'} ${assistantLifePlaceShow(r0.p)}へおでかけ中。部屋は見られます` : '🚶 いまはおでかけ中。部屋は見られます') : roomState === 'sleep' ? '💤 すやすや…起こさないように、そっと見るだけ' : `🏠 部屋で${(ASSISTANT_LIFE_DOINGS[r0.d] || {}).label || 'のんびり'}`)}</p>
          </div>
          <button type="button" data-mhl-sheet-close className="shrink-0 rounded-xl border border-slate-500 px-3 py-1.5 text-[12px] font-black text-slate-100" onClick={() => { setRoomId(null); setTalk(null); }}>とじる</button>
        </div>
        <p className="mt-2 text-[11px] font-bold text-slate-200" data-alf-visit-furn>🪑 贈られた家具: {furnNames(roomId).length ? furnNames(roomId).join('・') : 'まだありません'}</p>
        {keptNames(roomId).length > 0 && <p className="mt-0.5 text-[10.5px] text-slate-300" data-alf-visit-kept>📦 押し入れ: {keptNames(roomId).join('・')}</p>}
        {masmonOf(roomId).length > 0 && <p className="mt-0.5 text-[10.5px] text-slate-300" data-alf-visit-masmon>🐾 マスモン: {masmonOf(roomId).join('・')}</p>}
        {talk && talk.aid === roomId ? (
          <div className="mt-2" data-alf-visit-talk>
            {talk.mine && <p className="mb-1 text-right text-[12.5px] text-pink-100" data-alf-visit-mine>あなた「{talk.mine}」</p>}
            <div className="flex items-end gap-2">
              <AlfFace id={talk.aid} size={40}/>
              <p className="min-w-0 rounded-2xl border border-sky-300/40 bg-sky-950/70 px-3 py-2 text-[14px] leading-snug text-sky-50">{talk.text}</p>
            </div>
            {talk.step === 0 && <><p className="mt-2 text-[10px] font-bold text-slate-300">返事を押すと、{assistantLifeName(roomId)}が答えてくれます</p>
              <div className="mt-1 grid grid-cols-3 gap-1.5" data-alf-visit-replies>{ALF_PLAYER_REPLIES.map((t, i) => <button key={i} type="button" className="rounded-xl border border-pink-200/50 bg-pink-950/50 px-1 py-2.5 text-[12px] font-black text-pink-50" data-alf-reply={i} onClick={() => reply(i)}>{t}</button>)}</div></>}
          </div>)
          : roomState === 'home' ? <button type="button" className="mhl-btn mt-2 w-full bg-sky-600" data-alf-visit-room={roomId} onClick={() => greet(roomId)}>💬 {assistantLifeName(roomId)}に話しかける</button>
          : <>{roomState === 'sleep' && vl(roomId).sleep.length > 0 && <p className="mt-2 rounded-2xl border border-indigo-300/30 bg-indigo-950/60 px-3 py-1.5 text-[12.5px] italic text-indigo-100" data-alf-visit-sleep>💤 {alfFill(vl(roomId).sleep[(roomId.length + (friend.id || '').length) % vl(roomId).sleep.length], { h: friend.name, who: roomId, name: visitor })}</p>}
            <p className="mt-2 text-[11px] text-slate-300">{roomState === 'out' ? '帰ってきたら話せます。' : '起きているときに話せます。'}</p></>}
        {can === 'ok' && !done && <button type="button" className="mhl-btn mt-2 w-full bg-amber-500 text-slate-950" data-alf-visit-room-note={roomId} onClick={() => { setRoomId(null); setNoteWarn(''); setLeaving(roomId); }}>✉️ {roomState === 'home' ? '置き手紙を残して帰る' : `${assistantLifeName(roomId)}に一言残して帰る`}</button>}
      </div>
    </div>) : null;
  const words = leaving != null ? (
    <div className="absolute inset-0" style={{ zIndex: 31 }} data-alf-visit-words>
      <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/55" onClick={() => setLeaving(null)}/>
      <div className="mhl-sheet" style={land ? { left: 'auto', width: '44%', top: 0, maxHeight: '100%', paddingTop: 92, borderRadius: '22px 0 0 22px' } : { maxHeight: 'calc(100% - 96px)' }}>
        <p className="text-[15px] font-black text-amber-100">✉️ 置き手紙の一言をえらぶ{leaving ? <span className="ml-1 text-[11px] text-slate-200">(あて先: {assistantLifeName(leaving)}{h.r[leaving] && (h.r[leaving].at !== 'home' || h.r[leaving].d === 'sleep') ? '・留守' : ''})</span> : null}</p>
        <p className="text-[10.5px] font-bold text-slate-200">一言を押すと{friend.name}さんに届いて、この家から帰ります(ビートP 50)</p>
        <label className="mt-2 block text-[10.5px] font-bold text-slate-200" htmlFor="alf-note-free">✏️ ひとこと(自由・{ALF_NOTE_MAX}字まで・なくてもよい)</label>
        <div className="mt-1 flex items-center gap-1.5">
          <input id="alf-note-free" type="text" data-alf-note-free value={noteText} maxLength={ALF_NOTE_MAX} autoComplete="off" spellCheck={false}
            onChange={(e) => { setNoteText(e.target.value); setNoteWarn(''); }} placeholder="例: ソファ、ふかふかでよかった！"
            className="min-h-[40px] min-w-0 flex-1 rounded-xl border border-white/20 bg-black/40 px-2.5 text-[13px] font-bold text-white placeholder:text-slate-500"/>
          <span className="shrink-0 text-[10px] text-slate-400">{[...noteText].length}/{ALF_NOTE_MAX}</span>
        </div>
        {(() => { const c = alfNoteCheck(noteText); const warn = noteWarn || (!c.ok ? c.reason : ''); return warn ? <p className="mt-1 text-[10.5px] font-bold text-rose-300" data-alf-note-warn>⚠️ {warn}</p> : <p className="mt-1 text-[10px] text-slate-400">連絡先・住所・本名などは書けません。悪い言葉は●になります。{friend.name}さんは自由文を見ないようにもできます。</p>; })()}
        <div className="mt-2 flex flex-wrap gap-1.5">{ALF_WORD_TEXTS.map((t, i) => <button key={i} type="button" className="rounded-xl border border-amber-200/50 bg-slate-800 px-2 py-1.5 text-[12px] font-bold text-amber-50 disabled:opacity-40" data-alf-word={i} disabled={!alfNoteCheck(noteText).ok} onClick={() => leave(i)}>{t}</button>)}</div>
        <button type="button" data-mhl-sheet-close className="mhl-btn mt-3 w-full bg-slate-700" onClick={() => { setLeaving(null); setNoteWarn(''); }}>やめる</button>
      </div>
    </div>) : null;
  const diarySheet = boardOpen ? (
    <div className="absolute inset-0" style={{ zIndex: 31 }} data-alf-visit-diary-all>
      <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/55" onClick={() => setBoardOpen(false)}/>
      <div className="mhl-sheet" style={land ? { left: 'auto', width: '44%', top: 0, maxHeight: '100%', paddingTop: 92, borderRadius: '22px 0 0 22px' } : { maxHeight: 'calc(100% - 96px)' }}>
        <p className="text-[16px] font-black text-amber-100">📌 {friend.name}さんの家の最近</p>
        {diaryItems.length ? diaryItems.map((d, i) => <React.Fragment key={i}>
          {!d.act && (i === 0 || diaryItems[i - 1].act) && <p className="mt-2.5 border-t border-slate-600/60 pt-1.5 text-[11px] font-black text-sky-200" data-alf-visit-diary-sep>🏠 助手たちの今日</p>}
          <p className="mt-1.5 text-[12px] font-bold leading-snug text-slate-100"><b className="mr-1.5 text-amber-200">{d.t}</b>{d.x}</p></React.Fragment>) : <p className="mt-1.5 text-[12px] text-slate-300">まだ何もありません</p>}
        <button type="button" data-mhl-sheet-close className="mhl-btn mt-3 w-full bg-slate-700" onClick={() => setBoardOpen(false)}>閉じる</button>
      </div>
    </div>) : null;
  return alfLayer(
    <div className="mhl-root" style={{ zIndex: 44, position: 'absolute' }} data-alf-visit data-assistant-life-look={look}>
      {typeof AssistantLifeHouseStyle === 'function' && <AssistantLifeHouseStyle/>}
      <div className="mhl-page" style={{ maxWidth: land ? 'none' : 480 }}>
        <div className={`mhl-sky t-${look}`}/>
        <div className="mhl-wood" style={{ backgroundImage: `url(${ASSISTANT_LIFE_VIEW[look][1]})` }}/>
        {land ? (
          <div className="relative z-[2] flex h-full min-h-0" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
            <div className="mhl-body" style={{ flex: '0 0 64%' }}>{houseView}</div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto bg-gradient-to-b from-[#1a0f2e] to-[#0b1020] px-2.5 pb-2" style={{ paddingTop: 88 }} data-alf-visit-side>{header}{board}{tiles}</div>
          </div>
        ) : (<>
          {header}
          <div className="mhl-body">{houseView}</div>
          <div className="relative z-[3] bg-gradient-to-t from-[#0b1020] via-[#0b1020ee] to-transparent px-3 pt-1.5" style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>{tiles}</div>
        </>)}
        {sheet}
        {words}
        {diarySheet}
      </div>
    </div>);
}
// 家へ遊びに行けない理由(プロフィールの入口と「🏘 フレンド」の一覧で同じ文)。行けるときは null
const alfVisitBlockedText = (friendId, name, s = ALF_STORE.state) => {
  if (s.mode === 'off') return 'フレンドの家との行き来は、いまお休み中です。';
  if (!s.settings.open) return '「🏘 フレンド」の設定で、行き来を切にしています。';
  if (s.settings.muted.includes(friendId)) return 'この家は「来ないようにする」にしています。';
  if (!alfOpenHouses('look').some(f => f.id === friendId)) return `${name || 'このフレンド'}さんが助手ライフを開くと遊びに行けます。`;
  // 訪ねて見て回るのは、回数の制限なしでいつでも(2026-11-08 社長「家に遊びに行くのに制限はなしがいい」)。
  //   1日の上限があるのは、置き手紙(届く一言・ビートP)だけ。それは訪ねた家の中で出す
  return null;
};
// フレンドのプロフィールの入口「🏘 家へ遊びに行く」(2026-11-08 社長)。75-screen-friends が差しこむ。
//   押すとその人の家(AlfFriendHouseView)を開き、もどるとそのままプロフィールへ戻る。行けないときは押せない形で理由を出す
function AssistantLifeFriendProfileVisit({ friendId, friendName }) {
  const s = useAssistantLifeFriendState();
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { if (alfEnabled() && alfSafeOther(friendId)) void (async () => { await ALF_STORE.load(); await alfFetchHouses(); })(); }, [friendId]);
  if (!alfEnabled() || !alfSafeOther(friendId)) return null;
  const blocked = s.ready ? alfVisitBlockedText(friendId, friendName, s) : '読み込んでいます…';
  const house = blocked ? null : alfOpenHouses('look').find(f => f.id === friendId);
  return (
    <div className="mt-2" data-alf-profile-visit={blocked ? 'blocked' : 'ok'}>
      <button type="button" disabled={!house} className="min-h-[44px] w-full rounded-xl border-2 border-amber-300/70 bg-amber-300 px-3 text-[13px] font-black text-slate-950 active:scale-95 disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-400"
        data-alf-profile-visit-go onClick={() => house && setOpen(true)}>🏘 家へ遊びに行く</button>
      {blocked && <p className="mt-1 text-center text-[10.5px] font-bold leading-snug text-slate-400" data-alf-profile-visit-why>{blocked}</p>}
      {open && house && (typeof ReactDOM !== 'undefined' && ReactDOM.createPortal && typeof document !== 'undefined'
        ? ReactDOM.createPortal(<div className="fixed inset-0" style={{ zIndex: 70 }} data-alf-profile-layer><AlfFriendHouseView friend={house} onClose={() => setOpen(false)}/></div>, document.body)
        : <div className="fixed inset-0" style={{ zIndex: 70 }} data-alf-profile-layer><AlfFriendHouseView friend={house} onClose={() => setOpen(false)}/></div>)}
    </div>);
}
// 家の画面のアイコン「🏘 フレンド」のページ(②いま・今日の行き来/置き手紙/③行ったことのある家/⑧設定)
function AssistantLifeFriendPage({ life }) {
  const s = useAssistantLifeFriendState();
  const [scene, setScene] = React.useState(null);
  const [visit, setVisit] = React.useState(null);
  const [menu, setMenu] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    (async () => { await ALF_STORE.load(); await assistantLifeFriendOnOpen(life); await alfFetchVisits(); if (alive) assistantLifeFriendMarkSeen(); })();
    return () => { alive = false; };
  }, []);
  if (!alfEnabled()) return null;
  const st = s.st; const lim = ALF_LIMITS[s.mode === 'on' ? 'on' : 'thin'];
  if (!s.ready || s.mode === 'off') return <div className="px-3 py-6 text-center text-[12px] text-slate-300" data-alf-page="off">🏘 フレンドの家との行き来は、いまお休み中です。</div>;
  const houses = alfOpenHouses('look');
  // 家が届いていない(または古い)フレンド。来ないようにした家は出さない
  const waiting = s.roster.filter(f => !houses.some(h => h.id === f.id) && !s.settings.muted.includes(f.id)).slice(0, 30);
  const notes = assistantLifeFriendNotes(s);
  const openScene = async (kind, i) => {
    if (kind === 'out') { setScene(assistantLifeFriendGoScene(st.out)); const r = await assistantLifeFriendSeeOuting('out'); if (r && r.beatP) setScene(x => x && { ...x, reward: `🎁 おみやげ ビートP ${r.beatP}${r.photo ? '・写真1枚' : ''}` }); }
    if (kind === 'back') { setScene(assistantLifeFriendBackScene(st.back)); const r = await assistantLifeFriendSeeOuting('back'); if (r && r.beatP) setScene(x => x && { ...x, reward: `🎁 おみやげ ビートP ${r.beatP}${r.photo ? '・写真1枚' : ''}` }); }
    if (kind === 'come') { setScene(assistantLifeFriendComeScene(st.came[i])); void assistantLifeFriendSeeCome(i); }
  };
  const sec = 'mt-3 inline-block rounded-full bg-slate-950/85 px-2.5 py-0.5 text-[12px] font-black text-amber-200 shadow';
  const card = 'mt-1.5 rounded-2xl border border-amber-300/25 bg-slate-900/85 p-2';
  return (
    <div className="px-3 pb-3 pt-1" data-alf-page="on">
      {!s.intro && (
        <div className={card} data-alf-intro>
          <p className="text-[11px] leading-snug text-slate-200" data-alf-intro-text>{['助手たちは、', 'ときどき自分で', 'フレンドの家へ', '遊びに行きます。', 'フレンドの助手が', '遊びに来ることも', 'あります。', 'あなたも', '「🚪 訪ねる」で', 'フレンドの家を', '見て回れます。'].map((t, i) => <span key={i} className="whitespace-nowrap">{t}</span>)}</p>
          <button type="button" className="mt-1.5 rounded-xl bg-amber-300 px-3 py-1 text-[11px] font-black text-slate-950" data-alf-intro-ok onClick={() => { ALF_STORE.set({ intro: true }); try { storeSet(ALF_INTRO_KEY, true, false); } catch {} }}>わかった</button>
        </div>)}
      <p className={sec}>🏘 いまの行き来</p>
      <div className={card} data-alf-now>
        {st.out && <div className="flex items-center gap-2" data-alf-now-out>{st.out.ids.map(id => <AlfFace key={id} id={id} size={28}/>)}<p className="min-w-0 flex-1 text-[11.5px] text-slate-100"><span className="whitespace-nowrap">{st.out.ids.map(assistantLifeName).join('・')}</span>が<span className="whitespace-nowrap">{st.out.name}さんの家へ</span></p><button type="button" className="shrink-0 rounded-xl bg-amber-300 px-2.5 py-1 text-[11px] font-black text-slate-950" data-alf-act="out" onClick={() => openScene('out')}>▶ 様子</button></div>}
        {!st.out && st.back && !st.back.seen && <div className="flex items-center gap-2" data-alf-now-back>{st.back.ids.map(id => <AlfFace key={id} id={id} size={28}/>)}<p className="min-w-0 flex-1 text-[11.5px] text-slate-100"><span className="whitespace-nowrap">{st.back.ids.map(assistantLifeName).join('・')}</span>が帰ってきた</p><button type="button" className="shrink-0 rounded-xl bg-amber-300 px-2.5 py-1 text-[11px] font-black text-slate-950" data-alf-act="back" onClick={() => openScene('back')}>おかえり！</button></div>}
        {st.came.map((c, i) => <div key={i} className="mt-1 flex items-center gap-2" data-alf-now-come><AlfFace id={c.aid} size={28}/><p className="min-w-0 flex-1 text-[11.5px] text-slate-100"><span className="whitespace-nowrap">{alfTheirLabel(c.name, c.aid)}</span>が遊びに来た</p>{!c.seen ? <button type="button" className="shrink-0 rounded-xl bg-sky-300 px-2.5 py-1 text-[11px] font-black text-slate-950" data-alf-act="come" onClick={() => openScene('come', i)}>▶ 迎える</button> : <span className="shrink-0 text-[10px] text-slate-400">迎えた</span>}</div>)}
        {!st.out && !(st.back && !st.back.seen) && !st.came.length && <p className="text-[11px] text-slate-400">いまは、みんな家にいます。</p>}
        <p className="mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-slate-300" data-alf-today><span className="whitespace-nowrap">助手が行った {st.go}/{lim.go}</span><span className="whitespace-nowrap">来てくれた {st.come}/{lim.come}</span><span className="whitespace-nowrap">置き手紙 {st.look}/{lim.look}</span><span className="whitespace-nowrap">おみやげ {st.beatP}/{ALF_BEAT_P.dayMax}P</span></p>
      </div>
      <p className={sec}>✉️ 置き手紙</p>
      <div className={card} data-alf-notes>
        {notes.length ? notes.slice(0, 12).map(n => (
          <div key={n.id} className="border-b border-slate-700/60 py-1 last:border-0" data-alf-note={n.kind}>
            <p className="text-[11px] leading-snug text-slate-100">
              <span className="whitespace-nowrap text-slate-400">{alfAgoText(n.at)}</span>{' '}
              {n.dir === 'away' ? <><span className="whitespace-nowrap">{n.ids.map(assistantLifeName).join('・')}</span>が<span className="whitespace-nowrap">{n.name}さんの家へ</span>遊びに行っていた</>
                : n.kind === 'player' ? <><span className="whitespace-nowrap">{n.name}さん</span>が{n.noteTo ? <span className="whitespace-nowrap">{assistantLifeName(n.noteTo)}あてに</span> : '訪ねてくれた'}「{ALF_WORD_TEXTS[n.word]}」{n.ids.length ? <span className="whitespace-nowrap">・{n.ids.map(assistantLifeName).join('・')}と話した</span> : null}</>
                : <><span className="whitespace-nowrap">{n.name}さんの{n.ids.map(assistantLifeName).join('・')}</span>が来た「{ALF_WORD_TEXTS[n.word]}」</>}
            </p>
            {n.dir === 'in' && n.note ? (s.settings.noteShow && !s.settings.noteOff.includes(n.who)
              ? <p className="mt-0.5 rounded border-l-2 border-pink-300 bg-pink-950/30 px-1.5 py-0.5 text-[11px] text-pink-50" data-alf-note-text>✏️ {n.note}</p>
              : <p className="mt-0.5 text-[10px] text-slate-400" data-alf-note-hidden>✏️ (自由文を見ないようにしています)</p>) : null}
            {n.dir === 'in' && n.note && s.settings.noteShow && <button type="button" className="mt-0.5 text-[10px] text-rose-200 underline" data-alf-note-off={n.who}
              onClick={() => { const off = s.settings.noteOff.includes(n.who); assistantLifeFriendSetSettings({ noteOff: off ? s.settings.noteOff.filter(x => x !== n.who) : [...s.settings.noteOff, n.who] }); }}>{s.settings.noteOff.includes(n.who) ? `${n.name}さんの自由文を見る` : `${n.name}さんの自由文を見ない`}</button>}
            {n.dir === 'in' && (n.thanks == null
              ? <div className="mt-1 flex flex-wrap gap-1">{ALF_THANKS_TEXTS.slice(0, 3).map((t, k) => <button key={k} type="button" className="rounded-lg border border-amber-200/40 px-1.5 py-0.5 text-[10px] text-amber-100" data-alf-thanks={k} onClick={() => assistantLifeFriendThanks(n.id, k)}>{t}</button>)}</div>
              : <p className="text-[10px] text-slate-400">お礼「{ALF_THANKS_TEXTS[n.thanks]}」を返しました</p>)}
          </div>)) : <p className="text-[11px] text-slate-400">まだ置き手紙はありません。</p>}
      </div>
      <p className={sec}>🏠 フレンドの家</p>
      <div data-alf-houses>
        {houses.length ? houses.map(f => { const can = assistantLifeFriendCanLook(f.id); const been = st.photos.some(p => p.host === f.id); return (
          <div key={f.id} className={`${card} flex items-center gap-2`} data-alf-house={f.id}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-black text-slate-100">{f.name}さんの家{been ? ' 📷' : ''}</p>
              <p className="text-[10px] text-slate-300" data-alf-house-sum>{(() => { const hs = f.house; const at = (k) => hs.ids.filter(id => hs.r[id] && (k === 'sleep' ? hs.r[id].at === 'home' && hs.r[id].d === 'sleep' : k === 'home' ? hs.r[id].at === 'home' && hs.r[id].d !== 'sleep' : hs.r[id].at !== 'home')).length; const fu = hs.ids.reduce((n, id) => n + Object.keys((hs.r[id] && hs.r[id].fu) || {}).length, 0);
                return <><span className="whitespace-nowrap">🏠 家に{at('home')}人</span>{at('out') ? <><wbr/><span className="whitespace-nowrap">・🚶 おでかけ{at('out')}人</span></> : null}{at('sleep') ? <><wbr/><span className="whitespace-nowrap">・💤 {at('sleep')}人</span></> : null}{fu ? <><wbr/><span className="whitespace-nowrap">・🪑 家具{fu}</span></> : null}<wbr/><span className="whitespace-nowrap text-slate-400">・{alfAgoText(f.at)}</span></>; })()}</p>
              {f.house.ac1 && <p className="truncate text-[10.5px] font-bold text-amber-200" data-alf-house-act>{ALF_ACT_ICON[f.house.ac1.k] || '✨'} {f.house.ac1.x}</p>}
              <div className="mt-0.5 flex gap-0.5">{alfHomeIds(f.house).slice(0, 6).map(id => <AlfFace key={id} id={id} size={22}/>)}</div>
            </div>
            <button type="button" disabled={can === 'off'} className="shrink-0 rounded-xl bg-amber-300 px-2.5 py-1.5 text-[11px] font-black text-slate-950 disabled:opacity-40" data-alf-act="look" onClick={() => setVisit(f)}>🚪 訪ねる</button>
            <button type="button" className="shrink-0 rounded-xl border border-slate-500 px-2 py-1.5 text-[11px] text-slate-200" aria-label="その他" data-alf-act="menu" onClick={() => setMenu(menu === f.id ? null : f.id)}>⋯</button>
            {menu === f.id && <button type="button" className="shrink-0 rounded-xl border border-rose-300/60 px-2 py-1.5 text-[10px] text-rose-100" data-alf-act="mute" onClick={() => { assistantLifeFriendMute(f.id, true); setMenu(null); }}>来ないようにする</button>}
          </div>); })
          : !waiting.length && <p className={`${card} text-[11px] text-slate-400`}>遊びに行けるフレンドの家はまだありません(フレンドが助手ライフを開くと、ここに並びます)。</p>}
        {/* まだ家が届いていないフレンドも薄く並べる(2026-11-08 社長)。押せない */}
        {waiting.map(f => (
          <div key={f.id} className={`${card} flex items-center gap-2 border-dashed border-slate-500/60`} data-alf-house-waiting={f.id}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-black text-slate-300">{f.name}さんの家</p>
              <p className="text-[10px] leading-snug text-slate-300">{f.name}さんが助手ライフを開くと遊びに行けます</p>
            </div>
            <span className="shrink-0 rounded-xl border border-slate-500 bg-slate-800 px-2.5 py-1.5 text-[11px] font-black text-slate-300">🚪 まだ</span>
          </div>))}
      </div>
      <p className={sec}>⚙️ 行き来の設定</p>
      <div className={card} data-alf-settings>
        {[['open', 'フレンドの家と行き来する'], ['show', '家の様子をフレンドに見せる'], ['come', 'フレンドの助手が遊びに来る'], ['act', '最近の遊びをフレンドに見せる'], ['noteShow', '置き手紙の自由文を見る']].map(([k, label]) => (
          <label key={k} className="flex items-center justify-between gap-2 py-1 text-[11.5px] text-slate-100" data-alf-setting={k}>
            <span>{label}</span>
            <input type="checkbox" checked={!!s.settings[k]} onChange={(e) => assistantLifeFriendSetSettings({ [k]: e.target.checked })}/>
          </label>))}
        {s.settings.muted.length > 0 && <button type="button" className="mt-1 text-[10.5px] text-amber-200 underline" data-alf-unmute onClick={() => assistantLifeFriendSetSettings({ muted: [] })}>来ないようにした家({s.settings.muted.length}軒)を戻す</button>}
      </div>
      <AlfSceneSheet scene={scene} onClose={() => setScene(null)}/>
      {visit && <AlfFriendHouseView friend={visit} onClose={() => setVisit(null)}/>}
    </div>);
}
// 部屋の札: フレンドの家へ行っている助手は「🏘 〇〇さんの家へ」(家の中の組からは外さない。様子の保存 mh_assistant_life_v1 は変えない)
const assistantLifeFriendDecorateRooms = (rooms) => {
  if (!alfEnabled() || !rooms) return rooms;
  for (const id of Object.keys(rooms)) {
    const o = assistantLifeFriendAwayOf(id);
    if (!o || !rooms[id]) continue;
    rooms[id] = { tag: [`🏘 ${o.name}さんの家へ`, o.ids.length > 1 ? `${o.ids.length}人で 遊びに` : 'ひとりで 遊びに', o.ids.length > 1 ? assistantLifeGroupNames(o.ids, 4) : null] };
  }
  return rooms;
};
// HOME: 施設「🏡 助手ライフ」の札の右上に「🏘 n」(札の字にかからないよう、札の角の外側に半分出す)。
//   新しい置き手紙・来ている助手が増えたら、札のすぐ上に1行の帯を3秒(HOME だけ。演奏中・バトル中などには出さない。
//   画面の上に出すと助手の吹き出しの名前に重なった・2026-11-08 ミハリ)
function AssistantLifeFriendHomeBadge({ rect }) {
  const s = useAssistantLifeFriendState();
  const [toast, setToast] = React.useState('');
  const lastRef = React.useRef(null);
  React.useEffect(() => { if (alfEnabled()) void (async () => { await ALF_STORE.load(); const m = await alfLoadMode(); if (m !== 'off') await alfEnsureHouse(); await alfRoster(); await alfFetchVisits(); })(); }, []);
  const n = alfEnabled() && s.loaded && s.mode && s.mode !== 'off' ? assistantLifeFriendUnseen(s) : 0;
  React.useEffect(() => {
    if (lastRef.current != null && n > lastRef.current) {
      const seen = new Set(s.st.seen);
      const note = assistantLifeFriendNotes(s).find(x => !seen.has(x.id));
      setToast(note ? (note.kind === 'player' ? `🏘 ${note.name}さんが訪ねてくれました` : note.dir === 'away' ? `🏘 ${note.ids.map(assistantLifeName).join('・')}が${note.name}さんの家へ行っていました` : `🏘 ${note.name}さんの${note.ids.map(assistantLifeName).join('・')}が来ました`) : '🏘 フレンドの家から知らせがあります');
      const t = setTimeout(() => setToast(''), 3000);
      lastRef.current = n;
      return () => clearTimeout(t);
    }
    lastRef.current = n;
    return undefined;
  }, [n]);
  if (!n && !toast) return null;
  return (<>
    {n > 0 && rect && <span className="pointer-events-none fixed rounded-full border border-white/70 bg-sky-300 px-1 text-[9.5px] font-black leading-[15px] text-slate-950 shadow" data-alf-badge style={{ zIndex: 41, left: rect.x + rect.w - 14, top: rect.y - 8 }}>🏘 {n}</span>}
    {toast && rect && <div className="pointer-events-none fixed whitespace-nowrap rounded-full border border-sky-200/60 bg-slate-950/90 px-2.5 text-[11px] font-black leading-[20px] text-sky-50 shadow-lg" data-alf-toast
      style={{ zIndex: 60, top: Math.max(4, rect.y - 26), ...(rect.right ? { right: Math.max(4, (typeof window !== 'undefined' ? window.innerWidth : 390) - rect.x - rect.w) } : { left: Math.max(4, rect.x) }) }}>{toast}</div>}
  </>);
}
