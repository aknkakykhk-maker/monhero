#!/usr/bin/env node
// 助手マスモンの対戦の「忠誠度(そっぽを向く番)」と「人気(会心)」を確かめる。2026-11-12 キズナ・案 docs/progress/assistant-peer/masmon-plan/POWER.md 8章
//   node tools/masmon-battle/masmon-bond-battle-check.js
//   ① loy・pop の無い編成は、今の計算(main の計算の写し)と全く同じ結果(指紋・勝ち負け・手数)。忠誠100・人気0 を書いても同じ
//   ② 忠誠度が低いほど「そっぽを向く番」が出る(忠誠0で約25%・80で約5%)。そっぽの番はガッツだけたまる
//   ③ 人気が高いほど会心が出る(人気100で +20%・上限は技の30%+人気の分)
//   ④ 壊れた値は既定(忠誠100・人気0)/端末の口 unitFromGrow は絆があるときだけ loy・pop を渡す
//   ⑤ サーバ(masmon-pvp/core.js): loy・pop は 0〜100 の整数だけ受ける/人気は戦績から出し、端末の値を超えない/戦績が無ければ人気0
'use strict';
const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process'); const { pathToFileURL } = require('url');
const { load, makeUnit } = require('./load');
const ROOT = path.resolve(__dirname, '..', '..');
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };
const { engine, catalog, data } = load();
const STYLE_IDS = Object.keys(engine.STYLES);
const team = (rng, size, extra = {}) => Array.from({ length: size }, () => ({ ...makeUnit(engine, catalog, rng), ...extra }));
const input = (seed, extraA = {}, extraB = {}) => { const rng = engine.makeRng(`bond-${seed}`); return { seed: `s-${seed}`, catalog, teamA: { assistantId: STYLE_IDS[seed % 8], tactics: 40, members: team(rng, 3, extraA) }, teamB: { assistantId: STYLE_IDS[(seed + 3) % 8], tactics: 40, members: team(rng, 3, extraB) } }; };
const N = 300;

// ① 今の計算と同じ
{
  let old = null;
  try {
    const src = execSync('git show origin/main:monster-hero/data/assistant-masmon-battle.js', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (!/LOYAL_NOACT/.test(src)) { const tmp = path.join(require('os').tmpdir(), `amb-old-${process.pid}.js`); fs.writeFileSync(tmp, src); old = require(tmp); fs.unlinkSync(tmp); }
  } catch (_) { old = null; }
  let same = 0, sameOld = 0, oldN = 0;
  for (let i = 0; i < N; i++) {
    const a = engine.simulate(input(i)); const b = engine.simulate(input(i, { loy: 100, pop: 0 }, { loy: 100, pop: 0 }));
    if (a.digest === b.digest && a.winner === b.winner && a.rounds === b.rounds) same++;
    if (old) { oldN++; const c = old.simulate({ ...input(i), catalog: old.buildCatalog(data) }); if (c.digest === a.digest && c.winner === a.winner && c.rounds === a.rounds) sameOld++; }
  }
  check(`① 忠誠100・人気0 を書いても、無い編成と全く同じ(${N}戦)`, same === N, `${same}/${N}`);
  check(old ? `① loy・pop の無い編成は main の計算と全く同じ(${N}戦)` : '① main の計算と比べる(main がもう新しい計算なので省く)', !old || sameOld === oldN, old ? `${sameOld}/${oldN}` : '');
}
// ② 忠誠度
{
  const rate = (loy) => { let sulk = 0, acts = 0; for (let i = 0; i < N; i++) { const r = engine.simulate(input(i, { loy }, {})); for (const e of r.log) if (e.side === 'A' && ['tech', 'move', 'guard', 'charge', 'swap'].includes(e.ev)) { acts++; if (e.why === 'sulk') sulk++; } } return sulk / acts; };
  const r0 = rate(0), r80 = rate(80), r100 = rate(100);
  check('② 忠誠0 で約25%・80 で約5%・100 で0% がそっぽを向く', Math.abs(r0 - 0.25) < 0.03 && Math.abs(r80 - 0.05) < 0.015 && r100 === 0, `0: ${(r0 * 100).toFixed(1)}% / 80: ${(r80 * 100).toFixed(1)}% / 100: ${(r100 * 100).toFixed(1)}%`);
  let win0 = 0, win100 = 0; for (let i = 0; i < N; i++) { if (engine.simulate(input(i, { loy: 0 }, {})).winner === 'A') win0++; if (engine.simulate(input(i)).winner === 'A') win100++; }
  check('② 忠誠度が低いと勝ちにくい', win0 < win100, `忠誠0 ${win0}勝 / 忠誠100 ${win100}勝`);
  const r = engine.simulate(input(1, { loy: 0 }, {})); const e = r.log.find(x => x.why === 'sulk');
  check('② 忠誠度・人気が効く編成も効かない編成も、試合の行に今の版(8)が残る', engine.simulate(input(1, { loy: 0 }, {})).version === engine.VERSION && engine.simulate(input(1)).version === engine.VERSION_PLAIN && engine.VERSION === 8 && engine.VERSION_PLAIN === 8);
  check('② そっぽの番は「ためる」の形(ガッツだけたまる)・吹き出しの文がある', !!e && e.ev === 'charge' && !!engine.WHY.sulk);
}
// ③ 人気
{
  const crit = (pop) => { let c = 0, h = 0; for (let i = 0; i < N; i++) for (const e of engine.simulate(input(i, { pop }, {})).log) if (e.side === 'A' && e.ev === 'tech' && e.hit) { h++; if (e.crit) c++; } return c / h; };
  const c0 = crit(0), c100 = crit(100);
  check('③ 人気100 で会心が約20%ふえる', c100 - c0 > 0.16 && c100 - c0 < 0.24, `人気0 ${(c0 * 100).toFixed(1)}% → 人気100 ${(c100 * 100).toFixed(1)}%`);
}
// ④ 壊れた値・端末の口
{
  const a = engine.simulate(input(5)); const b = engine.simulate(input(5, { loy: 'x', pop: null }, { pop: 'abc' }));
  const c = engine.simulate(input(5, { loy: -50 }, {})); const d = engine.simulate(input(5, { loy: 0 }, {}));
  check('④ 読めない値は既定(忠誠100・人気0)・範囲外は端に寄せる(−50 → 0)', a.digest === b.digest && c.digest === d.digest && c.digest !== a.digest);
  const row = { monster: Object.keys(catalog.species)[0], nick: 'テスト', lv: 3 };
  const u0 = engine.unitFromGrow(row, null, null); const u1 = engine.unitFromGrow(row, null, null, { loy: 72.4, pop: 33.8 });
  check('④ unitFromGrow は絆があるときだけ loy・pop(整数)を渡す', !('loy' in u0) && !('pop' in u0) && u1.loy === 72 && u1.pop === 33);
}
// ⑤ サーバ
(async () => {
  const core = await import(pathToFileURL(path.join(ROOT, 'supabase', 'functions', 'masmon-pvp', 'core.js')).href);
  const bundle = await import(pathToFileURL(path.join(ROOT, 'supabase', 'functions', 'masmon-pvp', 'engine.js')).href);
  const eng = bundle.engine || bundle.default || bundle; const cat = bundle.catalog || null;
  const sp = Object.keys(catalog.species)[0]; const st = Object.fromEntries(engine.STAT_KEYS.map(k => [k, 300]));
  const raw = (extra) => ({ tactics: 10, members: [{ slot: 0, species: sp, name: 'テスト', lv: 5, stats: st, ...extra }] });
  const P = (extra) => core.parseTeam(raw(extra), engine, catalog, {});
  check('⑤ loy・pop は 0〜100 の整数だけ受ける', !P({ loy: 40, pop: 7 }).error && P({ loy: 101 }).error === 'loy' && P({ loy: 3.5 }).error === 'loy' && P({ pop: -1 }).error === 'pop' && !P({}).error);
  check('⑤ 受けた忠誠度・人気は登録の編成に残る(無ければ残さない)', P({ loy: 40, pop: 7 }).team.members[0].loy === 40 && !('loy' in P({}).team.members[0]));
  check('⑤ 人気は戦績から(勝ち+2・負けと引き分け+0.5・上限100)', core.popFromRecord([{ wins: 3, losses: 2, draws: 1 }, { wins: 1, losses: 0, draws: 0 }]) === 9 && core.popFromRecord([{ wins: 80, losses: 0, draws: 0 }]) === 100 && core.popFromRecord(null) === 0);
  const team = P({ loy: 40, pop: 30 }).team;
  const bt = (pop) => core.battleTeam({ assistantId: 'kiki', team, division: 'raw', size: 1, engine, pop }).members[0];
  check('⑤ 人気は端末の値と戦績の小さい方・戦績が無ければ人気なし・忠誠はそのまま', bt(10).pop === 10 && bt(50).pop === 30 && !('pop' in bt(0)) && bt(0).loy === 40);
  check('⑤ 公平の区分でも忠誠度・人気は残る', core.battleTeam({ assistantId: 'kiki', team, division: 'fair', size: 1, engine, pop: 50 }).members[0].loy === 40);
  const t0 = P({}).team; const bt0 = (division) => core.battleTeam({ assistantId: 'kiki', team: t0, division, size: 1, engine, pop: 0 }).members[0];
  check('⑤ 忠誠度が無い編成は 50 とみなす(公平の区分でも)・試合の行の編成に 50 が残る', bt0('raw').loy === 50 && bt0('fair').loy === 50 && core.LOY_DEFAULT === 50);
  { const A = core.battleTeam({ assistantId: 'kiki', team: t0, division: 'raw', size: 1, engine, pop: 0 }); const B = core.battleTeam({ assistantId: 'mua', team: t0, division: 'raw', size: 1, engine, pop: 0 });
    const r1 = engine.simulate({ seed: 'loy50', catalog, teamA: A, teamB: B }); const r2 = engine.simulate({ seed: 'loy50', catalog, teamA: JSON.parse(JSON.stringify(A)), teamB: JSON.parse(JSON.stringify(B)) });
    check('⑤ 50 とみなした試合は、行の編成で見返しても同じ(digest)・忠誠度が効く版', r1.digest === r2.digest && r1.version === engine.VERSION, `${r1.version}`); }
  check('⑤ サーバの計算の写しも同じ版(8)', (eng && eng.VERSION) === engine.VERSION || /VERSION = 8;/.test(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'masmon-pvp', 'engine.js'), 'utf8')));
  void cat;
  console.log(ng ? `NG ${ng} 件` : 'すべて OK');
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
