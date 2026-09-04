#!/usr/bin/env node
// 検査用に「正解が分かっている音」を作る。
//
//   node tools/mode/rhythm-audio-testtone.js --out /tmp/a.wav --bpm 150 --bars 32
//   node tools/mode/rhythm-audio-testtone.js --out /tmp/b.wav --bpm 120 --beats-per-bar 3 --swing 0.62
//   node tools/mode/rhythm-audio-testtone.js --out /tmp/c.wav --bpm 140 --tempo-change 168 --bars 32
//
// 【なぜ要るか】
// 「これから増える曲すべてに対応できるか」は、手持ちの曲で試すだけでは分からない。
// 手持ちに無い曲（3拍子・5拍子・跳ね・途中でテンポが変わる・頭に無音がある・とても短い）で
// 何が起きるかを確かめるには、**正解が分かっている音を自分で作って通す**しかない。
//
// 出力は16bitモノラルのWAV。ブラウザのデコーダがそのまま読める。
// ゲームのランタイム・保存データには一切触れない。検査専用の道具。
'use strict';
const fs=require('fs');

const SAMPLE_RATE=16000;
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};

// --- 音の部品（キック・スネア・ハイハット・伸びる音） ---
const addKick=(buffer,at,gain=1)=>{
  const length=Math.round(SAMPLE_RATE*.18);
  for(let i=0;i<length;i++){
    const index=at+i;
    if(index<0||index>=buffer.length)continue;
    const t=i/SAMPLE_RATE;
    const frequency=110*Math.exp(-t*28)+45;
    buffer[index]+=Math.sin(2*Math.PI*frequency*t)*Math.exp(-t*18)*.9*gain;
  }
};
const addSnare=(buffer,at,gain=1,seed=1)=>{
  const length=Math.round(SAMPLE_RATE*.14);
  let state=seed*2654435761>>>0;
  for(let i=0;i<length;i++){
    const index=at+i;
    if(index<0||index>=buffer.length)continue;
    state=(state*1664525+1013904223)>>>0;
    const noise=(state/4294967296)*2-1;
    const t=i/SAMPLE_RATE;
    buffer[index]+=(noise*.6+Math.sin(2*Math.PI*190*t)*.4)*Math.exp(-t*26)*.7*gain;
  }
};
const addHat=(buffer,at,gain=1,seed=1)=>{
  const length=Math.round(SAMPLE_RATE*.045);
  let state=(seed*40503+12345)>>>0,previous=0;
  for(let i=0;i<length;i++){
    const index=at+i;
    if(index<0||index>=buffer.length)continue;
    state=(state*1664525+1013904223)>>>0;
    const noise=(state/4294967296)*2-1;
    const highPassed=noise-previous;   // 一次のハイパス（高い成分だけ残す）
    previous=noise;
    buffer[index]+=highPassed*Math.exp(-i/SAMPLE_RATE*70)*.35*gain;
  }
};
const addTone=(buffer,at,durationMs,hz,gain=1)=>{
  const length=Math.round(SAMPLE_RATE*durationMs/1000);
  for(let i=0;i<length;i++){
    const index=at+i;
    if(index<0||index>=buffer.length)continue;
    const t=i/SAMPLE_RATE;
    const envelope=Math.min(1,t*60)*Math.min(1,(length-i)/SAMPLE_RATE*40);
    buffer[index]+=(Math.sin(2*Math.PI*hz*t)*.6+Math.sin(2*Math.PI*hz*2*t)*.2)*envelope*.35*gain;
  }
};

const writeWav=(file,samples)=>{
  const data=Buffer.alloc(samples.length*2);
  for(let i=0;i<samples.length;i++){
    const value=Math.max(-1,Math.min(1,samples[i]));
    data.writeInt16LE(Math.round(value*32000),i*2);
  }
  const header=Buffer.alloc(44);
  header.write('RIFF',0);
  header.writeUInt32LE(36+data.length,4);
  header.write('WAVE',8);
  header.write('fmt ',12);
  header.writeUInt32LE(16,16);
  header.writeUInt16LE(1,20);
  header.writeUInt16LE(1,22);
  header.writeUInt32LE(SAMPLE_RATE,24);
  header.writeUInt32LE(SAMPLE_RATE*2,28);
  header.writeUInt16LE(2,32);
  header.writeUInt16LE(16,34);
  header.write('data',36);
  header.writeUInt32LE(data.length,40);
  fs.writeFileSync(file,Buffer.concat([header,data]));
};

// --- 曲を組み立てる ---
// bpm / beatsPerBar / bars / swing（8分の裏をどれだけ後ろへ）/ leadSilenceMs /
// tempoChangeBpm（後半のBPM）/ melody（音階を動かすか）/ noiseFloor（録音の底の雑音）
const buildTrack=options=>{
  const {bpm=150,beatsPerBar=4,bars=32,swing=.5,leadSilenceMs=0,tempoChangeBpm=null,
    melody=true,sixteenths=true,noiseFloor=.00013}=options;
  const totalBeats=bars*beatsPerBar;
  // 拍ごとの時刻を先に決める（テンポが変わる曲は後半だけ間隔が変わる）
  const beatTimes=[];
  let time=leadSilenceMs;
  for(let beat=0;beat<totalBeats;beat++){
    beatTimes.push(time);
    const currentBpm=tempoChangeBpm&&beat>=totalBeats/2?tempoChangeBpm:bpm;
    time+=60000/currentBpm;
  }
  const totalMs=time+1200;
  const buffer=new Float32Array(Math.round(SAMPLE_RATE*totalMs/1000));
  // 本物の音源には、無音のところにも必ず小さな雑音（録音の底）がある。
  // 完全な「デジタル無音」で作ると、解析側の「その帯域の下位25%」が0になり、
  // 実際の曲では起こらない割り算の発散を試すことになってしまう。
  // ここで -78dB ほどの底を敷いて、本物に近い音にする。
  if(noiseFloor>0){
    let state=12345;
    for(let i=0;i<buffer.length;i++){
      state=(state*1664525+1013904223)>>>0;
      buffer[i]+=((state/4294967296)*2-1)*noiseFloor;
    }
  }
  const at=ms=>Math.round(ms/1000*SAMPLE_RATE);
  const scale=[0,2,4,5,7,9,11,12];
  beatTimes.forEach((beatMs,beat)=>{
    const beatLength=(beatTimes[beat+1]??beatMs+60000/bpm)-beatMs;
    const inBar=beat%beatsPerBar;
    // 拍の頭: 1拍目と3拍目はキック、2拍目と4拍目はスネア
    if(inBar===0||(beatsPerBar>=4&&inBar===2))addKick(buffer,at(beatMs),inBar===0?1:.8);
    else addSnare(buffer,at(beatMs),.9,beat+1);
    // 8分の裏（跳ねがあれば後ろへずらす）
    addHat(buffer,at(beatMs+beatLength*swing),.9,beat+7);
    // 16分（4分割の曲だけ）。**毎拍**入れる。
    // 1拍おきにすると、半分のテンポで読んでもほとんどの打点が格子に乗ってしまい、
    // 「どちらとも取れる音」になる（実際、200BPMの試験音が100BPMでも当たってしまった）。
    if(sixteenths){
      addHat(buffer,at(beatMs+beatLength*.25),.5,beat+13);
      addHat(buffer,at(beatMs+beatLength*.75),.5,beat+17);
    }
    // メロディ（伸びる音。音階を上下させる）
    if(melody&&inBar===0){
      const step=scale[(Math.floor(beat/beatsPerBar))%scale.length];
      addTone(buffer,at(beatMs),beatLength*beatsPerBar*.9,220*2**(step/12));
    }
  });
  return {samples:buffer,totalMs,beatTimes,
    truth:{bpm,beatsPerBar,bars,swing,leadSilenceMs,tempoChangeBpm,
      beatZeroMs:leadSilenceMs,durationMs:Math.round(totalMs)}};
};

module.exports={buildTrack,writeWav,SAMPLE_RATE};

if(require.main===module){
  const out=arg('--out');
  if(!out){console.error('使い方: node tools/mode/rhythm-audio-testtone.js --out <wav> [--bpm 150] [--beats-per-bar 4] [--bars 32] [--swing 0.5] [--lead-silence 0] [--tempo-change 0]');process.exit(1);}
  const track=buildTrack({
    bpm:Number(arg('--bpm',150)),
    beatsPerBar:Number(arg('--beats-per-bar',4)),
    bars:Number(arg('--bars',32)),
    swing:Number(arg('--swing',.5)),
    leadSilenceMs:Number(arg('--lead-silence',0)),
    tempoChangeBpm:Number(arg('--tempo-change',0))||null,
    sixteenths:arg('--sixteenths','1')!=='0',
  });
  writeWav(out,track.samples);
  console.log(`書き出し: ${out}  ${(track.totalMs/1000).toFixed(1)}秒 / ${track.truth.bpm}BPM / ${track.truth.beatsPerBar}拍子`
    +(track.truth.tempoChangeBpm?` → 途中から${track.truth.tempoChangeBpm}BPM`:'')
    +(track.truth.swing!==.5?` / 跳ね${track.truth.swing}`:''));
}
