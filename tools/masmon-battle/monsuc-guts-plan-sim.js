#!/usr/bin/env node
// モンサクの試合のガッツ回復の案の試算(r1115-084)。node tools/masmon-battle/monsuc-guts-plan-sim.js [戦数]
//   案 = 自然回復の幅(最小,最大)・移動/ガード・ためる・技の消費の倍率。芯の定数を差し替えた写しで、モンサクの規則(30ターン判定)の1対1を回す。
//   出す数: 技を1回撃つのに何ターンかかるか(ランク1〜5=技の消費を5分位に分けた代わり・平均の自然回復÷消費)、ためる・移動を選ぶ割合、
//   30ターン判定まで行く割合、判定で A が勝つ割合、回復の速い種と遅い種の勝率差
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const W = path.resolve(__dirname, '..', '..'); const N = Number(process.argv[2]) || 600;
const { load, makeUnit } = require('./load.js'); const { data, engine: e0 } = load();
const src = fs.readFileSync(path.join(W, 'monster-hero/data/assistant-masmon-battle.js'), 'utf8');
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'gps-'));
const PLANS = [
  ['現状', 5, 15, 10, 22, 1],
  ['案1 自然回復を半分', 3, 8, 10, 22, 1],           // 幅 5〜15 → 3〜8(真ん中 10 → 5〜6)
  ['案2 消費を1.5倍', 5, 15, 10, 22, 1.5],
  ['案3 回復7割・消費1.25倍', 4, 11, 10, 22, 1.25],
  ['採用 r1115-090 全部半分(回復3〜8・移動5・ため11)', 3, 8, 5, 11, 1],
];
const pc = (x) => (x * 100).toFixed(1) + '%';
for (const [name, mn, mx, mv, ch, mul] of PLANS) {
  const t = src.replace(/const GUTS_REGEN_MIN = \d+;/, `const GUTS_REGEN_MIN = ${mn};`).replace(/const GUTS_REGEN_MAX = \d+;/, `const GUTS_REGEN_MAX = ${mx};`)
    .replace(/const GUTS_MOVE = \d+;/, `const GUTS_MOVE = ${mv};`).replace(/const GUTS_CHARGE = \d+;/, `const GUTS_CHARGE = ${ch};`);
  const f = path.join(DIR, `e${PLANS.findIndex(p => p[0] === name)}.js`); fs.writeFileSync(f, t);
  const engine = require(f); const catalog = engine.buildCatalog(data);
  for (const sp of Object.values(catalog.species)) for (const tk of sp.techs) tk.guts = Math.round(tk.guts * mul);
  const ids = Object.keys(catalog.species); const rng = engine.makeRng('gp-' + name);
  const costs = Object.values(catalog.species).flatMap(s => s.techs.map(x => x.guts)).sort((a, b) => a - b);
  const q = (k) => costs[Math.min(costs.length - 1, Math.floor(costs.length * k))];
  const regenAvg = ids.reduce((s, id) => s + catalog.species[id].regen, 0) / ids.length;
  const slow = ids.reduce((m, id) => Math.min(m, catalog.species[id].regen), 99), fast = ids.reduce((m, id) => Math.max(m, catalog.species[id].regen), 0);
  const rankCost = [0.1, 0.3, 0.5, 0.7, 0.9].map(q);
  const act = { tech: 0, move: 0, guard: 0, charge: 0 }; let games = 0, rounds = 0, j = 0, jA = 0, aw = 0, fastW = 0, fastN = 0;
  for (let i = 0; i < N; i++) {
    const A = makeUnit(engine, catalog, rng, { species: ids[Math.floor(rng() * ids.length)] }), B = { ...makeUnit(engine, catalog, rng, { species: ids[Math.floor(rng() * ids.length)] }) }; B.stats = { ...A.stats }; B.lv = A.lv;
    const r = engine.simulate({ seed: `gp${i}`, catalog, roundLimit: 30, judge: 'three', teamA: { assistantId: 'atsu', tactics: 50, members: [A] }, teamB: { assistantId: 'atsu', tactics: 50, members: [B] } });
    games++; rounds += r.rounds; if (r.winner === 'A') aw++;
    if (r.reason === 'judge') { j++; if (r.winner === 'A') jA++; }
    const ra = catalog.species[A.species].regen, rb = catalog.species[B.species].regen;
    if (Math.abs(ra - rb) >= 4) { fastN++; if (r.winner === (ra > rb ? 'A' : 'B')) fastW++; }
    for (const e of r.log) { if (e.ev === 'tech') act.tech++; else if (e.ev === 'move') act.move++; else if (e.ev === 'guard') act.guard++; else if (e.ev === 'charge' && e.why !== 'sulk') act.charge++; }
  }
  const tot = act.tech + act.move + act.guard + act.charge;
  console.log(`■${name}(自然回復 ${mn}〜${mx}・平均 ${regenAvg.toFixed(1)}・移動 ${mv}・ため ${ch}・消費×${mul})`);
  console.log(`  ランク1〜5の消費の目安 ${rankCost.join('/')} → 自然回復だけで撃てる間隔(平均の種): ${rankCost.map(c => (c / regenAvg).toFixed(1)).join('/')} ターン`);
  console.log(`  遅い種(${slow})・速い種(${fast})のランク3の間隔: ${(rankCost[2] / slow).toFixed(1)} / ${(rankCost[2] / fast).toFixed(1)} ターン`);
  console.log(`  行動の割合: 技${pc(act.tech / tot)} 移動${pc(act.move / tot)} ガード${pc(act.guard / tot)} ため${pc(act.charge / tot)} ・平均 ${(rounds / games).toFixed(1)} ターン`);
  console.log(`  30ターン判定まで行く ${pc(j / games)}(判定で A の勝ち ${j ? pc(jA / j) : '-'})・全体の A の勝ち ${pc(aw / games)}・回復の差4以上で速い側の勝ち ${fastN ? pc(fastW / fastN) : '-'}(${fastN}戦)`);
}
