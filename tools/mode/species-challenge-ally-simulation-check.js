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
const masuMons=[{id:101,baseId:'Mocchi'},{id:102,baseId:'Mocchi'},{id:202,baseId:'Suezo'}];
const unlockedBaseIds=['Mocchi','Suezo'];
equal(api.speciesChallengeAvailableAllyIds('mocchi',unlockedBaseIds,masuMons),['Mocchi','masu:101','masu:102'],'選択種族のBase/Masuだけを候補にする');
assert(api.validateSpeciesChallengeAllySelection({speciesId:'mocchi',heroId:'Mocchi',allyIds:['masu:101','masu:102'],unlockedBaseIds,masuMons}).valid,'Base勇者と同種族の別Masu複数を許可する');
assert(api.validateSpeciesChallengeAllySelection({speciesId:'mocchi',heroId:'masu:101',allyIds:['Mocchi','masu:102'],unlockedBaseIds,masuMons}).valid,'Masu勇者と同種Base・別Masuを許可する');
assert(!api.validateSpeciesChallengeAllySelection({speciesId:'mocchi',heroId:'masu:101',allyIds:['masu:101'],unlockedBaseIds,masuMons}).valid,'勇者本人entryIdを供モンにできない');
assert(!api.validateSpeciesChallengeAllySelection({speciesId:'mocchi',heroId:'Mocchi',allyIds:['Suezo'],unlockedBaseIds,masuMons}).valid,'他種族を拒否する');
for(let count=0;count<=3;count++){const ids=['masu:101','masu:102'].slice(0,count);if(count===3)ids.push('Mocchi');const hero=count===3?'masu:101':'Mocchi';const allies=count===3?['Mocchi','masu:102']:ids;assert(api.createSpeciesChallengeRunState({speciesId:'mocchi',difficultyId:'Expert',heroId:hero,allyIds:allies,unlockedBaseIds,masuMons}),`${count}体で出撃可能`);}
let run=api.createSpeciesChallengeRunState({speciesId:'mocchi',heroId:'masu:101',allyIds:['Mocchi','masu:102'],unlockedBaseIds,masuMons});
for(const id of ['masu:102','Mocchi']){const result=api.simulateSpeciesChallengeJoinWave(run,id);assert(result.joinedAllyId===id,'残りから任意順で加入できる');run=result.state;}
equal(api.speciesChallengeUnjoinedAllies(run),[],'加入済みを候補から除外する');
assert(source.includes("selected?'選択中':''")&&!source.includes('`${selectedAllies.indexOf(entry.entryId)+1}番目`'),'事前選択順を表示しない');
console.log('species challenge ally simulation checks passed');
