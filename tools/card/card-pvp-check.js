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
//   ⑦ 報酬(台帳 #119 の対人戦・1日の上限なし)と持ち時間の決まり(自分の番60秒・守り15秒・使い切ったときの手)
//   ⑧ 結果の台詞(社長「このまま入れる」): 6人×勝ち・負け・相手が抜けた×3本・話し方の決まり・控えの表と同じ
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const read = (p) => fs.readFileSync(path.join(GAME, p), 'utf8');
const multi = read('src/parts/91-card-battle-multi.jsx').split('// ---- 部屋と通信')[0];
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map, crypto: crypto.webcrypto, TextEncoder });
vm.runInContext(`${read('data/card-battle-cards.js')}\n;\n${read('src/parts/82-card-battle-core.jsx')}\n;\n`
  + 'const rhythmMultiText = (v, max) => String(v == null ? "" : v).replace(/[\\u0000-\\u001f]/g, "").slice(0, max);\n'
  + `${multi}\n;\nthis.E = { CARD_BATTLE_DATA, cardAiChooseAction, cardAiPolicy, cardAiBuildDeck, cardDecider, cardClone, cardApplyAction, CARD_PVP_HIDDEN,
    cardPvpFlip, cardPvpRevealOf, cardPvpNewGame, cardPvpApplyRemote, cardPvpPatchDiscard, cardPvpSealText, cardPvpSha256, cardPvpTruthGame, cardPvpVerify, cardPvpCleanMessage, cardPvpCleanAct,
    cardPvpReward, cardPvpTimeoutAct, cardPvpLimitMs, cardPvpClockKey, cardPvpDecider, cardPvpNormalizePenalty, CARD_PVP_STAMPS, CARD_PVP_TURN_MS, CARD_PVP_GUARD_MS, CARD_PVP_RESULT_LINES, cardPvpResultLine };`, ctx);
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
  check('⑥ チャットは定型文の番号だけ通す', C({ t: 'chat', from: 'a', i: 0 }).i === 0 && C({ t: 'chat', from: 'a', i: 99 }) === null && C({ t: 'chat', from: 'a', i: 'よろしく' }) === null);
  // ⑦ 報酬と持ち時間
  const R = E.cardPvpReward;
  const eq = (a, b) => a.point === b[0] && a.loops === b[1];
  check('⑦ 勝ち 200・24周 / 負け 50・12周(自分の番10回で満額)', eq(R('win', { ownTurns: 12, kos: 3 }), [200, 24]) && eq(R('lose', { ownTurns: 10, kos: 0 }), [50, 12]) && eq(R('lose', { ownTurns: 5, kos: 0 }), [50, 6]));
  check('⑦ 投了は倒した数で決める・自分の番が3回より前に終わったら0', eq(R('surrender', { ownTurns: 8, kos: 2 }), [20, 8]) && eq(R('win', { ownTurns: 2, kos: 3 }), [0, 0]) && R('win', { ownTurns: 2, kos: 3 }).short === true);
  check('⑦ 何戦してももらえる(1日の上限・同じ相手の制限を使わない)', !/dailyMax|sameFoePerDay|pvpPoint\s*[<>]/.test(multi));
  const st0 = E.cardPvpNewGame(db, { myDeck: g.deckA, mySeed: 3, foeMonsters: g.deckB.monsters, first: 1, names: ['A', 'B'] });
  check('⑦ 始める前・攻撃の番は60秒、守りの番は15秒', E.cardPvpLimitMs(st0) === 60000 && E.cardPvpLimitMs({ ...st0, pending: {} }) === 15000);
  check('⑦ 持ち時間を使い切ったときの手は、どの場面でもルールに合う(始める前・攻撃・ガッツ)', (() => {
    let s1 = E.cardApplyAction(db, st0, E.cardPvpTimeoutAct(st0));           // 始める前(こちらが後攻)
    if (!s1) return false;
    for (let k = 0; k < 6 && s1.winner === null; k++) {
      const a = E.cardPvpTimeoutAct(s1);
      const n = E.cardApplyAction(db, s1, a.type === 'setupGuts' || E.cardPvpDecider(s1) === 0 ? a : (s1.pending ? { type: 'pass' } : s1.phase === 'main' ? { type: 'endAttacks' } : { type: 'guts', hand: [] }));
      if (!n) return false; s1 = n;
    }
    return true;
  })());
  check('⑦ 時計は、決める人か番が変わると数え直す(攻撃とガッツは同じ60秒)', E.cardPvpClockKey({ ...st0, phase: 'main', turn: 3 }) === E.cardPvpClockKey({ ...st0, phase: 'guts', turn: 3 })
    && E.cardPvpClockKey({ ...st0, phase: 'main', turn: 3 }) !== E.cardPvpClockKey({ ...st0, phase: 'main', turn: 4 }));
  check('⑦ 抜けた人の待ち時間の保存は、壊れた値なら0(入れる)', E.cardPvpNormalizePenalty('x') === 0 && E.cardPvpNormalizePenalty(-5) === 0 && E.cardPvpNormalizePenalty(123) === 123);
  // ⑧ 結果の台詞
  const L = E.CARD_PVP_RESULT_LINES;
  const ids = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko'];
  const all = ids.flatMap((id) => ['win', 'lose', 'left'].flatMap((k) => ((L[id] || {})[k] || []).map(([t, f]) => ({ id, k, t, f }))));
  check('⑧ 6人それぞれに、勝ち・負け・相手が抜けたの台詞が3本ずつ', all.length === 54 && ids.every((id) => ['win', 'lose', 'left'].every((k) => L[id][k].length === 3)));
  const faces = ['normal', 'happy', 'wink', 'excited', 'troubled', 'surprise', 'angry', 'crying'];
  check('⑧ 表情は助手の8つの表情のどれか', all.every((x) => faces.includes(x.f)), all.filter((x) => !faces.includes(x.f)).map((x) => x.f).join(','));
  const names = ['みゅあ', 'きき', 'ももすけ', 'ドラ', 'あつ', 'きゅうこ'];
  check('⑧ ほかの助手の名前を出さない(まだ会っていない子がいる)', all.every((x) => !names.some((n) => x.t.includes(n))), all.filter((x) => names.some((n) => x.t.includes(n))).map((x) => x.t).join(' / '));
  const atsuBad = all.filter((x) => x.id === 'atsu' && !/[笑！？…!?)）]$/.test(x.t));
  check('⑧ あつの台詞は、文末に笑か記号', atsuBad.length === 0, atsuBad.map((x) => x.t).join(' / '));
  check('⑧ みゅあは「ぢゃん」を使わない・半角の \' を使わない', all.filter((x) => x.id === 'mua').every((x) => !/ぢゃん|'/.test(x.t)));
  check('⑧ きゅうこは1文に笑とwを両方付けない', all.filter((x) => x.id === 'kyuko').every((x) => !/笑w|w笑/.test(x.t)));
  const leftAll = all.filter((x) => x.k === 'left');
  check('⑧ 相手が抜けたときの「勝ちは勝ち」「電波」は、それぞれ2人まで(同じ言い方にしない)', leftAll.filter((x) => x.t.includes('勝ちは勝ち')).length <= 2 && leftAll.filter((x) => x.t.includes('電波')).length <= 2);
  const md = fs.readFileSync(path.resolve(__dirname, '..', '..', 'docs/progress/card-battle/multi/result-lines.md'), 'utf8');
  check('⑧ 台詞は、社長に見せた控えの表と1字も違わない', all.every((x) => md.includes(`| ${x.f} | ${x.t} |`)));
  check('⑧ 台詞の選び方: 同じ試合なら同じ台詞・知らない助手はみゅあの台詞', E.cardPvpResultLine('kiki', 'win', 5).text === E.cardPvpResultLine('kiki', 'win', 5).text && E.cardPvpResultLine('zzz', 'lose', 0).text === L.mua.lose[0][0]);
  // ⑨ 公開の印(社長 案A: MFバトルカードの公開と同じ日にマルチも開く)
  const full91 = read('src/parts/91-card-battle-multi.jsx'), p84 = read('src/parts/84-screen-card-battle.jsx'), p90 = read('src/parts/90-card-rank.jsx');
  check('⑨ マルチの公開の印は RELEASE_FLAGS.cardBattle を見るたびに引く', /const cardPvpOpen = \(\) => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS\.cardBattle === true;/.test(full91));
  check('⑨ 「マルチ対戦」のボタンは、デバッグか公開の印のときだけ押せる', /data-card-mode-multi disabled=\{!\(debug \|\| cardPvpOpen\(\)\)\}/.test(p84));
  check('⑨ 「準備中」の札は、公開の印が立つまで(ボタン・ランキング)', /\{!cardPvpOpen\(\) && <span[^\n]*準備中/.test(p84) && /\{!cardPvpOpen\(\) && <span[^\n]*準備中/.test(p90));
  check('⑨ 強さの点数へ届けるのは、公開後のふつうの入口だけ(rank.send で、デバッグではない)', /rankSend=\{!!\(rank && rank\.send\) && !debug\}/.test(p84));
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
