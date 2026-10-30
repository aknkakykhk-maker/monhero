// MFバトルカード: 登録デッキの賢さの段と、MASTER を超える段の先読みを確かめる(2026-10-30 ルールくん)。ブラウザなしで動かす。
//
//   node tools/card/card-share-search-check.js [--verbose]
//
// 見るもの
//   A. 段: 何もセットしない登録・前の形の登録は EXPERT。打ち方の土台は EXPERT か MASTER。超える段だけ先読みが付く
//   B. 助手と対戦の打ち方(cardAiPolicy)には先読みが付かない(助手の強さは変わらない)
//   C. 先読みの1手: 出せる手を返す・同じ種なら同じ手・1回の判断で試す手の数に上限がある(スマホで重くしない)
//   D. 先読みつきの登録デッキで1試合を最後まで回せる・大会の1試合(cardTourPlay)も回せる
//   E. 画面の表示: 「賢さ GRAND MASTER 相当」のように出る
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const PART = (n) => fs.readFileSync(path.join(GAME, 'src', 'parts', n), 'utf8');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map, Date });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${PART('82-card-battle-core.jsx')}\n;\n${PART('82-card-tactics-core.jsx')}\n;\n${PART('82-card-share-core.jsx')}\n;\n${PART('82-card-tournament-core.jsx')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, CARD_SHARE_SEARCH, CARD_SHARE_SMART_LABEL, CARD_AI_SEARCH_STEP_MAX, cardSharePolicy, cardShareSmartLevel, cardShareFightLevel, cardTacticPackFrames, cardAiPolicy, cardAiBuildDeck, cardAiSeededRand, cardCreateGame, cardApplyAction, cardAiChooseAction, cardDecider, cardOther, cardRngNext, cardTourPlay, cardAiSearchPick };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const J = (v) => JSON.stringify(v);

// 戦術カードの枠(基本 n 枚・別々の効く条件 rows 個)
const CONDS = ['any', 'ko', 'lowest', 'highest', 'strongest', 'attacker', 'leader', 'foeLife.90', 'foeLife.80', 'foeLife.70', 'foeLife.60', 'foeLife.50', 'foeLife.40', 'foeLife.30', 'foeLife.20'];
const frames = (base, rows) => {
  const list = CONDS.slice(0, rows).map((c) => ({ c, a: 'atk' }));
  return { base: ['tBalance', 'tBig', 'tArea'].slice(0, base), breeder: [], mons: [list.slice(0, 5), list.slice(5, 10), list.slice(10)] };
};
const tac = (base, rows) => ({ habit: 'kyuko', f: E.cardTacticPackFrames(frames(base, rows)) });

// ---- A ----
{
  const want = [[0, 0, 'expert'], [1, 3, 'expert'], [2, 0, 'master'], [0, 4, 'master'], [3, 4, 'grandmaster'], [3, 7, 'hell'], [3, 10, 'legend']];
  want.forEach(([b, r, lv]) => check(`A 基本${b}枚・効く戦術カード${r}枚は ${lv}`, E.cardShareSmartLevel(tac(b, r)) === lv, E.cardShareSmartLevel(tac(b, r))));
  check('A 前の形の登録(戦術カードの枠が無い)は EXPERT', E.cardShareSmartLevel({ habit: 'dra' }) === 'expert' && E.cardShareFightLevel({ habit: 'dra' }) === 'expert');
  check('A 打ち方の土台: EXPERT の段だけ EXPERT・ほかは MASTER', E.cardShareFightLevel(tac(0, 0)) === 'expert' && ['master', 'grandmaster', 'hell', 'legend'].every((lv, i) => E.cardShareFightLevel(tac(...[[2, 0], [3, 4], [3, 7], [3, 10]][i])) === 'master'));
  const pol = (b, r) => E.cardSharePolicy(tac(b, r), 'normal');
  check('A 先読みは GRAND MASTER・HELL・LEGEND だけに付く', !pol(0, 0).search && !pol(2, 0).search && J(pol(3, 4).search) === J(E.CARD_SHARE_SEARCH.grandmaster) && J(pol(3, 7).search) === J(E.CARD_SHARE_SEARCH.hell) && J(pol(3, 10).search) === J(E.CARD_SHARE_SEARCH.legend));
  check('A 段が上がるほど先読みが深い(試す手の数×回数×手番)', ['grandmaster', 'hell', 'legend'].map((k) => E.CARD_SHARE_SEARCH[k]).every((c, i, a) => !i || c.k * c.r * c.h >= a[i - 1].k * a[i - 1].r * a[i - 1].h));
  check('A でたらめには打たない(何もセットしなくても)', !pol(0, 0).gambitRandom);
  check('A 呼んだ側の強さに左右されない(前の形の登録も)', J(E.cardSharePolicy({ habit: 'dra' }, 'easy').level) === J(E.cardSharePolicy({ habit: 'dra' }, 'master').level));
}
// ---- B ----
{
  const all = ['mua', 'momosuke', 'kiki', 'kyuko', 'dra', 'atsu', 'sorashido'].flatMap((w) => ['easy', 'normal', 'hard', 'expert', 'master'].map((lv) => E.cardAiPolicy(w, lv)));
  check('B 助手と対戦の打ち方(EASY〜MASTER の全員)には先読みが付かない', all.every((p) => !p.search));
}
// ---- C ----
const mkRand = (seed) => { let r = seed >>> 0 || 1; return () => { const n = E.cardRngNext(r); r = n.s; return n.v; }; };
const deckA = E.cardAiBuildDeck(db, 'kyuko', 'master', E.cardAiSeededRand('sa'));
const deckB = E.cardAiBuildDeck(db, 'kiki', 'master', E.cardAiSeededRand('sb'));
{
  // 攻める段まで MASTER どうしで進める
  let st = E.cardCreateGame(db, { decks: [deckA, deckB], names: ['A', 'B'], seed: 77, first: 0 });
  const r0 = mkRand(9);
  const m = [E.cardAiPolicy('kyuko', 'master'), E.cardAiPolicy('kiki', 'master')];
  let found = null;
  for (let k = 0; k < 600 && st.winner === null; k++) {
    const who = st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? E.cardOther(st.first) : E.cardDecider(st);
    if (k > 20 && st.phase === 'main' && !st.pending && !st.pendingChoice && !st.pendingDiscard && !st.pendingPray && !st.pendingReveal && st.turn >= 4) { found = st; break; }
    const a = E.cardAiChooseAction(db, st, m[who], r0);
    const n = a && E.cardApplyAction(db, st, a);
    if (!n) break;
    st = n;
  }
  check('C 攻める段の場面を作れた', !!found);
  if (found) {
    const pol = { ...E.cardSharePolicy(tac(3, 10), 'normal'), gambit: null };
    const t = Date.now();
    const a1 = E.cardAiChooseAction(db, found, pol, mkRand(5));
    const ms = Date.now() - t;
    const a2 = E.cardAiChooseAction(db, found, pol, mkRand(5));
    check('C LEGEND の1手は出せる手', a1 && !!E.cardApplyAction(db, found, a1), J(a1));
    check('C 同じ種なら同じ手', J(a1) === J(a2));
    check(`C 1回の判断が重すぎない(パソコンで 400ms 未満。いま ${ms}ms)`, ms < 400, `${ms}ms`);
    check('C 1回の判断で試しに進める手の数に上限がある', Number.isInteger(E.CARD_AI_SEARCH_STEP_MAX) && E.CARD_AI_SEARCH_STEP_MAX > 0 && E.CARD_AI_SEARCH_STEP_MAX <= 3000);
    // 上限をとても深い先読みで確かめる: 試す手番を大きくしても、上限で止まる
    const deep = { ...pol, search: { k: 8, r: 50, h: 99, eval: 'ko' } };
    const t2 = Date.now();
    const a3 = E.cardAiChooseAction(db, found, deep, mkRand(3));
    const ms2 = Date.now() - t2;
    check(`C とても深い先読みでも上限で止まる(${ms2}ms)`, a3 && ms2 < 2500, `${ms2}ms`);
  }
}
// ---- D ----
{
  let st = E.cardCreateGame(db, { decks: [deckA, deckB], names: ['A', 'B'], seed: 123, first: 1 });
  const r = mkRand(4);
  const pols = [E.cardSharePolicy(tac(3, 10), 'normal'), E.cardAiPolicy('kiki', 'master')];
  let k = 0;
  for (; k < 4000 && st.winner === null; k++) {
    const who = st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? E.cardOther(st.first) : E.cardDecider(st);
    let a = E.cardAiChooseAction(db, st, pols[who], r);
    let n = a && E.cardApplyAction(db, st, a);
    if (!n) { a = st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : st.phase === 'guts' ? { type: 'guts', hand: [] } : null; n = a && E.cardApplyAction(db, st, a); if (!n) break; }
    st = n;
  }
  check('D LEGEND の登録デッキと MASTER の助手で、最後まで勝ち負けが付く', st.winner === 0 || st.winner === 1, `${k}手`);
  const res = E.cardTourPlay(db, { deck: deckA, tactics: tac(3, 10) }, { assist: 'dra' }, { seed: 55, first: 0, key: 'k' });
  check('D 大会の1試合(LEGEND の登録デッキ)も回せる', (res.winner === 0 || res.winner === 1) && res.acts.length > 10);
}
// ---- E ----
{
  check('E 段の名前は本編のチャレンジモードの並び', J(E.CARD_SHARE_SMART_LABEL) === J({ expert: 'EXPERT', master: 'MASTER', grandmaster: 'GRAND MASTER', hell: 'HELL', legend: 'LEGEND' }));
}

if (fails.length) {
  console.error(`登録デッキの賢さと先読みの検査: NG ${fails.length}件(OK ${passed}件)`);
  fails.forEach((f) => console.error(`  NG: ${f}`));
  process.exit(1);
}
console.log(`登録デッキの賢さと先読みの検査: OK ${passed}件`);
