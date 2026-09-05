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
//
// どこで次のノーツへ移るかは「判定の段(MARVELOUS/EXCELLENT/…)」で決まる。
// 1つめの段が落ちて、2つめのほうが良い段になった瞬間に切り替わる。
// 時間の近さで決めると2つのちょうど中間で切り替わってしまい、
// 16分なら0.044秒遅れただけで次へ移る＝これがユーザーの指摘そのものだった。
// 段で決めるので、実際にはそれよりずっと遅くまで1つめが取れる。
const RANK=[55,100,150,200,240];   // MARVELOUS / EXCELLENT / GREAT / GOOD / BAD の端
const rankOf=d=>{const a=Math.abs(d);for(let i=0;i<RANK.length;i++)if(a<=RANK[i])return i;return RANK.length;};
const GAPS=[[' 16分  88ms',88],[' 8分  176ms',176],['付点8分 264ms',264]];
for(const [label,gap] of GAPS){
  ok(`${label}間隔は判定の受付幅(${WINDOW}ms)より狭い＝次のノーツも候補に入る`,gap<=WINDOW*2);
  let wrong=null,switchedAt=null;
  for(let late=0;late<gap;late+=1){
    if(late>WINDOW)break;
    const got=hit([note(1000,0),note(1000+gap,1)],1000+late);
    // このタイミングで「どちらを取るのが正しいか」を段で出す
    const want=rankOf(gap-late)<rankOf(late)?1:0;
    if(got!==want){wrong={late,got,want};break;}
    if(got===1&&switchedAt===null)switchedAt=late;
  }
  ok(`${label}: 判定の段の良いほうを取る（時間の近さで流れない）`,!wrong,
    wrong?`${wrong.late}ms遅れで${wrong.got===null?'どれにも当たらなかった':`${wrong.got+1}つめ`}(正しくは${wrong.want+1}つめ)`
      :`${switchedAt===null?'最後まで1つめ':`${switchedAt}ms遅れで2つめへ`}（中間の${Math.round(gap/2)}msよりあとまで1つめが取れる）`);
  if(switchedAt!==null)ok(`${label}: 切り替わりは間隔の半分より遅い`,switchedAt>gap/2,`${switchedAt}ms > ${gap/2}ms`);
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
// 過ぎている側とまだ来ていない側を別々に絞ってから比べる。
// ここを1本のループで「いちばん近いもの」にすると、判定が次々と流れる状態に戻る
ok('過ぎている側とまだ来ていない側を別々に絞っている',
  /passedBest=candidate\(passedBest,note,index,noteTime,inside,distance,true\)/.test(source)
  &&/upcomingBest=candidate\(upcomingBest,note,index,noteTime,inside,distance,false\)/.test(source));
// 2つの比べ方は「時間の近さ」ではなく「判定の段」。
// 近さで比べると2つのちょうど中間で切り替わり、16分なら0.044秒遅れただけで次へ移る
// (＝「近くに次のノーツがあるときに判定がそっちにいってる」の再発)
ok('2つの比べ方は判定の段で、近さではない',
  /const judgeRank=deltaMs=>/.test(source)
  &&/judgeRank\(upcomingBest\.noteTime-now\)<judgeRank\(now-passedBest\.noteTime\)/.test(source));
// 同じ段のときは、実際に叩いたつもりである「過ぎている側」を取る
ok('同じ段なら過ぎている側を取る',
  /\?upcomingBest:passedBest;/.test(source));
// 押した位置がノーツの内側にあるものを優先する(幅の広いノーツの内側を押しているのに
// となりが取られる件への対応)
ok('同じ時刻なら押した位置が内側のものを優先する',
  /const isInside=note=>/.test(source)&&/if\(inside!==current\.inside\)/.test(source));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
