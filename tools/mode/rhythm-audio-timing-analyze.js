#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const DEFAULT_AUDIO=path.join(ROOT,'monster-hero/audio/bgm-atsu-cup-theme.mp3');
const SAMPLE_RATE=8000;
// 100Hzでは169BPM付近が166.7BPMへ量子化されるため、5ms刻みまで上げる。
const ENVELOPE_HZ=200;
const BPM_MIN=70;
const BPM_MAX=200;

const arg=(name,fallback=null)=>{
  const index=process.argv.indexOf(name);
  return index>=0&&index+1<process.argv.length?process.argv[index+1]:fallback;
};
const requireFfmpeg=process.argv.includes('--require-ffmpeg');
const jsonOnly=process.argv.includes('--json');
const audioPath=path.resolve(arg('--audio',DEFAULT_AUDIO));

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
if(jsonOnly)console.log(`RHYTHM_AUDIO_ANALYSIS_JSON=${JSON.stringify(result)}`);
else console.log(JSON.stringify(result,null,2));
