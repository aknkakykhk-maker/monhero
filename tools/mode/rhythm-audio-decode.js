#!/usr/bin/env node
// 音源(mp3等)を「モノラルのPCM」へデコードして返す。
//
//   const {decodeAudio}=require('./rhythm-audio-decode.js');
//   const {samples,sampleRate,durationMs,via}=await decodeAudio('monster-hero/audio/...mp3',{sampleRate:16000});
//
// 【なぜ作ったか】
// 既存の解析(rhythm-audio-timing-analyze.js)は ffmpeg でデコードしていたが、
// 開発に使うサンドボックスには ffmpeg が入っていない。そのため
// 「音を解析し直す」作業だけが手元でできず、譜面制作ツールを音から作り込めなかった。
//
// この環境には Playwright の Chromium が入っている。ブラウザは mp3 を確実に読めるので、
// Web Audio の decodeAudioData でデコードし、OfflineAudioContext で望みの
// サンプリング周波数のモノラルへ落として取り出す。ffmpeg があればそちらを使う
// (速いのと、ブラウザを立てない分だけ確実なため)。どちらでも同じ結果を返す。
//
// 音源は読み取りしかしない。ゲームのランタイム・保存データには一切触れない。
'use strict';
const fs=require('fs');
const path=require('path');
const http=require('http');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const DEFAULT_SAMPLE_RATE=16000;

const ffmpegAvailable=()=>{
  try{return spawnSync('ffmpeg',['-version'],{encoding:'utf8'}).status===0;}
  catch{return false;}
};

const decodeWithFfmpeg=(file,sampleRate)=>{
  const out=spawnSync('ffmpeg',['-v','quiet','-i',file,'-ac','1','-ar',String(sampleRate),'-f','f32le','-'],
    {maxBuffer:1024*1024*1024});
  if(out.status!==0)throw new Error('ffmpeg のデコードに失敗しました');
  const buffer=out.stdout;
  const samples=new Float32Array(buffer.buffer,buffer.byteOffset,Math.floor(buffer.length/4));
  return {samples:Float32Array.from(samples),sampleRate,via:'ffmpeg'};
};

// ブラウザから読めるよう、その場だけの静的サーバーを立てる。
// 外へは出さない(127.0.0.1のみ)。ポートは空いているものを自動で取る。
const serveOnce=fileAbs=>new Promise((resolve,reject)=>{
  const server=http.createServer((req,res)=>{
    if(req.url==='/probe.html'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
      res.end('<!doctype html><meta charset="utf-8"><title>decode</title>');
      return;
    }
    if(req.url==='/audio'){
      res.writeHead(200,{'Content-Type':'application/octet-stream'});
      fs.createReadStream(fileAbs).pipe(res);
      return;
    }
    res.writeHead(404);res.end();
  });
  server.on('error',reject);
  server.listen(0,'127.0.0.1',()=>resolve(server));
});

const decodeWithChromium=async(fileAbs,sampleRate)=>{
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{throw new Error('ffmpeg も Playwright も無いのでデコードできません');}}
  const server=await serveOnce(fileAbs);
  const port=server.address().port;
  let browser;
  try{
    const launch={};
    if(fs.existsSync('/opt/pw-browsers/chromium'))launch.executablePath='/opt/pw-browsers/chromium';
    browser=await playwright.chromium.launch(launch);
    const page=await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/probe.html`);
    // PCMはそのままJSONで返すと巨大になるので、16bit整数にしてbase64で渡す。
    // 音の解析に使う範囲では16bitで十分(-90dBまで表せる)。
    const packed=await page.evaluate(async targetRate=>{
      const response=await fetch('/audio');
      const encoded=await response.arrayBuffer();
      const probe=new OfflineAudioContext(1,1,targetRate);
      const decoded=await probe.decodeAudioData(encoded.slice(0));
      const offline=new OfflineAudioContext(1,Math.max(1,Math.ceil(decoded.duration*targetRate)),targetRate);
      const source=offline.createBufferSource();
      source.buffer=decoded;
      source.connect(offline.destination);
      source.start();
      const rendered=await offline.startRendering();
      const data=rendered.getChannelData(0);
      const ints=new Int16Array(data.length);
      for(let i=0;i<data.length;i++){
        const v=Math.max(-1,Math.min(1,data[i]));
        ints[i]=Math.round(v*32767);
      }
      let binary='';
      const bytes=new Uint8Array(ints.buffer);
      const chunk=0x8000;
      for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
      return {base64:btoa(binary),length:ints.length,nativeSampleRate:decoded.sampleRate,channels:decoded.numberOfChannels};
    },sampleRate);
    const bytes=Buffer.from(packed.base64,'base64');
    const ints=new Int16Array(bytes.buffer,bytes.byteOffset,packed.length);
    const samples=new Float32Array(packed.length);
    for(let i=0;i<packed.length;i++)samples[i]=ints[i]/32767;
    return {samples,sampleRate,via:'chromium',nativeSampleRate:packed.nativeSampleRate,channels:packed.channels};
  }finally{
    if(browser)await browser.close();
    server.close();
  }
};

const decodeAudio=async(file,options={})=>{
  const sampleRate=Number(options.sampleRate)||DEFAULT_SAMPLE_RATE;
  const fileAbs=path.isAbsolute(file)?file:path.join(ROOT,file);
  if(!fs.existsSync(fileAbs))throw new Error(`音源が見つかりません: ${file}`);
  const prefer=options.prefer||'auto';
  if(prefer!=='chromium'&&ffmpegAvailable()){
    const result=decodeWithFfmpeg(fileAbs,sampleRate);
    return {...result,durationMs:result.samples.length/sampleRate*1000};
  }
  const result=await decodeWithChromium(fileAbs,sampleRate);
  return {...result,durationMs:result.samples.length/sampleRate*1000};
};

module.exports={decodeAudio,ffmpegAvailable,DEFAULT_SAMPLE_RATE};

if(require.main===module){
  const file=process.argv[2];
  if(!file){console.error('使い方: node tools/mode/rhythm-audio-decode.js <音源ファイル>');process.exit(1);}
  decodeAudio(file,{sampleRate:Number(process.argv[3])||DEFAULT_SAMPLE_RATE}).then(result=>{
    let peak=0,sum=0;
    for(let i=0;i<result.samples.length;i++){const v=Math.abs(result.samples[i]);if(v>peak)peak=v;sum+=v*v;}
    console.log(`デコード: ${result.via} / ${result.sampleRate}Hz モノラル / ${(result.durationMs/1000).toFixed(2)}秒 / ${result.samples.length}サンプル`);
    console.log(`  ピーク ${peak.toFixed(4)} / RMS ${Math.sqrt(sum/result.samples.length).toFixed(4)}`);
  }).catch(e=>{console.error(e.message);process.exit(1);});
}
