#!/usr/bin/env node
// 16分の曲に3連符が混ざっていないかを見る(2026-09-29・MHB CHART ENGINE 強化「16分と3連符が混ざる曲」)。
//
//   node tools/mode/rhythm-audio-triplet-mix.js            # 解析済みの曲を全部見て、数字を並べる(読むだけ)
//
// 【なぜ要るか】
// 譜面は拍を4つに割った格子(16分)の上に作る。3連符(拍を3つに割った位置)の音は、いちばん近い16分へ丸められ、
// 拍の1/12(180 BPM で約28ms)ずれる。フィルやサビだけ3連になる曲だと、その小節のノーツが音とずれて聞こえる。
// 曲全体が3連なら解析(rhythm-audio-tempo-v3.js)が拍を3つか6つに割るので、困るのは「混ざる」曲だけ。
//
// 【いまの曲では何もしない理由】
// 解析済みの全曲で、3連の位置に乗る打点の割合を、同じ幅だけずらした位置(偶然そこに乗る割合)と比べると、
// 多い曲でも1.8倍、3連が集まる小節は1曲に6小節ほどだった(偶然と見分けがつかない)。3連の位置へ寄せる生成を
// 作っても良くなる曲が無いので作らない。そのかわり、次に3連が混ざる曲を解析したとき、黙って16分へ丸めないように
// 注意(triplet-mixed)を出す。止めはしない(譜面は作れる。ずれが気になるかは聞いて確かめる)。
//
// 【決め方】強さ TRIPLET_MIN_STRENGTH 以上の打点を拍の中の位置で見る。
//   ・曲全体: 3連の位置(1/3・2/3)の±TOLERANCE_MS に乗り、16分の格子から12ms以上離れた打点の割合 ÷ 偶然の割合 ≧ TRIPLET_RATIO
//   ・小節ごと: 3連の位置に乗る打点が3つ以上で、16分の裏(1/4・3/4)の打点と同じか多い小節が、全体の TRIPLET_BAR_SHARE 以上かつ TRIPLET_BARS 小節以上
// 両方を満たしたときだけ注意を出す。
'use strict';
const fs=require('fs'),path=require('path');

const TRIPLET_MIN_STRENGTH=.15,TOLERANCE_MS=6,SIXTEENTH_CLEAR_MS=12;
const TRIPLET_RATIO=2.5,TRIPLET_BAR_SHARE=.08,TRIPLET_BARS=6;

// timing: {beatMs, beatZeroMs, beatsPerBar, subdivisionsPerBeat} / onsets: 解析の打点({timeMs, strength})
const tripletMix=(timing,onsets)=>{
  const beatMs=Number(timing&&timing.beatMs);
  if(!(beatMs>0)||Number(timing.subdivisionsPerBeat)%3===0)return null; // 拍を3つか6つに割った曲は3連が格子に乗っている
  const beatZeroMs=Number(timing.beatZeroMs)||0,beatsPerBar=Number(timing.beatsPerBar)||4;
  const phases=[];
  for(const onset of onsets||[]){
    if(!(Number(onset.strength)>=TRIPLET_MIN_STRENGTH))continue;
    const beats=(Number(onset.timeMs)-beatZeroMs)/beatMs;
    if(!Number.isFinite(beats))continue;
    phases.push({bar:Math.floor(beats/beatsPerBar),phase:((beats%1)+1)%1});
  }
  if(phases.length<50)return null;
  const distance=(phase,points)=>Math.min(...points.map(point=>Math.abs(phase-point)))*beatMs;
  const SIXTEENTHS=[0,.25,.5,.75,1];
  const shareNear=center=>phases.filter(({phase})=>distance(phase,[center,1-center])<=TOLERANCE_MS
    &&distance(phase,SIXTEENTHS)>SIXTEENTH_CLEAR_MS).length/phases.length;
  const triplet=shareNear(1/3);
  // 偶然の割合: 3連の位置を少しずらした所と、16分と32分の間の所(どれも16分の格子から離れている)
  const chance=Math.max(1e-3,(shareNear(1/3-.04)+shareNear(1/3+.04)+shareNear(1/8+.02))/3);
  const bars=new Map();
  for(const {bar,phase} of phases){
    const entry=bars.get(bar)||{triplet:0,sixteenth:0};
    const toTriplet=distance(phase,[1/3,2/3]),toOffbeat=distance(phase,[.25,.75]);
    if(toTriplet<=TOLERANCE_MS+1&&toTriplet<toOffbeat)entry.triplet++;
    else if(toOffbeat<=TOLERANCE_MS+1)entry.sixteenth++;
    bars.set(bar,entry);
  }
  const tripletBars=[...bars].filter(([,entry])=>entry.triplet>=3&&entry.triplet>=entry.sixteenth).map(([bar])=>bar).sort((a,b)=>a-b);
  const ratio=Math.round(triplet/chance*100)/100,barShare=Math.round(tripletBars.length/Math.max(1,bars.size)*1000)/1000;
  const mixed=ratio>=TRIPLET_RATIO&&barShare>=TRIPLET_BAR_SHARE&&tripletBars.length>=TRIPLET_BARS;
  return {mixed,ratio,barShare,tripletBars,barCount:bars.size};
};

module.exports={tripletMix,TRIPLET_RATIO,TRIPLET_BAR_SHARE,TRIPLET_BARS};

if(require.main===module){
  const dir=path.join(__dirname,'authoring');
  const rows=[];
  for(const file of fs.readdirSync(dir).filter(name=>/-v3-audio\.json$/.test(name))){
    const audio=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
    const result=tripletMix(audio.timing,audio.onsets);
    if(result)rows.push([file.replace('-v3-audio.json',''),result]);
  }
  rows.sort((a,b)=>b[1].ratio-a[1].ratio);
  console.log(`3連の位置の打点 ÷ 偶然の割合(${TRIPLET_RATIO}以上) / 3連が集まる小節(${TRIPLET_BAR_SHARE*100}%・${TRIPLET_BARS}小節以上)`);
  for(const [id,result] of rows)console.log(`${result.mixed?'!':' '} ${id.padEnd(32)} ${result.ratio.toFixed(2).padStart(5)}  ${String(result.tripletBars.length).padStart(3)}/${result.barCount}`);
}
