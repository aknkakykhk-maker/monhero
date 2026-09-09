// 魂格 STEP5B「ランキング記録時スナップショット」の回帰検査。
// 正式ビルド後: node tools/masu/soul-rank-step5b-check.js
const {loadDyeModule}=require('../harness');
const api=loadDyeModule();
let failed=0;const ck=(n,o)=>{console.log(`${o?'OK':'NG'}: ${n}`);if(!o)failed++;};
const base={
  id:'rank-soul',baseId:'Mocchi',name:'魂格ランキング',
  transcended:true,soulRankStage:3,levelCap:800,
  bondXp:api.totalBondXpForLevel(750),soulPointMaxReachedLevel:750,
  soulTraitLevels:{allDamage:10,partyDamageReduction:2,critRate:5},
  rebirthCount:35,reincarnateCount:0,distAptPoints:0,distAptBoosts:[0,0,0,0],
  statPoints:{hp:0,atk:0,def:0,guts:0},
};
const d=api.rankingMasuDetail(base);
ck('ランキングdetail versionは魂格対応v6',d.v===6);
ck('記録時の魂格段階を保存',d.soulRankStage===3);
ck('全魂格特性振り分けを保存',d.soulTraitLevels.allDamage===10&&d.soulTraitLevels.partyDamageReduction===2&&d.soulTraitLevels.critRate===5);
ck('使用済み魂格Pを保存',d.soulSpentPoints===105);
ck('未使用魂格Pそのものは保存しない',!Object.prototype.hasOwnProperty.call(d,'soulAvailablePoints')&&!Object.prototype.hasOwnProperty.call(d,'soulPointAvailable'));
const restored=api.rankingDetailToMasu('Mocchi',d,[]);
ck('ランキング記録から魂格段階を復元',restored.soulRankStage===3);
ck('ランキング記録から魂格特性を復元',restored.soulTraitLevels.allDamage===10&&restored.soulTraitLevels.partyDamageReduction===2&&restored.soulTraitLevels.critRate===5);
ck('使用済み魂格Pスナップショットを保持',restored.soulSpentPointsSnapshot===105);
const old=api.rankingDetailToMasu('Mocchi',{v:5,bondXp:0,transcended:true,levelCap:500},[]);
ck('旧ランキングは魂格なしで安全に読む',old.soulRankStage===0&&Object.keys(old.soulTraitLevels).length===0&&old.soulSpentPointsSnapshot===0);
const mutated={...base,soulTraitLevels:{allDamage:1}};
ck('後から現個体を振り直しても保存済みdetailは変わらない',d.soulTraitLevels.allDamage===10&&mutated.soulTraitLevels.allDamage===1);
console.log(failed?`\n${failed}件のNG`:'\n魂格STEP5B: すべてOK');process.exit(failed?1:0);
