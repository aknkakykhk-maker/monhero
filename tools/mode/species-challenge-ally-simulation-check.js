const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (actual, expected, message) => assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}: ${JSON.stringify(actual)}`);

const start = source.indexOf('const speciesChallengeEntryBaseId =');
const end = source.indexOf('const SPECIES_CHALLENGE_INITIAL_UNLOCK_COUNT =', start);
assert(start >= 0 && end > start, 'STEP1Dの一時ランhelperが見つかる');
const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.api={speciesChallengeEntryBaseId,speciesChallengeAvailableAllyIds,validateSpeciesChallengeAllySelection,createSpeciesChallengeRunState,speciesChallengeUnjoinedAllies,joinSpeciesChallengeAlly,simulateSpeciesChallengeJoinWave};`, context);
const { api } = context;
const masuMons = [{ id:101, baseId:'Dragon' }, { id:202, baseId:'Slime' }];
const unlockedBaseIds = ['Mocchi','Dragon','Slime','Golem'];

assert(!api.validateSpeciesChallengeAllySelection({heroId:'Mocchi',allyIds:['Mocchi'],unlockedBaseIds,masuMons}).valid, '勇者と同種を拒否する');
assert(!api.validateSpeciesChallengeAllySelection({heroId:'Mocchi',allyIds:['Dragon','masu:101'],unlockedBaseIds,masuMons}).valid, 'Base/Masuを含む供モン同種を拒否する');
assert(!api.validateSpeciesChallengeAllySelection({heroId:'Mocchi',allyIds:['Slime','masu:202'],unlockedBaseIds,masuMons}).valid, '供モン同士の同種を拒否する');

let run = api.createSpeciesChallengeRunState({heroId:'Mocchi',allyIds:['Golem','Dragon','Slime'],unlockedBaseIds,masuMons});
for (const id of ['Slime','Golem','Dragon']) {
  const result = api.simulateSpeciesChallengeJoinWave(run,id);
  assert(result.joinedAllyId === id && result.gutsRecoveryRequired, '任意順の加入と回復対象を両立する');
  run = result.state;
}
equal(api.speciesChallengeUnjoinedAllies(run), [], '3体をW2/W4/W6で全員加入できる');
const duplicate = api.simulateSpeciesChallengeJoinWave(run,'Dragon');
assert(duplicate.joinedAllyId === null && duplicate.state === run, '二重加入できない');

run = api.createSpeciesChallengeRunState({heroId:'Mocchi',allyIds:['Dragon'],unlockedBaseIds,masuMons});
run = api.simulateSpeciesChallengeJoinWave(run,'Dragon').state;
for (const wave of [4,6]) {
  const noJoin = api.simulateSpeciesChallengeJoinWave(run,null);
  assert(noJoin.joinedAllyId === null && noJoin.gutsRecoveryRequired, `1体構成のW${wave}は加入なしでも回復対象`);
}
run = api.createSpeciesChallengeRunState({heroId:'Mocchi',allyIds:[],unlockedBaseIds,masuMons});
for (const wave of [2,4,6]) {
  const noJoin = api.simulateSpeciesChallengeJoinWave(run,null);
  assert(noJoin.joinedAllyId === null && noJoin.gutsRecoveryRequired, `0体構成のW${wave}は加入なしでも回復対象`);
}

const screenStart = source.indexOf("{gameState==='SPECIES_CHALLENGE_DEBUG'&&(()=>{");
const screenEnd = source.indexOf("{gameState==='MONSTER_IMAGE_DEBUG'", screenStart);
const screen = source.slice(screenStart, screenEnd);
for (const helper of ['speciesChallengeEntryBaseId','speciesChallengeAvailableAllyIds','validateSpeciesChallengeAllySelection','createSpeciesChallengeRunState','speciesChallengeUnjoinedAllies','joinSpeciesChallengeAlly']) assert(source.includes(helper), `STEP1D helper ${helper}を維持する`);
assert(screen.includes('data-species-ally-simulation'), '既存デバッグ画面内に加入シミュレーションがある');
assert(screen.includes("applyAllyJoinBonus(joinedMon?.plusStats?.[key]||0,rule,0)"), '加入時だけ既存の加入ボーナス計算を使う');
assert(screen.includes("const bonus=result.joinedAllyId?"), '加入なしでは加入ボーナスを計算しない');
assert(!screen.includes("storeSet('mh_species_challenge"), 'シミュレーション用の保存キーを追加しない');

console.log('species challenge ally simulation checks passed');
