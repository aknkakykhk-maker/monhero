#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const context={console};
vm.runInNewContext(`${source}\nthis.out={RHYTHM_SONGS,RHYTHM_SLIDE_TOLERANCE_LANES,rhythmSlideAuthoredLane,rhythmSlideWidth,rhythmSlideInputSpan,rhythmSlideTrackingTolerance,rhythmSlideExpectedLane,rhythmReleaseLane,rhythmProjectLane,rhythmProjectSlideSpan,rhythmNoteVisualSpan,rhythmNoteHasVariableSpan,rhythmMatchInputBatch,rhythmSlideSegmentPolygons,RHYTHM_GESTURE_RUNTIME,widthSlideTestChart,widthSlideVariableTestChart};`,context);
const {
  RHYTHM_SONGS,RHYTHM_SLIDE_TOLERANCE_LANES,rhythmSlideAuthoredLane,rhythmSlideWidth,
  rhythmSlideInputSpan,rhythmSlideTrackingTolerance,rhythmSlideExpectedLane,rhythmReleaseLane,
  rhythmProjectLane,rhythmProjectSlideSpan,rhythmNoteVisualSpan,rhythmNoteHasVariableSpan,
  rhythmMatchInputBatch,rhythmSlideSegmentPolygons,RHYTHM_GESTURE_RUNTIME,widthSlideTestChart,
  widthSlideVariableTestChart,
}=context.out;
const close=(a,b,epsilon=1e-9)=>Math.abs(Number(a)-Number(b))<epsilon;
const makeSlide=(overrides={})=>({
  type:'SLIDE',timeMs:1000,endTimeMs:2200,lane:.5,endLane:1.5,done:false,activePointerId:null,
  slidePoints:[{timeMs:1000,lane:.5},{timeMs:1600,lane:1},{timeMs:2200,lane:1.5}],
  ...overrides,
});

check('SLIDE authored laneは0.5刻みを受け付ける',rhythmSlideAuthoredLane(.5)===.5&&rhythmSlideAuthoredLane(3.5)===3.5&&rhythmSlideAuthoredLane(4)===4);
check('0.25刻みや範囲外はSTEP2B-1以降も受け付けない',rhythmSlideAuthoredLane(.25)===null&&rhythmSlideAuthoredLane(4.5)===null);

const slide=makeSlide();
check('slidePointsの0.5刻みを時間補間できる',close(rhythmSlideExpectedLane(slide,1300),.75)&&close(rhythmSlideExpectedLane(slide,1900),1.25));
check('終端レーンも0.5刻みを維持する',close(rhythmReleaseLane(slide),1.5));

const visual=rhythmNoteVisualSpan({type:'SLIDE'},1.25,.72),expected=rhythmProjectLane(1.25,.72);
check('幅指定なしSLIDE頭は従来幅・連続座標を維持する',close(visual.center,expected.center)&&close(visual.width,expected.width));
check('SLIDEはTAP/HOLDのleft-edge可変span扱いにはしない',!rhythmNoteHasVariableSpan(slide));
check('幅指定なし/不正幅は従来の幅2へ正規化する',rhythmSlideWidth(slide)===2&&rhythmSlideWidth(makeSlide({subLaneWidth:0}))===2&&rhythmSlideWidth(makeSlide({subLaneWidth:5}))===2);
check('SLIDEはsubLaneWidth 1〜4を受け付ける',[1,2,3,4].every(width=>rhythmSlideWidth(makeSlide({subLaneWidth:width}))===width));

const y=.68,legacySpan=rhythmProjectLane(1.5,y),width1Span=rhythmProjectSlideSpan(1.5,makeSlide({subLaneWidth:1}),y),width2Span=rhythmProjectSlideSpan(1.5,makeSlide({subLaneWidth:2}),y),width4Span=rhythmProjectSlideSpan(1.5,makeSlide({subLaneWidth:4}),y);
check('SLIDE幅2は旧固定幅projectionと完全互換',close(width2Span.left,legacySpan.left)&&close(width2Span.right,legacySpan.right)&&close(width2Span.center,legacySpan.center));
check('SLIDE幅1〜4で中心を動かさず幅だけ変わる',close(width1Span.center,width2Span.center)&&close(width4Span.center,width2Span.center)&&close(width1Span.width*2,width2Span.width)&&close(width4Span.width,width2Span.width*2));

const input1=rhythmSlideInputSpan(makeSlide({subLaneWidth:1})),input4=rhythmSlideInputSpan(makeSlide({subLaneWidth:4}));
check('SLIDE開始入力幅もsubLaneWidthへ一致する',close(input1.width,1)&&close(input4.width,4)&&close(input1.center,input4.center));
let result=rhythmMatchInputBatch([makeSlide({subLaneWidth:1})],[{inputKey:'narrow-center',lane:1,subLaneCoordinate:2}],1000,0);
check('幅1 SLIDEを中心で開始できる',!!result[0].target);
RHYTHM_GESTURE_RUNTIME.clear();
result=rhythmMatchInputBatch([makeSlide({subLaneWidth:1})],[{inputKey:'narrow-outside',lane:1,subLaneCoordinate:2.7}],1000,0);
check('幅1 SLIDEの開始範囲外は取得しない',!result[0].target);
RHYTHM_GESTURE_RUNTIME.clear();
result=rhythmMatchInputBatch([makeSlide({subLaneWidth:4})],[{inputKey:'wide-edge',lane:0,subLaneCoordinate:.01}],1000,0);
check('幅4 SLIDEは拡張された開始範囲で取得できる',!!result[0].target);
RHYTHM_GESTURE_RUNTIME.clear();

result=rhythmMatchInputBatch([makeSlide()],[{inputKey:'half-start',lane:1,subLaneCoordinate:2}],1000,0);
check('メインレーン境界上の0.5位置から旧幅SLIDEを開始できる',!!result[0].target);
RHYTHM_GESTURE_RUNTIME.clear();
result=rhythmMatchInputBatch([makeSlide()],[{inputKey:'half-outside',lane:1,subLaneCoordinate:3.01}],1000,0);
check('旧幅SLIDE開始範囲の外側は取得しない',!result[0].target);
RHYTHM_GESTURE_RUNTIME.clear();
const legacy={type:'SLIDE',timeMs:1000,endTimeMs:2000,lane:2,endLane:3,done:false,activePointerId:null,slidePoints:[{timeMs:1000,lane:2},{timeMs:2000,lane:3}]};
result=rhythmMatchInputBatch([legacy],[{inputKey:'legacy',lane:2,subLaneCoordinate:5}],1000,0);
check('旧整数レーンSLIDEの開始入力互換を維持する',!!result[0].target);
RHYTHM_GESTURE_RUNTIME.clear();

check('幅2の途中追従許容は従来0.82レーンのまま',close(rhythmSlideTrackingTolerance(makeSlide({subLaneWidth:2})),RHYTHM_SLIDE_TOLERANCE_LANES));
check('細SLIDEは狭く、太SLIDEは広く追従できる',rhythmSlideTrackingTolerance(makeSlide({subLaneWidth:1}))<RHYTHM_SLIDE_TOLERANCE_LANES&&rhythmSlideTrackingTolerance(makeSlide({subLaneWidth:4}))>RHYTHM_SLIDE_TOLERANCE_LANES);

const rect={width:500,height:800},travel={visualTime:1000,travelMs:2000,spawnY:0,travelPx:700};
const narrowPolygon=rhythmSlideSegmentPolygons(makeSlide({lane:1.5,endLane:1.5,subLaneWidth:1,slidePoints:[{timeMs:1000,lane:1.5},{timeMs:2200,lane:1.5}]}),1000,travel,rect)[0];
const widePolygon=rhythmSlideSegmentPolygons(makeSlide({lane:1.5,endLane:1.5,subLaneWidth:4,slidePoints:[{timeMs:1000,lane:1.5},{timeMs:2200,lane:1.5}]}),1000,travel,rect)[0];
const firstWidth=polygon=>{const coords=polygon.trim().split(/\s+/).slice(0,2).map(pair=>Number(pair.split(',')[0]));return coords[1]-coords[0];};
check('SLIDE帯SVGも幅1〜4を反映する',firstWidth(widePolygon)>firstWidth(narrowPolygon)*3.9);

const hard=RHYTHM_SONGS.find(song=>song.songId==='width_test')?.difficulties?.HARD;
check('WIDTH TEST HARDにSTEP2B-1位置確認譜面を維持する',hard===widthSlideTestChart&&hard.notes.some(note=>note.type==='SLIDE'));
const authoredSlides=hard?.notes?.filter(note=>note.type==='SLIDE')||[];
check('HARDの authored point は0.5刻みを維持する',authoredSlides.length>0&&authoredSlides.every(note=>[note.lane,note.endLane,...note.slidePoints.map(point=>point.lane)].every(lane=>close(Number(lane)*2,Math.round(Number(lane)*2)))));
check('HARDは旧幅2相当のまま残す',authoredSlides.every(note=>note.subLaneWidth==null));

const expert=RHYTHM_SONGS.find(song=>song.songId==='width_test')?.difficulties?.EXPERT;
const variableSlides=expert?.notes?.filter(note=>note.type==='SLIDE')||[];
check('WIDTH TEST EXPERTに可変幅SLIDE確認譜面がある',expert===widthSlideVariableTestChart&&variableSlides.length>=4);
check('EXPERTに幅1〜4をすべて収録する',[1,2,3,4].every(width=>variableSlides.some(note=>note.subLaneWidth===width)));
check('STEP2B-2では1ノーツ内の途中幅変化をまだ入れない',variableSlides.every(note=>note.slidePoints.every(point=>point.subLaneWidth==null&&point.width==null)));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);