#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const source=read('monster-hero/data/rhythm-mode.js'),game=read('monster-hero/src/game-system.jsx'),help=read('monster-hero/data/help.js');
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const helpers=source.match(/const RHYTHM_PROJECTION_TOP_SCALE=[\s\S]*?const rhythmLaneCoordinateAtPoint=/)?.[0].replace(/const rhythmLaneCoordinateAtPoint=$/,'');
check('終端時刻・レーンと共通projection helperを抽出できる',!!helpers);
if(helpers){
  const context={RHYTHM_LANE_COUNT:5};vm.runInNewContext(`${helpers}\nthis.out={rhythmProjectTravelProgress,rhythmProjectLane,rhythmReleaseTargetMs,rhythmReleaseLane};`,context);
  const h=context.out,note={timeMs:1000,endTimeMs:2201,_rhythmReleaseOriginalEndTimeMs:2000,lane:1,endLane:3,slidePoints:[{timeMs:1000,lane:1},{timeMs:2000,lane:4}]};
  check('runtime延期後も元endTimeMsを終端バーの正本にする',h.rhythmReleaseTargetMs(note)===2000);
  check('SLIDE終点はslidePoints最終位置を優先する',h.rhythmReleaseLane(note)===4);
  const y=(target,now)=>h.rhythmProjectTravelProgress(1-(target-now)/1000);
  check('元endTimeMsちょうどで終端バーが判定位置へ到達する',y(h.rhythmReleaseTargetMs(note),2000)===h.rhythmProjectTravelProgress(1));
  check('終端バーも奥・中央・判定位置で共通レーン投影を使える',[.05,.5,.88].every(r=>h.rhythmProjectLane(4,r).center===h.rhythmProjectLane(h.rhythmReleaseLane(note),r).center));
}
check('HOLD／SLIDEだけに入力を遮らない終端バーを描画',game.includes("(note.type==='HOLD'||note.type==='SLIDE')&&<span data-rhythm-end-bar")&&game.includes("pointerEvents:'none'"));
check('終端バーYは元終端時刻と共通travel projectionから毎フレーム算出',game.includes('releaseTargetMs=rhythmReleaseTargetMs(note)')&&game.includes('rhythmProjectTravelProgress(releaseProgress)*travel.travelPx'));
check('帯と終端バーを同じ終端Yへ接続',game.includes('bodyPx=Math.max(0,yPx-releaseYpx)')&&game.includes('rhythmLayoutNoteVisual(el,note,yPx,visualLane,playAreaRef.current,releaseYpx)'));
check('終端バーの横位置と幅は共通lane projectionを再利用',source.includes('end=rhythmProjectLane(rhythmReleaseLane(note),endY)')&&source.includes('rect.width*end.width*RHYTHM_NOTE_WIDTH_RATIO'));
check('ヘルプに終端バーで指を離す案内がある',help.includes('終端バーが判定ラインへ来たタイミングで指を離します'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
