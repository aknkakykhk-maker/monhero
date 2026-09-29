#!/usr/bin/env node
// 曲の終わりの余韻(2026-09-29・MHB CHART ENGINE Rev.22・ユーザー指摘「ビッグブリッヂで音がなくなろうとしてる終盤が結構長くて
// そこでノーツが続いてるのが違和感」・ユーザー判断「4曲すべてでやって」)。
//
//   node tools/mode/rhythm-chart-ending.js            # 一覧の曲を全部見て、余韻で締める曲と最後の一発を出す(読むだけ)
//
// 【なぜ要るか】
// 生成器は「薄い所でも間延びしないよう、1秒あたりのノーツを一定以上置く」下限を持ち、小節ごとの取り分は打点の数で配る。
// 曲の最後の一発のあと、鳴り残る音が消えていく数秒にも弱い打点(残響)が拾われるので、音がほとんど無い所でノーツが続いていた
// (ビッグブリッヂの死闘: 最後の一発 142.1秒のあと、147.0秒まで HARD で12個)。
//
// 【決め方】音源解析(*-v3-audio.json)は読むだけ。
//   1. 余韻: 曲の終わりから2秒ずつさかのぼり、打点の強さの中央値が曲全体の中央値の 1/3 を下回ったまま終わる区間(2秒以上)。
//      一覧に "shortFadeEnding": true を書いた曲(余韻を音源ごと短くした曲)は 0.5秒以上でよく、強い一発の線も 0.45 に下げる。
//      ビッグブリッヂの死闘は、ユーザー指示「曲自体短くしたほうがいい」で余韻を 142.6〜144.6秒のフェードに縮めた(残り0.6秒)。
//      音源を作り直すと強さの目盛りも少し動き、最後の一発(142.13秒)が 0.55→0.49 になった。
//      印の無い曲まで 0.5秒に下げると、ふつうに終わる曲(Monster Hero など7曲)まで当たってしまうので、印を付けた曲だけにする
//   2. 最後の一発: 余韻の始まりの8秒前〜2秒後にある、強い打点(強さ 0.5 と曲の上位4割の大きいほう以上)のうち最後のもの
//   3. 最後の一発から余韻の始まりまでが ENDING_MAX_GAP_MS 以内のときだけ使う(離れていれば、その間はまだ曲が鳴っている)。
//      譜面の終わり(一覧の playEndMs)が余韻より前の曲も使わない
//   4. 長押しの終わり: 最後の一発のあと、曲の中央値の半分以上の強さの音が鳴っている最後の時刻。1.5〜3秒に収め、曲の終わりの0.3秒前までにする
// 生成器は、最後の一発より後のノーツを置かず、最後の一発のノーツを太い長押しにして締める。
'use strict';
const fs=require('fs'),path=require('path');

const ENDING_REVISION=22;
const ENDING_WINDOW_MS=2000,ENDING_MIN_TAIL_MS=2000,ENDING_SHORT_TAIL_MS=500,ENDING_LOOKBACK_MS=8000,ENDING_MAX_GAP_MS=3000;
const ENDING_HOLD_MIN_MS=1500,ENDING_HOLD_MAX_MS=3000,ENDING_HOLD_END_MARGIN_MS=300;

const median=list=>{const sorted=[...list].sort((a,b)=>a-b);return sorted.length?sorted[sorted.length>>1]:0;};

const fadingEnding=(audio,{chartEndMs=Infinity,shortFade=false}={})=>{
  const none=reason=>({active:false,reason});
  const onsets=Array.isArray(audio&&audio.onsets)?audio.onsets:[];
  const durationMs=Number(audio&&audio.durationMs);
  if(!onsets.length||!(durationMs>0))return none('解析が無い');
  const strengths=onsets.map(onset=>Number(onset.strength)||0);
  const songMedian=median(strengths);
  let tailFromMs=null;
  for(let at=Math.floor(durationMs/ENDING_WINDOW_MS)*ENDING_WINDOW_MS;at>=0;at-=ENDING_WINDOW_MS){
    const inWindow=onsets.filter(onset=>onset.timeMs>=at&&onset.timeMs<at+ENDING_WINDOW_MS).map(onset=>Number(onset.strength)||0);
    if(median(inWindow)<songMedian/3)tailFromMs=at;else break;
  }
  if(tailFromMs===null||durationMs-tailFromMs<(shortFade?ENDING_SHORT_TAIL_MS:ENDING_MIN_TAIL_MS))return none('音が消えていく終わりが無い');
  if(chartEndMs<tailFromMs)return none('譜面の終わりが余韻より前');
  const sorted=[...strengths].sort((a,b)=>a-b);
  const strongMin=Math.max(shortFade?.45:.5,sorted[Math.floor(sorted.length*.6)]);
  const hits=onsets.filter(onset=>onset.strength>=strongMin&&onset.timeMs>=tailFromMs-ENDING_LOOKBACK_MS&&onset.timeMs<tailFromMs+ENDING_WINDOW_MS);
  const last=hits[hits.length-1];
  if(!last)return none('余韻の前に強い一発が無い');
  if(tailFromMs-last.timeMs>ENDING_MAX_GAP_MS)return none(`最後の一発(${(last.timeMs/1000).toFixed(1)}秒)から余韻までが長い(まだ曲が鳴っている)`);
  const audible=onsets.filter(onset=>onset.timeMs>last.timeMs&&onset.strength>=songMedian/2);
  const lastAudibleMs=audible.length?audible[audible.length-1].timeMs:last.timeMs;
  const holdEndMs=Math.min(durationMs-ENDING_HOLD_END_MARGIN_MS,last.timeMs+ENDING_HOLD_MAX_MS,Math.max(last.timeMs+ENDING_HOLD_MIN_MS,lastAudibleMs));
  return {active:true,lastHitMs:last.timeMs,holdEndMs,tailFromMs,
    reason:`最後の一発 ${(last.timeMs/1000).toFixed(2)}秒・余韻 ${(tailFromMs/1000).toFixed(0)}〜${(durationMs/1000).toFixed(1)}秒・長押しの終わり ${(holdEndMs/1000).toFixed(2)}秒`};
};

module.exports={ENDING_REVISION,fadingEnding};

if(require.main===module){
  const dir=path.join(__dirname,'authoring');
  const registry=JSON.parse(fs.readFileSync(path.join(dir,'rhythm-song-registry.json'),'utf8')).songs;
  for(const [trackId,entry] of Object.entries(registry)){
    const file=path.join(dir,`${trackId.replace(/_/g,'-')}-v3-audio.json`);
    if(!fs.existsSync(file))continue;
    const ending=fadingEnding(JSON.parse(fs.readFileSync(file,'utf8')),{chartEndMs:Number(entry.playEndMs)||Infinity,shortFade:entry.shortFadeEnding===true});
    console.log(`${ending.active?'◎':'・'} ${trackId.padEnd(28)} ${ending.reason}`);
  }
}
