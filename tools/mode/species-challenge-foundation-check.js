const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const start = source.indexOf('const DIFFICULTY_SETTINGS =');
const end = source.indexOf('const EXTREME_SETTING =', start);
if (start < 0 || end < 0) throw new Error('難易度・種族チャレンジ定義が見つかりません');

const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.foundation={
  DIFFICULTY_SETTINGS,EXTREME_DIFFICULTIES,SPECIES_CHALLENGE_DIFFICULTY_IDS,
  isSpeciesChallengeDifficultyUnlocked,SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS,
  speciesChallengeFirstClearReward,
};`, context);
const foundation = context.foundation;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const expectedIds = [
  'Beginner','Easy','Normal','Hard','Expert','Master','GrandMaster','Hell','Legend',
  'EXTREME','NIGHTMARE','CHAOS','ULTIMATE','INFINITY',
];
const expectedRewards = {
  Beginner:1, Easy:2, Normal:3, Hard:4, Expert:5, Master:6, GrandMaster:8,
  Hell:10, Legend:12, EXTREME:15, NIGHTMARE:20, CHAOS:25, ULTIMATE:30, INFINITY:40,
};
const unlocked = foundation.isSpeciesChallengeDifficultyUnlocked;

assert(foundation.SPECIES_CHALLENGE_DIFFICULTY_IDS.length === 14, '難易度は14個である');
assert(JSON.stringify([...foundation.SPECIES_CHALLENGE_DIFFICULTY_IDS]) === JSON.stringify(expectedIds), '難易度順が仕様どおりである');
for (const id of expectedIds.slice(0, 5)) assert(unlocked(id, []), `${id}は初期解放される`);
for (let index = 5; index < expectedIds.length; index++) {
  const id = expectedIds[index];
  const prerequisite = expectedIds[index - 1];
  assert(unlocked(id, [prerequisite]), `${id}は${prerequisite}クリアで解放される`);
  assert(!unlocked(id, []), `${id}は前提難易度未クリアならロックされる`);
}
assert(unlocked('EXTREME', ['Legend']), 'EXTREMEはLegendクリアで解放される');
assert(unlocked('INFINITY', ['ULTIMATE']), 'INFINITYはULTIMATEクリアで解放される');
assert(!unlocked('Master', ['Master']), '対象難易度自身のクリアは前提クリアの代わりにならない');
assert(!unlocked('UNKNOWN', expectedIds), '不正難易度IDはfalseになる');
assert(!unlocked(null, expectedIds), '不正な型の難易度IDはfalseになる');
assert(!unlocked('Master', null), '不正なクリア一覧は空として扱う');

assert(JSON.stringify({...foundation.SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS}) === JSON.stringify(expectedRewards), '報酬14難易度が指定値と完全一致する');
for (const [id, reward] of Object.entries(expectedRewards)) assert(foundation.speciesChallengeFirstClearReward(id) === reward, `${id}の報酬は${reward}個である`);
assert(foundation.speciesChallengeFirstClearReward('UNKNOWN') === 0, '不正難易度IDの報酬は0個になる');

assert(JSON.stringify(Object.keys(foundation.DIFFICULTY_SETTINGS)) === JSON.stringify(expectedIds.slice(0, 9)), '既存DIFFICULTY_SETTINGSのIDと順序を変更していない');
assert(JSON.stringify(foundation.EXTREME_DIFFICULTIES.map(item => item.id)) === JSON.stringify(expectedIds.slice(9)), '既存EXTREME_DIFFICULTIESのIDと順序を変更していない');
const battleModes = source.slice(source.indexOf('const BATTLE_MODES = ['), source.indexOf('// 極限チャレンジは通常の3モードとは別に持っている'));
assert(!battleModes.includes('BATTLE_MODE_SPECIES_CHALLENGE') && !battleModes.includes('SPECIES_CHALLENGE_MODE'), '種族チャレンジは本番モード選択UIへ表示されていない');
assert(source.includes("const BATTLE_MODE_SPECIES_CHALLENGE = 'speciesChallenge';") && source.includes("label:'種族チャレンジ'"), '内部IDと表示名を定義している');
assert(!source.includes("'mh_species"), '種族チャレンジ用の保存キーを追加していない');

console.log('species challenge foundation checks passed');
