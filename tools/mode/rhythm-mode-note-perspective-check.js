#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const source=read('monster-hero/data/rhythm-mode.js'),game=read('monster-hero/src/game-system.jsx'),html=read('monster-hero/index.html'),release=read('monster-hero/data/rhythm-step3-release.js'),help=read('monster-hero/data/help.js');
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const helper=source.match(/const RHYTHM_PROJECTION_TOP_SCALE=[\s\S]*?const rhythmLaneAtPoint=[\s\S]*?\n\};/)?.[0];
check('共通projection helperを抽出できる',!!helper);
if(helper){
  const context={RHYTHM_LANE_COUNT:5};vm.runInNewContext(`${helper}\nthis.out={rhythmProjectBoundary,rhythmProjectLane,rhythmLanePolygon,rhythmProjectTravelProgress,rhythmLaneCoordinateAtPoint,rhythmLaneAtPoint};`,context);
  const {rhythmProjectBoundary,rhythmProjectLane,rhythmProjectTravelProgress,rhythmLaneCoordinateAtPoint,rhythmLaneAtPoint}=context.out,rect={left:20,top:40,width:500,height:800};
  for(const y of [0,.25,.5,.75,.88]){
    for(let lane=0;lane<5;lane++){
      const p=rhythmProjectLane(lane,y),left=rhythmProjectBoundary(lane,y),right=rhythmProjectBoundary(lane+1,y);
      const clientX=rect.left+p.center*rect.width,clientY=rect.top+y*rect.height,coordinate=rhythmLaneCoordinateAtPoint(clientX,clientY,rect);
      check(`lane ${lane+1} / y ${y} の境界・中央・入力が一致`,Math.abs(p.left-left)<1e-9&&Math.abs(p.right-right)<1e-9&&Math.abs(p.center-(left+right)/2)<1e-9&&Math.abs(coordinate-lane)<1e-9&&rhythmLaneAtPoint(clientX,clientY,rect)===lane);
      const leftInside=rect.left+(left+(right-left)*.02)*rect.width,rightInside=rect.left+(right-(right-left)*.02)*rect.width;
      check(`lane ${lane+1} / y ${y} の左右内側も同じレーン`,rhythmLaneAtPoint(leftInside,clientY,rect)===lane&&rhythmLaneAtPoint(rightInside,clientY,rect)===lane);
      if(lane<4)check(`lane ${lane+1}-${lane+2} / y ${y} の共有境界が同一`,Math.abs(p.right-rhythmProjectLane(lane+1,y).left)<1e-9);
    }
    const outerLeft=rhythmProjectBoundary(0,y),outerRight=rhythmProjectBoundary(5,y);
    check(`y ${y} の外周幅はprojection scaleと一致`,Math.abs((outerRight-outerLeft)-rhythmProjectLane(2,y).scale)<1e-9);
  }
  check('奥ほど細く判定ライン側ほど広い',rhythmProjectLane(2,0).width<rhythmProjectLane(2,.88).width&&rhythmProjectLane(2,.88).width<rhythmProjectLane(2,1).width);
  // 収束率は .30 から .18 へ下げた(2026-09-03)。Safe Areaの二重掛けを直してプレイエリアが
  // 1.44倍の高さになったぶん、同じ収束率だと円錐が寝て奥行きが薄く見えるため。
  // 上端が細く収束すること・判定線側が十分広いことは変わらず担保する。
  check('上端は画面幅の20%以下へ収束し、判定線側は87%以上まで広がる',rhythmProjectLane(2,0).scale<=.20&&rhythmProjectLane(2,.88).scale>=.87);
  const far=rhythmProjectTravelProgress(.2)-rhythmProjectTravelProgress(.1),near=rhythmProjectTravelProgress(.9)-rhythmProjectTravelProgress(.8);
  check('Y移動は時刻を保った自然な非線形遠近',rhythmProjectTravelProgress(0)===0&&rhythmProjectTravelProgress(1)===1&&far>0&&near>far&&near/far<2);
  check('手前の移動量は奥の1.6倍以上で迫り感を保つ',near/far>=1.6);
}
check('TAP・HOLD・FLICK・SLIDE端点が共通projectionを使用',source.includes('const projected=rhythmNoteIsSlide(note)?rhythmProjectSlideSpan(lane,note,yRatio,slideTravel?.chartNowMs):rhythmNoteVisualSpan(note,lane,yRatio,slideTravel?.chartNowMs)')&&source.includes('span=rhythmProjectSlideSpan(Number(point.lane),note,yRatio,point.timeMs)')&&source.includes('const bodyTopY=centerY-height;')&&source.includes('const yRatioAt=rhythmClamp01((bodyTopY+height*ratio)/rect.height);')
  &&source.includes('holdSpan?rhythmProjectSubLaneRange(holdSpan.subLane,holdSpan.subLaneWidth,yRatioAt)')
  &&source.includes(':variableHold?rhythmNoteVisualSpan(note,lane,yRatioAt)')
  &&source.includes(':rhythmProjectLane(lane,yRatioAt);'));
check('ノーツの高さと明るさもprojectionに連動',source.includes("--rhythm-note-depth-scale")&&source.includes("--rhythm-note-depth-brightness")&&source.includes('[data-rhythm-note]>span:last-child'));
check('HOLD帯とSLIDE区間はノーツ中心から同じ境界幅で生成',source.includes('centerY=Number(yPx)+noteHeight/2')&&source.includes('const bodyTopY=centerY-height;')&&source.includes('RHYTHM_BODY_WIDTH_RATIO')&&source.includes('body.style.clipPath=`polygon(${[...bodyRight,...bodyLeft].join(\',\')})`')&&source.includes('const topEdgeRatio=height>0?(0-bodyTopY)/height:0;'));
check('5レーンはプレイエリア全体へ重ねて同じ投影座標で描画',source.includes('[data-rhythm-lane]{position:absolute!important;inset:0!important;'));
check('レーン形状と6本の境界線は同じboundary helper',source.includes('lane.style.clipPath=rhythmLanePolygon(index)')&&source.includes("--rhythm-boundary-clip")&&source.includes('rhythmBoundaryLinePolygon(index)')&&source.includes('rhythmBoundaryLinePolygon(RHYTHM_LANE_COUNT,-1)'));
check('押下発光は別楕円ではなくレーン台形本体',source.includes('[data-rhythm-lane]::after{content:none!important}')&&source.includes('[data-rhythm-lane][data-pressed="true"]{background:linear-gradient'));
check('判定ラインも同じ外周境界',source.includes('left=rhythmProjectBoundary(0,y),right=rhythmProjectBoundary(RHYTHM_LANE_COUNT,y)')&&source.includes("line.style.left=`${(left*100).toFixed(4)}%`")&&source.includes("line.style.right=`${((1-right)*100).toFixed(4)}%`"));
check('Touch・Pointer・SLIDE追従がclientX/clientYで共通逆投影',game.includes('rhythmLaneAtPoint(e.clientX,e.clientY,rect)')&&game.includes('rhythmLaneAtPoint(touch.clientX,touch.clientY,rect)')&&source.includes('rhythmLaneCoordinateAtPoint(clientX,clientY,rect)'));
check('描画と横投影は同じ丸め済みY座標を使用',game.includes('yPx=Math.round(yPx);el.style.transform=`translate3d(0,${yPx}px,0)`')&&!game.includes('el.style.transform=`translate3d(0,${yPx}px,0) scale('));
check('ノーツY/X/幅をプレイ本体の同じrAFで配置',game.includes('rhythmProjectTravelProgress(progress)*travel.travelPx')&&game.includes('rhythmLayoutNoteVisual(el,note,yPx,visualLane,playAreaRef.current,releaseYpx,{chartNowMs:')&&!source.match(/const installRhythmPerspectiveNoteVisuals=[\s\S]*?requestAnimationFrame/));
check('別座標系のCSS 3D変形を廃止',!html.includes('transform:perspective(')&&!source.includes('const scale=.44+.56*depth'));
check('既存の同時押しbatchを維持',source.includes('const rhythmMatchInputBatch='));
// FLICKの色はシアン→オレンジ→緑と変えてきた(2026-09-03)。
// シアンはHOLDの縁と背景の青に紛れ、オレンジはモンスターノーツの金色と色相が25度しか離れて
// いなかった。既存4色(ピンク330° / 金50° / シアン188° / 紫271°)のいちばん大きな空きは
// 50°〜188°で、その中の緑(142°)を選んだ。最短距離は46°まで広がる。上方向の印はそのまま。
check('FLICKは他のどのノーツとも別の緑表示で上方向を明示',
  html.includes('[data-rhythm-note][data-note-type="FLICK"][data-note-type="FLICK"] > span:last-child')
  &&html.includes('linear-gradient(180deg,#f0fdf4 0%,#86efac 34%,#22c55e 62%,#15803d 100%)')
  &&html.includes('content:"⇧" !important')
  &&html.includes('rgba(34,197,94,.92)'));
check('FLICKの見た目変更だけで判定距離・受付時間は維持',source.includes('const RHYTHM_FLICK_DISTANCE_PX = 24;')&&source.includes('const RHYTHM_FLICK_MAX_MS = 450;'));

const remainingHelper=release.match(/const rhythmSlideRemainingRatio=[\s\S]*?\n  \};/)?.[0];
check('SLIDE残り時間率helperを抽出できる',!!remainingHelper);
if(remainingHelper){
  const context={};vm.runInNewContext(`${remainingHelper}\nthis.out=rhythmSlideRemainingRatio;`,context);
  const ratio=context.out;
  check('SLIDE帯は開始1→中間0.5→終了0へ単調短縮',ratio(1000,3000,1000)===1&&Math.abs(ratio(1000,3000,2000)-.5)<1e-9&&ratio(1000,3000,3000)===0&&ratio(1000,3000,3500)===0);
}
check('SLIDE残り表示は既存のノーツ描画フレームへ統合',release.includes('const originalSlideVisualLaneForIndex=runtime.slideVisualLaneForIndex.bind(runtime)')&&release.includes('runtime.slideVisualLaneForIndex=index=>')&&release.includes('updateBody(index)')&&!release.includes('requestAnimationFrame('));
check('SLIDE帯の高さだけをCSS変数で短縮',release.includes("body.style.setProperty('--rhythm-slide-visible-height'")&&release.includes('height:var(--rhythm-slide-visible-height,var(--rhythm-slide-height,120px))!important'));
check('SLIDE入力・判定runtimeは上書きしない',!release.includes('runtime.bind=')&&!release.includes('rhythmMatchInputBatch=')&&!release.includes('RHYTHM_SLIDE_TOLERANCE_LANES='));
check('最新のHOLD・SLIDE仕様がヘルプへ反映されている',help.includes('SLIDE')&&help.includes('HOLD')&&help.includes('タイミングで指を離します')&&help.includes('横長の発光する終端バー'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
