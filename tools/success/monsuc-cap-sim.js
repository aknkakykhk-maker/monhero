#!/usr/bin/env node
// モンサクの「能力の上限アップ」(r1115-103)の試算。芯の写しに上限アップを入れて、強い編成で何代か育て続ける。
//   node tools/success/monsuc-cap-sim.js                       … 割合 20%・3代・各 20回
//   node tools/success/monsuc-cap-sim.js --rate 0.25 --gens 4 --runs 30
//   node tools/success/monsuc-cap-sim.js --clampBonus            … 編成の子の「能力の補正」「はじめに受け継ぐ能力」は 999 までで数える(案)
// 1代目の編成は、いまの点検の「育て終えた子らしい子」(real-S)。2代目からは、前の代で育て終えた子のうち総合力の高い6体を編成にする。
// 上限 = 999 + 編成の子ごとに(500 を超える能力の上位3つなら、その能力 × 割合 の切り捨て)の合計。天井なし。
// 総合力の曲がり方(999 を超えた分の 1点の値)は W_LIST の3つを並べて出す。試合の芯も写しで 999 の切りを外す(本物のファイルは書き換えない)。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CORE, loadDeps, depsFor } = require('./load');
const battleLoad = require('../masmon-battle/load.js');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const RUNS = Math.max(1, Number(opt('--runs', 20)) || 20);
const GENS = Math.max(1, Number(opt('--gens', 3)) || 3);
const RATE = Number(opt('--rate', 0.2));
const CLAMP_BONUS = args.includes('--clampBonus');
const NOCAP = args.includes('--nocap'); // 比べる用: いまのまま(999)
const W_LIST = [[3.5, '案α 超えた分は1点 3.5(999 のときの伸びの半分)'], [1.75, '案β 超えた分は1点 1.75(4分の1)'], [6.94, '比べる用: 曲げない(999 のときの伸びのまま)']];

const DATA = path.join(__dirname, '..', '..', 'monster-hero', 'data');
const TMP = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'monsuc-cap-'));
const rep = (src, a, b) => { if (!src.includes(a)) throw new Error(`芯に元の文字が無い: ${a.slice(0, 70)}`); return src.split(a).join(b); };

// ---- 芯の写し ----
let src = fs.readFileSync(CORE, 'utf8');
if (!NOCAP) {
  const capFn = `const __top500 = (m) => KEYS.filter(k => num(m.stats[k]) > 500).sort((a, b) => (m.stats[b] - m.stats[a]) || (KEYS.indexOf(a) - KEYS.indexOf(b))).slice(0, 3);
    const __cap = (s, k) => 999 + (Array.isArray(s.team) ? s.team.reduce((t, m) => t + (m && m.kind === 'raised' && __top500(m).includes(k) ? Math.floor(num(m.stats[k]) * ${RATE}) : 0), 0) : 0);
    const addStat = (s, k, v) => { s.stats[k] = clamp(Math.round(s.stats[k] + v), 0, __cap(s, k)); };`;
  src = rep(src, 'const addStat = (s, k, v) => { s.stats[k] = clamp(Math.round(s.stats[k] + v), 0, STAT_MAX); };', capFn);
  src = rep(src, 's.stats[key] = clamp(was + add, 0, STAT_MAX);', 's.stats[key] = clamp(was + add, 0, __cap(s, key));');
  src = rep(src, "s.stats[k] >= STAT_MAX) break;", "s.stats[k] >= __cap(s, k)) break;");
  // 編成の子は 999 を超えた能力のまま読む
  src = rep(src, "const normStats = (st, sp) => { const base = initStats(sp); const o = {}; KEYS.forEach(k => { o[k] = clamp(Math.round(num(st && st[k], base[k])), 0, STAT_MAX); }); return o; };",
    "const normStats = (st, sp) => { const base = initStats(sp); const o = {}; KEYS.forEach(k => { o[k] = clamp(Math.round(num(st && st[k], base[k])), 0, 99999); }); return o; };");
  if (CLAMP_BONUS) {
    src = rep(src, 'bonus[k] = i < 0 ? 0 : r2(stats[k] / 40 * POS_COEF[i]', 'bonus[k] = i < 0 ? 0 : r2(Math.min(999, stats[k]) / 40 * POS_COEF[i]');
    src = rep(src, 'startAdd: { stat: top[0], v: Math.floor(stats[top[0]] / START_STAT_DIV) }', 'startAdd: { stat: top[0], v: Math.floor(Math.min(999, stats[top[0]]) / START_STAT_DIV) }');
  }
}
const coreFile = path.join(TMP, 'core.js'); fs.writeFileSync(coreFile, src);
const SUC = require(coreFile).create(depsFor(loadDeps()));
const C = loadDeps().MASMON_CALC;

// ---- 試合の芯の写し(999 の切りを外す) ----
const { catalog, data } = battleLoad.load();
let bsrc = fs.readFileSync(path.join(DATA, 'assistant-masmon-battle.js'), 'utf8');
// guardCut は 能力 ÷ STAT_MAX を使うので、写しでは 999 で割る形に残す(大きくしたままだとガードが弱くなる。本番で直すときは別の名前の定数にする)
if (!NOCAP) { bsrc = rep(bsrc, 'u.stats.tough / STAT_MAX * 0.25', 'u.stats.tough / 999 * 0.25'); bsrc = rep(bsrc, 'const STAT_MAX = 999;', 'const STAT_MAX = 99999;'); }
const bfile = path.join(TMP, 'battle.js'); fs.writeFileSync(bfile, bsrc);
const engine = require(bfile);
const cat = NOCAP ? catalog : engine.buildCatalog(data);

const K = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
const AT = require('../../monster-hero/data/monhero-success-assist.js');
const battleSp = (sp) => (cat.species[sp] ? sp : 'Mocchi');
const GEAR = { debut: [2, 10, 5], junior: [2, 20, 10], middle: [3, 40, 20], pro: [4, 60, 30], final: [5, 80, 40] };
const unitOf = (sp0, stats, techs) => { const sp = battleSp(sp0); const ts = cat.species[sp].techs.slice(0, techs).map(t => t.id); return { species: sp, name: sp, lv: 1, stats, techs: ts, mastery: Object.fromEntries(ts.map(t => [t, 0])) }; };
const SP6 = ['Undine', 'Mocchi', 'Golem', 'Pixie', 'Tiger', 'Kyubi'];
const real0 = () => SP6.map((x, i) => { const st = {}; K.forEach((k, j) => { st[k] = Math.round(4300 / 6 * (0.7 + ((i + j) % 4) * 0.2)); }); return { kind: 'raised', species: x, name: `箱${i + 1}`, stats: st, lv: 30, loy: 85, pop: 70, techs: SUC.techsOf(x).slice(0, 8).map(t => t.id), assists: AT.autoPick(AT.pointsOf(14500), []).picks }; });
// 育て方: 修行中心(いまいちばん強い)・ほめる・能力は子の得意3つ
const FOCUS = { Mocchi: [1, 5, 0], Golem: [1, 5], Tiger: [3, 4, 1], Kyubi: [2, 3], Undine: [0, 2, 4], Pixie: [2, 3, 4] };
const STYLE = { tr: 2, rest: 1, play: 0, shu: 6, cup: 1 };

const runOne = (species, team, seed) => {
  const id = `cap-${species}-${seed}`;
  let s = SUC.newRun({ id, species, aid: 'mua', team, aidBondLv: 1 });
  let r = (seed * 2654435761 + 7) >>> 0; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  const wpick = (w) => { const ks = Object.keys(w).filter(k => w[k] > 0); let t = ks.reduce((a, k) => a + w[k], 0) * rnd(); for (const k of ks) { t -= w[k]; if (t <= 0) return k; } return ks[0]; };
  let lastUse = null; const out = { fights: 0, hpLeft: [], dmg: [], hit: [] };
  const fight = (opp, idx) => {
    const g = GEAR[SUC.periodOf(s.turn).key]; const sp = battleSp(s.species); const own = cat.species[sp].techs.map(t => t.id); const ts = s.techs.filter(t => own.includes(t));
    const a = { species: sp, name: sp, lv: 1, stats: s.stats, techs: ts.length ? ts : undefined, mastery: {}, techBoost: SUC.techBoostOf(s), loy: SUC.loyalOf(s), pop: s.pop };
    const b = { ...unitOf(opp.species, opp.stats, opp.techs), ...(Number.isFinite(opp.loy) ? { loy: opp.loy } : {}), ...(Number.isFinite(opp.pop) ? { pop: opp.pop } : {}) };
    const res = engine.simulate({ seed: `${id}:${s.turn}:${s.battle.kind}:${s.battle.round}:${idx}`, catalog: cat, teamA: { assistantId: s.aid, tactics: g[2], members: [a] }, teamB: { assistantId: 'kiki', tactics: opp.tactics, members: [b] }, buffs: SUC.battleBuffs(s) });
    lastUse = SUC.techUseOf(res.log, 'A'); out.fights += 1; return res.winner === 'A';
  };
  let guard = 0;
  while (!s.over && guard++ < 260) {
    if (s.battle) {
      const opps = SUC.opponents(s); const wins = [];
      for (let j = 0; j < opps.length; j++) { const w = fight(opps[j], j); wins.push(w); if (!w) break; }
      s = SUC.settle(s, wins, lastUse).state;
      if (s.mealReady && !s.over) { const o = SUC.mealOpts(s); if (o[0]) s = SUC.meal(s, o[0]).state; }
      continue;
    }
    if (SUC.storyDue(s) !== null) s = SUC.storyStep(s, 'a').state;
    const vw = SUC.peek(s); let a;
    if (vw.can.includes('cond')) a = { kind: 'cond' };
    else if (vw.can.includes('retry')) a = { kind: 'retry' };
    else if (vw.can.includes('clinic')) a = { kind: 'clinic' };
    else {
      const frac = s.hp / s.hpMax; const w = { ...STYLE };
      if (frac < 0.3) { w.rest += 8; w.tr = 0; w.shu = 0; } else if (frac < 0.5) w.rest += 3; if (s.stress > 70) w.play += 5;
      if (!vw.can.includes('shugyo') || !vw.shugyo.techs.length) w.shu = 0;
      const cup = vw.cups.find(c => c.entry.ok); if (!cup) w.cup = 0;
      const k = wpick(w); const f = FOCUS[species] || [1, 2, 3];
      if (k === 'tr') a = { kind: 'train', stat: K[f[Math.floor(rnd() * f.length)]] };
      else if (k === 'shu') { const t = vw.shugyo.techs.slice().sort((x, y) => (x.rank || 0) - (y.rank || 0)).pop(); a = { kind: 'shugyo', course: 'fire', techs: [t.id] }; }
      else if (k === 'cup') a = { kind: 'cup', id: cup.id };
      else a = { kind: k === 'play' ? 'play' : 'rest' };
    }
    let x = SUC.act(s, a); if (!x.out.ok) x = SUC.act(s, { kind: 'rest' }); s = x.state;
    if (s.last && ['train', 'shugyo'].includes(s.last.kind)) s = SUC.react(s, 'praise').state;
    if (SUC.issaComes(s)) s = SUC.issa(s, 'none').state;
    s = SUC.endTurn(s).state;
  }
  s = SUC.autoPts(s).state;
  const e = SUC.evaluate(s);
  const caps = {}; K.forEach(k => { caps[k] = NOCAP ? 999 : 999 + s.team.reduce((t, m) => { const top = K.filter(q => m.stats[q] > 500).sort((p, q) => (m.stats[q] - m.stats[p]) || (K.indexOf(p) - K.indexOf(q))).slice(0, 3); return t + (m.kind === 'raised' && top.includes(k) ? Math.floor(m.stats[k] * RATE) : 0); }, 0); });
  const over = K.reduce((t, k) => t + Math.max(0, s.stats[k] - 999), 0);
  return { species, stats: { ...s.stats }, caps, over, power0: e.power, lv: s.lv, loy: SUC.loyalOf(s), pop: s.pop, techs: s.techs.slice(), wonFinal: (s.titles || []).length, e };
};

const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
const pct = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * p))] : 0; };
let team = real0();
console.log(`■ 上限アップの試算(割合 ${Math.round(RATE * 100)}%${NOCAP ? '・比べる用: いまのまま 999' : ''}${CLAMP_BONUS ? '・編成の補正は999まで' : ''}・修行中心・各 ${RUNS}回)`);
for (let g = 1; g <= GENS; g++) {
  const rows = [];
  for (const sp of SP6) for (let i = 0; i < RUNS; i++) rows.push(runOne(sp, team, g * 1000 + i + 1));
  const capTop = team.map(m => K.filter(k => m.stats[k] > 500).sort((p, q) => m.stats[q] - m.stats[p]).slice(0, 3).map(k => `${k}${m.stats[k]}`).join('/')).join(' ');
  const maxStat = rows.map(x => Math.max(...K.map(k => x.stats[k])));
  const capMax = rows.map(x => Math.max(...K.map(k => x.caps[k])));
  const atCap = rows.reduce((t, x) => t + K.filter(k => x.stats[k] >= x.caps[k]).length, 0) / rows.length;
  const n999 = rows.reduce((t, x) => t + K.filter(k => x.stats[k] >= 999).length, 0) / rows.length;
  console.log(`\n${g}代目  編成の子(500超えの上位3つ): ${capTop}`);
  console.log(`  上限のいちばん高い能力: 中央 ${med(capMax)}・最大 ${Math.max(...capMax)} / 育て終えた子のいちばん高い能力: 中央 ${med(maxStat)}・9割 ${pct(maxStat, 0.9)}・最大 ${Math.max(...maxStat)}`);
  console.log(`  1体あたり 999以上の能力 ${n999.toFixed(2)}個・上限に届いた能力 ${atCap.toFixed(2)}個・999を超えた分の合計 中央 ${med(rows.map(x => x.over))}`);
  for (const [w, name] of W_LIST) {
    const pw = rows.map(x => x.power0 + Math.round(x.over * w));
    const gd = {}; pw.forEach(p => { const L = String(SUC.gradeOf(p).label).replace(/\d+$/, ''); gd[L] = (gd[L] || 0) + 1; });
    const dist = Object.entries(gd).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}${Math.round(n / pw.length * 100)}%`).join(' ');
    console.log(`  ${name}: 総合力 中央 ${med(pw)}・9割 ${pct(pw, 0.9)}・最大 ${Math.max(...pw)} / 評価 ${dist}`);
  }
  if (NOCAP) break;
  // 次の代の編成: 総合力の高い6体(種はばらばら)
  const best = rows.slice().sort((a, b) => (b.power0 + b.over * 3.5) - (a.power0 + a.over * 3.5));
  const pick = []; for (const x of best) { if (pick.length >= 6) break; if (!pick.some(p => p.species === x.species)) pick.push(x); }
  team = pick.map((x, i) => ({ kind: 'raised', species: x.species, name: `代${g}-${i + 1}`, stats: x.stats, lv: x.lv, loy: x.loy, pop: x.pop, techs: x.techs, assists: AT.autoPick(AT.pointsOf(14500), []).picks }));
}
fs.rmSync(TMP, { recursive: true, force: true });
