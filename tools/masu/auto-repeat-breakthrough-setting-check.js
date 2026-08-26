#!/usr/bin/env node
'use strict';

const assert = require('assert');
const m = require('../harness').loadDyeModule();
const fs = require('fs');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');

assert.deepStrictEqual(Array.from(m.autoRepeatBreakthroughLevelOptions(69)), [], 'Lv69はOFFのみ');
assert.deepStrictEqual(Array.from(m.autoRepeatBreakthroughLevelOptions(70)), [35], 'Lv70はLv35まで');
assert.strictEqual(m.autoRepeatBreakthroughMaxLevel(100), 50, 'Lv100は最大Lv50');
assert.strictEqual(m.autoRepeatBreakthroughMaxLevel(153), 75, 'Lv153は最大Lv75');
assert.ok(!source.includes('AUTO_REPEAT_BREAKTHROUGH_LEVEL_LIMIT'), '固定Lv100定数を撤去');

const normalizeStart = source.indexOf('const normalizeMasuProgression =');
const normalizeEnd = source.indexOf('// 固有技ポイントの仮配分', normalizeStart);
const normalizer = source.slice(normalizeStart, normalizeEnd);
assert.ok(normalizer.includes('autoRepeatBreakthroughLevel: normalizeAutoRepeatBreakthroughLevel'), '数値項目を正本として正規化');
assert.ok(!normalizer.includes('autoRepeatBreakthrough:'), '旧booleanを正本にしない');

const saverStart = source.indexOf('const setMasuAutoRepeatBreakthrough =');
const saverEnd = source.indexOf('const useUniqueSkillResetTicket', saverStart);
const saver = source.slice(saverStart, saverEnd);
assert.ok(saver.includes("storeSet('mh_masu_mons', next, false)"), '既存mh_masu_monsへ保存');
assert.deepStrictEqual(saver.match(/mh_[a-z0-9_]+/g), ['mh_masu_mons'], '新しいmh_*キーなし');
assert.ok(saver.includes('String(m.id) === String(masuId) ? updated : m'), '対象個体だけを更新');

const detailStart = source.indexOf('{masuMonDetail&&!MASU_ENHANCE_STATES.includes(gameState)&&');
const detailEnd = source.indexOf('{/* 固有技設定:', detailStart);
const detail = source.slice(detailStart, detailEnd);
assert.ok(detail.includes('<select') && detail.includes('<option value={0}>OFF</option>'), 'スマホ向けselectとOFF');
assert.ok(detail.includes('autoBreakthroughLevels.map'), '利用可能な5刻み選択肢だけを生成');
assert.ok(detail.includes('設定可能上限：'), '現在の設定可能上限を表示');

const runtimeStart = source.indexOf('// AUTO∞から新しいrunId');
const runtimeEnd = source.indexOf('// 正規リザルトの全報酬演出', runtimeStart);
const runtime = source.slice(runtimeStart, runtimeEnd);
assert.ok(!runtime.includes('autoRepeatBreakthrough') && !runtime.includes('executeAutoRepeatBreakthroughs'), '周回終了処理へ未接続');

console.log('✅ AUTO∞自動限界突破の上限設定・保存チェックOK');
