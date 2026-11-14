#!/usr/bin/env node
// モンヒロサクセスの試算(段取りの回1)。計算の芯 monster-hero/data/monhero-success.js を、ふつうのプレイヤーの作戦で
// 46ターン回し、育成ランクの分布・忠誠・タッグ・出来事・大会の勝ち方を集計する。大会の試合は助手マスモン対戦の芯で回す。
//
//   node tools/success/success-sim.js                 … 編成ごとのランク分布(既定 400回ずつ)
//   node tools/success/success-sim.js --runs 1000
//   node tools/success/success-sim.js --calibrate     … 大会の相手の基準 B(期の終わりの6能力の合計)を測って出す
//   node tools/success/success-sim.js --only none,B6 --issa stat
//   node tools/success/success-sim.js --json <出力先>
//   node tools/success/success-sim.js --no-events     … ランダムイベント(monhero-success-events.js)を起こさずに回す(くらべる用)
'use strict';
const fs = require('fs');
const { load } = require('./load');
const battleLoad = require('../masmon-battle/load.js');

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const RUNS = Math.max(1, Number(opt('--runs', 400)) || 400);
const ONLY = opt('--only', '');
const ISSA_PICK = opt('--issa', 'hp');
const CALIBRATE = args.includes('--calibrate');
const JSON_OUT = opt('--json', '');
const NO_EVENTS = args.includes('--no-events'); // ランダムイベント(monhero-success-events.js)を起こさない(くらべる用)

const loaded = load();
const { SUC } = loaded;
const SNAP = [];
const { engine, catalog } = battleLoad.load();
const K = SUC.KEYS;

// ---- 編成の子を作る(試算用・決まった乱数) ----
const RANK_PRESET = {
  C: { sum: 1950, lv: 20, techs: 3, m: 30, loy: 60, pop: 25 },
  B: { sum: 2500, lv: 30, techs: 4, m: 50, loy: 70, pop: 40 },
  S: { sum: 4300, lv: 50, techs: 6, m: 70, loy: 85, pop: 70 },
  M: { sum: 5850, lv: 99, techs: 8, m: 100, loy: 100, pop: 100 },
};
const AS3 = (power) => { try { const AT = require('../../monster-hero/data/monhero-success-assist.js'); return AT.VERSION === 3 ? AT.autoPick(AT.pointsOf(power), []).picks : []; } catch (e) { return []; } };
const makeRaised = (rng, rank, topStats, assists) => {
  const p = RANK_PRESET[rank];
  const species = SUC.speciesList[Math.floor(rng() * SUC.speciesList.length)];
  const w = {}; K.forEach(k => { w[k] = 0.6 + rng() * 0.4; });
  if (topStats) topStats.forEach((k, i) => { w[k] = 1.8 - i * 0.15; });
  const ws = K.reduce((a, k) => a + w[k], 0);
  const stats = {}; K.forEach(k => { stats[k] = Math.min(999, Math.round(p.sum * w[k] / ws)); });
  const techs = SUC.techsOf(species).slice(0, p.techs).map(t => t.id);
  return { kind: 'raised', species, stats, lv: p.lv, masteries: Array(p.techs).fill(p.m), techs, loy: p.loy, pop: p.pop, assists: assists || [] };
};
// よくあるアシストの持ち方(誰にでも効くもの・ポイントの予算内: M 約390・S 約280・B 約160)
const AS_M = [{ id: 'sokoji', lv: 3 }, { id: 'kizuna', lv: 2 }, { id: 'atooshi', lv: 3 }, { id: 'kaketsuke', lv: 2 }]; // 128+80+80+64 = 352
const AS_S = [{ id: 'sokoji', lv: 3 }, { id: 'kizuna', lv: 2 }, { id: 'atooshi', lv: 2 }, { id: 'ochitsuki', lv: 1 }]; // 128+80+48+24 = 280
const AS_MH = [{ id: 'sokoji', lv: 3 }, { id: 'atooshi', lv: 3 }, { id: 'mitate', lv: 3 }, { id: 'miseba', lv: 3 }]; // 128+80+80+80 = 368(ひらめきの2つ入り)
const HINT5 = [[{ id: 'gatsu', lv: 3 }, { id: 'miseba', lv: 3 }], [{ id: 'mitate', lv: 3 }, { id: 'kensho', lv: 3 }], [{ id: 'mimamori', lv: 3 }]]; // ひらめき5つを段3で(編成の3体に分けて持たせる)
const AS_B = [{ id: 'sokoji', lv: 2 }, { id: 'atooshi', lv: 2 }, { id: 'kizuna', lv: 1 }]; // 80+48+40 = 168(B の上のほう)
const STAY7 = [[{ id: 'tairyoku', lv: 5 }, { id: 'gussuri', lv: 5 }, { id: 'kuishinbo', lv: 5 }, { id: 'shitsuke', lv: 5 }], [{ id: 'asobi', lv: 5 }, { id: 'genki', lv: 5 }, { id: 'tsukisoi', lv: 5 }]];
const CUP8 = [[{ id: 'shokin', lv: 5 }, { id: 'kokoroe', lv: 5 }, { id: 'ticket', lv: 5 }, { id: 'rivaldamashii', lv: 5 }], [{ id: 'ninki', lv: 5 }, { id: 'yobimizu', lv: 5 }, { id: 'mejirushi', lv: 5 }, { id: 'joshu', lv: 5 }]];
const PRESETS = {
  none: { name: '編成なし(ベースモン6枠)', team: () => [] },
  C6: { name: 'C 6体(得意ばらばら)', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'C')) },
  B6: { name: 'B 6体(得意ばらばら)', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'B')) },
  B6same: { name: 'B 6体(得意そろえ: ちから・命中・回避)', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'B', ['pow', 'hit', 'eva'])) },
  B6sokoji: { name: 'B 6体・全員 特訓の底力 段2', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'B', null, [{ id: 'sokoji', lv: 2 }])) },
  S6: { name: 'S 6体(得意ばらばら)', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'S')) },
  M6: { name: 'M 6体(得意ばらばら)', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'M')) },
  M6as: { name: 'M 6体・全員アシストあり(底力3・きずな2・後押し3・かけつけ2)', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'M', null, AS_M)) },
  S6as: { name: 'S 6体・全員アシストあり(底力3・きずな2・後押し2・落ち着き1)', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'S', null, AS_S)) },
  B6hint5: { name: 'B 6体・ひらめき5つ段3(大会の試合だけに効く)', team: (rng) => Array.from({ length: 6 }, (_, i) => makeRaised(rng, 'B', null, HINT5[i] || [])) },
  M6hint: { name: 'M 6体・アシストあり(底力3・後押し3・見立て3・見せ場3)', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'M', null, AS_MH)) },
  M6asAim: { name: 'M 6体・アシストあり・得意そろえ(ちから・命中・回避)', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'M', ['pow', 'hit', 'eva'], AS_M)) },
  B6as: { name: 'B 6体・全員アシストあり(底力2・後押し2・きずな1)', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'B', null, AS_B)) },
  // 段5(第2版・2026-11-12): いちばん強い形。総合力が狙いのランクを超えすぎないかを見る
  B6sokoji5: { name: 'B 6体・全員 特訓の底力 段5', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'B', null, [{ id: 'sokoji', lv: 5 }])) },
  M6as5: { name: 'M 6体・全員アシスト段5(底力・きずな・後押し・かけつけ)', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'M', null, [{ id: 'sokoji', lv: 5 }, { id: 'kizuna', lv: 5 }, { id: 'atooshi', lv: 5 }, { id: 'kaketsuke', lv: 5 }])) },
  // トレーニングに効く新しい11種 段5(第2版・依頼②・2026-11-12)
  B6kun5: { name: 'B 6体・得意そろえ・全員 ちから/命中/回避特訓 段5+タッグの息 段5', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'B', ['pow', 'hit', 'eva'], [{ id: 'kunpow', lv: 5 }, { id: 'kunhit', lv: 5 }, { id: 'kuneva', lv: 5 }, { id: 'tagpow', lv: 5 }])) },
  B6care5: { name: 'B 6体・全員 見張り役・気晴らし・仲よし特訓・はじめの親しさ 段5', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'B', null, [{ id: 'miharu', lv: 5 }, { id: 'kibarashi', lv: 5 }, { id: 'nakayoshi', lv: 5 }, { id: 'shitashi', lv: 5 }])) },
  M6new5: { name: 'M 6体・得意そろえ・全員 底力・後押し・ちから特訓・タッグの息 段5', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'M', ['pow', 'hit', 'eva'], [{ id: 'sokoji', lv: 5 }, { id: 'atooshi', lv: 5 }, { id: 'kunpow', lv: 5 }, { id: 'tagpow', lv: 5 }])) },
  // いるだけ型(体力・ようす・編成の7つ)段5(依頼③の1つ目)。いるだけ型は編成でいちばん高い段の1つだけなので、7つを4体と2体に分けて持たせる
  B6stay5: { name: 'B 6体・いるだけ型7つ 段5(体力自慢・ぐっすり・食いしん坊・しつけ上手/遊び上手・元気のお守り・通院の付きそい)', team: (rng) => Array.from({ length: 6 }, (_, i) => makeRaised(rng, 'B', null, i < 4 ? STAY7[0] : STAY7[1])) },
  M6stay5: { name: 'M 6体・底力 段5+いるだけ型7つ 段5', team: (rng) => Array.from({ length: 6 }, (_, i) => makeRaised(rng, 'M', null, i < 4 ? STAY7[0] : [{ id: 'sokoji', lv: 5 }, ...STAY7[1]])) },
  // 第3版(2026-11-14): 全員がおまかせで取ったアシスト効果(ポイント = そのランクの中ほどの総合力 ÷ 50)。今の B6as・S6as・M6as とくらべる
  B6auto3: { name: 'B 6体・全員 第3版のおまかせ(200pt・8種類)', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'B', null, AS3(10000))) },
  S6auto3: { name: 'S 6体・全員 第3版のおまかせ(290pt・8種類)', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'S', null, AS3(14500))) },
  M6auto3: { name: 'M 6体・全員 第3版のおまかせ(390pt・8種類)', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'M', null, AS3(19500))) },
  B6cup5: { name: 'B 6体・いるだけ型8つ 段5(賞金かせぎ・勝負の心得・チケット運・ライバル魂/人気者のお手本・出来事の呼び水・博士の目じるし・博士の助手)', team: (rng) => Array.from({ length: 6 }, (_, i) => makeRaised(rng, 'B', null, i < 3 ? CUP8[0] : CUP8[1])) },
  M6all5: { name: 'M 6体・底力 段5+いるだけ型15 段5(いちばん積んだ形)', team: (rng) => Array.from({ length: 6 }, (_, i) => makeRaised(rng, 'M', null, [[{ id: 'sokoji', lv: 5 }, ...STAY7[1]], STAY7[0], CUP8[0], CUP8[1], [{ id: 'sokoji', lv: 5 }], [{ id: 'sokoji', lv: 5 }]][i])) },
  M6kun5: { name: 'M 6体・得意そろえ・全員 ちから/命中/回避特訓・タッグの息 段5', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'M', ['pow', 'hit', 'eva'], [{ id: 'kunpow', lv: 5 }, { id: 'kunhit', lv: 5 }, { id: 'kuneva', lv: 5 }, { id: 'tagpow', lv: 5 }])) },
  S6aim: { name: 'S 6体・得意そろえ・人なつっこさ段3+底力段3', team: (rng) => Array.from({ length: 6 }, () => makeRaised(rng, 'S', ['pow', 'hit', 'eva'], [{ id: 'hitonatsu', lv: 3 }, { id: 'sokoji', lv: 3 }])) },
};
const VARIANTS = [
  { key: 'none', aidLv: 1 }, { key: 'C6', aidLv: 3 }, { key: 'B6', aidLv: 3 }, { key: 'B6', aidLv: 5, label: 'B 6体・助手の仲良し Lv5(タッグあり)' },
  { key: 'B6same', aidLv: 3 }, { key: 'B6sokoji', aidLv: 3 }, { key: 'S6', aidLv: 3 }, { key: 'M6', aidLv: 5 }, { key: 'S6aim', aidLv: 5 },
  { key: 'none', aidLv: 1, rematch: { sand: 2 }, label: '編成なし・時渡りの砂時計2つを持ちこみ' }, { key: 'B6', aidLv: 3, rematch: { sand: 2 }, label: 'B 6体・時渡りの砂時計2つを持ちこみ' },
  { key: 'B6', aidLv: 3, rematch: { rainbow: 2 }, label: 'B 6体・虹の時渡りの砂時計2つを持ちこみ' },
  { key: 'B6', aidLv: 3, carry: ['mag', 'hachi'], label: 'B 6体・持ちこみ2つ(週刊!トレーニング・修行のハチマキ)' },
  { key: 'B6', aidLv: 3, cups: true, label: 'B 6体・ライバル2人(助手・フレンド)の大会に出る' },
  { key: 'M6hint', aidLv: 5 },
  { key: 'B6hint5', aidLv: 3 },
  { key: 'B6as', aidLv: 3 }, { key: 'S6as', aidLv: 5 }, { key: 'M6as', aidLv: 5 }, { key: 'M6asAim', aidLv: 5 }, { key: 'B6auto3', aidLv: 3 }, { key: 'S6auto3', aidLv: 5 }, { key: 'M6auto3', aidLv: 5 },
  { key: 'B6sokoji5', aidLv: 3 }, { key: 'M6as5', aidLv: 5 }, // 段5(第2版・2026-11-12)
  { key: 'B6kun5', aidLv: 3 }, { key: 'B6care5', aidLv: 3 }, { key: 'M6kun5', aidLv: 5 }, { key: 'M6new5', aidLv: 5 }, // トレーニングに効く新しい11種 段5(依頼②)
  { key: 'B6stay5', aidLv: 3 }, { key: 'M6stay5', aidLv: 5 }, // いるだけ型7つ 段5(依頼③の1つ目)
  { key: 'B6cup5', aidLv: 3 }, { key: 'M6all5', aidLv: 5 }, // いるだけ型8つ 段5(依頼③の2つ目)
];

// ---- 試合(助手マスモン対戦の芯で 1対1) ----
const GEAR = { debut: [2, 10, 5], junior: [2, 20, 10], middle: [3, 40, 20], pro: [4, 60, 30], final: [5, 80, 40] };
const battleSp = (sp) => (catalog.species[sp] ? sp : 'Mocchi');
const unitOf = (sp0, stats, techs, mastery) => {
  const sp = battleSp(sp0); const ts = catalog.species[sp].techs.slice(0, techs).map(t => t.id);
  const ms = {}; ts.forEach(t => { ms[t] = mastery; });
  return { species: sp, name: sp, lv: 1, stats, techs: ts, mastery: ms };
};
let LAST_USE = null;
const TECH_BOOST_ON = Boolean(engine && (engine.TECH_BOOST || (engine.FEATURES && engine.FEATURES.techBoost)));
const fight = (s, opp, idx) => {
  const g = GEAR[SUC.periodOf(s.turn).key];
  const loy = SUC.loyalOf(s);
  // 育てる子は、修行と連続イベントで覚えた技・熟練そのままで戦う
  const sp = battleSp(s.species); const own = catalog.species[sp].techs.map(t => t.id);
  const ts = s.techs.filter(t => own.includes(t));
  // 熟練の効き目: 芯に techBoost の口があればそこへ(芯の熟練は空に)。無ければ今までどおり mastery で渡す
  const boost = TECH_BOOST_ON && typeof SUC.techBoostOf === 'function';
  const a = { species: sp, name: sp, lv: 1, stats: s.stats, techs: ts.length ? ts : undefined, ...(boost ? { mastery: {}, techBoost: SUC.techBoostOf(s) } : { mastery: Object.fromEntries(ts.map(t => [t, s.mastery[t] || 0])) }), loy, pop: s.pop };
  const b = { ...unitOf(opp.species, opp.stats, opp.techs, opp.mastery), ...(Number.isFinite(opp.loy) ? { loy: opp.loy } : {}), ...(Number.isFinite(opp.pop) ? { pop: opp.pop } : {}) }; // 相手の人気・忠誠(2026-11-12 社長)
  const r = engine.simulate({ seed: `${s.id}:${s.turn}:${s.battle.kind}:${s.battle.retry || 0}:${s.battle.round}:${idx}:${s.battle.again || 0}`, catalog,
    teamA: { assistantId: s.aid, tactics: g[2], members: [a] }, teamB: { assistantId: 'kiki', tactics: opp.tactics, members: [b] }, buffs: SUC.battleBuffs(s) });
  LAST_USE = typeof SUC.techUseOf === 'function' ? SUC.techUseOf(r.log, 'A') : null; // 熟練: 技ごとに使った回数
  return r.winner === 'A';
};

// ---- ふつうのプレイヤーの作戦 ----
// ランダムイベント: ふつうのプレイヤーの選び方(体力が少なければ体力の戻る方・ストレスが高ければ下がる方・ほかは能力の上がる方・無ければ a)
const EVT = { n: 0, st: 0, kinds: {} };
const chooseEvent = (s, ev) => {
  if (ev.watch) return null;
  const ok = ev.choices.filter(c => c.ok);
  const score = (c) => { const fx = c.fx || []; let v = 0; fx.forEach(([op, a, b]) => { if (op === 'st') v += (a === 'all' ? 6 : 1) * b * 10; if (op === 'hp' && s.hp < s.hpMax * 0.4) v += a; if (op === 'str' && s.stress >= 50) v -= a; if (op === 'loy' && SUC.loyalOf(s) < 60) v += a; }); if (c.p) v += c.p * 8; return v; };
  return ok.slice().sort((x, y) => score(y) - score(x))[0].c;
};
const runEvent = (s, slot, o) => {
  if (NO_EVENTS || !SUC.events) return s;
  const r = SUC.events.open(s, slot, o); s = r.state; const ev = r.out.ev; if (!ev) return s;
  const p = SUC.events.pick(s, chooseEvent(s, ev)); if (!p.out.ok) return s;
  EVT.n += 1; EVT.kinds[ev.kind] = (EVT.kinds[ev.kind] || 0) + 1; EVT.st += Object.values(p.out.delta.stats || {}).reduce((x, y) => x + y, 0);
  return p.state;
};
let CUP_MODE = false; // ライバルの大会に出る作戦(試算の行で切り替える)
const chooseAction = (s, v) => {
  if (v.can.includes('cond')) return { kind: 'cond' };
  if (v.can.includes('retry')) return { kind: 'retry' };
  if (v.can.includes('clinic')) return { kind: 'clinic' };
  if (CUP_MODE && v.can.includes('cup') && s.hp >= s.hpMax * 0.5) { const c = v.cups.find(x => x.rival && x.entry.ok); if (c) return { kind: 'cup', id: c.id }; }
  const ratio = s.hp / s.hpMax;
  // 修行: 体力が上限の70%以上あれば行く。行き先は素質と低い能力に合うところ・技は「強さ × 覚える率」の上から2つ
  // 修行はチケットの数だけ。札の倍率が低いとき(よく伸びる札が無い)か、いまより強い技を覚えられそうなときに行く
  const bestMult = Math.max(...Object.values(v.cards).map(c => c.mult));
  const knownPow = Math.max(0, ...s.techs.map(id => (SUC.techsOf(s.species).find(t => t.id === id) || {}).power || 0));
  const goodTech = v.shugyo.techs.some(t => t.power > knownPow && t.rate >= 0.35);
  if (v.can.includes('shugyo') && ratio >= 0.7 && (goodTech || bestMult < 1.5 || v.shugyo.tickets > 3)) {
    const avg0 = K.reduce((x, k) => x + s.stats[k], 0) / 6;
    let course = null; let cs = -1;
    for (const [key, c] of Object.entries(SUC.SHUGYO.courses)) { const sc = c.stages.flat().reduce((x, k) => x + SUC.aptMult(s.species, k) * Math.sqrt((avg0 + 50) / (s.stats[k] + 50)), 0); if (sc > cs) { cs = sc; course = key; } }
    const techs = v.shugyo.techs.slice().sort((x, y) => y.power * y.rate - x.power * x.rate).slice(0, v.shugyo.superLeft > 0 && v.shugyo.tickets >= 2 && v.shugyo.techs.length >= 2 ? 2 : 1).map(t => t.id); // 超修行が残っていれば2つ(2026-11-13)
    return { kind: 'shugyo', course, techs };
  }
  if (ratio < 0.45) return (s.stress >= 40) ? { kind: 'play' } : { kind: 'rest' };
  if (s.stress >= 60) return { kind: 'play' };
  const avg = K.reduce((a, k) => a + s.stats[k], 0) / 6;
  let best = null;
  for (const c of Object.values(v.cards)) {
    const bal = Math.sqrt((avg + 50) / (s.stats[c.stat] + 50));
    const sc = c.mult * SUC.aptMult(s.species, c.stat) * bal * (1 - c.fail);
    if (!best || sc > best.sc) best = { sc, kind: c.kind, stat: c.stat };
  }
  return { kind: best.kind, stat: best.stat };
};
const chooseReact = (s) => {
  const good = s.last.res === 'great' || s.last.res === 'ok';
  if (good) return s.ama < 50 ? 'praise' : null;
  return 'scold';
};

const RIVALS = (rng) => [0, 1].map(i => { const r = makeRaised(rng, 'B'); return { kind: i ? 'friend' : 'aid', name: i ? 'フレンドの子' : '助手のマスモン', species: r.species, stats: r.stats }; });
const playRun = (id, preset, aidLv, species, aid, rematch, carry, bag, rivals) => {
  const rng = SUC.rngOf(id, 'team');
  let s = SUC.newRun({ id, species, aid, team: PRESETS[preset].team(rng), aidBondLv: aidLv, items: rematch || {}, carry: carry || [], bag: bag || {}, rivals: rivals ? RIVALS(rng) : [] });
  const trace = { loyal60: null, periodSums: {} };
  let guard = 0;
  while (!s.over && guard++ < 200) {
    if (s.battle) {
      if (CALIBRATE) SNAP.push(JSON.parse(JSON.stringify(s)));
      let opps = SUC.opponents(s); const wins = [];
      for (let j = 0; j < opps.length; j++) {
        let w = fight(s, opps[j], j);
        // 負けたら砂時計でやり直す(先に同じ相手の砂時計・無ければ虹で相手を変える)
        let cur = opps;
        while (!w && (SUC.canRematch(s, 'sand') || SUC.canRematch(s, 'rainbow'))) { s = SUC.rematch(s, SUC.canRematch(s, 'sand') ? 'sand' : 'rainbow').state; cur = SUC.opponents(s); w = fight(s, cur[j], j); opps = cur; }
        wins.push(w); if (!w) break;
      }
      trace.battles = trace.battles || []; trace.battles.push({ kind: s.battle.kind, round: s.battle.round, won: wins.every(Boolean) && wins.length === opps.length });
      const bk = s.battle.kind; const rv = Boolean(s.battle.rival);
      const st = SUC.settle(s, wins, LAST_USE); s = st.state;
      s = runEvent(s, 'cup', { won: st.out.won, kind: bk });
      if (bk === 'cup') { trace.cups = (trace.cups || 0) + 1; if (rv) { trace.rivalCups = (trace.rivalCups || 0) + 1; if (st.out.won) trace.rivalWins = (trace.rivalWins || 0) + 1; } }
      // 大会のあとのごはん(9種): 忠誠60未満 → ごちそう、体力が少ない → ビタミン、賞金があれば いちばん高い能力の餌
      if (s.mealReady && !s.over) {
        const topK = Object.keys(s.stats).sort((x, y) => s.stats[y] - s.stats[x])[0]; const can = (k) => !!SUC.MEALS[k];
        const pick = SUC.loyalOf(s) < 60 && can('gochiso') ? 'gochiso' : s.hp < s.hpMax * 0.6 && can('vitamin') ? 'vitamin' : can(`f_${topK}`) ? `f_${topK}` : null;
        if (pick) s = SUC.meal(s, pick).state;
      }
      continue;
    }
    // 育成中のアイテム(1ターン1個): 体力が3割を切ったらジュース・忠誠50未満ならライセンス
    if (s.bag) { if (s.hp < s.hpMax * 0.3 && s.bag.juice) s = SUC.useItem(s, 'juice').state; else if (SUC.loyalOf(s) < 50 && s.bag.license) s = SUC.useItem(s, 'license').state; }
    // 助手の連続イベント(ゲームと同じくターンのはじめ・ランダムイベントの前)。2択は a(いい結末への道)
    if (SUC.storyDue(s) !== null) s = SUC.storyStep(s, 'a').state;
    s = runEvent(s, 'start');
    const v = SUC.peek(s);
    const a = chooseAction(s, v);
    let r = SUC.act(s, a); s = r.state;
    if (s.last && ['train', 'shugyo'].includes(s.last.kind)) { s = SUC.react(s, chooseReact(s)).state; s = runEvent(s, 'after'); }
    if (SUC.issaComes(s)) s = SUC.issa(s, ISSA_PICK).state;
    const p = SUC.periodOf(s.turn);
    if (p.left === 1) trace.periodSums[p.key] = SUC.sumOf(s.stats);
    if (trace.loyal60 === null && SUC.loyalOf(s) >= 60) trace.loyal60 = s.turn;
    s = SUC.endTurn(s).state;
  }
  s = SUC.autoPts(s).state;
  return { s, ev: SUC.evaluate(s), trace };
};

const SPECIES = SUC.speciesList.filter(sp => catalog.species[sp]);
const AIDS = SUC.AIDS;
const pct = (n, d) => (d ? Math.round(n / d * 1000) / 10 : 0);
const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
const mean = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : 0);

const runVariant = (vr) => {
  const ranks = {}; const powers = []; const sums = []; const loy60 = []; const loys = []; const tags = [0, 0, 0, 0];
  const lg = { rematch: 0, meal: 0, shugyo: 0, learned: 0, taught: 0, train: 0, great: 0, fail: 0, sab: 0, events: 0, story: 0, cond: 0, rest: 0, play: 0, clinic: 0 };
  const per = {}; const bt = {}; let over = { done: 0, lost: 0, gameover: 0 }; let story3 = 0; const techN = []; let rivalCups = 0; let rivalWins = 0; let issaMet = 0; let issaWon = 0; let pts = 0;
  const endK = {}; const endPow = {}; // エンディング(2026-11-13)の割合と、その子の総合力
  EVT.n = 0; EVT.st = 0; EVT.kinds = {};
  for (let i = 0; i < RUNS; i++) {
    const id = `${vr.key}-${vr.aidLv}-${i}`;
    const sp = SPECIES[i % SPECIES.length]; const aid = AIDS[i % AIDS.length];
    CUP_MODE = Boolean(vr.cups);
    const { s, ev, trace } = playRun(id, vr.key, vr.aidLv, sp, aid, vr.rematch, vr.carry, vr.bag, vr.cups);
    rivalCups += trace.rivalCups || 0; rivalWins += trace.rivalWins || 0;
    ranks[ev.rank] = (ranks[ev.rank] || 0) + 1; powers.push(ev.power); sums.push(ev.sum); loys.push(ev.loyal);
    if (trace.loyal60 !== null) loy60.push(trace.loyal60);
    s.log.tagTurns.forEach((n, j) => { tags[j] += n; });
    Object.keys(lg).forEach(k => { lg[k] += s.log[k] || 0; });
    over[s.over] = (over[s.over] || 0) + 1;
    { const ek = s.ending ? s.ending.kind : 'none'; endK[ek] = (endK[ek] || 0) + 1; (endPow[ek] = endPow[ek] || []).push(ev.power); }
    story3 += s.story.filter(x => x >= 3).length; techN.push(s.techs.length); issaMet += s.issaMet; issaWon += s.issaWon; pts += s.pts + 0;
    Object.entries(trace.periodSums).forEach(([k, v]) => { (per[k] = per[k] || []).push(v); });
    (trace.battles || []).forEach(b => { const key = b.kind === 'summit' ? `summit${b.round + 1}` : b.kind; bt[key] = bt[key] || [0, 0]; bt[key][0] += b.won ? 1 : 0; bt[key][1] += 1; });
  }
  const order = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'M'];
  return {
    label: vr.label || PRESETS[vr.key].name, aidLv: vr.aidLv,
    rank: order.filter(k => ranks[k]).map(k => `${k} ${pct(ranks[k], RUNS)}%`).join(' / '), grade: SUC.gradeOf(median(powers)).label,
    powerMedian: median(powers), powerMean: mean(powers), sumMedian: median(sums), loyalMean: mean(loys),
    loyal60Turn: loy60.length ? median(loy60) : null, loyal60Rate: pct(loy60.length, RUNS),
    tagsPerRun: tags.map(n => Math.round(n / RUNS * 10) / 10),
    perRun: Object.fromEntries(Object.entries(lg).map(([k, v]) => [k, Math.round(v / RUNS * 10) / 10])),
    story3: Math.round(story3 / RUNS * 10) / 10, techs: mean(techN), rival: rivalCups ? `${Math.round(rivalCups / RUNS * 10) / 10}回出て勝率 ${pct(rivalWins, rivalCups)}%` : null, issa: `${Math.round(issaMet / RUNS * 100) / 100}回(成功 ${Math.round(issaWon / RUNS * 100) / 100})`,
    end: Object.fromEntries(Object.entries(over).map(([k, v]) => [k, pct(v, RUNS)])),
    ending: Object.fromEntries(['bad', 'good', 'super', 'none'].filter(k => endK[k]).map(k => [k, `${pct(endK[k], RUNS)}%(総合力 ${median(endPow[k])}・${SUC.gradeOf(median(endPow[k])).label})`])),
    randomEvents: { perRun: Math.round(EVT.n / RUNS * 10) / 10, statPerRun: Math.round(EVT.st / RUNS), kinds: Object.fromEntries(Object.entries(EVT.kinds).map(([k, v]) => [k, Math.round(v / RUNS * 10) / 10])) },
    battles: Object.fromEntries(Object.entries(bt).map(([k, [w, n]]) => [k, `${pct(w, n)}% (${n})`])),
    periodSumMedian: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, median(v)])),
  };
};

const list = VARIANTS.filter(v => !ONLY || ONLY.split(',').includes(v.key));
if (CALIBRATE) {
  // 「ふつうに育てた子」(編成なし・C 6体・B 6体)の大会の直前の様子を集め、狙いの勝率になる基準 B を二分探索で求める
  for (const v of [VARIANTS[0], VARIANTS[1], VARIANTS[2]]) runVariant(v);
  const TARGET = { debut: 0.8, junior: 0.6, middle: 0.45, pro: 0.3, summit: 0.25 };
  const { mod, deps } = loaded;
  const winRate = (key, bench) => {
    const S2 = mod.create(require('./load').depsFor(deps, { bench: { [key]: bench } }));
    let w = 0; let n = 0;
    for (const s0 of SNAP) {
      const kind = s0.battle.kind; if (kind !== key) continue;
      if (kind === 'debut' && s0.battle.retry) continue;
      if (kind === 'summit' && s0.battle.round !== 0) continue;
      const s = kind === 'summit' ? { ...s0, battle: { ...s0.battle, round: 2 } } : s0; // 頂は決勝の強さで見る
      const opps = S2.opponents(s); let ok = true;
      for (let j = 0; j < opps.length && ok; j++) ok = fight(s, opps[j], j);
      w += ok ? 1 : 0; n += 1;
    }
    return { rate: n ? w / n : 0, n };
  };
  const B = {};
  for (const key of Object.keys(TARGET)) {
    let lo = 200; let hi = 6000;
    for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; if (winRate(key, mid).rate > TARGET[key]) lo = mid; else hi = mid; }
    B[key] = Math.round(lo / 10) * 10; const r = winRate(key, B[key]);
    console.log(`${key}: 基準 ${B[key]} で勝率 ${Math.round(r.rate * 1000) / 10}%(${r.n}件・狙い ${TARGET[key] * 100}%)`);
  }
  console.log('BENCH の案:', JSON.stringify(B)); console.log('いまの BENCH:', JSON.stringify(SUC.BENCH));
  process.exit(0);
}
const results = [];
for (const v of list) {
  const r = runVariant(v); results.push(r);
  console.log(`■ ${r.label}(助手の仲良し Lv${r.aidLv}・${RUNS}回)`);
  console.log(`  ランク: ${r.rank}(中央値の評価 ${r.grade})`);
  console.log(`  総合力 中央値 ${r.powerMedian}・6能力の合計 中央値 ${r.sumMedian}・忠誠 平均 ${r.loyalMean}(60に届く ${r.loyal60Rate}%・届くターン中央値 ${r.loyal60Turn})`);
  console.log(`  タッグ 0/1/2/3+ 体のトレーニング: ${r.tagsPerRun.join(' / ')} 回・3話を見終わる子 ${r.story3}体・博士 ${r.issa}・技 平均 ${r.techs}つ`);
  console.log(`  1回あたり: ${Object.entries(r.perRun).map(([k, v]) => `${k} ${v}`).join('・')}`);
  console.log(`  大会の勝率: ${Object.entries(r.battles).map(([k, v]) => `${k} ${v}`).join('・')}`);
  if (r.rival) console.log(`  ライバルの大会: ${r.rival}`);
  if (!NO_EVENTS) console.log(`  ランダムイベント: 1回の育成で ${r.randomEvents.perRun}回(${Object.entries(r.randomEvents.kinds).map(([k, v]) => `${k} ${v}`).join('・')})・能力の合計 +${r.randomEvents.statPerRun}`);
  console.log(`  終わり方: ${Object.entries(r.end).map(([k, v]) => `${k} ${v}%`).join('・')}`);
  console.log(`  エンディング: ${Object.entries(r.ending).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
}
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ runs: RUNS, issa: ISSA_PICK, results }, null, 1));
