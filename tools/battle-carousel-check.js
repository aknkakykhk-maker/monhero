const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const order=['Beginner','Easy','Normal','Hard','Expert','Master','GrandMaster','Hell','Legend'];
let last=-1;for(const key of order){const i=src.indexOf(`${key}:`,src.indexOf('const DIFFICULTY_SETTINGS'));assert(i>last,`${key} の順序`);last=i;}
for(const token of ['snap-mandatory','touchAction:\'pan-x pinch-zoom\'','flex items-start gap-2.5 overflow-x-auto overflow-y-hidden','relative shrink-0','前の難易度','次の難易度','自己ベストスコア','最高到達 WAVE','全WAVE詳細','この難易度で挑戦','ENEMY_SEQUENCE.map'])assert(src.includes(token),token);
assert(src.includes('const createBattleEnemy ='));assert(src.includes('const newEnemy=createBattleEnemy(w,difficulty,forcedEnemyKey,extremeRunRef.current?EXTREME_SETTING.power:null)'));
// WAVE1の敵情報は難易度カードから外し、「全WAVE詳細」でだけ見せる(カードを縦に縮めるため)
assert(!src.includes('createBattleEnemy(1,key)'),'難易度カードにWAVE1の敵情報を戻していないこと');
// モードのタブと、チャレンジのときだけ出るランキングボタン
for(const token of ['const BATTLE_MODES = [','setBattleMode(mode.id)','🏆 ランキングを見る（チャレンジモード）','battleModeInfo(runMode)'])assert(src.includes(token),token);
assert(src.includes("ChevronLeft: '<polyline"),'ChevronLeft のSVGパス');
assert(src.includes("ChevronLeft=_icon('ChevronLeft')"),'ChevronLeft のコンポーネント定義');
assert(src.includes("const normalizeBattleDifficulty ="),'難易度の正規化');
assert(src.includes("? value : 'Normal'"),'不正な難易度のNormalフォールバック');
for(const token of ["name:base?.name || '敵データ未設定'","imgUrl:base?.imgUrl || ''","emoji:base?.emoji || '❓'",'Math.max(1, Number(base.baseHp))','Math.max(0, Number(base.baseAtk))'])assert(src.includes(token),`敵フォールバック: ${token}`);
assert((src.match(/createBattleEnemy\(index\+1,waveDifficulty,null,powerOverride\)/g)||[]).length===1);
assert(src.includes("BATTLE_MENU: 'enhance'"),'難易度画面のBGM');
assert(src.includes("if (state === 'BATTLE')"),'実バトルのBGM切替');
assert(src.includes("setGameState('HOME');"),'HOMEへ戻る導線');
console.log('OK: 9難易度、アイコン定義、スワイプ/矢印、敵・難易度フォールバック、WAVE1〜10、BGM、戻る・挑戦導線を確認');
