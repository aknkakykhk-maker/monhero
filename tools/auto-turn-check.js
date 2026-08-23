#!/usr/bin/env node
'use strict';
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const start = source.indexOf('const chooseAutoTurn =');
const end = source.indexOf('// 難易度。', start);
if (start < 0 || end < 0) throw new Error('AUTO判断helperが見つかりません');
const context = {Math};
vm.runInNewContext(`${source.slice(start, end)};this.chooseAutoTurn=chooseAutoTurn;`, context);
const chooseAutoTurn = context.chooseAutoTurn;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const needsMonster = card => ['atk','range_atk','unique'].includes(card.type) || (card.type === 'debuff' && card.subType === 'stun_atsu');
const base = {
  guts:100, cardLimit:3, slots:[{id:'A'},null,{id:'Ham'},null],
  getCardGuts:card => card.guts, cardNeedsMonster:needsMonster,
  slotMaxUses:mon => mon.id === 'Ham' ? 3 : 1, rng:() => 0,
};
const pick = options => chooseAutoTurn({...base, ...options});
const totalGuts = result => result.reduce((sum, action) => sum + action.card.guts, 0);

let result = pick({hand:[{type:'atk',guts:60},{type:'atk',guts:60}]});
assert(totalGuts(result) <= 100, '現在ガッツを超えました');
result = pick({hand:[{type:'guard',guts:0},{type:'heal',guts:10},{type:'buff',guts:10}],cardLimit:2});
assert(result.length === 2, 'cardLimitを守っていません');
result = pick({hand:[{type:'atk',guts:20}],slots:[null,{id:'A'},null,null]});
assert(result.length === 1 && result[0].slotIdx === 1, '空スロットへ割り当てました');
result = pick({hand:[{type:'unique',guts:20,ownerSlotIdx:2}]});
assert(result.length === 1 && result[0].slotIdx === 2, 'uniqueをownerSlotIdxへ割り当てていません');
result = pick({hand:[{type:'unique',guts:20,ownerSlotIdx:1}]});
assert(result.length === 0, 'uniqueをownerSlotIdx以外へ割り当てました');
result = pick({hand:[{type:'atk',guts:10},{type:'range_atk',guts:10}],slots:[{id:'A'}]});
assert(result.length === 1, 'slotMaxUsesを超えました');
result = pick({strategy:'random',hand:[{type:'atk',guts:30},{type:'heal',guts:20},{type:'guard',guts:0}]});
assert(result.length >= 1 && result.length <= 3 && totalGuts(result) <= 100 && result.every(a => !needsMonster(a.card) || base.slots[a.slotIdx]), 'randomが不正な結果を返しました');
result = pick({strategy:'offense',cardLimit:1,hand:[{type:'guard',guts:0},{type:'atk',guts:20}]});
assert(result[0]?.card.type === 'atk', 'offenseが攻撃系を優先していません');
result = pick({strategy:'defense',cardLimit:1,hand:[{type:'atk',guts:20},{type:'guard',guts:0},{type:'heal',guts:20}]});
assert(result[0]?.card.type === 'heal', 'defenseがhealを優先していません');
result = pick({strategy:'guts',hand:[{type:'guard',guts:0},{type:'atk',guts:30},{type:'range_atk',guts:10}]});
assert(result.length === 1 && result[0].card.guts === 10, 'gutsが低ガッツ攻撃を選んでいません');
result = pick({hand:[{type:'atk',guts:20}],slots:[null,null,null,null]});
assert(result.length === 0, '合法行動がないのに空配列ではありません');
const sequence = () => { let i=0; const values=[0.8,0.2,0.6,0.1,0.7]; return () => values[i++ % values.length]; };
const reproducibleHand = [{type:'guard',guts:0,id:'a'},{type:'heal',guts:10,id:'b'},{type:'atk',guts:20,id:'c'}];
const first = pick({strategy:'random',hand:reproducibleHand,rng:sequence()}).map(a => [a.handIndex,a.slotIdx]);
const second = pick({strategy:'random',hand:reproducibleHand,rng:sequence()}).map(a => [a.handIndex,a.slotIdx]);
assert(JSON.stringify(first) === JSON.stringify(second), '固定rngで結果を再現できません');

assert(!source.slice(start, end).match(/setSelectedCards|setCardAssignments|processTurn|setPendingCard/), 'helperがbattle stateを変更しています');
console.log('OK: AUTOの4方針とカード・ガッツ・スロットの合法判断を確認');
