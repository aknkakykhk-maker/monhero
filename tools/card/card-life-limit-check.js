// MFバトルカード: カード部屋の 1.5倍の回数(1つの時間帯で、助手1人につき1回。2026-11-08 社長 Q1 A)。ブラウザなしで数え方を確かめる
//
//   node tools/card/card-life-limit-check.js
//
// 見ているもの
//   A 保存の読み方: 無い・壊れている・形が違う・時間帯が違う → まだ使っていない。数は整数・0より大きいものだけ
//   B 1回足す: 同じ時間帯なら足し、違う時間帯なら数え直して1。保存のほうが新しい時間帯なら書かない(新しい時間帯の数を上書きしない)
//   C 使い切ったか: 1回使ったら使い切り。時間帯が変わると戻る。「次は◯時から」は次の時間帯の始まり(夜21時の次は0時)
//   D 書き方(84): 始めた時点で決める(cardLifeRewardLeft)・時間帯も始めた時点(lifeSlot)・数えるのは 1.5倍で本当に増えた試合だけ・結果と同じ取引で書く
//   E 56: HOME の顔から外す・部屋のボタンを灰色にするのは、カード部の口(cardLifeRewardSpent)を typeof で確かめて読む
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const src = (rel) => fs.readFileSync(path.join(root, 'monster-hero', rel), 'utf8');
let failed = 0, passed = 0;
const check = (name, ok, detail = '') => { if (ok) passed++; else { failed++; console.log(`  NG: ${name}${detail ? ` — ${detail}` : ''}`); } };

const s84 = src('src/parts/84-screen-card-battle.jsx');
const s56 = src('src/parts/56-assistant-life-house.jsx');
const a = s84.indexOf('const CARD_LIFE_REWARD_KEY = ');
const b = s84.indexOf('// 育つ助手の型を使うか');
check('84 に回数の部分がある', a > 0 && b > a);

// 時間帯の口(56 の assistantLifeSlotAt と同じ形)。now は「通しの番号 × 4時間」で決める簡単なもの
const SLOTS = [{ from: 0 }, { from: 5 }, { from: 10 }, { from: 14 }, { from: 18 }, { from: 21 }];
const ctx = vm.createContext({ ASSISTANT_LIFE_SLOTS: SLOTS, assistantLifeSlotAt: (now) => ({ abs: Math.floor(now), i: ((Math.floor(now) % 6) + 6) % 6 }),
  store: {}, storeGet: async function (k, d) { return k in this.store ? JSON.parse(JSON.stringify(this.store[k])) : d; } });
ctx.storeGet = ctx.storeGet.bind(ctx);
vm.runInContext(`${s84.slice(a, b)}\nthis.E = { CARD_LIFE_REWARD_KEY, CARD_LIFE_REWARD_MAX, cardLifeRewardNorm, cardLifeRewardAfter, CARD_LIFE_REWARD_MEM, cardLifeRewardLeft, cardLifeRewardSpent, cardLifeSpentText, cardLifeRewardEntry, cardLifeRewardLoad };`, ctx);
const E = ctx.E;

(async () => {
  // A
  check('A キーは mh_card_life_reward_v1・上限は1回', E.CARD_LIFE_REWARD_KEY === 'mh_card_life_reward_v1' && E.CARD_LIFE_REWARD_MAX === 1);
  const empty = (v) => v && Object.keys(v.used).length === 0;
  check('A 無い → 空', empty(E.cardLifeRewardNorm(null, 10)) && empty(E.cardLifeRewardNorm(undefined, 10)));
  check('A 壊れた形 → 空', [1, 'x', [], { slot: '10', used: { a: 1 } }, { slot: 10, used: [] }, { slot: 10, used: 'a' }, { slot: 10 }].every((r) => empty(E.cardLifeRewardNorm(r, 10))));
  check('A 時間帯が違う → 空', empty(E.cardLifeRewardNorm({ slot: 9, used: { sorashido: 1 } }, 10)));
  const n = E.cardLifeRewardNorm({ slot: 10, used: { sorashido: 1, erubin: '2', x: -1, y: 'a', z: 0, w: 2.7 } }, 10);
  check('A 数は整数・0より大きいものだけ', JSON.stringify(n.used) === JSON.stringify({ sorashido: 1, erubin: 2, w: 2 }), JSON.stringify(n.used));
  // B
  check('B 同じ時間帯なら足す', JSON.stringify(E.cardLifeRewardAfter({ slot: 10, used: { erubin: 1 } }, 10, 'sorashido')) === JSON.stringify({ slot: 10, used: { erubin: 1, sorashido: 1 } }));
  check('B 違う(古い)時間帯なら数え直して1', JSON.stringify(E.cardLifeRewardAfter({ slot: 8, used: { sorashido: 1 } }, 10, 'sorashido')) === JSON.stringify({ slot: 10, used: { sorashido: 1 } }));
  check('B 無いなら1', JSON.stringify(E.cardLifeRewardAfter(null, 10, 'erubin')) === JSON.stringify({ slot: 10, used: { erubin: 1 } }));
  check('B 保存のほうが新しい時間帯なら書かない(試合中に時間帯が変わった)', E.cardLifeRewardAfter({ slot: 11, used: { erubin: 1 } }, 10, 'sorashido') === null);
  check('B 時間帯・助手が分からなければ書かない', E.cardLifeRewardAfter(null, NaN, 'a') === null && E.cardLifeRewardAfter(null, 10, '') === null);
  ctx.store = { mh_card_life_reward_v1: { slot: 10, used: { erubin: 1 } } };
  const ent = await E.cardLifeRewardEntry('sorashido', 10);
  check('B 取引の1件は { key, next, before }', ent && ent.key === 'mh_card_life_reward_v1' && ent.next.used.sorashido === 1 && ent.before.used.erubin === 1, JSON.stringify(ent));
  ctx.store = { mh_card_life_reward_v1: { slot: 12, used: {} } };
  check('B 新しい時間帯の保存があれば取引に足さない', (await E.cardLifeRewardEntry('sorashido', 10)) === null);
  // C
  E.CARD_LIFE_REWARD_MEM.raw = null;
  check('C まだ使っていない', E.cardLifeRewardLeft('sorashido', 10) && E.cardLifeRewardSpent('sorashido', 10) === null);
  E.CARD_LIFE_REWARD_MEM.raw = { slot: 10, used: { sorashido: 1 } };
  const sp = E.cardLifeRewardSpent('sorashido', 10);
  check('C 1回使ったら使い切り(ほかの助手はまだ)', !E.cardLifeRewardLeft('sorashido', 10) && sp && E.cardLifeRewardLeft('erubin', 10), JSON.stringify(sp));
  check('C 「次は◯時から」は次の時間帯の始まり(10 は夕方の並び → 21時)', sp && sp.next === 21 && E.cardLifeSpentText(sp, 'ソラシド') === '🃏 ソラシドのごほうびアップは使い切りました…次は21時から', E.cardLifeSpentText(sp, 'ソラシド'));
  check('C 部屋のボタンの言い方(名前なし)', E.cardLifeSpentText(sp) === '🃏 ごほうびアップは使い切りました…次は21時から');
  E.CARD_LIFE_REWARD_MEM.raw = { slot: 11, used: { sorashido: 1 } };
  check('C 夜21時の次は0時', (E.cardLifeRewardSpent('sorashido', 11) || {}).next === 0);
  check('C 時間帯が変わると戻る', E.cardLifeRewardLeft('sorashido', 12) && E.cardLifeRewardSpent('sorashido', 12) === null);
  ctx.store = { mh_card_life_reward_v1: { slot: 12, used: { atsu: 1 } } };
  await E.cardLifeRewardLoad();
  check('C 起動時に保存を読む', !E.cardLifeRewardLeft('atsu', 12));
  // D
  check('D 始めた時点で決める: カード部屋にいて、まだ残っているときだけ', /const lifeUp = !share && !cup && !auto && cardLifeAtCard\(pick\.who\) && cardLifeRewardLeft\(pick\.who\);/.test(s84));
  check('D 数える時間帯も始めた時点(game.lifeSlot)', /const lifeSlot = lifeUp \? \(cardLifeSlotNow\(\) \|\| \{\}\)\.abs : null;/.test(s84) && /\{ lifeUp: true, lifeSlot \}/.test(s84));
  check('D 1.5倍はふだんどおり game.lifeUp で決める(途中で時間帯が変わっても、その試合は 1.5倍)', /const lifeMult = game\.lifeUp && !game\.demo \? CARD_LIFE_UP_MULT : 1;/.test(s84));
  check('D 数えるのは 1.5倍で本当に増えた試合だけ(もらえる数が0の試合は数えない)', /const lifeEntry = lifeMult > 1 && reward\.lifeUp === true && Number\.isFinite\(game\.lifeSlot\) \? await cardLifeRewardEntry\(game\.who, game\.lifeSlot\) : null;/.test(s84));
  check('D 結果と同じ取引で書き、書けたら写しを差しかえる', /\.\.\.levelGain\.entries, \.\.\.\(lifeEntry \? \[lifeEntry\] : \[\]\)\]\);/.test(s84) && /if \(ok && lifeEntry\) CARD_LIFE_REWARD_MEM\.raw = lifeEntry\.next;/.test(s84));
  check('D 起動時に写しを読む(cardLifeSetApp)', /const cardLifeSetApp = \(app\) => \{[^}]*void cardLifeRewardLoad\(\);/.test(s84));
  check('D 相手えらび: 使い切った助手は消さず「🃏済」・帯に言い方', /data-card-foe-life-chip="spent"[^>]*>🃏済</.test(s84) && /data-card-foe-life-spent=\{x\.id\}/.test(s84) && /cardLifeSpentText\(lifeSpent\[x\.id\], x\.name\)/.test(s84));
  // E
  check('E 56 はカード部の口を typeof で確かめて読む', /const assistantLifeCardSpent = \(id\) => \{ try \{ return typeof cardLifeRewardSpent === 'function' \? cardLifeRewardSpent\(id\) : null; \} catch \{ return null; \} \};/.test(s56));
  check('E 56 HOME: 使い切った助手は MFバトルカードの横の顔から外す', /if \(f === 'card' && assistantLifeCardSpent\(id\)\) continue;/.test(s56));
  check('E 56 部屋: 使い切ったら灰色の押せないボタン', /disabled[^>]*data-assistant-life-room-act="card-spent"/.test(s56));

  if (failed) { console.log(`カード部屋の 1.5倍の回数: NG ${failed}件(OK ${passed}件)`); process.exit(1); }
  console.log(`カード部屋の 1.5倍の回数: OK ${passed}件`);
})();
