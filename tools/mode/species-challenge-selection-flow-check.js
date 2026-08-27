const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(`NG: ${message}`);
  console.log(`OK: ${message}`);
};

const helperStart = source.indexOf('const speciesChallengeEntryBaseId =');
const helperEnd = source.indexOf('const SPECIES_CHALLENGE_INITIAL_UNLOCK_COUNT =', helperStart);
const foundationStart = source.indexOf('const DIFFICULTY_SETTINGS =');
const foundationEnd = source.indexOf('const SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS =', foundationStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'STEP1Dの選択validation/helperが存在する');
assert(foundationStart >= 0 && foundationEnd > foundationStart, '共通難易度解放helperが存在する');

const helperContext = { console };
vm.createContext(helperContext);
vm.runInContext(`${source.slice(helperStart, helperEnd)}\nglobalThis.api={speciesChallengeEntryBaseId,speciesChallengeAvailableAllyIds,validateSpeciesChallengeAllySelection,createSpeciesChallengeRunState};`, helperContext);
const api = helperContext.api;
const unlockedBaseIds = ['Mocchi', 'Dragon', 'Slime', 'Golem', 'Tiger'];
const masuMons = [
  { id:'hero-masu', baseId:'Mocchi' },
  { id:'dragon-masu', baseId:'Dragon' },
  { id:'tiger-masu', baseId:'Tiger' },
];

assert(api.speciesChallengeAvailableAllyIds(unlockedBaseIds, masuMons).includes('Mocchi'), '解放済みBaseを統合候補へ含める');
assert(api.speciesChallengeAvailableAllyIds(unlockedBaseIds, masuMons).includes('masu:hero-masu'), '所持Masuを安定IDで統合候補へ含める');
for (const allies of [[], ['Dragon'], ['Dragon', 'Slime'], ['Dragon', 'Slime', 'Golem']]) {
  assert(api.validateSpeciesChallengeAllySelection({ heroId:'masu:hero-masu', allyIds:allies, unlockedBaseIds, masuMons }).valid, `供モン${allies.length}体を許可する`);
}
assert(!api.validateSpeciesChallengeAllySelection({ heroId:'Mocchi', allyIds:['masu:hero-masu'], unlockedBaseIds, masuMons }).valid, '勇者と同じbaseIdの供モンを拒否する');
assert(!api.validateSpeciesChallengeAllySelection({ heroId:'Mocchi', allyIds:['Dragon', 'masu:dragon-masu'], unlockedBaseIds, masuMons }).valid, 'Base/Masu混在でも供モン同種を拒否する');
assert(!api.validateSpeciesChallengeAllySelection({ heroId:'Mocchi', allyIds:['Dragon', 'Slime', 'Golem', 'Tiger'], unlockedBaseIds, masuMons }).valid, '4体目を拒否する');
const run = api.createSpeciesChallengeRunState({ speciesId:'Mocchi', difficultyId:'Expert', heroId:'masu:hero-masu', allyIds:['Dragon'], unlockedBaseIds, masuMons });
assert(run?.speciesId === 'Mocchi' && run?.difficultyId === 'Expert' && run?.heroId === 'masu:hero-masu' && run?.allyIds[0] === 'Dragon', '確認画面から本番バトル用run情報を生成する');

const screenStart = source.indexOf("{gameState==='SPECIES_CHALLENGE_SELECT'");
const screenEnd = source.indexOf("{gameState==='MONSTER_IMAGE_DEBUG'", screenStart);
const screen = source.slice(screenStart, screenEnd);
assert(screenStart >= 0 && screenEnd > screenStart, '5段階の共通選択画面が存在する');
for (const step of ['species', 'difficulty', 'hero', 'allies', 'confirm']) assert(screen.includes(`'${step}'`), `${step}ステップがある`);
assert(screen.includes('Object.entries(ALL_PLAYER_MONSTERS)'), '種族候補はALL_PLAYER_MONSTERSのbaseIdを正本にする');
assert(screen.includes('SPECIES_CHALLENGE_DIFFICULTY_IDS.map'), '14難易度は既存ID一覧を再利用する');
assert(screen.includes('isSpeciesChallengeDifficultyUnlocked(id,clearedIds)'), 'ロック判定は既存helperと種族別進行を再利用する');
assert(screen.includes('buildUnifiedMonsterEntries(unlockedMonsterIds,masuMons,[])'), '勇者・供モンは既存統合候補生成を再利用する');
assert(screen.includes('validateSpeciesChallengeAllySelection') && screen.includes('createSpeciesChallengeRunState'), 'STEP1D validationとrun helperを再利用する');
assert(screen.includes('0体のままでも次へ進めます') && screen.includes('min-h-[44px]'), '0体出撃案内と44px以上の戻る操作を備える');
assert(source.includes('data-species-challenge-production-flow') && source.includes("setGameState('SPECIES_CHALLENGE_SELECT')"), '入口は種族チャレンジ進行確認にある');
const battleModes = source.slice(source.indexOf('const BATTLE_MODES = ['), source.indexOf('// 極限チャレンジは通常の3モードとは別に持っている'));
assert(!battleModes.includes('BATTLE_MODE_SPECIES_CHALLENGE') && !battleModes.includes('SPECIES_CHALLENGE_SELECT'), '本番BATTLE MODEには入口を表示しない');
assert(!screen.includes('storeSet(') && !screen.includes('storeGet(') && !/mh_[a-z]/.test(screen), '選択フローは保存キーを読み書きしない');

console.log('種族チャレンジSTEP5A選択フロー確認: PASS');
