// 起動フローの進行不能とタップ領域の退行を、配信用ソースの構造から検出する。
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
const checks = [
  ['音声失敗時にもTITLEへ進む', /音声の成否とは分離[\s\S]{0,160}setBootPhase\('TITLE'\)/.test(source)
    && !/if\s*\(!unlocked\)\s*\{[\s\S]{0,100}return/.test(source)],
  ['タイトル開始領域が全画面', /\.mh-title-start\{[^}]*inset:0[^}]*width:100%[^}]*height:100%/.test(source)],
  ['startGameを同期refで多重実行防止', /if \(titleStartingRef\.current[^\n]+return;[\s\S]{0,80}titleStartingRef\.current = true;/.test(source)],
  ['ゲーム準備と最低演出時間を並列実行', /await Promise\.all\(\[[\s\S]{0,400}prepareGameEntry[\s\S]{0,400}setTimeout\(r, 850\)/.test(source)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
