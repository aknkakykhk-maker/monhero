const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const start = source.indexOf('const DIFFICULTY_SETTINGS =');
const end = source.indexOf('const SPECIES_CHALLENGE_INITIAL_UNLOCK_COUNT =', start);
if (start < 0 || end < 0) throw new Error('種族チャレンジ進行定義が見つかりません');

const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.progressApi={
  SPECIES_CHALLENGE_DIFFICULTY_IDS,SPECIES_CHALLENGE_PROGRESS_KEY,
  normalizeSpeciesChallengeProgress,isSpeciesChallengeCleared,
  isSpeciesChallengeFirstRewardClaimed,speciesChallengeClearedDifficultyIds,
  markSpeciesChallengeCleared,markSpeciesChallengeFirstRewardClaimed,
};`, context);
const api = context.progressApi;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const json = value => JSON.stringify(value);
const empty = { version:1, species:{} };

assert(api.SPECIES_CHALLENGE_PROGRESS_KEY === 'mh_species_challenge_progress_v1', '保存キー名が正しい');
for (const raw of [undefined, null, false, -1, 'broken', [], [1]]) {
  assert(json(api.normalizeSpeciesChallengeProgress(raw)) === json(empty), `${String(raw)}は空progressになる`);
}
const dirty = { version:-1, species:{
  Mocchi:{ cleared:{ Expert:true, Master:false, UNKNOWN:true }, firstRewardClaimed:{ Expert:1, Master:true } },
  FutureSpecies:{ cleared:{ INFINITY:true }, firstRewardClaimed:null },
  Broken:null,
} };
const normalized = api.normalizeSpeciesChallengeProgress(dirty);
assert(normalized.version === 1, 'versionは1へ正規化される');
assert(api.isSpeciesChallengeCleared(normalized, 'Mocchi', 'Expert'), 'trueのクリアだけを保持する');
assert(!api.isSpeciesChallengeCleared(normalized, 'Mocchi', 'Master'), 'falseはクリア扱いしない');
assert(!api.isSpeciesChallengeCleared(normalized, 'Mocchi', 'UNKNOWN'), '不正難易度を無視する');
assert(!api.isSpeciesChallengeFirstRewardClaimed(normalized, 'Mocchi', 'Expert'), 'truthy値を受取済み扱いしない');
assert(api.isSpeciesChallengeFirstRewardClaimed(normalized, 'Mocchi', 'Master'), '報酬受取trueを保持する');
assert(api.isSpeciesChallengeCleared(normalized, 'FutureSpecies', 'INFINITY'), '未知の有効speciesIdを保持する');

const original = { version:1, species:{ Liger:{ cleared:{ Hard:true }, firstRewardClaimed:{ Normal:true } } } };
const cleared = api.markSpeciesChallengeCleared(original, 'Mocchi', 'Expert');
assert(!api.isSpeciesChallengeCleared(original, 'Mocchi', 'Expert'), '元オブジェクトを破壊しない');
assert(api.isSpeciesChallengeCleared(cleared, 'Mocchi', 'Expert'), '対象難易度をクリア済みにする');
assert(api.isSpeciesChallengeCleared(cleared, 'Liger', 'Hard'), '他種族のクリアを保持する');
assert(api.isSpeciesChallengeFirstRewardClaimed(cleared, 'Liger', 'Normal'), '他種族の報酬記録を保持する');
assert(!api.isSpeciesChallengeFirstRewardClaimed(cleared, 'Mocchi', 'Expert'), 'クリアと報酬受取は独立する');
const claimed = api.markSpeciesChallengeFirstRewardClaimed(cleared, 'Mocchi', 'Expert');
assert(api.isSpeciesChallengeCleared(claimed, 'Mocchi', 'Expert'), '報酬mark後もクリアを保持する');
assert(api.isSpeciesChallengeFirstRewardClaimed(claimed, 'Mocchi', 'Expert'), '報酬を受取済みにする');
assert(json(api.markSpeciesChallengeCleared(cleared, 'Mocchi', 'Expert')) === json(cleared), 'clear markは冪等である');
assert(json(api.markSpeciesChallengeFirstRewardClaimed(claimed, 'Mocchi', 'Expert')) === json(claimed), 'reward markは冪等である');
for (const speciesId of [null, '', '   ', 1, [], {}]) {
  assert(json(api.markSpeciesChallengeCleared(claimed, speciesId, 'Master')) === json(claimed), '不正speciesIdでは変更しない');
}
assert(json(api.markSpeciesChallengeCleared(claimed, 'Mocchi', 'UNKNOWN')) === json(claimed), '不正難易度では変更しない');
assert(!api.isSpeciesChallengeCleared(claimed, 'Liger', 'Expert'), '種族ごとに同難易度の記録が独立する');
assert(!api.isSpeciesChallengeCleared(claimed, 'Mocchi', 'Hard'), '同種族でも難易度ごとに記録が独立する');

const mocchiClears = api.speciesChallengeClearedDifficultyIds(claimed, 'Mocchi');
const ligerClears = api.speciesChallengeClearedDifficultyIds(claimed, 'Liger');
assert(json(mocchiClears) === json(['Expert']), 'Mocchiのクリア一覧だけを返す');
assert(json(ligerClears) === json(['Hard']), 'Ligerのクリア一覧だけを返す');

const foundationEnd = source.indexOf('const SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS =', end);
const unlockContext = {};
vm.createContext(unlockContext);
vm.runInContext(`${source.slice(start, foundationEnd)}\nglobalThis.unlocked=isSpeciesChallengeDifficultyUnlocked;`, unlockContext);
assert(unlockContext.unlocked('Master', mocchiClears), 'Expertクリアで同種族のMasterが解放される');
assert(!unlockContext.unlocked('Master', ligerClears), '別種族のMasterは解放されない');
assert(source.includes('Beginner:1, Easy:2, Normal:3, Hard:4, Expert:5, Master:6, GrandMaster:8,'), 'STEP1Aの報酬定義を変更していない');
assert((source.match(/'mh_species_challenge_progress_v1'/g) || []).length === 1, '新しい保存キーは1つだけである');

console.log('species challenge progress checks passed');
