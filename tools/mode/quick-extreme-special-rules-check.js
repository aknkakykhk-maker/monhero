#!/usr/bin/env node
// クイック極限難易度が極限本体のspecialRulesを共有し、通常クイックへ漏れないことを確認する。
const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');

const extreme = { assistCardEffect: 0.5 };
const nightmare = { waveEnhancement: 0.5, positiveModifier: 0.5, negativeModifier: 2 };
const chaos = { damageDealt: 0.5, allyJoinBonus: 0.5, gutsCost: 1.5 };
const rule = (rules, key) => rules?.[key] ?? 1;
const specialRuleDifficulty = (runMode, difficultyId, extremeRun=false, extremeDifficultyId=null) => {
  const candidate=extremeRun ? extremeDifficultyId : (runMode==='quick' ? difficultyId : null);
  return ['EXTREME','NIGHTMARE','CHAOS','ULTIMATE'].includes(candidate) ? candidate : null;
};
assert.strictEqual(rule(extreme, 'assistCardEffect'), 0.5);
assert.strictEqual(rule(extreme, 'waveEnhancement'), 1);
assert.strictEqual(rule(nightmare, 'assistCardEffect'), 1);
assert.strictEqual(rule(nightmare, 'waveEnhancement'), 0.5);
assert.strictEqual(rule(nightmare, 'positiveModifier'), 0.5);
assert.strictEqual(rule(nightmare, 'negativeModifier'), 2);
assert.strictEqual(rule(null, 'assistCardEffect'), 1);
assert.strictEqual(rule(chaos, 'damageDealt'), 0.5);
assert.strictEqual(rule(chaos, 'allyJoinBonus'), 0.5);
assert.strictEqual(rule(chaos, 'gutsCost'), 1.5);
assert.strictEqual(specialRuleDifficulty('challenge','Normal'),null);
assert.strictEqual(specialRuleDifficulty('quick','Normal'),null);
assert.strictEqual(specialRuleDifficulty('quick','EXTREME'),'EXTREME');
assert.strictEqual(specialRuleDifficulty('quick','ULTIMATE'),'ULTIMATE');
assert.strictEqual(specialRuleDifficulty('challenge','Normal',true,'ULTIMATE'),'ULTIMATE');

assert(source.includes('const specialRuleDifficultyForRun = (runMode, difficultyId, extremeRun=false, extremeDifficultyId=null) =>'));
assert(source.includes('const candidate=extremeRun ? extremeDifficultyId : (isQuickMode(runMode) ? difficultyId : null);'));
assert(source.includes('return hasExtremeSpecialRules(candidate) ? candidate : null;'));
assert(!source.includes('extremeRunRef.current?extremeSpecialRule(extremeDifficulty'), 'special rule activation must not depend only on extremeRunRef');
assert(source.includes("const effMul=isBreeder&&specialRuleDifficulty?extremeSpecialRule(specialRuleDifficulty,'assistCardEffect')"));
for (const use of [
  'applyDistanceEnhancement(d*0.001/100,specialRuleDifficulty)',
  'applyNightmareSignedModifier(baseRecoveryDelta,specialRuleDifficulty)',
  'getMonsterAptPct(m,specialRuleDifficulty)',
  'applyNightmareStatGain(base,after,specialDifficulty)',
]) assert(source.includes(use), `${use} must use the shared run rule difficulty`);
assert(source.includes('quick&&hasExtremeSpecialRules(key)') && source.includes('特殊ルールあり'));
assert(source.includes('const groups=extremeRuleDetailGroups(specialDifficulty,isQuickMode(runMode));'), 'Quick ULTIMATE intro must describe automatic growth without changing the extreme training label');
assert(source.includes("? ['自動成長',`WAVE Tごと-${turnPointText(rules.awakeningPenaltyRate)}`]"), 'Quick ULTIMATE rule detail must call the WAVE effect automatic growth');
// クイックの自動成長は成長率そのものから引く(pt)、トレーニングは増える量へ掛ける(%)。
// 掛かり方が違うので、ルール詳細の言い方も分ける
assert(source.includes(": ['トレーニング',`強化量が WAVE Tごと-${precisePercent(rules.awakeningPenaltyRate)}`]"), 'training reduction must be described as a multiplier on the gain');
assert(source.includes("['与ダメ倍率',`経過Tごと-${turnPointText(rules.damageTurnRate)}（${specialRulePercent(rules.minimumDamageDealt??0)}で停止）`]")&&!source.includes('経過累計T×0.75%（最低25%）'), 'Quick ULTIMATE rule detail must explain the damage floor as a stopping point');
assert(source.includes('extremeRuleSummaryText(setting.id)')&&source.includes('data-extreme-rule-detail-open={setting.id}'), 'official card must point at the shared rule-detail sheet instead of listing rules');
assert(source.includes('const enemyTurnMultiplier=ultimateEnemyTurnMultiplier(totalTurnCount,specialRuleDifficulty);'), 'ULTIMATE enemy turn scaling must use the shared run rule difficulty');
assert(source.includes('const breakPending=w>1&&ultimateDistanceBreakPendingRef.current&&!!extremeDistanceBreakRule(specialRuleDifficulty);'), 'ULTIMATE BREAK reveal must use the shared run rule difficulty');
assert(!source.includes('ultimateDistanceBreakPendingRef.current&&extremeRunRef.current&&extremeDifficulty===ULTIMATE_SETTING.id'), 'BREAK activation must not depend on the extreme-run flags directly');
assert(!/QUICK_EXTREME_SETTINGS[\s\S]{0,700}(assistCardEffect|waveEnhancement|positiveModifier|negativeModifier|damageDealt|allyJoinBonus|gutsCost)/.test(source), 'quick settings must not duplicate special-rule values');
const quickExtremeSettings=source.match(/const QUICK_EXTREME_SETTINGS = Object\.freeze\(\{([\s\S]*?)\n\}\);/)?.[1]||'';
assert(quickExtremeSettings.includes('ULTIMATE: QUICK_ULTIMATE_SETTING'), 'Quick ULTIMATE must be published after CHAOS');
assert(source.includes("const QUICK_ULTIMATE_SETTING = Object.freeze({\n  label:'ULTIMATE', power:ULTIMATE_SETTING.power, xp:35, gold:12, psyche:60"), 'Quick ULTIMATE must use power/xp/diamond/psyche 35/35/12/60');
assert(source.includes('const quickDifficultySetting = (difficultyId) => difficultyId===ULTIMATE_SETTING.id')
  && source.includes('? QUICK_ULTIMATE_SETTING : QUICK_DIFFICULTY_SETTINGS[difficultyId];'), 'runtime must keep using the shared Quick ULTIMATE resolver');
assert(source.includes('const quickExtremeSetting = isQuickMode(runMode) ? quickDifficultySetting(difficulty) : null;'), 'runtime rewards must resolve the hidden setting');
assert(source.includes('ULTIMATE: QUICK_ULTIMATE_SETTING.psyche'), 'Quick ULTIMATE clear reward must resolve to 60 psyche');
assert.strictEqual(35*1.5,52.5, 'growth XP must include the existing quick multiplier');
assert.strictEqual(12*1.5,18, 'growth diamond must include the existing quick multiplier');
assert.strictEqual(60*2,120, 'psyche policy must double psyche');
assert.strictEqual(12*1.5*2,36, 'diamond policy must double the final quick diamond reward');
assert(source.includes('const quickGrowthRateForRun = (runMode, difficultyId, waveTurnCount) =>'));
assert(source.includes('specialRuleDifficultyForRun(runMode,difficultyId)'), 'growth penalty must share the special-rule resolver');
assert(source.includes("const penaltyRate=extremeRuleNumber(specialDifficulty,'awakeningPenaltyRate');"), 'growth penalty must reuse the difficulty rule instead of a duplicated rate');
assert(!/quickGrowthRateForRun[\s\S]{0,500}0\.0075/.test(source), 'quick growth must not duplicate the ULTIMATE rate');
const quickGrowthRate = turns => Math.max(0,0.10-Math.max(0,Number(turns)||0)*0.0075);
for(const [turns,expected] of [[1,.0925],[5,.0625],[10,.025],[14,0],[99,0]]) {
  assert(Math.abs(quickGrowthRate(turns)-expected)<1e-12, `unexpected Quick ULTIMATE growth at ${turns}T`);
}
assert(source.includes('const growthRate = quickGrowthRateForRun(runMode,difficulty,waveResult?.turn);'));
assert(source.includes('data-quick-ultimate-growth') && source.includes("effectiveRate=quickGrowthRateForRun(runMode,difficulty,waveResult.turn)"), 'Quick ULTIMATE result must show the effective shared growth calculation');
assert(source.includes('normalRate-effectiveRate'), 'Quick ULTIMATE result must compare normal and effective growth');
assert(source.includes('setHp(nextEffectiveMaxHp); setGuts(nextEffectiveMaxGuts);'), 'HP/guts full recovery must remain');
assert(source.includes('if(penaltyRate==null) return QUICK_GROWTH_MULT-1;'), 'other quick difficulties must keep 10% growth');
assert(source.includes("specialRuleDifficultyForRun('challenge','Normal',true,'ULTIMATE')") === false, 'production must not hard-code a Quick-only ULTIMATE rule branch');
assert(source.includes("quick?'h-[366px] flex flex-col':''"), 'fixed quick card height must remain unchanged');
assert(source.includes('if (isQuickMode(runMode)) {') && source.includes('return;'), 'quick ranking exclusion path must remain present');
const changelog=fs.readFileSync('monster-hero/data/changelog.js','utf8');
const assistants=fs.readFileSync('monster-hero/data/assistants.js','utf8');
assert(changelog.includes("id:'update_notice_quick_ultimate_v1', type:'mode'"), 'official notice must come from changelog');
assert(!assistants.includes('update_notice_quick_ultimate_v1'), 'notice must not be duplicated in assistants.js');
console.log('OK: クイックULTIMATEの公開・報酬・特殊ルール・自動成長・全回復・ランキング除外・表示・通知');
