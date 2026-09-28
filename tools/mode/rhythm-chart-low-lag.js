// 低音の打点の遅れ(2026-09-28・MHB CHART ENGINE Rev.17)。
//
// 【なぜ要るか】解析(rhythm-audio-analyze-v3.js)は低音の立ち上がりを長い窓で見るので、キックやベースの打点が
// ほかの音より遅れて記録される(公開中の曲で 5〜30ms)。only my railgun はこれが 52ms(16分のちょうど半分)で、
// 強いキックの多くが格子から外れた音として生成器の候補から落ちていた(docs/spec/RHYTHM_CHART_ENGINE_ROADMAP.md の8章)。
//
// 【測り方】低音の強い一発(低い帯が5割以上の PUNCH / FULL)と、それ以外の音(低い帯が4割未満)の、格子に対する位相の
// 円周平均の差。ほかの音が格子にそろっていて(まとまり OTHER_MIN_R 以上・位相が格子から OTHER_MAX_MS 以内)、
// 低音にもまとまり(LOW_MIN_R 以上)があり、差が MIN_MS 以上のときだけ「遅れ」とみなす。16分の半分に近いときは遅れと読む
// (解析の仕組みで打点が早く記録されることは無い)。
//
// どれだけ差し引くか(0〜1倍)は、プレイヤーの遊んだ記録から学ぶ(rhythm-chart-play-tuning.js の lowLagFactor)。
// 乱数を使わない。同じ入力なら毎回同じ結果。
'use strict';

const LOW_LAG_MIN_MS=20,LOW_LAG_LOW_MIN_R=.15,LOW_LAG_OTHER_MIN_R=.3,LOW_LAG_OTHER_MAX_MS=10;
const isLowHit=onset=>!!onset&&!!onset.share&&Number(onset.share.low)>=.5&&(onset.character==='PUNCH'||onset.character==='FULL');
const isNotLow=onset=>!!onset&&!(onset.share&&Number(onset.share.low)>=.4);

// timing: {beatZeroMs, gridMs}(gridMs が無ければ beatMs / subdivisionsPerBeat)
const lowLagOf=(audio,timing=audio&&audio.timing)=>{
  const gridMs=Number(timing&&timing.gridMs)||Number(timing&&timing.beatMs)/Number(timing&&timing.subdivisionsPerBeat);
  const beatZeroMs=Number(timing&&timing.beatZeroMs)||0;
  const empty={lagMs:0,detectedMs:0,gridMs,low:null,other:null};
  if(!(gridMs>0)||!Array.isArray(audio&&audio.onsets))return empty;
  const circ=list=>{
    let x=0,y=0;
    for(const onset of list){const phase=((onset.timeMs-beatZeroMs)%gridMs+gridMs)%gridMs/gridMs*2*Math.PI;x+=Math.cos(phase);y+=Math.sin(phase);}
    const n=list.length||1;
    return {ms:Math.atan2(y/n,x/n)/(2*Math.PI)*gridMs,r:Math.hypot(x/n,y/n),n:list.length};
  };
  const low=circ(audio.onsets.filter(isLowHit)),other=circ(audio.onsets.filter(isNotLow));
  let lag=low.ms-other.ms;
  lag=((lag%gridMs)+gridMs)%gridMs;
  if(lag>gridMs*.75)lag-=gridMs;
  const usable=low.n>=20&&other.n>=20&&low.r>=LOW_LAG_LOW_MIN_R&&other.r>=LOW_LAG_OTHER_MIN_R&&Math.abs(other.ms)<=LOW_LAG_OTHER_MAX_MS&&Math.abs(lag)>=LOW_LAG_MIN_MS;
  return {lagMs:usable?lag:0,detectedMs:lag,gridMs,low,other};
};

module.exports={LOW_LAG_MIN_MS,LOW_LAG_LOW_MIN_R,LOW_LAG_OTHER_MIN_R,LOW_LAG_OTHER_MAX_MS,isLowHit,isNotLow,lowLagOf};
