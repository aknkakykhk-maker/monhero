#!/usr/bin/env node
// 「1本の指で叩き直す間隔」の物差しが、少し動いただけで**人間に無理な速さ**を
// 許していないことを確かめる。
//
//   node tools/mode/rhythm-hand-restrike-check.js
//
// 【なぜ要るか】(2026-09-12)
// 手のモデル(rhythm-hand-simulate.js の evaluateFinger)は、同じレーンの叩き直しだけ
// restrikeLimitMs(105ms) を見ていて、**少しでも動くなら距離だけで判定**していた。
// 0.5レーンなら 0.5/18*1000 = 28ms ＝ **1本の指で毎秒36打**が「押せる」扱いになる。
//
// 実測で、譜面の「交互率」が低い原因はこれだった。16分で並ぶ2打のうち同じ指に
// 割り当てられた233組を調べると、レーン差は 0.3〜0.8（＝ほぼ同じレーン）で
// 間隔の中央は83ms。人間には無理な速さなのに「忙しい」とも言われていなかった(230/233)。
//
// 指を持ち上げて押し直すぶんの時間は、動く距離とは別に必ず要る。
// なので限界は **max(叩き直しの下限, 距離ぶんの移動時間)**。
'use strict';
const path=require('path');
const {HAND_MODEL}=require('./rhythm-hand-model.js');
const {simulateNotes}=require('./rhythm-hand-simulate.js');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// BPM 180・16分＝83.3ms。5レーンのうち2か所を、指1本しか空いていない状態で叩かせる。
// ★timing には beatMs も gridMs も入れる。simulateNotes が gridMs を正本にする前は
//   beatMs から割り出していたので、片方だけ渡すと NaN になって**押せない判定が丸ごと
//   効かなくなる**（この検査を書いたときに実際に踏んだ）。
const timing=Object.freeze({bpm:180,beatMs:60000/180,beatZeroMs:0,
  subdivisionsPerBeat:4,beatsPerBar:4,gridMs:60000/180/4});
const gridMs=timing.gridMs;
const tap=(grid,subLane,width=2)=>({type:'TAP',grid,subLane,subLaneWidth:width,lane:Math.floor(subLane/2)});

// ── ① 指が2本空いていれば、16分で1レーン離れた2打は「交互で」取れる ──────────
// 1レーン離れていれば指2本が入る(fingerMinGapLanes=1)。
// 1本で叩くには max(105ms, 1レーンぶん56ms)=105ms 要るので、83msでは交互しかない。
{
  const notes=[tap(0,4),tap(1,6)];   // 1レーン差・83ms
  const sim=simulateNotes(notes,timing);
  const fingers=notes.map((note,index)=>sim.assignments.get(index));
  ok('指が2本空いていれば、16分で1レーン離れた2打は押せる',sim.impossible===0,
    `押せない${sim.impossible}件`);
  // ★ここが本題。1本で叩ける扱いにすると、ここが交互にならない（＝譜面の交互率が落ちる）
  ok('その2打は左右の指へ振り分けられる',fingers[0]!==fingers[1],
    `割り当て ${fingers.join(' / ')}`);
}

// ── ② 押さえっぱなしで指が1本ふさがっていたら、同じ2打は押せない ────────────────
// 残った1本では 83ms で叩き直せない。**ここが直す前は「押せる」になっていた**。
{
  const hold={type:'HOLD',grid:0,durationGrids:64,subLane:0,subLaneWidth:2,lane:0};
  const notes=[hold,tap(16,4),tap(17,6)];   // 残り1本で 1レーン差・83ms
  const sim=simulateNotes(notes,timing);
  ok('指が1本しか空いていないと、16分で1レーン離れた2打は押せない',sim.impossible>0,
    `押せない${sim.impossible}件`);
}

// ── ③ 叩き直しの下限が「距離に関係なく」効く ────────────────────────────────────
{
  const need=HAND_MODEL.restrikeLimitMs;
  const rows=[],broken=[];
  for(const {distanceSub,label} of [{distanceSub:0,label:'同じレーン'},{distanceSub:2,label:'1レーン'}]){
    // 指1本しか使えない状況を作り、下限のすぐ下／すぐ上で押せるかを見る
    const hold={type:'HOLD',grid:0,durationGrids:96,subLane:0,subLaneWidth:2,lane:0};
    const under=Math.max(1,Math.floor((need-5)/gridMs));
    const over=Math.ceil((need+25)/gridMs);
    const a=simulateNotes([hold,tap(24,4),tap(24+under,4+distanceSub)],timing);
    const b=simulateNotes([hold,tap(24,4),tap(24+over,4+distanceSub)],timing);
    rows.push(`${label}: ${(under*gridMs).toFixed(0)}ms→${a.impossible>0?'押せない':'押せる'} / ${(over*gridMs).toFixed(0)}ms→${b.impossible>0?'押せない':'押せる'}`);
    if(!(a.impossible>0&&b.impossible===0))broken.push(label);
  }
  ok(`叩き直しの下限(${need}ms)が距離に関係なく効く`,broken.length===0,rows.join('  '));
}

// ── ④ 大きく動くときは移動時間のほうが効く ──────────────────────────────────
{
  const travelMs=4/HAND_MODEL.laneSpeedLimit*1000;   // 4レーン
  ok('4レーンの移動は叩き直しの下限より時間が要る(移動時間が効く)',
    travelMs>HAND_MODEL.restrikeLimitMs,
    `4レーン ${travelMs.toFixed(0)}ms > 下限 ${HAND_MODEL.restrikeLimitMs}ms`);
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
