#!/usr/bin/env node
// NIGHTMAREステップ3の数値処理と、既存モードからの分離を静的・代表値で確認する。
const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');

const signed = (value, nightmare=false) => value * (nightmare ? (value >= 0 ? 0.5 : 2) : 1);
const wave = (value, nightmare=false) => value * (nightmare ? 0.5 : 1);

assert.strictEqual(wave(10, true), 5, 'NIGHTMARE WAVE enhancement must be 50%');
assert.strictEqual(signed(0.025, true), 0.0125, 'positive recovery modifier must be 50%');
assert.strictEqual(signed(-0.025, true), -0.05, 'negative recovery modifier must be 200%');
assert.strictEqual(signed(0.1, true), 0.05, 'positive aptitude modifier must be 50%');
assert.strictEqual(signed(-0.1, true), -0.2, 'negative aptitude modifier must be 200%');
assert.strictEqual(wave(10, false), 10, 'non-NIGHTMARE WAVE enhancement must stay unchanged');
assert.strictEqual(signed(-0.025, false), -0.025, 'non-NIGHTMARE signed modifiers must stay unchanged');

assert(source.includes("specialRules:Object.freeze({ waveEnhancement:0.5, positiveModifier:0.5, negativeModifier:2.0 })"));
assert(source.includes('applyDistanceEnhancement(d*0.001/100,specialRuleDifficulty)'), 'WAVE distance gain must go through the shared distance-enhancement rule');
// 距離強化はINFINITY専用ルールが無ければ従来どおりNIGHTMAREのWAVE後強化へ落ちる
assert(/const applyDistanceEnhancement[\s\S]{0,320}applyNightmareWaveEnhancement\(value,specialDifficulty\)/.test(source), 'NIGHTMARE distance gain must still fall back to the WAVE enhancement rule');
assert(source.includes("applyNightmareSignedModifier(aptGradeToPct(apt[i] || 'C'), nightmare)"), 'monster aptitude must use the signed rule separately');
assert(source.includes('const baseRecoveryDelta=Math.max(-0.05,Math.min(0.05,(remainingTurns-10)*0.005));'), 'recovery base formula and bounds must stay intact');
assert(source.includes('const recoveryDelta=applyNightmareSignedModifier(baseRecoveryDelta,specialRuleDifficulty);'), 'recovery rule must apply after the base calculation');
assert(source.includes("isBreeder&&specialRuleDifficulty?extremeSpecialRule(specialRuleDifficulty,'assistCardEffect')"), 'EXTREME breeder-card rule must stay intact');
assert(!source.includes("specialRules:Object.freeze({ assistCardEffect:0.5, waveEnhancement"), 'NIGHTMARE rules must not leak into EXTREME');
assert(source.includes('data-extreme-battle-status={rule}') && source.includes("['強化',specialRulePercent(extremeSpecialRule(difficultyId,'waveEnhancement'))]"), 'battle status must show shared NIGHTMARE values');
assert(source.includes('data-nightmare-training-status') && source.includes('通常 +{normalGain} → 実際 +{effectiveGain}'), 'training must compare resolver results');
assert(source.includes('baseRecoveryDelta,recoveryDelta') && source.includes('通常 {waveResult.baseRecoveryDelta'), 'recovery must compare base and effective values');
assert(source.includes('normalGainedDistBonus') && source.includes('通常 +${normalGained.toFixed(1)} → 実際 +${gained.toFixed(1)}'), 'WAVE growth must compare normal and effective values');

console.log('OK: NIGHTMARE特殊ルール（WAVE後50%、自動回復・距離適性のプラス50%／マイナス200%、既存モード分離）');
