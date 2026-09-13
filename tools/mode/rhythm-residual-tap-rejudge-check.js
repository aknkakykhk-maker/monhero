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
  /if\(state\.empty\)inputStarts\(\[\{lane:Math\.floor\(subLane\/2\),subLaneCoordinate,inputKey,rejudge:true\}\]\)/.test(game));

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


// 【2026-09-13・両手の高速タップでミスが出る】
// 鍵(syntheticTargetTime)が無いのは「中心の指が何も取れなかった」とき。
// それまでは時刻の制限がまるごと外れ、最大170ms先(16分なら2つ先)のノーツまで取れていた。
// 取られたノーツは本来の時刻には既に done なので、そこを叩いても何も起きず見逃しMISSになる。
// 両手だと「片方が先に取ったので、もう片方は行き先が無い」が頻繁に起きるぶん目立っていた。
console.log('\n--- 鍵が無い疑似TAPの届く範囲 ---');
const noLock=(noteTimeMs,now)=>{
  prepareSynthetic();
  run(`RHYTHM_TOUCH_SPAN_RUNTIME.recordPhysicalTarget('touch:1',null)`);
  return syntheticMatch([tap(noteTimeMs,5,0)],[{lane:2,subLaneCoordinate:5.5,inputKey:'pointer:910001'}],now)[0]===0;
};
ok('中心が位置で外れたノーツは、同時刻なら接触幅で拾える(本来の役目)',noLock(1000,1000));
ok('遅れて叩いたぶんも拾える(30ms/150ms)',noLock(1000,1030)&&noLock(1000,1150));
ok('窓の内側の早押しも拾える(40ms前)',noLock(1000,960));
ok('これから来るノーツへは手を伸ばさない(56ms先・88ms先)',!noLock(1056,1000)&&!noLock(1088,1000));
ok('170ms先(16分で2つ先)を先食いしない',!noLock(1170,1000));


// 【2026-09-13・両手の交互高速タップでだけミスが出る】
// TAPに成功した指も inputFeedbackState の empty は true(TAPは何も押さえ続けないため)。
// その指が残ったままずれて別のサブレーンへ入ると inputMoves がもう一度タップを発火する。
// これは「レーンを滑って続けて叩く」ための機能だが、まだ来ていないノーツを最大170ms先まで
// 先に食べていた。消えたノーツは本来の時刻にはもう無いので、そこを叩いた手が空振りになる。
// 両手の交互連打は、叩いたばかりの指が残ったまま転がるので、これがいちばん出やすい。
console.log('\n--- 滑って再発火したタップの届く範囲 ---');
{
  const play=require('fs').readFileSync(require('path').join(ROOT,'monster-hero','src','parts','30-rhythm-play.jsx'),'utf8');
  ok('滑って再発火した入力には目印(rejudge)が付く',
    /inputStarts\(\[\{lane:Math\.floor\(subLane\/2\),subLaneCoordinate,inputKey,rejudge:true\}\]\)/.test(play));
  const note=(timeMs,subLane,index)=>({type:'TAP',timeMs,subLane,subLaneWidth:2,lane:Math.floor(subLane/2),index,done:false,activePointerId:null});
  const hit=(noteTimeMs,now,rejudge)=>run(`rhythmMatchInputBatch(${JSON.stringify([note(noteTimeMs,4,0)])},`
    +`${JSON.stringify([{lane:2,subLaneCoordinate:5,inputKey:'touch:9',...(rejudge?{rejudge:true}:{})}])},${now},0)`
    +`.map(r=>r.target?r.target.index:null)`)[0]===0;
  ok('滑って叩いた先に「いま」のノーツがあれば取れる(本来の役目)',hit(1000,1000,true));
  ok('遅れて滑ったぶんも取れる(100ms/170ms遅れ)',hit(1000,1100,true)&&hit(1000,1170,true));
  ok('わずかに早い滑り(28ms前)は取れる',hit(1028,1000,true));
  ok('88ms先(16分で1つ先)のノーツは先食いしない',!hit(1088,1000,true));
  ok('170ms先(16分で2つ先)も先食いしない',!hit(1170,1000,true));
  ok('ふつうの初回タップの早押し範囲は変えていない(88ms先は取れる)',hit(1088,1000,false));
}
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
