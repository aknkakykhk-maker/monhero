// 魂格 STEP4「戦闘接続」の回帰検査。
// 正式ビルド後: node tools/masu/soul-rank-step4-check.js
const fs=require('fs'),path=require('path');
const {REPO_ROOT,loadDyeModule,readAppSource}=require('../harness');
// バトル画面は 71-screen-battle.jsx へ切り出したので、本体と切り出した画面を合わせて見る
const app=readAppSource();
const prog=fs.readFileSync(path.join(REPO_ROOT,'monster-hero/src/parts/11-masu-progression.jsx'),'utf8');
const hits=fs.readFileSync(path.join(REPO_ROOT,'monster-hero/src/parts/22-enemy-and-bond-entries.jsx'),'utf8');
const auto=fs.readFileSync(path.join(REPO_ROOT,'monster-hero/src/parts/18-points-and-auto.jsx'),'utf8');
const api=loadDyeModule();
let failed=0;const ck=(n,o)=>{console.log(`${o?'OK':'NG'}: ${n}`);if(!o)failed++;};const near=(a,b)=>Math.abs(a-b)<1e-9;
const masu=(levels={})=>api.normalizeMasuProgression({id:'s4',baseId:'Mocchi',transcended:true,soulRankStage:5,levelCap:1000,bondXp:api.totalBondXpForLevel(1000),soulPointMaxReachedLevel:1000,soulTraitLevels:levels,rebirthCount:35,distAptPoints:0,distAptBoosts:[0,0,0,0],statPoints:{hp:0,atk:0,def:0,guts:0}});
{
 const m=masu({allDamage:3,normalDamage:2,uniqueDamage:4,rangeMidDamage:5,comboFinalDamage:6,critRate:7,critDamage:8,gutsCostReduction:9});
 const n=api.soulTraitAttackProfile(m,{type:'atk'},2),u=api.soulTraitAttackProfile(m,{type:'unique'},2),a=api.soulTraitAttackProfile(m,{type:'debuff',subType:'stun_atsu'},2);
 ck('闘魂+武技+距離極意を同じ倍率へ合算',n.damagePct===10&&near(n.damageMultiplier,1.10));
 ck('奥義/距離、連撃最終、会心、省気を正しく分離',u.damagePct===12&&near(n.comboFinalMultiplier,1.06)&&near(n.critRateBonus,.07)&&near(n.critDamageBonus,.08)&&near(n.gutsCostMultiplier,.91));
 ck('あつの挑発は闘魂+距離だけ',a.damagePct===8);
}
{
 const p=api.soulTraitPartyPreview([masu({partyDamageReduction:10,partyEvasion:20,partyReflect:10,partyAbsorb:5,enemyDisable:25,autoGutsRecovery:10,coordination:1}),masu({partyDamageReduction:20,partyEvasion:30,partyReflect:20,partyAbsorb:10,enemyDisable:20,autoGutsRecovery:20,coordination:1})]);
 ck('鉄壁/回避/反射/吸収/威圧は乗算合成',near(p.damageReduction,28)&&near(p.evasion,44)&&near(p.reflect,28)&&near(p.absorb,14.5)&&near(p.intimidate,40));
 ck('自動ガッツは倍率乗算、連携は複数でも+1',near(p.autoGutsMultiplier,1.32)&&p.coordinationCardBonus===1);
 const d=api.buildUnifiedSpecialDefense({soulEvasion:50,soulReflect:40,soulAbsorb:30,existingEvasion:50,existingReflect:30,existingAbsorb:30});
 ck('既存勇者特性と同種合成し特殊防御率は75%上限',near(d.evasion,75)&&near(d.reflect,58)&&near(d.absorb,51)&&near(d.rate,75));
 ck('特殊防御は発動後E:R:Aから1つだけ選ぶ',api.rollUnifiedSpecialDefense(d,.74,0)==='evasion'&&api.rollUnifiedSpecialDefense(d,.74,.6)==='reflect'&&api.rollUnifiedSpecialDefense(d,.74,.99)==='absorb'&&api.rollUnifiedSpecialDefense(d,.75,0)==='none');
}
ck('実戦個体へ魂格stage/traitを持ち込む',prog.includes('soulRankStage: normalizeSoulRankStage(masu?.soulRankStage)')&&prog.includes('soulTraitLevels: normalizeSoulTraitLevels(masu?.soulTraitLevels)'));
ck('予測/実処理が共通魂格攻撃profileを使う',app.includes('soulTraitAttackProfile(mon?.masuId?getMasuMon(mon.masuId):null,card,slotIdx)')&&app.includes('soulTraitAttackProfile(activeMon?.masuId?getMasuMon(activeMon.masuId):null,card,slotIdx)'));
ck('会心100%上限・連撃最終倍率・贖罪追撃を共通化',app.includes("Math.min(1,(card.crit||0.1)+critRateBonus)")&&app.includes('comboFinalMultiplier:soulAttack.comboFinalMultiplier')&&hits.includes('beforeSoulFinal * safeComboFinalMultiplier')&&app.includes('attackAtonementDmg(card, finalD, soulAttack.comboFinalMultiplier)'));
ck('あつの挑発も魂格会心/連撃へ接続',app.includes('soulTraitAttackProfile(stunMon?.masuId?getMasuMon(stunMon.masuId):null,card,slotIdx)')&&app.includes('mainCanCrit:false, comboFinalMultiplier:soulAttack.comboFinalMultiplier'));
ck('鉄壁/特殊防御/威圧/自動ガッツを実戦へ接続',app.includes('iceLockEnemyDamageMult*soulDamageRemaining')&&app.includes('rollUnifiedSpecialDefense(unifiedSpecialDefense')&&app.includes("mainHero?.id==='Suezo'?40:0")&&app.includes('Math.max(0,gutsRecoveryRate)*soulBattleParty.autoGutsMultiplier'));
ck('省気は本人slot・手動/実消費/AUTOで共通',app.includes('const pendingCardGuts = (card) =>')&&app.includes('usedCardEntries.reduce((sum,entry)=>sum+getCardGuts(entry.card,entry.slotIdx),0)')&&auto.includes('getCardGuts(card, slotIdx)'));
ck('連携は全体+1/重複なし/所持本人だけ/総上限5',app.includes('soulCoordinationSlots.length>0 ? 1 : 0')&&app.includes('Math.min(5,baseCardLimit+soulCoordinationCardBonus)')&&app.includes('soulCoordinationSlots.includes(slotIdx)')&&app.includes('data-soul-coordination-bonus'));
ck('STEP5以降の合体継承・バッジ/オーラは未着手',!prog.includes('buildSoulRankFusionInheritance')&&!app.includes('soul-rank-aura-'));
console.log(failed?`\n${failed}件のNG`:'\n魂格STEP4: すべてOK');process.exit(failed?1:0);
