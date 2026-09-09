// 魂格システム STEP2「魂格進化・勇者の証」の回帰検査。
//
//   node tools/masu/soul-rank-step2-check.js
//
// 正式仕様:
// - 魂格進化I〜Vの条件・コスト・Lv上限
// - 進化しても実Lv/XPは上げない
// - 勇者の証は高難度の実クリアで反復入手、Quick等は0
// - 3保存値の取引保存、神殿導線、所持表示、リザルト、iPhone操作
const fs = require('fs');
const path = require('path');
const { REPO_ROOT, loadDyeModule } = require('../harness');

const app = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
const resultUi = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/27-result-widgets.jsx'), 'utf8');
const progression = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/11-masu-progression.jsx'), 'utf8');
const api = loadDyeModule();

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const makeMasu = (stage, level, over = {}) => api.normalizeMasuProgression({
  id:'soul-step2', baseId:'Snegurochka', name:'魂格STEP2',
  transcended:true, soulRankStage:stage, levelCap:api.soulRankLevelCap(stage),
  bondXp:api.totalBondXpForLevel(level), soulPointMaxReachedLevel:Math.max(500, level),
  soulTraitLevels:{}, rebirthCount:35, reincarnateCount:0,
  distAptPoints:0, distAptBoosts:[0,0,0,0], statPoints:{hp:0,atk:0,def:0,guts:0},
  ...over,
});

(async () => {
  // ---- 1. 進化表 ----
  const expected = [
    [1,'魂格Ⅰ',500,600,5000000,20],
    [2,'魂格Ⅱ',600,700,10000000,30],
    [3,'魂格Ⅲ',700,800,15000000,40],
    [4,'魂格Ⅳ',800,900,20000000,50],
    [5,'魂格Ⅴ',900,1000,25000000,60],
  ];
  check('魂格進化I〜Vの5段階だけを持つ', api.SOUL_RANK_EVOLUTION_STAGES.length === 5);
  for (const [stage,label,requiredLevel,cap,diamondCost,heroProofCost] of expected) {
    const step = api.soulRankEvolutionForStage(stage);
    check(`${label}: Lv${requiredLevel}→上限${cap} / ${diamondCost.toLocaleString()}ダイヤ / 証${heroProofCost}`,
      !!step && step.label===label && step.requiredLevel===requiredLevel && step.levelCap===cap
      && step.diamondCost===diamondCost && step.heroProofCost===heroProofCost);
  }
  check('I〜V合計は75,000,000ダイヤ・勇者の証200',
    api.SOUL_RANK_EVOLUTION_STAGES.reduce((n,x)=>n+x.diamondCost,0)===75000000
    && api.SOUL_RANK_EVOLUTION_STAGES.reduce((n,x)=>n+x.heroProofCost,0)===200);

  // ---- 2. 次の1段階だけ進化 ----
  {
    const m = makeMasu(0,500);
    const beforeXp = m.bondXp;
    const r = api.buildMasuSoulRankEvolution({masu:m,gold:5000000,ownedItems:{hero_proof:20,training_ticket:2}});
    check('魂格なし→魂格Iだけを1段階進める', r.ok && r.fromStage===0 && r.toStage===1 && r.nextMasu.soulRankStage===1 && r.nextMasu.levelCap===600);
    check('進化しても実Lv・絆XP・最高初到達Lv・振り分けを変えない',
      api.masuBondLevelInfo(r.nextMasu).level===500 && r.nextMasu.bondXp===beforeXp
      && r.nextMasu.soulPointMaxReachedLevel===m.soulPointMaxReachedLevel
      && same(r.nextMasu.soulTraitLevels,m.soulTraitLevels));
    check('必要分だけダイヤと勇者の証を消費し、他アイテムは保持',
      r.nextGold===0 && r.nextOwnedItems.hero_proof===0 && r.nextOwnedItems.training_ticket===2);
  }
  check('超越前は魂格進化できない',
    !api.buildMasuSoulRankEvolution({masu:makeMasu(0,500,{transcended:false,levelCap:400}),gold:99999999,ownedItems:{hero_proof:999}}).ok);
  check('必要Lv未到達では進化できない',
    !api.buildMasuSoulRankEvolution({masu:makeMasu(1,599),gold:99999999,ownedItems:{hero_proof:999}}).ok);
  check('ダイヤ不足では進化できない',
    !api.buildMasuSoulRankEvolution({masu:makeMasu(1,600),gold:9999999,ownedItems:{hero_proof:30}}).ok);
  check('勇者の証不足では進化できない',
    !api.buildMasuSoulRankEvolution({masu:makeMasu(1,600),gold:10000000,ownedItems:{hero_proof:29}}).ok);
  check('魂格VからVIは作らない',
    !api.buildMasuSoulRankEvolution({masu:makeMasu(5,1000),gold:999999999,ownedItems:{hero_proof:999}}).ok
    && api.soulRankEvolutionForStage(6)===null);

  // I〜Vを順に進める。各段階で必要Lvまで育ったものとしてXPだけ到達値へ置く。
  {
    let m = makeMasu(0,500);
    let gold = 75000000;
    let items = {hero_proof:200};
    for (const step of api.SOUL_RANK_EVOLUTION_STAGES) {
      m = api.normalizeMasuProgression({...m,bondXp:api.totalBondXpForLevel(step.requiredLevel)});
      const beforeLevel = api.masuBondLevelInfo(m).level;
      const r = api.buildMasuSoulRankEvolution({masu:m,gold,ownedItems:items});
      check(`${step.label}を順番どおり進化できる`, r.ok && r.toStage===step.stage && r.toLevelCap===step.levelCap && api.masuBondLevelInfo(r.nextMasu).level===beforeLevel);
      m=r.nextMasu; gold=r.nextGold; items=r.nextOwnedItems;
    }
    check('5段階完了で魂格V・Lv上限1000、総コストをちょうど消費', m.soulRankStage===5 && m.levelCap===1000 && gold===0 && items.hero_proof===0);
  }

  // ---- 3. 勇者の証 ----
  const reward = api.heroProofClearReward;
  check('極限GOD=1 / RAGNAROK=2',
    reward({runMode:'challenge',difficulty:'Normal',extremeDifficulty:'GOD'})===1
    && reward({runMode:'challenge',difficulty:'Normal',extremeDifficulty:'RAGNAROK'})===2);
  check('Pro Master/Grand Master/Hell/Legend = 1/2/3/4',
    reward({runMode:'pro',difficulty:'Master'})===1
    && reward({runMode:'pro',difficulty:'GrandMaster'})===2
    && reward({runMode:'pro',difficulty:'Hell'})===3
    && reward({runMode:'pro',difficulty:'Legend'})===4);
  check('種族GOD/RAGNAROKの将来接続表は1/2',
    reward({runMode:'speciesChallenge',speciesDifficulty:'GOD',speciesSave:true})===1
    && reward({runMode:'speciesChallenge',speciesDifficulty:'RAGNAROK',speciesSave:true})===2);
  check('種族の保存なし確認は0',
    reward({runMode:'speciesChallenge',speciesDifficulty:'RAGNAROK',speciesSave:false})===0);
  check('Quickは難易度名や極限名に関係なく常に0',
    reward({runMode:'quick',difficulty:'Legend',extremeDifficulty:'RAGNAROK'})===0);
  check('通常チャレンジと低難易度Proは0',
    reward({runMode:'challenge',difficulty:'Legend'})===0
    && reward({runMode:'pro',difficulty:'Expert'})===0);
  check('デバッグは対象難易度でも0',
    reward({runMode:'pro',difficulty:'Legend',debug:true})===0
    && reward({runMode:'challenge',extremeDifficulty:'RAGNAROK',debug:true})===0);
  check('挑戦前カードの勇者の証表示も実報酬関数を参照',
    app.includes("const heroProofReward=heroProofClearReward({runMode:battleMode,difficulty:key})")
    && app.includes("const heroProofReward=heroProofClearReward({extremeDifficulty:setting.id})")
    && (app.match(/data-hero-proof-reward=/g)||[]).length>=2);
  check('プロ・極限の表示値を別の数値表へ複製しない',
    !app.includes('const HERO_PROOF_DISPLAY_REWARDS')
    && !app.includes('heroProofDisplayRewards'));

  // ---- 4. 取引保存の実動作 ----
  {
    const before = {
      mh_masu_mons:[makeMasu(0,500)],
      mh_gold:5000000,
      mh_owned_items:{hero_proof:20,training_ticket:3},
    };
    const plan = api.buildMasuSoulRankEvolution({masu:before.mh_masu_mons[0],gold:before.mh_gold,ownedItems:before.mh_owned_items});
    const entries = [
      {key:'mh_masu_mons',before:before.mh_masu_mons,next:[plan.nextMasu]},
      {key:'mh_gold',before:before.mh_gold,next:plan.nextGold},
      {key:'mh_owned_items',before:before.mh_owned_items,next:plan.nextOwnedItems},
    ];
    const storage = JSON.parse(JSON.stringify(before));
    const setValue = async (key,value)=>{storage[key]=JSON.parse(JSON.stringify(value));};
    const getValue = async (key)=>{
      if(key==='mh_gold') return -1; // 読み戻し不一致を故意に起こす
      return storage[key];
    };
    const ok = await api.saveStoredValuesOrRollback(entries,getValue,setValue);
    check('保存読戻しが1キーでも不一致なら魂格・ダイヤ・証を全部beforeへ戻す',
      ok===false && same(storage.mh_masu_mons,before.mh_masu_mons)
      && storage.mh_gold===before.mh_gold && same(storage.mh_owned_items,before.mh_owned_items));
  }

  // ---- 5. 本体結線 / UI ----
  check('神殿に魂格進化入口があり、神殿BGMを継続',
    app.includes('data-soul-rank-link') && app.includes("setGameState('MASU_SOUL_RANK')")
    && app.includes("MASU_SOUL_RANK: 'temple'"));
  check('魂格画面は既存temple助手シーンを再利用し、新しい未定義sceneを作らない',
    app.includes("gameState==='MASU_SOUL_RANK'") && app.includes('<AssistantBubble scene="temple" compact/>')
    && !app.includes('scene="soulRank"'));
  check('条件不足でもLv・ダイヤ・勇者の証を表示',
    app.includes('必要Lv') && app.includes('必要ダイヤ') && app.includes('必要な勇者の証')
    && app.includes('goldShort') && app.includes('proofShort'));
  check('進化確定は3キーをsaveStoredValuesOrRollbackで同時保存',
    (()=>{const a=app.indexOf('const executeMasuSoulRankEvolution');const b=app.indexOf('const commitTranscendPlan',a);const body=app.slice(a,b);return body.includes('saveStoredValuesOrRollback([')
      && ["mh_masu_mons","mh_gold","mh_owned_items"].every(k=>body.includes("{ key:'"+k+"'"))
      && body.includes("if (!saved) throw new Error('soul rank save failed')");})());
  check('勇者の証はrecordClearOnceの実クリア経路だけで付与',
    app.includes('const awardHeroProofForClear = async () =>')
    && /await awardClearPsyche\(\);\s*await awardHeroProofForClear\(\);/.test(app)
    && !progression.includes('BREEDER_MARKET_ITEMS.push({\n  id:HERO_PROOF_ITEM_ID'));
  check('勇者の証は既存mh_owned_itemsに入り、アイテム欄で所持表示',
    app.includes('[HERO_PROOF_ITEM_ID]:ownedItemCount(ownedItemsRef.current, HERO_PROOF_ITEM_ID) + gain')
    && app.includes('...((ownedItems[HERO_PROOF_ITEM_ID]||0)>0?[HERO_PROOF_ITEM]:[])')
    && app.includes("item.usage==='soulRank'"));
  check('リザルトに勇者の証・魂格P・超越P・進化可能案内を表示',
    resultUi.includes('勇者の証') && resultUi.includes('魂格P +{gain.gainedSoulPoints}')
    && resultUi.includes('超越P +{gain.gainedTranscendPoints}') && resultUi.includes('魂格進化できます'));
  check('進化確定ボタンは52px以上・Safe Area対応',
    app.includes('data-soul-rank-execute') && app.includes('min-h-[52px]')
    && app.includes("gameState==='MASU_SOUL_RANK'")
    && app.includes("paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'"));
  check('成功演出は短時間だけ・reduced motionで短縮',
    app.includes('data-soul-rank-animation') && app.includes('prefersReducedMotion()?800:2400'));
  // STEP2検査は進化・勇者の証の回帰条件だけを固定する。
  // STEP3以降が追加されても、STEP2で成立した仕様そのものは引き続き検査する。

  console.log(failed ? `\n${failed}件のNGがあります` : '\n魂格STEP2: すべてOK');
  process.exit(failed ? 1 : 0);
})().catch(error=>{console.error(error);process.exit(1);});
