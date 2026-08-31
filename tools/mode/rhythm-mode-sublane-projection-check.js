#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const source=read('monster-hero/data/rhythm-mode.js'),game=read('monster-hero/src/game-system.jsx');
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const helper=source.match(/const RHYTHM_PROJECTION_TOP_SCALE=[\s\S]*?const rhythmLaneAtPoint=[\s\S]*?\n\};/)?.[0];
check('10サブレーンprojection helperを抽出できる',!!helper&&source.includes('const RHYTHM_SUB_LANE_COUNT = RHYTHM_LANE_COUNT*2'));
if(helper){
  const context={RHYTHM_LANE_COUNT:5};
  vm.runInNewContext(`${helper}\nthis.out={rhythmProjectBoundary,rhythmProjectLane,rhythmProjectSubLaneSpan,rhythmNoteVisualSpan};`,context);
  const h=context.out,close=(a,b)=>Math.abs(a-b)<1e-9;
  for(const y of [0,.5,.88,1]){
    const spans=Array.from({length:10},(_,subLane)=>h.rhythmProjectSubLaneSpan(subLane,1,y));
    check(`y ${y} で10サブレーンを連続生成`,spans.every((span,index)=>span.subLane===index&&span.width>0&&(index===0||close(spans[index-1].right,span.left))));
    check(`y ${y} で旧lane 0〜4と幅2が従来projectionに一致`,[0,1,2,3,4].every(lane=>{const old=h.rhythmProjectLane(lane,y),compat=h.rhythmNoteVisualSpan({type:'TAP'},lane,y),width2=h.rhythmProjectSubLaneSpan(lane*2,2,y);return close(old.left,compat.left)&&close(old.right,compat.right)&&close(old.center,width2.center)&&close(old.width,width2.width);}));
    check(`y ${y} で幅1〜4を共通境界へ投影`,[1,2,3,4].every(width=>{const span=h.rhythmProjectSubLaneSpan(3,width,y);return close(span.left,h.rhythmProjectBoundary(1.5,y))&&close(span.right,h.rhythmProjectBoundary((3+width)/2,y));}));
    check(`y ${y} で左右端を外へ出さない`,[1,2,3,4].every(width=>{const left=h.rhythmProjectSubLaneSpan(-5,width,y),right=h.rhythmProjectSubLaneSpan(20,width,y);return left.left>=h.rhythmProjectBoundary(0,y)&&right.right<=h.rhythmProjectBoundary(5,y);}));
  }
  check('奥側と手前側で同じprojection scaleを共有',[.05,.88].every(y=>[1,2,3,4].every(width=>close(h.rhythmProjectSubLaneSpan(4,width,y).scale,h.rhythmProjectLane(2,y).scale))));
}
check('薄い5本のサブレーン境界を共通boundaryで配置',game.includes('Array.from({length:5},(_,index)=><i key={index} data-rhythm-sublane-boundary="" />)')&&source.includes('rhythmProjectBoundary(coordinate,0)')&&source.includes('rhythmProjectBoundary(coordinate,1)'));
check('可変幅はTAP描画だけに限定',source.includes("note?.type==='TAP'")&&source.includes('rhythmNoteVisualSpan(note,lane,yRatio)'));
check('既存HOLD・SLIDE帯とENDバーのprojectionを維持',source.includes('rhythmProjectLane(Number(point.lane),yRatio)')&&source.includes('top=rhythmProjectLane(topLane,topY/rect.height),bottom=rhythmProjectLane(lane,yRatio)')&&source.includes('end=rhythmProjectLane(rhythmReleaseLane(note),endY)'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
