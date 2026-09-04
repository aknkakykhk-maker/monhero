#!/usr/bin/env node
// 音源から「譜面づくりに要る土台の値」をまとめて出す。
// 解析（テンポ・構造・打点）はどれもここの出力を入力にするので、
// 同じ音を別々のやり方で測ってしまい、あとで食い違うのを防ぐ。
//
//   const {audioFeatures}=require('./rhythm-audio-features-v3.js');
//   const f=await audioFeatures('monster-hero/audio/xxx.mp3');
//
// 返すもの
//   samples / sampleRate / durationMs
//   frames / frameMs                  … 8msごとのフレーム
//   bands                             … 帯域の定義
//   level[b][f] / flux[b][f]          … 帯域ごとの大きさと立ち上がり
//   contrast[b][f]                    … その帯域自身の直近と比べて何倍か
//   envelope[f]                       … 打点らしさ（テンポ推定にも打点検出にも使う）
'use strict';
const {decodeAudio}=require('./rhythm-audio-decode.js');
const {spectrogram,bandFlux,localContrast,normalize}=require('./rhythm-audio-dsp.js');

const SAMPLE_RATE=16000;
const FFT_SIZE=1024;              // 64ms
const HOP_SIZE=128;               // 8ms
const CONTRAST_RADIUS_MS=350;
const BANDS=Object.freeze([
  Object.freeze({id:'low',    fromHz:40,   toHz:120}),
  Object.freeze({id:'lowMid', fromHz:120,  toHz:400}),
  Object.freeze({id:'mid',    fromHz:400,  toHz:1600}),
  Object.freeze({id:'hi',     fromHz:1600, toHz:4000}),
  Object.freeze({id:'air',    fromHz:4000, toHz:7800}),
]);

const audioFeatures=async(file,options={})=>{
  const decoded=await decodeAudio(file,{sampleRate:SAMPLE_RATE,...options});
  const samples=decoded.samples;
  const spec=spectrogram(samples,FFT_SIZE,HOP_SIZE);
  const {ids,flux,level,frames}=bandFlux(spec,SAMPLE_RATE,BANDS);
  const frameMs=HOP_SIZE/SAMPLE_RATE*1000;
  const contrastRadius=Math.max(4,Math.round(CONTRAST_RADIUS_MS/frameMs));
  const contrast=flux.map(values=>localContrast(values,contrastRadius));
  // 打点らしさ: どれかの帯がはっきり跳ねたら山になる（最大＋平均）
  const raw=new Float32Array(frames);
  for(let f=0;f<frames;f++){
    let max=0,sum=0;
    for(let b=0;b<contrast.length;b++){const v=contrast[b][f];if(v>max)max=v;sum+=v;}
    raw[f]=max*.6+sum/contrast.length*.4;
  }
  const envelope=new Float32Array(frames);
  for(let f=0;f<frames;f++){
    const a=raw[Math.max(0,f-1)],b=raw[f],c=raw[Math.min(frames-1,f+1)];
    envelope[f]=(a+b*2+c)/4;
  }
  // テンポ推定用に「1倍を超えたぶん」だけ残した波（ずっと鳴っている成分を落とす）
  const pulse=new Float32Array(frames);
  for(let f=0;f<frames;f++)pulse[f]=Math.max(0,envelope[f]-1);
  return {
    samples,sampleRate:SAMPLE_RATE,durationMs:decoded.durationMs,decodedVia:decoded.via,
    frames,frameMs,fftSize:FFT_SIZE,hopSize:HOP_SIZE,bands:BANDS,bandIds:ids,
    level,flux,contrast,envelope,pulse,contrastRadius,
    frameToMs:frame=>frame*frameMs+FFT_SIZE/2/SAMPLE_RATE*1000,
    msToFrame:ms=>Math.round((ms-FFT_SIZE/2/SAMPLE_RATE*1000)/frameMs),
    normalizedEnvelope:normalize(envelope,.99),
  };
};

module.exports={audioFeatures,SAMPLE_RATE,FFT_SIZE,HOP_SIZE,BANDS,CONTRAST_RADIUS_MS};
