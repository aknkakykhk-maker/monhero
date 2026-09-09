// 魂格 STEP5C「ランキング表示」の回帰検査。
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/60-app.jsx'),'utf8');
let failed=0;const ck=(n,o)=>{console.log(`${o?'OK':'NG'}: ${n}`);if(!o)failed++;};
ck('ランキング一覧に記録時魂格バッジを表示',
  app.includes('data-ranking-soul-badge')
  &&app.includes('soulRankStage={entry.detail?.soulRankStage}'));
ck('ランキング詳細は保存済み魂格段階を表示',
  app.includes('data-ranking-soul-build')
  &&app.includes('rankingSoulStage')
  &&app.includes('SOUL_RANK_BADGE_LABELS[rankingSoulStage]'));
ck('ランキング詳細は振り分け済み全特性を列挙',
  app.includes('rankingSoulTraitEntries')
  &&app.includes('SOUL_TRAIT_DEFINITIONS.filter')
  &&app.includes('formatSoulTraitEffect'));
ck('ランキング詳細は記録時使用済み魂格Pを表示',
  app.includes('soulSpentPointsSnapshot')
  &&app.includes('使用済み魂格P'));
ck('ランキング詳細は読み取り専用で魂格強化導線を出さない',
  !/data-ranking-soul-build[\s\S]{0,2500}setGameState\('MASU_SOUL_TRAITS'\)/.test(app));
console.log(failed?`\n${failed}件のNG`:'\n魂格STEP5C: すべてOK');process.exit(failed?1:0);
