// ===== 助手どうしのつながり(2026-11-07 社長「ガッツリ作りこんで」) =====
// 段階2 ペアの仲良し度 と 段階3 台本版の掛け合い。設計: docs/progress/assistant-peer-plan.md
// (段階1 会話の共有は 56-assistant-chat.jsx の assistantPeerMemosFor)
// ★公開の印 RELEASE_FLAGS.assistantPeer の後ろ。偽のあいだは上がりも掛け合いも出ない
// ★保存は新しいキーだけ(CLAUDE.md ⑦)。どれも壊れていたら空として読む
//   mh_assistant_peer_bond_v1        { "kiki-mua"(id の名前順): 点数 }
//   mh_assistant_peer_bond_day_v1    { day, got: { [ペア]: { [行動]: その日に上がった量 } } }  1日の上限を数える
//   mh_assistant_peer_talk_log_v1    [{ id, at }] 最近見た掛け合い(30件)
//   mh_assistant_peer_talk_day_v1    { day, home, other }  その日に流した数(HOME / ほかの画面)
//   mh_assistant_peer_special_seen_v1 [ペア] Lv5 の特別なお話を見たペア
//   mh_assistant_peer_talk_gen_v1    { day, asked, talks:[{ id, pair, lines }] }  API 版で作ったその日の掛け合い(段階3 API 版)
//   mh_assistant_peer_daily_v1       { day, pair, seen, done, lastDay, streak }  今日のペアと、続けてログインした日数(2026-11-07)
//   mh_assistant_peer_choice_v1      { [掛け合いid]: 選んだ返事の番号 }  掛け合いで返した返事
//   mh_assistant_peer_album_v1       { [ペア]: [掛け合いid] }  思い出アルバム(見た掛け合い。API 版で作ったものは入れない)
// プレイヤーと助手の親密度(mh_assistant_bond_*)は、60-app.jsx の addAssistantBondFor を通して、今の行動と同じように足すだけ
const ASSISTANT_PEER_BOND_STORE_KEY = 'mh_assistant_peer_bond_v1';
const ASSISTANT_PEER_BOND_DAY_KEY = 'mh_assistant_peer_bond_day_v1';
const ASSISTANT_PEER_TALK_LOG_KEY = 'mh_assistant_peer_talk_log_v1';
const ASSISTANT_PEER_TALK_DAY_KEY = 'mh_assistant_peer_talk_day_v1';
const ASSISTANT_PEER_SPECIAL_SEEN_KEY = 'mh_assistant_peer_special_seen_v1';
const ASSISTANT_PEER_TALK_GEN_KEY = 'mh_assistant_peer_talk_gen_v1';
const ASSISTANT_PEER_DAILY_KEY = 'mh_assistant_peer_daily_v1';
const ASSISTANT_PEER_CHOICE_KEY = 'mh_assistant_peer_choice_v1';
const ASSISTANT_PEER_ALBUM_KEY = 'mh_assistant_peer_album_v1';
const ASSISTANT_PEER_TALK_LOG_MAX = 30;
// 今日のペア: そのペアの掛け合いをこの回数見る(返事をした回も1回)と達成
const ASSISTANT_PEER_DAILY_GOAL = 3;
// API 版(段階3)。1日に頼める回数(サーバの1人の上限と同じ100回・2026-11-07 社長)と、作ったものを台本より先に出す割合。
//   頼むのは、その日に作ったものを見終えたときだけ(流すのは HOME 1日5回まで)なので、ふつうは1日1〜2回
const ASSISTANT_PEER_GEN_ASK_MAX = 100;
const ASSISTANT_PEER_GEN_RATE = 0.6;
const ASSISTANT_PEER_GEN_EXPRESSIONS = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
// 1日に流す数(社長「HOMEで1日5回程度、ほかの画面でもときどき」)と、画面に入ったときに流す割合
const ASSISTANT_PEER_TALK_HOME_MAX = 5;
const ASSISTANT_PEER_TALK_OTHER_MAX = 3;
const ASSISTANT_PEER_TALK_RATE = { home: 0.4, other: 0.25 };
// 続けて流さない間(ミリ秒)
const ASSISTANT_PEER_TALK_GAP_MS = 90 * 1000;
// 1行を出しておく時間(タップで先へ進める)
const ASSISTANT_PEER_LINE_MS = 3600;
// 掛け合いを出す画面(gameState → 場面)
const ASSISTANT_PEER_SCENES = Object.freeze({ HOME: 'home', BREEDER_MARKET: 'market', RHYTHM_MODE_SELECT: 'rhythm', MASU_MONS: 'masu', CARD_TOP: 'card' });

const assistantPeerEnabled = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantPeer === true;
// API 版は、サーバ(assistant-chat の kind:'peer_talks')を窓口が配ってから真にする(RELEASE_FLAGS.assistantPeerApi)
const assistantPeerApiEnabled = () => assistantPeerEnabled() && typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantPeerApi === true;
const assistantPeerPairKey = (a, b) => [String(a), String(b)].sort().join('-');
const assistantPeerTalkList = () => (typeof ASSISTANT_PEER_TALKS !== 'undefined' && Array.isArray(ASSISTANT_PEER_TALKS)) ? ASSISTANT_PEER_TALKS : [];
const assistantPeerLevelOf = (points) => (typeof assistantPeerBondLevel === 'function') ? assistantPeerBondLevel(points) : 1;

const normalizeAssistantPeerBond = (raw) => {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const n = Math.floor(Number(v));
    if (/^[a-z]+-[a-z]+$/.test(k) && Number.isFinite(n) && n > 0) out[k] = Math.min(n, 99999);
  }
  return out;
};
const normalizeAssistantPeerBondDay = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.day !== 'string') return { day: null, got: {} };
  const got = {};
  if (raw.got && typeof raw.got === 'object' && !Array.isArray(raw.got)) {
    for (const [pair, acts] of Object.entries(raw.got)) {
      if (!acts || typeof acts !== 'object' || Array.isArray(acts)) continue;
      const one = {};
      for (const [a, v] of Object.entries(acts)) { const n = Math.floor(Number(v)); if (Number.isFinite(n) && n > 0) one[a] = n; }
      got[pair] = one;
    }
  }
  return { day: raw.day, got };
};
const normalizeAssistantPeerTalkLog = (raw) => (Array.isArray(raw) ? raw : [])
  .filter(x => x && typeof x.id === 'string').map(x => ({ id: x.id, at: Number.isFinite(x.at) ? x.at : 0 })).slice(-ASSISTANT_PEER_TALK_LOG_MAX);
const normalizeAssistantPeerTalkDay = (raw) => {
  const ok = raw && typeof raw === 'object' && !Array.isArray(raw) && typeof raw.day === 'string';
  const n = (v) => (Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  return ok ? { day: raw.day, home: n(raw.home), other: n(raw.other) } : { day: null, home: 0, other: 0 };
};
const normalizeAssistantPeerSpecialSeen = (raw) => (Array.isArray(raw) ? raw.filter(x => typeof x === 'string') : []);
const normalizeAssistantPeerDaily = (raw) => {
  const n = (v) => (Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { day: null, pair: null, seen: 0, done: false, lastDay: null, streak: 0 };
  return { day: typeof raw.day === 'string' ? raw.day : null, pair: typeof raw.pair === 'string' && /^[a-z]+-[a-z]+$/.test(raw.pair) ? raw.pair : null,
    seen: n(raw.seen), done: raw.done === true, lastDay: typeof raw.lastDay === 'string' ? raw.lastDay : null, streak: n(raw.streak) };
};
const normalizeAssistantPeerChoice = (raw) => {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) if (typeof k === 'string' && Number.isInteger(v) && v >= 0 && v < 3) out[k] = v;
  return out;
};
const normalizeAssistantPeerAlbum = (raw) => {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) if (/^[a-z]+-[a-z]+$/.test(k) && Array.isArray(v)) out[k] = [...new Set(v.filter(x => typeof x === 'string'))].slice(0, 200);
  return out;
};
// API 版で作った掛け合い。形の崩れたものは捨てる(ゲームは {c} だけを置きかえる)
const normalizeAssistantPeerGen = (raw) => {
  const empty = { day: null, asked: 0, talks: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.day !== 'string') return empty;
  const ids = typeof ASSISTANT_PEER_CALLS !== 'undefined' ? Object.keys(ASSISTANT_PEER_CALLS) : [];
  const talks = (Array.isArray(raw.talks) ? raw.talks : []).filter(t => t && typeof t.id === 'string' && Array.isArray(t.pair) && t.pair.length === 2
    && t.pair.every(id => ids.includes(id)) && t.pair[0] !== t.pair[1] && Array.isArray(t.lines) && t.lines.length >= 2 && t.lines.length <= 4
    && t.lines.every(l => l && t.pair.includes(l.who) && ASSISTANT_PEER_GEN_EXPRESSIONS.includes(l.e) && typeof l.t === 'string' && l.t.length > 0 && l.t.length <= 80 && !/[{}]/.test(l.t.replace(/\{c\}/g, ''))))
    .slice(0, 16).map(t => ({ id: t.id, pair: [...t.pair].sort(), lv: 1, scene: 'any', gen: true, lines: t.lines.map(l => ({ who: l.who, e: l.e, t: l.t })) }));
  return { day: raw.day, asked: Number.isFinite(raw.asked) ? Math.max(0, Math.floor(raw.asked)) : 0, talks };
};

// ---------- 置き場(どの画面からも同じものを見る) ----------
const ASSISTANT_PEER_STORE = {
  state: { loaded: false, bond: {}, bondDay: { day: null, got: {} }, log: [], talkDay: { day: null, home: 0, other: 0 }, special: [], gen: { day: null, asked: 0, talks: [] },
    daily: { day: null, pair: null, seen: 0, done: false, lastDay: null, streak: 0 }, choice: {}, album: {}, lastShownAt: 0 },
  loading: null,
  listeners: new Set(),
  emit() { for (const fn of this.listeners) { try { fn(this.state); } catch {} } },
  set(patch) { this.state = { ...this.state, ...patch }; this.emit(); },
  load() {
    if (this.state.loaded) return Promise.resolve(this.state);
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const [bond, bondDay, log, talkDay, special, gen, daily, choice, album] = await Promise.all([
        storeGet(ASSISTANT_PEER_BOND_STORE_KEY, {}, false), storeGet(ASSISTANT_PEER_BOND_DAY_KEY, null, false),
        storeGet(ASSISTANT_PEER_TALK_LOG_KEY, [], false), storeGet(ASSISTANT_PEER_TALK_DAY_KEY, null, false),
        storeGet(ASSISTANT_PEER_SPECIAL_SEEN_KEY, [], false), storeGet(ASSISTANT_PEER_TALK_GEN_KEY, null, false),
        storeGet(ASSISTANT_PEER_DAILY_KEY, null, false), storeGet(ASSISTANT_PEER_CHOICE_KEY, {}, false), storeGet(ASSISTANT_PEER_ALBUM_KEY, {}, false),
      ].map(p => Promise.resolve(p).catch(() => null)));
      this.set({ loaded: true, bond: normalizeAssistantPeerBond(bond), bondDay: normalizeAssistantPeerBondDay(bondDay),
        log: normalizeAssistantPeerTalkLog(log), talkDay: normalizeAssistantPeerTalkDay(talkDay), special: normalizeAssistantPeerSpecialSeen(special), gen: normalizeAssistantPeerGen(gen),
        daily: normalizeAssistantPeerDaily(daily), choice: normalizeAssistantPeerChoice(choice), album: normalizeAssistantPeerAlbum(album) });
      return this.state;
    })();
    return this.loading;
  },
};
const useAssistantPeerState = () => {
  const [st, setSt] = React.useState(ASSISTANT_PEER_STORE.state);
  React.useEffect(() => {
    ASSISTANT_PEER_STORE.listeners.add(setSt);
    ASSISTANT_PEER_STORE.load().then(s => setSt(s)).catch(() => {});
    return () => { ASSISTANT_PEER_STORE.listeners.delete(setSt); };
  }, []);
  return st;
};
const assistantPeerPoints = (st, a, b) => (st && st.bond && st.bond[assistantPeerPairKey(a, b)]) || 0;
const assistantPeerLevel = (st, a, b) => assistantPeerLevelOf(assistantPeerPoints(st, a, b));

// ---------- 仲良し度を上げる ----------
// 渡された状態から次の状態を作るだけ(保存しない)。検査からも呼べるように分けてある
const assistantPeerGainState = (st, a, b, action, day) => {
  const actions = (typeof ASSISTANT_PEER_BOND_ACTIONS !== 'undefined' && ASSISTANT_PEER_BOND_ACTIONS) || {};
  const act = actions[action];
  if (!act || !a || !b || a === b) return { st, gained: 0 };
  const pair = assistantPeerPairKey(a, b);
  const bondDay = st.bondDay && st.bondDay.day === day ? st.bondDay : { day, got: {} };
  const got = { ...(bondDay.got[pair] || {}) };
  const usedAct = got[action] || 0;
  const pairMax = (typeof ASSISTANT_PEER_BOND_DAILY_MAX !== 'undefined' && ASSISTANT_PEER_BOND_DAILY_MAX) || 20;
  // uncapped の行動(今日のペア・続けてログイン)はペアごとの1日の合計に数えず、合計の上限でも止めない
  const usedCapped = Object.entries(got).filter(([k]) => !(actions[k] && actions[k].uncapped)).reduce((s, [, v]) => s + v, 0);
  const gain = Math.max(0, Math.min(act.amount, act.dailyMax - usedAct, act.uncapped ? Infinity : pairMax - usedCapped));
  if (gain <= 0) return { st, gained: 0 };
  got[action] = usedAct + gain;
  const before = st.bond[pair] || 0;
  return {
    st: { ...st, bond: { ...st.bond, [pair]: before + gain }, bondDay: { day, got: { ...bondDay.got, [pair]: got } } },
    gained: gain, pair, levelBefore: assistantPeerLevelOf(before), levelAfter: assistantPeerLevelOf(before + gain),
  };
};
const assistantPeerSaveBond = () => {
  const st = ASSISTANT_PEER_STORE.state;
  try { storeSet(ASSISTANT_PEER_BOND_STORE_KEY, st.bond, false); storeSet(ASSISTANT_PEER_BOND_DAY_KEY, st.bondDay, false); } catch {}
};
// 2人の仲良し度を上げる。上がった結果を返す(上がらなければ gained:0)
const assistantPeerGain = async (a, b, action) => {
  if (!assistantPeerEnabled()) return { gained: 0 };
  await ASSISTANT_PEER_STORE.load();
  const r = assistantPeerGainState(ASSISTANT_PEER_STORE.state, a, b, action, assistantPeerDayKey());
  if (r.gained > 0) { ASSISTANT_PEER_STORE.set(r.st); assistantPeerSaveBond(); }
  return r;
};
// お話を最後まで見たとき(60-app.jsx のお話の finish)。出た助手のペアぜんぶ
const assistantPeerGainStory = (ids) => {
  const list = [...new Set((ids || []).map(id => String(id || '').split('@')[0]))]
    .filter(id => typeof ASSISTANT_PEER_CALLS !== 'undefined' && ASSISTANT_PEER_CALLS[id]);
  (async () => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) await assistantPeerGain(list[i], list[j], 'story'); })();
};
// 助手を切り替えたとき(60-app.jsx の chooseAssistant)。前の助手と次の助手のペア
const assistantPeerGainSwitch = (prev, next) => { if (prev && next && prev !== next) void assistantPeerGain(prev, next, 'switch'); };

// ---------- プレイヤーと助手の親密度(2026-11-07 社長「助手の親密度を上げる何かがもっとほしい」) ----------
// 60-app.jsx が addAssistantBondFor(助手id, 行動) を渡しておく。行動は data/assistants.js の ASSISTANT_BOND_ACTIONS の peer*
let assistantPeerPlayerBondAdder = null;
const assistantPeerSetPlayerBondAdder = (fn) => { assistantPeerPlayerBondAdder = typeof fn === 'function' ? fn : null; };
const assistantPeerAddPlayerBond = (ids, action) => {
  if (!assistantPeerEnabled() || !assistantPeerPlayerBondAdder) return;
  for (const id of [...new Set(ids || [])]) { try { assistantPeerPlayerBondAdder(id, action); } catch {} }
};

// ---------- その日の出来事(台本の when) ----------
// today … その日の遊び方 { battles, clears, enhances }(60-app.jsx がミッションの数から渡す)。streak … 続けてログインした日数
const assistantPeerWhenOk = (when, { now = Date.now(), today = {}, streak = 0 } = {}) => {
  if (!when) return true;
  const d = new Date(Number(now) + 9 * 3600000); // 日本時間
  const h = d.getUTCHours(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
  switch (when) {
    case 'morning': return h >= 5 && h <= 10;
    case 'night': return h >= 21 || h <= 4;
    case 'winter': return m === 12 || m <= 2;
    case 'christmas': return m === 12 && day >= 20 && day <= 25;
    case 'newyear': return m === 1 && day <= 7;
    case 'battle': return (Number(today.battles) || 0) > 0;
    case 'clear': return (Number(today.clears) || 0) > 0;
    case 'enhance': return (Number(today.enhances) || 0) > 0;
    case 'streak': return streak >= 3;
    default: return false;
  }
};

// ---------- 今日のペア ----------
// その日に会った助手のペアから1組を決める(日付から決まるので、同じ日はだれでも同じ組。会った助手が違えば変わる)
const assistantPeerDayBefore = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
const assistantPeerTodayPairOf = (metIds, day) => {
  const ids = [...new Set(metIds || [])].filter(id => typeof ASSISTANT_PEER_CALLS !== 'undefined' && ASSISTANT_PEER_CALLS[id]).sort();
  const pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push(`${ids[i]}-${ids[j]}`);
  if (!pairs.length) return null;
  let h = 0;
  for (const ch of String(day)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pairs[h % pairs.length];
};
// その日はじめてなら、今日のペアを決め、続けてログインした日数を数える。2日以上続いたら今日のペアに +2
const assistantPeerEnsureDaily = (metIds, now = Date.now()) => {
  if (!assistantPeerEnabled()) return null;
  const st = ASSISTANT_PEER_STORE.state;
  const day = assistantPeerDayKey(now);
  if (st.daily.day === day && st.daily.pair) return st.daily;
  const pair = assistantPeerTodayPairOf(metIds, day);
  if (!pair) return null;
  const streak = st.daily.lastDay === assistantPeerDayBefore(day) ? st.daily.streak + 1 : 1;
  const daily = { day, pair, seen: 0, done: false, lastDay: day, streak };
  ASSISTANT_PEER_STORE.set({ daily });
  try { storeSet(ASSISTANT_PEER_DAILY_KEY, daily, false); } catch {}
  if (streak >= 2) { const [a, b] = pair.split('-'); void assistantPeerGain(a, b, 'streak'); }
  return daily;
};
// 今日のペアの掛け合いを見た(返事をした)。達成したら { done:true } を返す
const assistantPeerDailyProgress = async (talk) => {
  const st = ASSISTANT_PEER_STORE.state;
  const day = assistantPeerDayKey();
  const pair = assistantPeerPairKey(talk.pair[0], talk.pair[1]);
  if (st.daily.day !== day || st.daily.pair !== pair || st.daily.done) return { done: false };
  const seen = st.daily.seen + 1;
  const done = seen >= ASSISTANT_PEER_DAILY_GOAL;
  const daily = { ...st.daily, seen, done };
  ASSISTANT_PEER_STORE.set({ daily });
  try { storeSet(ASSISTANT_PEER_DAILY_KEY, daily, false); } catch {}
  if (done) {
    await assistantPeerGain(talk.pair[0], talk.pair[1], 'daily');
    assistantPeerAddPlayerBond(talk.pair, 'peerDaily');
  }
  return { done, seen };
};
// 思い出アルバムに入れる(台本だけ。API 版で作ったものは見返せないので入れない)
const assistantPeerAlbumAdd = (talk) => {
  if (!talk || talk.gen) return;
  const st = ASSISTANT_PEER_STORE.state;
  const pair = assistantPeerPairKey(talk.pair[0], talk.pair[1]);
  const list = st.album[pair] || [];
  if (list.includes(talk.id)) return;
  const album = { ...st.album, [pair]: [...list, talk.id] };
  ASSISTANT_PEER_STORE.set({ album });
  try { storeSet(ASSISTANT_PEER_ALBUM_KEY, album, false); } catch {}
};
const assistantPeerSaveChoice = (talkId, index) => {
  const choice = { ...ASSISTANT_PEER_STORE.state.choice, [talkId]: index };
  ASSISTANT_PEER_STORE.set({ choice });
  try { storeSet(ASSISTANT_PEER_CHOICE_KEY, choice, false); } catch {}
};

// ---------- 掛け合いを選ぶ ----------
// metIds … 会った助手(選べる助手)。selectedId … いま一緒にいる助手(その助手が入るペアを出やすくする)
// 返すのは { talk, special } か null。rand は検査から決めた値を渡せる
const assistantPeerPickTalk = (st, { scene, metIds, selectedId, now = Date.now(), rand = Math.random, today = {} }) => {
  const met = new Set(metIds || []);
  const whenCtx = { now, today, streak: (st.daily && st.daily.streak) || 0 };
  const ok = (t) => t && Array.isArray(t.pair) && t.pair.length === 2 && t.pair.every(id => met.has(id)) && assistantPeerWhenOk(t.when, whenCtx);
  const all = assistantPeerTalkList().filter(ok);
  // Lv5 になったペアの特別なお話は、まだ見ていなければ HOME で先に流す(1日の数には入れない)
  if (scene === 'home') {
    const sp = all.find(t => t.special && assistantPeerLevel(st, t.pair[0], t.pair[1]) >= 5 && !st.special.includes(assistantPeerPairKey(t.pair[0], t.pair[1])));
    if (sp) return { talk: sp, special: true };
  }
  const day = assistantPeerDayKey(now);
  const td = st.talkDay.day === day ? st.talkDay : { day, home: 0, other: 0 };
  const isHome = scene === 'home';
  if (isHome ? td.home >= ASSISTANT_PEER_TALK_HOME_MAX : td.other >= ASSISTANT_PEER_TALK_OTHER_MAX) return null;
  if (now - (st.lastShownAt || 0) < ASSISTANT_PEER_TALK_GAP_MS) return null;
  if (rand() >= (isHome ? ASSISTANT_PEER_TALK_RATE.home : ASSISTANT_PEER_TALK_RATE.other)) return null;
  // API 版で作ったその日の掛け合い(まだ見ていないもの)を、HOME では台本より先に出す(6割)
  if (isHome && st.gen && st.gen.day === day) {
    const seen = st.log.map(x => x.id);
    const gen = st.gen.talks.filter(t => ok(t) && !seen.includes(t.id));
    if (gen.length && rand() < ASSISTANT_PEER_GEN_RATE) {
      const mine = gen.filter(t => t.pair.includes(selectedId));
      return { talk: (mine.length ? mine : gen)[0], special: false };
    }
  }
  // ほかの画面はその画面の台本を先に。無ければどこでもの台本
  const fits = (t) => !t.special && assistantPeerLevel(st, t.pair[0], t.pair[1]) >= (t.lv || 1);
  let pool = isHome ? all.filter(t => fits(t) && (t.scene === 'any' || t.scene === 'home')) : all.filter(t => fits(t) && t.scene === scene);
  if (!pool.length && !isHome) pool = all.filter(t => fits(t) && t.scene === 'any');
  if (!pool.length) return null;
  // 最近見たものは外す(全部見たなら、いちばん前に見たものから)
  const recent = st.log.map(x => x.id);
  const fresh = pool.filter(t => !recent.includes(t.id));
  if (fresh.length) pool = fresh;
  else pool = [...pool].sort((x, y) => recent.indexOf(x.id) - recent.indexOf(y.id)).slice(0, Math.max(1, Math.ceil(pool.length / 3)));
  // 重み: いまの助手が入るペアは3倍。仲良し度Lv2から掛け合いが増える(Lv が上がるほど出やすい)。
  //   今日のペア(まだ達成していない)は4倍、その日の出来事に合う掛け合いは6倍
  const dailyPair = st.daily && st.daily.day === day && !st.daily.done ? st.daily.pair : null;
  const weight = (t) => (t.pair.includes(selectedId) ? 3 : 1) * (1 + 0.5 * (assistantPeerLevel(st, t.pair[0], t.pair[1]) - 1))
    * (dailyPair && assistantPeerPairKey(t.pair[0], t.pair[1]) === dailyPair ? 4 : 1) * (t.when ? 6 : 1);
  const sum = pool.reduce((s, t) => s + weight(t), 0);
  let r = rand() * sum;
  for (const t of pool) { r -= weight(t); if (r <= 0) return { talk: t, special: false }; }
  return { talk: pool[pool.length - 1], special: false };
};
// 流したことを残す(1日の数・最近の記録・特別なお話)
const assistantPeerMarkShown = (talk, { scene, special, now = Date.now() }) => {
  const st = ASSISTANT_PEER_STORE.state;
  const day = assistantPeerDayKey(now);
  const td = st.talkDay.day === day ? { ...st.talkDay } : { day, home: 0, other: 0 };
  if (!special) { if (scene === 'home') td.home += 1; else td.other += 1; }
  const log = [...st.log.filter(x => x.id !== talk.id), { id: talk.id, at: now }].slice(-ASSISTANT_PEER_TALK_LOG_MAX);
  const pair = assistantPeerPairKey(talk.pair[0], talk.pair[1]);
  const specialSeen = special && !st.special.includes(pair) ? [...st.special, pair] : st.special;
  ASSISTANT_PEER_STORE.set({ talkDay: td, log, special: specialSeen, lastShownAt: now });
  try {
    storeSet(ASSISTANT_PEER_TALK_DAY_KEY, td, false);
    storeSet(ASSISTANT_PEER_TALK_LOG_KEY, log, false);
    if (specialSeen !== st.special) storeSet(ASSISTANT_PEER_SPECIAL_SEEN_KEY, specialSeen, false);
  } catch {}
};
// 台本の {c} を、話している助手が相手を呼ぶ呼び方へ置きかえる(呼び方は仲良し度では変えない・2026-11-07 社長)
const assistantPeerLineText = (line, talk) => {
  const partner = talk.pair.find(id => id !== line.who) || talk.pair[0];
  const call = typeof assistantPeerCall === 'function' ? assistantPeerCall(line.who, partner) : partner;
  return String(line.t || '').replace(/\{c\}/g, call);
};

// ---------- 掛け合いの表示 ----------
// 画面の下に、2人の顔と1行ずつのセリフを出す。押すと次へ、×で閉じる。ゲームの操作はふさがない(この帯だけが押せる)
// 返事を選ぶ掛け合い(choice)は、最後の行のあとに3つの返事を出す。選ぶと2人の反応が続く(選ぶまでは自動で進まない)
// replay … 関係図・アルバムから見返すときの台本(1日の数に入れず、仲良し度も上げない。返事は選び直せる)
// today … その日の遊び方 { battles, clears, enhances }(その日の出来事の掛け合いを選ぶのに使う)
function AssistantPeerTalk({ scene, metIds, selectedId, replay = null, onReplayEnd = null, today = null }) {
  const st = useAssistantPeerState();
  const [cur, setCur] = React.useState(null); // { talk, special, step, phase:'lines'|'choice'|'reply', pick, replay }
  const decidedRef = React.useRef('');
  const metKey = (metIds || []).join(',');
  React.useEffect(() => {
    if (replay) { setCur({ talk: replay, special: !!replay.special, step: 0, phase: 'lines', pick: null, replay: true }); return; }
    if (!assistantPeerEnabled() || !st.loaded || !scene) return;
    assistantPeerEnsureDaily(metIds);
    // 画面に入ったときに1回だけ決める
    const key = `${scene}:${selectedId}`;
    if (decidedRef.current === key) return;
    decidedRef.current = key;
    const picked = assistantPeerPickTalk(ASSISTANT_PEER_STORE.state, { scene, metIds, selectedId, today: today || {} });
    if (!picked) return;
    assistantPeerMarkShown(picked.talk, { scene, special: picked.special });
    setCur({ talk: picked.talk, special: picked.special, step: 0, phase: 'lines', pick: null });
  }, [scene, selectedId, st.loaded, replay, metKey]);
  // 画面が変わったら閉じる(見返しは閉じない)。次にその画面へ入ったときに、もう一度決める
  React.useEffect(() => { decidedRef.current = decidedRef.current.startsWith(`${scene}:`) ? decidedRef.current : ''; setCur(c => (c && !c.replay ? null : c)); }, [scene]);
  const [toast, setToast] = React.useState(null); // { kind:'level'|'daily', pair, level }
  const finish = React.useCallback(async (c) => {
    setCur(null);
    if (c.replay) { if (typeof onReplayEnd === 'function') onReplayEnd(); return; }
    const r = await assistantPeerGain(c.talk.pair[0], c.talk.pair[1], 'talk');
    assistantPeerAddPlayerBond(c.talk.pair, 'peerTalk');
    assistantPeerAlbumAdd(c.talk);
    const d = await assistantPeerDailyProgress(c.talk);
    if (d.done) setToast({ kind: 'daily', pair: c.talk.pair });
    else if (r && r.gained > 0 && r.levelAfter > r.levelBefore) setToast({ kind: 'level', pair: c.talk.pair, level: r.levelAfter });
  }, [onReplayEnd]);
  // 返事を選んだ(見返しでは何も増やさない)。加算は状態の更新の外で1回だけ
  const choose = (index) => {
    const c = cur;
    if (!c || c.phase !== 'choice') return;
    if (!c.replay) {
      assistantPeerSaveChoice(c.talk.id, index);
      void assistantPeerGain(c.talk.pair[0], c.talk.pair[1], 'choice');
      assistantPeerAddPlayerBond(c.talk.pair, 'peerChoice');
    }
    setCur({ ...c, phase: 'reply', pick: index, step: 0 });
  };
  const linesOf = (c) => (c.phase === 'reply' ? c.talk.choice[c.pick].reply : c.talk.lines);
  const advance = React.useCallback((c) => {
    if (!c) return;
    const list = linesOf(c);
    if (c.phase === 'choice') return;
    if (c.step + 1 < list.length) { setCur(x => x && ({ ...x, step: x.step + 1 })); return; }
    if (c.phase === 'lines' && Array.isArray(c.talk.choice) && c.talk.choice.length) { setCur(x => x && ({ ...x, phase: 'choice' })); return; }
    finish(c);
  }, [finish]);
  React.useEffect(() => {
    if (!cur || cur.phase === 'choice') return undefined;
    const t = setTimeout(() => advance(cur), ASSISTANT_PEER_LINE_MS + (cur.special ? 1200 : 0));
    return () => clearTimeout(t);
  }, [cur, advance]);
  React.useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);

  const wrap = (children, attrs = {}) => (
    <div className="fixed inset-x-0 flex justify-center px-2 pointer-events-none" style={{ zIndex: 8500, bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }} {...attrs}>
      <div className="pointer-events-auto w-full max-w-md">{children}</div>
    </div>
  );
  if (!cur) {
    if (!toast) return null;
    const [a, b] = toast.pair.map(id => assistantById(id));
    const stage = (typeof ASSISTANT_PEER_BOND_LEVELS !== 'undefined' ? ASSISTANT_PEER_BOND_LEVELS : []).find(s => s.level === toast.level);
    return wrap(
      <div data-assistant-peer-toast={toast.kind} className="mx-auto w-fit rounded-full border border-pink-300/60 bg-slate-950/90 px-4 py-1.5 text-[11px] font-black text-pink-200 shadow-xl">
        {toast.kind === 'daily' ? `今日のペア達成！ ${a.name}と${b.name}がもっと仲良くなりました` : `${a.name}と${b.name}の仲良し度が Lv${toast.level}${stage ? `「${stage.name}」` : ''}になりました`}
      </div>);
  }
  const { talk } = cur;
  const list = linesOf(cur);
  const line = cur.phase === 'choice' ? talk.lines[talk.lines.length - 1] : list[cur.step];
  // 左は最初に話す助手、右はその相手
  const left = assistantById(talk.lines[0].who);
  const right = assistantById(talk.pair.find(id => id !== left.id));
  const speaker = assistantById(line.who);
  const pairKey = assistantPeerPairKey(talk.pair[0], talk.pair[1]);
  const daily = st.daily && st.daily.day === assistantPeerDayKey() && st.daily.pair === pairKey ? st.daily : null;
  const face = (who) => {
    const speaking = who.id === line.who;
    return (
      <div className={`shrink-0 transition-all duration-200 ${speaking ? 'opacity-100 scale-100' : 'opacity-50 scale-90'}`} data-assistant-peer-face={who.id}>
        <AssistantFace who={who} size={44} accent={who.accent} expression={speaking ? line.e : 'normal'}/>
      </div>);
  };
  const total = talk.lines.length + (cur.phase === 'reply' ? list.length : 0);
  const pos = cur.phase === 'reply' ? talk.lines.length + cur.step + 1 : cur.phase === 'choice' ? talk.lines.length : cur.step + 1;
  return wrap(
    <div data-assistant-peer-talk={talk.id} data-assistant-peer-step={cur.step} data-assistant-peer-phase={cur.phase} role="button" tabIndex={0} onClick={() => advance(cur)}
      onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); advance(cur); } }}
      className="relative rounded-2xl border-2 bg-slate-950/92 px-2 py-2 shadow-2xl cursor-pointer select-none"
      style={{ borderColor: speaker.accent || '#f472b6', backgroundColor: '#020617' }}>
      {cur.special && <p data-assistant-peer-special className="mb-1 text-center text-[10px] font-black tracking-wider text-amber-200">✦ {left.name}と{right.name}の特別なお話 ✦</p>}
      {daily && !cur.replay && <p data-assistant-peer-daily-chip className="mb-1 w-fit rounded-full bg-amber-400/15 px-2 py-0.5 text-[9px] font-black text-amber-200">今日のペア {daily.done ? '達成！' : `${Math.min(daily.seen + 1, ASSISTANT_PEER_DAILY_GOAL)}/${ASSISTANT_PEER_DAILY_GOAL}`}</p>}
      <div className="flex items-center gap-2">
        {face(left)}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black leading-none" style={{ color: speaker.accent || '#f472b6' }}>{speaker.name}</p>
          <p data-assistant-peer-line className="mt-1 text-[12px] font-bold leading-snug text-white">{helpWrap(assistantPeerLineText(line, talk))}</p>
        </div>
        {face(right)}
      </div>
      {cur.phase === 'choice' && (
        <div data-assistant-peer-choices className="mt-2 grid gap-1.5">
          {talk.choice.map((o, i) => (
            <button key={i} type="button" data-assistant-peer-choice={i} onClick={ev => { ev.stopPropagation(); choose(i); }}
              className="min-h-[40px] rounded-xl border border-pink-300/50 bg-[#2a1030] px-3 py-1.5 text-left text-[12px] font-black text-pink-100 active:scale-[.98]">
              {o.label}
            </button>))}
        </div>)}
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[9px] font-bold text-slate-500">{cur.phase === 'choice' ? '返事をえらんでね' : `${pos}/${total}・タップで次へ`}</span>
        <button type="button" data-assistant-peer-close aria-label="閉じる" onClick={ev => { ev.stopPropagation(); finish(cur); }}
          className="h-7 w-7 rounded-full border border-slate-600 text-[13px] font-black text-slate-300 active:scale-95">×</button>
      </div>
    </div>);
}

// ---------- 思い出アルバム(ペアごと) ----------
// ツーショット写真(ASSISTANT_PEER_PHOTOS の段ごとに1枚。2人の立ち絵を並べて作る)と、見た掛け合いの一覧。押すと見返せる
function AssistantPeerPhoto({ pair, photo, open }) {
  const [a, b] = pair.map(id => assistantById(id));
  return (
    <div data-assistant-peer-photo={photo.lv} data-assistant-peer-photo-open={open ? '1' : '0'}
      className="relative overflow-hidden rounded-xl border-2" style={{ aspectRatio: '4 / 3', borderColor: open ? '#fcd34d' : 'rgba(255,255,255,.12)', background: open ? `linear-gradient(135deg, ${a.accent}55, ${b.accent}55)` : 'rgba(15,23,42,.8)' }}>
      {open ? (<>
        {/* 立ち絵の上のほう(顔から胸まで)を寄りで並べる */}
        <img src={assistantFullImage(a, photo.e[0])} alt="" loading="lazy" decoding="async" className="absolute left-[-2%] top-[6%] h-[170%] w-[56%]" style={{ objectFit: 'cover', objectPosition: '50% 0%' }}/>
        <img src={assistantFullImage(b, photo.e[1])} alt="" loading="lazy" decoding="async" className="absolute right-[-2%] top-[6%] h-[170%] w-[56%]" style={{ objectFit: 'cover', objectPosition: '50% 0%' }}/>
        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[9px] font-black text-amber-100">{photo.title}</span>
      </>) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center text-[10px] font-bold text-slate-500"><span className="text-lg" aria-hidden="true">🔒</span>Lv{photo.lv}で貼られます</span>)}
    </div>);
}
function AssistantPeerAlbum({ pair, onClose, onReplay }) {
  const st = useAssistantPeerState();
  const [a, b] = pair.map(id => assistantById(id));
  const key = assistantPeerPairKey(pair[0], pair[1]);
  const lv = assistantPeerLevel(st, pair[0], pair[1]);
  const photos = typeof ASSISTANT_PEER_PHOTOS !== 'undefined' ? ASSISTANT_PEER_PHOTOS : [];
  const seen = new Set(st.album[key] || []);
  // 特別なお話は見たら(Lv5 で流れたら)アルバムに入る。前に見た人の分は special の記録からも拾う
  const talks = assistantPeerTalkList().filter(t => assistantPeerPairKey(t.pair[0], t.pair[1]) === key && (seen.has(t.id) || (t.special && st.special.includes(key))));
  const all = assistantPeerTalkList().filter(t => assistantPeerPairKey(t.pair[0], t.pair[1]) === key).length;
  const firstLine = (t) => assistantPeerLineText(t.lines[0], t);
  return (
    <div data-assistant-peer-album={key} className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/70 p-2" style={{ zIndex: 9100 }} onClick={onClose}>
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto mh-scroll rounded-2xl border-2 border-amber-300/60 bg-slate-950 p-3" onClick={ev => ev.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2">
          <p className="min-w-0 flex-1 text-[13px] font-black text-amber-200">{a.name}と{b.name}の思い出アルバム</p>
          <button type="button" data-assistant-peer-album-close onClick={onClose} aria-label="閉じる" className="h-8 w-8 rounded-full border border-slate-600 text-[14px] font-black text-slate-300 active:scale-95">×</button>
        </div>
        <p className="mb-2 text-[10px] text-slate-400">仲良し度 Lv{lv}・見た掛け合い {talks.length}/{all}</p>
        <div className="grid grid-cols-2 gap-2">
          {photos.map(ph => <AssistantPeerPhoto key={ph.lv} pair={pair} photo={ph} open={lv >= ph.lv}/>)}
        </div>
        <p className="mb-1 mt-3 text-[11px] font-black text-pink-200">見た掛け合い</p>
        {talks.length === 0 && <p className="text-[10px] text-slate-500">2人の掛け合いを見ると、ここに集まります。</p>}
        <div className="space-y-1">
          {talks.map(t => (
            <button key={t.id} type="button" data-assistant-peer-replay={t.id} onClick={() => onReplay && onReplay(t)}
              className="flex w-full items-center gap-2 rounded-lg bg-slate-900/80 px-2 py-1.5 text-left active:scale-[.98]">
              <span className="shrink-0 text-[10px]" aria-hidden="true">{t.special ? '✦' : t.choice ? '💬' : '▶'}</span>
              <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-200">{t.special ? '特別なお話' : firstLine(t)}</span>
            </button>))}
        </div>
      </div>
    </div>);
}

// ---------- プロフィールの関係図(Lv3 から線が出る) ----------
// 会った助手を円に並べ、Lv3 以上のペアを線で結ぶ(太さ・色が Lv で変わる)。下に今日のペアと全部のペアの Lv。行を押すと思い出アルバム
function AssistantPeerMap({ metIds, onReplay }) {
  const st = useAssistantPeerState();
  // 一覧は仲良し度の高い6組だけ出し、残りは「全部のペアを見る」で広げる
  const [showAll, setShowAll] = React.useState(false);
  const [albumPair, setAlbumPair] = React.useState(null);
  const ids = (metIds || []).filter(id => assistantById(id) && assistantById(id).id === id);
  if (ids.length < 2) return null;
  const size = 260, cx = size / 2, cy = size / 2, r = 98;
  const pos = Object.fromEntries(ids.map((id, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / ids.length;
    return [id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }];
  }));
  const pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i], ids[j]]);
  const levels = (typeof ASSISTANT_PEER_BOND_LEVELS !== 'undefined' ? ASSISTANT_PEER_BOND_LEVELS : []);
  const lineColor = (lv) => (lv >= 9 ? '#fde68a' : lv >= 7 ? '#fcd34d' : lv >= 5 ? '#f9a8d4' : lv >= 4 ? '#c4b5fd' : '#93c5fd');
  const rows = pairs.map(([a, b]) => ({ a, b, pts: assistantPeerPoints(st, a, b), lv: assistantPeerLevel(st, a, b) }))
    .sort((x, y) => y.pts - x.pts);
  const daily = st.daily && st.daily.day === assistantPeerDayKey() && st.daily.pair ? st.daily : null;
  const dailyPair = daily ? daily.pair.split('-') : null;
  return (
    <div data-assistant-peer-map className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
      <p className="text-[12px] font-black text-pink-200">助手どうしの関係図</p>
      <p className="mb-2 text-[9px] leading-tight text-slate-400">助手どうしも仲良くなります。仲良し度 Lv3 になった2人は線で結ばれます。ペアを押すと思い出アルバムが開きます。</p>
      {dailyPair && dailyPair.every(id => ids.includes(id)) && (
        <button type="button" data-assistant-peer-daily onClick={() => setAlbumPair(dailyPair)}
          className="mb-2 flex w-full items-center gap-2 rounded-xl border border-amber-300/50 bg-amber-400/10 px-2 py-1.5 text-left active:scale-[.98]">
          <span className="text-[10px] font-black text-amber-200">今日のペア</span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-black text-white">{assistantById(dailyPair[0]).name} × {assistantById(dailyPair[1]).name}</span>
          <span className="text-[10px] font-black text-amber-200">{daily.done ? '達成！' : `掛け合い ${daily.seen}/${ASSISTANT_PEER_DAILY_GOAL}`}</span>
        </button>)}
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0" aria-hidden="true">
          {rows.filter(x => x.lv >= 3).map(x => (
            <line key={`${x.a}-${x.b}`} data-assistant-peer-link={assistantPeerPairKey(x.a, x.b)} x1={pos[x.a].x} y1={pos[x.a].y} x2={pos[x.b].x} y2={pos[x.b].y}
              stroke={lineColor(x.lv)} strokeWidth={Math.min(10, x.lv * 0.9)} strokeLinecap="round" opacity="0.85"/>))}
        </svg>
        {ids.map(id => { const who = assistantById(id); return (
          <div key={id} className="absolute flex flex-col items-center" style={{ left: pos[id].x - 24, top: pos[id].y - 24, width: 48 }}>
            <AssistantFace who={who} size={48} accent={who.accent}/>
            <span className="mt-0.5 whitespace-nowrap text-[9px] font-black text-slate-200">{who.name}</span>
          </div>); })}
      </div>
      <div className="mt-3 space-y-1">
        {(showAll ? rows : rows.slice(0, 6)).map(x => { const A = assistantById(x.a), B = assistantById(x.b); const stage = levels.find(s => s.level === x.lv); const nextStage = levels.find(s => s.level === x.lv + 1);
          return (
            <button key={`${x.a}-${x.b}`} type="button" data-assistant-peer-row={assistantPeerPairKey(x.a, x.b)} onClick={() => setAlbumPair([x.a, x.b])}
              className="flex w-full items-center gap-2 rounded-lg bg-slate-900/70 px-2 py-1 text-left active:scale-[.98]">
              <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-200">{A.name} × {B.name}</span>
              <span className="whitespace-nowrap text-[10px] font-black text-pink-200">Lv{x.lv}{stage ? ` ${stage.name}` : ''}</span>
              <span className="w-14 h-1.5 shrink-0 overflow-hidden rounded-full bg-slate-700" aria-hidden="true">
                <span className="block h-full bg-pink-400" style={{ width: `${nextStage ? Math.min(100, Math.round(100 * (x.pts - stage.min) / (nextStage.min - stage.min))) : 100}%` }}/>
              </span>
            </button>); })}
        {rows.length > 6 && (
          <button type="button" data-assistant-peer-more onClick={() => setShowAll(v => !v)}
            className="w-full rounded-lg border border-white/10 py-1.5 text-[10px] font-bold text-slate-300 active:scale-[.98]">
            {showAll ? 'たたむ' : `全部のペアを見る(${rows.length}組)`}
          </button>)}
      </div>
      {albumPair && <AssistantPeerAlbum pair={albumPair} onClose={() => setAlbumPair(null)} onReplay={(t) => { setAlbumPair(null); if (onReplay) onReplay(t); }}/>}
    </div>
  );
}

// ---------- API 版の掛け合いを頼む(段階3・kind:'peer_talks') ----------
// HOME に入ったときに呼ぶ。その日にまだ見ていない作った掛け合いが無く、頼んだ回数が上限より少ないときだけ頼む。
// 失敗・上限・オフラインのときは何もしない(台本版だけで流れる)。送るのは、会ったペアと呼び方・仲良し度、
// 遊んだ記録(数字だけ・buildAssistantDailyStats)、30日以内に話した助手の思い出メモ(ないしょを除く)。会話の本文は送らない
let assistantPeerGenBusy = false;
const assistantPeerRequestGen = async ({ metIds, stats }) => {
  if (!assistantPeerApiEnabled() || assistantPeerGenBusy) return 'skip';
  await ASSISTANT_PEER_STORE.load();
  const st = ASSISTANT_PEER_STORE.state;
  const day = assistantPeerDayKey();
  const gen = st.gen && st.gen.day === day ? st.gen : { day, asked: 0, talks: [] };
  const met = (metIds || []).filter(id => typeof ASSISTANT_PEER_CALLS !== 'undefined' && ASSISTANT_PEER_CALLS[id]);
  const seen = st.log.map(x => x.id);
  if (gen.talks.some(t => !seen.includes(t.id) && t.pair.every(id => met.includes(id)))) return 'cached';
  if (gen.asked >= ASSISTANT_PEER_GEN_ASK_MAX || met.length < 2) return 'skip';
  const pairs = [];
  for (let i = 0; i < met.length; i++) for (let j = i + 1; j < met.length; j++) {
    const a = met[i], b = met[j], lv = assistantPeerLevel(st, a, b);
    pairs.push({ a, b, lv, ab: assistantPeerCall(a, b), ba: assistantPeerCall(b, a) });
  }
  assistantPeerGenBusy = true;
  const asked = { ...gen, asked: gen.asked + 1 };
  ASSISTANT_PEER_STORE.set({ gen: asked });
  try { storeSet(ASSISTANT_PEER_TALK_GEN_KEY, asked, false); } catch {}
  try {
    const [rawMemo, rawMemoV2, rawLast] = await Promise.all([storeGet(ASSISTANT_CHAT_MEMO_KEY, {}, false), storeGet(ASSISTANT_CHAT_MEMO_V2_KEY, {}, false), storeGet(ASSISTANT_CHAT_LAST_KEY, {}, false)]);
    const peerMemos = assistantPeerMemosFor(null, normalizeAssistantChatMemo(rawMemoV2, rawMemo), normalizeAssistantChatLast(rawLast));
    const breederId = await ensureBreederId();
    const r = await fetch(ASSISTANT_CHAT_URL, { method: 'POST', headers: SB_HEADERS,
      body: JSON.stringify({ kind: 'peer_talks', breederId: breederId || 'unknown', pairs, peerMemos, stats }) });
    const res = r.ok ? await r.json() : null;
    if (!res || res.ok !== true || !Array.isArray(res.talks)) return 'failed';
    const stamp = `${day.replace(/-/g, '')}-${asked.asked}`;
    const next = normalizeAssistantPeerGen({ day, asked: asked.asked, talks: [...asked.talks, ...res.talks.map((t, i) => ({ ...t, id: `gen-${stamp}-${i + 1}` }))] });
    ASSISTANT_PEER_STORE.set({ gen: next });
    try { storeSet(ASSISTANT_PEER_TALK_GEN_KEY, next, false); } catch {}
    return next.talks.length > asked.talks.length ? 'ok' : 'failed';
  } catch { return 'failed'; } finally { assistantPeerGenBusy = false; }
};
