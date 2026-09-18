#!/usr/bin/env node
// 見分けられない場所に付いている終点フリック(endFlick)を外す。譜面の中身は1音も動かさない。
//
//   node tools/mode/rhythm-end-flick-swing-fix.js                   # 何を外すかだけ出す
//   node tools/mode/rhythm-end-flick-swing-fix.js --write            # 実際に外す
//   node tools/mode/rhythm-end-flick-swing-fix.js --include-event    # イベント開催中の曲も外す
//
// 【なぜ要るか】
//   rhythm-end-flick-swing-check.js を見る。受付のあいだに経路そのものが
//   フリック距離より大きく振れる区間では、「弾いた」と「経路を追った」を見分けられない。
//   そういう場所の終点フリックは、弾かなくても成立してしまい、
//   弾いても(実装側が早い確定を見送るので)いちばん良い判定にはならない。
//   ＝プレイヤーには何の意味も無いので、フラグごと外す。
//
// 【やらないこと】
//   ・譜面を作り直さない(ノーツの時刻・位置・種類・本数は一切変えない。外すのは endFlick だけ)
//   ・イベント開催中の曲は触らない(CLAUDE.md ⑥-4)。検査が「保留」として出す。
//     ★--include-event を付けたときだけ、それも外す。**ユーザーが明示的にそう言ったときだけ**使う。
//     開催中に譜面が変わると、変わる前に遊んだ人と後の人で条件が違ってしまうため既定では触らない。
//     2026-09-18、開催の翌日(残り3日)にユーザーが「まだ始まったばかりだから全部直して」と
//     判断し、この経路で13本を外した
//   ・レベルの表は書き換えない(終点フリック1本=仕事量0.35。1譜面あたり1〜4本なので、
//     実測でどの譜面もLv.は変わらない。変わったら検査が教えてくれる)
'use strict';
const fs=require('fs');
const {loadRuntime,renderBlock,markerBlock,replaceBlock,RUNTIME}=require('./rhythm-runtime-notes.js');
const {swingReport}=require('./rhythm-end-flick-swing-check.js');

const write=process.argv.includes('--write');
const includeEvent=process.argv.includes('--include-event');
const rt=loadRuntime();
let source=rt.source;

// 「いま配信している譜面」がどのマーカーの中身かを、書き出した文字列の一致で決める。
// 入れ替え中の曲(RHYTHM_SWITCHING_CHARTS)は古いほうにも似た譜面があるので、
// 名前ではなく中身で見分ける。古いほうは触らない(CLAUDE.md ⑥-4「旧譜面は消さない」)。
const markerNames=[...source.matchAll(/\/\/ <([a-z0-9-]+)-notes>/g)].map(m=>m[1]);
const bodies=new Map(markerNames.map(name=>[name,markerBlock(source,name).body]));
const liveMarker=(song,difficultyId)=>{
  const chart=song.difficulties[difficultyId];
  if(!chart||!Array.isArray(chart.notes)||!chart.notes.length)return null;
  const rendered=renderBlock(chart.notes);
  const hit=[...bodies.entries()].filter(([,body])=>body===rendered).map(([name])=>name);
  return hit.length===1?hit[0]:null;
};

const report=swingReport();
const targets=report.rows.filter(r=>r.over&&(includeEvent||!r.heldByEvent));
const heldSkipped=includeEvent?[]:report.rows.filter(r=>r.over&&r.heldByEvent);
if(includeEvent){
  const onEvent=targets.filter(r=>r.heldByEvent);
  if(onEvent.length)console.log(`★イベント開催中の曲も対象にします(--include-event): ${onEvent.length}本\n`);
}
if(!targets.length){
  console.log('外すものはありません。');
  process.exit(0);
}
const byChart=new Map();
for(const t of targets){
  const key=`${t.songId}::${t.difficulty}`;
  if(!byChart.has(key))byChart.set(key,[]);
  byChart.get(key).push(t);
}

// 同じ譜面を2曲が共有していることがある(例: six_eternel_remix と six_eternel_remix_beat)。
// マーカーでまとめてから1回だけ書き換える(2回書くと、あとの書き換えが前のを取り消す)。
const byMarker=new Map();
let failed=0;
for(const [key,rows] of byChart){
  const [songId,difficulty]=key.split('::');
  const song=rt.RHYTHM_SONGS.find(s=>s.songId===songId);
  const marker=song?liveMarker(song,difficulty):null;
  if(!marker){
    console.error(`NG: ${songId} ${difficulty} の譜面がどのマーカーか決められません(手で直してください)`);
    failed++;continue;
  }
  if(!byMarker.has(marker))byMarker.set(marker,{notes:song.difficulties[difficulty].notes,rows:[],labels:[]});
  const entry=byMarker.get(marker);
  entry.rows.push(...rows);
  entry.labels.push(`${songId} ${difficulty}`);
}
let removed=0;
for(const [marker,entry] of byMarker){
  const notes=entry.notes.map(note=>{
    const hit=entry.rows.some(r=>Number(note.timeMs)===r.timeMs&&Number(note.endTimeMs??note.timeMs)===r.endTimeMs);
    if(!hit||note.endFlick!==true)return note;
    removed++;
    const {endFlick,...rest}=note;
    return rest;
  });
  const count=entry.notes.filter(n=>n.endFlick===true).length-notes.filter(n=>n.endFlick===true).length;
  console.log(`${entry.labels.join(' / ')} (${marker}): ${count}本`);
  if(write)source=replaceBlock(source,marker,notes);
}
const charts=byMarker.size;
if(failed){
  console.error(`\n${failed}件はマーカーが決められませんでした。何も書き換えていません。`);
  process.exit(1);
}
console.log(`\n${charts}譜面 / ${removed}本の終点フリックを外${write?'しました':'せます'}。`);
if(heldSkipped.length)console.log(`イベント開催中の曲の ${heldSkipped.length}本 は残してあります(--include-event で外せます)。`);
if(write){
  fs.writeFileSync(RUNTIME,source);
  console.log('書き換えました。node tools/build.js と検査を通してください。');
}else{
  console.log('実際に外すには --write を付けてください。');
}
