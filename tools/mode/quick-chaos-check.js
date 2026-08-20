#!/usr/bin/env node
// クイックCHAOSが既存の報酬・保存・表示経路へ一度だけ接続されていることを確認する。
const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const changelog = fs.readFileSync('monster-hero/data/changelog.js', 'utf8');
const help = fs.readFileSync('monster-hero/data/help.js', 'utf8');

assert(source.includes("CHAOS: { label:'CHAOS', power:CHAOS_SETTING.power, xp:30, gold:9, psyche:50"));
assert.strictEqual(30 * 1.5, 45, '育成の最終経験値倍率');
assert.strictEqual(9 * 1.5, 13.5, '育成の最終ダイヤ倍率');
assert.strictEqual(50 * 2, 100, 'プシュケー優先の虹報酬');
assert.strictEqual(9 * 1.5 * 2, 27, 'ダイヤ優先の最終ダイヤ倍率');
assert(source.includes('specialRuleDifficultyForRun(runMode,difficulty'), '特殊ルール共通解決関数を実戦で使用');
const quickConfig = source.slice(source.indexOf('const QUICK_EXTREME_SETTINGS'), source.indexOf('const QUICK_DIFFICULTY_SETTINGS'));
assert(!/(damageDealt|allyJoinBonus|gutsCost)/.test(quickConfig), 'クイック定義に特殊ルールを複製しない');
assert(source.includes("const modeKeyPrefix = (mode) => isQuickMode(mode) ? 'mh_quick_'"), '既存クイック記録キー方式を使用');
assert(source.includes('if (isQuickMode(runMode)) {') && source.includes('return;'), 'クイックはランキング送信前に除外');
assert(source.includes('debugBattleRef.current=false') && source.includes('debugBattle||isQuickDifficultyUnlocked'), '通常開始はデバッグ保存を無効化し、デバッグ選択は解放条件を無視');
const order = source.indexOf("Legend:") < source.indexOf("EXTREME: { label:'EXTREME'")
  && source.indexOf("EXTREME: { label:'EXTREME'") < source.indexOf("NIGHTMARE: { label:'NIGHTMARE'")
  && source.indexOf("NIGHTMARE: { label:'NIGHTMARE'") < source.indexOf("CHAOS: { label:'CHAOS'");
assert(order, 'Legend → EXTREME → NIGHTMARE → CHAOSの順序');
assert(source.includes("quick?'h-[366px] flex flex-col':''"), 'クイックカードの固定高を共用');
assert(source.includes('data-difficulty-assistant') && source.includes('compact={quick}'), '助手コメントをカード外のコンパクト枠へ配置');
assert(changelog.includes("id:'update_notice_quick_chaos_v1'") && changelog.includes("id:'update_notice_chaos_v1'"), '極限CHAOSとは別IDの通知');
assert(help.includes("title:'クイック CHAOS'") && help.includes('経験値×45・ダイヤ×13.5'), 'ヘルプに正式仕様を掲載');
console.log('OK: クイックCHAOS（3報酬方針・解放・特殊ルール共有・記録・ランキング除外・デバッグ・カード・通知）');
