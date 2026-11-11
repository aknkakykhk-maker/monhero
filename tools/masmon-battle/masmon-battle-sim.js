#!/usr/bin/env node
// 助手のマスモンのオートバトルを数千戦まわして、偏りを集計する道具(2026-11-11 タタカイ)。
//   node tools/masmon-battle/masmon-battle-sim.js            ふつうの集計(各 2000 戦)
//   node tools/masmon-battle/masmon-battle-sim.js --n 500    戦数を変える
//   node tools/masmon-battle/masmon-battle-sim.js --json     数字を JSON で出す
// 見るもの:
//   ① 同じ強さどうしで A 側・B 側(先に書いた方)に偏らないか
//   ② 性格ごとの勝率(同じ編成を入れ替えて戦わせる=編成の運を消す)
//   ③ 能力の合計の差で勝率がどう変わるか
//   ④ 戦術経験(0 と 100)の差
//   ⑤ 1対1〜3対3 の決着の速さ・判定になった割合・手の内わけ
'use strict';
const { load, makeUnit } = require('./load.js');

const args = process.argv.slice(2);
const argVal = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? Number(args[i + 1]) : def; };
const N = argVal('--n', 2000);
const asJson = args.includes('--json');

const { engine, catalog } = load();
const STYLE_IDS = Object.keys(engine.STYLES);

const team = (rng, size, opts = {}) => Array.from({ length: size }, () => makeUnit(engine, catalog, rng, opts));
const run = (seed, a, b) => engine.simulate({ seed, catalog, teamA: a, teamB: b });

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const out = {};

// ① A・B の偏り(同じ総量・ばらばらの編成・同じ性格)
{
  const rng = engine.makeRng('sim-side');
  let a = 0, b = 0, d = 0, judge = 0, rounds = 0;
  for (let i = 0; i < N; i++) {
    const r = run(`side-${i}`, { assistantId: 'atsu', tactics: 50, members: team(rng, 3) }, { assistantId: 'atsu', tactics: 50, members: team(rng, 3) });
    if (r.winner === 'A') a++; else if (r.winner === 'B') b++; else d++;
    if (r.reason === 'judge') judge++;
    rounds += r.rounds;
  }
  out.side = { A: a / N, B: b / N, draw: d / N, judge: judge / N, avgRounds: rounds / N };
}

// ② 性格どうしの総当たり(同じ編成を入れ替えて2回 = 編成の運を消す)
{
  const M = Math.max(50, Math.floor(N / 10));
  const wins = Object.fromEntries(STYLE_IDS.map(s => [s, 0]));
  const games = Object.fromEntries(STYLE_IDS.map(s => [s, 0]));
  const rng = engine.makeRng('sim-style');
  for (let x = 0; x < STYLE_IDS.length; x++) for (let y = x + 1; y < STYLE_IDS.length; y++) {
    for (let i = 0; i < M; i++) {
      const ta = team(rng, 3), tb = team(rng, 3);
      for (const swap of [false, true]) {
        const [p, q] = swap ? [STYLE_IDS[y], STYLE_IDS[x]] : [STYLE_IDS[x], STYLE_IDS[y]];
        const r = run(`style-${x}-${y}-${i}-${swap}`, { assistantId: p, tactics: 50, members: ta }, { assistantId: q, tactics: 50, members: tb });
        games[p]++; games[q]++;
        if (r.winner === 'A') wins[p]++; else if (r.winner === 'B') wins[q]++; else { wins[p] += 0.5; wins[q] += 0.5; }
      }
    }
  }
  out.style = Object.fromEntries(STYLE_IDS.map(s => [s, wins[s] / games[s]]));
}

// ③ 能力の合計の差(1体あたりの6能力の合計 1800 対 1800×(1+gap))
{
  out.statGap = {};
  for (const gap of [0.05, 0.1, 0.2, 0.3]) {
    const rng = engine.makeRng(`sim-gap-${gap}`);
    let w = 0;
    const M = Math.floor(N / 2);
    for (let i = 0; i < M; i++) {
      const strongFirst = i % 2 === 0;
      const strong = { assistantId: 'atsu', tactics: 50, members: team(rng, 3, { total: Math.round(1800 * (1 + gap)) }) };
      const weak = { assistantId: 'atsu', tactics: 50, members: team(rng, 3, { total: 1800 }) };
      const r = strongFirst ? run(`gap-${gap}-${i}`, strong, weak) : run(`gap-${gap}-${i}`, weak, strong);
      if (r.winner === (strongFirst ? 'A' : 'B')) w++; else if (r.winner === 'draw') w += 0.5;
    }
    out.statGap[`+${Math.round(gap * 100)}%`] = w / M;
  }
}

// ④ 戦術経験 100 対 0(同じ編成を入れ替えて2回)
{
  const rng = engine.makeRng('sim-tactics');
  let w = 0, g = 0;
  const M = Math.floor(N / 2);
  for (let i = 0; i < M; i++) {
    const ta = team(rng, 3), tb = team(rng, 3);
    for (const swap of [false, true]) {
      const pro = { assistantId: 'atsu', tactics: 100, members: swap ? tb : ta };
      const rookie = { assistantId: 'atsu', tactics: 0, members: swap ? ta : tb };
      const r = swap ? run(`tac-${i}-1`, rookie, pro) : run(`tac-${i}-0`, pro, rookie);
      g++;
      if (r.winner === (swap ? 'B' : 'A')) w++; else if (r.winner === 'draw') w += 0.5;
    }
  }
  out.tactics = w / g;
}

// ⑤ 形ごと(1対1・2対2・3対3・1対2 など)
{
  out.formats = {};
  for (const [na, nb] of [[1, 1], [2, 2], [3, 3], [1, 2], [2, 3]]) {
    const rng = engine.makeRng(`sim-fmt-${na}-${nb}`);
    const M = Math.floor(N / 2);
    let rounds = 0, maxRounds = 0, judge = 0, aWin = 0;
    const acts = {};
    for (let i = 0; i < M; i++) {
      const r = run(`fmt-${na}-${nb}-${i}`, { assistantId: STYLE_IDS[i % 8], tactics: (i * 37) % 101, members: team(rng, na) },
        { assistantId: STYLE_IDS[(i + 3) % 8], tactics: (i * 53) % 101, members: team(rng, nb) });
      rounds += r.rounds; maxRounds = Math.max(maxRounds, r.rounds);
      if (r.reason === 'judge') judge++;
      if (r.winner === 'A') aWin++;
      for (const e of r.log) if (['tech', 'move', 'guard', 'charge', 'swap'].includes(e.ev)) acts[e.ev] = (acts[e.ev] || 0) + 1;
    }
    const total = Object.values(acts).reduce((a, b) => a + b, 0);
    out.formats[`${na}対${nb}`] = { avgRounds: rounds / M, maxRounds, judge: judge / M, aWin: aWin / M,
      acts: Object.fromEntries(Object.entries(acts).map(([k, v]) => [k, v / total])) };
  }
}

// ⑥ 種だけの差(6能力を全員同じ 300 にして1対1の総当たり・先後を入れ替え)= 距離の得意・ガッツの速さ・技の倍率の差
{
  const ids = Object.keys(catalog.species);
  const flat = { life: 300, pow: 300, wise: 300, hit: 300, eva: 300, tough: 300 };
  const w = Object.fromEntries(ids.map(id => [id, 0])), g = Object.fromEntries(ids.map(id => [id, 0]));
  const M = Math.max(4, Math.floor(N / 200));
  for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) for (let i = 0; i < M; i++) {
    for (const sw of [false, true]) {
      const [p, q] = sw ? [ids[y], ids[x]] : [ids[x], ids[y]];
      const r = run(`sp-${x}-${y}-${i}-${sw}`, { assistantId: 'atsu', tactics: 50, members: [{ species: p, lv: 50, stats: flat, techs: catalog.species[p].techs.map(t => t.id) }] },
        { assistantId: 'atsu', tactics: 50, members: [{ species: q, lv: 50, stats: flat, techs: catalog.species[q].techs.map(t => t.id) }] });
      g[p]++; g[q]++;
      if (r.winner === 'A') w[p]++; else if (r.winner === 'B') w[q]++; else { w[p] += 0.5; w[q] += 0.5; }
    }
  }
  out.species = Object.fromEntries(ids.map(id => [id, w[id] / g[id]]).sort((a, b) => b[1] - a[1]));
}

if (asJson) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
console.log(`■ 助手のマスモンのオートバトル 集計(各 ${N} 戦前後)`);
console.log(`① 先後の偏り: A ${pct(out.side.A)} / B ${pct(out.side.B)} / 引き分け ${pct(out.side.draw)}・判定 ${pct(out.side.judge)}・平均 ${out.side.avgRounds.toFixed(1)} ラウンド`);
console.log('② 性格ごとの勝率(総当たり・編成入れ替え):');
for (const s of STYLE_IDS) console.log(`   ${s.padEnd(10)} ${engine.STYLES[s].label.padEnd(6, '　')} ${pct(out.style[s])}`);
console.log('③ 能力の合計が多い側の勝率: ' + Object.entries(out.statGap).map(([k, v]) => `${k} → ${pct(v)}`).join(' / '));
console.log(`④ 戦術経験 100 対 0 の勝率: ${pct(out.tactics)}`);
console.log('⑤ 形ごと:');
for (const [k, v] of Object.entries(out.formats)) {
  console.log(`   ${k}: 平均 ${v.avgRounds.toFixed(1)} ・最長 ${v.maxRounds} ラウンド・判定 ${pct(v.judge)}・A勝ち ${pct(v.aWin)}・手 `
    + Object.entries(v.acts).map(([a, x]) => `${a} ${pct(x)}`).join(' '));
}
const sp = Object.entries(out.species);
console.log(`⑥ 種だけの差(能力を同じにして1対1): 上 ${sp.slice(0, 3).map(([k, v]) => `${catalog.species[k].name} ${pct(v)}`).join('・')} / 下 ${sp.slice(-3).map(([k, v]) => `${catalog.species[k].name} ${pct(v)}`).join('・')}`);
