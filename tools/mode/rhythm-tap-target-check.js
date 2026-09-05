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
//   ・過ぎている側があるなら、必ずそちらを取る(古いものから順に消費する)
//   ・過ぎている側は「いちばん後ろ(時刻の新しいほう)」まで絞る
//   ・まだ来ていない側を見るのは、過ぎている側が1つも無いとき(＝早押し)だけ
//   ・同じ時刻に複数あるときは、押した位置が**内側**にあるほうを優先し、
//     それも同じなら中心に近いほう
//
// 【4回目で受け入れたトレードオフ】
// 3回目の指摘「次のノーツをほぼジャストで叩いたらそちらが取れる」は元に戻る。
// A=1.000秒を叩き忘れたままB=1.100秒を1.099秒にジャストで叩くと、Aが取られる。
// これは「1回の入力で取れるのは1つ」「古いものから消費する」という当たり前の形で、
// 失うのは叩き忘れたAだけ。引っ張りのように**後ろへ連鎖して崩れることはない**。
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
vm.runInContext(src+'\nglobalThis.__m=rhythmMatchInputBatch;globalThis.__W=RHYTHM_INPUT_MATCH_WINDOW_MS;',ctx);
const match=ctx.__m,WINDOW=ctx.__W;

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const note=(i,timeMs,subLane,width=2,type='TAP')=>
  ({index:i,type,timeMs,lane:Math.floor(subLane/2),subLane,subLaneWidth:width,done:false,activePointerId:null});
const hit=(notes,sub,now)=>{
  const r=match(notes,[{inputKey:'k',lane:Math.floor(sub/2),subLaneCoordinate:sub}],now,0);
  return r[0]?.target?r[0].target.index:null;
};

console.log('--- 時間の決め方 (16分=88ms間隔で同じ場所に2つ) ---');
// 決め手は「判定の段が良くなるほう」。同じ段なら、叩いたつもりである
// 過ぎている側(前のノーツ)を取る。近さで決めると中間で切り替わってしまい、
// 0.044秒遅れただけで次のノーツへ移る＝「判定が次へ流れる」状態に戻る
for(const [now,want,why] of [
  [ 960,0,'まだどちらも来ていない。いちばん早いほうを狙っている'],
  [1000,0,'1つめちょうど'],
  [1040,0,'1つめから40ms。どちらもMARVELOUSの段なので、遅れて叩いた1つめ'],
  [1050,0,'1つめから50ms。まだ同じ段なので1つめのまま(次へ流れない)'],
  [1060,0,'1つめから60ms遅れ。2つめのほうが判定は良くなるが、引っ張らずに1つめのまま'],
  [1080,0,'1つめから80ms遅れ。2つめは8ms前だが、まだ2つめの時刻は来ていない'],
  [1088,1,'2つめちょうど'],
  [1200,1,'2つめから112ms遅れ。1つめはもう遠い'],
]) check(`${now}ms に叩いたら ${want===0?'1つめ':'2つめ'}`,
  hit([note(0,1000,4),note(1,1088,4)],5,now)===want,why);

console.log('\n--- 引っ張りが起きないこと (4回目・実機の指摘そのもの) ---');
// 連続ノーツを遅れて叩いても、次のノーツへ移らない。ここが引っ張りの防波堤。
// 16分(88ms)でも8分(176ms)でも、次のノーツの時刻が来るまでは前のノーツのまま。
for(const [gap,delay,why] of [
  [ 88, 60,'16分で60ms遅れ(2つめのほうが判定は良い)'],
  [ 88, 80,'16分で80ms遅れ(2つめの8ms前)'],
  [176,120,'8分で120ms遅れ(2つめの56ms前)'],
  [176,170,'8分で170ms遅れ(2つめの6ms前)'],
]) check(`${why} → 1つめのまま`,
  hit([note(0,1000,4),note(1,1000+gap,4)],5,1000+delay)===0,
  `${1000+delay}ms に叩く。2つめ(${1000+gap}ms)はまだ来ていない`);
// 3つ以上でも同じ。1つ遅れたぶんが後ろへ連鎖しない
check('16分3連で1つめを遅れて叩いても、2つめ3つめへ移らない',
  hit([note(0,1000,4),note(1,1088,4),note(2,1176,4)],5,1080)===0,
  '1.080秒→1つめ(+80ms)。2つめ(1.088秒)も3つめも取らない');

console.log('\n--- 受け入れたトレードオフ (3回目の指摘は元に戻る) ---');
// A=1000ms / B=1100ms。Aを叩き忘れたままBを1099ms(ほぼジャスト)に叩く。
// 古いものから消費するので、ここではAが取られる。失うのは叩き忘れたAだけで、
// Bは次の入力で取れる。引っ張りのように後ろへ連鎖しないことのほうを取った。
check('叩き忘れがあるときは、古いほうから消費する',
  hit([note(0,1000,4),note(1,1100,4)],5,1099)===0,
  '1.099秒に叩く→1.000秒のノーツ(+99ms)。Bは次の入力で取れる');
check('逆に、前のノーツの判定が落ちていなければ前が取れる',
  hit([note(0,1000,4),note(1,1100,4)],5,1040)===0,'1.040秒→1.000秒のノーツ(+40ms MARVELOUS)');
// 「近さ」で決めていないことの確かめ。1.050秒は2つめ(1.088秒)のほうが時間は近いが、
// どちらもMARVELOUSの段なので1つめのまま。ここが「判定が次へ流れる」の防波堤
check('時間が近いだけでは次のノーツへ移らない',
  hit([note(0,1000,4),note(1,1088,4)],5,1050)===0,'1.050秒→1つめ(+50ms)。2つめは38ms前だが同じ段');

console.log('\n--- 判定が次々と流れていかないこと (1回目の指摘) ---');
// 3つ並んでいても、隣り合う2つの間でしか揺れない。3つめまで飛ばない
check('3つ並んでいても2つ先までは飛ばない',
  hit([note(0,1000,4),note(1,1088,4),note(2,1176,4)],5,1100)===1,
  '1.100秒に叩く→2つめ(1.088秒)。3つめ(1.176秒)へは飛ばない');
check('8分でも遅れて叩いたぶんは前のノーツのまま',
  hit([note(0,1000,4),note(1,1176,4)],5,1092)===0,'1.092秒→1つめ(+92ms)。どちらもEXCELLENTの段');

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
check(`前後${WINDOW}msの外は取らない`,
  hit([note(0,1000,4)],5,1000+WINDOW+1)===null&&hit([note(0,1000,4)],5,1000-WINDOW-1)===null);
check(`前後${WINDOW}msちょうどは取る`,
  hit([note(0,1000,4)],5,1000+WINDOW)===0&&hit([note(0,1000,4)],5,1000-WINDOW)===0);

console.log('');
if(failed){console.log(`${failed}件のNGがあります`);process.exit(1);}
console.log('すべてOK');
