// 種族チャレンジの編成validationと、WAVE中の供モン加入を確認する。
// 「種族」は主血統なので、同じ血統なら別のモンスターでも一緒に連れていける
// (ピクシー種＝ピクシー・ミーア・パンドラ)。別の血統は拒否する。
const fs=require('fs'),vm=require('vm');
const {installLineageHelpers}=require('./species-challenge-lineage-stub');
const source=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const start=source.indexOf('const speciesChallengeEntryBaseId ='),end=source.indexOf('const SPECIES_CHALLENGE_INITIAL_UNLOCK_COUNT =',start);
const context={console};vm.createContext(context);
installLineageHelpers(vm,context,{source});
vm.runInContext(`${source.slice(start,end)}\nglobalThis.api={speciesChallengeEntryBaseId,speciesChallengeEntryLineageId,validateSpeciesChallengeAllySelection,createSpeciesChallengeRunState,speciesChallengeSelectedAllies,speciesChallengeUnjoinedAllies,joinSpeciesChallengeAlly};`,context);
const api=context.api,assert=(c,m)=>{if(!c)throw new Error(m)},equal=(a,b,m)=>assert(JSON.stringify(a)===JSON.stringify(b),m);
// モッチー種 = Mocchi / Mitarashi、スエゾー種 = Suezo
const unlockedBaseIds=['Mocchi','Mitarashi','Suezo'];
const masuMons=[{id:'hero',baseId:'Mocchi'},{id:'a',baseId:'Mocchi'},{id:'b',baseId:'Mitarashi'},{id:'c',baseId:'Mocchi'},{id:'other',baseId:'Suezo'}];
const validate=allyIds=>api.validateSpeciesChallengeAllySelection({speciesId:'mocchi',heroId:'masu:hero',allyIds,unlockedBaseIds,masuMons});
for(let count=0;count<=3;count++)assert(validate(['Mocchi','masu:a','masu:b'].slice(0,count)).valid,`${count}体の供モン選択は有効である`);
assert(!validate(['Mocchi','masu:a','masu:b','masu:c']).valid,'4体を拒否する');
assert(!validate(['masu:hero']).valid,'勇者本人entryIdを拒否する');
assert(!validate(['Suezo']).valid,'他の種族(スエゾー種)を拒否する');
// 種族＝主血統なので、同じ血統の別モンスターは一緒に使える
assert(api.speciesChallengeEntryLineageId('Mitarashi',masuMons)==='mocchi','ミタラシはモッチー種として扱う');
assert(validate(['Mitarashi']).valid,'同じ種族の別モンスター(ミタラシ)を供モンにできる');
assert(validate(['masu:b']).valid,'同じ種族の別モンスターのマスモンも供モンにできる');
assert(api.validateSpeciesChallengeAllySelection({speciesId:'mocchi',heroId:'Mitarashi',allyIds:['Mocchi'],unlockedBaseIds,masuMons}).valid,'勇者を同じ種族の別モンスターにできる');
const initial=api.createSpeciesChallengeRunState({speciesId:'mocchi',heroId:'masu:hero',allyIds:['Mocchi','masu:a','masu:b'],unlockedBaseIds,masuMons});
equal(api.speciesChallengeSelectedAllies(initial),['Mocchi','masu:a','masu:b'],'選択済み供モンを保持する');
let joined=api.joinSpeciesChallengeAlly(initial,'masu:b');assert(joined.joinedAllyId==='masu:b','残りから任意加入する');
equal(api.speciesChallengeUnjoinedAllies(joined.state),['Mocchi','masu:a'],'加入済みを除外する');
const duplicate=api.joinSpeciesChallengeAlly(joined.state,'masu:b');assert(!duplicate.joinedAllyId&&duplicate.state===joined.state,'二重加入を拒否する');
const empty=api.createSpeciesChallengeRunState({speciesId:'mocchi',heroId:'masu:hero',allyIds:[],unlockedBaseIds,masuMons});assert(!api.joinSpeciesChallengeAlly(empty,'Mocchi').joinedAllyId,'0体は加入なし');
assert(!source.slice(start,end).includes('mh_'),'保存キーを追加しない');
console.log('species challenge run state checks passed');
