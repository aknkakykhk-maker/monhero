const fs=require('fs');
const game=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const must=["const setPressedLanes=coordinates=>","Array.from({length:10},(_,subLane)","data-rhythm-sublane-feedback={subLane}","rhythmSubLanePolygon(subLane)","liveSubLanes=[]","setPressedLanes(liveSubLanes)","activePointerFeedback.set(e.pointerId,subLaneCoordinate)","setPressedLanes([]);run.notes.forEach","onPointerMove={pointerMove}","inputMoves(inputKey,subLaneCoordinate)","if(subLane===state.subLane)return","if(state.empty)inputStarts([{lane:Math.floor(subLane/2),subLaneCoordinate,inputKey}])","RHYTHM_JUDGMENT_DISPLAY_MS=450","revision!==judgmentRevisionRef.current","last:'',fastSlow:''","inset 0 -52px 42px","'brightness(1.08)':'brightness(1.22)'","run.audio?.stop();}runRef.current=null;setPressedLanes([])"];
for(const token of must){if(!game.includes(token)){console.error('missing lane feedback token:',token);process.exit(1);}}
if(!game.includes("rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs)")){console.error('simultaneous batch input path regressed');process.exit(1);}
if(!game.includes("rhythmSubLaneCoordinateAtPoint(touch.clientX,touch.clientY,rect)")){console.error('continuous projection touch path regressed');process.exit(1);}
console.log('rhythm lane press feedback check: OK');
