#!/usr/bin/env node
// マスモンの対戦の距離適性の効き目を見くらべる試算(2026-11-13 バトル部・社長「距離適性はモンサク用に効果調整して。与ダメや被ダメ・命中・回避等に影響。C を 0% として増減」)
//   node tools/masmon-battle/masmon-apt-sim.js <戦数> '与ダメ,被ダメ,命中,回避[,A より上の刻み]' ...    (1段あたりの割合。例 '0.04,0.02,0.015,0.015,0.5')
// 芯の定数だけを差し替えた写しで回す。出すもの:
//   ① 同じ能力・種だけ違う1対1(左右入れ替え): 間合いの得手(4つの間合いの段の平均)が良い側の勝率/差が1.5段以上の組の勝率/決着の長さ
//   ② 同じ種・同じ能力で、片方の「いちばん得意な間合い」だけを A・S・SS・M に上げたとき/4つ全部を M にしたときの、上げた側の勝率(M の子が強すぎないか)
'use strict';
const fs = require('fs'); const path = require('path'); const os = require('os');
const { load, makeUnit } = require('./load.js');
const N = Number(process.argv[2]) || 2000;
const cfgs = process.argv.slice(3);
const { data } = load();
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'data', 'assistant-masmon-battle.js'), 'utf8');
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mas-'));
const pc = (x) => `${(x * 100).toFixed(1)}%`;
for (const c of cfgs) {
  const [dm, df, ht, ev, ab] = c.split(',').map(Number);
  const t = src.replace(/const APT_DMG = [\d.]+;/, `const APT_DMG = ${dm};`).replace(/const APT_DEF = [\d.]+;/, `const APT_DEF = ${df};`)
    .replace(/const APT_HIT = [\d.]+;/, `const APT_HIT = ${ht};`).replace(/const APT_EVA = [\d.]+;/, `const APT_EVA = ${ev};`)
    .replace(/const APT_ABOVE_A = [\d.]+;/, `const APT_ABOVE_A = ${Number.isFinite(ab) ? ab : 1};`);
  const f = path.join(DIR, `e-${c.replace(/[,.]/g, '_')}.js`); fs.writeFileSync(f, t);
  const engine = require(f); const catalog = engine.buildCatalog(data);
  const ids = Object.keys(catalog.species); const rng = engine.makeRng(`apt-${c}`);
  const score = (sp) => catalog.species[sp].apt.reduce((a, g) => a + engine._internal.aptSteps(g), 0) / 4;
  const team = (u) => ({ assistantId: 'atsu', tactics: 50, members: [u] });
  // ①
  let w = 0, n = 0, bw = 0, bn = 0, rounds = 0, games = 0;
  for (let i = 0; i < N; i++) {
    const a = ids[Math.floor(rng() * ids.length)], b = ids[Math.floor(rng() * ids.length)];
    const sa = score(a), sb = score(b); if (sa === sb) { i--; continue; }
    const ua = makeUnit(engine, catalog, rng, { species: a }); const ub = { ...makeUnit(engine, catalog, rng, { species: b }), stats: { ...ua.stats }, lv: ua.lv };
    for (const sw of [0, 1]) {
      const A = sw ? ub : ua, B = sw ? ua : ub;
      const r = engine.simulate({ seed: `a${i}-${sw}`, catalog, teamA: team(A), teamB: team(B) });
      games++; rounds += r.rounds;
      const better = score(A.species) > score(B.species) ? 'A' : 'B';
      if (r.winner !== 'draw') { n++; if (r.winner === better) w++; if (Math.abs(sa - sb) >= 1.5) { bn++; if (r.winner === better) bw++; } }
    }
  }
  // ② いちばん得意な間合いだけ上げる(種の写しを作る)
  const up = {};
  for (const g of ['A', 'S', 'SS', 'M', 'M4']) {
    let uw = 0, un = 0;
    for (let i = 0; i < Math.max(300, N / 3); i++) {
      const sp = ids[Math.floor(rng() * ids.length)]; const base = catalog.species[sp];
      const best = base.apt.reduce((bi, gr, k, arr) => (engine._internal.aptSteps(gr) > engine._internal.aptSteps(arr[bi]) ? k : bi), 0);
      const upId = `${sp}__up`; catalog.species[upId] = { ...base, apt: base.apt.map((x, k) => (g === 'M4' ? 'M' : k === best ? g : x)) };
      const u0 = makeUnit(engine, catalog, rng, { species: sp }); const u1 = { ...u0, species: upId };
      for (const sw of [0, 1]) {
        const r = engine.simulate({ seed: `u${g}${i}-${sw}`, catalog, teamA: team(sw ? u0 : u1), teamB: team(sw ? u1 : u0) });
        if (r.winner !== 'draw') { un++; if (r.winner === (sw ? 'B' : 'A')) uw++; }
      }
      delete catalog.species[upId];
    }
    up[g] = uw / un;
  }
  console.log(`${c.padEnd(22)} 得手の良い側 ${pc(w / n)}(差1.5段以上 ${pc(bw / bn)})・平均${(rounds / games).toFixed(1)}R | 得意な間合いを上げた側: A ${pc(up.A)}・S ${pc(up.S)}・SS ${pc(up.SS)}・M ${pc(up.M)}・4つ全部 M ${pc(up.M4)}`);
}
