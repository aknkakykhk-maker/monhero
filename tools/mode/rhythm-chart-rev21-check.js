#!/usr/bin/env node
// MHB CHART ENGINE Rev.21(テンポの揺れに合わせる・2026-09-29・rhythm-chart-tempo-warp.js)を見張る。
//   ・揺れに合わせるのは、なめらかに揺れていて、半分の区間から測った揺れが残りの半分にも当てはまる曲だけ
//   ・揺れていない曲は Rev.20 と同じ譜面
//   ・揺れに合わせた曲は、ノーツの時刻(揺れを足した時刻)が、もとの音の時刻へ近づく
//   ・作り物の曲: ゆっくり揺れる曲は揺れを見つけ、ずれがでたらめな曲・揺れの無い曲は見つけない
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const {tempoWarp,tempoWarpForChart}=require('./rhythm-chart-tempo-warp.js');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.21 以上',CHART_REVISION_CODE_LATEST>=21);

// --- 作り物の曲 ---
{
  const timing={bpm:150,beatMs:400,beatZeroMs:0,beatsPerBar:4,subdivisionsPerBeat:4,gridMs:100};
  // seed を決めた乱数(同じ結果になるように)
  let seed=7;const rand=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
  const song=offsetOf=>{
    const onsets=[];
    for(let grid=0;grid<16*96;grid+=2){
      const offset=offsetOf(grid)+(rand()-.5)*6;
      onsets.push({grid,timeMs:grid*100+offset,gridOffsetMs:offset,strength:.4+rand()*.5,share:{low:.1}});
    }
    return {timing,onsets};
  };
  const drift=tempoWarp(song(grid=>25*Math.sin(grid/(16*96)*2*Math.PI)));
  ok('ゆっくり揺れる曲は揺れを見つける',drift.active,drift.reason);
  const noise=tempoWarp(song(grid=>((Math.floor(grid/64)*7919)%41)-20));
  ok('区間ごとのずれがでたらめな曲は見つけない',!noise.active,noise.reason);
  const flat=tempoWarp(song(()=>0));
  ok('揺れの無い曲は見つけない',!flat.active,flat.reason);
  ok('Rev.20 以前の譜面には揺れを使わない',!tempoWarpForChart({chartRevision:20},song(grid=>25*Math.sin(grid/(16*96)*2*Math.PI))).active);
}

// --- 実際の曲 ---
const read=file=>JSON.parse(fs.readFileSync(path.join(__dirname,'authoring',file),'utf8'));
const registry=read('rhythm-song-registry.json').songs;
const active=[];
for(const trackId of Object.keys(registry)){
  const file=path.join(__dirname,'authoring',`${trackId.replace(/_/g,'-')}-v3-audio.json`);
  if(fs.existsSync(file)&&tempoWarp(JSON.parse(fs.readFileSync(file,'utf8'))).active)active.push(trackId);
}
ok('揺れに合わせるのは、確かめの通った曲だけ(いまは2曲)',active.join(',')==='six_eternel_remix_beat,the_city_beneath_the_comets',active.join(' / '));

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev21-'));
try{
  const generate=(trackId,revision)=>{
    const dir=path.join(tmp,`${trackId}-${revision}`);fs.mkdirSync(dir);
    spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--chart-revision',String(revision),'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
    return difficulty=>JSON.parse(fs.readFileSync(path.join(dir,`${trackId.replace(/_/g,'-')}-v3-chart-${difficulty}.json`),'utf8'));
  };
  // 揺れていない曲は同じ
  const a=generate('dullahan',20),b=generate('dullahan',21);
  const strip=chart=>JSON.stringify(chart.notes);
  ok('揺れていない曲は Rev.20 と同じノーツ',['easy','master'].every(d=>strip(a(d))===strip(b(d))));
  // 揺れに合わせた曲は、ノーツの時刻が音へ近づく(ノーツのもとになった打点の時刻との差)
  for(const trackId of active){
    const audio=read(`${trackId.replace(/_/g,'-')}-v3-audio.json`);
    const timing=audio.timing,gridMs=timing.gridMs||timing.beatMs/timing.subdivisionsPerBeat;
    const byTime=[...audio.onsets].sort((x,y)=>x.timeMs-y.timeMs);
    const nearest=ms=>{let lo=0,hi=byTime.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(byTime[mid].timeMs<ms)lo=mid+1;else hi=mid;}
      return Math.min(...[byTime[lo-1],byTime[lo]].filter(Boolean).map(o=>Math.abs(o.timeMs-ms)));};
    const within=(chart,warp)=>{const notes=chart.notes.filter(n=>n.type==='TAP');
      return notes.filter(n=>nearest(timing.beatZeroMs+n.grid*gridMs+warp.at(n.grid))<=15).length/notes.length;};
    const old=generate(trackId,20)('hard'),next=generate(trackId,21)('hard');
    const before=within(old,{at:()=>0}),after=within(next,tempoWarpForChart(next,audio));
    ok(`${trackId}: HARD のノーツが音から15ms以内にある割合が上がる`,after>before,`${(before*100).toFixed(1)}% → ${(after*100).toFixed(1)}%`);
  }
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

const pipeline=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-pipeline.js'),'utf8');
ok('書き出す時刻に揺れを足す',/const gridTimeMs=grid=>Math\.round\(timing\.beatZeroMs\+grid\*gridMs\+warp\.at\(grid\)\);/.test(pipeline));
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.21(テンポの揺れに合わせる)は期待どおり');
process.exit(failed?1:0);
