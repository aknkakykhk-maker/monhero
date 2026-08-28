// 種族チャレンジのWAVE中の供モン合流が、手動でもAUTOでも「出撃前に選んだ供モン」だけに
// 限られていることを確かめる。
//
// 2026年8月に、AUTOバトルだと選んでいない他種族のモンスター(赤カマ)がパーティへ加わる
// 不具合を出した。原因は2つあった。
//   ・AUTOの加入は joinCandidatePool()(＝ふだんの編成)をそのまま候補にしていた
//   ・setupMon が「スロットへ置く → 種族チャレンジの加入判定」の順で、弾いても盤面には残った
// どちらも画面を開くだけでは気づけないので、ここで機械的に見張る。
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(`NG: ${message}`);
  console.log(`OK: ${message}`);
};

// --- AUTOの加入選択そのものを動かす ---
// 候補の合法判定は手動と共有の pickJoinCandidates を通るので、本体の関数をそのまま切り出す
const autoStart = source.indexOf('const joinRosterEntry = (mon) =>');
const autoEnd = source.indexOf('const XP_CURVE_EXPONENT =', autoStart);
assert(autoStart >= 0 && autoEnd > autoStart, 'AUTOの供モン加入helperが存在する');
const context = { console };
vm.createContext(context);
vm.runInContext(`${source.slice(autoStart, autoEnd)}\nglobalThis.api={chooseAutoAllyJoin,pickJoinCandidates};`, context);
const { api } = context;

// モッチー種のランで、事前に選んだ供モンはミタラシだけ。
// AUTO設定には別モードで選んだ「赤カマ」が残っている状態を再現する
const speciesPool = [{ id: 'Mitarashi', masuId: null }];
const setting = { rosterEntry: 'AkaKama', slot: 2 };
const slots = [{ id: 'Mocchi' }, null, null, null];
// スロットも配置先もランダムに選ぶので、何度繰り返しても候補から外れないことを見る
const picked = new Set();
for (let i = 0; i < 30; i++) {
  const choice = api.chooseAutoAllyJoin({ pool: speciesPool, activeMons: [slots[0]], heroId: 'Mocchi', setting, slots });
  picked.add(choice ? choice.mon.id : 'null');
}
assert(picked.size === 1 && picked.has('Mitarashi'), `AUTO設定に残った他種族ではなく事前に選んだ供モンだけを選ぶ(30回: ${[...picked].join(',')})`);
const noCandidate = api.chooseAutoAllyJoin({ pool: [], activeMons: [slots[0]], heroId: 'Mocchi', setting, slots });
assert(noCandidate === null, '候補が空なら加入させずAUTO停止側へ渡す');

// --- 候補の作り方が1か所にまとまっている ---
const poolStart = source.indexOf('const speciesChallengeJoinPool = () =>');
const poolEnd = source.indexOf('const joinOfferSize = () =>', poolStart);
assert(poolStart >= 0 && poolEnd > poolStart, '種族チャレンジ専用の合流候補helperがある');
const pool = source.slice(poolStart, poolEnd);
assert(pool.includes('speciesChallengeUnjoinedAllies(run)'), '合流済みを除いた供モンだけを候補にする');
assert(pool.includes('const speciesPool = speciesChallengeJoinPool();') && pool.includes('if (speciesPool) return speciesPool;'),
  'joinCandidatePoolは種族チャレンジを最優先で返す');
assert(pool.indexOf('if (speciesPool) return speciesPool;') < pool.indexOf('getActiveMonsterList()'),
  '編成やプロモードの候補より先に種族チャレンジを判定する');

// AUTOのPICK_ALLYが、手動と同じ joinCandidatePool() を通っている
const autoPick = source.slice(source.indexOf("if(gameState==='PICK_ALLY'){"), source.indexOf("if(gameState==='PICK_TEACHING'){"));
assert(autoPick.includes('pool:joinCandidatePool(),'), 'AUTOの加入候補もjoinCandidatePool()から取る');
assert(!/pool:\s*getActiveMonsterList\(\)/.test(autoPick), 'AUTOが編成を直接candidateにしない');

// 手動の合流画面も同じhelperを使う
assert(source.includes('const avail=speciesChallengeJoinPool()\n        ||pickJoinCandidates(joinCandidatePool(),activeIds,mainHero?.id,joinOfferSize());'),
  '手動の合流画面も同じhelperから候補を作る');

// --- 弾いた供モンをスロットへ残さない ---
const setupStart = source.indexOf('const setupMon = (m, slotIdx) => {');
const setupEnd = source.indexOf('const handleTraining =', setupStart);
assert(setupStart >= 0 && setupEnd > setupStart, 'setupMonが存在する');
const setup = source.slice(setupStart, setupEnd);
const guardAt = setup.indexOf('if(speciesJoin&&!speciesJoin.joinedAllyId)return;');
const slotAt = setup.indexOf('nextSlots[slotIdx]={...m};');
assert(guardAt >= 0 && slotAt > guardAt, '種族チャレンジの加入判定はスロットへ置く前に行う');
assert(setup.includes('joinSpeciesChallengeAlly(speciesChallengeBattleRunRef.current,joinRosterEntry(m))'), '加入判定は既存helperをそのまま使う');
assert(!setup.includes('const joined=joinSpeciesChallengeAlly'), '加入判定を2回走らせない');

// --- 選択画面が無音にならない ---
// gameStateにBGMの割り当てが無いと bgmKeyForState が null を返し、Audio_.stopBGM() で曲が止まる
const bgmMap = source.slice(source.indexOf('const BGM_STATE_MAP = {'), source.indexOf('const PROFILE_BGM_STATES ='));
assert(/SPECIES_CHALLENGE_SELECT:\s*'enhance'/.test(bgmMap), '種族チャレンジの選択画面はモード選択と同じBGMを続ける');

console.log('種族チャレンジ AUTO合流/選択画面BGM確認: PASS');
