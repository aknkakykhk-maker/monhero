#!/usr/bin/env node
// サビを見つける(2026-11-11・MHB CHART ENGINE Rev.38)。
//
//   node tools/mode/rhythm-chart-chorus.js --track <曲>     # 区切りごとの「サビらしさ」の点数と内訳
//   node tools/mode/rhythm-chart-chorus.js --all            # 曲の一覧の全曲を1行ずつ(読むだけ)
//
// 【なぜ要るか】それまでの「盛り上がる区切り」(climax)は音の大きさの順位だけで決めていた(上位3割・0.5以上)。
// 大きいだけの間奏・つなぎもサビ扱いになり、見せ場(開く形・端振り・両手スライド)が散っていた。
// ここは解析ファイル(*-v3-audio.json)と音の層の解析(*-v3-layers.json)を読むだけで、区切りごとに点数を出す。
// 解析ファイルは作り直さない・書かない。「サビ」「Aメロ」の名札は付けない(外すと譜面まで外れる)。点数だけ。
//
// 【点数(0〜1)】5つの手がかりの重み付きの和。
//   energy   … 盛り上がり(その曲の山に対する比)
//   repeat   … 繰り返し(同じ名札の区切りが何回あるか / 小節単位の繰り返しの見分けで前後とつながる小節の割合。大きい方)
//   lead     … 歌・主旋律の帯の強さ(音の層の lead の平均。曲の中でいちばん強い区切りに対する比)。層の解析が無ければ音高のはっきりさ
//   rise     … 前の区切りからの上がり幅(サビは入りで一段上がる)
//   position … 曲の中の位置(曲の頭・最初の区切りはサビではない)
// サビとするのは、点数がその曲の最高点の CHORUS_RATIO 倍以上・CHORUS_MIN 以上で、4小節以上あり、盛り上がりが山の半分以上の区切り。
// どれも当たらない曲は「サビなし」を返す(生成器は今までの決め方へ戻る)。
// 乱数を使わない。同じ入力なら毎回同じ結果。
'use strict';
const fs=require('fs'),path=require('path');
const {detectRepeats}=require('./rhythm-chart-repeats.js');

const WEIGHTS=Object.freeze({energy:.4,repeat:.2,lead:.15,rise:.15,position:.1});
const CHORUS_RATIO=.85,CHORUS_MIN=.55,CHORUS_MIN_BARS=4,CHORUS_MIN_ENERGY=.5;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const round=(x,k=3)=>Math.round(x*10**k)/10**k;

// audio: 解析ファイル / layers: 音の層の解析(無ければ null)
// 返り値: {sections:[{index,startBar,endBarExclusive,startMs,endMs,label,score,parts,chorus}], chorus:[区切り…], maxScore, hasChorus}
const chorusScores=(audio,layers=null)=>{
  const list=((audio&&audio.structure&&audio.structure.sections)||[]).slice().sort((a,b)=>a.startBar-b.startBar);
  const empty={sections:[],chorus:[],maxScore:0,hasChorus:false};
  if(list.length<2)return empty;
  const timing=audio.timing,BAR=timing.subdivisionsPerBeat*timing.beatsPerBar;
  const firstBar=list[0].startBar,lastBar=list[list.length-1].endBarExclusive,span=Math.max(1,lastBar-firstBar);
  const maxI=Math.max(.001,...list.map(s=>Number(s.intensity)||0));
  // 繰り返し(小節単位): 見分けた「元 → 写し」の両方の小節に印を付ける
  let linked=new Set();
  try{
    const found=detectRepeats(audio,layers);
    for(const [bar,source] of found.sourceByBar){linked.add(bar);linked.add(source);}
  }catch{linked=new Set();}
  const labelCount=new Map();
  for(const s of list)if(s.label)labelCount.set(s.label,(labelCount.get(s.label)||0)+1);
  // 歌・主旋律の帯: 音の層の lead。無ければ音高のはっきりさ(clarity>=.5 のグリッドの割合)
  const leadSeries=layers&&layers.series&&Array.isArray(layers.series.lead)&&layers.grid?layers.series.lead:null;
  const clear=new Set();
  if(!leadSeries)for(const p of audio.pitchCurve||[])if(Number(p.clarity)>=.5&&Number(p.hz)>0)clear.add(p.grid);
  const leadOf=s=>{
    let sum=0,n=0;
    for(let g=s.startBar*BAR;g<s.endBarExclusive*BAR;g++){
      if(leadSeries){const i=g-layers.grid.firstGrid;if(i>=0&&i<leadSeries.length){sum+=Number(leadSeries[i])||0;n++;}}
      else{sum+=clear.has(g)?1:0;n++;}
    }
    return n?sum/n:0;
  };
  const leads=list.map(leadOf),maxLead=Math.max(.001,...leads);
  const sections=list.map((s,index)=>{
    const bars=s.endBarExclusive-s.startBar;
    const energy=clamp((Number(s.intensity)||0)/maxI);
    let linkedBars=0;for(let b=s.startBar;b<s.endBarExclusive;b++)if(linked.has(b))linkedBars++;
    const repeat=Math.max(clamp(((labelCount.get(s.label)||1)-1)/2),bars?linkedBars/bars:0);
    const lead=clamp(leads[index]/maxLead);
    const prev=index>0?Number(list[index-1].intensity)||0:Number(s.intensity)||0;
    const rise=clamp(((Number(s.intensity)||0)-prev)/maxI/.4);
    const center=(s.startBar+bars/2-firstBar)/span;
    const position=index===0?0:clamp((center-.1)/.2);
    const parts={energy:round(energy),repeat:round(repeat),lead:round(lead),rise:round(rise),position:round(position)};
    const score=round(Object.keys(WEIGHTS).reduce((sum,key)=>sum+WEIGHTS[key]*parts[key],0));
    return {index,startBar:s.startBar,endBarExclusive:s.endBarExclusive,startMs:s.startMs,endMs:s.endMs,bars,label:s.label||null,
      intensity:Number(s.intensity)||0,score,parts,chorus:false};
  });
  const maxScore=Math.max(...sections.map(s=>s.score));
  for(const s of sections)
    s.chorus=s.score>=Math.max(CHORUS_MIN,maxScore*CHORUS_RATIO)&&s.bars>=CHORUS_MIN_BARS&&s.parts.energy>=CHORUS_MIN_ENERGY;
  // サビの続き: サビのすぐ後ろの、同じ名札で盛り上がりも落ちていない区切り(解析がサビを2つに割った所)はサビに含める
  for(let i=1;i<sections.length;i++){
    const s=sections[i],prev=sections[i-1];
    if(!s.chorus&&prev.chorus&&s.label&&s.label===prev.label&&s.intensity>=prev.intensity*.9&&s.parts.energy>=CHORUS_MIN_ENERGY)s.chorus=true;
  }
  const chorus=sections.filter(s=>s.chorus);
  return {sections,chorus,maxScore:round(maxScore),hasChorus:chorus.length>0};
};

// サビの時間の範囲 [[startMs,endMs],…](続いていればつなげる)。手の仕上げの「山場」に使う
const chorusRanges=(audio,layers=null)=>{
  const out=[];
  for(const s of chorusScores(audio,layers).chorus){
    const last=out[out.length-1];
    if(last&&s.startMs-last[1]<=1)last[1]=s.endMs;else out.push([s.startMs,s.endMs]);
  }
  return out;
};

// 解析ファイルと、それに合う音の層の解析を読む(合わない・無いときは layers=null)
const loadForTrack=(trackId,root=path.resolve(__dirname,'..','..'))=>{
  const dashed=trackId.replace(/_/g,'-');
  const audioFile=path.join(root,'tools/mode/authoring',`${dashed}-v3-audio.json`);
  if(!fs.existsSync(audioFile))return null;
  const raw=fs.readFileSync(audioFile);
  const audio=JSON.parse(raw);
  let layers=null;
  try{
    const data=JSON.parse(fs.readFileSync(path.join(root,'tools/mode/authoring',`${dashed}-v3-layers.json`),'utf8'));
    if(data.basedOn&&data.basedOn.sha256===require('crypto').createHash('sha256').update(raw).digest('hex'))layers=data;
  }catch{layers=null;}
  return {audio,layers};
};

const sectionLine=s=>`${s.chorus?'★':'　'} ${String(s.label||'-').padEnd(2)} ${String(s.startBar).padStart(3)}〜${String(s.endBarExclusive).padEnd(3)}小節 `
  +`(${(s.startMs/1000).toFixed(0)}〜${(s.endMs/1000).toFixed(0)}秒) 点数 ${s.score.toFixed(2)}  `
  +`盛り上がり ${s.parts.energy.toFixed(2)}・繰り返し ${s.parts.repeat.toFixed(2)}・歌の帯 ${s.parts.lead.toFixed(2)}・上がり ${s.parts.rise.toFixed(2)}・位置 ${s.parts.position.toFixed(2)}`;

module.exports={chorusScores,chorusRanges,loadForTrack,sectionLine,WEIGHTS,CHORUS_RATIO,CHORUS_MIN};

if(require.main===module){
  const arg=name=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:null;};
  if(process.argv.includes('--all')){
    const registry=JSON.parse(fs.readFileSync(path.resolve(__dirname,'authoring/rhythm-song-registry.json'),'utf8')).songs;
    let none=0,total=0;
    for(const trackId of Object.keys(registry)){
      const data=loadForTrack(trackId);if(!data)continue;
      const r=chorusScores(data.audio,data.layers);total++;if(!r.hasChorus)none++;
      console.log(`${trackId.padEnd(34)} ${r.hasChorus?'サビ '+r.chorus.map(s=>`${(s.startMs/1000).toFixed(0)}〜${(s.endMs/1000).toFixed(0)}秒(${s.score.toFixed(2)})`).join(' '):'サビなし(最高 '+r.maxScore.toFixed(2)+')'}`);
    }
    console.log(`${total}曲のうち、サビが見つからない曲 ${none}`);
  }else{
    const trackId=arg('--track');
    const data=trackId?loadForTrack(trackId):null;
    if(!data){console.error('使い方: node tools/mode/rhythm-chart-chorus.js --track <曲> | --all');process.exit(1);}
    const r=chorusScores(data.audio,data.layers);
    console.log(`サビらしさ(${trackId}・★=サビ・層の解析 ${data.layers?'あり':'なし'})`);
    for(const s of r.sections)console.log(sectionLine(s));
    if(!r.hasChorus)console.log('サビと言える区切りが無い(生成器は盛り上がりの順位だけで決める)');
  }
}
