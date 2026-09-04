#!/usr/bin/env node
// 譜面制作で使う信号処理の道具箱。外部ライブラリを使わず、結果が毎回同じになるように書く。
//
//   fft / 窓関数 / スペクトログラム / 帯域ごとのスペクトルフラックス /
//   ピーク検出 / FFTを使った自己相関(音高推定)
//
// 音ゲーの譜面は「どの音を叩かせるか」で決まる。どの音かを知るには、
// 「いつ」だけでなく「どんな音か(低いか高いか・鋭いか伸びるか・音程があるか)」が要る。
// ここはその土台。譜面の作り方そのものは持たない。
'use strict';

// --- FFT（基数2・その場で計算する。長さは2のべき乗） ---
const fft=(re,im)=>{
  const n=re.length;
  for(let i=1,j=0;i<n;i++){
    let bit=n>>1;
    for(;j&bit;bit>>=1)j^=bit;
    j^=bit;
    if(i<j){const tr=re[i];re[i]=re[j];re[j]=tr;const ti=im[i];im[i]=im[j];im[j]=ti;}
  }
  for(let len=2;len<=n;len<<=1){
    const ang=-2*Math.PI/len;
    const wr=Math.cos(ang),wi=Math.sin(ang);
    for(let i=0;i<n;i+=len){
      let cr=1,ci=0;
      for(let k=0;k<len/2;k++){
        const ur=re[i+k],ui=im[i+k];
        const vr=re[i+k+len/2]*cr-im[i+k+len/2]*ci;
        const vi=re[i+k+len/2]*ci+im[i+k+len/2]*cr;
        re[i+k]=ur+vr;im[i+k]=ui+vi;
        re[i+k+len/2]=ur-vr;im[i+k+len/2]=ui-vi;
        const ncr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=ncr;
      }
    }
  }
};

const hann=size=>{
  const window=new Float32Array(size);
  for(let i=0;i<size;i++)window[i]=.5-.5*Math.cos(2*Math.PI*i/size);
  return window;
};

// --- スペクトログラム（振幅） ---
// samples: Float32Array / fftSize: 2のべき乗 / hopSize: フレーム間隔
const spectrogram=(samples,fftSize,hopSize)=>{
  const window=hann(fftSize);
  const frames=Math.max(0,Math.floor((samples.length-fftSize)/hopSize)+1);
  const bins=fftSize/2;
  const magnitudes=new Float32Array(frames*bins);
  const re=new Float64Array(fftSize),im=new Float64Array(fftSize);
  for(let f=0;f<frames;f++){
    const start=f*hopSize;
    for(let i=0;i<fftSize;i++){re[i]=samples[start+i]*window[i];im[i]=0;}
    fft(re,im);
    for(let b=0;b<bins;b++)magnitudes[f*bins+b]=Math.hypot(re[b],im[b]);
  }
  return {magnitudes,frames,bins,fftSize,hopSize};
};

// --- 帯域ごとのスペクトルフラックス（増えたぶんだけ足す＝音の立ち上がり） ---
// bands: [{id, fromHz, toHz}] / sampleRate
const bandFlux=(spec,sampleRate,bands)=>{
  const {magnitudes,frames,bins,fftSize}=spec;
  const hzPerBin=sampleRate/fftSize;
  const ranges=bands.map(band=>({
    id:band.id,
    from:Math.max(1,Math.floor(band.fromHz/hzPerBin)),
    to:Math.min(bins-1,Math.ceil(band.toHz/hzPerBin)),
  }));
  const flux=ranges.map(()=>new Float32Array(frames));
  const level=ranges.map(()=>new Float32Array(frames));
  for(let f=0;f<frames;f++){
    for(let r=0;r<ranges.length;r++){
      const {from,to}=ranges[r];
      let rise=0,sum=0;
      for(let b=from;b<=to;b++){
        const now=magnitudes[f*bins+b];
        const prev=f>0?magnitudes[(f-1)*bins+b]:0;
        const diff=now-prev;
        if(diff>0)rise+=diff;
        sum+=now;
      }
      flux[r][f]=rise;
      level[r][f]=sum;
    }
  }
  return {ids:ranges.map(r=>r.id),flux,level,frames};
};

// --- 0〜1へ正規化（上位 quantile を1とする。単発の外れ値に引っぱられないため） ---
const normalize=(values,quantile=.98)=>{
  const sorted=Array.from(values).filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);
  if(!sorted.length)return new Float32Array(values.length);
  const top=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*quantile))]||1;
  const out=new Float32Array(values.length);
  for(let i=0;i<values.length;i++)out[i]=Math.max(0,Math.min(1,values[i]/(top||1)));
  return out;
};

// --- 移動中央値（適応しきい値に使う） ---
const movingMedian=(values,radius)=>{
  const out=new Float32Array(values.length);
  const buffer=[];
  for(let i=0;i<values.length;i++){
    const from=Math.max(0,i-radius),to=Math.min(values.length-1,i+radius);
    buffer.length=0;
    for(let k=from;k<=to;k++)buffer.push(values[k]);
    buffer.sort((a,b)=>a-b);
    out[i]=buffer[buffer.length>>1];
  }
  return out;
};

// --- ピーク検出（適応しきい値＋最小間隔） ---
const pickPeaks=(values,{medianRadius=24,delta=.08,minGap=5,multiplier=1.35}={})=>{
  const median=movingMedian(values,medianRadius);
  const peaks=[];
  let last=-Infinity;
  for(let i=1;i<values.length-1;i++){
    const threshold=median[i]*multiplier+delta;
    if(values[i]<threshold)continue;
    if(values[i]<values[i-1]||values[i]<values[i+1])continue;
    if(i-last<minGap){
      // 直前のピークより強ければ置き換える
      if(peaks.length&&values[i]>values[peaks[peaks.length-1]]){peaks[peaks.length-1]=i;last=i;}
      continue;
    }
    peaks.push(i);last=i;
  }
  return peaks;
};

// --- FFTを使った自己相関（音高推定） ---
// 窓ぶんの波形から、いちばんそれらしい周期を返す。clarity は 0〜1 のはっきり具合。
const estimatePitch=(samples,start,size,sampleRate,{minHz=60,maxHz=1100}={})=>{
  const n=size*2;   // 円状のたたみ込みを避けるため2倍へ0詰め
  const re=new Float64Array(n),im=new Float64Array(n);
  const window=hann(size);
  let mean=0;
  for(let i=0;i<size;i++)mean+=samples[start+i]||0;
  mean/=size;
  let energy=0;
  for(let i=0;i<size;i++){
    const v=((samples[start+i]||0)-mean)*window[i];
    re[i]=v;energy+=v*v;
  }
  if(energy<1e-9)return {hz:0,clarity:0,level:0};
  fft(re,im);
  for(let i=0;i<n;i++){const p=re[i]*re[i]+im[i]*im[i];re[i]=p;im[i]=0;}
  fft(re,im);                       // パワースペクトルの逆変換＝自己相関(スケール違い)
  const auto=re;                    // auto[0] が最大
  const minLag=Math.max(2,Math.floor(sampleRate/maxHz));
  const maxLag=Math.min(size-1,Math.ceil(sampleRate/minHz));
  let bestLag=-1,bestValue=0;
  for(let lag=minLag;lag<=maxLag;lag++){
    if(auto[lag]>bestValue&&auto[lag]>auto[lag-1]&&auto[lag]>=auto[lag+1]){bestValue=auto[lag];bestLag=lag;}
  }
  if(bestLag<0)return {hz:0,clarity:0,level:Math.sqrt(energy/size)};
  // 放物線で山の頂点を補間する（半音の精度を出すため）
  const y0=auto[bestLag-1],y1=auto[bestLag],y2=auto[bestLag+1];
  const denominator=y0-2*y1+y2;
  const shift=denominator!==0?.5*(y0-y2)/denominator:0;
  const lag=bestLag+Math.max(-1,Math.min(1,shift));
  const clarity=Math.max(0,Math.min(1,bestValue/(auto[0]||1)));
  return {hz:sampleRate/lag,clarity,level:Math.sqrt(energy/size)};
};

// --- 帯域通過フィルタ（RBJ biquad。音高を取る前に、メロディの帯だけ残すのに使う） ---
// 位相は変わるが、自己相関で周期を見るだけなので影響しない。
const biquadBandpass=(samples,sampleRate,centerHz,q)=>{
  const w0=2*Math.PI*centerHz/sampleRate;
  const alpha=Math.sin(w0)/(2*q);
  const b0=alpha,b1=0,b2=-alpha;
  const a0=1+alpha,a1=-2*Math.cos(w0),a2=1-alpha;
  const out=new Float32Array(samples.length);
  let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<samples.length;i++){
    const x0=samples[i];
    const y0=(b0*x0+b1*x1+b2*x2-a1*y1-a2*y2)/a0;
    out[i]=y0;
    x2=x1;x1=x0;y2=y1;y1=y0;
  }
  return out;
};

// --- その帯域自身の直近と比べた立ち上がり（コントラスト） ---
// 密なミックスでは、高域はずっと鳴っている。絶対値で見ると「いつも鳴っている」で終わるので、
// 「その帯域の直近の中央値と比べて、いま何倍か」で見る。これで
// 「低域だけが跳ねた＝キック」「高域だけが跳ねた＝ハイハット」を分けられる。
const localContrast=(values,radius)=>{
  const median=movingMedian(values,radius);
  const out=new Float32Array(values.length);
  let floor=0;
  {
    const sorted=Array.from(values).sort((a,b)=>a-b);
    floor=sorted[Math.floor(sorted.length*.25)]||1e-6;
  }
  for(let i=0;i<values.length;i++)out[i]=values[i]/Math.max(median[i],floor,1e-9);
  return out;
};

module.exports={fft,hann,spectrogram,bandFlux,normalize,movingMedian,pickPeaks,estimatePitch,
  biquadBandpass,localContrast};
