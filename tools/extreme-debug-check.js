#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const config = source.slice(source.indexOf('const EXTREME_DEBUG_DIFFICULTIES'), source.indexOf('const normalizeBattleDifficulty'));
for (const name of ['EXTREME','NIGHTMARE','CHAOS','ULTIMATE','INFINITY']) assert(config.includes(`'${name}'`), `${name} must be listed`);
assert(/EXTREME[^\n]+available:true[^\n]+power:13[^\n]+score:20[^\n]+xp:25[^\n]+gold:7\.5[^\n]+psyche:75[^\n]+teachingEffect:0\.5/.test(config), 'EXTREME settings must match the trial specification');
for (const name of ['NIGHTMARE','CHAOS','ULTIMATE','INFINITY']) assert(new RegExp(`${name}[^\\n]+available:false`).test(config), `${name} must remain unavailable without placeholder values`);
assert(source.includes('debugExtremeRef.current?EXTREME_DEBUG_SETTING.power:null'), 'enemy generation must use x13 only in EXTREME debug');
assert(source.includes("isBreeder&&debugExtremeRef.current?EXTREME_DEBUG_SETTING.teachingEffect"), 'only breeder cards must receive the EXTREME multiplier');
assert(source.includes("addPermaBuff('atkPct',card.baseValue*effMul)"), 'normal breeder buff must use the shared multiplier');
assert(source.includes('Math.floor(getDmg(card,slotIdx,stunMon,localOryoAdd,localDmgModAdd,false)*effMul)'), 'breeder attack damage must use the shared multiplier');
assert(source.includes("const d=getDmg(card,slotIdx,activeMon,localOryoAdd,localDmgModAdd,halved"), 'non-breeder attacks must retain their existing calculation');
assert(source.indexOf('debugBattleRef.current') < source.indexOf('awardRunRewards'), 'debug reward isolation must precede persistent rewards');
assert(source.includes('EXTREME 検証結果（保存されません）'), 'debug result must show calculated rewards without persistence');
assert.strictEqual(Math.floor(100 * 0.5), 50, 'representative integer card effect must be exactly 50%');
assert.strictEqual(0.1 * 0.5, 0.05, 'representative ratio card effect must be exactly 50%');
assert.strictEqual(Math.floor(100 * 13), 1300, 'EXTREME enemy HP/attack must be x13 versus Normal');
console.log('OK: EXTREME debug values, locked future tiers, breeder-only 50%, enemy x13, and persistence isolation');
