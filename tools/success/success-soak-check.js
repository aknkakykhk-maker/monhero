#!/usr/bin/env node
// モンヒロサクセスの計算の芯(monster-hero/data/monhero-success.js)の「通し検査」。画面は開かない(数秒)。
// monhero-success-check.js が1つずつの決まりを見るのに対し、こちらは 46ターンを最後まで何十回も回して、
// どの組み合わせでも壊れないかを見る。
//
//   ・いろいろな編成(なし・C/B/S/M・アシストつき)× 助手6人 × 持ちこみ(始める前/育成中/砂時計)× 作戦
//     (訓練重視・休み多め・修行と大会に出る・叱る/褒める・博士の6択・ごはん・アイテム)で最後まで回す
//   ・どの手のあとも: 例外が出ない・数がすべて有限・体力 0〜上限(上限は 160 まで)・6能力 0〜999・
//     甘え度/恐れ度 0〜50(忠誠 0〜100)・ストレス/人気 0〜100・チケット/砂時計/袋の数/能力ポイント/名声が負にならない・
//     やり直しは1回の育成で3回まで・技は8つまで・熟練と親密度は 0〜100
//   ・デビュー戦: 負けの数 = 砂時計を使わずに負けを受けた回数(砂時計でやり直して勝てば数えない)・3回でゲームオーバー
//   ・終わり方は done / lost / gameover のどれか・46ターンを超えて続かない・evaluate が有限
//   ・同じ育成 id と同じ手なら、まったく同じ結果になる
//   ・中断と再開: 途中の状態を JSON にして restore で戻すと、そのまま続けたときと同じ結果になる(何か所かで切る)
//
//   node tools/success/success-soak-check.js            … 既定(48通り)
//   node tools/success/success-soak-check.js --runs 200 … 回す数を増やす
//   node tools/success/success-soak-check.js --verbose  … 1回ずつの終わり方を出す
'use strict';
const { load } = require('./load');

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const RUNS = Math.max(6, Number(opt('--runs', 48)) || 48);
const VERBOSE = args.includes('--verbose');

const { SUC } = load();
const K = SUC.KEYS;
const errors = [];
const errOnce = new Set();
const fail = (msg) => { if (errOnce.has(msg)) return; errOnce.add(msg); errors.push(msg); };

// 試合は助手マスモン対戦の芯で回す行と、決まった乱数で勝ち負けを決める行(ゲームオーバーまで届かせるため)を混ぜる
let battle = null;
try { battle = require('../masmon-battle/load.js').load(); } catch (e) { battle = null; }

// ---- 編成の子 ----
const RANK = {
  C: { sum: 1950, lv: 20, techs: 3, m: 30, loy: 60, pop: 25 },
  B: { sum: 2500, lv: 30, techs: 4, m: 50, loy: 70, pop: 40 },
  S: { sum: 4300, lv: 50, techs: 6, m: 70, loy: 85, pop: 70 },
  M: { sum: 5850, lv: 99, techs: 8, m: 100, loy: 100, pop: 100 },
};
const ASSIST_SETS = [[], [{ id: 'sokoji', lv: 3 }, { id: 'kizuna', lv: 2 }], [{ id: 'hitonatsu', lv: 3 }, { id: 'atooshi', lv: 2 }], [{ id: 'itawari', lv: 2 }, { id: 'kaketsuke', lv: 2 }]];
const raised = (rng, rank, assists) => {
  const p = RANK[rank];
  const species = SUC.speciesList[Math.floor(rng() * SUC.speciesList.length)];
  const w = {}; K.forEach(k => { w[k] = 0.5 + rng(); });
  const ws = K.reduce((a, k) => a + w[k], 0);
  const stats = {}; K.forEach(k => { stats[k] = Math.min(999, Math.round(p.sum * w[k] / ws)); });
  const techs = SUC.techsOf(species).slice(0, p.techs).map(t => t.id);
  return { kind: 'raised', species, stats, lv: p.lv, masteries: Array(techs.length).fill(p.m), techs, loy: p.loy, pop: p.pop, assists };
};
const teamOf = (rng, kind) => {
  if (kind === 'none') return [];
  if (kind === 'mixed') return ['C', 'B', 'S', 'M'].map((r, i) => raised(rng, r, ASSIST_SETS[i % ASSIST_SETS.length]));
  return Array.from({ length: 6 }, (_, i) => raised(rng, kind, ASSIST_SETS[(i + kind.length) % ASSIST_SETS.length]));
};

const CARRY_SETS = [
  { carry: [], bag: {}, items: {} },
  { carry: ['mag', 'hachi'], bag: {}, items: { sand: 2 } },
  { carry: ['dango'], bag: { juice: 1 }, items: { rainbow: 1 } },
  { carry: ['guide'], bag: { loupe: 1 }, items: { sand: 3, rainbow: 3 } },
  { carry: [], bag: { pack: 1, license: 1 }, items: { sand: 1 } },
  { carry: ['band', 'omamori', 'grass'], bag: { powder: 5 }, items: { sand: 9, rainbow: 9 } }, // 上限より多く渡して切られるか
];
const STYLES = ['train', 'rest', 'wide', 'react'];
const TEAMS = ['none', 'C', 'B', 'S', 'M', 'mixed'];
const WIN_P = [0.9, 0.55, 0.25]; // 決まった乱数で勝つ確率(低いほどゲームオーバー・頂で負けに届く)

// ---- 1つの手を決める(決まった乱数は 状態のターン + 用途 から作る: 再開しても同じ手になる) ----
const rngAt = (s, tag) => SUC.rngOf(s.id, 'drv', s.turn, tag, s.battle ? `${s.battle.kind}:${s.battle.round}:${s.battle.again || 0}` : '-');
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

const chooseAction = (s, v, style) => {
  const r = rngAt(s, 'act');
  if (v.can.includes('cond')) return { kind: 'cond' };
  if (v.can.includes('retry')) return { kind: 'retry' };
  if (v.can.includes('clinic') && r() < 0.6) return { kind: 'clinic' };
  const ratio = s.hp / s.hpMax;
  if (style === 'wide') {
    if (v.can.includes('cup') && r() < 0.35) { const ok = v.cups.filter(c => c.entry.ok); if (ok.length) return { kind: 'cup', id: pick(r, ok).id }; }
    if (v.can.includes('shugyo') && r() < 0.4) {
      const course = pick(r, Object.keys(SUC.SHUGYO.courses));
      const techs = v.shugyo.techs.slice(0, v.shugyo.superLeft > 0 && v.shugyo.tickets >= 2 ? 2 : 1).map(t => t.id);
      return { kind: 'shugyo', course, techs };
    }
  }
  if (style === 'rest' && ratio < 0.7) return r() < 0.5 ? { kind: 'rest' } : { kind: 'play' };
  if (ratio < 0.3 && r() < 0.7) return s.stress >= 40 ? { kind: 'play' } : { kind: 'rest' };
  if (r() < 0.06) return { kind: pick(r, ['rest', 'play']) };
  // 体力が少なくてもわざと訓練する回も混ぜる(体力 0 の端を通す)
  return { kind: 'train', stat: pick(r, K) };
};
const chooseReact = (s, style) => {
  const r = rngAt(s, 'react');
  if (style === 'react') return pick(r, ['praise', 'scold', null, 'praise', 'scold']);
  const good = s.last && (s.last.res === 'great' || s.last.res === 'ok');
  return good ? (r() < 0.6 ? 'praise' : null) : (r() < 0.6 ? 'scold' : null);
};
const ISSA_KEYS = Object.keys(SUC.ISSA.choices);

// ---- 試合 ----
const GEAR = { debut: 10, junior: 20, middle: 40, pro: 60, final: 80 };
const fightEngine = (s, opp, idx) => {
  const { engine, catalog } = battle;
  const sp = catalog.species[s.species] ? s.species : 'Mocchi';
  const own = catalog.species[sp].techs.map(t => t.id); const ts = s.techs.filter(t => own.includes(t));
  const osp = catalog.species[opp.species] ? opp.species : 'Mocchi';
  const ots = catalog.species[osp].techs.slice(0, opp.techs).map(t => t.id);
  const a = { species: sp, name: sp, lv: 1, stats: s.stats, techs: ts.length ? ts : undefined, mastery: Object.fromEntries(ts.map(t => [t, s.mastery[t] || 0])), loy: SUC.loyalOf(s), pop: s.pop };
  const b = { species: osp, name: osp, lv: 1, stats: opp.stats, techs: ots, mastery: Object.fromEntries(ots.map(t => [t, opp.mastery])) };
  const r = engine.simulate({ seed: `${s.id}:${s.turn}:${s.battle.kind}:${s.battle.retry || 0}:${s.battle.round}:${idx}:${s.battle.again || 0}`, catalog,
    teamA: { assistantId: s.aid, tactics: GEAR[SUC.periodOf(Math.min(s.turn, SUC.TOTAL_TURNS)).key] || 40, members: [a] }, teamB: { assistantId: 'kiki', tactics: opp.tactics, members: [b] } });
  return r.winner === 'A';
};
const fightDice = (s, idx, p) => SUC.rngOf(s.id, 'win', s.turn, s.battle.kind, s.battle.round, s.battle.retry || 0, s.battle.again || 0, s.battle.reroll || 0, idx)() < p;

// ---- 見張り: どの手のあとも ----
const LOOSE = new Set(['log']); // 数の記録は有限かだけ見る
const walkFinite = (o, path, out) => {
  if (o === null || o === undefined) return;
  if (typeof o === 'number') { if (!Number.isFinite(o)) out.push(path); return; }
  if (typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) walkFinite(v, path ? `${path}.${k}` : k, out);
};
const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const checkState = (s, where) => {
  const bad = [];
  walkFinite(s, '', bad);
  if (bad.length) fail(`${where}: 数でない値(NaN/∞)がある: ${bad.slice(0, 4).join(', ')}`);
  try { JSON.stringify(s); } catch (e) { fail(`${where}: JSON にできない(${e.message})`); }
  if (!inRange(s.hpMax, 1, 160)) fail(`${where}: 体力の上限が 1〜160 でない: ${s.hpMax}`);
  if (!inRange(s.hp, 0, s.hpMax)) fail(`${where}: 体力が 0〜上限でない: ${s.hp}/${s.hpMax}`);
  K.forEach(k => { if (!inRange(s.stats[k], 0, 999)) fail(`${where}: 能力 ${k} が 0〜999 でない: ${s.stats[k]}`); });
  if (!inRange(s.ama, 0, 50) || !inRange(s.fear, 0, 50)) fail(`${where}: 甘え度・恐れ度が 0〜50 でない: ${s.ama}/${s.fear}`);
  const loy = SUC.loyalOf(s); if (!inRange(loy, 0, 100)) fail(`${where}: 忠誠が 0〜100 でない: ${loy}`);
  if (!inRange(s.stress, 0, 100)) fail(`${where}: ストレスが 0〜100 でない: ${s.stress}`);
  if (!inRange(s.pop, 0, 100)) fail(`${where}: 人気が 0〜100 でない: ${s.pop}`);
  if (!inRange(s.pol, -3, 3)) fail(`${where}: 育成方針が -3〜3 でない: ${s.pol}`);
  if (!inRange(s.tickets, 0, 999)) fail(`${where}: 修行チケットが負か多すぎ: ${s.tickets}`);
  if (!inRange(s.items.sand, 0, SUC.REMATCH.carry + 20) || !inRange(s.items.rainbow, 0, SUC.REMATCH.carry + 20)) fail(`${where}: 砂時計の数が負: ${JSON.stringify(s.items)}`);
  Object.entries(s.bag || {}).forEach(([k, n]) => { if (!inRange(n, 0, 99)) fail(`${where}: 袋の ${k} が負: ${n}`); });
  if (!inRange(s.rematchUsed, 0, SUC.REMATCH.max)) fail(`${where}: やり直しが ${SUC.REMATCH.max} 回を超えた: ${s.rematchUsed}`);
  if (!inRange(s.pts, 0, 1e6)) fail(`${where}: 能力ポイントが負: ${s.pts}`);
  if (!inRange(s.fame, 0, 1e7)) fail(`${where}: 名声が負: ${s.fame}`);
  if (!inRange(s.debutLoss, 0, 3)) fail(`${where}: デビュー戦の負けの数が 0〜3 でない: ${s.debutLoss}`);
  if (s.debutLoss >= 3 && s.over !== 'gameover') fail(`${where}: デビュー戦に3回負けたのにゲームオーバーでない`);
  if (s.over === 'gameover' && s.debutLoss < 3) fail(`${where}: デビュー戦の負けが3回未満でゲームオーバーになった: ${s.debutLoss}`);
  if (!inRange(s.turn, 1, SUC.TOTAL_TURNS + 1)) fail(`${where}: ターンが 1〜${SUC.TOTAL_TURNS + 1} でない: ${s.turn}`);
  if (s.over === 'done' && s.turn <= SUC.TOTAL_TURNS) fail(`${where}: 46ターン前に「育て終えた」になった: ${s.turn}`);
  if (s.over && !['done', 'lost', 'gameover'].includes(s.over)) fail(`${where}: 終わり方が知らない値: ${s.over}`);
  if (!Array.isArray(s.techs) || s.techs.length > SUC.TECH_MAX) fail(`${where}: 技が ${SUC.TECH_MAX} を超えた: ${s.techs && s.techs.length}`);
  (s.techs || []).forEach(t => { if (!inRange(s.mastery[t], 0, 100)) fail(`${where}: 熟練が 0〜100 でない: ${t}=${s.mastery[t]}`); });
  (s.bond || []).forEach((b, i) => { if (!inRange(b, 0, SUC.BOND.max)) fail(`${where}: 親密度[${i}] が 0〜${SUC.BOND.max} でない: ${b}`); });
  if (!inRange(s.aidBond, 0, SUC.BOND.max)) fail(`${where}: 助手の親密度が範囲外: ${s.aidBond}`);
  if (!inRange(s.lv, 1, 99)) fail(`${where}: Lv が 1〜99 でない: ${s.lv}`);
  if (s.carry.length + Object.values(s.bag || {}).reduce((a, n) => a + n, 0) > SUC.CARRY_MAX + 10) fail(`${where}: 持ちこみが多すぎ`);
};

// ---- 1回の育成を回す(stopAt の手数で止めて途中の状態を返せる) ----
const newRunOf = (c) => {
  const rng = SUC.rngOf(c.id, 'team');
  return SUC.newRun({ id: c.id, species: c.species, aid: c.aid, team: teamOf(rng, c.team), aidBondLv: c.aidLv, pol: c.pol, carry: c.set.carry, bag: c.set.bag, items: c.set.items,
    rivals: c.rivals ? [{ kind: 'aid', name: '助手のマスモン', species: 'Mocchi', stats: { life: 300, pow: 300, wise: 300, hit: 300, eva: 300, tough: 300 } }] : [] });
};
// 1手ずつ進める。戻り値: 次の状態(stats は c.stats に数える)
const step = (s, c, st) => {
  const where = `${c.id} T${s.turn}`;
  if (s.battle) {
    const b = s.battle;
    const opps = SUC.opponents(s);
    if (!Array.isArray(opps) || !opps.length) { fail(`${where}: 大会の相手が作れない(${b.kind})`); return null; }
    opps.forEach((o, j) => { K.forEach(k => { if (!inRange(o.stats[k], 0, 999)) fail(`${where}: 相手${j} の能力 ${k} が範囲外: ${o.stats[k]}`); }); });
    const wins = [];
    for (let j = 0; j < opps.length; j++) {
      const w = c.engine && battle ? fightEngine(s, SUC.opponents(s)[j], j) : fightDice(s, j, c.winP);
      if (!w && (SUC.canRematch(s, 'sand') || SUC.canRematch(s, 'rainbow'))) {
        const item = SUC.canRematch(s, 'sand') ? 'sand' : 'rainbow';
        const before = { n: s.items[item], used: s.rematchUsed, loss: s.debutLoss };
        const r = SUC.rematch(s, item); const s2 = r.state;
        if (!r.out.ok) { fail(`${where}: やり直せるはずが断られた`); return null; }
        if (s2.items[item] !== before.n - 1 || s2.rematchUsed !== before.used + 1) fail(`${where}: やり直しの数え方がおかしい(${item})`);
        if (s2.debutLoss !== before.loss) fail(`${where}: やり直しでデビュー戦の負けが増えた`);
        if (b.kind === 'debut') st.debutRematch += 1;
        st.rematch += 1; checkState(s2, `${where} rematch`);
        return s2; // 同じ大会をもう一度(次の step で戦い直す)
      }
      wins.push(w); if (!w) break;
    }
    const lossBefore = s.debutLoss;
    const r = SUC.settle(s, wins); const s2 = r.state;
    const won = wins.length === opps.length && wins.every(Boolean);
    if (b.kind === 'debut') {
      if (won && s2.debutLoss !== lossBefore) fail(`${where}: デビュー戦に勝ったのに負けが増えた`);
      if (!won && s2.debutLoss !== lossBefore + 1) fail(`${where}: デビュー戦の負けが1つずつ増えない: ${lossBefore}→${s2.debutLoss}`);
      if (!won) st.debutLossSeen += 1;
    }
    if (b.kind === 'summit' && !won && s2.over !== 'lost') fail(`${where}: 頂への道で負けても終わらない`);
    st.battles += 1; if (won) st.wins += 1;
    checkState(s2, `${where} settle`);
    let s3 = s2;
    if (s3.mealReady && !s3.over) {
      const mr = rngAt(s3, 'meal'); const key = pick(mr, [...Object.keys(SUC.MEALS), null]);
      if (key) { const fame0 = s3.fame; const m = SUC.meal(s3, key); if (m.out.ok) { s3 = m.state; st.meal += 1; if (s3.fame < 0 || (fame0 >= SUC.MEALS[key].cost && !s3.freeMeal && s3.fame > fame0)) fail(`${where}: ごはんの名声の数え方がおかしい`); checkState(s3, `${where} meal`); } }
    }
    return s3;
  }
  // 育成中のアイテム(1ターン1個)
  const ir = rngAt(s, 'item');
  const keys = Object.keys(s.bag || {}).filter(k => s.bag[k] > 0);
  if (keys.length && ir() < 0.3) {
    const k = pick(ir, keys); const n0 = s.bag[k];
    const r = SUC.useItem(s, k);
    if (r.out.ok) {
      s = r.state; st.items += 1;
      const gives = SUC.ITEMS[k].gives ? (SUC.ITEMS[k].gives[k] || 0) : 0;
      if (s.bag[k] !== n0 - 1 + gives) fail(`${where}: 袋の ${k} が1つ減らない`);
      if (SUC.useItem(s, keys.find(x => s.bag[x] > 0) || k).out.ok) fail(`${where}: 1ターンに2つ使えた`);
      checkState(s, `${where} item`);
    }
  }
  // 助手のお話(台本)
  const due = SUC.storyDue(s);
  if (due !== null) { const r = SUC.storyStep(s, rngAt(s, 'story')() < 0.5 ? 'a' : 'b'); if (r.out.ok) { s = r.state; st.story += 1; checkState(s, `${where} story`); } }
  const v = SUC.peek(s);
  const a = chooseAction(s, v, c.style);
  if (a.kind === 'train') { const pv = SUC.preview(s, a); if (!pv || Object.values(pv.gain).some(g => !Number.isFinite(g))) fail(`${where}: 訓練の見込みが数でない`); }
  const tickets0 = s.tickets;
  let r = SUC.act(s, a);
  if (!r.out.ok && !['cond', 'retry'].includes(a.kind)) { r = SUC.act(s, { kind: 'rest' }); }
  if (!r.out.ok) { fail(`${where}: 何もできないターンになった(${a.kind}: ${r.out.why})`); return null; }
  s = r.state; st.acts[s.last ? s.last.kind : a.kind] = (st.acts[s.last ? s.last.kind : a.kind] || 0) + 1;
  if (a.kind === 'shugyo' && s.last && s.last.kind === 'shugyo' && s.tickets !== tickets0 - ((a.techs || []).length >= 2 ? SUC.SHUGYO.superTickets : 1)) fail(`${where}: 修行でチケットが1枚(超修行は2枚)減らない`);
  if (SUC.act(s, { kind: 'rest' }).out.ok) fail(`${where}: 1ターンに2回動けた`);
  checkState(s, `${where} act:${a.kind}`);
  if (s.last && ['train', 'shugyo'].includes(s.last.kind)) {
    s = SUC.react(s, chooseReact(s, c.style)).state; checkState(s, `${where} react`);
    if (SUC.react(s, 'praise').out.ok) fail(`${where}: 2回褒められた`);
  }
  if (SUC.issaComes(s)) { const r2 = SUC.issa(s, pick(rngAt(s, 'issa'), ISSA_KEYS)); s = r2.state; st.issa += 1; checkState(s, `${where} issa`); }
  // 能力ポイント(ときどき振る)
  if (s.pts > 0 && rngAt(s, 'pts')() < 0.3) { const p0 = s.pts; s = SUC.spendPts(s, pick(rngAt(s, 'ptsk'), K), 3).state; if (s.pts > p0) fail(`${where}: 能力ポイントを振って増えた`); checkState(s, `${where} pts`); }
  const e = SUC.endTurn(s); if (!e.out.ok) { fail(`${where}: ターンを閉じられない(${e.out.why})`); return null; }
  s = e.state; checkState(s, `${where} endTurn`);
  return s;
};

const MAX_STEPS = 400;
const play = (c, opts = {}) => {
  let s = newRunOf(c); checkState(s, `${c.id} newRun`);
  const st = { battles: 0, wins: 0, rematch: 0, debutRematch: 0, debutLossSeen: 0, meal: 0, items: 0, story: 0, issa: 0, acts: {} };
  const snaps = [];
  let n = 0;
  while (!s.over && n < MAX_STEPS) {
    if (opts.snapAt && opts.snapAt.includes(n)) snaps.push({ n, json: JSON.stringify(s) });
    const t0 = s.turn;
    let s2;
    try { s2 = step(s, c, st); } catch (e) { fail(`${c.id} T${t0}: 例外 ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : e}`); return null; }
    if (!s2) return null;
    s = s2; n += 1;
  }
  if (!s.over) { fail(`${c.id}: ${MAX_STEPS} 手で終わらない(T${s.turn})`); return null; }
  if (s.debutLoss !== st.debutLossSeen) fail(`${c.id}: デビュー戦の負けの数(${s.debutLoss})が、砂時計を使わずに負けを受けた回数(${st.debutLossSeen})と合わない`);
  let fin; try { fin = SUC.autoPts(s).state; } catch (e) { fail(`${c.id}: autoPts で例外 ${e.message}`); return null; }
  let ev; try { ev = SUC.evaluate(fin); } catch (e) { fail(`${c.id}: evaluate で例外 ${e.message}`); return null; }
  if (!Number.isFinite(ev.power) || ev.power < 0 || typeof ev.rank !== 'string' || !Number.isFinite(ev.points)) fail(`${c.id}: 評価が数でない: ${JSON.stringify({ power: ev.power, rank: ev.rank, points: ev.points })}`);
  if (fin.pts < 0) fail(`${c.id}: 自動で振ったあとの能力ポイントが負`);
  return { s: fin, ev, st, snaps, steps: n };
};
// ---- 既知の不具合(作者へ知らせ済みのもの)----
// 芯が直るまでは警告にとどめ、その項目だけ保存した値を戻してから続ける(ほかの違いは今までどおり NG にする)。
// 直ると「直った」と出るので、この表から外す。
// 2026-11-12 の2件(restore で編成の熟練が消える・記録の数が消える)は芯で直ったので外した。
// 新しく見つけたら { key, label, hit(raw, back) } の形で足す(key は保存した値を戻す項目)。
const KNOWN = [];
const knownSeen = new Map(); KNOWN.forEach(k => knownSeen.set(k.key, 0));
const patchKnown = (raw, back) => {
  KNOWN.forEach(k => { if (k.hit(raw, back)) { knownSeen.set(k.key, knownSeen.get(k.key) + 1); back[k.key] = JSON.parse(JSON.stringify(raw[k.key])); } });
  return back;
};
// 途中から続ける(restore してから)
const playFrom = (c, json) => {
  let s = SUC.restore(JSON.parse(json));
  if (!s) { fail(`${c.id}: restore が null を返した(正しい途中の状態なのに)`); return null; }
  s = patchKnown(JSON.parse(json), s);
  const st = { battles: 0, wins: 0, rematch: 0, debutRematch: 0, debutLossSeen: 0, meal: 0, items: 0, story: 0, issa: 0, acts: {} };
  let n = 0;
  while (!s.over && n < MAX_STEPS) { let s2; try { s2 = step(s, c, st); } catch (e) { fail(`${c.id} 再開後 T${s.turn}: 例外 ${e.message}`); return null; } if (!s2) return null; s = s2; n += 1; }
  return SUC.autoPts(s).state;
};
// restore が「無い」を既定値(false・null・[])で埋めるのは表し方の違いだけなので、比べる前にそろえる
// (キーの並び順の違いも中身の違いではないので、並べ替えてから文字にする)
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v);
const canon = (o) => { const c = JSON.parse(JSON.stringify(o)); Object.keys(c).forEach(k => { const v = c[k]; if (v === false || v === null || (Array.isArray(v) && !v.length)) delete c[k]; }); return JSON.stringify(sortKeys(c)); };
const deepDiff = (a, b, p = '', out = []) => { if (JSON.stringify(a) === JSON.stringify(b)) return out; if (a && b && typeof a === 'object' && typeof b === 'object') { new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => deepDiff(a[k], b[k], p ? `${p}.${k}` : k, out)); return out; } out.push(`${p} ${JSON.stringify(a)}→${JSON.stringify(b)}`); return out; };
const diffKeys = (a, b) => {
  const out = [];
  const ka = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  ka.forEach(k => { if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(k); });
  return out;
};

// ---- 組み合わせを作る ----
const species = SUC.speciesList;
const cases = [];
for (let i = 0; i < RUNS; i++) {
  cases.push({
    id: `runchk-${i}`, species: species[(i * 7) % species.length], aid: SUC.AIDS[i % SUC.AIDS.length],
    team: TEAMS[i % TEAMS.length], aidLv: 1 + (i * 3) % 10, pol: ((i * 5) % 7) - 3, set: CARRY_SETS[i % CARRY_SETS.length],
    style: STYLES[(i >> 1) % STYLES.length], winP: WIN_P[i % WIN_P.length], engine: Boolean(battle) && i % 4 === 3, rivals: i % 5 === 2,
  });
}

const t0 = Date.now();
const ends = { done: 0, lost: 0, gameover: 0 };
const total = { battles: 0, rematch: 0, debutRematch: 0, meal: 0, items: 0, story: 0, issa: 0, acts: {} };
let restoreChecked = 0; let restoreIdentity = 0;
const idDiff = new Map();
cases.forEach((c, i) => {
  const snapAt = [3, 17, 40, 71, 110];
  const a = play(c, { snapAt });
  if (!a) return;
  ends[a.s.over] = (ends[a.s.over] || 0) + 1;
  ['battles', 'rematch', 'debutRematch', 'meal', 'items', 'story', 'issa'].forEach(k => { total[k] += a.st[k]; });
  Object.entries(a.st.acts).forEach(([k, v]) => { total.acts[k] = (total.acts[k] || 0) + v; });
  if (VERBOSE) console.log(`${c.id} ${c.species}/${c.aid}/${c.team}/${c.style}: ${a.s.over} T${a.s.turn} ${a.ev.rank} ${a.ev.power} 試合${a.st.battles}`);
  // 同じ id・同じ手 → 同じ結果(半分だけ・時間の節約)
  if (i % 2 === 0) {
    const b = play(c);
    if (b && canon(a.s) !== canon(b.s)) fail(`${c.id}: 同じ育成 id と同じ手なのに結果が違う(${diffKeys(a.s, b.s).slice(0, 6).join(', ')})`);
  }
  // 中断と再開: 途中の状態から restore して続けても同じ結果
  a.snaps.forEach(({ n, json }) => {
    const raw = JSON.parse(json);
    const back0 = SUC.restore(JSON.parse(json));
    const back = back0 ? patchKnown(raw, back0) : back0;
    restoreChecked += 1;
    if (back && canon(back) === canon(raw)) restoreIdentity += 1;
    else if (back) diffKeys(JSON.parse(canon(raw)), JSON.parse(canon(back))).forEach(k => idDiff.set(k, (idDiff.get(k) || 0) + 1));
    const fin = playFrom(c, json);
    if (fin && canon(fin) !== canon(a.s)) fail(`${c.id}: ${n}手目で中断→再開すると結果が変わる(違う所: ${deepDiff(JSON.parse(canon(a.s)), JSON.parse(canon(fin))).slice(0, 4).join(', ')})`);
  });
});
if (idDiff.size) fail(`restore で戻すと、保存した途中の状態と中身が変わる項目がある: ${[...idDiff.entries()].map(([k, n]) => `${k}(${n})`).join(', ')}`);

// 通ったことの確かめ(どの道も一度は通っているか)
const must = [
  [ends.done > 0, '最後まで育て終えた回が1つも無い'],
  [ends.gameover > 0, 'デビュー戦3回負けのゲームオーバーを1回も通っていない'],
  [ends.lost > 0, '頂への道で負けて終わる回を1回も通っていない'],
  [total.debutRematch > 0, 'デビュー戦の砂時計のやり直しを1回も通っていない'],
  [total.meal > 0, '大会のあとのごはんを1回も通っていない'],
  [total.items > 0, '育成中のアイテムを1回も使っていない'],
  [(total.acts.shugyo || 0) > 0, '修行を1回も通っていない'],
  [(total.acts.cup || 0) > 0, '自由参加の大会を1回も通っていない'],
  [total.issa > 0, 'イッサ博士を1回も通っていない'],
  [restoreChecked > 0, '中断と再開を1回も確かめていない'],
];
if (RUNS >= 24) must.forEach(([cond, msg]) => { if (!cond) fail(`通っていない道: ${msg}`); });

const sec = ((Date.now() - t0) / 1000).toFixed(1);
// knownSeen は playFrom でも数えるので、1か所で2回数えることがある(出たかどうかだけ見る)
const knownMsg = KNOWN.map(k => (knownSeen.get(k.key) ? `  ⚠ 既知の不具合(芯・作者へ連絡済み): ${k.label}` : `  ✓ 直った: ${k.label} → tools/success/success-soak-check.js の KNOWN から外す`));
if (errors.length) {
  console.error(`NG success-soak-check(${errors.length} 件・${RUNS} 通り・${sec} 秒)`);
  errors.slice(0, 30).forEach(e => console.error('  - ' + e));
  if (errors.length > 30) console.error(`  …ほか ${errors.length - 30} 件`);
  knownMsg.forEach(m => console.error(m));
  process.exit(1);
}
console.log(`OK success-soak-check: ${RUNS} 通りを最後まで(育て終えた ${ends.done}・頂で負け ${ends.lost}・ゲームオーバー ${ends.gameover})・試合 ${total.battles}・やり直し ${total.rematch}・中断と再開 ${restoreChecked} か所・${sec} 秒`);
knownMsg.forEach(m => console.log(m));
