const fs=require('fs');
const game=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const must=["const setPressedLanes=lanes=>","data-rhythm-lane={lane}","liveLanes=new Set()","setPressedLanes(liveLanes)","backgroundColor=pressed?'rgba(34,211,238,0.30)'","boxShadow=pressed?'inset 0 0 26px","setPressedLanes([]);run.notes.forEach","setPressedLanes([]);run.audio?.stop()"];
for(const token of must){if(!game.includes(token)){console.error('missing lane feedback token:',token);process.exit(1);}}
if(!game.includes("rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs)")){console.error('simultaneous batch input path regressed');process.exit(1);}
console.log('rhythm lane press feedback check: OK');
