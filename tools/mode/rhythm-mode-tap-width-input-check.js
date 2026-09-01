#!/usr/bin/env node
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('monster-hero/data/rhythm-mode.js','utf8');
const game=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(source,ctx);
const run=code=>vm.runInContext(code,ctx);
const note=(subLane,subLaneWidth,index=0,extra={})=>({type:'TAP',timeMs:1000,lane:Math.floor(subLane/2),subLane,subLaneWidth,index,done:false,activePointerId:null,...extra});
const match=(notes,inputs)=>run(`rhythmMatchInputBatch(${JSON.stringify(notes)},${JSON.stringify(inputs)},1000,0).map(x=>x.target&&x.target.index)`);
const input=(subLaneCoordinate,key='touch:1')=>({lane:Math.max(0,Math.min(4,Math.floor(subLaneCoordinate/2))),subLaneCoordinate,inputKey:key});
assert.deepEqual(match([note(4,1)],[input(4.5)]),[0],'幅1中央');
for(const width of [2,3,4]) assert.deepEqual(match([note(3,width)],[input(3+width-.01)]),[0],`幅${width}内側`);
assert.deepEqual(match([note(3,2)],[input(2.99)]),[null],'幅2範囲外');
assert.deepEqual(match([note(0,1)],[input(.5)]),[0],'左端');
assert.deepEqual(match([note(9,1)],[input(9.5)]),[0],'右端');
assert.deepEqual(match([note(4,1)],[input(3.85)]),[0],'幅1の最小タッチ許容内');
assert.deepEqual(match([note(4,1)],[input(3.8)]),[null],'細ノーツ許容を広げすぎない');
assert.strictEqual(match([note(4,1,0),note(5,1,1)],[input(5)]).filter(x=>x!==null).length,1,'1入力1ノーツ');
assert.deepEqual(match([note(4,1,0),note(5,1,1)],[input(4.5,'touch:1'),input(5.5,'touch:2')]),[0,1],'別指同時取得');
assert.deepEqual(match([{type:'TAP',timeMs:1000,lane:2,index:0,done:false,activePointerId:null}],[{lane:2,inputKey:'touch:1'}]),[0],'旧5レーンTAP互換');
for(const y of [.05,.5,.88,1]) for(const sub of [.1,2.5,5.5,9.9]){
  const rect={left:10,top:20,width:400,height:800},left=run(`rhythmProjectBoundary(0,${y})`),right=run(`rhythmProjectBoundary(5,${y})`),x=rect.left+rect.width*(left+(right-left)*sub/10),cy=rect.top+rect.height*y;
  const actual=run(`rhythmSubLaneCoordinateAtPoint(${x},${cy},${JSON.stringify(rect)})`);
  assert(Math.abs(actual-sub)<1e-9,'描画projectionと入力逆変換');
}
assert(source.includes("id==='EASY'?widthTestChart")&&/\[7200,4,1\],\[7200,5,1\]/.test(source),'WIDTH TEST譜面');
assert(game.includes('subLaneCoordinate=rhythmSubLaneCoordinateAtPoint')&&game.includes('{lane,subLaneCoordinate,inputKey'),'Touch/Pointerが実座標を渡す');
assert(source.includes("note?.type==='TAP'||note?.type==='HOLD'")&&source.includes('return note.lane===lane'),'HOLD可変幅・FLICK/SLIDE回帰');
assert(source.includes('rhythmReleaseTargetMs')&&source.includes('data-rhythm-end-bar'),'ENDバー回帰');
console.log('OK: 10サブレーン可変幅TAP入力・許容・同時入力・旧譜面・projection回帰');
