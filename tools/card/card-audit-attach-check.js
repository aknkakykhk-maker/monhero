#!/usr/bin/env node
// MFバトルカードの総点検 C「つける札・ブリーダー」(2026-10-27・カード部 ツナグくん)。
// きっかけ: No.277「意味不明」が効いていない疑い(社長)。カードの文 → データ(effects)→ 82 の処理 が合っているかを、小さな場面で1枚ずつ確かめる。
//
//   node tools/card/card-audit-attach-check.js
//
// 受け持ちの効果: attach・attachMult・attachAdd・attachCost・attachCostHalf・attachFree・attachNoEvade・attachNoEvadeHybrid・
//   attachNoBlockReduce・attachNoGuard・attachNoGuardIfGuarded・attachNoZeroGuard・attachSelfIfHit・attachBind・mimic・ancient・
//   breederUnlimited・freeSpeThisTurn・rush
// とくに「全員に当たる技に付けた・2枚同時・回避された」ときの取りこぼしを見る。card-rules-check.js は広げない(社長の決め・部長の指示)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardAttackOptions, cardGuardOptions, cardActionCost, cardOf, cardBindNames };', ctx, { filename: '82-card-battle-core.jsx' });
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
let failed = 0;
let count = 0;
const check = (name, ok, detail = '') => { count += 1; console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed += 1; };

// ---- 場面を作る道具(card-rules-check と同じ作り。両方とも決まった3体・山札は同じ札で埋め、手札とガッツを決める) ----
const scene = ({ mons = [['C-001', 'C-006', 'C-007'], ['C-001', 'C-006', 'C-003']], hands = [[], []], guts = [0, 0], deck = [50, 50] }) => {
  const decks = mons.map((m) => ({ monsters: m, cards: Array(50).fill('100') }));
  let st = E.cardCreateGame(db, { decks, seed: 3, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players.forEach((pl, i) => { pl.hand = hands[i].slice(); pl.guts = Array(guts[i]).fill('100'); pl.deck = pl.deck.slice(0, deck[i]); });
  st.active = 0; st.phase = 'main';
  return st;
};
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
// その手札の番号の組で、その子が、相手のその子を狙う手(全体の技は target が無い)
const optOf = (st, mon, hand, tm = 0) => E.cardAttackOptions(db, st).find((o) => o.mon === mon && same(o.hand, hand) && (o.target ? o.target.p === 1 && o.target.m === tm : true));
const play = (st, o, extra = {}) => { const n = E.cardApplyAction(db, st, { ...o, ...extra }); if (!n) throw new Error(`だめな操作: ${JSON.stringify(o)}`); return n; };
const guardNames = (st) => E.cardGuardOptions(db, st).filter((g) => g.type === 'guard').map((g) => E.cardOf(db, st.players[1].hand[g.hand]).name);
// 守らないで最後まで当てる(全員に当たる技は、1体ずつ「守らない」)
const passAll = (st) => { let s = st; for (let i = 0; i < 6 && s.pending; i++) s = play(s, { type: 'pass' }); return s; };
const life = (st, p, m) => st.players[p].mons[m].life;
const lost = (st0, st, p, m) => life(st0, p, m) - life(st, p, m);

// ---- 電光石火(009)・跳躍(070): ちから技は回避されない ----
{
  const st = scene({ hands: [['005', '009'], ['011', '035']], guts: [3, 2] });
  const o = optOf(st, 0, [0, 1]);
  check('電光石火: ライガーの突き刺し(ちから)に付けられる', !!o);
  check('電光石火: かしこさ技(電撃)には付けられない', !optOf(scene({ hands: [['007', '009'], []], guts: [9, 0] }), 0, [0, 1]));
  if (o) {
    const s1 = play(st, o);
    check('電光石火: 相手はバック転(回避)を出せない', !guardNames(s1).includes('バック転'), guardNames(s1).join('・'));
    const s2 = passAll(s1);
    check('電光石火: 突き刺しの4が当たる', lost(st, s2, 1, 0) === 4, String(lost(st, s2, 1, 0)));
  }
  const sj = scene({ hands: [['061', '070'], ['011']], guts: [3, 2] });
  const oj = optOf(sj, 1, [0, 1]);
  check('跳躍: ディノのパンチに付けられ、バック転を出せない', !!oj && !guardNames(play(sj, oj)).includes('バック転'));
  check('跳躍: ディノの札なので、ライガーの技には付けられない', !optOf(scene({ hands: [['005', '070'], []], guts: [9, 0] }), 0, [0, 1]));
}
// ---- 瞬殺(363): 回避も防御もされない ----
{
  const st = scene({ hands: [['073', '363'], ['071', '109']], guts: [4, 3] });
  const o = optOf(st, 2, [0, 1], 1);
  check('瞬殺: ナーガのボディーブローに付けられる', !!o);
  if (o) check('瞬殺: 相手は踏ん張る(防御)も緊急回避(回避)も出せない', guardNames(play(st, o)).length === 0, guardNames(play(st, o)).join('・'));
}
// ---- 渾身(362): 防御で減らない(効かない防御の札は出せない。社長の答え 案A・2026-10-27) ----
{
  const st = scene({ hands: [['061', '362'], ['035']], guts: [3, 2] });
  const o = optOf(st, 1, [0, 1], 2);
  check('渾身: ディノのパンチに付けられる', !!o);
  if (o) {
    const s1 = play(st, o);
    const g = E.cardGuardOptions(db, s1).find((x) => x.type === 'guard');
    check('渾身: 相手は効かない堅い守り(防御)を出せない', !g);
    const s2 = passAll(s1);
    check('渾身: 堅い守り(−5)を持っていてもパンチの3がそのまま当たる', lost(st, s2, 1, 2) === 3, String(lost(st, s2, 1, 2)));
  }
}
// ---- 集中(274): 消費ガッツ0の守りは出せない ----
{
  const st = scene({ hands: [['005', '274'], ['109', '011']], guts: [4, 2] });
  const o = optOf(st, 0, [0, 1]);
  check('集中: 突き刺しに付けられる', !!o);
  if (o) { const n = guardNames(play(st, o)); check('集中: 緊急回避(0ガッツ)は出せず、バック転(1ガッツ)は出せる', !n.includes('緊急回避') && n.includes('バック転'), n.join('・')); }
}
// 集中は「そのとき払うガッツ」で数える(2026-10-27 案A)。全体カードでガッツが変わったときも同じ
{
  const field = (st, no) => { const c = db.cards[no]; st.field = { no, p: 0, effects: (c.effects || []).map((e) => ({ ...e })) }; return st; };
  const holy = field(scene({ hands: [['005', '274'], ['109', '011']], guts: [4, 2] }), 'F118');
  const o = optOf(holy, 0, [0, 1]);
  if (o) { const n = guardNames(play(holy, o)); check('集中: ホリィの声援(ガッツ−1)の場では、0ガッツになったバック転も出せない', !n.includes('緊急回避') && !n.includes('バック転'), n.join('・') || '(なし)'); }
  else check('集中: ホリィの声援の場で、突き刺しに付けられる', false);
  const master = field(scene({ hands: [['005', '274'], ['109', '011']], guts: [5, 2] }), 'F256');
  const o2 = optOf(master, 0, [0, 1]);
  if (o2) { const n = guardNames(play(master, o2)); check('集中: 師匠のまなざし(ガッツ+1)の場では、1ガッツになった緊急回避は出せる', n.includes('緊急回避'), n.join('・') || '(なし)'); }
  else check('集中: 師匠のまなざしの場で、突き刺しに付けられる', false);
}
// ---- 挟み撃ち(349): このターンもう守った子は守れない ----
{
  const st = scene({ hands: [['005', '349'], ['011', '072']], guts: [4, 3] });
  st.players[1].mons[0].guardTurn = st.turn;
  const o = optOf(st, 0, [0, 1], 0);
  check('挟み撃ち: 突き刺しに付けられる', !!o);
  if (o) check('挟み撃ち: このターン守ったライガーは、バック転を出せない', !guardNames(play(st, o)).includes('バック転'), guardNames(play(st, o)).join('・'));
  const o2 = optOf(st, 0, [0, 1], 1);
  if (o2) check('挟み撃ち: まだ守っていないディノは、横っ飛びを出せる', guardNames(play(st, o2)).includes('横っ飛び'), guardNames(play(st, o2)).join('・'));
  // 前の守りで guardTurn が付くか(付かないと、挟み撃ちが効かない)
  let s = scene({ hands: [['005', '007'], ['011', '011']], guts: [9, 4] });
  s = play(s, optOf(s, 0, [0]));
  const g = E.cardGuardOptions(db, s).find((x) => x.type === 'guard');
  s = passAll(play(s, g));
  check('挟み撃ち: 回避を出した子に、このターン守った印(guardTurn)が付く', s.players[1].mons[0].guardTurn === s.turn, String(s.players[1].mons[0].guardTurn));
}
// ---- 純血のスピード(346): 派生の子は回避できない・付けられるのは純血の子の技だけ ----
{
  const st = scene({ mons: [['C-001', 'C-006', 'C-007'], ['C-051', 'C-006', 'C-003']], hands: [['005', '346'], ['011']], guts: [4, 2] });
  const o = optOf(st, 0, [0, 1], 0);
  check('純血のスピード: 純血のライガーの突き刺しに付けられる', !!o);
  if (o) check('純血のスピード: 派生のバロンはバック転を出せない', !guardNames(play(st, o)).includes('バック転'), guardNames(play(st, o)).join('・'));
  const sh = scene({ mons: [['C-051', 'C-006', 'C-007'], ['C-001', 'C-006', 'C-003']], hands: [['005', '346'], []], guts: [9, 0] });
  check('純血のスピード: 派生のバロンの技には付けられない', !optOf(sh, 0, [0, 1]));
}
// ---- 影縛り(366): 名指しした守りは出せない(ほかの守りは出せる) ----
{
  const st = scene({ hands: [['005', '366'], ['011', '109']], guts: [3, 2] });
  const o = optOf(st, 0, [0, 1]);
  check('影縛り: 突き刺しに付けられる・名指しの名前に バック転 がある', !!o && E.cardBindNames(db).includes('バック転'));
  if (o) {
    check('影縛り: 名指しなしでは出せない', E.cardApplyAction(db, st, o) === null);
    const n = guardNames(play(st, o, { bind: 'バック転' }));
    check('影縛り: バック転は出せず、緊急回避は出せる', !n.includes('バック転') && n.includes('緊急回避'), n.join('・'));
    const s2 = play(st, o, { bind: 'バック転' });
    check('影縛り: ブリーダーの札なので、そのターンのブリーダーの1枚に数える', s2.players[0].breederUsed === true);
  }
}
// ---- 捨て身(330): 2倍・回避されなければ自分に2 ----
{
  const mons = [['C-049', 'C-006', 'C-007'], ['C-001', 'C-006', 'C-003']];
  const st = scene({ mons, hands: [['322', '330'], ['011']], guts: [4, 2] });
  const o = optOf(st, 0, [0, 1], 0);
  check('捨て身: ケンタウロスのスマッシュに付けられる', !!o);
  if (o) {
    const hit = passAll(play(st, o));
    check('捨て身: 当たると2倍(2→4)・自分に2', lost(st, hit, 1, 0) === 4 && lost(st, hit, 0, 0) === 2, `${lost(st, hit, 1, 0)} / ${lost(st, hit, 0, 0)}`);
    const s1 = play(st, o);
    const g = E.cardGuardOptions(db, s1).find((x) => x.type === 'guard');
    const ev = passAll(play(s1, g));
    check('捨て身: 回避されたら0・自分も0', lost(st, ev, 1, 0) === 0 && lost(st, ev, 0, 0) === 0, `${lost(st, ev, 1, 0)} / ${lost(st, ev, 0, 0)}`);
  }
  // 空中の子には当たらない技(根っこ)は、狙えない(当たらないのに自分だけ傷つくことはない)
}
// ---- クリティカル(121)・底力(110)・必死(345)・劇的な幕切れ(124): ダメージの足し算・かけ算 ----
{
  let st = scene({ hands: [['005', '121'], []], guts: [5, 0] });
  let o = optOf(st, 0, [0, 1]);
  check('クリティカル: 突き刺しに付けて 4+2=6', !!o && lost(st, passAll(play(st, o)), 1, 0) === 6);
  st = scene({ hands: [['005', '110'], []], guts: [4, 0] });
  check('底力: ライフ3以上のときは付けられない', !optOf(st, 0, [0, 1]));
  st.players[0].mons[0].life = 2;
  o = optOf(st, 0, [0, 1]);
  check('底力: ライフ2のときに付けて 4×2=8', !!o && lost(st, passAll(play(st, o)), 1, 0) === 6, '(相手のライフ6なので6で止まる)');
  // 2枚同時: 底力+クリティカル (4+2)×2=12 → ゴーレム(9)に当てて KO
  st = scene({ hands: [['005', '110', '121'], []], guts: [9, 0] });
  st.players[0].mons[0].life = 2;
  o = optOf(st, 0, [0, 1, 2], 2);
  check('2枚同時: 底力とクリティカルを一緒に付けられる(ガッツ 3+1+2=6)', !!o && E.cardActionCost(db, st, 0, st.players[0].hand, o.hand) === 6, o ? String(E.cardActionCost(db, st, 0, st.players[0].hand, o.hand)) : '候補なし');
  if (o) { const s = passAll(play(st, o)); check('2枚同時: (4+2)×2 で ゴーレム(9)が KO', s.players[1].mons[2].ko === true, String(life(s, 1, 2))); }
  st = scene({ hands: [['005', '345'], []], guts: [4, 0] });
  check('必死: ライフ3以上のときは付けられない', !optOf(st, 0, [0, 1]));
  st.players[0].mons[0].life = 1;
  o = optOf(st, 0, [0, 1], 2);
  check('必死: ライフ1のときに付けて 4+2=6', !!o && lost(st, passAll(play(st, o)), 1, 2) === 6);
  st = scene({ hands: [['005', '124'], []], guts: [4, 0] });
  check('劇的な幕切れ: 山札があるときは付けられない', !optOf(st, 0, [0, 1]));
  st = scene({ hands: [['005', '124'], []], guts: [4, 0], deck: [0, 50] });
  o = optOf(st, 0, [0, 1], 2);
  check('劇的な幕切れ: 山札0のときに付けて 4×3=12 → ゴーレム(9) KO', !!o && passAll(play(st, o)).players[1].mons[2].ko === true);
}
// ---- 全員に当たる技に付けた: 竜巻アタック(ゴーレムの 4・全員)+クリティカル → どの子にも 6 ----
{
  const mons = [['C-003', 'C-006', 'C-007'], ['C-003', 'C-006', 'C-009']];
  const st = scene({ mons, hands: [['032', '121'], []], guts: [10, 0] });
  const o = E.cardAttackOptions(db, st).find((x) => x.mon === 0 && same(x.hand, [0, 1]));
  check('全員に当たる技: 竜巻アタックにクリティカルを付けられる', !!o);
  if (o) { const s = passAll(play(st, o)); check('全員に当たる技: 3体ともに 4+2=6', [0, 1, 2].every((m) => lost(st, s, 1, m) === 6), [0, 1, 2].map((m) => lost(st, s, 1, m)).join(',')); }
}
// ---- 回避されても半分の技に付けた: パラボラビーム(4・半分)+クリティカル → 回避されて 6の半分=3 ----
{
  const mons = [['C-022', 'C-006', 'C-007'], ['C-001', 'C-006', 'C-003']];
  const st = scene({ mons, hands: [['147', '121'], ['011']], guts: [6, 2] });
  const o = optOf(st, 0, [0, 1], 0);
  check('回避されても半分: パラボラビームにクリティカルを付けられる', !!o);
  if (o) {
    const s1 = play(st, o);
    const g = E.cardGuardOptions(db, s1).find((x) => x.type === 'guard');
    const s = passAll(play(s1, g));
    check('回避されても半分: (4+2) の半分で 3', lost(st, s, 1, 0) === 3, String(lost(st, s, 1, 0)));
  }
}
// ---- 払うガッツを減らす札: 光合成(−2)・団結(−1)・急襲(半分)・ジョイのサポート(0) ----
{
  let st = scene({ mons: [['C-027', 'C-006', 'C-007'], ['C-001', 'C-006', 'C-003']], hands: [['205', '209'], []], guts: [1, 0] });
  let o = optOf(st, 0, [0, 1], 1);
  check('光合成: フェイスドリル(3)が −2 で、ガッツ1で出せる', !!o && E.cardActionCost(db, st, 0, st.players[0].hand, o.hand) === 1);
  if (o) check('光合成: 出したらガッツが1減る', play(st, o).players[0].guts.length === 0);
  st = scene({ mons: [['C-050', 'C-006', 'C-007'], ['C-001', 'C-006', 'C-003']], hands: [['337', '343'], []], guts: [2, 0] });
  o = optOf(st, 0, [0, 1], 0);
  check('団結: マッハトルネード(3)が −1 で、ガッツ2で出せる', !!o && E.cardActionCost(db, st, 0, st.players[0].hand, o.hand) === 2);
  st = scene({ mons: [['C-003', 'C-006', 'C-007'], ['C-001', 'C-006', 'C-003']], hands: [['032', '347'], []], guts: [5, 0] });
  o = E.cardAttackOptions(db, st).find((x) => x.mon === 0 && same(x.hand, [0, 1]));
  check('急襲: 竜巻アタック(8)が半分の4+急襲1=5 で出せる', !!o && E.cardActionCost(db, st, 0, st.players[0].hand, o.hand) === 5);
  st = scene({ hands: [['005', '347'], []], guts: [9, 0] });
  check('急襲: 1体だけの技には付けられない', !optOf(st, 0, [0, 1]));
  st = scene({ hands: [['114', '276'], []], guts: [0, 0] });
  o = E.cardAttackOptions(db, st).find((x) => same(x.hand, [0, 1]));
  check('ジョイのサポート: 突進(ブリーダー・3)をガッツ0で出せる', !!o && E.cardActionCost(db, st, 0, st.players[0].hand, o.hand) === 0);
  if (o) { const s = play(st, o); check('ジョイのサポート: 突進が効いて、ガッツ0から5になる', s.players[0].guts.length === 5, String(s.players[0].guts.length)); }
  st = scene({ hands: [['005', '276'], []], guts: [9, 0] });
  check('ジョイのサポート: モンスターの技には付けられない', !optOf(st, 0, [0, 1]));
}
// ---- うたうニャ(197): このターン、ブリーダーの札を何枚でも ----
{
  // 冬虫散(ブリーダー・0ガッツ・自分に1・1枚引く)を2枚。体力が満タンでも出せる札にする
  let st = scene({ mons: [['C-026', 'C-006', 'C-007'], ['C-001', 'C-006', 'C-003']], hands: [['197', '253', '253'], []], guts: [4, 0] });
  const o = E.cardAttackOptions(db, st).find((x) => same(x.hand, [0]));
  check('うたうニャ: ニャーが出せる', !!o);
  if (o) {
    st = passAll(play(st, o));
    const b1 = E.cardAttackOptions(db, st).find((x) => same(x.hand, [0]));
    check('うたうニャ: 出したあと、ブリーダーの札を1枚出せる', !!b1);
    if (b1) { st = passAll(play(st, b1)); check('うたうニャ: さらにもう1枚(2枚め)も出せる', !!E.cardAttackOptions(db, st).find((x) => same(x.hand, [0]))); }
  }
  let s0 = scene({ hands: [['253', '253'], []], guts: [4, 0] });
  s0 = passAll(play(s0, E.cardAttackOptions(db, s0).find((x) => same(x.hand, [0]))));
  check('うたうニャ: 無いときは、ブリーダーの札は1ターン1枚', !E.cardAttackOptions(db, s0).find((x) => same(x.hand, [0])));
}
// ---- 突進(114): そのターンの最初の1枚・山札の上から5枚をガッツ・そのあと出せない ----
{
  let st = scene({ hands: [['114', '005'], []], guts: [3, 0] });
  const o = E.cardAttackOptions(db, st).find((x) => same(x.hand, [0]));
  check('突進: ターンの最初なら出せる', !!o);
  if (o) {
    st = passAll(play(st, o));
    check('突進: ガッツが 3−3+5=5 になる', st.players[0].guts.length === 5, String(st.players[0].guts.length));
    check('突進: そのターンは、ほかの札(突き刺し)を出せない', E.cardAttackOptions(db, st).length === 0, String(E.cardAttackOptions(db, st).length));
  }
  let s2 = scene({ hands: [['005', '114'], []], guts: [9, 0] });
  s2 = passAll(play(s2, optOf(s2, 0, [0])));
  check('突進: ほかの札を出したあとは出せない', !E.cardAttackOptions(db, s2).find((x) => same(x.hand, [0])));
}
// ---- ものまね(150): ゲルが、ほかの種族のちから技を出せる ----
{
  const st = scene({ mons: [['C-022', 'C-006', 'C-007'], ['C-001', 'C-006', 'C-003']], hands: [['005', '150'], []], guts: [9, 0] });
  const o = optOf(st, 0, [0, 1], 0);
  check('ものまね: ゲルがライガーの突き刺しを、ものまねと一緒に出せる', !!o);
  check('ものまね: ものまね無しでは、ゲルは突き刺しを出せない', !optOf(scene({ mons: [['C-022', 'C-006', 'C-007'], ['C-001', 'C-006', 'C-003']], hands: [['005'], []], guts: [9, 0] }), 0, [0], 0));
  if (o) check('ものまね: 突き刺しの4が当たる', lost(st, passAll(play(st, o)), 1, 0) === 4);
}
// ---- 友情の証(342): このターン、味方の特殊技は0ガッツ ----
{
  // ライガーの特殊技(電光石火は付ける札なので、付けない特殊技を探す)
  const spe = Object.values(db.cards).find((c) => c.ready && c.kind === 'spe' && c.user === 'tiger' && (c.guts || 0) > 0 && !(c.effects || []).some((e) => e.t === 'attach'));
  if (spe) {
    let st = scene({ mons: [['C-050', 'C-001', 'C-007'], ['C-001', 'C-006', 'C-003']], hands: [['342', spe.no], []], guts: [0, 0] });
    const o = E.cardAttackOptions(db, st).find((x) => x.mon === 0 && same(x.hand, [0]));
    check('友情の証: コロペンドラが出せる', !!o);
    if (o) {
      st = passAll(play(st, o));
      const o2 = E.cardAttackOptions(db, st).find((x) => x.mon === 1 && same(x.hand, [0]));
      check(`友情の証: そのターン、ライガーの「${spe.name}」(${spe.guts}ガッツ)を0ガッツで出せる`, !!o2);
    }
  } else check('友情の証: 確かめに使うライガーの特殊技が見つからない', false);
}
// ---- 太古の記憶(348): 派生の子が、サブの種族の特殊技を出せる ----
{
  // バロン(メイン ライガー・サブ ガリ)が、ガリの特殊技を出す
  const spe = Object.values(db.cards).find((c) => c.ready && c.kind === 'spe' && c.user === 'gali' && !(c.effects || []).some((e) => e.t === 'attach'));
  if (spe) {
    const mons = [['C-051', 'C-006', 'C-007'], ['C-001', 'C-006', 'C-003']];
    const st = scene({ mons, hands: [[spe.no, '348'], []], guts: [9, 0] });
    st.players[0].discard = ['005']; // 捨て札から選ぶ札(作戦の指示)のため
    const o = E.cardAttackOptions(db, st).find((x) => x.mon === 0 && same(x.hand, [0, 1]));
    check(`太古の記憶: バロンが、サブ(ガリ)の「${spe.name}」を一緒に出せる`, !!o);
    const none = scene({ mons, hands: [[spe.no], []], guts: [9, 0] });
    none.players[0].discard = ['005'];
    check(`太古の記憶: 無いときは、バロンはガリの「${spe.name}」を出せない`, !E.cardAttackOptions(db, none).find((x) => x.mon === 0 && same(x.hand, [0])));
    if (o) { const s = play(st, o); check('太古の記憶: 出したあと、太古の記憶は捨て札へ(手札に残らない)', !s.players[0].hand.includes('348'), s.players[0].hand.join(',')); }
    const pure = scene({ hands: [[spe.no, '348'], []], guts: [9, 0] });
    pure.players[0].discard = ['005'];
    check('太古の記憶: 純血のライガーには付けられない', !E.cardAttackOptions(db, pure).find((x) => same(x.hand, [0, 1])));
  } else check('太古の記憶: 確かめに使うガリの特殊技が見つからない', false);
}

console.log(`\n${count} 件を確かめた`);
if (failed) { console.log(`NG: ${failed} 件`); process.exit(1); }
console.log('すべて OK');
