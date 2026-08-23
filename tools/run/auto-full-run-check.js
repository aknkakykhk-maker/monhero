const fs = require('fs');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
let failed = false;
const check = (label, condition) => {
  console.log(`${condition ? 'OK' : 'NG'}: ${label}`);
  if (!condition) failed = true;
};
const grab = (from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  return start >= 0 && end > start ? source.slice(start, end) : '';
};

const controller = grab('// AUTO中にWAVE後の画面へ入ったときだけ', '\n  const upgradeUnique =');
const finalizer = grab('const handleNextWave = async () => {', '\n  // ===== クイックモード: WAVEごとの自動成長');

check('既存のpost-wave同期ロックを使う',
  controller.includes('autoPostWaveRunningRef.current') && controller.includes('autoPostWaveScheduledRef.current'));
check('WAVE_RESULTで既存handleNextWaveを呼ぶ',
  controller.includes("if(gameState==='WAVE_RESULT') handleNextWave();"));
check('QUICK_GROWTHで既存finishQuickGrowthを呼ぶ',
  controller.includes("else if(gameState==='QUICK_GROWTH') finishQuickGrowth();"));
check('QUICK_JOINで既存finishQuickJoinを呼ぶ',
  controller.includes('else finishQuickJoin();'));
check('AUTO OFFなら予約もhandler実行もしない',
  (controller.match(/if\(!autoBattleRef\.current\)return;/g) || []).length >= 3
    && controller.includes('if(!autoBattleRef.current||autoPostWaveRunningRef.current)return;'));
check('追加3画面も画面遷移ごとにロックをリセットする',
  controller.includes("if(gameState==='WAVE_RESULT'||gameState==='QUICK_GROWTH'||gameState==='QUICK_JOIN')")
    && controller.includes('autoPostWaveRunningRef.current=false;'));
check('AUTO controllerはWAVE・Quickの計算や直接遷移を再実装しない',
  !/setWave\(|setGameState\(|awardRunRewards|recordClearOnce|resolveQuickGrowthStats|quickGrowStat/.test(controller));
check('既存の4画面のAUTO対象を維持する',
  ['REWARD_PICK', 'PICK_ALLY', 'PICK_TEACHING', 'UPGRADE_SKILL'].every(state => controller.includes(`'${state}'`)));
check('WAVE10はAUTO停止後に既存の終了ロック・報酬・記録・CHAMPIONを通る',
  finalizer.includes('stopAutoBattle();')
    && finalizer.indexOf('runFinalizingRef.current = true;') < finalizer.indexOf('await awardRunRewards(10);')
    && finalizer.indexOf('await awardRunRewards(10);') < finalizer.indexOf('await recordClearOnce();')
    && finalizer.indexOf('await recordClearOnce();') < finalizer.indexOf("setGameState('CHAMPION');")
    && finalizer.indexOf("setGameState('CHAMPION');") < finalizer.indexOf('await submitRunScoreOnce();'));
check('AUTO controllerから自動Retry・マスモン登録を実行しない',
  !/retry|returnToHome|register|masu/i.test(controller));

if (failed) process.exit(1);
console.log('AUTO 1周完走チェック: すべてOK');
