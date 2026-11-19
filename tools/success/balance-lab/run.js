// モンサクのバランス研究(r1119-014 PR2)の「1回の育成」。tools/success/monsuc-balance-lab.js から使う。
//   芯(monster-hero/data/monhero-success.js)と試合(本体の parts の msxR3Fight を game-fight.js で切り出した物)を
//   そのまま読み込むので、試合型アシストの上乗せ・覚醒・aptUp・MONSUC_MATCH_RULE・作戦の値・乱数の種はゲームと同じ。
//   本体のファイルは書き換えない。手で戦う試合は再現できないので、すべてオート相当。
//
// 条件 = 子(種)× 育て方(STRATEGIES の7つ)× 編成(TEAMS)× 助手(SUC.AIDS)。i 回目の条件と種は i から決まる(同じ i なら同じ結果)。
// 育て方は peek(そのターンに選べる行動と率)だけを見て決める。試しに打って良い物を選ぶ形にはしない
// (芯の乱数は 育成id・ターン・用途 で決まるので、試し打ちは未来が見えるズルになる)。
'use strict';
const { CORE, loadDeps, depsFor } = require('../load');
const battleLoad = require('../../masmon-battle/load.js');
const { makeGameFight } = require('../game-fight.js');
const { boxSeed } = require('../monsuc-play10.js');
const AT = require('../../../monster-hero/data/monhero-success-assist.js');

const K = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
const STRATEGIES = Object.freeze({
  train: 'トレーニング重視',
  shugyo: '修行重視',
  balance: 'バランス型',
  tag: '友情タッグ重視',
  hp: '体力管理重視',
  cup: '大会勝利重視',
  ev: '各ターンの期待値優先',
});
// 編成: base = ベースモンだけ / box-mid = 10周点検の中くらいの箱(アシスト効果なし) / real-B・A・S = 育て終えた子らしい6体(おまかせのアシスト効果)
//       battle-S = real-S の6体に、試合型のアシスト(根性・見せ場・見立て・健勝・見守り)を最大まで(試合の上乗せを測る)
const REAL = { B: { sum: 2600, techs: 4, loy: 70, pop: 40, power: 10000 }, A: { sum: 3400, techs: 6, loy: 80, pop: 55, power: 12500 }, S: { sum: 4300, techs: 8, loy: 85, pop: 70, power: 14500 } };
const TEAMS = Object.freeze(['base', 'box-mid', 'real-B', 'real-A', 'real-S', 'battle-S']);
const TEAM_SP = ['Undine', 'Mocchi', 'Golem', 'Pixie', 'Tiger', 'Kyubi'];

const makeLab = () => {
  const SUC = require(CORE).create(depsFor(loadDeps()));
  const { engine, catalog } = battleLoad.load();
  const GAME = makeGameFight(catalog);
  const species = SUC.speciesList.slice();
  const aids = SUC.AIDS.slice();
  const strategies = Object.keys(STRATEGIES);

  const teamOf = (kind) => {
    if (kind === 'base') return [];
    if (kind.startsWith('box-')) return boxSeed(kind).mons.slice(0, 6).map((m) => ({ kind: 'raised', species: m.species, name: m.nick, stats: m.st, techs: m.techs }));
    const p = REAL[kind.replace(/^(real|battle)-/, '')];
    const picks = kind.startsWith('battle-')
      ? AT.LIST.filter((a) => a.type === 'battle').map((a) => ({ id: a.id, n: a.max }))
      : AT.autoPick(AT.pointsOf(p.power));
    return TEAM_SP.map((x, i) => {
      const st = {}; K.forEach((k, j) => { st[k] = Math.round(p.sum / 6 * (0.7 + ((i + j) % 4) * 0.2)); });
      return { kind: 'raised', species: x, name: `箱${i + 1}`, stats: st, lv: 30, loy: p.loy, pop: p.pop, techs: SUC.techsOf(x).slice(0, p.techs).map((t) => t.id), assists: picks };
    });
  };

  // i 回目の条件。組み合わせ(種 × 育て方 × 編成 × 助手)を、組み合わせの数と互いに素な歩幅で飛び飛びに回るので、
  // 少ない回数で止めても、どの次元の条件もほぼ同じ数になる。組み合わせを一周したら同じ順にもう一周(育成 id が違うので結果は違う)
  const combos = species.length * strategies.length * TEAMS.length * aids.length;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  let stride = Math.floor(combos * 0.618) | 1; while (gcd(stride, combos) !== 1) stride += 2;
  const condOf = (i) => {
    let n = (i % combos) * stride % combos;
    const sp = species[n % species.length]; n = Math.floor(n / species.length);
    const st = strategies[n % strategies.length]; n = Math.floor(n / strategies.length);
    const team = TEAMS[n % TEAMS.length]; n = Math.floor(n / TEAMS.length);
    const aid = aids[n % aids.length];
    return { species: sp, strategy: st, team, aid };
  };

  // 育て方ごとの行動(peek の中身だけで決める)
  const chooseAct = (s, vw, strategy, rnd, focus) => {
    if (vw.can.includes('cond')) return { kind: 'cond' };
    if (vw.can.includes('retry')) return { kind: 'retry' };
    if (vw.can.includes('clinic')) return { kind: 'clinic' };
    const hp = s.hpMax > 0 ? s.hp / s.hpMax : 1;
    const cards = K.map((k) => ({ stat: k, c: vw.cards && vw.cards[`train:${k}`] })).filter((x) => x.c);
    const ev = (x) => (x.c.mult || 1) * (1 - (x.c.fail || 0)) * (1 + (x.c.great || 0)) * (focus.includes(x.stat) ? 1.3 : 1);
    const best = (score) => cards.slice().sort((a, b) => score(b) - score(a) || K.indexOf(a.stat) - K.indexOf(b.stat))[0];
    const train = (score = ev) => { const b = best(score); return b ? { kind: 'train', stat: b.stat } : { kind: 'rest' }; };
    const shugyoOk = vw.can.includes('shugyo') && vw.shugyo && vw.shugyo.techs && vw.shugyo.techs.length && !vw.shugyo.short;
    const shugyo = () => { const t = vw.shugyo.techs.slice().sort((x, y) => (x.rank || 0) - (y.rank || 0)).pop(); return { kind: 'shugyo', course: 'fire', techs: [t.id] }; };
    const cup = (vw.cups || []).find((c) => c.entry && c.entry.ok);
    switch (strategy) {
      case 'train': return hp < 0.3 ? { kind: 'rest' } : train((x) => (focus.includes(x.stat) ? 2 : 1) * (x.c.mult || 1));
      case 'shugyo': if (hp < 0.3) return { kind: 'rest' }; return shugyoOk ? shugyo() : train();
      case 'tag': return hp < 0.3 ? { kind: 'rest' } : train((x) => (x.c.tags ? x.c.tags.length : 0) * 10 + (x.c.members ? x.c.members.length : 0) + (x.c.mult || 1));
      case 'hp': if (hp < 0.5) return { kind: 'rest' }; if (s.stress > 60) return { kind: 'play' }; return train();
      case 'cup': if (cup && hp >= 0.4) return { kind: 'cup', id: cup.id }; return hp < 0.5 ? { kind: 'rest' } : train();
      case 'ev': {
        if (hp < 0.35) return { kind: 'rest' };
        const b = best(ev);
        if (shugyoOk && (!b || ev(b) < 1.15)) return shugyo();
        return b ? { kind: 'train', stat: b.stat } : { kind: 'rest' };
      }
      default: { // balance: 重みのくじ(10周点検の「バランス」と同じ考え)
        const w = { tr: 4, rest: 2, play: 1, shu: shugyoOk ? 2 : 0, cup: cup ? 1 : 0 };
        if (hp < 0.3) { w.rest += 8; w.tr = 0; w.shu = 0; } else if (hp < 0.5) w.rest += 3;
        if (s.stress > 70) w.play += 5;
        const ks = Object.keys(w).filter((k) => w[k] > 0); let t = ks.reduce((a, k) => a + w[k], 0) * rnd();
        let pick = ks[0]; for (const k of ks) { t -= w[k]; if (t <= 0) { pick = k; break; } }
        if (pick === 'tr') return { kind: 'train', stat: focus[Math.floor(rnd() * focus.length)] };
        if (pick === 'shu') return shugyo();
        if (pick === 'cup') return { kind: 'cup', id: cup.id };
        return { kind: pick === 'play' ? 'play' : 'rest' };
      }
    }
  };

  // 1回の育成。返り: 1行(数だけ。名前などの個人の情報は入らない)
  const runOne = (i, { spy = null } = {}) => {
    const cond = condOf(i);
    const id = `lab-${i}`;
    let s = SUC.newRun({ id, species: cond.species, aid: cond.aid, team: teamOf(cond.team), aidBondLv: 1 });
    let r = ((i + 1) * 2654435761 + 7) >>> 0;
    const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
    // 得意の能力: はじめの能力の高い順に3つ
    const focus = K.slice().sort((a, b) => (s.stats[b] - s.stats[a]) || K.indexOf(a) - K.indexOf(b)).slice(0, 3);
    const out = { matches: 0, wins: 0, losses: 0, league: [0, 0], summit: [0, 0], cup: [0, 0], firstLoss: null, acts: {} };
    let guard = 0;
    while (!s.over && guard++ < 300) {
      if (s.battle) {
        const b = s.battle;
        const f = GAME.msxR3Fight(engine, SUC, { s, nick: '' });
        if (spy) spy(f, s);
        const won = Boolean(f && f.won);
        out.matches += 1; if (won) out.wins += 1; else out.losses += 1;
        const slot = b.kind === 'summit' ? 'summit' : b.kind === 'cup' ? 'cup' : 'league';
        out[slot][1] += 1; if (won) out[slot][0] += 1;
        if (!won && !out.firstLoss) out.firstLoss = `${b.kind}${b.round ? `-${b.round}` : ''}@${s.turn}`;
        s = SUC.settle(s, [won], f ? f.use : null).state;
        if (s.mealReady && !s.over) { const o = SUC.mealOpts(s); if (o[0]) s = SUC.meal(s, o[0]).state; }
        continue;
      }
      if (SUC.storyDue(s) !== null) s = SUC.storyStep(s, 'a').state;
      const ev = (slot) => {
        if (!SUC.events) return;
        const x = SUC.events.open(s, slot); s = x.state; const e = x.out.ev;
        if (!e || e.watch) return;
        const ok = e.choices.filter((c) => c.ok); if (!ok.length) return;
        const y = SUC.events.pick(s, ok[0].c); if (y.out.ok) s = y.state;
      };
      ev('start');
      const a = chooseAct(s, SUC.peek(s), cond.strategy, rnd, focus);
      let x = SUC.act(s, a);
      let kind = a.kind;
      if (!x.out.ok) { x = SUC.act(s, { kind: 'rest' }); kind = 'rest'; }
      s = x.state;
      out.acts[kind] = (out.acts[kind] || 0) + 1;
      if (s.last && ['train', 'shugyo'].includes(s.last.kind)) { s = SUC.react(s, 'praise').state; ev('after'); }
      if (SUC.issaComes(s)) s = SUC.issa(s, 'none').state;
      s = SUC.endTurn(s).state;
    }
    s = SUC.autoPts(s).state;
    const e = SUC.evaluate(s);
    const statSum = K.reduce((t, k) => t + (Number(s.stats[k]) || 0), 0);
    const log = {}; Object.entries(s.log || {}).forEach(([k, v]) => { if (typeof v === 'number' && Number.isFinite(v)) log[k] = v; });
    return {
      i, ...cond, turns: guard, over: Boolean(s.over),
      // 育成が途中で終わった(デビュー戦の負けなど)。ふつうの終わりはファイナルの進み方で 44〜47 ターンにばらつくので、40 ターンより前で見る
      earlyEnd: Number(s.turn) < SUC.TOTAL_TURNS - 6, endTurn: Number(s.turn) || 0,
      power: e.power, grade: String((e.grade && e.grade.label) || e.grade).replace(/\d+$/, ''), rank: e.rank,
      statSum, techs: Array.isArray(s.techs) ? s.techs.length : 0, fame: Number(s.fame) || 0,
      ...out, log,
    };
  };

  return { SUC, GAME, engine, condOf, runOne, species, aids, strategies, teams: TEAMS.slice() };
};

module.exports = { makeLab, STRATEGIES, TEAMS, K };
