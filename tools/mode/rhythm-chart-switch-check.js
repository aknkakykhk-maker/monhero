#!/usr/bin/env node
// 時刻で入れ替わる譜面（RHYTHM_SWITCHING_CHARTS）が、正しく切り替わるか。
//
//   node tools/mode/rhythm-chart-switch-check.js
//
// 【なぜ要るか】(2026-09-13・ユーザー指示
// 「イベント終わると同時の時刻で最新譜面に変わるようにできる？」)
// 週末ゲリラ杯の対象3曲だけ、イベント中は譜面を変えずに出していた。
// イベントの終わり(=週の区切り)と同時に、新しい生成器で作った譜面へ入れ替える。
//
// この仕掛けでいちばん危ないのは、**読み込み時に1回だけ答えを決めてしまうこと**。
// 開始前に起動して開きっぱなしの端末では、その答えが永久に残る
// (運用ルール⑥-4。前回のイベントで enabled と告知IDの2か所で実際に踏んだ)。
// 「見るたびに数え直す」形のままかを、ここで見張る。
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const runtimeSource=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const eventSource=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-event.js'),'utf8');

// 切り替えの時刻を、指定した答えで読み込む
const load=forced=>{
  const context={Object,Number,Math,JSON,Array,String,Date,__MH_RHYTHM_CHART_SWITCH:forced||null};
  vm.runInNewContext(`${runtimeSource}
this.out={RHYTHM_SONGS,RHYTHM_DIFFICULTIES,RHYTHM_SWITCHING_CHARTS,RHYTHM_CHART_SWITCH_AT_MS,
  rhythmChartSwitchDone,rhythmChartSwitchHold};`,context);
  return context.out;
};

const before=load('before');
const after=load('after');
const switching=Object.keys(before.RHYTHM_SWITCHING_CHARTS||{});
ok('入れ替わる曲が登録されている',switching.length>0,switching.join(' / ')||'RHYTHM_SWITCHING_CHARTS が空');

// ── ① 切り替えの時刻が、イベントの終わりと同じか ────────────────────────────
// ここがずれると「イベント中に譜面が変わる」か「終わっても古いまま」になる。
const eventEnd=/endAt:\s*'([^']+)'/.exec(eventSource);
const switchAt=/RHYTHM_CHART_SWITCH_AT_MS=\(typeof Date[^)]*\)\?Date\.parse\('([^']+)'\)/.exec(runtimeSource);
ok('切り替えの時刻が書いてある',!!switchAt,switchAt?switchAt[1]:'Date.parse(...) が見つからない');
if(switchAt&&eventEnd){
  ok('切り替えの時刻が、イベントの終わりと同じ',
    Date.parse(switchAt[1])===Date.parse(eventEnd[1]),
    `譜面=${switchAt[1]} / イベント=${eventEnd[1]}`);
}

// ── ② 見るたびに数え直しているか ───────────────────────────────────────────
// RHYTHM_SONGS は起動時に1回だけ組み立てて freeze するので、そこで答えを決めると
// 開きっぱなしの端末で切り替わらない。難易度が getter になっていることを見る。
const sample=before.RHYTHM_SONGS.find(song=>switching.includes(song.songId));
ok('入れ替わる曲が RHYTHM_SONGS にある',!!sample,switching.join(' / '));
if(sample){
  const desc=Object.getOwnPropertyDescriptor(sample.difficulties,'MASTER');
  ok('譜面を「参照するたびに」選んでいる（getter になっている）',!!(desc&&typeof desc.get==='function'),
    desc&&typeof desc.value!=='undefined'?'値で固めてある（読み込み時に決まってしまう）':'');
}

// ── ③ 前と後で、実際に譜面が変わるか ───────────────────────────────────────
const changed=[],same=[];
for(const songId of switching){
  const b=before.RHYTHM_SONGS.find(song=>song.songId===songId);
  const a=after.RHYTHM_SONGS.find(song=>song.songId===songId);
  if(!b||!a)continue;
  let differs=false;
  for(const {id} of before.RHYTHM_DIFFICULTIES){
    const bc=b.difficulties[id],ac=a.difficulties[id];
    if(!bc||!ac)continue;
    if(bc.notes.length!==ac.notes.length||JSON.stringify(bc.notes)!==JSON.stringify(ac.notes))differs=true;
  }
  (differs?changed:same).push(songId);
}
ok('切り替えの前後で、譜面が実際に入れ替わる',same.length===0,
  same.length?`同じままの曲: ${same.join(' / ')}`:`${changed.length}曲が入れ替わる`);

// ── ④ どちらの譜面も、遊べる形になっているか ───────────────────────────────
// ノーツが0件・時刻が逆・終わりが曲より後ろ、といった壊れ方をしていないこと。
const broken=[];
for(const [label,loaded] of [['切り替え前',before],['切り替え後',after]]){
  for(const songId of switching){
    const song=loaded.RHYTHM_SONGS.find(entry=>entry.songId===songId);
    if(!song)continue;
    for(const {id} of loaded.RHYTHM_DIFFICULTIES){
      const chart=song.difficulties[id];
      if(!chart)continue;
      if(!Array.isArray(chart.notes)||chart.notes.length===0){broken.push(`${label} ${songId} ${id}: ノーツが無い`);continue;}
      if(!Number.isFinite(chart.level)||chart.level<1)broken.push(`${label} ${songId} ${id}: レベルが無い`);
      let last=-1;
      for(const note of chart.notes){
        if(!Number.isFinite(note.timeMs)){broken.push(`${label} ${songId} ${id}: 時刻が数字でない`);break;}
        if(note.timeMs<last){broken.push(`${label} ${songId} ${id}: 時刻の順が逆`);break;}
        last=note.timeMs;
      }
    }
  }
}
ok('どちらの譜面も遊べる形になっている',broken.length===0,broken.slice(0,3).join(' / '));

// ── ⑤ 難易度の順が守られているか（どちらの側でも） ─────────────────────────
const unordered=[];
for(const [label,loaded] of [['切り替え前',before],['切り替え後',after]]){
  for(const songId of switching){
    const song=loaded.RHYTHM_SONGS.find(entry=>entry.songId===songId);
    if(!song)continue;
    const counts=loaded.RHYTHM_DIFFICULTIES
      .map(({id})=>({id,n:(song.difficulties[id]||{}).notes?.length||0}))
      .filter(row=>row.n>0);
    for(let i=1;i<counts.length;i++){
      if(counts[i].n<counts[i-1].n)
        unordered.push(`${label} ${songId}: ${counts[i-1].id}(${counts[i-1].n}) > ${counts[i].id}(${counts[i].n})`);
    }
  }
}
ok('難易度の順（上ほどノーツが多い）が守られている',unordered.length===0,unordered.slice(0,3).join(' / '));

// ── ⑥ 演奏のあいだは固定できるか ───────────────────────────────────────────
// 曲の途中で時刻をまたいでも、総ノーツ数とレベルが変わらないようにするための仕掛け。
ok('演奏のあいだ固定する仕掛けがある（rhythmChartSwitchHold）',
  typeof before.rhythmChartSwitchHold==='function');
const playSource=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');
ok('演奏画面が、出入りで固定を掛け外ししている',
  /rhythmChartSwitchHold\(true\)/.test(playSource)&&/rhythmChartSwitchHold\(false\)/.test(playSource),
  '30-rhythm-play.jsx の useEffect');

// ── ⑦ 旧譜面を消していないか ───────────────────────────────────────────────
// 切り替えの時刻より前に起動した端末のために、両方を持っておく必要がある。
const missingMarkers=[];
for(const marker of ['monster-hero-v3','kaze-ga-soyogu-v3','close-to-your-heart-v3',
                     'monster-hero-v4','kaze-ga-soyogu-v4','close-to-your-heart-v4']){
  for(const difficulty of ['easy','normal','hard','expert','master']){
    const tag=`<${marker}-${difficulty}-notes>`;
    if(!runtimeSource.includes(tag))missingMarkers.push(tag);
  }
}
ok('新旧どちらの譜面も残っている',missingMarkers.length===0,missingMarkers.slice(0,4).join(' / '));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
