const fs = require('fs');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
};

const start = source.slice(source.indexOf('const startSpeciesChallengeBattle ='), source.indexOf('const createRepeatRunTemplate ='));
assert(start.includes('resolveRosterEntryToMon(run.heroId)'), 'Base/Masu勇者を共通roster resolverで解決する');
assert(start.includes('speciesChallengeBattleRunRef.current=run'), 'createSpeciesChallengeRunStateのrunを実戦状態に保持する');
assert(start.includes("setDifficulty(extremeSetting?'Normal':run.difficultyId)"), '通常難易度IDを既存バトル難易度へ渡す');
assert(start.includes('extremeRuleSetting(run.difficultyId)') && start.includes('setExtremeDifficulty(extremeSetting.id)'), '極限5難易度を既存設定へ渡す');
// 勇者モンの配置距離は他モードとまったく同じ PICK_SLOT で選ぶ。
// 以前はここで initialBattleDistanceRef.current=0 と slots[0] を決め打ちしており、
// 種族チャレンジだけ必ず零距離スタートになっていた(他モードは距離を選べる)。
// 距離を決め打ちに戻すと以下の2つが同時に落ちる
assert(start.includes("setGameState('PICK_SLOT')") && start.includes('setCurrentPickingMon(hero)'),
  '勇者モンの配置距離は他モードと同じPICK_SLOTで選ばせる');
// 「もう書いていないこと」を見る検査は、説明のコメントに書いた同じ文字列へ反応してしまう。
// 実際に動くコードだけを見たいので、行コメントを落としてから判定する
const stripLineComments = (text) => text.split('\n').map(line => line.replace(/\/\/.*$/, '')).join('\n');
const startCode = stripLineComments(start);
assert(!/initialBattleDistanceRef\.current\s*=\s*0/.test(startCode) && !/const initialSlots=\[\{\.\.\.hero\}/.test(startCode),
  '出撃時に距離0・スロット0を決め打ちしない');
// PICK_SLOT で置いたあとは setupMon が距離を確定してアシストカード選択へ合流する
const setupHero = source.slice(source.indexOf('const setupMon ='), source.indexOf('// 「この編成で開始」'));
assert(setupHero.includes('initialBattleDistanceRef.current=slotIdx') && setupHero.includes("setGameState('PICK_TEACHING')"),
  '選んだ距離をそのまま初期距離にして、既存のアシストカード選択からWAVE1へ合流する');
// 種族チャレンジは通常の勇者選択(PICK_HERO)を持たないので、PICK_SLOTの選び直しは選択画面へ戻す
assert(source.includes("if(!mainHero&&speciesChallengeBattleRunRef.current){") && source.includes("setSpeciesChallengeSelection(current=>({...current,step:'confirm'}));"),
  'PICK_SLOTの選び直しは通常のPICK_HEROではなく種族チャレンジの編成画面へ戻す');

const nextWave = source.slice(source.indexOf('const handleNextWave ='), source.indexOf('// ===== クイックモード'));
assert(nextWave.includes('!speciesChallengeBattleRunRef.current'), '通常デバッグ戦の1WAVE終了を種族チャレンジには適用しない');
assert(nextWave.includes("setDebugOutcome('win')"), 'WAVE10勝利は保存処理の前でデバッグ結果へ移る');

const training = source.slice(source.indexOf('const handleTraining ='), source.indexOf('// UPGRADE_SKILL画面'));
// 候補の作り方は speciesChallengeJoinPool() に1本化してある(AUTOの自動加入と共有するため)。
// 詳しい中身は tools/mode/species-challenge-auto-join-check.js で見ている
const joinPool = source.slice(source.indexOf('const speciesChallengeJoinPool = () =>'), source.indexOf('const joinOfferSize = () =>'));
assert(joinPool.includes('speciesChallengeUnjoinedAllies(run).map(resolveRosterEntryToMon)'), 'WAVE2/4/6候補はSTEP1D未加入helperとBase/Masu resolverを使う');
assert(training.includes('const avail=speciesChallengeJoinPool()'), 'WAVE2/4/6の供モン選択はその共通helperから候補を作る');
assert(training.includes('joinWaves.includes(wave)') && training.includes("setGameState('PICK_ALLY')"), '候補がある加入WAVEだけ既存供モン選択UIを出す');
assert(training.includes('initBattle(wave+1,slots,ownedUniques,ownedTeachings,nDef)'), '候補なしでも既存の次WAVE開始へ進む');

const setup = source.slice(source.indexOf('const setupMon ='), source.indexOf('// 「この編成で開始」'));
assert(setup.includes('joinSpeciesChallengeAlly(speciesChallengeBattleRunRef.current,joinRosterEntry(m))'), '加入確定はSTEP1D helperを再利用して二重加入を防ぐ');
assert(setup.indexOf('joinSpeciesChallengeAlly') < setup.indexOf("const bonus=m.plusStats||{}"), '実加入が成立した場合だけ既存加入ボーナスを適用する');

assert(source.includes('if (w === 1 && !forcedEnemyKey && !debugBattleRef.current)'), 'デバッグ実戦では助手・ミッションを含む保存進行を抑止する');
// 保存なし確認のデバッグ表示・本番のCHAMPION・敗北/リタイアの「再挑戦」の3つとも、
// 通常のPICK_HEROではなく種族チャレンジの選択画面へ戻す(保存する/しないも引き継ぐ)
assert(source.includes('speciesChallengeBattleRun?<button') && source.includes('openSpeciesChallengeSelection({saveProgress:keepSaving,fromDebug:keepDebug});'), '保存なし確認のリザルトから種族チャレンジ選択へ戻る');
assert(source.includes('data-species-champion-back') && source.includes('openSpeciesChallengeSelection({saveProgress:keepSaving,fromDebug:keepDebug});'), '本番のCHAMPIONからも種族チャレンジ選択へ戻れる');
const retryFn = source.slice(source.indexOf('const handleRetry = () => {'), source.indexOf('const runResultActionOnce ='));
assert(retryFn.includes('if (speciesChallengeBattleRunRef.current) {')
  && retryFn.indexOf('openSpeciesChallengeSelection({ saveProgress: keepSaving, fromDebug: keepDebug });') < retryFn.indexOf("setGameState('PICK_HERO')"), '敗北・リタイアの再挑戦は通常のPICK_HEROへ落ちない');
assert(source.includes('...((SPECIES_CHALLENGE_PUBLIC_RELEASE||debugBattle)?[SPECIES_CHALLENGE_MODE]:[])') && !source.slice(source.indexOf('const BATTLE_MODES = ['), source.indexOf('// 極限チャレンジは通常')).includes('BATTLE_MODE_SPECIES_CHALLENGE'), '共通BATTLE MODEへ入口を出す(公開前はデバッグのときだけ)');
// 公開の切り替えは1か所だけ。公開後は true のまま(false へ戻すと、
// すでに遊んだ人の全国ランキングだけが止まる)
assert(/const SPECIES_CHALLENGE_PUBLIC_RELEASE = true;/.test(source), '一般公開フラグはtrue(公開済み)');
assert(source.includes("mode !== BATTLE_MODE_SPECIES_CHALLENGE || SPECIES_CHALLENGE_PUBLIC_RELEASE"), '公開フラグを見てからランキングへ送る');
assert(!source.includes('grantSpeciesChallengeFirstClearReward') && !source.includes('species_challenge_ranking'), '進行報酬・ランキングは既存の共通処理だけを使う(専用の保存を書かない)');

console.log('種族チャレンジSTEP5B実バトル接続確認: PASS');
