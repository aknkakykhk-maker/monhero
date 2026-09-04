#!/usr/bin/env node
// 曲の構造（区切り・盛り上がり・繰り返し）を音だけから出す。
//
//   node tools/mode/rhythm-audio-structure-v3.js monster-hero/audio/bgm-xxx.mp3
//
// 【なぜ要るか】
// V3の生成器は、これまで区切りと盛り上がりを V2 の解析結果
// （<track>-v2-structure.json / -v2-features.json）から取っていた。
// あれらは ffmpeg を使う別系統の道具が作るもので、**新しい曲では作れない**。
// 「全ての曲に対応できるツール」にするには、ここも音だけから出せないといけない。
//
// 【やり方】
// 1. 小節ごとに「どんな音か」をまとめる（5つの帯域の大きさ）
// 2. 小節どうしの似ている度合いを全部の組で測る（自己類似行列）
// 3. 市松模様の型を対角線に沿って滑らせ、**似ていない境目**が山になる曲線を作る（Foote法）
// 4. 山を区切りとして採り、短すぎる区切りはつなぐ
// 5. 区切りごとに、どれと似ているかで A / B / C … の名札を付ける（繰り返しの検出）
// 6. 盛り上がりは、小節ごとの音の大きさの順位で持つ（曲の中での相対）
//
// セクションに「サビ」「Aメロ」といった名前は付けない。曲によって当たり外れが大きく、
// 外した名前を土台にすると譜面まで外れるため。譜面づくりに要るのは
// 「どこで変わるか」「どれくらい盛り上がっているか」「どこが繰り返しか」の3つだけ。
'use strict';
const path=require('path');
const {audioFeatures}=require('./rhythm-audio-features-v3.js');

const KERNEL_BARS=8;            // 市松模様の型の大きさ（前後4小節ずつを見る）
const MIN_SECTION_BARS=4;       // これより短い区切りはつなぐ
const MAX_SECTION_BARS=20;      // これより長い区切りは、中でいちばん切れ目らしいところで割る
const NOVELTY_PEAK_DISTANCE=4;  // 区切りどうしの最小の間隔（小節）
const LABEL_SIMILARITY=.86;     // これ以上似ていれば同じ名札にする

const round=(value,digits=3)=>Math.round(value*10**digits)/10**digits;

const cosine=(a,b)=>{
  let dot=0,na=0,nb=0;
  for(let i=0;i<a.length;i++){dot+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];}
  return dot/Math.sqrt((na||1e-9)*(nb||1e-9));
};

// 小節ごとの「どんな音か」
const barVectors=(features,timing)=>{
  const barMs=timing.beatMs*timing.beatsPerBar;
  const bars=[];
  for(let bar=0;;bar++){
    const startMs=timing.beatZeroMs+bar*barMs;
    const endMs=startMs+barMs;
    if(endMs>features.durationMs)break;
    const from=Math.max(0,features.msToFrame(startMs));
    const to=Math.min(features.frames-1,features.msToFrame(endMs));
    if(to<=from)break;
    const vector=[];
    let total=0;
    for(let b=0;b<features.level.length;b++){
      let sum=0;
      for(let f=from;f<=to;f++)sum+=features.level[b][f];
      const mean=sum/(to-from+1);
      vector.push(Math.log1p(mean));
      total+=mean;
    }
    bars.push({bar,vector,energy:Math.log1p(total/(to-from+1)),startMs,endMs});
  }
  // 帯域ごとに「平均からのずれ」へ直す（平均を引いてばらつきで割る）。
  // 0〜1へそろえるだけだと、どの小節も似た向きのベクトルになり、
  // 似ている度合い（余弦）がほとんど1に張り付いて区切りが出ない（実際そうなった）。
  for(let b=0;b<features.level.length;b++){
    const values=bars.map(entry=>entry.vector[b]);
    const mean=values.reduce((a,c)=>a+c,0)/values.length;
    const deviation=Math.sqrt(values.reduce((a,c)=>a+(c-mean)**2,0)/values.length)||1e-9;
    bars.forEach((entry,i)=>{entry.vector[b]=(values[i]-mean)/deviation;});
  }
  const energies=bars.map(entry=>entry.energy).sort((a,b)=>a-b);
  const rank=value=>{
    let below=0;
    while(below<energies.length&&energies[below]<value)below++;
    return energies.length>1?below/(energies.length-1):0;
  };
  for(const entry of bars)entry.intensity=round(rank(entry.energy));
  return bars;
};

// 似ていない境目を山にする曲線（Foote のノベルティ）
const noveltyCurve=bars=>{
  const n=bars.length;
  const half=Math.min(KERNEL_BARS,Math.floor(n/4))||1;
  const novelty=new Float64Array(n);
  for(let center=0;center<n;center++){
    let same=0,cross=0,sameCount=0,crossCount=0;
    for(let i=-half;i<0;i++){
      for(let j=-half;j<0;j++){
        const a=center+i,b=center+j;
        if(a<0||b<0||a>=n||b>=n)continue;
        same+=cosine(bars[a].vector,bars[b].vector);sameCount++;
      }
    }
    for(let i=0;i<half;i++){
      for(let j=0;j<half;j++){
        const a=center+i,b=center+j;
        if(a<0||b<0||a>=n||b>=n)continue;
        same+=cosine(bars[a].vector,bars[b].vector);sameCount++;
      }
    }
    for(let i=-half;i<0;i++){
      for(let j=0;j<half;j++){
        const a=center+i,b=center+j;
        if(a<0||b<0||a>=n||b>=n)continue;
        cross+=cosine(bars[a].vector,bars[b].vector);crossCount++;
      }
    }
    const inside=sameCount?same/sameCount:0;
    const outside=crossCount?cross/crossCount:0;
    novelty[center]=inside-outside;
  }
  return novelty;
};

const detectStructure=async(file,timing,options={})=>{
  const features=options.features||await audioFeatures(file);
  const bars=barVectors(features,timing);
  if(bars.length<8){
    return {bars,sections:[{startBar:0,endBarExclusive:bars.length,label:'A',
      intensity:round(bars.reduce((s,b)=>s+b.intensity,0)/Math.max(1,bars.length))}],repeats:[],novelty:[]};
  }
  const novelty=noveltyCurve(bars);
  // 山を採る（前後より高く、平均＋ばらつきを超えるもの）
  const mean=novelty.reduce((a,b)=>a+b,0)/novelty.length;
  const deviation=Math.sqrt(novelty.reduce((a,b)=>a+(b-mean)**2,0)/novelty.length);
  const threshold=mean+deviation*.35;
  const boundaries=[0];
  for(let i=1;i<novelty.length-1;i++){
    if(novelty[i]<threshold)continue;
    if(novelty[i]<novelty[i-1]||novelty[i]<novelty[i+1])continue;
    if(i-boundaries[boundaries.length-1]<NOVELTY_PEAK_DISTANCE)continue;
    boundaries.push(i);
  }
  boundaries.push(bars.length);
  // 短すぎる区切りはつなぐ
  const merged=[boundaries[0]];
  for(let i=1;i<boundaries.length-1;i++){
    if(boundaries[i]-merged[merged.length-1]>=MIN_SECTION_BARS)merged.push(boundaries[i]);
  }
  merged.push(bars.length);

  // 長すぎる区切りは、その中でいちばん切れ目らしいところで割る。
  // 1つの区切りが曲の半分を占めると、盛り上がりの目安として使えなくなる。
  const split=[...new Set(merged)].sort((a,b)=>a-b);
  for(let guard=0;guard<12;guard++){
    let changed=false;
    for(let i=0;i<split.length-1;i++){
      const from=split[i],to=split[i+1];
      if(to-from<=MAX_SECTION_BARS)continue;
      let best=-1,bestValue=-Infinity;
      for(let k=from+MIN_SECTION_BARS;k<=to-MIN_SECTION_BARS;k++){
        if(novelty[k]>bestValue){bestValue=novelty[k];best=k;}
      }
      if(best<0)continue;
      split.splice(i+1,0,best);
      changed=true;
      break;
    }
    if(!changed)break;
  }
  merged.length=0;
  merged.push(...split);

  const sections=[];
  for(let i=0;i<merged.length-1;i++){
    const startBar=merged[i],endBarExclusive=merged[i+1];
    if(endBarExclusive<=startBar)continue;
    const slice=bars.slice(startBar,endBarExclusive);
    const vector=slice[0].vector.map((_,b)=>slice.reduce((sum,entry)=>sum+entry.vector[b],0)/slice.length);
    sections.push({startBar,endBarExclusive,vector,
      startMs:Math.round(slice[0].startMs),endMs:Math.round(slice[slice.length-1].endMs),
      bars:endBarExclusive-startBar,
      intensity:round(slice.reduce((sum,entry)=>sum+entry.intensity,0)/slice.length)});
  }
  // 似ている区切りへ同じ名札を付ける（繰り返しの検出）
  const labels=[];
  for(const section of sections){
    let found=null;
    for(const entry of labels){
      if(cosine(section.vector,entry.vector)>=LABEL_SIMILARITY){found=entry;break;}
    }
    if(found){section.label=found.label;section.repeatOf=found.startBar;}
    else{
      const label=String.fromCharCode(65+labels.length);
      section.label=label;
      labels.push({label,vector:section.vector,startBar:section.startBar});
    }
    delete section.vector;
  }
  // 同じ名札で長さも同じ区切りは、譜面の形を使い回せる組にする
  const repeats=[];
  for(let i=0;i<sections.length;i++){
    for(let j=0;j<i;j++){
      if(sections[i].label!==sections[j].label)continue;
      if(sections[i].bars!==sections[j].bars)continue;
      repeats.push({fromBar:sections[j].startBar,toBar:sections[i].startBar,bars:sections[i].bars});
      break;
    }
  }
  return {bars:bars.map(({bar,intensity,startMs,endMs})=>({bar,intensity,startMs:Math.round(startMs),endMs:Math.round(endMs)})),
    sections,repeats,
    novelty:Array.from(novelty).map(value=>round(value)),
    settings:{kernelBars:KERNEL_BARS,minSectionBars:MIN_SECTION_BARS,labelSimilarity:LABEL_SIMILARITY}};
};

module.exports={detectStructure,barVectors,noveltyCurve,KERNEL_BARS,MIN_SECTION_BARS,LABEL_SIMILARITY};

if(require.main===module){
  const {detectTiming}=require('./rhythm-audio-tempo-v3.js');
  const file=process.argv[2];
  if(!file){console.error('使い方: node tools/mode/rhythm-audio-structure-v3.js <音源>');process.exit(1);}
  (async()=>{
    const features=await audioFeatures(file);
    const timing=await detectTiming(file,{features});
    const structure=await detectStructure(file,timing,{features});
    console.log(`${path.basename(file)}  BPM ${timing.bpm.toFixed(2)} / ${timing.beatsPerBar}拍子 / ${structure.bars.length}小節`);
    console.log(`区切り ${structure.sections.length}個:`);
    for(const section of structure.sections){
      const bar='█'.repeat(Math.round(section.intensity*24)).padEnd(24,'·');
      console.log(`  ${section.label} 第${String(section.startBar+1).padStart(3)}〜${String(section.endBarExclusive).padStart(3)}小節 `
        +`(${(section.startMs/1000).toFixed(1)}s〜${(section.endMs/1000).toFixed(1)}s / ${section.bars}小節) 盛り上がり ${bar} ${section.intensity.toFixed(2)}`
        +(section.repeatOf!=null?`  ← 第${section.repeatOf+1}小節の繰り返し`:''));
    }
    if(structure.repeats.length)console.log(`繰り返しの組 ${structure.repeats.length}件`);
  })();
}
