#!/usr/bin/env node
// モンサクの「10周点検と同じ周」を、計算の芯だけで何回も回して、案の数字どうしを比べる(r1115-071・r1115-072)。
//   node tools/success/monsuc-balance-sim.js                     … いまの数字で、10周の設計 × 既定 30回ずつ
//   node tools/success/monsuc-balance-sim.js --runs 50 --variant all
//   node tools/success/monsuc-balance-sim.js --variant now,A      … 比べる案(下の VARIANTS の名前)
//   node tools/success/monsuc-balance-sim.js --json <出力先>
// 周の設計(育てる子・育て方の重み・トレーニングの能力・ほめ/しかる・編成)は 10周点検の台本 monsuc-play10.js の LAPS をそのまま使う。
// 行動の選び方も台本に合わせる(重みでくじ・体力3割未満は休む・修行は覚えられる技のいちばん高いランク・大会は出られる最初の札)。
// 台本と違うところ: 試合はオート相当(芯の対戦)・育て終わりに能力ポイントを使い切る(おまかせ)・案に「熟練へ振る」があれば先に振る。
// 案の数字は芯のファイルの文字を置き換えた写しで試す(本物のファイルは書き換えない)。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CORE, loadDeps, depsFor } = require('./load');
const battleLoad = require('../masmon-battle/load.js');
const { LAPS, boxSeed } = require('./monsuc-play10.js');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const RUNS = Math.max(1, Number(opt('--runs', 30)) || 30);
const JSON_OUT = opt('--json', '');

// ---- 案(芯の文字の置き換え)。now = いまの数字 ----
//   置き換えは [元の文字, 新しい文字]。元の文字が見つからなければ止める(芯が変わったら案を直す)
const VARIANTS = {
  now: { name: 'いま', rep: [] },
  // 案A: アシスト編成を強く(能力の補正 ÷40 → ÷20・ランクの上乗せ 約2倍・タッグ +10点・はじめの親密度 +20)
  A: { name: '案A アシスト強化', rep: [
    ["const RANK_ADD = Object.freeze({ G: 0, F: 0, E: 1, D: 1, C: 2, B: 3, A: 4, S: 5, SS: 6, SSS: 6, M: 8 });", "const RANK_ADD = Object.freeze({ G: 1, F: 1, E: 2, D: 3, C: 4, B: 6, A: 8, S: 10, SS: 12, SSS: 12, M: 15 });"],
    ["const TAG_POWER = Object.freeze({ base: 15, G: 20, F: 20, E: 22, D: 22, C: 24, B: 25, A: 27, S: 30, SS: 32, SSS: 32, M: 35, aid: 25 });", "const TAG_POWER = Object.freeze({ base: 15, G: 25, F: 25, E: 28, D: 30, C: 32, B: 35, A: 38, S: 42, SS: 45, SSS: 45, M: 50, aid: 25 });"],
    ["const BOND_START = Object.freeze({ base: 0, G: 10, F: 10, E: 15, D: 15, C: 20, B: 25, A: 30, S: 35, SS: 40, SSS: 40, M: 50 });", "const BOND_START = Object.freeze({ base: 0, G: 20, F: 20, E: 30, D: 35, C: 40, B: 45, A: 50, S: 55, SS: 60, SSS: 60, M: 70 });"],
    ["bonus[k] = i < 0 ? 0 : r2(stats[k] / 40 * POS_COEF[i]", "bonus[k] = i < 0 ? 0 : r2(stats[k] / 20 * POS_COEF[i]"],
  ] },
  // 案P: 能力ポイントを多く(大会のポイント ×2・トレーニングの大成功で +2)と、熟練へ振れる(1点で熟練 +1)
  P: { name: '案P 能力ポイント×2・熟練へ振る', pts: 2, greatPts: 2, mastery: 1, rep: [] },
};
// 案A2・A3: トレーニングの能力の補正をさらに強く(÷40 → ÷15・÷10)。ほかは案Aと同じ
const withDiv = (d) => VARIANTS.A.rep.map(([a, b]) => [a, b.replace('stats[k] / 20 *', `stats[k] / ${d} *`)]);
VARIANTS.A2 = { name: '案A2 アシスト強化(補正 ÷15)', rep: withDiv(15) };
VARIANTS.A3 = { name: '案A3 アシスト強化(補正 ÷10)', rep: withDiv(10) };
// 案P2: 能力ポイントをトレーニングからも(1回 +1・大成功は +3)・大会のポイント ×1.5・熟練へ 1点で +1
VARIANTS.P2 = { name: '案P2 トレーニングでも能力ポイント・大会×1.5・熟練へ振る', pts: 1.5, trainPts: 1, greatPts: 2, mastery: 1, rep: [] };
VARIANTS.A3P2 = { name: '案A3+P2', rep: VARIANTS.A3.rep, pts: 1.5, trainPts: 1, greatPts: 2, mastery: 1 };
// 別案(勝手に入れない): 修行の「編成の得意」の割合を下げる(1位 3% → 2%・2位 1% → 0.7%・3位 0.5% → 0.3%)
VARIANTS.A3P2S = { name: '案A3+P2+修行の編成の割合を下げる(別案)', rep: [...VARIANTS.A3.rep, ['pct: Object.freeze([0.03, 0.01, 0.005])', 'pct: Object.freeze([0.02, 0.007, 0.003])']], pts: 1.5, trainPts: 1, greatPts: 2, mastery: 1 };
VARIANTS.A3P2h = { name: '案A3+P2(熟練は2点で+1)', rep: VARIANTS.A3.rep, pts: 1.5, trainPts: 1, greatPts: 2, mastery: 0.5 };
// 案D(r1115-093): いっしょ型を「大きい順に 1・1/2・1/4…」で重ねる(その子のいっしょ型の合計ごとに)・失敗率/サボり/ストレスの下げは合計 50% まで・体力消費ダウンは 40% まで
const DIM = [
  ["const withSum = (s, card, id) => { let v = 0; if (card) card.members.forEach(i => { const lv = assistLv(s.team[i], id); if (lv) v += num(aOf(id, 'v', lv)); }); return v; };",
   "const __dim = (a) => a.slice().sort((x, y) => y - x).reduce((t, x, i) => t + x * Math.pow(0.5, i), 0); const withSum = (s, card, id) => { const a = []; if (card) card.members.forEach(i => { const lv = assistLv(s.team[i], id); if (lv) a.push(num(aOf(id, 'v', lv))); }); return __dim(a); };"],
  ["const loy = loyalOf(s); let add = 0; let tag = 0; const tags = [];", "const loy = loyalOf(s); let add = 0; let tag = 0; const tags = []; const __ap = [];"],
  ["add += (memberEffect(m, card.stat, loy) + evMod(s, 'boost', i)) / 100;", "add += ((m.bonus[card.stat] || 0) + evMod(s, 'boost', i)) / 100; __ap.push(assistPart(m, card.stat, loy));"],
  ["if (card.members.length >= GATHER.groupMin) add +=", "add += __dim(__ap) / 100; if (card.members.length >= GATHER.groupMin) add +="],
  ["card.members.forEach(i => { const lv = assistLv(s.team[i], 'hirameki'); if (lv) g += aOf('hirameki', 'v', lv) / 100; });", "g += withSum(s, card, 'hirameki') / 100;"],
  ["return Math.min(0.8, c); };", "return Math.min(0.5, c); };"],
  ["f *= 1 - Math.min(0.8, cut);", "f *= 1 - Math.min(0.5, cut);"],
  ["(1 - Math.min(0.6, it))", "(1 - Math.min(0.4, it))"],
];
VARIANTS.D = { name: '案D 重なり方の決め(093)', rep: DIM };
VARIANTS.A3D = { name: '案A3+D', rep: [...VARIANTS.A3.rep, ...DIM] };
VARIANTS.AP = { name: '案A+P', rep: VARIANTS.A.rep, pts: 2, greatPts: 2, mastery: 1 };
// 別案(勝手に入れない): 修行の能力の上がり(行き先の基礎 8 → 6)を少し下げる
VARIANTS.APs = { name: '案A+P+修行の基礎 8→6(別案)', rep: [...VARIANTS.A.rep, ['fixed: Object.freeze({ base: 8,', 'fixed: Object.freeze({ base: 6,']], pts: 2, greatPts: 2, mastery: 1 };
// ---- コスト案(r1115-107 の後半・クラフト37): 芯は同じで、編成の子がポイントで買えるアシスト効果だけが変わる ----
//   cost … 効果id → 1目盛りの値段(表に無い物は いまの値段)。編成 real-* と buy:* がこの値段で買う
const COST_P1 = { haru: 1, natsu: 1, aki: 1, fuyu: 1, hagemi: 1 };
VARIANTS.c_now = { name: 'コスト いま', rep: [] };
VARIANTS.c_P1 = { name: 'コスト案1 季節・励を半額', rep: [], cost: COST_P1 };
// 上限の表(CAP)に足して試す(芯の写しの CAPT だけを変える)
const CAPLINE = "const CAPT = AT && AT.CAP && typeof AT.CAP === 'object' ? AT.CAP : {};";
const capRep = (extra) => [[CAPLINE, `const CAPT = Object.assign({}, AT && AT.CAP && typeof AT.CAP === 'object' ? AT.CAP : {}, ${JSON.stringify(extra)});`]];
VARIANTS.x50 = { name: '上限案 修行効果アップ50%・修行特別効果アップ20', rep: capRep({ shugyo: { v: 50, sum: true }, shugyotoku: { v: 20, sum: true } }), cost: COST_P1 };
VARIANTS.x30 = { name: '上限案 修行効果アップ30%・修行特別効果アップ10', rep: capRep({ shugyo: { v: 30, sum: true }, shugyotoku: { v: 10, sum: true } }), cost: COST_P1 };
// ---- 修行の上振れを抑える案(r1115-173・クラフト43。数値は決まっていない。試すだけ) ----
//   ② 編成の得意(子の能力 × 3%/1%/0.5%)が、強い編成ほどそのまま修行の上がりに乗るのを抑える
const SG_LOOP = 'let w = 1; c.forEach(v => { o[k] += v * w; w *= F.overlap; });';
const sgCap = (n) => [[SG_LOOP, `let w = 1, __t = 0; c.forEach(v => { __t += v * w; w *= F.overlap; }); o[k] += Math.min(${n}, __t);`]];
VARIANTS.Sc10 = { name: '修行案1 編成の得意の分を1能力 +10 まで', rep: sgCap(10) };
VARIANTS.Sc15 = { name: '修行案1b 編成の得意の分を1能力 +15 まで', rep: sgCap(15) };
VARIANTS.Scourse = { name: '修行案2 編成の得意は行き先の4能力だけ', rep: [[SG_LOOP, 'const __cs = [].concat(...((SHUGYO.courses[course] || SHUGYO.courses.fire).stages || [])); let w = 1; c.forEach(v => { if (__cs.includes(k)) o[k] += v * w; w *= F.overlap; });']] };
VARIANTS.Spct = { name: '修行案3 得意の割合 3%/1%/0.5% → 2%/0.7%/0.3%', rep: [['pct: Object.freeze([0.03, 0.01, 0.005])', 'pct: Object.freeze([0.02, 0.007, 0.003])']] };
const pickV = String(opt('--variant', 'now,A,P,AP')).split(',');
const vlist = (pickV.includes('all') ? Object.keys(VARIANTS) : pickV).filter(k => VARIANTS[k]);

const DEPS = loadDeps();
const SRC = fs.readFileSync(CORE, 'utf8');
const TMP = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'monsuc-bal-'));
const coreOf = (v) => {
  let src = SRC;
  // 大会のポイントを倍に: gainWinPts の入口で掛ける(芯の写しだけ)
  if (v.pts && v.pts !== 1) src = src.replace('const gainWinPts = (s, v) => gainPts(s, Math.round(num(v) *', `const gainWinPts = (s, v) => gainPts(s, Math.round(num(v) * ${v.pts} *`);
  for (const [a, b] of v.rep) { if (!src.includes(a)) throw new Error(`案の元の文字が芯に無い: ${a.slice(0, 60)}`); src = src.split(a).join(b); }
  const f = path.join(TMP, `core-${Math.random().toString(36).slice(2)}.js`); fs.writeFileSync(f, src);
  return require(f).create(depsFor(DEPS));
};

const { engine, catalog } = battleLoad.load();
const GAME = require('./game-fight.js').makeGameFight(catalog);
const K = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];

// 編成: base = ベースモン / box-* = 10周点検と同じ箱の子(アシスト効果なし) / real-* = 育て終えた子らしい子(能力・技・引退で付くおまかせのアシスト効果)
const AT = require('../../monster-hero/data/monhero-success-assist.js');
const REAL = { B: { sum: 2600, techs: 4, loy: 70, pop: 40, power: 10000 }, A: { sum: 3400, techs: 6, loy: 80, pop: 55, power: 12500 }, S: { sum: 4300, techs: 8, loy: 85, pop: 70, power: 14500 } };
const ptOf = (v, id) => (v && v.cost && Number.isFinite(v.cost[id]) ? v.cost[id] : AT.BY_ID[id].pt);
// おまかせ(AT.autoPick と同じ配り方)を案の値段で
const autoPickPt = (v, pts) => {
  const order = [...AT.AUTO_ORDER]; AT.LIST.forEach(a => { if (a.from === 'core' && !order.includes(a.id)) order.push(a.id); });
  const n = {}; let left = pts;
  for (const step of [AT.AUTO_STEP, 1]) for (let changed = true; changed;) {
    changed = false;
    for (const id of order) {
      const a = AT.BY_ID[id]; const now = n[id] || 0; if (now >= a.max) continue;
      if (!now && Object.keys(n).length >= AT.MAX_KINDS) continue;
      const k = Math.min(step, a.max - now); const c = k * ptOf(v, id); if (c > left) continue;
      n[id] = now + k; left -= c; changed = true;
    }
  }
  return order.filter(id => n[id]).map(id => ({ id, n: n[id] }));
};
// 買う編成: 並べた順に、買えるだけ目盛りを取る(8種類まで)
const BUY = {
  tre: ['sokoji', 'atooshi', 'hirameki', 'ninzu', 'kizuna', 'ochitsuki', 'itawari', 'tsuika'],
  sea: ['haru', 'natsu', 'aki', 'fuyu', 'hagemi', 'atooshi', 'hirameki', 'ninzu'],
  none: [], s1: ['shugyo'], s2: ['shugyotoku'], s3: ['chokyo'], s4: ['wazakazu', 'waza', 'shugyohp', 'aptq'], s5: ['kokoroe'],
  shu: ['shugyo', 'shugyotoku', 'chokyo', 'wazakazu', 'waza', 'shugyohp', 'aptq', 'kokoroe'],
};
const buyPt = (v, pts, ids) => { let left = pts; const out = []; for (const id of ids) { if (out.length >= AT.MAX_KINDS) break; const a = AT.BY_ID[id]; if (!a) continue; const p = ptOf(v, id); const k = Math.min(a.max, Math.floor(left / p)); if (k > 0) { out.push({ id, n: k }); left -= k * p; } } return out; };
const teamOf = (SUC, kind, v) => {
  if (kind === 'base') return [];
  if (kind.startsWith('buy:')) { // buy:<買い方>:<B|A|S>
    const [, plan, rk] = kind.split(':'); const p = REAL[rk]; const sp = ['Undine', 'Mocchi', 'Golem', 'Pixie', 'Tiger', 'Kyubi'];
    const picks = buyPt(v, AT.pointsOf(p.power), BUY[plan]);
    return sp.map((x, i) => { const st = {}; K.forEach((k, j) => { st[k] = Math.round(p.sum / 6 * (0.7 + ((i + j) % 4) * 0.2)); }); return { kind: 'raised', species: x, name: `箱${i + 1}`, stats: st, lv: 30, loy: p.loy, pop: p.pop, techs: SUC.techsOf(x).slice(0, p.techs).map(t => t.id), assists: picks }; });
  }
  if (kind.startsWith('box-')) return boxSeed(kind).mons.slice(0, 6).map(m => ({ kind: 'raised', species: m.species, name: m.nick, stats: m.st, techs: m.techs }));
  if (kind === 'tsuika') { // 6体とも 能力 3,400・追加トレボーナスを最大で(r1115-122 の試算用)
    const sp = ['Undine', 'Mocchi', 'Golem', 'Pixie', 'Tiger', 'Kyubi'];
    return sp.map((x, i) => { const st = {}; K.forEach((k, j) => { st[k] = Math.round(3400 / 6 * (0.7 + ((i + j) % 4) * 0.2)); }); return { kind: 'raised', species: x, name: `箱${i + 1}`, stats: st, lv: 30, loy: 80, pop: 55, techs: SUC.techsOf(x).slice(0, 6).map(t => t.id), assists: [{ id: 'tsuika', n: AT.BY_ID.tsuika.v.length }] }; });
  }
  if (kind === 'max') { // 6体とも 能力の合計 4,300・いっしょ型8つを最大で(いちばん強く積んだ形)
    const ids = ['sokoji', 'atooshi', 'hirameki', 'ochitsuki', 'itawari', 'kizuna', 'ninzu', 'hagemi']; const sp = ['Undine', 'Mocchi', 'Golem', 'Pixie', 'Tiger', 'Kyubi'];
    return sp.map((x, i) => { const st = {}; K.forEach((k, j) => { st[k] = Math.round(4300 / 6 * (0.7 + ((i + j) % 4) * 0.2)); }); return { kind: 'raised', species: x, name: `箱${i + 1}`, stats: st, lv: 50, loy: 85, pop: 70, techs: SUC.techsOf(x).slice(0, 8).map(t => t.id), assists: ids.map(id => ({ id, n: AT.BY_ID[id].v.length })) }; });
  }
  const p = REAL[kind.replace('real-', '')]; const sp = ['Undine', 'Mocchi', 'Golem', 'Pixie', 'Tiger', 'Kyubi'];
  return sp.map((x, i) => { const st = {}; K.forEach((k, j) => { st[k] = Math.round(p.sum / 6 * (0.7 + ((i + j) % 4) * 0.2)); }); return { kind: 'raised', species: x, name: `箱${i + 1}`, stats: st, lv: 30, loy: p.loy, pop: p.pop, techs: SUC.techsOf(x).slice(0, p.techs).map(t => t.id), assists: autoPickPt(v, AT.pointsOf(p.power)) }; });
};
const runLap = (SUC, v, cfg, seed) => {
  const id = `lap-${cfg.species}-${cfg.name}-${seed}`;
  const team = teamOf(SUC, cfg.team, v);
  let s = SUC.newRun({ id, species: cfg.species, aid: 'mua', team, aidBondLv: 1 });
  let r = (seed * 2654435761 + 7) >>> 0; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  const wpick = (w) => { const ks = Object.keys(w).filter(k => w[k] > 0); let t = ks.reduce((a, k) => a + w[k], 0) * rnd(); for (const k of ks) { t -= w[k]; if (t <= 0) return k; } return ks[0]; };
  let lastUse = null; const out = { league: [0, 0], summit: [0, 0], losses: 0, wins: 0, ptsGot: 0, condLearned: 0, condTotal: 0, shugyo: 0, great: 0 };
  // 試合は本番の msxR3Fight をそのまま使う(r1115-202 H2: 前は入力を書き写していて、アシストの上乗せの渡し方・覚醒・aptUp・MONSUC_MATCH_RULE・相手の技の数がずれていた)
  const fight = () => {
    const f = GAME.msxR3Fight(engine, SUC, { s, nick: '' });
    lastUse = f ? f.use : null; return Boolean(f && f.won);
  };
  const pts0 = () => s.pts + s.ptsLost;
  let guard = 0;
  while (!s.over && guard++ < 260) {
    if (s.battle) {
      const opps = SUC.opponents(s); const wins = [];
      for (let j = 0; j < opps.length; j++) { const w = fight(opps[j], j); wins.push(w); if (!w) break; }
      const won = wins.length === opps.length && wins.every(Boolean); const bk = s.battle.kind;
      if (bk === 'junior' || bk === 'middle' || bk === 'pro') { out.league[1] += 1; if (won) out.league[0] += 1; }
      if (bk === 'summit') { out.summit[1] += 1; if (won) out.summit[0] += 1; }
      if (won) out.wins += 1; else out.losses += 1;
      const p = pts0(); s = SUC.settle(s, wins, lastUse).state; out.ptsGot += pts0() - p;
      if (s.mealReady && !s.over) { const o = SUC.mealOpts(s); if (o[0]) { const p2 = pts0(); s = SUC.meal(s, o[0]).state; out.ptsGot += pts0() - p2; } }
      continue;
    }
    if (SUC.storyDue(s) !== null) s = SUC.storyStep(s, 'a').state;
    const ev = (slot, o) => { if (!SUC.events) return; const x = SUC.events.open(s, slot, o); s = x.state; const e = x.out.ev; if (!e || e.watch) return; const ok = e.choices.filter(c => c.ok); if (!ok.length) return; const c = cfg.pick === 'first' ? ok[0] : cfg.pick === 'last' ? ok[ok.length - 1] : ok[Math.floor(rnd() * ok.length)]; const p = pts0(); const y = SUC.events.pick(s, c.c); if (y.out.ok) { s = y.state; out.ptsGot += pts0() - p; } };
    ev('start');
    const vw = SUC.peek(s); let a;
    if (vw.can.includes('cond')) a = { kind: 'cond' };
    else if (vw.can.includes('retry')) a = { kind: 'retry' };
    else if (vw.can.includes('clinic')) a = { kind: 'clinic' };
    else {
      const frac = s.hp / s.hpMax; const w = { ...cfg.style };
      if (frac < 0.3) { w.rest += 8; w.tr = 0; w.shu = 0; } else if (frac < 0.5) w.rest += 3; if (s.stress > 70) w.play += 5;
      if (!vw.can.includes('shugyo') || !vw.shugyo.techs.length) w.shu = 0;
      const cup = vw.cups.find(c => c.entry.ok); if (!cup) w.cup = 0;
      const k = wpick(w);
      if (k === 'tr') a = { kind: 'train', stat: K[cfg.focus[Math.floor(rnd() * cfg.focus.length)]] };
      else if (k === 'shu') { const t = vw.shugyo.techs.slice().sort((x, y) => (x.rank || 0) - (y.rank || 0)).pop(); a = { kind: 'shugyo', course: 'fire', techs: [t.id] }; }
      else if (k === 'cup') a = { kind: 'cup', id: cup.id };
      else a = { kind: k === 'play' ? 'play' : 'rest' };
    }
    const p = pts0(); const g0 = s.log.great;
    let x = SUC.act(s, a); if (!x.out.ok) x = SUC.act(s, { kind: 'rest' }); s = x.state;
    if (a.kind === 'shugyo' && x.out.ok) out.shugyo += 1;
    if (v.trainPts && s.last && s.last.kind === 'train' && ['ok', 'great'].includes(s.last.res)) { s.pts = Math.min(SUC.PTS.hold, s.pts + v.trainPts); out.ptsGot += v.trainPts; } // 案: トレーニングの成功で能力ポイント
    if (v.greatPts && s.log.great > g0) { s.pts = Math.min(SUC.PTS.hold, s.pts + v.greatPts); out.ptsGot += v.greatPts; } // 案: 大成功で能力ポイント(芯の写しの外で足す)
    out.ptsGot += pts0() - p;
    if (s.last && ['train', 'shugyo'].includes(s.last.kind) && cfg.react !== 'none') { s = SUC.react(s, cfg.react === 'scold' ? 'scold' : 'praise').state; ev('after'); }
    if (SUC.issaComes(s)) s = SUC.issa(s, 'none').state;
    // 案: 熟練へ振る(熟練の条件がある技の、条件の技がまだ届かない分だけ。期ごとに見直す)
    if (v.mastery && s.pts > 0) {
      const need = {}; SUC.techsOf(s.species).forEach(t => { if (!t.learn || !t.learn.need || s.techs.includes(t.id)) return; Object.entries(t.learn.need).forEach(([tid, n]) => { if (s.techs.includes(tid)) need[tid] = Math.max(need[tid] || 0, n); }); });
      Object.entries(need).sort((p1, q) => q[1] - p1[1]).forEach(([tid, n]) => { const lack = Math.max(0, n - (s.mastery[tid] || 0)); const use = Math.min(s.pts, Math.ceil(lack / v.mastery)); if (use > 0) { s.pts -= use; s.mastery[tid] = Math.min(100, (s.mastery[tid] || 0) + use * v.mastery); } });
    }
    s = SUC.endTurn(s).state;
  }
  s = SUC.autoPts(s).state;
  const e = SUC.evaluate(s);
  SUC.techsOf(s.species).forEach(t => { if (t.learn && t.learn.need && Object.keys(t.learn.need).length) { out.condTotal += 1; if (s.techs.includes(t.id)) out.condLearned += 1; } });
  return { ...out, power: e.power, grade: e.grade.label || String(e.grade), rank: e.rank };
};

// --matrix: 同じ子・同じ編成で「トレーニング中心」と「修行中心」を並べる(差が縮んだかを見る)
const MATRIX = args.includes('--matrix');
const STY = { tr: { name: 'トレーニング中心', style: { tr: 8, rest: 1, play: 0, shu: 0, cup: 1 }, react: 'praise', pick: 'first' }, shu: { name: '修行中心', style: { tr: 2, rest: 1, play: 0, shu: 6, cup: 1 }, react: 'praise', pick: 'first' } };
const MX_SP = { Mocchi: [1, 5, 0], Golem: [1, 5], Tiger: [3, 4, 1], Kyubi: [2, 3], Undine: [0, 2, 4] };
const MX_TEAM = String(opt('--teams', 'base,box-mid,real-B,real-A')).split(',');
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
const results = {};
for (const vk of vlist) {
  const v = VARIANTS[vk]; const SUC = coreOf(v); results[vk] = { name: v.name, laps: [] };
  const plan = MATRIX ? Object.entries(MX_SP).flatMap(([sp, focus]) => MX_TEAM.flatMap(team => Object.values(STY).map(st => ({ species: sp, focus, team, ...st })))) : LAPS;
  plan.forEach((cfg, li) => {
    const rs = []; for (let i = 0; i < RUNS; i++) rs.push(runLap(SUC, v, cfg, i + 1));
    const sum = (k) => rs.reduce((a, x) => a + x[k][0], 0) / rs.reduce((a, x) => a + x[k][1], 0);
    const pw = med(rs.map(x => x.power));
    const gd = {}; rs.forEach(x => { const L = String(x.grade).replace(/\d+$/, ''); gd[L] = (gd[L] || 0) + 1; });
    const row = { dist: ['M', 'SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E'].filter(k => gd[k]).map(k => `${k}${Math.round(gd[k] / RUNS * 100)}%`).join(' '), lap: li + 1, species: cfg.species, style: cfg.name, team: cfg.team, power: pw, grade: SUC.gradeOf(pw).label, losses: +(rs.reduce((a, x) => a + x.losses, 0) / RUNS).toFixed(1),
      leagueWin: Math.round(sum('league') * 100), summitWin: Math.round(sum('summit') * 100), endLose: Math.round(rs.filter(x => x.league[0] < x.league[1] || x.summit[0] < x.summit[1]).length / RUNS * 100),
      ptsGot: med(rs.map(x => x.ptsGot)), shugyo: med(rs.map(x => x.shugyo)), cond: +(rs.reduce((a, x) => a + x.condLearned, 0) / RUNS).toFixed(2), condTotal: rs[0].condTotal };
    results[vk].laps.push(row);
  });
}
for (const [vk, r] of Object.entries(results)) {
  console.log(`■ ${r.name}(${RUNS}回ずつ・中央値)`);
  console.log('周|子|育て方|編成|総合力|評価|負け|リーグ勝率|ファイナル勝率|期末で負けた周|能力P|修行|熟練の条件つき技');
  r.laps.forEach(x => console.log([x.lap, x.species, x.style, x.team, x.power, x.grade, x.losses, `${x.leagueWin}%`, `${x.summitWin}%`, `${x.endLose}%`, x.ptsGot, x.shugyo, `${x.cond}/${x.condTotal}`, x.dist].join('|')));
}
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ runs: RUNS, results }, null, 1));
fs.rmSync(TMP, { recursive: true, force: true });
