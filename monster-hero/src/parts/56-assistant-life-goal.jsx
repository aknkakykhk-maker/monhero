// ===== 助手ライフの作り直し 段5: 今日の目標の土台(docs/spec/ASSISTANT_LIFE.md §7-3・§8 段5) =====
// 毎日すること: 家で「見る・話す・贈る・誘う」。4つのうち3つで「今日の目標を達成」(2026-11-21 社長 A)
// 保存は新しいキー mh_assistant_life_goal_v1 だけ = { v:1, day:'YYYY-MM-DD', done:{ watch, talk, give, play }, streak, basket }
//   streak … 目標を達成した日の数(7日でごほうび。とびとびでよい・今の「聞いた日」と同じ数え方) / basket … 7日のごほうびを受け取った回数
// 一度きりの写し: 初めて読むとき、今の mh_assistant_life_daily_v1 から「続けた日数(days の数)」と「7日のバスケットの数(claims)」だけを写し、
//   印 mh_assistant_life_goal_migrated_v1 を付ける。印があれば二度と写さない。古いキーは消さず、書き換えもしない(CLAUDE.md ⑦)
// 画面にはまだ出さない(段6〜7 で家の型に載せる)。ごほうびの配り方・旧UIの7日の記録は今のまま(この部品は配らない)
const ASSISTANT_LIFE_GOAL_KEY = 'mh_assistant_life_goal_v1';
const ASSISTANT_LIFE_GOAL_MIGRATED_KEY = 'mh_assistant_life_goal_migrated_v1';
const ASSISTANT_LIFE_GOAL_KINDS = Object.freeze(['watch', 'talk', 'give', 'play']);
const ASSISTANT_LIFE_GOAL_NEED = 3; // 4つのうち3つで達成
const ASSISTANT_LIFE_GOAL_DAYS = 7; // 7日達成でごほうび(今の7日のバスケットと同じ数)
const ASSISTANT_LIFE_GOAL_LABEL = Object.freeze({ watch: '👀 見る', talk: '💬 話す', give: '🎁 贈る', play: '🎵 誘う' });

const assistantLifeGoalDay = () => {
  try { if (typeof assistantLifePerkDay === 'function') return assistantLifePerkDay(); } catch (_) {}
  try { if (typeof jstDayKey4 === 'function') return jstDayKey4(); } catch (_) {}
  return '';
};
const assistantLifeGoalCount = (n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
// 読むときは必ずここを通す(形が違う・壊れている → 空の目標から)
const normalizeAssistantLifeGoal = (raw) => {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const d = o.done && typeof o.done === 'object' && !Array.isArray(o.done) ? o.done : {};
  const done = {};
  for (const k of ASSISTANT_LIFE_GOAL_KINDS) done[k] = d[k] === true;
  return {
    v: 1,
    day: typeof o.day === 'string' ? o.day : '',
    done,
    streak: assistantLifeGoalCount(o.streak),
    basket: assistantLifeGoalCount(o.basket),
  };
};
// その日の目標(日が変わっていれば done を空に。streak・basket はそのまま)
const assistantLifeGoalToday = (st, day) => {
  const s = normalizeAssistantLifeGoal(st);
  if (s.day === day) return s;
  const done = {}; for (const k of ASSISTANT_LIFE_GOAL_KINDS) done[k] = false;
  return { ...s, day, done };
};
const assistantLifeGoalDoneCount = (st) => ASSISTANT_LIFE_GOAL_KINDS.filter(k => st && st.done && st.done[k] === true).length;
const assistantLifeGoalAchieved = (st) => assistantLifeGoalDoneCount(st) >= ASSISTANT_LIFE_GOAL_NEED;
// 1つ済ませたときの次の状態。同じ日の同じ行動は2回数えない。3つ目で達成した日だけ streak を1足す(4つ目では足さない)
const assistantLifeGoalMark = (st, kind, day) => {
  const s = assistantLifeGoalToday(st, day);
  if (!ASSISTANT_LIFE_GOAL_KINDS.includes(kind) || s.done[kind]) return { st: s, added: false, achieved: false };
  const before = assistantLifeGoalAchieved(s);
  const next = { ...s, done: { ...s.done, [kind]: true } };
  const now = assistantLifeGoalAchieved(next);
  const achieved = !before && now;
  return { st: achieved ? { ...next, streak: next.streak + 1 } : next, added: true, achieved };
};
// 一度きりの写しの中身(純粋な計算)。今の7日の記録から、続けた日数と受け取った回数だけ
const assistantLifeGoalFromDaily = (daily) => {
  const d = typeof assistantLifeDailyNormalize === 'function' ? assistantLifeDailyNormalize(daily) : { days: [], claims: 0 };
  const g = normalizeAssistantLifeGoal(null);
  return { ...g, streak: Math.min(ASSISTANT_LIFE_GOAL_DAYS, Array.isArray(d.days) ? d.days.length : 0), basket: assistantLifeGoalCount(d.claims) };
};

const ASSISTANT_LIFE_GOAL_STORE = {
  loaded: false, p: null, state: normalizeAssistantLifeGoal(null), subs: new Set(),
  // 読む(初めてのときだけ写す)。写しは印で1回だけ。すでに新しいキーがあれば写さず、それを読む
  async load() {
    if (this.loaded) return this.state;
    if (!this.p) this.p = (async () => {
      try {
        const [cur, migrated] = await Promise.all([storeGet(ASSISTANT_LIFE_GOAL_KEY, null, false), storeGet(ASSISTANT_LIFE_GOAL_MIGRATED_KEY, null, false)]);
        if (migrated === true) { this.state = normalizeAssistantLifeGoal(cur); }
        else if (cur && typeof cur === 'object') { this.state = normalizeAssistantLifeGoal(cur); try { await storeSet(ASSISTANT_LIFE_GOAL_MIGRATED_KEY, true, false); } catch (_) {} }
        else {
          const daily = typeof ASSISTANT_LIFE_DAILY_KEY !== 'undefined' ? await storeGet(ASSISTANT_LIFE_DAILY_KEY, null, false) : null;
          this.state = assistantLifeGoalFromDaily(daily);
          try { await storeSet(ASSISTANT_LIFE_GOAL_KEY, this.state, false); await storeSet(ASSISTANT_LIFE_GOAL_MIGRATED_KEY, true, false); } catch (_) {}
        }
      } catch (_) { this.state = normalizeAssistantLifeGoal(null); }
      this.loaded = true;
      this.subs.forEach(f => { try { f(this.state); } catch (_) {} });
      return this.state;
    })();
    return this.p;
  },
};
// 済ませた行動を数える口(段7 で家の「見る・話す・贈る・誘う」から呼ぶ)。返すのは { added, achieved, st }
const assistantLifeGoalNote = async (kind) => {
  const S = ASSISTANT_LIFE_GOAL_STORE;
  await S.load();
  const r = assistantLifeGoalMark(S.state, kind, assistantLifeGoalDay());
  S.state = r.st;
  if (r.added) { try { await storeSet(ASSISTANT_LIFE_GOAL_KEY, r.st, false); } catch (_) {} S.subs.forEach(f => { try { f(r.st); } catch (_) {} }); }
  return { added: r.added, achieved: r.achieved, st: r.st };
};
// 見る口: 今日の目標(日が変わっていれば空)。{ day, done, count, need, achieved, streak, days, basket }
const assistantLifeGoalView = (st = ASSISTANT_LIFE_GOAL_STORE.state, day = assistantLifeGoalDay()) => {
  const s = assistantLifeGoalToday(st, day);
  const count = assistantLifeGoalDoneCount(s);
  return { day: s.day, done: s.done, count, need: ASSISTANT_LIFE_GOAL_NEED, achieved: count >= ASSISTANT_LIFE_GOAL_NEED, streak: s.streak, days: ASSISTANT_LIFE_GOAL_DAYS, basket: s.basket };
};
