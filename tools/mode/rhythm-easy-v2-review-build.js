#!/usr/bin/env node
const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'../..');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const v1=read('monster-hero/debug/atsu-cup-theme-easy-formal-candidate-v1.json');
const draft=read('tools/mode/authoring/atsu-cup-theme-easy-draft.json');
const onset=read('tools/mode/authoring/atsu-cup-theme-onset-candidates.json');
const outputPath=path.join(ROOT,'monster-hero/debug/atsu-cup-theme-easy-formal-candidate-v2-review.json');
const stepMs=(60000/v1.bpm)/v1.subdivisionsPerBeat;
const timeAt=grid=>v1.beatZeroMs+Number(grid)*stepMs;
const round=(value,digits=2)=>Number(Number(value).toFixed(digits));
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
const slope=(xs,ys)=>{const mx=mean(xs),my=mean(ys);let top=0,bottom=0;xs.forEach((x,index)=>{const dx=x-mx;top+=dx*(ys[index]-my);bottom+=dx*dx;});return bottom?top/bottom:0;};
const formatTime=ms=>{const seconds=Math.max(0,Number(ms))/1000,minutes=Math.floor(seconds/60);return `${minutes}:${(seconds-minutes*60).toFixed(3).padStart(6,'0')}`;};
const sourceMap=new Map(draft.points.map(row=>[Number(row[0]),row]));
const onsetMap=new Map(onset.candidates.map(row=>[Number(row[0]),row]));
const notes=v1.notes.map(note=>({...note}));
const offsets=notes.map(note=>Number(note.sourcePeakOffsetMs));
const absoluteOffsets=offsets.map(Math.abs);
const times=notes.map(note=>timeAt(note.grid));
const thresholds=[10,20,30,40];
const sections=[['first',0,1/3],['middle',1/3,2/3],['last',2/3,1]].map(([id,start,end])=>{
  const rows=notes.filter(note=>timeAt(note.grid)>=144640*start&&timeAt(note.grid)<144640*end),values=rows.map(note=>Number(note.sourcePeakOffsetMs));
  return {id,noteCount:rows.length,meanOffsetMs:round(mean(values),1),meanAbsoluteOffsetMs:round(mean(values.map(Math.abs)),1)};
});
const gridGaps=notes.slice(1).map((note,index)=>Number(note.grid)-Number(notes[index].grid));
const densityBy32Grid=[];
for(let start=0;start<=Math.max(...notes.map(note=>Number(note.grid)));start+=32){const count=notes.filter(note=>Number(note.grid)>=start&&Number(note.grid)<start+32).length;if(count)densityBy32Grid.push({startGrid:start,endGrid:start+31,noteCount:count});}
const longGaps=notes.slice(1).map((note,index)=>({fromGrid:Number(notes[index].grid),toGrid:Number(note.grid),gapGrids:Number(note.grid)-Number(notes[index].grid),gapMs:round(timeAt(note.grid)-timeAt(notes[index].grid),1)})).filter(row=>row.gapGrids>=64);
const densePairs=notes.slice(1).map((note,index)=>({fromGrid:Number(notes[index].grid),toGrid:Number(note.grid),gapGrids:Number(note.grid)-Number(notes[index].grid)})).filter(row=>row.gapGrids<4);
const holdClearances=notes.filter(note=>note.type==='HOLD').map(note=>{const index=notes.indexOf(note),next=notes[index+1],endGrid=Number(note.grid)+Number(note.durationGrids);return {grid:Number(note.grid),endGrid,nextGrid:next?Number(next.grid):null,clearanceGrids:next?Number(next.grid)-endGrid:null};});
const issues=[];
notes.forEach((note,index)=>{
  const grid=Number(note.grid),previous=notes[index-1],next=notes[index+1];
  if(previous&&grid<=Number(previous.grid))issues.push({code:'ORDER_OR_DUPLICATE',grid});
  if(!Number.isInteger(grid))issues.push({code:'OFF_GRID',grid});
  if(!Number.isInteger(note.lane)||note.lane<0||note.lane>4)issues.push({code:'INVALID_LANE',grid});
  if(note.subLane!==note.lane*2||note.subLaneWidth!==2)issues.push({code:'INVALID_EASY_SPAN',grid});
  if(!sourceMap.has(grid))issues.push({code:'SOURCE_MISSING',grid});
  if(note.type==='HOLD'){
    const endGrid=grid+Number(note.durationGrids);
    if(![4,8].includes(Number(note.durationGrids)))issues.push({code:'INVALID_HOLD_DURATION',grid});
    if(next&&endGrid>=Number(next.grid))issues.push({code:'HOLD_OVERLAP',grid});
    if(timeAt(endGrid)>144640)issues.push({code:'HOLD_AFTER_AUDIO',grid});
  }
});
const lanePattern=[2,1,3,0,4,2,0,3,1,4];
const selectedGrids=notes.map(note=>Number(note.grid));
const pendingReviews=v1.earReviewGrids.map(grid=>{
  const row=onsetMap.get(Number(grid));
  const before=[...selectedGrids].filter(value=>value<grid).pop()??null;
  const after=selectedGrids.find(value=>value>grid)??null;
  const nearby=[-2,-1,0,1,2].map(delta=>{const found=onsetMap.get(grid+delta);return {deltaGrid:delta,grid:grid+delta,strength:found?Number(found[1]):null,sourcePeakOffsetMs:found?Number(found[2]):null};});
  const alternatives=nearby.filter(item=>item.deltaGrid!==0&&item.strength!==null).sort((a,b)=>Math.abs(a.sourcePeakOffsetMs)-Math.abs(b.sourcePeakOffsetMs)||b.strength-a.strength);
  const bestAlternative=alternatives[0]||null;
  let machineRecommendation='AMBIGUOUS',reason='耳でフレーズ上の位置を確認する必要がある';
  if(bestAlternative&&Math.abs(bestAlternative.sourcePeakOffsetMs)+5<Math.abs(row[2])){machineRecommendation='SHIFT_CANDIDATE';reason=`近傍grid ${bestAlternative.grid}のoffset絶対値が5ms以上小さい`;}
  else if(Math.abs(row[2])<=35&&row[1]>=.9){machineRecommendation='KEEP_CANDIDATE';reason='offsetが35ms以内かつonset強度0.90以上';}
  else if(row[1]<.9&&!bestAlternative){machineRecommendation='DROP_CANDIDATE';reason='onset強度0.90未満で前後2gridに別候補がない';}
  const draftIndex=draft.points.findIndex(point=>Number(point[0])===grid),lane=lanePattern[Math.max(0,draftIndex)%lanePattern.length];
  return {
    grid,timeMs:round(timeAt(grid),3),timeLabel:formatTime(timeAt(grid)),sourcePeakOffsetMs:Number(row[2]),sourceStrength:Number(row[1]),
    previousAcceptedGrid:before,nextAcceptedGrid:after,
    previousGapGrids:before===null?null:grid-before,nextGapGrids:after===null?null:after-grid,
    beatIndex:Math.floor(grid/4),subdivisionIndex:grid%4,barApproximation:Math.floor(grid/16)+1,gridInBar:grid%16,
    nearbyOnsets:nearby,bestNearbyAlternative:bestAlternative,
    machineRecommendation,machineRecommendationReason:reason,
    proposedNote:{type:'TAP',grid,lane,subLane:lane*2,subLaneWidth:2,sourceStrength:Number(row[1]),sourcePeakOffsetMs:Number(row[2])},
    reviewDecision:null,targetGrid:null,
  };
});
const classificationCounts=Object.fromEntries(['KEEP_CANDIDATE','SHIFT_CANDIDATE','DROP_CANDIDATE','AMBIGUOUS'].map(id=>[id,pendingReviews.filter(row=>row.machineRecommendation===id).length]));
const result={
  trackId:v1.trackId,difficulty:v1.difficulty,candidateVersion:2,status:'FORMAL_CANDIDATE_REVIEW',reviewRequired:true,runtimeConnected:false,
  bpm:v1.bpm,beatZeroMs:v1.beatZeroMs,subdivisionsPerBeat:v1.subdivisionsPerBeat,audioDurationMs:144640,
  source:'formal-candidate-v1 + full-length-quality-audit + onset-candidates',baseCandidate:'atsu-cup-theme-easy-formal-candidate-v1.json',
  policy:{formalNotesRemainFromV1:true,pendingReviewsAreNotFormalNotes:true,machineRecommendationsAreAdvisory:true,userEarDecisionWins:true,allowedReviewDecisions:['KEEP','SHIFT_PREVIOUS_GRID','SHIFT_NEXT_GRID','DROP','PENDING'],recommendationRules:{SHIFT_CANDIDATE:'前後2grid内にoffset絶対値が5ms以上小さいonset候補',KEEP_CANDIDATE:'offset絶対値35ms以内かつstrength 0.90以上',DROP_CANDIDATE:'strength 0.90未満かつ前後2gridに別onset候補なし',AMBIGUOUS:'上記以外'}},
  noteCount:notes.length,typeCounts:{TAP:notes.filter(note=>note.type==='TAP').length,HOLD:notes.filter(note=>note.type==='HOLD').length},notes,
  qualityAudit:{
    offsetCount:offsets.length,meanOffsetMs:round(mean(offsets),1),meanAbsoluteOffsetMs:round(mean(absoluteOffsets),1),medianOffsetMs:round(median(offsets),1),medianAbsoluteOffsetMs:round(median(absoluteOffsets),1),maxAbsoluteOffsetMs:round(Math.max(...absoluteOffsets),1),
    withinMs:Object.fromEntries(thresholds.map(limit=>[String(limit),{count:absoluteOffsets.filter(value=>value<=limit).length,percentage:round(absoluteOffsets.filter(value=>value<=limit).length/absoluteOffsets.length*100,1)}])),
    driftMsPerMinute:round(slope(times,offsets)*60000,2),sections,densityWindowGrids:32,densityBy32Grid,maxDensityPer32Grid:Math.max(...densityBy32Grid.map(row=>row.noteCount)),minAdjacentGapGrids:Math.min(...gridGaps),minAdjacentGapMs:round(Math.min(...gridGaps)*stepMs,1),longGapThresholdGrids:64,longGaps,densePairThresholdGrids:4,densePairs,holdClearances,
  },
  mechanicalValidation:{passed:issues.length===0,issueCount:issues.length,issues},
  pendingReviewCount:pendingReviews.length,classificationCounts,pendingReviews,
};
fs.writeFileSync(outputPath,`${JSON.stringify(result,null,2)}\n`);
console.log(`書き出しました: ${path.relative(ROOT,outputPath)}`);
console.log(JSON.stringify({noteCount:result.noteCount,qualityAudit:result.qualityAudit,classificationCounts,mechanicalValidation:result.mechanicalValidation},null,2));
