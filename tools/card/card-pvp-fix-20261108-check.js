#!/usr/bin/env node
// MFバトルカード: 2026-11-08 マルチが止まった不具合の補正(92 の cardPvpFix20261108Once)を見張る(2026-11-08 ソランド)。
//   node tools/card/card-pvp-fix-20261108-check.js
// 見ているもの(ブラウザは使わない)
//   ① 履歴にその試合の「負け・投了」がある端末だけ、記録の pvp.lose を戻す(勝ち・ほかの数は触らない)
//   ② 印 mh_card_pvp_fix_20261108_v1 を同じ取引で書き、2回目は何もしない(二重に戻さない)
//   ③ 当てはまらない端末(ほかの人・その試合が勝ち)は印だけ書き、記録は1字も変えない
//   ④ 負けが0のときはマイナスにしない・壊れた履歴/記録でも落ちない・保存に失敗したら印も書かない(次に開いたときにやり直す)
//   ⑤ 84 の load が記録を読む前に呼んでいる
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const PARTS = path.resolve(__dirname, '..', '..', 'monster-hero', 'src', 'parts');
let fails = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK' : 'NG'}: ${msg}`); if (!c) fails += 1; };
const read = (f) => fs.readFileSync(path.join(PARTS, f), 'utf8');
const cut = (src, name) => {
  const at = src.search(new RegExp(`^const ${name} = `, 'm'));
  if (at < 0) throw new Error(`${name} が見つからない`);
  let depth = 0, q = null;
  for (let i = at; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '\\') { i += 1; continue; } if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (ch === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if ('({['.includes(ch)) depth += 1;
    else if (')}]'.includes(ch)) depth -= 1;
    else if (ch === ';' && depth === 0) return src.slice(at, i + 1);
  }
  throw new Error(`${name} の終わりが見つからない`);
};
const core = read('82-card-battle-core.jsx');
const hist = read('92-card-pvp-history.jsx');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const code = [
  fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8'), ';', core, ';',
  ...['CARD_PVP_HISTORY_MAX', 'CARD_PVP_HISTORY_KEY', 'cardPvpHistText', 'cardPvpHistCards', 'cardPvpHistDeck', 'cardPvpHistInt', 'cardPvpNormalizeHistoryEntry', 'cardPvpNormalizeHistory',
    'CARD_PVP_FIX_20261108_KEY', 'CARD_PVP_FIX_20261108_MATCHES', 'cardPvpFix20261108Plan', 'cardPvpFix20261108Once'].map((n) => cut(hist, n)),
  'this.E = { cardPvpFix20261108Once, cardPvpFix20261108Plan, CARD_PVP_FIX_20261108_KEY, CARD_SAVE_KEYS, CARD_PVP_HISTORY_KEY };',
].join('\n');
const ctx = { console, Math, JSON, Object, Array, Number, String, Set, Map }; vm.createContext(ctx); vm.runInContext(code, ctx);
const E = ctx.E;
const RK = E.CARD_SAVE_KEYS.record, HK = E.CARD_PVP_HISTORY_KEY, FK = E.CARD_PVP_FIX_20261108_KEY;
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const mkStore = (init, failWrite = false) => {
  const store = clone(init);
  const getValue = async (k, d) => (k in store ? clone(store[k]) : d);
  const setValue = async (k, v) => { if (failWrite && k === RK) return; store[k] = clone(v); };
  const saveAll = async (entries, g, s) => {
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    await Promise.all(entries.map(({ key, next }) => s(key, next, false)));
    const got = await Promise.all(entries.map(({ key }) => g(key, null, false)));
    if (entries.every(({ next }, i) => same(got[i], next))) return true;
    await Promise.all(entries.map(({ key, before }) => (before === null || before === undefined ? delete store[key] : s(key, before, false))));
    return false;
  };
  return { store, getValue, setValue, saveAll };
};
const row = (match, outcome, reason) => ({ match, at: 1, room: 'private', outcome, reason, turns: 3, verify: 'skip', foe: { name: 'あいて' } });
const rec = (win, lose) => ({ cpu: { win: 3, lose: 2, surrender: 1 }, pvp: { win, lose }, beaten: { mua: true }, recent: [], byLevel: {} });

(async () => {
  // ① ② あつの端末(試合3を投了)
  const a = mkStore({ [HK]: [row('mmw7e6d8i6v7uxd', 'lose', '投了'), row('mmw7ecam4ptfvzi', 'win', '相手の投了'), row('zzzzzzzz1', 'lose', '投了')], [RK]: rec(16, 8) });
  const r1 = await E.cardPvpFix20261108Once(a.getValue, a.setValue, a.saveAll);
  ok(r1.saved && r1.undone === 1 && a.store[RK].pvp.lose === 7 && a.store[RK].pvp.win === 16, `① あつの端末: 投了の負けだけ1つ戻す(8 → ${a.store[RK].pvp.lose}・勝ちは ${a.store[RK].pvp.win})`);
  ok(a.store[RK].cpu.win === 3 && a.store[RK].beaten.mua === true, '① ほかの数(助手と対戦の記録)は触らない');
  ok(a.store[FK] && a.store[FK].undone === 1 && Array.isArray(a.store[FK].matches) && a.store[FK].matches[0] === 'mmw7e6d8i6v7uxd', '② 印に戻した数と試合を書く');
  const r2 = await E.cardPvpFix20261108Once(a.getValue, a.setValue, a.saveAll);
  ok(!r2.saved && a.store[RK].pvp.lose === 7, '② 2回目は何もしない(二重に戻さない)');
  // えるびんの端末(試合4を投了)
  const b = mkStore({ [HK]: [row('mmw7ecam4ptfvzi', 'lose', '投了'), row('mmw7e6d8i6v7uxd', 'win', '相手の投了')], [RK]: rec(7, 6) });
  await E.cardPvpFix20261108Once(b.getValue, b.setValue, b.saveAll);
  ok(b.store[RK].pvp.lose === 5 && b.store[RK].pvp.win === 7, `① えるびんの端末: 6 → ${b.store[RK].pvp.lose}`);
  // ③ ほかの人
  const before = rec(4, 4);
  const c = mkStore({ [HK]: [row('aaaaaaaa1', 'lose', '投了')], [RK]: before });
  await E.cardPvpFix20261108Once(c.getValue, c.setValue, c.saveAll);
  ok(JSON.stringify(c.store[RK]) === JSON.stringify(before) && c.store[FK] && c.store[FK].undone === 0, '③ 当てはまらない端末は印だけ書き、記録は1字も変えない');
  const c2 = mkStore({ [HK]: [row('mmw7e6d8i6v7uxd', 'lose', '時間切れ')], [RK]: rec(1, 1) });
  await E.cardPvpFix20261108Once(c2.getValue, c2.setValue, c2.saveAll);
  ok(c2.store[RK].pvp.lose === 1, '③ 同じ試合でも投了でなければ戻さない');
  // ④
  const d = mkStore({ [HK]: [row('mmw7e6d8i6v7uxd', 'lose', '投了')], [RK]: rec(0, 0) });
  await E.cardPvpFix20261108Once(d.getValue, d.setValue, d.saveAll);
  ok(d.store[RK].pvp.lose === 0, '④ 負けが0ならマイナスにしない');
  const e = mkStore({ [HK]: 'こわれた', [RK]: 'こわれた' });
  let threw = false; try { await E.cardPvpFix20261108Once(e.getValue, e.setValue, e.saveAll); } catch (_) { threw = true; }
  ok(!threw && e.store[FK] && e.store[FK].undone === 0, '④ 壊れた履歴・記録でも落ちない(印だけ)');
  const f = mkStore({ [HK]: [row('mmw7e6d8i6v7uxd', 'lose', '投了')], [RK]: rec(2, 2) }, true);
  const rf = await E.cardPvpFix20261108Once(f.getValue, f.setValue, f.saveAll);
  ok(!rf.saved && !(FK in f.store) && f.store[RK].pvp.lose === 2, '④ 記録の保存に失敗したら印も書かない(次に開いたときにやり直す)');
  // ⑤
  const scr = read('84-screen-card-battle.jsx');
  const i1 = scr.indexOf('cardPvpFix20261108Once(storeGet'), i2 = scr.indexOf('storeGet(K.record, null)');
  ok(i1 > 0 && i2 > 0 && i1 < i2, '⑤ 84 の load が、記録を読む前に補正を呼ぶ');
  console.log(fails ? `${fails}件 NG` : 'すべて OK');
  process.exit(fails ? 1 : 0);
})();
