#!/usr/bin/env node
// MFバトルカードの「過去の対戦を見る」(93-card-replay.jsx)の純粋な計算を確かめる(2026-10-27・カード部ミカエシくん)。
//
//   node tools/card/card-replay-check.js
//
//   ① コンピューターどうしで何十戦も最後まで戦わせ、記録からなぞり直すと、1手ごとの場と勝ち負けが、実際の試合と同じになる
//   ② 記録を保存の形(JSON)にして読み直しても、同じようになぞれる
//   ③ ルールが変わったときの止まり方: 手を1つ書き換える・指紋を書き換えると、その手で止まる(勝手に別の試合にしない)
//   ④ 保存の掃除: 壊れた値・知らない形・型の違う項目は捨てる/同じ試合は1つ/50試合まで/お気に入り10までで消さない/大きさの上限/最後の番
//   ⑤ 番の区切りと、いまの手の一言
//   ⑥ 助手と対戦(種は1つ・cardCreateGame の始まり)の記録も、同じようになぞれる
const fs = require('fs'), path = require('path'), vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const read = (p) => fs.readFileSync(path.join(GAME, p), 'utf8');
const multi = read('src/parts/91-card-battle-multi.jsx').split('// ---- 部屋と通信')[0];
// 92 の画面の部品(再生の帯)は React を使うので、純粋な計算の所だけを読む
const replay = read('src/parts/93-card-replay.jsx').split('// ---- 保存(端末の中だけ)')[0];
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${read('data/card-battle-cards.js')}\n;\n${read('src/parts/82-card-battle-core.jsx')}\n;\n`
  + 'const rhythmMultiText = (v, max) => String(v == null ? "" : v).replace(/[\\u0000-\\u001f]/g, "").slice(0, max);\n'
  + `${multi}\n;\n${replay}\n;\nthis.E = { CARD_BATTLE_DATA, cardAiChooseAction, cardAiPolicy, cardAiBuildDeck, cardApplyAction, cardPvpTruthGame, cardPvpVerify, cardPvpDecider, cardPvpTimeoutAct,
    cardReplayPrint, cardReplayNormalize, cardReplayNormalizeOne, cardReplayAdd, cardReplaySetFav, cardReplayBuild, cardReplayFromPvp, cardReplayFromCpu, cardCreateGame, cardReplayTurnStarts, cardReplayCaption,
    CARD_REPLAY_MAX, CARD_REPLAY_FAV_MAX, CARD_REPLAY_BYTES_MAX, CARD_REPLAY_RULES };`, ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

// 本当の場(両方の山札が本物)で、決める人の手をコンピューターに選ばせる。history は 91 と同じ形 [{ by, act }]
const play = (n) => {
  const who = ['mua', 'kiki', 'momosuke', 'dra', 'kyuko', 'atsu'];
  const lv = n < 15 ? 'normal' : 'master';
  const r = rng(500 + n);
  const myDeck = E.cardAiBuildDeck(db, who[n % 6], lv, r), foeDeck = E.cardAiBuildDeck(db, who[(n + 2) % 6], lv, r);
  const mySeed = (n * 7919 + 3) >>> 0, foeSeed = (n * 104729 + 11) >>> 0, first = n % 2;
  let st = E.cardPvpTruthGame(db, { myDeck, mySeed, foeDeck, foeSeed, first, names: ['あなた', 'あいて'] });
  const pols = [E.cardAiPolicy('kyuko', lv), E.cardAiPolicy('atsu', lv)];
  const history = [], states = [st];
  let steps = 0;
  while (st.winner === null && steps < 3000) {
    steps++;
    const by = E.cardPvpDecider(st);
    let act = E.cardAiChooseAction(db, st, pols[by], r);
    let next = act && E.cardApplyAction(db, st, act);
    if (!next) { act = E.cardPvpTimeoutAct(st); next = E.cardApplyAction(db, st, act); }
    if (!next) break;
    history.push({ by, act: JSON.parse(JSON.stringify(act)) });
    st = next; states.push(st);
  }
  return { myDeck, foeDeck, mySeed, foeSeed, first, history, states, st };
};

// ① ② なぞり直しが実際の試合と同じになる
let games = 0, sameAll = 0, maxBytes = 0, sumBytes = 0;
const recs = [];
for (let n = 0; n < 30; n++) {
  const g = play(n);
  if (g.st.winner === null) continue;
  games++;
  const v = E.cardPvpVerify(db, { myDeck: g.myDeck, mySeed: g.mySeed, foeDeck: g.foeDeck, foeSeed: g.foeSeed, first: g.first, names: ['あなた', 'あいて'], history: g.history, winner: g.st.winner });
  const rec = E.cardReplayFromPvp(db, { match: `m-test-${n}`, at: 1000 + n, myDeck: g.myDeck, mySeed: g.mySeed, foeDeck: g.foeDeck, foeSeed: g.foeSeed, first: g.first,
    history: g.history, foe: { name: 'あいて', icon: '🙂' }, outcome: g.st.winner === 0 ? 'win' : 'lose', reason: '' });
  if (!v.ok || !rec) { check(`${n}戦目: 記録が作れる`, false, v.why || 'cardReplayFromPvp が null'); continue; }
  const loaded = E.cardReplayNormalizeOne(JSON.parse(JSON.stringify(rec)));
  const built = E.cardReplayBuild(db, loaded);
  const ok = built.stop === null && built.states.length === g.states.length
    && built.states.every((s, i) => E.cardReplayPrint(s) === E.cardReplayPrint(g.states[i]) && JSON.stringify(s.players) === JSON.stringify(g.states[i].players))
    && built.states[built.states.length - 1].winner === g.st.winner;
  if (ok) sameAll++;
  else check(`${n}戦目: なぞり直しが同じ`, false, `stop=${built.stop} 長さ ${built.states.length}/${g.states.length}`);
  const bytes = JSON.stringify(rec).length;
  maxBytes = Math.max(maxBytes, bytes); sumBytes += bytes;
  recs.push({ rec, g });
}
check(`記録からなぞり直すと、実際の試合と1手ごとに同じ(${sameAll}/${games}戦)`, games >= 20 && sameAll === games);
check(`1試合の記録の大きさ(最大 ${(maxBytes / 1024).toFixed(1)}KB・平均 ${(sumBytes / Math.max(1, games) / 1024).toFixed(1)}KB)が15KB以下`, maxBytes <= 15000);

// ③ ルールが変わったときの止まり方
{
  const { rec } = recs[0];
  const mid = Math.floor(rec.acts.length / 2);
  // 指紋を1つ書き換える(ルールが変わって場がずれたのと同じ)
  const badPrint = JSON.parse(JSON.stringify(rec));
  badPrint.prints = `${badPrint.prints.slice(0, mid * 4)}zzzz${badPrint.prints.slice(mid * 4 + 4)}`;
  const b1 = E.cardReplayBuild(db, E.cardReplayNormalizeOne(badPrint));
  check('指紋が合わない手で止まる(そこまでは見られる)', b1.stop === mid && b1.states.length === mid + 1, `stop=${b1.stop}`);
  // 番でない人の手にする
  const badBy = JSON.parse(JSON.stringify(rec));
  badBy.acts[mid][0] = 1 - badBy.acts[mid][0];
  const b2 = E.cardReplayBuild(db, E.cardReplayNormalizeOne(badBy));
  check('番でない人の手で止まる', b2.stop === mid, `stop=${b2.stop}`);
  // 当てられない手(手札に無い番号)
  const badAct = JSON.parse(JSON.stringify(rec));
  const k = badAct.acts.findIndex((a) => a[1].type === 'guard' || a[1].type === 'attack');
  if (k >= 0) {
    badAct.acts[k][1] = { type: 'guard', hand: 19, mon: 0 };
    const b3 = E.cardReplayBuild(db, E.cardReplayNormalizeOne(badAct));
    check('ルールに合わない手で止まる', b3.stop !== null && b3.stop <= k, `stop=${b3.stop} k=${k}`);
  }
  // 指紋の無い記録(古い形)でも、手が当たる所までは見られる
  const noPrint = { ...JSON.parse(JSON.stringify(rec)), prints: '' };
  const b4 = E.cardReplayBuild(db, E.cardReplayNormalizeOne(noPrint));
  check('指紋の無い記録も、最後までなぞれる', b4.stop === null && b4.states.length === rec.acts.length + 1);
  check('記録にルールの版が入っている', rec.rules === E.CARD_REPLAY_RULES && rec.rules >= 1);
}

// ④ 保存の掃除
{
  const junk = [null, 1, 'x', [], { v: 2 }, { list: 'x' }, { v: 1, list: [null, 1, { v: 1 }, { v: 1, id: 'a b', kind: 'pvp' }] }];
  check('壊れた保存は空として読む', junk.every((j) => E.cardReplayNormalize(j).list.length === 0));
  const r0 = recs[0].rec;
  const broken = [
    { ...r0, id: 'bad1', decks: [r0.decks[0]] },
    { ...r0, id: 'bad2', seeds: [-1, 2] },
    { ...r0, id: 'bad3', first: 2 },
    { ...r0, id: 'bad4', acts: [[0, { type: 'nuke' }]] },
    { ...r0, id: 'bad5', acts: [[3, { type: 'pass' }]] },
    { ...r0, id: 'bad6', kind: 'other' },
    { ...r0, id: 'bad7', decks: [{ monsters: ['C-001'], cards: [] }, r0.decks[1]] },
  ];
  const box = E.cardReplayNormalize({ v: 1, list: [r0, ...broken, r0] });
  check('型の違う記録は捨て、同じ試合は1つにする', box.list.length === 1 && box.list[0].id === r0.id);
  const odd = E.cardReplayNormalizeOne({ ...r0, prints: 'xyz', foe: { name: 5 }, outcome: 'nope', fav: 'yes' });
  check('知らない値は既定で補う(指紋なし・相手の名前・結果・お気に入り)', odd && odd.prints === '' && odd.foe.name === 'あいて' && odd.outcome === null && odd.fav === false);

  // 50試合まで・お気に入りは消さない・10まで(30戦の記録を番号を替えて増やし、上限を超えるまで足す)
  const many = [];
  for (let k = 0; many.length < E.CARD_REPLAY_MAX + 15; k++) recs.forEach(({ rec }) => { if (many.length < E.CARD_REPLAY_MAX + 15) many.push({ ...rec, id: `${rec.id}-${k}`, at: 1 + many.length }); });
  let saved = null;
  const FAV = E.CARD_REPLAY_FAV_MAX;
  many.slice(0, FAV + 1).forEach((rec) => { saved = E.cardReplayAdd(saved, rec); });
  for (let i = 0; i < FAV; i++) saved = E.cardReplaySetFav(saved, many[i].id, true).box;
  const over = E.cardReplaySetFav(saved, many[FAV].id, true);
  check(`お気に入りは${FAV}まで`, !over.ok && over.box.list.filter((r) => r.fav).length === FAV);
  many.slice(FAV + 1).forEach((rec) => { saved = E.cardReplayAdd(saved, rec); });
  const ids = saved.list.map((r) => r.id);
  check(`取っておくのは${E.CARD_REPLAY_MAX}試合まで(${saved.list.length})`, saved.list.length === E.CARD_REPLAY_MAX);
  check('いちばん古い試合でも、お気に入りは消えない', many.slice(0, FAV).every((r) => ids.includes(r.id)));
  check('新しい試合が先頭', saved.list[0].id === many[many.length - 1].id);
  check(`合わせた大きさが上限以下(${(JSON.stringify(saved).length / 1024).toFixed(1)}KB)`, JSON.stringify(saved).length <= E.CARD_REPLAY_BYTES_MAX);
  check('最後の番が記録に入る(一覧の「◯番まで」)', saved.list.every((r) => Number.isInteger(r.turn) && r.turn >= 1));
  const old = E.cardReplayNormalizeOne({ ...many[0], turn: undefined });
  check('最後の番の無い前の記録も読める', old && old.turn === null);
  const again = E.cardReplayAdd(saved, many[many.length - 1]);
  check('同じ試合は2度足さない', again.list.length === saved.list.length);
  const off = E.cardReplaySetFav(saved, many[0].id, false);
  check('お気に入りを外せる', off.ok && !off.box.list.find((r) => r.id === many[0].id).fav);
  // 保存の4つ目のお気に入り(手で書き換えた保存)は、読むときに3つへ減らす
  const four = { v: 1, list: saved.list.map((r) => ({ ...r, fav: true })) };
  check(`読むときもお気に入りは${E.CARD_REPLAY_FAV_MAX}まで`, E.cardReplayNormalize(four).list.filter((r) => r.fav).length === E.CARD_REPLAY_FAV_MAX);
}

// ⑤ 番の区切りと一言
{
  const { rec } = recs[0];
  const built = E.cardReplayBuild(db, rec);
  const turns = E.cardReplayTurnStarts(built.states);
  const okTurns = turns[0] === 0 && turns.every((t, i) => i === 0 || (built.states[t].turn !== built.states[t - 1].turn || built.states[t].active !== built.states[t - 1].active));
  check(`番の区切り(${turns.length}か所)が、番の替わり目になっている`, okTurns && turns.length >= 3);
  const caps = built.states.map((_, i) => E.cardReplayCaption(built.states, i));
  check('手のあとの一言がほとんどの手で出る', caps.filter(Boolean).length >= built.states.length * 0.6, `${caps.filter(Boolean).length}/${built.states.length}`);
}

// ⑥ 助手と対戦
{
  let ok = 0, n0 = 0;
  for (let n = 0; n < 10; n++) {
    const r = rng(900 + n);
    const myDeck = E.cardAiBuildDeck(db, 'kiki', 'normal', r), cpuDeck = E.cardAiBuildDeck(db, 'dra', 'hard', r);
    const seed = (n * 31337 + 5) >>> 0, first = n % 2;
    let st = E.cardCreateGame(db, { decks: [myDeck, cpuDeck], names: ['あなた', 'ドラ'], seed, first });
    const pol = E.cardAiPolicy('dra', 'hard');
    const history = [], states = [st];
    for (let k = 0; k < 3000 && st.winner === null; k++) {
      const by = E.cardPvpDecider(st);
      let act = E.cardAiChooseAction(db, st, pol, r);
      let next = act && E.cardApplyAction(db, st, act);
      if (!next) { act = E.cardPvpTimeoutAct(st); next = E.cardApplyAction(db, st, act); }
      if (!next) break;
      history.push({ by, act: JSON.parse(JSON.stringify(act)) }); st = next; states.push(st);
    }
    // 途中で投了した試合も(半分の手まで)
    const cut = n % 3 === 0 ? Math.floor(history.length / 2) : history.length;
    n0++;
    const rec = E.cardReplayFromCpu(db, { id: `c${seed}`, at: 1, myDeck, cpuDeck, seed, first, history: history.slice(0, cut), foe: { name: 'ドラ', who: 'dra' }, outcome: cut < history.length ? 'surrender' : st.winner === 0 ? 'win' : 'lose' });
    const built = rec && E.cardReplayBuild(db, E.cardReplayNormalizeOne(JSON.parse(JSON.stringify(rec))));
    if (built && built.stop === null && built.states.length === cut + 1 && built.states.every((s, i) => E.cardReplayPrint(s) === E.cardReplayPrint(states[i])) && rec.foe.who === 'dra' && rec.kind === 'cpu') ok++;
  }
  check(`助手と対戦の記録も、1手ごとに同じになぞれる(投了で終わった試合も・${ok}/${n0}戦)`, ok === n0 && n0 === 10);
}

console.log(failed ? `\nNG ${failed} 件` : '\nすべて OK');
process.exit(failed ? 1 : 0);
