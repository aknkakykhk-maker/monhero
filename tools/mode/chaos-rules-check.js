#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const help = fs.readFileSync('monster-hero/data/help.js', 'utf8');
const configStart = source.indexOf('const EXTREME_DIFFICULTIES');
const configEnd = source.indexOf('// 極限チャレンジの説明には', configStart);
const context = { DIFFICULTY_SETTINGS:{}, isQuickMode:()=>false };
vm.createContext(context);
vm.runInContext(`${source.slice(configStart, configEnd)}\nglobalThis.rules = { extremeSpecialRule, specialRuleDifficultyForRun, applyExtremeIntegerRule, applyAllyJoinBonus };`, context);

const { extremeSpecialRule, specialRuleDifficultyForRun, applyExtremeIntegerRule, applyAllyJoinBonus } = context.rules;
assert.strictEqual(specialRuleDifficultyForRun('extreme', 'Normal', true, 'CHAOS'), 'CHAOS');
assert.strictEqual(applyExtremeIntegerRule(101, 'CHAOS', 'damageDealt'), 50, 'CHAOSの与ダメージは端数切り捨てで50%');
assert.strictEqual(applyExtremeIntegerRule(31, 'CHAOS', 'allyJoinBonus'), 15, 'CHAOSの加入ボーナスは端数切り捨てで50%');
assert.strictEqual(applyAllyJoinBonus(31, 'CHAOS', 100), 15, 'CHAOSの加入ボーナスは累計ターンに関係なく50%');
assert.strictEqual(applyExtremeIntegerRule(21, 'CHAOS', 'gutsCost'), 31, 'CHAOSの消費ガッツは端数切り捨てで150%');
for (const difficulty of ['EXTREME', 'NIGHTMARE', null]) {
  assert.strictEqual(applyExtremeIntegerRule(101, difficulty, 'damageDealt'), 101, `${difficulty || '通常'}へ与ダメージルールを誤適用しない`);
  assert.strictEqual(applyExtremeIntegerRule(31, difficulty, 'allyJoinBonus'), 31, `${difficulty || '通常'}へ加入ルールを誤適用しない`);
  assert.strictEqual(applyExtremeIntegerRule(21, difficulty, 'gutsCost'), 21, `${difficulty || '通常'}へガッツルールを誤適用しない`);
}
assert.strictEqual(extremeSpecialRule('CHAOS', 'damageDealt'), 0.5);
assert.strictEqual((source.match(/applyExtremeIntegerRule\(distanceBrokenDmg,specialRuleDifficulty,'damageDealt'\)/g)||[]).length, 1, '与ダメージの共通経路へ1回だけ適用');
assert.strictEqual((source.match(/applyExtremeIntegerRule\(cost,specialRuleDifficulty,'gutsCost'\)/g)||[]).length, 1, '表示・選択・実消費が共有するgetCardGutsへ1回だけ適用');
assert(!source.includes("if (['buff','debuff','heal','draw'].includes(card.type)) return"), '教え・回復・補助カードも共通のガッツ倍率経路を通る');
assert.strictEqual((source.match(/applyAllyJoinBonus\(bonus\[key\]\|\|0,specialRuleDifficulty,waveResult\?\.totalTurnCount\)/g)||[]).length, 1, '加入時ステータス増加へ共通helperを1回だけ適用');
assert(source.includes("const aptDelta=getMonsterAptPct(m,specialRuleDifficulty)"), '間合い適性の加入処理を維持');
assert(source.includes('const newAllyUnique={...m.unique'), '固有技の加入処理を維持');
assert(help.includes('CHAOS だけの特殊ルール') && help.includes('供モンの加入、間合い適性、固有技の取得は半減しません'), 'ヘルプに正式仕様と対象外を記載');

console.log('OK: CHAOS特殊ルール（与ダメージ50%・加入ボーナス50%・消費ガッツ150%・一重適用・他難易度隔離）');
