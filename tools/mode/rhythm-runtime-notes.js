#!/usr/bin/env node
// 配信している譜面(monster-hero/data/rhythm-mode.js)を、道具から読み書きするための共通部品。
//
// 【なぜ要るか】
// 譜面の検査はこれまで authoring/ の中間ファイル(grid単位)を見ていた。
// けれどプレイヤーが実際に遊ぶのは rhythm-mode.js のマーカーの中身(ms単位)で、
// そこへ入ったあとの配置は誰も測っていなかった。
// 実機の指摘(2026-09-05)「スライドノーツに他ノーツが重なってるパターンで
// 太さが同じぐらいのスライドノーツにくると物理的に押せない」は、まさにそこで起きていた。
//
// ここでは、
//   ・配信データをそのまま読む(ランタイムの関数を使うので、見た目と同じ幅・位置になる)
//   ・押せない重なりを見つける
//   ・マーカーの内側だけを書き戻す
// の3つを提供する。検査(-check)と修正(-fix)が同じ物差しを使うために切り出した。
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
const RUNTIME=path.join(ROOT,'monster-hero/data/rhythm-mode.js');
const {HAND_MODEL}=require('./rhythm-hand-model.js');

// 指の太さはレーン単位で決めてあるので、サブレーン(1レーン=2サブレーン)へ直して使う
const FINGER_GAP_SUB=HAND_MODEL.fingerMinGapLanes*2;

const loadRuntime=()=>{
  const source=fs.readFileSync(RUNTIME,'utf8');
  const context={console};
  vm.createContext(context);
  vm.runInContext(`${source}\nglobalThis.__x={RHYTHM_SONGS,RHYTHM_DEMO_SONG_IDS,RHYTHM_DIFFICULTIES,`
    +`rhythmHoldSpanAt,rhythmSlideExpectedLane,rhythmSlideWidthAt,rhythmSlideFittedLane,RHYTHM_SUB_LANE_COUNT,RHYTHM_MAX_SUB_LANE_WIDTH};`,context);
  return {source,...context.__x};
};

// ノーツが時刻 t に占めるサブレーンの範囲。見た目・入力の受け付けと同じ関数で出す。
const makeSpanAt=(rt)=>(note,timeMs)=>{
  if(note.type==='SLIDE'){
    const width=rt.rhythmSlideWidthAt(note,timeMs);
    const lane=rt.rhythmSlideExpectedLane(note,timeMs);
    const center=(rt.rhythmSlideFittedLane(lane,width)+.5)*2;
    return [center-width/2,center+width/2];
  }
  if(note.type==='HOLD'){
    const span=rt.rhythmHoldSpanAt(note,timeMs);
    return [span.subLane,span.subLane+span.subLaneWidth];
  }
  const subLane=Number(note.subLane),width=Number(note.subLaneWidth)||2;
  if(Number.isFinite(subLane))return [subLane,subLane+width];
  const lane=Number(note.lane)||0;
  return [lane*2,lane*2+2];
};
// 指にも太さがあるので、帯の端ぎりぎりには置けない。左右へ半径ぶん残した範囲が「置ける場所」。
// 指より狭い帯は動かす余地が無いので中心の1点になる(rhythm-hand-model.js と同じ考え方)。
const usableSpan=([lo,hi])=>{
  const radius=FINGER_GAP_SUB/2;
  if(hi-lo<=radius*2){const center=(lo+hi)/2;return [center,center];}
  return [lo+radius,hi-radius];
};
// 押さえ続けている指が実際にいられる範囲。
// usableSpan と違い、端まで寄せられるとは考えない。
// 次に何が来るかを知らないと端へ寄せて構えることはできないため
// (2026-09-05・実機の指摘「まだ物理的に押せない(押しづらすぎる？)箇所がある」)。
// SLIDEを押さえている指は経路に沿うので、中心から動かせない。
const HOLD_SHIFT_SUB=HAND_MODEL.holdShiftLanes*2;
const heldSpan=([lo,hi],isSlide)=>{
  const center=(lo+hi)/2;
  const shift=isSlide?0:Math.min((hi-lo)/4,HOLD_SHIFT_SUB);
  return [center-shift,center+shift];
};
// 2本の指をいちばん離して置いたときの距離
const maxSeparation=(a,b)=>Math.max(a[1]-b[0],b[1]-a[0]);
const noteEndMs=note=>Number(note.endTimeMs??note.timeMs);
const isHeld=note=>note.type==='HOLD'||note.type==='SLIDE';

// 押さえている帯と、その最中に来るノーツとで、指が2本入るか。
// 入らなければ「押さえている指を離すしかない」＝物理的に押せない。
const overlapConflicts=(notes,spanAt)=>{
  const out=[];
  for(let i=0;i<notes.length;i++){
    const held=notes[i];
    if(!isHeld(held))continue;
    const start=Number(held.timeMs),end=noteEndMs(held);
    const heldIsSlide=held.type==='SLIDE';
    for(let j=0;j<notes.length;j++){
      if(j===i)continue;
      const other=notes[j],otherStart=Number(other.timeMs),otherEnd=noteEndMs(other);
      // 相手の**開始時刻**だけでなく、2つが重なっている期間ぜんぶを見る。
      // 開始時点では離れていても、動くSLIDE同士は途中で近づくことがある
      const from=Math.max(start,otherStart),to=Math.min(end,otherEnd);
      if(to<from-1)continue;
      let worst=Infinity,worstAt=from;
      for(let t=from;t<=to+1;t+=20){
        const separation=maxSeparation(
          heldSpan(spanAt(held,t),heldIsSlide),
          heldSpan(spanAt(other,t),other.type==='SLIDE'));
        if(separation<worst){worst=separation;worstAt=t;}
      }
      if(worst+1e-9<FINGER_GAP_SUB)out.push({heldIndex:i,noteIndex:j,timeMs:worstAt,separation:worst});
    }
  }
  return out;
};

// 近いのに速い2音。指が2本入らない近さなのに、1本で叩き直すには間隔が足りない組み合わせ。
// (rhythm-hand-model.js の fingerPairFeasible と同じ考え方を、配信データの ms 単位で見る)
const fastPairConflicts=(notes,spanAt)=>{
  const order=notes.map((note,index)=>({note,index})).sort((a,b)=>Number(a.note.timeMs)-Number(b.note.timeMs));
  const out=[];
  for(let a=1;a<order.length;a++){
    for(let b=a-1;b>=0;b--){
      const dt=Number(order[a].note.timeMs)-Number(order[b].note.timeMs);
      if(dt>=HAND_MODEL.restrikeLimitMs)break;   // ここより前は同じ指で叩き直せる
      if(dt<1)continue;                          // 同時押しは重なりの側で見る
      const gap=maxSeparation(
        heldSpan(spanAt(order[a].note,Number(order[a].note.timeMs)),order[a].note.type==='SLIDE'),
        heldSpan(spanAt(order[b].note,Number(order[b].note.timeMs)),order[b].note.type==='SLIDE'));
      if(gap+1e-9<FINGER_GAP_SUB)out.push({laterIndex:order[a].index,earlierIndex:order[b].index,
        timeMs:Number(order[a].note.timeMs),deltaMs:dt,separation:gap});
    }
  }
  return out;
};

// --- マーカーの内側を書き戻す ---
// 行の書き方は tools/mode/rhythm-chart-v3-pipeline.js の runtimeRow と同じにする。
// ここがずれると、直していないノーツまで差分に出てしまう。
const runtimeRow=note=>{
  const time=Math.round(Number(note.timeMs));
  if(note.type==='SLIDE'){
    const points=note.slidePoints.map(p=>`[${Math.round(Number(p.timeMs))},${p.lane},${p.subLaneWidth}]`).join(',');
    return `s(${time},${Math.round(noteEndMs(note))},[${points}]${note.endFlick===true?',1':''})`;
  }
  if(note.type==='HOLD'){
    const taper=Array.isArray(note.holdPoints)&&note.holdPoints.length>=2
      ?`,[${note.holdPoints.map(p=>`[${Math.round(Number(p.timeMs))},${p.subLane},${p.subLaneWidth}]`).join(',')}]`
      :'';
    const flick=taper?(note.endFlick===true?',1':',0'):(note.endFlick===true?',1':'');
    return `h(${time},${note.subLane},${note.subLaneWidth},${Math.round(noteEndMs(note))}${flick}${taper})`;
  }
  if(note.type==='FLICK')return `f(${time},${note.subLane},${note.subLaneWidth})`;
  return `t(${time},${note.subLane},${note.subLaneWidth},${note.monsterSlot||0})`;
};
const markerBlock=(source,marker)=>{
  const begin=`// <${marker}-notes>`,end=`// </${marker}-notes>`;
  const b=source.indexOf(begin),e=source.indexOf(end);
  if(b<0||e<b)return null;
  return {begin,end,from:b+begin.length,to:e,body:source.slice(b+begin.length,e)};
};
const renderBlock=notes=>{
  const rows=[...notes].sort((a,b)=>Number(a.timeMs)-Number(b.timeMs)).map(runtimeRow);
  const lines=[];
  for(let i=0;i<rows.length;i+=4)lines.push('  '+rows.slice(i,i+4).join(',')+',');
  return `\n${lines.join('\n')}\n`;
};
const replaceBlock=(source,marker,notes)=>{
  const block=markerBlock(source,marker);
  if(!block)throw new Error(`マーカーが見つかりません: ${marker}`);
  return source.slice(0,block.from)+renderBlock(notes)+source.slice(block.to);
};

// 先行公開している5曲と、その譜面が入っているマーカー名の対応。
// マーカー名は曲idと違う(音源のidから作られている)ので、ここで1か所にまとめる。
const RELEASED_MARKERS=Object.freeze({
  mf_ichika_mix:'atsu-cup-theme-v3',
  monster_hero:'monster-hero-v3',
  six_eternel_remix:'six-eternel-remix-beat-v3',
  stay_with_me:'pandora-boss-v3',
  kiki_issen:'eiki-boss-v3',
});

module.exports={heldSpan,HOLD_SHIFT_SUB,ROOT,RUNTIME,FINGER_GAP_SUB,loadRuntime,makeSpanAt,usableSpan,maxSeparation,
  noteEndMs,isHeld,overlapConflicts,fastPairConflicts,runtimeRow,markerBlock,renderBlock,replaceBlock,RELEASED_MARKERS};
