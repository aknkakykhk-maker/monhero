// 音ゲーの作法の一覧(知識の置き場)と、その重み(2026-09-26・Rev.7)。
//
// 【なぜ要るか】ユーザー指示「よその作品の譜面知識や音ゲーとしての一般的知識は生成器にいれとてほしい」
// 「決めつけはしないであくまでも曲に合わせた作りをできるようにして」
// 「色んな音ゲーが出てるからそれを学習してかつモンビーの中でもどんどん改良出来る仕組みにしていきたい」
//
// 【決めごと】
// ・作法は**決めつけない**。1件ごとに「曲のどんな音があるときに効くか(evidence)」を持ち、
//   音の裏づけが無ければ 0 を返す(何もしない)。最後に決めるのはいつも曲の音。
// ・作法は「選ばれやすさ」を少し足すだけ。押せるか・音に乗るかの関門は今までどおり生成器が見る。
// ・よその作品の**譜面データは取り込まない**(ノーツの並びを写さない)。採るのは公開されている
//   作り方の考え方(一般原則)だけ。出どころは sources に残す。
// ・重みは tools/mode/authoring/chart-knowledge-weights.json に**リビジョンごと**に残す。遊んだ感想(譜面メモ)から
//   rhythm-chart-learn.js が重みを上げ下げし、新しいリビジョンとして書き足す(前のリビジョンの重みは消さない＝戻せる)。
//
// 新しい作法は KNOWLEDGE へ1件足すだけで生成器に効く(stage が生成器の段に対応する)。
//   stage: 'pick'   … 拾う音の優先度に足す
//          'accent' … 区切りの一発(太いノーツ)の選ばれやすさに足す
//          'chord'  … 同時押しの選ばれやすさに足す
//          'shape'  … かたまりの形の好み(prefer)を足す(returns {ids})
'use strict';
const fs=require('fs'),path=require('path');

const WEIGHTS_FILE=path.resolve(__dirname,'authoring/chart-knowledge-weights.json');
const KNOWLEDGE_BASE_REVISION=7;
const clamp01=value=>Math.max(0,Math.min(1,value));

// ctx(生成器が渡す): { traits(その打点の音の性格・rhythm-sound-traits.js), bar, grid, BAR, BEAT,
//   section(その小節の区切り), previousSection, nextSection, sectionIntensity(0〜1), barDensityRatio(その小節の打点の多さ÷区切りの平均),
//   isLastNote, onset(解析の打点) }
const KNOWLEDGE=Object.freeze([
  Object.freeze({
    id:'section_opening_hit',title:'盛り上がる区切りの頭を、決めの一発で始める',
    sources:['プロジェクトセカイ・バンドリ！の公式譜面に多い「サビ頭の同時押し・太いノーツ」','CHUNITHM・maimai の区切り頭のアクセント'],
    stage:['accent','chord'],defaultWeight:1,
    // 前の区切りより盛り上がる区切りの1拍目で、そこに大きな一発かシンバルが鳴っているときだけ
    evidence:ctx=>{
      const section=ctx.section,previous=ctx.previousSection,traits=ctx.traits;
      if(!section||!previous||!traits)return 0;
      if(ctx.grid-section.startBar*ctx.BAR>=ctx.BEAT)return 0;
      const rise=(Number(section.intensity)||0)-(Number(previous.intensity)||0);
      if(rise<.15)return 0;
      if(!(traits.crash||traits.accent||traits.character==='FULL'))return 0;
      return clamp01(rise/.4)*(traits.crash?1:.7);
    },
  }),
  Object.freeze({
    id:'final_hit',title:'曲の最後の一音を締めにする',
    sources:['多くの音ゲーで曲の最後はフィニッシュの一発(太いノーツ・同時押し)で終わる'],
    stage:['accent'],defaultWeight:1,
    // 譜面の最後のノーツが強く鳴り、そのあと音が止まるときだけ
    evidence:ctx=>{
      const traits=ctx.traits;
      if(!ctx.isLastNote||!traits)return 0;
      if(!(traits.accent||traits.crash||traits.character==='FULL'))return 0;
      return traits.gapBeats>=1?1:.5;
    },
  }),
  Object.freeze({
    id:'build_up_fill',title:'盛り上がる前の溜め(フィル)は、次へ流れる形にする',
    sources:['osu!・maimai の「ビルドアップ」表現(連打をなめらかな流れで次の区切りへつなぐ)'],
    stage:['shape'],defaultWeight:1,
    // 次の区切りが今より盛り上がり、この小節がその直前で、打点が区切りの平均より詰まっているときだけ
    evidence:ctx=>{
      const section=ctx.section,next=ctx.nextSection;
      if(!section||!next)return 0;
      if(ctx.bar!==section.endBarExclusive-1)return 0;
      const rise=(Number(next.intensity)||0)-(Number(section.intensity)||0);
      if(rise<.15||!(ctx.barDensityRatio>=1.3))return 0;
      return clamp01(rise/.4)*clamp01((ctx.barDensityRatio-1)/1);
    },
    // 効くときに好む形(流れる階段)。強さに重みを掛けた値を prefer へ足す
    shapeIds:Object.freeze(['stair_up','stair_down','stair_up_long','stair_down_long','stair2_up','stair2_down','cross_step_up','cross_step_down']),
  }),
  Object.freeze({
    id:'layer_follow',title:'場面で追う楽器を変える(静かな所は歌、盛り上がる所は打楽器)',
    sources:['バンドリ！・プロセカのAメロは歌、サビはドラム主体になる作り','osu! の Ranking criteria「譜面は曲の目立つ層に従う」'],
    stage:['pick'],defaultWeight:1,
    // 静かな区切りの音程のある音、盛り上がる区切りの打楽器(低い帯の一発)にだけ
    evidence:ctx=>{
      const onset=ctx.onset,intensity=Number(ctx.sectionIntensity);
      if(!onset||!Number.isFinite(intensity))return 0;
      if(intensity<=.35&&onset.pitchHz>0)return clamp01((.35-intensity)/.35+.3);
      const low=(Number(onset.share&&onset.share.low)||0)+(Number(onset.share&&onset.share.lowMid)||0);
      if(intensity>=.65&&(onset.character==='FULL'||onset.character==='PUNCH')&&low>=.5)return clamp01((intensity-.65)/.35+.3);
      return 0;
    },
  }),
]);
const KNOWLEDGE_BY_ID=Object.freeze(Object.fromEntries(KNOWLEDGE.map(entry=>[entry.id,entry])));

const defaultWeights=()=>Object.fromEntries(KNOWLEDGE.map(entry=>[entry.id,entry.defaultWeight]));
const readWeightsFile=()=>{
  try{
    const value=JSON.parse(fs.readFileSync(WEIGHTS_FILE,'utf8'));
    return value&&typeof value==='object'&&value.revisions&&typeof value.revisions==='object'?value:{schemaVersion:1,revisions:{}};
  }catch{return {schemaVersion:1,revisions:{}};}
};
// 重みを書き足したリビジョンのうち、いちばん新しい番号(書いていなければRev.7)
const latestKnowledgeRevision=()=>{
  const numbers=Object.keys(readWeightsFile().revisions).map(Number).filter(Number.isInteger);
  return Math.max(KNOWLEDGE_BASE_REVISION,...numbers);
};
// そのリビジョンで使う重み。そのリビジョン以下で書いてあるいちばん新しい重みを使い、書いていない作法は既定値
const weightsForRevision=revision=>{
  const revisions=readWeightsFile().revisions;
  const usable=Object.keys(revisions).map(Number).filter(n=>Number.isInteger(n)&&n<=revision).sort((a,b)=>b-a);
  const stored=usable.length?revisions[String(usable[0])]&&revisions[String(usable[0])].weights:null;
  const weights=defaultWeights();
  if(stored&&typeof stored==='object')for(const [id,value] of Object.entries(stored)){
    if(KNOWLEDGE_BY_ID[id]&&Number.isFinite(Number(value)))weights[id]=Math.max(0,Math.min(2,Number(value)));
  }
  return weights;
};

// ある段で効く作法を並べ、{total, fired:[id]} を返す(重みを掛けた後押しの合計と、効いた作法)
const knowledgeBoost=(stage,ctx,weights)=>{
  let total=0;const fired=[];
  for(const entry of KNOWLEDGE){
    if(!entry.stage.includes(stage))continue;
    const strength=entry.evidence(ctx);
    if(!(strength>0))continue;
    const weight=Number(weights&&weights[entry.id]);
    const value=strength*(Number.isFinite(weight)?weight:entry.defaultWeight);
    if(value>0){total+=value;fired.push(entry.id);}
  }
  return {total,fired};
};
// 形の好み(shape)は、効いた作法の好む形へ「強さ×重み」を足した prefer を返す
const knowledgeShapePrefer=(ctx,weights)=>{
  const ids={};const fired=[];
  for(const entry of KNOWLEDGE){
    if(!entry.stage.includes('shape')||!entry.shapeIds)continue;
    const strength=entry.evidence(ctx);
    if(!(strength>0))continue;
    const weight=Number(weights&&weights[entry.id]);
    const value=strength*(Number.isFinite(weight)?weight:entry.defaultWeight);
    if(!(value>0))continue;
    for(const id of entry.shapeIds)ids[id]=(ids[id]||0)+value;
    fired.push(entry.id);
  }
  return {ids,fired};
};

module.exports={KNOWLEDGE,KNOWLEDGE_BY_ID,KNOWLEDGE_BASE_REVISION,WEIGHTS_FILE,defaultWeights,readWeightsFile,
  latestKnowledgeRevision,weightsForRevision,knowledgeBoost,knowledgeShapePrefer};
