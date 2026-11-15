#!/usr/bin/env node
// モンサクの試合の前の「予想」が、本番の試合と同じ強化・ルールで出ていて、実際の勝ち負けと合うかを数で確かめる(r1115-202 H2)。
//   試合の入力は本番の msxR3Fight、予想は本番の monsucOdds を parts からそのまま切り出して使う(tools/success/game-fight.js)。
//   10周点検と同じ子・育て方(monsuc-play10.js の LAPS)で育成を芯だけで回し、立った試合ごとに
//     予想(種を変えて40回)/ 本番の種でのオート(芯 createMatch → auto。画面の「オート」と同じ)/ 手で選んだ場合の目安(おすすめの手・欲張り・最初の札)
//   を並べ、予想の段(楽勝〜勝ち目なし)ごとの実際の勝率を出す。
//   見張り: 予想の段ごとに「予想の平均」と「オートの実際」の差が 0.12 を超えたら NG(1段に20試合以上あるときだけ数える)。
//   node tools/battle/monsuc-odds-check.js [--runs 3]
'use strict';
const path = require('path');
const { load } = require('../success/load.js');
const { engine, catalog } = require('../masmon-battle/load.js').load();
const G = require('../success/game-fight.js').makeGameFight(catalog);
const { LAPS } = require('../success/monsuc-play10.js');
const AT = require(path.join(__dirname, '..', '..', 'monster-hero', 'data', 'monhero-success-assist.js'));

const args = process.argv.slice(2);
const RUNS = Math.max(1, Number((args[args.indexOf('--runs') + 1]) || 3) || 3);
const HN = 6; // 手で選ぶ目安は、本番の種を少し変えて6回
const { SUC } = load();
const K = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];

// 編成(アシストの上乗せが試合に入るように、試合型を含むおまかせのアシスト効果を付けた子)
const teamOf = (kind) => {
  if (kind === 'base') return [];
  const sum = { 'box-low': 800, 'box-mid': 2400, 'box-high': 4200, 'box-max': 5800 }[kind] || 2400;
  const pts = typeof AT.pointsOf === 'function' ? AT.pointsOf(sum * 3) : 20;
  const battle = AT.LIST.filter((x) => x.type === 'battle').map((x) => x.id); // 試合型(ガッツ・会心・はずれ減・回避・意味不明をしない)
  const ap = typeof AT.autoPick === 'function' ? AT.autoPick(pts) : null; const auto = Array.isArray(ap) ? ap : ap && Array.isArray(ap.picks) ? ap.picks : [];
  const assists = (i) => [{ id: battle[i % battle.length], n: AT.BY_ID[battle[i % battle.length]].max }, ...auto].slice(0, AT.MAX_KINDS || 8);
  return ['Undine', 'Mocchi', 'Golem', 'Pixie', 'Tiger', 'Kyubi'].map((x, i) => { const st = {}; K.forEach((k, j) => { st[k] = Math.round(sum / 6 * (0.7 + ((i + j) % 4) * 0.2)); }); return { kind: 'raised', species: x, name: `箱${i + 1}`, stats: st, lv: 30, loy: 80, pop: 50, techs: SUC.techsOf(x).slice(0, 6).map((t) => t.id), assists: assists(i) }; });
};

const play = (input, pol) => {
  const m = engine.createMatch({ ...input, control: { A: 'human' } });
  for (let g = 0; !m.done() && g < 600; g++) {
    const o = m.pending(); if (!o) break;
    let c = null;
    if (o.kind === 'enter') c = o.enter.find((x) => x.ok);
    else if (pol === 'hint') c = o.hint;
    else {
      const ok = o.tech.filter((t) => t.ok);
      if (pol === 'greedy' && ok.length) c = ok.slice().sort((a, b) => b.p * b.power - a.p * a.power)[0];
      else if (pol === 'first' && ok.length) c = ok[0];
      else if (!o.tech.some((t) => t.reach)) { const st = o.tech.some((t) => t.dist.some((d) => d < o.dist)) ? -1 : 1; c = o.move.find((x) => x.step === st && x.ok) || (o.charge.ok ? o.charge : o.guard); }
      else c = o.charge.ok ? o.charge : o.guard;
    }
    if (!c || !m.choose(c).ok) m.auto('A');
  }
  const r = m.result(); return Boolean(r && r.winner === 'A');
};
const autoWin = (input) => { const m = engine.createMatch({ ...input, control: { A: 'human' } }); m.auto('A'); const r = m.result(); return Boolean(r && r.winner === 'A'); };

const rows = [];
let simSame = 0; let simAll = 0;
LAPS.forEach((cfg, li) => {
  for (let seed = 1; seed <= RUNS; seed++) {
    let s = SUC.newRun({ id: `odds-${li}-${seed}`, species: cfg.species, aid: 'mua', team: teamOf(cfg.team), aidBondLv: 1 });
    let r = (seed * 2654435761 + li * 97) >>> 0; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
    for (let guard = 0; !s.over && guard < 260; guard++) {
      if (s.battle) {
        const f = G.msxR3Fight(engine, SUC, { s, nick: '' });
        if (!f) { s = SUC.settle(s, false).state; continue; }
        const od = G.monsucOdds(engine, f.input);
        const aw = autoWin(f.input); simAll++; if (aw === f.won) simSame++;
        const hs = Array.from({ length: HN }, (_, i) => ({ ...f.input, seed: `${f.input.seed}:h${i}` }));
        const cnt = (pol) => hs.filter((x) => play(x, pol)).length / HN;
        rows.push({ rate: od.rate, applied: Boolean(f.r && f.r.log && f.r.log[0] && f.r.log[0].buffs), auto: aw, autoMore: hs.filter(autoWin).length / HN, hint: cnt('hint'), greedy: cnt('greedy'), first: cnt('first'), buffs: Boolean(f.input.buffs) });
        s = SUC.settle(s, f.won, f.use).state;
        if (s.mealReady && !s.over) { const o = SUC.mealOpts(s); if (o[0]) s = SUC.meal(s, o[0]).state; }
        continue;
      }
      if (SUC.storyDue(s) !== null) s = SUC.storyStep(s, 'a').state;
      const vw = SUC.peek(s); let a;
      if (vw.can.includes('cond')) a = { kind: 'cond' }; else if (vw.can.includes('retry')) a = { kind: 'retry' }; else if (vw.can.includes('clinic')) a = { kind: 'clinic' };
      else { const cup = vw.cups.find((c) => c.entry.ok); if (s.hp / s.hpMax < 0.35) a = { kind: 'rest' }; else if (cup && rnd() < 0.15) a = { kind: 'cup', id: cup.id }; else a = { kind: 'train', stat: K[cfg.focus[Math.floor(rnd() * cfg.focus.length)]] }; }
      let x = SUC.act(s, a); if (!x.out.ok) x = SUC.act(s, { kind: 'rest' }); s = x.state;
      if (SUC.issaComes(s)) s = SUC.issa(s, 'none').state;
      s = SUC.endTurn(s).state;
    }
  }
});

let ng = 0;
const B = G.MSC_FORECAST;
console.log(`試合 ${rows.length}(試合型アシストの上乗せを渡した ${rows.filter((x) => x.buffs).length}・芯に入った ${rows.filter((x) => x.applied).length})・本番の試合の式と画面のオートの勝ち負けが同じ: ${simSame}/${simAll}`);
console.log('予想の段|試合|予想の平均|オートの実際|手で:おすすめの手|手で:欲張り|手で:最初の札');
B.forEach(([lo, , label], i) => {
  const hi = i ? B[i - 1][0] : 1.01;
  const rs = rows.filter((x) => x.rate >= lo && x.rate < hi); if (!rs.length) return;
  const av = (k) => rs.reduce((t, x) => t + (typeof x[k] === 'boolean' ? (x[k] ? 1 : 0) : x[k]), 0) / rs.length;
  const pred = av('rate'); const real = (av('auto') + av('autoMore') * HN) / (HN + 1);
  const bad = rs.length >= 20 && Math.abs(pred - real) > 0.12; if (bad) ng++;
  console.log([label, rs.length, pct(pred), pct(real) + (bad ? ' ←ずれ' : ''), pct(av('hint')), pct(av('greedy')), pct(av('first'))].join('|'));
});
function pct(v) { return `${Math.round(v * 100)}%`; }
if (simSame !== simAll) ng++;
if (rows.filter((x) => x.buffs).length !== rows.filter((x) => x.applied).length) { ng++; console.log('NG: 試合型アシストの上乗せが芯に入っていない試合がある(buffs の形の食い違い)'); }
console.log(ng ? `NG: 予想と実際がずれている段が ${ng}` : 'OK: 予想は本番の試合(オート)の勝率と合っている');
process.exit(ng ? 1 : 0);
