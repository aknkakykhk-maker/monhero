#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'../..'),file=path.join(ROOT,'monster-hero/data/rhythm-mode.js'),source=fs.readFileSync(file,'utf8'),game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const projection=source.match(/const RHYTHM_PROJECTION_TOP_SCALE=[\s\S]*?const rhythmProjectTravelProgress=[\s\S]*?\n\};/)?.[0],slide=source.match(/const rhythmSlidePoints=[\s\S]*?const rhythmSlideExpectedLane=[\s\S]*?\n\};/)?.[0],segments=source.match(/const rhythmSlideSegmentPolygons=[\s\S]*?\n\};/)?.[0],helpers=[projection,slide,segments].filter(Boolean).join('\n');
check('SLIDE経路描画helperを抽出できる',!!helpers);
if(helpers){
  const context={RHYTHM_LANE_COUNT:5};vm.runInNewContext(`${helpers}\nthis.out={rhythmSlideExpectedLane,rhythmSlideSegmentPolygons,rhythmProjectLane,rhythmProjectTravelProgress};`,context);
  const h=context.out,note={type:'SLIDE',timeMs:1000,endTimeMs:4000,lane:0,endLane:4,slidePoints:[{timeMs:1000,lane:0},{timeMs:2000,lane:3},{timeMs:3000,lane:1},{timeMs:4000,lane:4}]},travel={visualTime:1000,travelMs:4000,spawnY:0,travelPx:800,noteHalfHeight:10},rect={width:500,height:900};
  const steps=Number(source.match(/const RHYTHM_SLIDE_SEGMENT_STEPS=(\d+)/)?.[1])||1;
  const all=h.rhythmSlideSegmentPolygons(note,1000,travel,rect),remaining=h.rhythmSlideSegmentPolygons(note,2500,travel,rect);
  check('slidePointsの全区間を個別polygonへ変換',all.length===(note.slidePoints.length-1)*steps);
  check('始点と終点だけを直結する巨大polygonを作らない',all.length===3*steps&&steps>=2&&source.includes("createElementNS('http://www.w3.org/2000/svg','polygon')"));
  check('通過済み区間を除き現在補間位置から残りだけ描画',remaining.length===2*steps&&Math.abs(h.rhythmSlideExpectedLane(note,2500)-2)<1e-9);
  const widths=all.map(points=>{const n=points.split(/[ ,]/).map(Number);return [n[2]-n[0],n[4]-n[6]];});
  check('各端の帯幅は横移動量でなく同一レーン幅基準',widths.flat().every(width=>width>0&&width<70));
  check('奥から手前へ共通projectionに従って自然に太くなる',widths[0][1]<widths[0][0]);
  const last=all[all.length-1].split(/[ ,]/).map(Number),endY=last[5],endLane=h.rhythmProjectLane(4,endY/rect.height);
  check('最後の帯中心はslidePoints終端・ENDバーと同じレーン投影',Math.abs((last[4]+last[6])/2-rect.width*endLane.center)<.02&&source.includes('rhythmReleaseLane(note),endY'));
}
check('描画は判定と同じrhythmSlidePointsを正本にしてnote単位で再利用できる',source.includes('const points=rhythmSlidePoints(note);')&&source.includes('note?._rhythmSlideRenderPoints||rhythmSlidePoints(note)')&&game.includes('_rhythmSlideRenderPoints:rhythmSlidePoints(note)'));
check('既存projectionとプレイ本体rAFの時刻を再利用',source.includes('rhythmProjectTravelProgress(progress)')&&source.includes('rhythmProjectSlideSpan(Number(point.lane),note,yRatio,point.timeMs)')&&game.includes('chartNowMs:songTimeMs-settings.judgmentTimingOffsetMs'));
check('SLIDE区間計算は毎frameのfilter・map・spread配列を作らない',!segments.includes('.filter(')&&!segments.includes('.map(')&&!segments.includes('...source'));
check('playArea rectとnote高さは1frameの計測結果を全noteで共有',game.includes('rect:areaRect,noteHeight')&&game.includes('{rect:travel.rect,noteHeight:travel.noteHeight,bodyHeight:bodyPx}'));
check('表示外noteは重いprojectionとpolygon更新をskip',game.includes("if(!visible||!travel)return;")&&game.indexOf("if(!visible||!travel)return;")<game.indexOf('rhythmLayoutNoteVisual(el,note'));
check('polygon DOMは不足分だけ追加し通過済み区間を非表示で再利用',source.includes("if(!segment){segment=document.createElementNS")&&source.includes("body.childNodes[index].style.display='none'")&&!source.includes('body.lastChild.remove()'));
check('同一polygon pointsのsetAttributeを省略',source.includes("if(segment._rhythmPoints!==points){segment.setAttribute('points',points);segment._rhythmPoints=points;}"));
check('SLIDE幅2の許容値と現在幅を使う追従判定',source.includes('const RHYTHM_SLIDE_TOLERANCE_LANES = .82;')&&source.includes('if(Math.abs(actual-expected)>rhythmSlideTrackingTolerance(session.note,chartNow))'));
check('SLIDE帯は薄い塗りと控えめな発光でも縁を維持',source.includes('fill:rgba(168,85,247,.48)')&&source.includes('stroke:rgba(233,213,255,.56)')&&source.includes('drop-shadow(0 0 5px rgba(168,85,247,.38)'));
check('TAP・HOLD・FLICK描画分岐を維持',game.includes("note.type==='HOLD'&&<span data-rhythm-hold-body")&&source.includes('[data-note-type="FLICK"]')&&source.includes('rhythmNoteVisualSpan(note,lane,yRatio)'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
