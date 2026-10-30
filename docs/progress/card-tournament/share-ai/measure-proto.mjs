// MASTER を超える段の強さを測った試作(2026-10-30 ルールくん)。ゲームでは使わない。bundle.mjs はカードの部品 82-card-* をつないで、使う関数を export した物(手元で作る)。
// 使い方: node measure-proto.mjs <試合数> <段の名前...>(段の名前は下の CFGS)
import * as g from './bundle.mjs';
const db = g.CARD_BATTLE_DATA;
const FOES = ['mua', 'momosuke', 'kiki', 'kyuko', 'dra', 'atsu', 'sorashido'];
const mkRand = (seed) => { let r = seed >>> 0 || 1; return () => { const n = g.cardRngNext(r); r = n.s; return n.v; }; };
const life = (s, p) => { let a = 0, b = 0; s.players[p].mons.forEach((m) => { if (!m.ko) a += Math.max(0, m.life); b += m.max; }); return b ? a / b : 0; };
let EVAL2 = false; let EVAL3 = false;
const evalOf = (s, me) => {
  if (s.winner === me) return 100;
  if (s.winner !== null) return -100;
  const op = g.cardOther(me);
  const base = 10 * (g.cardKoCount(s, me) - g.cardKoCount(s, op)) + 4 * (life(s, me) - life(s, op)) + 0.3 * (s.players[me].hand.length - s.players[op].hand.length);
  if (EVAL3) {
    const alive = (x) => s.players[x].mons.filter((m) => !m.ko).length;
    return 12 * (alive(me) - alive(op)) + 8 * (life(s, me) - life(s, op)) + 0.4 * (s.players[me].hand.length - s.players[op].hand.length) + 0.4 * (s.players[me].guts.length - s.players[op].guts.length);
  }
  if (!EVAL2) return base;
  const P = s.players[me], O = s.players[op];
  const deckRisk = (x) => (x.deck.length < 6 ? (6 - x.deck.length) * 1.5 : 0);
  return base + 0.6 * (P.guts.length - O.guts.length) - deckRisk(P) + deckRisk(O);
};
const shuffle = (a, rand) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } };
const decider = (s) => (s.pendingDiscard ? s.pendingDiscard.p : s.phase === 'setup' ? g.cardOther(s.first) : g.cardDecider(s));
const rollout = (s0, act, me, pols, rand, H) => {
  const s1 = structuredClone({ ...s0, log: [], events: [] });
  // 先の山札は知らないことにする(両方の山札を混ぜ直す)
  s1.players.forEach((p) => shuffle(p.deck, rand));
  let s = g.cardApplyAction(db, s1, act);
  if (!s) return -999;
  const t0 = s.turn;
  for (let k = 0; k < 300 && s.winner === null && s.turn < t0 + H; k++) {
    const w = decider(s);
    let a = g.cardAiChooseAction(db, s, pols[w], rand);
    let n = a && g.cardApplyAction(db, s, a);
    if (!n) { a = s.pending ? { type: 'pass' } : s.phase === 'main' ? { type: 'endAttacks' } : s.phase === 'guts' ? { type: 'guts', hand: [] } : null; n = a && g.cardApplyAction(db, s, a); if (!n) break; }
    s = n; s.log = []; s.events = [];
  }
  return evalOf(s, me);
};
// 探す打ち方: 攻める段だけ、点の高い手 K 個+攻め終わりを R 回ずつ H 手番先まで試して選ぶ
const searchChoose = (cfg) => (db_, st, pol, rand) => {
  EVAL2 = !!cfg.eval2; EVAL3 = !!cfg.eval3;
  if (st.pendingChoice || st.pendingDiscard || st.pendingPray || st.pendingReveal || st.phase === 'setup') return g.cardAiChooseAction(db, st, pol, rand);
  if (st.pending || st.phase === 'guts') {
    const ai = g.cardAiChooseAction(db, st, pol, rand);
    if (!cfg.all) return ai;
    const me2 = decider(st);
    const alt = st.pending ? { type: 'pass' } : { type: 'guts', hand: [] };
    if (JSON.stringify(alt) === JSON.stringify(ai)) return ai;
    const pols2 = [null, null]; pols2[me2] = pol; pols2[g.cardOther(me2)] = cfg.oppPol;
    let a = 0, b = 0; for (let r = 0; r < cfg.R; r++) { a += rollout(st, ai, me2, pols2, rand, cfg.H); b += rollout(st, alt, me2, pols2, rand, cfg.H); }
    return b > a + 1 ? alt : ai;
  }
  if (st.phase !== 'main') return g.cardAiChooseAction(db, st, pol, rand);
  const me = st.active;
  const opts = g.cardAiAttackChoices(db, st, pol);
  if (!opts.length) return { type: 'endAttacks' };
  const scored = g.cardAiAttackScored(db, st, opts, pol).slice(0, cfg.K);
  const cands = scored.map((x) => g.cardAiFillBind(db, st, x.o, pol));
  cands.push({ type: 'endAttacks' });
  const pols = [null, null]; pols[me] = pol; pols[g.cardOther(me)] = cfg.oppPol;
  let best = cands[0], bv = -1e9;
  cands.forEach((a, i) => {
    let v = 0; for (let r = 0; r < cfg.R; r++) v += rollout(st, a, me, pols, rand, cfg.H);
    v = v / cfg.R + (i === 0 ? 0.5 : 0);
    if (v > bv) { bv = v; best = a; }
  });
  return best;
};
const CFGS = {
  expert: { level: 'expert' },
  master: { level: 'master' },
  s1: { level: 'master', search: { K: 3, R: 1, H: 1 } },
  s2: { level: 'master', search: { K: 4, R: 2, H: 2 } },
  s3: { level: 'master', search: { K: 5, R: 3, H: 2 } },
  s4: { level: 'master', search: { K: 4, R: 2, H: 4 } },
  s5: { level: 'master', search: { K: 4, R: 2, H: 99 } },
  l1: { level: 'master', search: { K: 4, R: 2, H: 4, eval2: true } },
  l6: { level: 'master', search: { K: 4, R: 2, H: 4, eval3: true } },
  l7: { level: 'master', search: { K: 5, R: 3, H: 4, eval3: true } },
  l8: { level: 'master', search: { K: 4, R: 2, H: 6, eval3: true } },
  m0: { level: 'master' },
  l4: { level: 'master', search: { K: 6, R: 4, H: 4 } },
  l5: { level: 'master', search: { K: 4, R: 4, H: 6 } },
  l2: { level: 'master', search: { K: 4, R: 2, H: 4, all: true } },
  l3: { level: 'master', search: { K: 4, R: 2, H: 4, all: true, eval2: true } },
};
const play = (cfgName, foe, seed, first) => {
  const cfg = CFGS[cfgName];
  const rd = mkRand(seed * 31 + 7);
  const deckA = g.cardAiBuildDeck(db, 'kyuko', 'master', g.cardAiSeededRand(`me|${seed}`));
  const deckB = g.cardAiBuildDeck(db, foe, 'master', g.cardAiSeededRand(`foe|${foe}|${seed}`));
  const polA = g.cardAiPolicy('kyuko', cfg.level, { sameBlood: deckA.sameBlood });
  const polB = g.cardAiPolicy(foe, 'master', { sameBlood: deckB.sameBlood });
  const chooseA = cfg.search ? searchChoose({ ...cfg.search, oppPol: g.cardAiPolicy('kyuko', 'master') }) : (d, s, p, r) => g.cardAiChooseAction(db, s, p, r);
  let st = g.cardCreateGame(db, { decks: [deckA, deckB], names: ['A', 'B'], seed, first });
  let think = 0;
  for (let k = 0; k < 4000 && st.winner === null; k++) {
    const w = decider(st);
    const t = performance.now();
    let a = w === 0 ? chooseA(db, st, polA, rd) : g.cardAiChooseAction(db, st, polB, rd);
    if (w === 0) think += performance.now() - t;
    let n = a && g.cardApplyAction(db, st, a);
    if (!n) { a = st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : st.phase === 'guts' ? { type: 'guts', hand: [] } : null; n = a && g.cardApplyAction(db, st, a); if (!n) break; }
    st = n;
  }
  return { win: st.winner === 0, think };
};
const N = Number(process.argv[2]) || 14;
for (const name of process.argv.slice(3)) {
  let w = 0, n = 0, think = 0;
  for (let i = 0; i < N; i++) { const foe = FOES[i % FOES.length]; const r = play(name, foe, 1000 + i * 17, i % 2); w += r.win ? 1 : 0; n++; think += r.think; }
  console.log(`${name}: MASTER の助手に ${w}/${n} 勝(${Math.round((w / n) * 100)}%)・1試合の考える時間 ${Math.round(think / n)}ms`);
}
