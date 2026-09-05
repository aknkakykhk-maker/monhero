#!/usr/bin/env node
// 押さえている帯の上に別のノーツが重なって「指が2本入らない」配置を、配信中の譜面から取り除く。
//
//   node tools/mode/rhythm-overlap-reach-fix.js            # 直す場所を数えるだけ
//   node tools/mode/rhythm-overlap-reach-fix.js --write    # rhythm-mode.js のマーカーの内側だけ直す
//   node tools/mode/rhythm-overlap-reach-fix.js --verbose  # 1件ずつ出す
//
// 【なぜ要るか】
// 実機の指摘(2026-09-05)
//   「スライドノーツに他ノーツが重なってるパターンで、
//     太さが同じぐらいのスライドノーツにくると物理的に押せない」
//
// SLIDE / HOLD を押さえている指は、その帯から離れられない。
// そこへ重なって別のノーツが来たとき、2本目の指を置く場所が
// 帯から指の太さぶん離れていなければ、指が物理的に入らない。
// 幅の広いSLIDEに幅の広いTAPが重なると、2つ合わせて5レーンを超えてしまい、
// どこにも指が入らなくなる。これが「押せない」の正体。
//
// これまでの検査(STEP6)は authoring の grid データで、しかも
//   ・同時押しのレーン差
//   ・105ms以内に並ぶ2音の指の太さ
// しか見ていなかった。長いSLIDEの**途中**に重なるノーツは、
// 「前のHOLD/SLIDEを押さえている指は使えない」ので**もう片方の指へ回す**とだけ判定し、
// その指が入る隙間があるかどうかは誰も測っていなかった。
//
// 【直し方】
// 動かすのは重なってきた側(TAP / FLICK / HOLD)だけ。押さえている帯そのものは動かさない。
// 帯を動かすと経路が丸ごと変わって、曲との合い方まで崩れるため。
//   ① 元の位置にいちばん近い、指が入るサブレーンへ寄せる
//   ② それでも入らなければ、幅を1つずつ細くして寄せ直す
//   ③ どうしても入らない場合だけ、そのノーツを外す(件数を報告する)
// 寄せ先は「ほかの同時押し」「105ms以内の前後の音」とも指が2本入ることを確かめてから決める。
'use strict';
const fs=require('fs');
const rt0=require('./rhythm-runtime-notes.js');
const {HAND_MODEL}=require('./rhythm-hand-model.js');

const write=process.argv.includes('--write');
const verbose=process.argv.includes('--verbose');

const runtime=rt0.loadRuntime();
const spanAt=rt0.makeSpanAt(runtime);
const SUB_MAX=runtime.RHYTHM_SUB_LANE_COUNT;                 // 10
const WIDTH_MAX=runtime.RHYTHM_MAX_SUB_LANE_WIDTH;
const GAP=rt0.FINGER_GAP_SUB;                                // 指の太さ(サブレーン)
const RESTRIKE_MS=HAND_MODEL.restrikeLimitMs;

const cloneNote=note=>JSON.parse(JSON.stringify(note));
// subLane を持つノーツを、幅はそのままに別のサブレーンへ寄せる(HOLDの帯も同じだけ動かす)
const movedNote=(note,subLane,width)=>{
  const next=cloneNote(note);
  const deltaLane=subLane-Number(note.subLane);
  const deltaWidth=width-Number(note.subLaneWidth);
  next.subLane=subLane;next.subLaneWidth=width;next.lane=Math.floor(subLane/2);
  if(Array.isArray(next.holdPoints)){
    next.holdPoints=next.holdPoints.map(point=>({
      ...point,
      subLane:Math.max(0,Math.min(SUB_MAX-1,Number(point.subLane)+deltaLane)),
      subLaneWidth:Math.max(1,Math.min(WIDTH_MAX,Number(point.subLaneWidth)+deltaWidth)),
    }));
  }
  return next;
};
// 動かせるのは subLane を持つノーツだけ。SLIDEは経路そのものなので動かさない
const movable=note=>(note.type==='TAP'||note.type==='FLICK'||note.type==='HOLD')
  &&Number.isFinite(Number(note.subLane));

// candidate を置いたときに、ほかのノーツと指が2本入るか
const fits=(notes,index,candidate)=>{
  const start=Number(candidate.timeMs),end=rt0.noteEndMs(candidate);
  // 押さえている帯と重なる時間帯は、始点だけでなく何点かで見る
  // (HOLDは押さえているあいだずっと指が要るため)
  const samples=start===end?[start]:[start,(start+end)/2,end];
  for(let j=0;j<notes.length;j++){
    if(j===index)continue;
    const other=notes[j],at=Number(other.timeMs),otherEnd=rt0.noteEndMs(other);
    // ① 相手が押さえている帯で、こちらの時間と重なる
    if(rt0.isHeld(other)){
      for(const t of samples){
        if(t<at-1||t>otherEnd+1)continue;
        if(rt0.maxSeparation(rt0.usableSpan(spanAt(other,t)),rt0.usableSpan(spanAt(candidate,t)))+1e-9<GAP)return false;
      }
    }
    // ② こちらが押さえている帯で、相手がその最中に来る
    if(rt0.isHeld(candidate)&&at>=start-1&&at<=end+1){
      if(rt0.maxSeparation(rt0.usableSpan(spanAt(candidate,at)),rt0.usableSpan(spanAt(other,at)))+1e-9<GAP)return false;
    }
    // ③ 同時押し・105ms以内に並ぶ音は、指の太さぶん離れていないと2本入らない
    const dt=Math.abs(at-start);
    if(dt<RESTRIKE_MS){
      if(rt0.maxSeparation(rt0.usableSpan(spanAt(candidate,start)),rt0.usableSpan(spanAt(other,at)))+1e-9<GAP)return false;
    }
  }
  return true;
};

let totalBefore=0,totalBeforeFast=0,totalMoved=0,totalNarrowed=0,totalDropped=0,changedCharts=0;
let source=runtime.source;
// 触ってよいのは先行公開5曲のマーカーだけ。ほかの譜面(v1・候補v2・デバッグ曲)を
// 巻き添えで書き換えていないことを、書き込む前に必ず確かめる
// (tools/mode/rhythm-chart-v3-pipeline.js と同じ守り方)
const OWN=new Set(Object.values(rt0.RELEASED_MARKERS)
  .flatMap(marker=>['easy','normal','hard','expert','master'].map(d=>`${marker}-${d}`)));
const snapshot=text=>[...text.matchAll(/\/\/ <([a-z0-9-]+)-notes>/g)]
  .map(match=>match[1]).filter(name=>!OWN.has(name))
  .map(name=>`${name}:${(rt0.markerBlock(text,name)||{body:''}).body}`);
const beforeSnapshot=snapshot(source);

for(const [songId,marker] of Object.entries(rt0.RELEASED_MARKERS)){
  const song=runtime.RHYTHM_SONGS.find(entry=>entry.songId===songId);
  for(const difficulty of ['EASY','NORMAL','HARD','EXPERT','MASTER']){
    const chart=song.difficulties[difficulty];
    if(!chart||!chart.notes.length)continue;
    let notes=chart.notes.map(cloneNote);
    const before=rt0.overlapConflicts(notes,spanAt);
    // 「近いのに速い」2音も、指が2本入らないという点では同じ不具合。
    // 同じ物差しで見つかるので、ここでまとめて直す(直し方も同じ)
    const beforeFast=rt0.fastPairConflicts(notes,spanAt);
    if(!before.length&&!beforeFast.length)continue;
    totalBefore+=before.length;totalBeforeFast+=beforeFast.length;
    // 直す対象は「重なってきた側」と「あとから来た音」。同じノーツが何度も出てくるのでまとめる
    const targets=[...new Set([...before.map(c=>c.noteIndex),...beforeFast.map(c=>c.laterIndex),
      ...beforeFast.map(c=>c.earlierIndex)])].sort((a,b)=>a-b);
    const dropped=new Set();
    for(const index of targets){
      const note=notes[index];
      if(!movable(note)){
        // 押さえている帯どうしが重なっている場合。動かす先が無いので、
        // 重なってきた側(相手)を直す機会に任せる(ここでは触らない)
        continue;
      }
      if(fits(notes,index,note))continue;   // ほかのノーツが動いた結果、すでに解消していることがある
      const width0=Number(note.subLaneWidth);
      let fixed=null,narrowed=false;
      for(let width=width0;width>=1&&!fixed;width--){
        const candidates=[];
        for(let subLane=0;subLane+width<=SUB_MAX;subLane++)candidates.push(subLane);
        // 元の位置に近い順。同じ距離なら小さいほうを先に見る(結果を毎回同じにするため)
        candidates.sort((a,b)=>Math.abs(a-note.subLane)-Math.abs(b-note.subLane)||a-b);
        for(const subLane of candidates){
          const candidate=movedNote(note,subLane,width);
          if(fits(notes,index,candidate)){fixed=candidate;narrowed=width!==width0;break;}
        }
      }
      if(fixed){
        notes[index]=fixed;
        if(narrowed)totalNarrowed++;else totalMoved++;
        if(verbose)console.log(`  ${songId} ${difficulty} ${Math.round(note.timeMs)}ms ${note.type}`
          +` サブレーン${note.subLane}幅${width0} → ${fixed.subLane}幅${fixed.subLaneWidth}`);
      }else{
        dropped.add(index);totalDropped++;
        if(verbose)console.log(`  ${songId} ${difficulty} ${Math.round(note.timeMs)}ms ${note.type} は置き場所が無いので外しました`);
      }
    }
    if(dropped.size)notes=notes.filter((_,index)=>!dropped.has(index));
    const after=rt0.overlapConflicts(notes,spanAt);
    const afterFast=rt0.fastPairConflicts(notes,spanAt);
    console.log(`${songId} ${difficulty}: 重なり ${before.length}→${after.length}件`
      +` / 近いのに速い ${beforeFast.length}→${afterFast.length}件`
      +`（ノーツ ${chart.notes.length} → ${notes.length}）`);
    changedCharts++;
    source=rt0.replaceBlock(source,`${marker}-${difficulty.toLowerCase()}`,notes);
  }
}

console.log(`\n押せない重なり ${totalBefore}件 / 近いのに速い ${totalBeforeFast}件`
  +` → 寄せた ${totalMoved} ・ 細くして寄せた ${totalNarrowed} ・ 外した ${totalDropped}`);
if(!changedCharts){console.log('直すところはありません。');process.exit(0);}
if(!write){console.log('※ --write を付けると rhythm-mode.js のマーカーの内側だけを直します。');process.exit(0);}
const afterSnapshot=snapshot(source);
if(beforeSnapshot.length!==afterSnapshot.length
  ||beforeSnapshot.some((text,index)=>text!==afterSnapshot[index])){
  console.error('✗ 先行公開5曲以外の譜面まで書き換えようとしました。中止します。');
  process.exit(1);
}
fs.writeFileSync(rt0.RUNTIME,source);
console.log(`書き戻しました: monster-hero/data/rhythm-mode.js（先行公開5曲のマーカーの内側だけ）`);
console.log('※ この後は node tools/build.js を実行してください。');
