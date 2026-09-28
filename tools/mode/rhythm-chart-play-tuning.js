// 遊んだ記録から学ぶ調整値(2026-09-28・MHB CHART ENGINE Rev.17 から読む)。
//
// 【なぜ要るか】ユーザー指示「人間が関与しないで完璧なツールに仕上がる仕組みを」。
// 生成器のコードは書き換えず、ここにある数字だけを、プレイヤーの遊んだ記録(rhythm-play-log.js --learn)が週1回動かす。
// 数字を動かすたびに新しいリビジョンとして書き足し、前の数字は消さない(そのリビジョンの曲は、いつ作り直しても同じ譜面になる)。
//   lowLagFactor … 低音の打点の遅れ(rhythm-chart-low-lag.js)を何倍差し引くか。0 = 差し引かない(Rev.16 までと同じ)
//   lineBoost    … フレーズごとに決めた1本の線(歌・旋律かドラム)の打点を、拾う順でどれだけ前へ出すか。0 = 出さない
//   lineDemote   … もう一方の線だけの打点を、どれだけ後ろへ回すか(大きい一発は回さない)。0 = 回さない
// 番号は「作り方の最新(CHART_REVISION_CODE_LATEST)・作法の重み・この調整値」の最新の大きいほう＋1(rhythm-chart-v3-revision.js)。
// 既存の曲(一覧に書いてあるリビジョン)は、作り直すと決めない限り変わらない(CLAUDE.md ⑩-2)。
'use strict';
const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'..','..');
// 検査のときだけ MH_PLAY_TUNING_FILE で別のファイルを読ませる(本物の調整値を書き換えずに効き方を試すため)
const TUNING_FILE=process.env.MH_PLAY_TUNING_FILE?path.resolve(process.env.MH_PLAY_TUNING_FILE):path.join(ROOT,'tools/mode/authoring/chart-play-tuning.json');
const DEFAULT_PLAY_TUNING=Object.freeze({lowLagFactor:0,lineBoost:0,lineDemote:0});
const PLAY_TUNING_LIMITS=Object.freeze({lowLagFactor:[0,1.2],lineBoost:[0,1.2],lineDemote:[0,.6]});

const clampTuning=values=>Object.fromEntries(Object.entries(DEFAULT_PLAY_TUNING).map(([key,fallback])=>{
  const value=Number(values&&values[key]);
  const [lo,hi]=PLAY_TUNING_LIMITS[key];
  return [key,Number.isFinite(value)?Math.max(lo,Math.min(hi,value)):fallback];
}));
const readPlayTuning=()=>{
  try{
    const data=JSON.parse(fs.readFileSync(TUNING_FILE,'utf8'));
    return data&&typeof data.revisions==='object'&&data.revisions?data:{schemaVersion:1,revisions:{}};
  }catch{return {schemaVersion:1,revisions:{}};}
};
const latestPlayTuningRevision=()=>Math.max(0,...Object.keys(readPlayTuning().revisions).map(Number).filter(Number.isFinite));
// そのリビジョンで使う調整値 = そのリビジョン以下で、いちばん新しく書き足されたもの。無ければすべて0
const playTuningForRevision=revision=>{
  const revisions=readPlayTuning().revisions;
  const usable=Object.keys(revisions).map(Number).filter(r=>Number.isFinite(r)&&r<=revision).sort((a,b)=>b-a);
  return usable.length?clampTuning(revisions[usable[0]].values):{...DEFAULT_PLAY_TUNING};
};

module.exports={TUNING_FILE,DEFAULT_PLAY_TUNING,PLAY_TUNING_LIMITS,clampTuning,readPlayTuning,latestPlayTuningRevision,playTuningForRevision};
