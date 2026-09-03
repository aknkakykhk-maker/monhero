#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const ROOT=path.resolve(__dirname,'..','..');
const TRACKS=Object.freeze({
  atsu_cup_theme:Object.freeze({
    input:'tools/mode/authoring/atsu-cup-theme-v2-features.json',
    output:'tools/mode/authoring/atsu-cup-theme-v2-structure.json',
  }),
  monster_hero_theme:Object.freeze({
    input:'tools/mode/authoring/monster-hero-theme-v2-features.json',
    output:'tools/mode/authoring/monster-hero-theme-v2-structure.json',
  }),
});
const LABELS=['INTRO','VERSE','BUILD','CHORUS','BREAK','BRIDGE','FINAL_CHORUS','OUTRO'];
const arg=(name,fallback=null)=>{
  const index=process.argv.indexOf(name);
  return index>=0&&index+1<process.argv.length?process.argv[index+1]:fallback;
};
const trackId=arg('--track','atsu_cup_theme');
const config=TRACKS[trackId];
if(!config){console.error(`STEP2未登録トラックです: ${trackId} (${Object.keys(TRACKS).join(', ')})`);process.exit(1);}
const inputPath=path.resolve(arg('--input',path.join(ROOT,config.input)));
const outputPath=path.resolve(arg('--output',path.join(ROOT,config.output)));
const write=process.argv.includes('--write');
const summaryOnly=process.argv.includes('--summary');

const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const round=(value,digits=6)=>Number((Number.isFinite(value)?value:0).toFixed(digits));
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const quantile=(values,ratio)=>{
  if(!values.length)return 0;
  const sorted=Array.from(values).sort((a,b)=>a-b);
  const position=(sorted.length-1)*clamp(ratio),lower=Math.floor(position),upper=Math.ceil(position);
  return lower===upper?sorted[lower]:sorted[lower]+(sorted[upper]-sorted[lower])*(position-lower);
};
const normalize=(value,low,high)=>high>low?clamp((value-low)/(high-low)):0;
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const vectorDistance=(a,b)=>mean(a.map((value,index)=>Math.abs(value-(b[index]??0))));
const vectorSimilarity=(a,b)=>clamp(1-vectorDistance(a,b));
const featureMean=(timeline,key)=>mean(timeline.map(key));

const source=JSON.parse(fs.readFileSync(inputPath,'utf8'));
if(source.analysisType!=='rhythm-chart-v2-step1-features')throw new Error('STEP1 V2 JSONではありません');
if(source.trackId!==trackId)throw new Error(`trackId不一致: ${source.trackId} != ${trackId}`);

const windowsIn=(startMs,endMs)=>source.timeline.filter(item=>item.centerMs>=startMs&&item.centerMs<endMs);
const accentsIn=(startMs,endMs)=>source.events.accents.filter(item=>item.timeMs>=startMs&&item.timeMs<endMs);
const onsetP95=quantile(source.timeline.map(item=>item.onset.densityPerSecond),.95)||1;
const downbeats=source.timing.downbeat.timesMs;
if(!Array.isArray(downbeats)||downbeats.length<8)throw new Error('downbeat候補が不足しています');

// STEP1のdownbeat候補を小節境界に使う。先頭のpickupと末尾も失わず全尺を覆う。
const bars=[];
for(let index=0;index<downbeats.length;index++){
  const startMs=index===0?0:downbeats[index];
  const endMs=index+1<downbeats.length?downbeats[index+1]:source.durationMs;
  if(endMs<=startMs)continue;
  const timeline=windowsIn(startMs,endMs);
  if(!timeline.length)continue;
  const first=timeline[0],last=timeline[timeline.length-1];
  bars.push({
    index:bars.length,startMs,endMs,
    intensity:featureMean(timeline,item=>item.intensity),
    energy:featureMean(timeline,item=>item.energy.normalized),
    low:featureMean(timeline,item=>item.frequencyBands.low.normalized),
    mid:featureMean(timeline,item=>item.frequencyBands.mid.normalized),
    high:featureMean(timeline,item=>item.frequencyBands.high.normalized),
    onset:clamp(featureMean(timeline,item=>item.onset.densityPerSecond)/onsetP95),
    brightness:featureMean(timeline,item=>item.spectral.brightness),
    spectralChange:featureMean(timeline,item=>item.spectral.change),
    accent:featureMean(timeline,item=>item.accent),
    slope:clamp((last.intensity-first.intensity+1)/2),
  });
}

const barVector=bar=>[bar.intensity,bar.energy,bar.low,bar.mid,bar.high,bar.onset,bar.brightness,bar.spectralChange,bar.accent,bar.slope];
const boundaryRaw=[];
for(let index=1;index<bars.length;index++){
  const novelty=vectorDistance(barVector(bars[index-1]),barVector(bars[index]));
  const intensityJump=Math.abs(bars[index].intensity-bars[index-1].intensity);
  boundaryRaw.push({index,novelty,intensityJump});
}
const noveltyP20=quantile(boundaryRaw.map(item=>item.novelty),.20);
const noveltyP90=quantile(boundaryRaw.map(item=>item.novelty),.90);
const jumpP20=quantile(boundaryRaw.map(item=>item.intensityJump),.20);
const jumpP90=quantile(boundaryRaw.map(item=>item.intensityJump),.90);
for(const boundary of boundaryRaw){
  const cyclePrior=(boundary.index%8===0?.25:boundary.index%4===0?.18:boundary.index%2===0?.08:0);
  boundary.score=clamp(normalize(boundary.novelty,noveltyP20,noveltyP90)*.55+normalize(boundary.intensityJump,jumpP20,jumpP90)*.25+cyclePrior);
}
const boundaryGate=quantile(boundaryRaw.map(item=>item.score),.68);

// フレーズは2小節単位の候補だけを使い、特徴変化が強い地点か最大8小節で区切る。
const phraseRanges=[];
let phraseStart=0;
for(let index=2;index<bars.length;index++){
  if(index%2!==0)continue;
  const length=index-phraseStart;
  const boundary=boundaryRaw.find(item=>item.index===index);
  const shouldSplit=(length>=4&&(boundary?.score||0)>=boundaryGate)||length>=8;
  if(!shouldSplit)continue;
  phraseRanges.push([phraseStart,index,boundary?.score||0]);
  phraseStart=index;
}
if(phraseStart<bars.length)phraseRanges.push([phraseStart,bars.length,1]);

const resample=(items,key,slots=4)=>Array.from({length:slots},(_,slot)=>{
  const start=Math.floor(slot*items.length/slots);
  const end=Math.max(start+1,Math.floor((slot+1)*items.length/slots));
  return mean(items.slice(start,end).map(key));
});
const phrases=phraseRanges.map(([startBar,endBar,boundaryScore],index)=>{
  const phraseBars=bars.slice(startBar,endBar);
  const startMs=phraseBars[0].startMs,endMs=phraseBars.at(-1).endMs;
  const timeline=windowsIn(startMs,endMs);
  const fingerprint=[
    ...resample(phraseBars,item=>item.intensity),
    ...resample(phraseBars,item=>item.onset),
    ...resample(phraseBars,item=>item.low),
    ...resample(phraseBars,item=>item.high),
    featureMean(timeline,item=>item.spectral.brightness),
    featureMean(timeline,item=>item.spectral.change),
    featureMean(timeline,item=>item.accent),
  ].map(value=>round(value));
  return {
    id:`P${String(index+1).padStart(2,'0')}`,
    startMs,endMs,startBar,endBarExclusive:endBar,barCount:endBar-startBar,
    boundaryConfidence:round(index===0?1:boundaryScore),
    intensity:round(featureMean(timeline,item=>item.intensity)),
    confidence:0,
    fingerprint,
    repeatGroupId:null,repeatedFromPhraseId:null,similarityToSource:0,
  };
});

// 類似判定は同じ長さを要求せず、時間方向を4点へ再サンプルしたfingerprintで比較する。
const parent=phrases.map((_,index)=>index);
const root=index=>parent[index]===index?index:(parent[index]=root(parent[index]));
const unite=(a,b)=>{a=root(a);b=root(b);if(a!==b)parent[b]=a;};
const similarities=[];
for(let current=1;current<phrases.length;current++){
  let best=null;
  for(let previous=0;previous<current;previous++){
    const similarity=vectorSimilarity(phrases[current].fingerprint,phrases[previous].fingerprint);
    similarities.push({previous,current,similarity});
    const adjacent=current-previous===1;
    if(similarity>=(adjacent?.92:.88)){
      unite(previous,current);
      if(!best||similarity>best.similarity)best={previous,similarity};
    }
  }
  if(best){
    phrases[current].repeatedFromPhraseId=phrases[best.previous].id;
    phrases[current].similarityToSource=round(best.similarity);
  }
}
const groups=new Map();
phrases.forEach((_,index)=>{const key=root(index);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(index);});
let groupNumber=0;
for(const indexes of groups.values()){
  if(indexes.length<2)continue;
  groupNumber++;
  for(const index of indexes)phrases[index].repeatGroupId=`PG${String(groupNumber).padStart(2,'0')}`;
}
for(const phrase of phrases){
  const repeatEvidence=phrase.repeatGroupId?.length?1:.35;
  const barEvidence=phrase.barCount%2===0?1:.7;
  phrase.confidence=round(clamp(source.confidence.features*.45+source.confidence.downbeat*.20+phrase.boundaryConfidence*.15+repeatEvidence*.10+barEvidence*.10));
}

// 2〜4フレーズを1セクションとし、フレーズ間noveltyとintensity差で可変分割する。
const phraseNovelty=[];
for(let index=1;index<phrases.length;index++)phraseNovelty[index]=vectorDistance(phrases[index-1].fingerprint,phrases[index].fingerprint);
const sectionGate=quantile(phraseNovelty.filter(Number.isFinite),.68);
const sectionRanges=[];
let sectionStart=0;
for(let index=1;index<phrases.length;index++){
  const length=index-sectionStart;
  const intensityJump=Math.abs(phrases[index].intensity-phrases[index-1].intensity);
  if((length>=2&&phraseNovelty[index]>=sectionGate&&intensityJump>=.06)||length>=3){
    sectionRanges.push([sectionStart,index,phraseNovelty[index]]);
    sectionStart=index;
  }
}
if(sectionStart<phrases.length)sectionRanges.push([sectionStart,phrases.length,1]);

const sectionBase=sectionRanges.map(([startPhrase,endPhrase,boundaryNovelty],index)=>{
  const members=phrases.slice(startPhrase,endPhrase);
  const startMs=members[0].startMs,endMs=members.at(-1).endMs;
  const timeline=windowsIn(startMs,endMs);
  const firstQuarter=timeline.slice(0,Math.max(1,Math.floor(timeline.length/4)));
  const lastQuarter=timeline.slice(-Math.max(1,Math.floor(timeline.length/4)));
  const intensity=featureMean(timeline,item=>item.intensity);
  const onset=clamp(featureMean(timeline,item=>item.onset.densityPerSecond)/onsetP95);
  const accent=featureMean(timeline,item=>item.accent);
  const high=featureMean(timeline,item=>item.frequencyBands.high.normalized);
  const slope=featureMean(lastQuarter,item=>item.intensity)-featureMean(firstQuarter,item=>item.intensity);
  const repeated=members.some(item=>item.repeatGroupId);
  const fingerprint=[intensity,onset,accent,high,featureMean(timeline,item=>item.energy.normalized),featureMean(timeline,item=>item.spectral.change),clamp((slope+1)/2)].map(value=>round(value));
  return {index,startPhrase,endPhrase,startMs,endMs,timeline,intensity,onset,accent,high,slope,repeated,fingerprint,boundaryNovelty};
});
const intensityQ25=quantile(sectionBase.map(item=>item.intensity),.25);
const intensityQ70=quantile(sectionBase.map(item=>item.intensity),.70);

const sections=[];
for(let index=0;index<sectionBase.length;index++){
  const item=sectionBase[index];
  let repeatedFromSectionId=null,sectionSimilarity=0;
  for(let previous=0;previous<index;previous++){
    const similarity=vectorSimilarity(item.fingerprint,sectionBase[previous].fingerprint);
    if(similarity>=.90&&similarity>sectionSimilarity){sectionSimilarity=similarity;repeatedFromSectionId=`S${String(previous+1).padStart(2,'0')}`;}
  }
  const position=item.startMs/source.durationMs;
  const nextIntensity=sectionBase[index+1]?.intensity??item.intensity;
  const baseChorus=clamp(normalize(item.intensity,intensityQ25,intensityQ70)*.40+item.onset*.20+item.accent*.15+item.high*.10+(item.repeated?.15:0));
  let earlierChorusSimilarity=0;
  for(let previous=0;previous<index;previous++){
    const previousBase=sectionBase[previous];
    const previousChorus=clamp(normalize(previousBase.intensity,intensityQ25,intensityQ70)*.40+previousBase.onset*.20+previousBase.accent*.15+previousBase.high*.10+(previousBase.repeated?.15:0));
    if(previousChorus>=.55)earlierChorusSimilarity=Math.max(earlierChorusSimilarity,vectorSimilarity(item.fingerprint,previousBase.fingerprint));
  }
  const middle=clamp(1-Math.abs(position-.5)*2);
  const scores={
    INTRO:index===0?clamp(.88+(1-item.intensity)*.12):clamp(.08*(1-position)),
    VERSE:clamp((1-Math.abs(item.intensity-.45)*1.8)*.45+(item.repeated?.25:.08)+item.onset*.12+middle*.10),
    BUILD:clamp(Math.max(0,item.slope)*1.8*.45+Math.max(0,nextIntensity-item.intensity)*1.8*.30+item.onset*.10+middle*.15),
    CHORUS:baseChorus,
    BREAK:clamp((1-normalize(item.intensity,intensityQ25,intensityQ70))*.50+(1-item.onset)*.25+(1-item.accent)*.15+middle*.10),
    BRIDGE:clamp(middle*.30+(item.repeated?0:.25)+normalize(item.boundaryNovelty,0,sectionGate||1)*.25+(1-Math.abs(item.intensity-.5)*2)*.20),
    FINAL_CHORUS:clamp(baseChorus*.50+clamp((position-.55)/.35)*.25+earlierChorusSimilarity*.25),
    OUTRO:index===sectionBase.length-1?clamp(.88+(1-item.intensity)*.12):clamp(.08*position),
  };
  const candidates=LABELS.map(type=>({type,score:round(scores[type])})).sort((a,b)=>b.score-a.score||LABELS.indexOf(a.type)-LABELS.indexOf(b.type));
  const labelMargin=clamp(candidates[0].score-(candidates[1]?.score||0));
  const confidence=clamp(source.confidence.features*.35+source.confidence.downbeat*.15+mean(phrases.slice(item.startPhrase,item.endPhrase).map(phrase=>phrase.confidence))*.25+normalize(item.boundaryNovelty,0,sectionGate||1)*.10+labelMargin*.15);
  sections.push({
    id:`S${String(index+1).padStart(2,'0')}`,
    startMs:item.startMs,endMs:item.endMs,
    startPhraseId:phrases[item.startPhrase].id,endPhraseId:phrases[item.endPhrase-1].id,
    intensity:round(item.intensity),confidence:round(confidence),
    sectionTypeCandidate:candidates[0].type,
    sectionTypeCandidates:candidates.slice(0,4),
    repeatedFromSectionId,
    similarityToSource:round(sectionSimilarity),
    phraseIds:phrases.slice(item.startPhrase,item.endPhrase).map(phrase=>phrase.id),
    majorAccents:accentsIn(item.startMs,item.endMs).sort((a,b)=>b.accent-a.accent||a.timeMs-b.timeMs).slice(0,8).sort((a,b)=>a.timeMs-b.timeMs).map(accent=>({timeMs:accent.timeMs,strength:accent.strength,accent:accent.accent,confidence:accent.confidence})),
    features:{onsetDensity:round(item.onset),accent:round(item.accent),high:round(item.high),intensitySlope:round(item.slope)},
  });
}

const repeatedPhraseGroups=[];
for(const indexes of groups.values()){
  if(indexes.length<2)continue;
  const phraseIds=indexes.map(index=>phrases[index].id);
  const pairScores=[];
  for(let a=0;a<indexes.length;a++)for(let b=a+1;b<indexes.length;b++)pairScores.push(vectorSimilarity(phrases[indexes[a]].fingerprint,phrases[indexes[b]].fingerprint));
  repeatedPhraseGroups.push({id:phrases[indexes[0]].repeatGroupId,phraseIds,similarity:round(mean(pairScores)),confidence:round(clamp(mean(pairScores)*.65+source.confidence.features*.35))});
}

const boundaryConfidence=mean(phrases.map(item=>item.boundaryConfidence));
const phraseConfidence=mean(phrases.map(item=>item.confidence));
const sectionConfidence=mean(sections.map(item=>item.confidence));
const overallConfidence=clamp(phraseConfidence*.40+sectionConfidence*.40+source.confidence.downbeat*.20);
const result={
  schemaVersion:2,
  analysisType:'rhythm-chart-v2-step2-structure',
  algorithm:'bar-novelty-phrase-similarity-v2.1',
  trackId,
  sourceStep1:{path:path.relative(ROOT,inputPath).replace(/\\/g,'/'),sha256:sha256(inputPath),audioSha256:source.audioSha256},
  durationMs:source.durationMs,
  timing:{bpm:source.timing.bpm,beatZeroMs:source.timing.beatZeroMs,beatsPerBar:source.timing.downbeat.beatsPerBar,downbeatPhaseFromBeatZero:source.timing.downbeat.phaseFromBeatZero,downbeatConfidence:source.timing.downbeat.confidence},
  confidence:{overall:round(overallConfidence),boundaries:round(boundaryConfidence),phrases:round(phraseConfidence),sections:round(sectionConfidence),sourceFeatures:source.confidence.features,sourceDownbeat:source.confidence.downbeat},
  summary:{barCount:bars.length,phraseCount:phrases.length,repeatedPhraseGroupCount:repeatedPhraseGroups.length,sectionCount:sections.length,labelCounts:Object.fromEntries(LABELS.map(label=>[label,sections.filter(section=>section.sectionTypeCandidate===label).length]))},
  phraseBoundaryCandidates:boundaryRaw.filter(item=>item.index%2===0).map(item=>({timeMs:bars[item.index]?.startMs??source.durationMs,barIndex:item.index,score:round(item.score),novelty:round(item.novelty),intensityJump:round(item.intensityJump)})),
  phrases,
  repeatedPhraseGroups,
  sections,
  scope:{sections:true,phrases:true,chartGeneration:false,expertMaster:false,autoCritique:false,autoFix:false},
};

const printSummary=analysis=>{
  console.log(`${analysis.trackId} / bars=${analysis.summary.barCount} phrases=${analysis.summary.phraseCount} repeatGroups=${analysis.summary.repeatedPhraseGroupCount} sections=${analysis.summary.sectionCount}`);
  console.log(`confidence overall=${analysis.confidence.overall.toFixed(3)} phrases=${analysis.confidence.phrases.toFixed(3)} sections=${analysis.confidence.sections.toFixed(3)} downbeat=${analysis.confidence.sourceDownbeat.toFixed(3)}`);
  for(const section of analysis.sections){
    const repeat=section.repeatedFromSectionId?` repeat=${section.repeatedFromSectionId}(${section.similarityToSource.toFixed(2)})`:'';
    console.log(`${section.id} ${(section.startMs/1000).toFixed(1)}-${(section.endMs/1000).toFixed(1)}s ${section.sectionTypeCandidate} score=${section.sectionTypeCandidates[0].score.toFixed(2)} intensity=${section.intensity.toFixed(2)} conf=${section.confidence.toFixed(2)}${repeat}`);
  }
};

if(write){
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});
  fs.writeFileSync(outputPath,`${JSON.stringify(result)}\n`);
  console.log(`wrote ${result.sections.length} sections / ${result.phrases.length} phrases: ${path.relative(ROOT,outputPath)}`);
}
if(summaryOnly||write)printSummary(result);
else console.log(JSON.stringify(result,null,2));
