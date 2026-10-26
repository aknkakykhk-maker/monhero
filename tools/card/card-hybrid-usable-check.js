// MFバトルカードの混血(派生)が使える技を見る(2026-10-27 社長の決め・カード部ルールくん)。ブラウザなしで 82 を動かす。
//
//   node tools/card/card-hybrid-usable-check.js [--verbose]
//
// 決まり: 混血は、攻撃・特殊はメインの種族、防御・回避はサブの種族の技を使う。メインの種族の防御・回避は使えない。
//         サブが「？？？」(sub: 'unknown')の子は純血扱いで、防御・回避もメインの種族の技を使う
// 見るもの
//   A. サブのある混血: メインの攻撃・特殊は使える/メインの防御・回避は使えない/サブの防御・回避は使える/サブの攻撃・特殊は使えない
//   B. サブ？？？の子: メインの種族の技は、防御・回避も含めて全部使える
//   C. CPUのデッキの弾の上限: 混血の防御・回避はサブの種族の弾まで見る(サブ？？？はメインのまま)。攻撃はメインの弾
//   D. CPUの組んだデッキ: 技のカード(全員・ブリーダーを除く)は、どれもデッキの3体のだれかが使える
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardUsableBy, cardIsGuardKind, cardAiMonWave, cardAiBuildDeck, cardMonsterOf, cardOf, CARD_AI_DECKS, CARD_AI_BUILD };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };

const mons = Object.values(db.monsters);
const hybrids = mons.filter((m) => String(m.wave) === 'hybrid' && m.main);
const realSub = hybrids.filter((m) => m.sub && m.sub !== 'unknown');
const unknownSub = hybrids.filter((m) => m.sub === 'unknown');
const cards = Object.values(db.cards).filter((c) => c.ready && c.user !== 'any' && c.user !== 'breeder');
const live = (m) => ({ ...m, ko: false });
check('サブのある混血がいる', realSub.length > 0);
check('サブ？？？の子がいる', unknownSub.length > 0);

// ---- A ----
realSub.forEach((m) => {
  const bad = [];
  cards.forEach((c) => {
    const guard = E.cardIsGuardKind(c.kind);
    let want = null;
    if (c.user === m.main) want = !guard;
    else if (c.user === m.sub) want = guard;
    if (want === null) return;
    if (E.cardUsableBy(c, live(m)) !== want) bad.push(`${c.no} ${c.name}(${c.user}・${c.kind})は${want ? '使える' : '使えない'}はず`);
  });
  check(`A ${m.no} ${m.name}(メイン ${m.main}/サブ ${m.sub})`, bad.length === 0, bad.slice(0, 4).join(' / '));
});

// ---- B ----
unknownSub.forEach((m) => {
  const own = cards.filter((c) => c.user === m.main);
  const bad = own.filter((c) => !E.cardUsableBy(c, live(m))).map((c) => `${c.no} ${c.name}`);
  check(`B ${m.no} ${m.name}(サブ？？？)はメインの技を全部使える`, own.length > 0 && bad.length === 0, bad.slice(0, 4).join(' / '));
  check(`B ${m.no} ${m.name}にメインの防御・回避がある`, own.some((c) => E.cardIsGuardKind(c.kind)));
});

// ---- C ----
const baseWave = (sp) => { const x = mons.find((y) => !y.variant && y.species === sp && String(y.wave) !== 'hybrid'); return x ? Number(x.wave) || 1 : 4; };
const guardCard = cards.find((c) => E.cardIsGuardKind(c.kind));
const atkCard = cards.find((c) => !E.cardIsGuardKind(c.kind));
realSub.forEach((m) => {
  check(`C ${m.no} ${m.name}の防御・回避はサブの弾まで`, E.cardAiMonWave(db, m, guardCard) === baseWave(m.sub), `${E.cardAiMonWave(db, m, guardCard)} / ${baseWave(m.sub)}`);
  check(`C ${m.no} ${m.name}の攻撃はメインの弾まで`, E.cardAiMonWave(db, m, atkCard) === baseWave(m.main) && E.cardAiMonWave(db, m) === baseWave(m.main));
});
unknownSub.forEach((m) => check(`C ${m.no} ${m.name}(サブ？？？)の防御・回避はメインの弾`, E.cardAiMonWave(db, m, guardCard) === baseWave(m.main)));

// ---- D ----
let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
Object.keys(E.CARD_AI_DECKS).forEach((who) => Object.keys(E.CARD_AI_BUILD).forEach((lv) => {
  for (let i = 0; i < 4; i++) {
    const d = E.cardAiBuildDeck(db, who, lv, rand);
    const ms = d.monsters.map((no) => live(E.cardMonsterOf(db, no)));
    const dead = d.cards.map((no) => E.cardOf(db, no)).filter((c) => c && c.user !== 'any' && c.user !== 'breeder' && !ms.some((m) => E.cardUsableBy(c, m)));
    check(`D ${who} ${lv} ${i + 1}回目のデッキに、だれも使えない技がない`, dead.length === 0, dead.slice(0, 3).map((c) => `${c.no} ${c.name}`).join(' / '));
  }
}));

if (fails.length) {
  console.error(`混血の使える技の検査: NG ${fails.length}件(OK ${passed}件)`);
  fails.slice(0, 30).forEach((f) => console.error(`  NG: ${f}`));
  process.exit(1);
}
console.log(`混血の使える技の検査: OK ${passed}件`);
