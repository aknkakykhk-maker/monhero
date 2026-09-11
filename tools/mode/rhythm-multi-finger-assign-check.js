#!/usr/bin/env node
// 1フレームに複数の指が来たときの「どの入力がどのノーツを取るか」を確かめる。
//
//   node tools/mode/rhythm-multi-finger-assign-check.js
//
// 【なぜ要るか】(2026-09-11・タップ判定の監査で見つけた2件)
//
// ① 指を置いた順で結果が変わっていた
//    入力は先に処理したものが claimed で勝つ早い者勝ちで、並び順は
//    Array.from(e.touches) の順＝指が触れた順。位置とは無関係なので、
//    同じ配置でも置いた順で片方が空打ちになり、ノーツが1つ見逃しMISSになった。
//    いまは「どれかの帯の内側にいる指」を先に通す(選べる先が狭いほうが先)。
//
// ② 幅の広いノーツが、細いノーツの内側を押した指を奪っていた
//    同じ時刻で帯が重なると、内側かどうかの次は「中心までの距離」だけで決まるため、
//    細い帯をわざわざ押していても中心がたまたま近い広いほうが取られた。
//    いまは、どちらの内側にもいるときは細いほうを先に見る。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const prefix=source.split('const emptyRhythmChart',1)[0];
const ctx={console,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}};
vm.createContext(ctx);
vm.runInContext(prefix+'\nthis.out={rhythmMatchInputBatch};',ctx);
const {rhythmMatchInputBatch:match}=ctx.out;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const note=(index,timeMs,subLane,subLaneWidth)=>
  ({index,type:'TAP',timeMs,lane:Math.floor(subLane/2),subLane,subLaneWidth,done:false,activePointerId:null});
const run=(makeNotes,coords,order)=>{
  const notes=makeNotes();
  const inputs=order.map(key=>({inputKey:key,lane:Math.floor(coords[key]/2),subLaneCoordinate:coords[key]}));
  const result=match(notes,inputs,1000,0);
  const taken={};
  result.forEach(r=>{taken[r.input.inputKey]=r.target?r.target.index:null;});
  return taken;
};

console.log('--- ① 指を置いた順で結果が変わらない ---');
// X=sub0〜2(中心1) / Y=sub3〜5(中心4) が同時刻。
// f1=sub2.6 はどちらの内側でもない(Yの中心に近い) / f2=sub4.0 はYの内側だけ
{
  const makeNotes=()=>[note(0,1000,0,2),note(1,1000,3,2)];
  const coords={f1:2.6,f2:4.0};
  const a=run(makeNotes,coords,['f1','f2']);
  const b=run(makeNotes,coords,['f2','f1']);
  ok('置いた順が違っても同じ割り当てになる',
    a.f1===b.f1&&a.f2===b.f2,`順[f1,f2]=${JSON.stringify(a)} / 順[f2,f1]=${JSON.stringify(b)}`);
  ok('2本の指で、2つのノーツが両方とも取れる',
    a.f1!==null&&a.f2!==null&&a.f1!==a.f2,`f1→${a.f1} / f2→${a.f2}`);
  ok('内側にいる指(f2)は、その内側のノーツ(Y=index1)を取る',a.f2===1,`f2→${a.f2}`);
  ok('内側でない指(f1)は残ったほう(X=index0)へ回る',a.f1===0,`f1→${a.f1}`);
}
// 指が1本だけのときは、並べ替えても結果が変わらない
{
  const makeNotes=()=>[note(0,1000,0,2),note(1,1000,3,2)];
  const one=run(makeNotes,{f1:2.6},['f1']);
  ok('指1本のときの行き先は変えていない(中心に近いほう)',one.f1===1,`f1→${one.f1}`);
}

console.log('\n--- ② 同じ時刻で帯が重なったら、細いほうを優先する ---');
{
  // 全幅TAP(sub0〜10, 中心5) と 幅1TAP(sub5〜6, 中心5.5) が同時刻
  const makeNotes=()=>[note(0,1000,0,10),note(1,1000,5,1)];
  for(const sub of [5.0,5.2,5.4,5.8]){
    const got=run(makeNotes,{f:sub},['f']).f;
    ok(`sub${sub.toFixed(1)}(細い帯の内側)を押すと細いほうが取れる`,got===1,`取れたのは index${got}`);
  }
  // 細い帯の外を押したときは、これまでどおり広いほうが取れる
  const outside=run(makeNotes,{f:2.0},['f']).f;
  ok('細い帯の外(sub2.0)なら広いほうが取れる',outside===0,`取れたのは index${outside}`);
}

console.log('\n--- 回帰: 離れた同時押しは今までどおり ---');
{
  const makeNotes=()=>[note(0,1000,0,2),note(1,1000,8,2)];
  const both=run(makeNotes,{L:1,R:9},['L','R']);
  ok('左右の同時押しは2本の指で両方取れる',both.L===0&&both.R===1,JSON.stringify(both));
  const one=run(makeNotes,{L:1},['L']);
  ok('片方だけ叩いたら取れるのは1つ',one.L===0);
}

console.log('\n--- 実装ガード ---');
ok('入力を並べ替えてから相手を決めている',/rhythmOrderInputsForMatch\(inputs,insideSomeNote\)\.map\(input=>\{/.test(source));
ok('並べ替えは安定(同じ区分なら触れた順のまま)',/a\.inside-b\.inside\|\|a\.order-b\.order/.test(source));
ok('同時刻に重なったら細いほうを先に見る',/return span<current\.span\?made:current;/.test(source));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
