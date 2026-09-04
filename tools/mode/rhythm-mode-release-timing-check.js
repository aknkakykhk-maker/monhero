#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
const prefix=source.split('const emptyRhythmChart',1)[0];
let now=0,rafCb=null;
const context={console,performance:{now:()=>now},requestAnimationFrame:cb=>{rafCb=cb;return 1;},cancelAnimationFrame:()=>{rafCb=null;}};
vm.createContext(context);
vm.runInContext(prefix+'\nthis.out={RHYTHM_GESTURE_RUNTIME,rhythmJudgeRelease,rhythmWorseJudgment};',context);
const {RHYTHM_GESTURE_RUNTIME:runtime,rhythmJudgeRelease,rhythmWorseJudgment}=context.out;
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
for(const [delta,expected] of [[0,'MARVELOUS'],[55,'MARVELOUS'],[56,'EXCELLENT'],[100,'EXCELLENT'],[101,'GREAT'],[150,'GREAT'],[151,'GOOD'],[200,'GOOD'],[201,'BAD'],[240,'BAD'],[241,'MISS'],[-241,'MISS']])check(`終端 ${delta}ms => ${expected}`,rhythmJudgeRelease(delta)===expected);
check('開始と終了の悪い方を採用',rhythmWorseJudgment('MARVELOUS','GOOD')==='GOOD'&&rhythmWorseJudgment('GREAT','EXCELLENT')==='GREAT');
const fresh=(kind='HOLD',startJudgment='MARVELOUS',startDelta=0)=>{runtime.clear();now=0;rafCb=null;const note={type:kind,timeMs:1000,endTimeMs:2000,lane:0,done:false,holdJudgment:null,holdDeltaMs:0,index:0};runtime.bind('touch:1',note,kind,1000,0);note.holdJudgment=startJudgment;note.holdDeltaMs=startDelta;return note;};
let note=fresh();now=1000;runtime.release('touch:1');check('HOLDは終端ちょうどでMARVELOUS',note.holdJudgment==='MARVELOUS'&&note._rhythmReleaseDeltaMs===0);
// 判定窓を広げたので、GOODになる遅れも変わる(+150msは今はGREAT)。
note=fresh('HOLD','MARVELOUS');now=1180;runtime.release('touch:1');check('HOLD終端+180msはGOOD',note.holdJudgment==='GOOD');
note=fresh('HOLD','GREAT',80);now=1000;runtime.release('touch:1');check('開始GREAT/終了MARVELOUSはGREAT',note.holdJudgment==='GREAT'&&note.holdDeltaMs===80);
note=fresh();now=709;runtime.release('touch:1');check('240msより早い離しはMISS',note.holdJudgment==='MISS');
note=fresh();now=1241;runtime.release('touch:1');check('240msより遅い離しはMISS',note.holdJudgment==='MISS');
note=fresh();now=1000;runtime.release('touch:1',true);check('touchcancel/pointercancelはMISS',note.holdJudgment==='MISS');
note=fresh();now=1090;let cb=rafCb;cb&&cb();check('終端100ms前から旧自動成功を+241msへ延期',note.endTimeMs===2241);
now=1220;cb=rafCb;cb&&cb();check('押しっぱなしは+240ms到達前にMISSガード',note.holdJudgment==='MISS');
now=1180;runtime.release('touch:1');check('MISSガード後でも+180msで離せばGOODへ確定',note.holdJudgment==='GOOD');
note=fresh('SLIDE');const session=[...runtime._sessions.values()][0];session.failed=true;now=1000;runtime.release('touch:1');check('SLIDE途中追従失敗は終端が合ってもMISS',note.holdJudgment==='MISS');
check('HOLDもruntimeへbindする',source.includes("originalType==='HOLD'||originalType==='FLICK'||originalType==='SLIDE'"));
check('旧本体はruntimeが作ったholdJudgmentを1回だけ適用',game.includes("applyJudgment(note,note.holdJudgment||'MISS',note.holdDeltaMs||0)"));
// 受付の広さは 2026-09-05 に判定表から作るようにした(RHYTHM_INPUT_MATCH_WINDOW_MS)。
// 数字を直接書かないので、見張るのは「判定表のいちばん外側を使っている」ことにする。
check('TAP/FLICKの開始判定条件は変更しない',
  source.includes("RHYTHM_NOTE_TYPES.includes(note.type)")
  &&source.includes("tapOnly&&note.type!=='TAP'")
  &&source.includes("const timeDistance=Math.abs(now-(Number(note.timeMs)+offset));")
  &&source.includes("timeDistance<=RHYTHM_INPUT_MATCH_WINDOW_MS")
  &&!/timeDistance<=\d/.test(source));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
