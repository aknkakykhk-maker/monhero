#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const vm=require('vm');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const DEFAULT_AUDIO=path.join(ROOT,'monster-hero/audio/bgm-atsu-cup-theme.mp3');
const SAMPLE_RATE=8000;
const ENVELOPE_HZ=200;
const BPM_MIN=70;
const BPM_MAX=200;
const FEATURE_WINDOW_MS=500;
const FEATURE_HOP_MS=250;

const V2_TRACKS=Object.freeze({
  atsu_cup_theme:Object.freeze({
    audio:'monster-hero/audio/bgm-atsu-cup-theme.mp3',
    output:'tools/mode/authoring/atsu-cup-theme-v2-features.json',
  }),
  monster_hero_theme:Object.freeze({
    audio:'monster-hero/audio/bgm-monster-hero-theme.mp3',
    output:'tools/mode/authoring/monster-hero-theme-v2-features.json',
  }),
});

const arg=(name,fallback=null)=>{
  const index=process.argv.indexOf(name);
  return index>=0&&index+1<process.argv.length?process.argv[index+1]:fallback;
};
const requireFfmpeg=process.argv.includes('--require-ffmpeg');
const jsonOnly=process.argv.includes('--json');
const analyzeV2=process.argv.includes('--v2');
const write=process.argv.includes('--write');
const summaryOnly=process.argv.includes('--summary');
const trackId=arg('--track','atsu_cup_theme');
const trackConfig=V2_TRACKS[trackId]||null;
if(analyzeV2&&!trackConfig){
  console.error(`V2未登録トラックです: ${trackId} (${Object.keys(V2_TRACKS).join(', ')})`);
  process.exit(1);
}
const audioPath=path.resolve(arg('--audio',analyzeV2?path.join(ROOT,trackConfig.audio):DEFAULT_AUDIO));

const ffmpegVersion=spawnSync('ffmpeg',['-version'],{encoding:'utf8'});
if(ffmpegVersion.error||ffmpegVersion.status!==0){
  const message='ffmpeg が見つからないため実音源解析を実行できません';
  if(requireFfmpeg){console.error(message);process.exit(1);}
  console.log(`SKIP: ${message}`);process.exit(0);
}
if(!fs.existsSync(audioPath)){console.error(`音源が見つかりません: ${audioPath}`);process.exit(1);}

const decoded=spawnSync('ffmpeg',[
  '-hide_banner','-loglevel','error','-i',audioPath,
  '-vn','-ac','1','-ar',String(SAMPLE_RATE),
  '-af','highpass=f=80,lowpass=f=3600',
  '-f','f32le','pipe:1'
],{encoding:null,maxBuffer:128*1024*1024});
if(decoded.status!==0){
  console.error(decoded.stderr?.toString('utf8')||'ffmpeg decode failed');
  process.exit(1);
}
const pcm=decoded.stdout;
if(!pcm||pcm.length<4*SAMPLE_RATE){console.error('デコード結果が短すぎます');process.exit(1);}
const sampleCount=Math.floor(pcm.length/4);
const samples=new Float32Array(sampleCount);
for(let i=0;i<sampleCount;i++)samples[i]=pcm.readFloatLE(i*4);

const hop=Math.max(1,Math.round(SAMPLE_RATE/ENVELOPE_HZ));
const frameCount=Math.floor(sampleCount/hop);
const energy=new Float64Array(frameCount);
for(let frame=0;frame<frameCount;frame++){
  const start=frame*hop,end=Math.min(sampleCount,start+hop);
  let sum=0,absDiff=0,prev=samples[start]||0,count=0;
  for(let i=start;i<end;i++){
    const s=samples[i]||0;
    sum+=s*s;
    absDiff+=Math.abs(s-prev);
    prev=s;
    count++;
  }
  energy[frame]=count?Math.sqrt(sum/count)+absDiff/count*.35:0;
}
const onset=new Float64Array(frameCount);
let baseline=energy[0]||0,maxOnset=0;
for(let i=1;i<frameCount;i++){
  baseline=baseline*.90+energy[i-1]*.10;
  const rise=Math.max(0,energy[i]-baseline*1.04);
  onset[i]=rise;
  if(rise>maxOnset)maxOnset=rise;
}
if(maxOnset<=0){console.error('オンセットを抽出できません');process.exit(1);}
for(let i=0;i<frameCount;i++)onset[i]/=maxOnset;

const sortedOnset=Array.from(onset).sort((a,b)=>a-b);
const gate=sortedOnset[Math.floor(sortedOnset.length*.78)]||0;
const gated=new Float64Array(frameCount);
for(let i=0;i<frameCount;i++)gated[i]=onset[i]>=gate?onset[i]:0;

const corrAtLag=lag=>{
  let dot=0,power=0;
  for(let i=lag;i<frameCount;i++){
    const a=gated[i],b=gated[i-lag];
    dot+=a*b;
    power+=Math.max(a,b);
  }
  return power>0?dot/power:0;
};
const minLag=Math.max(2,Math.floor(ENVELOPE_HZ*60/BPM_MAX));
const maxLag=Math.min(frameCount-2,Math.ceil(ENVELOPE_HZ*60/BPM_MIN));
const raw=[];
for(let lag=minLag;lag<=maxLag;lag++)raw.push({lag,bpm:60*ENVELOPE_HZ/lag,raw:corrAtLag(lag)});
const byLag=new Map(raw.map(item=>[item.lag,item.raw]));
const lagScore=lag=>{
  const base=byLag.get(lag)||0;
  const double=byLag.get(lag*2)||0;
  const half=byLag.get(Math.round(lag/2))||0;
  return base+double*.30+half*.10;
};
for(const item of raw)item.score=lagScore(item.lag);
const localPeaks=raw.filter((item,index,arr)=>{
  const prev=arr[index-1]?.score??-Infinity,next=arr[index+1]?.score??-Infinity;
  return item.score>=prev&&item.score>=next;
}).sort((a,b)=>b.score-a.score);
const medianScore=raw.map(x=>x.score).sort((a,b)=>a-b)[Math.floor(raw.length/2)]||0;
const tempoPrior=bpm=>1-Math.min(.08,Math.abs(bpm-132)/1000);
const ranked=localPeaks.map(item=>({...item,rankScore:item.score*tempoPrior(item.bpm)})).sort((a,b)=>b.rankScore-a.rankScore);
const best=ranked[0]||raw.sort((a,b)=>b.score-a.score)[0];
if(!best){console.error('BPM候補を作成できません');process.exit(1);}

const phaseScore=(lag,phase)=>{
  let score=0,hits=0;
  for(let i=phase;i<frameCount;i+=lag){
    score+=gated[i]||0;
    if(i>0)score+=(gated[i-1]||0)*.45;
    if(i+1<frameCount)score+=(gated[i+1]||0)*.45;
    hits++;
  }
  return hits?score/hits:0;
};
let bestPhase=0,bestPhaseScore=-Infinity;
for(let phase=0;phase<best.lag;phase++){
  const score=phaseScore(best.lag,phase);
  if(score>bestPhaseScore){bestPhaseScore=score;bestPhase=phase;}
}

const bpm=best.bpm;
const beatMs=60000/bpm;
const offsetMs=bestPhase/ENVELOPE_HZ*1000;
const durationMs=Math.round(sampleCount/SAMPLE_RATE*1000);
const beatTimes=[];
for(let t=offsetMs;t<=durationMs&&beatTimes.length<64;t+=beatMs)beatTimes.push(Math.round(t));
const confidence=Math.max(0,Math.min(1,medianScore>0?(best.score/medianScore-1)/4:best.score>0?1:0));
const candidates=ranked.slice(0,8).map(item=>({
  bpm:Number(item.bpm.toFixed(3)),
  beatMs:Number((60000/item.bpm).toFixed(3)),
  score:Number(item.score.toFixed(6)),
}));
const result={
  audio:path.relative(ROOT,audioPath).replace(/\\/g,'/'),
  durationMs,
  estimatedBpm:Number(bpm.toFixed(3)),
  beatMs:Number(beatMs.toFixed(3)),
  beatOffsetMs:Number(offsetMs.toFixed(1)),
  confidence:Number(confidence.toFixed(3)),
  firstBeatsMs:beatTimes.slice(0,32),
  candidates,
};

const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const round=(value,digits=6)=>Number((Number.isFinite(value)?value:0).toFixed(digits));
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const quantile=(values,ratio)=>{
  if(!values.length)return 0;
  const sorted=Array.from(values).sort((a,b)=>a-b);
  const position=(sorted.length-1)*clamp(ratio);
  const lower=Math.floor(position),upper=Math.ceil(position);
  if(lower===upper)return sorted[lower];
  return sorted[lower]+(sorted[upper]-sorted[lower])*(position-lower);
};
const normalized=(value,low,high)=>high>low?clamp((value-low)/(high-low)):0;
const sha256=filePath=>crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const readTiming=targetTrackId=>{
  const timingFile=path.join(ROOT,'monster-hero/data/rhythm-timing.js');
  const source=fs.readFileSync(timingFile,'utf8');
  const context={Object,Number,Math};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__timing=RHYTHM_TIMING_DATA[${JSON.stringify(targetTrackId)}];`,context);
  return context.__timing||null;
};

const featureAnalysisV2=()=>{
  const timing=readTiming(trackId);
  if(!timing)throw new Error(`${trackId} timing data is missing`);

  // 1回のmono decodeを、決定的な1-pole crossoverへ通す。8kHzは既存解析と同じで、
  // STEP1が必要とする低域(<250Hz) / 中域(250-2000Hz) / 高域(>2000Hz)の相対変化を
  // 新規DSP依存なしで取れる。楽器名の断定には使わない。
  const rawRms=new Float64Array(frameCount);
  const lowRms=new Float64Array(frameCount);
  const midRms=new Float64Array(frameCount);
  const highRms=new Float64Array(frameCount);
  const lowAlpha=Math.exp(-2*Math.PI*250/SAMPLE_RATE);
  const midAlpha=Math.exp(-2*Math.PI*2000/SAMPLE_RATE);
  let lowState=0,belowHighState=0;
  for(let frame=0;frame<frameCount;frame++){
    const start=frame*hop,end=Math.min(sampleCount,start+hop);
    let rawPower=0,lowPower=0,midPower=0,highPower=0,count=0;
    for(let i=start;i<end;i++){
      const sample=samples[i]||0;
      lowState=lowAlpha*lowState+(1-lowAlpha)*sample;
      belowHighState=midAlpha*belowHighState+(1-midAlpha)*sample;
      const low=lowState;
      const mid=belowHighState-lowState;
      const high=sample-belowHighState;
      rawPower+=sample*sample;
      lowPower+=low*low;
      midPower+=mid*mid;
      highPower+=high*high;
      count++;
    }
    rawRms[frame]=Math.sqrt(rawPower/Math.max(1,count));
    lowRms[frame]=Math.sqrt(lowPower/Math.max(1,count));
    midRms[frame]=Math.sqrt(midPower/Math.max(1,count));
    highRms[frame]=Math.sqrt(highPower/Math.max(1,count));
  }

  const bandAttack={low:new Float64Array(frameCount),mid:new Float64Array(frameCount),high:new Float64Array(frameCount)};
  const spectralBrightness=new Float64Array(frameCount);
  const spectralSpread=new Float64Array(frameCount);
  const spectralChange=new Float64Array(frameCount);
  const previousShare=[0,0,0];
  const baseline=[lowRms[0]||0,midRms[0]||0,highRms[0]||0];
  for(let i=0;i<frameCount;i++){
    const bands=[lowRms[i],midRms[i],highRms[i]];
    const powers=bands.map(value=>value*value);
    const total=powers[0]+powers[1]+powers[2]+1e-12;
    const share=powers.map(value=>value/total);
    const centers=[125,1125,3000];
    const centroid=share.reduce((sum,value,index)=>sum+value*centers[index],0);
    const variance=share.reduce((sum,value,index)=>sum+value*(centers[index]-centroid)**2,0);
    spectralBrightness[i]=clamp(centroid/3000);
    spectralSpread[i]=clamp(Math.sqrt(variance)/1500);
    if(i>0)spectralChange[i]=(Math.abs(share[0]-previousShare[0])+Math.abs(share[1]-previousShare[1])+Math.abs(share[2]-previousShare[2]))/2;
    for(let band=0;band<3;band++){
      const attack=Math.max(0,bands[band]-baseline[band]*1.035);
      bandAttack[['low','mid','high'][band]][i]=attack;
      baseline[band]=baseline[band]*.92+bands[band]*.08;
      previousShare[band]=share[band];
    }
  }

  const onsetGate=quantile(Array.from(onset).filter(value=>value>0),.78);
  const onsetPeaks=[];
  const minPeakGap=Math.max(1,Math.round(ENVELOPE_HZ*.045));
  let lastPeak=-minPeakGap;
  for(let i=1;i<frameCount-1;i++){
    if(onset[i]<onsetGate||onset[i]<onset[i-1]||onset[i]<onset[i+1])continue;
    if(i-lastPeak<minPeakGap){
      if(onset[i]>onset[lastPeak])onsetPeaks[onsetPeaks.length-1]=i,lastPeak=i;
      continue;
    }
    onsetPeaks.push(i);lastPeak=i;
  }

  const windowFrames=Math.max(1,Math.round(FEATURE_WINDOW_MS/1000*ENVELOPE_HZ));
  const hopFrames=Math.max(1,Math.round(FEATURE_HOP_MS/1000*ENVELOPE_HZ));
  const rawWindows=[];
  const sliceMean=(array,start,end)=>{
    let sum=0;
    for(let i=start;i<end;i++)sum+=array[i]||0;
    return sum/Math.max(1,end-start);
  };
  const sliceMax=(array,start,end)=>{
    let maximum=0;
    for(let i=start;i<end;i++)if((array[i]||0)>maximum)maximum=array[i];
    return maximum;
  };
  for(let start=0;start<frameCount;start+=hopFrames){
    const end=Math.min(frameCount,start+windowFrames);
    const startMs=start/ENVELOPE_HZ*1000;
    const endMs=end===frameCount?durationMs:Math.min(durationMs,end/ENVELOPE_HZ*1000);
    const seconds=Math.max(.001,(endMs-startMs)/1000);
    let onsetCount=0,onsetStrength=0;
    for(const peak of onsetPeaks){
      if(peak<start)continue;
      if(peak>=end)break;
      onsetCount++;
      onsetStrength=Math.max(onsetStrength,onset[peak]);
    }
    const rms=sliceMean(rawRms,start,end);
    rawWindows.push({
      start,end,startMs,endMs,
      rms,
      dbfs:20*Math.log10(rms+1e-9),
      low:sliceMean(lowRms,start,end),
      mid:sliceMean(midRms,start,end),
      high:sliceMean(highRms,start,end),
      lowAttack:sliceMax(bandAttack.low,start,end),
      midAttack:sliceMax(bandAttack.mid,start,end),
      highAttack:sliceMax(bandAttack.high,start,end),
      onsetCount,
      onsetDensity:onsetCount/seconds,
      onsetStrength,
      brightness:sliceMean(spectralBrightness,start,end),
      spread:sliceMean(spectralSpread,start,end),
      spectralChange:sliceMean(spectralChange,start,end),
    });
    if(end===frameCount)break;
  }

  const ranges={};
  for(const key of ['dbfs','low','mid','high','lowAttack','midAttack','highAttack','onsetDensity','onsetStrength','spectralChange']){
    const values=rawWindows.map(item=>key==='dbfs'?item[key]:20*Math.log10(item[key]+1e-9));
    ranges[key]=key==='dbfs'
      ?[quantile(values,.10),quantile(values,.95)]
      :[quantile(values,.10),quantile(values,.95)];
  }
  const scale=(item,key)=>{
    const value=key==='dbfs'?item[key]:20*Math.log10(item[key]+1e-9);
    return normalized(value,ranges[key][0],ranges[key][1]);
  };
  const provisional=rawWindows.map(item=>{
    const energyNorm=scale(item,'dbfs');
    const lowNorm=scale(item,'low'),midNorm=scale(item,'mid'),highNorm=scale(item,'high');
    const onsetDensityNorm=scale(item,'onsetDensity');
    const onsetStrengthNorm=scale(item,'onsetStrength');
    const spectralChangeNorm=scale(item,'spectralChange');
    const lowAttackNorm=scale(item,'lowAttack'),midAttackNorm=scale(item,'midAttack'),highAttackNorm=scale(item,'highAttack');
    const accent=clamp(onsetStrengthNorm*.55+Math.max(lowAttackNorm,midAttackNorm,highAttackNorm)*.45);
    const rawIntensity=clamp(energyNorm*.40+onsetDensityNorm*.20+onsetStrengthNorm*.12+spectralChangeNorm*.13+lowNorm*.08+highNorm*.07);
    return {...item,energyNorm,lowNorm,midNorm,highNorm,onsetDensityNorm,onsetStrengthNorm,spectralChangeNorm,lowAttackNorm,midAttackNorm,highAttackNorm,accent,rawIntensity};
  });
  const smoothed=provisional.map((item,index)=>{
    const previous=provisional[index-1]?.rawIntensity??item.rawIntensity;
    const next=provisional[index+1]?.rawIntensity??item.rawIntensity;
    return previous*.25+item.rawIntensity*.5+next*.25;
  });
  const intensityLow=quantile(smoothed,.05),intensityHigh=quantile(smoothed,.98);

  const timingCloseness=clamp(1-Math.abs((result.estimatedBpm-timing.bpm)/timing.bpm)*12);
  const timingConfidence=clamp(.55*timingCloseness+.45*result.confidence);
  const beatEvidence=[];
  const beatCount=Math.max(0,Math.floor((durationMs-timing.beatZeroMs)/timing.beatMs)+1);
  const evidenceRadius=Math.max(1,Math.round(ENVELOPE_HZ*.045));
  const lowAttackP95=quantile(Array.from(bandAttack.low),.95)+1e-9;
  for(let beatIndex=0;beatIndex<beatCount;beatIndex++){
    const timeMs=timing.beatZeroMs+beatIndex*timing.beatMs;
    const center=Math.round(timeMs/1000*ENVELOPE_HZ);
    const start=Math.max(0,center-evidenceRadius),end=Math.min(frameCount,center+evidenceRadius+1);
    beatEvidence.push({
      beatIndex,timeMs,
      evidence:sliceMax(onset,start,end)*.65+sliceMax(bandAttack.low,start,end)*.35/lowAttackP95,
    });
  }
  const phaseScores=[0,1,2,3].map(phase=>mean(beatEvidence.filter(item=>item.beatIndex%4===phase).map(item=>item.evidence)));
  const rankedPhases=phaseScores.map((score,phase)=>({phase,score})).sort((a,b)=>b.score-a.score||a.phase-b.phase);
  const downbeatPhase=rankedPhases[0]?.phase||0;
  const downbeatSeparation=rankedPhases[0]?.score>0?(rankedPhases[0].score-(rankedPhases[1]?.score||0))/rankedPhases[0].score:0;
  const downbeatConfidence=clamp(.35*timingConfidence+.65*Math.max(0,downbeatSeparation));
  const downbeats=beatEvidence.filter(item=>item.beatIndex%4===downbeatPhase).map(item=>Math.round(item.timeMs));

  let peakAmplitude=0,clippedSamples=0;
  for(const sample of samples){
    const absolute=Math.abs(sample);
    if(absolute>peakAmplitude)peakAmplitude=absolute;
    if(absolute>=.999)clippedSamples++;
  }
  const clippingRatio=clippedSamples/sampleCount;
  const dynamicRangeDb=quantile(rawWindows.map(item=>item.dbfs),.95)-quantile(rawWindows.map(item=>item.dbfs),.10);
  const signalConfidence=clamp((quantile(rawWindows.map(item=>item.dbfs),.75)+60)/45);
  const dynamicConfidence=clamp(dynamicRangeDb/18);
  const onsetConfidence=clamp(onsetPeaks.length/Math.max(1,durationMs/1000*2));
  const featureConfidence=clamp(signalConfidence*.35+dynamicConfidence*.25+onsetConfidence*.25+(1-clamp(clippingRatio/.01))*.15);
  const overallConfidence=clamp(featureConfidence*.62+timingConfidence*.23+downbeatConfidence*.15);

  let previousVector=null;
  const timeline=provisional.map((item,index)=>{
    const intensity=normalized(smoothed[index],intensityLow,intensityHigh);
    const vector=[item.energyNorm,item.lowNorm,item.midNorm,item.highNorm,item.onsetDensityNorm,item.spectralChangeNorm];
    const changeFromPrevious=previousVector?mean(vector.map((value,i)=>Math.abs(value-previousVector[i]))):0;
    previousVector=vector;
    const sustainLikelihood=clamp(item.energyNorm*.55+(1-item.onsetDensityNorm)*.20+(1-item.spectralChangeNorm)*.25);
    const localEvidence=clamp(item.energyNorm*.45+Math.max(item.lowNorm,item.midNorm,item.highNorm)*.25+Math.max(item.onsetDensityNorm,item.spectralChangeNorm)*.20+.10);
    const localConfidence=clamp(featureConfidence*.65+localEvidence*.25+timingConfidence*.10);
    return {
      startMs:Math.round(item.startMs),
      endMs:Math.round(item.endMs),
      centerMs:Math.round((item.startMs+item.endMs)/2),
      energy:{rms:round(item.rms,8),dbfs:round(item.dbfs,3),normalized:round(item.energyNorm)},
      frequencyBands:{
        low:{rms:round(item.low,8),normalized:round(item.lowNorm),attack:round(item.lowAttackNorm)},
        mid:{rms:round(item.mid,8),normalized:round(item.midNorm),attack:round(item.midAttackNorm)},
        high:{rms:round(item.high,8),normalized:round(item.highNorm),attack:round(item.highAttackNorm)},
      },
      onset:{count:item.onsetCount,densityPerSecond:round(item.onsetDensity,3),strength:round(item.onsetStrengthNorm)},
      spectral:{brightness:round(item.brightness),spread:round(item.spread),change:round(item.spectralChangeNorm)},
      changeFromPrevious:round(changeFromPrevious),
      sustainLikelihood:round(sustainLikelihood),
      accent:round(item.accent),
      intensity:round(intensity),
      confidence:round(localConfidence),
    };
  });

  const totalBandPower={
    low:rawWindows.reduce((sum,item)=>sum+item.low*item.low,0),
    mid:rawWindows.reduce((sum,item)=>sum+item.mid*item.mid,0),
    high:rawWindows.reduce((sum,item)=>sum+item.high*item.high,0),
  };
  const totalPower=totalBandPower.low+totalBandPower.mid+totalBandPower.high||1;
  const intensityValues=timeline.map(item=>item.intensity);
  const peakCandidates=timeline.filter((item,index,array)=>item.intensity>=(array[index-1]?.intensity??-1)&&item.intensity>=(array[index+1]?.intensity??-1)).sort((a,b)=>b.intensity-a.intensity||a.centerMs-b.centerMs);
  const intensityPeaks=[];
  for(const item of peakCandidates){
    if(intensityPeaks.some(existing=>Math.abs(existing.centerMs-item.centerMs)<4000))continue;
    intensityPeaks.push({centerMs:item.centerMs,intensity:item.intensity,confidence:item.confidence});
    if(intensityPeaks.length===8)break;
  }
  intensityPeaks.sort((a,b)=>a.centerMs-b.centerMs);

  const gridStepMs=timing.beatMs/(Number(timing.subdivisionsPerBeat)||4);
  const onsetEvents=onsetPeaks.map(frame=>{
    const timeMs=frame/ENVELOPE_HZ*1000;
    const nearestGridIndex=Math.round((timeMs-timing.beatZeroMs)/gridStepMs);
    const gridTimeMs=timing.beatZeroMs+nearestGridIndex*gridStepMs;
    const attackAt=(key,array)=>normalized(20*Math.log10((array[frame]||0)+1e-9),ranges[key][0],ranges[key][1]);
    const accent=clamp(onset[frame]*.55+Math.max(attackAt('lowAttack',bandAttack.low),attackAt('midAttack',bandAttack.mid),attackAt('highAttack',bandAttack.high))*.45);
    return {
      timeMs:Math.round(timeMs),
      strength:round(onset[frame]),
      nearestGridIndex,
      gridOffsetMs:round(timeMs-gridTimeMs,3),
      accent:round(accent),
      confidence:round(clamp(featureConfidence*.6+onset[frame]*.4)),
    };
  });
  const accentGate=quantile(onsetEvents.map(item=>item.accent),.90);
  const accentEvents=onsetEvents.filter(item=>item.accent>=accentGate);
  const sustainedCandidates=[];
  let sustainStart=-1;
  for(let index=0;index<=timeline.length;index++){
    const active=index<timeline.length&&timeline[index].sustainLikelihood>=.72&&timeline[index].energy.normalized>=.35;
    if(active&&sustainStart<0)sustainStart=index;
    if(active||sustainStart<0)continue;
    const endIndex=index-1;
    const startMs=timeline[sustainStart].startMs,endMs=timeline[endIndex].endMs;
    if(endMs-startMs>=750){
      sustainedCandidates.push({
        startMs,endMs,
        likelihood:round(mean(timeline.slice(sustainStart,endIndex+1).map(item=>item.sustainLikelihood))),
        confidence:round(mean(timeline.slice(sustainStart,endIndex+1).map(item=>item.confidence))),
      });
    }
    sustainStart=-1;
  }
  const subdivisionHistogram=Array.from({length:Number(timing.subdivisionsPerBeat)||4},()=>0);
  for(const event of onsetEvents){
    const index=((event.nearestGridIndex%subdivisionHistogram.length)+subdivisionHistogram.length)%subdivisionHistogram.length;
    subdivisionHistogram[index]++;
  }
  const onsetIntervals=onsetEvents.slice(1).map((item,index)=>item.timeMs-onsetEvents[index].timeMs);
  const medianOnsetIntervalMs=quantile(onsetIntervals,.5);
  const intervalDeviation=quantile(onsetIntervals.map(value=>Math.abs(value-medianOnsetIntervalMs)),.5);
  const rhythmPatternConfidence=clamp(1-intervalDeviation/Math.max(1,medianOnsetIntervalMs));

  return {
    schemaVersion:2,
    analysisType:'rhythm-chart-v2-step1-features',
    algorithm:'time-domain-multiband-features-v2.1',
    trackId,
    audio:path.relative(ROOT,audioPath).replace(/\\/g,'/'),
    audioSha256:sha256(audioPath),
    durationMs,
    sampleRate:SAMPLE_RATE,
    envelopeHz:ENVELOPE_HZ,
    windowMs:FEATURE_WINDOW_MS,
    hopMs:FEATURE_HOP_MS,
    frequencyBandsHz:{low:[0,250],mid:[250,2000],high:[2000,4000]},
    timing:{
      source:'monster-hero/data/rhythm-timing.js',
      bpm:round(timing.bpm,3),
      beatMs:round(timing.beatMs,3),
      beatZeroMs:round(timing.beatZeroMs,3),
      subdivisionsPerBeat:Number(timing.subdivisionsPerBeat)||4,
      detectedBpm:result.estimatedBpm,
      detectedBeatOffsetMs:result.beatOffsetMs,
      confidence:round(timingConfidence),
      downbeat:{beatsPerBar:4,phaseFromBeatZero:downbeatPhase,confidence:round(downbeatConfidence),phaseScores:phaseScores.map(value=>round(value)),timesMs:downbeats},
      tempoChangeCandidates:[],
    },
    confidence:{overall:round(overallConfidence),timing:round(timingConfidence),downbeat:round(downbeatConfidence),features:round(featureConfidence)},
    summary:{
      frameCount:timeline.length,
      onsetCount:onsetPeaks.length,
      onsetDensityPerSecond:round(onsetPeaks.length/(durationMs/1000),3),
      peakAmplitude:round(peakAmplitude),
      clippingRatio:round(clippingRatio,8),
      dynamicRangeDb:round(dynamicRangeDb,3),
      energyDbfs:{mean:round(mean(rawWindows.map(item=>item.dbfs)),3),p10:round(quantile(rawWindows.map(item=>item.dbfs),.10),3),p95:round(quantile(rawWindows.map(item=>item.dbfs),.95),3)},
      bandBalance:{low:round(totalBandPower.low/totalPower),mid:round(totalBandPower.mid/totalPower),high:round(totalBandPower.high/totalPower)},
      spectralChange:{mean:round(mean(timeline.map(item=>item.spectral.change))),p95:round(quantile(timeline.map(item=>item.spectral.change),.95))},
      intensity:{mean:round(mean(intensityValues)),p10:round(quantile(intensityValues,.10)),p90:round(quantile(intensityValues,.90)),max:round(Math.max(...intensityValues)),peaks:intensityPeaks},
      rhythmPattern:{
        nearestGridSubdivisionHistogram:subdivisionHistogram,
        medianOnsetIntervalMs:round(medianOnsetIntervalMs,3),
        regularityConfidence:round(rhythmPatternConfidence),
      },
    },
    events:{onsets:onsetEvents,accents:accentEvents,sustainedCandidates},
    timeline,
    scope:{sections:false,phrases:false,chartGeneration:false,expertMaster:false,autoFix:false},
  };
};

const printV2Summary=analysis=>{
  const blocks='▁▂▃▄▅▆▇█';
  const buckets=64;
  const spark=[];
  for(let i=0;i<buckets;i++){
    const start=Math.floor(i*analysis.timeline.length/buckets);
    const end=Math.max(start+1,Math.floor((i+1)*analysis.timeline.length/buckets));
    const value=mean(analysis.timeline.slice(start,end).map(item=>item.intensity));
    spark.push(blocks[Math.min(blocks.length-1,Math.floor(clamp(value)*blocks.length))]);
  }
  const s=analysis.summary;
  console.log(`${analysis.trackId} / ${(analysis.durationMs/1000).toFixed(1)}秒 / ${analysis.timeline.length}区間`);
  console.log(`intensity  ${spark.join('')}`);
  console.log(`intensity mean=${s.intensity.mean.toFixed(3)} p90=${s.intensity.p90.toFixed(3)} max=${s.intensity.max.toFixed(3)}`);
  console.log(`energy=${s.energyDbfs.mean.toFixed(1)}dBFS onset=${s.onsetCount} (${s.onsetDensityPerSecond.toFixed(2)}/s) spectralChange=${s.spectralChange.mean.toFixed(3)}`);
  console.log(`bands low=${s.bandBalance.low.toFixed(3)} mid=${s.bandBalance.mid.toFixed(3)} high=${s.bandBalance.high.toFixed(3)}`);
  console.log(`confidence overall=${analysis.confidence.overall.toFixed(3)} timing=${analysis.confidence.timing.toFixed(3)} downbeat=${analysis.confidence.downbeat.toFixed(3)} features=${analysis.confidence.features.toFixed(3)}`);
};

if(analyzeV2){
  const analysis=featureAnalysisV2();
  if(write){
    const outputPath=path.resolve(arg('--output',path.join(ROOT,trackConfig.output)));
    fs.mkdirSync(path.dirname(outputPath),{recursive:true});
    // 生成データは機械入力なので1行JSONにし、同じ内容を整形空白だけで数万行へ膨らませない。
    fs.writeFileSync(outputPath,`${JSON.stringify(analysis)}\n`);
    console.log(`wrote ${analysis.timeline.length} feature windows: ${path.relative(ROOT,outputPath)}`);
  }
  if(summaryOnly||write)printV2Summary(analysis);
  else if(jsonOnly)console.log(`RHYTHM_AUDIO_ANALYSIS_V2_JSON=${JSON.stringify(analysis)}`);
  else console.log(JSON.stringify(analysis,null,2));
}else if(jsonOnly)console.log(`RHYTHM_AUDIO_ANALYSIS_JSON=${JSON.stringify(result)}`);
else console.log(JSON.stringify(result,null,2));
