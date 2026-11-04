// MFバトルカード: 場の全体カードで使えない技を、AI(助手)が手札に温存しないか(2026-11-04 社長「必殺技の封印を使ってるのに、威力が高い技を温存して、ほかをガッツにする」)
//
//   node tools/card/card-ai-field-ban-guts-check.js
//
// 見るもの(助手全員 × 全部の強さ。ガッツにする札を選ぶ cardAiChooseGuts)
//   ① 必殺技の封印(ダメージ4以上が使えない): 使えない強い技を、使える技より先にガッツにする(使える技を残す)
//   ② 必殺技の応酬(ダメージ3以下が使えない): 使えない弱い技を、使える強い技より先にガッツにする
//   ③ がんじがらめ(特殊技が使えない): 使えない特殊技を、使える技より先にガッツにする
//   ④ 場が無いときは、強い技を残し弱い技からガッツにする(これまでどおり)
//   ⑤ 自分の手札に全体カード(場を替えられる)があっても、使えない技は使える技より先にガッツにする
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardAiChooseGuts, cardAiPolicy, CARD_AI_HABITS, CARD_AI_LEVELS, cardUsableBy, cardIsGuardKind };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
let failed = 0, passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) passed++; else { failed++; fails.push(`${name}${detail ? ` — ${detail}` : ''}`); } };

// モッチー3体の場。ちから・かしこさの技(効果なし)から強い札・弱い札、特殊技、守り、全体カードを選ぶ
const mon = Object.values(db.monsters).find((m) => m.species === 'mocchi' && !m.main && !m.variant);
const own = Object.values(db.cards).filter((c) => c.ready !== false && c.user !== 'breeder' && E.cardUsableBy(c, { ...mon, ko: false }));
const plain = own.filter((c) => (c.kind === 'pow' || c.kind === 'int') && !(c.effects || []).length);
const strong = plain.find((c) => c.damage >= 4);
const weak = plain.filter((c) => c.damage >= 2 && c.damage <= 3);
const spe = own.find((c) => c.kind === 'spe');
const guard = own.find((c) => E.cardIsGuardKind(c.kind));
const fld = Object.values(db.cards).find((c) => c.kind === 'fld' && c.no !== 'F258');
if (!strong || weak.length < 2 || !spe || !guard || !fld) { console.error('NG: 場面に使う札が見つからない'); process.exit(1); }

const LEVELS = Object.keys(E.CARD_AI_LEVELS);
const HABITS = Object.keys(E.CARD_AI_HABITS);
// hand の札をガッツにする順(cardAiChooseGuts が返す並び。返さなかった札は残す)
const picksOf = (hand, fieldNo, who, lv) => {
  const decks = [0, 1].map(() => ({ monsters: [mon.no, mon.no, mon.no], cards: Array(50).fill('100') }));
  let st = E.cardCreateGame(db, { decks, seed: 7, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players.forEach((pl) => { pl.hand = hand.slice(); pl.guts = Array(2).fill('100'); pl.deck = Array(30).fill('100'); pl.discard = []; });
  st.active = 0; st.phase = 'guts';
  st.field = fieldNo ? { no: fieldNo, p: 1, effects: db.cards[fieldNo].effects.map((e) => ({ ...e })) } : null;
  return E.cardAiChooseGuts(db, st, E.cardAiPolicy(who, lv), null).hand.map((i) => hand[i]);
};
// banned を usable より先にガッツへ回しているか(banned が残っていて usable を捨てている・banned より先に usable を捨てている、をだめとする)
const before = (picks, banned, usable) => {
  const ib = picks.indexOf(banned), iu = picks.indexOf(usable);
  if (iu < 0) return true;           // 使える札を捨てていない
  return ib >= 0 && ib < iu;         // 捨てるなら使えない札が先
};
for (const who of HABITS) for (const lv of LEVELS) {
  const tag = `${who} ${lv}`;
  const w0 = weak[0].no, w1 = weak[1].no;
  const p1 = picksOf([strong.no, w0, w1, guard.no], 'F258', who, lv);
  check(`① 封印: 使えない強い技を先にガッツ(${tag})`, before(p1, strong.no, w0) && before(p1, strong.no, w1), p1.map((n) => db.cards[n].name).join('・'));
  const p2 = picksOf([strong.no, w0, guard.no], 'F119', who, lv);
  check(`② 応酬: 使えない弱い技を先にガッツ(${tag})`, before(p2, w0, strong.no), p2.map((n) => db.cards[n].name).join('・'));
  const p3 = picksOf([spe.no, w0, guard.no], 'F257', who, lv);
  check(`③ がんじがらめ: 使えない特殊技を先にガッツ(${tag})`, before(p3, spe.no, w0), p3.map((n) => db.cards[n].name).join('・'));
  const p4 = picksOf([strong.no, w0, w1, guard.no], null, who, lv);
  check(`④ 場が無いときは強い技を残す(${tag})`, before(p4, w0, strong.no), p4.map((n) => db.cards[n].name).join('・'));
  const p5 = picksOf([strong.no, w0, fld.no, guard.no], 'F258', who, lv);
  check(`⑤ 手札に全体カードがあっても、使えない技が先(${tag})`, before(p5, strong.no, w0), p5.map((n) => db.cards[n].name).join('・'));
}
if (failed) { console.error(`NG ${failed}件 / OK ${passed}件\n${fails.slice(0, 12).map((f) => `  ✗ ${f}`).join('\n')}`); process.exitCode = 1; }
else console.log(`すべてOK(${passed}件)`);
