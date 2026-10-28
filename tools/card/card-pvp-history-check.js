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
//   ⑧ 記録の「強さの移り」のグラフ: 点数の分かる試合を古い順に20まで・付け直しの時刻より前の試合は入れない(2026-10-28)
//   ⑥ 書けないときの守り: いっぱいなら古い試合から減らして書く・ゲーム全体の保存(storeSet)は使わない・まったく入らなければあきらめる
const fs = require('fs'), path = require('path'), vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const src = fs.readFileSync(path.join(GAME, 'src/parts/92-card-pvp-history.jsx'), 'utf8').split('// ---- 保存(')[0];
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Date });
vm.runInContext(`${src}\n;this.E = { cardPvpNormalizeHistory, cardPvpHistoryEntryOf, cardPvpHistoryAdd, cardPvpHistorySetRating, cardPvpDeckGroups, cardPvpRatingDelta, cardPvpHistoryWhen, cardPvpRatingChart, CARD_PVP_HISTORY_MAX };`, ctx);
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

// ⑦ 履歴があるのに読めないときは書かない(案1)
// ⑧
const ch = Array.from({ length: 25 }, (_, i) => ({ match: `c${i}`, at: 1000 - i * 10, rating: i === 3 ? null : { before: 1500, after: 1500 + i } })); // 新しい順
const c0 = E.cardPvpRatingChart(ch, 0);
check('⑧ グラフは点数の分かる試合を20まで・古い順(付け直し前)', c0.length === 20 && c0[19].match === 'c0' && !c0.some((x) => x.match === 'c3'));
const c1 = E.cardPvpRatingChart(ch, 955);
check('⑧ 付け直しの時刻より前に終わった試合は、グラフに入れない', c1.length === 4 && c1.every((x) => x.at >= 955) && c1[3].match === 'c0', c1.map((x) => x.match).join(','));
check('⑧ 時刻の無い試合は、付け直しのあとは入れない・壊れた履歴でも落ちない', E.cardPvpRatingChart([{ match: 'x', rating: { before: 1, after: 2 } }], 5).length === 0 && E.cardPvpRatingChart(null, 5).length === 0);

// ⑥ 書けないときの守り(保存の見回り 2026-10-27): localStorage がいっぱいなら古い試合から減らして書く・ゲーム全体の保存(storeSet)は使わない
(async () => {
  const full = fs.readFileSync(path.join(GAME, 'src/parts/92-card-pvp-history.jsx'), 'utf8');
  const save = full.slice(full.indexOf('// ---- 保存('), full.indexOf('// ---- 強さの点数の増減'));
  const mem = {};
  let limit = 1e9, storeSetCalls = 0, readFail = false;
  const ls = {
    setItem: (k, v) => { const used = Object.entries(mem).filter(([x]) => x !== k).reduce((a, [, x]) => a + x.length, 0); if (used + String(v).length > limit) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } mem[k] = String(v); },
    getItem: (k) => (k in mem ? mem[k] : null), removeItem: (k) => { delete mem[k]; },
  };
  const c2 = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Date, window: { localStorage: ls },
    storeGet: async (k, d) => (!readFail && k in mem ? JSON.parse(mem[k]) : d), storeSet: async () => { storeSetCalls += 1; return false; },
    hasWinStorage: () => false, isStorageWriteBlocked: () => false });
  vm.runInContext(`${src}\n${save}\n;this.S = { cardPvpHistoryWrite, cardPvpHistoryAdd, CARD_PVP_HISTORY_ROOM };`, c2);
  const S = c2.S;
  const one = (i) => ({ ...ok, match: `m${String(i).padStart(8, '0')}`, at: i });
  let got = await S.cardPvpHistoryWrite((l) => S.cardPvpHistoryAdd(l, one(1)));
  check('⑥ 空きがあれば、そのまま書ける(ゲーム全体の保存は使わない)', got && got.length === 1 && storeSetCalls === 0 && JSON.parse(mem.mh_card_pvp_history_v1).length === 1);
  for (let i = 2; i <= 10; i++) await S.cardPvpHistoryWrite((l) => S.cardPvpHistoryAdd(l, one(i)));
  const per = mem.mh_card_pvp_history_v1.length / 10;
  // 残す空き(128KB)を入れて、6試合ぶんしか入らない大きさにする
  limit = S.CARD_PVP_HISTORY_ROOM + Math.floor(per * 6.5);
  got = await S.cardPvpHistoryWrite((l) => S.cardPvpHistoryAdd(l, one(11)));
  const saved = JSON.parse(mem.mh_card_pvp_history_v1);
  check('⑥ いっぱいなら、古い試合から減らして書く(いちばん新しい試合は残る)', got && saved.length >= 1 && saved.length <= 6 && saved[0].match === 'm00000011', `${saved.length}試合・先頭 ${saved[0] && saved[0].match}`);
  check('⑥ いっぱいでも、ゲーム全体の保存(storeSet)は呼ばない', storeSetCalls === 0);
  limit = 10;
  got = await S.cardPvpHistoryWrite((l) => S.cardPvpHistoryAdd(l, one(12)));
  check('⑥ まったく入らないときは、あきらめて落ちない', got === null);
  // ⑦ 端末に履歴があるのに読めない(読み違え・形が壊れている)ときは、書かずに今までの対戦を残す(93 の見返しと同じ守り・2026-10-27 案1)
  limit = 1e9;
  const before = mem.mh_card_pvp_history_v1;
  readFail = true;
  got = await S.cardPvpHistoryWrite((l) => S.cardPvpHistoryAdd(l, one(13)));
  readFail = false;
  check('⑦ 履歴があるのに読めないときは、書かずに今までの対戦を残す', got === null && mem.mh_card_pvp_history_v1 === before);
  mem.mh_card_pvp_history_v1 = '{"broken"';
  got = await S.cardPvpHistoryWrite((l) => S.cardPvpHistoryAdd(l, one(14))).catch(() => null);
  check('⑦ 形が壊れているときも、書かずに残す', got === null && mem.mh_card_pvp_history_v1 === '{"broken"');
  delete mem.mh_card_pvp_history_v1;
  got = await S.cardPvpHistoryWrite((l) => S.cardPvpHistoryAdd(l, one(15)));
  check('⑦ まだ履歴が無ければ、ふつうに書ける', got && got.length === 1 && JSON.parse(mem.mh_card_pvp_history_v1).length === 1);
  if (failed) { console.log(`\nNG: ${failed} 件`); process.exit(1); }
  console.log('\nすべて OK');
})();

