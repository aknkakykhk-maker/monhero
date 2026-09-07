#!/usr/bin/env node
// canvas 版のノーツ座標(rhythmNoteCanvasGeometry)が、DOM 版(rhythmLayoutNoteVisual)と同じ場所を指しているかを
// Node 上で突き合わせる(2026-09-07・canvas 化)。
//
// DOM 版は「要素の width / translate」「HOLD 帯の clipPath(%)」「SLIDE 帯の polygon points」「ENDバーの left/top/width」へ
// 書き込む。ここでは最小限の要素もどきを渡してその書き込みを受け取り、canvas 版が返す座標と比べる。
// 両者は同じ投影(rhythmProjectLane など)から出しているので、ずれが出るなら式の写し間違い。
//   node tools/mode/rhythm-canvas-geometry-check.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(source,ctx);
const run=code=>vm.runInContext(code,ctx);
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// 要素もどき。style への書き込みだけを受け取る
const fakeStyle=()=>{const s={};s.setProperty=(k,v)=>{s[k]=v;};return s;};
const fakeEl=(note)=>{
  const el={style:fakeStyle(),offsetHeight:20,dataset:{}};
  let body=null;
  if(note.type==='HOLD'){body={style:fakeStyle(),hasAttribute:()=>false};}
  if(note.type==='SLIDE'){
    body={style:fakeStyle(),hasAttribute:name=>name==='data-rhythm-slide-body',childNodes:[],setAttribute(){},};
    body.appendChild=node=>{body.childNodes.push(node);};
  }
  el._rhythmVisualBody=body;
  el._rhythmEndBar=(note.type==='HOLD'||note.type==='SLIDE')?{style:fakeStyle()}:null;
  el.querySelector=()=>null;
  return {el,body};
};
ctx.document={createElementNS:()=>({style:{},setAttribute(k,v){this[k]=v;},dataset:{}})};
ctx.getComputedStyle=()=>({height:'0px'});

const rect={width:390,height:700,top:0,left:0};
const noteHeight=20,spawnY=-noteHeight,judgmentY=700*.88-1.5-noteHeight/2,travelPx=judgmentY-spawnY;
const CASES=[
  {id:'TAP 幅1 左端',type:'TAP',subLane:0,subLaneWidth:1},
  {id:'TAP 幅2 中央',type:'TAP',subLane:4,subLaneWidth:2},
  {id:'TAP 全幅10',type:'TAP',subLane:0,subLaneWidth:10},
  {id:'FLICK 幅2',type:'FLICK',subLane:8,subLaneWidth:2},
  {id:'HOLD 幅2',type:'HOLD',subLane:4,subLaneWidth:2,holdMs:700},
  {id:'HOLD 旧譜面',type:'HOLD',lane:0,holdMs:700},
  {id:'HOLD 長尺',type:'HOLD',subLane:0,subLaneWidth:2,holdMs:1800},
  {id:'HOLD 幅2→全幅10',type:'HOLD',subLane:4,subLaneWidth:2,holdMs:700,holdPoints:[{at:0,subLane:4,subLaneWidth:2},{at:700,subLane:0,subLaneWidth:10}]},
  {id:'SLIDE 幅2 直線',type:'SLIDE',lane:1,subLaneWidth:2,holdMs:700},
  {id:'SLIDE 幅4 移動',type:'SLIDE',lane:2.5,endLane:1,subLaneWidth:4,holdMs:700},
  {id:'SLIDE 長尺',type:'SLIDE',lane:2,subLaneWidth:2,holdMs:1800},
];
const SPEEDS=[1,6,12],PROGRESSES=[.5,.9,1.05];
// 速度→走行時間の変換は game-system.jsx 側にあるので、ここでは代表値(速度1・6・12)を直接使う
const travelMsForSpeed=speed=>({1:7000,6:2150,12:500})[speed];
const yFor=p=>spawnY+run(`rhythmProjectTravelProgress(${p})`)*travelPx;
const parseClip=clip=>[...String(clip||'').matchAll(/(-?[\d.]+)%\s+(-?[\d.]+)%/g)].map(m=>({x:Number(m[1])/100,r:Number(m[2])/100}));
let worstHead=0,worstBand=0,worstSlide=0,worstEnd=0,measured=0;
for(const source of CASES)for(const speed of SPEEDS)for(const progress of PROGRESSES){
  const travelMs=travelMsForSpeed(speed);
  const note={type:source.type,timeMs:10000,lane:source.lane??Math.floor((source.subLane??0)/2),index:0};
  if(source.subLane!=null)note.subLane=source.subLane;
  if(source.subLaneWidth!=null)note.subLaneWidth=source.subLaneWidth;
  if(source.holdMs){
    note.endTimeMs=note.timeMs+source.holdMs;
    if(source.holdPoints)note.holdPoints=source.holdPoints.map(p=>({timeMs:note.timeMs+p.at,subLane:p.subLane,subLaneWidth:p.subLaneWidth}));
    if(source.type==='SLIDE'){note.endLane=source.endLane??note.lane;note.slidePoints=[{timeMs:note.timeMs,lane:note.lane},{timeMs:note.endTimeMs,lane:note.endLane}];}
  }
  const yPx=Math.round(yFor(progress)),releaseYpx=Math.round(yFor(progress-(source.holdMs||0)/travelMs)),bodyPx=Math.max(0,yPx-releaseYpx);
  const visualTime=note.timeMs-(1-progress)*travelMs;
  const slideTravel={chartNowMs:visualTime,visualTime,travelMs,spawnY,travelPx};
  const hasBody=source.holdMs!=null;
  ctx.__note=note;ctx.__rect=rect;ctx.__travel=slideTravel;ctx.__fake=fakeEl(note);
  run(`rhythmLayoutNoteVisual(__fake.el,__note,${yPx},__note.lane,{},${hasBody?releaseYpx:'null'},__travel,{rect:__rect,noteHeight:${noteHeight},bodyHeight:${bodyPx}})`);
  const geo=run(`rhythmNoteCanvasGeometry(__note,${yPx},__note.lane,__rect,${noteHeight},${hasBody?releaseYpx:'null'},__travel,${hasBody?bodyPx:0})`);
  measured++;
  const {el,body}=ctx.__fake;
  // 粒: DOM は left=0 + translate + width。中心 = translate + width/2
  const domLeft=parseFloat(el.style.translate),domWidth=parseFloat(el.style.width);
  worstHead=Math.max(worstHead,Math.abs(domLeft+domWidth/2-geo.head.cx),Math.abs(domWidth-geo.head.w));
  // HOLD 帯: clipPath の %(帯の箱 = 幅 rect.width・高さ bodyPx・下端 = 粒の中心)と canvas の外周
  if(note.type==='HOLD'&&bodyPx>0&&geo.band){
    const pairs=parseClip(body.style.clipPath),half=pairs.length/2;
    const domRight=pairs.slice(0,half),domLeftEdge=pairs.slice(half).reverse();
    const bodyTopY=yPx+noteHeight/2-bodyPx;
    if(domRight.length!==geo.band.length)worstBand=Math.max(worstBand,999);
    else geo.band.forEach((edge,i)=>{
      worstBand=Math.max(worstBand,Math.abs(domRight[i].x*rect.width-edge.right),Math.abs(domLeftEdge[i].x*rect.width-edge.left),Math.abs(bodyTopY+domRight[i].r*bodyPx-edge.y));
    });
  }
  // SLIDE 帯: polygon points(文字列)と canvas の四角形
  if(note.type==='SLIDE'&&geo.slide){
    const polys=body.childNodes.map(n=>String(n.points||'').split(/[\s,]+/).map(Number));
    if(polys.length!==geo.slide.length)worstSlide=Math.max(worstSlide,999);
    else geo.slide.forEach((q,i)=>{const p=polys[i];worstSlide=Math.max(worstSlide,Math.abs(p[0]-q.l0),Math.abs(p[1]-q.y0),Math.abs(p[2]-q.r0),Math.abs(p[4]-q.r1),Math.abs(p[5]-q.y1),Math.abs(p[6]-q.l1));});
  }
  // ENDバー: DOM の left/top/width は粒の要素基準(left=translate)。中心 = translate + left + width/2、上端 + 4 = 中心の y
  if(hasBody&&el._rhythmEndBar&&geo.end){
    const bar=el._rhythmEndBar.style;
    const domCx=domLeft+parseFloat(bar.left)+parseFloat(bar.width)/2,domCy=yPx+parseFloat(bar.top)+4,domW=parseFloat(bar.width);
    worstEnd=Math.max(worstEnd,Math.abs(domCx-geo.end.cx),Math.abs(domCy-geo.end.cy),Math.abs(domW-geo.end.w));
  }
}
check('全組み合わせを比べられた',measured===CASES.length*SPEEDS.length*PROGRESSES.length,`${measured}件`);
check('粒の中心と幅が DOM 版と一致(0.05px 以内)',worstHead<=.05,`最大ズレ ${worstHead.toFixed(3)}px`);
check('HOLD 帯の外周が DOM 版の clipPath と一致(0.05px 以内・点の数も同じ)',worstBand<=.05,`最大ズレ ${worstBand.toFixed(3)}px`);
check('SLIDE 帯の区切りが DOM 版の polygon と一致(0.05px 以内・数も同じ)',worstSlide<=.05,`最大ズレ ${worstSlide.toFixed(3)}px`);
check('終わりの横棒の中心と幅が DOM 版と一致(0.05px 以内)',worstEnd<=.05,`最大ズレ ${worstEnd.toFixed(3)}px`);
// 判定・入力には触っていない
check('canvas 版は判定・入力の関数を呼ばない',!/rhythmNoteCanvasGeometry[\s\S]*?\n};/.test(source)||!/const rhythmNoteCanvasGeometry=[\s\S]*?\n};/.exec(source)[0].match(/rhythmMatchInputBatch|applyJudgment|rhythmJudge/));
console.log(failed?`\n${failed}件のNGがあります`:'\nOK: canvas 版の座標は DOM 版と一致');
process.exit(failed?1:0);
