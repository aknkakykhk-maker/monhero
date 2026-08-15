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
assert(/\{ id:'ULTIMATE', label:'ULTIMATE', available:true, power:25, score:20, xp:40, gold:20, psyche:60,/.test(source),'formal ULTIMATE values must be available');
assert(source.includes("unlockRequirement:'CHAOS'")&&source.includes('allyJoinPenaltyRate:0.005'),'ULTIMATE must define its CHAOS unlock prerequisite and ally penalty rate');
assert(source.includes('const ULTIMATE_SETTING = EXTREME_DIFFICULTIES[3]'),'ULTIMATE_SETTING must reference the formal difficulty definition');
assert(source.includes("const ULTIMATE_BEST_SCORE_KEY = extremeBestScoreKey('ULTIMATE');")&&source.includes("const ULTIMATE_CLEAR_COUNT_KEY = extremeClearCountKey('ULTIMATE');"),'ULTIMATE records must use the shared extreme key format');
assert(source.includes('EXTREME_DIFFICULTIES.map(async setting =>')&&source.includes('normalizeExtremeRecordValue(await storeGet(extremeBestScoreKey(setting.id), 0, false))')&&source.includes('normalizeExtremeRecordValue(await storeGet(extremeClearCountKey(setting.id), 0, false))'),'all extreme records, including missing ULTIMATE saves, must load through shared normalization');
assert(source.includes('setExtremeBestScores(prev => ({ ...prev, [extremeDifficulty]: score }))')&&source.includes('setExtremeClearCounts(prev => ({ ...prev, [extremeDifficulty]:'),'future official ULTIMATE runs must update the selected difficulty record without dedicated branches');
assert(source.includes('EXTREME_DIFFICULTIES.filter(setting=>setting.available).map(setting=>')&&source.includes('EXTREME_DIFFICULTIES.filter(item=>item.available).map(item=>item.id)'),'available ULTIMATE must use the shared ranking and profile filters');
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
assert(source.includes("applyAllyJoinBonus(bonus[key]||0,specialRuleDifficulty,waveResult?.totalTurnCount)"),'ally joins must use the completed WAVE cumulative total, not stale React state');
assert(!/allyJoin(?:Total)?TurnCount/.test(source),'ULTIMATE must not introduce a separate ally-join turn counter');
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
for(const [label,value] of [['敵強化','累計T ×0.5%'],['供モン加入B低下','累計T ×0.5%'],['能力覚醒低下','WAVE T ×0.5%'],['距離弱体','50Tごと / 与ダメ50%']]) {
  assert(source.includes(`['${label}','${value}']`),`ULTIMATE difficulty card must show: ${label} ${value}`);
}
assert(source.indexOf("if (difficultyId===ULTIMATE_SETTING.id) return [")<source.indexOf("const rules=extremeDifficultySetting(difficultyId)?.specialRules || {};"),'ULTIMATE card labels must bypass generic special-rule rendering');
assert(!changelog.includes('ULTIMATEデバッグ表示を改善')&&!help.includes('未公開ULTIMATEのデバッグ表示'),'unreleased debug UI must not be announced in public changelog or help');
for(const text of ['ULTIMATE 特殊ルール','累計ターン圧','覚醒低下','DISTANCE BREAK','現在の累計ターン：','現在の弱体距離：','※距離強化は対象外']) {
  assert(source.includes(text),`ULTIMATE rule overlay must show: ${text}`);
}
assert(source.includes("join(' / ')||'なし'"),'rule and reveal overlays must name active distances or explicitly show none');
assert(source.includes('repeating-linear-gradient')&&source.includes('border-red-400')&&source.includes('⚠ 与ダメ ↓50%'),'broken slots must combine warning badge, corrupted texture, and danger border');
const allyJoin=(value,total,difficulty='ULTIMATE')=>difficulty==='ULTIMATE'
  ? Math.floor(value*Math.max(0,1-total*.005))
  : difficulty==='CHAOS'?Math.floor(value*.5):value;
for(const [turns,percent] of [[0,1],[20,.9],[40,.8],[50,.75],[80,.6],[100,.5],[120,.4]]) {
  assert.strictEqual(allyJoin(100,turns),Math.floor(100*percent),`${turns}T ally multiplier must be ${percent*100}%`);
}
assert.strictEqual(allyJoin(31,50),23,'ULTIMATE 31 at 50T must floor to 23');
assert.strictEqual(allyJoin(31,100),15,'ULTIMATE 31 at 100T must floor to 15');
assert.strictEqual(allyJoin(31,50,'CHAOS'),15,'CHAOS must remain a single fixed 50% reduction');
assert.strictEqual(allyJoin(31,50,null),31,'normal ally bonuses must remain unchanged');
assert(source.includes('const aptDelta=getMonsterAptPct(m,specialRuleDifficulty)')&&source.includes('const newAllyUnique={...m.unique'),'aptitude and unique acquisition must stay outside the ally bonus helper');
assert(source.includes('nextSlots[slotIdx]={...m}')&&source.indexOf('nextSlots[slotIdx]={...m}')<source.indexOf('applyAllyJoinBonus(bonus[key]'),'the ally must join independently before its stat bonus is calculated');
assert(source.includes('const chaosClearCount = extremeClearCounts[CHAOS_SETTING.id] || 0;')&&source.includes('const ultimateUnlocked = useMemo(() => isUltimateUnlocked(chaosClearCount)'),'ULTIMATE unlock must reuse CHAOS clear counts');
assert(source.includes('const isUltimateUnlocked = (chaosClearCount) => (Number(chaosClearCount) || 0) > 0;'),'zero CHAOS clears must be locked and one or more must unlock');
assert(source.includes("const previewable=(setting.available||debugBattle&&setting.id===ULTIMATE_SETTING.id)&&unlocked"),'official ULTIMATE must be previewable when unlocked while debug remains available');
assert(help.includes('CHAOSを1回以上クリアすると解放')&&help.includes('敵強度×25・スコア×20・経験値×40・ダイヤ×20')&&help.includes('虹のプシュケー60個'),'help must describe ULTIMATE unlock and rewards');
assert(changelog.includes('極限チャレンジにULTIMATEを追加しました')&&changelog.includes("assistantNotice: { id:'update_notice_ultimate_v1', type:'mode' }"),'ULTIMATE release must have a linked assistant notice');
assert(source.includes('h-[382px]')&&source.includes('h-[51px]'),'difficulty card and special-rule box dimensions must remain fixed');
console.log('OK: ULTIMATE正式公開（解放、加入ボーナス低下、ターン強化、能力低下、距離弱体化、記録共通経路、デバッグ分離）');
