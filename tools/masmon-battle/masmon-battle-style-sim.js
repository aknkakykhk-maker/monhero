#!/usr/bin/env node
// 助手マスモン対戦 β の「作戦」「交代の早さ」の上書き案を、鏡の対戦で測る(2026-11-11 ミセカタ2)。資料 docs/progress/assistant-peer/masmon-battle/beta/STYLE-PLAN.md
const { load, makeUnit } = require('./load.js');
const { engine, catalog } = load();
const PLANS = {
  omakase: {},
  attack: { aggr: 1.25, caution: 0.8, thrift: 0.85, gamble: 1.2 },
  guard: { aggr: 0.85, caution: 1.3, thrift: 1.2, gamble: 0.8 },
  range: { mobility: 1.35, thrift: 1.05 },
  big: { gamble: 1.45, aggr: 1.1, thrift: 0.8 },
};
const SWAPS = { omakase: null, early: 1.5, late: 0.55 };
const mk = (aid, plan, swap) => { const b = engine.STYLES[aid]; const o = {}; for (const [k, f] of Object.entries(PLANS[plan])) o[k] = Math.max(0.4, Math.min(1.8, b[k] * f)); if (SWAPS[swap]) o.swap = Math.max(0.3, Math.min(2, b.swap * SWAPS[swap])); return o; };
const N = 1500; const res = {};
for (const aid of ['atsu', 'mua', 'erubin']) for (const plan of Object.keys(PLANS)) for (const swap of Object.keys(SWAPS)) {
  if (plan !== 'omakase' && swap !== 'omakase') continue;
  let w = 0, sw = 0, rounds = 0;
  for (let k = 0; k < N; k++) {
    const rng = engine.makeRng('s' + k);
    const mem = Array.from({ length: 3 }, () => makeUnit(engine, catalog, rng, {}));
    const flip = k % 2;
    const me = { assistantId: aid, tactics: 40, members: mem, style: mk(aid, plan, swap) };
    const foe = { assistantId: aid, tactics: 40, members: mem };
    const r = engine.simulate({ seed: 'x' + k, catalog, teamA: flip ? foe : me, teamB: flip ? me : foe, trace: true });
    if (r.winner === (flip ? 'B' : 'A')) w++; else if (r.winner === 'draw') w += 0.5;
    sw += r.log.filter(e => e.ev === 'swap' && e.side === (flip ? 'B' : 'A')).length; rounds += r.rounds;
  }
  res[`${aid} ${plan} ${swap}`] = `勝率${(w / N * 100).toFixed(1)}% 交代${(sw / N).toFixed(2)}回 R${(rounds / N).toFixed(1)}`;
}
console.log(res);
