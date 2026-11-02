// 点検: 手札が固まって決着しない試合を数える(ブラウザなし)。node sim.js <リポジトリ> <モード assist|tactics> <試合数>
const fs = require('fs'), path = require('path'), vm = require('vm');
const [root, mode, N0, smode] = process.argv.slice(2);
const N = Number(N0 || 300);
const G = path.join(root, 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map, __stuckMode: smode || 'none' });
const rd = (f) => fs.readFileSync(path.join(G, f), 'utf8');
vm.runInContext(`${rd('data/card-battle-cards.js')}\n;\n${rd('src/parts/82-card-battle-core.jsx')}\n;\n${rd('src/parts/82-card-tactics-core.jsx')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, CARD_TACTIC_CARDS, cardTacticNormalizeFrames, cardAiPolicy, cardAiBuildDeck, cardAiSeededRand, cardCreateGame, cardAiChooseAction, cardApplyAction, cardDecider, cardOther, cardRngNext, cardOf, cardIsGuardKind, cardUsableBy };', ctx);
const E = ctx.E, db = E.CARD_BATTLE_DATA;
const WHO = ['mua', 'momosuke', 'kiki', 'kyuko', 'dra', 'atsu', 'sorashido'];
const ids = (cat) => E.CARD_TACTIC_CARDS.filter((c) => c.cat === cat).map((c) => c.id);
const CONDS = ids('cond'), BASES = ids('base'), BREED = ids('breeder'), MONS = ids('monster');
let seed = 12345; const R = () => { const n = E.cardRngNext(seed); seed = n.s; return n.v; };
const pick = (a) => a[Math.floor(R() * a.length) % a.length];
const randFrames = () => {
  const rows = (acts, n) => Array.from({ length: n }, () => ({ c: R() < 0.5 ? 'any' : pick(CONDS), a: pick(acts), on: true }));
  return E.cardTacticNormalizeFrames({ base: [pick(BASES), pick(BASES), pick(BASES)], breeder: rows(BREED, 1 + Math.floor(R() * 5)), mons: [0, 1, 2].map(() => rows(MONS, Math.floor(R() * 4))) });
};
const acts0 = (frames) => new Set(frames.flatMap((f) => (f ? f.breeder.map((r) => r.a) : [])));
const res = { lockByAct: {}, games: 0, long: 0, cap: 0, turns: [], byAct: {}, longByAct: {}, longExamples: [] };
for (let g = 0; g < N; g++) {
  const w = [pick(WHO), pick(WHO)];
  const decks = w.map((x, i) => E.cardAiBuildDeck(db, x, 'master', E.cardAiSeededRand(`s${g}:${i}`)));
  let pols, frames = [null, null];
  if (mode === 'tactics') {
    frames = [randFrames(), randFrames()];
    pols = w.map((x, i) => ({ ...E.cardAiPolicy(x, 'master', { noTactics: true }), gambit: frames[i] }));
  } else pols = w.map((x, i) => E.cardAiPolicy(x, 'master', { sameBlood: !!decks[i].sameBlood }));
  let st = E.cardCreateGame(db, { decks, names: ['A', 'B'], seed: 900 + g, first: g % 2 });
  let steps = 0;
  const lastHand = [null, null], streak = [0, 0], maxStreak = [0, 0]; let prevTurn = st.turn, prevActive = st.active;
  for (; steps < 6000 && st.winner === null; steps++) {
    const who = st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? E.cardOther(st.first) : E.cardDecider(st);
    let act = E.cardAiChooseAction(db, st, pols[who], R);
    let n = act && E.cardApplyAction(db, st, act);
    if (!n) { act = st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : st.phase === 'guts' ? { type: 'guts', hand: [] } : null; n = act && E.cardApplyAction(db, st, act); if (!n) break; }
    st = n;
    if (st.turn !== prevTurn) {
      const p = prevActive, h = st.players[p].hand.slice().sort().join(',');
      if (st.players[p].hand.length >= 5 && h === lastHand[p]) { streak[p]++; maxStreak[p] = Math.max(maxStreak[p], streak[p]);
        if (streak[p] === 5 && (res.diag = res.diag || []).length < 8) { const me = st.players[p]; const live = me.mons.filter((m) => !m.ko);
          res.diag.push({ who: w[p], turn: st.turn, guts: me.guts.length, deck: me.deck.length, mons: me.mons.map((m) => `${m.name}${m.ko ? '(KO)' : ''}${m.life}/${m.max}`).join('・'), foe: st.players[1 - p].mons.map((m) => `${m.name}${m.ko ? '(KO)' : ''}${m.life}`).join('・'),
            hand: me.hand.map((no) => { const c = E.cardOf(db, no); return c ? `${c.name}(${c.kind}・g${c.guts}${live.some((m) => E.cardUsableBy(c, m)) ? '' : '・使える子なし'}${(c.effects || []).some((e) => e.t === 'attach') ? '・付ける' : ''})` : no; }).join(' / ') }); } }
      else streak[p] = 0;
      lastHand[p] = h; prevTurn = st.turn; prevActive = st.active;
    }
  }
  res.games++; res.turns.push(st.turn);
  const locked = Math.max(...maxStreak) >= 5; if (locked) res.locked = (res.locked || 0) + 1;
  [0, 1].forEach((p) => { const has = frames[p] ? frames[p].breeder.map((r) => r.a) : []; const keepy = has.some((a) => /keepGuard|gutsN\.0|stop|holdBreeder|save/.test(a));
    res.side = res.side || { keepyN: 0, keepyLock: 0, plainN: 0, plainLock: 0 }; if (keepy) { res.side.keepyN++; if (maxStreak[p] >= 5) res.side.keepyLock++; } else { res.side.plainN++; if (maxStreak[p] >= 5) res.side.plainLock++; }
    res.streaks = res.streaks || {}; const k = Math.min(10, maxStreak[p]); res.streaks[k] = (res.streaks[k] || 0) + 1; });
  if (locked) acts0(frames).forEach((a) => { res.lockByAct[a] = (res.lockByAct[a] || 0) + 1; });
  if (st.winner === null) res.cap++;
  const acts = new Set(frames.flatMap((f) => (f ? f.breeder.map((r) => r.a) : [])));
  acts.forEach((a) => { res.byAct[a] = (res.byAct[a] || 0) + 1; });
  if (st.turn >= 50 || st.winner === null) {
    res.long++;
    acts.forEach((a) => { res.longByAct[a] = (res.longByAct[a] || 0) + 1; });
    if (res.longExamples.length < 5) res.longExamples.push({ g, who: w, turn: st.turn, reason: st.reason, hands: st.players.map((p) => p.hand.map((no) => { const c = E.cardOf(db, no); return c ? `${c.name}(${c.kind})` : no; })), guts: st.players.map((p) => p.guts.length), frames: frames.map((f) => (f ? f.breeder.map((r) => `${r.c}→${r.a}`) : null)) });
  }
}
const t = res.turns.slice().sort((a, b) => a - b);
console.log(JSON.stringify({ side: res.side, streaks: res.streaks, smode, diag: res.diag, mode, games: res.games, locked: res.locked || 0, lockByAct: Object.fromEntries(Object.entries(res.lockByAct).filter(([, v]) => v >= 3).map(([a, v]) => [a, `${v}/${res.byAct[a]}`])), long50: res.long, cap: res.cap, median: t[Math.floor(t.length / 2)], p95: t[Math.floor(t.length * 0.95)], max: t[t.length - 1],
  rateByAct: Object.fromEntries(Object.entries(res.longByAct).map(([a, v]) => [a, `${v}/${res.byAct[a]}`]).sort()), examples: res.longExamples }, null, 1));
