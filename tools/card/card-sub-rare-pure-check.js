// MFバトルカード: サブが「？？？」の子は、純血のスピード・純血のプライドで純血ではない(2026-10-27 社長 案A・カード部ルールくん)。
// 社長「サブレアは純血扱いじゃなくす。ただ防御回避カードは純血と同じ扱いはルールのまま」。ブラウザなしで 82 を動かす。
//
//   node tools/card/card-sub-rare-pure-check.js [--verbose]
//
// サブが？？？の子(ジェントル・ギンギライガー・ムー・剣士モッチー・パンドラ)1体ずつ
//   A. 純血の子が純血のスピードを付けた技: 回避の札を出せない(くらべ: 純血のライガーは出せる)
//   B. 自分の技に純血のスピードを付けられない
//   C. 純血のプライドが場にあるとき、純血の子の攻撃: 回避の札を出せない
//   D. 純血のプライドが場にあっても、この子の攻撃にはプライドが効かない(狙われた混血の子は回避を出せる)
//   E. ふだん(どちらも無いとき): メインの種族の回避の札を出せる(守りの札の種族は今のまま)
//   F. 助手の見込み: 純血のスピード・プライドのとき、この子に回避されるとは見込まない
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardAttackOptions, cardGuardOptions, cardOf, cardHasEff, cardEff, cardIsPureMon, cardIsHybridMon, cardAiEvadeChance, cardAttachMods };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };

const cards = Object.values(db.cards).filter((c) => c.ready);
const mons = Object.values(db.monsters);
const SPEED = '346'; const PRIDE = 'F255';
const rares = mons.filter((m) => m.sub === 'unknown' && !m.variant);
check('材料: サブが？？？の子が5体いる', rares.length >= 5, rares.map((m) => m.name).join('・'));
const pureOf = (sp) => mons.find((m) => m.species === sp && !m.main && !m.variant);
const evadeOf = (sp) => cards.find((c) => c.kind === 'dge' && c.user === sp && (c.effects || []).some((e) => e.t === 'evade' && e.kinds.includes('pow') && e.kinds.includes('int') && !e.minGuts))
  || cards.find((c) => c.kind === 'dge' && c.user === sp && (c.effects || []).some((e) => e.t === 'evade' && !e.minGuts));
const plainAtk = (sp) => cards.filter((c) => c.user === sp && (c.kind === 'pow' || c.kind === 'int') && !(c.effects || []).length && (c.damage || 0) >= 2);
const PURE_ATTACKERS = ['zilla', 'golem', 'tiger', 'dragon', 'naga', 'suezo', 'pixie', 'hare', 'mocchi'];

const scene = (m0, m1, h0, h1, field = null) => {
  let st = E.cardCreateGame(db, { decks: [{ monsters: m0, cards: Array(50).fill('100') }, { monsters: m1, cards: Array(50).fill('100') }], seed: 7, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players[0].hand = h0.slice(); st.players[1].hand = h1.slice();
  st.players.forEach((pl) => { pl.guts = Array(10).fill('100'); });
  st.active = 0; st.phase = 'main';
  if (field) st.field = { no: field, p: 0, effects: db.cards[field].effects };
  return st;
};
// 純血の子が、守る側の1体目(def)を狙える攻撃を探す。withSpeed なら純血のスピードも付ける。返す { st(攻撃のあと), o, st0 }
const pureAttack = (defMon, evadeNo, { withSpeed = false, field = null } = {}) => {
  for (const sp of PURE_ATTACKERS) {
    const am = pureOf(sp); if (!am) continue;
    for (const atk of plainAtk(sp)) {
      const st0 = scene([am.no, 'C-003', 'C-006'], [defMon.no, 'C-003', 'C-006'], withSpeed ? [atk.no, SPEED] : [atk.no], [evadeNo], field);
      if (!E.cardHasEff(atk, 'area') && evadeOf(defMon.main || defMon.species) && !(E.cardEff(E.cardOf(db, evadeNo), 'evade') || { kinds: [] }).kinds.includes(atk.kind)) continue;
      const o = E.cardAttackOptions(db, st0).find((x) => x.mon === 0 && x.hand.length === (withSpeed ? 2 : 1) && x.target && x.target.p === 1 && x.target.m === 0);
      if (o) return { st0, o, st: E.cardApplyAction(db, st0, o), atk };
    }
  }
  return null;
};
const canEvade = (st, evadeNo) => !!st && !!st.pending && E.cardGuardOptions(db, st).some((x) => st.players[1].hand[x.hand] === evadeNo);

rares.forEach((m) => {
  const ev = evadeOf(m.main);
  if (!ev) { check(`${m.name}: 材料(メインの種族の回避の札)`, false); return; }
  check(`${m.name}: 純血ではない・守りの札はメインの種族`, !E.cardIsPureMon({ ...m }) && !E.cardIsHybridMon({ ...m }));
  // A
  const a = pureAttack(m, ev.no, { withSpeed: true });
  check(`A ${m.name}: 純血のスピードを付けた技の場面が作れる`, !!a);
  if (a) check(`A ${m.name}: 純血のスピードを付けた技には、${ev.name}を出せない`, !canEvade(a.st, ev.no));
  // B
  const own = plainAtk(m.main)[0];
  if (own) {
    const st = scene([m.no, 'C-003', 'C-006'], ['C-001', 'C-003', 'C-006'], [own.no, SPEED], []);
    const withSpeed = E.cardAttackOptions(db, st).some((x) => x.mon === 0 && x.hand.length === 2);
    check(`B ${m.name}: 自分の技(${own.name})に純血のスピードを付けられない`, !withSpeed);
  }
  // C
  const c = pureAttack(m, ev.no, { field: PRIDE });
  if (c) check(`C ${m.name}: 純血のプライドのとき、純血の子の攻撃に${ev.name}を出せない`, !canEvade(c.st, ev.no));
  // D: この子が攻める・狙われるのはサブの種族の回避を持つ混血
  const hy = mons.find((x) => x.main && x.sub && x.sub !== 'unknown' && !x.variant && x.type === 'ground' && evadeOf(x.sub));
  if (own && hy) {
    const hev = evadeOf(hy.sub);
    const st0 = scene([m.no, 'C-003', 'C-006'], [hy.no, 'C-003', 'C-006'], [own.no], [hev.no], PRIDE);
    const o = E.cardAttackOptions(db, st0).find((x) => x.mon === 0 && x.target && x.target.p === 1 && x.target.m === 0);
    if (o) check(`D ${m.name}: プライドが場にあっても、この子の攻撃に混血の${hy.name}は${hev.name}を出せる`, canEvade(E.cardApplyAction(db, st0, o), hev.no));
  }
  // E
  const e = pureAttack(m, ev.no);
  if (e) check(`E ${m.name}: ふだんは${ev.name}を出せる(守りの札はメインの種族のまま)`, canEvade(e.st, ev.no));
  // F
  if (a) {
    const handCards = a.o.hand.map((i) => E.cardOf(db, a.st0.players[0].hand[i]));
    const ch = E.cardAiEvadeChance(db, a.st0, 0, handCards[0], a.o.target, { readHand: true }, E.cardAttachMods(handCards).flags, a.st0.players[0].mons[0]);
    check(`F ${m.name}: 純血のスピードのとき、回避されるとは見込まない`, ch === 0, `見込み ${ch}`);
  }
});
// くらべ: 純血のライガーは純血のスピードの技でも回避できる
{
  const liger = pureOf('tiger');
  const a = pureAttack(liger, '011', { withSpeed: true });
  check('くらべ 純血のライガーは、純血のスピードを付けた技にもバック転を出せる', !!a && canEvade(a.st, '011'));
}

if (fails.length) {
  console.error(`サブ？？？の子と純血の検査: NG ${fails.length}件(OK ${passed}件)`);
  fails.forEach((f) => console.error(`  NG: ${f}`));
  process.exit(1);
}
console.log(`サブ？？？の子と純血の検査: OK ${passed}件`);
