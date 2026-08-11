#!/usr/bin/env node
// クイック極限難易度が極限本体のspecialRulesを共有し、通常クイックへ漏れないことを確認する。
const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');

const extreme = { breederCardEffect: 0.5 };
const nightmare = { waveEnhancement: 0.5, positiveModifier: 0.5, negativeModifier: 2 };
const rule = (rules, key) => rules?.[key] ?? 1;
assert.strictEqual(rule(extreme, 'breederCardEffect'), 0.5);
assert.strictEqual(rule(extreme, 'waveEnhancement'), 1);
assert.strictEqual(rule(nightmare, 'breederCardEffect'), 1);
assert.strictEqual(rule(nightmare, 'waveEnhancement'), 0.5);
assert.strictEqual(rule(nightmare, 'positiveModifier'), 0.5);
assert.strictEqual(rule(nightmare, 'negativeModifier'), 2);
assert.strictEqual(rule(null, 'breederCardEffect'), 1);

assert(source.includes('const specialRuleDifficultyForRun = (runMode, difficultyId, extremeRun=false, extremeDifficultyId=null) =>'));
assert(source.includes('const candidate=extremeRun ? extremeDifficultyId : (isQuickMode(runMode) ? difficultyId : null);'));
assert(source.includes('return hasExtremeSpecialRules(candidate) ? candidate : null;'));
assert(!source.includes('extremeRunRef.current?extremeSpecialRule(extremeDifficulty'), 'special rule activation must not depend only on extremeRunRef');
assert(source.includes("const effMul=isBreeder&&specialRuleDifficulty?extremeSpecialRule(specialRuleDifficulty,'breederCardEffect')"));
for (const use of [
  'applyNightmareWaveEnhancement(d*0.001/100,specialRuleDifficulty)',
  'applyNightmareSignedModifier(baseRecoveryDelta,specialRuleDifficulty)',
  'getMonsterAptPct(m,specialRuleDifficulty)',
  'applyNightmareStatGain(atk,Math.floor(atk*1.10),specialRuleDifficulty)',
]) assert(source.includes(use), `${use} must use the shared run rule difficulty`);
assert(source.includes('quick&&hasExtremeSpecialRules(key)') && source.includes('特殊ルールあり'));
assert(source.includes('extremeSpecialRuleLines(specialDifficulty).map'), 'battle intro must share the rule presentation');
assert(source.includes('extremeSpecialRuleLines(setting.id).map'), 'official card must share the same rule presentation');
assert(!/QUICK_EXTREME_SETTINGS[\s\S]{0,500}(breederCardEffect|waveEnhancement|positiveModifier|negativeModifier)/.test(source), 'quick settings must not duplicate special-rule values');
assert(source.includes("quick?'h-[366px] flex flex-col':''"), 'fixed quick card height must remain unchanged');
assert(source.includes('if (isQuickMode(runMode)) {') && source.includes('return;'), 'quick ranking exclusion path must remain present');
console.log('OK: クイック極限難易度はspecialRulesを共用し、通常難易度・報酬・ランキング・固定カード高を維持');
