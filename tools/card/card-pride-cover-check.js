// MFバトルカード: 全体カード「純血のプライド」は、味方をかばう回避(みんな下がれ)も止める(2026-10-27 社長・案A・カード部ルールくん)。
// ブラウザなしで 82 を動かす。
//
//   node tools/card/card-pride-cover-check.js [--verbose]
//
// 決まり: 純血の子の攻撃に、派生の子は回避を使えない。純血の子が「みんな下がれ」を出しても、派生の味方は一緒に回避できない
// 見るもの
//   A. プライドあり・純血の子の全体攻撃 → みんな下がれ: 純血の子は回避、派生の味方には当たる
//   B. プライドなし → これまでどおり全員が回避
//   C. プライドあり・攻めるのが派生の子 → プライドは効かず、全員が回避
//   D. 先に狙われたのが派生の子(みんな下がれを出せない)→ 次の純血の子が出す → 残りの派生の子にも当たる(総点検E・ナガメくんの場面2)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardAttackOptions, cardGuardOptions, cardOf, cardHasEff, cardIsHybridMon };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };

const mons = Object.values(db.monsters);
const pureOf = (sp) => (mons.find((m) => m.species === sp && !m.main && !m.variant) || {}).no;
const AREA = '104'; // さくら吹雪(モッチー・かしこさ・全員に当たる)
const EVADE_ALL = '123'; // みんな下がれ(全モンスター)
const PRIDE = 'F255';
const hybridMocchi = mons.find((m) => m.main === 'mocchi' && m.sub && m.sub !== 'unknown' && !m.variant); // メインがモッチーの混血(さくら吹雪を使える)
const hybridDef = mons.find((m) => m.main && m.sub && m.sub !== 'unknown' && !m.variant && m.main !== 'mocchi');
const hybridDef2 = mons.find((m) => m.main && m.sub && m.sub !== 'unknown' && !m.variant && m.main !== 'mocchi' && m.species !== (hybridDef || {}).species);
const atkPure = [pureOf('mocchi'), pureOf('golem'), pureOf('dino')];
const defTeam = [pureOf('golem'), hybridDef && hybridDef.no, pureOf('dino')];
check('材料がそろう', atkPure.every(Boolean) && defTeam.every(Boolean) && !!hybridMocchi && E.cardHasEff(E.cardOf(db, AREA), 'area') && E.cardHasEff(E.cardOf(db, EVADE_ALL), 'evadeAll') && !!db.cards[PRIDE],
  JSON.stringify({ atkPure, defTeam, hm: hybridMocchi && hybridMocchi.no }));

const run = ({ attackers, pride, defenders = defTeam }) => {
  const decks = [{ monsters: attackers, cards: Array(50).fill('100') }, { monsters: defenders, cards: Array(50).fill('100') }];
  let st = E.cardCreateGame(db, { decks, seed: 7, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players[0].hand = [AREA]; st.players[1].hand = [EVADE_ALL];
  st.players.forEach((pl) => { pl.guts = Array(10).fill('100'); });
  st.active = 0; st.phase = 'main';
  if (pride) st.field = { no: PRIDE, p: 0, effects: db.cards[PRIDE].effects };
  const life0 = st.players[1].mons.map((m) => m.life);
  const o = E.cardAttackOptions(db, st).find((x) => x.mon === 0 && x.hand.length === 1);
  if (!o) return { noAttack: true };
  st = E.cardApplyAction(db, st, o);
  let offered = false;
  for (let i = 0; st && st.pending && i < 20; i++) {
    const g = E.cardGuardOptions(db, st).find((x) => st.players[1].hand[x.hand] === EVADE_ALL);
    if (g) offered = true;
    st = E.cardApplyAction(db, st, g || { type: 'pass' });
  }
  return { offered, dmg: st.players[1].mons.map((m, i) => life0[i] - m.life) };
};

// ---- A ----
{
  const r = run({ attackers: atkPure, pride: true });
  check('A 純血の子が狙われた番に、みんな下がれを出せる', r.offered, JSON.stringify(r));
  check('A 純血の子は回避する', !!r.dmg && r.dmg[0] === 0 && r.dmg[2] === 0, JSON.stringify(r.dmg));
  check('A 派生の味方は一緒に回避できず、当たる', !!r.dmg && r.dmg[1] > 0, JSON.stringify(r.dmg));
}
// ---- B ----
{
  const r = run({ attackers: atkPure, pride: false });
  check('B プライドなしなら全員が回避', r.offered && !!r.dmg && r.dmg.every((d) => d === 0), JSON.stringify(r));
}
// ---- C ----
{
  const r = run({ attackers: [hybridMocchi.no, pureOf('golem'), pureOf('dino')], pride: true });
  check('C 攻めるのが派生の子なら、プライドは効かず全員が回避', r.offered && !!r.dmg && r.dmg.every((d) => d === 0), JSON.stringify(r));
}

// ---- D ----
{
  const defs = [hybridDef.no, pureOf('golem'), hybridDef2.no];
  const r = run({ attackers: atkPure, pride: true, defenders: defs });
  check('D 次に狙われた純血の子が、みんな下がれを出せる', r.offered, JSON.stringify(r));
  check('D 純血の子は回避し、前後の派生の子には当たる', !!r.dmg && r.dmg[0] > 0 && r.dmg[1] === 0 && r.dmg[2] > 0, JSON.stringify(r.dmg));
  const r2 = run({ attackers: atkPure, pride: false, defenders: defs });
  check('D プライドなしなら全員が回避', r2.offered && !!r2.dmg && r2.dmg.every((d) => d === 0), JSON.stringify(r2));
}

if (fails.length) {
  console.error(`純血のプライドとみんな下がれの検査: NG ${fails.length}件(OK ${passed}件)`);
  fails.forEach((f) => console.error(`  NG: ${f}`));
  process.exit(1);
}
console.log(`純血のプライドとみんな下がれの検査: OK ${passed}件`);
