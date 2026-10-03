#!/usr/bin/env node
// MHB CHART ENGINE Rev.23(テンポの揺れの読み方の v2・2026-09-29・rhythm-chart-tempo-warp.js)を見張る。
//   ・v2 で揺れに合わせるのは、ビッグブリッヂの死闘と SIX ÉTERNEL ドパガキリミックスだけ
//   ・格子の乗り換えを重ねた間違った坂(Monster Hero -Another-)や、格子に比べて大きすぎる揺れ(SIX ÉTERNEL)は拾わない
//   ・Rev.21 の読み方で揺れに合わせていた曲は、Rev.23 でも外れない(v2 で当たらなければ Rev.21 の読み方)
//   ・ビッグブリッヂの死闘: ノーツが音から15ms以内にある割合が上がる。揺れていない曲は Rev.22 と同じ譜面
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const {tempoWarp,tempoWarpForRevision,tempoWarpForChart}=require('./rhythm-chart-tempo-warp.js');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.23 以上',CHART_REVISION_CODE_LATEST>=23);

const dir=path.join(__dirname,'authoring');
const registry=JSON.parse(fs.readFileSync(path.join(dir,'rhythm-song-registry.json'),'utf8')).songs;
const audioOf=trackId=>JSON.parse(fs.readFileSync(path.join(dir,`${trackId.replace(/_/g,'-')}-v3-audio.json`),'utf8'));
const v2=[],v1=[],rev23=[];
for(const trackId of Object.keys(registry)){
  if(!fs.existsSync(path.join(dir,`${trackId.replace(/_/g,'-')}-v3-audio.json`)))continue;
  const audio=audioOf(trackId);
  if(tempoWarp(audio,{v2:true}).active)v2.push(trackId);
  if(tempoWarp(audio).active)v1.push(trackId);
  if(tempoWarpForRevision(23,audio).active)rev23.push(trackId);
}
ok('v2 で揺れに合わせるのは2曲',v2.sort().join(',')==='big_bridge_no_shitou,six_eternel_remix_beat',v2.join(' / '));
ok('Rev.21 の読み方は変わらない(2曲)',v1.sort().join(',')==='six_eternel_remix_beat,the_city_beneath_the_comets',v1.join(' / '));
ok('Rev.23 では Rev.21 で合わせていた曲も外れない(3曲)',rev23.sort().join(',')==='big_bridge_no_shitou,six_eternel_remix_beat,the_city_beneath_the_comets',rev23.join(' / '));
{
  const reason=tempoWarp(audioOf('monster_hero_theme_alt'),{v2:true}).reason;
  ok('間違った坂は拾わない(Monster Hero -Another-)',/大きすぎる/.test(reason),reason);
}

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev23-'));
try{
  const generate=(trackId,revision)=>{
    const out=path.join(tmp,`${trackId}-${revision}`);fs.mkdirSync(out);
    spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--chart-revision',String(revision),'--write','--output-dir',out],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
    return difficulty=>JSON.parse(fs.readFileSync(path.join(out,`${trackId.replace(/_/g,'-')}-v3-chart-${difficulty}.json`),'utf8'));
  };
  const a=generate('dullahan',22),b=generate('dullahan',23);
  ok('揺れていない曲は Rev.22 と同じノーツ',['easy','master'].every(d=>JSON.stringify(a(d).notes)===JSON.stringify(b(d).notes)));
  const audio=audioOf('big_bridge_no_shitou'),timing=audio.timing,gridMs=timing.gridMs||timing.beatMs/timing.subdivisionsPerBeat;
  const byTime=[...audio.onsets].sort((x,y)=>x.timeMs-y.timeMs);
  const nearest=ms=>{let lo=0,hi=byTime.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(byTime[mid].timeMs<ms)lo=mid+1;else hi=mid;}
    return Math.min(...[byTime[lo-1],byTime[lo]].filter(Boolean).map(o=>Math.abs(o.timeMs-ms)));};
  const within=(chart,fromMs=0,toMs=Infinity)=>{const warp=tempoWarpForChart(chart,audio);
    const notes=chart.notes.filter(n=>n.type==='TAP').map(n=>timing.beatZeroMs+n.grid*gridMs+warp.at(n.grid)).filter(ms=>ms>=fromMs&&ms<toMs);
    return notes.filter(ms=>nearest(ms)<=15).length/Math.max(1,notes.length);};
  const old=generate('big_bridge_no_shitou',22)('hard'),next=generate('big_bridge_no_shitou',23)('hard');
  const introBefore=within(old,0,25000),introAfter=within(next,0,25000);
  ok('ビッグブリッヂの死闘 HARD: イントロ(はじめの25秒)のノーツが音から15ms以内にある割合が上がる',introAfter>introBefore+.15,`${(introBefore*100).toFixed(0)}% → ${(introAfter*100).toFixed(0)}%`);
  ok('ビッグブリッヂの死闘 HARD: 曲全体でも下がらない',within(next)>=within(old),`${(within(old)*100).toFixed(1)}% → ${(within(next)*100).toFixed(1)}%`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.23(テンポの揺れの読み方の v2)は期待どおり');
process.exit(failed?1:0);
