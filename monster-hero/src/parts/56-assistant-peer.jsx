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
const ASSISTANT_PEER_BOND_STORE_KEY = 'mh_assistant_peer_bond_v1';
const ASSISTANT_PEER_BOND_DAY_KEY = 'mh_assistant_peer_bond_day_v1';
const ASSISTANT_PEER_TALK_LOG_KEY = 'mh_assistant_peer_talk_log_v1';
const ASSISTANT_PEER_TALK_DAY_KEY = 'mh_assistant_peer_talk_day_v1';
const ASSISTANT_PEER_SPECIAL_SEEN_KEY = 'mh_assistant_peer_special_seen_v1';
const ASSISTANT_PEER_TALK_GEN_KEY = 'mh_assistant_peer_talk_gen_v1';
const ASSISTANT_PEER_TALK_LOG_MAX = 30;
// API 版(段階3)。1日に頼む回数(サーバの上限と同じ3回)と、作ったものを台本より先に出す割合
const ASSISTANT_PEER_GEN_ASK_MAX = 3;
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
  state: { loaded: false, bond: {}, bondDay: { day: null, got: {} }, log: [], talkDay: { day: null, home: 0, other: 0 }, special: [], gen: { day: null, asked: 0, talks: [] }, lastShownAt: 0 },
  loading: null,
  listeners: new Set(),
  emit() { for (const fn of this.listeners) { try { fn(this.state); } catch {} } },
  set(patch) { this.state = { ...this.state, ...patch }; this.emit(); },
  load() {
    if (this.state.loaded) return Promise.resolve(this.state);
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const [bond, bondDay, log, talkDay, special, gen] = await Promise.all([
        storeGet(ASSISTANT_PEER_BOND_STORE_KEY, {}, false), storeGet(ASSISTANT_PEER_BOND_DAY_KEY, null, false),
        storeGet(ASSISTANT_PEER_TALK_LOG_KEY, [], false), storeGet(ASSISTANT_PEER_TALK_DAY_KEY, null, false),
        storeGet(ASSISTANT_PEER_SPECIAL_SEEN_KEY, [], false), storeGet(ASSISTANT_PEER_TALK_GEN_KEY, null, false),
      ].map(p => Promise.resolve(p).catch(() => null)));
      this.set({ loaded: true, bond: normalizeAssistantPeerBond(bond), bondDay: normalizeAssistantPeerBondDay(bondDay),
        log: normalizeAssistantPeerTalkLog(log), talkDay: normalizeAssistantPeerTalkDay(talkDay), special: normalizeAssistantPeerSpecialSeen(special), gen: normalizeAssistantPeerGen(gen) });
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
  const usedAll = Object.values(got).reduce((s, v) => s + v, 0);
  const pairMax = (typeof ASSISTANT_PEER_BOND_DAILY_MAX !== 'undefined' && ASSISTANT_PEER_BOND_DAILY_MAX) || 12;
  const gain = Math.max(0, Math.min(act.amount, act.dailyMax - usedAct, pairMax - usedAll));
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
  const r = assistantPeerGainState(ASSISTANT_PEER_STORE.state, a, b, action, assistantBubbleDayKey());
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

// ---------- 掛け合いを選ぶ ----------
// metIds … 会った助手(選べる助手)。selectedId … いま一緒にいる助手(その助手が入るペアを出やすくする)
// 返すのは { talk, special } か null。rand は検査から決めた値を渡せる
const assistantPeerPickTalk = (st, { scene, metIds, selectedId, now = Date.now(), rand = Math.random }) => {
  const met = new Set(metIds || []);
  const ok = (t) => t && Array.isArray(t.pair) && t.pair.length === 2 && t.pair.every(id => met.has(id));
  const all = assistantPeerTalkList().filter(ok);
  // Lv5 になったペアの特別なお話は、まだ見ていなければ HOME で先に流す(1日の数には入れない)
  if (scene === 'home') {
    const sp = all.find(t => t.special && assistantPeerLevel(st, t.pair[0], t.pair[1]) >= 5 && !st.special.includes(assistantPeerPairKey(t.pair[0], t.pair[1])));
    if (sp) return { talk: sp, special: true };
  }
  const day = assistantBubbleDayKey(now);
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
  // 重み: いまの助手が入るペアは3倍。仲良し度Lv2から掛け合いが増える(Lv が上がるほど出やすい)
  const weight = (t) => (t.pair.includes(selectedId) ? 3 : 1) * (1 + 0.5 * (assistantPeerLevel(st, t.pair[0], t.pair[1]) - 1));
  const sum = pool.reduce((s, t) => s + weight(t), 0);
  let r = rand() * sum;
  for (const t of pool) { r -= weight(t); if (r <= 0) return { talk: t, special: false }; }
  return { talk: pool[pool.length - 1], special: false };
};
// 流したことを残す(1日の数・最近の記録・特別なお話)
const assistantPeerMarkShown = (talk, { scene, special, now = Date.now() }) => {
  const st = ASSISTANT_PEER_STORE.state;
  const day = assistantBubbleDayKey(now);
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
// 台本の {c} を、話している助手が相手を呼ぶ呼び方へ置きかえる(Lv4 からはくだけた呼び方。表が決まるまでは今の呼び方)
const assistantPeerLineText = (line, talk, level) => {
  const partner = talk.pair.find(id => id !== line.who) || talk.pair[0];
  const call = typeof assistantPeerCall === 'function' ? assistantPeerCall(line.who, partner, level) : partner;
  return String(line.t || '').replace(/\{c\}/g, call);
};

// ---------- 掛け合いの表示 ----------
// 画面の下に、2人の顔と1行ずつのセリフを出す。押すと次へ、×で閉じる。ゲームの操作はふさがない(この帯だけが押せる)
// replay … 関係図から見返すときの台本(1日の数に入れず、仲良し度も上げない)
function AssistantPeerTalk({ scene, metIds, selectedId, replay = null, onReplayEnd = null }) {
  const st = useAssistantPeerState();
  const [cur, setCur] = React.useState(null); // { talk, special, step, level }
  const decidedRef = React.useRef('');
  React.useEffect(() => {
    if (replay) { setCur({ talk: replay, special: !!replay.special, step: 0, level: assistantPeerLevel(ASSISTANT_PEER_STORE.state, replay.pair[0], replay.pair[1]), replay: true }); return; }
    if (!assistantPeerEnabled() || !st.loaded || !scene) return;
    // 画面に入ったときに1回だけ決める
    const key = `${scene}:${selectedId}`;
    if (decidedRef.current === key) return;
    decidedRef.current = key;
    const picked = assistantPeerPickTalk(ASSISTANT_PEER_STORE.state, { scene, metIds, selectedId });
    if (!picked) return;
    assistantPeerMarkShown(picked.talk, { scene, special: picked.special });
    setCur({ talk: picked.talk, special: picked.special, step: 0, level: assistantPeerLevel(ASSISTANT_PEER_STORE.state, picked.talk.pair[0], picked.talk.pair[1]) });
  }, [scene, selectedId, st.loaded, replay]);
  // 画面が変わったら閉じる(見返しは閉じない)。次にその画面へ入ったときに、もう一度決める
  React.useEffect(() => { decidedRef.current = decidedRef.current.startsWith(`${scene}:`) ? decidedRef.current : ''; setCur(c => (c && !c.replay ? null : c)); }, [scene]);
  const [levelUp, setLevelUp] = React.useState(null);
  const finish = React.useCallback(async (c) => {
    setCur(null);
    if (c.replay) { if (typeof onReplayEnd === 'function') onReplayEnd(); return; }
    const r = await assistantPeerGain(c.talk.pair[0], c.talk.pair[1], 'talk');
    if (r && r.gained > 0 && r.levelAfter > r.levelBefore) setLevelUp({ pair: c.talk.pair, level: r.levelAfter });
  }, [onReplayEnd]);
  React.useEffect(() => {
    if (!cur) return undefined;
    const t = setTimeout(() => {
      if (cur.step + 1 < cur.talk.lines.length) setCur(c => c && ({ ...c, step: c.step + 1 }));
      else finish(cur);
    }, ASSISTANT_PEER_LINE_MS + (cur.special ? 1200 : 0));
    return () => clearTimeout(t);
  }, [cur, finish]);
  React.useEffect(() => { if (!levelUp) return undefined; const t = setTimeout(() => setLevelUp(null), 3200); return () => clearTimeout(t); }, [levelUp]);

  const wrap = (children, attrs = {}) => (
    <div className="fixed inset-x-0 flex justify-center px-2 pointer-events-none" style={{ zIndex: 8500, bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }} {...attrs}>
      <div className="pointer-events-auto w-full max-w-md">{children}</div>
    </div>
  );
  if (!cur) {
    if (!levelUp) return null;
    const [a, b] = levelUp.pair.map(id => assistantById(id));
    const stage = (typeof ASSISTANT_PEER_BOND_LEVELS !== 'undefined' ? ASSISTANT_PEER_BOND_LEVELS : []).find(s => s.level === levelUp.level);
    return wrap(
      <div data-assistant-peer-levelup={levelUp.level} className="mx-auto w-fit rounded-full border border-pink-300/60 bg-slate-950/90 px-4 py-1.5 text-[11px] font-black text-pink-200 shadow-xl">
        {a.name}と{b.name}の仲良し度が Lv{levelUp.level}{stage ? `「${stage.name}」` : ''}になりました
      </div>);
  }
  const { talk, step, level } = cur;
  const line = talk.lines[step];
  // 左は最初に話す助手、右はその相手
  const left = assistantById(talk.lines[0].who);
  const right = assistantById(talk.pair.find(id => id !== left.id));
  const speaker = assistantById(line.who);
  const next = () => { if (step + 1 < talk.lines.length) setCur(c => c && ({ ...c, step: c.step + 1 })); else finish(cur); };
  const face = (who) => {
    const speaking = who.id === line.who;
    return (
      <div className={`shrink-0 transition-all duration-200 ${speaking ? 'opacity-100 scale-100' : 'opacity-50 scale-90'}`} data-assistant-peer-face={who.id}>
        <AssistantFace who={who} size={44} accent={who.accent} expression={speaking ? line.e : 'normal'}/>
      </div>);
  };
  return wrap(
    <div data-assistant-peer-talk={talk.id} data-assistant-peer-step={step} role="button" tabIndex={0} onClick={next}
      onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); next(); } }}
      className="relative rounded-2xl border-2 bg-slate-950/92 px-2 py-2 shadow-2xl cursor-pointer select-none"
      style={{ borderColor: speaker.accent || '#f472b6', backgroundColor: 'rgba(2,6,23,.92)' }}>
      {cur.special && <p data-assistant-peer-special className="mb-1 text-center text-[10px] font-black tracking-wider text-amber-200">✦ {left.name}と{right.name}の特別なお話 ✦</p>}
      <div className="flex items-center gap-2">
        {face(left)}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black leading-none" style={{ color: speaker.accent || '#f472b6' }}>{speaker.name}</p>
          <p data-assistant-peer-line className="mt-1 text-[12px] font-bold leading-snug text-white">{helpWrap(assistantPeerLineText(line, talk, level))}</p>
        </div>
        {face(right)}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[9px] font-bold text-slate-500">{step + 1}/{talk.lines.length}・タップで次へ</span>
        <button type="button" data-assistant-peer-close aria-label="閉じる" onClick={ev => { ev.stopPropagation(); finish({ ...cur, step: talk.lines.length - 1 }); }}
          className="h-7 w-7 rounded-full border border-slate-600 text-[13px] font-black text-slate-300 active:scale-95">×</button>
      </div>
    </div>);
}

// ---------- プロフィールの関係図(Lv3 から線が出る) ----------
// 会った助手を円に並べ、Lv3 以上のペアを線で結ぶ(太さ・色が Lv で変わる)。下に全部のペアの Lv と、見られる特別なお話を出す
function AssistantPeerMap({ metIds, onReplay }) {
  const st = useAssistantPeerState();
  // 一覧は仲良し度の高い6組だけ出し、残りは「全部のペアを見る」で広げる
  const [showAll, setShowAll] = React.useState(false);
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
  const lineColor = ['', '', '', '#93c5fd', '#f9a8d4', '#fcd34d'];
  const rows = pairs.map(([a, b]) => ({ a, b, pts: assistantPeerPoints(st, a, b), lv: assistantPeerLevel(st, a, b) }))
    .sort((x, y) => y.pts - x.pts);
  const specials = assistantPeerTalkList().filter(t => t.special && st.special.includes(assistantPeerPairKey(t.pair[0], t.pair[1])));
  return (
    <div data-assistant-peer-map className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
      <p className="text-[12px] font-black text-pink-200">助手どうしの関係図</p>
      <p className="mb-2 text-[9px] leading-tight text-slate-400">助手どうしも仲良くなります。仲良し度 Lv3 になった2人は線で結ばれます。</p>
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0" aria-hidden="true">
          {rows.filter(x => x.lv >= 3).map(x => (
            <line key={`${x.a}-${x.b}`} data-assistant-peer-link={assistantPeerPairKey(x.a, x.b)} x1={pos[x.a].x} y1={pos[x.a].y} x2={pos[x.b].x} y2={pos[x.b].y}
              stroke={lineColor[x.lv]} strokeWidth={x.lv * 1.2} strokeLinecap="round" opacity="0.85"/>))}
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
            <div key={`${x.a}-${x.b}`} data-assistant-peer-row={assistantPeerPairKey(x.a, x.b)} className="flex items-center gap-2 rounded-lg bg-slate-900/70 px-2 py-1">
              <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-200">{A.name} × {B.name}</span>
              <span className="text-[10px] font-black text-pink-200">Lv{x.lv}{stage ? ` ${stage.name}` : ''}</span>
              <span className="w-14 h-1.5 overflow-hidden rounded-full bg-slate-700" aria-hidden="true">
                <span className="block h-full bg-pink-400" style={{ width: `${nextStage ? Math.min(100, Math.round(100 * (x.pts - stage.min) / (nextStage.min - stage.min))) : 100}%` }}/>
              </span>
            </div>); })}
        {rows.length > 6 && (
          <button type="button" data-assistant-peer-more onClick={() => setShowAll(v => !v)}
            className="w-full rounded-lg border border-white/10 py-1.5 text-[10px] font-bold text-slate-300 active:scale-[.98]">
            {showAll ? 'たたむ' : `全部のペアを見る(${rows.length}組)`}
          </button>)}
      </div>
      {specials.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-black text-amber-200">特別なお話を見返す</p>
          <div className="flex flex-wrap gap-1.5">
            {specials.map(t => (
              <button key={t.id} type="button" data-assistant-peer-replay={t.id} onClick={() => onReplay && onReplay(t)}
                className="rounded-full border border-amber-300/50 px-2.5 py-1 text-[10px] font-bold text-amber-100 active:scale-95">
                {assistantById(t.lines[0].who).name} × {assistantById(t.pair.find(id => id !== t.lines[0].who)).name}
              </button>))}
          </div>
        </div>)}
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
  const day = assistantBubbleDayKey();
  const gen = st.gen && st.gen.day === day ? st.gen : { day, asked: 0, talks: [] };
  const met = (metIds || []).filter(id => typeof ASSISTANT_PEER_CALLS !== 'undefined' && ASSISTANT_PEER_CALLS[id]);
  const seen = st.log.map(x => x.id);
  if (gen.talks.some(t => !seen.includes(t.id) && t.pair.every(id => met.includes(id)))) return 'cached';
  if (gen.asked >= ASSISTANT_PEER_GEN_ASK_MAX || met.length < 2) return 'skip';
  const pairs = [];
  for (let i = 0; i < met.length; i++) for (let j = i + 1; j < met.length; j++) {
    const a = met[i], b = met[j], lv = assistantPeerLevel(st, a, b);
    pairs.push({ a, b, lv, ab: assistantPeerCall(a, b, lv), ba: assistantPeerCall(b, a, lv) });
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
