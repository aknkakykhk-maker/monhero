#!/usr/bin/env node
// 子ごとに上げた間合い適性(aptUp)の振り方ごとの勝率(2026-11-13 バトル部。開発部の育成の釣り合いを見る用)
//   node tools/masmon-battle/masmon-aptup-sim.js [組の数]
// 同じ種・同じ能力の1対1で、片方にだけ段数を足して左右入れ替えで回す。「得意」= その種でいちばん段の高い間合いから順
'use strict';
const { load, makeUnit } = require('./load.js');
const N = Number(process.argv[2]) || 1500;
const { engine, catalog } = load();
const I = engine._internal; const ids = Object.keys(catalog.species); const rng = engine.makeRng('aptup-sim');
const order = (sp) => [0, 1, 2, 3].sort((a, b) => I.aptSteps(catalog.species[sp].apt[b]) - I.aptSteps(catalog.species[sp].apt[a]));
const PLANS = {
  '+4 得意な間合いに全部': (o) => { const u = [0, 0, 0, 0]; u[o[0]] = 4; return u; },
  '+4 2つに2段ずつ': (o) => { const u = [0, 0, 0, 0]; u[o[0]] = 2; u[o[1]] = 2; return u; },
  '+8 2つに4段ずつ': (o) => { const u = [0, 0, 0, 0]; u[o[0]] = 4; u[o[1]] = 4; return u; },
  '+12 4つに3段ずつ': () => [3, 3, 3, 3],
  '+12 2つに6段ずつ': (o) => { const u = [0, 0, 0, 0]; u[o[0]] = 6; u[o[1]] = 6; return u; },
  '+18 得意から順に M まで': (o) => { const u = [0, 0, 0, 0]; let left = 18; for (const d of o) { const need = 11; const g = Math.min(left, need); u[d] = g; left -= g; } return u; },
  '+18 4つに4〜5段': () => [5, 5, 4, 4],
};
const team = (u) => ({ assistantId: 'atsu', tactics: 50, members: [u] });
for (const [label, plan] of Object.entries(PLANS)) {
  let w = 0, n = 0;
  for (let i = 0; i < N; i++) {
    const sp = ids[Math.floor(rng() * ids.length)];
    const u0 = makeUnit(engine, catalog, rng, { species: sp }); const u1 = { ...u0, aptUp: plan(order(sp)) };
    for (const sw of [0, 1]) {
      const r = engine.simulate({ seed: `p${i}-${sw}`, catalog, teamA: team(sw ? u0 : u1), teamB: team(sw ? u1 : u0) });
      if (r.winner !== 'draw') { n++; if (r.winner === (sw ? 'B' : 'A')) w++; }
    }
  }
  console.log(`${label.padEnd(16)} 上げた側の勝率 ${(w / n * 100).toFixed(1)}%`);
}
