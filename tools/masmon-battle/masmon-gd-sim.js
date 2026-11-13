#!/usr/bin/env node
// ガッツダウン(技の gd)を強くしたときの試合の釣り合いの見積もり(2026-11-13 バトル部・社長「ガッツダウンの数値が弱く見える」→ 技表の値そのものを強くする)。
//   node tools/masmon-battle/masmon-gd-sim.js <技表の js> <戦数> <倍率 or 式>...   例: ... tech2.js 1500 1 1.5 2 '+5'
//   倍率: gd を k 倍(四捨五入・0 の技は 0 のまま・芯の上限 45 で切る)/'+n': 0 でない技に n を足す
//   出すもの(小さく): 3対3 の平均ラウンド・判定(ラウンド上限)の割合・手のうち「ためる」の割合・1試合のガッツを削った量・
//   ガッツが技に足りない手番の割合/1対1 の種ごとの勝率(同じ能力・左右入れ替え)の幅(最低〜最高)と 38〜70% の外の種の数
'use strict';
const fs = require('fs'); const path = require('path');
const { load, makeUnit } = require('./load.js');
const [file, nArg, ...cfgs] = process.argv.slice(2);
if (!file || !cfgs.length) { console.log('使い方: masmon-gd-sim.js <技表の js> <戦数> <倍率|+n>...'); process.exit(0); }
const N = Number(nArg) || 1000;
const { engine, data } = load();
const T = new Function(`${fs.readFileSync(file, 'utf8')};return ASSISTANT_MASMON_TECHS;`)();
const GD_MAX = (engine.TECH_LIMITS && engine.TECH_LIMITS.gd) ? engine.TECH_LIMITS.gd[1] : 45;
const scaled = (cfg) => {
  const t = JSON.parse(JSON.stringify(T));
  const f = cfg.startsWith('+') ? (g) => (g > 0 ? g + Number(cfg.slice(1)) : 0) : (g) => Math.round(g * Number(cfg));
  for (const v of Object.values(t.species || t)) for (const x of (Array.isArray(v) ? v : v.techs || [])) x.gd = Math.min(GD_MAX, Math.max(0, f(Number(x.gd) || 0)));
  return engine.buildCatalog({ ALL_PLAYER_MONSTERS: data.ALL_PLAYER_MONSTERS, ASSISTANT_MASMON_TECHS: t });
};
const pct = (a, b) => (b ? `${(a / b * 100).toFixed(1)}%` : '—');
console.log(`技表 ${path.basename(file)}・各 ${N} 戦\n`);
console.log('| gd | 3対3 平均R | 判定 | ためる | 削ったガッツ/試合 | 技に足りない手番 | 1対1 種の勝率の幅 | 38〜70% の外 |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const cfg of cfgs) {
  const catalog = scaled(cfg);
  const ids = Object.keys(catalog.species);
  let rounds = 0, judge = 0, acts = 0, charge = 0, gdSum = 0, short = 0, turns = 0;
  for (let i = 0; i < N; i++) {
    const rng = engine.makeRng(`gd-${i}`);
    const team = () => ({ assistantId: 'atsu', tactics: 40, members: [0, 1, 2].map(() => makeUnit(engine, catalog, rng, { total: 1800, lv: 50 })) });
    const r = engine.simulate({ seed: `gd-${i}`, catalog, teamA: team(), teamB: team() });
    rounds += r.rounds; if (r.reason === 'judge') judge++;
    for (const e of r.log) {
      if (['tech', 'charge', 'guard', 'move', 'swap'].includes(e.ev)) { acts++; if (e.ev === 'charge') charge++; }
      if (e.ev === 'tech' && e.hit && Number.isFinite(e.gd)) gdSum += e.gd;
      if (e.ev === 'charge' && e.why === 'noGuts') short++;
      if (['tech', 'charge', 'guard', 'move'].includes(e.ev)) turns++;
    }
  }
  // 1対1: 種ごと、同じ能力の相手(種はほか全部)と左右入れ替えて
  const win = {}; const M = Math.max(4, Math.round(N / 60));
  for (const sp of ids) {
    let w = 0, n = 0;
    for (const op of ids) { if (op === sp) continue;
      for (let j = 0; j < M; j++) {
        const st = makeUnit(engine, catalog, engine.makeRng(`st-${j}`), { total: 1800, lv: 50 }).stats;
        const a = { assistantId: 'atsu', tactics: 40, members: [makeUnit(engine, catalog, () => 0.5, { species: sp, stats: st, lv: 50 })] };
        const b = { assistantId: 'atsu', tactics: 40, members: [makeUnit(engine, catalog, () => 0.5, { species: op, stats: st, lv: 50 })] };
        const r1 = engine.simulate({ seed: `v-${sp}-${op}-${j}`, catalog, teamA: a, teamB: b }).winner;
        const r2 = engine.simulate({ seed: `w-${sp}-${op}-${j}`, catalog, teamA: b, teamB: a }).winner;
        w += (r1 === 'A' ? 1 : r1 === 'draw' ? 0.5 : 0) + (r2 === 'B' ? 1 : r2 === 'draw' ? 0.5 : 0); n += 2; } }
    win[sp] = w / n;
  }
  const ws = Object.values(win), lo = Math.min(...ws), hi = Math.max(...ws), out = ws.filter((x) => x < 0.38 || x > 0.70).length;
  console.log(`| ${cfg} | ${(rounds / N).toFixed(1)} | ${pct(judge, N)} | ${pct(charge, acts)} | ${(gdSum / N).toFixed(0)} | ${pct(short, turns)} | ${(lo * 100).toFixed(0)}〜${(hi * 100).toFixed(0)}% | ${out} |`);
}
