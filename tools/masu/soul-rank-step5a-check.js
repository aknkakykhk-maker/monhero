// 魂格 STEP5A「合体継承」の回帰検査。
// 正式ビルド後: node tools/masu/soul-rank-step5a-check.js
const {loadDyeModule,readAppSource}=require('../harness');
const api=loadDyeModule();
// 合体画面は 66-screen-masu-fusion.jsx へ切り出したので、本体と画面の両方を通して見る
const app=readAppSource();
let failed=0;const ck=(n,o)=>{console.log(`${o?'OK':'NG'}: ${n}`);if(!o)failed++;};
const make=(id,stage,levelCap,maxReached,traits={})=>api.normalizeMasuProgression({
  id,baseId:'Mocchi',name:id,transcended:true,soulRankStage:stage,levelCap,
  bondXp:api.totalBondXpForLevel(Math.min(levelCap,maxReached)),
  soulPointMaxReachedLevel:maxReached,soulTraitLevels:traits,
  rebirthCount:35,distAptPoints:0,distAptBoosts:[0,0,0,0],statPoints:{hp:0,atk:0,def:0,guts:0},
});
{
  const main=make('main',2,700,650,{allDamage:3});
  const sub=make('sub',4,900,900,{critDamage:9});
  const p=api.buildFusionSoulRankInheritancePlan({main,subs:[sub],inherit:true,gold:40000000,ownedItems:{hero_proof:100}});
  ck('副の魂格が高いときだけ継承可能',p.eligible&&p.currentStage===2&&p.targetStage===4);
  ck('不足段階III+IVの通常進化コストを合算',p.diamondCost===35000000&&p.heroProofCost===90);
  ck('主のLv上限だけ魂格IV相当へ解放',p.nextMasu.soulRankStage===4&&p.nextMasu.levelCap===900);
  ck('主の最高初到達Lvと魂格特性を維持',p.nextMasu.soulPointMaxReachedLevel===650&&p.nextMasu.soulTraitLevels.allDamage===3&&!p.nextMasu.soulTraitLevels.critDamage);
  ck('副の魂格P履歴・振り分けをコピーしない',p.nextMasu.soulPointMaxReachedLevel!==900);
  ck('費用を正しく差し引く',p.nextGold===5000000&&p.nextOwnedItems.hero_proof===10);
}
{
  const main=make('main2',2,700,650,{allDamage:3});
  const sub=make('sub2',4,900,900,{critDamage:9});
  const p=api.buildFusionSoulRankInheritancePlan({main,subs:[sub],inherit:false,gold:40000000,ownedItems:{hero_proof:100}});
  ck('通常合体では主の魂格を変えない',p.ok&&p.nextMasu.soulRankStage===2&&p.nextMasu.levelCap===700&&p.nextGold===40000000&&p.nextOwnedItems.hero_proof===100);
}
ck('合体画面に魂格継承の一時状態がある',app.includes('fusionInheritSoulRank')&&app.includes('setFusionInheritSoulRank'));
ck('実処理で魂格継承をXP加算より先に適用',app.includes('buildFusionSoulRankInheritancePlan({')&&app.includes('const fusionMainBase = soulInheritancePlan.nextMasu'));
ck('魂格継承時は勇者の証も取引保存',app.includes("withBreakthrough||fusionInheritSoulRank")&&app.includes("key:'mh_owned_items'"));
ck('合体確認UIに魂格継承切替を表示',app.includes('data-soul-rank-inherit-fusion')&&app.includes('魂格を引き継いで合体'));
ck('合体結果に魂格継承を表示',app.includes('data-soul-rank-inherit-result')&&app.includes('soulRankInherited'));
console.log(failed?`\n${failed}件のNG`:'\n魂格STEP5A: すべてOK');process.exit(failed?1:0);
