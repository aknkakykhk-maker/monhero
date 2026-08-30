#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
const DEFAULT_CANDIDATES=path.join(ROOT,'tools/mode/authoring/atsu-cup-theme-onset-candidates.json');
const DEFAULT_OUTPUT=path.join(ROOT,'tools/mode/authoring/atsu-cup-theme-easy-draft.json');
const TIMING_FILE=path.join(ROOT,'monster-hero/data/rhythm-timing.js');

const EASY_PROFILE=Object.freeze({
  targetNotes:100,
  minGridGap:4,
  sectionWindowGrids:32,
  sectionAnchorStrength:.65,
  minTimeMs:1800,
  endPaddingMs:1000,
});

const timingSource=fs.readFileSync(TIMING_FILE,'utf8');
const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${timingSource}\nthis.__timing=RHYTHM_TIMING_DATA.atsu_cup_theme;this.__at=rhythmTimingAt;`,timingContext);
const timing=timingContext.__timing;
const timingAt=timingContext.__at;

const phaseBonus=gridIndex=>gridIndex%4===0?.16:gridIndex%2===0?.08:0;
const candidateScore=row=>Number(row[1])+phaseBonus(Number(row[0]));
const gridTimeMs=gridIndex=>timingAt('atsu_cup_theme',Math.floor(gridIndex/4),gridIndex%4,4);
const farEnough=(selected,gridIndex,minGap)=>selected.every(row=>Math.abs(Number(row[0])-gridIndex)>=minGap);

const buildEasyDraft=(source,profile=EASY_PROFILE)=>{
  const rows=(Array.isArray(source?.candidates)?source.candidates:[])
    .filter(row=>Array.isArray(row)&&row.length>=3)
    .filter(row=>{
      const time=gridTimeMs(Number(row[0]));
      return Number.isFinite(time)&&time>=profile.minTimeMs&&time<=timing.audioDurationMs-profile.endPaddingMs;
    });
  const selected=[];
  const maxGrid=rows.reduce((max,row)=>Math.max(max,Number(row[0])),0);

  // 曲の各区間が完全な空白にならないよう、まず8拍ごとに最も目立つ候補を1点だけ確保する。
  for(let start=0;start<=maxGrid;start+=profile.sectionWindowGrids){
    const choices=rows
      .filter(row=>Number(row[0])>=start&&Number(row[0])<start+profile.sectionWindowGrids&&Number(row[1])>=profile.sectionAnchorStrength)
      .sort((a,b)=>candidateScore(b)-candidateScore(a)||Number(a[0])-Number(b[0]));
    const picked=choices.find(row=>farEnough(selected,Number(row[0]),profile.minGridGap));
    if(picked)selected.push(picked);
  }

  // 残りは強いオンセットと表拍/8分位置を優先し、EASYで過密にならない最小間隔を守って埋める。
  const chosen=new Set(selected.map(row=>Number(row[0])));
  const ranked=rows
    .filter(row=>!chosen.has(Number(row[0])))
    .sort((a,b)=>candidateScore(b)-candidateScore(a)||Number(a[0])-Number(b[0]));
  for(const row of ranked){
    if(selected.length>=profile.targetNotes)break;
    if(farEnough(selected,Number(row[0]),profile.minGridGap))selected.push(row);
  }
  selected.sort((a,b)=>Number(a[0])-Number(b[0]));
  return selected.slice(0,profile.targetNotes);
};

const source=JSON.parse(fs.readFileSync(DEFAULT_CANDIDATES,'utf8'));
const selected=buildEasyDraft(source);
const result={
  trackId:'atsu_cup_theme',
  difficulty:'EASY',
  bpm:timing.bpm,
  beatZeroMs:timing.beatZeroMs,
  subdivisionsPerBeat:4,
  sourceAlgorithm:source.algorithm,
  draftAlgorithm:'easy-onset-selection-v1',
  profile:EASY_PROFILE,
  reviewRequired:true,
  runtimeConnected:false,
  noteTypePlan:'TAP_ONLY',
  noteCount:selected.length,
  points:selected,
};

if(process.argv.includes('--write')){
  fs.mkdirSync(path.dirname(DEFAULT_OUTPUT),{recursive:true});
  fs.writeFileSync(DEFAULT_OUTPUT,`${JSON.stringify(result)}\n`);
  console.log(`wrote EASY draft ${selected.length} notes: ${path.relative(ROOT,DEFAULT_OUTPUT)}`);
}else process.stdout.write(`${JSON.stringify(result)}\n`);

module.exports={EASY_PROFILE,buildEasyDraft};
