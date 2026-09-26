#!/usr/bin/env node
// 音の「層」を解析する(2026-09-26・MHB CHART ENGINE 強化の段2)。
//
//   node tools/mode/rhythm-audio-layers-v3.js --track <曲id>            # 解析して要約を出すだけ
//   node tools/mode/rhythm-audio-layers-v3.js --track <曲id> --write    # authoring/<曲>-v3-layers.json へ書く
//   node tools/mode/rhythm-audio-layers-v3.js --all --write             # 一覧にある曲を全部
//
// 【なぜ要るか】
// いまの解析(rhythm-audio-analyze-v3.js)は、打点を4つの性格(FULL / PUNCH / BODY / LIGHT)に分けるだけで、
// 「何の楽器が鳴ったか」は持たない。16kHz で読むので 8kHz より上(ハイハット・シンバルの芯)も見えない。
// 人が譜面を作るときは「いまはドラムを追う」「ここは歌を追う」と、音の層を聞き分けて叩かせる音を選んでいる。
// 設計と段取り: docs/spec/RHYTHM_CHART_ENGINE_ROADMAP.md の段2。
//
// 【何を出すか】既存の解析ファイル(*-v3-audio.json)は**読むだけで書き換えない**(運用ルール ⑩-2)。別のファイルへ足す。
//   ・打楽器と音程楽器の分離(HPSS): スペクトルを「時間方向の中央値」でならすと横に伸びる音(音程楽器・歌)、
//     「周波数方向の中央値」でならすと縦に立つ音(打楽器)が残る。2つの比で柔らかく振り分ける
//   ・打点ごとの打楽器の種類: 既存の打点それぞれで、打楽器成分の強さを3つの帯で測る(その帯の曲の床からの dB)
//       キック   … 低域(40〜300Hz)が強く、低域のうち打楽器成分の割合が DRUM_KICK_SHARE 以上
//                  (ベースも低域は強いが、音程のある伸びる音なので打楽器成分の割合が1割に満たない)
//       スネア   … 中域(1〜5kHz)が強く、高域より・キックの低域より弱くない
//                  (キックの打ち始めの「カチッ」も中域に出るので、キックだけの打点をスネアと呼ばないように)
//       ハイハット … 高域(6〜15kHz)が強く、中域より DRUM_HAT_MARGIN_DB 以上強い(32kHz で読むので見える)
//     「強い」の線は、その曲の打点の値を「鳴っている群」と「鳴っていない群」へいちばんよく分ける境目(大津の方法)。
//     ただし床から DRUM_MIN_DB を下限にする。割合を決め打ちしない(打点の上位4分の1、とすると、
//     ハイハットが打点の3分の1ある検証音で64件中17件しか拾えなかった)。
//     ハイハットの無い曲で、雑音を無理にハイハットと呼ばないため。
//     【初めの作りで外したこと】「直前との差」で測ると、ベースが鳴り続けている所のキックは差が小さく、
//     無音から鳴るベースのほうが大きく出た(検証音で裏拍のベース64件すべてをキックと呼んだ)。
//     打楽器成分の帯は音が無いと0に近いので、差で測るとどの打点も「60dB上がった」になった
//   ・16分ごとの層の強さ: 音程楽器(harmonic)・打楽器(percussive)・歌や主旋律の帯の音程楽器(lead: 250〜4000Hz)・
//     高い打楽器(high: 6kHz〜)。曲の中の強さの順位で 0〜1 にする(段3の「主役の追跡」の材料)
//
// 外部ライブラリは使わない。乱数を使わず、同じ音源なら毎回同じ結果になる。
// ゲームのランタイム・保存データには一切触れない。
'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {spectrogram}=require('./rhythm-audio-dsp.js');

const ROOT=path.resolve(__dirname,'..','..');
const authoringDir=path.join(ROOT,'tools/mode/authoring');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};

const LAYER_SAMPLE_RATE=32000;
// 32kHz で FFT 1024(32ms)・ホップ 256(8ms)。既存の解析(16kHz・ホップ128)と同じ 8ms 刻み
const LAYER_FFT=1024,LAYER_HOP=256;
// HPSS の中央値の幅(フレーム / ビン)。17フレーム=136ms・17ビン=約530Hz
const HPSS_TIME_KERNEL=17,HPSS_FREQ_KERNEL=17;
const DRUM_BANDS=Object.freeze({kick:[40,300],snare:[1000,5000],hat:[6000,15000]});
// 強さの線の下限(床からの dB)
const DRUM_MIN_DB=10;
// キックを名乗る低域の打楽器成分の割合の下限 / ハイハットが中域より強くなければならない差(dB)
const DRUM_KICK_SHARE=.2,DRUM_HAT_MARGIN_DB=3;
const LEAD_BAND=[250,4000],HIGH_BAND=[6000,15000];

// --- 幅 k の中央値でならす(両端は端の値で埋める)。挿入で並べ替えた窓を持つので O(n・k) ---
const slidingMedian=(input,k,out)=>{
  const n=input.length,half=k>>1,win=new Float64Array(k);
  const at=i=>input[i<0?0:i>=n?n-1:i];
  for(let i=0;i<n;i++){
    for(let j=0;j<k;j++){
      const v=at(i-half+j);
      let p=j;
      while(p>0&&win[p-1]>v){win[p]=win[p-1];p--;}
      win[p]=v;
    }
    out[i]=win[half];
  }
  return out;
};

// --- 打楽器と音程楽器の分離(柔らかい振り分け・ウィーナー型) ---
const hpss=spec=>{
  const {magnitudes,frames,bins}=spec;
  const harmonicMed=new Float32Array(frames*bins),percussiveMed=new Float32Array(frames*bins);
  const column=new Float32Array(frames),colOut=new Float32Array(frames);
  for(let b=0;b<bins;b++){
    for(let f=0;f<frames;f++)column[f]=magnitudes[f*bins+b];
    slidingMedian(column,HPSS_TIME_KERNEL,colOut);
    for(let f=0;f<frames;f++)harmonicMed[f*bins+b]=colOut[f];
  }
  const row=new Float32Array(bins),rowOut=new Float32Array(bins);
  for(let f=0;f<frames;f++){
    for(let b=0;b<bins;b++)row[b]=magnitudes[f*bins+b];
    slidingMedian(row,HPSS_FREQ_KERNEL,rowOut);
    for(let b=0;b<bins;b++)percussiveMed[f*bins+b]=rowOut[b];
  }
  const harmonic=new Float32Array(frames*bins),percussive=new Float32Array(frames*bins);
  for(let i=0;i<frames*bins;i++){
    const h=harmonicMed[i]*harmonicMed[i],p=percussiveMed[i]*percussiveMed[i],sum=h+p;
    if(sum<=0)continue;
    harmonic[i]=magnitudes[i]*h/sum;
    percussive[i]=magnitudes[i]*p/sum;
  }
  return {harmonic,percussive};
};

const binRange=([fromHz,toHz],sampleRate,fftSize,bins)=>{
  const hz=sampleRate/fftSize;
  return [Math.max(1,Math.floor(fromHz/hz)),Math.min(bins-1,Math.ceil(toHz/hz))];
};
// フレームごとの帯のエネルギー(振幅の2乗の和)
const bandEnergy=(values,frames,bins,[lo,hi])=>{
  const out=new Float64Array(frames);
  for(let f=0;f<frames;f++){let sum=0;const base=f*bins;for(let b=lo;b<=hi;b++){const v=values[base+b];sum+=v*v;}out[f]=sum;}
  return out;
};
const dB=value=>10*Math.log10(value+1e-12);
const median=list=>{const s=Float64Array.from(list).sort();return s.length?s[s.length>>1]:0;};
// 曲の中の順位で 0〜1 にする(大きい音量の曲と小さい曲をそろえる)
const rankNormalize=values=>{
  const sorted=Float64Array.from(values).sort();
  const n=sorted.length;
  return values.map(v=>{
    let lo=0,hi=n;
    while(lo<hi){const mid=(lo+hi)>>1;if(sorted[mid]<v)lo=mid+1;else hi=mid;}
    return n>1?Math.round(lo/(n-1)*100)/100:0;
  });
};

// samples: Float32Array(モノラル) / timing: 既存の解析の timing / onsets: 既存の解析の onsets([{timeMs}])
const analyzeLayers=(samples,sampleRate,{timing,onsets})=>{
  const fftSize=LAYER_FFT*Math.max(1,Math.round(sampleRate/LAYER_SAMPLE_RATE));
  const hopSize=Math.round(sampleRate*.008);
  const spec=spectrogram(samples,fftSize,hopSize);
  const {frames,bins}=spec;
  const {harmonic,percussive}=hpss(spec);
  const range=band=>binRange(band,sampleRate,fftSize,bins);
  const frameOfMs=ms=>Math.round((ms/1000*sampleRate-fftSize/2)/hopSize);
  const clampFrame=f=>Math.max(0,Math.min(frames-1,f));

  // --- 打点ごとの打楽器の種類 ---
  const bandOf=(values,band)=>bandEnergy(values,frames,bins,range(band));
  const energy={
    kickP:bandOf(percussive,DRUM_BANDS.kick),kickH:bandOf(harmonic,DRUM_BANDS.kick),
    snare:bandOf(percussive,DRUM_BANDS.snare),hat:bandOf(percussive,DRUM_BANDS.hat),
  };
  const harmonicAll=bandEnergy(harmonic,frames,bins,[1,bins-1]),percussiveAll=bandEnergy(percussive,frames,bins,[1,bins-1]);
  // 帯の床: 曲の中央値。ただしその帯のいちばん大きい音(99%点)から40dB下を下限にする(無音の多い曲で床が0にならないように)
  const percentile=(values,p)=>{const sorted=Float64Array.from(values).sort();return sorted[Math.floor(p*(sorted.length-1))]||0;};
  const floorOf=values=>Math.max(percentile(values,.5),percentile(values,.99)*1e-4)+1e-12;
  const floors={kick:floorOf(energy.kickP),snare:floorOf(energy.snare),hat:floorOf(energy.hat)};
  // 打点の直後(0〜40ms)のいちばん大きい所
  const peakAt=(values,ms)=>{const f=frameOfMs(ms);let peak=0;for(let k=0;k<=5;k++)peak=Math.max(peak,values[clampFrame(f+k)]);return peak;};
  const features=onsets.map(onset=>{
    const kickP=peakAt(energy.kickP,onset.timeMs),kickH=peakAt(energy.kickH,onset.timeMs);
    return {kick:dB(kickP/floors.kick),kickShare:kickP+kickH>0?kickP/(kickP+kickH):0,
      snare:dB(peakAt(energy.snare,onset.timeMs)/floors.snare),hat:dB(peakAt(energy.hat,onset.timeMs)/floors.hat)};
  });
  // 2つの群へいちばんよく分ける境目(大津の方法・0.5dB刻み)。床から DRUM_MIN_DB を下限にする
  const otsu=values=>{
    const list=values.filter(Number.isFinite);
    if(list.length<4)return Infinity;
    const lo=Math.min(...list),hi=Math.max(...list);
    let best=lo,bestScore=-1;
    for(let cut=lo+.5;cut<hi;cut+=.5){
      let n0=0,s0=0,n1=0,s1=0;
      for(const v of list){if(v<cut){n0++;s0+=v;}else{n1++;s1+=v;}}
      if(!n0||!n1)continue;
      const score=n0*n1*(s0/n0-s1/n1)**2;
      if(score>bestScore){bestScore=score;best=cut;}
    }
    return best;
  };
  const lineOf=kind=>Math.max(DRUM_MIN_DB,otsu(features.map(x=>x[kind])));
  const lines={kick:lineOf('kick'),snare:lineOf('snare'),hat:lineOf('hat')};
  const onsetLayers=onsets.map((onset,i)=>{
    const x=features[i],drums=[];
    if(x.kick>=lines.kick&&x.kickShare>=DRUM_KICK_SHARE)drums.push('kick');
    if(x.snare>=lines.snare&&x.snare>=x.hat-DRUM_HAT_MARGIN_DB&&x.snare>=x.kick-DRUM_HAT_MARGIN_DB)drums.push('snare');
    if(x.hat>=lines.hat&&x.hat>=x.snare+DRUM_HAT_MARGIN_DB)drums.push('hat');
    const f=frameOfMs(onset.timeMs);
    let h=0,p=0;for(let k=0;k<=5;k++){h+=harmonicAll[clampFrame(f+k)];p+=percussiveAll[clampFrame(f+k)];}
    const r1=v=>Math.round(v*10)/10;
    return {timeMs:onset.timeMs,drums,kick:r1(x.kick),kickShare:Math.round(x.kickShare*100)/100,snare:r1(x.snare),hat:r1(x.hat),
      percussiveShare:h+p>0?Math.round(p/(h+p)*100)/100:0};
  });

  // --- 16分ごとの層の強さ ---
  const gridMs=Number.isFinite(Number(timing.gridMs))?Number(timing.gridMs):timing.beatMs/timing.subdivisionsPerBeat;
  const durationMs=samples.length/sampleRate*1000;
  const firstGrid=Math.ceil((0-timing.beatZeroMs)/gridMs),lastGrid=Math.floor((durationMs-timing.beatZeroMs)/gridMs);
  const lead=bandEnergy(harmonic,frames,bins,range(LEAD_BAND)),high=bandEnergy(percussive,frames,bins,range(HIGH_BAND));
  const perGrid=energy=>{
    const out=[];
    for(let g=firstGrid;g<=lastGrid;g++){
      const from=clampFrame(frameOfMs(timing.beatZeroMs+g*gridMs)),to=clampFrame(frameOfMs(timing.beatZeroMs+(g+1)*gridMs));
      let sum=0;for(let f=from;f<=Math.max(from,to-1);f++)sum+=energy[f];
      out.push(dB(sum/Math.max(1,to-from)));
    }
    return rankNormalize(out);
  };
  const counts={kick:0,snare:0,hat:0,none:0};
  for(const layer of onsetLayers){if(!layer.drums.length)counts.none++;for(const kind of layer.drums)counts[kind]++;}
  return {
    sampleRate,fftSize,hopSize,
    hpss:{timeKernel:HPSS_TIME_KERNEL,freqKernel:HPSS_FREQ_KERNEL},
    drumBands:DRUM_BANDS,drumLines:{method:'otsu',minDb:DRUM_MIN_DB,kickShare:DRUM_KICK_SHARE,hatMarginDb:DRUM_HAT_MARGIN_DB,
      kick:Math.round(lines.kick*10)/10,snare:Math.round(lines.snare*10)/10,hat:Math.round(lines.hat*10)/10},
    grid:{firstGrid,count:lastGrid-firstGrid+1,gridMs},
    series:{harmonic:perGrid(harmonicAll),percussive:perGrid(percussiveAll),lead:perGrid(lead),high:perGrid(high)},
    onsets:onsetLayers,
    summary:{onsets:onsetLayers.length,drums:counts},
  };
};

// --- 拍の中の位置で見た「もっともらしさ」(要約用。正解の無い実曲で、分類が音楽的に筋が通っているかを見る) ---
//   キックは拍の頭、スネアは2・4拍目(4拍子)、ハイハットは8分・16分の裏にも多い、のが一般的なポップス・ロック
const plausibility=(onsetLayers,audio)=>{
  const t=audio.timing,gridMs=t.gridMs||t.beatMs/t.subdivisionsPerBeat,BEAT=t.subdivisionsPerBeat,bar=BEAT*(t.beatsPerBar||4);
  const pos=ms=>{const g=Math.round((ms-t.beatZeroMs)/gridMs);return {onBeat:((g%BEAT)+BEAT)%BEAT===0,beat:Math.floor((((g%bar)+bar)%bar)/BEAT)};};
  const stat={};
  for(const kind of ['kick','snare','hat']){
    const list=onsetLayers.filter(l=>l.drums.includes(kind)).map(l=>pos(l.timeMs));
    stat[kind]={count:list.length,onBeat:list.length?Math.round(list.filter(p=>p.onBeat).length/list.length*100)/100:null,
      backbeat:list.length&&(t.beatsPerBar||4)===4?Math.round(list.filter(p=>p.onBeat&&(p.beat===1||p.beat===3)).length/list.length*100)/100:null};
  }
  return stat;
};

const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const layersFor=async(trackId)=>{
  const dashed=trackId.replace(/_/g,'-');
  const audioFile=path.join(authoringDir,`${dashed}-v3-audio.json`);
  if(!fs.existsSync(audioFile))throw new Error(`解析ファイルがありません: ${path.relative(ROOT,audioFile)}`);
  const audio=readJson(audioFile);
  const source=path.join(ROOT,audio.audio);
  if(!fs.existsSync(source))throw new Error(`音源がありません: ${audio.audio}`);
  const {decodeAudio}=require('./rhythm-audio-decode.js');
  const decoded=await decodeAudio(source,{sampleRate:LAYER_SAMPLE_RATE});
  const result=analyzeLayers(decoded.samples,decoded.sampleRate,{timing:audio.timing,onsets:audio.onsets||[]});
  return {
    schemaVersion:1,analysisType:'rhythm-audio-layers-v3',trackId,audio:audio.audio,
    audioSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),
    decodedVia:decoded.via,
    // どの解析ファイルの打点・格子に合わせたか(解析ファイルが変わったら作り直す目印)
    basedOn:{file:path.basename(audioFile),sha256:crypto.createHash('sha256').update(fs.readFileSync(audioFile)).digest('hex')},
    ...result,
    plausibility:plausibility(result.onsets,audio),
  };
};

module.exports={analyzeLayers,hpss,slidingMedian,plausibility,layersFor,LAYER_SAMPLE_RATE,DRUM_BANDS,DRUM_MIN_DB,DRUM_KICK_SHARE,DRUM_HAT_MARGIN_DB};

if(require.main===module){
  (async()=>{
    const write=process.argv.includes('--write');
    const tracks=process.argv.includes('--all')
      ?Object.keys(readJson(path.join(authoringDir,'rhythm-song-registry.json')).songs||{})
      :[arg('--track')].filter(Boolean);
    if(!tracks.length){console.error('--track <曲id> か --all を指定してください');process.exit(2);}
    let failed=0;
    for(const trackId of tracks){
      try{
        const started=Date.now();
        const out=await layersFor(trackId);
        const p=out.plausibility,d=out.summary.drums;
        const pct=v=>v==null?'—':`${Math.round(v*100)}%`;
        console.log(`${trackId}: 打点${out.summary.onsets} キック${d.kick}(拍の頭${pct(p.kick.onBeat)}) スネア${d.snare}(2・4拍目${pct(p.snare.backbeat)}) ハイハット${d.hat}(拍の頭${pct(p.hat.onBeat)}) 名乗らない${d.none}  ${((Date.now()-started)/1000).toFixed(1)}秒`);
        if(write){
          const file=path.join(authoringDir,`${trackId.replace(/_/g,'-')}-v3-layers.json`);
          fs.writeFileSync(file,JSON.stringify(out)+'\n');
          console.log(`  書き出し: ${path.relative(ROOT,file)}（${Math.round(fs.statSync(file).size/1024)}KB）`);
        }
      }catch(error){failed++;console.error(`${trackId}: 失敗 — ${error.message}`);}
    }
    process.exit(failed?1:0);
  })();
}
