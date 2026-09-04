#!/usr/bin/env node
// 「曲によるタイプ」の作りを確かめる。
//
// ユーザー指示(2026-09-05)「難易度別もそうだけど曲によるタイプで作ってほしい。
// この曲は細かいのが多いとか、スライドが多いとか、うまく曲にあわせて違いが作れるようにしたい」。
//
// 曲が1つしか無いと「曲によって本当に変わるのか」を実物では確かめられない。
// ここでは**作り物の特徴量**（細かい曲・伸びる曲・よく動く曲…）を入れて、
// 出てくる譜面づくりの方針が狙いどおりに違うことを確かめる。
//
//   node tools/mode/rhythm-chart-v2-song-type-check.js
const path=require('path');
const {SONG_TYPE_AXES,SONG_TYPE_EFFECT,songTypeFromFeatures,songTypeLabels,loadFeatures}
  =require('./rhythm-chart-v2-song-type.js');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};
const AXES=Object.keys(SONG_TYPE_AXES);

// --- 作り物の曲。極端な値を入れて、軸が本当に振り切れるかを見る ---
const makeFeatures=({onsetPerSecond=6,offbeatShare=.3,medianInterval=160,
  sustainLikelihood=.45,sustainedRatio=.05,spectralChange=.5,brightnessSwing=.05,
  balanceSwing=.08,intensityLow=.15,intensityHigh=.85,dynamicRangeDb=4,
  regularityConfidence=.55,downbeatShare=.35}={})=>{
  const frames=200,durationMs=120000;
  // ヒストグラムは [拍頭, 16分裏, 8分裏, 16分裏] の順。拍頭と16分裏の割合を作る。
  const total=1000;
  const down=Math.round(total*downbeatShare),off=Math.round(total*offbeatShare);
  const histogram=[down,Math.round(off/2),total-down-off,off-Math.round(off/2)];
  const timeline=[];
  for(let index=0;index<frames;index++){
    // brightness と バンドバランスを、指定した揺れ幅ぶんだけ1窓ごとに振る
    const flip=index%2===0?1:-1;
    timeline.push({
      sustainLikelihood,
      spectral:{brightness:.3+flip*brightnessSwing/2,spread:.4,change:spectralChange},
      frequencyBands:{low:{normalized:.4-flip*balanceSwing/2},high:{normalized:.2+flip*balanceSwing/2}},
    });
  }
  return {analysisType:'rhythm-chart-v2-step1-features',durationMs,timeline,
    events:{sustainedCandidates:[{startMs:0,endMs:durationMs*sustainedRatio}]},
    summary:{onsetDensityPerSecond:onsetPerSecond,dynamicRangeDb,
      spectralChange:{mean:spectralChange},
      intensity:{p10:intensityLow,p90:intensityHigh},
      rhythmPattern:{nearestGridSubdivisionHistogram:histogram,
        medianOnsetIntervalMs:medianInterval,regularityConfidence}}};
};

const SONGS={
  ゆったり:makeFeatures({onsetPerSecond:3.5,offbeatShare:.10,medianInterval:260}),
  細かい:makeFeatures({onsetPerSecond:11,offbeatShare:.50,medianInterval:95}),
  伸びる:makeFeatures({sustainLikelihood:.72,sustainedRatio:.15}),
  切れがいい:makeFeatures({sustainLikelihood:.18,sustainedRatio:0}),
  よく動く:makeFeatures({spectralChange:.78,brightnessSwing:.13,balanceSwing:.19}),
  まっすぐ:makeFeatures({spectralChange:.28,brightnessSwing:.01,balanceSwing:.01}),
  抑揚が大きい:makeFeatures({intensityLow:.03,intensityHigh:.97,dynamicRangeDb:11}),
  ならされている:makeFeatures({intensityLow:.42,intensityHigh:.62,dynamicRangeDb:1.2}),
  拍に素直:makeFeatures({regularityConfidence:.9,downbeatShare:.55}),
  崩している:makeFeatures({regularityConfidence:.25,downbeatShare:.12}),
};
const types=Object.fromEntries(Object.entries(SONGS).map(([name,features])=>[name,songTypeFromFeatures(features)]));

// --- 軸が0〜1へ収まり、狙った方向へ振り切れる ---
check('5つの軸がすべて0〜1に収まる',
  Object.values(types).every(type=>AXES.every(axis=>Number.isFinite(type[axis])&&type[axis]>=0&&type[axis]<=1)));
const pairs=[
  ['granularity','細かい','ゆったり','細かさ'],
  ['sustain','伸びる','切れがいい','伸び'],
  ['motion','よく動く','まっすぐ','うねり'],
  ['dynamics','抑揚が大きい','ならされている','抑揚'],
  ['regularity','拍に素直','崩している','規則性'],
];
for(const [axis,high,low,label] of pairs){
  check(`${label}: 「${high}」曲のほうが「${low}」曲より高く出る`,
    types[high][axis]>types[low][axis]+.3,
    `${types[high][axis].toFixed(2)} vs ${types[low][axis].toFixed(2)}`);
  check(`${label}: 両端がはっきり振り切れる(0.25以下と0.75以上)`,
    types[low][axis]<=.25&&types[high][axis]>=.75,
    `${types[low][axis].toFixed(2)} / ${types[high][axis].toFixed(2)}`);
}
// 軸どうしが独立していること。1つの軸を振ったときに、他の軸まで一緒に動いてしまうと
// 「細かい曲にしたらスライドも増えた」のような、意図しない連動になる。
for(const [axis,high,low] of pairs){
  const others=AXES.filter(other=>other!==axis);
  const moved=others.filter(other=>Math.abs(types[high][other]-types[low][other])>.15);
  check(`${SONG_TYPE_AXES[axis].label}を振っても他の軸が動かない`,moved.length===0,
    moved.length?`一緒に動いた: ${moved.map(other=>SONG_TYPE_AXES[other].label).join(',')}`:'');
}

// --- 譜面づくりへの効き方が狙いどおり ---
const effect=(name,key)=>SONG_TYPE_EFFECT[key](types[name]);
check('細かい曲は密度が上がり、ゆったりした曲は下がる',
  effect('細かい','density')>1.05&&effect('ゆったり','density')<.95,
  `${effect('細かい','density').toFixed(2)} / ${effect('ゆったり','density').toFixed(2)}`);
check('半ノーツ(幅1)は細かい曲でだけ増える',
  effect('細かい','narrow')>1.2&&effect('ゆったり','narrow')<.75,
  `${effect('細かい','narrow').toFixed(2)} / ${effect('ゆったり','narrow').toFixed(2)}`);
check('伸びる曲はHOLDが増え、切れのいい曲は減る',
  effect('伸びる','hold')>1.15&&effect('切れがいい','hold')<.85,
  `${effect('伸びる','hold').toFixed(2)} / ${effect('切れがいい','hold').toFixed(2)}`);
check('伸びる曲はHOLDの幅変化も増える',
  effect('伸びる','holdTaper')>1.2&&effect('切れがいい','holdTaper')<.8,
  `${effect('伸びる','holdTaper').toFixed(2)} / ${effect('切れがいい','holdTaper').toFixed(2)}`);
check('よく動く曲はSLIDEが増え、まっすぐな曲は減る',
  effect('よく動く','slide')>1.3&&effect('まっすぐ','slide')<.7,
  `${effect('よく動く','slide').toFixed(2)} / ${effect('まっすぐ','slide').toFixed(2)}`);
check('よく動く曲はSLIDEの曲がりも大きくなる',
  effect('よく動く','slideReach')>1.15&&effect('まっすぐ','slideReach')<.85,
  `${effect('よく動く','slideReach').toFixed(2)} / ${effect('まっすぐ','slideReach').toFixed(2)}`);
check('抑揚の大きい曲ほど静と動の差を強く付ける',
  effect('抑揚が大きい','contrast')>1.15&&effect('ならされている','contrast')<.9,
  `${effect('抑揚が大きい','contrast').toFixed(2)} / ${effect('ならされている','contrast').toFixed(2)}`);
check('拍に素直な曲だけ反復モチーフを効かせる',
  SONG_TYPE_EFFECT.motif(types['拍に素直'])===true&&SONG_TYPE_EFFECT.motif(types['崩している'])===false);
check('ゆったりした曲だけ格子を粗くする',
  SONG_TYPE_EFFECT.lattice(types['ゆったり'])===true&&SONG_TYPE_EFFECT.lattice(types['細かい'])===false);

// 倍率の振れ幅は、効く先によって許す幅が違う。
//   ・**密度**に効くもの … 難易度どうしの差(1.15〜1.4倍)を飲み込んではいけないので1.6倍まで。
//     ここが広すぎると「MASTERよりHARDのほうが忙しい曲」ができてしまう。
//   ・**配分**に効くもの … 「この曲はスライドが多い」を作るのが目的なので、むしろ広くてよい。
//     ただし広すぎるとSLIDEが0本の曲やSLIDEだらけの曲になるので上限も置く。
//     下限も置いて、曲のタイプが**何も効いていない**状態を検出する。
const allTypes=Object.values(types);
const DENSITY_KEYS=['density','holdLength','contrast'];
const MIX_KEYS=['narrow','hold','holdTaper','slide','slideReach','flick'];
const spanOf=key=>{
  const values=allTypes.map(type=>SONG_TYPE_EFFECT[key](type));
  return Math.max(...values)/Math.min(...values);
};
for(const key of DENSITY_KEYS){
  const span=spanOf(key);
  check(`密度に効く倍率(${key})は難易度の差より小さい`,span<=1.6,`最大/最小=${span.toFixed(2)}倍`);
}
for(const key of MIX_KEYS){
  const span=spanOf(key);
  check(`配分に効く倍率(${key})は曲によってはっきり変わる(1.5〜3.6倍)`,span>=1.5&&span<=3.6,
    `最大/最小=${span.toFixed(2)}倍`);
}

// --- タイプ名 ---
check('振り切れた曲には名前が付く',
  songTypeLabels(types['細かい']).some(label=>label.includes('細かい'))
  &&songTypeLabels(types['伸びる']).some(label=>label.includes('伸ば'))
  &&songTypeLabels(types['よく動く']).some(label=>label.includes('動く')));
check('真ん中の曲には無理に名前を付けない',
  songTypeLabels({granularity:.5,sustain:.5,motion:.5,dynamics:.5,regularity:.5}).join()==='素直な曲');

// --- 実際の曲(Monster Hero)でも動く ---
const real=songTypeFromFeatures(loadFeatures('monster_hero_theme'));
check('実際の曲でも5つの軸が出る',AXES.every(axis=>Number.isFinite(real[axis])),
  AXES.map(axis=>`${SONG_TYPE_AXES[axis].label}${real[axis].toFixed(2)}`).join(' / '));
check('実際の曲は極端ではない(基準の置き方が偏っていない)',
  AXES.every(axis=>real[axis]>=.2&&real[axis]<=.8));
check('同じ入力からは必ず同じ結果になる(乱数を使っていない)',
  JSON.stringify(songTypeFromFeatures(loadFeatures('monster_hero_theme')))===JSON.stringify(real));

// --- 新しい音源解析を足していない ---
const fs=require('fs');
const source=fs.readFileSync(path.join(__dirname,'rhythm-chart-v2-song-type.js'),'utf8');
// コメントに ffmpeg の文字が出るのは構わない(「足さない」と書いてある)。実際に起動しないことを見る。
const code=source.split('\n').filter(line=>!line.trim().startsWith('//')).join('\n');
check('STEP1の特徴量だけを読む(新しい音源解析を足していない)',
  source.includes('-v2-features.json')&&!/spawnSync|child_process|ffmpeg/.test(code));
check('ゲームのランタイム・保存・ランキングへ触れない',
  !/monster-hero\/(data|src)\//.test(source)&&!/mh_/.test(source));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
