#!/usr/bin/env node
// 引き出し R1: 密度の形を数える(2026-10-16 社長の決定・数えるだけ。譜面は1つも変えない)。
//
//   node tools/mode/rhythm-density-shape.js                      # 公開中の全曲の MASTER と、HELL(デバッグ)を数える
//   node tools/mode/rhythm-density-shape.js --difficulty EXPERT  # 難易度を選ぶ(ALL で全部)
//   node tools/mode/rhythm-density-shape.js --chart <譜面のJSON>   # 生成器の書き出し(*-v3-chart-*.json)を数える
//   node tools/mode/rhythm-density-shape.js --json               # 表のかわりに JSON
//
// 入り=最初の15%・本編=そのあと70%まで・後半=最後の30%・いちばん濃い10秒(1秒あたりのノーツ数)。
// 参考動画(10/16)の形は「入りは本編の約0.4倍・後半が最も高い(約1.1倍)」。数(1秒10ノーツ)は写さない・比だけを見る。
// 学んだこと: tools/mode/CHART_DRAWERS.md
'use strict';
const fs=require('fs'),path=require('path');
const {densityShape,REFERENCE_SHAPE}=require('./rhythm-chart-drawers.js');
const args=process.argv.slice(2),argOf=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};

const rows=[];
const chartFile=argOf('--chart');
if(chartFile){
  const chart=JSON.parse(fs.readFileSync(path.resolve(chartFile),'utf8'));
  const beatMs=60000/Number(chart.bpm),grid=beatMs/Number(chart.subdivisionsPerBeat||4);
  const shape=densityShape((chart.notes||[]).map(n=>Number(chart.beatZeroMs)+n.grid*grid));
  rows.push({song:chart.trackId,difficulty:chart.difficulty,...shape});
}else{
  const {loadRuntimeSongs}=require('./rhythm-chart-level.js');
  const runtime=loadRuntimeSongs();
  const want=String(argOf('--difficulty')||'MASTER').toUpperCase();
  const pick=d=>want==='ALL'||d===want;
  for(const song of runtime.RHYTHM_SONGS||[])for(const [difficulty,chart] of Object.entries(song.difficulties||{})){
    if(!pick(difficulty)||!chart||!Array.isArray(chart.notes))continue;
    const shape=densityShape(chart.notes.map(n=>Number(n.timeMs)));if(shape)rows.push({song:song.songId,difficulty,...shape});}
  // HELL はデバッグの曲(〜_hell_debug など)にある
  if(want==='ALL'||want==='HELL')for(const song of runtime.RHYTHM_PROTO_SONGS||[]){const chart=(song.difficulties||{}).HELL;
    if(!chart||!Array.isArray(chart.notes))continue;const shape=densityShape(chart.notes.map(n=>Number(n.timeMs)));if(shape)rows.push({song:song.songId,difficulty:'HELL',...shape});}
}
if(args.includes('--json')){console.log(JSON.stringify({reference:REFERENCE_SHAPE,rows},null,1));process.exit(0);}
const near=r=>r.introRatio!=null&&r.introRatio<=.6&&r.lateRatio>=1;
console.log(`密度の形(1秒あたり)。参考の形: 入り/本編 約${REFERENCE_SHAPE.introRatio}・後半/本編 約${REFERENCE_SHAPE.lateRatio}。○=入りが本編の0.6倍以下で後半が本編以上`);
console.log('曲 | 難易度 | ノーツ | 入り | 本編 | 後半 | 濃い10秒(秒) | 入り/本編 | 後半/本編 | 形');
for(const r of rows)console.log(`${r.song} | ${r.difficulty} | ${r.notes} | ${r.intro} | ${r.body} | ${r.late} | ${r.peak10s}(${r.peakAtSec}) | ${r.introRatio} | ${r.lateRatio} | ${near(r)?'○':'—'}`);
const ratios=k=>rows.map(r=>r[k]).filter(Number.isFinite).sort((a,b)=>a-b),mid=a=>a.length?a[a.length>>1]:null;
console.log(`${rows.length}譜面・入り/本編の中央 ${mid(ratios('introRatio'))}・後半/本編の中央 ${mid(ratios('lateRatio'))}・参考の形に近い ${rows.filter(near).length}`);
