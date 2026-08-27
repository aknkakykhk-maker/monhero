const fs = require('fs');
const { loadDyeModule } = require('../harness');

const api = loadDyeModule();
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const fruit = speciesId => api.speciesTranscendFruitItemId(speciesId);
const empty = () => api.normalizeSpeciesChallengeProgress(null);

assert(api.speciesChallengeFirstClearReward('Beginner') === 1, 'Beginner初回は1個');
assert(api.speciesChallengeFirstClearReward('INFINITY') === 40, 'INFINITY初回は40個');
assert(Object.values(api.SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS).reduce((sum,n)=>sum+n,0) === 181, '14難易度合計181個');

let first = api.finalizeSpeciesChallengeClearReward({ progress:empty(),ownedItems:{ potion:7 },speciesId:'mocchi',difficultyId:'Beginner' });
assert(first.rewardGranted && first.rewardAmount === 1 && first.nextOwnedItems[fruit('mocchi')] === 1, 'Beginner初回を対応種族(主血統)へ付与');
assert(first.nextOwnedItems.potion === 7, '他のownedItemsを保持');
let twice = api.finalizeSpeciesChallengeClearReward({ progress:first.nextProgress,ownedItems:first.nextOwnedItems,speciesId:'mocchi',difficultyId:'Beginner' });
assert(!twice.rewardGranted && twice.rewardAmount === 0 && twice.nextOwnedItems[fruit('mocchi')] === 1, '同じ組み合わせの2回目は+0');

const infinity = api.finalizeSpeciesChallengeClearReward({ progress:empty(),ownedItems:{},speciesId:'suezo',difficultyId:'INFINITY' });
assert(infinity.nextOwnedItems[fruit('suezo')] === 40, 'INFINITY初回を40個付与');
assert(!infinity.nextOwnedItems[api.RAINBOW_TRANSCEND_FRUIT_ITEM_ID], '虹の超越の実を付与しない');
const separate = api.finalizeSpeciesChallengeClearReward({ progress:first.nextProgress,ownedItems:first.nextOwnedItems,speciesId:'suezo',difficultyId:'Beginner' });
assert(separate.nextOwnedItems[fruit('suezo')] === 1 && separate.nextOwnedItems[fruit('mocchi')] === 1, '別種族は独立');

const clearedOnly = api.normalizeSpeciesChallengeProgress({ species:{ Mocchi:{ cleared:{ Hard:true },firstRewardClaimed:{} } } });
const recoveredOld = api.finalizeSpeciesChallengeClearReward({ progress:clearedOnly,ownedItems:{},speciesId:'mocchi',difficultyId:'Hard' });
assert(recoveredOld.rewardGranted && recoveredOld.nextOwnedItems[fruit('mocchi')] === 4, 'cleared済みclaimed未済みへ1回だけ付与');
const claimed = api.finalizeSpeciesChallengeClearReward({ progress:recoveredOld.nextProgress,ownedItems:recoveredOld.nextOwnedItems,speciesId:'mocchi',difficultyId:'Hard' });
assert(!claimed.rewardGranted && claimed.nextOwnedItems[fruit('mocchi')] === 4, 'claimed済みは付与なし');

async function crashRecovery(failAfter) {
  const storage = { [api.SPECIES_CHALLENGE_PROGRESS_KEY]:empty(),'mh_owned_items':{ potion:3 } };
  let writes = 0;
  const storeSet = async (key,value) => { if (++writes > failAfter) throw new Error('reload'); storage[key]=JSON.parse(JSON.stringify(value)); };
  const storeGet = async (key,fallback) => storage[key] ?? fallback;
  try { await api.persistSpeciesChallengeClearReward({ progress:storage[api.SPECIES_CHALLENGE_PROGRESS_KEY],ownedItems:storage.mh_owned_items,speciesId:'mocchi',difficultyId:'Normal',storeSet,storeGet }); } catch (error) { assert(error.message==='reload','想定した途中終了'); }
  const pendingReloaded=api.normalizeSpeciesChallengeProgress(storage[api.SPECIES_CHALLENGE_PROGRESS_KEY]);
  writes=0;
  const result=await api.persistSpeciesChallengeClearReward({ progress:pendingReloaded,ownedItems:storage.mh_owned_items,speciesId:'mocchi',difficultyId:'Normal',storeSet:async(key,value)=>{storage[key]=JSON.parse(JSON.stringify(value));},storeGet });
  assert(storage.mh_owned_items[fruit('mocchi')]===3, `保存${failAfter}段階後も1回分へ収束`);
  assert(storage.mh_owned_items.potion===3, '復旧でも他アイテムを保持');
  assert(api.isSpeciesChallengeCleared(result.nextProgress,'mocchi','Normal'),'復旧後cleared=true');
  assert(api.isSpeciesChallengeFirstRewardClaimed(result.nextProgress,'mocchi','Normal'),'復旧後claimed=true');
  assert(Object.keys(result.nextProgress.pendingRewards).length===0,'復旧後pending解除');
}

(async()=>{
  for (const failAfter of [1,2,3]) await crashRecovery(failAfter);
  const source=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
  const touchedKeys=[...source.matchAll(/['"](mh_[a-z0-9_]+)['"]/g)].map(match=>match[1]);
  const rewardBlock=source.slice(source.indexOf('const finalizeSpeciesChallengeClearReward'),source.indexOf('const EXTREME_SETTING'));
  const rewardKeys=[...rewardBlock.matchAll(/['"](mh_[a-z0-9_]+)['"]/g)].map(match=>match[1]);
  assert(rewardKeys.every(key=>['mh_species_challenge_progress_v1','mh_owned_items'].includes(key)), '確定処理は指定2キーだけを使う');
  assert(touchedKeys.includes('mh_species_challenge_progress_v1') && touchedKeys.includes('mh_owned_items'), '既存2キーを維持');
  console.log('species challenge clear reward checks passed');
})().catch(error=>{ console.error(error);process.exitCode=1; });
