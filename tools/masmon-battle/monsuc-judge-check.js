#!/usr/bin/env node
// モンサクの試合の「30ターンで判定」(r1115-058)を確かめる。node tools/masmon-battle/monsuc-judge-check.js
//   ① judge:'three' を渡さないと今までと同じ(150ラウンド・判定の行に rows が無い)=助手のマスモン対戦は変わらない
//   ② roundLimit:30 + judge:'three' では 30ラウンドを超えない。判定の行の勝ち数・決め手・勝者が決まりどおり。引き分けにならない
//   ③ 判定になった試合の数を出す(バランス確認)
'use strict';
const { load, makeUnit } = require('./load');
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };
const { engine, catalog } = load();
const STYLE_IDS = Object.keys(engine.STYLES);
const team = (rng, n) => Array.from({ length: n }, () => makeUnit(engine, catalog, rng));
const input = (i, extra) => { const rng = engine.makeRng(`mj-${i}`); return { seed: `mj-${i}`, catalog, ...extra,
  teamA: { assistantId: STYLE_IDS[i % 8], tactics: 40, members: team(rng, 1) }, teamB: { assistantId: STYLE_IDS[(i + 3) % 8], tactics: 40, members: team(rng, 1) } }; };
const N = 400; const LIM = 8;   // 判定の計算を確かめるため、30より短い上限で回す(本番の上限は MONSUC_MATCH_RULE の30)
let short = 0;
let judged = 0, bad = 0, over = 0, draw = 0, plainBad = 0; const by = {}; let aWin = 0;
for (let i = 0; i < N; i++) {
  // 版10: 判定は全部の試合で3つの比べ(r1115-111)。judge:'life' を渡したときだけ前の判定(残ライフの割合・rows なし)
  const p = engine.simulate(input(i, { roundLimit: LIM, judge: 'life' })); const j0 = p.log.find(e => e.ev === 'judge');
  if (j0 && j0.rows) plainBad++;
  const r = engine.simulate(input(i, { roundLimit: LIM, judgeTie: 'B' }));
  if (r.rounds > LIM) over++;
  if (r.winner === 'draw') draw++;
  const j = r.log.find(e => e.ev === 'judge');
  if (r.reason !== 'judge') continue;
  judged++; if (r.winner === 'A') aWin++;
  by[j.by] = (by[j.by] || 0) + 1;
  const wa = j.rows.filter(x => x.win === 'A').length, wb = j.rows.filter(x => x.win === 'B').length;
  let exp;
  if (wa !== wb) exp = wa > wb ? 'A' : 'B'; else if (j.hpA !== j.hpB) exp = j.hpA > j.hpB ? 'A' : 'B';
  else if (j.rows[0].a !== j.rows[0].b) exp = j.rows[0].a > j.rows[0].b ? 'A' : 'B'; else if (j.rows[1].a !== j.rows[1].b) exp = j.rows[1].a > j.rows[1].b ? 'A' : 'B'; else exp = 'B';
  if (exp !== r.winner || j.winner !== r.winner || j.winsA !== wa || j.winsB !== wb || (wa !== wb && j.by !== 'wins')) bad++;
  if (j.rows.some(x => x.key === 'guts' && x.win && (x.win === 'A') !== (x.a > x.b))) bad++;
}
check("① judge:'life' を渡したときだけ前の判定(rows が付かない)", plainBad === 0);
check('② 上限を超えない', over === 0, `${N}戦`);
check("② モンサクの大会(judgeTie:'B')は引き分けにならない", draw === 0);
check('② 判定になった試合がある', judged > 0, `${judged}戦`);
check('② 判定の勝者・勝ち数・決め手が決まりどおり', bad === 0, `判定 ${judged}戦・自分の勝ち ${aWin}・決め手 ${JSON.stringify(by)}`);
// ③ 自動ガッツ回復(版10・全部の試合で0.75倍 r1115-133): 無し・空・regen 0.75 は同じ指紋/regen 1(元の速さ)なら試合が短くなる
//   打ち切りは1体あたり30(1体30・2体60・3体90。r1115-118・121)/フレンド対戦の完全な同点は引き分け(既定)
{
  let same = 0, rA = 0, rB = 0; const M = 150;
  for (let i = 0; i < M; i++) {
    const a = engine.simulate(input(i, {})), b = engine.simulate(input(i, { gutsPlan: { regen: 0.75 } })), c = engine.simulate(input(i, { gutsPlan: {} }));
    if (a.digest === b.digest && a.digest === c.digest) same++;
    const h = engine.simulate(input(i, { gutsPlan: { regen: 1 } })); rA += a.rounds; rB += h.rounds;
  }
  check('③ gutsPlan が無し・空・regen 0.75 なら同じ指紋(既定が0.75倍)', same === M, `${same}/${M}`);
  check('③ 回復を元の速さにすると試合が短くなる(=既定は0.75倍)', rB < rA, `平均 ${(rA / M).toFixed(1)}(既定) / ${(rB / M).toFixed(1)}(元の速さ) ラウンド`);
  const lim = [1, 2, 3].map(n => { const rng = engine.makeRng(`lim-${n}`); const r = engine.simulate({ seed: `lim-${n}`, catalog, roundLimit: undefined,
    teamA: { assistantId: 'atsu', tactics: 0, members: team(rng, n).map(m => ({ ...m, stats: { ...m.stats, pow: 1, wise: 1 } })) },
    teamB: { assistantId: 'atsu', tactics: 0, members: team(rng, n).map(m => ({ ...m, stats: { ...m.stats, pow: 1, wise: 1 } })) } }); return r.rounds; });
  check('③ 打ち切りは1体あたり30ターン(1体30・2体60・3体90 を超えない)', lim[0] <= 30 && lim[1] <= 60 && lim[2] <= 90 && engine.ROUND_PER_UNIT === 30, lim.join('・'));
  const tie = engine.simulate({ seed: 'tie', catalog, roundLimit: 1, teamA: { assistantId: 'atsu', tactics: 0, members: [{ species: 'Mocchi', name: 'a', lv: 1, stats: { life: 100, pow: 0, wise: 0, hit: 0, eva: 999, tough: 999 }, techs: [] }] },
    teamB: { assistantId: 'atsu', tactics: 0, members: [{ species: 'Mocchi', name: 'b', lv: 1, stats: { life: 100, pow: 0, wise: 0, hit: 0, eva: 999, tough: 999 }, techs: [] }] } });
  const tieJ = tie.log.find(e => e.ev === 'judge') || {};
  check('③ 完全な同点は引き分け(フレンド対戦)・モンサクの大会は judgeTie:B で自分の負け', tieJ.by !== 'tie' || (tie.winner === 'draw' && engine.simulate({ ...{ seed: 'tie', catalog, roundLimit: 1, judgeTie: 'B', teamA: tie && { assistantId: 'atsu', tactics: 0, members: [{ species: 'Mocchi', name: 'a', lv: 1, stats: { life: 100, pow: 0, wise: 0, hit: 0, eva: 999, tough: 999 }, techs: [] }] }, teamB: { assistantId: 'atsu', tactics: 0, members: [{ species: 'Mocchi', name: 'b', lv: 1, stats: { life: 100, pow: 0, wise: 0, hit: 0, eva: 999, tough: 999 }, techs: [] }] } } }).winner === 'B'), `${tieJ.by}・${tie.winner}`);
}
console.log(ng ? `\nNG ${ng}件` : '\nすべて OK'); process.exit(ng ? 1 : 0);
