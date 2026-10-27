// MFバトルカード: 組み合わせ(付ける札)の手で、助手が「何も変わらない札を付けない」・記録が出した札とずれない(2026-10-27 カード部ルールくん)。
// きっかけ: 観戦の記録で、ドラがカララギマンゴーにジョイのサポートを付けて2枚出していた(払うガッツはもともと0。1枚むだ)。
// 付ける札の効き目そのものは card-audit-attach-check.js(総点検 C)が見る。ここは助手の選び方と記録だけ。ブラウザなしで 82 を動かす。
//
//   node tools/card/card-ai-combo-check.js [--verbose]
//
// 見るもの
//   A. カララギマンゴー＋ジョイのサポートの場面: どの助手も、どの強さでも、ジョイを付けた手を選ばない(雑な手のときも)
//   B. 純血のスピード: 狙う相手が純血だけなら付けない手を選ぶ/混血を狙うなら付けた手も選べる(付ける札は外さない)
//   C. 助手どうしの対戦を回し、手を打つたびに
//      ・ほかに手があるのに、付けても変わらない札(cardAttachUseless)を付けた手を選んでいない
//      ・記録(use の出来事)に出る札が、出した手の札と同じ
//      ・手札から減った札が、出した札とカード投げで捨てた札と同じ(勝手に増えたり抜けたりしない)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, CARD_AI_HABITS, cardCreateGame, cardApplyAction, cardAttackOptions, cardAiChooseAction, cardAiPolicy, cardAttachUseless, cardAiBuildDeck, cardAiSeededRand, cardDecider, cardOther, cardRngNext };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };

const WHO = Object.keys(E.CARD_AI_HABITS);
const LEVELS = ['easy', 'normal', 'hard', 'expert', 'master'];
const scene = (m0, m1, h0, h1) => {
  let st = E.cardCreateGame(db, { decks: [{ monsters: m0, cards: Array(50).fill('100') }, { monsters: m1, cards: Array(50).fill('100') }], seed: 7, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players[0].hand = h0.slice(); st.players[1].hand = h1.slice();
  st.players.forEach((pl) => { pl.guts = Array(10).fill('100'); });
  st.active = 0; st.phase = 'main';
  return st;
};
const seeded = (seed) => { let s = seed >>> 0; return () => { const n = E.cardRngNext(s); s = n.s; return n.v; }; };
const names = (st, act) => (act.hand || []).map((i) => st.players[st.active].hand[i]).join('+');

// ---- A ----
{
  const st = scene(['C-031', 'C-003', 'C-006'], ['C-003', 'C-006', 'C-001'], ['113', '276'], []);
  st.players[0].mons[0].life = 5;
  const offered = E.cardAttackOptions(db, st).some((o) => o.hand.length === 2);
  check('A 材料: ルールではカララギマンゴー＋ジョイのサポートを出せる(人は選べる)', offered);
  WHO.forEach((w) => LEVELS.forEach((lv) => {
    let bad = 0;
    for (let k = 0; k < 60; k++) { const a = E.cardAiChooseAction(db, st, E.cardAiPolicy(w, lv), seeded(k + 1)); if (names(st, a) === '113+276') bad++; }
    check(`A ${w} ${lv}: ジョイのサポートを付けた手を選ばない`, bad === 0, `${bad}/60 回`);
  }));
}
// ---- B ----
{
  const pure = scene(['C-031', 'C-003', 'C-006'], ['C-003', 'C-006', 'C-001'], ['264', '346'], []);
  const po = E.cardAttackOptions(db, pure).filter((o) => o.mon === 0 && o.target && o.target.m === 0);
  check('B 純血の相手には、純血のスピードを付けた手を外す', po.some((o) => o.hand.length === 2) && po.filter((o) => o.hand.length === 2).every((o) => E.cardAttachUseless(db, pure, o)));
  const hy = scene(['C-031', 'C-003', 'C-006'], ['C-010', 'C-006', 'C-001'], ['264', '346'], []);
  const ho = E.cardAttackOptions(db, hy).filter((o) => o.mon === 0 && o.target && o.target.m === 0);
  check('B 混血の相手なら、純血のスピードを付けた手は外さない', ho.some((o) => o.hand.length === 2) && ho.every((o) => !E.cardAttachUseless(db, hy, o)));
}
// ---- B2. 払うガッツを減らす札は、少しでも減るなら外さない(光合成 −2 を払うガッツ1以上のプラントの技に) ----
{
  const plantPow = Object.values(db.cards).find((c) => c.ready && c.user === 'plant' && c.kind === 'pow' && c.guts >= 1 && !(c.effects || []).length);
  const plant = Object.values(db.monsters).find((m) => m.species === 'plant' && !m.main && !m.variant);
  if (plantPow && plant) {
    const st = scene([plant.no, 'C-003', 'C-006'], ['C-003', 'C-006', 'C-001'], [plantPow.no, '209'], []);
    const o = E.cardAttackOptions(db, st).filter((x) => x.mon === 0 && x.hand.length === 2);
    check(`B2 光合成を払うガッツ${plantPow.guts}の技に付ける手は外さない`, o.length > 0 && o.every((x) => !E.cardAttachUseless(db, st, x)));
  } else check('B2 材料: プラントの技', false);
}
// ---- C ----
{
  let games = 0, actions = 0, combos = 0;
  const pairs = [];
  WHO.forEach((a, i) => WHO.forEach((b, j) => { if (i < j) pairs.push([a, b]); }));
  ['normal', 'master'].forEach((lv) => pairs.forEach(([a, b], k) => {
    for (let g = 0; g < 2; g++) {
      const decks = [E.cardAiBuildDeck(db, a, lv, E.cardAiSeededRand(`combo:${a}:${lv}:${g}`)), E.cardAiBuildDeck(db, b, lv, E.cardAiSeededRand(`combo:${b}:${lv}:${g}`))];
      const pol = [E.cardAiPolicy(a, lv), E.cardAiPolicy(b, lv)];
      let st = E.cardCreateGame(db, { decks, seed: 900 + k * 7 + g, first: g % 2 });
      const rand = seeded(31 + k * 13 + g);
      for (let step = 0; step < 3000 && st.winner === null; step++) {
        const who = st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? E.cardOther(st.first) : E.cardDecider(st);
        const act = E.cardAiChooseAction(db, st, pol[who], rand);
        if ((act.type === 'attack' || act.type === 'breeder') && st.phase === 'main' && !st.pending) {
          actions++;
          const p = st.active;
          const cardsPlayed = act.hand.map((i) => st.players[p].hand[i]);
          if (cardsPlayed.length > 1) combos++;
          if (E.cardAttachUseless(db, st, act)) {
            const others = E.cardAttackOptions(db, st).some((o) => !E.cardAttachUseless(db, st, o));
            check(`C ${a}対${b} ${lv}: 付けても変わらない札を付けない(${cardsPlayed.join('+')})`, !others);
          }
          const next = E.cardApplyAction(db, st, act);
          if (next) {
            const ev = (next.events || []).find((e) => e.t === 'use' && e.p === p);
            const evCards = ev ? (ev.cards || []).slice().sort().join(',') : null;
            check(`C ${a}対${b} ${lv}: 記録の札が出した札と同じ(${cardsPlayed.join('+')})`, evCards === cardsPlayed.slice().sort().join(','), `記録 ${evCards}`);
            const toss = (act.toss || []).map((i) => st.players[p].hand[i]);
            const before = st.players[p].hand.slice(); const after = next.players[p].hand.slice();
            const gone = before.slice(); after.forEach((n) => { const x = gone.indexOf(n); if (x >= 0) gone.splice(x, 1); });
            const want = [...cardsPlayed, ...toss].sort().join(',');
            // 出したあとに引く札(もう1枚引くなど)は、手札が増えるだけなので数えない
            check(`C ${a}対${b} ${lv}: 手札から減った札が出した札と同じ(${cardsPlayed.join('+')})`, gone.sort().join(',') === want || after.length > before.length - cardsPlayed.length - toss.length, `減った ${gone.join(',')}・出した ${want}`);
          }
          st = next || st;
          if (!next) break;
          continue;
        }
        const next = E.cardApplyAction(db, st, act);
        if (!next) break;
        st = next;
      }
      games++;
    }
  }));
  check('C 対戦を回せた', games > 0 && actions > 100, `${games}試合・${actions}手・組み合わせ ${combos}手`);
  if (VERBOSE) console.log(`  ${games}試合・${actions}手・組み合わせ ${combos}手`);
}

if (fails.length) {
  console.error(`組み合わせの手と記録の検査: NG ${fails.length}件(OK ${passed}件)`);
  fails.slice(0, 30).forEach((f) => console.error(`  NG: ${f}`));
  process.exit(1);
}
console.log(`組み合わせの手と記録の検査: OK ${passed}件`);
