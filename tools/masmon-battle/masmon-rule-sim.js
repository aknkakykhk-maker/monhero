#!/usr/bin/env node
// 試合の決まりの試算(r1115-110 移動にガッツ・ふきとばし / r1115-111 全試合の決まりをそろえる)。
//   node tools/masmon-battle/masmon-rule-sim.js [戦数] [比べる元の芯のファイル]
//   同じ編成どうし(同じ能力・種はばらばら)を、モンサク(1体・30ターン)とフレンド対戦(3体)の形で多数回す。
//   出す数: 1試合のラウンド数・技を撃てた回数・移動し合い(移動の行が続いた)の最長・打ち切り判定の割合・勝ち負けの偏り(A の勝ち・先に置いた側・回復の速い側)
//   元の芯を渡さなければ、作業中の芯だけを回す。元の芯は git の main から書き出して渡す:
//     git show origin/main:monster-hero/data/assistant-masmon-battle.js > <一時ファイル>
'use strict';
const path = require('path');
const { load, makeUnit } = require('./load.js');
const N = Number(process.argv[2]) || 400;
const oldFile = process.argv[3] ? path.resolve(process.argv[3]) : null;
const { data, engine: cur } = load();

const pc = (x) => (x * 100).toFixed(1) + '%';
// 移動し合いの最長: 移動(move・ふきとばし blow)の行が、技・ガード・ためるを挟まずに続いた数(技で移った行は数えない)
const moveRun = (log) => {
  let best = 0, run = 0;
  for (const e of log) {
    if ((e.ev === 'move' && e.why !== 'techMove' && e.why !== 'blown') || e.ev === 'blow') { run++; if (run > best) best = run; }
    else if (['tech', 'guard', 'charge', 'swap'].includes(e.ev)) run = 0;
  }
  return best;
};

const runSet = (label, engine, mkInput) => {
  const catalog = engine.buildCatalog(data);
  const ids = Object.keys(catalog.species);
  const rng = engine.makeRng('rule-sim');
  let rounds = 0, techs = 0, hits = 0, runMax = 0, runSum = 0, run10 = 0, judge = 0, aw = 0, draw = 0, fastW = 0, fastN = 0, blows = 0;
  const act = { tech: 0, move: 0, guard: 0, charge: 0, swap: 0, blow: 0 };
  for (let i = 0; i < N; i++) {
    const size = mkInput.size;
    const mk = () => makeUnit(engine, catalog, rng, { species: ids[Math.floor(rng() * ids.length)] });
    const A = [], B = [];
    for (let k = 0; k < size; k++) { const a = mk(), b = mk(); b.stats = { ...a.stats }; b.lv = a.lv; A.push(a); B.push(b); }
    const r = engine.simulate({ seed: `rs${i}`, catalog, balance: 'A', ...mkInput.rule,
      teamA: { assistantId: 'atsu', tactics: 50, members: A }, teamB: { assistantId: 'atsu', tactics: 50, members: B } });
    rounds += r.rounds; if (r.winner === 'A') aw++; if (r.winner === 'draw') draw++; if (r.reason === 'judge') judge++;
    const m = moveRun(r.log); runSum += m; if (m > runMax) runMax = m; if (m >= 10) run10++;
    for (const e of r.log) {
      if (e.ev === 'tech') { techs++; if (e.hit) hits++; }
      if (act[e.ev] !== undefined && !(e.ev === 'charge' && e.why === 'sulk') && !(e.ev === 'move' && (e.why === 'techMove' || e.why === 'blown'))) act[e.ev]++;
      if (e.ev === 'blow') blows++;
    }
    const ra = A.reduce((s, u) => s + catalog.species[u.species].regen, 0), rb = B.reduce((s, u) => s + catalog.species[u.species].regen, 0);
    if (Math.abs(ra - rb) >= 3 * size) { fastN++; if (r.winner === (ra > rb ? 'A' : 'B')) fastW++; }
  }
  const tot = Object.values(act).reduce((a, b) => a + b, 0) || 1;
  console.log(`■${label}`);
  console.log(`  1試合: 平均 ${(rounds / N).toFixed(1)} ラウンド・技を撃てた ${(techs / N).toFixed(1)} 回(当たり ${(hits / N).toFixed(1)})・打ち切り判定 ${pc(judge / N)}`);
  console.log(`  移動し合いの最長: 全試合で ${runMax} 回・1試合の平均 ${(runSum / N).toFixed(1)} 回・10回以上続いた試合 ${pc(run10 / N)}`);
  console.log(`  手の割合: 技${pc(act.tech / tot)} 移動${pc(act.move / tot)} ふきとばし${pc(act.blow / tot)} ガード${pc(act.guard / tot)} ため${pc(act.charge / tot)} 交代${pc(act.swap / tot)}`);
  console.log(`  勝ち負け: A の勝ち ${pc(aw / N)}・引き分け ${pc(draw / N)}・回復の速い側の勝ち ${fastN ? pc(fastW / fastN) : '-'}(${fastN} 戦)`);
};

// いまの決まり(元の芯): モンサク = 30ターン・3つの判定・ガッツ半分 / フレンド対戦 = 既定(150ターン・残ライフの判定)
const OLD_SETS = [
  ['モンサク(1体・いま)', { size: 1, rule: { roundLimit: 30, judge: 'three', gutsPlan: { regen: 0.5, move: 0.5, charge: 0.5 } } }],
  ['フレンド対戦(3体・いま)', { size: 3, rule: {} }],
];
// 新しい決まり(作業中の芯): どの試合も芯の既定の決まり(rules を渡さない)
const NEW_SETS = [
  ['モンサク(1体・新しい決まり)', { size: 1, rule: {} }],
  ['フレンド対戦(3体・新しい決まり)', { size: 3, rule: {} }],
];

// 人が詰める試合(モンサクの自分で操作する試合の形): A は「いちばん強い技の間合い」へ詰め、着いたら撃てる中で一番強い技、撃てなければためる。
//   零で行きたい間合いが遠なら、ふきとばしがあれば使う。B は AI(離れたがる子もいる)
const runChase = (label, engine, rule) => {
  const catalog = engine.buildCatalog(data);
  const ids = Object.keys(catalog.species);
  const rng = engine.makeRng('rule-sim-chase');
  let rounds = 0, techs = 0, runMax = 0, runSum = 0, run10 = 0, aw = 0, stuck = 0, judge = 0;
  for (let i = 0; i < N; i++) {
    const a = makeUnit(engine, catalog, rng, { species: ids[Math.floor(rng() * ids.length)] }), b = makeUnit(engine, catalog, rng, { species: ids[Math.floor(rng() * ids.length)] });
    b.stats = { ...a.stats };
    const m = engine.createMatch({ seed: `ch${i}`, catalog, balance: 'A', ...rule, control: { A: 'human' },
      teamA: { assistantId: 'atsu', tactics: 50, members: [a] }, teamB: { assistantId: 'atsu', tactics: 50, members: [b] } });
    let o, guard = 0, aTech = 0;
    while ((o = m.pending()) && guard++ < 400) {
      if (o.kind !== 'act') { m.choose(o.enter.find(x => x.ok)); continue; }
      // 行きたい間合い: 威力が一番大きい技の届く間合い
      const big = o.tech.slice().sort((x, y) => y.power - x.power)[0];
      const want = big ? big.dist.reduce((best, dd) => (Math.abs(dd - o.dist) < Math.abs(best - o.dist) ? dd : best), big.dist[0]) : o.dist;
      let c = null;
      const ready = o.tech.filter(t => t.ok).sort((x, y) => y.power - x.power)[0];
      if (want !== o.dist) {
        if (want === 3 && o.blow && o.blow.ok) c = { type: 'blow' };
        else { const mv = o.move.find(x => x.ok && x.step === (want > o.dist ? 1 : -1)); if (mv) c = mv; }
      }
      if (!c && ready) c = ready;
      if (!c) c = o.charge.ok ? o.charge : o.guard;
      m.choose(c);
    }
    const r = m.result();
    if (!r) { stuck++; continue; }
    rounds += r.rounds; if (r.winner === 'A') aw++; if (r.reason === 'judge') judge++;
    const mr = moveRun(r.log); runSum += mr; if (mr > runMax) runMax = mr; if (mr >= 10) run10++;
    for (const e of r.log) if (e.ev === 'tech' && e.side === 'A') aTech++;
    techs += aTech;
  }
  const n = N - stuck || 1;
  console.log(`■${label}`);
  console.log(`  1試合: 平均 ${(rounds / n).toFixed(1)} ラウンド・人の側が技を撃てた ${(techs / n).toFixed(1)} 回・打ち切り判定 ${pc(judge / n)}・人の側の勝ち ${pc(aw / n)}`);
  console.log(`  移動し合いの最長: 全試合で ${runMax} 回・1試合の平均 ${(runSum / n).toFixed(1)} 回・10回以上続いた試合 ${pc(run10 / n)}`);
};

console.log(`戦数 ${N}・同じ能力の編成どうし(種はばらばら)・戦術経験50`);
if (oldFile) {
  const old = require(oldFile);
  for (const [l, s] of OLD_SETS) runSet(l, old, s);
}
for (const [l, s] of (oldFile ? NEW_SETS : OLD_SETS.concat(NEW_SETS))) runSet(l, cur, s);
if (oldFile) runChase('人が詰める・モンサク(1体・いま)', require(oldFile), OLD_SETS[0][1].rule);
runChase('人が詰める・モンサク(1体・新しい決まり)', cur, NEW_SETS[0][1].rule);
