const fs = require('fs');
const vm = require('vm');
const { loadDyeModule } = require('../harness');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (actual, expected, message) => assert(
  JSON.stringify(actual) === JSON.stringify(expected),
  `${message}: ${JSON.stringify(actual)}`,
);

// 難易度、進行、ラン状態、specialRules resolver は互いに隣接しているため、正本から
// まとめて切り出して動かす。isQuickMode だけは resolver の外部依存なので最小stubを渡す。
const definitionStart = source.indexOf('const DIFFICULTY_SETTINGS =');
const definitionEnd = source.indexOf('const quickGrowthRateForRun =', definitionStart);
assert(definitionStart >= 0 && definitionEnd > definitionStart, '種族チャレンジ統合対象の定義が見つかる');
const context = { isQuickMode: mode => mode === 'quick' };
vm.createContext(context);
vm.runInContext(`${source.slice(definitionStart, definitionEnd)}
globalThis.api={
  DIFFICULTY_SETTINGS,EXTREME_DIFFICULTIES,SPECIES_CHALLENGE_DIFFICULTY_IDS,
  SPECIES_CHALLENGE_PROGRESS_KEY,normalizeSpeciesChallengeProgress,
  speciesChallengeClearedDifficultyIds,markSpeciesChallengeCleared,
  speciesChallengeEntryBaseId,speciesChallengeAvailableAllyIds,
  validateSpeciesChallengeAllySelection,createSpeciesChallengeRunState,
  speciesChallengeUnjoinedAllies,simulateSpeciesChallengeJoinWave,
  isSpeciesChallengeDifficultyUnlocked,SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS,
  speciesChallengeFirstClearReward,extremeDifficultySetting,specialRuleDifficultyForRun,
};`, context);
const api = context.api;

const expectedDifficulties = [
  'Beginner','Easy','Normal','Hard','Expert','Master','GrandMaster','Hell','Legend',
  'EXTREME','NIGHTMARE','CHAOS','ULTIMATE','INFINITY',
];
equal([...api.SPECIES_CHALLENGE_DIFFICULTY_IDS], expectedDifficulties, '14難易度の順序が正しい');
equal(expectedDifficulties.slice(0, 9), Object.keys(api.DIFFICULTY_SETTINGS), '通常難易度の既存設定を参照する');
equal(expectedDifficulties.slice(9), api.EXTREME_DIFFICULTIES.map(({ id }) => id), '極限難易度の既存設定を参照する');
for (const id of expectedDifficulties.slice(0, 5)) {
  assert(api.isSpeciesChallengeDifficultyUnlocked(id, []), `${id}は初期解放される`);
}
for (let i = 5; i < expectedDifficulties.length; i++) {
  const id = expectedDifficulties[i];
  assert(!api.isSpeciesChallengeDifficultyUnlocked(id, []), `${id}は直前未クリアなら解放されない`);
  assert(api.isSpeciesChallengeDifficultyUnlocked(id, [expectedDifficulties[i - 1]]), `${id}は同種族の直前クリアで解放される`);
}
let progress = api.normalizeSpeciesChallengeProgress(null);
progress = api.markSpeciesChallengeCleared(progress, 'Dragon', 'Expert');
assert(api.isSpeciesChallengeDifficultyUnlocked('Master', api.speciesChallengeClearedDifficultyIds(progress, 'Dragon')), '同種族ExpertクリアでMasterを解放する');
assert(!api.isSpeciesChallengeDifficultyUnlocked('Master', api.speciesChallengeClearedDifficultyIds(progress, 'Slime')), '他種族の進行は解放へ影響しない');

const masuMons = [{ id:'dragon-a', baseId:'Dragon' }, { id:'dragon-b', baseId:'Dragon' }, { id:'slime-owned', baseId:'Slime' }];
const unlockedBaseIds = ['Dragon','Slime','Mocchi','Golem'];
equal(api.speciesChallengeAvailableAllyIds('Dragon', unlockedBaseIds, masuMons), ['Dragon','masu:dragon-a','masu:dragon-b'], '選択種族のBaseと所持Masuだけを候補にする');
assert(api.validateSpeciesChallengeAllySelection({ speciesId:'Dragon',heroId:'Dragon', allyIds:['masu:dragon-a','masu:dragon-b'], unlockedBaseIds, masuMons }).valid, '同種族の別Masu複数を許可する');
assert(!api.validateSpeciesChallengeAllySelection({ speciesId:'Dragon',heroId:'masu:dragon-a', allyIds:['masu:dragon-a'], unlockedBaseIds, masuMons }).valid, '勇者本人entryIdを拒否する');
assert(!api.validateSpeciesChallengeAllySelection({ speciesId:'Dragon',heroId:'Dragon', allyIds:['Slime'], unlockedBaseIds, masuMons }).valid, '他種族を拒否する');
let run = api.createSpeciesChallengeRunState({ speciesId:'Dragon',heroId:'masu:dragon-a', allyIds:['Dragon','masu:dragon-b'], unlockedBaseIds, masuMons });
for (const [wave, entryId] of [[2,'masu:dragon-b'],[4,'Dragon']]) { const result=api.simulateSpeciesChallengeJoinWave(run,entryId); assert(result.joinedAllyId===entryId&&result.gutsRecoveryRequired,`WAVE${wave}で残りから任意加入する`); run=result.state; }
equal(api.speciesChallengeUnjoinedAllies(run), [], '加入後は候補から除外する');
run=api.createSpeciesChallengeRunState({speciesId:'Dragon',heroId:'Dragon',allyIds:[],unlockedBaseIds,masuMons});
for(const wave of [2,4,6]){const result=api.simulateSpeciesChallengeJoinWave(run,null);assert(!result.hadJoinCandidates&&result.gutsRecoveryRequired,`候補なしのWAVE${wave}も処理を継続する`);}

for (const id of ['EXTREME','NIGHTMARE','CHAOS','ULTIMATE','INFINITY']) {
  assert(api.specialRuleDifficultyForRun('extreme', id, true, id) === id, `${id}を既存resolverで解決する`);
  assert(api.extremeDifficultySetting(id) === api.EXTREME_DIFFICULTIES.find(setting => setting.id === id), `${id}は既存specialRulesの同一オブジェクトを返す`);
}
const debugStart = source.indexOf("{gameState==='SPECIES_CHALLENGE_DEBUG'&&(()=>{");
const debugEnd = source.indexOf("{gameState==='MONSTER_IMAGE_DEBUG'", debugStart);
const debugScreen = source.slice(debugStart, debugEnd);
assert(debugScreen.includes('buildUnifiedMonsterEntries(unlockedMonsterIds,masuMons,[])'), '勇者候補は解放済Baseと所持Masuの既存統合一覧を使う');
assert(debugScreen.includes('heroCandidates=challengeEntries.filter(entry=>entry.baseId===speciesId)'), '勇者候補を選択種族だけへ絞る');
assert(debugScreen.includes("const bonus=result.joinedAllyId?"), '加入ボーナスは実際の加入時だけ計算する');
assert(debugScreen.includes("specialRuleDifficultyForRun('extreme',speciesChallengeDebugDifficultyId,true,speciesChallengeDebugDifficultyId)"), '種族チャレンジは共通specialRules resolverを使う');
assert(!/speciesChallenge[^\n]{0,80}specialRules\s*:\s*\{/.test(source), '種族チャレンジ専用specialRules数値を複製しない');

const fruitApi = loadDyeModule();
for (const [baseId, item] of Object.entries(fruitApi.SPECIES_TRANSCEND_FRUIT_ITEMS)) {
  assert(item.baseId === baseId && item.id === fruitApi.speciesTranscendFruitItemId(baseId), `${baseId}のitemIdとbaseIdが一致する`);
}
const [baseId, otherBaseId] = Object.keys(fruitApi.ALL_PLAYER_MONSTERS);
const speciesFruit = fruitApi.speciesTranscendFruitItemId(baseId);
const otherFruit = fruitApi.speciesTranscendFruitItemId(otherBaseId);
const rainbowFruit = fruitApi.RAINBOW_TRANSCEND_FRUIT_ITEM_ID;
const masu = { id:'integration-fruit', baseId, transcended:false, transcendPoints:0 };
const items = { [speciesFruit]:1, [otherFruit]:1, [rainbowFruit]:1 };
const used = fruitApi.useTranscendFruitOnMasu(masu, items, speciesFruit, 1);
assert(used.ok && used.nextMasu.transcendPoints === 1 && !used.nextMasu.transcended, '未超越でも実1個で既存transcendPointsを+1する');
assert(fruitApi.useTranscendFruitOnMasu(masu, items, rainbowFruit, 1).ok, '虹の実は全種族に使える');
const rejected = fruitApi.useTranscendFruitOnMasu(masu, items, otherFruit, 1);
assert(!rejected.ok && rejected.nextOwnedItems[rainbowFruit] === 1, '別種族を拒否し虹を自動代用しない');
assert(Object.values(api.SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS).reduce((sum, count) => sum + count, 0) === 181, '1種族の初回報酬合計は181個である');

assert(api.SPECIES_CHALLENGE_PROGRESS_KEY === 'mh_species_challenge_progress_v1', '進行は指定済みキーを使う');
assert(debugScreen.includes("storeSet('mh_masu_mons',nextMasuMons,false)") && debugScreen.includes("storeSet('mh_owned_items',result.nextOwnedItems,false)"), '実の使用は既存のMasu・所持品キーだけへ保存する');
assert(!debugScreen.includes('storeSet(\'mh_species_challenge_run') && !debugScreen.includes('storeSet("mh_species_challenge_run'), '供モンのラン状態を保存しない');
for (const legacyKey of ['mh_species_challenge_progress_v1','mh_owned_items','mh_masu_mons']) assert(source.includes(legacyKey), `${legacyKey}を維持する`);

const battleModes = source.slice(source.indexOf('const BATTLE_MODES = ['), source.indexOf('// 極限チャレンジは通常の3モードとは別に持っている'));
assert(!battleModes.includes('BATTLE_MODE_SPECIES_CHALLENGE'), '本番BATTLE MODEへ表示しない');
assert(!source.includes('SPECIES_CHALLENGE_RANKING') && !source.includes('species_challenge_ranking'), '種族チャレンジのランキング接続を作らない');
assert(!source.includes('SPECIES_CHALLENGE_MARKET') && !source.includes('species_challenge_market'), '種族チャレンジのMARKET接続を作らない');
assert(!source.includes('grantSpeciesChallengeFirstClearReward'), '初回報酬の自動配布をまだ接続しない');

console.log('species challenge integration checks passed');
