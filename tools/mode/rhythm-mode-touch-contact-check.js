#!/usr/bin/env node
const fs=require('fs');
const vm=require('vm');

const mode=fs.readFileSync('monster-hero/data/rhythm-mode.js','utf8');
const release=fs.readFileSync('monster-hero/data/rhythm-step3-release.js','utf8');
const ctx={console,Math,Number,Array,Object,Map,Set,JSON,Date,Promise,setTimeout,clearTimeout};
vm.createContext(ctx);
vm.runInContext(mode,ctx);
vm.runInContext(release,ctx);

let failed=0;
const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const runtime=ctx.__mhRhythmTouchContactRuntime;
check('接触幅runtimeを初期化',!!runtime&&typeof runtime.contactSubLanes==='function'&&runtime.maxSubLanes===3);

if(runtime){
  const rect={left:0,top:0,width:1000,height:1000},clientY=900;
  const clientX=runtime.clientXForSubLane(4,clientY,rect);
  const fallback=runtime.contactSubLanes({clientX,clientY,radiusX:0},rect);
  check('radiusXなしは中心1サブレーンへfallback',fallback.length===1&&fallback[0]===4);
  const invalid=runtime.contactSubLanes({clientX,clientY,radiusX:NaN},rect);
  check('不正な接触幅も中心1サブレーンへfallback',invalid.length===1&&invalid[0]===4);

  let triple=[];
  for(let radiusX=1;radiusX<=300&&triple.length<3;radiusX++)triple=runtime.contactSubLanes({clientX,clientY,radiusX},rect);
  check('接触幅が広がると隣接3サブレーンを返せる',triple.length===3&&triple.includes(4)&&triple[1]===triple[0]+1&&triple[2]===triple[1]+1);
  const capped=runtime.contactSubLanes({clientX,clientY,radiusX:5000},rect);
  check('異常に大きいradiusXでも最大3サブレーン',capped.length<=3&&capped.includes(4));
}

check('接触した全サブレーンを発光対象にする',release.includes("querySelectorAll('[data-rhythm-sublane-feedback]')")&&release.includes("el.style.opacity=on?'1':'0'"));
check('追加取得はTAP候補だけをsynthetic pointerへ渡す',release.includes("el.dataset.noteType==='TAP'")&&release.includes("pointerType:'pen'"));
check('HOLD/SLIDE/FLICK gesture中は追加TAPを取らない',release.includes("RHYTHM_GESTURE_RUNTIME?._sessions?.has(inputKey)"));
check('touchmoveでは新しく接触したサブレーンだけを処理',release.includes("previous.has(lane)")&&release.includes("event.type==='touchstart'||event.type==='touchmove'"));
check('1物理イベントで成功SEは最大1回・成功なし時だけ空押しSE',release.includes("group.success===1?group.playOriginal")&&release.includes("group.success===0&&group.empty>0"));
check('既存10サブレーンprojectionを接触幅計算へ再利用',release.includes('rhythmSubLaneCoordinateAtPoint')&&release.includes('rhythmProjectBoundary'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);