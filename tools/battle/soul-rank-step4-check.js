// 魂格システム STEP4「バトル接続」の回帰検査。
//
//   node tools/battle/soul-rank-step4-check.js
//
// 戦闘数式・手動操作・AUTOが同じ魂格特性ルールを使うことを固定する。
const fs=require('fs');
const path=require('path');
const {REPO_ROOT,loadDyeModule}=require('../harness');
const a=loadDyeModule();
const app=fs.readFileSync(path.join(REPO_ROOT,'monster-hero/src/parts/60-app.jsx'),'utf8');
const auto=fs.readFileSync(path.join(REPO_ROOT,'monster-hero/src/parts/18-points-and-auto.jsx'),'utf8');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const masu=(levels={})=>a.normalizeMasuProgression({
  id:'soul-step4',baseId:'Mocchi',name:'STEP4',transcended:true,soulRankStage:1,levelCap:600,
  soulPointMaxReachedLevel:1000,soulTraitLevels:levels,bondXp:a.totalBondXpForLevel(500),
  rebirthCount:35,distAptPoints:0,distAptBoosts:[0,0,0,0],statPoints:{hp:0,atk:0,def:0,guts:0}
});

// 攻撃系: 本人だけ / 連撃別枠 / 会心
{
  const m=masu({allDamage:2,uniqueDamage:3,normalDamage:4,rangeZeroDamage:5,comboFinalDamage:6,critRate:7,critDamage:8,gutsCostReduction:9});
  const unique=a.soulTraitAttackProfile(m,{type:'unique'},0);
  const normal=a.soulTraitAttackProfile(m,{type:'atk'},0);
  check('闘魂+奥義+距離極意を本人の固有技倍率へ合成',unique.damagePct===10&&Math.abs(unique.damageMultiplier-1.10)<1e-9);
  check('闘魂+武技+距離極意を本人の通常技倍率へ合成',normal.damagePct===11&&Math.abs(normal.damageMultiplier-1.11)<1e-9);
  check('連撃強化はcomboDmgPctへ混ぜず最終倍率で返す',unique.comboFinalPct===6&&Math.abs(unique.comboFinalMultiplier-1.06)<1e-9);
  check('会心眼/会心極/省気を別値で返す',unique.critRatePoints===7&&unique.critDamagePct===8&&unique.gutsCostReductionPct===9);
  check('魂格なしは攻撃・会心・省気を一切増やさない',
    a.soulTraitAttackProfile({...m,soulRankStage:0},{type:'unique'},0).damageMultiplier===1
    && a.soulTraitAttackProfile({...m,soulRankStage:0},{type:'unique'},0).gutsCostMultiplier===1);
}

// 防御系: 残り乗算・特殊防御75%・E:R:A比率
{
  const combined=a.combineSoulProbabilityPoints([25,25,25,25]);
  check('同種25%×4は残り乗算で68.359375%',Math.abs(combined-68.359375)<1e-9,String(combined));
  const p=a.buildUnifiedSpecialDefense({existingEvasion:50,soulEvasion:20,existingReflect:30,soulReflect:20,existingAbsorb:20,soulAbsorb:20});
  check('回避/反射/吸収は同種内を残り乗算',Math.abs(p.evasion-60)<1e-9&&Math.abs(p.reflect-44)<1e-9&&Math.abs(p.absorb-36)<1e-9);
  check('特殊防御発動率はmax(E,R,A)・上限75%',p.rate===60);
  check('特殊防御発動時はE:R:A比率で1種類だけ選ぶ',
    a.rollUnifiedSpecialDefense(p,0.1,0)==='evasion'
    && a.rollUnifiedSpecialDefense(p,0.1,0.99)==='absorb'
    && a.rollUnifiedSpecialDefense(p,0.99,0)==='none');
  const capped=a.buildUnifiedSpecialDefense({existingEvasion:90,soulEvasion:90});
  check('特殊防御は75%を超えない',capped.rate===75);
}

// パーティ特性
{
  const p=a.soulTraitPartyPreview([
    masu({partyDamageReduction:5,partyEvasion:10,enemyDisable:20,autoGutsRecovery:20,coordination:1}),
    masu({partyDamageReduction:5,partyEvasion:10,enemyDisable:20,autoGutsRecovery:20,coordination:1}),
  ]);
  check('鉄壁は加算ではなく残り乗算',Math.abs(p.damageReduction-9.75)<1e-9);
  check('残像/威圧も同種残り乗算',Math.abs(p.evasion-19)<1e-9&&Math.abs(p.intimidate-36)<1e-9);
  check('自動ガッツ回復は正の回復量への乗算倍率',Math.abs(p.autoGutsMultiplier-1.44)<1e-9);
  check('連携は複数所持でもパーティ+1だけ',p.coordinationCardBonus===1);
}

// 実戦接続: 参加中マスモンのみ
check('実戦魂格効果はslotsのmasuIdだけから組み立てる',
  app.includes("const battleSoulMasus = slots.map(mon=>mon?.masuId?getMasuMon(mon.masuId):null).filter(Boolean)")
  && app.includes('const soulBattleParty = soulTraitPartyPreview(battleSoulMasus)'));
check('鉄壁は既存被ダメ軽減と乗算して実ダメ/予測共通入口へ入る',
  app.includes('const soulDamageRemaining=Math.max(0,1-(soulBattleParty.damageReduction/100))')
  && app.includes('getIncomingDamageBeforeTurnReduction'));
check('回避・反射・吸収は統一特殊防御を1回だけ抽選',
  app.includes('const unifiedSpecialDefense = buildUnifiedSpecialDefense({')
  && app.includes("rollUnifiedSpecialDefense(unifiedSpecialDefense,Math.random(),Math.random())"));
check('既存確定反射バフは従来どおり確定で優先',
  app.includes("getTurnBuff('reflect',false)")&&app.includes("? 'reflect'"));
check('威圧はSuezo既存40%と同種乗算して特殊防御と分離',
  app.includes("const battleIntimidate = combineSoulProbabilityPoints([")
  && app.includes("mainHero?.id==='Suezo'?40:0"));
check('自動ガッツ回復は既存最終率を0でクランプしてから魂格倍率',
  app.includes('Math.max(0,gutsRecoveryRate)*soulBattleParty.autoGutsMultiplier'));

// 省気: 本人だけ、手動/実消費/AUTOでslot-aware
check('省気は割当先slotの本人だけから取得',
  app.includes('const getCardGuts = (card, slotIdx=null) =>')
  && app.includes("soulTraitAttackProfile(soulOwner,card,slotIdx).gutsCostMultiplier"));
check('省気は高難度倍率とまとめて最後に丸める',
  app.includes("effectiveExtremeSpecialRule(specialRuleDifficulty,'gutsCost',wave)*soulGutsMultiplier"));
check('実ターンの合計と個別消費はslotIdx込みgetCardGutsを使う',
  app.includes('usedCardEntries.reduce((sum,entry)=>sum+getCardGuts(entry.card,entry.slotIdx),0)')
  && app.includes('getCardGuts(card,slotIdx)'));
check('手動ドラッグのガッツ判定も割当slotを使う',
  app.includes('const curGuts=getCardGuts(c,slotIdx)')
  && app.includes("getCardGuts(hand[idx],cardAssignments[idx]!=null?cardAssignments[idx]:null)"));
check('AUTOも同じslot-aware getCardGutsを使う',
  auto.includes('getCardGuts(card, slotIdx)')&&auto.includes('slotMaxUses(monster, slotIdx)'));

// 連携: 全体+1、追加1枚は所持者のみ、最大5
check('連携は参加中所持者の有無だけで+1',
  app.includes("const soulCoordinationCardBonus = soulCoordinationSlots.length>0 ? 1 : 0"));
check('既存カード上限+連携を最終5枚でクランプ',
  app.includes('const cardLimit = Math.min(5,baseCardLimit+soulCoordinationCardBonus)'));
check('連携追加枠は連携所持者のslotだけ増やす',
  app.includes('const coordinationHolder=Number.isInteger(slotIdx)&&soulCoordinationSlots.includes(slotIdx)')
  && app.includes('base+(coordinationHolder?soulCoordinationCardBonus:0)'));
check('手動とAUTOが同じslotMaxUsesを使う',
  app.includes('slotMaxUses(targetMon,slotIdx)')&&auto.includes('slotMaxUses(monster, slotIdx)'));

// STEP4で範囲外へ踏み込まない
check('プロはマスモンslotsが無い限り魂格効果を発生させない',app.includes('battleSoulMasus'));
check('STEP5の魂格継承合体・ランキングスナップショットはSTEP4チェック対象外',
  !app.includes('data-soul-rank-inherit-fusion') && !app.includes('soulTraitSnapshotVersion'));
check('STEP6の魂格オーラはまだ接続しない',!app.includes('soul-rank-aura-'));

console.log(failed?`\n${failed}件のNGがあります`:'\n魂格STEP4: すべてOK');
process.exit(failed?1:0);
