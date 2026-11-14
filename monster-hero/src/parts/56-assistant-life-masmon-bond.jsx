// 助手のマスモンの「絆」: 総合力とランク・忠誠度・人気・育成方針(叱る/褒める)・年齢と寿命・成長の型とピーク・訓練の結果・育ちの速さ ×3
//   (2026-11-12 キズナ・案 docs/progress/assistant-peer/masmon-plan/POWER.md 第3版の決定版・社長の答えは台帳 2026-11-12)
//   計算はすべて MASMON_CALC(56-assistant-life-masmon-calc.jsx)を呼ぶ。ここは「助手の値を集めて渡す」「結果を保存する」「見せる」だけ
//   保存は新しいキー mh_assistant_masmon_bond_v1 だけ(育成 mh_assistant_masmon_grow_v1・修行 mh_assistant_masmon_train_v1 は形も意味も変えない)
//   公開の印 RELEASE_FLAGS.assistantMasmonBond が偽のあいだは、受け口はすべて「何もしない」(掛け算は 1・結果は null)を返し、今の育成の結果を1つも変えない
//   乱数は自分の種(ブリーダーの種・助手・枠:種類・回)から作り、育成の乱数の列を引かない
const ASSISTANT_MASMON_BOND_KEY = 'mh_assistant_masmon_bond_v1';
const AMGB_NUM = Object.freeze({
  loy0: 50, pop0: 0, // はじめの忠誠度・人気
  idleDays: 7, // 何も関わらない日がこれを超えると忠誠度 −1/日・どの対戦にも出ない日がこれを超えると人気 −1/日
  scoldDay: 3, scoldStr: 5, // 叱りすぎ(1日3回目から)はストレス +5
  warnDays: 5, // 寿命の残りがこの日数を切ったら知らせる
  baseLife: 30, // 普通の方針の寿命(日)
  log: 9,
});
const AMGB_TRAIN_ACTS = Object.freeze(['light', 'heavy', 'real', 'focus', 'weak', 'joint', 'shugyo']);
const AMGB_RESULT_ICON = Object.freeze({ great: '🌟', ok: '⭕', fail: '❌', cheat: '🤫', skip: '💤' });
const AMGB_RANK_COLOR = Object.freeze({ G: '#94a3b8', F: '#94a3b8', E: '#4ade80', D: '#4ade80', C: '#67e8f9', B: '#60a5fa', A: '#c084fc', S: '#facc15', SS: '#facc15', SSS: '#facc15', M: '#f472b6' });
const amgbKey = (aid, slot, monster) => `${aid}:${slot}:${monster}`;
const amgbKeyOk = (k) => typeof k === 'string' && /^[a-z]{2,12}:[1-8]:\w{2,40}$/.test(k);
const amgbBlank = (v) => v === null || v === undefined || v === ''; // null・'' は既定値(Number(null)=0 にしない・ミハリ5)
const amgbInt = (v, d, lo, hi) => (!amgbBlank(v) && Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) : d);
const amgbNum = (v, d, lo, hi) => (!amgbBlank(v) && Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : d);
// 1体ぶんを読める形にそろえる(読めない値は既定: 忠誠50・人気0・方針 普通・年齢0)
const amgbNormOne = (x) => {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const rs = (Array.isArray(x.rs) ? x.rs : []).filter(r => r && Number.isInteger(r.s) && AMGB_RESULT_ICON[r.r]).slice(-AMGB_NUM.log).map(r => ({ s: r.s, r: r.r, ...(r.a === 'praise' || r.a === 'scold' ? { a: r.a } : {}) }));
  return {
    loy: amgbNum(x.loy, AMGB_NUM.loy0, 0, 100), pop: amgbNum(x.pop, AMGB_NUM.pop0, 0, 100),
    pol: amgbInt(x.pol, 0, -3, 3), pp: amgbInt(x.pp, 0, -9, 9), gt: amgbInt(x.gt, 2, 0, 5),
    age: amgbInt(x.age, 0, 0, 99999), life: Math.round(amgbNum(x.life, 0, 0, 1000) * 100) / 100, // life = 寿命の進み(千分率・小数2桁)
    last: amgbInt(x.last, -1, -1, 1e7), touch: amgbInt(x.touch, -1, -1, 1e7), fight: amgbInt(x.fight, -1, -1, 1e7),
    sc: { d: amgbInt(x.sc && x.sc.d, -1, -1, 1e7), n: amgbInt(x.sc && x.sc.n, 0, 0, 99) }, rs,
  };
};
const normalizeAssistantMasmonBond = (raw) => {
  const out = { v: 1, start: -1, mons: {}, bt: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  out.start = amgbInt(raw.start, -1, -1, 1e7);
  out.bt = (Array.isArray(raw.bt) ? raw.bt : []).filter(x => typeof x === 'string' && x.length <= 120).slice(-60); // 人気を数えた対戦(二重に数えない)
  if (raw.mons && typeof raw.mons === 'object' && !Array.isArray(raw.mons)) for (const [k, x] of Object.entries(raw.mons)) { if (!amgbKeyOk(k)) continue; const one = amgbNormOne(x); if (one) out.mons[k] = one; }
  return out;
};
const AMGB_STORE = { state: normalizeAssistantMasmonBond(null), loaded: false, subs: new Set(), dirty: false,
  set(next) { this.state = next; this.subs.forEach(f => { try { f(next); } catch (_) {} }); },
  load() { // 読み込みは1回だけ(同時に呼ばれても、あとから終わった方が古い値で戻さない)
    if (this.loaded) return Promise.resolve(this.state);
    this._p = this._p || (async () => {
      let raw = null; try { raw = typeof storeGet === 'function' ? await storeGet(ASSISTANT_MASMON_BOND_KEY, null, false) : null; } catch (_) {}
      this.loaded = true; this.set(normalizeAssistantMasmonBond(raw)); return this.state;
    })();
    return this._p;
  } };
const amgbOn = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantMasmonBond === true;
// 保存を読み込む前は書かない(空の既定値で前の記録を上書きしない)。失敗は false
const amgbSave = (next) => {
  if (!AMGB_STORE.loaded) return false;
  AMGB_STORE.set(next);
  if (!AMGB_STORE.dirty) { AMGB_STORE.dirty = true; Promise.resolve().then(() => { AMGB_STORE.dirty = false; try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_BOND_KEY, AMGB_STORE.state, false); } catch (_) {} }); }
  return true;
};
try { setTimeout(() => { try { if (amgbOn()) void AMGB_STORE.load(); } catch (_) {} }, 0); } catch (_) {}
const amgbLive = () => amgbOn() && AMGB_STORE.loaded && typeof MASMON_CALC !== 'undefined';
const amgbSeed = () => (typeof ASSISTANT_MASMON_STORE !== 'undefined' && ASSISTANT_MASMON_STORE.state && ASSISTANT_MASMON_STORE.state.seed) || '';
const amgbRng = (text) => (typeof assistantMasmonRng === 'function' ? assistantMasmonRng(text) : () => 0.5);
// 迎えたときの成長の型(1体ずつ・種類の伸びやすさで出やすさが変わる)。同じ子なら何度呼んでも同じ
const amgbTypeFor = (aid, row) => MASMON_CALC.typeFromApt(typeof AMG_APT !== 'undefined' ? AMG_APT[row.monster] : '', amgbRng(`${amgbSeed()}|${aid}|bond-type|${row.slot}:${row.monster}`)());
// 読むだけ(無ければ既定の形。保存はしない)
const amgbEntryOf = (aid, row, st = AMGB_STORE.state) => {
  if (!row) return null;
  const x = st.mons[amgbKey(aid, row.slot, row.monster)];
  return x || amgbNormOne({ gt: amgbTypeFor(aid, row) });
};
const amgbPut = (st, aid, row, x) => ({ ...st, mons: { ...st.mons, [amgbKey(aid, row.slot, row.monster)]: x } });
const amgbLifeFrac = (b) => (b ? Math.min(1, b.life / 1000) : 0);
// けが・病気・家出の長さ(回): 軽い1回・ふつう3回・重い6回。load = けがは疲れ・病気と家出はストレス。印が偽なら null(今の長さ)
const amgbCondLen = (load, r) => (amgbLive() ? MASMON_CALC.condLen(load, r) : null);
const amgbLifeOver = (aid, row) => { if (!amgbLive()) return false; const b = amgbEntryOf(aid, row); return !!b && b.life >= 1000; };

// ---- 育成(56-assistant-life-masmon-grow.jsx の amgCatchUp・amgDo)から呼ぶ受け口。印が偽なら何もしない ----
// その回の前に、日が変わっていれば年齢と寿命を進める・関わらない日の忠誠度/人気を下げる(冬眠中の子は rows に無いので進まない)
const amgbTick = (aid, row, slot) => {
  if (!amgbLive() || !row) return false;
  const day = typeof amgSlotDay === 'function' ? amgSlotDay(slot) : Math.floor(slot / 3);
  let st = AMGB_STORE.state;
  if (st.start < 0) st = { ...st, start: day }; // 公開の日を0日として数え始める(前からいる子も、この日から)
  const b0 = st.mons[amgbKey(aid, row.slot, row.monster)];
  if (!b0) { amgbSave(amgbPut(st, aid, row, amgbNormOne({ gt: amgbTypeFor(aid, row), last: day, touch: day, fight: day }))); return true; }
  if (b0.last >= day) { if (st !== AMGB_STORE.state) amgbSave(st); return false; }
  // まだ数え始めていない子(対戦などで先に記録だけできた・last が無い): 年齢は進めず、今日から数え始める(ミハリ5: 一度に400日進んで寿命にならないように)
  if (b0.last < 0) { amgbSave(amgbPut(st, aid, row, { ...b0, last: day, touch: b0.touch < 0 ? day : b0.touch, fight: b0.fight < 0 ? day : b0.fight })); return true; }
  // 育てた日だけ年をとる(社長 2026-11-12): 年齢と寿命は「育成の回が実際に進んだ日」だけ進める。
  //   育成は閉じていた分を2日(6回)までしか追いつかないので、その外の日(開いていない日・冬眠・前の子に戻すまでの日)は数えない。
  //   ここは育成の回ごとに呼ばれ、日が替わった最初の回で1日ぶん進む(=育成が進んだ日数・追いつきの上限と同じ2〜3日まで)
  const d = Math.min(1, day - b0.last);
  const b = { ...b0, sc: { ...b0.sc }, rs: [...b0.rs] };
  b.age = b0.age + d;
  b.life = Math.min(1000, Math.round(b0.life * 100 + Math.ceil(d * 1000 * MASMON_CALC.lifeStep(b0.pol, AMGB_NUM.baseLife) * 100)) / 100); // 小数2桁(切り上げで足し、寿命の日にちょうど1000へ届く)
  const idleL = Math.max(0, day - b0.touch - AMGB_NUM.idleDays); const prevL = Math.max(0, b0.last - b0.touch - AMGB_NUM.idleDays);
  if (b0.touch >= 0 && idleL > prevL) b.loy = Math.max(0, b0.loy - (idleL - prevL));
  const idleP = Math.max(0, day - b0.fight - AMGB_NUM.idleDays); const prevP = Math.max(0, b0.last - b0.fight - AMGB_NUM.idleDays);
  if (b0.fight >= 0 && idleP > prevP) b.pop = Math.max(0, b0.pop - (idleP - prevP));
  b.last = day;
  amgbSave(amgbPut(st, aid, row, b));
  return true;
};
// 訓練の前: サボり・ズル・大成功を決める(失敗は今の式のまま amgDo が決める)。訓練でない回・印が偽なら null
//   plan = 育成ノートの計画の回(サボりは育成ノートが忠誠・方針をかけて先に決めるので、ここでは 0)
const amgbPre = (aid, row, slot, e, act, plan) => {
  if (!amgbLive() || !row || !e || !act || !AMGB_TRAIN_ACTS.includes(act.a)) return null;
  const b = amgbEntryOf(aid, row);
  const sab = plan || typeof amgpSabChance !== 'function' ? 0 : amgpSabChance(e.fat, e.str);
  const r = MASMON_CALC.resultOf({ loyal: b.loy, pol: b.pol, sab, fail: 0, r: amgbRng(`${amgbSeed()}|${aid}|bond-res|${row.slot}:${row.monster}|${slot}`)() });
  return r;
};
// 伸びの掛け算: 育ちの速さ ×3・成長の型と年齢・育成方針・結果(大成功 ×1.5・ズル ×0.2)。寿命が来たら 0(伸びが止まる)
const amgbGainMult = (aid, row, pre) => {
  if (!amgbLive() || !row) return 1;
  const b = amgbEntryOf(aid, row);
  const f = amgbLifeFrac(b); if (f >= 1) return 0;
  const res = MASMON_CALC.RESULTS[pre] && (pre === 'great' || pre === 'cheat') ? MASMON_CALC.RESULTS[pre].mult : 1;
  return MASMON_CALC.PACE * MASMON_CALC.ageMult(b.gt, f) * MASMON_CALC.policyOf(b.pol).gain * res;
};
// 1日の伸びの上限・育成の経験・チケットの倍率(育ちの速さ)。印が偽なら 1
const amgbPace = () => (amgbLive() ? MASMON_CALC.PACE : 1);
// 育成ノートのサボりの起きやすさにかける(忠誠が低い・甘い方針ほどサボる)
const amgbSabMult = (aid, row) => { if (!amgbLive() || !row) return 1; const b = amgbEntryOf(aid, row); return MASMON_CALC.sabLoyalMult(b.loy) * MASMON_CALC.policyOf(b.pol).sab; };
// ストレスのたまり方(方針)。増える分だけにかける
const amgbStressMult = (aid, row) => { if (!amgbLive() || !row) return 1; return MASMON_CALC.policyOf(amgbEntryOf(aid, row).pol).stress; };
// 訓練のあと: 結果を記録(叱る/褒めるの相手)。ズルは疲れが増えない・大成功はストレス −3
const amgbAfter = (aid, row, slot, e, act, pre, failed, fat0) => {
  if (!amgbLive() || !row || !e || !act) return;
  let r = null;
  if (act.a === 'saboru') r = 'skip';
  else if (AMGB_TRAIN_ACTS.includes(act.a)) r = failed ? 'fail' : pre === 'great' || pre === 'cheat' ? pre : 'ok';
  if (!r) return;
  if (r === 'cheat' && Number.isFinite(fat0)) e.fat = Math.min(e.fat, fat0);
  if (r === 'great') e.str = Math.max(0, e.str + MASMON_CALC.RESULTS.great.str);
  const st = AMGB_STORE.state; const b0 = st.mons[amgbKey(aid, row.slot, row.monster)] || amgbEntryOf(aid, row);
  if (b0.rs.some(x => x.s === slot)) return;
  amgbSave(amgbPut(st, aid, row, { ...b0, rs: [...b0.rs, { s: slot, r }].slice(-AMGB_NUM.log) }));
};

// ---- プレイヤーが関わる ----
// くわしい画面を開いた(関わった日)
const amgbTouch = (aid, row, now = Date.now()) => {
  if (!amgbLive() || !row) return false;
  const day = amgSlotDay(amgSlotOf(now)); const st = AMGB_STORE.state; const b0 = st.mons[amgbKey(aid, row.slot, row.monster)];
  if (!b0 || b0.touch >= day) return false;
  return amgbSave(amgbPut(st, aid, row, { ...b0, touch: day }));
};
// 叱る・褒めるの相手になる結果(今日のいちばん新しい結果で、まだ叱る/褒めるをしていないもの)
const amgbPendOf = (b, now = Date.now()) => { if (!b || !b.rs.length) return null; const x = b.rs[b.rs.length - 1]; return !x.a && amgSlotDay(x.s) === amgSlotDay(amgSlotOf(now)) ? x : null; };
// act = 'praise' | 'scold'。返り値 { ok, loy, dl, pol, moved, r } か { ok:false, why }
const amgbReact = (aid, row, act, now = Date.now()) => {
  if (!amgbLive() || !row || (act !== 'praise' && act !== 'scold')) return { ok: false, why: 'いまはできません' };
  const st = AMGB_STORE.state; const key = amgbKey(aid, row.slot, row.monster); const b0 = st.mons[key];
  const p = amgbPendOf(b0, now); if (!p) return { ok: false, why: '今日の訓練の結果がまだありません' };
  const day = amgSlotDay(amgSlotOf(now));
  const fx = MASMON_CALC.reactOf(p.r, act); const mv = MASMON_CALC.policyMove(b0.pol, b0.pp, fx.dir);
  const sc = act === 'scold' ? { d: day, n: (b0.sc.d === day ? b0.sc.n : 0) + 1 } : b0.sc;
  const b = { ...b0, loy: Math.max(0, Math.min(100, b0.loy + fx.loyal)), pol: mv.pol, pp: mv.pp, sc, touch: day, rs: b0.rs.map(x => (x === p ? { ...x, a: act } : x)) };
  if (!amgbSave({ ...st, mons: { ...st.mons, [key]: b } })) return { ok: false, why: '読み込み中です' };
  if (act === 'scold' && sc.n >= AMGB_NUM.scoldDay && typeof AMG_STORE !== 'undefined' && AMG_STORE.loaded) { // 叱りすぎはストレス +5(育成の値)
    const S = AMG_STORE.state; const mk = amgMonKey(row.slot, row.monster); const e = S.mons[aid] && S.mons[aid][mk];
    if (e) amgSave({ ...S, mons: { ...S.mons, [aid]: { ...S.mons[aid], [mk]: { ...e, str: Math.min(100, e.str + AMGB_NUM.scoldStr) } } } });
  }
  return { ok: true, loy: b.loy, dl: b.loy - b0.loy, pol: b.pol, moved: b.pol !== b0.pol, r: p.r, over: act === 'scold' && sc.n >= AMGB_NUM.scoldDay };
};
// 対戦のあと(人気)。kind = 'pvp'(フレンド対戦)|'peer'(助手どうし)|'spar'(修行の練習試合)
const assistantMasmonBondBattle = (aid, row, kind, win, now = Date.now()) => {
  if (!amgbLive() || !row) return false;
  const st = AMGB_STORE.state; const b0 = st.mons[amgbKey(aid, row.slot, row.monster)] || amgbEntryOf(aid, row);
  return amgbSave(amgbPut(st, aid, row, { ...b0, pop: MASMON_CALC.popAfterBattle(b0.pop, kind, !!win), fight: amgSlotDay(amgSlotOf(now)) }));
};

// ---- 冬眠・合体(56-assistant-life-masmon-sleep.jsx)から呼ぶ口。冬眠の行に絆の写し bd を持たせる ----
// 眠らせる子・前にいた子の写し(無い・読み込み前は null)
const amgbCopyOf = (aid, slot, monster) => { if (!AMGB_STORE.loaded) return null; const x = AMGB_STORE.state.mons[amgbKey(aid, slot, monster)]; return x ? { ...x, sc: { ...x.sc }, rs: [...x.rs] } : null; };
const amgbBedOk = (x) => amgbNormOne(x);
// 起こしたとき: 眠らせた子の行(outMonster)は消し、起きた子の行へ写しを戻す。眠っていた日は年齢も寿命も進めず、関わらない日にも数えない
const amgbWake = (aid, slot, outMonster, inMonster, bd, now = Date.now()) => {
  if (!AMGB_STORE.loaded) return false;
  const day = amgSlotDay(amgSlotOf(now));
  const mons = { ...AMGB_STORE.state.mons }; delete mons[amgbKey(aid, slot, outMonster)];
  if (bd) mons[amgbKey(aid, slot, inMonster)] = { ...bd, last: bd.last < 0 ? -1 : day, touch: Math.max(bd.touch, day), fight: Math.max(bd.fight, day) };
  else delete mons[amgbKey(aid, slot, inMonster)];
  return amgbSave({ ...AMGB_STORE.state, mons });
};
// 合体の子: 忠誠=主・人気=2体の高い方の半分・方針=主(点は0)・型=主・年齢と寿命は0(POWER.md 保存の節)
const amgbFuseChild = (aid, mainRow, mainBd, matBd) => {
  const m = mainBd || amgbNormOne({ gt: amgbTypeFor(aid, mainRow) }); const pops = [mainBd ? mainBd.pop : 0, matBd ? matBd.pop : 0];
  return amgbNormOne({ loy: m.loy, pop: Math.max(...pops) / 2, pol: m.pol, pp: 0, gt: m.gt, age: 0, life: 0, last: -1, touch: -1, fight: -1 });
};
// 冬眠の行の総合力(育成の写し g・修行の写し t・絆の写し bd から)
const amgbBedPower = (bed) => {
  if (typeof MASMON_CALC === 'undefined' || !bed || !bed.g || !bed.g.st) return null;
  const t = bed.t; const ms = t && Array.isArray(t.learn) ? t.learn.map(id => Number(t.m && t.m[id]) || 0) : [];
  const power = MASMON_CALC.power({ stats: bed.g.st, masteries: ms, lv: bed.g.lv, loyal: bed.bd ? bed.bd.loy : AMGB_NUM.loy0, pop: bed.bd ? bed.bd.pop : 0 });
  return { power, rank: MASMON_CALC.rankOf(power) };
};

// 対戦の振り返りから(1戦に1回だけ)。rows = 出たマスモンの行。kind = 'pvp'|'peer'|'spar'
const amgbBattleOnce = (id, aid, rows, kind, win, now = Date.now()) => {
  if (!amgbLive() || typeof id !== 'string' || !id || !Array.isArray(rows)) return false;
  const st0 = AMGB_STORE.state; const bid = id.slice(0, 120); if (st0.bt.includes(bid)) return false;
  const day = amgSlotDay(amgSlotOf(now)); let st = { ...st0, bt: [...st0.bt, bid].slice(-60) };
  for (const row of rows) { if (!row || !Number.isInteger(row.slot) || !row.monster) continue; const b0 = st.mons[amgbKey(aid, row.slot, row.monster)] || amgbEntryOf(aid, row); st = amgbPut(st, aid, row, { ...b0, pop: MASMON_CALC.popAfterBattle(b0.pop, kind, !!win), fight: day }); }
  return amgbSave(st);
};

// ---- 総合力とランク(表示だけ・保存しない) ----
const amgbMasteriesOf = (aid, row) => {
  try {
    if (typeof AMGT_STORE === 'undefined') return [];
    const me = (AMGT_STORE.state.mons[aid] || {})[`${row.slot}:${row.monster}`];
    return me ? me.learn.map(id => Number(me.m[id]) || 0) : [];
  } catch (_) { return []; }
};
// 6能力が無い子(古い形)は null(「—」で見せる)
const amgPowerOf = (aid, row) => {
  if (typeof MASMON_CALC === 'undefined' || !row || typeof amgEntryOf !== 'function') return null;
  const e = amgEntryOf(aid, row); if (!e || !e.st) return null;
  const b = amgbEntryOf(aid, row);
  const power = MASMON_CALC.power({ stats: e.st, masteries: amgbMasteriesOf(aid, row), lv: e.lv, loyal: b ? b.loy : AMGB_NUM.loy0, pop: b ? b.pop : 0 });
  return { power, rank: MASMON_CALC.rankOf(power) };
};
const amgbStars = (pop) => (pop >= 90 ? '★★★' : pop >= 60 ? '★★' : pop >= 30 ? '★' : '');

// ---- 画面 ----
const useAmgbState = () => {
  const [st, setSt] = React.useState(AMGB_STORE.state);
  React.useEffect(() => { AMGB_STORE.subs.add(setSt); if (amgbOn()) void AMGB_STORE.load(); return () => { AMGB_STORE.subs.delete(setSt); }; }, []);
  return st;
};
// ランクの札(一覧・冬眠の行などの小さい印)
function AmgbRankChip({ rank, small = false }) {
  if (!rank) return null;
  const c = AMGB_RANK_COLOR[rank.key] || '#94a3b8'; const frame = ['SS', 'SSS', 'M'].includes(rank.key);
  return <b className={`inline-flex items-center justify-center rounded-md px-1 font-black leading-none ${small ? 'min-w-[22px] text-[10px] py-[2px]' : 'min-w-[30px] text-[13px] py-[3px]'}`} style={{ color: '#0f172a', background: rank.key === 'M' ? 'linear-gradient(90deg,#f472b6,#facc15,#4ade80,#60a5fa,#c084fc)' : c, boxShadow: frame ? `0 0 0 2px #fde68a` : 'none' }} data-amgb-rank={rank.key}>{rank.label || rank.key}</b>; // M より上は M1・MG・MG9 などの名前(幅は px-1 と最小幅で広がる)
}
// 名前の横に置く「ランク + 総合力」(印が偽なら何も出さない)
function AmgbPowerTag({ aid, row }) {
  useAmgbState();
  if (!amgbOn()) return null;
  const p = amgPowerOf(aid, row);
  if (!p) return <span className="text-[10px] font-bold text-slate-400" data-amgb-power="none">総合力 —</span>;
  return <span className="inline-flex items-center gap-1 text-[10.5px] font-black text-amber-100" data-amgb-power={p.power}><AmgbRankChip rank={p.rank} small/>{p.power.toLocaleString()}</span>;
}
// 冬眠の行に置く「ランク + 総合力」
function AmgbBedTag({ bed }) {
  if (!amgbOn()) return null;
  const p = amgbBedPower(bed);
  if (!p) return null;
  const over = !!(bed.bd && amgbLifeFrac(amgbNormOne(bed.bd)) >= 1);
  return <span className="inline-flex items-center gap-1 text-[10.5px] font-black text-amber-100" data-amgb-bed-power={p.power}><AmgbRankChip rank={p.rank} small/>{p.power.toLocaleString()}{over && <small className="rounded bg-slate-700 px-1 text-[9.5px] text-slate-200" data-amgb-bed-over>⏳ 寿命</small>}</span>;
}
// 合体の見通しに出す「絆」: 年齢と寿命は新しく(0歳)・忠誠度は主のまま・人気は2体の高い方の半分・合体後の総合力とランク(保存しない)
function AmgbFusePreview({ main, mat, plan }) {
  if (!amgbOn() || typeof MASMON_CALC === 'undefined' || !main || !mat || !plan) return null;
  const c = amgbFuseChild(main.aid, { slot: main.slot, monster: main.row.monster }, main.bd || null, mat.bd || null);
  const now = amgbBedPower(main); const after = amgbBedPower({ g: { st: plan.st, lv: 1 }, t: { learn: plan.learn, m: plan.m }, bd: c });
  const mb = (main.bd && amgbNormOne(main.bd)) || amgbNormOne({});
  return (
    <div className="mt-1 rounded-xl bg-slate-800 p-2 text-[11px] font-bold text-slate-200" data-amgb-fuse-preview>
      {now && after && <p className="flex items-center justify-between gap-1"><span>総合力</span><span className="inline-flex items-center gap-1"><AmgbRankChip rank={now.rank} small/>{now.power.toLocaleString()} → <AmgbRankChip rank={after.rank} small/><b className="text-amber-200" data-amgb-fuse-power={after.power}>{after.power.toLocaleString()}</b></span></p>}
      <p data-amgb-fuse-age>🎂 {MASMON_CALC.ageLabel(mb.age)} → <b className="text-amber-200">{MASMON_CALC.ageLabel(0)}</b>(寿命も新しくなります)</p>
      <p>忠誠度 <b className="text-amber-200" data-amgb-fuse-loy={Math.round(c.loy)}>{Math.round(c.loy)}</b>(主のまま) ・ 人気 <b className="text-amber-200" data-amgb-fuse-pop={Math.round(c.pop)}>{Math.round(c.pop)}</b>(2体の高い方の半分)</p>
    </div>);
}
// 冬眠中の子のくわしい画面に出す「絆」(眠らせたときの写し bd から・総合力・忠誠度・人気・年齢・寿命の残り。写しが無い子は既定値)
function AmgbBedPanel({ bed }) {
  if (!amgbOn() || typeof MASMON_CALC === 'undefined' || !bed) return null;
  const b = (bed.bd && amgbNormOne(bed.bd)) || amgbNormOne({});
  const p = amgbBedPower(bed); const f = amgbLifeFrac(b);
  const left = Math.max(0, Math.ceil((1 - f) * MASMON_CALC.lifeLen(b.pol, AMGB_NUM.baseLife)));
  return (
    <div className="mt-2 rounded-2xl border border-white/10 bg-slate-800/70 p-2" data-amgb-bed-panel>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black text-slate-400">総合力</p>
        {p ? <p className="flex items-center gap-1.5 text-[16px] font-black text-amber-100" data-amgb-bed-total={p.power}><AmgbRankChip rank={p.rank}/>{p.power.toLocaleString()}</p> : <p className="text-[12px] font-bold text-slate-400">—</p>}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] font-bold text-slate-200">
        <p>忠誠度 <b className="text-amber-200" data-amgb-bed-loy>{Math.round(b.loy)}</b></p>
        <p>人気 <b className="text-amber-200" data-amgb-bed-pop>{Math.round(b.pop)}</b></p>
        <p data-amgb-bed-age={b.age}>🎂 {MASMON_CALC.ageLabel(b.age)}</p>
        <p data-amgb-bed-life={b.life}>{f >= 1 ? '⏳ 寿命(もう伸びません)' : `⏳ 寿命まで あと約${left}日`}</p>
      </div>
      <p className="mt-0.5 text-[9.5px] font-bold text-slate-400">眠っている間は年をとりません</p>
    </div>);
}
// くわしい画面の「絆」(総合力・忠誠度・人気・方針・年齢・型・訓練の結果と叱る/褒める)
function AmgbPanel({ who, t }) {
  const bst = useAmgbState();
  const [msg, setMsg] = React.useState('');
  React.useEffect(() => { if (amgbOn()) { void AMGB_STORE.load().then(() => amgbTouch(who.id, t)); } }, [who.id, t.slot, t.monster]);
  const b0 = amgbOn() ? amgbEntryOf(who.id, t, bst) : null;
  const lastS = b0 && b0.rs.length ? b0.rs[b0.rs.length - 1].s : -1;
  React.useEffect(() => { setMsg(''); }, [lastS, who.id, t.slot, t.monster]); // 結果が替わったら前の叱る/褒めるの文は消す(ミハリ)
  if (!amgbOn()) return null;
  const b = b0; const p = amgPowerOf(who.id, t);
  if (!b) return null;
  const pol = MASMON_CALC.policyOf(b.pol); const gt = MASMON_CALC.typeOf(b.gt); const f = amgbLifeFrac(b);
  const lifeDays = MASMON_CALC.lifeLen(b.pol, AMGB_NUM.baseLife); const left = Math.max(0, Math.ceil((1 - f) * lifeDays));
  const pk = MASMON_CALC.peakOf(b.gt); const mult = MASMON_CALC.ageMult(b.gt, f);
  const inPeak = f < 1 && f >= pk.from && f < pk.to; const toPeak = f < pk.from ? Math.ceil((pk.from - f) * lifeDays) : 0;
  const pend = amgbPendOf(b);
  const last = b.rs.length ? b.rs[b.rs.length - 1] : null;
  const react = (act) => { const r = amgbReact(who.id, t, act); setMsg(r.ok ? `${act === 'praise' ? '👏 褒めた' : '📣 叱った'}: 忠誠度 ${r.dl >= 0 ? '+' : '−'}${Math.abs(r.dl)}${r.moved ? ` ・ 育成方針が「${MASMON_CALC.policyOf(r.pol).name}」になった` : ''}${r.over ? ' ・ 叱りすぎてストレスが少したまった' : ''}` : r.why); };
  const polBar = (b.pol + 3) / 6 * 100;
  return (
    <div className="mhm-card mt-2" data-amgb-panel>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black text-slate-400">総合力</p>
        {p ? <p className="flex items-center gap-1.5 text-[18px] font-black text-amber-100" data-amgb-total={p.power}><AmgbRankChip rank={p.rank}/>{p.power.toLocaleString()}</p> : <p className="text-[12px] font-bold text-slate-400">—</p>}
      </div>
      {p && (p.rank.labelNext || p.rank.next) && <p className="text-right text-[9.5px] font-bold text-slate-400">次のランクまで {((p.rank.labelNext || p.rank.next) - p.power).toLocaleString()}</p>}
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
        <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-200"><span className="w-[40px] shrink-0">忠誠度</span><span className="mhm-bar"><i style={{ width: `${b.loy}%`, background: 'linear-gradient(90deg,#34d399,#22d3ee)' }}/></span><b className="w-[26px] text-right text-amber-200" data-amgb-loy>{Math.round(b.loy)}</b></div>
        <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-200"><span className="w-[40px] shrink-0">人気</span><span className="mhm-bar"><i style={{ width: `${b.pop}%`, background: 'linear-gradient(90deg,#f472b6,#facc15)' }}/></span><b className="w-[26px] text-right text-amber-200" data-amgb-pop>{Math.round(b.pop)}</b></div>
      </div>
      <p className="mt-1 text-[9.5px] font-bold text-slate-400">忠誠度が低いと対戦で意味不明な行動をする番が出ることがあります ・ 人気が高いほど会心の一撃が出やすくなります{amgbStars(b.pop) ? ` ・ 人気 ${amgbStars(b.pop)}` : ''}</p>
      <div className="mt-1.5 text-[10.5px] font-bold text-slate-200" data-amgb-policy={b.pol}>
        <div className="flex items-center justify-between"><span>🧭 育成方針: <b className="text-amber-200">{pol.name}</b></span><small className="text-[9.5px] text-slate-400">褒める ← → 叱る</small></div>
        <div className="relative mt-1 h-[8px] rounded-full" style={{ background: 'linear-gradient(90deg,#f9a8d4,#e2e8f0,#93c5fd)' }}><i className="absolute top-[-3px] h-[14px] w-[6px] rounded bg-slate-900 ring-2 ring-amber-200" style={{ left: `calc(${polBar}% - 3px)` }}/></div>
        <p className="mt-0.5 text-[9.5px] text-slate-400">甘いほど寿命が長くストレスがたまりにくいけれど、サボりやすく伸びも少し落ちます。厳しいほどその逆です</p>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 text-[10.5px] font-bold text-slate-200">
        <p data-amgb-age={b.age}>🎂 {MASMON_CALC.ageLabel(b.age)}</p>
        <p data-amgb-life={b.life}>{f >= 1 ? '⏳ 寿命(もう伸びません)' : `⏳ 寿命まで あと約${left}日`}</p>
      </div>
      <p className="mt-1 text-[10.5px] font-bold text-emerald-200" data-amgb-type={gt.key}>📊 成長の型: {gt.name}{f >= 1 ? '' : inPeak ? ` ・ いまピーク(伸び ×${mult})` : toPeak > 0 ? ` ・ ピークまで あと約${toPeak}日` : ` ・ 伸び ×${mult}`}</p>
      <AmgbCurve gt={b.gt} frac={f}/>
      {f < 1 && left <= AMGB_NUM.warnDays && <p className="mt-1 rounded-lg bg-amber-900/50 p-1.5 text-[10.5px] font-bold text-amber-100" data-amgb-warn>{who.name || '助手'}「そろそろ伸びが止まりそう。{typeof amgsFuseOn === 'function' && amgsFuseOn() ? '合体も考えてみる?' : 'いまのうちに、たくさん鍛えておこうね'}」</p>}
      {f >= 1 && <p className="mt-1 text-[10px] font-bold text-slate-400">寿命が来ても、いなくなったりはしません。対戦にも出られます</p>}
      <div className="mt-2 rounded-xl border border-white/10 p-2" data-amgb-result>
        <p className="text-[10.5px] font-bold text-slate-200">{last ? `いちばん新しい訓練: ${AMGB_RESULT_ICON[last.r]} ${MASMON_CALC.RESULTS[last.r].name}${last.a ? `(${last.a === 'praise' ? '褒めた' : '叱った'})` : ''}` : 'まだ訓練の結果はありません'}</p>
        {pend && <div className="mt-1.5 flex gap-2">
          <button type="button" className="min-h-[40px] flex-1 rounded-xl bg-sky-700 px-2 text-[12px] font-black" onClick={() => react('scold')} data-amgb-act="scold">📣 叱る</button>
          <button type="button" className="min-h-[40px] flex-1 rounded-xl bg-pink-600 px-2 text-[12px] font-black" onClick={() => react('praise')} data-amgb-act="praise">👏 褒める</button>
        </div>}
        {pend && <p className="mt-1 text-[9.5px] font-bold text-slate-400">結果に合うほうを選ぶと忠誠度が上がります(しなくても大丈夫)</p>}
        {msg && <p className="mt-1 text-[10.5px] font-bold text-amber-200" data-amgb-msg>{msg}</p>}
      </div>
    </div>);
}
// 成長の型の曲線(10区間)と「いまここ」
function AmgbCurve({ gt, frac }) {
  const c = MASMON_CALC.typeOf(gt).c; const W = 200, H = 34; const top = 1.8;
  const pts = c.map((v, i) => `${i / 9 * W},${H - v / top * H}`).join(' '); // 左端=0歳・右端=寿命
  const x = Math.min(1, Math.max(0, frac)) * W;
  return (<>
    <svg viewBox={`0 0 ${W} ${H + 2}`} className="mt-1 h-[36px] w-full" preserveAspectRatio="none" aria-hidden="true" data-amgb-curve>
      <polyline points={pts} fill="none" stroke="#6ee7b7" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
      <line x1={x} x2={x} y1="0" y2={H} stroke="#fde68a" strokeWidth="2" strokeDasharray="3 2" vectorEffect="non-scaling-stroke"/>
    </svg>
    <div className="flex justify-between text-[9px] font-bold leading-none text-slate-400" data-amgb-curve-ends><span>0歳</span><span>寿命</span></div>
    </>);
}
