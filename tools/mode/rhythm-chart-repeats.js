// 繰り返しの見分け(2026-09-28・MHB CHART ENGINE Rev.18)。
//
// 【なぜ要るか】解析(rhythm-audio-structure-v3.js)の繰り返しは「同じ名札・同じ長さの区切り」しか見ないので、
// 公開中の曲の多くで繰り返しが少なく(only my railgun・風がそよぐ場所・Close To Your Heart は0)、フレーズの写し・発展・ラスサビが効いていなかった。
// ここは解析ファイルの材料だけで、4小節ずつ「前にほぼ同じ4小節があったか」を探す(解析ファイルは作り直さない)。
//
// 【決め方】4つの別々の手がかりのうち NEED 個以上が「同じ」と言うときだけ繰り返しとする。
//   ・メロディ … 音高が取れているグリッドどうしで、半音1つ以内の一致の割合(両方に音高がある所が8グリッド以上のとき)
//   ・リズム   … 打点の強さの並びの似かた(余弦)
//   ・低音     … 打点の強さ×低い帯の割合の並びの似かた
//   ・音の層   … 音の層の解析(<曲>-v3-layers.json)の音程楽器と歌・主旋律の帯の並びの似かた(層の解析が無ければ使わない)
//   しきい値は曲ごとに決める。「半小節ずらした位置」と比べた組(本来は繰り返しではない)の上位 QUANTILE の値。
//   同じ決まりをずらした組に当てはめて通ってしまう割合を、見つけた繰り返しの「間違いの見積もり」(falsePositiveRate)として返す。
// 乱数を使わない。同じ入力なら毎回同じ結果。
'use strict';

const REPEAT_BARS=4,REPEAT_NEED=3,REPEAT_QUANTILE=.99,MELODY_MIN_BOTH=8;
// 1小節ずつの確かめ直し(4小節のまとまりが一致した後で、その小節も似ているか)
const BAR_NEED=2,BAR_QUANTILE=.95,BAR_MELODY_MIN_BOTH=3;

const cosine=(x,y)=>{let d=0,a=0,c=0;for(let i=0;i<x.length;i++){d+=x[i]*y[i];a+=x[i]*x[i];c+=y[i]*y[i];}return a&&c?d/Math.sqrt(a*c):0;};

// audio: 解析ファイル / layers: 音の層の解析(無ければ null)
// 返り値: {sourceByBar: Map(小節→最初の出どころの小節), thresholds, falsePositiveRate}
const detectRepeats=(audio,layers=null,{bars=REPEAT_BARS,need=REPEAT_NEED,quantile=REPEAT_QUANTILE}={})=>{
  const timing=audio.timing,BAR=timing.subdivisionsPerBeat*timing.beatsPerBar,HALF=Math.floor(BAR/2);
  const barCount=Array.isArray(audio.structure&&audio.structure.bars)?audio.structure.bars.length:0;
  const empty={sourceByBar:new Map(),thresholds:null,falsePositiveRate:0};
  if(barCount<bars*2)return empty;
  const semitone=new Map();
  for(const point of audio.pitchCurve||[])if(Number(point.clarity)>=.5&&Number(point.hz)>0)semitone.set(point.grid,Math.round(12*Math.log2(Number(point.hz)/440)));
  const onsetByGrid=new Map();
  for(const onset of audio.onsets||[])if(onset.grid!=null)onsetByGrid.set(onset.grid,onset);
  const layerAt=(key,grid)=>{
    if(!layers||!layers.series||!Array.isArray(layers.series[key]))return 0;
    const i=grid-layers.grid.firstGrid,list=layers.series[key];
    return i>=0&&i<list.length?list[i]:0;
  };
  const width=bars*BAR;
  const spanAt=start=>{
    const s=[],r=[],low=[],h=[];
    for(let g=start;g<start+width;g++){
      s.push(semitone.has(g)?semitone.get(g):null);
      const onset=onsetByGrid.get(g),strength=onset?Number(onset.strength)||0:0;
      r.push(strength);low.push(onset&&onset.share?(Number(onset.share.low)||0)*strength:0);
      if(layers)h.push(layerAt('harmonic',g),layerAt('lead',g));
    }
    return {s,r,low,h};
  };
  const melody=(a,b)=>{let both=0,same=0;for(let k=0;k<a.s.length;k++){if(a.s[k]==null||b.s[k]==null)continue;both++;if(Math.abs(a.s[k]-b.s[k])<=1)same++;}return both>=MELODY_MIN_BOTH?same/both:null;};
  const similarity=(a,b)=>[melody(a,b),cosine(a.r,b.r),cosine(a.low,b.low),layers?cosine(a.h,b.h):null];
  const count=barCount-bars+1;
  const spans=Array.from({length:count},(_,b)=>spanAt(b*BAR));
  const shifted=Array.from({length:count},(_,b)=>spanAt(b*BAR+HALF));
  // しきい値: ずらした組の上位 quantile
  const nullValues=[[],[],[],[]];
  const nullSims=[];
  for(let i=bars;i<count;i++)for(let j=0;j<=i-bars;j++){const v=similarity(spans[i],shifted[j]);nullSims.push(v);v.forEach((x,k)=>{if(x!=null)nullValues[k].push(x);});}
  const thresholds=nullValues.map(list=>{if(list.length<50)return Infinity;const sorted=list.slice().sort((x,y)=>x-y);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*quantile))];});
  const passes=v=>v.filter((x,k)=>x!=null&&x>thresholds[k]).length>=need;
  const falsePositiveRate=nullSims.length?nullSims.filter(passes).length/nullSims.length:0;
  // 1小節ずつの確かめ直し: 4小節のまとまりが一致しても、端の小節は似ていないことがある(まとまり全体の一致に引きずられる)。
  //   小節単位でも同じやり方でしきい値を決め、BAR_NEED 個以上の手がかりが一致する小節だけを採る
  const barSpan=(b)=>{const s=[],r=[],low=[],h=[];const all=spans[Math.min(b,count-1)];const offset=(b-Math.min(b,count-1))*BAR;
    for(let k=offset;k<offset+BAR;k++){s.push(all.s[k]);r.push(all.r[k]);low.push(all.low[k]);if(layers)h.push(all.h[2*k],all.h[2*k+1]);}return {s,r,low,h};};
  const oneBar=Array.from({length:barCount},(_,b)=>barSpan(b));
  const oneBarShifted=Array.from({length:barCount},(_,b)=>{const whole=spanAt(b*BAR+HALF);return {s:whole.s.slice(0,BAR),r:whole.r.slice(0,BAR),low:whole.low.slice(0,BAR),h:whole.h.slice(0,2*BAR)};});
  const barMelody=(a,b)=>{let both=0,same=0;for(let k=0;k<a.s.length;k++){if(a.s[k]==null||b.s[k]==null)continue;both++;if(Math.abs(a.s[k]-b.s[k])<=1)same++;}return both>=BAR_MELODY_MIN_BOTH?same/both:null;};
  const barSimilarity=(a,b)=>[barMelody(a,b),cosine(a.r,b.r),cosine(a.low,b.low),layers?cosine(a.h,b.h):null];
  const barNull=[[],[],[],[]];
  for(let i=1;i<barCount;i++)for(let j=0;j<i;j++)barSimilarity(oneBar[i],oneBarShifted[j]).forEach((x,k)=>{if(x!=null)barNull[k].push(x);});
  const barThresholds=barNull.map(list=>{if(list.length<50)return Infinity;const sorted=list.slice().sort((x,y)=>x-y);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*BAR_QUANTILE))];});
  const barPasses=(i,j)=>barSimilarity(oneBar[i],oneBar[j]).filter((x,k)=>x!=null&&x>barThresholds[k]).length>=BAR_NEED;
  // それぞれの4小節について、前にある4小節のうち、しきい値を越えた分の合計がいちばん大きいもの
  const found=new Map();
  for(let i=bars;i<count;i++){
    let best=-1,from=-1;
    for(let j=0;j<=i-bars;j++){
      const v=similarity(spans[i],spans[j]);
      if(!passes(v))continue;
      const score=v.reduce((sum,x,k)=>sum+(x!=null&&x>thresholds[k]?x-thresholds[k]:0),0);
      if(score>best+1e-12){best=score;from=j;}
    }
    if(from<0)continue;
    for(let k=0;k<bars;k++){const bar=i+k;if(!barPasses(bar,from+k))continue;if(!found.has(bar)||found.get(bar).score<best)found.set(bar,{source:from+k,score:best});}
  }
  // 出どころをたどって、いちばん最初の小節へ
  const root=bar=>{let current=bar;for(let guard=0;guard<64;guard++){const hit=found.get(current);if(!hit||hit.source>=current)break;current=hit.source;}return current;};
  const sourceByBar=new Map();
  for(const bar of [...found.keys()].sort((a,b)=>a-b)){const source=root(bar);if(source<bar)sourceByBar.set(bar,source);}
  return {sourceByBar,thresholds,falsePositiveRate};
};

module.exports={REPEAT_BARS,REPEAT_NEED,REPEAT_QUANTILE,detectRepeats};
