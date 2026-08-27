const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const screenStart = source.indexOf("{gameState==='SPECIES_CHALLENGE_DEBUG'");
const screenEnd = source.indexOf("{gameState==='MONSTER_IMAGE_DEBUG'", screenStart);
assert(screenStart >= 0 && screenEnd > screenStart, '種族チャレンジ専用デバッグ画面がある');
const screen = source.slice(screenStart, screenEnd);

for (const name of [
  'SPECIES_CHALLENGE_PROGRESS_KEY', 'normalizeSpeciesChallengeProgress',
  'isSpeciesChallengeCleared', 'isSpeciesChallengeFirstRewardClaimed',
  'speciesChallengeClearedDifficultyIds', 'markSpeciesChallengeCleared',
  'markSpeciesChallengeFirstRewardClaimed', 'isSpeciesChallengeDifficultyUnlocked',
  'speciesChallengeFirstClearReward',
]) assert(screen.includes(name), `デバッグ画面がSTEP1 helper ${name}を利用する`);

assert(screen.includes('Object.entries(ALL_PLAYER_MONSTERS)'), '種族一覧はALL_PLAYER_MONSTERSから生成する');
assert(screen.includes('SPECIES_CHALLENGE_DIFFICULTY_IDS.map'), '14難易度は共通難易度ID一覧から生成する');
assert(screen.includes('delete next.species[speciesId]'), 'リセットは選択種族だけを削除する');
assert(screen.includes('storeSet(SPECIES_CHALLENGE_PROGRESS_KEY,normalized,false)'), '保存先は既存の種族チャレンジ進行キーだけである');
assert(source.includes('data-debug-species-challenge') && source.includes("setGameState('SPECIES_CHALLENGE_DEBUG')"), '入口はデバッグ設定にだけある');
assert(screen.includes('data-transcend-fruit-debug'), '超越の実の確認セクションがある');
for (const text of ['所持マスモン','対応種族の実','虹の実','MAX','超越P：']) assert(screen.includes(text), `超越の実確認に「${text}」がある`);
assert(screen.includes('useTranscendFruitOnMasu(selectedMasu,ownedItems,selectedFruitId,amount)'), '純粋処理へ選択した実を明示して渡す');
assert(screen.includes("storeSet('mh_masu_mons',nextMasuMons,false)") && screen.includes("storeSet('mh_owned_items',result.nextOwnedItems,false)"), '使用結果は既存の2保存キーだけへ保存する');

const start = source.indexOf('const DIFFICULTY_SETTINGS =');
const end = source.indexOf('const SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS =', start);
const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.api={
  normalizeSpeciesChallengeProgress,markSpeciesChallengeCleared,
  speciesChallengeClearedDifficultyIds,isSpeciesChallengeDifficultyUnlocked,
};`, context);
const { api } = context;
const initial = api.normalizeSpeciesChallengeProgress(null);
const mocchi = api.markSpeciesChallengeCleared(initial, 'Mocchi', 'Expert');
assert(api.isSpeciesChallengeDifficultyUnlocked('Master', api.speciesChallengeClearedDifficultyIds(mocchi, 'Mocchi')), 'モッチーExpertクリアでモッチーMasterが解放される');
assert(!api.isSpeciesChallengeDifficultyUnlocked('Master', api.speciesChallengeClearedDifficultyIds(mocchi, 'Raiga')), 'モッチーの進行でライガーMasterは解放されない');

console.log('species challenge debug checks passed');
