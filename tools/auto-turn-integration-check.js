#!/usr/bin/env node
'use strict';

const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const processStart = source.indexOf('const processTurn = async (explicitEntries = null) =>');
const autoStart = source.indexOf('const runAutoTurnOnce = () =>', processStart);
const autoEnd = source.indexOf('// WAVE 10', autoStart);

assert(processStart >= 0, 'processTurnの明示entries引数が見つかりません');
assert(autoStart > processStart && autoEnd > autoStart, 'runAutoTurnOnceの定義が見つかりません');

const processSource = source.slice(processStart, autoStart);
const autoSource = source.slice(autoStart, autoEnd);

assert(processSource.includes('Array.isArray(explicitEntries)'), '明示entriesの配列判定がありません');
assert(processSource.includes(': selectedCards.map('), '手動のselectedCards経路が維持されていません');
assert(processSource.includes('cardAssignments[i]'), '手動のcardAssignments経路が維持されていません');
assert(processSource.includes('hand[entry.handIndex]'), '明示entriesのhandIndex検証がありません');
assert(processSource.includes('usedCardEntries.length===0'), '空entriesを開始前に拒否していません');
assert.strictEqual((source.match(/const processTurn\s*=/g) || []).length, 1, 'processTurnが複数系統あります');

assert(autoSource.includes('chooseAutoTurn({'), 'runAutoTurnOnceがchooseAutoTurnを使っていません');
for (const input of ['hand', 'slots', 'guts', 'cardLimit', 'strategy:autoSettings.strategy',
  'getCardGuts', 'cardNeedsMonster', 'slotMaxUses']) {
  assert(autoSource.includes(input), `chooseAutoTurnへ${input}を渡していません`);
}
assert(autoSource.includes('if (entries.length>0) processTurn(entries)'), '明示entriesを空でない場合だけprocessTurnへ渡していません');
assert(!/setSelectedCards|setCardAssignments|setPendingCard/.test(autoSource),
  'runAutoTurnOnceが選択stateの更新を経由しています');
assert(source.includes('onClick={()=>processTurn()}'), 'ACTIONがclick eventをprocessTurnへ直接渡します');
assert(!source.includes('onClick={processTurn}'), 'processTurnを直接click handlerへ指定しています');

console.log('OK: AUTO 1ターン接続の明示/手動経路・state非経由・イベント安全性を確認');
