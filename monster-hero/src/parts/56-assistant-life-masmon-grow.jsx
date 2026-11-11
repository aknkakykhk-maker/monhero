// 助手のマスモンの育成基盤(社長の仕様書 docs/progress/assistant-peer/ASSISTANT-MASMON-AUTOBATTLE-SPEC-v1.md の第①段階・2026-11-11 キズナ4)
//   6能力(ライフ・ちから・かしこさ・命中・回避・丈夫さ)・疲労・ストレス・1日3回(朝・昼・夜)の自主育成。作りは docs/progress/assistant-peer/masmon-grow/GROW-BASE-PLAN.md
//   保存は新しいキー mh_assistant_masmon_grow_v1 だけ(mh_assistant_life_masmon_v1 は読むだけ・書き換えない)。公開の印 RELEASE_FLAGS.assistantMasmonGrow が真のときだけ動く
//   同じ種(ブリーダーの種・助手・枠:種類・回)なら同じ結果になる(第④段階でサーバが確かめられる形)
const ASSISTANT_MASMON_GROW_KEY = 'mh_assistant_masmon_grow_v1';
const AMG_STATS = Object.freeze([['life', 'ライフ'], ['pow', 'ちから'], ['wise', 'かしこさ'], ['hit', '命中'], ['eva', '回避'], ['tough', '丈夫さ']]);
const AMG_KEYS = AMG_STATS.map(x => x[0]);
const AMG_MAX = 999; // 仕様書 §2 の仮案
// 種族ごとの適性(ライフ・ちから・かしこさ・命中・回避・丈夫さ の順に A〜E)。案: docs/progress/assistant-peer/masmon-grow/aptitude-draft.jpg(社長が見て決める)
// 種族ごとの伸びやすさ(ライフ・ちから・かしこさ・命中・回避・丈夫さ の順に A〜E)と初めの値。2026-11-11 社長「モンスターファームを参考に」:
//   モンスターファーム2の種族ランクと純血の初期値(appmedia.jp の MF2 攻略 wiki の種族ページ)。◇=近い血統の値・※=モンヒロ独自(MF2 に無い)・★=オリジナルの独自の素質(剣士モッチー・パンドラ・エイキ。社長 11-11)。表は docs/progress/assistant-peer/masmon-grow/aptitude-mf2.json
const AMG_APT = Object.freeze({
  Mocchi: 'CCCBBB',
  Suezo: 'DCABDD',
  Golem: 'CACEEA',
  Tiger: 'DDBABE',
  Ham: 'CAECAE',
  Pixie: 'EDABBE',
  Mia: 'DCABBE',
  Pandora: 'DBABCC',
  Monol: 'DCCDEA',
  Oboro: 'BECCDD',
  Plant: 'AECCDE',
  Zan: 'EBEAAE',
  Eiki: 'DACBAE',
  KenshiMocchi: 'CAEABD',
  Mitarashi: 'CBBBCB',
  Ark: 'CCCDCB',
  Iblis: 'DCCDCC',
  Snegurochka: 'CEBABD',
  Undine: 'CEBABD',
  Yaobikuni: 'CEBABD',
  Yggdrasil: 'AECDEA',
  MelWhip: 'ADCCEA',
  Melody: 'AECBEA',
  Kuromy: 'BACBDB',
  Ghost: 'EEBBBE',
  Spooky: 'EEBBBE',
  Illumine: 'EEBCAE',
  Dreamy: 'DEBCAD',
  Kyubi: 'CCAACD',
  Orihime: 'CDAACC',
});
const AMG_INIT = Object.freeze({
  Mocchi: [110, 100, 120, 140, 150, 130],
  Suezo: [80, 120, 170, 130, 90, 100],
  Golem: [100, 220, 110, 70, 60, 160],
  Tiger: [80, 90, 130, 160, 140, 70],
  Ham: [50, 130, 70, 100, 140, 40],
  Pixie: [50, 80, 170, 150, 140, 60],
  Mia: [94, 104, 204, 124, 94, 94],
  Pandora: [85, 135, 160, 135, 110, 110],
  Monol: [110, 130, 140, 100, 10, 220],
  Oboro: [140, 50, 120, 110, 100, 80],
  Plant: [160, 40, 120, 110, 100, 70],
  Zan: [60, 135, 60, 160, 160, 60],
  Eiki: [85, 160, 110, 135, 160, 60],
  KenshiMocchi: [110, 160, 60, 160, 135, 85],
  Mitarashi: [100, 110, 140, 150, 120, 160],
  Ark: [110, 110, 110, 85, 110, 135],
  Iblis: [85, 110, 110, 85, 110, 110],
  Snegurochka: [50, 10, 150, 110, 100, 60],
  Undine: [50, 10, 150, 110, 100, 60],
  Yaobikuni: [50, 10, 150, 110, 100, 60],
  Yggdrasil: [160, 60, 110, 85, 60, 160],
  MelWhip: [160, 85, 110, 110, 60, 160],
  Melody: [160, 60, 110, 135, 60, 160],
  Kuromy: [135, 160, 110, 135, 85, 135],
  Ghost: [100, 90, 120, 140, 150, 80],
  Spooky: [100, 90, 120, 140, 150, 80],
  Illumine: [60, 60, 135, 110, 160, 60],
  Dreamy: [85, 60, 135, 110, 160, 85],
  Kyubi: [110, 110, 160, 160, 110, 85],
  Orihime: [110, 85, 160, 160, 110, 110],
});
const AMG_APT_MULT = Object.freeze({ A: 1.3, B: 1.15, C: 1, D: 0.85, E: 0.7 });
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
const AMG_DAY_CAP = 15; // 1体1日の伸びの合計の上限(仕様書 §8。仮。11-11 試算で 40 では30日で上限近くまで届いたので下げた)
// 関わるほど強くなる(2026-11-11 社長「人が手を加えれば加えるほど強くなる。何もしていない人より強くなるように」)。数字はここだけ
const AMG_CARE = Object.freeze({
  viewCap: 20, viewMult: 1.1, // その日にプレイヤーが様子を見に来たマスモン: 1日の上限 15→20・伸び 1.1倍
  pickMult: 1.3, pickFail: 0.5, picksPerDay: 3, // 自分で訓練を指定した回: 伸び 1.3倍・失敗しにくい(半分)。指定は助手1人につき1日3回まで
  askMult: 1.1, // 相談(鍛えて)で頼んだ能力を伸ばした回: 1.1倍
  ranchMult: 1.2, // M/B管理に助手がいるあいだにプレイヤーがトレーニングした(ナカヨシ9の受け口・1日1回): 次の回の伸び 1.2倍(2026-11-11 社長)
});
const AMG_LV_MAX = 99; // Lv は育成の経験(訓練で上がる・社長 11-11)
const amgLvNeed = (lv) => 10 + lv; // 次の Lv までの経験
const AMG_XP = Object.freeze({ light: 1, heavy: 2, real: 3, joint: 2, focus: 2, weak: 2, rest: 0, play: 0 });
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
  const out = { v: 1, mons: {}, done: {}, focus: {}, rest: {}, care: {}, plan: {}, boost: {} };
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
        .map(x => ({ s: x.s, a: x.a.slice(0, 12), k: AMG_KEYS.includes(x.k) ? x.k : '', g: Object.fromEntries(Object.entries(x.g && typeof x.g === 'object' ? x.g : {}).filter(([k, n]) => AMG_KEYS.includes(k) && Number.isFinite(n)).map(([k, n]) => [k, amgClamp(Math.round(n), -99, 99)])), ...(x.f ? { f: 1 } : {}), ...(x.p ? { p: 1 } : {}), ...(x.r ? { r: 1 } : {}) }));
      one[key] = { st, fat: amgNum(e.fat, 0, 0, 100), str: amgNum(e.str, 0, 0, 100), ind, log, src: 'init_v1', dg: { d: amgNum(e.dg && e.dg.d, 0, 0, 1e7), n: amgNum(e.dg && e.dg.n, 0, 0, 999) }, lv: amgNum(e.lv, 1, 1, AMG_LV_MAX), xp: amgNum(e.xp, 0, 0, 9999) };
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
  // 関わり: { [助手]: { d: 日, view: { [枠]: true }, picks: その日に指定した回数 } }/指定した訓練: { [助手]: { [枠]: { s: 回, a, k } } }
  if (raw.care && typeof raw.care === 'object') for (const [aid, c] of Object.entries(raw.care)) {
    if (!okAid(aid) || !c || typeof c !== 'object') continue;
    const view = {}; for (const [sl, x] of Object.entries(c.view && typeof c.view === 'object' ? c.view : {})) { const n = Number(sl); if (Number.isInteger(n) && n >= 1 && n <= 8 && x === true) view[n] = true; }
    out.care[aid] = { d: amgNum(c.d, 0, 0, 1e7), view, picks: amgNum(c.picks, 0, 0, 99) };
  }
  const ACTS = ['light', 'heavy', 'real', 'joint', 'focus', 'weak', 'rest', 'play'];
  if (raw.plan && typeof raw.plan === 'object') for (const [aid, p] of Object.entries(raw.plan)) {
    if (!okAid(aid) || !p || typeof p !== 'object') continue;
    const o = {}; for (const [sl, x] of Object.entries(p)) { const n = Number(sl); if (Number.isInteger(n) && n >= 1 && n <= 8 && x && Number.isInteger(x.s) && ACTS.includes(x.a) && (!x.k || AMG_KEYS.includes(x.k))) o[n] = { s: x.s, a: x.a, k: x.k || '' }; }
    out.plan[aid] = o;
  }
  if (raw.boost && typeof raw.boost === 'object') for (const [aid, b] of Object.entries(raw.boost)) if (okAid(aid) && b && Number.isInteger(b.d) && Number.isInteger(b.s)) out.boost[aid] = { d: b.d, s: b.s };
  return out;
};
// 初めの値(一度だけ・2026-11-11 社長「初期ステータスも独自に。モンスターファームを参考に」): 種族の初期値(AMG_INIT)に、小さな個体差と Lv の上乗せ
const AMG_INIT_VAR = 0.1; // 個体差(±10%)
const AMG_INIT_LV_BONUS = 3; // 今の Lv × 3 を、育成方針(型)の能力だけに上乗せ(社長 11-11 案C。Lv25 なら +75)。0 にすれば上乗せなし
const AMG_INIT_FLOOR = 50; // 初めの値の下限(MF2 は 10 などの低い値もある。社長 11-11「下限を50にする」)
const amgInitial = (row, rnd) => {
  const base = AMG_INIT[row.monster] || [110, 110, 110, 110, 110, 110]; const lv = Number.isFinite(row.lv) ? row.lv : 10;
  const pol = AMG_POLICY[String(row.grow || '').split('(')[0]] || [];
  const st = {}; AMG_KEYS.forEach((k, i) => { st[k] = amgClamp(Math.round(base[i] * (1 + (rnd() - 0.5) * 2 * AMG_INIT_VAR) + (pol.includes(k) ? lv * AMG_INIT_LV_BONUS : 0)), Math.max(1, AMG_INIT_FLOOR), AMG_MAX); });
  const ind = {}; for (const k of AMG_KEYS) { const r = rnd(); ind[k] = r < 0.2 ? -1 : r > 0.8 ? 1 : 0; } // 伸びの個体差(迎えたとき1回だけ・仕様書 §3)
  return { st, fat: 0, str: 0, ind, log: [], src: 'init_v1', dg: { d: 0, n: 0 }, lv: amgClamp(Math.round(lv), 1, AMG_LV_MAX), xp: 0 };
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
const amgDo = (aid, e, row, rnd, slot, act, care = {}) => {
  const apt = amgAptOf(row.monster); const g = {}; let fail = false;
  const day = amgSlotDay(slot);
  const cap = care.viewed ? AMG_CARE.viewCap : AMG_DAY_CAP;
  const mult = (care.viewed ? AMG_CARE.viewMult : 1) * (act.picked ? AMG_CARE.pickMult : 1) * (act.asked ? AMG_CARE.askMult : 1) * (care.ranch ? AMG_CARE.ranchMult : 1);
  const left = () => Math.max(0, cap - (e.dg.d === day ? e.dg.n : 0));
  const add = (k, lo, hi) => {
    const base = amgRange(rnd, lo, hi) * AMG_APT_MULT[apt[k]] * (1 + 0.1 * (e.ind[k] || 0)) * (e.fat >= 50 ? 0.7 : 1) * (fail ? 0.5 : 1) * mult;
    const n = Math.min(Math.max(1, Math.round(base)), left(), AMG_MAX - e.st[k]);
    if (n <= 0) return;
    e.st[k] += n; g[k] = (g[k] || 0) + n; e.dg = { d: day, n: (e.dg.d === day ? e.dg.n : 0) + n };
  };
  const failChance = (extra) => Math.min(0.4, e.str / 200 + extra) * (act.picked ? AMG_CARE.pickFail : 1);
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
  // 経験と Lv(訓練をすると上がる)
  e.xp = (e.xp || 0) + (AMG_XP[act.a] || 0); e.lv = e.lv || 1;
  while (e.lv < AMG_LV_MAX && e.xp >= amgLvNeed(e.lv)) { e.xp -= amgLvNeed(e.lv); e.lv += 1; }
  e.log = [...e.log, { s: slot, a: act.a, k: act.k || '', g, ...(fail ? { f: 1 } : {}), ...(act.picked ? { p: 1 } : {}), ...(care.ranch ? { r: 1 } : {}) }].slice(-AMG_LOG);
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
  const focus = { ...(state.focus[aid] || {}) }; const rest = { ...(state.rest[aid] || {}) }; const plan = { ...(state.plan[aid] || {}) };
  const care = state.care[aid] || { d: -1, view: {}, picks: 0 };
  for (let s = from; s <= nowSlot; s++) {
    for (const row of rows) {
      const key = amgMonKey(row.slot, row.monster); const e0 = mons[key]; if (!e0) continue;
      const e = { ...e0, st: { ...e0.st }, dg: { ...e0.dg } };
      const rnd = assistantMasmonRng(`${seed}|${aid}|grow|${key}|${s}`);
      const f = focus[row.slot] && focus[row.slot].until >= s ? focus[row.slot].k : '';
      const pl = plan[row.slot] && plan[row.slot].s === s ? plan[row.slot] : null;
      const act = pl ? { a: pl.a, k: pl.k, picked: true } : amgChoose(aid, e, row, rnd, f, !!rest[row.slot]);
      if (!pl && f && act.k === f) act.asked = true;
      if (rest[row.slot]) delete rest[row.slot];
      if (plan[row.slot] && plan[row.slot].s <= s) delete plan[row.slot];
      mons[key] = amgDo(aid, e, row, rnd, s, act, { viewed: care.d === amgSlotDay(s) && !!care.view[row.slot], ranch: !!(state.boost[aid] && state.boost[aid].s === s) });
    }
    changed = true;
  }
  if (!changed && state.done[aid] === nowSlot) return state;
  return { ...state, mons: { ...state.mons, [aid]: mons }, done: { ...state.done, [aid]: Math.max(nowSlot, state.done[aid] || 0) }, focus: { ...state.focus, [aid]: focus }, rest: { ...state.rest, [aid]: rest }, plan: { ...state.plan, [aid]: plan } };
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
// 様子を見に来た(くわしい画面を開いた)。その日のそのマスモンは、上限と伸びが上がる
const amgView = (aid, slot, now = Date.now()) => {
  const st = AMG_STORE.state; const d = amgSlotDay(amgSlotOf(now));
  const c = st.care[aid] && st.care[aid].d === d ? st.care[aid] : { d, view: {}, picks: 0 };
  if (c.view[slot]) return false;
  amgSave({ ...st, care: { ...st.care, [aid]: { ...c, view: { ...c.view, [slot]: true } } } });
  return true;
};
const amgPicksLeft = (aid, now = Date.now(), st = AMG_STORE.state) => { const d = amgSlotDay(amgSlotOf(now)); const c = st.care[aid]; return AMG_CARE.picksPerDay - (c && c.d === d ? c.picks : 0); };
// 次の回の訓練を自分で決める(社長 11-11「自分で指定も出来るし任せる事もできる」)。act = { a: 'light'|'heavy'|'rest'|'play', k }
const amgPick = (aid, slot, act, now = Date.now()) => {
  const st = AMG_STORE.state; const s = amgSlotOf(now) + 1; const d = amgSlotDay(amgSlotOf(now));
  if (!act || !['light', 'heavy', 'rest', 'play'].includes(act.a) || ((act.a === 'light' || act.a === 'heavy') && !AMG_KEYS.includes(act.k))) return false;
  const e = (st.mons[aid] || {})[Object.keys(st.mons[aid] || {}).find(k => k.startsWith(`${slot}:`)) || ''];
  if (e && act.k && e.st[act.k] >= AMG_MAX) return false; // 上限に届いた能力は指定しない
  const had = st.plan[aid] && st.plan[aid][slot] && st.plan[aid][slot].s === s;
  if (!had && amgPicksLeft(aid, now) <= 0) return false;
  const c = st.care[aid] && st.care[aid].d === d ? st.care[aid] : { d, view: {}, picks: 0 };
  amgSave({ ...st, plan: { ...st.plan, [aid]: { ...(st.plan[aid] || {}), [slot]: { s, a: act.a, k: act.k || '' } } }, care: { ...st.care, [aid]: { ...c, picks: c.picks + (had ? 0 : 1) } } });
  return true;
};
// 外から呼ぶ受け口(ナカヨシ9・2026-11-11 社長): M/B管理(ranch)に助手がいるあいだにプレイヤーがトレーニングした。
//   その日1回だけ受け付け、その助手のマスモン全員の「次の育成の回」の伸びを AMG_CARE.ranchMult 倍にする。受け付けたら true(もう受けた日・印が偽なら false)
const assistantMasmonTrainBoost = (aid, opts = {}, now = Date.now()) => {
  if (!amgOn() || typeof aid !== 'string' || !/^[a-z]{2,12}$/.test(aid) || (opts && opts.source && opts.source !== 'ranch')) return false;
  const st = AMG_STORE.state; const s = amgSlotOf(now); const d = amgSlotDay(s);
  if (st.boost[aid] && st.boost[aid].d === d) return false;
  amgSave({ ...st, boost: { ...st.boost, [aid]: { d, s: s + 1 } } });
  return true;
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
// ---------- 画面(公開の印が真のときだけ出す) ----------
const useAmgState = () => {
  const [st, setSt] = React.useState(AMG_STORE.state);
  React.useEffect(() => { AMG_STORE.subs.add(setSt); return () => { AMG_STORE.subs.delete(setSt); }; }, []);
  return st;
};
function AmgStatBars({ e, small = false, cols = 2 }) {
  return (
    <div className={`grid gap-x-3 ${small ? 'gap-y-0.5' : 'gap-y-1'} ${cols === 1 ? 'grid-cols-1' : 'grid-cols-2'}`} data-amg-stats>
      {AMG_STATS.map(([k, label]) => (
        <div key={k} className={`flex items-center gap-1.5 font-bold ${small ? 'text-[9.5px] text-slate-300' : 'text-[10.5px] text-slate-200'}`}>
          <span className={`${small ? 'w-[40px]' : 'w-[48px]'} shrink-0 whitespace-nowrap`}>{label}</span>
          <span className="mhm-bar"><i style={{ width: `${Math.round(e.st[k] / AMG_MAX * 100)}%` }}/></span>
          {!small && <b className="w-[28px] shrink-0 text-right text-amber-200" data-amg-stat={k}>{e.st[k]}</b>}
        </div>))}
    </div>);
}
// くわしい画面の能力の札(6能力・疲労・ストレス・今日の育成)
// 次の回の訓練を自分で決める欄(社長 11-11「自分で指定も出来るし任せる事もできる」)
const AMG_PICK_OPTIONS = Object.freeze([
  ...AMG_KEYS.map(k => ({ v: `light:${k}`, label: `軽トレ ${AMG_LIGHT[k]}(${(AMG_STATS.find(x => x[0] === k) || [])[1]})` })),
  ...AMG_KEYS.map(k => ({ v: `heavy:${k}`, label: `重トレ ${AMG_HEAVY[k]}(${(AMG_STATS.find(x => x[0] === k) || [])[1]})` })),
  { v: 'rest:', label: '休養' }, { v: 'play:', label: '遊び' },
]);
function AmgPickRow({ who, t, e, st }) {
  const next = amgSlotOf() + 1;
  const pl = st.plan[who.id] && st.plan[who.id][t.slot] && st.plan[who.id][t.slot].s === next ? st.plan[who.id][t.slot] : null;
  const [v, setV] = React.useState(pl ? `${pl.a}:${pl.k}` : `light:${AMG_KEYS.reduce((a, b) => (e.st[b] < e.st[a] ? b : a))}`);
  const left = amgPicksLeft(who.id, Date.now(), st);
  const pick = () => { const [a, k] = v.split(':'); amgPick(who.id, t.slot, { a, k }); };
  const auto = () => { const p = { ...(st.plan[who.id] || {}) }; delete p[t.slot]; amgSave({ ...st, plan: { ...st.plan, [who.id]: p } }); };
  return (
    <div className="mt-1.5 rounded-xl border border-white/10 p-2" data-amg-pick>
      <p className="text-[10px] font-black text-slate-400">🗓 次の回({AMG_PERIOD_NAME[next % 3]})の育成 ・ 自分で決める(今日あと{Math.max(0, left)}回)か、{who.name}に任せる</p>
      {pl ? <p className="mt-0.5 text-[11px] font-bold text-sky-200" data-amg-pick-now>あなたが決めた: {amgActName(pl)}(よく伸びて、失敗しにくい) <button type="button" className="ml-1 underline" onClick={auto} data-amg-pick-auto>{who.name}に任せる</button></p>
        : <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <select className="min-w-0 flex-1 rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-bold text-white" value={v} onChange={(ev) => setV(ev.target.value)} data-amg-pick-select>
            {AMG_PICK_OPTIONS.map(o => <option key={o.v} value={o.v} disabled={!!o.v.split(':')[1] && e.st[o.v.split(':')[1]] >= AMG_MAX}>{o.label}</option>)}
          </select>
          <button type="button" className="mhl-btn px-3 text-[11px]" disabled={left <= 0} onClick={pick} data-amg-pick-go>決める</button>
        </div>}
    </div>);
}
function AmgGrowCard({ who, t, e, kindText = '', growMine = null }) {
  const amgSt = useAmgState();
  React.useEffect(() => { if (amgOn()) amgView(who.id, t.slot); }, [who.id, t.slot]); // 様子を見に来た(その日は伸びやすい)
  const today = amgSlotDay(amgSlotOf());
  const logs = e.log.filter(x => amgSlotDay(x.s) === today);
  const T = AMG_TRAIT[who.id] || null;
  return (
    <div className="mhm-card" data-assistant-masmon-detail-stats data-amg-card>
      <p className="text-[10px] font-black text-slate-400">能力(6つ・上限{AMG_MAX})</p>
      <div className="mt-1"><AmgStatBars e={e}/></div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3">
        <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-200"><span className="w-[48px] shrink-0">疲労</span><span className="mhm-bar"><i style={{ width: `${e.fat}%`, background: 'linear-gradient(90deg,#fb7185,#f97316)' }}/></span><b className="w-[24px] text-right text-amber-200" data-amg-fat>{e.fat}</b></div>
        <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-200"><span className="w-[48px] shrink-0">ストレス</span><span className="mhm-bar"><i style={{ width: `${e.str}%`, background: 'linear-gradient(90deg,#60a5fa,#a78bfa)' }}/></span><b className="w-[24px] text-right text-amber-200" data-amg-str>{e.str}</b></div>
      </div>
      <p className="mt-1.5 text-[11px] font-bold text-amber-200">📈 育成方針: {t.grow} ・ 育成 Lv.{e.lv}<small className="ml-1 text-[9.5px] text-slate-400">(次まで {amgLvNeed(e.lv) - e.xp})</small></p>
      {growMine && <p className="text-[10.5px] font-bold text-sky-200" data-assistant-masmon-grow-mine>🌱 育て方: {growMine.kind}({growMine.day ? `${growMine.day.slice(5).replace('-', '/')} ` : ''}あなたの提案)</p>}
      {kindText && <p className="text-[10.5px] font-bold text-slate-300">{kindText}</p>}
      <p className="mt-1.5 text-[10px] font-black text-slate-400">今日の育成({who.name}{T ? `・${T.name}` : ''})</p>
      {logs.length ? logs.map(x => (
        <p key={x.s} className="text-[11px] font-bold text-slate-100" data-amg-log={x.a}>{['🌅', '☀', '🌙'][x.s % 3]} {AMG_PERIOD_NAME[x.s % 3]} {amgActName(x)}{x.p ? '(あなたが決めた)' : ''}{x.r ? '(M/B管理でいっしょにトレーニング)' : ''}{x.f ? '(うまくいかなかった)' : ''} {Object.entries(x.g).map(([k, n]) => `${(AMG_STATS.find(s => s[0] === k) || [])[1]} +${n}`).join('・')}{x.a === 'rest' ? '(疲れがとれた)' : x.a === 'play' ? '(気分転換)' : ''}</p>))
        : <p className="text-[10.5px] font-bold text-slate-400">まだ今日の育成はありません(朝4:00・昼12:00・夜18:00に{who.name}が育てます)</p>}
      {(amgSt.care[who.id] && amgSt.care[who.id].d === today && amgSt.care[who.id].view[t.slot]) && <p className="mt-1 text-[10px] font-bold text-pink-200" data-amg-viewed>👀 今日は様子を見に来たので、いつもより伸びやすい</p>}
      <AmgPickRow who={who} t={t} e={e} st={amgSt}/>
    </div>);
}
