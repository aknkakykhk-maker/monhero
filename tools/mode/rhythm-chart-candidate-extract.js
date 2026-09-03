#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const DEFAULT_AUDIO=path.join(ROOT,'monster-hero/audio/bgm-atsu-cup-theme.mp3');
const DEFAULT_OUTPUT=path.join(ROOT,'tools/mode/authoring/atsu-cup-theme-onset-candidates.json');
const TIMING_FILE=path.join(ROOT,'monster-hero/data/rhythm-timing.js');
const SAMPLE_RATE=8000;
const ENVELOPE_HZ=200;
const ONSET_WINDOW_MS=40;
const STRENGTH_THRESHOLD=.60;

const arg=(name,fallback=null)=>{
  const i=process.argv.indexOf(name);
  return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;
};
const requireFfmpeg=process.argv.includes('--require-ffmpeg');
const write=process.argv.includes('--write');
const audioPath=path.resolve(arg('--audio',DEFAULT_AUDIO));
const outputPath=path.resolve(arg('--output',DEFAULT_OUTPUT));
// 曲を増やしても同じ手順で候補を作れるように、対象トラックを指定できる
// (既定は従来どおり あつ杯テーマ)。
const trackId=arg('--track','atsu_cup_theme');

const timingSource=fs.readFileSync(TIMING_FILE,'utf8');
const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${timingSource}\nthis.__timing=RHYTHM_TIMING_DATA[${JSON.stringify(trackId)}];`,timingContext);
const timing=timingContext.__timing;
if(!timing)throw new Error(`${trackId} timing data is missing`);

const ffmpegVersion=spawnSync('ffmpeg',['-version'],{encoding:'utf8'});
if(ffmpegVersion.error||ffmpegVersion.status!==0){
  const message='ffmpeg が見つからないためノーツ候補抽出を実行できません';
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
if(decoded.status!==0){console.error(decoded.stderr?.toString('utf8')||'ffmpeg decode failed');process.exit(1);}

const pcm=decoded.stdout;
const sampleCount=Math.floor(pcm.length/4);
const hop=Math.max(1,Math.round(SAMPLE_RATE/ENVELOPE_HZ));
const frameCount=Math.floor(sampleCount/hop);
const energy=new Float64Array(frameCount);
let previousSample=0;
for(let frame=0;frame<frameCount;frame++){
  const start=frame*hop,end=Math.min(sampleCount,start+hop);
  let sum=0,diff=0,count=0,prev=previousSample;
  for(let i=start;i<end;i++){
    const s=pcm.readFloatLE(i*4);
    sum+=s*s;
    diff+=Math.abs(s-prev);
    prev=s;
    count++;
  }
  previousSample=prev;
  energy[frame]=count?Math.sqrt(sum/count)+diff/count*.35:0;
}

const onset=new Float64Array(frameCount);
let baseline=energy[0]||0;
for(let i=1;i<frameCount;i++){
  baseline=baseline*.90+energy[i-1]*.10;
  onset[i]=Math.max(0,energy[i]-baseline*1.04);
}

const subdivisions=Math.max(1,Number(timing.subdivisionsPerBeat)||4);
const stepMs=timing.beatMs/subdivisions;
const durationMs=sampleCount/SAMPLE_RATE*1000;
const grid=[];
const radius=Math.ceil(ONSET_WINDOW_MS/1000*ENVELOPE_HZ);
for(let gridIndex=0,timeMs=timing.beatZeroMs;timeMs<=durationMs;gridIndex++,timeMs=timing.beatZeroMs+gridIndex*stepMs){
  const center=Math.round(timeMs/1000*ENVELOPE_HZ);
  let raw=0,peakFrame=center;
  for(let i=Math.max(0,center-radius);i<Math.min(frameCount,center+radius+1);i++){
    if(onset[i]>raw){raw=onset[i];peakFrame=i;}
  }
  grid.push({gridIndex,timeMs,raw,peakTimeMs:peakFrame/ENVELOPE_HZ*1000});
}

const positives=grid.map(item=>item.raw).filter(value=>value>0).sort((a,b)=>a-b);
const p95=positives[Math.floor(positives.length*.95)]||1;
const candidates=[];
for(let i=1;i<grid.length-1;i++){
  const item=grid[i],strength=item.raw/p95;
  if(item.raw<grid[i-1].raw||item.raw<grid[i+1].raw||strength<STRENGTH_THRESHOLD)continue;
  candidates.push([
    item.gridIndex,
    Number(strength.toFixed(2)),
    Math.round(item.peakTimeMs-item.timeMs),
  ]);
}

const result={
  trackId:timing.trackId,
  bpm:timing.bpm,
  beatZeroMs:timing.beatZeroMs,
  subdivisionsPerBeat:subdivisions,
  algorithm:'time-domain-onset-grid-v1',
  threshold:STRENGTH_THRESHOLD,
  p95:Number(p95.toFixed(8)),
  candidateCount:candidates.length,
  candidates,
};
const text=`${JSON.stringify(result)}\n`;
if(write){
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});
  fs.writeFileSync(outputPath,text);
  console.log(`wrote ${candidates.length} candidates: ${path.relative(ROOT,outputPath)}`);
}else process.stdout.write(text);
