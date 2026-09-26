#!/usr/bin/env node
// 譜面メモ(遊んだ感想)を取り込み、良い／変と言われた区間に何が多いかを数える(2026-09-26)。
//
//   node tools/mode/rhythm-chart-feedback.js --import <file>     # 結果画面の「コピー」で渡された JSON を取り込む
//   pbpaste | node tools/mode/rhythm-chart-feedback.js --import -  # 標準入力から(1件でも、複数行でもよい)
//   node tools/mode/rhythm-chart-feedback.js --report            # 👍の区間と👎の区間を比べる
//   node tools/mode/rhythm-chart-feedback.js --report --json
//
// 【なぜ要るか】ユーザー指示「遊んだ感想を譜面に残す仕組みも」。
// 自動譜面を「学習」させるには、人が遊んで良いと確かめた譜面が要る(docs/spec/RHYTHM_CHART_CORPUS.md)。
// ここは、その手本をためる入口と、たまった手本から「良い区間／変な区間に何が多いか」を数える道具。
//   ・取り込んだメモは tools/mode/authoring/feedback/<音源の一覧のid>-<難易度>.json へ(ゲームは読まない)
//   ・メモには譜面の指紋(fingerprint)が付いている。譜面を作り直したあとのメモと混ざらないよう、
//     いまの公開譜面と指紋が違うメモは「作り直す前の譜面へのメモ」として数え分ける
// 数えるだけで、生成器へはまだ効かせない。たまってから、コーパスの点数として足す(設計どおり)。
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const {loadRuntime,RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const FEEDBACK_DIR=path.join(ROOT,'tools/mode/authoring/feedback');
const MARKS=new Set(['','good','bad']);

// ランタイムの譜面メモ(30-rhythm-play.jsx の rhythmChartFingerprint)と同じ式
const fingerprintOf=chart=>{
  const notes=Array.isArray(chart?.notes)?chart.notes:[];
  const times=notes.map(note=>Number(note.timeMs)).filter(Number.isFinite).sort((a,b)=>a-b);
  return `${notes.length}:${times.length?Math.round(times[0]):0}:${times.length?Math.round(times[times.length-1]):0}`;
};

// 貼られた文字列から、メモのJSONを1件ずつ取り出す。JSONそのもの(1件・配列)／1行に1件／前後に文章が混ざった形のどれでもよい
const parseNotes=text=>{
  const found=[];
  const take=value=>{for(const item of Array.isArray(value)?value:[value])if(item&&item.kind==='monhero-rhythm-chart-note')found.push(item);};
  try{take(JSON.parse(String(text)));return found;}catch{/* 次の読み方へ */}
  for(const line of String(text).split(/\r?\n/)){
    const at=line.indexOf('{'),end=line.lastIndexOf('}');
    if(at<0||end<=at)continue;
    try{take(JSON.parse(line.slice(at,end+1)));}catch{/* 壊れた1件は飛ばす */}
  }
  return found;
};
const validNote=note=>note&&note.kind==='monhero-rhythm-chart-note'&&typeof note.songId==='string'&&note.songId
  &&typeof note.difficulty==='string'&&Array.isArray(note.marks)&&note.marks.every(mark=>MARKS.has(mark))
  &&Number.isFinite(Number(note.segmentMs))&&Number(note.segmentMs)>0;

const fileFor=(trackId,difficulty)=>path.join(FEEDBACK_DIR,`${trackId}-${difficulty.toLowerCase()}.json`);
const readList=file=>{try{const value=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(value)?value:[];}catch{return [];}};

const importNotes=text=>{
  const notes=parseNotes(text);
  if(!notes.length){console.error('譜面メモが見つかりません（結果画面の「コピー」で出た文字をそのまま渡してください）');process.exit(1);}
  fs.mkdirSync(FEEDBACK_DIR,{recursive:true});
  let added=0,skipped=0;
  for(const note of notes){
    if(!validNote(note)){skipped++;continue;}
    const trackId=RELEASED_TRACKS[note.songId];
    if(!trackId){console.log(`  × ${note.songId}: 公開曲の一覧にない曲です`);skipped++;continue;}
    const file=fileFor(trackId,note.difficulty);
    const list=readList(file);
    if(list.some(entry=>entry.savedAt===note.savedAt&&entry.fingerprint===note.fingerprint)){skipped++;continue;}
    list.push({...note,importedAt:new Date().toISOString()});
    fs.writeFileSync(file,JSON.stringify(list,null,1)+'\n');
    added++;
    const good=note.marks.filter(mark=>mark==='good').length,bad=note.marks.filter(mark=>mark==='bad').length;
    console.log(`  ✓ ${note.displayName||note.songId} ${note.difficulty}: 👍${good}区間 👎${bad}区間${note.memo?` ／ メモ「${note.memo}」`:''}`);
  }
  console.log(`取り込み: ${added}件（重複・不正 ${skipped}件）→ ${path.relative(ROOT,FEEDBACK_DIR)}/`);
};

// 1区間に入っているノーツの特徴(公開中の譜面から数える)
const segmentFeatures=(chart,fromMs,toMs)=>{
  const notes=(chart.notes||[]).filter(note=>note.timeMs>=fromMs&&note.timeMs<toMs);
  const byTime=new Map();for(const note of notes)byTime.set(note.timeMs,(byTime.get(note.timeMs)||0)+1);
  const count=type=>notes.filter(note=>note.type===type).length;
  return {notes:notes.length,perSecond:notes.length/((toMs-fromMs)/1000),
    TAP:count('TAP'),FLICK:count('FLICK'),HOLD:count('HOLD'),SLIDE:count('SLIDE'),
    sideFlick:notes.filter(note=>note.flickDir==='left'||note.flickDir==='right').length,
    chords:[...byTime.values()].filter(n=>n>=2).length};
};

const report=()=>{
  const files=fs.existsSync(FEEDBACK_DIR)?fs.readdirSync(FEEDBACK_DIR).filter(f=>f.endsWith('.json')):[];
  if(!files.length){console.log('譜面メモはまだありません（--import で取り込みます）');return null;}
  const rt=loadRuntime();
  const trackToSong=Object.fromEntries(Object.entries(RELEASED_TRACKS).map(([song,track])=>[track,song]));
  const sum={good:{segments:0},bad:{segments:0}};
  const add=(bucket,features)=>{bucket.segments++;for(const [k,v] of Object.entries(features))bucket[k]=(bucket[k]||0)+v;};
  const rows=[];let stale=0;
  for(const file of files){
    for(const note of readList(path.join(FEEDBACK_DIR,file))){
      if(!validNote(note))continue;
      const song=rt.RHYTHM_SONGS.find(entry=>entry.songId===note.songId);
      const chart=song&&song.difficulties[note.difficulty];
      if(!chart){continue;}
      const current=fingerprintOf(chart)===note.fingerprint;
      if(!current){stale++;continue;}
      note.marks.forEach((mark,i)=>{
        if(!mark)return;
        const fromMs=i*note.segmentMs,toMs=fromMs+note.segmentMs;
        add(sum[mark],segmentFeatures(chart,fromMs,toMs));
      });
      rows.push(`${note.displayName||note.songId} ${note.difficulty}: 👍${note.marks.filter(m=>m==='good').length} 👎${note.marks.filter(m=>m==='bad').length}${note.memo?`「${note.memo}」`:''}`);
    }
  }
  const per=(bucket,key)=>bucket.segments?(bucket[key]||0)/bucket.segments:0;
  const out={segments:{good:sum.good.segments,bad:sum.bad.segments},stale,
    perSegment:Object.fromEntries(['notes','TAP','FLICK','HOLD','SLIDE','sideFlick','chords'].map(key=>[key,{good:per(sum.good,key),bad:per(sum.bad,key)}]))};
  if(process.argv.includes('--json')){console.log(JSON.stringify(out,null,1));return out;}
  console.log('譜面メモ');for(const row of rows)console.log(`  ${row}`);
  if(stale)console.log(`  （作り直す前の譜面へのメモ ${stale}件は数えていません）`);
  console.log(`\n1区間あたりの平均（👍 ${out.segments.good}区間 ／ 👎 ${out.segments.bad}区間）`);
  for(const [key,value] of Object.entries(out.perSegment))console.log(`  ${key.padEnd(9)} 👍 ${value.good.toFixed(2).padStart(6)}   👎 ${value.bad.toFixed(2).padStart(6)}`);
  return out;
};

module.exports={parseNotes,validNote,fingerprintOf,segmentFeatures};

if(require.main===module){
  const source=arg('--import');
  if(source!=null)importNotes(source==='-'?fs.readFileSync(0,'utf8'):fs.readFileSync(path.resolve(source),'utf8'));
  else if(process.argv.includes('--report'))report();
  else{console.log('使い方: --import <file|-> / --report');}
}
