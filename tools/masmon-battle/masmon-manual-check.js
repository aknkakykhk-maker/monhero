#!/usr/bin/env node
// 対戦の芯の「1手ずつ進める口」(createMatch・replay)を確かめる。2026-11-12 ジン(モンヒロサクセスの自分操作)
//   node tools/masmon-battle/masmon-manual-check.js            検査
//   node tools/masmon-battle/masmon-manual-check.js --write    オートの指紋の控え(auto-golden.json)を作り直す
//                                                              ※ 計算をわざと変えたとき(VERSION を上げたとき)だけ。窓口の了解のあと
//   ① オート(simulate)の結果が、止まれる形にする前の計算の控えと全部同じ(助手マスモン・masmon-pvp の結果を変えない)
//   ② 自分で操作しない createMatch は、simulate と同じ結果
//   ③ 自分で操作する試合は、選べる手だけで最後まで進み、選べない手は断る
//   ④ 同じ入力と手の列(JSON を通しても)で、全く同じ試合を再生できる(見返し・中断の続き・サーバの確かめ)
//   ⑤ 途中でオートにした試合も、列に印が残って同じに再生できる
//   ⑥ 忠誠度の「動かない番」は手を聞かない/3体で倒れたら次の子を聞く
//   ⑦ 選べる手の形(届かない技・ガッツの足りない技・端の移動・満タンのためる・交代の待ち)
//   ⑧ サーバ(masmon-pvp/core.js)は自分操作の口を使わない
'use strict';
const fs = require('fs'); const path = require('path');
const { load, makeUnit } = require('./load');
const ROOT = path.resolve(__dirname, '..', '..');
const GOLDEN = path.join(__dirname, 'auto-golden.json');
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };
const { engine, catalog } = load();
const STYLE_IDS = Object.keys(engine.STYLES);

// いろいろな形の試合(1〜3体・忠誠と人気・作戦・交代の早さ・つまみ・trace・buffs)
const autoInput = (i) => {
  const rng = engine.makeRng(`golden-${i}`);
  const size = 1 + (i % 3);
  const extra = i % 3 === 1 ? { loy: 20 + (i % 80), pop: i % 100 } : {};
  const team = (k) => ({ assistantId: STYLE_IDS[(i + k) % 8], tactics: (i * 7 + k * 13) % 101,
    plan: [undefined, 'attack', 'guard', 'range', 'big'][(i + k) % 5], swapPace: [undefined, 'early', 'late'][(i + k) % 3],
    members: Array.from({ length: size }, () => ({ ...makeUnit(engine, catalog, rng), ...extra })) });
  return { seed: `golden-${i}`, catalog, teamA: team(0), teamB: team(3), balance: ['A', 'B', 'C'][i % 3], trace: i % 4 === 0,
    ...(i % 5 === 0 ? { buffs: { A: { guts: 10, hit1: 0.1, crit: 0.1, missCut: 0.3, eva: 0.05, noSulk: i % 2 === 0 } } } : {}) };
};
const GOLD_N = 2000;

if (process.argv.includes('--write')) {
  const out = { note: 'オート(simulate)の結果の指紋の控え。masmon-manual-check.js ①が突き合わせる。計算をわざと変えたときだけ --write で作り直す',
    version: engine.VERSION, techVersion: catalog.techVersion || null, n: GOLD_N, digests: [] };
  for (let i = 0; i < GOLD_N; i++) { const r = engine.simulate(autoInput(i)); out.digests.push(`${r.digest}${r.winner}${r.rounds}`); }
  fs.writeFileSync(GOLDEN, JSON.stringify(out) + '\n');
  console.log(`書いた: ${path.relative(ROOT, GOLDEN)}(${GOLD_N}戦)`);
  process.exit(0);
}

// ① オートの結果は控えと同じ
{
  const g = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  let ok = 0; const bad = [];
  for (let i = 0; i < g.n; i++) { const r = engine.simulate(autoInput(i)); if (`${r.digest}${r.winner}${r.rounds}` === g.digests[i]) ok++; else if (bad.length < 3) bad.push(i); }
  check(`① オート(simulate)の結果が控えと全部同じ(${g.n}戦・1〜3体・忠誠/人気・作戦・つまみ・trace・buffs)`, ok === g.n,
    ok === g.n ? '' : `${ok}/${g.n} 違う例 ${bad.join(',')}(計算をわざと変えたなら VERSION を上げて --write)`);
}

const manualInput = (i, size, loy = 100) => {
  const rng = engine.makeRng(`man-${i}`);
  const team = (k) => ({ assistantId: STYLE_IDS[(i + k) % 8], tactics: 40, members: Array.from({ length: size }, () => ({ ...makeUnit(engine, catalog, rng), loy })) });
  return { seed: `man-${i}`, catalog, teamA: team(0), teamB: team(3) };
};
const legal = (o) => (o.kind === 'enter' ? o.enter.filter(x => x.ok)
  : [...o.tech.filter(x => x.ok), o.guard, ...o.move.filter(x => x.ok), ...(o.charge.ok ? [o.charge] : []), ...o.swap.filter(x => x.ok)]);
const playRandom = (m, seed, stopAt = -1) => {
  const pr = engine.makeRng(seed); let n = 0, rejected = 0, bad = 0;
  while (m.pending()) {
    const o = m.pending();
    if (n === stopAt) { m.auto('A'); break; }
    for (const x of [{ type: 'tech', key: '__none__' }, { type: 'warp' }, null, { type: 'move', step: 5 }, { type: 'swap', to: 9 }]) if (!m.choose(x).ok) rejected++; else bad++;
    const all = legal(o); const c = all[Math.floor(pr() * all.length)];
    if (!m.choose(c).ok) { bad++; break; }
    n++;
  }
  return { n, rejected, bad };
};

// ② 自分で操作しない createMatch = simulate
{
  let ok = 0; const N = 200;
  for (let i = 0; i < N; i++) { const inp = manualInput(i, 1 + (i % 3), i % 2 ? 40 : 100); const m = engine.createMatch(inp);
    if (!m.pending() && m.done() && m.result().digest === engine.simulate(inp).digest && !m.log[0].ctl) ok++; }
  check(`② 自分で操作しない createMatch は simulate と同じ(${N}戦)`, ok === N, `${ok}/${N}`);
}

// ③④⑥ 自分で操作して最後まで・選べない手は断る・同じに再生できる
{
  const N = 300; let ends = 0, bad = 0, rejected = 0, same = 0, sameJson = 0, ctlRow = 0, player = 0, sulkOk = 0, sulkN = 0, sulkAll = 0, enterAsked = 0;
  for (let i = 0; i < N; i++) {
    const size = 1 + (i % 3); const loy = i % 4 === 0 ? 30 : 100;
    const inp = { ...manualInput(i, size, loy), control: { A: 'human' } };
    const m = engine.createMatch(inp);
    let asksA = 0, sawEnter = false;
    const pr = engine.makeRng(`pick-${i}`);
    while (m.pending()) {
      const o = m.pending();
      if (o.kind === 'enter') sawEnter = true; else asksA++;
      for (const x of [{ type: 'tech', key: '__none__' }, { type: 'warp' }, null, { type: 'move', step: 5 }, { type: 'swap', to: 9 }]) if (m.choose(x).ok) bad++; else rejected++;
      const all = legal(o); const c = all[Math.floor(pr() * all.length)];
      if (!m.choose(c).ok) { bad++; break; }
    }
    if (m.done() && m.result() && ['A', 'B', 'draw'].includes(m.result().winner)) ends++;
    const r = m.result(); if (!r) continue;
    if (r.log[0].ctl && r.log[0].ctl.A === 'human' && !r.log[0].ctl.B) ctlRow++;
    // 技の勢いで移った行(ev:'move'・why:'techMove'・byTech)は、芯が技のあとに足す移動で「自分の手」ではない
    const aActs = r.log.filter(e => e.side === 'A' && ['tech', 'move', 'guard', 'charge', 'swap'].includes(e.ev) && !e.byTech);
    if (aActs.filter(e => e.why !== 'sulk').every(e => e.why === 'player')) player++;
    if (loy < 100) { sulkN++; const sulks = aActs.filter(e => e.why === 'sulk').length; sulkAll += sulks; if (sulks + asksA === aActs.length) sulkOk++; }
    if (size === 3 && sawEnter) enterAsked++;
    const rp = engine.replay(inp, m.choices());
    if (rp.ok && rp.match.result() && rp.match.result().digest === r.digest) same++;
    const rj = engine.replay({ ...JSON.parse(JSON.stringify(inp)), catalog }, JSON.parse(JSON.stringify(m.choices())));
    if (rj.ok && rj.match.result().digest === r.digest) sameJson++;
  }
  check(`③ 自分で操作した試合が選べる手だけで最後まで進む(${N}戦)`, ends === N && bad === 0, `決着 ${ends}/${N}・通ってしまった手 ${bad}`);
  check('③ 選べない手(無い技・知らない手・空・端の外・いない子)は断って進めない', rejected > 0 && bad === 0, `断った ${rejected}`);
  check('③ 自分の手の行は why:player・記録の1行目に ctl:{A:human}', player === N && ctlRow === N, `${player}/${N}・${ctlRow}/${N}`);
  check(`④ 同じ入力と手の列で全く同じ試合を再生できる(JSON を通しても)`, same === N && sameJson === N, `${same}/${N}・${sameJson}/${N}`);
  check('⑥ 忠誠度の「動かない番」は手を聞かない(聞いた数 + 動かない番 = 自分の手の数)', sulkOk === sulkN && sulkN > 0 && sulkAll > 0, `${sulkOk}/${sulkN}・動かない番 ${sulkAll}`);
  check('⑥ 3体で倒れたら次の子を聞く', enterAsked > 0, `${enterAsked}戦で聞いた`);
}

// ⑤ 途中でオートにする
{
  const N = 100; let ok = 0, mark = 0, aiAfter = 0, pressed = 0;
  for (let i = 0; i < N; i++) {
    const inp = { ...manualInput(1000 + i, 1 + (i % 3)), control: { A: 'human' } };
    const m = engine.createMatch(inp);
    playRandom(m, `auto-${i}`, 3);
    if (!m.choices().some(x => x.type === 'auto')) continue;   // オートを押す前に決着した試合は数えない
    pressed++;
    if (!m.done()) continue;
    const ch = m.choices();
    if (ch.length && ch[ch.length - 1].type === 'auto') mark++;
    const r = m.result();
    if (r.log.some(e => e.side === 'A' && !e.byTech && e.why && e.why !== 'player' && e.why !== 'sulk')) aiAfter++;
    const rp = engine.replay(inp, ch);
    if (rp.ok && rp.match.result().digest === r.digest) ok++;
  }
  check(`⑤ 途中でオートにしても最後まで進み、列に印が残り、同じに再生できる(${N}戦)`, pressed > N * 0.8 && ok === pressed && mark === pressed && aiAfter > pressed * 0.8, `押した ${pressed}・再生 ${ok}・印 ${mark}・AI の手 ${aiAfter}`);
}

// ⑦ 選べる手の形
{
  let techOk = true, moveOk = true, chargeOk = true, swapOk = true, hintOk = 0, n = 0;
  for (let i = 0; i < 60; i++) {
    const m = engine.createMatch({ ...manualInput(2000 + i, 3), control: { A: 'human' } });
    const pr = engine.makeRng(`shape-${i}`);
    while (m.pending()) {
      const o = m.pending();
      if (o.kind === 'act') {
        n++;
        for (const t of o.tech) {
          if (t.ok !== (t.dist.includes(o.dist) && o.guts >= t.guts)) techOk = false;
          if (t.reach !== t.dist.includes(o.dist)) techOk = false;
          if (!(t.p >= 5 && t.p <= 99)) techOk = false;
        }
        for (const mv of o.move) if (mv.ok !== (mv.to >= 0 && mv.to <= 3)) moveOk = false;
        if (o.charge.ok !== (o.guts < engine.GUTS_MAX)) chargeOk = false;
        for (const s of o.swap) if (s.ok && (o.swapWait > 0 || s.hp <= 0)) swapOk = false;
        if (o.hint && legal(o).some(x => x.type === o.hint.type)) hintOk++;
      }
      const all = legal(o); m.choose(all[Math.floor(pr() * all.length)]);
    }
  }
  check('⑦ 技: 届く距離でガッツが足りるときだけ選べる・命中%付き', techOk);
  check('⑦ 移動: 零・遠の端では片方だけ/ためる: 満タンでは選べない', moveOk && chargeOk);
  check('⑦ 交代: 待ちの間と倒れた子は選べない', swapOk);
  check('⑦ AI のおすすめ(hint)が選べる手の中にある', hintOk >= n * 0.95, `${hintOk}/${n}`);
}

// ⑧ サーバは自分操作の口を使わない
{
  const core = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'masmon-pvp', 'core.js'), 'utf8');
  check('⑧ masmon-pvp/core.js は createMatch・replay・control を使わない', !/createMatch|replay\(|control\s*:/.test(core));
}

console.log(ng ? `\n${ng} 件 NG` : '\nすべて OK');
process.exit(ng ? 1 : 0);
