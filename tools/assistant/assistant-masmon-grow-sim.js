#!/usr/bin/env node
// 助手のマスモンの育成の試算(社長 11-11「手を加えるほど強くなる。何もしない人との差」)。検査ではなく、表を作る道具。
//   node tools/assistant/assistant-masmon-grow-sim.js [日数=30] → 関わり方3通りの、能力の合計(と6能力)を出す
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const masmon = fs.readFileSync(path.join(root, 'monster-hero/src/parts/56-assistant-life-masmon.jsx'), 'utf8');
const all = fs.readFileSync(path.join(root, 'monster-hero/src/parts/56-assistant-life-masmon-grow.jsx'), 'utf8');
const grow = all.slice(0, all.indexOf('// ---------- 画面'));
const rngLine = masmon.match(/^const assistantMasmonRng = .*$/m)[0];
const DAYS = Number(process.argv[2]) || 30;
const mons = [
  { aid: 'kiki', row: { slot: 1, monster: 'Golem', lv: 20, grow: '攻撃型' }, label: 'きき・ゴーレム(攻撃型)' },
  { aid: 'mua', row: { slot: 1, monster: 'Pixie', lv: 15, grow: 'すばやさ型' }, label: 'みゅあ・ピクシー(すばやさ型)' },
  { aid: 'momosuke', row: { slot: 1, monster: 'Mocchi', lv: 15, grow: 'ライフ型' }, label: 'ももすけ・モッチー(ライフ型)' },
];
const POL = { '攻撃型': 'pow', 'すばやさ型': 'eva', 'ライフ型': 'life' };
const run = (m, style, seed) => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext([rngLine, "const assistantMasmonGrowKind = (g) => String(g || '').split('(')[0];", 'const assistantMasmonStats = () => ({ hp: 0.4, atk: 0.4, def: 0.4 });', 'const RELEASE_FLAGS = { assistantMasmonGrow: true };', grow,
    'this.T = { normalizeAssistantMasmonGrow, amgCatchUp, amgView, amgPick, amgAdvise, AMG_STORE, AMG_KEYS };'].join('\n'), ctx);
  const T = ctx.T; const start = Date.UTC(2026, 10, 11, 0, 0); const slot0 = Math.floor((start + 5 * 3600000) / 86400000) * 3;
  const at = (s) => (Math.floor(s / 3) * 86400000) - 5 * 3600000 + [0, 8, 14][s % 3] * 3600000 + 60000; // その回が始まった時刻
  let st = T.amgCatchUp(T.normalizeAssistantMasmonGrow(null), m.aid, [m.row], seed, slot0);
  const st0 = { ...st.mons[m.aid][`1:${m.row.monster}`].st };
  for (let s = slot0 + 1; s <= slot0 + DAYS * 3; s++) {
    T.AMG_STORE.set(st); const now = at(s - 1); const e = st.mons[m.aid][`1:${m.row.monster}`]; const day = Math.floor(s / 3);
    if (style === 'some') { if (day % 2 === 0) T.amgView(m.aid, 1, now); if (day % 7 === 0 && s % 3 === 0) T.amgAdvise(m.aid, 1, e.st[POL[m.row.grow]] < 900 ? POL[m.row.grow] : 'auto', now); }
    if (style === 'much') { T.amgView(m.aid, 1, now); const k = e.st[POL[m.row.grow]] < 900 ? POL[m.row.grow] : T.AMG_KEYS.reduce((x, y) => (e.st[y] < e.st[x] ? y : x)); T.amgPick(m.aid, 1, e.fat >= 45 ? { a: 'rest' } : { a: e.fat < 30 ? 'heavy' : 'light', k }, now); }
    st = T.amgCatchUp(T.AMG_STORE.state, m.aid, [m.row], seed, s);
  }
  const e = st.mons[m.aid][`1:${m.row.monster}`];
  return { sum0: Object.values(st0).reduce((a, b) => a + b, 0), sum: Object.values(e.st).reduce((a, b) => a + b, 0), st: e.st, lv: e.lv, main: e.st[POL[m.row.grow]] - st0[POL[m.row.grow]] };
};
const STYLES = [['none', '任せる(何もしない)'], ['some', 'ときどき(2日に1回見る・週1回相談)'], ['much', 'よく関わる(毎日見る・毎日3回訓練を指定)']];
const rows = [];
for (const m of mons) for (const [k, name] of STYLES) {
  const rs = [1, 2, 3, 4, 5].map(i => run(m, k, `sim-${i}`)); const avg = (f) => Math.round(rs.reduce((a, r) => a + f(r), 0) / rs.length);
  rows.push({ mon: m.label, style: name, start: avg(r => r.sum0), end: avg(r => r.sum), grew: avg(r => r.sum - r.sum0), main: avg(r => r.main), lv: avg(r => r.lv) });
}
console.log(JSON.stringify(rows, null, 1));
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify({ days: DAYS, rows }, null, 1));
