#!/usr/bin/env node
// 操作性のシナリオ検査。本番の入力関数(rhythmMatchInputBatch / RHYTHM_GESTURE_RUNTIME /
// rhythmJudgeReleaseLenient / rhythmInputAgeMs)を Node 上でそのまま動かし、
// 「指→対象ノーツ→判定」がプレイヤーの自然な操作で通ることを1つの表で確かめる。
//
//   node tools/mode/rhythm-input-scenario-check.js
//
// 【なぜ要るか】(2026-09-07)
// 入力の検査はこれまで、タップの取り合い(tap-target)・持ち替え(finger-swap)・終端(release-timing)…と
// 場面ごとに分かれていた。どれも本物の関数を動かす良い検査だが、「iPhoneで実際に遊んだときの
// 操作」を一覧で見られる場所が無く、片方を直すともう片方が壊れることに気づきにくかった。
// ここでは実機の確認項目(高速TAP・交互・隣接・端レーン・同時押し・HOLD・HOLD+TAP・持ち替え・
// SLIDE・SLIDE+TAP・FLICK・終点フリック・入力の古さの補正・リスタート)を、
// 同じ物差しで並べる。文字列の存在確認ではなく、関数を動かした結果で見る。
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const src=fs.readFileSync(path.join(ROOT,'monster-hero','data','rhythm-mode.js'),'utf8');
const game=fs.readFileSync(path.join(ROOT,'monster-hero','src','game-system.jsx'),'utf8');
const stub=()=>({style:{setProperty(){},removeProperty(){}},setAttribute(){},removeAttribute(){},
  getAttribute:()=>null,appendChild(){},removeChild(){},addEventListener(){},removeEventListener(){},
  classList:{add(){},remove(){}},dataset:{},querySelector:()=>null,querySelectorAll:()=>[],
  textContent:'',isConnected:false,children:[],childNodes:[],closest:()=>null,
  getBoundingClientRect:()=>({top:0,left:0,width:0,height:0,bottom:0,right:0})});
let perfNow=0,rafCb=null;
const ctx={console,navigator:{},performance:{now:()=>perfNow},requestAnimationFrame:cb=>{rafCb=cb;return 1;},cancelAnimationFrame(){rafCb=null;},
  setTimeout,clearTimeout,MutationObserver:function(){this.observe=()=>{};this.disconnect=()=>{};},
  document:{createElement:stub,createElementNS:stub,head:stub(),body:stub(),documentElement:stub(),
    addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]}};
ctx.window=ctx;ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(src+'\nglobalThis.__x={rhythmMatchInputBatch,RHYTHM_GESTURE_RUNTIME,RHYTHM_FLOATING_NOTES,'
  +'rhythmFloatingNoteAdd,rhythmFloatingNoteRemove,RHYTHM_HOLD_RELEASE_GRACE_MS,RHYTHM_HOLD_HANDOVER_GRACE_MS,'
  +'rhythmJudgeReleaseLenient,rhythmJudgeRelease,rhythmInputAgeMs,RHYTHM_INPUT_AGE_MAX_MS,RHYTHM_JUDGMENTS,'
  +'RHYTHM_INPUT_MATCH_WINDOW_MS,rhythmLaneCoordinateAtPoint,rhythmSubLaneCoordinateAtPoint,rhythmProjectBoundary,'
  +'RHYTHM_FLICK_DISTANCE_PX,RHYTHM_FLICK_MAX_MS,RHYTHM_END_FLICK_ARM_MS};',ctx);
const X=ctx.__x,match=X.rhythmMatchInputBatch,RT=X.RHYTHM_GESTURE_RUNTIME;
const judgeTap=delta=>X.RHYTHM_JUDGMENTS.find(item=>item.windowMs!==null&&Math.abs(delta)<=item.windowMs)?.id||'MISS';

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const section=title=>console.log(`\n--- ${title} ---`);

// --- 本体(game-system.jsx)と同じ手順の最小版 ---
const makeRun=notes=>({notes:notes.map((n,i)=>({...n,index:i,done:false,activePointerId:null,holdJudgment:null,holdDeltaMs:0})),
  activePointers:new Map(),standbyPointers:new Map(),empty:0,judged:[]});
const starts=(run,inputs,now,ageMs=0)=>{
  perfNow=now;   // 本体では曲の時刻と performance.now() が同じ速さで進む。ここでは同じ値にそろえる
  const at=now-(ageMs>0?ageMs:0);
  match(run.notes,inputs,at,0).forEach(({input,target,deltaMs,standby})=>{
    if(!target&&standby){run.standbyPointers.set(input.inputKey,standby.index);return;}
    if(!target){run.empty++;return;}
    const judgment=judgeTap(deltaMs);
    if(target.type==='HOLD'){
      const handover=target.releasedAtMs!=null;
      target.activePointerId=input.inputKey;
      if(handover){target.releasedAtMs=null;X.rhythmFloatingNoteRemove(target);}
      else{target.holdJudgment=judgment;target.holdDeltaMs=deltaMs;}
      run.activePointers.set(input.inputKey,target.index);
      return;
    }
    target.done=true;run.judged.push({index:target.index,judgment,deltaMs});
  });
};
const ends=(run,keys,now)=>keys.forEach(key=>{
  perfNow=now;
  run.standbyPointers.delete(key);
  const idx=run.activePointers.get(key);
  RT.release(key,false);
  if(idx===undefined)return;
  run.activePointers.delete(key);
  const note=run.notes[idx];
  if(!note||note.done)return;
  note.activePointerId=null;
  const holdEndMs=note.endTimeMs;
  let takeover=null;
  for(const [k,i] of run.standbyPointers){if(i===idx&&k!==key){takeover=k;break;}}
  if(takeover&&now<holdEndMs-X.RHYTHM_HOLD_RELEASE_GRACE_MS){
    note.activePointerId=takeover;note.releasedAtMs=null;X.rhythmFloatingNoteRemove(note);
    run.activePointers.set(takeover,idx);run.standbyPointers.delete(takeover);
    RT.bind(takeover,note,note._rhythmOriginalType||note.type,now,0);
    return;
  }
  if(now>=holdEndMs-X.RHYTHM_HOLD_RELEASE_GRACE_MS){note.done=true;run.judged.push({index:idx,judgment:note.holdJudgment||'MISS'});}
  else{note.releasedAtMs=now;X.rhythmFloatingNoteAdd(note);}
});
const tick=(run,now)=>{
  perfNow=now;
  if(rafCb){const cb=rafCb;cb();}
  run.notes.forEach(note=>{
    if(note.type==='HOLD'&&note.activePointerId!==null&&now>=note.endTimeMs){note.done=true;run.judged.push({index:note.index,judgment:note.holdJudgment||'MISS'});}
    if(!note.done&&note.activePointerId===null&&note.releasedAtMs!=null&&now-note.releasedAtMs>=X.RHYTHM_HOLD_HANDOVER_GRACE_MS){
      note.releasedAtMs=null;X.rhythmFloatingNoteRemove(note);note.done=true;run.judged.push({index:note.index,judgment:'MISS'});
    }
    // 本体の visitNote と同じ順・同じ条件(浮いているノーツはここで失敗にしない)
    if(!note.done&&note.activePointerId===null&&note.releasedAtMs==null&&now-note.timeMs>X.RHYTHM_INPUT_MATCH_WINDOW_MS){note.done=true;run.judged.push({index:note.index,judgment:'MISS'});}
  });
};
const tap=(timeMs,sub,width=2)=>({type:'TAP',timeMs,lane:Math.floor(sub/2),subLane:sub,subLaneWidth:width});
const hold=(timeMs,endTimeMs,sub,width=2)=>({type:'HOLD',timeMs,endTimeMs,lane:Math.floor(sub/2),subLane:sub,subLaneWidth:width});
const flick=(timeMs,sub,width=2)=>({type:'FLICK',timeMs,lane:Math.floor(sub/2),subLane:sub,subLaneWidth:width});
const slide=(points,width=2,endFlick=false)=>({type:'SLIDE',timeMs:points[0][0],endTimeMs:points[points.length-1][0],
  lane:points[0][1],endLane:points[points.length-1][1],subLaneWidth:width,
  slidePoints:points.map(([timeMs,lane])=>({timeMs,lane})),...(endFlick?{endFlick:true}:{})});
const at=(key,sub)=>({inputKey:key,lane:Math.max(0,Math.min(4,Math.floor(sub/2))),subLaneCoordinate:sub});
const reset=()=>{RT.clear();X.RHYTHM_FLOATING_NOTES.clear();perfNow=0;rafCb=null;};
const judgmentOf=(run,index)=>run.judged.find(j=>j.index===index)?.judgment||null;

section('TAP: 高速・交互・隣接・端');
{
  reset();
  const run=makeRun([tap(1000,4),tap(1088,4),tap(1176,4),tap(1264,4)]);
  starts(run,[at('touch:1',4)],1000);ends(run,['touch:1'],1030);
  starts(run,[at('touch:2',4)],1090);ends(run,['touch:2'],1120);
  starts(run,[at('touch:3',4)],1170);ends(run,['touch:3'],1200);
  starts(run,[at('touch:4',4)],1270);ends(run,['touch:4'],1300);
  check('16分(88ms)の縦連を4つとも取れ、判定が後ろへ流れない',
    [0,1,2,3].every(i=>judgmentOf(run,i)==='MARVELOUS'),run.judged.map(j=>`${j.index}:${j.judgment}`).join(' '));
}
{
  reset();
  const run=makeRun([tap(1000,1),tap(1088,7),tap(1176,1),tap(1264,7)]);
  starts(run,[at('touch:1',1)],1000);ends(run,['touch:1'],1030);
  starts(run,[at('touch:2',7)],1088);ends(run,['touch:2'],1120);
  starts(run,[at('touch:3',1)],1176);ends(run,['touch:3'],1200);
  starts(run,[at('touch:4',7)],1264);ends(run,['touch:4'],1300);
  check('左右交互の16分を4つとも取れる',[0,1,2,3].every(i=>judgmentOf(run,i)==='MARVELOUS'));
}
{
  reset();
  const run=makeRun([tap(1000,4,1),tap(1000,5,1)]);
  starts(run,[at('touch:1',4.5),at('touch:2',5.5)],1000);
  check('隣り合う幅1の同時押しを、2本の指で別々に取れる',judgmentOf(run,0)==='MARVELOUS'&&judgmentOf(run,1)==='MARVELOUS');
}
{
  reset();
  const run=makeRun([tap(1000,0,2),tap(2000,8,2)]);
  starts(run,[at('touch:1',-0.4)],1000);   // 左端のさらに外側(猶予の中)
  starts(run,[at('touch:2',10.4)],2000);   // 右端のさらに外側
  check('端のレーンは外側の猶予(0.6サブレーン)まで押せる',judgmentOf(run,0)==='MARVELOUS'&&judgmentOf(run,1)==='MARVELOUS');
  const rect={left:0,top:0,width:500,height:800};
  const outside=X.rhythmLaneCoordinateAtPoint(-100,700,rect);
  check('台形の外(猶予より外)は入力にならない',outside===null);
}
{
  reset();
  const run=makeRun([tap(1000,2,2),tap(1000,6,2)]);
  starts(run,[at('touch:1',9)],1000);
  check('関係ない場所を押しても取れない(空打ち)',run.empty===1&&!judgmentOf(run,0)&&!judgmentOf(run,1));
}

section('同時押し: 完全同時・数十msずれ・左右どちらから');
for(const [label,order,gap] of [['完全同時',['L','R'],0],['左→右 40ms',['L','R'],40],['右→左 40ms',['R','L'],40],['左→右 90ms',['L','R'],90]]){
  reset();
  const run=makeRun([tap(1000,1,3),tap(1000,6,3)]);
  const first=order[0]==='L'?at('touch:1',2):at('touch:1',7),second=order[1]==='L'?at('touch:2',2):at('touch:2',7);
  starts(run,[first],1000);
  starts(run,[second],1000+gap);
  const j0=judgmentOf(run,0),j1=judgmentOf(run,1);
  check(`同時押し(${label}): 両方取れる`,j0&&j1&&j0!=='MISS'&&j1!=='MISS',`${j0} / ${j1}`);
}
{
  reset();
  const run=makeRun([tap(1000,1,3),tap(1000,6,3)]);
  starts(run,[at('touch:1',2)],1000);
  starts(run,[at('touch:2',2.5)],1030);   // 同じ側をもう一度(相方は右)
  check('同時押しの片方を2回押しても、相方(右)を勝手に取らない',judgmentOf(run,0)==='MARVELOUS'&&!judgmentOf(run,1)&&run.empty===1);
}

section('HOLD: 始点・保持・少しずれる・HOLD中TAP・終点・遅い離し');
{
  reset();
  const run=makeRun([hold(1000,2000,2,2),tap(1500,8,2)]);
  starts(run,[at('touch:1',2.5)],1000);
  starts(run,[at('touch:2',8.5)],1500);
  check('HOLD中に別の指でTAPを取れる',judgmentOf(run,1)==='MARVELOUS'&&run.notes[0].activePointerId==='touch:1');
  tick(run,1990);ends(run,['touch:1'],2000);
  check('終端ちょうどで離せばHOLDはMARVELOUS',judgmentOf(run,0)==='MARVELOUS');
}
{
  reset();
  const run=makeRun([hold(1000,2000,2,2)]);
  starts(run,[at('touch:1',2.5)],1000);
  RT.record('touch:1',0,0);   // 位置の追従は座標→レーンの変換が要るので、ここでは離す側だけを見る
  tick(run,1500);tick(run,2100);tick(run,2250);
  check('押しっぱなしで終端を過ぎても MISS にならず GOOD で確定する',run.notes[0].holdJudgment==='GOOD',String(run.notes[0].holdJudgment));
}
{
  reset();
  const run=makeRun([hold(1000,2000,2,2)]);
  starts(run,[at('touch:1',2.5)],1000);
  perfNow=2300;ends(run,['touch:1'],2300);
  check('終端から300ms遅れて離してもGOOD(遅い側はやさしく)',run.notes[0].holdJudgment==='GOOD',String(run.notes[0].holdJudgment));
  check('早すぎる離し(-241ms)は今までどおりMISS',X.rhythmJudgeRelease(-241)==='MISS'&&X.rhythmJudgeReleaseLenient(-241)==='MISS');
  check('判定表(RHYTHM_JUDGMENTS)そのものは変えていない',X.RHYTHM_JUDGMENTS.map(j=>`${j.id}:${j.windowMs}`).join(',')==='MARVELOUS:55,EXCELLENT:100,GREAT:150,GOOD:200,BAD:240,MISS:null');
}
{
  reset();
  const run=makeRun([hold(1000,3000,2,4)]);
  starts(run,[at('touch:1',3)],1000);
  ends(run,['touch:1'],1700);          // 途中で離す(持ち替えかもしれない)
  tick(run,1750);
  check('途中で離した直後はまだ失敗にしない(浮いている)',!run.notes[0].done&&run.notes[0].releasedAtMs===1700);
  tick(run,1700+X.RHYTHM_HOLD_HANDOVER_GRACE_MS+1);
  check('猶予を過ぎても戻ってこなければMISS',judgmentOf(run,0)==='MISS');

  check('本体の「始点を過ぎたのに誰も押していない→MISS」は、浮いているノーツを除いている',
    /note\.activePointerId===null&&note\.releasedAtMs==null&&songTimeMs-\(note\.timeMs\+settings\.judgmentTimingOffsetMs\)>RHYTHM_INPUT_MATCH_WINDOW_MS\)applyJudgment\(note,'MISS'/.test(game));
}

section('HOLD/SLIDE: 指の入れ替え(2通り)');
for(const [label,make] of [['HOLD',()=>hold(0,3000,2,4)],['SLIDE',()=>slide([[0,1],[3000,1]],4)]]){
  // A: 離してから置き直す
  reset();
  let run=makeRun([make()]);
  starts(run,[at('touch:1',4)],0);
  ends(run,['touch:1'],1500);
  starts(run,[at('touch:2',4)],1560);
  tick(run,1800);
  check(`${label}: 離してから置き直す順でも続く`,!run.notes[0].done&&run.notes[0].activePointerId==='touch:2');
  // B: 2本目を先に置いてから離す
  reset();
  run=makeRun([make()]);
  starts(run,[at('touch:1',4)],0);
  starts(run,[at('touch:2',4)],1500);
  ends(run,['touch:1'],1520);
  tick(run,1800);
  check(`${label}: 2本目を先に置いてから元の指を離す順でも続く`,!run.notes[0].done&&run.notes[0].activePointerId==='touch:2'&&run.empty===0);
}

section('SLIDE: 追従・折り返し・SLIDE中TAP');
{
  reset();
  const run=makeRun([slide([[1000,0],[1500,2],[2000,4],[2500,2]],2),tap(1750,9,1)]);
  starts(run,[at('touch:1',.5)],1000);
  starts(run,[at('touch:2',9.5)],1750);
  check('SLIDE中に別の指でTAPを取れる',judgmentOf(run,1)==='MARVELOUS'&&run.notes[0].activePointerId==='touch:1');
  // 経路上を追う指の期待レーン(折り返しを含む)
  const laneAt=t=>vm.runInContext(`rhythmSlideExpectedLane(${JSON.stringify(run.notes[0])},${t})`,ctx);
  check('折り返しの経路も時間で補間される',Math.abs(laneAt(1500)-2)<1e-9&&Math.abs(laneAt(2000)-4)<1e-9&&Math.abs(laneAt(2250)-3)<1e-9);
}

section('FLICK: 成立・不成立・終点フリック');
{
  reset();
  const run=makeRun([flick(1000,4,2)]);
  perfNow=1000;RT.record('touch:1',100,100);   // 本体では document の capture が先に指の位置を覚える
  starts(run,[at('touch:1',4.5)],1000);
  const note=run.notes[0];
  check('FLICKは指を置いた時点でHOLD扱いになり、動かすまで待つ',note.type==='HOLD'&&note._rhythmOriginalType==='FLICK');
  perfNow=1120;RT.record('touch:1',100,100-X.RHYTHM_FLICK_DISTANCE_PX);
  check('24px以上動かせば方向を問わず成立する',note._rhythmGestureDone===true&&note.holdJudgment!=='MISS');
}
{
  reset();
  const run=makeRun([flick(1000,4,2)]);
  perfNow=1000;RT.record('touch:1',100,100);
  starts(run,[at('touch:1',4.5)],1000);
  const note=run.notes[0];
  perfNow=1000+X.RHYTHM_FLICK_MAX_MS+10;RT.record('touch:1',103,100);
  tick(run,1000+X.RHYTHM_FLICK_MAX_MS+20);
  check('動かさないまま時間切れならMISS',note.holdJudgment==='MISS');
}
{
  reset();
  const run=makeRun([slide([[1000,1],[2000,3]],2,true)]);
  perfNow=1000;RT.record('touch:1',100,100);
  starts(run,[at('touch:1',1.5)],1000);
  const note=run.notes[0];
  tick(run,1800);            // 終端の200ms前 → 受付に入る(基準の位置を覚える)
  perfNow=1850;RT.record('touch:1',100+X.RHYTHM_FLICK_DISTANCE_PX,100);
  check('終点フリックは終端の手前で弾けば、離さなくてもその場で成立する(150ms早いのでGREAT)',note._rhythmReleaseDone===true&&note.holdJudgment==='GREAT',String(note.holdJudgment));
}

section('入力の古さの補正(event.timeStamp)');
{
  check('30ms前に起きたイベントは30msぶん巻き戻す',X.rhythmInputAgeMs(1000,1030)===30);
  check('上限(80ms)より古い値は使わない(時計の基準が違う可能性)',X.rhythmInputAgeMs(1000,1100)===0&&X.rhythmInputAgeMs(1e12,1000)===0);
  check('未来・欠損は0',X.rhythmInputAgeMs(2000,1000)===0&&X.rhythmInputAgeMs(undefined,1000)===0);
  reset();
  const run=makeRun([tap(1000,4,2)]);
  starts(run,[at('touch:1',4.5)],1060,30);   // 処理が1060msでも、指が触れたのは1030ms
  const j=run.judged[0];
  check('補正ぶんだけ判定の時刻が早まる(1060ms処理・30ms古い → 30ms遅れとして判定)',j&&j.deltaMs===30&&j.judgment==='MARVELOUS',JSON.stringify(j));
  check('本体はタッチ・ポインタの両方で補正を渡している',
    (game.match(/rhythmInputAgeMs\(e\.timeStamp/g)||[]).length>=2&&/const inputStarts=\(inputs,ageMs=0\)=>/.test(game));
}

section('リスタート・初回');
{
  reset();
  const run=makeRun([hold(1000,2000,2,2)]);
  starts(run,[at('touch:1',2.5)],1000);
  check('押さえている指がruntimeに登録される',RT._sessions.size===1);
  RT.clear();
  check('リスタート(clear)で押さえている指の記録が全部消える',RT._sessions.size===0);
  const fresh=makeRun([tap(1000,4,2)]);
  starts(fresh,[at('touch:9',4.5)],1000);
  check('作り直したあとの最初の入力も同じ物差しで判定される',judgmentOf(fresh,0)==='MARVELOUS');
}

console.log('');
if(failed){console.log(`${failed}件のNGがあります`);process.exit(1);}
console.log('すべてOK');
