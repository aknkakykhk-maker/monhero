// 種族チャレンジを「一般公開直前の完成状態」として見張る。
//
//   ① 本番のクリア報酬(経験値・ダイヤ・虹のプシュケー・ブリーダー経験値・絆経験値)を
//      既存の共通処理へ通していて、種族チャレンジ側へ数値を複製していない
//   ② 全国ランキングは「種族×難易度」ごとに独立し、既存rankingsテーブルの
//      difficulty列だけで表せる(スキーマ変更なし)。既存キーと絶対に衝突しない
//   ③ 一般公開フラグはfalseのままで、全国ランキングへ送らない
//   ④ 旧(モンスター1体単位)の超越の実を持っていても、同じ血統のマスモンへ使える
//
// ★報酬の個数そのものは species-challenge-clear-reward-check.js が正本なので重複して持たない。
const fs = require('fs');
const { loadDyeModule } = require('../harness');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const api = loadDyeModule();
const check = (message, ok, detail = '') => {
  if (!ok) throw new Error(`NG: ${message}${detail ? ` — ${detail}` : ''}`);
  console.log(`OK: ${message}${detail ? ` — ${detail}` : ''}`);
};

// ===== ① 本番のクリア報酬 =====
// 確定処理そのものだけを切り出す(この後ろに続くクリア結果カードは表示用なので含めない)
const clearFn = source.slice(source.indexOf('const finishSpeciesChallengeClear ='), source.indexOf('const speciesChallengeClearCardNode ='));
check('WAVE10クリアの確定処理がある', clearFn.length > 0);
check('既存の共通報酬処理をそのまま呼ぶ', clearFn.includes('await awardRunRewards(10);') && clearFn.includes('await recordClearOnce();'));
const previewReturn = clearFn.indexOf('if(!speciesChallengeSaveRunRef.current){');
check('保存しない確認では本番報酬を配らない',
  previewReturn >= 0 && previewReturn < clearFn.indexOf('await awardRunRewards(10);'));
check('虹のプシュケーを確定させてから超越の実を書き込む',
  clearFn.indexOf('await recordClearOnce();') < clearFn.indexOf('persistSpeciesChallengeClearReward({'));
check('クリアしたWAVEと累計ターンを既存の記録用refへ入れる',
  clearFn.includes('runEndWaveRef.current=10;') && clearFn.includes('runClearTurnsRef.current=clearTurns;'));
// 難易度ごとの倍率・個数は既存定義が正本。種族チャレンジ側へ数値を書き写していないこと
check('報酬の倍率・個数を種族チャレンジ側へ複製しない',
  !/DIFFICULTY_SETTINGS\s*\[/.test(clearFn) && !clearFn.includes('CLEAR_PSYCHE_REWARD') && !clearFn.includes('EXTREME_DIFFICULTIES'));

// クリア回数は種族×難易度の進行へ積む。他モードの通算クリア数は動かさない
const recordFn = source.slice(source.indexOf('const recordClearOnce = async () => {'), source.indexOf('// はじめての敗北かどうか'));
const speciesBranch = recordFn.indexOf('if (speciesChallengeBattleRunRef.current) {');
check('クリア記録に種族チャレンジの分岐がある', speciesBranch >= 0);
check('虹のプシュケーは他モードと同じ共通処理で配る', recordFn.indexOf('await awardClearPsyche();') < speciesBranch);
check('極限・クイック・プロ・チャレンジのクリア数より先に分岐する',
  speciesBranch < recordFn.indexOf('if (extremeRunRef.current) {')
  && speciesBranch < recordFn.indexOf('storeSet(`mh_clears_'));
const speciesBranchBody = recordFn.slice(speciesBranch, recordFn.indexOf('if (extremeRunRef.current) {'));
check('チャレンジ・極限の通算クリア数を書き換えない',
  !speciesBranchBody.includes('mh_clears_') && !speciesBranchBody.includes('extremeClearCountKey') && !speciesBranchBody.includes('storeSet('));

// ===== ② 全国ランキングの識別(種族×難易度) =====
const lineages = api.dexMainLineages();
const difficulties = api.SPECIES_CHALLENGE_DIFFICULTY_IDS;
check('主血統と14難易度が読める', lineages.length > 0 && difficulties.length === 14, `${lineages.length}種族 × ${difficulties.length}難易度`);
const speciesKeys = [];
for (const lineage of lineages) for (const difficultyId of difficulties) {
  const key = api.speciesChallengeRankingDifficulty(lineage.id, difficultyId);
  check(`${lineage.id}/${difficultyId} のランキングキーを作れる`, typeof key === 'string' && key.length > 0);
  speciesKeys.push(key);
}
check('種族×難易度がすべて別のランキングになる', new Set(speciesKeys).size === speciesKeys.length, `${speciesKeys.length}件`);
// 既存のチャレンジ・プロ・極限のキーと絶対に混ざらない(大文字小文字を無視しても衝突しない)
const existingKeys = new Set(api.RANKING_DIFFICULTY_KEYS.map(key => key.toLowerCase()));
check('既存のチャレンジ・プロ・極限のキーと衝突しない', speciesKeys.every(key => !existingKeys.has(key.toLowerCase())));
check('既存キーを種族チャレンジのキーと誤読しない', api.RANKING_DIFFICULTY_KEYS.every(key => api.parseSpeciesChallengeRankingDifficulty(key) === null));
// 往復できる(送信したキーから種族と難易度へ戻せる)
for (const lineage of [lineages[0], lineages[lineages.length - 1]]) for (const difficultyId of ['Beginner', 'Normal', 'INFINITY']) {
  const key = api.speciesChallengeRankingDifficulty(lineage.id, difficultyId);
  const parsed = api.parseSpeciesChallengeRankingDifficulty(key);
  check(`${key} を種族と難易度へ戻せる`, parsed && parsed.speciesId === lineage.id && parsed.difficultyId === difficultyId);
  check(`${key} は表示用の難易度へも戻せる`, api.rankingDifficultyBase(key) === difficultyId);
  check(`${key} は大文字小文字が違っても同じキーへ正規化される`, api.rankingDifficultyKey(key.toLowerCase()) === key);
}
check('既存モードのランキングキーは今までどおり',
  api.rankingDifficultyForMode('challenge', 'Normal') === 'Normal'
  && api.rankingDifficultyForMode('pro', 'Normal') === 'ProNormal'
  && api.rankingDifficultyForMode('extreme', 'EXTREME') === 'ExtremeEXTREME');
check('種族チャレンジは種族を渡してキーを作る',
  api.rankingDifficultyForMode(api.BATTLE_MODE_SPECIES_CHALLENGE, 'Normal', lineages[0].id) === speciesKeys[difficulties.indexOf('Normal')]);
for (const bad of [[null, 'Normal'], ['unknown', 'Normal'], [lineages[0].id, 'Unknown'], [lineages[0].id, null]]) {
  check(`不正な組み合わせを拒否する: ${String(bad[0])}/${String(bad[1])}`, api.speciesChallengeRankingDifficulty(bad[0], bad[1]) === null);
}
// Supabaseは既存のrankingsテーブルのまま。新しいテーブル・列を足していない
check('Supabaseのテーブル・列を増やしていない',
  !/create\s+table/i.test(source) && !/alter\s+table/i.test(source)
  && fs.readdirSync('supabase/migrations').length === 2);

// ===== ③ 公開フラグと送信 =====
check('一般公開フラグはfalseのまま', api.SPECIES_CHALLENGE_PUBLIC_RELEASE === false);
check('本番のBATTLE MODEへ出さない', source.includes('const SPECIES_CHALLENGE_PUBLIC_RELEASE = false;'));
const submitFn = source.slice(source.indexOf('const submitSpeciesChallengeScoreOnce ='), source.indexOf('const handleSaveName ='));
check('種族チャレンジ専用のスコア送信がある', submitFn.length > 0);
check('1ランにつき1回だけ送る', submitFn.includes('if (!run || score <= 0 || scoreSubmittedRef.current) return;') && submitFn.includes('scoreSubmittedRef.current = true;'));
check('公開までは全国ランキングへ送らない', submitFn.includes('if (!SPECIES_CHALLENGE_PUBLIC_RELEASE) return;'));
check('デバッグ実戦からも送らない', submitFn.includes('if (debugBattleRef.current) return;'));
check('送信は既存のsubmitLocalScoreを使う', submitFn.includes('await submitLocalScore(diff, score, runIdRef.current)'));
check('チャレンジの自己ベスト(mh_hs_*)を書き換えない', !submitFn.includes('mh_hs_') && !submitFn.includes('setHighScores'));

// ===== ④ 旧(モンスター1体単位)の超越の実 =====
const legacyIds = api.legacySpeciesTranscendFruitIdsForLineage('Mocchi');
check('旧実は同じ血統のぶんをまとめて引ける', legacyIds.length >= 2 && legacyIds.includes('transcend_fruit_species_Mocchi') && legacyIds.includes('transcend_fruit_species_Mitarashi'), legacyIds.join(','));
check('別の血統の旧実は混ざらない', !api.legacySpeciesTranscendFruitIdsForLineage('Suezo').includes('transcend_fruit_species_Mocchi'));
const masu = { id:1, baseId:'Mocchi', transcendPoints:2 };
const owned = { transcend_fruit_species_Mocchi:3, transcend_fruit_species_Mitarashi:1, other_item:5 };
const usedOwn = api.useTranscendFruitOnMasu(masu, owned, 'transcend_fruit_species_Mocchi', 2);
check('旧実をそのモンスターのマスモンへ使える', usedOwn.ok && usedOwn.nextMasu.transcendPoints === 4 && usedOwn.nextOwnedItems.transcend_fruit_species_Mocchi === 1);
const usedSibling = api.useTranscendFruitOnMasu(masu, owned, 'transcend_fruit_species_Mitarashi', 1);
check('同じ血統の別モンスターの旧実も使える(ミタラシの旧実→モッチー)', usedSibling.ok && usedSibling.nextMasu.transcendPoints === 3);
check('旧実を使っても他の所持品は残る', usedOwn.nextOwnedItems.other_item === 5 && usedOwn.nextOwnedItems.transcend_fruit_species_Mitarashi === 1);
check('入力の所持品を書き換えない', owned.transcend_fruit_species_Mocchi === 3);
const otherLineage = api.useTranscendFruitOnMasu({ id:2, baseId:'Suezo', transcendPoints:0 }, owned, 'transcend_fruit_species_Mocchi', 1);
check('別の血統のマスモンへは使えない', !otherLineage.ok && otherLineage.nextOwnedItems === owned);
const nowFruitId = api.masuSpeciesTranscendFruitItemId('Mocchi');
check('いまの血統単位の実はこれまでどおり使える',
  api.useTranscendFruitOnMasu(masu, { [nowFruitId]:1 }, nowFruitId, 1).ok);
check('旧実を新しいidへ変換しない(所持数はそのまま減るだけ)',
  usedOwn.nextOwnedItems[nowFruitId] === undefined);
check('旧実の所持数も読める', api.transcendFruitOwnedCount(owned, 'transcend_fruit_species_Mocchi') === 3);
// 超越強化の画面からも選べること(所持しているのに使えない状態を作らない)
const enhanceScreen = source.slice(source.indexOf('const legacyFruitChoices = legacySpeciesTranscendFruitsForLineage(masu.baseId)'), source.indexOf('const openFruit = () =>'));
check('超越強化UIが所持している旧実を選択肢へ出す',
  enhanceScreen.includes('.filter(choice => choice.have > 0)') && source.includes('{fruitChoices.map(({itemId,name,have})=><button'));
check('旧実を持っていなければ選択肢は増えない', enhanceScreen.includes('transcendFruitOwnedCount(ownedItems, item.id)'));

// ===== 保存キー =====
check('新しいmh_*保存キーを作らない',
  !/mh_species_challenge_(?!progress_v1)/.test(source)
  && source.includes("const SPECIES_CHALLENGE_PROGRESS_KEY = 'mh_species_challenge_progress_v1'"));

console.log('種族チャレンジ 公開前完成状態の確認: PASS');
