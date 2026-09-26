#!/usr/bin/env node
// テンポ・拍子の「二つ目の意見」(2026-09-26・MHB CHART ENGINE 強化の残り「テンポの自動確定」)。
//
//   node tools/mode/rhythm-audio-meter-opinion.js            # 一覧にある曲を全部見て、疑わしい曲を出す(読むだけ)
//
// 【なぜ要るか】
// 自動判定を人が直した曲のうち、本当に外していた3曲(crossing_field / freedom_dive / pandora_boss_beat)は、どれも
// 正しいテンポのちょうど 3/4 で判定していた。うち2曲は4拍子を3拍子と取り違えていた(16分4つの並びを付点8分3つの並びと読む)。
// どちらの読み方でも1小節の長さは同じ(約135 BPM の3拍 ＝ 約180 BPM の4拍)なので、テンポ候補の点数だけでは見分けられない
// (公開中の toriko も候補の点数の並びが crossing_field とほぼ同じ)。
// 違うのは「小節の中のどこで強い打点が鳴るか」。3拍子なら小節を3等分した位置、4拍子なら4等分した位置にキックやスネアが来る。
//
// 【決め方】自動判定が3拍子のときだけ見る(外していた形)。強い打点(低音 PUNCH と大きな一発 FULL)の強さが、
// 自動判定の16分で12個ぶんの小節の 4等分の位置(0,3,6,9)と 3等分の位置(0,4,8)のどちらに多いかを比べる。
//   4等分 ÷ 3等分 が METER_DOUBT_CRITICAL 以上 … 止める警告(人が確かめるまで公開しない)
//   METER_DOUBT_NOTICE 以上                        … 軽い注意
// どちらも「4/3倍のテンポ・4拍子」を代わりの候補として示す。**自動では書き換えない**
// (正解の分かっている例が少なく、書き換えると正しく判定できていた曲を壊すおそれがある)。
// 実測: crossing_field 2.1 / freedom_dive 1.55(どちらも本当は4拍子)。toriko 1.35 / six_eternel_remix 1.21。
//       six_eternel_beat は 2.19(3拍子のまま公開中。聞いて確かめたい)
'use strict';
const fs=require('fs'),path=require('path');

const METER_DOUBT_NOTICE=1.5,METER_DOUBT_CRITICAL=1.8;

// detected: 自動判定({bpm, beatZeroMs, beatsPerBar}) / onsets: 解析の打点({timeMs, strength, character})
const meterOpinion=(detected,onsets)=>{
  if(!detected||Number(detected.beatsPerBar)!==3||!(Number(detected.bpm)>0))return null;
  const grid=60000/Number(detected.bpm)/4,bar=12;
  const sum=new Array(bar).fill(0);
  for(const onset of onsets||[]){
    if(!(onset.character==='PUNCH'||onset.character==='FULL'))continue;
    const g=Math.round((Number(onset.timeMs)-Number(detected.beatZeroMs||0))/grid);
    sum[((g%bar)+bar)%bar]+=Number(onset.strength)||0;
  }
  const total=sum.reduce((a,b)=>a+b,0);
  if(!(total>0))return null;
  const share=ks=>ks.reduce((a,k)=>a+sum[k],0)/total;
  const four=share([0,3,6,9]),three=share([0,4,8]);
  const ratio=three>0?four/three:Infinity;
  return {four:Math.round(four*100)/100,three:Math.round(three*100)/100,ratio:Math.round(ratio*100)/100,
    level:ratio>=METER_DOUBT_CRITICAL?'critical':ratio>=METER_DOUBT_NOTICE?'notice':null,
    suggestion:{bpm:Math.round(Number(detected.bpm)*4/3*100)/100,beatsPerBar:4}};
};

module.exports={METER_DOUBT_NOTICE,METER_DOUBT_CRITICAL,meterOpinion};

if(require.main===module){
  const ROOT=path.resolve(__dirname,'..','..'),dir=path.join(ROOT,'tools/mode/authoring');
  const registry=JSON.parse(fs.readFileSync(path.join(dir,'rhythm-song-registry.json'),'utf8'));
  for(const id of Object.keys(registry.songs||{})){
    const file=path.join(dir,`${id.replace(/_/g,'-')}-v3-audio.json`);
    if(!fs.existsSync(file))continue;
    const audio=JSON.parse(fs.readFileSync(file,'utf8'));
    const opinion=meterOpinion(audio.timing.detected,audio.onsets);
    if(!opinion)continue;
    const final=`${audio.timing.bpm.toFixed(2)} BPM・${audio.timing.beatsPerBar}拍子(${audio.timing.source})`;
    console.log(`${id.padEnd(28)} 自動判定は3拍子  4等分÷3等分 ${opinion.ratio}${opinion.level?`  → ${opinion.level==='critical'?'疑わしい':'やや疑わしい'}（代わりの候補 ${opinion.suggestion.bpm} BPM・4拍子）`:''}  いま使っている値 ${final}`);
  }
}
