const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const order=['Beginner','Easy','Normal','Hard','Expert','Master','GrandMaster','Hell','Legend'];
let last=-1;for(const key of order){const i=src.indexOf(`${key}:`,src.indexOf('const DIFFICULTY_SETTINGS'));assert(i>last,`${key} の順序`);last=i;}
for(const token of ['snap-mandatory','touchAction:\'pan-y pinch-zoom\'','前の難易度','次の難易度','MY HIGH SCORE','highestWaves[key]','全WAVE詳細','この難易度で挑戦','ENEMY_SEQUENCE.map'])assert(src.includes(token),token);
assert(src.includes('const createBattleEnemy ='));assert(src.includes('const newEnemy=createBattleEnemy(w,difficulty,forcedEnemyKey)'));assert(src.includes('createBattleEnemy(1,key)'));
assert((src.match(/createBattleEnemy\(index\+1,difficulty\)/g)||[]).length===1);
console.log('OK: 9難易度、スワイプ/矢印、記録・敵プレビュー、WAVE1〜10、本番共通生成、挑戦導線を確認');
