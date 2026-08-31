#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const context={console};
vm.runInNewContext(`${source}\nthis.out={RHYTHM_SONGS,rhythmSlideAuthoredLane,rhythmSlideExpectedLane,rhythmReleaseLane,rhythmProjectLane,rhythmNoteVisualSpan,rhythmNoteHasVariableSpan,rhythmMatchInputBatch,RHYTHM_GESTURE_RUNTIME,widthSlideTestChart};`,context);
const {
  RHYTHM_SONGS,rhythmSlideAuthoredLane,rhythmSlideExpectedLane,rhythmReleaseLane,
  rhythmProjectLane,rhythmNoteVisualSpan,rhythmNoteHasVariableSpan,rhythmMatchInputBatch,
  RHYTHM_GESTURE_RUNTIME,widthSlideTestChart,
}=context.out;
const close=(a,b)=>Math.abs(Number(a)-Number(b))<1e-9;
const makeSlide=()=>({
  type:'SLIDE',timeMs:1000,endTimeMs:2200,lane:.5,endLane:1.5,done:false,activePointerId:null,
  slidePoints:[{timeMs:1000,lane:.5},{timeMs:1600,lane:1},{timeMs:2200,lane:1.5}],
});

check('SLIDE authored laneは0.5刻みを受け付ける',rhythmSlideAuthoredLane(.5)===.5&&rhythmSlideAuthoredLane(3.5)===3.5&&rhythmSlideAuthoredLane(4)===4);
check('0.25刻みや範囲外はSTEP2B-1では受け付けない',rhythmSlideAuthoredLane(.25)===null&&rhythmSlideAuthoredLane(4.5)===null);

const slide=makeSlide();
check('slidePointsの0.5刻みを時間補間できる',close(rhythmSlideExpectedLane(slide,1300),.75)&&close(rhythmSlideExpectedLane(slide,1900),1.25));
check('終端レーンも0.5刻みを維持する',close(rhythmReleaseLane(slide),1.5));

const visual=rhythmNoteVisualSpan({type:'SLIDE'},1.25,.72),expected=rhythmProjectLane(1.25,.72);
check('SLIDE頭は補間中の連続座標を丸めず描画する',close(visual.center,expected.center)&&close(visual.width,expected.width));
check('SLIDE幅は可変幅扱いにしない',!rhythmNoteHasVariableSpan(slide));

let result=rhythmMatchInputBatch([makeSlide()],[{inputKey:'half-start',lane:1,subLaneCoordinate:2}],1000,0);
check('メインレーン境界上の0.5位置からSLIDEを開始できる',!!result[0].target);
RHYTHM_GESTURE_RUNTIME.clear();
result=rhythmMatchInputBatch([makeSlide()],[{inputKey:'half-outside',lane:1,subLaneCoordinate:3.01}],1000,0);
check('SLIDE開始幅の外側は取得しない',!result[0].target);
RHYTHM_GESTURE_RUNTIME.clear();
const legacy={type:'SLIDE',timeMs:1000,endTimeMs:2000,lane:2,endLane:3,done:false,activePointerId:null,slidePoints:[{timeMs:1000,lane:2},{timeMs:2000,lane:3}]};
result=rhythmMatchInputBatch([legacy],[{inputKey:'legacy',lane:2,subLaneCoordinate:5}],1000,0);
check('旧整数レーンSLIDEの開始入力互換を維持する',!!result[0].target);
RHYTHM_GESTURE_RUNTIME.clear();

const hard=RHYTHM_SONGS.find(song=>song.songId==='width_test')?.difficulties?.HARD;
check('WIDTH TEST HARDにSLIDEサブレーン確認譜面がある',hard===widthSlideTestChart&&hard.notes.some(note=>note.type==='SLIDE'));
const authoredSlides=hard?.notes?.filter(note=>note.type==='SLIDE')||[];
check('デバッグSLIDEの authored point は0.5刻み',authoredSlides.length>0&&authoredSlides.every(note=>[note.lane,note.endLane,...note.slidePoints.map(point=>point.lane)].every(lane=>close(Number(lane)*2,Math.round(Number(lane)*2)))));
check('STEP2B-1ではSLIDE可変幅をまだ入れない',authoredSlides.every(note=>note.subLane==null&&note.subLaneWidth==null&&note.slidePoints.every(point=>point.subLane==null&&point.subLaneWidth==null)));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
