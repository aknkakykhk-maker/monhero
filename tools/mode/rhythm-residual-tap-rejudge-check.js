#!/usr/bin/env node
'use strict';

// TAP成功後に同じ物理タッチが残ったケースの回帰ガード。
// 目的は高速TAPや両手交互を禁止することではなく、
// 「成功済みTAPの指が微小に残って動いただけ」で別時刻の未来TAPを先食いしないことを守る。
// 実装は monster-hero/src/parts/30-rhythm-play.jsx の inputFeedbackState / inputMoves を対象にする。

const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'..','..');
const game=fs.readFileSync(path.join(ROOT,'monster-hero','src','parts','30-rhythm-play.jsx'),'utf8');
let failed=0;
const ok=(name,cond)=>{console.log(`${cond?'OK':'NG'}: ${name}`);if(!cond)failed++;};

console.log('--- TAP後の残留指フィルタ ---');
ok('TAP成功時の正確なサブレーン座標を保持する',
  /inputFeedbackState\.set\([^;]*subLaneCoordinate/.test(game));
ok('TAP成功後の再判定に微小移動ガードがある',
  /RHYTHM_TAP_REJUDGE_MOVE/.test(game)&&/Math\.abs\([^\n;]*subLaneCoordinate/.test(game));
ok('微小移動では inputStarts を再発火しない分岐がある',
  /RHYTHM_TAP_REJUDGE_MOVE/.test(game)&&/inputMoves=/.test(game)&&/return;/.test(game));
ok('サブレーンを明確に跨いだときの既存再判定経路は残す',
  /if\(state\.empty\)inputStarts\(\[\{lane:Math\.floor\(subLane\/2\),subLaneCoordinate,inputKey\}\]\)/.test(game));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
