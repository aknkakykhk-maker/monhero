#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const context={console};
vm.runInNewContext(`${source}\nthis.out={RHYTHM_SONGS,RHYTHM_SLIDE_TOLERANCE_LANES,rhythmSlideAuthoredLane,rhythmSlideWidth,rhythmSlideWidthAt,rhythmSlideInputSpan,rhythmSlideTrackingTolerance,rhythmSlideExpectedLane,rhythmReleaseLane,rhythmProjectLane,rhythmProjectSlideSpan,rhythmNoteVisualSpan,rhythmNoteHasVariableSpan,rhythmMatchInputBatch,rhythmSlideSegmentPolygons,rhythmSlideFittedLane,rhythmProjectBoundary,RHYTHM_GESTURE_RUNTIME,widthSlideTestChart,widthSlideVariableTestChart,widthSlideChangingTestChart};`,context);
const {
  RHYTHM_SONGS,RHYTHM_SLIDE_TOLERANCE_LANES,rhythmSlideAuthoredLane,rhythmSlideWidth,rhythmSlideWidthAt,
  rhythmSlideInputSpan,rhythmSlideTrackingTolerance,rhythmSlideExpectedLane,rhythmReleaseLane,
  rhythmProjectLane,rhythmProjectSlideSpan,rhythmNoteVisualSpan,rhythmNoteHasVariableSpan,
  rhythmMatchInputBatch,rhythmSlideSegmentPolygons,rhythmSlideFittedLane,rhythmProjectBoundary,
  RHYTHM_GESTURE_RUNTIME,widthSlideTestChart,
  widthSlideVariableTestChart,widthSlideChangingTestChart,
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
// 幅の上限は4→全幅(10)へ広げた(2026-09-04の実機指摘「上限を無くして全幅もありに」)。
// 0や11、小数のような「幅として書けない値」を幅2へ戻す約束はそのまま。
check('幅指定なし/不正幅は従来の幅2へ正規化する',rhythmSlideWidth(slide)===2&&rhythmSlideWidth(makeSlide({subLaneWidth:0}))===2&&rhythmSlideWidth(makeSlide({subLaneWidth:11}))===2&&rhythmSlideWidth(makeSlide({subLaneWidth:2.5}))===2);
check('SLIDEはsubLaneWidth 1〜10(全幅)を受け付ける',[1,2,3,4,5,6,7,8,9,10].every(width=>rhythmSlideWidth(makeSlide({subLaneWidth:width}))===width));
// 太いSLIDEが端のレーンを通ると、中心線のまわりへ幅を広げただけではレーンの外へ出る
// (実機で「スライドがレーンからはみ出て表示される場面がある」と報告があった 2026-09-05)。
// 幅は変えずに中心線を内側へ寄せて収める。見た目・入力の受け付け・追従の的が同じだけ動く。
check('幅2は寄せない(既存の正式候補v1が使う唯一の幅なので、譜面の見た目が変わらない)',
  [0,.5,1,2,3,3.5,4].every(lane=>close(rhythmSlideFittedLane(lane,2),lane)));
check('太いSLIDEは中心線を内側へ寄せてレーンへ収める',
  close(rhythmSlideFittedLane(0,5),.75)&&close(rhythmSlideFittedLane(4,5),3.25)
  &&close(rhythmSlideFittedLane(0,8),1.5)&&close(rhythmSlideFittedLane(0,10),2)&&close(rhythmSlideFittedLane(4,10),2));
check('寄せても幅は変わらない',[2,4,5,8,10].every(width=>{
  const note=makeSlide({subLaneWidth:width,slidePoints:[{timeMs:1000,lane:0},{timeMs:2200,lane:4}]});
  return close(rhythmProjectSlideSpan(0,note,1,1000).subLaneWidth,width);
}));
check('寄せたあとの帯が5レーンの外へ出ない',[1,2,3,4,5,6,7,8,9,10].every(width=>{
  const note=makeSlide({subLaneWidth:width,slidePoints:[{timeMs:1000,lane:0},{timeMs:2200,lane:4}]});
  return [0,.5,1,2,3,3.5,4].every(lane=>{
    const span=rhythmProjectSlideSpan(lane,note,1,1000);
    return span.left>=rhythmProjectBoundary(0,1)-1e-9&&span.right<=rhythmProjectBoundary(5,1)+1e-9;
  });
}));
check('追従の的も同じだけ寄る(見えている帯をなぞって外れた扱いにならない)',(()=>{
  // 幅8(=4レーンぶん)は端では収まらないので、中心線がレーン1.5へ寄る。
  // 追従の的(rhythmSlideExpectedLane)と帯(rhythmProjectSlideSpan)が同じ場所を指すことを見る。
  const note=makeSlide({subLaneWidth:8,slidePoints:[{timeMs:1000,lane:0},{timeMs:2200,lane:0}]});
  const expected=rhythmSlideExpectedLane(note,1600);
  const bandCenter=rhythmProjectSlideSpan(expected,note,1,1600).center;
  const laneCenter=rhythmProjectLane(expected,1).center;
  return close(expected,1.5)&&close(bandCenter,laneCenter);
})());
check('入力の受け付け幅も同じだけ寄る',(()=>{
  const note=makeSlide({subLaneWidth:8,lane:0,slidePoints:[{timeMs:1000,lane:0},{timeMs:2200,lane:0}]});
  const input=rhythmSlideInputSpan(note);
  return input&&close(input.start,0)&&close(input.end,8)&&close(input.center,4);
})());

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
check('WIDTH TEST HARDにSTEP2B-1位置確認譜面を維持する',hard.notes===widthSlideTestChart.notes&&hard.notes.some(note=>note.type==='SLIDE'));
const authoredSlides=hard?.notes?.filter(note=>note.type==='SLIDE')||[];
check('HARDの authored point は0.5刻みを維持する',authoredSlides.length>0&&authoredSlides.every(note=>[note.lane,note.endLane,...note.slidePoints.map(point=>point.lane)].every(lane=>close(Number(lane)*2,Math.round(Number(lane)*2)))));
check('HARDは旧幅2相当のまま残す',authoredSlides.every(note=>note.subLaneWidth==null));

const expert=RHYTHM_SONGS.find(song=>song.songId==='width_test')?.difficulties?.EXPERT;
const variableSlides=expert?.notes?.filter(note=>note.type==='SLIDE')||[];
check('WIDTH TEST EXPERTに可変幅SLIDE確認譜面がある',expert.notes===widthSlideVariableTestChart.notes&&variableSlides.length>=4);
check('EXPERTに幅1〜4をすべて収録する',[1,2,3,4].every(width=>variableSlides.some(note=>note.subLaneWidth===width)));
check('STEP2B-2では1ノーツ内の途中幅変化をまだ入れない',variableSlides.every(note=>note.slidePoints.every(point=>point.subLaneWidth==null&&point.width==null)));

const changing=makeSlide({subLaneWidth:3,slidePoints:[{timeMs:1000,lane:.5,subLaneWidth:1},{timeMs:1600,lane:1,subLaneWidth:4},{timeMs:2200,lane:1.5}]});
check('point幅を位置と同じ時間軸で連続補間する',close(rhythmSlideWidthAt(changing,1300),2.5)&&close(rhythmSlideWidthAt(changing,1900),3.5));
check('point→note→2の順で幅をfallbackする',rhythmSlideWidthAt(changing,2200)===3&&rhythmSlideWidthAt(makeSlide({slidePoints:[{timeMs:1000,lane:.5},{timeMs:2200,lane:1.5}]}),1600)===2&&rhythmSlideWidthAt(makeSlide({subLaneWidth:4,slidePoints:[{timeMs:1000,lane:.5,subLaneWidth:0},{timeMs:2200,lane:1.5,subLaneWidth:11}]}),1600)===4);
check('開始ノーツ幅は先頭pointの実効幅を使う',rhythmSlideInputSpan(changing).width===1);
check('END幅は最終pointの実効幅を使う',close(rhythmProjectSlideSpan(1.5,changing,.7,2200).subLaneWidth,3));
check('途中追従許容は現在時刻の補間幅に連動する',close(rhythmSlideTrackingTolerance(changing,1300),RHYTHM_SLIDE_TOLERANCE_LANES+.125));
check('途中の実効幅2でも追従許容±0.82を厳守する',close(rhythmSlideTrackingTolerance(changing,1200),RHYTHM_SLIDE_TOLERANCE_LANES));

// 譜面そのものが入っているかは**ノーツの配列**で見る。
// RHYTHM_SONGS は難易度レベル（Lv.）だけを差し替えた新しい入れ物を返すことがあるので、
// 入れ物の同一性（===）で見ると、レベルが変わっただけで落ちてしまう。
// ノーツの配列は差し替えないので、こちらで見れば「同じ譜面か」を確かめられる。
const master=RHYTHM_SONGS.find(song=>song.songId==='width_test')?.difficulties?.MASTER,masterSlides=master?.notes?.filter(note=>note.type==='SLIDE')||[];
check('WIDTH TEST MASTERへSTEP2B-3譜面を追加する',master.notes===widthSlideChangingTestChart.notes&&masterSlides.length>=4);
check('MASTERに幅1→4・4→1・1→3→2→4を収録する',masterSlides.some(note=>note.slidePoints.map(point=>point.subLaneWidth).join(',')==='1,4')&&masterSlides.some(note=>note.slidePoints.map(point=>point.subLaneWidth).join(',')==='4,1')&&masterSlides.some(note=>note.slidePoints.map(point=>point.subLaneWidth).join(',')==='1,3,2,4'));
check('MASTERに幅変化しながら曲がるSLIDEと途中TAPを収録する',masterSlides.some(note=>new Set(note.slidePoints.map(point=>point.lane)).size>=3&&new Set(note.slidePoints.map(point=>point.subLaneWidth)).size>=3)&&master.notes.some(note=>note.type==='TAP'&&masterSlides.some(slide=>note.timeMs>slide.timeMs&&note.timeMs<slide.endTimeMs)));
const masterSlideAt=timeMs=>masterSlides.find(note=>note.timeMs===timeMs);
const sCurve=masterSlideAt(11400),zigzag=masterSlideAt(16600),halfLane=masterSlideAt(21400),changingCurve=masterSlideAt(26200),longSlide=masterSlideAt(31400);
check('MASTERに大きなS字と細かいジグザグ経路を収録する',sCurve?.slidePoints.map(point=>point.lane).join(',')==='0.5,2,3.5,2,0.5'&&zigzag?.slidePoints.length>=9&&zigzag.slidePoints.slice(0,-1).every((point,index)=>point.lane===(index%2?3:1)));
check('MASTERに0.5レーン単位で左右へ移動する経路を収録する',halfLane?.slidePoints.length>=9&&halfLane.slidePoints.every(point=>point.lane===1.5||point.lane===2));
check('MASTERに曲がりながら幅1→4→1へ変化する経路を収録する',changingCurve?.slidePoints.map(point=>point.subLaneWidth).join(',')==='1,2,4,2,1'&&new Set(changingCurve.slidePoints.map(point=>point.lane)).size>=3);
check('MASTERに多数pointの長いSLIDEを収録する',longSlide?.endTimeMs-longSlide?.timeMs>=8000&&longSlide?.slidePoints.length>=16);
check('MASTERの複雑SLIDE中に別TAPと別HOLDを収録する',master.notes.some(note=>note.type==='TAP'&&note.timeMs>halfLane.timeMs&&note.timeMs<halfLane.endTimeMs)&&master.notes.some(note=>note.type==='HOLD'&&note.timeMs>longSlide.timeMs&&note.endTimeMs<longSlide.endTimeMs));
check('STEP2B-4の全経路・幅は既存authored範囲内',masterSlides.every(note=>note.slidePoints.every(point=>rhythmSlideAuthoredLane(point.lane)!==null&&(point.subLaneWidth==null||[1,2,3,4].includes(point.subLaneWidth)))));
const slideSteps=Number(source.match(/const RHYTHM_SLIDE_SEGMENT_STEPS=(\d+)/)?.[1])||1;
check('多数pointでも既存polygonを区間ごとに再利用する',rhythmSlideSegmentPolygons(longSlide,longSlide.timeMs,{visualTime:longSlide.timeMs,travelMs:10000,spawnY:0,travelPx:700},rect).length===(longSlide.slidePoints.length-1)*slideSteps);


console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
