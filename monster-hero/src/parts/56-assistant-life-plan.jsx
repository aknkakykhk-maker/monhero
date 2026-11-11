// ===== 助手ライフ: 助手の行き先の予定(📅 今日の予定表)=====
// 2026-11-11 社長「助手を次の移動のときにどこにいかすか提案したりスケジュールを組めるようにしたい」(台帳 #5301)。
//   設計 docs/progress/assistant-life/SCHEDULE-PLAN.md(8. が移動12回での形)・見本 docs/progress/assistant-life/schedule/mock.html
//   ・入口は3つ: 町の地図の場所の窓/部屋の「できること」/家の上の小さな1行「📅 今日の予定表」
//   ・聞いてくれる割合は仲良し度で 65〜93%(Lv1 で 65%・1Lv ごとに +1%・Lv29 から 93%)。決まるのは時間帯の乱数で、開き直しても変わらない
//   ・縦は1人ずつ(回が縦に並ぶ)・横は8人×4回の表/組めるのは今日の 4時〜24時の回だけ(深夜は出さない)
//   ・公開の印 RELEASE_FLAGS.assistantLifePlan の後ろ。偽のあいだは何も出さず、保存も読まない
// 保存(新しいキーだけ。既存の mh_assistant_life_v1 は変えない・CLAUDE.md ⑦):
//   mh_assistant_life_plan_v1 = { day: 日の通し番号(abs ÷ 12), plan: { [abs]: { [助手id]: 場所id } }, result: { [abs]: { [助手id]: 'ok'|'no' } } }
//   日が替わったら捨てる(次の日の予定は持たない)。壊れていれば空
const ASSISTANT_LIFE_PLAN_KEY = 'mh_assistant_life_plan_v1';
// 予定に入れられる場所(その場所でできる「していること」があるところ。マーケットは助手が行かない)
const ASSISTANT_LIFE_PLAN_PLACES = Object.freeze(['cafe', 'plaza', 'garden', 'hill', 'studio', 'ranch', 'cardroom', 'library', 'battle', 'home']);
const ASSISTANT_LIFE_PLAN_FIRST_J = 2; // 4〜6時の回から(0〜4時の深夜は出さない)
const ASSISTANT_LIFE_PLAN_TRUST = Object.freeze({ base: 0.65, perLv: 0.01, max: 0.93 });

const assistantLifePlanOn = () => {
  try { return typeof assistantLifeEnabled === 'function' && assistantLifeEnabled() && typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantLifePlan === true; } catch (_) { return false; }
};
const assistantLifePlanOkId = (id) => typeof id === 'string' && typeof ASSISTANT_LIFE_PREFS !== 'undefined' && !!ASSISTANT_LIFE_PREFS[id];
const assistantLifePlanOkPlace = (p) => ASSISTANT_LIFE_PLAN_PLACES.includes(p);
// 保存の値を今日の形へ(壊れている・日が違う → 空)
const normalizeAssistantLifePlan = (raw, day) => {
  const out = { day: Number.isInteger(day) ? day : null, plan: {}, result: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Number.isInteger(day) || raw.day !== day) return out;
  const inDay = (k) => { const a = Number(k); return Number.isInteger(a) && Math.floor(a / 12) === day; };
  if (raw.plan && typeof raw.plan === 'object' && !Array.isArray(raw.plan)) {
    for (const [k, m] of Object.entries(raw.plan)) {
      if (!inDay(k) || !m || typeof m !== 'object' || Array.isArray(m)) continue;
      const row = {}; for (const [id, p] of Object.entries(m)) if (assistantLifePlanOkId(id) && assistantLifePlanOkPlace(p)) row[id] = p;
      if (Object.keys(row).length) out.plan[String(Number(k))] = row;
    }
  }
  if (raw.result && typeof raw.result === 'object' && !Array.isArray(raw.result)) {
    for (const [k, m] of Object.entries(raw.result)) {
      if (!inDay(k) || !m || typeof m !== 'object' || Array.isArray(m)) continue;
      const row = {}; for (const [id, r] of Object.entries(m)) if (assistantLifePlanOkId(id) && (r === 'ok' || r === 'no')) row[id] = r;
      if (Object.keys(row).length) out.result[String(Number(k))] = row;
    }
  }
  return out;
};
// 聞いてくれる割合(プレイヤーとの仲良し度の Lv から)
const assistantLifePlanTrust = (lv) => {
  const L = Number.isFinite(lv) ? Math.max(1, Math.floor(lv)) : 1;
  return Math.min(ASSISTANT_LIFE_PLAN_TRUST.max, ASSISTANT_LIFE_PLAN_TRUST.base + (L - 1) * ASSISTANT_LIFE_PLAN_TRUST.perLv);
};
const assistantLifePlanLvOf = (id) => {
  try { const p = typeof assistantLifeBondPointsOf === 'function' ? assistantLifeBondPointsOf(id) : null; return Number.isFinite(p) && typeof assistantBondLevelOf === 'function' ? assistantBondLevelOf(p) : 1; } catch (_) { return 1; }
};

// ---------- 当てはめ(純粋な関数。検査が直接呼ぶ) ----------
// decided … assistantLifeDecide の結果 / want … { 助手id: 場所 } / trust … { 助手id: 0〜1 } / salt
// 聞いてくれた助手は、その場所でその助手がしたいこと(好みの重み)をする。同じ場所に聞いてくれた助手が2人以上いて、
// みんなでできることなら1つの組にする。組から抜けて1人になった助手は、ひとりで過ごす(していることはそのまま)。
// 返す: { life(同じ形), result: { id: 'ok'|'no' } }。断った助手の様子はふだんどおり(decided のまま)
const assistantLifePlanApply = (decided, want, trust = {}, salt = '') => {
  if (!decided || !want || typeof want !== 'object') return { life: decided, result: {} };
  const abs = decided.abs;
  const all = new Set([...(decided.groups || []).flatMap(g => g.ids), ...Object.keys(decided.solo || {})]);
  const result = {}; const yes = {};
  for (const id of Object.keys(want).sort()) {
    const place = want[id];
    if (!all.has(id) || !assistantLifePlanOkPlace(place)) continue;
    const r = assistantLifeRng(`${salt}|plan|${abs}|${id}`)();
    const p = Number.isFinite(trust[id]) ? trust[id] : ASSISTANT_LIFE_PLAN_TRUST.base;
    if (r < p) { result[id] = 'ok'; yes[id] = place; } else result[id] = 'no';
  }
  const ids = Object.keys(yes);
  if (!ids.length) return { life: decided, result };
  const where = (id) => { const g = (decided.groups || []).find(x => x.ids.includes(id)); return g ? g.place : (decided.solo[id] || {}).place; };
  const moved = ids.filter(id => where(id) !== yes[id]); // もうその場所にいる助手は、そのまま(組も崩さない)
  if (!moved.length) return { life: decided, result };
  const mv = new Set(moved);
  const solo = { ...decided.solo };
  const groups = [];
  for (const g of decided.groups || []) {
    const left = g.ids.filter(id => !mv.has(id));
    if (left.length === g.ids.length) { groups.push(g); continue; }
    // 残りが2人で家・寝る なら、家は3人から(ふだんの決め方と同じ)。その2人はひとりずつに
    if (left.length >= 2 && !(g.place === 'home' && left.length < 3)) groups.push({ ...g, ids: left });
    else for (const id of left) solo[id] = { doing: g.doing, place: g.place, reason: 'mypace' };
  }
  for (const id of moved) delete solo[id];
  const doingAt = (id, place, groupOnly) => {
    const pw = (ASSISTANT_LIFE_PREFS[id] && ASSISTANT_LIFE_PREFS[id].w) || {};
    const w = {}; for (const [d, def] of Object.entries(ASSISTANT_LIFE_DOINGS)) if (def.places.includes(place) && (!groupOnly || def.group) && d !== 'sleep') w[d] = (pw[d] || 0) + 0.2;
    return assistantLifePickWeighted(w, assistantLifeRng(`${salt}|plan-do|${abs}|${id}|${place}`));
  };
  const byPlace = {};
  for (const id of moved.sort()) (byPlace[yes[id]] = byPlace[yes[id]] || []).push(id);
  for (const [place, list] of Object.entries(byPlace)) {
    const gd = list.length >= 2 && !(place === 'home' && list.length < 3) ? doingAt(list[0], place, true) : null;
    if (gd) { groups.push({ ids: [...list].sort(), doing: gd, place }); continue; }
    for (const id of list) solo[id] = { doing: doingAt(id, place, false) || 'idle', place, reason: 'mypace' };
  }
  const lonely = (decided.lonely || []).filter(id => solo[id] && solo[id].reason === 'lonely');
  const moods = { ...decided.moods };
  for (const id of moved) if (moods[id] === 'lonely' || moods[id] === 'sleepy') moods[id] = 'happy';
  return { life: { ...decided, groups, solo, lonely, moods }, result };
};

// ---------- 入れ物 ----------
const ASSISTANT_LIFE_PLAN_STORE = {
  state: { loaded: false, data: normalizeAssistantLifePlan(null, null), open: null },
  loading: null,
  listeners: new Set(),
  emit() { for (const fn of this.listeners) { try { fn(this.state); } catch (_) {} } },
  set(patch) { this.state = { ...this.state, ...patch }; this.emit(); },
  load() {
    if (this.state.loaded) return Promise.resolve(this.state);
    if (this.loading) return this.loading;
    this.loading = (async () => {
      let raw = null; try { raw = await storeGet(ASSISTANT_LIFE_PLAN_KEY, null, false); } catch (_) { raw = null; }
      const day = Math.floor(assistantLifeSlotAt().abs / 12);
      this.set({ loaded: true, data: normalizeAssistantLifePlan(raw, day) });
      return this.state;
    })();
    return this.loading;
  },
};
const assistantLifePlanToday = (now = Date.now()) => {
  const st = ASSISTANT_LIFE_PLAN_STORE.state;
  const day = Math.floor(assistantLifeSlotAt(now).abs / 12);
  return st.data && st.data.day === day ? st.data : normalizeAssistantLifePlan(null, day);
};
const assistantLifePlanSave = (data) => {
  ASSISTANT_LIFE_PLAN_STORE.set({ data });
  try { storeSet(ASSISTANT_LIFE_PLAN_KEY, data, false); } catch (_) {}
};
// 予定を決める・空ける(place が null ならおまかせに戻す)。いまの回と過ぎた回は変えられない
const assistantLifePlanSet = (abs, id, place, now = Date.now()) => {
  if (!assistantLifePlanOn() || !Number.isInteger(abs) || !assistantLifePlanOkId(id)) return false;
  const cur = assistantLifeSlotAt(now).abs;
  if (abs <= cur || Math.floor(abs / 12) !== Math.floor(cur / 12) || abs % 12 < ASSISTANT_LIFE_PLAN_FIRST_J) return false;
  if (place != null && !assistantLifePlanOkPlace(place)) return false;
  const d = assistantLifePlanToday(now);
  const row = { ...(d.plan[String(abs)] || {}) };
  if (place == null) delete row[id]; else row[id] = place;
  const plan = { ...d.plan }; if (Object.keys(row).length) plan[String(abs)] = row; else delete plan[String(abs)];
  assistantLifePlanSave({ ...d, plan });
  return true;
};
const assistantLifePlanClearWho = (id, now = Date.now()) => {
  if (!assistantLifePlanOn()) return false;
  const d = assistantLifePlanToday(now); const cur = assistantLifeSlotAt(now).abs; const plan = {};
  for (const [k, m] of Object.entries(d.plan)) { const row = { ...m }; if (Number(k) > cur) delete row[id]; if (Object.keys(row).length) plan[k] = row; }
  assistantLifePlanSave({ ...d, plan });
  return true;
};
// 今日の残りの回(次の回から 22〜24時まで)
const assistantLifePlanSlotsLeft = (now = Date.now()) => {
  const cur = assistantLifeSlotAt(now).abs; const day = Math.floor(cur / 12); const out = [];
  for (let j = Math.max(ASSISTANT_LIFE_PLAN_FIRST_J, (cur % 12) + 1); j < 12; j++) out.push(day * 12 + j);
  return out;
};
// assistantLifeNow から呼ぶ: 決めた様子に今の回の予定を当てはめ、結果を保存する。印が偽・予定なしなら decided のまま
const assistantLifePlanOnDecide = (decided, salt = '') => {
  try {
    if (!assistantLifePlanOn() || !ASSISTANT_LIFE_PLAN_STORE.state.loaded || !decided) return decided;
    const d = ASSISTANT_LIFE_PLAN_STORE.state.data;
    if (!d || d.day !== Math.floor(decided.abs / 12)) return decided;
    const want = d.plan[String(decided.abs)];
    if (!want || !Object.keys(want).length || (d.result[String(decided.abs)] && Object.keys(d.result[String(decided.abs)]).length)) return decided;
    const trust = {}; for (const id of Object.keys(want)) trust[id] = assistantLifePlanTrust(assistantLifePlanLvOf(id));
    const r = assistantLifePlanApply(decided, want, trust, salt);
    assistantLifePlanSave({ ...d, result: { ...d.result, [String(decided.abs)]: r.result } });
    return r.life;
  } catch (_) { return decided; }
};
// その回の結果(ok・no・null)
const assistantLifePlanResultOf = (abs, id) => { const d = ASSISTANT_LIFE_PLAN_STORE.state.data; const m = d && d.result[String(abs)]; return m && m[id] ? m[id] : null; };
const assistantLifePlanOf = (abs, id) => { const d = ASSISTANT_LIFE_PLAN_STORE.state.data; const m = d && d.plan[String(abs)]; return m && m[id] ? m[id] : null; };
// 窓を開く(入口3つから)。who … 1人の予定 / place … その場所に次の回で来てもらう助手を選ぶ / 何もなし … 表
const assistantLifePlanOpen = (opt = {}) => {
  if (!assistantLifePlanOn()) return false;
  void ASSISTANT_LIFE_PLAN_STORE.load().then(() => ASSISTANT_LIFE_PLAN_STORE.set({ open: { who: opt.who || null, place: opt.place || null } }));
  return true;
};
const assistantLifePlanClose = () => ASSISTANT_LIFE_PLAN_STORE.set({ open: null });
// 部屋の行・家の上の1行に出す数(印が偽なら null)
const assistantLifePlanRowInfo = (id) => {
  if (!assistantLifePlanOn()) return null;
  const left = assistantLifePlanSlotsLeft(); if (!left.length) return null;
  const next = left[0]; const p = assistantLifePlanOf(next, id);
  const h = assistantLifeSlotOfAbs(next).from;
  return { next, hour: h, sub: `${h}時から: ${p ? ASSISTANT_LIFE_PLACES[p] : 'おまかせ'}` };
};
const assistantLifePlanFreeCount = (ids) => {
  if (!assistantLifePlanOn()) return 0;
  const left = assistantLifePlanSlotsLeft(); let n = 0;
  for (const abs of left) if ((ids || []).some(id => !assistantLifePlanOf(abs, id))) n++;
  return n;
};

// ---------- 画面 ----------
const assistantLifePlanUse = () => {
  const [st, setSt] = React.useState(ASSISTANT_LIFE_PLAN_STORE.state);
  React.useEffect(() => { const fn = (s) => setSt(s); ASSISTANT_LIFE_PLAN_STORE.listeners.add(fn); void ASSISTANT_LIFE_PLAN_STORE.load(); return () => { ASSISTANT_LIFE_PLAN_STORE.listeners.delete(fn); }; }, []);
  return st;
};
const ASSISTANT_LIFE_PLAN_ICON = Object.freeze({ cafe: '🍰', plaza: '⛲', garden: '🌷', hill: '🌄', studio: '🎵', ranch: '🐾', cardroom: '🃏', library: '📚', battle: '⚔', home: '🏡' });
const assistantLifePlanPerk = (place) => {
  if (place === 'cardroom') return `対戦すると ごほうび${typeof CARD_LIFE_UP_LABEL !== 'undefined' ? CARD_LIFE_UP_LABEL : 'アップ'}`;
  if (place === 'battle') return 'マスモンが修行する';
  return '';
};
const assistantLifePlanName = (id) => { try { return typeof assistantLifeName === 'function' ? assistantLifeName(id) : id; } catch (_) { return id; } };

// 場所を選ぶ一覧(得のある場所が先頭・好きな場所に ♥)
function AssistantLifePlanPicker({ id, abs, onDone }) {
  const fav = ASSISTANT_LIFE_PREFS[id] && ASSISTANT_LIFE_PREFS[id].fav;
  const cur = assistantLifePlanOf(abs, id);
  const list = [...ASSISTANT_LIFE_PLAN_PLACES].sort((a, b) => (assistantLifePlanPerk(b) ? 1 : 0) - (assistantLifePlanPerk(a) ? 1 : 0));
  const h = assistantLifeSlotOfAbs(abs).from;
  return (
    <div className="mt-1 rounded-xl border border-sky-300/60 bg-slate-900/95 p-1.5" data-assistant-life-plan-picker={abs}>
      <p className="px-1 text-[11.5px] font-black text-sky-200">{assistantLifePlanName(id)}に {h}〜{(h + 2) % 24}時 に行ってもらう場所</p>
      <div className="mt-1 grid grid-cols-2 gap-1">
        {list.map(p => (
          <button key={p} type="button" data-assistant-life-plan-place={p} onClick={() => { assistantLifePlanSet(abs, id, p); onDone && onDone(); }}
            className={`min-h-[44px] rounded-xl px-1.5 text-left text-[12px] font-black leading-tight ${cur === p ? 'bg-sky-600 text-white' : 'bg-white/10 text-white'} active:scale-95`}>
            {ASSISTANT_LIFE_PLAN_ICON[p]} {ASSISTANT_LIFE_PLACES[p]}{p === fav ? ' ♥' : ''}
            {assistantLifePlanPerk(p) && <span className="block text-[10px] font-bold text-amber-200">得: {assistantLifePlanPerk(p)}</span>}
          </button>))}
        <button type="button" data-assistant-life-plan-place="auto" onClick={() => { assistantLifePlanSet(abs, id, null); onDone && onDone(); }} className="col-span-2 min-h-[44px] rounded-xl bg-white/5 text-[12px] font-black text-slate-200 active:scale-95">おまかせにもどす</button>
      </div>
    </div>);
}

// 1人の予定(縦)
function AssistantLifePlanWho({ id, cur }) {
  const [pick, setPick] = React.useState(null);
  const day = Math.floor(cur / 12);
  const rows = [];
  for (let j = ASSISTANT_LIFE_PLAN_FIRST_J; j < 12; j++) {
    const abs = day * 12 + j; const s = assistantLifeSlotOfAbs(abs); const p = assistantLifePlanOf(abs, id); const r = assistantLifePlanResultOf(abs, id);
    const past = abs < cur, now = abs === cur;
    let body;
    if (past || now) body = <span className="min-w-0 flex-1 text-[12.5px] font-bold">{p ? `📍 ${ASSISTANT_LIFE_PLACES[p]}` : <span className="text-slate-400">おまかせ</span>}{r === 'ok' && <span className="ml-1 rounded-full bg-emerald-800 px-1.5 text-[10px] text-emerald-100">✓ お願いどおり</span>}{r === 'no' && <span className="ml-1 rounded-full bg-violet-800 px-1.5 text-[10px] text-violet-100">🌀 気分で別の場所へ</span>}{now && <span className="block text-[10.5px] text-emerald-300">いまの時間</span>}</span>;
    else body = <span className="min-w-0 flex-1 text-[12.5px] font-bold">{p ? <>📍 {ASSISTANT_LIFE_PLAN_ICON[p]} {ASSISTANT_LIFE_PLACES[p]}{assistantLifePlanPerk(p) && <span className="block text-[10.5px] text-emerald-300">{assistantLifePlanPerk(p)}</span>}</> : <span className="text-slate-400">おまかせ<span className="block text-[10.5px]">{assistantLifePlanName(id)}が自分で決める</span></span>}</span>;
    rows.push(
      <div key={abs} data-assistant-life-plan-row={abs} className={`rounded-xl border px-1.5 py-1 ${now ? 'border-amber-300 bg-amber-900/50' : 'border-white/15 bg-white/5'} ${past ? 'opacity-50' : ''}`}>
        <div className="flex min-h-[40px] items-center gap-1.5">
          <span className="w-[62px] shrink-0 text-[11px] font-black leading-tight text-sky-200">{s.from}〜{(s.from + 2) % 24}時<span className="block text-[10px] text-slate-400">{s.label}</span></span>
          {body}
          {!past && !now && <button type="button" data-assistant-life-plan-edit={abs} onClick={() => setPick(pick === abs ? null : abs)} className={`min-h-[44px] shrink-0 rounded-xl px-2 text-[11.5px] font-black active:scale-95 ${p ? 'bg-white/15 text-slate-100' : 'bg-amber-400 text-slate-900'}`}>{p ? '変える' : '📍 決める'}</button>}
        </div>
        {pick === abs && <AssistantLifePlanPicker id={id} abs={abs} onDone={() => setPick(null)}/>}
      </div>);
  }
  return <div className="flex flex-col gap-1" data-assistant-life-plan-who={id}>{rows}</div>;
}

// 8人×4回の表(横)
function AssistantLifePlanTable({ ids, cur, onCell }) {
  const left = assistantLifePlanSlotsLeft();
  const [page, setPage] = React.useState(0);
  const cols = left.slice(page * 4, page * 4 + 4);
  if (!cols.length) return <p className="p-2 text-[12px] font-bold text-slate-300">今日の移動はもうありません。明日の朝からまた決められます。</p>;
  return (
    <div data-assistant-life-plan-table>
      <table className="w-full table-fixed border-separate" style={{ borderSpacing: 2 }}>
        <thead><tr><th className="w-[74px]"/>{cols.map(a => { const s = assistantLifeSlotOfAbs(a); return <th key={a} className="text-[10.5px] font-black text-sky-200">{s.from}〜{(s.from + 2) % 24}時 <span className="text-slate-400">{s.label}</span></th>; })}</tr></thead>
        <tbody>{ids.map(id => <tr key={id}>
          <td className="truncate text-[11.5px] font-black text-white">{assistantLifePlanName(id)}</td>
          {cols.map(a => { const p = assistantLifePlanOf(a, id); return <td key={a} className="p-0"><button type="button" data-assistant-life-plan-cell={`${id}@${a}`} onClick={() => onCell(id, a)} className={`h-[30px] w-full truncate rounded-lg border text-[11px] font-black ${p ? 'border-sky-300 bg-blue-900 text-white' : 'border-white/15 bg-white/5 text-slate-400'}`}>{p ? `📍${ASSISTANT_LIFE_PLACES[p]}` : 'おまかせ'}</button></td>; })}
        </tr>)}</tbody>
      </table>
      {left.length > 4 && <div className="mt-1 flex justify-end gap-1">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="min-h-[36px] rounded-xl bg-white/10 px-3 text-[12px] font-black text-white disabled:opacity-40">◀ 前の回</button>
        <button type="button" disabled={(page + 1) * 4 >= left.length} onClick={() => setPage(page + 1)} className="min-h-[36px] rounded-xl bg-white/10 px-3 text-[12px] font-black text-white disabled:opacity-40">次の回 ▶</button>
      </div>}
    </div>);
}

// 次の回に、その場所へ来てもらう助手を選ぶ(地図の場所の窓から)
function AssistantLifePlanPlace({ place, ids, cur }) {
  const next = assistantLifePlanSlotsLeft()[0];
  if (!Number.isInteger(next)) return <p className="p-2 text-[12px] font-bold text-slate-300">今日の移動はもうありません。</p>;
  const h = assistantLifeSlotOfAbs(next).from;
  return (
    <div data-assistant-life-plan-for-place={place}>
      <p className="px-1 text-[12px] font-black text-sky-200">{h}時からの回に、{ASSISTANT_LIFE_PLAN_ICON[place]} {ASSISTANT_LIFE_PLACES[place]}へ来てもらう助手</p>
      <div className="mt-1 flex flex-col gap-1">{ids.map(id => { const on = assistantLifePlanOf(next, id) === place; return (
        <button key={id} type="button" data-assistant-life-plan-ask={id} onClick={() => assistantLifePlanSet(next, id, on ? null : place)}
          className={`flex min-h-[44px] items-center justify-between rounded-xl px-2 text-[12.5px] font-black ${on ? 'bg-sky-600 text-white' : 'bg-white/10 text-white'} active:scale-95`}>
          <span>{assistantLifePlanName(id)}</span><span className="text-[11px]">{on ? '📍 お願いした(もう一度押すと取り消し)' : '📍 来てもらう'}</span>
        </button>); })}</div>
    </div>);
}

// 予定表の窓(助手ライフの画面の根元に1つ)
function AssistantLifePlanHost({ ids = [], land = false }) {
  const st = assistantLifePlanUse();
  const [who, setWho] = React.useState(null);
  const [cell, setCell] = React.useState(null);
  const open = st.open;
  React.useEffect(() => { if (open) { setWho(open.who || (land ? null : ids[0] || null)); setCell(null); } }, [open, land]);
  if (!assistantLifePlanOn() || !open) return null;
  const cur = assistantLifeSlotAt().abs;
  const list = (ids || []).filter(assistantLifePlanOkId);
  const lv = who ? assistantLifePlanLvOf(who) : null;
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/60 p-2" style={{ zIndex: 60 }} data-assistant-life-plan onClick={(e) => { if (e.target === e.currentTarget) assistantLifePlanClose(); }}>
      <div className="flex max-h-full w-full flex-col overflow-hidden rounded-2xl border-2 border-amber-300 bg-slate-950/95 p-2 text-white" style={{ maxWidth: land ? 820 : 460 }}>
        <div className="flex items-center gap-1.5">
          <p className="text-[15px] font-black text-amber-200">📅 今日の予定表</p>
          {land && <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-300">マスを押して、助手に行き先をお願いできます</p>}
          <button type="button" aria-label="閉じる" data-assistant-life-plan-close onClick={assistantLifePlanClose} className="ml-auto grid h-[40px] w-[44px] place-items-center rounded-xl bg-white/10 text-[17px] font-black text-amber-200">✕</button>
        </div>
        {!land && <p className="px-0.5 pb-1 text-[11.5px] font-bold leading-snug text-slate-300">次の移動で、助手に行き先をお願いできます。たいてい聞いてくれますが、気分で別の場所へ行くこともあります。</p>}
        <div className="min-h-0 overflow-y-auto">
          {open.place ? <AssistantLifePlanPlace place={open.place} ids={list} cur={cur}/>
            : land && !who ? (cell ? <AssistantLifePlanPicker id={cell.id} abs={cell.abs} onDone={() => setCell(null)}/> : <AssistantLifePlanTable ids={list} cur={cur} onCell={(id, abs) => setCell({ id, abs })}/>)
            : <>
              <div className="mb-1 flex gap-1 overflow-x-auto" data-assistant-life-plan-tabs>{list.map(id => (
                <button key={id} type="button" data-assistant-life-plan-tab={id} onClick={() => setWho(id)} className={`min-h-[44px] shrink-0 rounded-xl border-2 px-2 text-[11.5px] font-black ${who === id ? 'border-pink-300 bg-pink-900/70' : 'border-transparent bg-white/10'}`}>{assistantLifePlanName(id)}</button>))}</div>
              {who && <AssistantLifePlanWho id={who} cur={cur}/>}
              {who && <button type="button" data-assistant-life-plan-clear onClick={() => assistantLifePlanClearWho(who)} className="mt-1.5 min-h-[44px] w-full rounded-xl bg-white/10 text-[12px] font-black text-slate-100">{assistantLifePlanName(who)}を ぜんぶおまかせに</button>}
              {who && <p className="mt-1 text-[11px] font-bold text-pink-200">💗 仲良し度が高いほど、お願いを聞いてくれます(いま 約{Math.round(assistantLifePlanTrust(lv) * 100)}%)</p>}
            </>}
        </div>
      </div>
    </div>);
}

// 家・町の上の小さな1行(入口③)
function AssistantLifePlanBand({ ids = [], land = false }) {
  assistantLifePlanUse();
  if (!assistantLifePlanOn() || !assistantLifePlanSlotsLeft().length) return null;
  const n = assistantLifePlanFreeCount(ids);
  return (
    <button type="button" data-assistant-life-plan-band onClick={() => assistantLifePlanOpen({})}
      className={`mx-3 ${land ? 'mb-1' : 'mb-2'} flex min-h-[44px] items-center gap-1.5 rounded-2xl border border-dashed border-amber-300/80 bg-slate-950/85 px-2 text-left text-white`} style={{ width: 'calc(100% - 24px)' }}>
      <span className="text-[13px] font-black text-amber-200">📅 今日の予定表</span>
      <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-300">{n ? `あと${n}回の移動が「おまかせ」` : '今日の予定を組みました'}</span>
      <span className="shrink-0 rounded-xl bg-amber-400 px-2 py-1 text-[11.5px] font-black text-slate-900">開く</span>
    </button>);
}
