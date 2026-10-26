// MFバトルカードの「相手の助手のデッキ名」(83-card-battle-vs.jsx)を、ブラウザなしで確かめる(2026-10-26)。
//
//   node tools/card/card-deck-name-check.js
//
// 【なぜ要るか】
// デッキ名は「(助手)の(まんなか)(しめ)」を言葉の部品から組む。見本に「あつのまとめてまとめてドーン組」が出た
// (まんなかの「まとめて」と、しめの「まとめてドーン組」が重なった)。部品を足したときに同じ重なりを作らないよう、
// まんなかになりうる言葉(型の言葉・血統の「一家」「コンビ」・好きな子の名前)と、助手ごとのしめを全部組み合わせて見る。
//
// 【見るもの】
// ① まんなか × しめの全部の組み合わせで、重なるものがあっても、組み方(cardDeckNamePick)が重ならない名前を選ぶ
// ② 助手ごと・強さごとに実際に組んだデッキで何度も名付けて、重なった名前・空の名前・長すぎる名前が出ない
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const vsSrc = fs.readFileSync(path.join(GAME, 'src', 'parts', '83-card-battle-vs.jsx'), 'utf8');
// 画面(JSX)の手前までが、言葉の部品と名付けの決まり
const vsPure = vsSrc.slice(0, vsSrc.indexOf('// 画面。intro = '));
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n${vsPure}\n;\n`
  + 'globalThis.__vs = { CARD_BATTLE_DATA, CARD_DECK_NAME_TAILS, CARD_AI_FAVORITE, CARD_DECK_NAME_MAX, cardAiBuildDeck, cardDeckFacts, cardDeckNamePick, cardDeckWordsOverlap, cardAssistantDeckName, cardLineageName };', ctx, { filename: '83-card-battle-vs.jsx' });
const V = ctx.__vs;
const db = V.CARD_BATTLE_DATA;
const who = Object.keys(V.CARD_DECK_NAME_TAILS);

// まんなかになりうる言葉
const styleWords = ['まとめて', 'カチコチ', 'しぶとい', 'パワー', 'かしこ'];
const species = [...new Set(Object.values(db.monsters).filter((m) => m && !m.main).map((m) => m.species))];
const lineWords = species.flatMap((sp) => { const n = V.cardLineageName(db, sp); return n ? [n, `${n}一家`, `${n}コンビ`] : []; });
const middles = [...styleWords, ...lineWords];
check('まんなかの言葉を集められた', middles.length > 20, `${middles.length}語`);

// ① 全部の組み合わせ: 重なる組を数え、組み方がそれを避けるか
const overlaps = [];
for (const w of who) for (const m of middles) for (const t of V.CARD_DECK_NAME_TAILS[w]) if (V.cardDeckWordsOverlap(m, t)) overlaps.push(`${w}:${m}+${t}`);
console.log(`   重なりうる組み合わせ ${overlaps.length}件(例: ${overlaps.slice(0, 4).join(' / ')})`);
check('「まとめて」と「まとめてドーン組」は重なりとみる', V.cardDeckWordsOverlap('まとめて', 'まとめてドーン組'));
check('重ならない言葉は重なりとみない', !V.cardDeckWordsOverlap('モッチー', 'まっしぐら隊'));
// まんなかが型の言葉になる中身を作って、どのしめを引いても重ならないこと
const fakeFacts = (word) => {
  const base = { mons: [], sameLine: null, area: 0, guard: 0, heal: 0, pow: 10, int: 10 };
  if (word === 'まとめて') return { ...base, area: 99 };
  if (word === 'カチコチ') return { ...base, guard: 99 };
  if (word === 'しぶとい') return { ...base, heal: 99 };
  if (word === 'パワー') return { ...base, pow: 99, int: 1 };
  return { ...base, pow: 1, int: 99 };
};
const bad1 = [];
for (const w of who) {
  const favMon = Object.values(db.monsters).find((m) => m && m.species === V.CARD_AI_FAVORITE[w] && !m.main);
  for (const word of styleWords) {
    for (let r = 0; r < 40; r++) {
      const facts = { ...fakeFacts(word), mons: favMon ? [favMon] : [] };
      const rnd = ((k) => () => ((k = (k * 9301 + 49297) % 233280) / 233280))(r + 1);
      const { middle, tail } = V.cardDeckNamePick(db, facts, w, { favorite: V.CARD_AI_FAVORITE[w], preferFavorite: false, rnd });
      if (!middle || !tail || V.cardDeckWordsOverlap(middle, tail)) bad1.push(`${w}:${middle}${tail}`);
    }
  }
}
check('型の言葉がまんなかでも、しめと重ならない名前を選ぶ', bad1.length === 0, bad1.slice(0, 5).join(' / '));

// ② 実際に組んだデッキで名付ける
const bad2 = [];
let n = 0;
for (const w of who) for (const lv of ['easy', 'normal', 'hard', 'expert', 'master']) {
  for (let i = 0; i < 40; i++) {
    const deck = V.cardAiBuildDeck(db, w, lv, Math.random, { playerDeck: null });
    const name = V.cardAssistantDeckName(db, deck, w, lv);
    n++;
    const body = name.replace(/^[^の]+の(本気の)?/, '');
    const tail = V.CARD_DECK_NAME_TAILS[w].find((t) => body.endsWith(t));
    const middle = tail ? body.slice(0, body.length - tail.length) : body;
    if (!tail || !middle || V.cardDeckWordsOverlap(middle, tail) || name.length > V.CARD_DECK_NAME_MAX + 4) bad2.push(name);
  }
}
check(`実際に組んだデッキ ${n}回で、重なり・空・長すぎる名前が出ない`, bad2.length === 0, bad2.slice(0, 5).join(' / '));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
