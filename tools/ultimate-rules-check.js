#!/usr/bin/env node
const fs=require('fs');
const assert=require('assert');
const source=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const enemySource=fs.readFileSync('monster-hero/data/enemy-monsters.js','utf8');
const changelog=fs.readFileSync('monster-hero/data/changelog.js','utf8');
const help=fs.readFileSync('monster-hero/data/help.js','utf8');
const enemy=(hp,atk,total)=>({hp:Math.floor(hp*25*(1+total*.005)),atk:Math.floor(atk*25*(1+total*.005))});
assert.deepStrictEqual(enemy(550,70,0),{hp:13750,atk:1750});
assert.deepStrictEqual(enemy(550,70,10),{hp:14437,atk:1837});
assert.deepStrictEqual(enemy(550,70,18),{hp:14987,atk:1907});
assert.deepStrictEqual(enemy(550,70,50),{hp:17187,atk:2187});
assert.notStrictEqual(enemy(550,70,18).hp,Math.floor(enemy(550,70,10).hp*1.09),'enemy correction must not multiply the previous WAVE');
const stats=(v,t)=>{const p=t*.005,f=1-t/20;return {atk:Math.floor(v.atk*(1+Math.max(0,.1-p))),def:Math.floor((v.def+20*f)*(1+Math.max(0,.1-p))),hp:Math.floor(v.hp*(1+Math.max(0,.2-p))),guts:Math.floor((v.guts+10*f)*(1+Math.max(0,.1-p)))};};
const base={atk:100,def:100,hp:500,guts:100};
assert.deepStrictEqual(stats(base,5),{atk:107,def:123,hp:587,guts:115});
assert.deepStrictEqual(stats(base,10),{atk:105,def:115,hp:575,guts:110});
assert.deepStrictEqual(stats(base,20),{atk:100,def:100,hp:550,guts:100});
assert(/\{ id:'ULTIMATE', label:'ULTIMATE', available:false, power:25, score:20, xp:40, gold:20, psyche:60,/.test(source),'formal ULTIMATE values must exist and stay unavailable');
assert(source.includes('const ULTIMATE_SETTING = EXTREME_DIFFICULTIES[3]'),'ULTIMATE_SETTING must reference the formal difficulty definition');
assert(!source.includes('ULTIMATE_DEBUG_SETTING'),'ULTIMATE must not keep a separate debug setting');
for(const rule of ["enemyTurnRate:0.005","awakeningPenaltyRate:0.005","awakeningPenaltyExcludes:Object.freeze(['distance'])","turns:Object.freeze([50,100,150])","damageDealt:0.5","rerollSameDistance:false","persistsForRun:true"]) {
  assert(source.includes(rule),`formal ULTIMATE rules must include: ${rule}`);
}
assert(source.includes('baseHp*mod*enemyTurnMultiplier')&&source.includes('baseAtk*mod*enemyTurnMultiplier'),'HP and attack must share the turn multiplier');
assert(source.includes('ultimateEnemyTurnMultiplier(totalTurnCount)'),'enemy correction must use existing cumulative total');
assert(source.includes('waveResult?.turn,specialRuleDifficulty'),'stat reduction must use the completed WAVE turn');
assert(source.includes('const gainedDistBonus=finalDistDamage.map(d=>applyNightmareWaveEnhancement'),'distance gain route must remain unchanged');
assert(source.includes("specialRules:Object.freeze({ waveEnhancement:0.5, positiveModifier:0.5, negativeModifier:2.0 })"),'NIGHTMARE 50% rule must remain');
assert(source.includes('setTotalTurnCount(newTotalTurnCount)')&&source.includes('const newTotalTurnCount=totalTurnCount+turnCount'),'existing cumulative counting must remain');
assert(source.includes('Math.max(0,21-turnCount)'),'20-turn scoring boundary must remain');
assert(/Gel:[^\n]+baseHp:550[^\n]+baseAtk:70/.test(enemySource),'Gel baseline must remain in enemy data');
const thresholds=[50,100,150];
const pending=(total,weakened,wave=1,difficulty='ULTIMATE')=>difficulty==='ULTIMATE'&&wave<10
  ? thresholds.find((threshold,index)=>index>=weakened.length&&total>=threshold)||null:null;
const draw=(weakened,random)=>{const candidates=[0,1,2,3].filter(index=>!weakened.includes(index));return candidates[Math.floor(random()*candidates.length)];};
assert.strictEqual(pending(49,[]),null,'49 turns must not reserve a break');
assert.strictEqual(pending(50,[]),50,'50 turns must reserve the first break');
assert.strictEqual(pending(99,[2]),null,'99 turns must keep one broken distance');
assert.strictEqual(pending(100,[2]),100,'100 turns must reserve a second break');
assert.strictEqual(pending(150,[2,0]),150,'150 turns must reserve a third break');
const broken=[]; for(const roll of [0.6,0,0.99]) broken.push(draw(broken,()=>roll));
assert.strictEqual(new Set(broken).size,3,'a distance must never be selected twice');
assert.strictEqual([0,1,2,3].filter(index=>!broken.includes(index)).length,1,'one distance must remain normal after three breaks');
const distanceDamage=(damage,slot,weakened,difficulty,type)=>difficulty==='ULTIMATE'&&['atk','range_atk','unique'].includes(type)&&weakened.includes(slot)?Math.floor(damage*.5):damage;
for(const type of ['atk','range_atk','unique']) assert.strictEqual(distanceDamage(100,2,[2],'ULTIMATE',type),50,`${type} must be halved by its source slot`);
assert.strictEqual(distanceDamage(100,1,[2],'ULTIMATE','range_atk'),100,'the card target distance must not decide the break');
assert.strictEqual(distanceDamage(100,2,[2],'ULTIMATE','buff'),100,'breeder and non-monster damage must remain unchanged');
assert.strictEqual(distanceDamage(100,2,[2],'CHAOS','atk'),100,'non-ULTIMATE modes must not use distance breaks');
assert.strictEqual(pending(150,[2,0],10),null,'WAVE 10 must not reserve a next-WAVE break');
assert(source.includes("const distanceBrokenDmg=applyUltimateDistanceBreak(finalDmg,slotIdx,ultimateWeakenedDistances,specialRuleDifficulty,card.type)"),'actual and predicted damage must share getDmg distance reduction');
assert(source.includes("const raw=Math.floor(baseDmg*rate)")&&source.includes("const base=Math.floor(d*rate)"),'combo and follow-up damage must derive from the once-reduced base');
assert(source.includes('ultimateWeakenedDistancesRef.current=[]; setUltimateWeakenedDistances([])'),'new runs must reset broken distances');
assert(source.includes('setWaveBuffs({}); // WAVE毎リセット')&&!source.includes("addWaveBuff('ultimateDistance"),'distance breaks must not be WAVE buffs');
assert(source.includes('data-distance-broken')&&source.includes('与ダメ ↓50%'),'empty and occupied broken slots must stay visibly marked');
assert(source.includes('data-ultimate-distance-break-warning')&&source.includes('data-ultimate-distance-break-reveal'),'result warning and one-time reveal must exist');
for(const [label,value] of [['敵強化','累計T ×0.5%'],['能力覚醒低下','WAVE T ×0.5%'],['距離弱体','50Tごと / 与ダメ50%']]) {
  assert(source.includes(`['${label}','${value}']`),`ULTIMATE difficulty card must show: ${label} ${value}`);
}
assert(source.indexOf("if (difficultyId===ULTIMATE_SETTING.id) return [")<source.indexOf("const rules=extremeDifficultySetting(difficultyId)?.specialRules || {};"),'ULTIMATE card labels must bypass generic special-rule rendering');
assert(!changelog.includes('ULTIMATEデバッグ表示を改善')&&!help.includes('未公開ULTIMATEのデバッグ表示'),'unreleased debug UI must not be announced in public changelog or help');
for(const text of ['ULTIMATE 特殊ルール','累計ターン圧','覚醒低下','DISTANCE BREAK','現在の累計ターン：','現在の弱体距離：','※距離強化は対象外']) {
  assert(source.includes(text),`ULTIMATE rule overlay must show: ${text}`);
}
assert(source.includes("join(' / ')||'なし'"),'rule and reveal overlays must name active distances or explicitly show none');
assert(source.includes('repeating-linear-gradient')&&source.includes('border-red-400')&&source.includes('⚠ 与ダメ ↓50%'),'broken slots must combine warning badge, corrupted texture, and danger border');
console.log('OK: ULTIMATE特殊ルール①・②（ターン強化、能力低下、距離弱体化、予測一致、デバッグ限定、既存ルール分離）');
