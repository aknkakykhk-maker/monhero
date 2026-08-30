#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const source=read('monster-hero/data/rhythm-mode.js'),html=read('monster-hero/index.html');
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const helper=source.match(/const RHYTHM_PROJECTION_TOP_SCALE=[\s\S]*?const rhythmLanePolygon=lane=>\{[\s\S]*?\n\};/)?.[0];
check('共通projection helperを抽出できる',!!helper);
if(helper){
  const context={RHYTHM_LANE_COUNT:5};vm.runInNewContext(`${helper}\nthis.out={rhythmProjectLane,rhythmLanePolygon};`,context);
  const {rhythmProjectLane}=context.out;
  for(const y of [0,.2,.5,.88,1])for(let lane=0;lane<5;lane++){
    const p=rhythmProjectLane(lane,y),left=rhythmProjectLane(0,y).center-rhythmProjectLane(0,y).width/2;
    check(`lane ${lane+1} / y ${y} の中央と境界が同じ投影式`,Math.abs(p.center-(left+(lane+.5)*p.width))<1e-9);
  }
  check('奥ほど細く判定ライン側ほど広い',rhythmProjectLane(2,0).width<rhythmProjectLane(2,.88).width&&rhythmProjectLane(2,.88).width<rhythmProjectLane(2,1).width);
}
check('TAP・FLICK・SLIDE端点が共通projectionを使用',source.includes('const projected=rhythmProjectLane(visualLane,yRatio)')&&source.includes("const topLane=body.hasAttribute('data-rhythm-slide-body')")&&source.includes('const top=rhythmProjectLane(topLane,topY/areaRect.height),bottom=rhythmProjectLane(visualLane,yRatio)'));
check('HOLD・SLIDE帯も共通境界からpolygonを生成',source.includes('body.style.clipPath=`polygon('));
check('レーン形状・番号・発光は同じlane polygon',source.includes('lane.style.clipPath=rhythmLanePolygon(index)')&&source.includes('const label=lane.querySelector')&&html.includes('[data-rhythm-lane][data-pressed="true"]'));
check('判定ラインも同じ投影幅',source.includes('const judgeProjection=rhythmProjectLane(2,judgeY/areaRect.height)')&&source.includes('line.style.left=')&&source.includes('line.style.right='));
check('別座標系のCSS 3D変形を廃止',!html.includes('transform:perspective(')&&!source.includes('const scale=.44+.56*depth'));
check('既存の同時押しbatchを維持',source.includes('const rhythmMatchInputBatch='));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
