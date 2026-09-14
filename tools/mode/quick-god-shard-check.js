// クイックの INFINITY・GOD 追加と、クイックGODの勇者の証片(2026-09-13・ユーザーが決めた)の回帰検査。
//
//   node tools/mode/quick-god-shard-check.js
//
// 正式仕様:
// - クイックの難易度は Legend のあと EXTREME → NIGHTMARE → CHAOS → ULTIMATE → INFINITY → GOD
// - 報酬倍率(案A) INFINITY: 経験値40 / ダイヤ18 / 虹80、GOD: 経験値45 / ダイヤ24 / 虹100
// - クイックGODのクリアで勇者の証片を1個。∞周回とモンヒロビート換算の周回にも、
//   虹のプシュケーと同じく周回数ぶん入る
// - 配るのは「勇者の証」ではなく「勇者の証片」。証(heroProofClearReward)はクイックでは0のまま
// - 保存キーは増やさない(所持数は既存の mh_owned_items の中)
const fs = require('fs');
const path = require('path');
const { REPO_ROOT, readAppSource, loadDyeModule } = require('../harness');

const app = readAppSource();
const resultUi = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/27-result-widgets.jsx'), 'utf8');
const rhythmPlay = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/30-rhythm-play.jsx'), 'utf8');
const api = loadDyeModule();

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- 1. 難易度の並びと報酬 ----
const order = Object.keys(api.QUICK_DIFFICULTY_SETTINGS);
check('クイックの並びは Legend → EXTREME …… → INFINITY → GOD',
  order.slice(-7).join(',') === 'Legend,EXTREME,NIGHTMARE,CHAOS,ULTIMATE,INFINITY,GOD',
  order.slice(-7).join(','));
const infinity = api.QUICK_DIFFICULTY_SETTINGS.INFINITY;
const god = api.QUICK_DIFFICULTY_SETTINGS.GOD;
check('INFINITYのクイック倍率は 経験値40 / ダイヤ18 / 虹80',
  infinity.xp === 40 && infinity.gold === 18 && infinity.psyche === 80);
check('GODのクイック倍率は 経験値45 / ダイヤ24 / 虹100',
  god.xp === 45 && god.gold === 24 && god.psyche === 100);
check('敵強度は極限本体をそのまま使う(INFINITY×50 / GOD×100)',
  infinity.power === 50 && god.power === 100);
check('クリア報酬の虹は難易度表と同じ個数(INFINITY80 / GOD100)',
  api.clearPsycheReward('INFINITY') === 80 && api.clearPsycheReward('GOD') === 100);
// 極限本体の報酬・特殊ルールは、クイックを足しても変わらない
const extremeGod = api.ALL_EXTREME_DIFFICULTIES.find(s => s.id === 'GOD');
check('極限チャレンジ本体のGODは従来どおり(経験値60 / ダイヤ40 / 虹100)',
  extremeGod.xp === 60 && extremeGod.gold === 40 && extremeGod.psyche === 100);

// ---- 2. 特殊ルールの引き継ぎ ----
check('クイックINFINITY・GODでも極限本体と同じ特殊ルールが効く',
  api.specialRuleDifficultyForRun('quick', 'INFINITY') === 'INFINITY'
  && api.specialRuleDifficultyForRun('quick', 'GOD') === 'GOD');
check('GODの神威は2WAVEごとに1段上がる(クイックの10WAVEでLv5まで)',
  api.extremeWaveStageRules('GOD', 1).level === 1
  && api.extremeWaveStageRules('GOD', 9).level === 5);

// ---- 3. 勇者の証片 ----
const shard = api.heroProofShardClearReward;
check('クイックGODのクリアで証片1個', shard({ runMode:'quick', difficulty:'GOD' }) === 1);
check('クイックのGOD以外は0',
  shard({ runMode:'quick', difficulty:'INFINITY' }) === 0
  && shard({ runMode:'quick', difficulty:'ULTIMATE' }) === 0);
check('クイック以外のモードでは配らない',
  shard({ runMode:'challenge', difficulty:'GOD' }) === 0
  && shard({ runMode:'pro', difficulty:'GOD' }) === 0);
check('デバッグ戦では配らない', shard({ runMode:'quick', difficulty:'GOD', debug:true }) === 0);
check('配るのは証片であって「勇者の証」ではない(証はクイックで0のまま)',
  api.heroProofClearReward({ runMode:'quick', difficulty:'GOD' }) === 0);
check('証片20個で勇者の証1個と交換できる関係は変えない', api.HERO_PROOF_SHARD_PER_PROOF === 20);

// ---- 4. 実装の経路 ----
check('実バトルのクリアで証片を配る',
  app.includes('await awardHeroProofShardForClear();')
  && app.includes('[HERO_PROOF_SHARD_ITEM_ID]:ownedItemCount(ownedItemsRef.current, HERO_PROOF_SHARD_ITEM_ID) + gain'));
check('モンヒロビート換算の周回にも、同じ関数で周回数ぶん配る',
  app.includes('const oneShard = heroProofShardClearReward({ runMode, difficulty });')
  && app.includes('const shardGain = Math.max(0, Math.floor(oneShard * count));'));
check('個数の正本は1か所だけ(画面や換算処理へ数字を書き写していない)',
  !/HERO_PROOF_SHARD_CLEAR_REWARDS\s*\[/.test(app)
  && !app.includes('shardGain = count'));
check('保存キーを増やさず、既存の mh_owned_items へ足す',
  !app.includes("mh_hero_proof_shard") && !app.includes("mh_quick_shard"));
check('難易度カードと2つのリザルトに証片が出る',
  app.includes('data-hero-proof-shard-reward={key}')
  && resultUi.includes('summary.heroProofShardGain > 0')
  && rhythmPlay.includes('quickRunAward.shard>0'));

console.log(failed ? `\nNG ${failed}件` : '\nクイックGOD・証片: すべてOK');
process.exit(failed ? 1 : 0);
