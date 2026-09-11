#!/usr/bin/env node
// 「叩いたとき、どのノーツが取られるか」を本番の関数で全部確かめる。
//
//   node tools/mode/rhythm-tap-target-check.js
//
// 【なぜ要るか】
// この選び方は 2026-09-05 に3回直している。片方を直すともう片方が壊れるので、
// **すべての言い分を1つの表にして同時に見る**。ここが唯一の正解表。
//
//   1回目 … 候補全部から時間の差の絶対値がいちばん小さいものを選んでいた。
//           さらに後ろのノーツまで拾い、判定が次々と流れていく
//           (指摘「近くに次のノーツがあるときに判定がそっちにいってる」)。
//   2回目 … 「過ぎている中でいちばん前」にしたら、今度は後ろを巻き込むようになった
//           (指摘「あとのノーツを巻き込んでる」)。
//   3回目 … 「過ぎている中でいちばん後ろ」にしたが、過ぎている側を**無条件に**
//           優先していたため、次のノーツをほぼジャストで叩いても
//           0.1秒近く前の取り逃したノーツが取られ、狙ったほうが巻き込まれた
//           (指摘「タップ判定の巻き込みもまだある」)。
//   4回目 … そこで「判定の段が良くなるほうを取る」にしたところ、
//           **連続ノーツで遅れて叩くと必ず次へ移る**ようになった。
//           16分(88ms)で60ms遅れただけで、前=EXCELLENT / 次=MARVELOUS となり次が取られる。
//           取られた次は本来の時刻には無いので、入力が後ろへずれ続ける
//           (指摘「連続ノーツ時のタップ判定の引っ張りがなくならない／致命的」)。
//
// いまの決め方:
//   ・判定ランクの窓(最大±240ms)と、どのノーツを狙ったかの所有時間を分離する
//   ・前/次の両候補があるときは、ノーツ間の前75%を前ノーツ側へ寄せる
//   ・次ノーツ側の早取り範囲はMARVELOUS窓を上限にする
//   ・これにより+60ms程度の遅押しを次へ飛ばさず、次の10ms程度の早押しを前へ吸わせ続けない
//   ・同じ時刻に複数あるときは、押した位置が内側のもの→中心に近いものを優先する
//
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const src=fs.readFileSync(path.join(ROOT,'monster-hero','data','rhythm-mode.js'),'utf8');
const stub=()=>({style:{setProperty(){},removeProperty(){}},setAttribute(){},removeAttribute(){},
  getAttribute:()=>null,appendChild(){},removeChild(){},addEventListener(){},removeEventListener(){},
  classList:{add(){},remove(){}},dataset:{},querySelector:()=>null,querySelectorAll:()=>[],
  textContent:'',isConnected:false,children:[],childNodes:[],closest:()=>null,
  getBoundingClientRect:()=>({top:0,left:0,width:0,height:0,bottom:0,right:0})});
const ctx={console,navigator:{},performance:{now:()=>0},requestAnimationFrame:()=>0,setTimeout,clearTimeout,
  MutationObserver:function(){this.observe=()=>{};this.disconnect=()=>{};},
  document:{createElement:stub,createElementNS:stub,head:stub(),body:stub(),documentElement:stub(),
    addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]}};
ctx.window=ctx;ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(src+'\nglobalThis.__m=rhythmMatchInputBatch;globalThis.__W=RHYTHM_INPUT_MATCH_WINDOW_MS;globalThis.__S=RHYTHM_COMBO_SAFE_WINDOW_MS;',ctx);
const match=ctx.__m,WINDOW=ctx.__W,SAFE=ctx.__S;

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const note=(i,timeMs,subLane,width=2,type='TAP')=>
  ({index:i,type,timeMs,lane:Math.floor(subLane/2),subLane,subLaneWidth:width,done:false,activePointerId:null});
const hit=(notes,sub,now)=>{
  const r=match(notes,[{inputKey:'k',lane:Math.floor(sub/2),subLaneCoordinate:sub}],now,0);
  return r[0]?.target?r[0].target.index:null;
};

console.log('--- 時間ターゲットの決め方 (判定幅とは分離) ---');
// 16分88msでは前ノーツ側を75% (=66ms) 保護する。
// +60ms程度の遅押しは前のまま、次ノーツ直前の早押しは次へ切り替える。
for(const [now,want,why] of [
  [ 960,0,'まだどちらも来ていない。いちばん早いほう'],
  [1000,0,'1つめちょうど'],
  [1040,0,'1つめから40ms遅れ'],
  [1060,0,'1つめから60ms遅れ。前方引っ張りを起こさない'],
  [1070,1,'2つめの18ms前。次ノーツ直前は次へ切り替える'],
  [1078,1,'2つめの10ms前。取り逃した前へ吸わせない'],
  [1088,1,'2つめちょうど'],
  [1200,1,'2つめから112ms遅れ'],
]) check(`${now}ms に叩いたら ${want===0?'1つめ':'2つめ'}`,
  hit([note(0,1000,4),note(1,1088,4)],5,now)===want,why);

console.log('\n--- 前方・後方どちらの連鎖引っ張りも起こさない ---');
check('16分で+60ms遅れを続けても、1つ先へずれない',
  JSON.stringify((()=>{
    const notes=[note(0,1000,4),note(1,1088,4),note(2,1176,4),note(3,1264,4)],picked=[];
    [1060,1148,1236,1324].forEach(now=>{const index=hit(notes,5,now);picked.push(index);const target=notes.find(n=>n.index===index);if(target)target.done=true;});
    return picked;
  })())===JSON.stringify([0,1,2,3]),
  '各ノーツを60ms遅く叩いても [0,1,2,3] の順で取る');

check('1つめをMISSして以後を10ms早く叩いても、1つ後ろへずれ続けない',
  JSON.stringify((()=>{
    const notes=[note(0,1000,4),note(1,1088,4),note(2,1176,4),note(3,1264,4)],picked=[];
    [1078,1166,1254].forEach(now=>{const index=hit(notes,5,now);picked.push(index);const target=notes.find(n=>n.index===index);if(target)target.done=true;});
    return picked;
  })())===JSON.stringify([1,2,3]),
  '1つめは未処理のままでも、B/C/Dの早押しをB/C/Dへ結び付ける');

check('BAD級まで遅れた前ノーツより、ほぼジャストの次ノーツを取る',
  hit([note(0,1000,4),note(1,1240,4)],5,1239)===1,
  'Aは+239ms(BAD)、Bは-1msなのでB');

check('8分では次ノーツの56ms前ならまだ前、36ms前なら次へ切り替わる',
  hit([note(0,1000,4),note(1,1176,4)],5,1120)===0
  &&hit([note(0,1000,4),note(1,1176,4)],5,1140)===1,
  '間隔が広いときも単純な近い方にはしない');

console.log('\n--- 2つ先へ飛ばない ---');
check('3つ並んでいても2つ先までは飛ばない',
  hit([note(0,1000,4),note(1,1088,4),note(2,1176,4)],5,1100)===1,
  '1.100秒に叩く→2つめ(1.088秒)。3つめへは飛ばない');

console.log('\n--- 押した位置の決め方 ---');
// 幅の広いノーツ(サブ0〜6)と、その隣(サブ6〜8)が同時にあるとき。
// 内側を押しているのに、中心がたまたま近い隣が取られてはいけない
const wide=()=>[note(0,1000,0,6),note(1,1000,6,2)];
for(const [sub,want,why] of [
  [1.0,0,'幅広の左端。内側なので幅広'],
  [5.0,0,'幅広の中。内側なので幅広'],
  [5.5,0,'幅広の中(端寄り)。中心は隣のほうが近いが、内側を優先する'],
  [6.5,1,'隣の内側'],
  [7.0,1,'隣の中'],
]) check(`サブ${sub.toFixed(1)} を押したら ${want===0?'幅広':'隣'}`,hit(wide(),sub,1000)===want,why);

console.log('\n--- 1回の入力で2つ取らない ---');
check('離れた同時押しの片方だけ叩いても、取れるのは1つ',
  match([note(0,1000,0),note(1,1000,8)],[{inputKey:'a',lane:0,subLaneCoordinate:1}],1000,0)
    .filter(r=>r.target).length===1);
check('2本の指で叩けば2つとも取れる',
  match([note(0,1000,0),note(1,1000,8)],
    [{inputKey:'a',lane:0,subLaneCoordinate:1},{inputKey:'b',lane:4,subLaneCoordinate:9}],1000,0)
    .filter(r=>r.target).length===2);

console.log('\n--- 受け付ける範囲 ---');
check(`遅れ側 ${WINDOW}msの外は取らない`,hit([note(0,1000,4)],5,1000+WINDOW+1)===null);
check(`遅れ側 ${WINDOW}msちょうどは取る`,hit([note(0,1000,4)],5,1000+WINDOW)===0);
// 【2026-09-11】早押し側だけ「コンボがつながる範囲(GOODの窓)」までに狭めた。
// まだ来ていないTAPをBADで取ると、叩き直せたはずのノーツを消してコンボまで切る。
// 空打ちにはペナルティが無いので、取らずに残すほうが必ず得(rhythm-mode.js の該当コメント)。
// 遅れ側は放っておけば確実に見逃しMISSなので、BADでも拾えたほうがまし＝据え置き。
check(`早押し側 ${SAFE}msちょうど(GOODの端)は取る`,hit([note(0,1000,4)],5,1000-SAFE)===0);
check(`早押し側 ${SAFE}msより早い(BADにしかならない)TAPは取らない`,
  hit([note(0,1000,4)],5,1000-SAFE-1)===null&&hit([note(0,1000,4)],5,1000-WINDOW)===null);
check(`早押しで取らなかったノーツは残り、叩き直せる`,(()=>{
  const notes=[note(0,1000,4)];
  return hit(notes,5,1000-WINDOW)===null&&hit(notes,5,1000)===0;
})());

console.log('');
if(failed){console.log(`${failed}件のNGがあります`);process.exit(1);}
console.log('すべてOK');
