#!/usr/bin/env node
// 出だしが空きすぎている配信中の譜面の頭に、ノーツを1つだけ足す。ほかのノーツは1つも動かさない。
//
//   node tools/mode/rhythm-intro-head-fix.js            # 何を足すかだけ出す
//   node tools/mode/rhythm-intro-head-fix.js --write    # 実際に足す
//
// 【なぜ要るか】(2026-09-27)
// 決定を押すとカウントダウンに3.2秒かかる。そこへさらに3秒以上ノーツが来ないと待たされすぎる
// (rhythm-song-challenge-check.js の「最初のノーツが3秒より後になっている曲が無い」)。
// 「もう一つの世界へ」(3.6秒)と「戦場の疾風」(4.0秒)がこれに当たっていた。
// 配信中の譜面は作り直さない決まり(CLAUDE.md ⑩-2)なので、ユーザーの判断(「譜面の頭だけ直す」)で、
// 作り直さずに頭へ1つ足す形にした。
//
// 【決めごと】
//   ・置くのは音源の解析(authoring/*-v3-audio.json の onsets)に実際にある音だけ。音の無いところへは置かない
//     (生成器の「1b. 出だしが空きすぎないようにする」と同じ考え方)
//   ・置く時刻は拍の格子の上(beatZeroMs + grid × gridMs)。道の拍の線とずれないように
//   ・範囲は 1.8〜3.0秒(配信中の曲でいちばん早い出だしが約1.9秒。それより前は落ちてくるのを見る間が無い)。
//     その中でいちばん強い音。拍の頭の音は少しだけ優先する
//   ・種類は TAP。レーンは、その譜面のいまの最初のノーツと同じ場所(手の動きが増えない)
//   ・イベント開催中の曲は触らない(CLAUDE.md ⑥-4)
//   ・レベルの表は書き換えない(1譜面に1つ足すだけ。変わったら検査が教えてくれる)
'use strict';
const fs=require('fs'),path=require('path');
const {loadRuntime,renderBlock,markerBlock,replaceBlock,RUNTIME,RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');

const ROOT=path.resolve(__dirname,'..','..');
const AUTHORING=path.join(ROOT,'tools','mode','authoring');
const FIRST_NOTE_LIMIT_MS=3000,EARLIEST_MS=1800,BEAT_BONUS=.1;
const write=process.argv.includes('--write');

const rt=loadRuntime();
let source=rt.source;
const markerNames=[...source.matchAll(/\/\/ <([a-z0-9-]+)-notes>/g)].map(m=>m[1]);
const bodies=new Map(markerNames.map(name=>[name,markerBlock(source,name).body]));
const liveMarker=chart=>{
  const rendered=renderBlock(chart.notes);
  const hit=[...bodies.entries()].filter(([,body])=>body===rendered).map(([name])=>name);
  return hit.length===1?hit[0]:null;
};
// 音源の解析を曲の trackId で引く
const analysisByTrack={};
for(const file of fs.readdirSync(AUTHORING).filter(name=>name.endsWith('-v3-audio.json'))){
  const json=JSON.parse(fs.readFileSync(path.join(AUTHORING,file),'utf8'));
  if(json&&json.trackId&&json.timing&&Array.isArray(json.onsets))analysisByTrack[json.trackId]=json;
}
// イベント開催中の曲(開始〜終了のあいだ)
const eventSource=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-event.js'),'utf8');
const now=Date.now();
const heldByEvent=new Set();
for(const m of eventSource.matchAll(/startAt: '([^']+)',\s*endAt: '([^']+)',[\s\S]*?songIds: Object\.freeze\(\[([^\]]*)\]\)/g)){
  if(Date.parse(m[1])<=now&&now<Date.parse(m[2]))for(const id of m[3].match(/[a-z0-9_]+/g)||[])heldByEvent.add(id);
}

let added=0,failed=0;
const byMarker=new Map();
for(const [songId,trackId] of Object.entries(RELEASED_TRACKS)){
  const song=rt.RHYTHM_SONGS.find(s=>s.songId===songId);
  if(!song)continue;
  for(const [difficulty,chart] of Object.entries(song.difficulties)){
    const notes=chart&&Array.isArray(chart.notes)?chart.notes:[];
    if(!notes.length||notes[0].timeMs<=FIRST_NOTE_LIMIT_MS)continue;
    const label=`${song.displayName} ${difficulty}`;
    if(heldByEvent.has(songId)){console.log(`保留: ${label}(イベント開催中)`);continue;}
    const analysis=analysisByTrack[trackId];
    if(!analysis){console.error(`NG: ${label} の音源の解析が見つかりません`);failed++;continue;}
    const {beatZeroMs,gridMs,subdivisionsPerBeat}=analysis.timing;
    const perBeat=Number(subdivisionsPerBeat)||4;
    const candidates=analysis.onsets
      .filter(onset=>Number.isInteger(onset.grid))
      .map(onset=>({...onset,atMs:Math.round(beatZeroMs+onset.grid*gridMs),onBeat:onset.grid%perBeat===0}))
      .filter(onset=>onset.atMs>=EARLIEST_MS&&onset.atMs<=FIRST_NOTE_LIMIT_MS&&onset.atMs<notes[0].timeMs)
      .sort((a,b)=>(b.strength+(b.onBeat?BEAT_BONUS:0))-(a.strength+(a.onBeat?BEAT_BONUS:0))||a.atMs-b.atMs);
    const head=candidates[0];
    if(!head){console.error(`NG: ${label} は ${EARLIEST_MS}〜${FIRST_NOTE_LIMIT_MS}ms に音がありません(手で決めてください)`);failed++;continue;}
    const first=notes[0];
    if(!Number.isFinite(first.lane)||!Number.isFinite(first.subLane)||!Number.isFinite(first.subLaneWidth)){
      console.error(`NG: ${label} の最初のノーツからレーンを決められません`);failed++;continue;
    }
    const marker=liveMarker(chart);
    if(!marker){console.error(`NG: ${label} の譜面がどのマーカーか決められません`);failed++;continue;}
    const note={type:'TAP',timeMs:head.atMs,lane:first.lane,subLane:first.subLane,subLaneWidth:first.subLaneWidth};
    console.log(`${label}: ${first.timeMs}ms → ${head.atMs}ms に TAP(音の強さ ${head.strength}・${head.onBeat?'拍の頭':'拍の間'}・レーン ${first.lane}) [${marker}]`);
    if(!byMarker.has(marker))byMarker.set(marker,{notes:[note,...notes]});
    added++;
  }
}
if(failed){console.error(`\n${failed}件は決められませんでした。何も書き換えていません。`);process.exit(1);}
if(!added){console.log('足すものはありません。');process.exit(0);}
console.log(`\n${byMarker.size}譜面に1つずつ足${write?'しました':'せます'}。`);
if(write){
  for(const [marker,entry] of byMarker)source=replaceBlock(source,marker,entry.notes);
  fs.writeFileSync(RUNTIME,source);
  console.log('書き換えました。node tools/build.js と検査を通してください。');
}else console.log('実際に足すには --write を付けてください。');
