#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const start = source.indexOf('const chooseAutoTurn =');
const end = source.indexOf('// 難易度。', start);
if (start < 0 || end < 0) throw new Error('chooseAutoTurnの定義が見つかりません');
const context = { Math };
vm.runInNewContext(`${source.slice(start, end)};this.chooseAutoTurn=chooseAutoTurn;this.hasAutoTurnWithEnoughGuts=hasAutoTurnWithEnoughGuts;`, context);
const chooseAutoTurn = context.chooseAutoTurn;
const hasAutoTurnWithEnoughGuts = context.hasAutoTurnWithEnoughGuts;

const needsMonster = card => ['atk','range_atk','unique'].includes(card.type)
  || (card.type === 'debuff' && card.subType === 'stun_atsu');
const base = {
  slots:[{id:'hero',maxUses:1}, null, {id:'ally',maxUses:1}],
  guts:100,
  cardLimit:3,
  getCardGuts:card => card.cost,
  cardNeedsMonster:needsMonster,
  slotMaxUses:monster => monster.maxUses,
};
const act = (hand, options = {}, rng = () => 0) => JSON.parse(JSON.stringify(chooseAutoTurn({...base, hand, ...options}, rng)));
const card = (id, type, cost, extra = {}) => ({id, type, cost, ...extra});

// 1. ガッツ上限
assert.deepStrictEqual(act([card('heavy','atk',101)]), [], '現在ガッツを超えるカードを選びました');
assert(act([card('a','atk',60),card('b','atk',60)], {slots:[{id:'hero',maxUses:3}]}).length === 1,
  '複数カードの合計ガッツが上限を超えました');

// 2. cardLimit
assert.strictEqual(act([card('a','guard',0),card('b','guard',0),card('c','guard',0)], {cardLimit:2}).length, 2,
  'cardLimitを超えました');

// 3. 空スロット回避
assert.deepStrictEqual(act([card('hit','atk',20)], {slots:[null,{id:'ally',maxUses:1}]}).map(x => x.slotIdx), [1],
  '空スロットへ割り当てました');

// 4, 5. uniqueはownerSlotIdxだけ
const unique = card('special','unique',20,{ownerSlotIdx:2});
assert.deepStrictEqual(act([unique]).map(x => x.slotIdx), [2], 'uniqueをownerSlotIdxへ割り当てませんでした');
assert.deepStrictEqual(act([unique], {slots:[{id:'hero',maxUses:1},null,null]}), [],
  'uniqueをownerSlotIdx以外へ割り当てました');

// 6. slotMaxUses
assert.strictEqual(act([card('a','atk',10),card('b','atk',10)], {slots:[{id:'hero',maxUses:1}]}).length, 1,
  'slotMaxUsesを超えました');
assert.strictEqual(act([card('a','atk',10),card('b','atk',10)], {slots:[{id:'hero',maxUses:2}]}).length, 2,
  'slotMaxUsesが許す複数割当を行えません');

// 7. randomも合法な候補だけを返す
const randomResult = act([card('too-heavy','atk',200),card('hit','atk',20),card('guard','guard',0)],
  {strategy:'random',slots:[null,{id:'ally',maxUses:1}],cardLimit:3}, () => 0.99);
assert(randomResult.every(x => x.card.id !== 'too-heavy' && (x.slotIdx === null || x.slotIdx === 1)),
  'randomが違法な行動を返しました');

// 8. offenseはunique、攻撃、その他、guard/healの順
assert.strictEqual(act([card('heal','heal',10),card('buff','buff',10),card('hit','atk',10),unique],
  {strategy:'offense'}, () => 0)[0].card.id, 'special', 'offenseがuniqueを優先しません');

// 9. defenseはheal、guardを優先
assert.strictEqual(act([card('hit','atk',10),card('guard','guard',0),card('heal','heal',10)],
  {strategy:'defense'}, () => 0)[0].card.id, 'heal', 'defenseがhealを優先しません');

// 10. gutsは使用可能な攻撃の最低ガッツを1枚だけ選ぶ
const gutsResult = act([card('guard','guard',0),card('high','atk',30),card('low','range_atk',10)],
  {strategy:'guts'});
assert.strictEqual(gutsResult.length, 1, 'gutsが複数枚を選びました');
assert.strictEqual(gutsResult[0].card.id, 'low', 'gutsが低ガッツ攻撃を優先しません');
assert.strictEqual(act([card('buff','buff',15),card('guard','guard',0)], {strategy:'guts'})[0].card.id, 'guard',
  'gutsの攻撃不能時フォールバックが最低ガッツではありません');

// 11. 合法行動なし
assert.deepStrictEqual(act([card('hit','atk',10)], {slots:[null,null],cardLimit:2}), [],
  '合法行動がないのに空配列を返しません');
assert.strictEqual(hasAutoTurnWithEnoughGuts({...base,hand:[card('heavy','atk',101)]}), true,
  'ガッツだけが不足する合法行動を検出できません');
assert.strictEqual(hasAutoTurnWithEnoughGuts({...base,hand:[card('hit','atk',10)],slots:[null,null]}), false,
  '配置が原因の行動不能をガッツ不足と誤判定しました');
assert.strictEqual(hasAutoTurnWithEnoughGuts({...base,hand:[card('special','unique',10,{ownerSlotIdx:1})]}), false,
  'owner不一致をガッツ不足と誤判定しました');

// 12. 注入した固定rngで再現でき、入力stateを書き換えない
const state = {...base, hand:[card('a','guard',0),card('b','guard',0)], strategy:'random', cardLimit:1};
const before = JSON.stringify(state);
const first = chooseAutoTurn(state, () => 0.75);
const second = chooseAutoTurn(state, () => 0.75);
assert.deepStrictEqual(first, second, '固定rngで結果を再現できません');
assert.strictEqual(first[0].card.id, 'b', '注入rngが候補選択へ反映されません');
assert.strictEqual(JSON.stringify(state), before, 'battle stateを書き換えました');

assert(!source.slice(start, end).match(/setSelectedCards|setCardAssignments|setPendingCard|processTurn/),
  'helper内に禁止されたstate更新または戦闘進行があります');
console.log('OK: chooseAutoTurnの合法判定・4方針・固定rng・非破壊性を確認');
