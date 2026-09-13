#!/usr/bin/env node
// 両手の指のシミュレート(共通部品)。
//
//   node tools/mode/rhythm-hand-simulate.js        # 合成テスト: 先読みが要る配置で greedy と beam を比べる
//
// 【なぜ要るか】(2026-09-07)
// STEP6(rhythm-chart-v2-step6-playability.js)の指の割り当ては、ノーツを時刻順に見て
// 「いま届く指のうち移動の小さいほう」を取る**その場の最適**だった。これだと
//
//   いまのノーツだけなら右手のほうが楽 → でも右手を使うと 80ms 後のノーツが取れない
//   いまを左手で取れば、そのあと全部押せる
//
// という配置を「押せない」と誤って判定する。合成テスト(下の require.main)で実際に再現できた。
// ここでは同じ手のモデル(rhythm-hand-model.js。値は二重管理しない)のまま、
// **数ノーツ先まで見る**ビームサーチで割り当てを探す。「実際に存在する押し方を見つけられる」
// ことが目的なので、必要以上に複雑にはしない(状態＝2本の指の位置と空く時刻だけ)。
//
// 返すもの:
//   issues        … STEP6と同じ形({severity,kind,noteIndex,grid,timeMs,bar,lane,type,detail})
//   assignments   … actionごとにどの指で取ったか(0/1/null)
//   fingerTravel  … 指ごとの移動距離(レーン)
//   strainStreaks … 「忙しい」が続いた区間(ms)
// 判定・スコア・ランタイムには一切関与しない。
'use strict';
const {HAND_MODEL,fingerPairFeasible,noteTouchLane}=require('./rhythm-hand-model.js');

const HANDS=HAND_MODEL.hands;
const DEFAULT_BEAM=8;

// --- ノーツを「指の仕事」へ均す(STEP6と同じ形) ---
const toActions=(notes,gridTimeMs,BAR)=>notes.map((note,index)=>{
  const startMs=gridTimeMs(note.grid);
  const lane=noteTouchLane(note);
  const endFlick=note.endFlick===true&&(note.type==='HOLD'||note.type==='SLIDE');
  if(note.type==='HOLD'){
    const endMs=gridTimeMs(note.grid+(Number(note.durationGrids)||0));
    return {index,type:note.type,startMs,endMs,startLane:lane,endLane:lane,grid:note.grid,endFlick,note};
  }
  if(note.type==='SLIDE'){
    const points=Array.isArray(note.slidePoints)&&note.slidePoints.length?note.slidePoints:null;
    const endGrid=note.grid+(Number(note.durationGrids)||0);
    const endLane=points?Number(points[points.length-1].lane):Number(note.endLane??note.lane??lane);
    return {index,type:note.type,startMs,endMs:gridTimeMs(endGrid),startLane:Number(note.lane)||0,endLane,grid:note.grid,endFlick,note};
  }
  return {index,type:note.type,startMs,endMs:startMs,startLane:lane,endLane:lane,grid:note.grid,endFlick:false,note};
}).sort((a,b)=>a.startMs-b.startMs||a.startLane-b.startLane).map(action=>({...action,bar:Math.floor(action.grid/BAR)}));

// 1本の指が1つのノーツを取れるか(限界)・楽に取れるか(快適)。STEP6の evaluate と同じ式。
const evaluateFinger=(finger,action)=>{
  if(finger.freeAtMs+HAND_MODEL.releaseMarginMs>action.startMs)
    return {ok:false,reason:`前のHOLD/SLIDEを${Math.round(finger.freeAtMs-action.startMs)}ms後まで押さえている`};
  const availableMs=action.startMs-Math.max(finger.freeAtMs,finger.lastHitMs);
  const distance=Math.abs(finger.lane-action.startLane);
  // ★1本の指で押し直すには、**動く距離とは別に**「持ち上げて押す」ぶんの時間が要る。
  //   以前は同じレーンのときだけ restrikeLimitMs を見て、少しでも動くなら距離だけで
  //   判定していた。0.5レーンなら28ms＝**1本の指で毎秒36打**が「押せる」扱いになり、
  //   譜面の交互率が落ちる原因になっていた(2026-09-12)。
  //   同じファイルの fingerPairFeasible は最初から105msを要求していて、食い違っていた。
  const travelLimitMs=distance/HAND_MODEL.laneSpeedLimit*1000;
  const needLimitMs=Math.max(HAND_MODEL.restrikeLimitMs,travelLimitMs);
  if(availableMs+1e-6<needLimitMs){
    // どちらが効いているのかを書き分ける（距離のせいなのか、叩き直しのせいなのか）
    return {ok:false,reason:travelLimitMs>HAND_MODEL.restrikeLimitMs
      ?`${distance.toFixed(2)}レーンを${Math.round(availableMs)}msで移動できない(最低${Math.round(needLimitMs)}ms)`
      :distance===0
        ?`同じレーンを${Math.round(availableMs)}msで叩き直せない(最低${HAND_MODEL.restrikeLimitMs}ms)`
        :`${distance.toFixed(2)}レーンずれた場所を${Math.round(availableMs)}msで叩き直せない`
          +`(1本の指の押し直しに最低${HAND_MODEL.restrikeLimitMs}ms)`};
  }
  const travelComfortMs=distance/HAND_MODEL.laneSpeedComfort*1000;
  const needComfortMs=Math.max(HAND_MODEL.restrikeComfortMs,travelComfortMs);
  const strain=availableMs<needComfortMs
    ?(travelComfortMs>HAND_MODEL.restrikeComfortMs
      ?`${distance.toFixed(2)}レーンの移動が${Math.round(availableMs)}ms(快適には${Math.round(needComfortMs)}ms欲しい)`
      :`${distance===0?'同じレーン':`${distance.toFixed(2)}レーンずれた場所`}の叩き直しが${Math.round(availableMs)}ms`
        +`(快適には${HAND_MODEL.restrikeComfortMs}ms欲しい)`)
    :null;
  // 左右交互が自然な基本(手の流れ)。直前に叩いたばかりの指をまた使うのは、
  // 移動が明らかに短いときだけにする(距離1レーンぶんの重み以下の小さな後押し)。
  // ただしこれは「どちらでも取れる」ときの好みで、押せる/押せないの判定には関係しない。
  const justHit=Number.isFinite(finger.lastHitMs)&&availableMs<400?400:0;
  return {ok:true,distance,cost:distance*1000+Math.max(0,200-availableMs)+justHit,strain};
};

// 同時押しの組へ、指をどう配るかの全通り(nullは「その音に指を使わない」)
const assignmentsFor=count=>{
  const out=[];
  const walk=(k,used,current)=>{
    if(k===count){out.push(current.slice());return;}
    for(let fi=0;fi<HANDS;fi++){
      if(used.has(fi))continue;
      used.add(fi);current.push(fi);walk(k+1,used,current);current.pop();used.delete(fi);
    }
    current.push(null);walk(k+1,used,current);current.pop();
  };
  walk(0,new Set(),[]);
  return out;
};
const ASSIGNMENTS=[assignmentsFor(0),assignmentsFor(1),assignmentsFor(2),assignmentsFor(3)];

const makeIssue=(severity,kind,action,detail)=>({
  severity,kind,noteIndex:action.index,grid:action.grid,
  timeMs:Math.round(action.startMs),bar:action.bar,
  lane:action.startLane,type:action.type,detail,
});

// --- 本体 ---
//   actions … toActions の出力
//   options.beam … 何通りの「指の置き方」を持ち越すか(1にすると従来のその場最適と同じ)
const simulateActions=(actions,options={})=>{
  const beamWidth=Math.max(1,Number(options.beam)||DEFAULT_BEAM);
  const issues=[];
  // 指の太さ(近いのに速い)は割り当てと無関係に決まるので、先に見る
  for(let a=1;a<actions.length;a++){
    const cur=actions[a];
    for(let b=a-1;b>=0;b--){
      const prev=actions[b];
      const dt=cur.startMs-prev.startMs;
      if(dt>=HAND_MODEL.restrikeLimitMs)break;
      if(dt<1)continue;
      const feasible=fingerPairFeasible(cur.note,prev.note,dt);
      if(!feasible.ok){
        issues.push(makeIssue('impossible','指が2本入らない近さで速すぎる',cur,`${Math.round(dt)}ms前のノーツと重なっていて${feasible.reason}`));
        break;
      }
    }
  }
  // 状態: 指ごとの {lane,freeAtMs,lastHitMs} と、ここまでの悪さ
  const initial={
    fingers:Array.from({length:HANDS},(_,i)=>({lane:i===0?1:3,freeAtMs:-Infinity,lastHitMs:-Infinity})),
    impossible:0,strained:0,cost:0,travel:Array.from({length:HANDS},()=>0),
    log:null,   // 連結リスト {issue|assign, prev}
  };
  let beam=[initial];
  let i=0;
  while(i<actions.length){
    let j=i;
    while(j+1<actions.length&&Math.abs(actions[j+1].startMs-actions[i].startMs)<1)j++;
    const group=actions.slice(i,j+1);
    const groupIssues=[];
    if(group.length>HANDS)groupIssues.push(makeIssue('impossible','同時に押す数が指より多い',group[0],`同じ瞬間に${group.length}個(指は${HANDS}本)`));
    if(group.length===2){
      const gap=Math.abs(group[0].startLane-group[1].startLane);
      if(gap<HAND_MODEL.fingerMinGapLanes)groupIssues.push(makeIssue('impossible','同時押しが近すぎて指が2本入らない',group[0],`レーン差${gap.toFixed(2)}(最低${HAND_MODEL.fingerMinGapLanes})`));
    }
    for(const issue of groupIssues)issues.push(issue);
    const plans=ASSIGNMENTS[Math.min(3,group.length)]||assignmentsFor(group.length);
    const next=[];
    for(const state of beam){
      const table=group.map(action=>state.fingers.map(f=>evaluateFinger(f,action)));
      for(const plan of plans){
        // 指が余っているのに使わない、は意味が無い(押せないを増やすだけ)
        const usedCount=plan.filter(fi=>fi!==null).length;
        if(usedCount<Math.min(group.length,HANDS)){
          // ただし「使える指が無い」ときだけ null を許す
          let couldUse=false;
          plan.forEach((fi,idx)=>{if(fi===null&&state.fingers.some((_,k)=>!plan.includes(k)&&table[idx][k].ok))couldUse=true;});
          if(couldUse)continue;
        }
        const fingers=state.fingers.map(f=>({...f}));
        const travel=state.travel.slice();
        let impossible=state.impossible,strained=state.strained,cost=state.cost,log=state.log;
        plan.forEach((fi,idx)=>{
          const action=group[idx];
          const result=fi===null?null:table[idx][fi];
          if(!result||!result.ok){
            const reasons=table[idx].map(r=>r.ok?null:r.reason).filter(Boolean);
            const detail=result?result.reason:(reasons.length?reasons[0]:'他のノーツに指を使っていて指が足りない');
            impossible++;
            cost+=1e6;
            log={item:{issue:makeIssue('impossible','押せる指がない',action,detail),assign:{index:action.index,finger:null}},prev:log};
            return;
          }
          if(result.strain){strained++;cost+=1000;log={item:{issue:makeIssue('strained','手の動きが忙しい',action,result.strain),assign:{index:action.index,finger:fi}},prev:log};}
          else log={item:{assign:{index:action.index,finger:fi}},prev:log};
          cost+=result.cost;
          const f=fingers[fi];
          travel[fi]+=Math.abs(f.lane-action.startLane)+Math.abs(action.endLane-action.startLane);
          f.lane=action.endLane;
          f.lastHitMs=action.startMs;
          f.freeAtMs=(action.endMs>action.startMs?action.endMs:action.startMs)+(action.endFlick?HAND_MODEL.endFlickReleaseMs:0);
        });
        next.push({fingers,impossible,strained,cost,travel,log});
      }
    }
    // 悪さの小さい順に、同じ指の状態は1つにまとめて上位だけ残す
    next.sort((a,b)=>a.impossible-b.impossible||a.strained-b.strained||a.cost-b.cost);
    const seen=new Set();
    beam=[];
    for(const state of next){
      const key=state.fingers.map(f=>`${f.lane.toFixed(2)}/${Math.round(f.freeAtMs)}/${Math.round(f.lastHitMs)}`).join('|');
      if(seen.has(key))continue;
      seen.add(key);
      beam.push(state);
      if(beam.length>=beamWidth)break;
    }
    i=j+1;
  }
  const best=beam[0]||initial;
  const assignments=new Map();
  const pathIssues=[];
  for(let node=best.log;node;node=node.prev){
    if(node.item.issue)pathIssues.push(node.item.issue);
    assignments.set(node.item.assign.index,node.item.assign.finger);
  }
  pathIssues.reverse();
  issues.push(...pathIssues);
  issues.sort((a,b)=>a.timeMs-b.timeMs||a.noteIndex-b.noteIndex);
  // 「忙しい」が続いた区間
  const strainedTimes=issues.filter(x=>x.severity==='strained').map(x=>x.timeMs).sort((a,b)=>a-b);
  const strainStreaks=[];
  let streakStart=null,streakLast=null;
  for(const t of strainedTimes){
    if(streakLast!==null&&t-streakLast<=HAND_MODEL.restrikeComfortMs*2){streakLast=t;continue;}
    if(streakStart!==null)strainStreaks.push({fromMs:streakStart,toMs:streakLast,ms:streakLast-streakStart});
    streakStart=t;streakLast=t;
  }
  if(streakStart!==null)strainStreaks.push({fromMs:streakStart,toMs:streakLast,ms:streakLast-streakStart});
  return {issues,assignments,fingerTravel:best.travel,strainStreaks,
    impossible:issues.filter(x=>x.severity==='impossible').length,
    strained:issues.filter(x=>x.severity==='strained').length};
};

const simulateNotes=(notes,timing,options={})=>{
  // ★グリッドの長さは timing.gridMs を正本にする（ほかの道具はこれを使っている）。
  //   beatMs から割り出していたので、gridMs だけ持つ timing を渡すと NaN になり、
  //   **押せない判定が丸ごと効かなくなる**（合成テストを書いたときに実際に踏んだ）。
  const gridMs=Number.isFinite(Number(timing.gridMs))
    ?Number(timing.gridMs):timing.beatMs/timing.subdivisionsPerBeat;
  const gridTimeMs=grid=>timing.beatZeroMs+grid*gridMs;
  const BAR=timing.subdivisionsPerBeat*(timing.beatsPerBar||4);
  return simulateActions(toActions(notes,gridTimeMs,BAR),options);
};

module.exports={toActions,simulateActions,simulateNotes,evaluateFinger,DEFAULT_BEAM};

if(require.main===module){
  // 合成テスト: 「いまだけ見れば左手が楽だが、左手を使うと次が取れない」配置。
  //   まず C(−200ms・レーン1)と D(−120ms・レーン3)で左右の指を置く
  //   (まだ一度も使っていない指は「どこにでも構えられる」扱いなので、先に使っておく)。
  //   A: 0ms   レーン2 (左は200ms余裕・右は120ms余裕なので、その場の物差しでは左が安い)
  //   B: 40ms  レーン0 (左がレーン2にいると 2レーン/40ms で限界超え。
  //                     右も 3→0 を160msで動かせない)
  //   正解は A を右手(3→2を120ms)で取り、左手をレーン1に残して B を取ること(1レーン/240ms)。
  // ★時刻は2026-09-12に広げた。それまでは D を−100ms・B を60msに置いていたが、
  //   「1本の指の叩き直しには距離とは別に restrikeLimitMs(105ms) が要る」と直した結果
  //   （それまでは1レーンなら56msで叩ける扱いだった）、正解の「右手で3→2を100ms」が
  //   5ms足りずに成立しなくなった。**配置の狙い（先読みなら解けるが、その場最適では解けない）
  //   は変えていない**。
  const timing={beatMs:20*4,gridMs:20,subdivisionsPerBeat:4,beatZeroMs:0,beatsPerBar:4};   // 1グリッド=20ms
  const at=(grid,lane)=>({type:'TAP',grid,lane:Math.max(0,Math.floor(lane)),subLane:lane*2-.5,subLaneWidth:1});   // 触る点=lane
  const notes=[at(-10,1),at(-6,3),at(0,2),at(2,0)];
  const greedy=simulateNotes(notes,timing,{beam:1});
  const beam=simulateNotes(notes,timing,{beam:8});
  const hand=fi=>fi===0?'左':fi===1?'右':'—';
  console.log(`その場最適(beam=1): 押せない ${greedy.impossible}件  ${greedy.issues.map(x=>x.detail).join(' / ')}`);
  console.log(`先読み(beam=8):     押せない ${beam.impossible}件  割り当て A=${hand(beam.assignments.get(2))} B=${hand(beam.assignments.get(3))}`);
  // 本当に押せない配置は、先読みでも押せないままであること
  const hopeless=[at(-10,1),at(-6,3),at(0,2),at(4,2)];
  const hopelessResult=simulateNotes(hopeless,timing,{beam:8});
  console.log(`同じ場所を80msで叩き直す配置: 押せない ${hopelessResult.impossible}件(1件のまま残るのが正しい)`);
  const ok=greedy.impossible===1&&beam.impossible===0&&beam.assignments.get(2)===1&&beam.assignments.get(3)===0&&hopelessResult.impossible>=1;
  console.log(ok?'\n合成テスト: 先読みで見つかる押し方が実在し、押せない配置は押せないまま':'\n合成テスト: 期待と違う');
  process.exit(ok?0:1);
}
