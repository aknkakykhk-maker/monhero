#!/usr/bin/env node
// 譜面まわりで共通して使う「手の物理条件」。
//
// スマホを両手で持って親指2本で押す、という前提を1か所にまとめてある。
// STEP3(生成) / STEP6(プレイ可能性検査) / STEP7(自動修正) が同じ値を見るために切り出した。
// 道具ごとに書き直すと、直したつもりで別の物差しになってしまう。
//
// 【2026-09-05・実機の指摘で作った】
// 「1枠を隣り合わせで交互に連続押しは物理的に不可能だからそういう譜面は作らないようにして。
//   もちろん速度と押すスピードによるから譜面作成ツールの精度をもっと上げてほしい」
//
// それまでのモデルには**指の太さ**が入っていなかった。同時押しのときだけ「1レーン以上離れて
// いること」を見ていて、時間がずれた連続ノーツには何の条件も無かった。そのため
// 「16分(87ms)おきに、触る点が0.25レーンしか離れていない交互押し」が
// 「押せる」と判定され、実際にHARDへ21箇所、EXPERT/MASTERへ70箇所以上出ていた。
//
// 指は2本しかなく、太さがある。連続する2音は次のどちらかでなければ押せない。
//
//   ・**指2本で分担する** … 触る点どうしが fingerMinGapLanes 以上離れている
//   ・**指1本で叩き直す** … 間隔が restrikeLimitMs 以上あり、その時間で移動しきれる距離
//
// どちらでもない「近いのに速い」組み合わせが、物理的に不可能な配置になる。
'use strict';

const HAND_MODEL=Object.freeze({
  // 親指2本
  hands:2,
  // 1本の指がレーンをまたぐ速さ(レーン毎秒)。快適/限界の2段。
  laneSpeedComfort:10,
  laneSpeedLimit:18,
  // 同じ指で叩き直すのに要る間隔。
  // 以前は限界55ms(＝毎秒18連打)としていたが、親指1本で18連打は出せない。
  // 実測される連打の上限は速い人でも毎秒9〜10なので、限界105ms・快適150msへ直した。
  restrikeComfortMs:150,
  restrikeLimitMs:105,
  // 指の太さ。触る点がこれより近いと、指が2本入らない(＝1本で処理するしかない)。
  // 同時押しの最低レーン差もこれと同じ値を使う。
  fingerMinGapLanes:1,
  // HOLD/SLIDEを離してから次を押すまでの余裕
  releaseMarginMs:30,
  // 終点フリックは「弾いて戻す」ぶん、指の解放が遅れる
  endFlickReleaseMs:80,
});

// ノーツの「指を置ける範囲」。レーン単位([0,5])で返す。
// 幅の広いノーツは端から端まで好きな場所を押せるので、1点ではなく範囲で持つ。
// (幅8のノーツの真ん中しか押せない、という前提で見ると、実際には押せる配置まで弾いてしまう)
const noteTouchSpan=note=>{
  if(!note)return [0,0];
  const widthLanes=(Number(note.subLaneWidth)||2)/2;
  const subLane=Number(note.subLane);
  if(Number.isFinite(subLane))return [subLane/2,subLane/2+widthLanes];
  const lane=Number(note.lane)||0;   // SLIDEの lane は経路の中心線
  return [lane-widthLanes/2,lane+widthLanes/2];
};
// 指にも太さがあるので、ノーツの端ぎりぎりには置けない。
// 左右へ指の半径ぶんを残した範囲が「実際に置ける場所」。
// 指の幅より狭いノーツ(幅1〜2)は動かす余地が無いので中心の1点になる。
const usableTouchSpan=note=>{
  const [lo,hi]=noteTouchSpan(note);
  const radius=HAND_MODEL.fingerMinGapLanes/2;
  if(hi-lo<=radius*2){const center=(lo+hi)/2;return [center,center];}
  return [lo+radius,hi-radius];
};
// 2つの範囲の「いちばん近づけたときの距離」と「いちばん離したときの距離」
const separationRange=(a,b)=>({
  min:a[1]<b[0]?b[0]-a[1]:(b[1]<a[0]?a[0]-b[1]:0),
  max:Math.max(a[1]-b[0],b[1]-a[0]),
});

// 連続する2音が押せるかどうか。
//   noteA / noteB … ノーツ(幅と位置を見る)
//   deltaMs       … 2音の時間差(ms)
// 返り値 { ok, by, reason }
//   by='twoFinger' … 指2本を1レーン以上離して置ける
//   by='oneFinger' … 指1本で叩き直せる
const fingerPairFeasible=(noteA,noteB,deltaMs)=>{
  const a=usableTouchSpan(noteA),b=usableTouchSpan(noteB);
  const {min,max}=separationRange(a,b);
  const dt=Math.max(0,Number(deltaMs)||0);
  if(max+1e-9>=HAND_MODEL.fingerMinGapLanes)return {ok:true,by:'twoFinger'};
  // 指2本を離して置けない近さ。1本で叩き直すしかない。
  if(dt+1e-9<HAND_MODEL.restrikeLimitMs){
    return {ok:false,by:null,
      reason:`指を離しても${max.toFixed(2)}レーンしか空かず指が2本入らないのに、`
        +`${Math.round(dt)}msでは同じ指で叩き直せない(最低${HAND_MODEL.restrikeLimitMs}ms)`};
  }
  const reach=dt/1000*HAND_MODEL.laneSpeedLimit;
  if(min>reach+1e-9){
    return {ok:false,by:null,
      reason:`${min.toFixed(2)}レーンを${Math.round(dt)}msで動かせない(限界${HAND_MODEL.laneSpeedLimit}レーン毎秒)`};
  }
  return {ok:true,by:'oneFinger'};
};

// 押せるが忙しい(快適の側を満たさない)かどうか。押せないときは null を返す。
const fingerPairStrain=(noteA,noteB,deltaMs)=>{
  const feasible=fingerPairFeasible(noteA,noteB,deltaMs);
  if(!feasible.ok||feasible.by==='twoFinger')return null;
  const {min}=separationRange(usableTouchSpan(noteA),usableTouchSpan(noteB));
  const dt=Math.max(0,Number(deltaMs)||0);
  if(dt+1e-9<HAND_MODEL.restrikeComfortMs)
    return `同じ指の叩き直しが${Math.round(dt)}ms(快適には${HAND_MODEL.restrikeComfortMs}ms欲しい)`;
  if(min>dt/1000*HAND_MODEL.laneSpeedComfort+1e-9)
    return `${min.toFixed(2)}レーンの移動が${Math.round(dt)}ms(快適には${HAND_MODEL.laneSpeedComfort}レーン毎秒まで)`;
  return null;
};

// ノーツの「触る点」の目安(中心)。レーンの偏りを数えるときなど、1点で表したいときに使う。
const noteTouchLane=note=>{
  const [lo,hi]=noteTouchSpan(note);
  return (lo+hi)/2;
};

module.exports={HAND_MODEL,fingerPairFeasible,fingerPairStrain,
  noteTouchLane,noteTouchSpan,usableTouchSpan,separationRange};
