#!/usr/bin/env node
// 音源からテンポ・拍の頭・拍子・刻みを自動で出す。
//
//   node tools/mode/rhythm-audio-tempo-v3.js monster-hero/audio/bgm-xxx.mp3
//   node tools/mode/rhythm-audio-tempo-v3.js --all        # 手持ちのBGM全部で試す
//
// 【なぜ要るか】
// これまでは BPM・拍の頭を monster-hero/data/rhythm-timing.js へ**手で書いて**あり、
// 書いてある曲（2曲）以外は譜面を作れなかった。曲を1つ足すたびに人が耳で合わせる、
// という状態では「全ての曲に対応できるツール」にならない。
//
// 【やり方】
// 1. 打点らしさの波（rhythm-audio-features-v3.js の envelope）の自己相関を取る
// 2. 倍・半分の周期も山になるので、倍音を足して重ねてから山を選ぶ（オクターブ違いを避ける）
// 3. その周期のパルス列を全ての位相でずらして当て、いちばん合う位置を拍の頭にする
// 4. 拍子（3拍子か4拍子か）は、小節の頭に来る音の強さで決める
// 5. 刻み（8分／16分／3連）は、拍の中のどこに音が来ているかの分布で決める
// 6. 跳ね（スイング）は、8分の裏がどれだけ後ろへずれているかで決める
'use strict';
const path=require('path');
const {audioFeatures}=require('./rhythm-audio-features-v3.js');

const MIN_BPM=70,MAX_BPM=210;
// 人が「速い／遅い」と感じる真ん中あたり。同じくらいの点なら、ここに近いほうを選ぶ。
const PREFERRED_BPM=125;
const PREFERRED_WIDTH_OCTAVES=.85;
const GRID_TOLERANCE_MS=28;      // 16分格子に「乗った」と見なすずれ
const PHASE_BINS=48;             // 位相を探す細かさ

const round=(value,digits=3)=>Math.round(value*10**digits)/10**digits;

// --- 自己相関（周期ごとの合い具合） ---
const autocorrelation=(values,minLag,maxLag)=>{
  const n=values.length;
  let mean=0;
  for(let i=0;i<n;i++)mean+=values[i];
  mean/=n;
  const centered=new Float64Array(n);
  for(let i=0;i<n;i++)centered[i]=values[i]-mean;
  const out=new Float64Array(maxLag+1);
  for(let lag=minLag;lag<=maxLag;lag++){
    let sum=0;
    for(let i=0;i+lag<n;i++)sum+=centered[i]*centered[i+lag];
    out[lag]=sum/(n-lag);
  }
  return out;
};

// --- 候補のテンポに、実際の打点がどれだけ乗るか ---
//
// ここが要。自己相関の山だけで選ぶと、**半分のテンポ**（2拍を1拍と見る）や
// **3分の2のテンポ**（付点4分を1拍と見る）も同じくらい高い点になり、実際そうなった
// （173→86.5、169→112.8）。
//
// 決め手は「そのテンポの16分格子に、実際の打点がどれだけ乗るか」。
//   ・正しいテンポなら、打点はほぼ全部が格子の上に乗る
//   ・半分のテンポだと、本当の8分が格子の間に落ちる
//   ・3分の2のテンポだと、半分近くが格子から外れる
// 実測（Monster Hero）: 正 91.2% / 半分 76.8% / 3分の2 50.3%
//        （あつ杯）  : 正 72.5% / 半分 39.3% / 3分の2 45.3%
//
// 位相は総当たりせず、打点の「余り」のヒストグラムから一気に出す。
const fitAtStep=(onsets,totalWeight,stepMs)=>{
  const bins=new Float64Array(PHASE_BINS);
  const binMs=stepMs/PHASE_BINS;
  for(const onset of onsets){
    let residual=onset.ms%stepMs;
    if(residual<0)residual+=stepMs;
    bins[Math.min(PHASE_BINS-1,Math.floor(residual/binMs))]+=onset.weight;
  }
  // 許容幅は刻みの幅に比例させる。固定にすると、細かい格子ほど窓が重なって
  // 「どんな打点でも乗っている」ことになり、細かい格子がいつでも勝ってしまう。
  const tolerance=Math.min(GRID_TOLERANCE_MS,stepMs*.3);
  const reach=Math.min(Math.floor(PHASE_BINS/2),Math.max(1,Math.round(tolerance/binMs)));
  let best={fit:0,phaseMs:0};
  for(let center=0;center<PHASE_BINS;center++){
    let sum=0;
    for(let d=-reach;d<=reach;d++)sum+=bins[((center+d)%PHASE_BINS+PHASE_BINS)%PHASE_BINS];
    if(sum>best.fit)best={fit:sum,phaseMs:(center+.5)*binMs};
  }
  return {fit:best.fit/(totalWeight||1),phaseMs:best.phaseMs};
};

// 拍の頭がどこかは、16分格子の「4つに1つ」をどこに置くかで決まる。
// 3つの手がかりを、4つの候補どうしの相対で見て決める。
//   ・その位置にどれだけ強い打点が来るか
//   ・その位置に打点がある拍の割合（占有）
//   ・低い帯（キック）の強さ
// 絶対値で足すと、桁の大きい手がかりだけで決まってしまう（実際そうなり、
// 打点は正しい位置のほうが強いのに、低域のわずかな差で裏拍を選んでいた）。
const beatPhaseFor=(onsets,totalWeight,beatMs,stepPhaseMs,features)=>{
  const stepMs=beatMs/4;
  const low=features?features.level[0]:null;
  const lowScale=(()=>{
    if(!low)return 1;
    const sorted=Array.from(low).sort((a,b)=>a-b);
    return sorted[Math.floor(sorted.length*.9)]||1;
  })();
  const peakAt=(series,ms)=>{
    if(!series||!features)return 0;
    const frame=features.msToFrame(ms);
    let peak=0;
    for(let d=-3;d<=3;d++){
      const f=frame+d;
      if(f>=0&&f<features.frames&&series[f]>peak)peak=series[f];
    }
    return peak;
  };
  const duration=features?features.durationMs:0;
  const measured=[];
  for(let k=0;k<4;k++){
    const phase=stepPhaseMs+k*stepMs;
    let weight=0,present=0,lowSum=0,count=0;
    for(let beat=0;;beat++){
      const ms=phase+beat*beatMs;
      if(ms>=duration-100)break;
      count++;
      let near=0,found=false;
      for(const onset of onsets){
        if(Math.abs(onset.ms-ms)>GRID_TOLERANCE_MS)continue;
        near+=onset.weight;found=true;
      }
      weight+=near;
      if(found)present++;
      lowSum+=peakAt(low,ms);
    }
    measured.push({phase,weight:count?weight/count:0,present:count?present/count:0,
      low:count?lowSum/count/lowScale:0,count});
  }
  const maxOf=key=>Math.max(1e-9,...measured.map(entry=>entry[key]));
  const maxWeight=maxOf('weight'),maxPresent=maxOf('present'),maxLow=maxOf('low');
  let best=null;
  for(const entry of measured){
    const score=entry.weight/maxWeight+entry.present/maxPresent+entry.low/maxLow*.6;
    if(!best||score>best.score)best={...entry,score};
  }
  let offset=best.phase;
  while(offset<0)offset+=beatMs;
  while(offset>=beatMs)offset-=beatMs;
  return {beatZeroMs:offset,fit:round(best.present)};
};

// --- 最小二乗で格子を当て直す ---
// 候補のテンポは0.1%ほどぶれる。2分半の曲では0.1%＝150msのずれになり、終盤で合わなくなる。
// 打点を「いちばん近い格子の番号」へ割り当ててから、時刻＝間隔×番号＋位相 を最小二乗で解き、
// 割り当て直しながら数回くり返す。これでテンポと位相を同時に詰められる。
const refineByRegression=(onsets,stepMs,phaseMs,tolerance)=>{
  let step=stepMs,phase=phaseMs;
  for(let pass=0;pass<4;pass++){
    let sw=0,sk=0,sm=0,skk=0,skm=0;
    for(const onset of onsets){
      const k=Math.round((onset.ms-phase)/step);
      const predicted=phase+k*step;
      if(Math.abs(onset.ms-predicted)>tolerance)continue;
      const w=onset.weight;
      sw+=w;sk+=w*k;sm+=w*onset.ms;skk+=w*k*k;skm+=w*k*onset.ms;
    }
    if(sw<=0)break;
    const denominator=skk*sw-sk*sk;
    if(Math.abs(denominator)<1e-9)break;
    const nextStep=(skm*sw-sk*sm)/denominator;
    const nextPhase=(sm-nextStep*sk)/sw;
    if(!Number.isFinite(nextStep)||!Number.isFinite(nextPhase))break;
    if(nextStep<=0)break;
    // 大きく飛んだら採らない（別の格子へ乗り移るのを防ぐ）
    if(Math.abs(nextStep-stepMs)/stepMs>.03)break;
    const changed=Math.abs(nextStep-step)/step+Math.abs(nextPhase-phase)/step;
    step=nextStep;phase=nextPhase;
    if(changed<1e-6)break;
  }
  return {stepMs:step,phaseMs:phase};
};

const estimateTempo=features=>{
  const {pickPeaks}=require('./rhythm-audio-dsp.js');
  const {pulse,frameMs,frames}=features;
  // 打点（テンポの判定にも位相の判定にも、同じものを使う）
  const onsetFrames=pickPeaks(features.envelope,
    {medianRadius:features.contrastRadius,delta:.15,minGap:6,multiplier:1.22});
  const onsets=onsetFrames.map(frame=>({ms:features.frameToMs(frame),weight:Math.max(0,features.envelope[frame]-1)}));
  const totalWeight=onsets.reduce((sum,onset)=>sum+onset.weight,0);
  if(onsets.length<24||totalWeight<=0)return null;

  const minLag=Math.floor(60000/MAX_BPM/frameMs);
  const maxLag=Math.ceil(60000/MIN_BPM/frameMs);
  const acf=autocorrelation(pulse,minLag,Math.min(frames-2,maxLag));
  const peaks=[];
  for(let lag=minLag+1;lag<Math.min(maxLag,acf.length-1);lag++){
    if(acf[lag]>acf[lag-1]&&acf[lag]>=acf[lag+1]&&acf[lag]>0)peaks.push(lag);
  }
  if(!peaks.length)return null;
  // 自己相関の山と、その倍・半分・1.5倍・3分の2も候補に入れる（取り違えをここで拾い直す）
  const candidateBpm=new Set();
  for(const lag of peaks){
    const bpm=60000/(lag*frameMs);
    for(const ratio of [1,2,.5,1.5,2/3,3,1/3,4/3,3/4]){
      const value=bpm*ratio;
      if(value>=MIN_BPM&&value<=MAX_BPM)candidateBpm.add(Math.round(value*100)/100);
    }
  }
  const prefer=bpm=>Math.exp(-.5*(Math.log2(bpm/PREFERRED_BPM)/PREFERRED_WIDTH_OCTAVES)**2);
  // 「拍のところに音があるか」も見る。速すぎるテンポで取ると、半分の拍が空になる。
  // 打点のある位置を印にしておき、拍ごとに引くだけで済むようにする。
  const marked=new Uint8Array(frames);
  const reachFrames=Math.max(1,Math.round(40/frameMs));
  for(const frame of onsetFrames){
    for(let d=-reachFrames;d<=reachFrames;d++){
      const f=frame+d;
      if(f>=0&&f<frames)marked[f]=1;
    }
  }
  const beatPresence=(bpm,phaseMs)=>{
    const beatMs=60000/bpm;
    let hit=0,count=0;
    for(let beat=0;;beat++){
      const ms=phaseMs+beat*beatMs;
      if(ms>=features.durationMs-100)break;
      const frame=features.msToFrame(ms);
      count++;
      if(frame>=0&&frame<frames&&marked[frame])hit++;
    }
    return count?hit/count:0;
  };
  const evaluate=bpm=>{
    const measured=fitAtStep(onsets,totalWeight,60000/bpm/4);
    const presence=beatPresence(bpm,measured.phaseMs);
    return {bpm,fit:measured.fit,phaseMs:measured.phaseMs,presence,
      score:measured.fit**2*prefer(bpm)*Math.max(.2,presence)};
  };
  const coarse=[...candidateBpm].map(evaluate).sort((a,b)=>b.score-a.score);
  // 上位だけ、粗い→細かいの3段で詰める（長い曲でもずれないよう0.02%まで）
  const refined=coarse.slice(0,5).map(entry=>{
    let best=entry;
    for(const span of [.02,.002,.0002]){
      const from=best.bpm*(1-span),to=best.bpm*(1+span);
      for(let i=0;i<=20;i++){
        const candidate=evaluate(from+(to-from)*i/20);
        if(candidate.score>best.score)best=candidate;
      }
    }
    return best;
  }).sort((a,b)=>b.score-a.score);
  let best=refined[0];

  // 最小二乗で格子を当て直して、テンポと位相を詰める
  const regressed=refineByRegression(onsets,60000/best.bpm/4,best.phaseMs,GRID_TOLERANCE_MS);
  const polished=evaluate(60000/(regressed.stepMs*4));
  if(polished.fit>=best.fit-.01)best={...polished,phaseMs:((regressed.phaseMs%regressed.stepMs)+regressed.stepMs)%regressed.stepMs};

  const beat=beatPhaseFor(onsets,totalWeight,60000/best.bpm,best.phaseMs,features);
  const runnerUp=refined.find(entry=>Math.abs(entry.bpm-best.bpm)/best.bpm>.05);
  return {
    beatMs:60000/best.bpm,bpm:best.bpm,
    beatZeroMs:beat.beatZeroMs,
    gridFit:round(best.fit),beatFit:round(beat.fit),beatPresence:round(best.presence??0),
    onsets,totalWeight,
    confidence:round(runnerUp?Math.max(0,Math.min(1,1-runnerUp.score/best.score)):1),
    candidates:refined.slice(0,4).map(entry=>({bpm:round(entry.bpm,2),fit:round(entry.fit),
      presence:round(entry.presence??0),score:round(entry.score)})),
  };
};

// --- 拍の頭（位相）---
// テンポの判定と同じ打点・同じ物差しで出す（別々に測ると食い違うため）
const estimateBeatPhase=(features,beatMs,tempo)=>{
  if(tempo&&Number.isFinite(tempo.beatZeroMs))return {beatZeroMs:round(tempo.beatZeroMs,1),strength:round(tempo.beatFit)};
  return {beatZeroMs:0,strength:0};
};

// --- 拍子（何拍で1小節か） ---
// 小節の頭には強い音（とくに低い帯）が来やすい。候補の拍子と位相で試して、
// 小節の頭に来る音の強さがいちばん際立つ組み合わせを選ぶ。
const estimateMeter=(features,beatMs,beatZeroMs)=>{
  const {pulse,frameMs,frames,level}=features;
  const low=level[0];
  const beatValue=beat=>{
    const frame=Math.round((beatZeroMs+beat*beatMs-features.frameToMs(0))/frameMs);
    if(frame<0||frame>=frames)return null;
    let peak=0,lowPeak=0;
    for(let d=-2;d<=2;d++){
      const f=frame+d;
      if(f<0||f>=frames)continue;
      peak=Math.max(peak,pulse[f]);
      lowPeak=Math.max(lowPeak,low[f]);
    }
    return {peak,lowPeak};
  };
  const totalBeats=Math.floor((features.durationMs-beatZeroMs)/beatMs);
  const values=[];
  for(let beat=0;beat<totalBeats;beat++)values.push(beatValue(beat));
  const lowMax=Math.max(1e-9,...values.filter(Boolean).map(v=>v.lowPeak));
  const scoreOf=(meter,phase)=>{
    let onSum=0,onCount=0,offSum=0,offCount=0;
    values.forEach((value,beat)=>{
      if(!value)return;
      const weight=value.peak+value.lowPeak/lowMax;
      if((beat-phase+meter*4)%meter===0){onSum+=weight;onCount++;}
      else{offSum+=weight;offCount++;}
    });
    const on=onCount?onSum/onCount:0,off=offCount?offSum/offCount:0;
    return off>0?on/off:0;
  };
  let best=null;
  for(const meter of [4,3]){
    for(let phase=0;phase<meter;phase++){
      const value=scoreOf(meter,phase);
      // 4拍子を少しだけ優先する（ほとんどの曲は4拍子で、僅差なら4を選ぶほうが外さない）
      const weighted=value*(meter===4?1.04:1);
      if(!best||weighted>best.weighted)best={meter,phase,value,weighted};
    }
  }
  return {beatsPerBar:best.meter,barPhase:best.phase,contrast:round(best.value)};
};

// --- 刻み（8分・16分・3連）と跳ね ---
const estimateSubdivision=(features,beatMs,beatZeroMs)=>{
  const {pulse,frameMs,frames}=features;
  // 拍の中のどこで音が立ったかを集める
  const positions=[];
  for(let frame=1;frame<frames-1;frame++){
    if(pulse[frame]<=0)continue;
    if(pulse[frame]<pulse[frame-1]||pulse[frame]<pulse[frame+1])continue;
    const ms=features.frameToMs(frame);
    let phase=((ms-beatZeroMs)%beatMs)/beatMs;
    if(phase<0)phase+=1;
    positions.push({phase,weight:pulse[frame]});
  }
  if(positions.length<20)return {subdivisionsPerBeat:4,triplet:false,swing:{ratio:.5,shift:0},confidence:0,samples:positions.length};
  const massNear=(target,tolerance)=>{
    let sum=0;
    for(const {phase,weight} of positions){
      const distance=Math.min(Math.abs(phase-target),1-Math.abs(phase-target));
      if(distance<=tolerance)sum+=weight;
    }
    return sum;
  };
  const total=positions.reduce((sum,p)=>sum+p.weight,0);
  const tolerance=.06;
  const beatMass=massNear(0,tolerance);
  const eighthMass=massNear(.5,tolerance);
  const sixteenthMass=massNear(.25,tolerance)+massNear(.75,tolerance);
  const tripletMass=massNear(1/3,tolerance)+massNear(2/3,tolerance);
  const share=value=>round(value/total);
  // 3連か16分かは、「その刻みの格子に打点がどれだけ乗るか」で決める。
  // 位置の割合だけで決めると、跳ねた曲や少しよれた曲で取り違える。
  const fitAt=divisions=>{
    const stepMs=beatMs/divisions;
    const tolerance=Math.min(GRID_TOLERANCE_MS,stepMs*.3);
    let hit=0;
    for(const {phase,weight} of positions){
      const position=phase*beatMs;
      const k=Math.round(position/stepMs);
      if(Math.abs(position-k*stepMs)<=tolerance)hit+=weight;
    }
    return hit/total;
  };
  const fit4=fitAt(4),fit3=fitAt(3),fit6=fitAt(6),fit2=fitAt(2);
  // 細かい格子はいつでも当たりやすいので、細かいほうを選ぶには差が要る
  let subdivisionsPerBeat=2,triplet=false;
  if(fit4>=fit2+.04){subdivisionsPerBeat=4;}
  if(fit3>=fit4+.06){subdivisionsPerBeat=3;triplet=true;}
  if(fit6>=Math.max(fit4,fit3)+.10){subdivisionsPerBeat=6;triplet=true;}
  // 跳ね: 8分の裏がどれだけ後ろへずれているか
  const swing=(()=>{
    const near=positions.filter(({phase})=>Math.abs(phase-.5)<=.18);
    if(near.length<10)return {ratio:.5,shift:0,samples:near.length};
    const shifts=near.map(({phase})=>phase-.5).sort((a,b)=>a-b);
    const median=shifts[shifts.length>>1];
    return {ratio:round(Math.max(.5,Math.min(.72,.5+median))),shift:round(median),samples:near.length};
  })();
  return {subdivisionsPerBeat,triplet,swing,samples:positions.length,
    gridFitByDivision:{2:round(fit2),3:round(fit3),4:round(fit4),6:round(fit6)},
    share:{beat:share(beatMass),eighth:share(eighthMass),sixteenth:share(sixteenthMass),triplet:share(tripletMass)},
    confidence:round(Math.min(1,positions.length/300))};
};

// --- まとめ ---
const detectTiming=async(file,options={})=>{
  const features=options.features||await audioFeatures(file);
  const tempo=estimateTempo(features);
  if(!tempo)return null;
  const phase=estimateBeatPhase(features,tempo.beatMs,tempo);
  const meter=estimateMeter(features,tempo.beatMs,phase.beatZeroMs);
  // 小節の頭が拍0に来るよう、拍の頭をずらす
  const beatZeroMs=round(phase.beatZeroMs+meter.barPhase*tempo.beatMs,1);
  const subdivision=estimateSubdivision(features,tempo.beatMs,beatZeroMs);
  return {
    bpm:round(tempo.bpm,3),
    beatMs:round(tempo.beatMs,3),
    beatZeroMs,
    beatsPerBar:meter.beatsPerBar,
    subdivisionsPerBeat:subdivision.subdivisionsPerBeat,
    triplet:subdivision.triplet,
    swing:subdivision.swing,
    audioDurationMs:Math.round(features.durationMs),
    confidence:{tempo:tempo.confidence,beat:phase.strength,meter:meter.contrast,grid:subdivision.confidence},
    gridFit:tempo.gridFit,
    beatPresence:tempo.beatPresence,
    tempoCandidates:tempo.candidates,
    detail:{subdivisionShare:subdivision.share,onsetSamples:subdivision.samples,
      gridFitByDivision:subdivision.gridFitByDivision},
  };
};

module.exports={detectTiming,estimateTempo,estimateBeatPhase,estimateMeter,estimateSubdivision,MIN_BPM,MAX_BPM};

if(require.main===module){
  const fs=require('fs');
  const ROOT=path.resolve(__dirname,'..','..');
  const all=process.argv.includes('--all');
  const files=all
    ?fs.readdirSync(path.join(ROOT,'monster-hero/audio')).filter(f=>/\.mp3$/i.test(f)).map(f=>`monster-hero/audio/${f}`)
    :[process.argv[2]];
  if(!files[0]){console.error('使い方: node tools/mode/rhythm-audio-tempo-v3.js <音源> | --all');process.exit(1);}
  (async()=>{
    for(const file of files){
      try{
        const started=Date.now();
        const timing=await detectTiming(file);
        if(!timing){console.log(`${path.basename(file).padEnd(44)} 判定できず`);continue;}
        console.log(`${path.basename(file).padEnd(44)} BPM ${String(timing.bpm.toFixed(2)).padStart(7)} / ${timing.beatsPerBar}拍子 / `
          +`拍の頭 ${String(Math.round(timing.beatZeroMs)).padStart(5)}ms / ${timing.subdivisionsPerBeat}分割${timing.triplet?'(3連)':''}`
          +` / 跳ね ${timing.swing.ratio<=.53?'なし':timing.swing.ratio.toFixed(2)}`
          +` / 確からしさ テンポ${timing.confidence.tempo.toFixed(2)} 拍子${timing.confidence.meter.toFixed(2)}`
          +`  (${((Date.now()-started)/1000).toFixed(1)}秒)`);
      }catch(e){console.log(`${path.basename(file).padEnd(44)} エラー: ${e.message}`);}
    }
  })();
}
