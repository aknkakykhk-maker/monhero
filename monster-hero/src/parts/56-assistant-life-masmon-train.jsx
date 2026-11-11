// 助手のマスモンの修行と助手の成長(社長の仕様書 docs/progress/assistant-peer/ASSISTANT-MASMON-AUTOBATTLE-SPEC-v1.md の第②段階・2026-11-11 シュギョウ)
//   修行6系統・技の習得と熟練(技表 monster-hero/data/assistant-masmon-techs.js・モンスターファームのような技)・助手のブリーダー能力・助手からの相談・日常の出来事
//   案は docs/progress/assistant-peer/masmon-train/TRAIN-PLAN.md・社長の答えは台帳 2026-11-11
//   修行は、助手の生活で「モンヒロバトル」にいた回にする(社長「モンバトにいるときにしよう」「MB管理とモンバトは別」。場所は助手ライフ担当ナカヨシ9が生活に足す)
//   保存は新しいキー mh_assistant_masmon_train_v1 だけ(mh_assistant_masmon_grow_v1・mh_assistant_life_masmon_v1 は読むだけ)
//   公開の印 RELEASE_FLAGS.assistantMasmonTrain が偽のあいだは、受け口はすべて「何もしない」を返す(第①段階の結果を1つも変えない)
//   乱数は自分の種(ブリーダーの種・助手・枠:種類・回)から作り、第①段階の乱数の列を引かない(同じ種なら同じ結果)
const ASSISTANT_MASMON_TRAIN_KEY = 'mh_assistant_masmon_train_v1';
// 修行の6系統(仕様書 §6)。stat=少し伸びる能力・aim=磨くもの
const AMGT_KINDS = Object.freeze({
  pow: { name: 'ちから修行', act: '岩割り', stat: 'pow', aim: 'ちから技' },
  wise: { name: 'かしこさ修行', act: '瞑想', stat: 'wise', aim: 'かしこさ技' },
  hit: { name: '命中修行', act: '一点突き', stat: 'hit', aim: '当てにくい技' },
  eva: { name: '回避修行', act: '見切り', stat: 'eva', aim: '間合いの判断' },
  tough: { name: '防御修行', act: '受け止め', stat: 'tough', aim: 'ガード' },
  real: { name: '実戦修行', act: '手合わせ', stat: 'life', aim: '交代の判断と全部の技' },
});
const AMGT_KIND_KEYS = Object.keys(AMGT_KINDS);
// 技のほかに磨くもの(0〜100)。guard=ガード・dist=間合いの判断・swap=交代の判断
const AMGT_SENSE = Object.freeze([['guard', 'ガード'], ['dist', '間合いの判断'], ['swap', '交代の判断']]);
const AMGT_SENSE_KEYS = AMGT_SENSE.map(x => x[0]);
const AMGT_RANKS = Object.freeze([[100, '極み'], [75, '達人'], [50, '得意'], [25, '慣れ'], [0, '見習い']]);
const amgtRankOf = (v) => (AMGT_RANKS.find(r => v >= r[0]) || AMGT_RANKS[AMGT_RANKS.length - 1])[1];
// 数字(社長 11-11: 修行の伸びはふつう)。数字はここだけ
const AMGT_NUM = Object.freeze({
  gain: [4, 8], // 修行1回の熟練(主)
  realAll: [1, 2], // 実戦修行で、覚えている全部の技に足す分
  stat: [2, 4], // 修行1回の能力の伸び(第①段階の1日の上限に入る)
  fat: 12, str: 2, // 疲労・ストレス
  perDay: 2, // 1日の修行の回数の上限(案)
  fatStop: 45, // これ以上疲れていたら修行に行かない(訓練側が休ませる)
  goAt: 0.4, // モンヒロバトルにいた回に修行へ行く起こりやすさに足す分(性格の p に足す)
  initPerLv: 0.3, initMax: 30, // 覚えている技の熟練の初めの値 = 育成 Lv × 0.3(最大30)
  askMult: 1.1, // 相談に答えて頼んだ系統の修行の伸び
});
// 熟練100のときの補正(対戦の中だけ・社長 11-11「中」)。対戦の計算はタタカイの戦闘の芯が持つ。ここは画面の説明用の写し
const AMGT_BONUS = Object.freeze({ hit: 0.06, guts: 0.15, guard: 0.08 });
// 助手のブリーダー能力(仕様書 §7)
const AMGT_BR = Object.freeze([['know', '育成知識'], ['lead', '指導力'], ['obs', '観察力'], ['tac', '戦術力'], ['trust', '信頼構築'], ['exp', '育成経験']]);
const AMGT_BR_KEYS = AMGT_BR.map(x => x[0]);
// 性格の初めの傾向(仕様書 §7 の仮の傾向。並びは AMGT_BR_KEYS)
const AMGT_BR_INIT = Object.freeze({
  mua: [25, 40, 20, 30, 35, 20], // 積極型
  kiki: [40, 25, 40, 35, 20, 20], // 分析型
  momosuke: [30, 25, 40, 20, 40, 20], // 安定型
  dra: [20, 40, 15, 40, 30, 20], // 大胆型
  atsu: [30, 30, 30, 30, 30, 20], // バランス型
  kyuko: [45, 25, 35, 30, 20, 20], // 研究型
  sorashido: [30, 30, 30, 35, 35, 20], // 柔軟型
  erubin: [35, 25, 35, 25, 35, 20], // 防御型
});
// 修行に行きやすさと、好んで選ぶ系統
const AMGT_TRAIT = Object.freeze({
  mua: { p: 0.4, like: ['pow', 'real'] }, kiki: { p: 0.4, like: ['wise', 'eva'] }, momosuke: { p: 0.3, like: ['tough'] },
  dra: { p: 0.45, like: ['pow', 'real'] }, atsu: { p: 0.35, like: [] }, kyuko: { p: 0.5, like: ['wise', 'hit'] },
  sorashido: { p: 0.4, like: ['eva', 'real'] }, erubin: { p: 0.35, like: ['tough', 'eva'] },
});
// ブリーダー能力の効き目(能力100のとき・社長 11-11「大きく」: 伸び×1.20・失敗とストレスの軽減も合わせて)
const AMGT_BR_EFFECT = Object.freeze({ lead: 0.20, know: 0.60, trust: 0.60, obs: 10 });
const AMGT_BR_RANKS = Object.freeze([[80, 'ベテラン'], [60, '一人前'], [40, 'なかなか'], [20, '駆け出し'], [0, 'はじめたて']]);
const amgtBrRankOf = (v) => (AMGT_BR_RANKS.find(r => v >= r[0]) || AMGT_BR_RANKS[AMGT_BR_RANKS.length - 1])[1];
// 行動ごとに経験が入るブリーダー能力
const AMGT_BR_XP = Object.freeze({
  light: ['lead'], heavy: ['lead'], real: ['tac', 'lead'], joint: ['trust', 'lead'], focus: ['lead'], weak: ['know'],
  rest: ['obs'], play: ['obs', 'trust'], shugyo: ['know', 'tac'], fail: ['know'], ask: ['trust'],
});
const AMGT_LOG = 21;
const AMGT_EV = 30;
const AMGT_AT = 12; // モンヒロバトルにいた回の記録の数
const AMGT_PLACE = 'battle'; // 修行する生活の場所の id(ナカヨシ9が ASSISTANT_LIFE_PLACES に足す・言葉は「モンヒロバトル」)
const AMGT_PLACE_NAME = 'モンヒロバトル';
const amgtSlotDay = (slot) => Math.floor(slot / 3);
// 第①段階と同じ回の番号(朝4:00・昼12:00・夜18:00。日本時間)
const amgtSlotOf = (now = Date.now()) => { const t = Number(now) + 9 * 3600000 - 4 * 3600000; const day = Math.floor(t / 86400000); const h = (t - day * 86400000) / 3600000; return day * 3 + (h < 8 ? 0 : h < 14 ? 1 : 2); };
const amgtClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const amgtNum = (v, d, lo, hi) => (Number.isFinite(Number(v)) ? amgtClamp(Math.round(Number(v)), lo, hi) : d);
const amgtOkAid = (aid) => typeof aid === 'string' && /^[a-z]{2,12}$/.test(aid);
const amgtRngOf = (text) => {
  if (typeof assistantMasmonRng === 'function') return assistantMasmonRng(text);
  let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  let x = h >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
};
const amgtRange = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
// 技表
const amgtTechsOf = (monster) => (typeof ASSISTANT_MASMON_TECHS !== 'undefined' && ASSISTANT_MASMON_TECHS.species && Array.isArray(ASSISTANT_MASMON_TECHS.species[monster]) ? ASSISTANT_MASMON_TECHS.species[monster] : []);
const amgtTechIdOk = (id) => typeof id === 'string' && /^[a-z]{2,20}_\d{2}$/.test(id);

const normalizeAssistantMasmonTrain = (raw) => {
  const out = { v: 1, mons: {}, br: {}, ask: {}, ev: {}, at: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  if (raw.mons && typeof raw.mons === 'object') for (const [aid, ms] of Object.entries(raw.mons)) {
    if (!amgtOkAid(aid) || !ms || typeof ms !== 'object') continue;
    const one = {};
    for (const [key, e] of Object.entries(ms).slice(0, 24)) {
      if (!/^[1-8]:\w{2,40}$/.test(key) || !e || typeof e !== 'object' || !e.m || typeof e.m !== 'object') continue;
      const m = {};
      for (const k of AMGT_SENSE_KEYS) m[k] = amgtNum(e.m[k], 0, 0, 100);
      for (const [k, v] of Object.entries(e.m).slice(0, 24)) if (amgtTechIdOk(k)) m[k] = amgtNum(v, 0, 0, 100);
      const learn = [...new Set((Array.isArray(e.learn) ? e.learn : []).filter(amgtTechIdOk))].slice(0, 16);
      const log = (Array.isArray(e.log) ? e.log : []).filter(x => x && typeof x === 'object' && Number.isInteger(x.s) && AMGT_KIND_KEYS.includes(x.k)).slice(-AMGT_LOG)
        .map(x => ({ s: x.s, k: x.k, g: Object.fromEntries(Object.entries(x.g && typeof x.g === 'object' ? x.g : {}).filter(([k, n]) => (AMGT_SENSE_KEYS.includes(k) || amgtTechIdOk(k)) && Number.isFinite(n)).map(([k, n]) => [k, amgtClamp(Math.round(n), 0, 99)])), ...(amgtTechIdOk(x.l) ? { l: x.l } : {}), ...(x.f ? { f: 1 } : {}) }));
      one[key] = { m, learn, day: { d: amgtNum(e.day && e.day.d, -1, -1, 1e7), n: amgtNum(e.day && e.day.n, 0, 0, 9) }, log, src: 'init_v1' };
    }
    out.mons[aid] = one;
  }
  if (raw.br && typeof raw.br === 'object') for (const [aid, b] of Object.entries(raw.br)) {
    if (!amgtOkAid(aid) || !b || typeof b !== 'object' || !b.ab || typeof b.ab !== 'object') continue;
    const ab = {}; const xp = {};
    for (const k of AMGT_BR_KEYS) { ab[k] = amgtNum(b.ab[k], 20, 0, 100); xp[k] = Number.isFinite(Number(b.xp && b.xp[k])) ? amgtClamp(Math.round(Number(b.xp[k]) * 2) / 2, 0, 999) : 0; }
    out.br[aid] = { ab, xp, src: 'init_v1' };
  }
  if (raw.ask && typeof raw.ask === 'object') for (const [aid, a] of Object.entries(raw.ask)) {
    if (!amgtOkAid(aid) || !a || typeof a !== 'object' || !Number.isInteger(a.d)) continue;
    const o = { d: a.d, q: typeof a.q === 'string' ? a.q.slice(0, 12) : '', slot: amgtNum(a.slot, 1, 1, 8) };
    if (typeof a.a === 'string') o.a = a.a.slice(0, 12);
    if (Number.isInteger(a.until)) o.until = a.until;
    out.ask[aid] = o;
  }
  if (raw.ev && typeof raw.ev === 'object') for (const [aid, list] of Object.entries(raw.ev)) {
    if (!amgtOkAid(aid) || !Array.isArray(list)) continue;
    out.ev[aid] = list.filter(x => x && Number.isInteger(x.s) && typeof x.t === 'string').slice(-AMGT_EV).map(x => ({ s: x.s, t: x.t.slice(0, 12), x: typeof x.x === 'string' ? x.x.slice(0, 60) : '' }));
  }
  if (raw.at && typeof raw.at === 'object') for (const [aid, list] of Object.entries(raw.at)) {
    if (!amgtOkAid(aid) || !Array.isArray(list)) continue;
    out.at[aid] = [...new Set(list.filter(n => Number.isInteger(n) && n > 0))].sort((a, b) => a - b).slice(-AMGT_AT);
  }
  return out;
};
// 技を覚える条件を満たすか(st = 第①段階の6能力・me = 修行の入れ物)
const amgtCanLearn = (t, st, me) => {
  if (!t || !t.learn) return false;
  if (t.learn.start) return true;
  for (const [k, v] of Object.entries(t.learn.st || {})) if (!st || !(Number(st[k]) >= v)) return false;
  for (const [id, v] of Object.entries(t.learn.need || {})) if (!me || !me.learn.includes(id) || !((me.m[id] || 0) >= v)) return false;
  return true;
};
// 初めの値(一度だけ): 初めからの技と、いまの能力で条件を満たしている技(先に磨く技の要らないもの)を覚えている。熟練は育成 Lv から
const amgtInitMon = (monster, lv, st) => {
  const base = Math.min(AMGT_NUM.initMax, Math.round((Number.isFinite(lv) ? lv : 1) * AMGT_NUM.initPerLv));
  const learn = amgtTechsOf(monster).filter(t => t.learn && (t.learn.start || (!t.learn.need && amgtCanLearn(t, st, null)))).map(t => t.id);
  const m = {}; for (const k of AMGT_SENSE_KEYS) m[k] = base; for (const id of learn) m[id] = base;
  return { m, learn, day: { d: -1, n: 0 }, log: [], src: 'init_v1' };
};
const amgtInitBreeder = (aid) => {
  const a = AMGT_BR_INIT[aid] || AMGT_BR_INIT.atsu; const ab = {}; const xp = {};
  AMGT_BR_KEYS.forEach((k, i) => { ab[k] = a[i]; xp[k] = 0; });
  return { ab, xp, src: 'init_v1' };
};
// ブリーダー能力に経験を足す(高いほど上がりにくい・苦手も少しずつ伸びる)。天井は 60 + 育成経験×0.4
const amgtBrNeed = (v) => 4 + Math.floor(v / 8);
const amgtBrCap = (br, k) => (k === 'exp' ? 100 : Math.min(100, 60 + Math.floor(br.ab.exp * 0.4)));
const amgtBrGain = (br, kinds, onUp) => {
  for (const k of [...kinds, 'exp']) {
    br.xp[k] = (br.xp[k] || 0) + (k === 'exp' ? 0.5 : 1);
    while (br.ab[k] < amgtBrCap(br, k) && br.xp[k] >= amgtBrNeed(br.ab[k])) {
      br.xp[k] -= amgtBrNeed(br.ab[k]); const before = br.ab[k]; br.ab[k] += 1;
      if (onUp && [40, 60, 80].some(n => before < n && br.ab[k] >= n)) onUp(k, br.ab[k]);
    }
  }
  return br;
};
// 修行の系統を選ぶ(相談の答え → 性格の好み・熟練の低い所・覚えられそうな技)
const amgtPickKind = (aid, me, techs, st, rnd, askK) => {
  if (askK && AMGT_KINDS[askK]) return askK;
  const T = AMGT_TRAIT[aid] || AMGT_TRAIT.atsu;
  const learned = techs.filter(t => me.learn.includes(t.id));
  const lowOf = (k) => {
    if (k === 'eva') return me.m.dist; if (k === 'tough') return me.m.guard; if (k === 'real') return me.m.swap;
    const list = k === 'hit' ? learned : learned.filter(t => t.kind === k);
    return list.length ? Math.min(...list.map(t => me.m[t.id] || 0)) : 100;
  };
  let best = ''; let sc = -1;
  for (const k of AMGT_KIND_KEYS) {
    const canNew = techs.some(t => !me.learn.includes(t.id) && t.learn && t.learn.by === k && amgtCanLearn(t, st, me)) ? 0.9 : 0;
    const s = (T.like.includes(k) ? 0.7 : 0) + (1 - lowOf(k) / 100) * 1.5 + canNew + rnd() * 0.8;
    if (s > sc) { sc = s; best = k; }
  }
  return best;
};

// ---------- 店(保存) ----------
const AMGT_STORE = { state: normalizeAssistantMasmonTrain(null), loaded: false, subs: new Set(), dirty: false,
  set(next) { this.state = next; this.subs.forEach(f => { try { f(next); } catch (_) {} }); },
  async load() {
    if (this.loaded) return this.state;
    let raw = null; try { raw = typeof storeGet === 'function' ? await storeGet(ASSISTANT_MASMON_TRAIN_KEY, null, false) : null; } catch (_) {}
    this.loaded = true; this.set(normalizeAssistantMasmonTrain(raw)); return this.state;
  } };
const amgtOn = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantMasmonTrain === true;
const amgtSave = (next) => {
  AMGT_STORE.set(next);
  if (AMGT_STORE.dirty) return; AMGT_STORE.dirty = true;
  Promise.resolve().then(() => { AMGT_STORE.dirty = false; try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_TRAIN_KEY, AMGT_STORE.state, false); } catch (_) {} });
};
const amgtSeed = () => (typeof ASSISTANT_MASMON_STORE !== 'undefined' && ASSISTANT_MASMON_STORE.state && ASSISTANT_MASMON_STORE.state.seed) || '';
const amgtKeyOf = (row) => `${row.slot}:${row.monster}`;
// 状態を1つ写して、助手・マスモンの入れ物を(無ければ一度だけ)作る
const amgtEnsure = (st, aid, row, e) => {
  const key = amgtKeyOf(row);
  const mons = { ...(st.mons[aid] || {}) };
  const me0 = mons[key] || amgtInitMon(row.monster, e && e.lv, e && e.st);
  const me = { ...me0, m: { ...me0.m }, learn: [...me0.learn], day: { ...me0.day }, log: [...me0.log] };
  mons[key] = me;
  const br0 = st.br[aid] || amgtInitBreeder(aid);
  const br = { ab: { ...br0.ab }, xp: { ...br0.xp }, src: 'init_v1' };
  return { next: { ...st, mons: { ...st.mons, [aid]: mons }, br: { ...st.br, [aid]: br }, ev: { ...st.ev, [aid]: [...(st.ev[aid] || [])] } }, me, br };
};
const amgtPushEv = (next, aid, s, t, x) => { next.ev[aid] = [...next.ev[aid], { s, t, x: String(x || '').slice(0, 60) }].slice(-AMGT_EV); };

// ---------- 修行の場所: 助手の生活でモンヒロバトルにいた回を覚えておく ----------
// 生活の1つの時間(life.abs = 日×6+区切り)が、第①段階のどの回に当たるか(始めと終わり)
const amgtLifeSlotsToGrow = (abs) => {
  const S = typeof ASSISTANT_LIFE_SLOTS !== 'undefined' ? ASSISTANT_LIFE_SLOTS : null;
  if (!S || !Number.isInteger(abs)) return [];
  const day = Math.floor(abs / 6); const s = S[abs - day * 6]; if (!s) return [];
  const t0 = day * 86400000 + s.from * 3600000 - 9 * 3600000; const t1 = day * 86400000 + s.to * 3600000 - 9 * 3600000 - 1;
  return [...new Set([amgtSlotOf(t0), amgtSlotOf(t1)])];
};
// 生活の居場所が決まったときに呼ぶ(助手ライフの受け口 amgtOnLifeSlot・または画面を開いたときに今の生活を読む)
const amgtNoteLife = (life) => {
  if (!amgtOn() || !AMGT_STORE.loaded || !life || !Number.isInteger(life.abs)) return false;
  const ids = [...(life.groups || []).filter(g => g && g.place === AMGT_PLACE).flatMap(g => g.ids || []), ...Object.entries(life.solo || {}).filter(([, s]) => s && s.place === AMGT_PLACE).map(([id]) => id)].filter(amgtOkAid);
  if (!ids.length) return false;
  const slots = amgtLifeSlotsToGrow(life.abs); if (!slots.length) return false;
  const st = AMGT_STORE.state; let changed = false; const at = { ...st.at };
  for (const id of ids) {
    const cur = at[id] || []; const add = slots.filter(n => !cur.includes(n));
    if (add.length) { at[id] = [...cur, ...add].sort((a, b) => a - b).slice(-AMGT_AT); changed = true; }
  }
  if (changed) amgtSave({ ...st, at });
  return changed;
};
const amgtOnLifeSlot = (life) => { try { return amgtNoteLife(life); } catch (_) { return false; } };
const amgtWasAtPlace = (aid, slot, st = AMGT_STORE.state) => {
  if (typeof ASSISTANT_LIFE_STORE !== 'undefined' && ASSISTANT_LIFE_STORE.state && ASSISTANT_LIFE_STORE.state.life) amgtNoteLife(ASSISTANT_LIFE_STORE.state.life);
  return ((AMGT_STORE.state.at || st.at)[aid] || []).includes(slot);
};

// ---------- 第①段階(キズナ4)からの受け口。印が偽なら何もしない ----------
// 1回分の行動を修行にするか。修行なら { a:'shugyo', k:系統 }、しないなら null。第①段階の rnd は引かない
const amgtChoose = (aid, e, row, _rnd, slot) => {
  if (!amgtOn() || !AMGT_STORE.loaded || !row || !e || !Number.isInteger(slot)) return null;
  if (e.fat >= AMGT_NUM.fatStop || e.str >= 50) return null;
  if (!amgtWasAtPlace(aid, slot)) return null;
  const st = AMGT_STORE.state;
  const me = (st.mons[aid] || {})[amgtKeyOf(row)] || amgtInitMon(row.monster, e.lv, e.st);
  const day = amgtSlotDay(slot);
  if (me.day.d === day && me.day.n >= AMGT_NUM.perDay) return null;
  const rnd = amgtRngOf(`${amgtSeed()}|${aid}|shugyo-pick|${amgtKeyOf(row)}|${slot}`);
  const ask = st.ask[aid];
  const askK = ask && ask.q === 'next' && ask.a && ask.slot === row.slot && Number.isInteger(ask.until) && ask.until >= slot ? ask.a : '';
  const T = AMGT_TRAIT[aid] || AMGT_TRAIT.atsu;
  if (!askK && rnd() >= T.p + AMGT_NUM.goAt) return null;
  return { a: 'shugyo', k: amgtPickKind(aid, me, amgtTechsOf(row.monster), e.st, rnd, askK), asked: !!askK };
};
// 修行を当てる。add(k, lo, hi) は第①段階の伸び(1日の上限・適性・個体差・関わり込み)。failChance(extra) は第①段階の失敗の起きやすさ
const amgtDo = (aid, e, row, _rnd, slot, act, add, failChance) => {
  if (!amgtOn() || !act || !AMGT_KINDS[act.k]) return e;
  const K = AMGT_KINDS[act.k];
  const rnd = amgtRngOf(`${amgtSeed()}|${aid}|shugyo|${amgtKeyOf(row)}|${slot}`);
  const { next, me, br } = amgtEnsure(AMGT_STORE.state, aid, row, e);
  const techs = amgtTechsOf(row.monster);
  const fail = rnd() < (typeof failChance === 'function' ? failChance(0.03) : 0.05) * amgtFailMult(aid);
  const lead = 1 + br.ab.lead / 100 * AMGT_BR_EFFECT.lead;
  const ask = act.asked ? AMGT_NUM.askMult : 1;
  const g = {};
  const nameOf = (k) => (AMGT_SENSE.find(x => x[0] === k) || [])[1] || (techs.find(t => t.id === k) || {}).name || '';
  const up = (k, lo, hi) => {
    const cur = me.m[k] || 0;
    const n = Math.min(100 - cur, Math.max(1, Math.round(amgtRange(rnd, lo, hi) * lead * ask * (fail ? 0.5 : 1))));
    if (n > 0) { me.m[k] = cur + n; g[k] = (g[k] || 0) + n; if (amgtRankOf(cur) !== amgtRankOf(me.m[k])) amgtPushEv(next, aid, slot, 'rank', `${amgtKeyOf(row)}|${nameOf(k)}|${amgtRankOf(me.m[k])}`); }
  };
  // 1) 技を覚える(この系統で覚える技のうち、条件を満たした最初の1つ・失敗した回は覚えない)
  let learned = '';
  if (!fail) {
    const t = techs.find(x => !me.learn.includes(x.id) && x.learn && x.learn.by === act.k && amgtCanLearn(x, e.st, me));
    if (t) { me.learn = [...me.learn, t.id]; me.m[t.id] = me.m[t.id] || 0; learned = t.id; amgtPushEv(next, aid, slot, 'learn', `${amgtKeyOf(row)}|${t.name}`); }
  }
  // 2) 熟練を磨く
  const known = techs.filter(t => me.learn.includes(t.id));
  const lowest = (list) => list.slice().sort((a, b) => (me.m[a.id] || 0) - (me.m[b.id] || 0) || a.id.localeCompare(b.id))[0];
  let main = '';
  if (act.k === 'eva') main = 'dist'; else if (act.k === 'tough') main = 'guard'; else if (act.k === 'real') main = 'swap';
  else if (learned) main = learned;
  else {
    const pool = act.k === 'hit' ? known.slice().sort((a, b) => a.hit - b.hit).slice(0, 2) : known.filter(t => t.kind === act.k);
    const t = lowest(pool.length ? pool : known); main = t ? t.id : 'swap';
  }
  up(main, AMGT_NUM.gain[0], AMGT_NUM.gain[1]);
  if (act.k === 'real') for (const t of known) up(t.id, AMGT_NUM.realAll[0], AMGT_NUM.realAll[1]);
  if (typeof add === 'function') add(K.stat, AMGT_NUM.stat[0], AMGT_NUM.stat[1]);
  e.fat = amgtClamp(e.fat + AMGT_NUM.fat, 0, 100);
  e.str = amgtClamp(e.str + Math.round((AMGT_NUM.str + (fail ? 5 : 0)) * amgtStressMult(aid)), 0, 100);
  const day = amgtSlotDay(slot);
  me.day = { d: day, n: (me.day.d === day ? me.day.n : 0) + 1 };
  me.log = [...me.log, { s: slot, k: act.k, g, ...(learned ? { l: learned } : {}), ...(fail ? { f: 1 } : {}) }].slice(-AMGT_LOG);
  amgtPushEv(next, aid, slot, 'shugyo', `${amgtKeyOf(row)}|${act.k}`);
  amgtBrGain(br, AMGT_BR_XP.shugyo.concat(fail ? AMGT_BR_XP.fail : []), (k, v) => amgtPushEv(next, aid, slot, 'breeder', `${k}|${v}`));
  amgtSave(next);
  e.shugyo = { k: act.k, g, ...(learned ? { l: learned } : {}), ...(fail ? { f: 1 } : {}) };
  return e;
};
// 訓練・休養などのあと(修行以外)。ブリーダー能力に経験
const amgtAfterAct = (aid, act, failed, slot) => {
  if (!amgtOn() || !AMGT_STORE.loaded || !act || act.a === 'shugyo' || !amgtOkAid(aid)) return;
  const st = AMGT_STORE.state; const br0 = st.br[aid] || amgtInitBreeder(aid);
  const br = { ab: { ...br0.ab }, xp: { ...br0.xp }, src: 'init_v1' };
  const next = { ...st, br: { ...st.br, [aid]: br }, ev: { ...st.ev, [aid]: [...(st.ev[aid] || [])] } };
  amgtBrGain(br, (AMGT_BR_XP[act.a] || []).concat(failed ? AMGT_BR_XP.fail : []), (k, v) => amgtPushEv(next, aid, Number.isInteger(slot) ? slot : 0, 'breeder', `${k}|${v}`));
  amgtSave(next);
};
const amgtBr = (aid) => (AMGT_STORE.state.br[aid] || amgtInitBreeder(aid)).ab;
// 掛け算(印が偽なら全部 1)
const amgtLeadMult = (aid) => (amgtOn() ? 1 + amgtBr(aid).lead / 100 * AMGT_BR_EFFECT.lead : 1);
const amgtFailMult = (aid) => (amgtOn() ? 1 - amgtBr(aid).know / 100 * AMGT_BR_EFFECT.know : 1);
const amgtStressMult = (aid) => (amgtOn() ? 1 - amgtBr(aid).trust / 100 * AMGT_BR_EFFECT.trust : 1);
// 観察力: 休ませる疲労の目安を、ちょうどよい所(55)へ寄せる(観察力100で最大10寄る)
const amgtRestAt = (aid, base) => {
  if (!amgtOn() || !Number.isFinite(base)) return base;
  const pull = Math.round(amgtBr(aid).obs / 100 * AMGT_BR_EFFECT.obs);
  return base > 55 ? Math.max(55, base - pull) : Math.min(55, base + pull);
};
const amgtActName = (x) => (x && x.a === 'shugyo' && AMGT_KINDS[x.k] ? `${AMGT_PLACE_NAME}で${AMGT_KINDS[x.k].act}(${AMGT_KINDS[x.k].name})` : '');

// ---------- 第③段階(タタカイ)へ渡すもの ----------
const amgtEntryOf = (aid, t, st = AMGT_STORE.state) => (t && st.mons[aid] ? st.mons[aid][amgtKeyOf(t)] : null) || null;
// 1体: { techs:[覚えた技の id], mastery:{ [技id]・guard・dist・swap: 0〜100 } }。入れ物が無ければ初めの値(初めからの技だけ)
const amgtBattleOf = (aid, t, lv, st = AMGT_STORE.state) => {
  const me = amgtEntryOf(aid, t, st) || amgtInitMon(t && t.monster, lv, null);
  return { techs: [...me.learn], mastery: { ...me.m } };
};
// チームの戦術経験 = ブリーダーの戦術力×0.8 + 出るマスモンの間合い・交代の判断の平均×0.2
const amgtTacticsOf = (aid, rows, st = AMGT_STORE.state) => {
  const br = (st.br[aid] || amgtInitBreeder(aid)).ab;
  const list = (Array.isArray(rows) ? rows : []).map(t => amgtEntryOf(aid, t, st)).filter(Boolean);
  const avg = list.length ? list.reduce((a, me) => a + (me.m.dist + me.m.swap) / 2, 0) / list.length : 0;
  return amgtClamp(Math.round(br.tac * 0.8 + avg * 0.2), 0, 100);
};

// ---------- 助手からの相談(1日1回まで) ----------
// その日の相談を決める(同じ日・同じ種なら同じ相談)。rows=いまのマスモン・growOf=第①段階の入れ物を引く関数
const amgtAskOf = (aid, rows, day, growOf, st = AMGT_STORE.state) => {
  if (!Array.isArray(rows) || !rows.length) return null;
  const done = st.ask[aid] && st.ask[aid].d === day ? st.ask[aid] : null;
  const rnd = amgtRngOf(`${amgtSeed()}|${aid}|shugyo-ask|${day}`);
  const t = rows[Math.floor(rnd() * rows.length)];
  const g = typeof growOf === 'function' ? growOf(t) : null;
  const me = amgtEntryOf(aid, t, st) || amgtInitMon(t.monster, g ? g.lv : t.lv, g ? g.st : null);
  const techs = amgtTechsOf(t.monster);
  const near = techs.find(x => !me.learn.includes(x.id) && x.learn && !x.learn.start && amgtCanLearn(x, g ? g.st : null, me));
  let q = 'next';
  if (g && g.fat >= 50) q = 'rest';
  else if (near && rnd() < 0.6) q = 'learn';
  const opts = q === 'rest' ? ['rest', 'more']
    : q === 'learn' ? [near.learn.by, near.learn.by === 'real' ? 'hit' : 'real']
      : AMGT_KIND_KEYS.map(k => [k, rnd()]).sort((a, b) => a[1] - b[1]).slice(0, 3).map(x => x[0]);
  return { q, slot: t.slot, row: t, opts, tech: near ? near.name : '', answered: done ? done.a : '' };
};
// 相談に答える。修行の系統なら3日間(9回)その系統を優先・その修行は ×1.1。「休ませて」は第①段階の相談へ渡す
const amgtAnswer = (aid, ask, choice, nowSlot) => {
  if (!amgtOn() || !ask || !ask.opts.includes(choice) || !Number.isInteger(nowSlot)) return false;
  const day = amgtSlotDay(nowSlot);
  const st = AMGT_STORE.state;
  if (st.ask[aid] && st.ask[aid].d === day && st.ask[aid].a) return false;
  const br0 = st.br[aid] || amgtInitBreeder(aid);
  const br = { ab: { ...br0.ab }, xp: { ...br0.xp }, src: 'init_v1' };
  const next = { ...st, br: { ...st.br, [aid]: br }, ev: { ...st.ev, [aid]: [...(st.ev[aid] || [])] } };
  const kind = AMGT_KINDS[choice] ? choice : '';
  next.ask = { ...st.ask, [aid]: { d: day, q: kind ? 'next' : ask.q, slot: ask.slot, a: choice, ...(kind ? { until: nowSlot + 9 } : {}) } };
  if (choice === 'rest' && typeof amgAdvise === 'function') amgAdvise(aid, ask.slot, 'rest');
  amgtPushEv(next, aid, nowSlot, 'ask', `${ask.slot}|${choice}`);
  amgtBrGain(br, AMGT_BR_XP.ask, (k, v) => amgtPushEv(next, aid, nowSlot, 'breeder', `${k}|${v}`));
  amgtSave(next);
  return true;
};

// 部屋の「🐾 ◯◯のマスモン」の行に出す一言(助手ライフ担当ナカヨシ9が行に載せる)。印が偽・何も無いときは null
//   いまモンヒロバトルにいる → 修行中/今日の相談にまだ答えていない → 相談/今日修行した → 回数
const amgtRoomLine = (aid, now = Date.now()) => {
  if (!amgtOn() || !AMGT_STORE.loaded || !amgtOkAid(aid)) return null;
  const life = typeof ASSISTANT_LIFE_STORE !== 'undefined' && ASSISTANT_LIFE_STORE.state ? ASSISTANT_LIFE_STORE.state.life : null;
  const here = life && typeof assistantLifeSlotAt === 'function' && life.abs === assistantLifeSlotAt(now).abs
    && ((life.groups || []).some(g => g && g.place === AMGT_PLACE && (g.ids || []).includes(aid)) || ((life.solo || {})[aid] && life.solo[aid].place === AMGT_PLACE));
  if (here) return `いま${AMGT_PLACE_NAME}で修行中`;
  const st = AMGT_STORE.state; const day = amgtSlotDay(amgtSlotOf(now));
  const ask = st.ask[aid];
  const rows = typeof ASSISTANT_MASMON_STORE !== 'undefined' && typeof assistantMasmonRowsOf === 'function' ? assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, aid) : [];
  if (rows.length && !(ask && ask.d === day && ask.a)) return '修行の相談があるみたい';
  const n = Object.values(st.mons[aid] || {}).reduce((a, me) => a + (me.day.d === day ? me.day.n : 0), 0);
  return n ? `今日は${AMGT_PLACE_NAME}で${n}回修行した` : null;
};

// ---------- 画面(公開の印が真のときだけ出す。置き場所は助手ライフ担当ナカヨシ9の形に合わせる) ----------
const AMGT_ASK_TEXT = Object.freeze({ // 仮の文(公開の前に社長の「この文で」をもらう)
  next: (n) => `${n}、次はどの修行がいいかな?`,
  rest: (n) => `${n}、ちょっと疲れてるみたい。休ませた方がいいかな?`,
  learn: (n, tech) => `${n}、もうすぐ「${tech}」を覚えられそう! どの修行がいいと思う?`,
});
const AMGT_OPT_TEXT = Object.freeze({ rest: '休ませよう', more: 'もう少しがんばろう' });
const AMGT_DIST = '零近中遠';
const useAmgtState = () => {
  const [st, setSt] = React.useState(AMGT_STORE.state);
  React.useEffect(() => { AMGT_STORE.subs.add(setSt); if (!AMGT_STORE.loaded) AMGT_STORE.load(); return () => { AMGT_STORE.subs.delete(setSt); }; }, []);
  return st;
};
const amgtEvText = (x, rowsByKey) => {
  const [a, b, c] = String(x.x || '').split('|');
  const nm = (k) => (rowsByKey[k] && rowsByKey[k].nick) || 'マスモン';
  if (x.t === 'shugyo') return AMGT_KINDS[b] ? `${nm(a)}が${AMGT_PLACE_NAME}で${AMGT_KINDS[b].act}をした` : '';
  if (x.t === 'rank') return `${nm(a)}の「${b}」が「${c}」になった`;
  if (x.t === 'learn') return `${nm(a)}が「${b}」を覚えた!`;
  if (x.t === 'breeder') return `ブリーダーの${(AMGT_BR.find(m => m[0] === a) || [])[1] || ''}が上がった`;
  if (x.t === 'ask') return '相談に答えてもらった';
  return '';
};
// ブリーダー能力の6つのゲージ(数字なし・段の名前だけ)
function AmgtBreederBars({ who, st }) {
  const ab = (st.br[who.id] || amgtInitBreeder(who.id)).ab;
  return (
    <div className="mhm-card" data-amgt-breeder>
      <p className="text-[10px] font-black text-slate-400">{who.name}のブリーダーの腕</p>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
        {AMGT_BR.map(([k, label]) => (
          <div key={k} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-200">
            <span className="w-[52px] shrink-0 whitespace-nowrap">{label}</span>
            <span className="mhm-bar"><i style={{ width: `${ab[k]}%`, background: 'linear-gradient(90deg,#34d399,#22d3ee)' }}/></span>
            <b className="w-[52px] shrink-0 text-right text-[9.5px] text-emerald-200" data-amgt-br={k}>{amgtBrRankOf(ab[k])}</b>
          </div>))}
      </div>
    </div>);
}
// くわしい画面の修行の札(技・熟練・相談・出来事)。e = 第①段階の入れ物
function AmgtCard({ who, t, e }) {
  const st = useAmgtState();
  if (!amgtOn() || !who || !t) return null;
  const me = amgtEntryOf(who.id, t, st) || amgtInitMon(t.monster, e && e.lv, e && e.st);
  const nowSlot = amgtSlotOf();
  const day = amgtSlotDay(nowSlot);
  const rows = typeof ASSISTANT_MASMON_STORE !== 'undefined' && typeof assistantMasmonRowsOf === 'function' ? assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, who.id) : [t];
  const growOf = (r) => (typeof amgEntryOf === 'function' ? amgEntryOf(who.id, r) : null);
  const ask = amgtAskOf(who.id, rows, day, growOf, st);
  const rowsByKey = Object.fromEntries(rows.map(r => [amgtKeyOf(r), r]));
  const evs = (st.ev[who.id] || []).filter(x => amgtSlotDay(x.s) === day).map(x => amgtEvText(x, rowsByKey)).filter(Boolean).slice(-6);
  const techs = amgtTechsOf(t.monster);
  return (
    <div className="mt-2 space-y-2" data-amgt-card>
      <div className="mhm-card">
        <p className="text-[10px] font-black text-slate-400">⚔ 技と熟練(モンヒロバトルの修行で覚える・磨く)</p>
        <div className="mt-1 grid grid-cols-1 gap-y-0.5">
          {techs.map(x => {
            const has = me.learn.includes(x.id);
            return (
              <div key={x.id} className={`flex items-center gap-1.5 text-[10.5px] font-bold ${has ? 'text-slate-100' : 'text-slate-500'}`} data-amgt-tech={x.id}>
                <span className={`w-[96px] shrink-0 truncate ${has ? (x.kind === 'wise' ? 'text-sky-200' : 'text-rose-200') : ''}`}>{has ? x.name : '???'}</span>
                <span className="w-[46px] shrink-0 whitespace-nowrap text-[9px]">{[0, 1, 2, 3].map(d => <i key={d} className={`not-italic ${x.dist.includes(d) && has ? 'text-amber-300' : 'text-slate-600'}`}>{AMGT_DIST[d]}</i>)}</span>
                <span className="mhm-bar"><i style={{ width: `${has ? me.m[x.id] || 0 : 0}%`, background: 'linear-gradient(90deg,#fbbf24,#f472b6)' }}/></span>
                <b className="w-[40px] shrink-0 text-right text-[9.5px] text-amber-200">{has ? amgtRankOf(me.m[x.id] || 0) : 'まだ'}</b>
              </div>);
          })}
          {AMGT_SENSE.map(([k, label]) => (
            <div key={k} className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-200" data-amgt-sense={k}>
              <span className="w-[148px] shrink-0 truncate">{label}</span>
              <span className="mhm-bar"><i style={{ width: `${me.m[k] || 0}%`, background: 'linear-gradient(90deg,#a78bfa,#f472b6)' }}/></span>
              <b className="w-[40px] shrink-0 text-right text-[9.5px] text-amber-200">{amgtRankOf(me.m[k] || 0)}</b>
            </div>))}
        </div>
      </div>
      {ask && ask.slot === t.slot && (
        <div className="mhm-card" data-amgt-ask={ask.q}>
          <p className="text-[11px] font-bold text-pink-100">💬 {who.name}「{AMGT_ASK_TEXT[ask.q](t.nick || 'マスモン', ask.tech)}」</p>
          {ask.answered
            ? <p className="mt-1 text-[10.5px] font-bold text-sky-200" data-amgt-ask-done>あなたの答え: {AMGT_KINDS[ask.answered] ? AMGT_KINDS[ask.answered].name : AMGT_OPT_TEXT[ask.answered]}</p>
            : <div className="mt-1 flex flex-wrap gap-1.5">
              {ask.opts.map(o => <button key={o} type="button" className="mhl-btn px-3 text-[11px]" onClick={() => amgtAnswer(who.id, ask, o, nowSlot)} data-amgt-ask-opt={o}>{AMGT_KINDS[o] ? AMGT_KINDS[o].name : AMGT_OPT_TEXT[o]}</button>)}
            </div>}
        </div>)}
      {evs.length > 0 && (
        <div className="mhm-card" data-amgt-events>
          <p className="text-[10px] font-black text-slate-400">今日の出来事</p>
          {evs.map((s, i) => <p key={i} className="text-[10.5px] font-bold text-slate-100">・{s}</p>)}
        </div>)}
      <AmgtBreederBars who={who} st={st}/>
    </div>);
}
