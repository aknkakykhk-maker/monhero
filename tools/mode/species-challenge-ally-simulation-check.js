const fs = require('fs');
const vm = require('vm');
const { installLineageHelpers } = require('./species-challenge-lineage-stub');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (actual, expected, message) => assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}: ${JSON.stringify(actual)}`);
const start = source.indexOf('const speciesChallengeEntryBaseId =');
const end = source.indexOf('const SPECIES_CHALLENGE_INITIAL_UNLOCK_COUNT =', start);
assert(start >= 0 && end > start, '種族チャレンジの一時ランhelperが見つかる');
const context = { console }; vm.createContext(context);
installLineageHelpers(vm, context, { source });
vm.runInContext(`${source.slice(start,end)}\nglobalThis.api={speciesChallengeAvailableAllyIds,validateSpeciesChallengeAllySelection,createSpeciesChallengeRunState,speciesChallengeUnjoinedAllies,simulateSpeciesChallengeJoinWave};`,context);
const {api}=context;
// 種族は主血統。ピクシー種＝ピクシー・ミーア・パンドラの3モンスター。
// 同じモンスター(baseId)は勇者と供モンを通して1体までなので、
// 「別のモンスター」を組み合わせて0〜3体を作る
const masuMons=[{id:101,baseId:'Pixie'},{id:102,baseId:'Mia'},{id:103,baseId:'Pandora'},{id:202,baseId:'Suezo'}];
const unlockedBaseIds=['Pixie','Mia','Pandora','Suezo'];
equal(api.speciesChallengeAvailableAllyIds('pixie',unlockedBaseIds,masuMons),['Pixie','Mia','Pandora','masu:101','masu:102','masu:103'],'選択種族のBase/Masuだけを候補にする');
assert(api.validateSpeciesChallengeAllySelection({speciesId:'pixie',heroId:'Pixie',allyIds:['masu:102','masu:103'],unlockedBaseIds,masuMons}).valid,'Base勇者と同種族の別モンスターMasu複数を許可する');
assert(api.validateSpeciesChallengeAllySelection({speciesId:'pixie',heroId:'masu:101',allyIds:['Mia','masu:103'],unlockedBaseIds,masuMons}).valid,'Masu勇者と同種族の別モンスターBase・Masuを許可する');
assert(!api.validateSpeciesChallengeAllySelection({speciesId:'pixie',heroId:'masu:101',allyIds:['masu:101'],unlockedBaseIds,masuMons}).valid,'勇者本人entryIdを供モンにできない');
assert(!api.validateSpeciesChallengeAllySelection({speciesId:'pixie',heroId:'masu:101',allyIds:['Pixie'],unlockedBaseIds,masuMons}).valid,'勇者と同じモンスターは供モンにできない');
assert(!api.validateSpeciesChallengeAllySelection({speciesId:'pixie',heroId:'Pixie',allyIds:['Mia','masu:102'],unlockedBaseIds,masuMons}).valid,'供モン同士でも同じモンスターは重ねられない');
assert(!api.validateSpeciesChallengeAllySelection({speciesId:'pixie',heroId:'Pixie',allyIds:['Suezo'],unlockedBaseIds,masuMons}).valid,'他種族を拒否する');
// 0〜3体。3体はピクシー種の3モンスターを勇者＋供モンで使い切る形になるので、
// 勇者をマスモンにして残り2モンスターのBase/Masuから3体を選ぶ
for(const allies of [[],['Mia'],['Mia','Pandora'],['Mia','Pandora','masu:103']]){
  const expected=allies.length<=2;
  const made=api.createSpeciesChallengeRunState({speciesId:'pixie',difficultyId:'Expert',heroId:'Pixie',allyIds:allies,unlockedBaseIds,masuMons});
  assert(!!made===expected,`供モン${allies.length}体は${expected?'出撃可能':'同じモンスターの重複で不可'}`);
}
let run=api.createSpeciesChallengeRunState({speciesId:'pixie',heroId:'masu:101',allyIds:['Mia','masu:103'],unlockedBaseIds,masuMons});
for(const id of ['masu:103','Mia']){const result=api.simulateSpeciesChallengeJoinWave(run,id);assert(result.joinedAllyId===id,'残りから任意順で加入できる');run=result.state;}
equal(api.speciesChallengeUnjoinedAllies(run),[],'加入済みを候補から除外する');
// 事前に選んだ順は加入順ではないので、画面へ順番を出さない
assert(source.includes("selected?'選択中':sameMonsterTaken?'選択済み':''")&&!source.includes('`${selectedAllies.indexOf(entry.entryId)+1}番目`'),'事前選択順を表示しない');
console.log('species challenge ally simulation checks passed');
