// 種族チャレンジの編成validationと、WAVE中の供モン加入を確認する。
// 「種族」は主血統なので、同じ血統なら別のモンスターでも一緒に連れていける
// (ピクシー種＝ピクシー・ミーア・パンドラ)。別の血統は拒否する。
const fs=require('fs'),vm=require('vm');
const {installLineageHelpers}=require('./species-challenge-lineage-stub');
const source=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const start=source.indexOf('const speciesChallengeEntryBaseId ='),end=source.indexOf('const SPECIES_CHALLENGE_INITIAL_UNLOCK_COUNT =',start);
const context={console};vm.createContext(context);
installLineageHelpers(vm,context,{source});
vm.runInContext(`${source.slice(start,end)}\nglobalThis.api={speciesChallengeEntryBaseId,speciesChallengeEntryLineageId,validateSpeciesChallengeAllySelection,speciesChallengeHeroDistance,createSpeciesChallengeRunState,speciesChallengeSelectedAllies,speciesChallengeUnjoinedAllies,joinSpeciesChallengeAlly};`,context);
const api=context.api,assert=(c,m)=>{if(!c)throw new Error(m)},equal=(a,b,m)=>assert(JSON.stringify(a)===JSON.stringify(b),m);
// ピクシー種 = Pixie / Mia / Pandora、スエゾー種 = Suezo。
// 同じモンスター(baseId)は勇者と供モンを通して1体までなので、
// 供モンは「勇者とは別のモンスター」から選ぶ
const unlockedBaseIds=['Pixie','Mia','Pandora','Suezo'];
const masuMons=[{id:'hero',baseId:'Pixie'},{id:'a',baseId:'Mia'},{id:'b',baseId:'Pandora'},{id:'same',baseId:'Pixie'},{id:'other',baseId:'Suezo'}];
const validate=allyIds=>api.validateSpeciesChallengeAllySelection({speciesId:'pixie',heroId:'masu:hero',allyIds,unlockedBaseIds,masuMons});
for(let count=0;count<=2;count++)assert(validate(['Mia','Pandora'].slice(0,count)).valid,`${count}体の供モン選択は有効である`);
assert(!validate(['Mia','Pandora','masu:a']).valid,'同じモンスターが混ざる3体を拒否する');
assert(!validate(['masu:hero']).valid,'勇者本人entryIdを拒否する');
assert(!validate(['Pixie']).valid,'勇者と同じモンスターのベースモンを拒否する');
assert(!validate(['masu:same']).valid,'勇者と同じモンスターの別マスモンも拒否する');
assert(!validate(['Suezo']).valid,'他の種族(スエゾー種)を拒否する');
// 種族＝主血統なので、同じ血統の別モンスターは一緒に使える
assert(api.speciesChallengeEntryLineageId('Mia',masuMons)==='pixie','ミーアはピクシー種として扱う');
assert(validate(['Mia']).valid,'同じ種族の別モンスター(ミーア)を供モンにできる');
assert(validate(['masu:a']).valid,'同じ種族の別モンスターのマスモンも供モンにできる');
assert(api.validateSpeciesChallengeAllySelection({speciesId:'pixie',heroId:'Mia',allyIds:['Pixie'],unlockedBaseIds,masuMons}).valid,'勇者を同じ種族の別モンスターにできる');
const initial=api.createSpeciesChallengeRunState({speciesId:'pixie',heroId:'masu:hero',allyIds:['Mia','masu:b'],unlockedBaseIds,masuMons});
equal(api.speciesChallengeSelectedAllies(initial),['Mia','masu:b'],'選択済み供モンを保持する');
assert(initial.heroDistance===0,'旧helper呼び出しは開始距離欠損時だけ零距離へフォールバックする');
const distanceRuns=[0,1,2,3].map(heroDistance=>api.createSpeciesChallengeRunState({speciesId:'pixie',heroId:'masu:hero',heroDistance,allyIds:['Mia'],unlockedBaseIds,masuMons}));
assert(distanceRuns.every((run,heroDistance)=>run?.heroDistance===heroDistance),'零・壱・弐・参の各開始距離をrunへ保持する');
const distanceRun=distanceRuns[2];
assert(api.joinSpeciesChallengeAlly(distanceRun,'Mia').state.heroDistance===2,'供モン加入後もrunの開始距離2を維持する');
assert(api.createSpeciesChallengeRunState({speciesId:'pixie',heroId:'masu:hero',heroDistance:null,allyIds:[],unlockedBaseIds,masuMons})===null,'通常UIの開始距離未選択(null)ではrunを作らない');
assert(api.createSpeciesChallengeRunState({speciesId:'pixie',heroId:'masu:hero',heroDistance:4,allyIds:[],unlockedBaseIds,masuMons})===null,'4スロット外の開始距離を拒否する');
let joined=api.joinSpeciesChallengeAlly(initial,'masu:b');assert(joined.joinedAllyId==='masu:b','残りから任意加入する');
equal(api.speciesChallengeUnjoinedAllies(joined.state),['Mia'],'加入済みを除外する');
const duplicate=api.joinSpeciesChallengeAlly(joined.state,'masu:b');assert(!duplicate.joinedAllyId&&duplicate.state===joined.state,'二重加入を拒否する');
const empty=api.createSpeciesChallengeRunState({speciesId:'pixie',heroId:'masu:hero',allyIds:[],unlockedBaseIds,masuMons});assert(!api.joinSpeciesChallengeAlly(empty,'Mia').joinedAllyId,'0体は加入なし');
assert(!source.slice(start,end).includes('mh_'),'保存キーを追加しない');
console.log('species challenge run state checks passed');
