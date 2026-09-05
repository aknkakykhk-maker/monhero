#!/usr/bin/env node
// 叩いたとき「狙ったノーツ」ではなく「次のノーツ」を取っていないかを確かめる。
//
//   node tools/mode/rhythm-near-note-match-check.js
//
// 【なぜ要るか】
// どのノーツを叩いたことにするかを、時間の差の**絶対値**がいちばん小さいもので
// 決めていた。これだと次のノーツとの間隔の半分を超えて遅れた瞬間、
// 次のノーツのほうが「近い」ことになって判定がそちらへ移る。
// BPM170の8分(176ms間隔)なら89ms、16分(88ms)なら45ms遅れただけで起きていた
// (2026-09-05・ユーザー指摘「近くに次のノーツがあるときに判定がそっちにいってる」)。
// しかも取られた次のノーツは本来の時刻には既に消えているので、1回の遅れで2つ崩れる。
//
// いまは「時刻を過ぎたノーツ(遅れて叩いているぶん)」を先に見て、
// そのなかでは**いちばん後ろ**(時刻の新しいほう)を取る。
// つまり1つのノーツが取られるのは「次のノーツの時刻が来るまで」。
// 前へ流れる(1回目の指摘)ことも、後ろを巻き込む(2回目の指摘)こともない。
// この検査は、その順番が守られているかを実際に関数を動かして確かめる。
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const prefix=source.split('const emptyRhythmChart',1)[0];
const ctx={console,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}};
vm.createContext(ctx);
vm.runInContext(prefix+'\nthis.out={rhythmMatchInputBatch,RHYTHM_INPUT_MATCH_WINDOW_MS,RHYTHM_JUDGMENTS};',ctx);
const {rhythmMatchInputBatch,RHYTHM_INPUT_MATCH_WINDOW_MS:WINDOW}=ctx.out;

const note=(timeMs,index,extra={})=>({type:'TAP',timeMs,lane:2,subLane:5,subLaneWidth:2,
  done:false,activePointerId:null,index,...extra});
// 叩いた結果、何番めのノーツが取れたか(0始まり)。取れなければ null
const hit=(notes,at,coordinate=6)=>{
  const result=rhythmMatchInputBatch(notes,[{inputKey:`k${at}`,lane:2,subLaneCoordinate:coordinate}],at,0);
  return result[0].target?result[0].target.index:null;
};

// --- 本題: 遅れて叩いても、次のノーツへ移らない ---
// 判定の受付幅より狭い間隔で並ぶ形すべてで確かめる。
// 受付幅(240ms)は8分(176ms)より広いので、次のノーツは必ず候補に入っている。
const GAPS=[[' 16分  88ms',88],[' 8分  176ms',176],['付点8分 264ms',264]];
for(const [label,gap] of GAPS){
  ok(`${label}間隔は判定の受付幅(${WINDOW}ms)より狭い＝次のノーツも候補に入る`,gap<=WINDOW*2);
  let wrong=null;
  // 1つめの時刻から、2つめが来る直前までのあいだは、必ず1つめが取れること
  for(let late=0;late<gap;late+=4){
    if(late>WINDOW)break;
    const got=hit([note(1000,0),note(1000+gap,1)],1000+late);
    if(got!==0){wrong={late,got};break;}
  }
  ok(`${label}: 遅れて叩いても1つめが取れる（次へ移らない）`,!wrong,
    wrong?`${wrong.late}ms遅れで${wrong.got===null?'どれにも当たらなかった':`${wrong.got+1}つめを取った`}`:'');
}

// --- 過ぎているノーツが2つ以上あるときは、いちばん後ろを取る ---
// 2つめの時刻ちょうどに叩いたら、1つめがまだ残っていても**2つめ**を取る。
//
// ここは2026-09-05に2回直している。
//   1回目 … 時間の差の絶対値で選んでいた → 遅れて叩くと次のノーツへ移る(上のブロック)
//   2回目 … そこで「過ぎている中でいちばん前」にした → 今度は**後ろを巻き込む**ようになった。
//           16分で並ぶ2つを2つめの時刻ちょうどで叩いても1つめが取られ、2つめは必ずMISS。
//           1回の入力で2つ崩れる(ユーザー指摘「あとのノーツを巻き込んでる」)
//
// 「過ぎている中でいちばん後ろ」なら両方とも起きない。
// 1つのノーツが取られるのは「次のノーツの時刻が来るまで」で、そこから先は次のノーツのもの。
// 上のブロック(遅れて叩いても1つめが取れる)と、このブロック(2つめの時刻なら2つめ)は
// **セットで**成り立っていなければならない。片方だけ直すと必ずもう片方が壊れる
for(const [label,gap] of GAPS){
  const got=hit([note(1000,0),note(1000+gap,1)],1000+gap);
  ok(`${label}: 2つめの時刻に叩いたら2つめが取れる(1つめを巻き込まない)`,
    got===1,got===null?'どれにも当たらない':`${got+1}つめ`);
  // 1つめは巻き込まれずに残っているので、そのあと取り逃しとして数えられる
  const notes=[note(1000,0),note(1000+gap,1)];
  const first=hit(notes,1000+gap);
  ok(`${label}: 巻き込まれなかった1つめは、まだ判定が確定していない`,
    first===1&&notes[0].done===false);
}

// --- ずれ込まない: 1つめが取り逃しとして確定したあとは、2つめが取れる ---
// 取り逃しの確定(MISS)は受付幅を過ぎた時点。そこまで来ればもう候補に残らないので、
// 以降の入力は次のノーツへ渡る＝1つずつずれ続けることはない
for(const [label,gap] of GAPS){
  const missed=note(1000,0);missed.done=true;
  const got=hit([missed,note(1000+gap,1)],1000+gap);
  ok(`${label}: 1つめが取り逃しになったあとは、2つめが取れる（ずれ込まない）`,got===1,
    got===null?'どれにも当たらない':`${got+1}つめ`);
}

// --- 連打を順に叩けば順に取れる ---
{
  const notes=[note(1000,0),note(1176,1),note(1352,2)];
  const order=[];
  for(const at of [1000,1176,1352]){
    const index=hit(notes,at);
    order.push(index===null?'なし':index+1);
    if(index!==null)notes[index].done=true;
  }
  ok('8分3連打を正確に叩けば1→2→3の順に取れる',order.join(',')==='1,2,3',order.join(','));
}

// --- 早く押した場合は、これから来るノーツを取る ---
ok('1つめより前に押せば1つめが取れる',hit([note(1000,0),note(1176,1)],950)===0);
ok('1つめを取ったあとなら、2つめを早めに押しても2つめが取れる',
  hit([note(1000,0,{done:true}),note(1176,1)],1100)===1);

// --- 同時押しは押した位置で選ぶ（時刻が同じなので順番では決まらない） ---
{
  const pair=()=>[
    {type:'TAP',timeMs:1000,lane:0,subLane:1,subLaneWidth:2,done:false,activePointerId:null,index:0},
    {type:'TAP',timeMs:1000,lane:4,subLane:8,subLaneWidth:2,done:false,activePointerId:null,index:1}];
  const left=rhythmMatchInputBatch(pair(),[{inputKey:'L',lane:0,subLaneCoordinate:2}],1000,0)[0].target;
  const right=rhythmMatchInputBatch(pair(),[{inputKey:'R',lane:4,subLaneCoordinate:9}],1000,0)[0].target;
  ok('同時押しは押した位置に近いほうを取る',left&&right&&left.index===0&&right.index===1,
    `左=${left?left.index+1:'なし'} / 右=${right?right.index+1:'なし'}`);
}

// --- 受付の外は取らない ---
ok(`受付幅より遅い(${WINDOW+1}ms)ときは取らない`,hit([note(1000,0)],1000+WINDOW+1)===null);
ok(`受付幅ちょうど(${WINDOW}ms)なら取る`,hit([note(1000,0)],1000+WINDOW)===0);

// --- 判定タイミング調整(offset)を入れてもこの順番が保たれる ---
{
  const withOffset=(at,offset)=>{
    const notes=[note(1000,0),note(1176,1)];
    const result=rhythmMatchInputBatch(notes,[{inputKey:'o',lane:2,subLaneCoordinate:6}],at,offset);
    return result[0].target?result[0].target.index:null;
  };
  ok('タイミング調整+50msでも、遅れて叩いて次へ移らない',withOffset(1150,50)===0,
    `${withOffset(1150,50)}`);
  ok('タイミング調整-50msでも、遅れて叩いて次へ移らない',withOffset(1050,-50)===0);
}

// --- 実装の書きぶり（絶対値だけで選ぶ形へ戻っていないか） ---
ok('遅れているノーツを先に見る作りになっている',
  /const rank=now>=noteTime\?0:1;/.test(source)&&/rank<pickedRank/.test(source));
// 過ぎている側は「いちばん後ろ」、まだ来ていない側は「いちばん前」。
// ここを両方とも同じ向きにすると、必ずどちらかの指摘が再発する
ok('過ぎている側といちばん前の側で、選ぶ向きを変えている',
  /const better=rank===0\?noteTime>pickedNoteTime:noteTime<pickedNoteTime;/.test(source));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
