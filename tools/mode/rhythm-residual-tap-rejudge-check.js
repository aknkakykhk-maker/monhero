#!/usr/bin/env node
'use strict';

// TAP成功後に同じ物理タッチが残ったケースの回帰ガード。
// 目的は高速TAPや両手交互を禁止することではなく、
// 「成功済みTAPの指が微小に残って動いただけ」で別時刻の未来TAPを先食いしないことを守る。
// 実装は monster-hero/src/parts/30-rhythm-play.jsx の inputFeedbackState / inputMoves を対象にする。

const fs=require('fs');
const path=require('path');
const vm=require('vm');

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

const threshold=Number(game.match(/RHYTHM_TAP_REJUDGE_MOVE_SUBLANES=([\d.]+)/)?.[1]);
const inputMovesSource=game.match(/const inputMoves=\(inputKey,subLaneCoordinate\)=>\{[^\n]+?\};/)?.[0];
const moveCalls=[];
if(Number.isFinite(threshold)&&inputMovesSource){
  const moveContext={runRef:{current:{inputFeedbackState:new Map([['touch:1',{subLane:4,subLaneCoordinate:4.99,empty:true}]])}},inputStarts:inputs=>moveCalls.push(inputs)};
  vm.createContext(moveContext);
  vm.runInContext(`const RHYTHM_TAP_REJUDGE_MOVE_SUBLANES=${threshold};${inputMovesSource}inputMoves('touch:1',5.01);inputMoves('touch:1',5.25);`,moveContext);
}
ok('境界を2%だけ跨ぐ微小揺れは再判定せず、明確な横移動は1回だけ再判定する',
  moveCalls.length===1&&Math.abs(moveCalls[0][0].subLaneCoordinate-5.25)<1e-9);

const rhythm=fs.readFileSync(path.join(ROOT,'monster-hero','data','rhythm-mode.js'),'utf8');
const rhythmContext={};vm.createContext(rhythmContext);vm.runInContext(rhythm,rhythmContext);
const run=code=>vm.runInContext(code,rhythmContext);
const prepareSynthetic=(source='touch:1',keys=['pointer:910001'])=>run(`RHYTHM_TOUCH_SPAN_RUNTIME.clear();${JSON.stringify(keys)}.forEach(key=>{RHYTHM_TOUCH_SPAN_RUNTIME._syntheticTapKeys.add(key);RHYTHM_TOUCH_SPAN_RUNTIME._syntheticTapSources.set(key,${JSON.stringify(source)});});`);
const syntheticMatch=(notes,inputs,now=1000)=>run(`rhythmMatchInputBatch(${JSON.stringify(notes)},${JSON.stringify(inputs)},${now},0).map(result=>result.target&&result.target.index)`);
const tap=(timeMs,subLane,index)=>({type:'TAP',timeMs,subLane,subLaneWidth:1,lane:Math.floor(subLane/2),index,done:false,activePointerId:null});
prepareSynthetic();
run(`RHYTHM_TOUCH_SPAN_RUNTIME.recordPhysicalTarget('touch:1',{type:'TAP',timeMs:1000})`);
ok('中心TAPと同じ物理接触の疑似TAPは88ms先を先食いしない',
  syntheticMatch([tap(1088,5,0)],[{lane:2,subLaneCoordinate:5.5,inputKey:'pointer:910001'}])[0]===null);
ok('中心TAPと同時刻なら接触幅の疑似TAPで取得できる',
  syntheticMatch([tap(1000,5,0)],[{lane:2,subLaneCoordinate:5.5,inputKey:'pointer:910001'}])[0]===0);
prepareSynthetic('touch:2',['pointer:910002','pointer:910003']);
const grouped=syntheticMatch([tap(1000,3,0),tap(1088,5,1)],[
  {lane:1,subLaneCoordinate:3.5,inputKey:'pointer:910002'},
  {lane:2,subLaneCoordinate:5.5,inputKey:'pointer:910003'},
]);
ok('中心に対象が無い接触でも複数の疑似TAPを別時刻へ分散させない',
  grouped[0]===0&&grouped[1]===null);

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
