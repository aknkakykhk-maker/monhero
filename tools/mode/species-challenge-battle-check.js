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
assert(start.includes("setGameState('PICK_TEACHING')"), '既存のアシストカード選択からWAVE1へ合流する');

const nextWave = source.slice(source.indexOf('const handleNextWave ='), source.indexOf('// ===== クイックモード'));
assert(nextWave.includes('!speciesChallengeBattleRunRef.current'), '通常デバッグ戦の1WAVE終了を種族チャレンジには適用しない');
assert(nextWave.includes("setDebugOutcome('win')"), 'WAVE10勝利は保存処理の前でデバッグ結果へ移る');

const training = source.slice(source.indexOf('const handleTraining ='), source.indexOf('// UPGRADE_SKILL画面'));
assert(training.includes('speciesChallengeUnjoinedAllies(speciesRun).map(resolveRosterEntryToMon)'), 'WAVE2/4/6候補はSTEP1D未加入helperとBase/Masu resolverを使う');
assert(training.includes('joinWaves.includes(wave)') && training.includes("setGameState('PICK_ALLY')"), '候補がある加入WAVEだけ既存供モン選択UIを出す');
assert(training.includes('initBattle(wave+1,slots,ownedUniques,ownedTeachings,nDef)'), '候補なしでも既存の次WAVE開始へ進む');

const setup = source.slice(source.indexOf('const setupMon ='), source.indexOf('// 「この編成で開始」'));
assert(setup.includes('joinSpeciesChallengeAlly(speciesChallengeBattleRunRef.current,joinRosterEntry(m))'), '加入確定はSTEP1D helperを再利用して二重加入を防ぐ');
assert(setup.indexOf('joinSpeciesChallengeAlly') < setup.indexOf("const bonus=m.plusStats||{}"), '実加入が成立した場合だけ既存加入ボーナスを適用する');

assert(source.includes('if (w === 1 && !forcedEnemyKey && !debugBattleRef.current)'), 'デバッグ実戦では助手・ミッションを含む保存進行を抑止する');
assert(source.includes('speciesChallengeBattleRun?<button') && source.includes('openSpeciesChallengeSelection();'), '勝敗・リタイア後は種族チャレンジ選択へ戻る');
assert(!source.slice(source.indexOf('const BATTLE_MODES'), source.indexOf('const BATTLE_DEFAULT_MODE')).includes('BATTLE_MODE_SPECIES_CHALLENGE'), '本番BATTLE MODEには入口を追加しない');
assert(!source.includes('grantSpeciesChallengeFirstClearReward') && !source.includes('species_challenge_ranking'), '進行報酬・ランキング保存を接続しない');

console.log('種族チャレンジSTEP5B実バトル接続確認: PASS');
