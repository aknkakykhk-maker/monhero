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
assert.strictEqual(m.autoRepeatBreakthroughMaxLevel(800), 400, 'ブリーダーLv800で通常限界突破の実上限Lv400');
assert.strictEqual(m.autoRepeatBreakthroughMaxLevel(1000), 400, 'ブリーダーLvがさらに上がっても追従上限はLv400を超えない');
assert.strictEqual(Math.max(...m.autoRepeatBreakthroughLevelOptions(1000)), 400, '固定Lv候補もLv400を超えない');
assert.strictEqual(m.buildAutoRepeatBreakthroughUpdate({id:'legacy405'}, 405).autoRepeatBreakthroughLevel, 400, '旧Lv405設定は実効上限Lv400へ安全に引き継ぐ');
assert.strictEqual(m.buildAutoRepeatBreakthroughUpdate({id:'legacy500'}, 500).autoRepeatBreakthroughLevel, 400, '旧Lv500設定も実効上限Lv400へ安全に引き継ぐ');
assert.ok(!source.includes('AUTO_REPEAT_BREAKTHROUGH_LEVEL_LIMIT'), '固定Lv100定数を撤去');

const normalizeStart = source.indexOf('const normalizeMasuProgression =');
const normalizeEnd = source.indexOf('// 固有技ポイントの仮配分', normalizeStart);
const normalizer = source.slice(normalizeStart, normalizeEnd);
assert.ok(normalizer.includes('autoRepeatBreakthroughMode: normalizeAutoRepeatBreakthroughMode'), '新しいmodeを後方互換つきで正規化');
assert.ok(normalizer.includes('autoRepeatBreakthroughLevel: normalizeAutoRepeatBreakthroughLevel'), '固定Lvの数値項目を正本として正規化');
assert.ok(!normalizer.includes('autoRepeatBreakthrough:'), '旧booleanを正本にしない');
assert.ok(source.includes("if (value === 'follow') return 'follow';"), '自動追従modeを保持');
assert.ok(source.includes("return level > 0 ? 'fixed' : 'off';"), 'mode欠損の既存数値設定はfixedへ継承');
const sample = { id:'setting', autoRepeatBreakthroughLevel:45 };
const follow = m.buildAutoRepeatBreakthroughSettingUpdate(sample, 'follow', 50);
assert.strictEqual(follow.autoRepeatBreakthroughMode, 'follow', 'followを個体設定へ保存');
assert.strictEqual(follow.autoRepeatBreakthroughLevel, 0, 'followは固定Lvを正本にしない');
const fixed = m.buildAutoRepeatBreakthroughSettingUpdate(sample, 'fixed', 50);
assert.strictEqual(fixed.autoRepeatBreakthroughMode, 'fixed', 'fixedを個体設定へ保存');
assert.strictEqual(fixed.autoRepeatBreakthroughLevel, 50, 'fixedは指定Lvを保存');
const invalidFixed = m.buildAutoRepeatBreakthroughSettingUpdate(sample, 'fixed', 51);
assert.strictEqual(invalidFixed.autoRepeatBreakthroughMode, 'off', '不正な固定LvはOFFへ落とす');
assert.strictEqual(invalidFixed.autoRepeatBreakthroughLevel, 0, '不正な固定Lvを残さない');
const legacyUpdate = m.buildAutoRepeatBreakthroughUpdate(sample, 55);
assert.strictEqual(legacyUpdate.autoRepeatBreakthroughMode, 'fixed', '従来の数値更新helperはfixed互換');
assert.strictEqual(legacyUpdate.autoRepeatBreakthroughLevel, 55, '従来の数値更新helperはLvを維持');

const saverStart = source.indexOf('const setMasuAutoRepeatBreakthrough =');
const saverEnd = source.indexOf('const useUniqueSkillResetTicket', saverStart);
const saver = source.slice(saverStart, saverEnd);
assert.ok(saver.includes("storeSet('mh_masu_mons', next, false)"), '既存mh_masu_monsへ保存');
assert.deepStrictEqual(saver.match(/mh_[a-z0-9_]+/g), ['mh_masu_mons'], '新しいmh_*キーなし');
assert.ok(saver.includes('String(m.id) === String(masuId) ? updated : m'), '対象個体だけを更新');

const detailStart = source.indexOf('{masuMonDetail&&!MASU_ENHANCE_STATES.includes(gameState)&&');
const detailEnd = source.indexOf('{/* 固有技設定:', detailStart);
const detail = source.slice(detailStart, detailEnd);
assert.ok(detail.includes('<select') && detail.includes('<option value="off">OFF</option>'), 'スマホ向けselectとOFF');
assert.ok(detail.includes('<option value="follow">ブリーダーLvに自動追従</option>'), '個体ごとに自動追従を選べる');
assert.ok(detail.includes('value={`fixed:${level}`}') && detail.includes('Lv{level}まで固定'), '固定Lvを5刻みで選べる');
assert.ok(detail.includes("value.startsWith('fixed:')") && detail.includes("setMasuAutoRepeatBreakthrough(masu.id,'follow')"), 'selectから3モードを保存へ接続');
assert.ok(detail.includes('autoBreakthroughLevels.map'), '利用可能な5刻み選択肢だけを生成');
assert.ok(detail.includes('現在の追従上限：'), '現在の自動追従上限を表示');
assert.ok(detail.includes('ブリーダーLv上昇に合わせて自動で伸びます'), '追従の意味を画面で説明');
assert.ok(detail.includes('w-full min-h-[48px]'), '縦画面で押しやすい幅と高さを確保');
assert.ok(source.includes('reserveGold = 0, reservePsyche = 0'), '残高保護は未設定なら従来どおり0');
assert.ok(source.includes('result.nextGold < protectedGold || result.nextPsyche < protectedPsyche'), '限凸後残高で保護判定');

console.log('✅ AUTO∞自動限界突破の上限設定・保存チェックOK');
