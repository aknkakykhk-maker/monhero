const fs=require('fs');
const path=require('path');
const vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'..','..','monster-hero','data','rhythm-mode.js'),'utf8');
const context={console,performance};
vm.createContext(context);
vm.runInContext(`${source}\n;globalThis.__rhythmGestureTest={RHYTHM_SONGS,RHYTHM_NOTE_TYPES,rhythmMatchInputBatch,RHYTHM_GESTURE_RUNTIME,rhythmSlideExpectedLane};`,context);
const api=context.__rhythmGestureTest;
const hard=api.RHYTHM_SONGS[0].difficulties.HARD;
const fail=[];
const ok=(name,value)=>{console.log(`${value?'OK':'NG'}: ${name}`);if(!value)fail.push(name);};
ok('4ノーツ種別を正式定義', ['TAP','HOLD','FLICK','SLIDE'].every(type=>api.RHYTHM_NOTE_TYPES.includes(type)));
ok('HARDに4種混在テスト譜面', ['TAP','HOLD','FLICK','SLIDE'].every(type=>hard.notes.some(note=>note.type===type)));
ok('EASY/NORMALは既存テストを維持', api.RHYTHM_SONGS[0].difficulties.EASY.notes.every(note=>note.type==='TAP')&&api.RHYTHM_SONGS[0].difficulties.NORMAL.notes.some(note=>note.type==='HOLD'));
// データ側からHUDの表記を'MIX TEST'へ書き換えるのはやめた。
// FLICK/SLIDEを含む譜面ならいつでも書き換えていたので、体験版から入ったプレイヤーの
// 画面にも「MIX TEST」と出ていた(2026-09-05・実機の指摘「ここがデバッグのままになってる」)。
// 表記はReact側が譜面から決める(tools/mode/rhythm-player-screen-debug-check.js が見張る)
ok('データ側からHUDの表記を書き換えていない', !source.includes("label.textContent='MIX TEST'"));
const runtime=()=>hard.notes.map((note,index)=>({...note,index,done:false,activePointerId:null,holdJudgment:null,holdDeltaMs:0}));
let notes=runtime();
api.RHYTHM_GESTURE_RUNTIME.record('touch:1',10,10);
const flick=api.rhythmMatchInputBatch(notes,[{lane:0,inputKey:'touch:1'}],2600,0)[0];
ok('FLICKは入力開始後だけHOLDライフサイクルへ接続', flick.target?._rhythmGestureType==='FLICK'&&flick.target.type==='HOLD'&&flick.target.endTimeMs>flick.target.timeMs+10000);
flick.target.holdJudgment='MARVELOUS';
api.RHYTHM_GESTURE_RUNTIME.record('touch:1',40,10);
ok('24px以上のフリックで完了予約', flick.target._rhythmGestureDone===true&&flick.target.endTimeMs<flick.target.timeMs+10000);
api.RHYTHM_GESTURE_RUNTIME.clear();
notes=runtime();
const two=api.rhythmMatchInputBatch(notes,[{lane:0,inputKey:'touch:2'},{lane:4,inputKey:'touch:3'}],13200,0);
ok('同時FLICKを別ノーツへ割当', two.length===2&&two.every(item=>item.target?._rhythmGestureType==='FLICK')&&two[0].target!==two[1].target);
api.RHYTHM_GESTURE_RUNTIME.clear();
notes=runtime();
const slide=api.rhythmMatchInputBatch(notes,[{lane:0,inputKey:'touch:4'}],6400,0)[0];
ok('SLIDEも1ノーツのHOLDライフサイクルへ接続', slide.target?._rhythmGestureType==='SLIDE'&&slide.target.type==='HOLD'&&slide.target.endTimeMs===8000);
ok('SLIDE中間点を線形補間', Math.abs(api.rhythmSlideExpectedLane(hard.notes.find(note=>note.type==='SLIDE'),7200)-1)<1e-9);
ok('1 authored note = 1 scoring unit', hard.totalNotes===hard.notes.length);
if(fail.length){console.error(`STEP 3B check failed: ${fail.join(' / ')}`);process.exit(1);}
console.log('OK: rhythm STEP 3B FLICK/SLIDE check');
