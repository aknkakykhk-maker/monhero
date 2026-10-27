// AIコピー(ソラシドのアシカの5人目)の共通の部品(33-ai-copy.jsx)を確かめる。タクティクスと5つの遊びで同じ関数を使う。
//
//   node tools/battle/ai-copy-check.js
//
// 見ること:
//   ・出す: 使ったターンの次から出る/強さと続くターンは開発部の計算どおり/ライフはタクティクスだけ/固有技の写しが山札に1枚足される
//   ・もう一度(同じ子): 続くターンだけ最初へ戻る(写しは1枚のまま)/切りかえ(別の子): 前の写しを抜いて新しい写しを1枚
//   ・数える: ターンの終わりに1つ減る。0 で外れ、写しが山札・手札・捨て札のどこからも抜ける
//   ・ターンの始め: コピーの手札に写しが入り、使うカードは0〜上限枚、先頭が「次に使うカード」。みんなの山札は減らない
//   ・遊びごとの足しもの(タクティクスの置き場所・ヘイト)は extra でそのまま持てる
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const breeder = read('monster-hero/data/breeder.js');
const grabArray = (name) => { const i = breeder.indexOf(`const ${name} = `); return breeder.slice(i, breeder.indexOf('\n];', i) + 3).replace(/^const /, 'var '); };
const ctx = { console, Math, JSON, Object, Array, Number, String };
vm.createContext(ctx);
vm.runInContext(`${grabArray('SORASHIDO_TIERS')}
${read('monster-hero/src/parts/32-sorashido-copy.jsx')}
${read('monster-hero/src/parts/33-ai-copy.jsx')}
globalThis.__s = { SORASHIDO_TIERS, aiCopyRules, isAiCopyOut, summonAiCopy, dismissAiCopy, tickAiCopy, planAiCopyTurn, aiCopyAutoScore };`, ctx);
const s = ctx.__s;

const src = { maxHp: 1000, atk: 200, def: 100, maxGuts: 150 };
const uniqueOf = (id) => ({ id: `u-${id}`, uid: `u-${id}`, type: 'unique', name: `${id}の固有技`, guts: 30 });
const card = (n, type = 'atk', guts = 20) => ({ id: `c${n}`, uid: `c${n}`, type, name: `札${n}`, guts });
const deck0 = [card(1), card(2), card(3, 'guard', 0), card(4, 'range_atk'), card(5)];
const zones0 = { deck: deck0, hand: [card(9)], discard: [] };
const uniqCount = (z) => ['deck', 'hand', 'discard'].reduce((n, k) => n + (z[k] || []).filter((c) => c && c.sorashidoCopyOf != null).length, 0);

// ---- 出す ----
const a = s.summonAiCopy({ aiCopy: null, zones: zones0 }, { srcSlot: 1, srcMonsterId: 'golem', name: 'ゴーレム', level: 0, src, uniqueCard: uniqueOf('golem'), turn: 3, mode: 'tactics', extra: { pos: 2, hate: 10 } });
check('新しく出す(kind new)', a.plan.kind === 'new');
check('使ったターンの次から出る', !s.isAiCopyOut(a.aiCopy, 3) && s.isAiCopyOut(a.aiCopy, 4), `spawnTurn ${a.aiCopy.spawnTurn}`);
check('続くターンは Lv1 で 2', a.aiCopy.turnsLeft === 2);
check('強さは Lv1 の割合(ライフ50%・ちから60%・丈夫さ50%・ガッツ60%)', a.aiCopy.maxHp === 500 && a.aiCopy.atk === 120 && a.aiCopy.def === 50 && a.aiCopy.maxGuts === 90, JSON.stringify({ hp: a.aiCopy.maxHp, atk: a.aiCopy.atk, def: a.aiCopy.def, guts: a.aiCopy.maxGuts }));
check('固有技の写しが山札に1枚足される', uniqCount(a.zones) === 1 && a.zones.deck.length === deck0.length + 1 && a.aiCopy.uniqueCardUid);
check('元の山札は書き換えない', deck0.length === 5 && zones0.deck === deck0);
check('遊びごとの足しもの(置き場所・ヘイト)を持てる', a.aiCopy.pos === 2 && a.aiCopy.hate === 10);
const c = s.summonAiCopy({ aiCopy: null, zones: zones0 }, { srcSlot: 0, srcMonsterId: 'golem', level: 0, src, uniqueCard: uniqueOf('golem'), turn: 1, mode: 'classic' });
check('5つの遊びのコピーはライフを持たない', c.aiCopy.hp === undefined && c.aiCopy.maxHp === undefined && c.aiCopy.maxGuts === 90);

// ---- もう一度・切りかえ ----
const worn = { ...a, aiCopy: { ...a.aiCopy, turnsLeft: 1 } };
const r = s.summonAiCopy(worn, { srcSlot: 1, srcMonsterId: 'golem', level: 1, src, uniqueCard: uniqueOf('golem'), turn: 5 });
check('同じ子でもう一度: 続くターンだけ最初へ(Lv2 は3)', r.plan.kind === 'refresh' && r.aiCopy.turnsLeft === 3 && r.aiCopy.spawnTurn === a.aiCopy.spawnTurn);
check('もう一度でも写しは1枚のまま', uniqCount(r.zones) === 1);
const sw = s.summonAiCopy(a, { srcSlot: 0, srcMonsterId: 'tiger', level: 0, src, uniqueCard: uniqueOf('tiger'), turn: 5 });
check('別の子へ切りかえ', sw.plan.kind === 'switch' && sw.aiCopy.srcMonsterId === 'tiger' && sw.aiCopy.spawnTurn === 6);
check('切りかえで前の写しを抜き、新しい写しを1枚', uniqCount(sw.zones) === 1 && sw.zones.deck.some((x) => x.sorashidoCopyOf === 'tiger') && !sw.zones.deck.some((x) => x.sorashidoCopyOf === 'golem'));

// ---- 数える・外す ----
const notYet = s.tickAiCopy(a, 3);
check('出る前のターンは数えない', notYet.aiCopy.turnsLeft === 2);
const t1 = s.tickAiCopy(a, 4);
check('ターンの終わりに1つ減る', t1.aiCopy && t1.aiCopy.turnsLeft === 1 && !t1.expired);
const handHas = { aiCopy: t1.aiCopy, zones: { ...t1.zones, hand: [...t1.zones.hand, t1.zones.deck.find((x) => x.sorashidoCopyOf)], deck: t1.zones.deck.filter((x) => !x.sorashidoCopyOf), discard: [] } };
const t2 = s.tickAiCopy(handHas, 5);
check('0 で外れる', t2.aiCopy === null && t2.expired === true);
check('外れたら写しは手札からも抜ける', uniqCount(t2.zones) === 0);
const d = s.dismissAiCopy({ aiCopy: a.aiCopy, zones: { deck: [], hand: [], discard: [a.zones.deck[a.zones.deck.length - 1]] } });
check('倒された・WAVE の終わりで外すと、捨て札の写しも抜ける', d.aiCopy === null && uniqCount(d.zones) === 0);
check('コピーがいなければ外しても何も変わらない', s.dismissAiCopy({ aiCopy: null, zones: zones0 }).zones === zones0);

// ---- ターンの始め ----
let i = 0; const rng = () => [0.1, 0.7, 0.3, 0.05, 0.9][i++ % 5];
const p = s.planAiCopyTurn(a.aiCopy, { deck: a.zones.deck, score: (x) => (x.type === 'unique' ? 9 : 1), costOf: (x) => x.guts, rng });
check('コピーの手札に写しが入る(2枚+固有技)', p.hand.length === 3 && p.hand.some((x) => x.sorashidoCopyOf === 'golem'), p.hand.map((x) => x.name).join('・'));
check('距離技は手札に入らない', !p.hand.some((x) => x.type === 'range_atk'));
check('Lv1 は1枚、先頭が次に使うカード', p.picks.length === 1 && p.nextCard === p.picks[0]);
check('みんなの山札は減らない', a.zones.deck.length === deck0.length + 1);
const lv3 = s.summonAiCopy({ aiCopy: null, zones: zones0 }, { srcSlot: 1, srcMonsterId: 'golem', level: 2, src: { ...src, maxGuts: 200 }, uniqueCard: uniqueOf('golem'), turn: 1 });
i = 0;
const p3 = s.planAiCopyTurn(lv3.aiCopy, { deck: lv3.zones.deck, score: (x) => 1, costOf: (x) => x.guts, rng });
check('Lv3 はガッツの上限120以上で2枚まで', p3.picks.length >= 1 && p3.picks.length <= 2 && lv3.aiCopy.maxGuts >= 120, `上限 ${lv3.aiCopy.maxGuts}・${p3.picks.length}枚`);
check('コピーがいなければ何もしない', s.planAiCopyTurn(null, { deck: deck0 }) === null);

// AUTO と同じ見方の点
{
  const atk = card(21, 'atk'), big = card(22, 'atk'), grd = card(23, 'guard'), heal = card(24, 'heal'), uq = uniqueOf('Ark');
  const dmgOf = (c) => (c === big ? 300 : c === uq ? 200 : 100);
  const sc = (st) => (c) => s.aiCopyAutoScore(c, { strategy: st, dmgOf });
  const top = (st, list) => [...list].sort((a, b) => sc(st)(b) - sc(st)(a))[0];
  check('攻撃重視は固有技が先', top('offense', [atk, big, grd, heal, uq]) === uq);
  check('耐久重視は回復が先、その次にガード', top('defense', [atk, big, grd, heal]) === heal && top('defense', [atk, big, grd]) === grd);
  check('作戦なし(random)は与ダメの大きい順', top('random', [atk, big, grd, uq]) === big);
  check('札が無ければいちばん低い', s.aiCopyAutoScore(null) === -Infinity);
}

if (failed) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }
console.log('\nすべてOK');
