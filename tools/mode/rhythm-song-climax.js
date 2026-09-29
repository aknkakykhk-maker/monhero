#!/usr/bin/env node
// 曲ごとの「盛り上がる区間」の表(RHYTHM_SONG_CLIMAX・monster-hero/data/rhythm-mode.js)を作る(2026-09-29)。
//
//   node tools/mode/rhythm-song-climax.js            # 表の中身を出すだけ
//   node tools/mode/rhythm-song-climax.js --write    # rhythm-mode.js の <rhythm-song-climax> の間を書き換える
//   node tools/mode/rhythm-song-climax.js --check    # いまの表が解析と合っているか(検査用・合わなければ終了コード1)
//
// 【なぜ要るか】ユーザー判断(参考動画を見て「盛り上がりで光の筋」を採用・既定OFF)。
// 演奏中、サビなど盛り上がる区切りに入ると、道の両側に光の筋が流れる(オプション「盛り上がりの光」)。
// 盛り上がりは音源の解析(*-v3-audio.json の structure.sections[].intensity)がもう持っているので、それを写す。
// 見た目にだけ使い、判定・スコア・譜面には関わらない。
//
// 【決め方】その曲(演奏する範囲)でいちばん盛り上がる区切りの強さの CLIMAX_RATIO 倍以上の区切りを選び、続いていればつなげる。
// つないでも2小節に届かない区間は出さない。
// 強さ(0.6〜1)は、選ばれた中での盛り上がりの順に比例する(いちばん盛り上がる所ほど光が濃い)。
// 譜面を途中までにしている曲(一覧の playEndMs)は、そこで切る。
'use strict';
const fs=require('fs'),path=require('path');
const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');

const ROOT=path.resolve(__dirname,'..','..');
const RUNTIME=path.join(ROOT,'monster-hero/data/rhythm-mode.js');
const CLIMAX_RATIO=.8,CLIMAX_MIN_INTENSITY=.5,CLIMAX_MIN_BARS=2;
const START='// <rhythm-song-climax>',END='// </rhythm-song-climax>';

const climaxOf=(audio,entry={})=>{
  const sections=(audio.structure&&audio.structure.sections)||[];
  const timing=audio.timing||{};
  const barMs=Number(timing.beatMs)*Number(timing.beatsPerBar);
  if(!sections.length||!(barMs>0))return [];
  const endLimit=Number(entry.playEndMs)>0?Number(entry.playEndMs):Number(audio.durationMs)||Infinity;
  const startOf=section=>Number(timing.beatZeroMs)+section.startBar*barMs;
  // いちばん盛り上がる所は、演奏する範囲(playEndMs まで)の中で決める
  const played=sections.filter(section=>startOf(section)<endLimit);
  if(!played.length)return [];
  const max=Math.max(...played.map(s=>Number(s.intensity)||0));
  const threshold=Math.max(CLIMAX_MIN_INTENSITY,max*CLIMAX_RATIO);
  const spans=[];
  for(const section of played){
    const intensity=Number(section.intensity)||0;
    if(intensity<threshold)continue;
    const start=Math.round(Number(timing.beatZeroMs)+section.startBar*barMs);
    const end=Math.min(endLimit,Math.round(Number(timing.beatZeroMs)+section.endBarExclusive*barMs));
    if(!(end>start))continue;
    const strength=Math.round((.6+.4*(max>threshold?(intensity-threshold)/(max-threshold):1))*100)/100;
    const last=spans[spans.length-1];
    if(last&&start-last[1]<=barMs/2){last[1]=end;last[2]=Math.max(last[2],strength);}
    else spans.push([start,end,strength]);
  }
  // 短すぎる区間(2小節未満)は、光がちらつくだけなので出さない
  return spans.filter(([start,end])=>end-start>=barMs*CLIMAX_MIN_BARS);
};

const buildTable=()=>{
  const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring/rhythm-song-registry.json'),'utf8')).songs;
  const rows=[];
  for(const [songId,trackId] of Object.entries(RELEASED_TRACKS)){
    const file=path.join(ROOT,'tools/mode/authoring',`${trackId.replace(/_/g,'-')}-v3-audio.json`);
    if(!fs.existsSync(file))continue;
    const spans=climaxOf(JSON.parse(fs.readFileSync(file,'utf8')),registry[trackId]||{});
    const key=/^[a-z_][a-z0-9_]*$/i.test(songId)&&!/^\d/.test(songId)?songId:`'${songId}'`;
    rows.push(`  ${key}:${JSON.stringify(spans)},`);
  }
  return rows.join('\n');
};

module.exports={climaxOf,CLIMAX_RATIO};

if(require.main===module){
  const table=buildTable();
  const source=fs.readFileSync(RUNTIME,'utf8');
  const a=source.indexOf(START),b=source.indexOf(END);
  if(process.argv.includes('--check')){
    const current=a>=0&&b>a?source.slice(a+START.length+1,b).trimEnd():'';
    const same=current===table;
    console.log(same?'OK: 盛り上がる区間の表は解析と合っている':'NG: 盛り上がる区間の表が古い(node tools/mode/rhythm-song-climax.js --write)');
    process.exit(same?0:1);
  }
  if(process.argv.includes('--write')){
    if(!(a>=0&&b>a)){console.error(`${path.relative(ROOT,RUNTIME)} に ${START} がありません`);process.exit(1);}
    fs.writeFileSync(RUNTIME,source.slice(0,a+START.length)+'\n'+table+'\n'+source.slice(b));
    console.log(`書き出し: ${path.relative(ROOT,RUNTIME)}`);
  }else console.log(table);
}
