#!/usr/bin/env node
// MHB CHART ENGINE Rev.22(曲の終わりの余韻・2026-09-29・rhythm-chart-ending.js)を見張る。
//   ・余韻で締めるのは、最後の一発のあと鳴り残る音が消えていく曲だけ(いまは4曲)
//   ・当たる曲: 最後の一発より後にノーツを置かず、最後のノーツは最後の一発から始まる太い長押し。押せない配置を作らない
//   ・当たらない曲は Rev.21 と同じ譜面
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const {fadingEnding}=require('./rhythm-chart-ending.js');
const {measureFeel}=require('./rhythm-chart-feel-report.js');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.22 以上',CHART_REVISION_CODE_LATEST>=22);

const dir=path.join(__dirname,'authoring');
const registry=JSON.parse(fs.readFileSync(path.join(dir,'rhythm-song-registry.json'),'utf8')).songs;
const active=[];
for(const [trackId,entry] of Object.entries(registry)){
  const file=path.join(dir,`${trackId.replace(/_/g,'-')}-v3-audio.json`);
  if(fs.existsSync(file)&&fadingEnding(JSON.parse(fs.readFileSync(file,'utf8')),{chartEndMs:Number(entry.playEndMs)||Infinity}).active)active.push(trackId);
}
ok('余韻で締めるのは4曲',active.sort().join(',')==='big_bridge_no_shitou,crossing_field,eiki_boss_remix,mou_hitotsu_no_sekai_e',active.join(' / '));

// 作り物: 強い音が続いたあと、最後の一発で消えていく曲 / 最後まで鳴っている曲
{
  const make=fade=>{const onsets=[];for(let ms=500;ms<60000;ms+=250){const inTail=fade&&ms>50000;onsets.push({timeMs:ms,strength:inTail?(ms===50250?.9:.02):(ms%1000===500?.9:.4)});}
    return {durationMs:60000,onsets};};
  const faded=fadingEnding(make(true));
  ok('最後の一発で消えていく曲は余韻で締める',faded.active&&Math.abs(faded.lastHitMs-50250)<1,faded.reason);
  ok('最後まで鳴っている曲は余韻で締めない',!fadingEnding(make(false)).active);
  ok('譜面の終わりが余韻より前の曲は締めない',!fadingEnding(make(true),{chartEndMs:40000}).active);
}

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev22-'));
try{
  const generate=(trackId,revision)=>{
    const out=path.join(tmp,`${trackId}-${revision}`);fs.mkdirSync(out);
    spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--chart-revision',String(revision),'--write','--output-dir',out],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
    return difficulty=>JSON.parse(fs.readFileSync(path.join(out,`${trackId.replace(/_/g,'-')}-v3-chart-${difficulty}.json`),'utf8'));
  };
  const a=generate('dullahan',21),b=generate('dullahan',22);
  ok('余韻で締めない曲は Rev.21 と同じノーツ',['easy','master'].every(d=>JSON.stringify(a(d).notes)===JSON.stringify(b(d).notes)));
  const audio=JSON.parse(fs.readFileSync(path.join(dir,'big-bridge-no-shitou-v3-audio.json'),'utf8'));
  const ending=fadingEnding(audio);
  const chart=generate('big_bridge_no_shitou',22);
  for(const difficulty of ['easy','normal','hard','expert','master']){
    const c=chart(difficulty),t=audio.timing,gridMs=t.gridMs||t.beatMs/t.subdivisionsPerBeat;
    const lastGrid=Math.round((ending.lastHitMs-t.beatZeroMs)/gridMs);
    const after=c.notes.filter(note=>note.grid>lastGrid).length;
    const final=c.notes.find(note=>note.endingHold);
    const feel=measureFeel(c,audio,{withQuality:false});
    ok(`ビッグブリッヂの死闘 ${difficulty}: 最後の一発の後に置かず、最後の一発から始まる太い長押しで締める・押せない配置0`,
      after===0&&final&&final.type==='HOLD'&&final.grid===lastGrid&&final.durationGrids>=t.subdivisionsPerBeat&&final.subLaneWidth>=2&&feel.impossible===0,
      `後ろ ${after}個・長押し ${final?`${final.durationGrids}グリッド 幅${final.subLaneWidth}`:'無し'}・押せない ${feel.impossible}`);
  }
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.22(曲の終わりの余韻)は期待どおり');
process.exit(failed?1:0);
