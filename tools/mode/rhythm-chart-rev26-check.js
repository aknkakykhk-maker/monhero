#!/usr/bin/env node
// MHB CHART ENGINE Rev.26(曲のつなぎ目の段差・2026-10-03)と、激しさの中間 strong を見張る。
//   ・つなぎ目(音源の一覧の splices)を書いた曲は、つなぎ目から先だけ一定のずれを返す。Rev.25 以前・書いていない曲は段差なし
//   ・音源の一覧の splices と、ゲームの拍の表(RHYTHM_SONG_BEATS の4つ目)が同じ値
//   ・ゲームの拍の線の計算(rhythmBeatZeroAt / rhythmBeatLineTime)が、つなぎ目の前後で正しい拍の時刻を返す
//   ・つなぎ目を書いた曲の譜面のノーツは、つなぎ目の前は格子に、後ろは格子+ずれに乗っている
//   ・strong は extreme の倍率の平方根(ちょうど半分の強さ)で、届く幅と EASY・NORMAL の16分は広げない
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');
const {SPLICE_REVISION,spliceWarp,tempoWarpForRevision}=require('./rhythm-chart-tempo-warp.js');
const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.26 以上',CHART_REVISION_CODE_LATEST>=26&&SPLICE_REVISION===26,String(CHART_REVISION_CODE_LATEST));

const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'authoring','rhythm-song-registry.json'),'utf8')).songs;
const spliced=Object.entries(registry).filter(([,entry])=>Array.isArray(entry.splices)&&entry.splices.length);
ok('つなぎ目を書いた曲がある',spliced.length>=1,spliced.map(([id])=>id).join(', '));

// --- 段差の計算 ---
for(const [trackId,entry] of spliced){
  const audio=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',`${trackId.replace(/_/g,'-')}-v3-audio.json`),'utf8'));
  const {gridMs,beatZeroMs}=audio.timing;
  const gridAt=ms=>Math.round((ms-beatZeroMs)/gridMs);
  const warp=spliceWarp(audio),[first]=entry.splices;
  ok(`${trackId}: つなぎ目の前は段差なし・後ろは ${first.shiftMs}ms`,warp&&warp.active&&warp.at(gridAt(first.atMs-500))===0&&warp.at(gridAt(first.atMs+500))===first.shiftMs);
  ok(`${trackId}: Rev.25 では段差を使わない`,!tempoWarpForRevision(25,audio).points.some(p=>p&&Number.isFinite(p.shiftMs)));
  ok(`${trackId}: 一覧のリビジョンが Rev.26 以上`,Number(entry.chartRevision)>=26,String(entry.chartRevision));
}
// 書いていない曲(公開中の曲)は段差なし
const plain=Object.keys(registry).filter(id=>!spliced.some(([s])=>s===id)&&fs.existsSync(path.join(ROOT,'tools/mode/authoring',`${id.replace(/_/g,'-')}-v3-audio.json`)));
ok('つなぎ目を書いていない曲には段差が出ない',plain.every(id=>!spliceWarp(JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',`${id.replace(/_/g,'-')}-v3-audio.json`),'utf8')))),`${plain.length}曲`);

// --- ゲームの拍の表と、拍の線の計算 ---
const ctx={console,Object,Number,Math,Array,JSON,String,Boolean,isNaN,parseInt,parseFloat,Date,Map,Set};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8')
  +'\nthis.out={RHYTHM_SONG_BEATS,rhythmSongBeatGrid,rhythmBeatZeroAt,rhythmBeatLineTime,RHYTHM_SONGS};',ctx);
const {rhythmSongBeatGrid,rhythmBeatZeroAt,rhythmBeatLineTime,RHYTHM_SONGS}=ctx.out;
const songOfTrack=trackId=>Object.entries(RELEASED_TRACKS).find(([,t])=>t===trackId)?.[0];
for(const [trackId,entry] of spliced){
  const songId=songOfTrack(trackId),grid=songId&&rhythmSongBeatGrid(songId);
  ok(`${trackId}: 拍の表のつなぎ目が音源の一覧と同じ`,!!grid&&JSON.stringify(grid.splices)===JSON.stringify(entry.splices.map(s=>[s.atMs,s.shiftMs])),grid?JSON.stringify(grid.splices):'表に無い');
  if(!grid)continue;
  const [at,shift]=grid.splices[0];
  ok(`${trackId}: 拍の頭はつなぎ目の前はそのまま・後ろはずれを足す`,rhythmBeatZeroAt(grid,at-1)===grid.zeroMs&&rhythmBeatZeroAt(grid,at+1)===grid.zeroMs+shift);
  const k=Math.ceil((at-grid.zeroMs)/grid.beatMs)+2,t0=grid.zeroMs+k*grid.beatMs;
  ok(`${trackId}: つなぎ目より後ろの拍の線はずれを足した時刻に引く`,rhythmBeatLineTime(grid,t0)===t0+shift&&rhythmBeatLineTime(grid,grid.zeroMs)===grid.zeroMs);
  // 譜面のノーツ: つなぎ目の前は格子、後ろは格子+ずれ(±20ms)
  const song=RHYTHM_SONGS.find(s=>s.songId===songId),step=grid.beatMs/4;
  const near=(ms,zero)=>{const q=(ms-zero)/step;return Math.abs(q-Math.round(q))*step<=20;};
  for(const [difficulty,chart] of Object.entries(song.difficulties)){
    const notes=chart&&Array.isArray(chart.notes)?chart.notes:[];if(!notes.length)continue;
    const after=notes.filter(n=>n.timeMs>=at+300),before=notes.filter(n=>n.timeMs<at-300);
    const onAfter=after.filter(n=>near(n.timeMs,grid.zeroMs+shift)).length,onBefore=before.filter(n=>near(n.timeMs,grid.zeroMs)).length;
    ok(`${songId} ${difficulty}: つなぎ目の前後のノーツがそれぞれの格子に乗る(98%以上)`,onBefore>=before.length*.98&&onAfter>=after.length*.98,
      `前 ${onBefore}/${before.length}・後 ${onAfter}/${after.length}`);
  }
}

// --- strong ---
const source=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-generate.js'),'utf8');
ok('strong は extreme の倍率の平方根で作る(届く幅と16分は広げない)',/INTENSITY_STYLES_STRONG:\{/.test(source)&&/Math\.sqrt\(value\)/.test(source)&&/key==='maxLaneStep'\|\|key==='lattice'\?0/.test(source));
const strongSongs=Object.entries(registry).filter(([,e])=>e.chartIntensity==='strong').map(([id])=>id);
ok('strong を書いた曲は Rev.26 以上(新しく足す曲だけ)',strongSongs.every(id=>Number(registry[id].chartRevision)>=26),strongSongs.join(', ')||'なし');

console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.26(曲のつなぎ目の段差)と strong は期待どおり');
process.exit(failed?1:0);
