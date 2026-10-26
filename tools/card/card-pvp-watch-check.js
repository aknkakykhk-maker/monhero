#!/usr/bin/env node
// MFバトルカードのマルチ対戦の観戦(92-card-pvp-watch.jsx)の「純粋な計算」を確かめる(2026-10-27・カード部ナガメくん)。
// 案: docs/progress/card-multi-plus/README.md の「3. 観戦」
//
//   node tools/card/card-pvp-watch-check.js
//
//   2台(ホスト A・相手 B)を node の中で戦わせ(91 の card-pvp-check.js と同じやり方)、ホストが観戦へ流す物(手・使った札・捨て札の並び)だけを
//   見る人の場(両方の手札と山札が仮の札)に当てていく。
//   ① 流れてきた手がいつも当てられる・見る人の場がホストの場とずっと同じ(ライフ・KO・手札の数・山札の数・ガッツの数・捨て札・番)
//   ② 下に出す人を入れ替えても(フレンドが相手側のとき)同じ
//   ③ 見る人の場の山札は全部仮の札・手札とガッツの本物の札は、流れた知らせに出た札だけ(捨て札から戻した札など)。流す知らせに、手札・山札の中身・封の項目が無い
//   ④ 途中から見る人(はじめの何手かを、あとからまとめてもらう)も同じ場になる
//   ⑤ 受け取った知らせの掃除(知らない形・大きすぎる数・手札の番号の形)
//   ⑥ 対戦中の一覧の並び(フレンドの試合が先・古い知らせは消える)
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const read = (p) => fs.readFileSync(path.join(GAME, p), 'utf8');
const multi = read('src/parts/91-card-battle-multi.jsx').split('// ---- 部屋と通信')[0];
const watch = read('src/parts/92-card-pvp-watch.jsx').split('// ---- 対戦する側')[0];
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map, crypto: crypto.webcrypto, TextEncoder });
vm.runInContext(`${read('data/card-battle-cards.js')}\n;\n${read('src/parts/82-card-battle-core.jsx')}\n;\n`
  + 'const rhythmMultiText = (v, max) => String(v == null ? "" : v).replace(/[\\u0000-\\u001f]/g, "").slice(0, max);\n'
  + `${multi}\n;\n${watch}\n;\nthis.E = { CARD_BATTLE_DATA, cardAiChooseAction, cardAiPolicy, cardLegalActions, cardAiFillBind, cardUsableBy, cardDeckProblems, cardAiBuildDeck, cardApplyAction, CARD_PVP_HIDDEN, cardPvpFlip, cardPvpRevealOf, cardPvpNewGame,
    cardPvpApplyRemote, cardPvpPatchDiscard, cardPvpCleanMessage, cardPvpTimeoutAct, cardPvpDecider, cardWatchNewGame, cardWatchApply, cardWatchSideEntry, cardWatchSideMeta, cardWatchPatchDiscards,
    cardWatchCleanMessage, cardWatchLiveList, CARD_WATCH_LIVE_FRESH_MS };`, ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const H = E.CARD_PVP_HIDDEN;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const pub = (st, p) => ({ life: st.players[p].mons.map((m) => `${m.life}${m.ko ? 'x' : ''}`).join(','), hand: st.players[p].hand.length, deck: st.players[p].deck.length, guts: st.players[p].guts.length, discard: st.players[p].discard.join(',') });
// ホスト(自分=0)の場と、見る人の場(side=0 ならホストが 0)を比べる
const same = (host, w, side) => {
  const a = side === 1 ? 1 : 0;
  return JSON.stringify(pub(host, 0)) === JSON.stringify(pub(w, a)) && JSON.stringify(pub(host, 1)) === JSON.stringify(pub(w, 1 - a))
    && host.turn === w.turn && host.phase === w.phase && (host.winner === null ? w.winner === null : w.winner === (side === 1 ? 1 - host.winner : host.winner));
};
// 知らせを JSON にして、受け取った側の掃除を通す(本物の通信と同じ)
const wire = (msg) => E.cardWatchCleanMessage(JSON.parse(JSON.stringify({ from: 'host', match: 'm1', ...msg })));

const who = ['mua', 'kiki', 'momosuke', 'dra', 'kyuko', 'atsu'];
// 61戦目から: どの札も出るように、3体で使える札(ブリーダー・全体カードを含む)から乱数で50枚を組み、手も半分は乱数で選ぶ(コンピューターが選ばない札も通るか見る)
const allMons = Object.values(db.monsters).filter((m) => m.ready !== false && !m.variant && !m.dexOnly);
const randomDeck = (r) => {
  const mons = [];
  while (mons.length < 3) { const m = allMons[Math.floor(r() * allMons.length)]; if (!mons.some((x) => x.species === m.species)) mons.push(m); }
  const pool = Object.values(db.cards).filter((c) => c.ready && (c.user === 'any' || c.user === 'breeder' || mons.some((m) => E.cardUsableBy(c, { ...m, ko: false }))));
  const cards = []; const named = {};
  for (let i = 0; cards.length < 50 && i < 5000; i++) { const c = pool[Math.floor(r() * pool.length)]; if ((named[c.name] || 0) < 3) { named[c.name] = (named[c.name] || 0) + 1; cards.push(c.no); } }
  return { monsters: mons.map((m) => m.no), cards };
};
let N = 0, okApply = 0, okSide = 0, okHidden = 0, okLate = 0, finished = 0, firstErr = '';
let skipped = 0;
const USED = new Set();
for (let n = 0; n < 200; n++) {
  N++;
  const r = rng(5000 + n);
  const lv = n < 30 ? 'normal' : 'master';
  const wild = n >= 60;
  const deckA = wild ? randomDeck(r) : E.cardAiBuildDeck(db, who[n % 6], lv), deckB = wild ? randomDeck(r) : E.cardAiBuildDeck(db, who[(n + 2) % 6], lv);
  if (wild && (E.cardDeckProblems(db, deckA).length || E.cardDeckProblems(db, deckB).length)) { N--; continue; }
  const firstA = n % 2;
  let A = E.cardPvpNewGame(db, { myDeck: deckA, mySeed: (n * 7919 + 13) >>> 0, foeMonsters: deckB.monsters, first: firstA, names: ['A', 'B'] });
  let B = E.cardPvpNewGame(db, { myDeck: deckB, mySeed: (n * 104729 + 7) >>> 0, foeMonsters: deckA.monsters, first: 1 - firstA, names: ['B', 'A'] });
  // ホストが流す meta(91 の begin と同じ形)
  const meta = { p: [{ name: 'A', mons: deckA.monsters, count: deckA.cards.length }, { name: 'B', mons: deckB.monsters, count: deckB.cards.length }], first: firstA, mode: 'private' };
  let W0 = E.cardWatchNewGame(db, E.cardWatchSideMeta(meta, 0));
  let W1 = E.cardWatchNewGame(db, E.cardWatchSideMeta(meta, 1));
  const log = [];
  const PUBLIC = new Set();
  let hostD = [[], []];
  const pol = E.cardAiPolicy('kyuko', 'easy');
  let steps = 0, err = '', sideErr = '', hiddenErr = '';
  while (A.winner === null && steps < 3000) {
    steps++;
    const aTurn = E.cardPvpDecider(A) === 0;
    const [me, foe] = aTurn ? [A, B] : [B, A];
    let act = E.cardAiChooseAction(db, me, pol, r);
    if (wild && r() < 0.5) { const legal = E.cardLegalActions(db, me); if (legal.length) act = E.cardAiFillBind(db, me, legal[Math.floor(r() * legal.length)], pol); }
    let next = act && E.cardApplyAction(db, me, act);
    if (!next) { act = E.cardPvpTimeoutAct(me); next = E.cardApplyAction(db, me, act); }
    if (!next) { err = `${steps}手目: 自分の手が進まない`; break; }
    const reveal = E.cardPvpRevealOf(me, act);
    const msg = E.cardPvpCleanMessage(JSON.parse(JSON.stringify({ t: 'act', from: 'x', seq: steps, act, reveal, discard: next.players[0].discard })));
    const other = E.cardPvpApplyRemote(db, foe, msg);
    if (!other) { err = 'skip'; break; } // 2台の対戦のほうで当てられない手(観戦の前の話。card-pvp-check.js の受け持ち)
    if (act.type === 'attack' || act.type === 'breeder' || act.type === 'guard') Object.values(reveal).forEach((no) => USED.add(no));
    const back = E.cardPvpPatchDiscard(db, next, other.players[0].discard);
    // ホストが流す1手(91 の watchPush と同じ: ホストの見え方の手・使った札・ホストの場の捨て札の並び)
    let entry;
    if (aTurn) { entry = { by: 0, act, reveal, d: [next.players[0].discard, next.players[1].discard] }; A = back; B = other; }
    else { entry = { by: 1, act: E.cardPvpFlip(act), reveal: msg.reveal, d: [other.players[0].discard, other.players[1].discard] }; B = back; A = other; }
    log.push(entry);
    hostD = [A.players[0].discard.slice(), A.players[1].discard.slice()]; // 受け取ったの知らせで分かった相手の捨て札(hb の d)
    const got = wire({ t: 'w-act', n: log.length, e: entry });
    if (!got) { err = `${steps}手目: 流した手が掃除で捨てられた`; break; }
    const next0 = E.cardWatchApply(db, W0, E.cardWatchSideEntry(got.e, 0));
    const next1 = E.cardWatchApply(db, W1, E.cardWatchSideEntry(got.e, 1));
    if (!next0) { err = `${steps}手目: 見る人の場に手を当てられない(${act.type})`; break; }
    if (!next1) { sideErr = sideErr || `${steps}手目: 入れ替えた見る人の場に当てられない(${act.type})`; break; }
    const hb = wire({ t: 'w-hb', n: log.length, eyes: 1, meta, d: hostD, end: null });
    W0 = E.cardWatchPatchDiscards(db, next0, hb.d);
    W1 = E.cardWatchPatchDiscards(db, next1, [hb.d[1], hb.d[0]]);
    if (!same(A, W0, 0)) { err = `${steps}手目: 見る人の場がホストと食い違った ${JSON.stringify([pub(A, 0), pub(W0, 0), pub(A, 1), pub(W0, 1)])}`; break; }
    if (!same(A, W1, 1)) { sideErr = sideErr || `${steps}手目: 入れ替えた見る人の場が食い違った`; break; }
    // 山札は全部仮の札。手札・ガッツの本物の札は、流れてきた知らせ(使った札・見せた手札・捨て札の並び)に出た札だけ(捨て札から手札へ戻した札など)
    entry.reveal && Object.values(entry.reveal).forEach((no) => PUBLIC.add(no)); entry.d.concat(hostD).flat().forEach((no) => PUBLIC.add(no));
    const leak = [W0, W1].some((w) => w.players.some((pl) => pl.deck.some((no) => no !== H) || pl.hand.concat(pl.guts).some((no) => no !== H && !PUBLIC.has(no))));
    if (leak && !hiddenErr) hiddenErr = `${steps}手目: 見る人の場に本物の札が残った(${act.type})`;
  }
  if (err === 'skip') { skipped++; N--; continue; }
  if (A.winner !== null) finished++;
  if (!err) okApply++; else if (!firstErr) firstErr = `${n}戦目: ${err}`;
  if (!err && !sideErr) okSide++; else if (sideErr && !firstErr) firstErr = `${n}戦目: ${sideErr}`;
  if (!hiddenErr) okHidden++; else if (!firstErr) firstErr = `${n}戦目: ${hiddenErr}`;
  // ④ 途中から見る人: 試合の半分まで来たところで入り、はじめからの手を150手ずつもらってなぞる
  if (!err) {
    let L = E.cardWatchNewGame(db, E.cardWatchSideMeta(meta, 0));
    let ok = true;
    for (let k = 0; k < log.length && ok; k += 150) {
      const chunk = wire({ t: 'w-log', start: k, list: log.slice(k, k + 150) });
      if (!chunk) { ok = false; break; }
      for (const e of chunk.list) { const nx = E.cardWatchApply(db, L, e); if (!nx) { ok = false; break; } L = nx; }
    }
    if (ok) L = E.cardWatchPatchDiscards(db, L, hostD);
    if (ok && same(A, L, 0)) okLate++; else if (!firstErr) firstErr = `${n}戦目: 途中から見る人の場が合わない`;
  }
}
console.log(`(乱数のデッキの試合のうち、2台の対戦のほうで手が当てられず数えなかった試合: ${skipped}戦・使われた札 ${USED.size}種)`);
check(`① 流れてきた手がいつも当てられ、見る人の場がホストと同じ(${okApply}/${N}戦・最後まで${finished}戦)`, okApply === N && finished === N, firstErr);
check(`② フレンドが相手側でも(下に出す人を入れ替えても)同じ(${okSide}/${N}戦)`, okSide === N);
check(`③ 見る人の場の山札は全部仮の札・手札とガッツの本物の札は、流れた知らせに出た札だけ(${okHidden}/${N}戦)`, okHidden === N);
check(`④ 途中から見る人も、はじめからの手をまとめてもらって同じ場になる(${okLate}/${N}戦)`, okLate === N);

// ③ 流す知らせの形: 手札・山札・封(seed・salt)・デッキの中身の項目が無い
{
  const src = read('src/parts/92-card-pvp-watch.jsx');
  const host = src.split('// ---- 対戦する側')[1].split('// ---- 見る側')[0];
  const bad = ['hand:', 'deck:', 'seed', 'salt', 'cards:', '.st'].filter((k) => new RegExp(`send(Watch|Live)\\(\\{[^}]*${k.replace('.', '\\.')}`).test(host));
  check('③ ホストが流す知らせに、手札・山札・封・デッキの中身・場そのものが入っていない', bad.length === 0, bad.join(' '));
  const pvp = read('src/parts/91-card-battle-multi.jsx');
  check('③ 91 から観戦へ渡すのは、手・使った札・捨て札の並び・番だけ', /const watchPush = \(by, act, reveal, st\) => \{ if \(isHost\(\)\) cardPvpWatchHost\(\)\.push\(\{ by, act, reveal, turn: st\.turn, d: \[st\.players\[0\]\.discard, st\.players\[1\]\.discard\] \}\); \};/.test(pvp));
}
// ⑤ 掃除
{
  const ok1 = wire({ t: 'w-act', n: 3, e: { by: 0, act: { type: 'pass' }, reveal: { 0: '061' }, d: [['061', -1], []] } });
  check('⑤ 正しい1手は通る(仮の札の -1 も捨て札に残す)', ok1 && ok1.e.d[0][1] === -1 && ok1.e.reveal[0] === '061');
  check('⑤ 知らない手・番号の形が違う札・大きすぎる番号は捨てる', !wire({ t: 'w-act', n: 3, e: { by: 0, act: { type: 'hack' } } }) && !wire({ t: 'w-act', n: 3, e: { by: 2, act: { type: 'pass' } } })
    && wire({ t: 'w-act', n: 3, e: { by: 0, act: { type: 'pass' }, reveal: { 0: '<script>' } } }).e.reveal[0] === undefined && !wire({ t: 'w-act', n: 99999, e: { by: 0, act: { type: 'pass' } } }));
  check('⑤ 知らない知らせは捨てる・見る人の「見ています」は数だけ', !wire({ t: 'act', act: { type: 'pass' } }) && wire({ t: 'w-eye', need: 5 }).need === 5 && wire({ t: 'w-eye', need: 'x' }).need === null);
  const hb = wire({ t: 'w-hb', n: 4, eyes: 2, meta: { p: [{ name: 'A', mons: ['C-001', 'C-003', 'C-005'], count: 50, hand: ['061'] }, { name: 'B', mons: ['C-001', 'C-003', 'C-005'], count: 50 }], first: 1, seed: 5 }, d: [[], []], end: { winner: 1, reason: '投了' } });
  check('⑤ hb の meta は名前・アイコン・3体・枚数だけ残す(余計な項目は捨てる)', hb && hb.meta && hb.meta.first === 1 && !('hand' in hb.meta.p[0]) && !('seed' in hb.meta) && hb.end.winner === 1);
}
// ⑥ 一覧
{
  const now = 100000;
  const seen = { a: { match: 'a', p: [{ bid: 'x' }, { bid: 'y' }], eyes: 0, at: now, seen: now }, b: { match: 'b', p: [{ bid: 'f' }, { bid: 'z' }], eyes: 0, at: now, seen: now },
    c: { match: 'c', p: [{ bid: 'q' }, { bid: 'f2' }], eyes: 5, at: now, seen: now }, d: { match: 'd', p: [{ bid: 'f' }, { bid: 'w' }], eyes: 0, at: now, seen: now - E.CARD_WATCH_LIVE_FRESH_MS - 1 } };
  const list = E.cardWatchLiveList(seen, now, new Set(['f', 'f2']));
  check('⑥ フレンドの試合が先・古い知らせは消える・フレンドがどちら側かが分かる', list.map((x) => x.match).join() === 'c,b,a' && list[0].friend === 1 && list[1].friend === 0 && list[2].friend === -1);
}
console.log(failed ? `\nNG が ${failed} 件あります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
