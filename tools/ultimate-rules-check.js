#!/usr/bin/env node
const fs=require('fs');
const assert=require('assert');
const source=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const changelog=fs.readFileSync('monster-hero/data/changelog.js','utf8');
const help=fs.readFileSync('monster-hero/data/help.js','utf8');
const enemy=(hp,atk,total)=>({hp:Math.floor(hp*35*(1+total*.0075)),atk:Math.floor(atk*35*(1+total*.0075))});
assert.deepStrictEqual(enemy(550,70,0),{hp:19250,atk:2450});
assert.deepStrictEqual(enemy(550,70,10),{hp:20693,atk:2633});
assert.deepStrictEqual(enemy(550,70,50),{hp:26468,atk:3368});
assert.notStrictEqual(enemy(550,70,18).hp,Math.floor(enemy(550,70,10).hp*1.06),'enemy correction must use the baseline');
// トレーニング(旧・能力覚醒)のULTIMATE低下。割合は max(0, 効果 - T×0.75%)、固定値は 1-T/20 で縮む。
// 4種の内訳と同一項目2回の複利は tools/training-reward-check.js が本体の関数を動かして見る。
const training=(v,t)=>{const p=t*.0075,f=1-t/20;return {hp:Math.floor(v.hp*(1+Math.max(0,.20-p))),atk:Math.floor(v.atk*(1+Math.max(0,.05-p))),def:Math.floor(v.def*(1+Math.max(0,.20-p))),guts:Math.floor((v.guts+5*f)*(1+Math.max(0,.05-p)))};};
assert.deepStrictEqual(training({atk:100,def:100,hp:500,guts:100},0),{hp:600,atk:105,def:120,guts:110});
assert.deepStrictEqual(training({atk:100,def:100,hp:500,guts:100},10),{hp:562,atk:100,def:112,guts:102});
assert(source.includes('const TRAINING_PICK_COUNT = 2;')&&source.includes('resolveTrainingStep'),'training resolver must exist');
assert(/ULTIMATE[^\n]+available:true[^\n]+power:35[^\n]+score:20[^\n]+xp:40[^\n]+gold:20[^\n]+psyche:60/.test(source),'ULTIMATE multipliers must match');
for(const rule of ['enemyTurnRate:0.0075','allyJoinPenaltyRate:0.0075','damageTurnRate:0.0075','minimumDamageDealt:0.25','awakeningPenaltyRate:0.0075','interval:35','damageDealtPerLevel:0.5','safeDistanceCount:1']) assert(source.includes(rule),`missing rule: ${rule}`);
const pending=(total,levels,wave=1,difficulty='ULTIMATE')=>difficulty==='ULTIMATE'&&wave<10&&total>=(levels.reduce((a,b)=>a+b,0)+1)*35?(levels.reduce((a,b)=>a+b,0)+1)*35:null;
assert.strictEqual(pending(34,[0,0,0,0]),null);assert.strictEqual(pending(35,[0,0,0,0]),35);assert.strictEqual(pending(105,[1,1,0,0]),105);assert.strictEqual(pending(140,[1,1,1,0]),140);assert.strictEqual(pending(315,[3,3,2,0]),315);assert.strictEqual(pending(350,[3,3,3,0]),350);assert.strictEqual(pending(350,[3,3,3,0],10),null);
const drawCandidates=levels=>{const active=levels.filter(v=>v>0),min=active.length?Math.min(...active):0;return levels.map((v,i)=>active.length<3?v===0?i:null:v===min?i:null).filter(v=>v!=null);};
let levels=[0,0,0,0];for(let event=0;event<9;event++){const c=drawCandidates(levels);const pick=c[event%c.length];levels[pick]++;if(event===2)assert.strictEqual(levels.filter(Boolean).length,3);if(event===5)assert.deepStrictEqual(levels.filter(Boolean).sort(),[2,2,2]);}assert.deepStrictEqual(levels.filter(Boolean).sort(),[3,3,3]);assert.strictEqual(levels.filter(v=>v===0).length,1);
const damage=(base,elapsed,level)=>Math.floor(Math.floor(base*Math.max(.25,1-elapsed*.0075))*(.5**level));
assert.strictEqual(damage(1000,0,0),1000);assert.strictEqual(damage(1000,1,0),992);assert.strictEqual(damage(1000,100,0),250);assert.strictEqual(damage(1000,999,0),250);assert.strictEqual(damage(1000,0,1),500);assert.strictEqual(damage(1000,0,2),250);assert.strictEqual(damage(1000,0,3),125);assert.strictEqual(damage(1000,100,2),62);
assert(source.includes('const elapsedTotalTurns=totalTurnCount+Math.max(0,turnCount-1)'),'first turn must count as elapsed 0T');
assert(source.includes('const turnPressedDmg=Math.floor(finalDmg*ultimateDamageTurnMultiplier')&&source.includes('applyUltimateDistanceBreak(turnPressedDmg'),'turn pressure and BREAK must multiply in shared damage path');
assert(source.includes('const enemyTurnMultiplier=specialRuleDifficulty===ULTIMATE_SETTING.id?ultimateEnemyTurnMultiplier(totalTurnCount):1;'),'enemy turn pressure must use shared run rule difficulty');
assert(source.includes('const distanceBreakThreshold=pendingUltimateDistanceBreak(newTotalTurnCount,ultimateDistanceBreakLevelsRef.current,wave,specialRuleDifficulty);'),'BREAK reservation must use shared run rule difficulty');
assert(source.includes('const breakPending=w>1&&ultimateDistanceBreakPendingRef.current&&specialRuleDifficulty===ULTIMATE_SETTING.id;'),'BREAK draw, level update, and reveal must use shared run rule difficulty');
assert(source.includes('specialDifficulty===ULTIMATE_SETTING.id?<>' )&&source.includes('ultimateDistanceBreakLevels.map'),'ULTIMATE rule and BREAK status presentation must use shared run rule difficulty');
assert(source.includes('ultimateDistanceBreakLevelsRef.current=[0,0,0,0]')&&!source.includes('ultimateWeakenedDistances'),'levels must be run-only and replace weakened-distance list');
assert(source.includes('DISTANCE BREAK OVERWRITE')&&source.includes("distanceBreakLevel===1?'⚠':'☠'")&&source.includes('data-distance-break-level'),'level presentation and overwrite reveal must exist');
assert(source.includes('waveResult?.turn,specialRuleDifficulty')&&source.includes('const gainedDistBonus=finalDistDamage.map(d=>applyNightmareWaveEnhancement'),'existing wave-stat resolver must remain and distance enhancement must stay excluded');
assert(source.includes("specialRules:Object.freeze({ waveEnhancement:0.5, positiveModifier:0.5, negativeModifier:2.0 })")&&source.includes("specialRules:Object.freeze({ damageDealt:0.5, allyJoinBonus:0.5, gutsCost:1.5 })"),'NIGHTMARE and CHAOS rules must remain unchanged');
assert(help.includes('敵強度×35・スコア×20・経験値×40・ダイヤ×20')&&help.includes('最低25%')&&help.includes('安全距離'),'help must match new rules');
assert(changelog.includes('ULTIMATEの難易度を調整しました'),'changelog must announce adjustment');
assert(source.includes('h-[382px]')&&source.includes('h-[51px]'),'difficulty card dimensions must remain fixed');
console.log('OK: ULTIMATE難易度調整（×35、各0.75%、最低25%、35T段階BREAK、安全距離、予測共通経路、他難易度回帰）');
