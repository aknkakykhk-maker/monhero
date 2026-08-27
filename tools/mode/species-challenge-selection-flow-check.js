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

assert(api.speciesChallengeAvailableAllyIds('Mocchi', unlockedBaseIds, masuMons).includes('Mocchi'), '選択種族のBaseを候補へ含める');
assert(api.speciesChallengeAvailableAllyIds('Mocchi', unlockedBaseIds, masuMons).includes('masu:hero-masu'), '選択種族の所持Masuを安定IDで候補へ含める');
for (const allies of [[], ['masu:hero-masu']]) {
  assert(api.validateSpeciesChallengeAllySelection({ speciesId:'Mocchi',heroId:'Mocchi', allyIds:allies, unlockedBaseIds, masuMons }).valid, `供モン${allies.length}体を許可する`);
}
assert(!api.validateSpeciesChallengeAllySelection({ speciesId:'Mocchi',heroId:'masu:hero-masu', allyIds:['masu:hero-masu'], unlockedBaseIds, masuMons }).valid, '勇者と同じentryIdの供モンを拒否する');
assert(!api.validateSpeciesChallengeAllySelection({ speciesId:'Mocchi',heroId:'Mocchi', allyIds:['Dragon'], unlockedBaseIds, masuMons }).valid, '他種族を拒否する');
const run = api.createSpeciesChallengeRunState({ speciesId:'Mocchi', difficultyId:'Expert', heroId:'Mocchi', allyIds:['masu:hero-masu'], unlockedBaseIds, masuMons });
assert(run?.speciesId === 'Mocchi' && run?.allyIds[0] === 'masu:hero-masu', '確認画面から種族限定run情報を生成する');

const screenStart = source.indexOf("{gameState==='SPECIES_CHALLENGE_SELECT'");
const screenEnd = source.indexOf("{gameState==='MONSTER_IMAGE_DEBUG'", screenStart);
const screen = source.slice(screenStart, screenEnd);
assert(screenStart >= 0 && screenEnd > screenStart, '本番形式の共通選択画面が存在する');
for (const step of ['species', 'hero', 'allies', 'confirm']) assert(screen.includes(`'${step}'`), `${step}ステップがある`);
assert(screen.includes('Object.entries(ALL_PLAYER_MONSTERS)'), '種族候補はALL_PLAYER_MONSTERSのbaseIdを正本にする');
assert(source.includes('const difficulties=species?SPECIES_CHALLENGE_DIFFICULTY_IDS.map'), '14難易度は既存BATTLE DIFFICULTY描画へデータとして渡す');
assert(source.includes('speciesChallengeClearedDifficultyIds(speciesChallengeProgress,speciesChallengeSelection.speciesId)'), '共通難易度画面は種族別progressからクリア難易度を得る');
assert(source.includes('isSpeciesChallengeDifficultyUnlocked(key,speciesChallengeClearedDifficultyIds'), 'ロック判定は既存helperと種族別進行を再利用する');
assert(!screen.includes('speciesChallengeDebugProgress'), '選択フローはデバッグ専用progressに依存しない');
assert(screen.includes('buildUnifiedMonsterEntries(unlockedMonsterIds,masuMons,[])'), '勇者・供モンは既存統合候補生成を再利用する');
assert(screen.includes('validateSpeciesChallengeAllySelection') && screen.includes('createSpeciesChallengeRunState'), 'STEP1D validationとrun helperを再利用する');
assert(screen.includes('0体のままでも次へ進めます') && screen.includes('min-h-[44px]'), '0体出撃案内と44px以上の戻る操作を備える');
assert(source.includes('speciesChallengeFirstClearReward(key)'), '共通難易度カードに既存helper由来の初回報酬を表示する');
assert(screen.includes("entry.type==='masu'?'Masu':'Base'") && screen.includes('DyedMonsterImage'), '勇者・供モンカードは画像とBase/Masu区別を表示する');
assert(!screen.includes("selection.step==='intro'") && !source.includes('data-species-preview-mode-card'), '専用モードプレビューを廃止する');
assert(source.includes("isSpecies?'種族を選ぶ':'難易度を選ぶ'"), '共通モードカードから種族選択へ進める');
assert(source.includes('const loadSpeciesChallengeProgress = async() =>')
  && source.includes('normalizeSpeciesChallengeProgress(await storeGet(SPECIES_CHALLENGE_PROGRESS_KEY,null,false))'), '共通loaderは既存キーを読み込み正規化する');
assert(source.includes('const openSpeciesChallengeSelection = async() =>')
  && source.includes('await loadSpeciesChallengeProgress();')
  && source.includes('if(isSpecies){openSpeciesChallengeSelection();return;}'), 'デバッグ画面を先に開かず選択フロー入口で保存済み進行を読む');
const battleModes = source.slice(source.indexOf('const BATTLE_MODES = ['), source.indexOf('// 極限チャレンジは通常の3モードとは別に持っている'));
assert(!battleModes.includes('BATTLE_MODE_SPECIES_CHALLENGE') && !battleModes.includes('SPECIES_CHALLENGE_SELECT'), '本番BATTLE MODEには入口を表示しない');
assert(!screen.includes('storeSet(') && !screen.includes('storeGet(') && !/mh_[a-z]/.test(screen), '選択フローは保存キーを読み書きしない');

console.log('種族チャレンジSTEP5A選択フロー確認: PASS');
