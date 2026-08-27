const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const start = source.indexOf('const speciesChallengeEntryBaseId =');
const end = source.indexOf('const SPECIES_CHALLENGE_INITIAL_UNLOCK_COUNT =', start);
if (start < 0 || end < 0) throw new Error('種族チャレンジの一時ラン状態処理が見つかりません');

const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.api={
  speciesChallengeEntryBaseId,speciesChallengeAvailableAllyIds,validateSpeciesChallengeAllySelection,
  createSpeciesChallengeRunState,speciesChallengeSelectedAllies,speciesChallengeUnjoinedAllies,
  joinSpeciesChallengeAlly,
};`, context);
const api = context.api;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (actual, expected, message) => assert(JSON.stringify(actual) === JSON.stringify(expected), message);
const unlockedBaseIds = ['Hero', 'Slime', 'Dragon', 'Golem', 'Beast'];
const masuMons = [
  { id:'slime-1', baseId:'Slime' },
  { id:202, baseId:'Dragon' },
  { id:'beast-1', baseId:'Beast' },
];
const validate = allyIds => api.validateSpeciesChallengeAllySelection({ heroId:'Hero', allyIds, unlockedBaseIds, masuMons });

for (let count = 0; count <= 3; count++) {
  const choices = ['Slime', 'masu:202', 'Golem'].slice(0, count);
  assert(validate(choices).valid, `${count}体の供モン選択は有効である`);
}
assert(!validate(['Slime', 'Dragon', 'Golem', 'Beast']).valid, '4体の供モン選択を拒否する');
assert(!api.validateSpeciesChallengeAllySelection({ heroId:'Hero', allyIds:['masu:hero-1'], unlockedBaseIds, masuMons:[...masuMons, {id:'hero-1',baseId:'Hero'}] }).valid, '勇者モンと同種のマスモンを拒否する');
assert(!validate(['Slime', 'masu:slime-1']).valid, 'ベースモンと同種のマスモンを重複として拒否する');
assert(api.speciesChallengeEntryBaseId('masu:202', masuMons) === 'Dragon', 'マスモン安定IDからbaseIdを解決する');

const initial = api.createSpeciesChallengeRunState({ heroId:'Hero', allyIds:['Slime', 'masu:202', 'Golem'], unlockedBaseIds, masuMons });
equal(api.speciesChallengeSelectedAllies(initial), ['Slime', 'masu:202', 'Golem'], '選択済み供モンを選択順で返す');
const dragonFirst = api.joinSpeciesChallengeAlly(initial, 'masu:202');
assert(dragonFirst.joinedAllyId === 'masu:202', '残り候補から任意の1体を加入させる');
equal(api.speciesChallengeUnjoinedAllies(dragonFirst.state), ['Slime', 'Golem'], '1体加入後は未加入が2体になる');
const golemSecond = api.joinSpeciesChallengeAlly(dragonFirst.state, 'Golem');
equal(golemSecond.state.joinedAllyIds, ['masu:202', 'Golem'], '加入順を固定せず選択順を記録する');
const duplicate = api.joinSpeciesChallengeAlly(golemSecond.state, 'masu:202');
assert(duplicate.joinedAllyId === null && duplicate.state === golemSecond.state, '同じ個体を二重加入させない');
const allJoined = api.joinSpeciesChallengeAlly(golemSecond.state, 'Slime');
assert(api.joinSpeciesChallengeAlly(allJoined.state, 'Golem').joinedAllyId === null, '全員加入後は加入なしを返す');
const empty = api.createSpeciesChallengeRunState({ heroId:'Hero', allyIds:[], unlockedBaseIds, masuMons });
assert(api.joinSpeciesChallengeAlly(empty, 'Slime').joinedAllyId === null, '供モン0体は加入なしを返す');
assert(!source.slice(start, end).includes('mh_'), '一時ラン状態用の保存キーを追加していない');

console.log('species challenge run state checks passed');
