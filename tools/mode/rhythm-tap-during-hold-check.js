#!/usr/bin/env node
// 押さえている HOLD / SLIDE の上へ「重なって」降ってくるノーツを叩けるか。
//
//   node tools/mode/rhythm-tap-during-hold-check.js
//
// 【なぜ要るか】(2026-09-18・プレイヤーの声)
//   「スライドやホールド中の被りノーツを押しても判定されてない気がする」
//
// 押さえながら別のノーツを叩く形(HAND_MODEL の tapDuringHold。EXPERT以上で出る)は、
// 叩く場所が**押さえている帯の内側**になることがふつうにある。
// ところが 2026-09-18 に入れた持ち替えの直し(#1493)は、
// 「押さえている帯の内側へ置いた指は、相手を決める前に控え(持ち替えの2本目)へ回す」
// という作りだったので、**そこへ降ってくるノーツが1本も叩けなくなっていた**。
//
// ★どちらも成り立たせる必要がある。見分けは「幅を持って重なっているか」。
//   ・帯と重なっているノーツの、その重なりの上へ置いた … そのノーツを叩きたい  → 取れる
//   ・帯の端に**接しているだけ**の隣のノーツ           … 狙いは持ち替えのほう  → 控え(#1493)
//   ・帯の内側だが、叩ける相手がいない                 … 持ち替えの2本目       → 控え
//
// ★この形を見る検査が1本も無かったので、#1493 は全部の検査を通ったまま入った。
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const src=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');

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
vm.runInContext(src+'\nglobalThis.__x={rhythmMatchInputBatch,RHYTHM_GESTURE_RUNTIME,rhythmHandoverSpanAt};',ctx);
const X=ctx.__x,match=X.rhythmMatchInputBatch;

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

const at=(key,sub)=>({inputKey:key,lane:Math.floor(sub/2),subLaneCoordinate:sub});
// 1本目が押さえている帯。HOLD は サブレーン2〜6、SLIDE は 1〜5(はめ込みのぶんずれる)
const hold=()=>({index:0,type:'HOLD',timeMs:0,endTimeMs:3000,lane:1,subLane:2,subLaneWidth:4,
  done:false,activePointerId:'touch:1'});
const slide=()=>({index:0,type:'SLIDE',timeMs:0,endTimeMs:3000,lane:1,endLane:1,subLane:2,subLaneWidth:4,
  slidePoints:[{timeMs:0,lane:1,subLaneWidth:4},{timeMs:3000,lane:1,subLaneWidth:4}],
  done:false,activePointerId:null});
// 帯の上へ重ねて置かれたノーツ(被りノーツ)
const over=(type,sub)=>({index:1,type,timeMs:1500,lane:Math.floor(sub/2),subLane:sub,subLaneWidth:2,
  done:false,endTimeMs:type==='HOLD'?2500:undefined,activePointerId:null});

const play=(held,other,sub,now=1500)=>{
  X.RHYTHM_GESTURE_RUNTIME.clear();
  held.activePointerId='touch:1';
  const r=match([held,other],[at('touch:2',sub)],now,0)[0];
  return {...r,held,other};
};

// ── 本題。帯の上へ重なって降ってくるノーツは叩ける ──
for(const [label,make] of [['長押し',hold],['スライド',slide]]){
  for(const type of ['TAP','FLICK','HOLD']){
    const r=play(make(),over(type,3),4);
    check(`${label}を押さえている最中でも、重なって降ってくる${type}を叩ける`,
      r.target===r.other,
      r.target?`取ったもの=index ${r.target.index}`:(r.standby?'控えにされた(＝叩けない)':'空打ち'));
  }
}
// 押さえているほうを横取りしない(1本目はそのまま押さえ続ける)
{
  const r=play(hold(),over('TAP',3),4);
  check('叩いても、押さえているほうは横取りされない',
    r.target!==r.held&&r.held.activePointerId==='touch:1',
    `押さえている指=${r.held.activePointerId}`);
}
// ── 接しているだけの隣のノーツは、これまでどおり控え(#1493を戻さない) ──
{
  // SLIDEの帯は 1〜5。隣のノーツは 5〜7 で、境界の1点(5.0)だけが接している
  const next=()=>({index:1,type:'TAP',timeMs:1500,lane:2,subLane:5,subLaneWidth:2,done:false,activePointerId:null});
  for(const spot of [4.4,4.6,4.8,5.0]){
    const s=slide();s.activePointerId='touch:1';
    const r=play(s,next(),spot);
    check(`帯の内側(${spot})へ置いた2本目は、接しているだけの隣のノーツに取られない`,
      !r.target&&r.standby===r.held,
      r.target?`取ったもの=index ${r.target.index}`:(r.standby?'控え':'空打ち'));
  }
  // 帯の外は、これまでどおり普通のノーツを取る
  const s=slide();
  const r=play(s,next(),5.2);
  check('帯の外(5.2)へ置いた指は、これまでどおり隣のノーツを取る',r.target===r.other,
    r.target?`取ったもの=index ${r.target.index}`:'取れなかった');
}
// ── 叩ける相手がいなければ、これまでどおり控え(持ち替えの2本目) ──
{
  const r=play(hold(),{index:1,type:'TAP',timeMs:9000,lane:4,subLane:8,subLaneWidth:2,done:false,activePointerId:null},4);
  check('帯の内側でも、叩ける相手がいなければ控えにする(持ち替え)',
    !r.target&&r.standby===r.held,r.target?'取ってしまった':'控え');
}
// 時刻が窓の外の被りノーツも、控えのまま(まだ来ていないものを先に食べない)
{
  const late=over('TAP',3);late.timeMs=3000;
  const r=play(hold(),late,4);
  check('まだ来ていない被りノーツは先に取らない(控えのまま)',
    !r.target&&r.standby===r.held,r.target?'取ってしまった':'控え');
}

// ── 実際の譜面に、この形がどれだけあるか ──
{
  const {loadRuntime,makeSpanAt,noteEndMs}=require('./rhythm-runtime-notes.js');
  const rt=loadRuntime();
  const spanAt=makeSpanAt(rt);
  let total=0;
  for(const song of rt.RHYTHM_SONGS){
    for(const d of rt.RHYTHM_DIFFICULTIES){
      const chart=song.difficulties[d.id];
      if(!chart||!Array.isArray(chart.notes))continue;
      const held=chart.notes.filter(n=>n.type==='HOLD'||n.type==='SLIDE');
      for(const note of chart.notes){
        if(note.type==='HOLD'||note.type==='SLIDE')continue;
        const t=Number(note.timeMs),[lo,hi]=spanAt(note,t);
        for(const h of held){
          if(!(t>Number(h.timeMs)+1&&t<noteEndMs(h)-1))continue;
          const [hlo,hhi]=spanAt(h,t);
          const start=Math.max(lo,hlo),end=Math.min(hi,hhi);
          if(end>start){total++;break;}
        }
      }
    }
  }
  check('配信中の譜面にこの形が実際にある(対象が消えたら検査の意味も消える)',total>0,`${total}本`);
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
