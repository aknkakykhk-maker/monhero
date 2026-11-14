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
  const p = engine.simulate(input(i, {})); const j0 = p.log.find(e => e.ev === 'judge');
  if (j0 && j0.rows) plainBad++;
  const r = engine.simulate(input(i, { roundLimit: LIM, judge: 'three' }));
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
check('① 渡さなければ判定の行に rows が付かない(今までどおり)', plainBad === 0);
check('② 上限を超えない', over === 0, `${N}戦`);
check('② 引き分けにならない', draw === 0);
check('② 判定になった試合がある', judged > 0, `${judged}戦`);
check('② 判定の勝者・勝ち数・決め手が決まりどおり', bad === 0, `判定 ${judged}戦・自分の勝ち ${aWin}・決め手 ${JSON.stringify(by)}`);
console.log(ng ? `\nNG ${ng}件` : '\nすべて OK'); process.exit(ng ? 1 : 0);
