const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const start = source.indexOf('const DIFFICULTY_SETTINGS =');
const end = source.indexOf('const SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS =', start);
if (start < 0 || end < 0) throw new Error('種族チャレンジ進行定義が見つかりません');

const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.progressApi={
  SPECIES_CHALLENGE_PROGRESS_KEY,normalizeSpeciesChallengeProgress,
  isSpeciesChallengeCleared,isSpeciesChallengeFirstRewardClaimed,
  speciesChallengeClearedDifficultyIds,markSpeciesChallengeCleared,
  markSpeciesChallengeFirstRewardClaimed,isSpeciesChallengeDifficultyUnlocked,
  speciesChallengeRecord,updateSpeciesChallengeRecord,speciesChallengeTotalClearedCount,
};`, context);
const api = context.progressApi;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const json = value => JSON.stringify(value);

assert(api.SPECIES_CHALLENGE_PROGRESS_KEY === 'mh_species_challenge_progress_v1', '保存キーが正しい');
for (const broken of [null, undefined, false, 1, 'broken', [], {}, { species:null }, { species:[] }]) {
  assert(json(api.normalizeSpeciesChallengeProgress(broken)) === json({ version:1, species:{}, pendingRewards:{} }), '空・壊れた値を空の進行へ正規化する');
}

const dirty = { version:0, species:{
  dragon:{ cleared:{ Expert:true, Master:false, UNKNOWN:true }, firstRewardClaimed:{ Hard:true, Expert:1 } },
  futureSpecies:{ cleared:{ Beginner:true }, firstRewardClaimed:{} },
} };
const clean = api.normalizeSpeciesChallengeProgress(dirty);
assert(json(clean) === json({ version:1, species:{
  dragon:{ cleared:{ Expert:true }, firstRewardClaimed:{ Hard:true }, records:{} },
  futureSpecies:{ cleared:{ Beginner:true }, firstRewardClaimed:{}, records:{} },
}, pendingRewards:{} }), '有効なtrueだけを保持し、未知の有効speciesIdを保持する');

// --- 自己記録は「種族 × 難易度」ごとに独立させる ---
// records を持たない既存セーブがそのまま読めること(新しいmh_*キーを作らないための後方互換)と、
// 壊れた値・他難易度・他種族へ漏れないことを確かめる。
assert(json(api.normalizeSpeciesChallengeProgress({ species:{ dragon:{ cleared:{ Expert:true } } } }).species.dragon.records) === json({}),
  'recordsを持たない既存セーブでも空の記録として読める');
const brokenRecords = api.normalizeSpeciesChallengeProgress({ species:{ dragon:{ records:{
  Expert:{ bestScore:'x', bestTurns:-3, clears:2.9 },
  UNKNOWN:{ bestScore:100, clears:1 },
  Hard:{ bestScore:0, bestTurns:0, clears:0 },
} } } });
assert(json(brokenRecords.species.dragon.records) === json({ Expert:{ bestScore:0, bestTurns:null, clears:2 } }),
  '壊れた記録・未知の難易度・中身のない記録を落とす');
const blank = api.normalizeSpeciesChallengeProgress(null);
const scored = api.updateSpeciesChallengeRecord(blank, 'dragon', 'Expert', { score:1200, turns:38 });
assert(json(api.speciesChallengeRecord(scored, 'dragon', 'Expert')) === json({ bestScore:1200, bestTurns:38, clears:1 }), '初回クリアの記録を残す');
assert(json(api.speciesChallengeRecord(scored, 'dragon', 'Hard')) === json({ bestScore:0, bestTurns:null, clears:0 }), '記録は難易度ごとに独立している');
assert(json(api.speciesChallengeRecord(scored, 'beast', 'Expert')) === json({ bestScore:0, bestTurns:null, clears:0 }), '記録は種族ごとに独立している');
const worse = api.updateSpeciesChallengeRecord(scored, 'dragon', 'Expert', { score:800, turns:55 });
assert(json(api.speciesChallengeRecord(worse, 'dragon', 'Expert')) === json({ bestScore:1200, bestTurns:38, clears:2 }), '記録が下回ったらベストは据え置き、クリア回数だけ増える');
const better = api.updateSpeciesChallengeRecord(worse, 'dragon', 'Expert', { score:2000, turns:20 });
assert(json(api.speciesChallengeRecord(better, 'dragon', 'Expert')) === json({ bestScore:2000, bestTurns:20, clears:3 }), 'スコアは高い方、ターンは少ない方を残す');
assert(json(api.speciesChallengeRecord(scored, 'dragon', 'Expert')) === json({ bestScore:1200, bestTurns:38, clears:1 }), '記録更新は更新元を破壊しない');
const twoCleared = api.markSpeciesChallengeCleared(api.markSpeciesChallengeCleared(blank, 'dragon', 'Expert'), 'beast', 'Hard');
assert(api.speciesChallengeTotalClearedCount(blank) === 0 && api.speciesChallengeTotalClearedCount(twoCleared) === 2,
  'モードカード用のクリア数は種族をまたいだクリア済みの組を数える');

const empty = api.normalizeSpeciesChallengeProgress(null);
const dragonExpert = api.markSpeciesChallengeCleared(empty, 'dragon', 'Expert');
assert(!api.isSpeciesChallengeCleared(empty, 'dragon', 'Expert'), '更新元を破壊しない');
assert(api.isSpeciesChallengeCleared(dragonExpert, 'dragon', 'Expert'), '対象種族・難易度をクリア済みにする');
assert(!api.isSpeciesChallengeCleared(dragonExpert, 'dragon', 'Hard'), '難易度間で独立している');
assert(!api.isSpeciesChallengeCleared(dragonExpert, 'beast', 'Expert'), '種族間で独立している');
assert(!api.isSpeciesChallengeFirstRewardClaimed(dragonExpert, 'dragon', 'Expert'), 'クリアと報酬受取は独立している');

const rewarded = api.markSpeciesChallengeFirstRewardClaimed(dragonExpert, 'dragon', 'Expert');
assert(api.isSpeciesChallengeCleared(rewarded, 'dragon', 'Expert'), '報酬受取更新でクリアを保持する');
assert(api.isSpeciesChallengeFirstRewardClaimed(rewarded, 'dragon', 'Expert'), '報酬受取を記録する');
assert(json(api.markSpeciesChallengeCleared(dragonExpert, 'dragon', 'Expert')) === json(dragonExpert), 'クリア更新は冪等である');
assert(json(api.markSpeciesChallengeFirstRewardClaimed(rewarded, 'dragon', 'Expert')) === json(rewarded), '報酬受取更新は冪等である');

const invalid = api.markSpeciesChallengeCleared(rewarded, 'dragon', 'UNKNOWN');
assert(json(invalid) === json(rewarded), '不正難易度を無視する');
assert(json(api.speciesChallengeClearedDifficultyIds(dragonExpert, 'dragon')) === json(['Expert']), 'クリア難易度を正本の順序で返す');
assert(api.isSpeciesChallengeDifficultyUnlocked('Master', api.speciesChallengeClearedDifficultyIds(dragonExpert, 'dragon')), 'Expertクリアで同種族Masterを解放する');
assert(!api.isSpeciesChallengeDifficultyUnlocked('Master', api.speciesChallengeClearedDifficultyIds(dragonExpert, 'beast')), '他種族Masterは解放されない');

console.log('species challenge progress checks passed');
