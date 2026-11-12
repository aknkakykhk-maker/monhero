#!/usr/bin/env node
// 対戦の芯の「その試合だけの上乗せ(buffs)」を確かめる。2026-11-12 キズナ(モンヒロサクセスの特別な1話 → 頂への道の1回戦)
//   node tools/masmon-battle/masmon-buffs-check.js
//   ① buffs を渡さない・空・null・壊れた値だけ なら、main の計算と全く同じ結果(指紋・勝ち負け・手数)。忠誠・人気ありの編成も
//   ② 同じ入力なら何度回しても同じ結果(buffs ありでも)
//   ③ 効き目: ガッツ・最初の攻撃の命中・会心・外れ減らし・回避・「動かない番」なし がそれぞれ効く向きに動く
//   ④ 1手目を取り出せる(firstAction)
//   ⑤ サーバ(masmon-pvp/core.js)は simulate へ buffs を渡さない
'use strict';
const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');
const { load, makeUnit } = require('./load');
const ROOT = path.resolve(__dirname, '..', '..');
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };
const { engine, catalog, data } = load();
const STYLE_IDS = Object.keys(engine.STYLES);
const team = (rng, size, extra = {}) => Array.from({ length: size }, () => ({ ...makeUnit(engine, catalog, rng), ...extra }));
const input = (seed, size = 3, extraA = {}, extraB = {}) => {
  const rng = engine.makeRng(`buff-${seed}`);
  return { seed: `b-${seed}`, catalog, teamA: { assistantId: STYLE_IDS[seed % 8], tactics: 40, members: team(rng, size, extraA) },
    teamB: { assistantId: STYLE_IDS[(seed + 3) % 8], tactics: 40, members: team(rng, size, extraB) } };
};
const N = 300;
const same = (a, b) => a.digest === b.digest && a.winner === b.winner && a.rounds === b.rounds;

// ① 渡さないときは今までと同じ
{
  let old = null;
  try {
    const src = execSync('git show origin/main:monster-hero/data/assistant-masmon-battle.js', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (!/normalizeBuffs/.test(src)) { const tmp = path.join(require('os').tmpdir(), `amb-old-buff-${process.pid}.js`); fs.writeFileSync(tmp, src); old = require(tmp); fs.unlinkSync(tmp); }
  } catch (_) { old = null; }
  const oldCat = old ? old.buildCatalog(data) : null;
  let s1 = 0, s2 = 0, oldN = 0, oldOk = 0;
  const empties = [undefined, null, {}, { A: null, B: null }, { A: {}, B: { guts: 'x', hit1: -1, noSulk: 'yes' } }];
  for (let i = 0; i < N; i++) {
    const extra = i % 2 ? { loy: 30 + (i % 70), pop: i % 100 } : {};
    const inp = input(i, 1 + (i % 3), extra, extra);
    const a = engine.simulate(inp);
    if (empties.every(b => same(a, engine.simulate({ ...inp, buffs: b })))) s1++;
    if (!a.log[0].buffs) s2++;
    if (old) { oldN++; if (same(a, old.simulate({ ...inp, catalog: oldCat }))) oldOk++; }
  }
  check(`① buffs が無い・空・壊れた値だけなら、渡さないときと全く同じ(${N}戦×${empties.length})`, s1 === N, `${s1}/${N}`);
  check('① buffs が無い試合の記録には buffs を書かない', s2 === N, `${s2}/${N}`);
  check(old ? `① buffs を渡さない試合は main の計算と全く同じ(${N}戦・忠誠・人気ありも)` : '① main の計算と比べる(main がもう新しい計算なので省く)', !old || oldOk === oldN, old ? `${oldOk}/${oldN}` : '');
}
// ② 同じ入力なら同じ結果
{
  const full = { A: { guts: 10, hit1: 0.15, crit: 0.1, missCut: 0.5, eva: 0.1, noSulk: true } };
  let ok = 0;
  for (let i = 0; i < 100; i++) { const inp = { ...input(i, 1, { loy: 20 }), buffs: full }; if (same(engine.simulate(inp), engine.simulate(JSON.parse(JSON.stringify(inp))))) ok++; }
  check('② buffs ありでも、同じ入力なら同じ結果(100戦)', ok === 100, `${ok}/100`);
  const r = engine.simulate({ ...input(1, 1), buffs: { A: { guts: 99, crit: 9, hit1: 0.15 } } });
  check('② 範囲外は切って記録に残す(ガッツ50・会心0.5)', r.log[0].buffs && r.log[0].buffs.A.guts === 50 && r.log[0].buffs.A.crit === 0.5 && r.log[0].buffs.B === null);
}
// ③ 効き目
{
  const techs = (buffs, side, extra = {}) => { const out = []; for (let i = 0; i < N; i++) { const r = engine.simulate({ ...input(i, 1, extra), buffs }); out.push(r); } return out; };
  const firstTech = (rs, side) => rs.map(r => r.log.find(e => e.ev === 'tech' && e.side === side)).filter(Boolean);
  const avg = (xs) => xs.reduce((t, x) => t + x, 0) / Math.max(1, xs.length);
  // ガッツ: 1ラウンド目の A のガッツが +10
  const g0 = engine._internal.setupState(input(3, 1), catalog).teams.A.units[0].guts;
  const r1 = engine.simulate({ ...input(3, 1), buffs: { A: { guts: 10 } } });
  check('③ ガッツ +10 が始まりのガッツに乗る(記録に残る)', r1.log[0].buffs.A.guts === 10 && g0 === 50);
  const base = techs(undefined), hitB = techs({ A: { hit1: 0.15 } });
  const p0 = avg(firstTech(base, 'A').map(e => e.p)), p1 = avg(firstTech(hitB, 'A').map(e => e.p));
  check('③ 最初の攻撃の命中 +15%(1手目の命中の平均が上がる)', p1 - p0 > 10, `${p0.toFixed(1)}% → ${p1.toFixed(1)}%`);
  const second = (rs) => avg(rs.map(r => r.log.filter(e => e.ev === 'tech' && e.side === 'A')[1]).filter(Boolean).map(e => e.p));
  check('③ 命中の上乗せは最初の攻撃だけ(2回目は変わらない向き)', Math.abs(second(hitB) - second(base)) < 3, `${second(base).toFixed(1)}% / ${second(hitB).toFixed(1)}%`);
  const critRate = (rs) => { const t = rs.flatMap(r => r.log.filter(e => e.ev === 'tech' && e.side === 'A' && e.hit)); return t.filter(e => e.crit).length / Math.max(1, t.length); };
  const c0 = critRate(base), c1 = critRate(techs({ A: { crit: 0.1 } }));
  check('③ 会心 +10%', c1 - c0 > 0.06, `${(c0 * 100).toFixed(1)}% → ${(c1 * 100).toFixed(1)}%`);
  const allP = (rs, side) => avg(rs.flatMap(r => r.log.filter(e => e.ev === 'tech' && e.side === side).map(e => e.p)));
  const m0 = 100 - allP(base, 'A'), m1 = 100 - allP(techs({ A: { missCut: 0.5 } }), 'A');
  check('③ 技の失敗(外れ) −50%', m1 < m0 * 0.6, `外れ ${m0.toFixed(1)}% → ${m1.toFixed(1)}%`);
  const e0 = allP(base, 'B'), e1 = allP(techs({ A: { eva: 0.1 } }), 'B');
  check('③ 回避 +10%(相手の命中が下がる)', e0 - e1 > 7, `相手の命中 ${e0.toFixed(1)}% → ${e1.toFixed(1)}%`);
  const sulk = (rs) => rs.reduce((t, r) => t + r.log.filter(e => e.side === 'A' && e.why === 'sulk').length, 0);
  const s0 = sulk(techs(undefined, 'A', { loy: 0 })), s1 = sulk(techs({ A: { noSulk: true } }, 'A', { loy: 0 }));
  check('③ 「動かない番」なし(忠誠0でも出ない)', s0 > 0 && s1 === 0, `${s0} → ${s1}`);
  const w = (rs) => rs.filter(r => r.winner === 'A').length / rs.length;
  const wAll = w(techs({ A: { guts: 10, hit1: 0.15, crit: 0.1, missCut: 0.5, eva: 0.1, noSulk: true } }));
  check('③ 全部のせると勝ちやすくなる', wAll > w(base) + 0.05, `${(w(base) * 100).toFixed(0)}% → ${(wAll * 100).toFixed(0)}%`);
}
// ④ 1手目
{
  let ok = 0;
  for (let i = 0; i < 50; i++) {
    const r = engine.simulate(input(i, 1));
    const fb = engine.firstAction(r.log, 'B'); const fa = engine.firstAction(r.log);
    if (fb && fb.side === 'B' && ['tech', 'move', 'guard', 'charge', 'swap'].includes(fb.ev) && fa && r.log.indexOf(fa) <= r.log.indexOf(fb)) ok++;
  }
  check('④ firstAction(log, side) でその側の1手目が取れる', ok === 50, `${ok}/50`);
  check('④ 壊れた記録は null', engine.firstAction(null) === null && engine.firstAction([{ ev: 'start' }], 'A') === null);
}
// ⑤ サーバは buffs を渡さない
{
  const core = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'masmon-pvp', 'core.js'), 'utf8');
  const calls = core.match(/engine\.simulate\(\{[^}]*\}\)/g) || [];
  check('⑤ masmon-pvp/core.js の simulate は項目を名指しし、buffs を渡さない', calls.length > 0 && calls.every(c => !/buffs|\.\.\./.test(c)), calls.join(' / '));
}
console.log(ng ? `\nNG ${ng} 件` : '\nすべて OK');
process.exit(ng ? 1 : 0);
