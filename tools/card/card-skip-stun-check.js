// MFバトルカード: 「吠え」「吹き飛ばし」のあとの「歌う」(2026-10-27 社長の答え・カード部ルールくん)。ブラウザなしで 82 を動かす。
//
//   node tools/card/card-skip-stun-check.js [--verbose]
//
// 決まり: 「攻撃できない」は、次の本当の番まで止める。「歌う」で飛ばした番では使い切らない
// 見るもの
//   A. 攻撃できない子がいるときに番を飛ばすと、飛ばした番のあとの本当の番で、その子は攻撃できない
//   B. その本当の番が終われば、また攻撃できる(ずっと止まらない)
//   C. 攻撃できない子がいないときの「歌う」は、これまでどおり(番を1つ飛ばして、こちらの番に戻る)
//   D. 実際のカードで: 「吠え」(全員)と「吹き飛ばし」(1体)のあとに「歌う」を出しても、相手の本当の番で止まっている
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardAttackOptions, cardMonCanAttack };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };

const monOf = {};
Object.values(db.monsters).forEach((m) => { if (!m.main && !m.variant && !monOf[m.species]) monOf[m.species] = m.no; });
const scene = (mons, hands) => {
  const decks = mons.map((m) => ({ monsters: m, cards: Array(50).fill('100') }));
  let st = E.cardCreateGame(db, { decks, seed: 7, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players.forEach((pl, i) => { pl.hand = hands[i].slice(); pl.guts = Array(10).fill('100'); });
  st.active = 0; st.phase = 'main';
  return st;
};
const act = (st, a) => { const n = E.cardApplyAction(db, st, a); if (!n) throw new Error(`だめな操作: ${JSON.stringify(a)}`); return n; };
const endTurn = (st) => act(act(st, { type: 'endAttacks' }), { type: 'guts', hand: [] });
const canAtk = (st, p, mi) => E.cardMonCanAttack(db, st, p, mi, null);
const trio = [monOf.tiger, monOf.suezo, monOf.golem];
check('材料: ライガー・スエゾー・ゴーレムがいる', trio.every(Boolean), trio.join(','));

// ---- A・B: 状態を直接作る ----
{
  let st = scene([trio, trio], [[], []]);
  const t = st.turn;
  st.players[1].mons[0].stunTurn = t + 1; // 次の番に攻撃できない(吠え・吹き飛ばしと同じ付け方)
  st.skip = 1; // 歌う
  st = endTurn(st);
  check('A 番を飛ばしたあと、こちらの番に戻る', st.active === 0 && st.turn === t + 2, `active ${st.active}・turn ${st.turn}`);
  check('A 攻撃できないは、相手の次の本当の番まで残る', st.players[1].mons[0].stunTurn === st.turn + 1, `stunTurn ${st.players[1].mons[0].stunTurn}・turn ${st.turn}`);
  st = endTurn(st);
  check('A 相手の本当の番で、その子は攻撃できない', st.active === 1 && !canAtk(st, 1, 0) && canAtk(st, 1, 1));
  st = endTurn(st); st = endTurn(st);
  check('B その番が過ぎれば、また攻撃できる', st.active === 1 && canAtk(st, 1, 0));
}
// ---- C ----
{
  let st = scene([trio, trio], [[], []]);
  const t = st.turn;
  st.skip = 1;
  st = endTurn(st);
  check('C 攻撃できない子がいないときの歌うは、これまでどおり', st.active === 0 && st.turn === t + 2 && st.players[1].mons.every((m) => m.stunTurn === -1));
  st = endTurn(st);
  check('C 相手の本当の番では、みんな攻撃できる', st.active === 1 && [0, 1, 2].every((i) => canAtk(st, 1, i)));
}
// ---- D: 実際のカード(吠え 010・吹き飛ばし 273・歌う 047) ----
const play = (st, handNo, mon, target) => {
  const hi = st.players[0].hand.indexOf(handNo);
  const o = E.cardAttackOptions(db, st).find((x) => x.hand.length === 1 && x.hand[0] === hi && x.mon === mon && (!target || (x.target && x.target.p === target.p && x.target.m === target.m)));
  if (!o) return null;
  let n = E.cardApplyAction(db, st, o);
  for (let i = 0; n && n.phase !== 'main' && i < 20; i++) n = E.cardApplyAction(db, n, { type: 'pass' });
  return n;
};
[['吠え', '010', null, [0, 1, 2]], ['吹き飛ばし', '273', { p: 1, m: 1 }, [1]]].forEach(([name, no, target, stunned]) => {
  let st = scene([trio, trio], [[no, '047'], []]);
  st = play(st, no, 0, target);
  check(`D ${name}を出せる`, !!st);
  if (!st) return;
  st = play(st, '047', 1, null);
  check(`D ${name}のあとに歌うを出せる`, !!st);
  if (!st) return;
  st = endTurn(st);
  check(`D ${name}+歌う: 相手の番が飛ばされ、こちらの番に戻る`, st.active === 0);
  st = endTurn(st);
  const ok = [0, 1, 2].every((i) => canAtk(st, 1, i) === !stunned.includes(i));
  check(`D ${name}+歌う: 相手の本当の番で、止めた子は攻撃できない`, st.active === 1 && ok, [0, 1, 2].map((i) => canAtk(st, 1, i)).join(','));
});

if (fails.length) {
  console.error(`吠え・吹き飛ばしのあとの歌うの検査: NG ${fails.length}件(OK ${passed}件)`);
  fails.forEach((f) => console.error(`  NG: ${f}`));
  process.exit(1);
}
console.log(`吠え・吹き飛ばしのあとの歌うの検査: OK ${passed}件`);
