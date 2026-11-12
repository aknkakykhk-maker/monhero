#!/usr/bin/env node
// 助手のマスモンの絆(56-assistant-life-masmon-bond.jsx・総合力とランク・忠誠度・人気・育成方針・年齢と寿命・成長の型・訓練の結果・育ちの速さ×3)を、画面なしで確かめる。2026-11-12 キズナ
//   node tools/assistant/assistant-masmon-bond-check.js          検査
//   node tools/assistant/assistant-masmon-bond-check.js --sim    30日(1世代)の試算(案 POWER.md 7章: 6能力の合計 +1,700 前後か)
//   ① 印が偽なら育成の結果は今と全く同じ ② 保存の正規化 ③ 年齢と寿命(普通30日・冬眠中や開かない日も日付で進む)・寿命で伸びが止まる
//   ④ 育ちの速さ ×3(1日の上限 45/60・経験 ×3) ⑤ 結果の種類(大成功・成功・失敗・ズル・サボり)と忠誠度での起きやすさ
//   ⑥ 叱る・褒める(忠誠度・方針の点・10点で1段・その日の結果だけ・1回だけ・叱りすぎ) ⑦ 関わらない日の忠誠度・人気 ⑧ 総合力とランク
//   ⑨ 同じ種なら同じ結果 ⑩ 読み込む前は書かない ⑪ 計算は MASMON_CALC を呼ぶだけ(式を写していない)
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const masmon = read('monster-hero/src/parts/56-assistant-life-masmon.jsx');
const cutAt = (src, mark) => { const i = src.indexOf(mark); return i < 0 ? src : src.slice(0, i); };
const calc = read('monster-hero/src/parts/56-assistant-life-masmon-calc.jsx');
const grow = cutAt(read('monster-hero/src/parts/56-assistant-life-masmon-grow.jsx'), '// ---------- 画面');
const plan = cutAt(read('monster-hero/src/parts/56-assistant-life-masmon-plan.jsx'), '// ---------- 画面');
const bondSrc = read('monster-hero/src/parts/56-assistant-life-masmon-bond.jsx');
const bond = cutAt(bondSrc, '// ---- 画面 ----');
const rngLine = masmon.match(/^const assistantMasmonRng = .*$/m)[0];
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };
const make = (flags, withBond = true) => {
  const ctx = { console, RELEASE_FLAGS: flags, Promise, setTimeout: () => 0 };
  vm.createContext(ctx);
  vm.runInContext([rngLine, "const assistantMasmonGrowKind = (g) => String(g || '').split('(')[0];", calc, grow, plan, withBond ? bond : '', "const ASSISTANT_MASMON_STORE = { state: { seed: 'bond-check' } };",
    `this.T = { normalizeAssistantMasmonGrow, amgCatchUp, amgSlotOf, amgSlotDay, AMG_STORE, AMG_KEYS, AMG_CARE, AMG_DAY_CAP, amgEntryOf, AMGP_STORE, AMGP_CSTORE, MASMON_CALC${withBond ? ', AMGB_STORE, AMGB_NUM, normalizeAssistantMasmonBond, amgbEntryOf, amgbReact, amgbSave, amgbKey, amgPowerOf, assistantMasmonBondBattle, amgbPendOf, amgbCopyOf, amgbWake, amgbFuseChild, amgbBedPower, amgbBattleOnce' : ''} };`].join('\n'), ctx);
  return ctx;
};
const ROW = { slot: 1, monster: 'Golem', lv: 20, grow: '攻撃型', nick: 'ゴロンタ' };
const ROW2 = { slot: 2, monster: 'Pixie', lv: 15, grow: 'すばやさ型', nick: 'ピピ' };
const SEED = 'bond-check';
const S0 = Math.floor((Date.UTC(2026, 10, 16, 0, 0) + 5 * 3600000) / 86400000) * 3; // 月曜の朝
const slotAt = (s) => (Math.floor(s / 3) * 86400000) - 5 * 3600000 + [0, 8, 14][s % 3] * 3600000 + 60000; // その回が始まった時刻
const run = (ctx, rows, slots, each = null, step = 1) => {
  const T = ctx.T; T.AMG_STORE.loaded = true; T.AMGP_STORE.loaded = true; T.AMGP_CSTORE.loaded = true; if (T.AMGB_STORE) T.AMGB_STORE.loaded = true;
  let st = T.amgCatchUp(T.normalizeAssistantMasmonGrow(null), 'kiki', rows, SEED, S0);
  T.AMG_STORE.set(st);
  for (let s = S0 + step; s <= S0 + slots; s += step) {
    if (each) each(s, T);
    st = T.amgCatchUp(T.AMG_STORE.state, 'kiki', rows, SEED, s); T.AMG_STORE.set(st);
  }
  return st;
};
const entry = (st, row) => st.mons.kiki[`${row.slot}:${row.monster}`];
const sumSt = (e) => Object.values(e.st).reduce((a, b) => a + b, 0);
const OFF = { assistantMasmonGrow: true, assistantMasmonPlan: true, assistantMasmonBond: false };
const ON = { assistantMasmonGrow: true, assistantMasmonPlan: true, assistantMasmonBond: true };

if (process.argv.includes('--sim')) {
  const days = 30; const out = [];
  for (const [name, flags] of [['いま(印が偽)', OFF], ['絆(×3・型・方針 普通)', ON]]) {
    const ctx = make(flags); const a = run(ctx, [ROW, ROW2], days * 3);
    const g = [ROW, ROW2].map(r => sumSt(entry(a, r)) - sumSt(entry(run(make(flags), [ROW, ROW2], 0), r)));
    const lv = [ROW, ROW2].map(r => entry(a, r).lv);
    out.push(`${name}: ${days}日で 6能力の合計 +${g.join(' / +')} ・ 育成Lv ${lv.join(' / ')}${flags.assistantMasmonBond ? ` ・ 型 ${[ROW, ROW2].map(r => ctx.T.MASMON_CALC.typeOf(ctx.T.amgbEntryOf('kiki', r).gt).name).join(' / ')}` : ''}`);
  }
  console.log(out.join('\n'));
  console.log('(おまかせだけの試算。計画・様子見・チケットがあるともっと伸びる。案の目安は計画ありで +1,700 前後)');
  process.exit(0);
}

// ① 印が偽なら、育成の結果は部品が無いときと全く同じ
{
  const a = run(make(OFF), [ROW, ROW2], 90);
  const b = run(make(OFF, false), [ROW, ROW2], 90);
  check('① 印が偽なら、育成の結果は今と全く同じ(90回)', JSON.stringify(a) === JSON.stringify(b));
  const T = make(OFF).T; T.AMGB_STORE.loaded = true;
  check('① 印が偽なら絆の保存に何も書かない', JSON.stringify(T.AMGB_STORE.state.mons) === '{}' && T.amgbReact('kiki', ROW, 'praise').ok === false);
}
// ② 保存の正規化
{
  const T = make(ON).T;
  const n = T.normalizeAssistantMasmonBond({ start: 5, mons: { 'kiki:1:Golem': { loy: 140, pop: -3, pol: 9, pp: 30, gt: 'x', age: 12, life: 2000, rs: [{ s: 3, r: 'great' }, { s: 4, r: 'boo' }, { s: 'x', r: 'ok' }] }, 'BAD:1:x': { loy: 1 }, 'kiki:9:Golem': {} } });
  const b = n.mons['kiki:1:Golem'];
  check('② 値は範囲に収める(忠誠≤100・人気≥0・方針 −3〜3・点 −9〜9・寿命の進み ≤1000)', b.loy === 100 && b.pop === 0 && b.pol === 3 && b.pp === 9 && b.life === 1000 && b.age === 12);
  check('② 読めない型は「普通」・知らない結果は捨てる・おかしなキーは捨てる', b.gt === 2 && b.rs.length === 1 && Object.keys(n.mons).length === 1);
  check('② 何も無い・壊れているときは空', JSON.stringify(T.normalizeAssistantMasmonBond('x')) === JSON.stringify({ v: 1, start: -1, mons: {}, bt: [] }));
  const d = T.amgbEntryOf('kiki', ROW);
  check('② まだ無い子の既定(忠誠50・人気0・方針 普通・年齢0)', d.loy === 50 && d.pop === 0 && d.pol === 0 && d.age === 0 && d.life === 0);
}
// ③ 年齢と寿命
{
  const ctx = make(ON); const T = ctx.T;
  run(ctx, [ROW], 3 * 15);
  const b15 = T.amgbEntryOf('kiki', ROW);
  check('③ 15日で年齢15(1歳3か月)・寿命の進み 半分', b15.age === 15 && Math.round(b15.life) === 500 && T.MASMON_CALC.ageLabel(b15.age) === '1歳3か月', `年齢 ${b15.age}・進み ${b15.life}`);
  const ctx2 = make(ON); run(ctx2, [ROW], 3 * 31);
  const b31 = ctx2.T.amgbEntryOf('kiki', ROW); const e31 = entry(ctx2.T.AMG_STORE.state, ROW);
  const before = JSON.stringify(e31.st);
  const st = ctx2.T.amgCatchUp(ctx2.T.AMG_STORE.state, 'kiki', [ROW], SEED, S0 + 3 * 33); const e33 = entry(st, ROW);
  check('③ 普通の方針で30日たつと寿命(進み1000)・その後は6能力が伸びない', b31.life === 1000 && JSON.stringify(e33.st) === before, `進み ${b31.life}`);
  // 開かない日も日付で進む(3日ぶりに開いた)
  const ctx3 = make(ON); run(ctx3, [ROW], 3 * 9, null, 9);
  check('③ 何日か開かなくても、日付どおりに年齢が進む', ctx3.T.amgbEntryOf('kiki', ROW).age === 9);
  // 超溺愛は40日・超スパルタは20日
  const len = (pol) => ctx.T.MASMON_CALC.lifeLen(pol, 30);
  check('③ 寿命の長さ 超溺愛40日・普通30日・超スパルタ20日', len(-3) === 40 && len(0) === 30 && len(3) === 20);
}
// ③ 対戦が先でも・last が null でも、年齢が一度に進まない(ミハリ5)
{
  const ctx = make(ON); const T = ctx.T; T.AMG_STORE.loaded = true; T.AMGP_STORE.loaded = true; T.AMGP_CSTORE.loaded = true; T.AMGB_STORE.loaded = true;
  T.assistantMasmonBondBattle('kiki', ROW, 'pvp', true, slotAt(S0));
  T.amgCatchUp(T.normalizeAssistantMasmonGrow(null), 'kiki', [ROW], SEED, S0 + 1);
  const b = T.amgbEntryOf('kiki', ROW);
  check('③ 対戦の記録が先にできても、寿命が来ない(年齢0から数える)', b.age === 0 && b.life === 0 && b.pop === 2, `年齢 ${b.age}・進み ${b.life}`);
  const n = T.normalizeAssistantMasmonBond({ mons: { 'kiki:1:Golem': { last: null, touch: '', fight: null, loy: null, age: null } } }).mons['kiki:1:Golem'];
  check('③ last・touch が null や空なら「まだ」(-1)・忠誠 null は既定50', n.last === -1 && n.touch === -1 && n.fight === -1 && n.loy === 50 && n.age === 0);
  T.AMGB_STORE.set({ v: 1, start: 1, mons: { 'kiki:1:Golem': n } });
  T.amgCatchUp(T.AMG_STORE.state, 'kiki', [ROW], SEED, S0 + 2);
  const b2 = T.amgbEntryOf('kiki', ROW);
  check('③ last が null の子も年齢が飛ばない', b2.age === 0 && b2.life === 0, `年齢 ${b2.age}`);
}
// ④ 育ちの速さ ×3
{
  const a = run(make(OFF), [ROW], 3 * 10); const ctx = make(ON); const b = run(ctx, [ROW], 3 * 10);
  const ga = sumSt(entry(a, ROW)) - sumSt(entry(run(make(OFF), [ROW], 0), ROW)); const gb = sumSt(entry(b, ROW)) - sumSt(entry(run(make(ON), [ROW], 0), ROW));
  check('④ 印が真だと10日の伸びが今の2倍以上(×3・型・方針)', gb >= ga * 2, `いま +${ga} → 絆 +${gb}`);
  const maxDay = Math.max(...Object.values(entry(b, ROW).log.reduce((m, l) => { const d = Math.floor(l.s / 3); m[d] = (m[d] || 0) + Object.values(l.g).reduce((x, y) => x + y, 0); return m; }, {})));
  check('④ 1日の伸びはおまかせで45まで(15×3)', maxDay <= 45, `いちばん伸びた日 +${maxDay}`);
  check('④ 経験も×3(10日で育成Lvが今より上)', entry(b, ROW).lv > entry(a, ROW).lv, `Lv ${entry(a, ROW).lv} → ${entry(b, ROW).lv}`);
}
// ⑤ 結果の種類
{
  const count = (loy) => {
    const ctx = make(ON); const T = ctx.T; T.AMGB_STORE.loaded = true;
    const c = {}; for (let i = 0; i < 4; i++) {
      const row = { ...ROW, slot: i + 1 };
      run(ctx, [row], 3 * 20, (s, TT) => { const k = TT.amgbKey('kiki', row.slot, row.monster); const b = TT.AMGB_STORE.state.mons[k]; if (b && b.loy !== loy) TT.amgbSave({ ...TT.AMGB_STORE.state, mons: { ...TT.AMGB_STORE.state.mons, [k]: { ...b, loy } } }); });
      for (const r of T.AMGB_STORE.state.mons[T.amgbKey('kiki', row.slot, row.monster)].rs) c[r.r] = (c[r.r] || 0) + 1;
    }
    return c;
  };
  // 結果は9つまでしか残らないので、全部の回を数えるには記録の前に覗く
  const tally = (loy) => {
    const ctx = make(ON); const T = ctx.T; const c = {};
    const C = T.MASMON_CALC; for (let i = 0; i < 2000; i++) { const r = C.resultOf({ loyal: loy, pol: 0, sab: 0.05, fail: 0.1, r: (i + 0.5) / 2000 }); c[r] = (c[r] || 0) + 1; }
    return c;
  };
  const hi = tally(90); const lo = tally(10);
  check('⑤ 忠誠が高いとズルが出ず大成功が多い・低いとズルとサボりが増える', !hi.cheat && (lo.cheat || 0) > 0 && (hi.great || 0) > (lo.great || 0) && (lo.skip || 0) > (hi.skip || 0), `忠誠90 ${JSON.stringify(hi)} / 忠誠10 ${JSON.stringify(lo)}`);
  const c = count(20);
  check('⑤ 実際の育成で結果が記録される(成功・大成功など)', Object.keys(c).length >= 2 && (c.ok || 0) > 0, JSON.stringify(c));
}
// ⑥ 叱る・褒める
{
  const ctx = make(ON); const T = ctx.T;
  run(ctx, [ROW], 6);
  const now = slotAt(S0 + 6);
  const k = T.amgbKey('kiki', ROW.slot, ROW.monster);
  const set = (r) => { const b = T.AMGB_STORE.state.mons[k]; T.amgbSave({ ...T.AMGB_STORE.state, mons: { ...T.AMGB_STORE.state.mons, [k]: { ...b, rs: [...b.rs, { s: S0 + 6, r }] } } }); };
  set('great'); const l0 = T.AMGB_STORE.state.mons[k].loy;
  const r1 = T.amgbReact('kiki', ROW, 'praise', now);
  check('⑥ 大成功を褒めると忠誠度が上がる・方針の点が甘い側へ', r1.ok && r1.dl > 0 && T.AMGB_STORE.state.mons[k].pp === -1, JSON.stringify(r1));
  check('⑥ 同じ結果には1回だけ', T.amgbReact('kiki', ROW, 'scold', now).ok === false);
  set('skip'); const r2 = T.amgbReact('kiki', ROW, 'scold', now);
  check('⑥ サボりを叱ると忠誠度が上がる・点が厳しい側へ', r2.ok && r2.dl > 0 && T.AMGB_STORE.state.mons[k].pp === 0);
  set('ok'); const r3 = T.amgbReact('kiki', ROW, 'scold', now);
  check('⑥ 成功を叱ると忠誠度が下がる', r3.ok && r3.dl < 0);
  set('ok'); const before = entry(T.AMG_STORE.state, ROW).str; const r4 = T.amgbReact('kiki', ROW, 'scold', now);
  check('⑥ 1日3回目の叱りはストレス +5', r4.over === true && entry(T.AMG_STORE.state, ROW).str === Math.min(100, before + 5), `${before} → ${entry(T.AMG_STORE.state, ROW).str}`);
  let mv = null; for (let i = 0; i < 12; i++) { set('great'); const r = T.amgbReact('kiki', ROW, 'praise', now); if (r.moved) { mv = r; break; } }
  check('⑥ 褒め続けると10点で1段(普通 → 甘い)', !!mv && mv.pol === -1 && T.AMGB_STORE.state.mons[k].pp === 0);
  check('⑥ 前の日の結果には叱る・褒めるはできない', T.amgbPendOf(T.AMGB_STORE.state.mons[k], slotAt(S0 + 12)) === null);
  check('⑥ 忠誠度は 0〜100 の中', T.AMGB_STORE.state.mons[k].loy <= 100 && T.AMGB_STORE.state.mons[k].loy >= 0 && l0 === 50);
}
// ⑦ 関わらない日・対戦の人気
{
  const ctx = make(ON); const T = ctx.T;
  run(ctx, [ROW], 3 * 10);
  const b = T.amgbEntryOf('kiki', ROW);
  check('⑦ 10日関わらないと忠誠度が 3 下がる(7日を超えた日から −1/日)', b.loy === 47, `忠誠 ${b.loy}`);
  T.assistantMasmonBondBattle('kiki', ROW, 'pvp', true, slotAt(S0 + 30)); T.assistantMasmonBondBattle('kiki', ROW, 'pvp', false, slotAt(S0 + 30));
  check('⑦ フレンド対戦で 勝ち +2・負け +0.5', T.amgbEntryOf('kiki', ROW).pop === 2.5);
  run(ctx, [ROW], 3 * 20);
}
// ⑧ 総合力とランク
{
  const ctx = make(ON); const T = ctx.T; run(ctx, [ROW], 0);
  const p = T.amgPowerOf('kiki', ROW); const e = entry(T.AMG_STORE.state, ROW);
  const want = Math.round(sumSt(e) * 2.5 + e.lv * 15 + 50 * 10);
  check('⑧ 総合力 = 6能力の合計×2.5 + 技 + Lv×15 + 忠誠×10 + 人気×10(技なし)', p && p.power === want, `${p && p.power} / ${want}`);
  check('⑧ ランクは区切りどおり', p && p.rank.key === T.MASMON_CALC.rankOf(want).key);
  check('⑧ 育成の値が無い子は null(「—」)', T.amgPowerOf('kiki', { slot: 7, monster: 'Golem' }) === null);
}
// ⑫ 冬眠・合体・対戦の人気
{
  const ctx = make(ON); const T = ctx.T; run(ctx, [ROW], 3 * 5);
  const k1 = T.amgbKey('kiki', 1, 'Golem');
  T.amgbSave({ ...T.AMGB_STORE.state, mons: { ...T.AMGB_STORE.state.mons, [k1]: { ...T.AMGB_STORE.state.mons[k1], loy: 77, pop: 40, pol: 2 } } });
  const bd = T.amgbCopyOf('kiki', 1, 'Golem');
  check('⑫ 眠らせる子の写しが取れる', bd && bd.loy === 77 && bd.age === 5);
  T.amgbWake('kiki', 1, 'Golem', 'Pixie', { ...bd, age: 12, last: 3 }, slotAt(S0 + 30));
  const w = T.AMGB_STORE.state.mons[T.amgbKey('kiki', 1, 'Pixie')];
  check('⑫ 起こすと写しが戻り、眠らせた子の行は消える・眠っていた日は年齢に入れない(last=今日)', w && w.loy === 77 && w.age === 12 && w.last === Math.floor((S0 + 30) / 3) && !T.AMGB_STORE.state.mons[k1]);
  T.amgbWake('kiki', 1, 'Pixie', 'Golem', null, slotAt(S0 + 30));
  check('⑫ 写しの無い子を起こすと既定から(前の子の値を引き継がない)', !T.AMGB_STORE.state.mons[k1] && !T.AMGB_STORE.state.mons[T.amgbKey('kiki', 1, 'Pixie')]);
  const c = T.amgbFuseChild('kiki', ROW, { ...bd, pop: 40 }, { ...bd, loy: 10, pop: 90, pol: -3 });
  check('⑫ 合体の子: 忠誠=主・人気=高い方の半分・方針と型=主・年齢0', c.loy === 77 && c.pop === 45 && c.pol === 2 && c.pp === 0 && c.gt === bd.gt && c.age === 0 && c.life === 0 && c.last === -1);
  const e = entry(T.AMG_STORE.state, ROW);
  const bp = T.amgbBedPower({ g: e, t: { learn: ['a', 'b'], m: { a: 20, b: 0 } }, bd });
  check('⑫ 冬眠の行の総合力(写しから)', bp && bp.power === Math.round(sumSt(e) * 2.5 + 220 + e.lv * 15 + 77 * 10 + 40 * 10), String(bp && bp.power));
  check('⑫ 写しの無い冬眠の行は忠誠50・人気0で数える・育成の写しが無ければ null', T.amgbBedPower({ g: e }).power === Math.round(sumSt(e) * 2.5 + e.lv * 15 + 500) && T.amgbBedPower({}) === null);
  const ctx2 = make(ON); const T2 = ctx2.T; run(ctx2, [ROW, ROW2], 3);
  T2.amgbBattleOnce('pvp-1', 'kiki', [ROW, ROW2], 'pvp', true, slotAt(S0 + 3)); T2.amgbBattleOnce('pvp-1', 'kiki', [ROW, ROW2], 'pvp', true, slotAt(S0 + 3));
  T2.amgbBattleOnce('ambb-2', 'kiki', [ROW], 'peer', false, slotAt(S0 + 3));
  check('⑫ 対戦の人気は1戦に1回だけ(フレンド対戦の勝ち+2・助手どうしの負け+0.2)', T2.amgbEntryOf('kiki', ROW).pop === 2.2 && T2.amgbEntryOf('kiki', ROW2).pop === 2 && T2.AMGB_STORE.state.bt.length === 2);
  const T3 = make(OFF).T; T3.AMGB_STORE.loaded = true;
  check('⑫ 印が偽なら対戦の人気は数えない', T3.amgbBattleOnce('x', 'kiki', [ROW], 'pvp', true) === false);
  const sleep = read('monster-hero/src/parts/56-assistant-life-masmon-sleep.jsx'); const beta = read('monster-hero/src/parts/56-assistant-masmon-battle-beta.jsx');
  check('⑫ 冬眠(正規化・前の子・入れ替え・合体・一覧)と対戦βの振り返りがつながっている', ["typeof amgbBedOk === 'function'", "typeof amgbCopyOf === 'function'", "typeof amgbWake === 'function'", "typeof amgbFuseChild === 'function'", "typeof AmgbBedTag === 'function'"].every(x => sleep.includes(x)) && beta.includes("typeof amgbBattleOnce !== 'function'"));
}
// ⑨ 同じ種なら同じ結果
{
  const a = run(make(ON), [ROW, ROW2], 60); const b = run(make(ON), [ROW, ROW2], 60);
  check('⑨ 同じ種なら同じ結果(60回)', JSON.stringify(a) === JSON.stringify(b));
}
// ⑩ 読み込む前は書かない
{
  const T = make(ON).T; T.AMGB_STORE.loaded = false;
  check('⑩ 読み込む前は書かない', T.amgbSave({ v: 1, start: 1, mons: {} }) === false && T.AMGB_STORE.state.start === -1);
}
// ⑪ 計算は MASMON_CALC を呼ぶだけ
{
  const body = bondSrc.replace(/\/\/.*$/gm, '');
  check('⑪ 総合力・寿命・結果の式を写していない(MASMON_CALC を呼ぶ)', /MASMON_CALC\.power\(/.test(body) && /MASMON_CALC\.resultOf\(/.test(body) && /MASMON_CALC\.lifeStep\(/.test(body) && !/\*\s*2\.5\b/.test(body) && !/0\.0025/.test(body));
  check('⑪ 保存は新しいキー mh_assistant_masmon_bond_v1 だけ', (body.match(/mh_assistant_[a-z_]+_v\d/g) || []).every(k => k === 'mh_assistant_masmon_bond_v1'));
}
console.log(ng ? `NG ${ng} 件` : 'すべて OK');
process.exit(ng ? 1 : 0);
