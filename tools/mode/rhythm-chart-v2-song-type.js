#!/usr/bin/env node
// 自動譜面制作システム V2: 曲のタイプ（性格）を出す。
//
//   node tools/mode/rhythm-chart-v2-song-type.js                 # いまの曲のタイプを見る
//   node tools/mode/rhythm-chart-v2-song-type.js --track <id>
//
// 【なぜ要るか】
// これまで譜面の性格は「難易度」だけで決めていた。そのため、どんな曲を入れても
// 同じ配分（同じくらいのHOLD数・SLIDE数・同じくらいの細かさ）の譜面が出てくる。
// 実機で遊んだユーザーから「曲によるタイプで作ってほしい。この曲は細かいのが多いとか、
// スライドが多いとか、うまく曲にあわせて違いが作れるようにしたい」と言われた(2026-09-05)。
//
// ここでは **STEP1で既に取ってある特徴量だけ** から、曲の性格を5つの軸(0〜1)で出す。
// 新しい音源解析(ffmpeg等)は足さない。STEP3はこの5つの軸で難易度プロファイルを掛け算する。
//
// 【軸の決め方の考え方】
// ・どの軸も「この曲の中での相対値」ではなく、**曲をまたいで比べられる絶対の基準**で正規化する。
//   曲の中で正規化すると、どんな曲でも必ず真ん中の値になり「曲による違い」が出せない。
// ・基準の数値は、この曲(Monster Hero)が極端な曲ではないという前提で、
//   一般的なポップス/ゲーム曲がだいたい 0.3〜0.7 に収まるように置いている。
// ・乱数は使わない。同じ入力からは必ず同じ結果になる。
const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'..','..');
const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
// low..high を 0..1 へ写す(範囲外は端で止める)。基準点をそのまま読めるようにこの形で書く。
const ramp=(value,low,high)=>clamp01((Number(value)-low)/(high-low));
const mean=list=>list.length?list.reduce((sum,value)=>sum+value,0)/list.length:0;
const round3=value=>Math.round(Number(value)*1000)/1000;

// --- 5つの軸 ---
//
// granularity（細かさ）: 音がどれだけ細かく詰まっているか
//   ・1秒あたりのオンセット数（4件/秒=ゆったり 〜 10件/秒=詰まっている）
//   ・16分の裏（グリッド1・3）に乗る音の割合（15%=8分主体 〜 45%=16分主体）
//   ・オンセット間隔の中央値（220ms=ゆったり 〜 110ms=細かい。短いほど細かいので向きが逆）
//
// sustain（伸び）: 伸びる音がどれだけあるか → HOLD の本数と長さへ効く
//   ・timeline の sustainLikelihood の平均（0.25 〜 0.65）
//   ・伸びる音の候補が曲の何割の時間を占めるか（0% 〜 12%）
//
// motion（うねり）: 音色や高さがどれだけ動くか → SLIDE の本数と曲がりの大きさへ効く
//   ・spectralChange の平均（0.35 〜 0.70）
//   ・明るさ(brightness)がどれだけ揺れるか（隣り合う窓の差の平均。0.02 〜 0.10）
//   ・低域と高域のバランスの揺れ（0.03 〜 0.15）
//
// dynamics（抑揚）: 静かなところと盛り上がりの落差 → 区間ごとの密度差の付け方へ効く
//   ・intensity の p90 - p10（0.35 〜 0.85）
//   ・dynamicRangeDb（2dB 〜 9dB）
//
// regularity（規則性）: 拍に素直に乗っているか → 反復モチーフの効かせ方へ効く
//   ・rhythmPattern.regularityConfidence（0.35 〜 0.80）
//   ・拍頭（グリッド0）に乗る音の割合（20% 〜 50%）
const SONG_TYPE_AXES=Object.freeze({
  granularity:Object.freeze({label:'細かさ',high:'細かい音が多い',low:'ゆったりしている'}),
  sustain:Object.freeze({label:'伸び',high:'伸ばす音が多い',low:'切れのいい音が多い'}),
  motion:Object.freeze({label:'うねり',high:'音がよく動く',low:'まっすぐしている'}),
  dynamics:Object.freeze({label:'抑揚',high:'静と動の差が大きい',low:'ならされている'}),
  regularity:Object.freeze({label:'規則性',high:'拍に素直',low:'崩している'}),
});

const songTypeFromFeatures=features=>{
  const summary=features?.summary||{};
  const timeline=Array.isArray(features?.timeline)?features.timeline:[];
  const durationMs=Number(features?.durationMs)||1;

  const histogram=summary.rhythmPattern?.nearestGridSubdivisionHistogram||[0,0,0,0];
  const histogramTotal=histogram.reduce((sum,value)=>sum+(Number(value)||0),0)||1;
  const offbeatSixteenthShare=((Number(histogram[1])||0)+(Number(histogram[3])||0))/histogramTotal;
  const downbeatShare=(Number(histogram[0])||0)/histogramTotal;

  const granularity=clamp01(
    ramp(summary.onsetDensityPerSecond,4,10)*.45
    +ramp(offbeatSixteenthShare,.15,.45)*.35
    +ramp(220-(Number(summary.rhythmPattern?.medianOnsetIntervalMs)||220),0,110)*.20);

  const sustained=Array.isArray(features?.events?.sustainedCandidates)?features.events.sustainedCandidates:[];
  const sustainedMs=sustained.reduce((sum,item)=>sum+Math.max(0,Number(item.endMs)-Number(item.startMs)),0);
  const sustain=clamp01(
    ramp(mean(timeline.map(window=>Number(window.sustainLikelihood)||0)),.25,.65)*.65
    +ramp(sustainedMs/durationMs,0,.12)*.35);

  let brightnessSwing=0,balanceSwing=0;
  for(let index=1;index<timeline.length;index++){
    const before=timeline[index-1],now=timeline[index];
    brightnessSwing+=Math.abs((Number(now.spectral?.brightness)||0)-(Number(before.spectral?.brightness)||0));
    const balanceNow=(Number(now.frequencyBands?.high?.normalized)||0)-(Number(now.frequencyBands?.low?.normalized)||0);
    const balanceBefore=(Number(before.frequencyBands?.high?.normalized)||0)-(Number(before.frequencyBands?.low?.normalized)||0);
    balanceSwing+=Math.abs(balanceNow-balanceBefore);
  }
  const steps=Math.max(1,timeline.length-1);
  const motion=clamp01(
    ramp(Number(summary.spectralChange?.mean),.35,.70)*.40
    +ramp(brightnessSwing/steps,.02,.10)*.35
    +ramp(balanceSwing/steps,.03,.15)*.25);

  const dynamics=clamp01(
    ramp((Number(summary.intensity?.p90)||0)-(Number(summary.intensity?.p10)||0),.35,.85)*.65
    +ramp(summary.dynamicRangeDb,2,9)*.35);

  const regularity=clamp01(
    ramp(summary.rhythmPattern?.regularityConfidence,.35,.80)*.60
    +ramp(downbeatShare,.20,.50)*.40);

  return {granularity:round3(granularity),sustain:round3(sustain),motion:round3(motion),
    dynamics:round3(dynamics),regularity:round3(regularity)};
};

// 人が読む「タイプ名」。0.62以上を強い、0.38以下を弱いとして拾う。
// 1つも当てはまらない曲は「素直」とだけ呼ぶ(無理に名前を付けない)。
const songTypeLabels=type=>{
  const labels=[];
  for(const [key,axis] of Object.entries(SONG_TYPE_AXES)){
    const value=Number(type[key]);
    if(value>=.62)labels.push(axis.high);
    else if(value<=.38)labels.push(axis.low);
  }
  return labels.length?labels:['素直な曲'];
};

// --- 難易度プロファイルへの掛け算 ---
// 難易度の順（EASY<NORMAL<HARD<EXPERT<MASTER）を壊さないよう、**全難易度へ同じ倍率**を掛ける。
// 倍率の幅は「曲によって違いが出るが、難易度の差より小さい」を狙って決めている
// （難易度どうしは1.15〜1.4倍ずつ違うので、曲による違いはその半分くらいまで）。
const SONG_TYPE_EFFECT=Object.freeze({
  // 細かい曲ほど密度を上げ、半ノーツ(幅1)も増やす。ゆったりした曲では両方減らす。
  density:type=>0.88+0.24*type.granularity,
  narrow:type=>0.60+0.70*type.granularity,
  lattice:type=>type.granularity<=.30,          // ゆったりした曲は格子を1段粗くする
  consecutive:type=>0.80+0.40*type.granularity,
  // 伸びる音が多い曲ほどHOLDを増やし、長く、幅の変化も増やす
  hold:type=>0.70+0.60*type.sustain,
  holdLength:type=>0.85+0.30*type.sustain,
  holdTaper:type=>0.55+0.90*type.sustain,
  // 音がよく動く曲ほどSLIDEを増やし、曲がりも大きくする
  slide:type=>0.45+1.10*type.motion,
  slideReach:type=>0.70+0.60*type.motion,
  // 抑揚の大きい曲ほど、静かな区間と盛り上がりの差を強く付ける
  contrast:type=>0.80+0.40*type.dynamics,
  // 拍に素直な曲ほど反復モチーフを効かせ、崩した曲では控える
  motif:type=>type.regularity>=.45,
  // FLICKは「音が動く曲」で増やす(弾く動作は音の動きに合う)
  flick:type=>0.70+0.60*type.motion,
});

const loadFeatures=trackId=>{
  const file=path.join(ROOT,`tools/mode/authoring/${trackId.replace(/_/g,'-')}-v2-features.json`);
  if(!fs.existsSync(file))throw new Error(`STEP1の特徴量が見つかりません: ${file}`);
  const features=JSON.parse(fs.readFileSync(file,'utf8'));
  if(features.analysisType!=='rhythm-chart-v2-step1-features')throw new Error('STEP1 V2 JSONではありません');
  return features;
};

module.exports={SONG_TYPE_AXES,SONG_TYPE_EFFECT,songTypeFromFeatures,songTypeLabels,loadFeatures};

if(require.main===module){
  const arg=(name,fallback=null)=>{const index=process.argv.indexOf(name);return index>=0&&index+1<process.argv.length?process.argv[index+1]:fallback;};
  const trackId=arg('--track','monster_hero_theme');
  const features=loadFeatures(trackId);
  const type=songTypeFromFeatures(features);
  console.log(`曲のタイプ（${trackId}）: ${songTypeLabels(type).join(' / ')}\n`);
  const bar=value=>'█'.repeat(Math.round(value*20)).padEnd(20,'・');
  for(const [key,axis] of Object.entries(SONG_TYPE_AXES)){
    console.log(`  ${axis.label.padEnd(4,'　')} ${bar(type[key])} ${type[key].toFixed(2)}`);
  }
  console.log('\n譜面づくりへの効き方（すべての難易度へ同じ倍率で掛かる）:');
  console.log(`  密度              ×${SONG_TYPE_EFFECT.density(type).toFixed(2)}`);
  console.log(`  半ノーツ(幅1)の量  ×${SONG_TYPE_EFFECT.narrow(type).toFixed(2)}`);
  console.log(`  HOLDの本数        ×${SONG_TYPE_EFFECT.hold(type).toFixed(2)}  / 長さ ×${SONG_TYPE_EFFECT.holdLength(type).toFixed(2)} / 幅の変化 ×${SONG_TYPE_EFFECT.holdTaper(type).toFixed(2)}`);
  console.log(`  SLIDEの本数       ×${SONG_TYPE_EFFECT.slide(type).toFixed(2)}  / 曲がりの大きさ ×${SONG_TYPE_EFFECT.slideReach(type).toFixed(2)}`);
  console.log(`  FLICKの本数       ×${SONG_TYPE_EFFECT.flick(type).toFixed(2)}`);
  console.log(`  静と動の差        ×${SONG_TYPE_EFFECT.contrast(type).toFixed(2)}`);
  console.log(`  格子を粗くする     ${SONG_TYPE_EFFECT.lattice(type)?'する':'しない'} / 反復モチーフ ${SONG_TYPE_EFFECT.motif(type)?'効かせる':'控える'}`);
}
