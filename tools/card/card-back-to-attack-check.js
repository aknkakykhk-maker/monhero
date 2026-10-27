// MFバトルカード: ガッツの段から「攻撃に戻る」(backToAttack)の決まり(2026-10-27 カード部ルールくん)。
// 社長「攻撃ターンを終わらせてガッツターンにいったときに間違って押しちゃうときもあるから戻れるようにしたい」。ブラウザなしで 82 を動かす。
//
//   node tools/card/card-back-to-attack-check.js [--verbose]
//
// 見るもの
//   A. 攻撃を終えた直後は戻れる。戻ると攻撃の段で、出せる手は終える前と同じ(もう攻撃した子は2回目を打てない)
//   B. 戻ったあと、もう一度攻撃を終えてガッツにでき、相手の番へ進む
//   C. 攻撃の段・ガッツにした後(相手の番)・勝ち負けが付いた後は通らない
//   D. 灼熱の地が効いた番は戻れない(案A)。次の番は戻れる
//   E. 助手の出せる手(cardLegalActions)に入らない・助手どうしの対戦で一度も選ばない
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, CARD_AI_HABITS, cardCreateGame, cardApplyAction, cardAttackOptions, cardLegalActions, cardCanBackToAttack, cardAiChooseAction, cardAiPolicy, cardAiBuildDeck, cardAiSeededRand, cardDecider, cardOther, cardRngNext };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const BACK = { type: 'backToAttack' };
const key = (st) => JSON.stringify(E.cardAttackOptions(db, st));

// もちき(100)を打てるモッチーの子だけで組む
const MOCCHI = Object.values(db.monsters).filter((m) => m.species === 'mocchi' && !m.main && !m.variant).map((m) => m.no).slice(0, 1);
const TEAM = [MOCCHI[0], 'C-006', 'C-001'];
const scene = () => {
  let st = E.cardCreateGame(db, { decks: [{ monsters: TEAM, cards: Array(50).fill('100') }, { monsters: TEAM, cards: Array(50).fill('100') }], seed: 7, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players.forEach((pl) => { pl.guts = Array(10).fill('100'); });
  return st;
};

// ---- A・B ----
{
  let st = scene();
  const opts = E.cardAttackOptions(db, st);
  const atk = opts.find((o) => o.type === 'attack');
  check('A 材料: 攻撃できる', !!atk);
  st = E.cardApplyAction(db, st, atk);
  for (let i = 0; i < 5 && st.pending; i++) st = E.cardApplyAction(db, st, { type: 'pass' });
  const before = key(st);
  const ended = E.cardApplyAction(db, st, { type: 'endAttacks' });
  check('A 攻撃を終えるとガッツの段', ended && ended.phase === 'guts');
  check('A ガッツの段で戻れる', E.cardCanBackToAttack(ended));
  const back = E.cardApplyAction(db, ended, BACK);
  check('A 戻ると攻撃の段・番はそのまま', back && back.phase === 'main' && back.active === st.active && back.turn === st.turn);
  check('A 戻ったあとの出せる手は、終える前と同じ', back && key(back) === before);
  check('A 戻っても場(ライフ・手札・ガッツ)は変わらない', back && JSON.stringify(back.players) === JSON.stringify(ended.players));
  const again = E.cardApplyAction(db, back, { type: 'endAttacks' });
  check('B もう一度終えられる', again && again.phase === 'guts');
  const g = again && E.cardApplyAction(db, again, { type: 'guts', hand: [0] });
  check('B ガッツにすると相手の番', g && g.active === E.cardOther(st.active) && g.phase === 'main');
  // ---- C ----
  check('C 攻撃の段では通らない', E.cardApplyAction(db, st, BACK) === null && !E.cardCanBackToAttack(st));
  check('C ガッツにした後(相手の番)は通らない', g && E.cardApplyAction(db, g, BACK) === null);
  const done = JSON.parse(JSON.stringify(ended)); done.winner = 0;
  check('C 勝ち負けが付いた後は通らない', E.cardApplyAction(db, done, BACK) === null);
  const pend = JSON.parse(JSON.stringify(ended)); pend.pendingChoice = { p: pend.active };
  check('C 選ぶ段の途中は戻れない', !E.cardCanBackToAttack(pend));
}
// ---- D ----
{
  let st = scene();
  st.field = { no: 'test', effects: [{ t: 'fieldBurn', n: 1 }] };
  const ended = E.cardApplyAction(db, st, { type: 'endAttacks' });
  check('D 材料: 灼熱の地でダメージが出る', ended && ended.phase === 'guts' && ended.players[st.active].mons.some((m, i) => m.life < st.players[st.active].mons[i].life));
  check('D 灼熱の地が効いた番は戻れない', ended && !E.cardCanBackToAttack(ended) && E.cardApplyAction(db, ended, BACK) === null);
  let nx = E.cardApplyAction(db, ended, { type: 'guts', hand: [] });
  nx.field = null;
  nx = E.cardApplyAction(db, nx, { type: 'endAttacks' });
  check('D 次の番(灼熱の地なし)は戻れる', nx && E.cardCanBackToAttack(nx));
}
// ---- E ----
{
  const st = E.cardApplyAction(db, scene(), { type: 'endAttacks' });
  check('E 助手の出せる手に入らない', !E.cardLegalActions(db, st).some((a) => a.type === 'backToAttack'));
  const WHO = Object.keys(E.CARD_AI_HABITS);
  let games = 0, backs = 0;
  WHO.forEach((a, i) => {
    const b = WHO[(i + 1) % WHO.length];
    const decks = [E.cardAiBuildDeck(db, a, 'master', E.cardAiSeededRand(`back:${a}`)), E.cardAiBuildDeck(db, b, 'master', E.cardAiSeededRand(`back:${b}`))];
    const pol = [E.cardAiPolicy(a, 'master'), E.cardAiPolicy(b, 'master')];
    let s = E.cardCreateGame(db, { decks, seed: 300 + i, first: i % 2 });
    let r = 11 + i;
    const rand = () => { const n = E.cardRngNext(r); r = n.s; return n.v; };
    for (let step = 0; step < 3000 && s.winner === null; step++) {
      const who = s.pendingDiscard ? s.pendingDiscard.p : s.phase === 'setup' ? E.cardOther(s.first) : E.cardDecider(s);
      const act = E.cardAiChooseAction(db, s, pol[who], rand);
      if (act && act.type === 'backToAttack') backs++;
      const next = E.cardApplyAction(db, s, act);
      if (!next) break;
      s = next;
    }
    games++;
  });
  check('E 助手は攻撃に戻らない', backs === 0, `${games}試合で ${backs} 回`);
}

if (fails.length) {
  console.error(`攻撃に戻るの検査: NG ${fails.length}件(OK ${passed}件)`);
  fails.forEach((f) => console.error(`  NG: ${f}`));
  process.exit(1);
}
console.log(`攻撃に戻るの検査: OK ${passed}件`);
