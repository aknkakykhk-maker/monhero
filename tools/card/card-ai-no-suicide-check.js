// MFバトルカード: 助手(CPU)が自分で負けにいく手を選ばないか(2026-10-27 遊ぶ人の声・カード部の割り当て)
//   ソラシドさん「最後の1体しかいないのに自爆して負ける」・あつさん「山札を気にせず負ける」
//
//   node tools/card/card-ai-no-suicide-check.js
//
// 見るもの(助手6人 × 5段の強さ × 乱数をいくつも。雑な手・気まぐれな手のときも)
//   ① 最後の1体で、使うと自分が倒れる技(自分も n ダメージ・当たったら自分も n ダメージ)を選ばない
//   ② ただし、その技で相手の最後の1体も倒せる(同時に全滅=攻撃した側の勝ち)なら、選べる手に残る
//   ③ 山札が尽きそうなとき、引く札で山札を0にして次の番に山札切れになる手を選ばない
//   ④ ガッツの段で、次の番に引く枚数より山札が少なくなるほど手札をガッツにしない
//   ⑤ 守りで負けにいかない(最後の1体で、守らなければ残るのに「受けるダメージ2倍」で倒れる)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardAttackOptions, cardGuardOptions, cardAiChooseAction, cardAiPolicy, cardAiLosesBy, CARD_AI_HABITS, CARD_AI_LEVELS };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
let failed = 0, passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) passed++; else { failed++; fails.push(`${name}${detail ? ` — ${detail}` : ''}`); } };

const HABITS = Object.keys(E.CARD_AI_HABITS);
const LEVELS = Object.keys(E.CARD_AI_LEVELS);
const monOf = {};
Object.values(db.monsters).forEach((m) => { if (!m.main && !m.variant && !monOf[m.species]) monOf[m.species] = m.no; });
const scene = ({ mons, hands, guts = [10, 10], deck = [40, 40] }) => {
  const decks = mons.map((m) => ({ monsters: m, cards: Array(50).fill('100') }));
  let st = E.cardCreateGame(db, { decks, seed: 5, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players.forEach((pl, i) => { pl.hand = hands[i].slice(); pl.guts = Array(guts[i]).fill('100'); pl.deck = Array(deck[i]).fill('100'); pl.discard = []; });
  st.active = 0; st.phase = 'main';
  return st;
};
const ko = (st, p, m) => { st.players[p].mons[m].ko = true; st.players[p].mons[m].life = 0; };
// 助手全員・全段で、seeds 回ずつ選ばせて、bad(手) が1回でも出たら NG
const everyAi = (name, st, bad, seeds = 40) => {
  const hits = [];
  HABITS.forEach((h) => LEVELS.forEach((lv) => {
    const pol = E.cardAiPolicy(h, lv);
    for (let k = 0; k < seeds; k++) {
      let x = (k + 1) * 2654435761 >>> 0;
      const rand = () => { x = (x * 1103515245 + 12345) >>> 0; return x / 4294967296; };
      const a = E.cardAiChooseAction(db, JSON.parse(JSON.stringify(st)), pol, rand);
      if (bad(a)) { hits.push(`${h}/${lv}`); break; }
    }
  }));
  check(name, !hits.length, hits.slice(0, 6).join('・'));
};
const usesNo = (st, no) => (a) => a && Array.isArray(a.hand) && (a.type === 'attack' || a.type === 'breeder') && a.hand.some((i) => st.players[0].hand[i] === no);

// ① 最後の1体(モノリス・ライフ2)で、自分も2ダメージを受ける「154」を選ばない(相手は3体とも元気)
{
  const st = scene({ mons: [[monOf.monol, monOf.golem, monOf.tiger], [monOf.golem, monOf.tiger, monOf.pixie]], hands: [['154', '100', '100'], []] });
  ko(st, 0, 1); ko(st, 0, 2); st.players[0].mons[0].life = 2;
  check('① 154 が場面で出せる(検査の前提)', E.cardAttackOptions(db, st).some(usesNo(st, '154')));
  everyAi('① 最後の1体で、自分が倒れる技(自分も2ダメージ)を選ばない', st, usesNo(st, '154'));
}
// ①b 当たったら自分も1ダメージ(モッチー 101)・ライフ1の最後の1体
{
  const st = scene({ mons: [[monOf.mocchi, monOf.golem, monOf.tiger], [monOf.golem, monOf.tiger, monOf.pixie]], hands: [['101', '100', '100'], []] });
  ko(st, 0, 1); ko(st, 0, 2); st.players[0].mons[0].life = 1;
  check('①b 101 が場面で出せる(検査の前提)', E.cardAttackOptions(db, st).some(usesNo(st, '101')));
  everyAi('①b 最後の1体(ライフ1)で、当たったら自分も1ダメージの技を選ばない', st, usesNo(st, '101'));
}
// ② 相手の最後の1体も倒せるなら、同時に全滅して勝ち(攻撃した側の勝ち)なので選べる手に残る
{
  const st = scene({ mons: [[monOf.monol, monOf.golem, monOf.tiger], [monOf.golem, monOf.tiger, monOf.pixie]], hands: [['154'], []] });
  ko(st, 0, 1); ko(st, 0, 2); st.players[0].mons[0].life = 2;
  ko(st, 1, 1); ko(st, 1, 2); st.players[1].mons[0].life = 3;
  const o = E.cardAttackOptions(db, st).find((x) => usesNo(st, '154')(x) && x.target && x.target.m === 0);
  check('② 相手の最後の1体も倒せる自爆は、負ける手に数えない', !!o && !E.cardAiLosesBy(db, st, o));
}
// ③ 山札が1枚・手札4枚: 1枚引く特殊(スエゾー 045)を使うと山札0で、次の番に山札切れ。選ばない
{
  const st = scene({ mons: [[monOf.suezo, monOf.golem, monOf.tiger], [monOf.golem, monOf.tiger, monOf.pixie]], hands: [['045', '100', '100', '100'], []], deck: [1, 40] });
  check('③ 045 が場面で出せる(検査の前提)', E.cardAttackOptions(db, st).some(usesNo(st, '045')));
  everyAi('③ 山札が尽きそうなとき、引く札で山札を0にしない', st, usesNo(st, '045'));
  const st2 = scene({ mons: [[monOf.suezo, monOf.golem, monOf.tiger], [monOf.golem, monOf.tiger, monOf.pixie]], hands: [['045', '100', '100', '100'], []], deck: [10, 40] });
  const o = E.cardAttackOptions(db, st2).find(usesNo(st2, '045'));
  check('③ 山札が十分なら、引く札は負ける手に数えない', !!o && !E.cardAiLosesBy(db, st2, o));
}
// ④ ガッツの段: 山札2枚・手札5枚 → 次の番に引くのは 5−(残りの手札) 枚。山札切れにならない数(2枚)までしかガッツにしない
{
  const st = scene({ mons: [[monOf.golem, monOf.tiger, monOf.pixie], [monOf.golem, monOf.tiger, monOf.pixie]], hands: [['100', '100', '100', '100', '100'], []], deck: [2, 40], guts: [0, 10] });
  st.phase = 'guts';
  everyAi('④ ガッツの段で、山札が足りなくなるほど手札をガッツにしない', st, (a) => a && a.type === 'guts' && (st.players[0].hand.length - a.hand.length) < 3);
}
// ⑤ 最後の1体(ゴーレム・ライフ5)が、ちから技4ダメージで狙われた: 守らなければ残る。「肉を切らせて」(2倍)は出さない
{
  const pow = Object.values(db.cards).find((c) => c.ready && c.user === 'golem' && c.kind === 'pow' && !(c.effects || []).length && c.damage === 4) || Object.values(db.cards).find((c) => c.ready && c.kind === 'pow' && !(c.effects || []).length && c.damage >= 3 && c.damage <= 4 && monOf[c.user]);
  const atk = monOf[pow.user];
  let st = scene({ mons: [[atk, monOf.tiger, monOf.pixie], [monOf.golem, monOf.tiger, monOf.pixie]], hands: [[pow.no], ['249']] });
  ko(st, 1, 1); ko(st, 1, 2); st.players[1].mons[0].life = pow.damage + 1;
  const o = E.cardAttackOptions(db, st).find((x) => x.target && x.target.p === 1 && x.target.m === 0);
  st = E.cardApplyAction(db, st, o);
  check('⑤ 249 が守りに出せる(検査の前提)', E.cardGuardOptions(db, st).some((g) => st.players[1].hand[g.hand] === '249'));
  everyAi('⑤ 最後の1体で、守らなければ残るのに「受けるダメージ2倍」の守りで倒れにいかない', st, (a) => a && a.type === 'guard' && st.players[1].hand[a.hand] === '249');
}

if (failed) { fails.forEach((f) => console.log(`NG: ${f}`)); console.log(`✗ 助手が自分で負けにいかない: ${failed} 件`); process.exit(1); }
console.log(`✓ 助手が自分で負けにいかない: ${passed} 件すべて OK`);
