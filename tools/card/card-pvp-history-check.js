#!/usr/bin/env node
// MFバトルカードのマルチの履歴(92-card-pvp-history.jsx)の「純粋な計算」を確かめる(2026-10-27・カード部 ツナグくん)。
// 案: docs/progress/card-multi-plus/README.md の案1
//
//   node tools/card/card-pvp-history-check.js
//
//   ① 部屋のようすから1行を作る: 封が「合っている」試合は相手のデッキを全部・相手が抜けた試合は使われた札だけ
//   ② 壊れた保存値を読んでも落ちない(空・知らない形・長すぎる文字・同じ試合の重なり)
//   ③ 30試合まで・同じ試合は上書き・新しい試合が先頭
//   ④ 強さの点数の増減(+16・-14・±0)と、同じ札のまとめ
//   ⑤ 日時は日本の時刻
const fs = require('fs'), path = require('path'), vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const src = fs.readFileSync(path.join(GAME, 'src/parts/92-card-pvp-history.jsx'), 'utf8').split('// ---- 保存(')[0];
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Date });
vm.runInContext(`${src}\n;this.E = { cardPvpNormalizeHistory, cardPvpHistoryEntryOf, cardPvpHistoryAdd, cardPvpHistorySetRating, cardPvpDeckGroups, cardPvpRatingDelta, cardPvpHistoryWhen, CARD_PVP_HISTORY_MAX };`, ctx);
const E = ctx.E;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const myDeck = { name: 'わたしのデッキ', monsters: ['M-1', 'M-2', 'M-3'], cards: Array.from({ length: 50 }, (_, i) => `0${10 + (i % 17)}`) };
const foeDeck = { monsters: ['M-7', 'M-8', 'M-9'], cards: Array.from({ length: 50 }, (_, i) => `1${10 + (i % 17)}`) };
const room = (verify, extra = {}) => ({
  match: 'mabc12345', mode: 'free', me: { bid: 'me-1', dn: 'わたしのデッキ' }, deck: myDeck,
  foe: { bid: 'foe-1', name: 'あいて', icon: 'snegurochka', fr: null, dn: 'あいてのデッキ' },
  foeOpen: verify === 'skip' ? null : { deck: foeDeck },
  history: [{ by: 1, act: {}, reveal: { 0: '111' } }, { by: 0, act: {}, reveal: {} }, { by: 1, act: {}, reveal: { 2: '112', 3: '111' } }],
  result: { outcome: 'win', reason: verify === 'skip' ? '相手が抜けた' : '勝ち', facts: { ownTurns: 7 }, verify },
  ...extra,
});

// ①
const ok = E.cardPvpHistoryEntryOf(room('ok'), 1000);
check('① 封が合った試合は、相手のデッキを全部(3体と50枚)', ok && ok.foeDeck && ok.foeDeck.monsters.length === 3 && ok.foeDeck.cards.length === 50 && ok.foeSeen.length === 0);
check('① 相手の名前・アイコン・デッキ名・自分のデッキ・部屋の種類', ok.foe.name === 'あいて' && ok.foe.icon === 'snegurochka' && ok.foe.deckName === 'あいてのデッキ' && ok.myDeck.cards.length === 50 && ok.myDeck.name === 'わたしのデッキ' && ok.room === 'free' && ok.turns === 7);
const left = E.cardPvpHistoryEntryOf(room('skip'), 1000);
check('① 相手が抜けた試合は、相手のデッキを持たず、使われた札だけ', left && left.foeDeck === null && left.foeSeen.join(',') === '111,112,111', JSON.stringify(left && left.foeSeen));
const ng = E.cardPvpHistoryEntryOf(room('ng'), 1000);
check('① 合わなかった試合は、届いたデッキを信じない(使われた札だけ)', ng && ng.foeDeck === null && ng.verify === 'ng');
check('① 試合の番号が無い・結果が無いときは作らない', E.cardPvpHistoryEntryOf({ ...room('ok'), match: '' }) === null && E.cardPvpHistoryEntryOf({ ...room('ok'), result: null }) === null);

// ②
check('② 壊れた保存値は空', [null, 1, 'x', {}, undefined].every((v) => E.cardPvpNormalizeHistory(v).length === 0));
const messy = E.cardPvpNormalizeHistory([null, { match: 'a' }, { match: 'b', at: 5, foe: 3, foeDeck: 'x', rating: { before: 'a' } }, { match: 'b', at: 6 }, { match: 'x'.repeat(99), at: 1, outcome: 'win', foe: { name: 'n'.repeat(99) } }]);
check('② 時刻の無い行は捨て、同じ試合は先の1行だけ・長い文字は切る', messy.length === 2 && messy[0].match === 'b' && messy[0].at === 5 && messy[0].foeDeck === null && messy[0].rating === null && messy[1].match.length === 40 && messy[1].foe.name.length === 40, JSON.stringify(messy.map((x) => x.match.length)));
check('② 知らない部屋の種類・勝ち負けは、合言葉・負けで読む', messy[0].room === 'private' && messy[0].outcome === 'lose');

// ③
let list = [];
for (let i = 0; i < 40; i++) list = E.cardPvpHistoryAdd(list, { ...ok, match: `m${String(i).padStart(8, '0')}`, at: i });
check(`③ ${E.CARD_PVP_HISTORY_MAX}試合まで・新しい試合が先頭`, list.length === E.CARD_PVP_HISTORY_MAX && list[0].at === 39 && list[list.length - 1].at === 10);
list = E.cardPvpHistoryAdd(list, { ...ok, match: 'm00000039', at: 99, outcome: 'lose' });
check('③ 同じ試合は上書き(増えない)', list.length === E.CARD_PVP_HISTORY_MAX && list[0].at === 99 && list[0].outcome === 'lose' && list.filter((x) => x.match === 'm00000039').length === 1);
list = E.cardPvpHistorySetRating(list, 'm00000030', { before: 1500, after: 1516 });
check('③ 点数の増減をあとから書ける(ほかの行は変えない)', list.find((x) => x.match === 'm00000030').rating.after === 1516 && list.filter((x) => x.rating).length === 1);

// ④
check('④ 点数の増減の表示', E.cardPvpRatingDelta({ before: 1500, after: 1516 }) === '+16' && E.cardPvpRatingDelta({ before: 1500, after: 1486 }) === '-14' && E.cardPvpRatingDelta({ before: 1500, after: 1500 }) === '±0' && E.cardPvpRatingDelta(null) === '');
const g = E.cardPvpDeckGroups(['a', 'b', 'a', 'c', 'a', 'b']);
check('④ 同じ札は1つにまとめて枚数(入れた順のまま)', JSON.stringify(g) === JSON.stringify([{ no: 'a', n: 3 }, { no: 'b', n: 2 }, { no: 'c', n: 1 }]));
check('④ 50枚の合計は崩れない', E.cardPvpDeckGroups(foeDeck.cards).reduce((a, x) => a + x.n, 0) === 50);

// ⑤
check('⑤ 日時は日本の時刻', E.cardPvpHistoryWhen(Date.UTC(2026, 9, 26, 15, 5)) === '10/27 00:05', E.cardPvpHistoryWhen(Date.UTC(2026, 9, 26, 15, 5)));

if (failed) { console.log(`\nNG: ${failed} 件`); process.exit(1); }
console.log('\nすべて OK');
