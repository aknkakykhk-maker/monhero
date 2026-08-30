#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const source=read('monster-hero/data/rhythm-mode.js'),game=read('monster-hero/src/game-system.jsx'),html=read('monster-hero/index.html');
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const helper=source.match(/const RHYTHM_PROJECTION_TOP_SCALE=[\s\S]*?const rhythmLaneAtPoint=[\s\S]*?\n\};/)?.[0];
check('共通projection helperを抽出できる',!!helper);
if(helper){
  const context={RHYTHM_LANE_COUNT:5};vm.runInNewContext(`${helper}\nthis.out={rhythmProjectLane,rhythmLanePolygon,rhythmProjectTravelProgress,rhythmLaneCoordinateAtPoint,rhythmLaneAtPoint};`,context);
  const {rhythmProjectLane,rhythmProjectTravelProgress,rhythmLaneCoordinateAtPoint,rhythmLaneAtPoint}=context.out,rect={left:20,top:40,width:500,height:800};
  for(const y of [.05,.5,.88])for(let lane=0;lane<5;lane++){
    const p=rhythmProjectLane(lane,y),left=rhythmProjectLane(0,y).center-rhythmProjectLane(0,y).width/2;
    const clientX=rect.left+p.center*rect.width,clientY=rect.top+y*rect.height,coordinate=rhythmLaneCoordinateAtPoint(clientX,clientY,rect);
    check(`lane ${lane+1} / y ${y} の境界・中央・入力が一致`,Math.abs(p.center-(left+(lane+.5)*p.width))<1e-9&&Math.abs(coordinate-lane)<1e-9&&rhythmLaneAtPoint(clientX,clientY,rect)===lane);
  }
  check('奥ほど細く判定ライン側ほど広い',rhythmProjectLane(2,0).width<rhythmProjectLane(2,.88).width&&rhythmProjectLane(2,.88).width<rhythmProjectLane(2,1).width);
  const far=rhythmProjectTravelProgress(.2)-rhythmProjectTravelProgress(.1),near=rhythmProjectTravelProgress(.9)-rhythmProjectTravelProgress(.8);
  check('Y移動は時刻を保った自然な非線形遠近',rhythmProjectTravelProgress(0)===0&&rhythmProjectTravelProgress(1)===1&&far>0&&near>far&&near/far<2);
}
check('TAP・FLICK・SLIDE端点が共通projectionを使用',source.includes('const projected=rhythmProjectLane(lane,yRatio)')&&source.includes("const topLane=body.hasAttribute('data-rhythm-slide-body')")&&source.includes('const top=rhythmProjectLane(topLane,topY/rect.height),bottom=rhythmProjectLane(lane,yRatio)'));
check('HOLD・SLIDE帯も共通境界からpolygonを生成',source.includes('body.style.clipPath=`polygon('));
check('レーン形状・番号・発光は同じlane polygon',source.includes('lane.style.clipPath=rhythmLanePolygon(index)')&&source.includes('const label=lane.querySelector')&&html.includes('[data-rhythm-lane][data-pressed="true"]'));
check('判定ラインも同じ投影幅',source.includes('projection=rhythmProjectLane(2,y)')&&source.includes('line.style.left=')&&source.includes('line.style.right='));
check('Touch・Pointer・SLIDE追従がclientX/clientYで共通逆投影',game.includes('rhythmLaneAtPoint(e.clientX,e.clientY,rect)')&&game.includes('rhythmLaneAtPoint(touch.clientX,touch.clientY,rect)')&&source.includes('rhythmLaneCoordinateAtPoint(clientX,clientY,rect)'));
check('ノーツY/X/幅をプレイ本体の同じrAFで配置',game.includes('rhythmProjectTravelProgress(progress)*travel.travelPx')&&game.includes('rhythmLayoutNoteVisual(el,note,yPx,visualLane,playAreaRef.current)')&&!source.match(/const installRhythmPerspectiveNoteVisuals=[\s\S]*?requestAnimationFrame/));
check('別座標系のCSS 3D変形を廃止',!html.includes('transform:perspective(')&&!source.includes('const scale=.44+.56*depth'));
check('既存の同時押しbatchを維持',source.includes('const rhythmMatchInputBatch='));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
