#!/usr/bin/env node
// 長押し・スライドの「指の置き換え」を、両方のやり方で確かめる。
//
//   node tools/mode/rhythm-finger-swap-check.js
//
// 【なぜ要るか】(2026-09-05・プレイヤーからの声)
//   「左指でスライダーノーツ押さえてて、左指で押さえた状態で右指を置くとミス判定。
//     スライダーノーツを左指で押さえる → 同じスライダーノーツを右指で押さえる →
//     左指を離して続きを右指で押さえ、左指は自由にする」
//   「指置き換えがプロセカの感覚でやってると確実にミス。親指勢は死んじゃう」
//
// 置き換えのやり方は2つある。**どちらも成立しなければいけない。**
//   ① 先に2本目を置いてから1本目を離す（親指で遊ぶ人はこちら。プロセカと同じ）
//   ② 1本目を離してから2本目を置き直す
//
// 以前は②しか想定しておらず、①は押さえている帯へ置いた2本目がどのノーツにも当たらず
// 空打ちになっていた。しかも1本目を離したときには2本目はもう画面に触れているので
// 新しい入力が起きず、引き継ぐきっかけが無い。猶予を過ぎて必ずMISSになっていた。
//
// ここでは本番の rhythmMatchInputBatch と、game-system.jsx の inputStarts / inputEnds と
// 同じ手順を動かして、①②のどちらでも指が渡ることを見る。
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const src=fs.readFileSync(path.join(ROOT,'monster-hero','data','rhythm-mode.js'),'utf8');
const game=fs.readFileSync(path.join(ROOT,'monster-hero','src','game-system.jsx'),'utf8');
const stub=()=>({style:{setProperty(){},removeProperty(){}},setAttribute(){},removeAttribute(){},
  getAttribute:()=>null,appendChild(){},removeChild(){},addEventListener(){},removeEventListener(){},
  classList:{add(){},remove(){}},dataset:{},querySelector:()=>null,querySelectorAll:()=>[],
  textContent:'',isConnected:false,children:[],childNodes:[],closest:()=>null,
  getBoundingClientRect:()=>({top:0,left:0,width:0,height:0,bottom:0,right:0})});
const ctx={console,navigator:{},performance:{now:()=>0},requestAnimationFrame:()=>0,cancelAnimationFrame(){},
  setTimeout,clearTimeout,MutationObserver:function(){this.observe=()=>{};this.disconnect=()=>{};},
  document:{createElement:stub,createElementNS:stub,head:stub(),body:stub(),documentElement:stub(),
    addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]}};
ctx.window=ctx;ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(src+'\nglobalThis.__x={rhythmMatchInputBatch,RHYTHM_GESTURE_RUNTIME,RHYTHM_FLOATING_NOTES,'
  +'rhythmFloatingNoteAdd,rhythmFloatingNoteRemove,RHYTHM_HOLD_RELEASE_GRACE_MS,RHYTHM_HOLD_HANDOVER_GRACE_MS};',ctx);
const X=ctx.__x,match=X.rhythmMatchInputBatch,RT=X.RHYTHM_GESTURE_RUNTIME;

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- 本番(game-system.jsx)と同じ手順 ---
const makeRun=notes=>({notes,activePointers:new Map(),standbyPointers:new Map(),empty:0});
const starts=(run,inputs,now)=>match(run.notes,inputs,now,0).forEach(({input,target,deltaMs,standby})=>{
  if(!target&&standby){run.standbyPointers.set(input.inputKey,standby.index);return;}
  if(!target){run.empty++;return;}
  if(target.type==='HOLD'){
    const handover=target.releasedAtMs!=null;
    target.activePointerId=input.inputKey;
    if(handover){target.releasedAtMs=null;X.rhythmFloatingNoteRemove(target);}
    else{target.holdJudgment='MARVELOUS';target.holdDeltaMs=deltaMs;}
    run.activePointers.set(input.inputKey,target.index);
    RT.bind(input.inputKey,target,target._rhythmOriginalType||target.type,now,0);
  }
});
const ends=(run,keys,now)=>keys.forEach(key=>{
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
  if(now>=holdEndMs-X.RHYTHM_HOLD_RELEASE_GRACE_MS){note.done=true;}
  else{note.releasedAtMs=now;X.rhythmFloatingNoteAdd(note);}
});
const tick=(run,now)=>run.notes.forEach(note=>{
  if(!note.done&&note.activePointerId===null&&note.releasedAtMs!=null
     &&now-note.releasedAtMs>=X.RHYTHM_HOLD_HANDOVER_GRACE_MS){
    note.releasedAtMs=null;X.rhythmFloatingNoteRemove(note);note.done=true;note._miss=true;
  }
});
const slide=()=>({index:0,type:'SLIDE',timeMs:0,endTimeMs:3000,lane:1,endLane:1,subLane:2,subLaneWidth:4,
  slidePoints:[{timeMs:0,lane:1,subLaneWidth:4},{timeMs:3000,lane:1,subLaneWidth:4}],
  done:false,activePointerId:null});
const hold=()=>({index:0,type:'HOLD',timeMs:0,endTimeMs:3000,lane:1,subLane:2,subLaneWidth:4,
  done:false,activePointerId:null});
const at=(key,sub)=>({inputKey:key,lane:Math.floor(sub/2),subLaneCoordinate:sub});
const reset=()=>{RT.clear();X.RHYTHM_FLOATING_NOTES.clear();};

// ① 先に2本目を置いてから1本目を離す（プレイヤーの声そのもの）
for(const [label,make] of [['スライド',slide],['長押し',hold]]){
  reset();
  const run=makeRun([make()]);
  starts(run,[at('touch:1',4)],0);        // 左指で押さえる
  starts(run,[at('touch:2',4)],1500);     // 押さえたまま、同じ帯へ右指
  const heldBefore=run.notes[0].activePointerId;
  ends(run,['touch:1'],1520);             // 左指を離す
  tick(run,1800);
  const note=run.notes[0];
  check(`${label}: 先に2本目を置いてから1本目を離しても続く`,
    !note._miss&&note.activePointerId==='touch:2',
    note._miss?'MISSになった':`押さえている指=${note.activePointerId}`);
  check(`${label}: 置いた2本目は空打ちにならない`,run.empty===0,`空打ち${run.empty}回`);
  check(`${label}: 渡す前は1本目が押さえたまま`,heldBefore==='touch:1',String(heldBefore));
}
// ② 1本目を離してから2本目を置き直す（これまでも動いていた形）
{
  reset();
  const run=makeRun([slide()]);
  starts(run,[at('touch:1',4)],0);
  ends(run,['touch:1'],1500);
  starts(run,[at('touch:2',4)],1580);
  tick(run,1800);
  const note=run.notes[0];
  check('離してから置き直す形も今までどおり続く',
    !note._miss&&note.activePointerId==='touch:2',
    note._miss?'MISSになった':`押さえている指=${note.activePointerId}`);
}
// 帯から離れた場所へ置いた指は控えにしない(何でも控え扱いにすると別のノーツを取れなくなる)
{
  reset();
  const run=makeRun([slide()]);
  starts(run,[at('touch:1',4)],0);
  starts(run,[at('touch:2',9)],1500);     // 帯(サブ2〜6)から離れた場所
  check('帯から離れた場所へ置いた指は控えにしない',
    run.standbyPointers.size===0&&run.empty===1,
    `控え${run.standbyPointers.size}件 / 空打ち${run.empty}回`);
}
// 控えの指が先に離れたら、控えは消える(1本目はそのまま押さえ続ける)
{
  reset();
  const run=makeRun([slide()]);
  starts(run,[at('touch:1',4)],0);
  starts(run,[at('touch:2',4)],1500);
  ends(run,['touch:2'],1600);             // 控えのほうが先に離れた
  const note=run.notes[0];
  check('控えの指が先に離れても、押さえている指はそのまま',
    note.activePointerId==='touch:1'&&run.standbyPointers.size===0,
    `押さえている指=${note.activePointerId} / 控え${run.standbyPointers.size}件`);
}
// 渡したあと、最後まで押さえれば成立する
{
  reset();
  const run=makeRun([slide()]);
  starts(run,[at('touch:1',4)],0);
  starts(run,[at('touch:2',4)],1500);
  ends(run,['touch:1'],1520);
  ends(run,['touch:2'],3000);             // 終わりまで押さえて離す
  const note=run.notes[0];
  check('渡したあと最後まで押さえれば成立する',note.done&&!note._miss);
}

// --- すぐ隣に普通のノーツがあるとき ---
// (2026-09-18・プレイヤーの声「スライドノーツの近くに普通のノーツがある時、
//  指置き換えしたらそっちに引っ張られちゃう」)
//
// 控えの指の判断は「どのノーツにも当たらなかったとき」だけだった。押さえている帯の
// **内側**へ置いた2本目でも、隣のノーツの受付(±0.6サブレーン)が掛かっているとそちらへ吸われ、
// 持ち替えが成立しないまま1本目を離してMISS。巻き込まれたノーツの判定まで狂っていた。
// ★この検査が今まで見逃したのは、近くに競合するノーツを1つも置いていなかったから。
{
  // 押さえているSLIDEの帯はサブレーン1〜5。すぐ隣(5〜7)に普通のノーツを置く。
  // 隣のノーツの受付は 5-0.6=4.4 から始まるので、4.4〜5.0 が取り合いになる
  const nextTo=()=>({index:1,type:'TAP',timeMs:1000,lane:2,subLane:5,subLaneWidth:2,
    done:false,activePointerId:null});
  for(const spot of [4.4,4.6,4.8,5.0]){
    reset();
    const run=makeRun([slide(),nextTo()]);
    starts(run,[at('touch:1',3)],0);               // 1本目でSLIDEを押さえる
    starts(run,[at('touch:2',spot)],1000);         // 2本目を帯の内側へ置く
    check(`帯の内側(${spot})へ置いた2本目は、隣の普通のノーツに取られない`,
      run.standbyPointers.get('touch:2')===0&&!run.notes[1].done,
      `控え=${run.standbyPointers.get('touch:2')} / 隣のノーツ done=${run.notes[1].done}`);
  }
  // 帯の外は、これまでどおり普通のノーツを取る
  {
    reset();
    const run=makeRun([slide(),nextTo()]);
    starts(run,[at('touch:1',3)],0);
    const got=match(run.notes,[at('touch:2',5.2)],1000,0)[0];
    check('帯の外(5.2)へ置いた指は、これまでどおり普通のノーツを取る',
      got.target===run.notes[1],`取ったもの=${got.target?got.target.type:'なし'}`);
  }
  // 誰も押さえていなければ、同じ場所でも普通のノーツを取る
  {
    reset();
    const run=makeRun([slide(),nextTo()]);
    const got=match(run.notes,[at('touch:1',4.8)],1000,0)[0];
    check('誰も押さえていなければ、同じ場所でも普通のノーツを取る',
      got.target===run.notes[1],`取ったもの=${got.target?got.target.type:'なし'}`);
  }
  // 渡したあと最後まで押さえれば、隣のノーツを巻き込まずに成立する
  {
    reset();
    const run=makeRun([slide(),nextTo()]);
    starts(run,[at('touch:1',3)],0);
    starts(run,[at('touch:2',4.8)],1000);
    ends(run,['touch:1'],1020);
    ends(run,['touch:2'],3000);
    check('持ち替えたあと最後まで押さえれば成立する(隣のノーツも巻き込まない)',
      run.notes[0].done&&!run.notes[0]._miss&&!run.notes[1].done,
      `SLIDE done=${run.notes[0].done} / 隣のノーツ done=${run.notes[1].done}`);
  }
}

// --- 本体側の作り ---
check('渡す先を探す仕組みがある',/const standbyFingerFor=/.test(game));
check('控えの指は run.standbyPointers で覚える',
  /standbyPointers:new Map\(\)/.test(game)&&/run\.standbyPointers\.set\(input\.inputKey,standby\.index\)/.test(game));
check('控えとして置いた指では空打ち音を鳴らさない',
  /if\(!target&&standby\)\{[\s\S]{0,220}?return;\s*\}/.test(game)
  &&!/if\(!target&&standby\)\{[\s\S]{0,220}?playEmpty/.test(game));
check('渡すときは元の種類で結び直す(SLIDEがただのHOLDへ化けない)',
  /RHYTHM_GESTURE_RUNTIME\.bind\(takeover,note,note\._rhythmOriginalType\|\|note\.type/.test(game));
check('ポーズしたら控えも捨てる',/run\.standbyPointers\?\.clear\(\)/.test(game));
// 押さえている帯の内側へ置いた指は、相手を決める前に控えへ回す(近くのノーツに取られないように)
check('帯の内側の指は、相手を決める前に控えへ回す',
  /const insideHeldBand=heldBandNote\(false\);/.test(src)
  &&/if\(insideHeldBand&&!insideOverlapWith\(insideHeldBand\)\)return \{input,target:null,deltaMs:null,standby:insideHeldBand\};/.test(src));
// ★ただし帯の上へ**重なって**降ってくるノーツ(被りノーツ)には譲る。
//   接しているだけ(重なりの幅0)は譲らない＝上の「隣のノーツに取られない」が成り立つ。
//   中身は tools/mode/rhythm-tap-during-hold-check.js が見る(2026-09-18)。
check('帯の上へ重なって降ってくるノーツには譲る(被りノーツを叩けるように)',
  /const insideOverlapWith=heldNote=>/.test(src)
  &&/if\(!\(end>start\)\)continue;/.test(src));

console.log('');
if(failed){console.log(`${failed}件のNGがあります`);process.exit(1);}
console.log('すべてOK');
