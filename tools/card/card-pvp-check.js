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
  + `${multi}\n;\nthis.E = { CARD_BATTLE_DATA, cardCreateGame, cardLegalActions, cardAiFillBind, cardAiChooseAction, cardAiPolicy, cardAiBuildDeck, cardDecider, cardClone, cardApplyAction, CARD_PVP_HIDDEN,
    cardPvpFlip, cardPvpRevealOf, cardPvpNewGame, cardPvpApplyRemote, cardPvpPatchDiscard, cardPvpSealText, cardPvpSha256, cardPvpTruthGame, cardPvpVerify, cardPvpCleanMessage, cardPvpCleanAct,
    cardPvpReward, cardUsableBy, cardPvpTimeoutAct, cardPvpLimitMs, cardPvpClockKey, cardPvpDecider, cardPvpNormalizePenalty, CARD_PVP_STAMPS, CARD_PVP_TURN_MS, CARD_PVP_GUARD_MS, CARD_PVP_RESULT_LINES, cardPvpResultLine, cardCpuReward, cardCpuLoops, CARD_AI_LEVELS };`, ctx);
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

// 準備中だった札(区切りごとに足す。一覧 docs/progress/card-battle/pending-83/README.md)
const PENDING_DONE = ['034', '210', '060', '236', '109',
  '121', '124', '330', '345', '343', '347', '274', '349', '366', '362', '363', '346', '276', '342', '009', '070', '209',
  '250', '254', '351', '234', '294', '083', '197', '046', '365', '057', '269', '010', '273', '047', '251',
  '114', '122', '125', '126', '127', '137', '149', '186', '252', '253', '278', '279', '303', '304', '306', '364', '022', '094',
  '107', '111', '123', '163', '275', '270', '318', '198', '249', '185', '293',
  '178', '214', '285', '286', '227', '288', '340', '054', '358', '361', '150',
  '128', '221', '222', '352', '348'];
// 付ける札は、準備中だった札だけ入れる(ほかの付ける札まで入れると、技が足りなくなる)
const usable = (c, mons) => c && c.ready && (PENDING_DONE.includes(c.no) || !(c.effects || []).some((e) => e.t === 'attach'))
  && (c.user === 'any' || c.user === 'breeder' || mons.some((m) => c.user === m.species || E.cardUsableBy(c, m)));
// 試合でまず起きない条件の札(山札0で付ける劇的な幕切れ)は、card-rules-check の場面だけで確かめる
// みんな下がれ・我慢は、相手が全員に当たる技・ガッツを減らす技を出した場面だけ。試合の流れで出会わないことがある(相手に隠す中身を動かさない守りなので、マルチで食い違う心配は小さい。効き目は card-rules-check で1枚ずつ確かめる)
const PENDING_RARE = ['124', '250', '127', '123', '275']; // 劇的な幕切れ(山札0)・孤軍奮闘・最後のきらめき(味方が1体)・みんな下がれ・我慢
const USED_SO_FAR = new Set();
const monOf = (sp) => Object.values(db.monsters).filter((m) => m.species === sp && !m.main).map((m) => m.no).sort()[0];
// その3体で使える準備中だった札を3枚ずつ入れ、残りはその3体で使える札を3枚ずつ順に足して50枚にする
const pendingDeck = (monsters, must = [], onlyMust = false) => {
  const mons = monsters.map((no) => db.monsters[no]);
  const cards = [];
  must.forEach((no) => cards.push(no, no, no)); // 追加の試合で、まだ使われていない札と、付ける先の技を必ず3枚ずつ入れる
  // 種族専用の札は3枚、誰でも・ブリーダーの札は1枚ずつ。準備中だった札は30枚まで(種族専用の札が先)(付ける札ばかりだと、付ける先の技が足りない)
  // onlyMust … 目当ての札だけを入れる(太古の記憶のように、2枚がそろわないと出せない札の追加の試合)
  // 全体カード・おいのりは、目当ての試合(must)だけに入れる(ほかの試合に混ざると、がんじがらめなどで目当ての札が出せなくなる)
  const mineP = onlyMust ? [] : PENDING_DONE.filter((no) => usable(db.cards[no], mons) && no !== '280');
  mineP.filter((no) => !must.includes(no) && !['any', 'breeder'].includes(db.cards[no].user)).forEach((no) => cards.push(no, no, no));
  mineP.filter((no) => !must.includes(no) && ['any', 'breeder'].includes(db.cards[no].user)).forEach((no) => cards.push(no));
  cards.splice(30);
  // 残りは、3体それぞれの札と誰でも使える札を、1種ずつ順に(番号の順だけで埋めると、最初の種族の札ばかりになる)
  // 派生(混血)の子は、メイン・サブの種族の札を使う(子の種族名そのものの札は無い)
  const lanes = [...new Set(mons.flatMap((m) => (m.main ? [m.main, m.sub].filter(Boolean) : [m.species]))), 'any'].map((sp) => Object.values(db.cards).filter((c) => usable(c, mons) && !PENDING_DONE.includes(c.no) && c.kind !== 'fld' && c.no !== '280' && (sp === 'any' ? c.user === 'any' || c.user === 'breeder' : c.user === sp)).map((c) => c.no).sort());
  const rest = [];
  for (let k = 0; lanes.some((l) => k < l.length); k++) lanes.forEach((l) => { if (k < l.length) rest.push(l[k]); });
  // 同じ名前は3枚まで(番号の違う同じ名前の札もある)
  const named = (no) => cards.filter((x) => db.cards[x].name === db.cards[no].name).length;
  for (let i = 0; cards.length < 50 && i < 5000; i++) { const no = rest[i % rest.length]; if (named(no) < 3) cards.push(no); }
  return { monsters, cards };
};

// 1戦: 2台(A・B)。A から見た first、B から見た first は反対
const play = (n, extraTrio, must, extraB, onlyMust) => {
  const r = rng(1000 + n);
  const who = ['mua', 'kiki', 'momosuke', 'dra', 'kyuko', 'atsu'];
  // 後半の20戦は MASTER のデッキ(全部の弾)。準備中だった札(台帳 #141)も、マルチで当てられるかを見る
  //   28戦目からの24戦は、その札を使える3体で、その札を必ず入れたデッキ(助手のデッキに入らない種族の札もあるため)
  const lv = n < 20 ? 'normal' : 'master';
  //   3体の組は3通り(準備中だった札の持ち主の種族がそろうように)
  const trio = extraTrio || (n < 34 ? [['C-003', 'C-027', 'C-029'], ['C-005', 'C-001', 'C-003']]
    : n < 43 ? [[monOf('centaur'), monOf('colorpandora'), monOf('dino')], [monOf('naga'), monOf('tiger'), monOf('plant')]]
    : [[monOf('metalner'), monOf('mew'), monOf('suezo')], [monOf('mocchi'), monOf('zilla'), monOf('dragon')]]);
  const forced = n >= 28 || !!extraTrio;
  const deckA = forced ? pendingDeck(trio[0], must, !!onlyMust) : E.cardAiBuildDeck(db, who[n % 6], lv);
  const deckB = extraB ? pendingDeck(trio[1], extraB.must) : forced ? pendingDeck(trio[1]) : E.cardAiBuildDeck(db, who[(n + 3) % 6], lv);
  const seedA = (n * 7919 + 13) >>> 0, seedB = (n * 104729 + 7) >>> 0;
  const firstA = n % 2;
  let A = E.cardPvpNewGame(db, { myDeck: deckA, mySeed: seedA, foeMonsters: deckB.monsters, first: firstA, names: ['A', 'B'] });
  let B = E.cardPvpNewGame(db, { myDeck: deckB, mySeed: seedB, foeMonsters: deckA.monsters, first: 1 - firstA, names: ['B', 'A'] });
  const hA = [], hB = [], usedNos = [];
  const pol = E.cardAiPolicy('kyuko', 'easy');
  let steps = 0, err = '';
  while (A.winner === null && steps < 3000) {
    steps++;
    const aTurn = decider(A) === 0;
    const [me, foe] = aTurn ? [A, B] : [B, A];
    if (decider(foe) !== 1) { err = `${steps}手目: 2台で番が食い違った`; break; }
    let act = E.cardAiChooseAction(db, me, pol, r);
    // 28戦目から: 準備中だった札を使える場面なら、その札を選ぶ(コンピューターが選ばない札も、マルチで通るか見るため)
    // 追加の試合の相手(B)は攻撃しない(まだ使われていない札の持ち主が先に倒れないように。守りはふつうに出す)
    if (extraTrio && !(extraB && extraB.attack) && !aTurn && me.phase === 'main' && !me.pending && !me.pendingDiscard && !me.pendingPray) act = { type: 'endAttacks' };
    else if (forced) {
      const noOf = (a) => (a.type === 'guard' ? [me.players[0].hand[a.hand]] : Array.isArray(a.hand) ? a.hand.map((i) => me.players[0].hand[i]) : []);
      // まだどの試合でも使っていない札を含む手を先に(影縛りには名指しを入れる)
      const legal = E.cardLegalActions(db, me).filter((a) => noOf(a).some((no) => PENDING_DONE.includes(no) || (extraB && extraB.must.includes(no))));
      // 追加の試合の相手は、入れた札(全員に当たる技など)を最初に使う
      const notLead = (a) => !(extraB && extraB.avoidLead && !aTurn && a.target && a.target.m === 0);
      const pick = (extraB && extraB.avoidLead && !aTurn && E.cardLegalActions(db, me).find((a) => (a.type === 'attack') && a.target && a.target.p === 1 && a.target.m !== 0)) || (extraB && legal.find((a) => notLead(a) && noOf(a).some((no) => extraB.must.includes(no)))) || legal.find((a) => noOf(a).some((no) => PENDING_DONE.includes(no) && !USED_SO_FAR.has(no))) || legal[0];
      if (pick) act = E.cardAiFillBind(db, me, pick, pol);
    }
    let next = act && E.cardApplyAction(db, me, act);
    if (next && (act.type === 'attack' || act.type === 'breeder')) usedNos.push(...act.hand.map((i) => me.players[0].hand[i]));
    if (next && act.type === 'guard') usedNos.push(me.players[0].hand[act.hand]);
    usedNos.forEach((no) => USED_SO_FAR.add(no));
    if (!next) { act = E.cardPvpTimeoutAct(me); next = E.cardApplyAction(db, me, act); }
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
  return { A, B, hA, hB, deckA, deckB, seedA, seedB, firstA, steps, err, usedNos };
};

let N = 52;
let applyOk = 0, winOk = 0, hiddenOk = 0, verifyOk = 0, finished = 0, firstErr = '';
const games = [];
const runOne = (n, extraTrio, must, extraB, onlyMust) => {
  const g = play(n, extraTrio, must, extraB, onlyMust);
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
};
for (let n = 0; n < N; n++) runOne(n);
// まだ使われていない準備中だった札があれば、その札を使える3体で追加の試合(1枚につき5戦まで。場の組み合わせが要る札は10戦まで・全部で80戦まで)。追加の試合も①〜④に数える
{
  const usedNow = () => new Set(games.flatMap((x) => x.usedNos));
  const left = () => PENDING_DONE.filter((no) => !PENDING_RARE.includes(no) && !usedNow().has(no));
  let extra = 0;
  for (const no of left()) {
    const c = db.cards[no];
    const own = ['any', 'breeder'].includes(c.user) ? null : monOf(c.user);
    // 全員に当たる技に付ける札は、全員に当たる技を持つコロペンドラと
    const needArea = (c.effects || []).some((e) => e.t === 'attach' && e.when && e.when.area);
    const lead = own || (needArea ? monOf('colorpandora') : 'C-003');
    let trioA = [lead, ...['C-003', 'C-001', 'C-005'].filter((x) => x !== lead)].slice(0, 3);
    // 場の組み合わせが要る札(区切り7): ヒノトリの復活はヒノトリを、合体は混血になる2体を、太古の記憶は混血の子を並べる
    const special = [];
    if ((c.effects || []).some((e) => e.t === 'revive')) trioA = [monOf('phoenix'), 'C-003', 'C-001'];
    if ((c.effects || []).some((e) => e.t === 'fuse')) { const hy = db.monsters['C-051']; trioA = [monOf(hy.main), monOf(hy.sub), 'C-005']; }
    if ((c.effects || []).some((e) => e.t === 'ancient')) {
      const ok2 = (x) => x.ready && x.kind === 'spe' && !(x.effects || []).some((e) => ['attach', 'choose', 'peekPick', 'useWhenAllies', 'emerge', 'cocoon', 'extraAttackTarget', 'unstunTarget', 'heal', 'selfHurt', 'revive', 'lastWish'].includes(e.t));
      const hy = Object.values(db.monsters).filter((m) => m.main && Object.values(db.cards).some((x) => ok2(x) && x.user === m.sub)).sort((a, b) => (a.no < b.no ? -1 : 1))[0];
      trioA = [hy.no, 'C-003', 'C-001'];
      special.push(Object.values(db.cards).filter((x) => ok2(x) && x.user === hy.sub).sort((a, b) => a.guts - b.guts)[0].no);
    }
    // 付ける札は、付ける先の技(先頭の子の、文の無いちから技)も3枚入れる
    const isAttach = (c.effects || []).some((e) => e.t === 'attach') && !needArea;
    const leadSp = db.monsters[lead].species;
    const baseAtk = isAttach ? Object.values(db.cards).filter((x) => x.ready && x.user === leadSp && x.kind === 'pow' && !(x.effects || []).length).map((x) => x.no).sort()[0] : null;
    // 捨て札から回避の札を選ぶ札(回避プログラム)は、その子が使える回避の札も3枚入れる
    const ch = (c.effects || []).find((e) => e.t === 'choose');
    const dgeCard = ch && ch.filter && ch.filter.kind === 'dge' ? Object.values(db.cards).filter((x) => x.ready && x.kind === 'dge' && x.user === leadSp && !PENDING_DONE.includes(x.no)).map((x) => x.no).sort()[0] : null;
    const areaCard = needArea ? Object.values(db.cards).filter((x) => x.ready && x.user === db.monsters[lead].species && (x.effects || []).some((e) => e.t === 'area' && e.who === 'enemies')).map((x) => x.no).sort()[0] : null;
    // 守りの札は、相手(B)に攻撃させる。みんな下がれ・我慢は、相手のデッキに全員に当たる技・ガッツを減らす技も入れる
    const isGuard = ['dge', 'blk'].includes(c.kind) || (c.effects || []).some((e) => e.t === 'revive'); // ヒノトリの復活も、相手に攻撃させる(倒れる場面が要る)
    const bMons = ['C-001', 'C-003', 'C-005'];
    const bNeed = (pred) => Object.values(db.cards).filter((x) => x.ready && ['pow', 'int'].includes(x.kind) && bMons.some((m) => db.monsters[m].species === x.user) && pred(x)).sort((a, b) => a.guts - b.guts || (a.no < b.no ? -1 : 1)).map((x) => x.no)[0]; // いちばん安い技
    const bMust = (c.effects || []).some((e) => e.t === 'evadeAll') ? [bNeed((x) => (x.effects || []).some((e) => e.t === 'area'))]
      : (c.effects || []).some((e) => e.t === 'noGutsLoss') ? [bNeed((x) => (x.effects || []).some((e) => e.t === 'gutsLossOnHit'))] : [];
    // 盾になる・吹き上げる(ほかの子が狙われたときに出す守り)は、相手が先頭の子(カードの持ち主)以外を狙う
    const avoidLead = (c.effects || []).some((e) => e.t === 'shield' || e.t === 'liftAllies' || e.t === 'cover');
    // 夏美草(攻撃できない子を攻撃できるようにする)は、相手に「当たると次のターン攻撃できない」技を持たせて攻撃させる(その場面が来ないと出せない)
    const unstun = (c.effects || []).some((e) => e.t === 'unstunTarget');
    const extraB = isGuard ? { attack: true, must: bMust.filter(Boolean), avoidLead } : unstun ? { attack: true, must: [bNeed((x) => (x.effects || []).some((e) => e.t === 'stunOnHit'))].filter(Boolean) } : null;
    // 盾になる・吹き上げる など、ほかの子が狙われたときに出す守りは、先頭の子をカードの持ち主にして、ほかの2体も並べる
    // 出せる場面が来にくい札(ガッツ6以上の重い技・攻撃できない子がいるときだけ出せる札)は15戦まで
    //   (2026-10-27 意味不明(277)が効くようになって試合の流れが変わり、魔神ファイナル(358)・夏美草(351)が5戦では出なくなった。ナガメくん)
    const hard = (c.guts || 0) >= 6 || (c.effects || []).some((e) => e.t === 'unstunTarget');
    for (let k = 0; k < (hard ? 15 : special.length ? 10 : 5) && extra < 80 && !usedNow().has(no); k++, extra++) { runOne(N + extra, [trioA, bMons], [no, ...special, ...(areaCard ? [areaCard] : []), ...(baseAtk ? [baseAtk] : []), ...(dgeCard ? [dgeCard] : [])], extraB, special.length > 0); }
  }
  N += extra;
}
// 派生(混血)のモンスターも全員、マルチの場がずれないか(2026-10-25 統括部長の公開前の確認)。派生を3体ずつ組にし、相手はふつうの3体。追加の試合も①〜④に数える
// キラ・別絵キラ(variant)は同じ種族なので入れない(同じ組に入ると「同じモンスターが2体」のデッキになる。剣士モッチーのキラ C-066S など)
const hybrids = Object.values(db.monsters).filter((m) => m.main && m.ready !== false && !m.variant && !m.dexOnly).map((m) => m.no).sort();
{
  let k = 0;
  // 3体ずつの組に、同じ子(キラ・別絵キラ。剣士モッチー C-066・C-066S・C-066V は species が同じ)を入れない。
  //   番号順に3つずつ切ると C-065・C-066・C-066S が同じ組になり、「同じモンスターが2体」でデッキの決まりに合わなかった(2026-10-26)
  const trios = [];
  hybrids.forEach((no) => {
    const sp = db.monsters[no].species;
    const t = trios.find((x) => x.length < 3 && !x.some((y) => db.monsters[y].species === sp));
    if (t) t.push(no); else trios.push([no]);
  });
  for (const trio of trios) {
    ['C-003', 'C-001', 'C-005'].forEach((x) => { if (trio.length < 3) trio.push(x); });
    runOne(N + k, [trio, ['C-005', 'C-001', 'C-003']]); k++;
    runOne(N + k, [['C-005', 'C-001', 'C-003'], trio]); k++; // 後攻・相手側でも
  }
  N += k;
}
// 全体カード15枚とおいのり(2026-10-25)。場の札・おいのりの窓・大混乱(山札を捨てる)・灼熱の地などで、2台の場がずれないか。追加の試合も①〜④に数える
const fieldNos = Object.keys(db.cards).filter((no) => db.cards[no].kind === 'fld').sort();
const fieldSeen = new Set(); let prayUsed = 0;
{
  let k = 0;
  for (let i = 0; i < fieldNos.length; i += 2) {
    const must = [...fieldNos.slice(i, i + 2), '280'];
    for (const side of [0, 1]) {
      const n0 = N + k;
      runOne(n0, side ? [['C-005', 'C-001', 'C-003'], ['C-003', 'C-027', 'C-029']] : [['C-003', 'C-027', 'C-029'], ['C-005', 'C-001', 'C-003']], must, { attack: true, must });
      const g = games[games.length - 1];
      g.hA.forEach((e) => { if (e.act && e.act.type === 'pray' && e.act.hand) prayUsed++; });
      [g.A, g.B].forEach((st) => (st.log || []).forEach((l) => { const m = /全体カード「([^」]+)」が場に出た/.exec(l.text); if (m) fieldSeen.add(m[1]); }));
      k++;
    }
  }
  // まだ場に出ていない全体カードは、その札だけを入れた試合を足す(1枚につき4戦まで)。出るかどうかは助手の見積もりしだいなので、目当ての札を出す手を選ばせる
  for (const no of fieldNos.filter((x) => !fieldSeen.has(db.cards[x].name))) {
    for (let t = 0; t < 4 && !fieldSeen.has(db.cards[no].name); t++) {
      runOne(N + k, [['C-003', 'C-027', 'C-029'], ['C-005', 'C-001', 'C-003']], [no, '280'], { attack: true, must: [no, '280'] });
      const g = games[games.length - 1];
      g.hA.forEach((e) => { if (e.act && e.act.type === 'pray' && e.act.hand) prayUsed++; });
      [g.A, g.B].forEach((st) => (st.log || []).forEach((l) => { const m = /全体カード「([^」]+)」が場に出た/.exec(l.text); if (m) fieldSeen.add(m[1]); }));
      k++;
    }
  }
  N += k;
}
check(`① 全体カード${fieldNos.length}枚が、マルチの試合で場に出ている`, fieldSeen.size === fieldNos.length, `${fieldSeen.size} / ${fieldNos.length}・まだ ${fieldNos.filter((no) => !fieldSeen.has(db.cards[no].name)).join('・')}`);
check('① おいのりが、マルチの試合で使われている', prayUsed > 0, `${prayUsed}回`);
const hyUsed = new Set(games.flatMap((g) => [...g.deckA.monsters, ...g.deckB.monsters]).filter((no) => hybrids.includes(no)));
check(`① 派生のモンスター${hybrids.length}体が全員、マルチの試合に出ている`, hyUsed.size === hybrids.length, `${hyUsed.size} / ${hybrids.length}`);
check(`① ${N}戦とも、届いた手を当てられて、2台の場がずっと同じ`, applyOk === N, firstErr);
check(`② ${N}戦とも最後まで決着して、勝ち負けが合う`, finished === N && winOk === N, `決着 ${finished} / 合う ${winOk}`);
check('③ 相手の手札・山札は、最後まで仮の札のまま(本物の番号が入らない)', hiddenOk === N, `${hiddenOk} / ${N}`);
check('④ 終わってから封を開けてなぞり直すと、両方で合っている', verifyOk === N, `${verifyOk} / ${N}`);
// 準備中だった札が、52戦のどこかで使われて、①〜④が通っていること
const usedAll = new Set(games.flatMap((x) => x.usedNos));
const wantNew = PENDING_DONE.filter((no) => !PENDING_RARE.includes(no));
const usedNew = wantNew.filter((no) => usedAll.has(no));
check('④ 準備中だった札も、マルチの試合で使われて当てられる(全部)', usedNew.length === wantNew.length, `使われた ${usedNew.length} / ${wantNew.length}枚・まだ ${wantNew.filter((no) => !usedAll.has(no)).join('・') || 'なし'}`);

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
  // 2026-10-26 社長: 勝ちは MASTER の2倍(400・44周)、負けと投了は MASTER と同じ(負けは勝ちの 3/4 = 150・自分の番10回で16周)
  // 2026-10-27 社長: マルチはさらに2倍(勝ち 800・88周 / 負け 300・32周。端数の出方は2倍前のまま)
  check('⑦ 勝ち 800・88周 / 負け 300・32周(ビートPも周回も自分の番10回で満額)', eq(R('win', { ownTurns: 12, kos: 3 }), [800, 88]) && eq(R('lose', { ownTurns: 10, kos: 0 }), [300, 32]) && eq(R('lose', { ownTurns: 5, kos: 0 }), [150, 16]) && eq(R('lose', { ownTurns: 3, kos: 0 }), [90, 8]) && eq(R('surrender', { ownTurns: 3, kos: 3 }), [60, 32]));
  check('⑦ 勝ちは MASTER の4倍・負けと投了は MASTER の2倍になる(マルチだけ2倍)', ['lose', 'surrender'].every((o) => [[10, 0], [5, 1], [8, 2], [12, 3]].every(([t, k]) => { const f = { ownTurns: t, kos: k }; return R(o, f).point === E.cardCpuReward({ cpuPoint: 0, firstWin: true }, 'master', o, f).base * 2 && R(o, f).loops === E.cardCpuLoops('master', o, f) * 2; }))
    && R('win', { ownTurns: 10, kos: 3 }).point === E.CARD_AI_LEVELS.master.point * 4 && R('win', { ownTurns: 10, kos: 3 }).loops === E.CARD_AI_LEVELS.master.loops * 4);
  check('⑦ 投了は倒した数で決める・自分の番が3回より前に終わったら0', eq(R('surrender', { ownTurns: 8, kos: 2 }), [40, 22]) && eq(R('win', { ownTurns: 2, kos: 3 }), [0, 0]) && R('win', { ownTurns: 2, kos: 3 }).short === true);
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
  // みゅあは「じゃん」「まじ」を崩して「ぢゃん」「まぢ」と書く(社長 2026-10-25。docs/spec/ASSISTANT_MUA_VOICE.md)
  check('⑧ みゅあは「じゃん」「まじ」を使わない(「ぢゃん」「まぢ」と崩す)・半角の \' を使わない', all.filter((x) => x.id === 'mua').every((x) => !/じゃん(?!け)|まじ(?![めなり])|'/.test(x.t)));
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
  // デバッグの合言葉を入れた端末でも、HOME の入口から遊んだ分はランキングへ送る(2026-10-26 社長「ふつうの入口の対戦はのせる」)。
  // 外すのはデバッグ設定の入口から入った対戦だけ(84 の debug = cardOrigin==='debug')
  const p60 = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'src', 'parts', '60-app.jsx'), 'utf8');
  check('⑨ ランキングへ送るかは公開の印だけで決め、合言葉の端末をまるごと外さない(デバッグ設定の入口は 84 の debug で外す)',
    /rank=\{\{send:EVENT_REPLAY_RELEASE_FLAGS\.cardBattle===true,/.test(p60) && /debug=\{cardOrigin==='debug'\}/.test(p60) && /const rankable = !!\(rank && rank\.send\) && !debug;/.test(p84));
  // ⑩ 捨て札から選ぶ段(2026-10-27 総点検D): 相手が「回避プログラム」(186・ガッツ1)を使い、払ったガッツの札が回避カードのとき、
  //   受ける側では払った札が仮の札のまま候補が作られ、候補が1枚少なくなって、相手が選んだ手をはねて試合が止まっていた
  [['186', (c, m) => c.kind === 'dge' && E.cardUsableBy(c, m)], ['303', (c, m) => ['pow', 'int'].includes(c.kind) && E.cardUsableBy(c, m)], ['303', (c, m) => ['pow', 'int'].includes(c.kind) && E.cardUsableBy(c, m), 'F256']].forEach(([no, fit, field]) => {
    const H = E.CARD_PVP_HIDDEN;
    const mon = Object.values(db.monsters).find((m) => m.species === db.cards[no].user && !m.main).no;
    const dA = { monsters: [mon, 'C-003', 'C-005'], cards: Array(50).fill('100') }, dB = { monsters: ['C-001', 'C-003', 'C-009'], cards: Array(50).fill('100') };
    const A = E.cardPvpNewGame(db, { myDeck: dA, mySeed: 1, foeMonsters: dB.monsters, first: 0, names: ['A', 'B'] });
    const B = E.cardPvpNewGame(db, { myDeck: dB, mySeed: 2, foeMonsters: dA.monsters, first: 1, names: ['B', 'A'] });
    const good = Object.values(db.cards).find((c) => c.ready && fit(c, A.players[0].mons[0]));
    [A, B].forEach((s0, i) => { s0.phase = 'main'; s0.turn = 1; s0.active = i; if (field) s0.field = { no: field, p: 1 - i, effects: db.cards[field].effects.map((e) => ({ ...e })) }; }); // 師匠のまなざし(ガッツ+1)で、悪夢(ガッツ0)も1枚払う(ナガメくんが見つけた形)
    A.players[0].hand = [no]; A.players[0].guts = Array(Math.max(1, db.cards[no].guts) + (field ? 1 : 0)).fill(good.no); A.players[0].discard = ['100', good.no];
    B.players[1].hand = [H]; B.players[1].guts = Array(Math.max(1, db.cards[no].guts) + (field ? 1 : 0)).fill(H); B.players[1].discard = ['100', good.no];
    const send = (from, to, act, seq) => { const n = E.cardApplyAction(db, from, act); return [n, n && E.cardPvpApplyRemote(db, to, E.cardPvpCleanMessage(JSON.parse(JSON.stringify({ t: 'act', from: 'x', seq, act, reveal: E.cardPvpRevealOf(from, act), discard: n.players[0].discard }))))]; };
    const o = E.cardLegalActions(db, A).find((a) => a.type === 'attack' && a.hand.length === 1);
    if (!o) return check(`⑩ ${no}: 場面が作れる`, false);
    const [A2, B2] = send(A, B, o, 1);
    check(`⑩ ${no}「${db.cards[no].name}」${field ? '+師匠のまなざし' : ''}: 選ぶ段の候補が2台で同じ(払ったガッツの札も入る)`, !!B2 && JSON.stringify(A2.pendingChoice.cands) === JSON.stringify(B2.pendingChoice && B2.pendingChoice.cands),
      `${JSON.stringify(A2.pendingChoice.cands)} / ${JSON.stringify(B2 && B2.pendingChoice && B2.pendingChoice.cands)}`);
    const pick = A2.pendingChoice.cands[A2.pendingChoice.cands.length - 1];
    const [A3, B3] = send(A2, B2, { type: 'choose', pick }, 2);
    check(`⑩ ${no}「${db.cards[no].name}」${field ? '+師匠のまなざし' : ''}: 払ったガッツの札を選んでも、相手の端末で当てられる`, !!B3 && same(A3, B3));
  });
  // ⑪ カード投げ(169・2026-10-27 総点検D): 手の「捨てる手札(toss)」が知らせの掃除で落ちて、受ける側で必ずはねて試合が止まっていた。0枚・2枚とも
  [[], [1, 2]].forEach((toss) => {
    const H = E.CARD_PVP_HIDDEN;
    const mon = Object.values(db.monsters).find((m) => m.species === db.cards['169'].user && !m.main).no;
    const dA = { monsters: [mon, 'C-003', 'C-005'], cards: Array(50).fill('100') }, dB = { monsters: ['C-001', 'C-003', 'C-009'], cards: Array(50).fill('100') };
    const A = E.cardPvpNewGame(db, { myDeck: dA, mySeed: 1, foeMonsters: dB.monsters, first: 0, names: ['A', 'B'] });
    const B = E.cardPvpNewGame(db, { myDeck: dB, mySeed: 2, foeMonsters: dA.monsters, first: 1, names: ['B', 'A'] });
    [A, B].forEach((s0, i) => { s0.phase = 'main'; s0.turn = 1; s0.active = i; });
    A.players[0].hand = ['169', '100', '100']; A.players[0].guts = Array(9).fill('100'); B.players[1].hand = [H, H, H]; B.players[1].guts = Array(9).fill(H);
    const send = (from, to, act, seq) => { const n = E.cardApplyAction(db, from, act); return [n, n && E.cardPvpApplyRemote(db, to, E.cardPvpCleanMessage(JSON.parse(JSON.stringify({ t: 'act', from: 'x', seq, act, reveal: E.cardPvpRevealOf(from, act), discard: n.players[0].discard }))))]; };
    const o = E.cardLegalActions(db, A).find((a) => a.type === 'attack' && Array.isArray(a.toss) && JSON.stringify(a.toss) === JSON.stringify(toss) && a.target);
    if (!o) return check(`⑪ カード投げ(${toss.length}枚): 場面が作れる`, false);
    const [A2, B2] = send(A, B, o, 1);
    check(`⑪ カード投げ(${toss.length}枚捨てる): 相手の端末で当てられる`, !!B2);
    if (!B2) return;
    const [A3] = send(B2, A2, { type: 'pass' }, 2).reverse();
    const B3 = E.cardApplyAction(db, B2, { type: 'pass' });
    check(`⑪ カード投げ(${toss.length}枚捨てる): 守らなかったあと、2台の場(ライフ・捨て札の数)が同じ`, !!A3 && !!B3 && same(A3, B3) && A3.players[1].mons[0].life === A3.players[1].mons[0].max - toss.length - (db.cards['169'].damage || 0));
  });
  // ⑫ 手の項目の突き合わせ(2026-10-27 総点検D・ソランドくん): 82 が出す手(攻撃・ブリーダー・守り)の項目を、知らせの掃除(cardPvpCleanAct)が1つも落とさない。
  //   使えるカードを1枚ずつ、使える子の場面で手札に入れ、出せる手・守りの手を全部並べて、掃除の前とあとで同じかを見る(カード投げの toss を落としていた形を止める)
  {
    const monOf2 = {}; Object.values(db.monsters).filter((m) => m.ready !== false && !m.main).sort((a, b) => (a.no < b.no ? -1 : 1)).forEach((m) => { if (!monOf2[m.species]) monOf2[m.species] = m.no; });
    const hyb = Object.values(db.monsters).find((m) => m.main && m.sub && m.ready !== false && monOf2[m.main] && monOf2[m.sub]);
    const keys = new Set(); const lost = []; let n = 0;
    const look = (a, where) => { n++; Object.keys(a).forEach((k) => keys.add(k)); const c = E.cardPvpCleanAct(JSON.parse(JSON.stringify(a))); const sk = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((kk) => [kk, x[kk]])) : x)); if (sk(c) !== sk(a) && lost.length < 5) lost.push(`${where}: ${JSON.stringify(a)} → ${JSON.stringify(c)}`); };
    Object.values(db.cards).filter((c) => c.ready).forEach((c) => {
      const u = monOf2[c.user] || 'C-003';
      const mons = c.no === '352' && hyb ? [monOf2[hyb.main], monOf2[hyb.sub], 'C-003'] : [u, u === 'C-003' ? 'C-009' : 'C-003', 'C-005'];
      let st = E.cardCreateGame(db, { decks: [{ monsters: mons, cards: Array(50).fill('100') }, { monsters: ['C-001', 'C-003', 'C-005'], cards: Array(50).fill('100') }], seed: 5, first: 0 });
      st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
      st.players[0].hand = [c.no, c.no, '100', '026']; st.players[0].guts = Array(9).fill('100'); st.players[0].discard = ['100', '108', '026', c.no];
      st.players[1].hand = ['100']; st.players[1].mons[0].life = 3;
      st.players[0].mons[1].attacks = 0;
      E.cardLegalActions(db, st).forEach((a) => look(a.hand && a.hand.some((i) => (db.cards[st.players[0].hand[i]].effects || []).some((e) => e.t === 'attachBind')) ? E.cardAiFillBind(db, st, a, E.cardAiPolicy('kyuko', 'easy')) : a, `${c.no} 攻撃`));
      // 守り: 相手のふつうの技を受けて、守りの手を全部
      if (['dge', 'blk'].includes(c.kind)) {
        let g = E.cardCreateGame(db, { decks: [{ monsters: ['C-001', 'C-003', 'C-005'], cards: Array(50).fill('100') }, { monsters: mons, cards: Array(50).fill('100') }], seed: 5, first: 0 });
        g = E.cardApplyAction(db, g, { type: 'setupGuts', hand: [] });
        g.players[0].hand = ['026']; g.players[0].guts = Array(9).fill('100'); g.players[1].hand = [c.no]; g.players[1].guts = Array(9).fill('100');
        E.cardLegalActions(db, g).filter((a) => a.type === 'attack').forEach((a) => { const p2 = E.cardApplyAction(db, g, a); if (p2 && p2.pending) E.cardLegalActions(db, p2).forEach((x) => look(x, `${c.no} 守り`)); });
      }
    });
    check(`⑫ 82 が出す手 ${n}通り(項目 ${[...keys].sort().join('・')})を、知らせの掃除が1つも落とさない`, !lost.length, lost.join(' / '));
    ['toss', 'split', 'fuse', 'form', 'bind', 'to', 'target', 'mon', 'hand'].forEach((k) => check(`⑫ 突き合わせの場面に「${k}」の手が入っている`, keys.has(k)));
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
