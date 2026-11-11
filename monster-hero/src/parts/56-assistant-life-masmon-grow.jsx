// 助手のマスモンの育成基盤(社長の仕様書 docs/progress/assistant-peer/ASSISTANT-MASMON-AUTOBATTLE-SPEC-v1.md の第①段階・2026-11-11 キズナ4)
//   6能力(ライフ・ちから・かしこさ・命中・回避・丈夫さ)・疲労・ストレス・1日3回(朝・昼・夜)の自主育成。作りは docs/progress/assistant-peer/masmon-grow/GROW-BASE-PLAN.md
//   保存は新しいキー mh_assistant_masmon_grow_v1 だけ(mh_assistant_life_masmon_v1 は読むだけ・書き換えない)。公開の印 RELEASE_FLAGS.assistantMasmonGrow が真のときだけ動く
//   同じ種(ブリーダーの種・助手・枠:種類・回)なら同じ結果になる(第④段階でサーバが確かめられる形)
const ASSISTANT_MASMON_GROW_KEY = 'mh_assistant_masmon_grow_v1';
const AMG_STATS = Object.freeze([['life', 'ライフ'], ['pow', 'ちから'], ['wise', 'かしこさ'], ['hit', '命中'], ['eva', '回避'], ['tough', '丈夫さ']]);
const AMG_KEYS = AMG_STATS.map(x => x[0]);
const AMG_MAX = 999; // 仕様書 §2 の仮案
// 種族ごとの適性(ライフ・ちから・かしこさ・命中・回避・丈夫さ の順に A〜E)。案: docs/progress/assistant-peer/masmon-grow/aptitude-draft.jpg(社長が見て決める)
const AMG_APT = Object.freeze({
  Mocchi: 'AADCDA',
  Suezo: 'BBDADB',
  Golem: 'BAEEEA',
  Tiger: 'CADBBC',
  Ham: 'DCDCBC',
  Pixie: 'ECAEAE',
  Mia: 'EBADAD',
  Pandora: 'DBBBBB',
  Monol: 'BDECEA',
  Oboro: 'ADEEDD',
  Plant: 'ADEEED',
  Zan: 'EBEAAE',
  Eiki: 'DADAAE',
  KenshiMocchi: 'EBDACC',
  Mitarashi: 'BAEDDB',
  Ark: 'CCCDCB',
  Iblis: 'DCCDCC',
  Snegurochka: 'DEADCC',
  Undine: 'ECAEBE',
  Yaobikuni: 'CEBEDB',
  Yggdrasil: 'AECDEA',
  MelWhip: 'ADCCEA',
  Melody: 'AECBEA',
  Kuromy: 'BACBDB',
  Ghost: 'CDBBBE',
  Spooky: 'BBBBBD',
  Illumine: 'EEBCAE',
  Dreamy: 'DEBCAD',
  Kyubi: 'CCAACD',
  Orihime: 'CDAACC',
});
const AMG_APT_MULT = Object.freeze({ A: 1.3, B: 1.15, C: 1, D: 0.85, E: 0.7 });
const AMG_APT_BASE = Object.freeze({ A: 300, B: 250, C: 200, D: 150, E: 100 }); // かしこさ・命中・回避の初めの値の元
const amgAptOf = (monster) => { const s = AMG_APT[monster] || 'CCCCCC'; const o = {}; AMG_KEYS.forEach((k, i) => { o[k] = AMG_APT_MULT[s[i]] ? s[i] : 'C'; }); return o; };
// 訓練(仕様書 §4 の表の名前)
const AMG_LIGHT = Object.freeze({ life: '走り込み', pow: '腕立て', wise: '勉強', hit: '的当て', eva: 'ステップ', tough: '受け身' });
const AMG_HEAVY = Object.freeze({ life: '長距離走', pow: '重量上げ', wise: '高度研究', hit: '高速射撃', eva: '障害物回避', tough: '耐久特訓' });
const AMG_SPECIAL = Object.freeze({ real: '実戦訓練', joint: '合同訓練', focus: '集中訓練', weak: '弱点克服' });
const AMG_SUB = Object.freeze({ life: 'tough', pow: 'life', wise: 'hit', hit: 'eva', eva: 'hit', tough: 'life' }); // 重トレの副能力
// 育成方針(いまの「攻撃型」などの型)で伸ばしたい能力(社長 11-11「型は育成方針として残す」)
const AMG_POLICY = Object.freeze({ '攻撃型': ['pow', 'hit'], '防御型': ['tough', 'eva'], 'ライフ型': ['life'], 'ガッツ型': ['wise'], 'すばやさ型': ['eva', 'hit'] });
// 助手の性格の傾向(仕様書 §7 の仮の傾向)。heavy=重トレの多さ・special=特殊訓練の多さ・rest=休ませる疲労の目安・like=好んで伸ばす能力
const AMG_TRAIT = Object.freeze({
  mua: { name: '積極型', heavy: 0.6, special: 0.15, rest: 65, like: ['pow'] },
  kiki: { name: '分析型', heavy: 0.4, special: 0.15, rest: 60, like: [] },
  momosuke: { name: '安定型', heavy: 0.25, special: 0.1, rest: 45, like: ['life'] },
  dra: { name: '大胆型', heavy: 0.55, special: 0.25, rest: 70, like: ['pow'] },
  atsu: { name: 'バランス型', heavy: 0.4, special: 0.15, rest: 60, like: [] },
  kyuko: { name: '研究型', heavy: 0.35, special: 0.2, rest: 55, like: ['wise'] },
  sorashido: { name: '柔軟型', heavy: 0.4, special: 0.3, rest: 60, like: [] },
  erubin: { name: '防御型', heavy: 0.35, special: 0.15, rest: 55, like: ['tough', 'eva'] },
});
const AMG_DAY_CAP = 40; // 1体1日の伸びの合計の上限(仕様書 §8。仮)
const AMG_CATCH_UP = 6; // 閉じていた分をまとめて決める回数の上限(2日分)
const AMG_LOG = 21;
const AMG_PERIOD_NAME = Object.freeze(['朝', '昼', '夜']);
// 回の番号: 朝(4:00〜)・昼(12:00〜)・夜(18:00〜)。日本時間で数える。日 = 朝4時で切り替え
const amgSlotOf = (now = Date.now()) => { const t = Number(now) + 9 * 3600000 - 4 * 3600000; const day = Math.floor(t / 86400000); const h = (t - day * 86400000) / 3600000; return day * 3 + (h < 8 ? 0 : h < 14 ? 1 : 2); };
const amgSlotDay = (slot) => Math.floor(slot / 3);
const amgClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const amgNum = (v, d, lo, hi) => (Number.isFinite(Number(v)) ? amgClamp(Math.round(Number(v)), lo, hi) : d);
const amgMonKey = (slot, monster) => `${slot}:${monster}`;
const normalizeAssistantMasmonGrow = (raw) => {
  const out = { v: 1, mons: {}, done: {}, focus: {}, rest: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const okAid = (aid) => typeof aid === 'string' && /^[a-z]{2,12}$/.test(aid);
  if (raw.mons && typeof raw.mons === 'object') for (const [aid, ms] of Object.entries(raw.mons)) {
    if (!okAid(aid) || !ms || typeof ms !== 'object') continue;
    const one = {};
    for (const [key, e] of Object.entries(ms).slice(0, 24)) {
      if (!/^[1-8]:\w{2,40}$/.test(key) || !e || typeof e !== 'object' || !e.st || typeof e.st !== 'object') continue;
      const st = {}; for (const k of AMG_KEYS) st[k] = amgNum(e.st[k], 0, 0, AMG_MAX);
      const ind = {}; for (const k of AMG_KEYS) ind[k] = amgNum(e.ind && e.ind[k], 0, -1, 1);
      const log = (Array.isArray(e.log) ? e.log : []).filter(x => x && typeof x === 'object' && Number.isInteger(x.s) && typeof x.a === 'string').slice(-AMG_LOG)
        .map(x => ({ s: x.s, a: x.a.slice(0, 12), k: AMG_KEYS.includes(x.k) ? x.k : '', g: Object.fromEntries(Object.entries(x.g && typeof x.g === 'object' ? x.g : {}).filter(([k, n]) => AMG_KEYS.includes(k) && Number.isFinite(n)).map(([k, n]) => [k, amgClamp(Math.round(n), -99, 99)])), ...(x.f ? { f: 1 } : {}) }));
      one[key] = { st, fat: amgNum(e.fat, 0, 0, 100), str: amgNum(e.str, 0, 0, 100), ind, log, src: 'init_v1', dg: { d: amgNum(e.dg && e.dg.d, 0, 0, 1e7), n: amgNum(e.dg && e.dg.n, 0, 0, 999) } };
    }
    out.mons[aid] = one;
  }
  if (raw.done && typeof raw.done === 'object') for (const [aid, s] of Object.entries(raw.done)) if (okAid(aid) && Number.isInteger(s) && s > 0) out.done[aid] = s;
  if (raw.focus && typeof raw.focus === 'object') for (const [aid, f] of Object.entries(raw.focus)) {
    if (!okAid(aid) || !f || typeof f !== 'object') continue;
    const o = {}; for (const [sl, x] of Object.entries(f)) { const n = Number(sl); if (Number.isInteger(n) && n >= 1 && n <= 8 && x && AMG_KEYS.includes(x.k) && Number.isInteger(x.until)) o[n] = { k: x.k, until: x.until }; }
    out.focus[aid] = o;
  }
  if (raw.rest && typeof raw.rest === 'object') for (const [aid, f] of Object.entries(raw.rest)) {
    if (!okAid(aid) || !f || typeof f !== 'object') continue;
    const o = {}; for (const [sl, x] of Object.entries(f)) { const n = Number(sl); if (Number.isInteger(n) && n >= 1 && n <= 8 && x === true) o[n] = true; }
    out.rest[aid] = o;
  }
  return out;
};
// 初めの値(一度だけ・社長 11-11 ②): ライフ・ちから・丈夫さはいまのゲージ(種族×Lv×型)の割合×600、かしこさ・命中・回避は適性と Lv から
const amgInitial = (row, rnd) => {
  const apt = amgAptOf(row.monster); const lv = Number.isFinite(row.lv) ? row.lv : 10;
  const now = (typeof assistantMasmonStats === 'function' ? assistantMasmonStats({ ...row, growMine: null }) : null) || {};
  const lvUp = 0.7 + Math.min(30, lv) / 50;
  const st = {
    life: Math.round((now.hp || 0.3) * 600), pow: Math.round((now.atk || 0.3) * 600), tough: Math.round((now.def || 0.3) * 600),
    wise: Math.round(AMG_APT_BASE[apt.wise] * lvUp), hit: Math.round(AMG_APT_BASE[apt.hit] * lvUp), eva: Math.round(AMG_APT_BASE[apt.eva] * lvUp),
  };
  for (const k of AMG_KEYS) st[k] = amgClamp(st[k], 1, 600);
  const ind = {}; for (const k of AMG_KEYS) { const r = rnd(); ind[k] = r < 0.2 ? -1 : r > 0.8 ? 1 : 0; } // 個体差(迎えたとき1回だけ・仕様書 §3)
  return { st, fat: 0, str: 0, ind, log: [], src: 'init_v1', dg: { d: 0, n: 0 } };
};
const amgRange = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
// 1回分の行動を選ぶ(仕様書 §8: 能力・適性・疲労・ストレス・性格・助言から)
const amgChoose = (aid, e, row, rnd, focusK, restReq) => {
  const T = AMG_TRAIT[aid] || AMG_TRAIT.atsu;
  if (restReq) return { a: 'rest' };
  if (e.fat >= T.rest) return { a: 'rest' };
  if (e.str >= 50) return { a: 'play' };
  const apt = amgAptOf(row.monster);
  const pol = AMG_POLICY[typeof assistantMasmonGrowKind === 'function' ? assistantMasmonGrowKind(row.grow) : String(row.grow || '').split('(')[0]] || [];
  // 伸ばしたい能力: 相談で頼まれた能力 → なければ、方針・性格の好み・適性に比べて低い能力に点を付けて選ぶ
  let k = focusK && AMG_KEYS.includes(focusK) ? focusK : '';
  if (!k) {
    let best = -1;
    for (const key of AMG_KEYS) {
      const want = (pol.includes(key) ? 2 : 0) + (T.like.includes(key) ? 0.8 : 0);
      const gap = 1 - e.st[key] / (AMG_MAX * (AMG_APT_MULT[apt[key]] / 1.3)); // 伸びしろ
      const sc = want + gap * 2 + rnd() * 0.9;
      if (sc > best) { best = sc; k = key; }
    }
  }
  const r = rnd();
  if (r < T.special) {
    const kinds = ['real', 'focus', 'weak', 'joint'];
    const sp = kinds[Math.floor(rnd() * kinds.length)];
    const weakest = AMG_KEYS.reduce((a, b) => (e.st[b] / AMG_APT_MULT[apt[b]] < e.st[a] / AMG_APT_MULT[apt[a]] ? b : a), AMG_KEYS[0]);
    return { a: sp, k: sp === 'weak' ? weakest : k };
  }
  return { a: r < T.special + T.heavy && e.fat < 40 ? 'heavy' : 'light', k };
};
// 1回分を当てる(仕様書 §4 の仮案の数字・§5 の疲労とストレス)
const amgDo = (aid, e, row, rnd, slot, act) => {
  const apt = amgAptOf(row.monster); const g = {}; let fail = false;
  const day = amgSlotDay(slot);
  const left = () => Math.max(0, AMG_DAY_CAP - (e.dg.d === day ? e.dg.n : 0));
  const add = (k, lo, hi) => {
    const base = amgRange(rnd, lo, hi) * AMG_APT_MULT[apt[k]] * (1 + 0.1 * (e.ind[k] || 0)) * (e.fat >= 50 ? 0.7 : 1) * (fail ? 0.5 : 1);
    const n = Math.min(Math.max(1, Math.round(base)), left(), AMG_MAX - e.st[k]);
    if (n <= 0) return;
    e.st[k] += n; g[k] = (g[k] || 0) + n; e.dg = { d: day, n: (e.dg.d === day ? e.dg.n : 0) + n };
  };
  const failChance = (extra) => Math.min(0.4, e.str / 200 + extra);
  if (act.a === 'rest') { e.fat = amgClamp(e.fat - 30, 0, 100); e.str = amgClamp(e.str - 5, 0, 100); }
  else if (act.a === 'play') { e.fat = amgClamp(e.fat - 10, 0, 100); e.str = amgClamp(e.str - 15, 0, 100); }
  else if (act.a === 'light') { fail = rnd() < failChance(0); add(act.k, 3, 6); e.fat = amgClamp(e.fat + 5, 0, 100); e.str = amgClamp(e.str + (fail ? 6 : 1), 0, 100); }
  else if (act.a === 'heavy') { fail = rnd() < failChance(0.05); add(act.k, 7, 12); add(AMG_SUB[act.k], 1, 3); e.fat = amgClamp(e.fat + 14, 0, 100); e.str = amgClamp(e.str + (fail ? 9 : 4), 0, 100); }
  else { // 特殊訓練
    fail = rnd() < failChance(0.03);
    const others = AMG_KEYS.filter(k => k !== act.k); const sub = others[Math.floor(rnd() * others.length)];
    add(act.k, 4, 9); add(sub, 2, 5);
    e.fat = amgClamp(e.fat + amgRange(rnd, 10, 18), 0, 100); e.str = amgClamp(e.str + (act.a === 'joint' ? -3 : fail ? 8 : 3), 0, 100);
  }
  e.log = [...e.log, { s: slot, a: act.a, k: act.k || '', g, ...(fail ? { f: 1 } : {}) }].slice(-AMG_LOG);
  return e;
};
// まだの回をまとめて決める。rows = その助手のいまのマスモン(assistantMasmonRowsOf)。初めての助手は、今の回から数える(さかのぼって育てない)
const amgCatchUp = (state, aid, rows, seed, nowSlot) => {
  const mons = { ...(state.mons[aid] || {}) }; let changed = false;
  for (const row of rows) {
    const key = amgMonKey(row.slot, row.monster);
    if (!mons[key] && typeof assistantMasmonRng === 'function') { mons[key] = amgInitial(row, assistantMasmonRng(`${seed}|${aid}|grow-init|${key}`)); changed = true; }
  }
  const last = state.done[aid];
  let from = Number.isInteger(last) ? last + 1 : nowSlot; // 初めては今の回だけ
  from = Math.max(from, nowSlot - AMG_CATCH_UP + 1);
  const focus = { ...(state.focus[aid] || {}) }; const rest = { ...(state.rest[aid] || {}) };
  for (let s = from; s <= nowSlot; s++) {
    for (const row of rows) {
      const key = amgMonKey(row.slot, row.monster); const e0 = mons[key]; if (!e0) continue;
      const e = { ...e0, st: { ...e0.st }, dg: { ...e0.dg } };
      const rnd = assistantMasmonRng(`${seed}|${aid}|grow|${key}|${s}`);
      const f = focus[row.slot] && focus[row.slot].until >= s ? focus[row.slot].k : '';
      const act = amgChoose(aid, e, row, rnd, f, !!rest[row.slot]);
      if (rest[row.slot]) delete rest[row.slot];
      mons[key] = amgDo(aid, e, row, rnd, s, act);
    }
    changed = true;
  }
  if (!changed && state.done[aid] === nowSlot) return state;
  return { ...state, mons: { ...state.mons, [aid]: mons }, done: { ...state.done, [aid]: Math.max(nowSlot, state.done[aid] || 0) }, focus: { ...state.focus, [aid]: focus }, rest: { ...state.rest, [aid]: rest } };
};
const amgActName = (x) => (x.a === 'rest' ? '休養' : x.a === 'play' ? '遊び' : x.a === 'light' ? AMG_LIGHT[x.k] : x.a === 'heavy' ? AMG_HEAVY[x.k] : AMG_SPECIAL[x.a]) || '';
const AMG_STORE = { state: normalizeAssistantMasmonGrow(null), loaded: false, subs: new Set(),
  set(next) { this.state = next; this.subs.forEach(f => { try { f(next); } catch (_) {} }); },
  async load() {
    if (this.loaded) return this.state;
    let raw = null; try { raw = typeof storeGet === 'function' ? await storeGet(ASSISTANT_MASMON_GROW_KEY, null, false) : null; } catch (_) {}
    this.loaded = true; this.set(normalizeAssistantMasmonGrow(raw)); return this.state;
  } };
const amgOn = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantMasmonGrow === true;
const amgSave = (next) => { AMG_STORE.set(next); try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_GROW_KEY, next, false); } catch (_) {} };
// 助手のマスモンを開いたときに呼ぶ(まだの回をまとめて決める)。印が偽のあいだは何もしない
const amgTick = async (aid, now = Date.now()) => {
  if (!amgOn() || typeof ASSISTANT_MASMON_STORE === 'undefined') return null;
  await ASSISTANT_MASMON_STORE.load(); await AMG_STORE.load();
  const ms = ASSISTANT_MASMON_STORE.state; if (!ms.seed) return null;
  const rows = typeof assistantMasmonRowsOf === 'function' ? assistantMasmonRowsOf(ms, aid) : [];
  if (!rows.length) return null;
  const next = amgCatchUp(AMG_STORE.state, aid, rows, ms.seed, amgSlotOf(now));
  if (next !== AMG_STORE.state) amgSave(next);
  return next;
};
const amgEntryOf = (aid, t, st = AMG_STORE.state) => (t && st.mons[aid] ? st.mons[aid][amgMonKey(t.slot, t.monster)] : null) || null;
// 相談(「◯◯を鍛えて」=3日間その能力を優先/「休ませて」=次の回は休む/「任せる」=優先を外す)
const amgAdvise = (aid, slot, what, now = Date.now()) => {
  const st = AMG_STORE.state; const s = amgSlotOf(now);
  if (what === 'rest') { amgSave({ ...st, rest: { ...st.rest, [aid]: { ...(st.rest[aid] || {}), [slot]: true } } }); return true; }
  if (what === 'auto') { const f = { ...(st.focus[aid] || {}) }; delete f[slot]; amgSave({ ...st, focus: { ...st.focus, [aid]: f } }); return true; }
  if (!AMG_KEYS.includes(what)) return false;
  amgSave({ ...st, focus: { ...st.focus, [aid]: { ...(st.focus[aid] || {}), [slot]: { k: what, until: s + 9 } } } });
  return true;
};
