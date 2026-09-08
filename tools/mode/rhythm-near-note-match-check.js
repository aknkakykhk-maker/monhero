#!/usr/bin/env node
// 近いノーツの受け渡し境界と連続入力の位相ずれを確認する。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..'),source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const prefix=source.split('const emptyRhythmChart',1)[0],ctx={console,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}};
vm.createContext(ctx);vm.runInContext(prefix+`
this.out={rhythmMatchInputBatch,RHYTHM_INPUT_MATCH_WINDOW_MS,RHYTHM_TAP_TARGET_PAST_HOLD_MS,RHYTHM_TAP_TARGET_NEXT_EARLY_MS};`,ctx);
const {rhythmMatchInputBatch:match,RHYTHM_INPUT_MATCH_WINDOW_MS:WINDOW,RHYTHM_TAP_TARGET_PAST_HOLD_MS:PAST,RHYTHM_TAP_TARGET_NEXT_EARLY_MS:EARLY}=ctx.out;
let failed=0;const ok=(n,c,d='')=>{console.log(`${c?'OK':'NG'}: ${n}${d?` — ${d}`:''}`);if(!c)failed++;};
const note=(timeMs,index,extra={})=>({type:'TAP',timeMs,lane:2,subLane:5,subLaneWidth:2,done:false,activePointerId:null,index,...extra});
const hit=(notes,at,offset=0,consume=false)=>{const r=match(notes,[{inputKey:`k${at}`,lane:2,subLaneCoordinate:6}],at,offset);const t=r[0]?.target||null;if(t&&consume)t.done=true;return t?t.index:null;};
const handoff=(a,b)=>Math.max(a+PAST,b-EARLY);
ok('受付幅240msは不変',WINDOW===240,String(WINDOW));ok('前猶予65ms',PAST===65);ok('次早側55ms',EARLY===55);
for(const [label,gap] of [['16分',88],['8分',176],['付点8分',264]]){
 const a=1000,b=a+gap,h=handoff(a,b);
 ok(`${label}: 境界までは前`,hit([note(a,0),note(b,1)],h)===0,`${h-a}ms遅れ`);
 ok(`${label}: 境界+1msから次`,hit([note(a,0),note(b,1)],h+1)===1);
 ok(`${label}: 次ちょうどは次`,hit([note(a,0),note(b,1)],b)===1);
}
ok('16分+60msは前',hit([note(1000,0),note(1088,1)],1060)===0);
ok('16分B-10msはB',hit([note(1000,0),note(1088,1)],1078)===1);
ok('A+239 BADよりB-1 MARVELOUS',hit([note(1000,0),note(1240,1)],1239)===1);
{
 const ns=[note(1000,0),note(1088,1),note(1176,2),note(1264,3)];
 const got=[1078,1166,1254].map(t=>hit(ns,t,0,true));
 ok('取り逃し後10ms FAST連打はB→C→D',got.join(',')==='1,2,3',got.join(','));
}
{
 const ns=[note(1000,0),note(1088,1),note(1176,2)];
 const got=[1060,1148,1236].map(t=>hit(ns,t,0,true));
 ok('60ms SLOW連打はA→B→C',got.join(',')==='0,1,2',got.join(','));
}
const withOffset=(delta,offset)=>hit([note(1000,0),note(1088,1)],1000+offset+delta,offset);
ok('補正+50でも+60相当は前',withOffset(60,50)===0);ok('補正-50でもB-10相当は次',withOffset(78,-50)===1);
ok('過去/未来を別々に絞る',/passedBest=candidate\(passedBest,note,index,noteTime,inside,distance,true\)/.test(source)&&/upcomingBest=candidate\(upcomingBest,note,index,noteTime,inside,distance,false\)/.test(source));
ok('judgeRankへ戻していない',!/judgeRank/.test(source));
ok('handoffは2条件の遅いほう',/Math\.max\([\s\S]*passedBest\.noteTime\+RHYTHM_TAP_TARGET_PAST_HOLD_MS[\s\S]*upcomingBest\.noteTime-RHYTHM_TAP_TARGET_NEXT_EARLY_MS/.test(source));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
