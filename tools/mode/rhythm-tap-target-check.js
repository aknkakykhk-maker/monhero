#!/usr/bin/env node
// 近いTAPの入力所有権を本番 rhythmMatchInputBatch で確認する。
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const src=fs.readFileSync(path.join(ROOT,'monster-hero','data','rhythm-mode.js'),'utf8');
const stub=()=>({style:{setProperty(){},removeProperty(){}},setAttribute(){},removeAttribute(){},getAttribute:()=>null,
 appendChild(){},removeChild(){},addEventListener(){},removeEventListener(){},classList:{add(){},remove(){}},dataset:{},
 querySelector:()=>null,querySelectorAll:()=>[],textContent:'',isConnected:false,children:[],childNodes:[],closest:()=>null,
 getBoundingClientRect:()=>({top:0,left:0,width:0,height:0,bottom:0,right:0})});
const ctx={console,navigator:{},performance:{now:()=>0},requestAnimationFrame:()=>0,setTimeout,clearTimeout,
 MutationObserver:function(){this.observe=()=>{};this.disconnect=()=>{};},
 document:{createElement:stub,createElementNS:stub,head:stub(),body:stub(),documentElement:stub(),
 addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]}};
ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(src+`
globalThis.__m=rhythmMatchInputBatch;globalThis.__W=RHYTHM_INPUT_MATCH_WINDOW_MS;
globalThis.__PAST=RHYTHM_TAP_TARGET_PAST_HOLD_MS;globalThis.__EARLY=RHYTHM_TAP_TARGET_NEXT_EARLY_MS;`,ctx);
const match=ctx.__m,WINDOW=ctx.__W,PAST=ctx.__PAST,EARLY=ctx.__EARLY;
let failed=0;const check=(n,ok,d='')=>{console.log(`${ok?'OK':'NG'}: ${n}${d?` — ${d}`:''}`);if(!ok)failed++;};
const note=(i,timeMs,subLane=4,width=2,type='TAP')=>({index:i,type,timeMs,lane:Math.floor(subLane/2),subLane,subLaneWidth:width,done:false,activePointerId:null});
const hit=(notes,sub,now,offset=0,consume=false)=>{const r=match(notes,[{inputKey:`k:${now}`,lane:Math.floor(sub/2),subLaneCoordinate:sub}],now,offset);const t=r[0]?.target||null;if(t&&consume)t.done=true;return t?t.index:null;};

check('前側の最低猶予は65ms',PAST===65,String(PAST));
check('次側はMARVELOUS早側55ms',EARLY===55,String(EARLY));
for(const [now,want] of [[1000,0],[1040,0],[1060,0],[1065,0],[1066,1],[1078,1],[1087,1],[1088,1]])
 check(`16分: ${now}ms → ${want?'B':'A'}`,hit([note(0,1000),note(1,1088)],5,now)===want);
for(const [gap,before,after] of [[176,1121,1122],[264,1209,1210]]){
 const ns=()=>[note(0,1000),note(1,1000+gap)];
 check(`${gap}ms: 境界までは前`,hit(ns(),5,before)===0);
 check(`${gap}ms: 境界+1msから次`,hit(ns(),5,after)===1);
}
check('A+239ms(BAD) / B-1ms(MARVELOUS)ならB',hit([note(0,1000),note(1,1240)],5,1239)===1);
check('A取り逃し+Bを1ms FASTならB',hit([note(0,1000),note(1,1100)],5,1099)===1);
{
 const ns=[note(0,1000),note(1,1088),note(2,1176),note(3,1264)];
 const got=[1078,1166,1254].map(t=>hit(ns,5,t,0,true));
 check('A取り逃し後B/C/Dを各10ms FAST → B/C/D',got.join(',')==='1,2,3',got.join(','));
 check('取り逃したAは入力で消費していない',ns[0].done===false);
}
{
 const ns=[note(0,1000),note(1,1088),note(2,1176)];
 const got=[1060,1148,1236].map(t=>hit(ns,5,t,0,true));
 check('A/B/Cを各60ms SLOW → A/B/C',got.join(',')==='0,1,2',got.join(','));
}
const pair=()=>[note(0,1000,0,6),note(1,1000,6,2)];
check('同時刻は内側のノーツを優先',hit(pair(),5.5,1000)===0&&hit(pair(),6.5,1000)===1);
check(`単独ノーツ受付は±${WINDOW}msのまま`,hit([note(0,1000)],5,1000+WINDOW)===0&&hit([note(0,1000)],5,1000+WINDOW+1)===null);
const withOffset=(delta,offset)=>hit([note(0,1000),note(1,1088)],5,1000+offset+delta,offset);
check('+50ms補正でも+60ms相当はA',withOffset(60,50)===0);
check('-50ms補正でもB-10ms相当はB',withOffset(78,-50)===1);
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
