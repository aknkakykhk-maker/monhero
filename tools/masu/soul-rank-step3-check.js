// 魂格システム STEP3「魂格特性・UI・再編・総合力」の回帰検査。
//
//   node tools/masu/soul-rank-step3-check.js
//
// STEP3だけを確認する:
// - 18特性の正式定義
// - 魂格Pの獲得/使用/未使用を重複保存せず導出
// - +1/+5/MAX/連携1回限り
// - 物理上限
// - 魂格再編の書 / 勇者の証交換
// - 総合力 = 使用済み魂格P * 10
// - マスモン詳細→専用全画面→3タブ→個別ボトムシート
// - 戦闘接続(STEP4)はまだ始めない
const fs = require('fs');
const path = require('path');
const { REPO_ROOT, loadDyeModule } = require('../harness');
const a = loadDyeModule();

const source = fs.readFileSync(path.join(REPO_ROOT,'monster-hero/src/game-system.jsx'),'utf8');
const app = fs.readFileSync(path.join(REPO_ROOT,'monster-hero/src/parts/60-app.jsx'),'utf8');
const breeder = fs.readFileSync(path.join(REPO_ROOT,'monster-hero/data/breeder.js'),'utf8');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

const makeMasu=(over={})=>a.normalizeMasuProgression({
  id:'soul-step3', baseId:'Snegurochka', name:'魂格STEP3',
  transcended:true, soulRankStage:1, levelCap:600,
  soulPointMaxReachedLevel:600, soulTraitLevels:{},
  bondXp:a.totalBondXpForLevel(600), rebirthCount:35, reincarnateCount:0,
  distAptPoints:0, distAptBoosts:[0,0,0,0], statPoints:{hp:0,atk:0,def:0,guts:0},
  ...over,
});

// ---- 1. 正式18特性 ----
check('魂格特性は18種類', a.SOUL_TRAIT_DEFINITIONS.length===18);
const expected=[
  ['allDamage','attack','闘魂',5],['uniqueDamage','attack','奥義',4],['normalDamage','attack','武技',4],
  ['rangeZeroDamage','attack','零距離の極意',2],['rangeNearDamage','attack','近距離の極意',2],
  ['rangeMidDamage','attack','中距離の極意',2],['rangeFarDamage','attack','遠距離の極意',2],
  ['comboFinalDamage','attack','連撃強化',4],['critRate','attack','会心眼',4],['critDamage','attack','会心極',3],
  ['partyDamageReduction','defense','鉄壁',20],['partyEvasion','defense','残像',30],
  ['partyReflect','defense','鏡返し',60],['partyAbsorb','defense','吸収',60],['enemyDisable','defense','威圧',25],
  ['gutsCostReduction','support','省気',10],['autoGutsRecovery','support','自動ガッツ回復強化',10],
  ['coordination','support','連携',200],
];
check('18特性のID/カテゴリ/名称/1段階コストが正式仕様と一致',
  expected.every(([id,cat,name,cost])=>{
    const x=a.SOUL_TRAIT_BY_ID[id];
    return x&&x.category===cat&&x.name===name&&x.costPerLevel===cost;
  }));
check('カテゴリは攻撃/防御/補助の3つ',
  JSON.stringify(a.SOUL_TRAIT_CATEGORIES.map(x=>x.id))===JSON.stringify(['attack','defense','support']));

// ---- 2. P導出 ----
const fresh=makeMasu({soulPointMaxReachedLevel:600});
check('Lv600初到達済みなら総獲得魂格P100',a.soulPointEarned(fresh)===100);
check('未使用魂格Pは総獲得-使用済みから導出',
  a.soulTraitSpentPoints({...fresh,soulTraitLevels:{allDamage:10,critDamage:5}})===65
  && a.soulTraitAvailablePoints({...fresh,soulTraitLevels:{allDamage:10,critDamage:5}})===35);
check('魂格Pそのものを別フィールドへ保存しない',
  !Object.prototype.hasOwnProperty.call(fresh,'soulPoints')&&!Object.prototype.hasOwnProperty.call(fresh,'soulPoint'));
check('未知の魂格特性IDは正規化で保存しない',(()=>{
  const n=a.normalizeMasuProgression({...fresh,soulTraitLevels:{allDamage:2,unknownFutureMistake:99}});
  return n.soulTraitLevels.allDamage===2&&!Object.prototype.hasOwnProperty.call(n.soulTraitLevels,'unknownFutureMistake');
})());

// ---- 3. 強化 ----
{
  const m=makeMasu({soulPointMaxReachedLevel:505});
  const r=a.buildSoulTraitUpgrade(m,'allDamage',1);
  check('闘魂1段階は5Pを消費して+1%',r&&r.cost===5&&r.nextLevel===1&&r.afterEffect===1&&r.afterAvailable===0);
  check('P不足なら2段階目は振れない',a.buildSoulTraitUpgrade(m,'allDamage',2)===null);
}
{
  const m=makeMasu({soulPointMaxReachedLevel:1000});
  check('500Pを越えて使えない',a.soulPointEarned(m)===500&&a.soulTraitAvailablePoints(m)===500);
  const c=a.buildSoulTraitUpgrade(m,'coordination',1);
  check('連携は200Pで1回だけ',c&&c.cost===200&&c.nextLevel===1&&a.maxSoulTraitUpgradeLevels(c.nextMasu,'coordination')===0);
  check('連携を2回習得できない',a.buildSoulTraitUpgrade(c.nextMasu,'coordination',1)===null);
}
check('会心眼は最低10%会心の技でも実効100%を超えない90ptで止まる',
  a.SOUL_TRAIT_BY_ID.critRate.maxLevel===90
  && a.normalizeSoulTraitLevels({critRate:999}).critRate===90
  && a.maxSoulTraitUpgradeLevels(makeMasu({soulPointMaxReachedLevel:1000,soulTraitLevels:{critRate:89}}),'critRate')===1);
check('残像/鏡返し/吸収の壊れた保存値は特殊防御物理上限75ptへ正規化',
  ['partyEvasion','partyReflect','partyAbsorb'].every(id=>
    a.normalizeSoulTraitLevels({[id]:999})[id]===75));
check('省気の壊れた保存値は100%へ正規化',
  a.normalizeSoulTraitLevels({gutsCostReduction:999}).gutsCostReduction===100);
check('魂格I未満は一覧定義を持っていても強化できない',
  a.maxSoulTraitUpgradeLevels(makeMasu({soulRankStage:0,levelCap:500}),'allDamage')===0
  && a.buildSoulTraitUpgrade(makeMasu({soulRankStage:0,levelCap:500}),'allDamage',1)===null);

// ---- 3B. STEP4で使う合成式の正本（まだ戦闘には接続しない） ----
check('同種25%×4は加算100%ではなく68.359375%',
  Math.abs(a.combineSoulProbabilityPoints([25,25,25,25])-68.359375)<1e-9);
{
  const party=[
    makeMasu({soulPointMaxReachedLevel:1000,soulTraitLevels:{partyEvasion:5,partyReflect:3,partyAbsorb:2,enemyDisable:5,autoGutsRecovery:2,coordination:1}}),
    makeMasu({soulPointMaxReachedLevel:1000,soulTraitLevels:{partyEvasion:5,partyReflect:3,partyAbsorb:2,enemyDisable:5,autoGutsRecovery:2,coordination:1}}),
  ];
  const p=a.soulTraitPartyPreview(party);
  check('特殊防御は3種のうち最大実効率を採用し75%上限',
    p.specialDefenseRate<=75&&p.specialDefenseRate===a.combineSoulProbabilityPoints([5,5]));
  check('特殊防御の発動内訳は回避:反射:吸収の実効率比',
    Math.abs((p.specialDefenseMix.evasion+p.specialDefenseMix.reflect+p.specialDefenseMix.absorb)-1)<1e-9
    &&p.specialDefenseMix.evasion>p.specialDefenseMix.reflect
    &&p.specialDefenseMix.reflect>p.specialDefenseMix.absorb);
  check('威圧は同種を残り確率乗算で合成',Math.abs(p.intimidate-a.combineSoulProbabilityPoints([5,5]))<1e-9);
  check('自動ガッツ回復強化は倍率を乗算',Math.abs(p.autoGutsMultiplier-1.0404)<1e-9);
  check('連携は複数所持でもカード+1だけ',p.coordinationCardBonus===1);
}

// ---- 4. 再編 ----
{
  const m=makeMasu({soulPointMaxReachedLevel:700,soulRankStage:2,levelCap:700,soulTraitLevels:{allDamage:10,partyDamageReduction:2}});
  const beforeLevel=a.masuBondLevelInfo(m).level;
  const reset=a.buildMasuSoulTraitReset(m);
  check('再編は使用済み魂格Pを全返却できる',reset&&reset.refundedPoints===90&&JSON.stringify(reset.nextMasu.soulTraitLevels)==='{}');
  check('再編で魂格段階/Lv/最高初到達Lvを変えない',
    reset.nextMasu.soulRankStage===2&&reset.nextMasu.levelCap===700
    &&a.masuBondLevelInfo(reset.nextMasu).level===beforeLevel
    &&reset.nextMasu.soulPointMaxReachedLevel===700);
}
check('未振りなら再編しない',a.buildMasuSoulTraitReset(fresh)===null);

// ---- 5. 魂格再編の書 ----
check('魂格再編の書は100万ダイヤの商品',
  breeder.includes("id:'soul_rank_respec_scroll'")&&/soul_rank_respec_scroll[^\n]*cost:1000000/.test(breeder)
  &&/soul_rank_respec_scroll[^\n]*usage:'soulRankRespec'/.test(breeder));
{
  const before={hero_proof:2,soul_rank_respec_scroll:3,keep:7};
  const x=a.buildSoulRankRespecProofExchange(before,1);
  check('勇者の証1個→再編の書1冊',x.ok&&x.ownedItems.hero_proof===1&&x.ownedItems.soul_rank_respec_scroll===4&&x.ownedItems.keep===7);
  check('交換は入力オブジェクトを破壊しない',before.hero_proof===2&&before.soul_rank_respec_scroll===3);
}
check('勇者の証不足なら交換しない',!a.buildSoulRankRespecProofExchange({hero_proof:0},1).ok);

// ---- 6. 総合力 ----
{
  const base=makeMasu({soulPointMaxReachedLevel:1000});
  const spent=makeMasu({soulPointMaxReachedLevel:1000,soulTraitLevels:{allDamage:10,critDamage:10}});
  check('魂格特性由来の総合力は使用済みP×10',
    a.masuPowerOf(spent)-a.masuPowerOf(base)===800,
    String(a.masuPowerOf(spent)-a.masuPowerOf(base)));
  const unspent=makeMasu({soulPointMaxReachedLevel:1000,soulTraitLevels:{}});
  check('未使用魂格Pは総合力に含めない',a.masuPowerOf(unspent)===a.masuPowerOf(base));
}

// ---- 7. UI/保存 ----
check('マスモン詳細に魂格I未満でも表示される入口がある',
  app.includes('data-soul-trait-entry')&&app.includes("setGameState('MASU_SOUL_TRAITS')"));
check('魂格特性は独立した全画面',
  app.includes("gameState==='MASU_SOUL_TRAITS'")&&app.includes('data-soul-trait-screen'));
check('魂格特性画面では背後のマスモン詳細を重ねず、プロフィールBGMを継続する',
  app.includes("const MASU_ENHANCE_STATES = ['MASU_ENHANCE','MASU_TRANSCEND_ENHANCE','MASU_SOUL_TRAITS']")
  &&app.includes("const PROFILE_BGM_STATES = ['ROSTER','OWNED_MONSTERS','MASU_MONS','MASU_ENHANCE','MASU_TRANSCEND_ENHANCE','MASU_SOUL_TRAITS']"));
check('未解放でも一覧閲覧可・強化だけロック',
  app.includes('data-soul-trait-locked')&&app.includes('Lv500到達＋魂格進化Ⅰで解放')
  &&app.includes('特性一覧と必要魂格Pは先に確認できます'));
check('上部に魂格/Lv/未使用P/使用済みPを表示',
  ['魂格','現在Lv','未使用','使用済み'].every(x=>app.includes(x)));
check('攻撃/防御/補助の3タブ',
  app.includes('aria-label="魂格特性カテゴリ"')&&app.includes('SOUL_TRAIT_CATEGORIES.map'));
check('一覧カード→個別ボトムシート',
  app.includes('data-soul-trait-card')&&app.includes('data-soul-trait-sheet'));
check('現在編成なら合成後効果を表示し、強化前後のBefore→Afterも出す',
  app.includes('data-soul-trait-party-preview')
  &&app.includes('data-soul-trait-before-after')
  &&app.includes('soulTraitPartyPreview(rosterSoulMasus)')
  &&app.includes('実戦では実際に参加した個体だけで再計算します'));
check('個別強化は-1/+1/+5/MAX/決定',
  app.includes('data-soul-trait-minus-one')&&app.includes('data-soul-trait-plus-one')
  &&app.includes('data-soul-trait-plus-five')&&app.includes('data-soul-trait-max')
  &&app.includes('data-soul-trait-confirm'));
check('連携は習得する200Pの単純UI',
  app.includes('data-soul-trait-learn-coordination')&&app.includes('習得する 200P'));
check('魂格再編は専用確認シートから1冊消費',
  app.includes('data-soul-trait-respec-open')&&app.includes('data-soul-trait-respec-sheet')
  &&app.includes('1冊使って再編'));
check('魂格特性強化はmh_masu_monsだけを検証保存',
  (()=>{const i=app.indexOf('const commitSoulTraitUpgrade');const j=app.indexOf('const commitSoulTraitRespec',i);const b=app.slice(i,j);return b.includes("key:'mh_masu_mons'")&&!b.includes("key:'mh_owned_items'");})());
check('魂格再編はmh_masu_mons/mh_owned_itemsを取引保存',
  (()=>{const i=app.indexOf('const commitSoulTraitRespec');const j=app.indexOf('// 固有技設定',i);const b=app.slice(i,j);return b.includes("key:'mh_masu_mons'")&&b.includes("key:'mh_owned_items'");})());
check('マーケットに勇者の証1→再編の書交換導線',
  app.includes('exchangeSoulRankRespecByProof')&&app.includes('勇者の証1個を魂格再編の書1冊へ交換'));
check('魂格特性画面はSafe Areaと44px以上の主要操作を守る',
  app.includes("paddingTop:'calc(1rem + env(safe-area-inset-top))'")
  &&app.includes("paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'")
  &&app.includes('min-h-[48px]'));

// ---- 8. STEP境界 ----
check('STEP4の戦闘接続はまだ実装しない',
  !source.includes('applySoulRankBattle')&&!source.includes('resolveSoulSpecialDefense')
  &&!source.includes('soulTraitBattleSummary'));
check('STEP5の魂格継承/ランキングスナップショットはまだ実装しない',
  !source.includes('soulRankInheritance')&&!source.includes('soulSpentPoints'));
check('STEP6のバッジ/オーラ画像接続はまだ実装しない',
  !source.includes('SOUL_RANK_AURA_IMAGES')&&!source.includes('SoulRankBadge'));

console.log(failed?`\n${failed}件のNGがあります`:'\n魂格STEP3: すべてOK');
process.exit(failed?1:0);
