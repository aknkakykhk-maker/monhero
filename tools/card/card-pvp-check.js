#!/usr/bin/env node
// MFバトルカードのマルチ対戦(91-card-battle-multi.jsx)の「純粋な計算」を確かめる(2026-10-24・バトル部)。
// 案: docs/spec/card-battle/MULTI_PLAN.md
//
//   node tools/card/card-pvp-check.js
//
//   2台の端末を node の中で作り、それぞれ「自分=0・相手=1」の見え方で、相手の手札と山札を仮の札にしたまま、
//   コンピューターの考え方で何十戦も最後まで戦わせる。
//   ① 届いた手がいつも当てられる(だめな手にならない)・2台の場がずっと同じ(ライフ・KO・手札の数・ガッツの数・捨て札・番)
//   ② 2台の勝ち負けが合う
//   ③ 相手の手札・山札の番号が、こちらの場に1枚も入っていない(使われた札と表の捨て札だけ)
//   ④ 終わってから封を開けてなぞり直すと、両方で「合っている」になる
//   ⑤ ズルを見抜く: 持っていない札を使った・山札の順を入れ替えた・勝ち負けをごまかした・封と中身が違う
//   ⑥ 受け取った知らせの掃除(知らない形・大きすぎる数・狙う先の番号の入れ替え)
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const read = (p) => fs.readFileSync(path.join(GAME, p), 'utf8');
const multi = read('src/parts/91-card-battle-multi.jsx').split('// ---- 部屋と通信')[0];
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map, crypto: crypto.webcrypto, TextEncoder });
vm.runInContext(`${read('data/card-battle-cards.js')}\n;\n${read('src/parts/82-card-battle-core.jsx')}\n;\n`
  + 'const rhythmMultiText = (v, max) => String(v == null ? "" : v).replace(/[\\u0000-\\u001f]/g, "").slice(0, max);\n'
  + `${multi}\n;\nthis.E = { CARD_BATTLE_DATA, cardAiChooseAction, cardAiPolicy, cardAiBuildDeck, cardDecider, cardClone, cardApplyAction, CARD_PVP_HIDDEN,
    cardPvpFlip, cardPvpRevealOf, cardPvpNewGame, cardPvpApplyRemote, cardPvpPatchDiscard, cardPvpSealText, cardPvpSha256, cardPvpTruthGame, cardPvpVerify, cardPvpCleanMessage, cardPvpCleanAct };`, ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 決めた種で回す乱数(どの回でも同じ結果になるように)
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const decider = (st) => (st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? 1 - st.first : E.cardDecider(st));
const pub = (st, p) => ({ life: st.players[p].mons.map((m) => `${m.life}${m.ko ? 'x' : ''}`).join(','), hand: st.players[p].hand.length, deck: st.players[p].deck.length, guts: st.players[p].guts.length, discard: st.players[p].discard.join(',') });
const same = (a, b) => JSON.stringify(pub(a, 0)) === JSON.stringify(pub(b, 1)) && JSON.stringify(pub(a, 1)) === JSON.stringify(pub(b, 0))
  && a.turn === b.turn && a.phase === b.phase && (a.winner === null ? b.winner === null : b.winner === 1 - a.winner);

// 1戦: 2台(A・B)。A から見た first、B から見た first は反対
const play = (n) => {
  const r = rng(1000 + n);
  const who = ['mua', 'kiki', 'momosuke', 'dra', 'kyuko', 'atsu'];
  const deckA = E.cardAiBuildDeck(db, who[n % 6], 'normal');
  const deckB = E.cardAiBuildDeck(db, who[(n + 3) % 6], 'normal');
  const seedA = (n * 7919 + 13) >>> 0, seedB = (n * 104729 + 7) >>> 0;
  const firstA = n % 2;
  let A = E.cardPvpNewGame(db, { myDeck: deckA, mySeed: seedA, foeMonsters: deckB.monsters, first: firstA, names: ['A', 'B'] });
  let B = E.cardPvpNewGame(db, { myDeck: deckB, mySeed: seedB, foeMonsters: deckA.monsters, first: 1 - firstA, names: ['B', 'A'] });
  const hA = [], hB = [];
  const pol = E.cardAiPolicy('kyuko', 'easy');
  let steps = 0, err = '';
  while (A.winner === null && steps < 3000) {
    steps++;
    const aTurn = decider(A) === 0;
    const [me, foe] = aTurn ? [A, B] : [B, A];
    if (decider(foe) !== 1) { err = `${steps}手目: 2台で番が食い違った`; break; }
    let act = E.cardAiChooseAction(db, me, pol, r);
    let next = act && E.cardApplyAction(db, me, act);
    if (!next) { act = me.pending ? { type: 'pass' } : me.phase === 'main' ? { type: 'endAttacks' } : me.pendingDiscard ? { type: 'discard', hand: [0] } : { type: 'guts', hand: [] }; next = E.cardApplyAction(db, me, act); }
    if (!next) { err = `${steps}手目: 自分の手が進まない`; break; }
    const reveal = E.cardPvpRevealOf(me, act);
    const msg = E.cardPvpCleanMessage(JSON.parse(JSON.stringify({ t: 'act', from: 'x', seq: steps, act, reveal, discard: next.players[0].discard })));
    const other = E.cardPvpApplyRemote(db, foe, msg);
    if (!other) { err = `${steps}手目: 届いた手を当てられない(${act.type})`; break; }
    // 受け取った側は「受け取った」と一緒に自分の捨て札を返す
    const back = E.cardPvpPatchDiscard(db, next, other.players[0].discard);
    if (aTurn) { A = back; B = other; hA.push({ by: 0, act, reveal: {} }); hB.push({ by: 1, act: E.cardPvpFlip(act), reveal }); }
    else { B = back; A = other; hB.push({ by: 0, act, reveal: {} }); hA.push({ by: 1, act: E.cardPvpFlip(act), reveal }); }
    if (!same(A, B)) { err = `${steps}手目: 2台の場が食い違った ${JSON.stringify([pub(A, 0), pub(B, 1)])}`; break; }
  }
  return { A, B, hA, hB, deckA, deckB, seedA, seedB, firstA, steps, err };
};

const N = 40;
let applyOk = 0, winOk = 0, hiddenOk = 0, verifyOk = 0, finished = 0, firstErr = '';
const games = [];
for (let n = 0; n < N; n++) {
  const g = play(n);
  games.push(g);
  if (!g.err) applyOk++; else if (!firstErr) firstErr = g.err;
  if (g.A.winner !== null) finished++;
  if (g.A.winner !== null && g.B.winner === 1 - g.A.winner) winOk++;
  // こちらの場に、相手の手札・山札の本物の番号が入っていないか(仮の札のまま)
  const hid = (st) => st.players[1].hand.every((no) => no === E.CARD_PVP_HIDDEN) && st.players[1].deck.every((no) => no === E.CARD_PVP_HIDDEN);
  if (hid(g.A) && hid(g.B)) hiddenOk++;
  const vA = E.cardPvpVerify(db, { myDeck: g.deckA, mySeed: g.seedA, foeDeck: g.deckB, foeSeed: g.seedB, first: g.firstA, names: ['A', 'B'], history: g.hA, winner: g.A.winner });
  const vB = E.cardPvpVerify(db, { myDeck: g.deckB, mySeed: g.seedB, foeDeck: g.deckA, foeSeed: g.seedA, first: 1 - g.firstA, names: ['B', 'A'], history: g.hB, winner: g.B.winner });
  if (vA.ok && vB.ok) verifyOk++; else if (!firstErr) firstErr = `${n}戦目のなぞり直し: ${vA.why || vB.why}`;
}
check(`① ${N}戦とも、届いた手を当てられて、2台の場がずっと同じ`, applyOk === N, firstErr);
check(`② ${N}戦とも最後まで決着して、勝ち負けが合う`, finished === N && winOk === N, `決着 ${finished} / 合う ${winOk}`);
check('③ 相手の手札・山札は、最後まで仮の札のまま(本物の番号が入らない)', hiddenOk === N, `${hiddenOk} / ${N}`);
check('④ 終わってから封を開けてなぞり直すと、両方で合っている', verifyOk === N, `${verifyOk} / ${N}`);

// ⑤ ズルを見抜く
const g = games.find((x) => !x.err && x.hA.some((e) => e.by === 1 && Object.keys(e.reveal).length));
const base = { myDeck: g.deckA, mySeed: g.seedA, foeDeck: g.deckB, foeSeed: g.seedB, first: g.firstA, names: ['A', 'B'], history: g.hA, winner: g.A.winner };
{
  // 持っていない札を使った(見せた札を別の札にすり替える)
  const k = g.hA.findIndex((e) => e.by === 1 && Object.keys(e.reveal).length);
  const fake = g.hA.map((e, i) => (i === k ? { ...e, reveal: Object.fromEntries(Object.entries(e.reveal).map(([a, no]) => [a, no === '061' ? '062' : '061'])) } : e));
  check('⑤ 手札に無い札を使ったら、なぞり直しで見抜く', !E.cardPvpVerify(db, { ...base, history: fake }).ok);
  // 山札の切り方(種)を、あとから別のものと言い張る
  check('⑤ 山札の順を入れ替えたら、なぞり直しで見抜く', !E.cardPvpVerify(db, { ...base, foeSeed: (g.seedB + 1) >>> 0 }).ok);
  check('⑤ 勝ち負けをごまかしたら、見抜く', !E.cardPvpVerify(db, { ...base, winner: 1 - g.A.winner }).ok);
  const bad = { ...g.deckB, cards: g.deckB.cards.map(() => g.deckB.cards[0]) };
  check('⑤ 決まりに合わないデッキ(同じ札が4枚以上)は、見抜く', !E.cardPvpVerify(db, { ...base, foeDeck: bad }).ok);
}
// 届いた手のその場の見張り
{
  // こちらが先攻(first=0)なら、始める前のガッツは相手(後攻)が決める
  const st = E.cardPvpNewGame(db, { myDeck: g.deckA, mySeed: 1, foeMonsters: g.deckB.monsters, first: 0, names: ['A', 'B'] });
  // こちらが後攻(first=1)のときは、始める前のガッツはこちらが決める番なので、相手からの手ははねる
  check('⑤ 相手の番でないときに届いた手ははねる', E.cardPvpApplyRemote(db, E.cardPvpNewGame(db, { myDeck: g.deckA, mySeed: 1, foeMonsters: g.deckB.monsters, first: 1, names: ['A', 'B'] }), { act: { type: 'setupGuts', hand: [] }, reveal: {}, discard: [] }) === null);
  const ok = E.cardPvpApplyRemote(db, st, { act: { type: 'setupGuts', hand: [0, 1] }, reveal: {}, discard: [] });
  check('⑤ 伏せた札(ガッツ)は見せなくても当てられる', !!ok && ok.players[1].guts.length === 2 && ok.players[1].guts.every((no) => no === E.CARD_PVP_HIDDEN));
  check('⑤ 捨て札の数が合わない知らせははねる', E.cardPvpApplyRemote(db, st, { act: { type: 'setupGuts', hand: [] }, reveal: {}, discard: [g.deckB.cards[0]] }) === null);
}
// 封の指紋
(async () => {
  const t1 = E.cardPvpSealText({ seed: 5, salt: 'abc', deck: g.deckB });
  const h1 = await E.cardPvpSha256(t1);
  const h2 = await E.cardPvpSha256(E.cardPvpSealText({ seed: 6, salt: 'abc', deck: g.deckB }));
  check('⑤ 封の指紋は64文字で、山札の切り方が違えば別の指紋になる', /^[0-9a-f]{64}$/.test(h1) && h1 !== h2);
  // ⑥ 知らせの掃除
  const C = E.cardPvpCleanMessage;
  check('⑥ 知らない形の知らせは捨てる', C({ t: 'xx', from: 'a' }) === null && C(null) === null && C({ t: 'act', from: 'a', seq: 1, act: { type: 'nuke' } }) === null);
  check('⑥ 大きすぎる数・壊れた数ははねる', C({ t: 'act', from: 'a', seq: 1, act: { type: 'attack', mon: 9, hand: [0], target: { p: 1, m: 0 } } }) === null
    && C({ t: 'act', from: 'a', seq: 1, act: { type: 'guard', hand: 'x', mon: 0 } }) === null);
  const flip = E.cardPvpFlip({ type: 'attack', mon: 0, hand: [1], target: { p: 1, m: 2 } });
  check('⑥ 相手から見た手は、狙う先の人の番号だけが入れ替わる', flip.target.p === 0 && flip.target.m === 2 && flip.mon === 0 && E.cardPvpFlip({ type: 'pass' }).type === 'pass');
  const hb = C({ t: 'hb', from: 'a', name: 'x'.repeat(99), mons: ['C-001', 'C-002', 'C-003'], seal: 'f'.repeat(64) });
  check('⑥ 名前は長さで切り、封は64文字の指紋だけ通す', hb && hb.name.length === 16 && hb.seal === 'f'.repeat(64) && C({ t: 'hb', from: 'a', seal: 'zz' }).seal === null);
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
