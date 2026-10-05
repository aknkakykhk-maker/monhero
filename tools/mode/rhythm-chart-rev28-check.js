#!/usr/bin/env node
// MHB CHART ENGINE Rev.28(人が測った拍のずれの曲線・2026-10-05)を見張る。
//   ・点のあいだを直線でつなぎ、両端より外は端の値(curveShiftAt)
//   ・音源の一覧の warpPoints を書いた曲だけ曲線を使う。Rev.27 以前・書いていない曲には効かない
//   ・ゲームの拍の表(RHYTHM_SONG_BEATS の5つ目)が音源の一覧と同じ点で、拍の頭と線の時刻に曲線を足す
//   ・その曲の譜面のノーツは「格子＋曲線のずれ」に乗っている(98%以上・±20ms)
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');
const {CURVE_REVISION,curveWarp,curveShiftAt,tempoWarpForRevision}=require('./rhythm-chart-tempo-warp.js');
const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.28 以上',CHART_REVISION_CODE_LATEST>=28&&CURVE_REVISION===28,String(CHART_REVISION_CODE_LATEST));

// --- 直線でつなぐ計算 ---
const pts=[[1000,0],[3000,200],[5000,100]];
ok('点のあいだは直線・両端より外は端の値',curveShiftAt(pts,0)===0&&curveShiftAt(pts,2000)===100&&curveShiftAt(pts,4000)===150&&curveShiftAt(pts,9000)===100);

const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'authoring','rhythm-song-registry.json'),'utf8')).songs;
const audioOf=id=>{const file=path.join(__dirname,'authoring',`${id.replace(/_/g,'-')}-v3-audio.json`);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;};
const curved=Object.entries(registry).filter(([,entry])=>Array.isArray(entry.warpPoints)&&entry.warpPoints.length>=2);
ok('拍のずれの曲線を書いた曲がある',curved.length>=1,curved.map(([id])=>id).join(', '));
const plain=Object.keys(registry).filter(id=>!curved.some(([c])=>c===id)&&audioOf(id));
ok('曲線を書いていない曲には曲線が出ない',plain.every(id=>!curveWarp(audioOf(id))),`${plain.length}曲`);

const ctx={console,Object,Number,Math,Array,JSON,String,Boolean,isNaN,parseInt,parseFloat,Date,Map,Set};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8')
  +'\nthis.out={rhythmSongBeatGrid,rhythmBeatZeroAt,rhythmBeatLineTime,rhythmBeatCurveAt,RHYTHM_SONGS};',ctx);
const {rhythmSongBeatGrid,rhythmBeatZeroAt,rhythmBeatLineTime,rhythmBeatCurveAt,RHYTHM_SONGS}=ctx.out;
const songOfTrack=trackId=>Object.entries(RELEASED_TRACKS).find(([,t])=>t===trackId)?.[0];

for(const [trackId,entry] of curved){
  const audio=audioOf(trackId);
  ok(`${trackId}: 一覧のリビジョンが Rev.28 以上`,Number(entry.chartRevision)>=28,String(entry.chartRevision));
  const w28=tempoWarpForRevision(28,audio),w27=tempoWarpForRevision(27,audio);
  ok(`${trackId}: Rev.28 では曲線を使い、Rev.27 では使わない`,w28.active&&w28.version==='curve'&&w27.version!=='curve');
  const songId=songOfTrack(trackId),grid=songId&&rhythmSongBeatGrid(songId);
  ok(`${trackId}: 拍の表の曲線が音源の一覧と同じ点`,!!grid&&JSON.stringify(grid.curve)===JSON.stringify(entry.warpPoints),grid?`${grid.curve.length}点`:'表に無い');
  if(!grid)continue;
  const mid=entry.warpPoints[Math.floor(entry.warpPoints.length/2)];
  ok(`${trackId}: 拍の頭と線の時刻に曲線のずれを足す`,Math.abs(rhythmBeatZeroAt(grid,mid[0])-(grid.zeroMs+mid[1]))<1e-6
    &&Math.abs(rhythmBeatLineTime(grid,mid[0])-(mid[0]+rhythmBeatCurveAt(grid,mid[0])))<1e-6);
  // 譜面のノーツが「格子＋曲線のずれ」に乗っている
  const song=RHYTHM_SONGS.find(s=>s.songId===songId),step=grid.beatMs/4;
  for(const [difficulty,chart] of Object.entries(song.difficulties)){
    const notes=chart&&Array.isArray(chart.notes)?chart.notes:[];if(!notes.length)continue;
    const on=notes.filter(n=>{const shift=rhythmBeatCurveAt(grid,n.timeMs);const q=(n.timeMs-shift-grid.zeroMs)/step;return Math.abs(q-Math.round(q))*step<=20;}).length;
    const flat=notes.filter(n=>{const q=(n.timeMs-grid.zeroMs)/step;return Math.abs(q-Math.round(q))*step<=20;}).length;
    ok(`${songId} ${difficulty}: ノーツが格子＋曲線のずれに乗る(98%以上)`,on>=notes.length*.98,`${on}/${notes.length}(曲線なしの格子なら ${flat})`);
  }
}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.28(人が測った拍のずれの曲線)は期待どおり');
process.exit(failed?1:0);
