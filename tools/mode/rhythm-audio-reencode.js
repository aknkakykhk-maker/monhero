#!/usr/bin/env node
// 音源を「ゲームに載せる形」へ作り直す。軽くする・切り出す・つなぎ目をならす、の3つ。
//
//   node tools/mode/rhythm-audio-reencode.js --in <元.mp3> --out <先.mp3>
//   node tools/mode/rhythm-audio-reencode.js --in a.mp3 --out b.mp3 --kbps 96
//   node tools/mode/rhythm-audio-reencode.js --in a.mp3 --out short.mp3 --from 61.2 --to 181.5 --fade-out 2
//
// 【なぜ要るか】
// 配ってもらった曲は 5分・180kbps・48kHz で1曲7MBある。スマホで遊ぶゲームに
// そのまま載せると、曲を選ぶたびに7MBを落とすことになる。既存のBGMは96kbps・
// 44.1kHzで作ってあるので、そこへそろえる。
// 音ゲー用にはさらに、曲の「おいしいところ」だけを切り出した短い版を作る。
//
// 【やり方】
// この環境には ffmpeg も lame も無い。そこで
//   ・デコード … Chromium の Web Audio（既存の rhythm-audio-decode.js と同じ手）
//   ・エンコード … lamejs（LAMEのJavaScript移植）
// を使う。どちらも外部コマンドに頼らないので、この箱の中で完結する。
//
// 元の音源には触らない。書き出し先だけを作る。
'use strict';
const fs=require('fs');
const path=require('path');
const http=require('http');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const num=(name,fallback)=>{const value=Number(arg(name,NaN));return Number.isFinite(value)?value:fallback;};

// --- lamejs は「ブラウザ用の1ファイル版」を読む ---
// npm の src 版は素の Node では動かない（内部の依存がグローバル前提で ReferenceError になる）。
// 1ファイル版を専用の入れ物で読むと、その中で完結して動く。
const loadLame=()=>{
  const file=path.join(ROOT,'tools/node_modules/lamejs/lame.min.js');
  if(!fs.existsSync(file))throw new Error('lamejs がありません（tools/ で npm install lamejs）');
  const context={console};
  context.window=context;context.self=context;context.global=context;context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file,'utf8'),context);
  const lame=context.lamejs;
  if(!lame||!lame.Mp3Encoder)throw new Error('lamejs を読み込めませんでした');
  return lame;
};

// --- その場だけの静的サーバー（外へは出さない） ---
const serveOnce=fileAbs=>new Promise((resolve,reject)=>{
  const server=http.createServer((req,res)=>{
    if(req.url==='/probe.html'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
      res.end('<!doctype html><meta charset="utf-8"><title>reencode</title>');
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

// --- デコード（ステレオのまま、好きなサンプリング周波数で） ---
// PCMをまとめてJSONで返すと数十MBの文字列になるので、5秒ずつに分けて受け取る。
const CHUNK_SECONDS=5;
const decodeStereo=async(fileAbs,targetRate)=>{
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{throw new Error('Playwright がありません');}
  const server=await serveOnce(fileAbs);
  const port=server.address().port;
  let browser;
  try{
    const launch={};
    if(fs.existsSync('/opt/pw-browsers/chromium'))launch.executablePath='/opt/pw-browsers/chromium';
    browser=await playwright.chromium.launch(launch);
    const page=await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/probe.html`);
    const info=await page.evaluate(async rate=>{
      const response=await fetch('/audio');
      const encoded=await response.arrayBuffer();
      const probe=new OfflineAudioContext(1,1,rate);
      const decoded=await probe.decodeAudioData(encoded.slice(0));
      const channels=Math.min(2,decoded.numberOfChannels);
      const offline=new OfflineAudioContext(channels,Math.max(1,Math.ceil(decoded.duration*rate)),rate);
      const source=offline.createBufferSource();
      source.buffer=decoded;
      source.connect(offline.destination);
      source.start();
      window.__rendered=await offline.startRendering();
      return {length:window.__rendered.length,channels,
        nativeRate:decoded.sampleRate,nativeChannels:decoded.numberOfChannels};
    },targetRate);
    const channels=[];
    for(let c=0;c<info.channels;c++)channels.push(new Int16Array(info.length));
    const step=Math.round(CHUNK_SECONDS*targetRate);
    for(let from=0;from<info.length;from+=step){
      const to=Math.min(info.length,from+step);
      const packed=await page.evaluate(([start,end])=>{
        const rendered=window.__rendered;
        const out=[];
        for(let c=0;c<rendered.numberOfChannels;c++){
          const data=rendered.getChannelData(c);
          const ints=new Int16Array(end-start);
          for(let i=start;i<end;i++){
            const v=Math.max(-1,Math.min(1,data[i]));
            ints[i-start]=Math.round(v*32767);
          }
          const bytes=new Uint8Array(ints.buffer);
          let binary='';
          const chunk=0x8000;
          for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
          out.push(btoa(binary));
        }
        return out;
      },[from,to]);
      packed.forEach((base64,c)=>{
        const bytes=Buffer.from(base64,'base64');
        const ints=new Int16Array(bytes.buffer,bytes.byteOffset,(to-from));
        channels[c].set(ints,from);
      });
    }
    return {channels,length:info.length,sampleRate:targetRate,
      nativeRate:info.nativeRate,nativeChannels:info.nativeChannels};
  }finally{
    if(browser)await browser.close();
    server.close();
  }
};

// --- 切り出しとフェード ---
// 切り出したところで「ブツッ」と鳴らないよう、頭と尻に必ず短いフェードを掛ける。
const cutAndFade=(channels,length,sampleRate,options)=>{
  const from=Math.max(0,Math.round((options.fromSec||0)*sampleRate));
  const to=Math.min(length,options.toSec!=null?Math.round(options.toSec*sampleRate):length);
  const count=Math.max(0,to-from);
  const fadeIn=Math.min(count,Math.round((options.fadeInSec||0)*sampleRate));
  const fadeOut=Math.min(count,Math.round((options.fadeOutSec||0)*sampleRate));
  const gain=Number.isFinite(options.gain)?options.gain:1;
  const out=channels.map(source=>{
    const cut=new Int16Array(count);
    for(let i=0;i<count;i++){
      let value=source[from+i]*gain;
      if(fadeIn>0&&i<fadeIn)value*=i/fadeIn;
      if(fadeOut>0&&i>=count-fadeOut)value*=(count-i)/fadeOut;
      cut[i]=Math.max(-32768,Math.min(32767,Math.round(value)));
    }
    return cut;
  });
  return {channels:out,length:count};
};

const encodeMp3=(channels,sampleRate,kbps)=>{
  const lame=loadLame();
  const encoder=new lame.Mp3Encoder(channels.length,sampleRate,kbps);
  const block=1152;
  const parts=[];
  for(let i=0;i<channels[0].length;i+=block){
    const left=channels[0].subarray(i,i+block);
    const right=channels.length>1?channels[1].subarray(i,i+block):null;
    const buffer=right?encoder.encodeBuffer(left,right):encoder.encodeBuffer(left);
    if(buffer.length)parts.push(Buffer.from(buffer));
  }
  const rest=encoder.flush();
  if(rest.length)parts.push(Buffer.from(rest));
  return Buffer.concat(parts);
};

const reencode=async options=>{
  const inputAbs=path.isAbsolute(options.input)?options.input:path.join(ROOT,options.input);
  if(!fs.existsSync(inputAbs))throw new Error(`音源が見つかりません: ${options.input}`);
  const rate=options.sampleRate||44100;
  const decoded=await decodeStereo(inputAbs,rate);
  let channels=decoded.channels;
  if(options.mono&&channels.length>1){
    const mixed=new Int16Array(decoded.length);
    for(let i=0;i<decoded.length;i++)mixed[i]=Math.round((channels[0][i]+channels[1][i])/2);
    channels=[mixed];
  }
  const cut=cutAndFade(channels,decoded.length,rate,options);
  const mp3=encodeMp3(cut.channels,rate,options.kbps||96);
  const outputAbs=path.isAbsolute(options.output)?options.output:path.join(ROOT,options.output);
  fs.mkdirSync(path.dirname(outputAbs),{recursive:true});
  fs.writeFileSync(outputAbs,mp3);
  return {bytes:mp3.length,durationMs:cut.length/rate*1000,
    sampleRate:rate,channels:cut.channels.length,kbps:options.kbps||96,
    sourceBytes:fs.statSync(inputAbs).size,
    nativeRate:decoded.nativeRate,nativeChannels:decoded.nativeChannels};
};

module.exports={reencode,decodeStereo,encodeMp3,cutAndFade};

if(require.main===module){
  const input=arg('--in');
  const output=arg('--out');
  if(!input||!output){
    console.error('使い方: node tools/mode/rhythm-audio-reencode.js --in <元.mp3> --out <先.mp3> [--kbps 96] [--rate 44100] [--mono] [--from 秒] [--to 秒] [--fade-in 秒] [--fade-out 秒] [--gain 倍率]');
    process.exit(1);
  }
  reencode({
    input,output,
    kbps:num('--kbps',96),
    sampleRate:num('--rate',44100),
    mono:process.argv.includes('--mono'),
    fromSec:num('--from',0),
    toSec:Number.isFinite(Number(arg('--to',NaN)))?Number(arg('--to')):null,
    fadeInSec:num('--fade-in',.03),
    fadeOutSec:num('--fade-out',.05),
    gain:num('--gain',1),
  }).then(result=>{
    console.log(`書き出し: ${output}`);
    console.log(`  ${(result.sourceBytes/1048576).toFixed(2)}MB → ${(result.bytes/1048576).toFixed(2)}MB`
      +` (${Math.round(result.bytes/result.sourceBytes*100)}%)`);
    console.log(`  ${(result.durationMs/1000).toFixed(1)}秒 / ${result.kbps}kbps / ${result.sampleRate}Hz / ${result.channels===1?'モノラル':'ステレオ'}`
      +`  （元は ${result.nativeRate}Hz / ${result.nativeChannels}ch）`);
  }).catch(e=>{console.error(e.stack||e.message);process.exit(1);});
}
