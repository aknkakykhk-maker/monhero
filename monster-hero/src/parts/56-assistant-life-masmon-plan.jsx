// 助手のマスモンの「育成ノート」(計画して育てる子・朝昼夜×7日の予定・疲れとストレスの管理・けが/病気/家出/サボり)。2026-11-12 キズナ
//   案 docs/progress/assistant-peer/masmon-plan/PLAN.md 第4版(社長の答え済み・台帳 2026-11-12 マスモン部)。止め絵 mock.png
//   保存は新しいキーだけ: mh_assistant_masmon_plan_v1(計画)・mh_assistant_masmon_cond_v1(けが・病気・家出)。育成のキー mh_assistant_masmon_grow_v1 の形・意味は変えない
//   公開の印 RELEASE_FLAGS.assistantMasmonPlan(と育成の印 assistantMasmonGrow)が真のときだけ動く。偽のあいだは育成の計算も画面も今と全く同じ
//   育成の計算(amgCatchUp)は typeof amgpActAt === 'function' のときだけ予定を読む(修行の amgtChoose と同じ形)
//   見る専用 <AssistantMasmonNote readOnly data ownerName onClose/>(オトズレのフレンドの家。data は alfMsNormalize の { ms, dk, wt })
//   病院(ナカヨシ): 口 assistantLifeHospitalSlotsOf(aid) → 病院にいた生活の回(abs)の配列を読む。各回1度だけ、けが・病気を残り1日短く+ストレス−10。家出は戻らない
const ASSISTANT_MASMON_PLAN_KEY = 'mh_assistant_masmon_plan_v1';
const ASSISTANT_MASMON_COND_KEY = 'mh_assistant_masmon_cond_v1';
const AMGP_STAGE_DAYS = Object.freeze([0, 5, 12, 20, 30]); // 2026-11-12 社長 7・21・42・70 → 5・12・20・30(寿命 約30日の案に合わせ、1世代のうちに5体)。段1〜5に届く「計画で育てた日」の延べ(社長 11-12)
const AMGP_MAX = AMGP_STAGE_DAYS.length;
// 数字は PLAN.md 第4版の表のまま(社長 11-12「案のまま」)
const AMGP_NUM = Object.freeze({
  sabFat: 60, sabStr: 50, sabMax: 0.35,
  hurtFat: 70, hurtPer: 0.015, hurtMax: 0.30, hurtN: 6,
  sickStr: 60, sickPer: 0.01, sickMax: 0.30, sickN: 9,
  awayStr: 80, awayBase: 0.03, awayPer: 0.005, awayN: 6,
  careSlots: 3, careStr: 10, findStr: 40, hospSlots: 3, hospStr: 10,
});
const AMGP_COND = Object.freeze({ hurt: { icon: '🤕', name: 'けが' }, sick: { icon: '🤒', name: '病気' }, away: { icon: '🏃', name: '家出' } });
// 育成できない回の休み扱い(疲れ・ストレスの増え方)。saboru = サボり(その回だけ)
const AMGP_IDLE = Object.freeze({ saboru: { fat: -5, str: -5 }, hurt: { fat: -30, str: -5 }, sick: { fat: -30, str: -10 }, away: { fat: -30, str: -5 } });
const AMGP_IDLE_NAME = Object.freeze({ saboru: 'サボった', hurt: 'けがで休み', sick: '病気で休み', away: '家出中' });
const AMGP_CODE_RE = /^(A|R|P|S|[LH]:(life|pow|wise|hit|eva|tough))$/;
const AMGP_DAY_NAME = Object.freeze(['月', '火', '水', '木', '金', '土', '日']);
const amgpOkCode = (c) => typeof c === 'string' && AMGP_CODE_RE.test(c);
const amgpKey = (aid, slot, monster) => `${aid}:${slot}:${monster}`;
const amgpKeyOk = (k) => typeof k === 'string' && /^[a-z]{2,12}:[1-8]:\w{2,40}$/.test(k);
const amgpSplitKey = (k) => { const [aid, slot, monster] = String(k).split(':'); return { aid, slot: Number(slot), monster }; };
// 週のマスの番号(月の朝=0 … 日の夜=20)。日の番号 0 は 1970-01-01(木)
const amgpWeekday = (day) => ((day % 7) + 7 + 3) % 7;
const amgpCellOf = (slot) => amgpWeekday(Math.floor(slot / 3)) * 3 + (slot % 3);
const amgpBlankWeek = () => Array.from({ length: 21 }, () => 'A');
const normalizeAssistantMasmonPlan = (raw) => {
  const out = { v: 1, picks: [], week: {}, once: {}, days: 0, dd: {}, done: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const p of (Array.isArray(raw.picks) ? raw.picks : []).slice(0, AMGP_MAX)) {
    if (!p || typeof p !== 'object' || !Number.isInteger(p.slot)) continue;
    const k = amgpKey(p.aid, p.slot, p.monster);
    if (amgpKeyOk(k) && !out.picks.some(q => amgpKey(q.aid, q.slot, q.monster) === k)) out.picks.push({ aid: p.aid, slot: p.slot, monster: p.monster, at: Number.isInteger(p.at) ? p.at : 0 });
  }
  if (raw.week && typeof raw.week === 'object') for (const [k, w] of Object.entries(raw.week).slice(-64)) if (amgpKeyOk(k) && Array.isArray(w) && w.length === 21) out.week[k] = w.map(c => (amgpOkCode(c) ? c : 'A'));
  if (raw.once && typeof raw.once === 'object') for (const [k, x] of Object.entries(raw.once).slice(-64)) if (amgpKeyOk(k) && x && Number.isInteger(x.s) && amgpOkCode(x.c)) out.once[k] = { s: x.s, c: x.c };
  out.days = amgNum(raw.days, 0, 0, 1e6);
  if (raw.dd && typeof raw.dd === 'object') for (const [k, d] of Object.entries(raw.dd).slice(-64)) if (amgpKeyOk(k) && Number.isInteger(d)) out.dd[k] = d;
  if (raw.done && typeof raw.done === 'object' && raw.done.pickMoved_v1 === true) out.done.pickMoved_v1 = true;
  return out;
};
const normalizeAssistantMasmonCond = (raw) => {
  const out = { v: 1, mons: {}, log: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const int = (v, d) => (Number.isInteger(v) ? v : d);
  if (raw.mons && typeof raw.mons === 'object') for (const [k, c] of Object.entries(raw.mons).slice(-64)) {
    if (!amgpKeyOk(k) || !c || typeof c !== 'object' || !AMGP_COND[c.k] || !Number.isInteger(c.from) || !Number.isInteger(c.until)) continue;
    out.mons[k] = { k: c.k, from: c.from, until: c.until, care: int(c.care, -1), find: int(c.find, -1), hosp: (Array.isArray(c.hosp) ? c.hosp : []).filter(Number.isInteger).slice(-30) };
  }
  out.log = (Array.isArray(raw.log) ? raw.log : []).filter(x => x && Number.isInteger(x.s) && amgpKeyOk(x.key) && AMGP_COND[x.k] && ['start', 'care', 'hosp', 'cure', 'find'].includes(x.t)).slice(-40).map(x => ({ s: x.s, key: x.key, k: x.k, t: x.t }));
  return out;
};
// 保存の入れ物(読み込む前は書かない・まとめて1回書く)
const amgpMakeStore = (key, norm) => ({ key, norm, state: norm(null), loaded: false, subs: new Set(), dirty: false,
  set(next) { this.state = next; this.subs.forEach(f => { try { f(next); } catch (_) {} }); },
  load() {
    if (this.loaded) return Promise.resolve(this.state);
    this._p = this._p || (async () => {
      let raw = null; try { raw = typeof storeGet === 'function' ? await storeGet(this.key, null, false) : null; } catch (_) {}
      this.loaded = true; this.set(this.norm(raw)); return this.state;
    })();
    return this._p;
  },
  save(next) {
    if (!this.loaded) return false;
    this.set(next);
    if (!this.dirty) { this.dirty = true; Promise.resolve().then(() => { this.dirty = false; try { if (typeof storeSet === 'function') storeSet(this.key, this.state, false); } catch (_) {} }); }
    return true;
  } });
const AMGP_STORE = amgpMakeStore(ASSISTANT_MASMON_PLAN_KEY, normalizeAssistantMasmonPlan);
const AMGP_CSTORE = amgpMakeStore(ASSISTANT_MASMON_COND_KEY, normalizeAssistantMasmonCond);
const amgpOn = () => typeof RELEASE_FLAGS !== 'undefined' && !!RELEASE_FLAGS && RELEASE_FLAGS.assistantMasmonPlan === true && typeof amgOn === 'function' && amgOn();
const amgpLoad = () => Promise.all([AMGP_STORE.load(), AMGP_CSTORE.load()]);
try { setTimeout(() => { try { if (amgpOn()) void amgpLoad(); } catch (_) {} }, 0); } catch (_) {}
// 段(1〜5)・計画できる数・次の段までの日数
const amgpStageOf = (days) => { const d = Number.isFinite(days) ? days : 0; const lv = AMGP_STAGE_DAYS.filter(x => d >= x).length; return { lv, cap: lv, next: lv < AMGP_MAX ? AMGP_STAGE_DAYS[lv] : null }; };
const amgpPickIndex = (aid, row, st = AMGP_STORE.state) => (row ? st.picks.findIndex(p => p.aid === aid && p.slot === row.slot && p.monster === row.monster) : -1);
const amgpCodeAt = (key, slot, st = AMGP_STORE.state) => (st.once[key] && st.once[key].s === slot ? st.once[key].c : ((st.week[key] || [])[amgpCellOf(slot)] || 'A'));
const amgpCondAt = (key, slot, cs = AMGP_CSTORE.state) => { const c = cs.mons[key]; return c && c.from < slot && slot <= c.until ? c : null; };
// 回の始めの値でサボるか(疲れ60以上 または ストレス50以上)
const amgpSabChance = (fat, str) => (fat >= AMGP_NUM.sabFat || str >= AMGP_NUM.sabStr ? Math.min(AMGP_NUM.sabMax, Math.max(0, fat - AMGP_NUM.sabFat) / 100 + Math.max(0, str - AMGP_NUM.sabStr) / 100) : 0);
const amgpHurtChance = (a, fat) => ((a === 'heavy' || a === 'shugyo') && fat >= AMGP_NUM.hurtFat ? Math.min(AMGP_NUM.hurtMax, (fat - AMGP_NUM.hurtFat) * AMGP_NUM.hurtPer) : 0);
const amgpSickChance = (a, str) => (a !== 'rest' && str >= AMGP_NUM.sickStr ? Math.min(AMGP_NUM.sickMax, (str - AMGP_NUM.sickStr) * AMGP_NUM.sickPer) : 0);
const amgpAwayChance = (str) => (str >= AMGP_NUM.awayStr ? AMGP_NUM.awayBase + (str - AMGP_NUM.awayStr) * AMGP_NUM.awayPer : 0);
const amgpPolicyKey = (row, e) => { const pol = AMG_POLICY[typeof assistantMasmonGrowKind === 'function' ? assistantMasmonGrowKind(row && row.grow) : String((row && row.grow) || '').split('(')[0]] || []; return pol[0] || AMG_KEYS.reduce((a, b) => (e && e.st[b] < e.st[a] ? b : a), AMG_KEYS[0]); };
// 修行のマス: 助手がその日モンヒロバトルにいて、その子の今日の修行がまだなら修行。そうでなければ方針の能力の軽い訓練
const amgpShugyoAct = (aid, row, e, slot, seed) => {
  try {
    if (typeof amgtOn !== 'function' || !amgtOn() || typeof AMGT_STORE === 'undefined' || !AMGT_STORE.loaded || typeof amgtWasAtPlace !== 'function' || !amgtWasAtPlace(aid, slot)) return null;
    const me = (AMGT_STORE.state.mons[aid] || {})[`${row.slot}:${row.monster}`] || amgtInitMon(row.monster, e.lv, e.st);
    if (me.day && me.day.d === amgSlotDay(slot) && me.day.n >= AMGT_NUM.perDay) return null;
    return { a: 'shugyo', k: amgtPickKind(aid, me, amgtTechsOf(row.monster), e.st, amgtRngOf(`${seed}|${aid}|plan-shugyo|${row.slot}:${row.monster}|${slot}`), '') };
  } catch (_) { return null; }
};
const amgpActOfCode = (aid, row, e, slot, code, seed) => {
  if (code === 'R') return { a: 'rest' };
  if (code === 'P') return { a: 'play' };
  if (code === 'S') return amgpShugyoAct(aid, row, e, slot, seed) || { a: 'light', k: amgpPolicyKey(row, e) };
  const [t, k] = code.split(':');
  return { a: t === 'H' ? 'heavy' : 'light', k };
};
// 病院(ナカヨシの口)。その子のけが・病気のあいだに病院にいた回を、1回ずつ効かせる。e はその回の育成の写し(ストレスを下げる)
const amgpAbsToSlot = (abs) => { try { const s = typeof amgtLifeSlotsToGrow === 'function' ? amgtLifeSlotsToGrow(abs) : []; return Number.isInteger(s[0]) ? s[0] : null; } catch (_) { return null; } };
const amgpHospital = (aid, key, slot, e) => {
  if (!(typeof assistantLifeHospitalSlotsOf === 'function')) return false;
  const cs = AMGP_CSTORE.state; const c0 = cs.mons[key];
  if (!c0 || c0.k === 'away' || c0.until < slot) return false;
  let abs = []; try { abs = assistantLifeHospitalSlotsOf(aid); } catch (_) { abs = []; }
  if (!Array.isArray(abs)) return false;
  // 特別な治療(ビートPの品物・ナカヨシの口)を使った回は、その回でけが・病気の残りを0にする(2026-11-12 ナカヨシと合意)
  let cures = []; try { cures = typeof assistantLifeHospitalCureSlotsOf === 'function' ? assistantLifeHospitalCureSlotsOf(aid) : []; } catch (_) { cures = []; }
  const cureSet = new Set(Array.isArray(cures) ? cures.filter(Number.isInteger) : []);
  abs = [...abs, ...cureSet].filter((a, i, l) => l.indexOf(a) === i);
  let c = c0; const log = [];
  for (const a of abs) {
    if (!Number.isInteger(a) || c.hosp.includes(a)) continue;
    const gs = amgpAbsToSlot(a);
    if (gs === null || gs < c.from || gs > slot || gs > c.until) continue;
    const cure = cureSet.has(a);
    c = { ...c, until: cure ? Math.max(c.from, gs - 1) : Math.max(gs, c.until - AMGP_NUM.hospSlots), hosp: [...c.hosp, a].slice(-30) };
    if (e) e.str = amgClamp(e.str - AMGP_NUM.hospStr, 0, 100);
    log.push({ s: gs, key, k: c.k, t: cure ? 'cure' : 'hosp' });
  }
  if (c === c0) return false;
  AMGP_CSTORE.save({ ...cs, mons: { ...cs.mons, [key]: c }, log: [...cs.log, ...log].slice(-40) });
  return true;
};
// 育成の計算(amgCatchUp)から呼ぶ。計画の回なら { act, plan:true, key, code }、けが・病気・家出の回なら { act, idle:true }、ほかは null(今までどおり)
const amgpActAt = (aid, row, slot, e, seed) => {
  if (!amgpOn() || !AMGP_STORE.loaded || !AMGP_CSTORE.loaded || !row || !e) return null;
  const key = amgpKey(aid, row.slot, row.monster);
  amgpHospital(aid, key, slot, e);
  const c = amgpCondAt(key, slot);
  if (c) return { act: { a: c.k }, idle: true, key };
  if (amgpPickIndex(aid, row) < 0) return null;
  const code = amgpCodeAt(key, slot);
  if (code === 'A') return null;
  if (/^[LHS]/.test(code)) {
    const p = amgpSabChance(e.fat, e.str) * (typeof amgbSabMult === 'function' ? amgbSabMult(aid, row) : 1); // 絆: 忠誠が低い・甘い方針ほどサボる(印が偽なら ×1)
    if (p > 0 && typeof assistantMasmonRng === 'function' && assistantMasmonRng(`${seed}|${aid}|plan-sab|${key}|${slot}`)() < p) return { act: { a: 'saboru' }, plan: true, key, code };
  }
  return { act: { ...amgpActOfCode(aid, row, e, slot, code, seed), picked: true }, plan: true, key, code };
};
// 育成の1回が終わったあと(e はその回の終わりの値)。日数の延べ・けが/病気/家出が起きるか
const amgpAfterAct = (aid, row, slot, e, pp, seed) => {
  if (!pp || !pp.plan || !amgpOn() || !e) return;
  const st = AMGP_STORE.state; const day = amgSlotDay(slot);
  let next = st;
  if (st.dd[pp.key] !== day) next = { ...next, days: next.days + 1, dd: { ...next.dd, [pp.key]: day } };
  if (next.once[pp.key] && next.once[pp.key].s <= slot) { const once = { ...next.once }; delete once[pp.key]; next = { ...next, once }; }
  if (next !== st) AMGP_STORE.save(next);
  const a = pp.act.a;
  if (a === 'saboru' || typeof assistantMasmonRng !== 'function') return;
  const rnd = assistantMasmonRng(`${seed}|${aid}|plan-ev|${pp.key}|${slot}`);
  let k = '';
  if (rnd() < amgpAwayChance(e.str)) k = 'away';
  else if (rnd() < amgpHurtChance(a, e.fat)) k = 'hurt';
  else if (rnd() < amgpSickChance(a, e.str)) k = 'sick';
  if (!k) return;
  const len = typeof amgbCondLen === 'function' ? amgbCondLen(k === 'hurt' ? e.fat : e.str, rnd()) : null; // 絆: 軽い1回・ふつう3回・重い6回(印が偽なら今の長さ)
  const cs = AMGP_CSTORE.state;
  AMGP_CSTORE.save({ ...cs, mons: { ...cs.mons, [pp.key]: { k, from: slot, until: slot + (Number.isInteger(len) ? len : AMGP_NUM[`${k}N`]), care: -1, find: -1, hosp: [] } }, log: [...cs.log, { s: slot, key: pp.key, k, t: 'start' }].slice(-40) });
};
// 育成の値のストレスを下げる(看病・さがしに行く)
const amgpLowerStr = (key, n) => {
  if (typeof AMG_STORE === 'undefined' || !AMG_STORE.loaded) return false;
  const { aid, slot, monster } = amgpSplitKey(key); const st = AMG_STORE.state; const mk = amgMonKey(slot, monster);
  const e = st.mons[aid] && st.mons[aid][mk]; if (!e) return false;
  return amgSave({ ...st, mons: { ...st.mons, [aid]: { ...st.mons[aid], [mk]: { ...e, str: amgClamp(e.str - n, 0, 100) } } } }) !== false;
};
// 🩹 看病(けが・病気・1日1回): 残り1日短く+ストレス−10
const amgpCare = (key, now = Date.now()) => {
  if (!amgpOn() || !AMGP_CSTORE.loaded) return false;
  const s = amgSlotOf(now); const day = amgSlotDay(s); const cs = AMGP_CSTORE.state; const c = cs.mons[key];
  if (!c || c.k === 'away' || c.until < s || c.care === day) return false;
  AMGP_CSTORE.save({ ...cs, mons: { ...cs.mons, [key]: { ...c, until: Math.max(s, c.until - AMGP_NUM.careSlots), care: day } }, log: [...cs.log, { s, key, k: c.k, t: 'care' }].slice(-40) });
  amgpLowerStr(key, AMGP_NUM.careStr);
  return true;
};
// 🔎 さがしに行ってもらう(家出・1日1回): その日のうちに戻る。ストレス−40
const amgpFind = (key, now = Date.now()) => {
  if (!amgpOn() || !AMGP_CSTORE.loaded) return false;
  const s = amgSlotOf(now); const day = amgSlotDay(s); const cs = AMGP_CSTORE.state; const c = cs.mons[key];
  if (!c || c.k !== 'away' || c.until < s || c.find === day) return false;
  AMGP_CSTORE.save({ ...cs, mons: { ...cs.mons, [key]: { ...c, until: s, find: day } }, log: [...cs.log, { s, key, k: c.k, t: 'find' }].slice(-40) });
  amgpLowerStr(key, AMGP_NUM.findStr);
  return true;
};
// 計画の子を入れる・外す(外しても予定は消さない)
const amgpSetPick = (aid, row, on, now = Date.now()) => {
  if (!amgpOn() || !AMGP_STORE.loaded || !row) return false;
  const st = AMGP_STORE.state; const i = amgpPickIndex(aid, row, st); const key = amgpKey(aid, row.slot, row.monster);
  if (!on) { if (i < 0) return false; return AMGP_STORE.save({ ...st, picks: st.picks.filter((_, j) => j !== i) }); }
  if (i >= 0 || st.picks.length >= amgpStageOf(st.days).cap || !amgpKeyOk(key)) return false;
  return AMGP_STORE.save({ ...st, picks: [...st.picks, { aid, slot: row.slot, monster: row.monster, at: amgSlotOf(now) }], week: st.week[key] ? st.week : { ...st.week, [key]: amgpBlankWeek() } });
};
const amgpSetCells = (key, cells) => { // cells = { [マスの番号]: code }
  if (!AMGP_STORE.loaded || !amgpKeyOk(key)) return false;
  const st = AMGP_STORE.state; const w = [...(st.week[key] || amgpBlankWeek())];
  for (const [i, c] of Object.entries(cells)) { const n = Number(i); if (Number.isInteger(n) && n >= 0 && n < 21 && amgpOkCode(c)) w[n] = c; }
  return AMGP_STORE.save({ ...st, week: { ...st.week, [key]: w } });
};
// かんたん設定: 選んだ曜日(0=月)の朝昼夜を、ほかの曜日へ写す。to = 'all' | 'weekday' | 'holiday'
const amgpCopyDay = (key, from, to) => {
  const w = AMGP_STORE.state.week[key] || amgpBlankWeek(); const days = to === 'weekday' ? [0, 1, 2, 3, 4] : to === 'holiday' ? [5, 6] : [0, 1, 2, 3, 4, 5, 6];
  const cells = {}; for (const d of days) for (let p = 0; p < 3; p++) cells[d * 3 + p] = w[from * 3 + p];
  return amgpSetCells(key, cells);
};
// 次の回だけ変える(今の「訓練を指定」の代わり)。code が 'clear' なら戻す
const amgpSetOnce = (key, code, now = Date.now()) => {
  if (!AMGP_STORE.loaded || !amgpKeyOk(key)) return false;
  const st = AMGP_STORE.state; const once = { ...st.once };
  if (code === 'clear') delete once[key]; else if (amgpOkCode(code)) once[key] = { s: amgSlotOf(now) + 1, c: code }; else return false;
  return AMGP_STORE.save({ ...st, once });
};
// 今の「訓練を指定」(育成のキーの plan)を、育成ノートを初めて開いたときに1度だけ写す。指定そのものは消さない・書き換えない(印 done.pickMoved_v1)
const amgpMigrate = (now = Date.now()) => {
  if (!amgpOn() || !AMGP_STORE.loaded || AMGP_STORE.state.done.pickMoved_v1 || typeof AMG_STORE === 'undefined' || !AMG_STORE.loaded || typeof ASSISTANT_MASMON_STORE === 'undefined' || !ASSISTANT_MASMON_STORE.loaded) return false;
  let st = AMGP_STORE.state; const nowSlot = amgSlotOf(now); const g = AMG_STORE.state;
  for (const [aid, p] of Object.entries(g.plan || {})) for (const [sl, x] of Object.entries(p || {})) {
    if (!x || !Number.isInteger(x.s) || x.s <= nowSlot) continue;
    const row = (typeof assistantMasmonRowsOf === 'function' ? assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, aid) : []).find(r => r.slot === Number(sl));
    if (!row) continue;
    const key = amgpKey(aid, row.slot, row.monster);
    const code = x.a === 'rest' ? 'R' : x.a === 'play' ? 'P' : (x.a === 'light' || x.a === 'heavy') && AMG_KEYS.includes(x.k) ? `${x.a === 'heavy' ? 'H' : 'L'}:${x.k}` : '';
    if (!code || !amgpKeyOk(key)) continue;
    if (!st.picks.some(q => amgpKey(q.aid, q.slot, q.monster) === key)) {
      if (st.picks.length >= amgpStageOf(st.days).cap) continue;
      st = { ...st, picks: [...st.picks, { aid, slot: row.slot, monster: row.monster, at: nowSlot }], week: st.week[key] ? st.week : { ...st.week, [key]: amgpBlankWeek() } };
    }
    st = { ...st, once: { ...st.once, [key]: { s: x.s, c: code } } };
  }
  return AMGP_STORE.save({ ...st, done: { ...st.done, pickMoved_v1: true } });
};
// ---------- 見通し(画面用。乱数を使わず、幅で出す) ----------
const AMGP_FS = Object.freeze({ L: [5, 1], H: [14, 4], S: [12, 2], R: [-30, -5], P: [-10, -15] });
const amgpGainOf = (row, e, code, fat, mult = AMG_CARE.pickMult) => {
  const apt = amgAptOf(row.monster); const g = {};
  const add = (k, lo, hi) => { const m = AMG_APT_MULT[apt[k]] * (1 + 0.1 * ((e.ind && e.ind[k]) || 0)) * (fat >= 50 ? 0.7 : 1) * mult; const a = Math.max(1, Math.round(lo * m)), b = Math.max(1, Math.round(hi * m)); g[k] = [(g[k] ? g[k][0] : 0) + a, (g[k] ? g[k][1] : 0) + b]; };
  if (code === 'S') add(amgpPolicyKey(row, e), 2, 4);
  else if (/^L:/.test(code)) add(code.slice(2), 3, 6);
  else if (/^H:/.test(code)) { add(code.slice(2), 7, 12); add(AMG_SUB[code.slice(2)], 1, 3); }
  return g;
};
// 1日(3回)の見通し。codes は朝昼夜の3つ(null = もう過ぎた回で数えない)。まかせる(A)は助手の決め方に近い形で見込む
//   opt.key・opt.slots があれば、けが・病気・家出の回は訓練しない(休み扱い・灰色)。opt.used = その日にもう伸びた分(1日の上限20から引く)
const amgpForecastDay = (aid, row, e, codes, fat0, str0, opt = {}) => {
  const T = AMG_TRAIT[aid] || AMG_TRAIT.atsu; let fat = fat0, str = str0; const pace = typeof amgbPace === 'function' ? amgbPace() : 1; const bm = typeof amgbGainMult === 'function' ? amgbGainMult(aid, row, null) : 1; let leftHi = Math.max(0, AMG_CARE.viewCap * pace - (opt.used || 0)); let leftLo = leftHi; const out = [];
  for (let p = 0; p < codes.length; p++) {
    const c0 = codes[p];
    if (!c0) { out.push(null); continue; }
    const cond = opt.key && opt.slots ? amgpCondAt(opt.key, opt.slots[p]) : null;
    if (cond) { fat = amgClamp(fat - 30, 0, 100); str = amgClamp(str - 5, 0, 100); out.push({ code: c0, as: 'X', cond: cond.k, auto: false, fat, str, sab: 0, hurt: 0, sick: 0, away: 0, g: {} }); continue; }
    let code = c0; let auto = false;
    if (code === 'A') { auto = true; code = fat >= T.rest ? 'R' : str >= 50 ? 'P' : `L:${amgpPolicyKey(row, e)}`; }
    const sab = !auto && /^[LHS]/.test(code) ? amgpSabChance(fat, str) : 0;
    const g0 = bm > 0 ? amgpGainOf(row, e, code, fat, (auto ? 1 : AMG_CARE.pickMult) * bm) : {}; const g = {}; // 絆: 育ちの速さ・型と年齢・方針(印が偽なら ×1)
    for (const [k, [a, b]] of Object.entries(g0)) { const bb = Math.min(b, leftHi); if (bb > 0) { const aa = Math.min(a, bb, leftLo); g[k] = [aa, bb]; leftHi -= bb; leftLo -= aa; } }
    const capped = Object.entries(g0).some(([k, [, b]]) => !g[k] || g[k][1] < b); // 1日の上限で伸びが削られた回(画面で「上限で止まる」と出す)
    const [df, ds] = AMGP_FS[code[0]] || [0, 0];
    fat = amgClamp(fat + df, 0, 100); str = amgClamp(str + ds, 0, 100);
    const a = code[0] === 'H' ? 'heavy' : code[0] === 'S' ? 'shugyo' : code[0] === 'R' ? 'rest' : code[0] === 'P' ? 'play' : 'light';
    out.push({ code: c0, as: code, auto, capped, fat, str, sab, hurt: auto ? 0 : amgpHurtChance(a, fat), sick: auto ? 0 : amgpSickChance(a, str), away: auto ? 0 : amgpAwayChance(str), g });
  }
  return out;
};
// 今日の朝から7日の見通し(日ごと)。今の疲れ・ストレスから続けて計算する
const amgpForecastWeek = (aid, row, e, key, now = Date.now()) => {
  const st = AMGP_STORE.state; const s0 = amgSlotOf(now); const day0 = amgSlotDay(s0);
  let fat = e.fat, str = e.str; const days = []; const total = {};
  for (let i = 0; i < 7; i++) {
    const day = day0 + i; const codes = [0, 1, 2].map(p => amgpCodeAt(key, day * 3 + p, st));
    const startFat = fat, startStr = str;
    // 今日の、もう過ぎた回は数えない
    const live = codes.map((c, p) => (i === 0 && day * 3 + p <= s0 ? null : c));
    const f = amgpForecastDay(aid, row, e, live, fat, str, { key, slots: [0, 1, 2].map(p => day * 3 + p), used: i === 0 && e.dg && e.dg.d === day ? e.dg.n : 0 });
    for (const x of f) if (x) { fat = x.fat; str = x.str; for (const [k, [a, b]] of Object.entries(x.g)) total[k] = [(total[k] ? total[k][0] : 0) + a, (total[k] ? total[k][1] : 0) + b]; }
    days.push({ day, wd: amgpWeekday(day), codes, f, startFat, startStr, fat, str });
  }
  return { days, total };
};
const amgpCodeName = (c) => { if (c === 'A') return 'まかせる'; if (c === 'R') return '休み'; if (c === 'P') return '遊び'; if (c === 'S') return '修行'; const [t, k] = String(c).split(':'); return t === 'H' ? AMG_HEAVY[k] : AMG_LIGHT[k]; };
const amgpCodeIcon = (c) => ({ A: '🍃', R: '😴', P: '🎈', S: '⚔' }[c] || (String(c)[0] === 'H' ? '🏋' : '💪'));
const amgpStatName = (k) => (AMG_STATS.find(x => x[0] === k) || [])[1] || '';
// 育成の記録の名前(サボり・けがなど)。amgActName から引く
const amgpActName = (x) => (x && AMGP_IDLE_NAME[x.a]) || '';

// ---------- 画面(公開の印が真のときだけ出す) ----------
const AMGP_HOST = { open: null, subs: new Set(), set(v) { this.open = v; this.subs.forEach(f => { try { f(v); } catch (_) {} }); } };
// 育成ノートを開く(aid を渡すと、その助手の子で絞った形)
const assistantMasmonNoteOpen = (aid = null) => { if (!amgpOn()) return false; AMGP_HOST.set({ aid: typeof aid === 'string' ? aid : null, at: Date.now() }); return true; };
function AssistantMasmonNoteHost({ land = false }) {
  const [open, setOpen] = React.useState(AMGP_HOST.open);
  React.useEffect(() => { const f = (v) => setOpen(v); AMGP_HOST.subs.add(f); return () => { AMGP_HOST.subs.delete(f); }; }, []);
  if (!open || !amgpOn()) return null;
  return <AssistantMasmonNote key={open.at} aid={open.aid} land={land} onClose={() => AMGP_HOST.set(null)}/>;
}
// 家の上に出す札(家の「いま行くと得なこと」の並びの近く)
function AssistantMasmonNoteBand({ land = false }) {
  const [st, setSt] = React.useState(AMGP_STORE.state);
  const [, setCs] = React.useState(0); // けが・病気が起きたら札の数をすぐ変える(fable の指摘 11-12)
  React.useEffect(() => { const f = () => setCs(n => n + 1); AMGP_STORE.subs.add(setSt); AMGP_CSTORE.subs.add(f); if (amgpOn()) void amgpLoad(); return () => { AMGP_STORE.subs.delete(setSt); AMGP_CSTORE.subs.delete(f); }; }, []);
  if (!amgpOn()) return null;
  const sg = amgpStageOf(st.days); const hurt = Object.values(AMGP_CSTORE.state.mons).filter(c => c.until >= amgSlotOf()).length;
  return (
    <button type="button" onClick={() => assistantMasmonNoteOpen()} data-amgp-band className={`mx-3 ${land ? 'mb-1' : 'mb-2'} flex min-h-[44px] w-[calc(100%-24px)] items-center gap-2 rounded-2xl border border-emerald-300/60 bg-slate-950/85 px-3 py-1.5 text-left text-white active:scale-[.98]`}>
      <span className="text-[20px]" aria-hidden="true">📒</span>
      <span className="min-w-0 flex-1"><b className="block text-[13px] font-black text-emerald-200">育成ノート</b>
        <span className="block text-[11px] font-bold text-slate-200">計画中 {st.picks.length}/{sg.cap}体{hurt ? ` ・ 休んでいるマスモン ${hurt}体` : ''}</span></span>
      <span className="text-[11px] font-black text-emerald-200" aria-hidden="true">▶</span>
    </button>);
}
// 部屋の「🐾 マスモン」の下に出す近道(その助手の子で絞った形)
function AssistantMasmonNoteRoomLink({ id }) {
  if (!amgpOn()) return null;
  return <button type="button" className="mhl-row w-full text-left" data-amgp-room-link onClick={() => assistantMasmonNoteOpen(id)}><span className="k">📒 育成ノート</span><span className="min-w-0 text-[11px] font-bold">予定を組む・疲れとストレスを見る</span><span className="ml-auto pl-1 text-[12px] font-black text-pink-300">›</span></button>;
}
const amgpUseStores = () => {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const f = () => setTick(n => n + 1);
    const ss = [AMGP_STORE, AMGP_CSTORE, ...(typeof AMG_STORE !== 'undefined' ? [AMG_STORE] : []), ...(typeof ASSISTANT_MASMON_STORE !== 'undefined' ? [ASSISTANT_MASMON_STORE] : []), ...(typeof AMGS_STORE !== 'undefined' && AMGS_STORE ? [AMGS_STORE] : [])];
    ss.forEach(s => s.subs.add(f));
    return () => { ss.forEach(s => s.subs.delete(f)); };
  }, []);
};
const amgpMonIcon = (monster) => { const m = typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS[monster] : null; return m && m.iconUrl ? <img src={m.iconUrl} alt="" className="h-9 w-9 shrink-0 object-contain"/> : <span className="w-9 shrink-0 text-center text-[22px]">🐾</span>; };
const amgpWhoName = (aid) => (typeof assistantLifeName === 'function' ? assistantLifeName(aid) : aid);
const amgpPct = (p) => `${Math.round(p * 100)}%`;
const AMGP_TABS = Object.freeze([['list', '一覧'], ['plan', '計画'], ['log', '記録'], ['train', '修行'], ['ticket', 'チケット']]);
const AMGP_RO_TABS = Object.freeze([['list', '一覧'], ['deck', 'デッキ']]);
const AMGP_OPTIONS = Object.freeze(['A', ...AMG_KEYS.map(k => `L:${k}`), ...AMG_KEYS.map(k => `H:${k}`), 'S', 'R', 'P']);
const amgpOptionLabel = (c) => (c === 'A' ? '🍃 助手にまかせる' : c === 'R' ? '😴 休み' : c === 'P' ? '🎈 遊び' : c === 'S' ? '⚔ 修行(いなければ軽い訓練)' : `${c[0] === 'H' ? '🏋 重' : '💪 軽'} ${amgpCodeName(c)}(${amgpStatName(c.slice(2))})`);
function AmgpShell({ title, sub, tabs, tab, setTab, onClose, land, children, ro = false }) {
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60" data-amgp-note={ro ? 'readonly' : 'mine'}>
      <div className="flex w-full max-w-md flex-col rounded-t-3xl border-t-2 border-emerald-300/70 bg-slate-900 text-white" style={{ height: land ? '96dvh' : '92dvh' }}>
        {/* 横向きは頭と切り替えを1行にまとめ、予定の見える高さを広げる(fable の指摘 11-12・568×320 で約190px だった) */}
        <div className={`flex items-center gap-2 px-3 ${land ? 'pt-1.5' : 'pt-3'}`}>
          <button type="button" onClick={onClose} data-mhl-sheet-close className={`${land ? 'min-h-[40px]' : 'min-h-[44px]'} shrink-0 rounded-xl bg-slate-700 px-3 text-[12px] font-black`}>閉じる</button>
          <div className="min-w-0 flex-1"><p className={`truncate font-black ${land ? 'text-[14px]' : 'text-[16px]'}`}>📒 {title}</p>{!land && <p className="truncate text-[10.5px] font-bold text-slate-300">{sub}</p>}</div>
          {land && <div className="flex shrink-0 gap-1" role="tablist">{tabs.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} data-amgp-tab={k} onClick={() => setTab(k)} className={`min-h-[40px] rounded-xl px-2.5 text-[12px] font-black ${tab === k ? 'bg-emerald-400 text-emerald-950' : 'bg-slate-800 text-slate-200'}`}>{label}</button>)}</div>}
        </div>
        {!land && <div className="mt-2 flex gap-1 px-3" role="tablist">
          {tabs.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} data-amgp-tab={k} onClick={() => setTab(k)} className={`min-h-[40px] flex-1 rounded-xl text-[12px] font-black ${tab === k ? 'bg-emerald-400 text-emerald-950' : 'bg-slate-800 text-slate-200'}`}>{label}</button>)}
        </div>}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-2">{children}</div>
      </div>
    </div>);
}
function AmgpBars({ st, add = null }) {
  return (
    <div className="grid gap-y-1" data-amgp-stats>
      {AMG_STATS.map(([k, label]) => { const v = Number(st && st[k]) || 0; const g = add && add[k]; return (
        <div key={k} className="flex items-center gap-1.5 text-[11px] font-bold">
          <span className="w-[48px] shrink-0">{label}</span>
          <span className="relative h-2 flex-1 overflow-hidden rounded bg-slate-700"><i className="absolute inset-y-0 left-0 bg-emerald-400" style={{ width: `${Math.min(100, v / AMG_MAX * 100)}%` }}/>
            {g && <i className="absolute inset-y-0 bg-amber-300" style={{ left: `${Math.min(100, v / AMG_MAX * 100)}%`, width: `${Math.min(100, g[1] / AMG_MAX * 100)}%` }}/>}</span>
          <b className="w-[30px] shrink-0 text-right text-amber-200">{v}</b>
          {add && <span className="w-[54px] shrink-0 text-right text-[10px] text-amber-300" data-amgp-gain={k}>{g ? `+${g[0]}〜${g[1]}` : ''}</span>}
        </div>); })}
    </div>);
}
// ---- 計画タブの「1日」の画面(社長 2026-11-13「育成ノートがわかりにくい」「疲れとストレスも一緒にゲージにして」) ----
//   上: この日の予定(朝・昼・夜の3枚の札。押すと選ぶ一覧)→ 下: 6能力の見通し・疲れとストレスのゲージ(危ない線つき)→ ほかの曜日へ写す
//   長い説明は「？」で開く。保存の形・計算は変えない(見せ方だけ)
const AMGP_FS_LINES = Object.freeze({ fat: Object.freeze([[60, '#fbbf24', 'サボりやすい'], [70, '#fb7185', 'けが']]), str: Object.freeze([[50, '#fbbf24', 'サボりやすい'], [60, '#fb923c', '病気'], [80, '#f43f5e', '家出']]) });
const amgpOptionSub = (c) => (c === 'A' ? '助手が決める' : c === 'R' ? '疲れがとれる' : c === 'P' ? 'ストレスがとれる' : c === 'S' ? 'いなければ軽い訓練' : `${amgpStatName(c.slice(2))}・${c[0] === 'H' ? '重い' : '軽い'}`);
const amgpDayCapNow = () => Math.round(AMG_CARE.viewCap * (typeof amgbPace === 'function' ? amgbPace() : 1)); // 計画の回の1日の伸びの上限(育成の計算と同じ)
const amgpRiskOf = (f) => (f && !f.auto && !f.cond ? [['サボり', f.sab], ['けが', f.hurt], ['病気', f.sick], ['家出', f.away]].filter(([, v]) => v > 0) : []);
function AmgpFsGauge({ kind, start, ends }) {
  const label = kind === 'fat' ? '疲れ' : 'ストレス';
  const vals = ends.filter(v => Number.isFinite(v));
  const peak = vals.length ? Math.max(start, ...vals) : start;
  const last = vals.length ? vals[vals.length - 1] : start;
  const pct = (v) => `${Math.max(0, Math.min(100, v))}%`;
  const lines = AMGP_FS_LINES[kind];
  const over = lines.filter(([v]) => peak >= v).pop();
  return (
    <div className="mt-1.5" data-amgp-gauge={kind}>
      <div className="flex items-baseline gap-1.5 text-[11px] font-black">
        <span className="w-[56px] shrink-0 text-left">{label}</span>
        <span className="flex-1 text-left text-[10px] font-bold" style={{ color: over ? over[1] : '#94a3b8' }}>{over ? `⚠ ${over[2]}の線をこえる` : 'だいじょうぶ'}</span>
        <b className="shrink-0 text-right text-amber-200" data-amgp-gauge-num>{start} → {last}{peak > last ? `(いちばん高い ${peak})` : ''}</b>
      </div>
      <div className="relative mt-1 h-3 overflow-hidden rounded-full bg-slate-700">
        <i className="absolute inset-y-0 left-0 bg-slate-300" style={{ width: pct(Math.min(start, peak)) }}/>
        {peak > start && <i className="absolute inset-y-0" style={{ left: pct(start), width: pct(peak - start), background: kind === 'fat' ? '#f59e0b' : '#f472b6' }} data-amgp-gauge-add/>}
        {lines.map(([v, c]) => <i key={v} className="absolute inset-y-0 w-[2px]" style={{ left: `calc(${pct(v)} - 1px)`, background: c }}/>)}
      </div>
      <div className="relative h-3 text-[8.5px] font-black">
        {lines.map(([v, c]) => <span key={v} className="absolute -translate-x-1/2" style={{ left: pct(v), color: c }}>{v}</span>)}
      </div>
    </div>);
}
function AmgpDayPlan({ x, d, di, setDi, w }) {
  const [open, setOpen] = React.useState(null); // 選んでいる回(0 朝・1 昼・2 夜)
  const [help, setHelp] = React.useState(false);
  const [copied, setCopied] = React.useState('');
  const wd = d.wd;
  const g = {}; for (const f of d.f) if (f) for (const [k, [a, b]] of Object.entries(f.g)) g[k] = [(g[k] ? g[k][0] : 0) + a, (g[k] ? g[k][1] : 0) + b];
  const risks = [0, 1, 2].flatMap(p => amgpRiskOf(d.f[p]).map(([n, v]) => `${AMG_PERIOD_NAME[p]}: ${n} ${amgpPct(v)}`));
  const copy = (mode, msg) => { amgpCopyDay(x.key, wd, mode); setCopied(msg); };
  return (<div data-amgp-dayplan>
    <div className="mt-2 flex items-center gap-1.5">
      <button type="button" disabled={di <= 0} onClick={() => { setDi(di - 1); setOpen(null); setCopied(''); }} className="min-h-[36px] rounded-full bg-slate-800 px-3 text-[12px] font-black disabled:opacity-40" aria-label="前の日">‹</button>
      <span className="flex-1 text-center text-[13px] font-black">{AMGP_DAY_NAME[wd]}曜日{di === 0 ? '(今日)' : ''}</span>
      <button type="button" disabled={di >= 6} onClick={() => { setDi(di + 1); setOpen(null); setCopied(''); }} className="min-h-[36px] rounded-full bg-slate-800 px-3 text-[12px] font-black disabled:opacity-40" aria-label="次の日">›</button>
    </div>
    <div className="mt-2 flex items-center gap-1.5">
      <p className="flex-1 text-left text-[12px] font-black text-emerald-200">📅 この日の予定(押して変える)</p>
      <button type="button" onClick={() => setHelp(!help)} className={`min-h-[30px] min-w-[30px] rounded-full text-[12px] font-black ${help ? 'bg-sky-400 text-sky-950' : 'bg-slate-700'}`} aria-label="説明" data-amgp-help-btn>？</button>
    </div>
    {help && <div className="mt-1 space-y-1 rounded-xl bg-slate-800 p-2 text-left text-[10.5px] font-bold text-slate-200" data-amgp-help>
      <p>朝(4:00)・昼(12:00)・夜(18:00)に何をするかを決めます。決めた予定は毎週くり返します。</p>
      <p>計画の回はよく伸びて(1.3倍)、失敗しにくくなります。1日に伸びるのは{amgpDayCapNow()}までで、こえる分は伸びません。「🍃 まかせる」の回は{amgpWhoName(x.aid)}が様子を見て決めます。</p>
      <p>疲れ60・ストレス50からサボりやすく、疲れ70で重い訓練・修行のけが、ストレス60で病気、80で家出が起きることがあります。計画のマスモンは自動では休まないので、「😴 休み」「🎈 遊び」を入れてください。</p>
    </div>}
    <div className="mt-1.5 grid grid-cols-3 gap-1.5" data-amgp-slots>
      {[0, 1, 2].map(p => { const f = d.f[p]; const code = w[wd * 3 + p]; const cond = f && f.cond && AMGP_COND[f.cond]; const rk = amgpRiskOf(f); return (
        <button key={p} type="button" disabled={!f} onClick={() => setOpen(open === p ? null : p)} data-amgp-slot={p}
          className={`flex min-h-[96px] flex-col items-center justify-start rounded-xl border-2 px-1 py-1.5 text-center disabled:opacity-40 ${open === p ? 'border-emerald-300 bg-emerald-950/70' : rk.length ? 'border-rose-300/70 bg-slate-800' : 'border-white/10 bg-slate-800'}`}>
          <span className="text-[10px] font-black text-slate-300">{AMG_PERIOD_NAME[p]} {['4:00', '12:00', '18:00'][p]}</span>
          <span className="mt-0.5 text-[24px] leading-none">{cond ? cond.icon : amgpCodeIcon(code)}</span>
          <span className="mt-1 whitespace-nowrap text-[11.5px] font-black">{cond ? cond.name : amgpCodeName(code)}</span>
          <span className="whitespace-nowrap text-[9.5px] font-bold text-slate-300">{!f ? 'もう過ぎた' : cond ? '休みになる' : amgpOptionSub(code)}</span>
          {f && f.capped && <span className="mt-0.5 whitespace-nowrap rounded bg-amber-700 px-1 text-[9px] font-black" data-amgp-slot-capped>⏸ 上限で止まる</span>}
          {rk.length > 0 && <span className="mt-0.5 rounded bg-rose-700 px-1 text-[9px] font-black" data-amgp-slot-risk>⚠ {rk[0][0]} {amgpPct(rk[0][1])}</span>}
        </button>); })}
    </div>
    {open !== null && d.f[open] && <div className="mt-1.5 rounded-xl border border-emerald-300/50 bg-slate-950 p-2" data-amgp-picker>
      <p className="text-left text-[11px] font-black text-emerald-200">{AMG_PERIOD_NAME[open]}にすること</p>
      <div className="mt-1 grid grid-cols-2 gap-1">
        {AMGP_OPTIONS.map(c => { const full = c.length > 2 && x.e.st[c.slice(2)] >= AMG_MAX; const on = w[wd * 3 + open] === c; return (
          <button key={c} type="button" disabled={full} onClick={() => { amgpSetCells(x.key, { [wd * 3 + open]: c }); setOpen(null); setCopied(''); }} data-amgp-opt={c}
            className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-1.5 text-left disabled:opacity-40 ${on ? 'bg-emerald-400 text-emerald-950' : c[0] === 'H' ? 'bg-violet-800' : c[0] === 'L' ? 'bg-blue-800' : 'bg-slate-700'}`}>
            <span className="text-[16px] leading-none">{amgpCodeIcon(c)}</span>
            <span className="min-w-0 leading-tight"><b className="block whitespace-nowrap text-[11px] font-black">{amgpCodeName(c)}</b><span className="block whitespace-nowrap text-[9px] font-bold opacity-80">{full ? 'もう上限' : amgpOptionSub(c)}</span></span>
          </button>); })}
      </div>
    </div>}
    <p className="mt-3 text-left text-[11px] font-black text-slate-200">📈 この日で伸びる見通し(黄色が伸びる分)</p>
    <div className="mt-1"><AmgpBars st={x.e.st} add={g}/></div>
    {d.f.some(f => f && f.capped) && <p className="mt-1 rounded-xl bg-amber-950/70 p-2 text-left text-[10.5px] font-bold text-amber-100" data-amgp-capped>⏸ 1日に伸びるのは{amgpDayCapNow()}まで。{[0, 1, 2].filter(p => d.f[p] && d.f[p].capped).map(p => AMG_PERIOD_NAME[p]).join('・')}の訓練は、上限で伸びが止まります(疲れ・ストレスはたまります)</p>}
    <p className="mt-3 text-left text-[11px] font-black text-slate-200">🔋 疲れとストレスの見通し(色が、この日に増える分)</p>
    <div data-amgp-fs>
      <AmgpFsGauge kind="fat" start={d.startFat} ends={d.f.map(f => (f ? f.fat : NaN))}/>
      <AmgpFsGauge kind="str" start={d.startStr} ends={d.f.map(f => (f ? f.str : NaN))}/>
    </div>
    {risks.length > 0 && <p className="mt-1 rounded-xl border border-rose-300/60 bg-rose-950/60 p-2 text-left text-[10.5px] font-bold text-rose-100" data-amgp-day-risk>⚠ {risks.join(' ・ ')}</p>}
    <p className="mt-3 text-left text-[11px] font-black text-slate-200">📄 この日と同じ予定にする</p>
    <div className="mt-1 grid grid-cols-3 gap-1.5" data-amgp-copy>
      <button type="button" onClick={() => copy('all', '毎日')} className="min-h-[40px] rounded-xl bg-slate-700 px-1 text-center text-[11px] font-black">毎日(7日)</button>
      <button type="button" onClick={() => copy('weekday', '平日')} className="min-h-[40px] rounded-xl bg-slate-700 px-1 text-center text-[11px] font-black">平日(月〜金)</button>
      <button type="button" onClick={() => copy('holiday', '土日')} className="min-h-[40px] rounded-xl bg-slate-700 px-1 text-center text-[11px] font-black">土日</button>
    </div>
    {copied && <p className="mt-1 text-left text-[10.5px] font-bold text-emerald-200" data-amgp-copied>✓ {copied}を{AMGP_DAY_NAME[wd]}曜日と同じ予定にしました</p>}
  </div>);
}
const amgpLevelColor = (v) => (v >= 70 ? 'text-rose-300' : v >= 60 ? 'text-amber-300' : 'text-slate-200');
function AssistantMasmonNote({ readOnly = false, data = null, ownerName = '', onClose, aid = null, land = false }) {
  if (readOnly) return <AmgpReadOnly data={data} ownerName={ownerName} onClose={onClose} land={land} aid={aid}/>;
  return <AmgpMine onClose={onClose} aid={aid} land={land}/>;
}
function AmgpMine({ onClose, aid = null, land = false }) {
  amgpUseStores();
  const [tab, setTab] = React.useState('list');
  const [filter, setFilter] = React.useState(aid);
  const [sel, setSel] = React.useState(null); // 計画・記録・修行で見る子(key)
  const [ready, setReady] = React.useState(AMGP_STORE.loaded && AMGP_CSTORE.loaded);
  const ids = (typeof ASSISTANT_LIFE_HOUSE_ORDER !== 'undefined' ? ASSISTANT_LIFE_HOUSE_ORDER : []);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await amgpLoad();
        if (typeof ASSISTANT_MASMON_STORE !== 'undefined') await ASSISTANT_MASMON_STORE.load();
        if (typeof AMG_STORE !== 'undefined') await AMG_STORE.load();
        for (const id of ids) { try { if (typeof amgTick === 'function') await amgTick(id); } catch (_) {} }
        amgpMigrate();
      } catch (_) {}
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, []);
  if (!amgpOn()) return null;
  const ms = typeof ASSISTANT_MASMON_STORE !== 'undefined' ? ASSISTANT_MASMON_STORE.state : null;
  const all = [];
  for (const id of ids) for (const row of (ms && typeof assistantMasmonRowsOf === 'function' ? assistantMasmonRowsOf(ms, id) : [])) {
    const e = typeof amgEntryOf === 'function' ? amgEntryOf(id, row) : null;
    if (e) all.push({ aid: id, row, e, key: amgpKey(id, row.slot, row.monster) });
  }
  const st = AMGP_STORE.state; const sg = amgpStageOf(st.days); const nowSlot = amgSlotOf();
  const picked = st.picks.map(p => all.find(x => x.aid === p.aid && x.row.slot === p.slot && x.row.monster === p.monster)).filter(Boolean);
  const others = all.filter(x => !picked.includes(x) && (!filter || x.aid === filter));
  const cur = all.find(x => x.key === sel) || picked[0] || null;
  const nameOf = (x) => x.row.nick || ((typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[x.row.monster]) || {}).name || '';
  const todayN = (x) => (x.e.dg && x.e.dg.d === amgSlotDay(nowSlot) ? x.e.dg.n : 0);
  const condTag = (x) => { const c = amgpCondAt(x.key, nowSlot + 1) || amgpCondAt(x.key, nowSlot); return c ? c : null; };
  const pickSel = (x) => (
    <div className="flex flex-wrap gap-1.5" data-amgp-pick-sel>
      {(picked.length ? picked : all.slice(0, 8)).map(x => <button key={x.key} type="button" onClick={() => setSel(x.key)} className={`flex min-h-[40px] items-center gap-1 rounded-xl border px-2 text-[11.5px] font-black ${cur && cur.key === x.key ? 'border-emerald-300 bg-emerald-900' : 'border-white/15 bg-slate-800'}`}>{nameOf(x)}<small className="text-[9.5px] text-slate-300">{amgpWhoName(x.aid)}</small></button>)}
    </div>);
  const card = (x, isPick) => {
    const c = condTag(x); const today = amgSlotDay(nowSlot);
    const nextCode = isPick ? amgpCodeAt(x.key, nowSlot + 1) : 'A';
    return (
      <div key={x.key} className={`mt-1.5 rounded-2xl border p-2 ${isPick ? 'border-emerald-300 bg-emerald-950/70' : 'border-white/10 bg-slate-800/70'}`} data-amgp-mon={x.key}>
        <div className="flex items-center gap-2">
          {amgpMonIcon(x.row.monster)}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1" data-amgp-name-row><p className="min-w-0 truncate text-[13px] font-black">{nameOf(x)} <small className="text-[10px] text-slate-300">{amgpWhoName(x.aid)}のマスモン・育成Lv.{x.e.lv}</small></p>{typeof AmgbPowerTag === 'function' && <span className="shrink-0" data-amgp-power-tag><AmgbPowerTag aid={x.aid} row={x.row}/></span>}</div>
            <p className="text-[10.5px] font-bold text-slate-300">{isPick ? `次の回: ${amgpCodeIcon(nextCode)} ${amgpCodeName(nextCode)} ・ ` : ''}疲れ <b className={amgpLevelColor(x.e.fat)}>{x.e.fat}</b> ・ ストレス <b className={amgpLevelColor(x.e.str + 10)}>{x.e.str}</b> ・ 今日の伸び {todayN(x)}/{(isPick ? 20 : 15) * (typeof amgbPace === 'function' ? amgbPace() : 1)}</p>
            {c && <p className="text-[11px] font-black text-rose-200" data-amgp-cond={c.k}>{AMGP_COND[c.k].icon} {AMGP_COND[c.k].name}(あと{Math.max(1, Math.ceil((c.until - nowSlot) / 3))}日くらい・対戦には出られます)</p>}
          </div>
          {isPick ? <span className="shrink-0 rounded-lg bg-emerald-400 px-1.5 py-0.5 text-[10px] font-black text-emerald-950">計画中</span> : <span className="shrink-0 rounded-lg bg-slate-600 px-1.5 py-0.5 text-[10px] font-black">まかせる</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {isPick && <button type="button" onClick={() => { setSel(x.key); setTab('plan'); }} data-amgp-go-plan className="min-h-[40px] rounded-xl bg-emerald-600 px-3 text-[11.5px] font-black">🗓 予定を組む</button>}
          {isPick && <button type="button" onClick={() => amgpSetPick(x.aid, x.row, false)} data-amgp-unpick className="min-h-[40px] rounded-xl bg-slate-700 px-3 text-[11.5px] font-black">計画から外す</button>}
          {!isPick && <button type="button" disabled={st.picks.length >= sg.cap} onClick={() => amgpSetPick(x.aid, x.row, true)} data-amgp-pick className="min-h-[40px] rounded-xl bg-emerald-700 px-3 text-[11.5px] font-black disabled:bg-slate-700 disabled:text-slate-400">📌 計画して育てる</button>}
          {typeof AmgsSleepButton === 'function' && <AmgsSleepButton aid={x.aid} row={x.row}/>}{/* 💤 冬眠(56-assistant-life-masmon-sleep.jsx・印が偽なら出ない) */}
          {c && c.k !== 'away' && <button type="button" disabled={c.care === today} onClick={() => amgpCare(x.key)} data-amgp-care className="min-h-[40px] rounded-xl bg-pink-700 px-3 text-[11.5px] font-black disabled:bg-slate-700 disabled:text-slate-400">{c.care === today ? '🩹 今日は看病した' : `🩹 ${amgpWhoName(x.aid)}に看病してもらう`}</button>}
          {c && c.k === 'away' && <button type="button" disabled={c.find === today} onClick={() => amgpFind(x.key)} data-amgp-find className="min-h-[40px] rounded-xl bg-sky-700 px-3 text-[11.5px] font-black disabled:bg-slate-700">🔎 {amgpWhoName(x.aid)}にさがしに行ってもらう</button>}
        </div>
      </div>);
  };
  let body = null;
  if (!ready) body = <p className="mt-6 text-center text-[12px] font-bold text-slate-300">読み込み中…</p>;
  else if (tab === 'list') {
    const toNext = sg.next !== null ? sg.next - st.days : 0;
    body = (<>
      <div className="rounded-2xl border border-amber-300/50 bg-slate-950 p-2" data-amgp-stage={sg.lv}>
        <p className="text-[12px] font-black text-amber-200">📒 ノートの段 {sg.lv} ・ 計画で育てた日 {st.days}{sg.next !== null ? `/${sg.next}` : ''}</p>
        <span className="mt-1 block h-2 overflow-hidden rounded bg-slate-700"><i className="block h-full bg-amber-300" style={{ width: `${sg.next === null ? 100 : Math.min(100, st.days / sg.next * 100)}%` }}/></span>
        <p className="mt-1 text-[10.5px] font-bold text-slate-300">{sg.next === null ? '最後の段です。5体まで計画して育てられます' : `あと${toNext}日で段${sg.lv + 1} → 計画できるマスモンが${sg.lv + 1}体に(計画のマスモンが予定で育った日を、1体ごとに数えます)`}</p>
      </div>
      <p className="mt-3 text-[12px] font-black text-emerald-200">📌 計画して育てるマスモン({picked.length}/{sg.cap})</p>
      {picked.map(x => card(x, true))}
      {Array.from({ length: Math.max(0, AMGP_MAX - Math.max(sg.cap, picked.length)) }).slice(0, 1).map((_, i) => <p key={i} className="mt-1.5 rounded-2xl border-2 border-dashed border-white/20 p-2 text-center text-[11px] font-bold text-slate-400" data-amgp-locked>🔒 {sg.cap + 1}体目は段{sg.cap + 1}で(あと{toNext}日)</p>)}
      {picked.length < sg.cap && <p className="mt-1 text-[10.5px] font-bold text-slate-300">下の一覧の「📌 計画して育てる」で選べます(いつでも外せます)</p>}
      <p className="mt-3 text-[12px] font-black text-slate-200">🍃 助手まかせ(自主育成) {others.length}体</p>
      <div className="mt-1 flex flex-wrap gap-1" data-amgp-filter>
        {[null, ...ids.filter(id => all.some(x => x.aid === id))].map(id => <button key={id || 'all'} type="button" onClick={() => setFilter(id)} className={`min-h-[34px] rounded-full px-3 text-[11px] font-black ${filter === id ? 'bg-emerald-400 text-emerald-950' : 'bg-slate-800'}`}>{id ? amgpWhoName(id) : '全員'}</button>)}
      </div>
      {others.map(x => card(x, false))}
      {typeof AmgsSection === 'function' && <AmgsSection filter={filter}/>}
      {!all.length && <p className="mt-3 text-[11.5px] font-bold text-slate-300">まだ育成している助手のマスモンがいません</p>}
    </>);
  } else if (tab === 'plan') body = cur && picked.includes(cur) ? <AmgpPlanTab x={cur} nameOf={nameOf} pickSel={pickSel(cur)}/> : <p className="mt-4 text-[12px] font-bold text-slate-300" data-amgp-plan-empty>「一覧」で計画して育てるマスモンを選ぶと、ここで朝・昼・夜の予定を組めます</p>;
  else if (tab === 'log') body = cur ? <AmgpLogTab x={cur} nameOf={nameOf} pickSel={pickSel(cur)}/> : <p className="mt-4 text-[12px] font-bold text-slate-300">記録はまだありません</p>;
  else if (tab === 'train') {
    const who = cur && typeof assistantById === 'function' ? assistantById(cur.aid) : null;
    body = (<>{pickSel(cur)}
      {cur && who && typeof AmgtCard === 'function' ? <div className="mt-2"><AmgtCard who={who} t={cur.row} e={cur.e}/></div> : <p className="mt-3 text-[11.5px] font-bold text-slate-300">修行は、助手がモンヒロバトルにいる時間にできます。予定の「⚔ 修行」の回は、助手がいればその回に修行します</p>}</>);
  } else if (tab === 'ticket') {
    const rows = ids.map(id => { let info = null; try { info = typeof assistantMasmonRanchRowInfo === 'function' ? assistantMasmonRanchRowInfo(id) : null; } catch (_) { info = null; } return info ? { id, info } : null; }).filter(Boolean);
    body = (<>
      <p className="text-[11.5px] font-bold text-slate-300">助手がM/B管理にいる時間帯に、その助手のマスモンへトレーニングチケットを使ってあげられます(時間帯ごとに助手1人1枚)</p>
      {rows.length ? rows.map(({ id, info }) => <button key={id} type="button" disabled={info.used} onClick={() => { try { assistantMasmonRanchOpen(id); } catch (_) {} }} data-amgp-ticket={id} className="mt-1.5 min-h-[44px] w-full rounded-xl bg-emerald-700 px-3 text-left text-[12px] font-black disabled:bg-slate-700 disabled:text-slate-400">🎫 {amgpWhoName(id)}のマスモンに使う{info.used ? '(この時間帯は済み)' : ''}</button>)
        : <p className="mt-2 rounded-xl bg-slate-800 p-2 text-[11.5px] font-bold text-slate-300" data-amgp-ticket-none>いまM/B管理にいる助手はいません</p>}
      {typeof AssistantMasmonRanchHost === 'function' && <AssistantMasmonRanchHost/>}
    </>);
  }
  return <AmgpShell title="育成ノート" sub={`助手のマスモン ${all.length}体 ・ 計画中 ${picked.length}/${sg.cap}体`} tabs={AMGP_TABS} tab={tab} setTab={setTab} onClose={onClose} land={land}>{body}</AmgpShell>;
}
function AmgpPlanTab({ x, nameOf, pickSel }) {
  const [mode, setMode] = React.useState('week');
  const now = Date.now(); const s0 = amgSlotOf(now); const day0 = amgSlotDay(s0);
  const [di, setDi] = React.useState(0); // 今日から何日目(1日の画面)
  const fw = amgpForecastWeek(x.aid, x.row, x.e, x.key, now);
  const w = AMGP_STORE.state.week[x.key] || amgpBlankWeek();
  const once = AMGP_STORE.state.once[x.key] && AMGP_STORE.state.once[x.key].s === s0 + 1 ? AMGP_STORE.state.once[x.key].c : '';
  const d = fw.days[di]; const wd = d.wd;
  const sel = (code, onChange, attr) => <select className="min-w-0 rounded-lg bg-slate-800 px-1.5 py-1 text-[11px] font-black text-white" value={code} onChange={ev => onChange(ev.target.value)} {...attr}>{AMGP_OPTIONS.map(c => <option key={c} value={c} disabled={c.length > 2 && x.e.st[c.slice(2)] >= AMG_MAX}>{amgpOptionLabel(c)}</option>)}</select>;
  const warn = fw.days.flatMap(dd => (dd.f || []).map((f, p) => (f && !f.auto && (f.fat >= 70 || f.str >= 60 || f.sab > 0) ? { dd, p, f } : null))).filter(Boolean)[0];
  return (<>
    {pickSel}
    <div className="mt-2 flex items-center gap-1.5">
      {[['week', '週'], ['day', '1日']].map(([k, l]) => <button key={k} type="button" onClick={() => setMode(k)} data-amgp-mode={k} className={`min-h-[36px] rounded-full px-4 text-[12px] font-black ${mode === k ? 'bg-emerald-400 text-emerald-950' : 'bg-slate-800'}`}>{l}</button>)}
      <span className="ml-auto truncate text-[11px] font-bold text-slate-300">{nameOf(x)}({amgpWhoName(x.aid)})</span>
    </div>
    <div className="mt-2 rounded-xl border border-sky-300/40 bg-slate-950 p-2" data-amgp-once>
      <p className="text-[10.5px] font-black text-sky-200">次の回({AMG_PERIOD_NAME[(s0 + 1) % 3]})だけ変える</p>
      <div className="mt-1 flex items-center gap-1.5">{sel(once || amgpCodeAt(x.key, s0 + 1), (c) => amgpSetOnce(x.key, c), { 'data-amgp-once-select': 1 })}
        {once && <button type="button" onClick={() => amgpSetOnce(x.key, 'clear')} className="min-h-[34px] rounded-lg bg-slate-700 px-2 text-[11px] font-black">予定どおりに戻す</button>}</div>
    </div>
    {mode === 'week' ? (<>
      <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: '28px 1fr 1fr 1fr 52px' }} data-amgp-week>
        <span/>{AMG_PERIOD_NAME.map(p => <span key={p} className="text-center text-[10px] font-black text-slate-400">{p}</span>)}<span className="text-center text-[10px] font-black text-slate-400">疲/ス</span>
        {fw.days.map((dd, i) => (<React.Fragment key={dd.day}>
          <span className={`flex items-center justify-center rounded-lg text-[11px] font-black ${i === 0 ? 'bg-emerald-400 text-emerald-950' : 'bg-slate-800'}`}>{AMGP_DAY_NAME[dd.wd]}</span>
          {dd.codes.map((c, p) => <button key={p} type="button" onClick={() => { setDi(i); setMode('day'); }} data-amgp-cell={dd.wd * 3 + p} className={`min-h-[34px] truncate rounded-lg px-1 text-[10.5px] font-black ${dd.f[p] && dd.f[p].cond ? 'bg-slate-700 text-slate-300' : c === 'A' ? 'bg-teal-800' : c === 'R' || c === 'P' ? 'bg-slate-600' : c === 'S' ? 'bg-orange-700' : c[0] === 'H' ? 'bg-violet-700' : 'bg-blue-700'} ${!dd.f[p] ? 'opacity-40' : ''}`} data-amgp-cond={dd.f[p] && dd.f[p].cond ? dd.f[p].cond : undefined}>{dd.f[p] && dd.f[p].cond && AMGP_COND[dd.f[p].cond] ? `${AMGP_COND[dd.f[p].cond].icon}${AMGP_COND[dd.f[p].cond].name}` : <>{amgpCodeIcon(c)}{amgpCodeName(c)}</>}</button>)}
          <span className={`flex items-center justify-center rounded-lg text-[10.5px] font-black ${dd.fat >= 70 || dd.str >= 70 ? 'bg-rose-700' : dd.fat >= 60 || dd.str >= 60 ? 'bg-amber-700' : 'bg-slate-800'}`} data-amgp-day-end={dd.wd}>{dd.fat}/{dd.str}</span>
        </React.Fragment>))}
      </div>
      {warn && <p className="mt-2 rounded-xl border border-rose-300/60 bg-rose-950/60 p-2 text-[11px] font-bold text-rose-100" data-amgp-warn>⚠ {AMGP_DAY_NAME[warn.dd.wd]}の{AMG_PERIOD_NAME[warn.p]}: 疲れ{warn.f.fat}・ストレス{warn.f.str}{warn.f.sab > 0 ? ` → サボり ${amgpPct(warn.f.sab)}` : ''}{warn.f.hurt > 0 ? ` ・ けが ${amgpPct(warn.f.hurt)}` : ''}{warn.f.sick > 0 ? ` ・ 病気 ${amgpPct(warn.f.sick)}` : ''}{warn.f.away > 0 ? ` ・ 家出 ${amgpPct(warn.f.away)}` : ''}</p>}
      <p className="mt-1 text-[10px] font-bold text-slate-400">疲/ス = その日の終わりの疲れ/ストレス(60で黄・70で赤)。マスを押すとその日の「1日」の画面へ。7日でくり返します</p>
      <p className="mt-2 rounded-xl bg-slate-800 p-2 text-[11px] font-bold text-slate-100" data-amgp-week-total>見通し(この7日): {Object.entries(fw.total).map(([k, [a, b]]) => `${amgpStatName(k)} +${a}〜${b}`).join(' ・ ') || '伸びなし'}</p>
    </>) : <AmgpDayPlan x={x} d={d} di={di} setDi={setDi} w={w}/>}
    {mode === 'week' && <p className="mt-2 text-[10px] font-bold text-slate-400">計画の回はよく伸びて(1.3倍)、失敗しにくくなります。1日に伸びるのは{amgpDayCapNow()}まで。「🍃 まかせる」の回は{amgpWhoName(x.aid)}が様子を見て決めます</p>}
  </>);
}
function AmgpLogTab({ x, nameOf, pickSel }) {
  const nowSlot = amgSlotOf(); const from = nowSlot - 20;
  const logs = x.e.log.filter(l => l.s >= from);
  const sum = {}; for (const l of logs) for (const [k, n] of Object.entries(l.g || {})) sum[k] = (sum[k] || 0) + n;
  const before = Object.fromEntries(AMG_KEYS.map(k => [k, x.e.st[k] - (sum[k] || 0)]));
  const cg = typeof amgCareGainOf === 'function' ? amgCareGainOf(x.e) : null;
  const ev = AMGP_CSTORE.state.log.filter(l => l.key === x.key && l.s >= from);
  const when = (s) => `${AMGP_DAY_NAME[amgpWeekday(amgSlotDay(s))]} ${AMG_PERIOD_NAME[s % 3]}`;
  const cTxt = { start: 'になった', care: 'を看病してもらった', hosp: 'で病院へ', cure: 'が特別な治療で治った', find: 'から帰ってきた' };
  return (<>
    {pickSel}
    <p className="mt-2 text-[12px] font-black text-slate-200">{nameOf(x)}の、この7日の能力の変化</p>
    <div className="mt-1 grid gap-0.5" data-amgp-log-change>
      {AMG_STATS.map(([k, label]) => <p key={k} className="flex justify-between text-[11.5px] font-bold"><span>{label}</span><span>{before[k]} → <b className="text-amber-200">{x.e.st[k]}</b>{sum[k] ? <span className="ml-1 text-emerald-300">+{sum[k]}</span> : null}</span></p>)}
    </div>
    <p className="mt-3 text-[12px] font-black text-slate-200">できごと</p>
    {[...logs].reverse().map((l, i) => (
      <p key={`${l.s}-${i}`} className="mt-0.5 flex justify-between gap-2 border-b border-white/5 py-0.5 text-[11px] font-bold" data-amgp-log={l.a}>
        <span className="min-w-0 truncate">{when(l.s)} {amgActName(l) || amgpActName(l)}{l.p ? '(計画)' : ''}{l.r ? '(M/B管理)' : ''}{l.f ? '(うまくいかなかった)' : ''}</span>
        <span className="shrink-0 text-emerald-300">{Object.entries(l.g || {}).map(([k, n]) => `${amgpStatName(k)} ${n >= 0 ? '+' : '−'}${Math.abs(n)}`).join(' ') || (AMGP_IDLE[l.a] ? '伸びなし' : '')}</span>
      </p>))}
    {ev.map((l, i) => <p key={`c${i}`} className="mt-0.5 text-[11px] font-bold text-rose-200" data-amgp-log-cond={l.t}>{when(l.s)} {AMGP_COND[l.k].icon} {AMGP_COND[l.k].name}{cTxt[l.t]}</p>)}
    {!logs.length && !ev.length && <p className="text-[11px] font-bold text-slate-400">まだ記録がありません</p>}
    {cg && cg.total > 0 && <p className="mt-2 rounded-xl bg-slate-800 p-2 text-[11px] font-bold text-sky-200" data-amgp-care-gain>関わって伸びた分(これまで): 計画・指定 +{cg.pick} ・ 見に来た +{cg.view} ・ 相談 +{cg.ask}{cg.ranch ? ` ・ M/B管理 +${cg.ranch}` : ''}</p>}
  </>);
}
// 見る専用(フレンドの家・オトズレ)。data = alfMsNormalize の { off, ms:[{ monster, nick, colors, lead, slot, lv, grow, growMine, stats, why }], dk:[…], wt }
//   自分の保存キーを読まない・書かない。ボタンは閉じるとタブだけ
function AmgpReadOnly({ data, ownerName = '', onClose, land = false, aid = null }) {
  const [tab, setTab] = React.useState('list');
  const [sel, setSel] = React.useState(0);
  const d = data && typeof data === 'object' ? data : null;
  const ms = d && Array.isArray(d.ms) ? d.ms : []; const dk = d && Array.isArray(d.dk) ? d.dk : [];
  const owner = typeof ownerName === 'string' && ownerName ? `${ownerName.slice(0, 16)}さんの` : '';
  const monName = (mo) => ((typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[mo]) || {}).name || '';
  const cur = ms[Math.min(sel, Math.max(0, ms.length - 1))] || null;
  let body;
  if (!d || d.off) body = <p className="mt-6 text-center text-[12px] font-bold text-slate-300" data-amgp-ro-off>{d && d.off ? '見せない設定になっています' : 'まだ見られません'}</p>;
  else if (tab === 'list') body = (<>
    <p className="text-[12px] font-black text-emerald-200">🐾 マスモン {ms.length}体{d.wt ? `(ほかに まだ迎えていない枠 ${d.wt})` : ''}</p>
    {ms.map((t, i) => <button key={i} type="button" onClick={() => setSel(i)} data-amgp-ro-mon={i} className={`mt-1.5 flex w-full items-center gap-2 rounded-2xl border p-2 text-left ${cur === t ? 'border-emerald-300 bg-emerald-950/70' : 'border-white/10 bg-slate-800/70'}`}>
      {amgpMonIcon(t.monster)}
      <span className="min-w-0 flex-1"><b className="block truncate text-[13px] font-black">{t.nick || monName(t.monster)}{t.lead ? ' 👑' : ''}</b><small className="block text-[10.5px] font-bold text-slate-300">{monName(t.monster)}{t.lv ? ` ・ Lv ${t.lv}` : ''}{t.grow ? ` ・ ${t.grow}` : ''}</small></span>
    </button>)}
    {cur && <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950 p-2" data-amgp-ro-detail>
      <p className="text-[12px] font-black">6能力({cur.nick || monName(cur.monster)})</p>
      {cur.stats ? <div className="mt-1"><AmgpBars st={cur.stats}/></div> : <p className="mt-1 text-[11px] font-bold text-slate-400">能力はまだ見られません</p>}
      {cur.why && <p className="mt-1 text-[11px] font-bold text-slate-300">{cur.why}</p>}
    </div>}
    <p className="mt-3 rounded-xl bg-slate-800 p-2 text-[10.5px] font-bold text-slate-400">見るだけです(計画・チケット・修行のボタンは出しません)</p>
  </>);
  else body = (<>
    {/* デッキの中身はカード部の部品で、自分のデッキと同じ形に出す(2026-11-12 窓口 案A・オトズレ)。3体はカードのモンスター番号。部品が無ければ下の1行 */}
    {dk.length && typeof CardAssistantDeckView === 'function' && typeof cardAssistantDeckViewOn === 'function' && cardAssistantDeckViewOn() ? dk.map((x, i) => <div key={i} className="mt-1.5" data-amgp-ro-deck={x.face}><CardAssistantDeckView who={aid} deck={x} land={land}/></div>)
    : dk.length ? dk.map((x, i) => <div key={i} className="mt-1.5 rounded-2xl border border-white/10 bg-slate-800/70 p-2" data-amgp-ro-deck={x.face}>
      <p className="text-[13px] font-black">🃏 {x.name || 'デッキ'}</p>
      {x.line && <p className="text-[11px] font-bold text-slate-300">{x.line}</p>}
      <p className="mt-1 text-[11px] font-bold text-slate-200">{(x.monsters || []).map(monName).filter(Boolean).join('・')}{x.ace ? ` ・ エース ${x.ace}` : ''}</p>
      <p className="text-[10.5px] font-bold text-slate-400">カード {(x.cards || []).reduce((a, c) => a + (Number(c[1]) || 0), 0)}枚</p>
    </div>) : <p className="mt-3 text-[11.5px] font-bold text-slate-300">見せているデッキはありません</p>}
  </>);
  // 見せない設定・まだの人は体数とタブを出さない(「0体」と出ると誤解する・ミハリ 最終確認)
  const shown = !!d && !d.off;
  return <AmgpShell ro title={`${owner}育成ノート`} sub={shown ? `見るだけ ・ 助手のマスモン ${ms.length}体` : '見るだけ'} tabs={shown ? AMGP_RO_TABS : []} tab={tab} setTab={setTab} onClose={onClose} land={land}>{body}</AmgpShell>;
}
