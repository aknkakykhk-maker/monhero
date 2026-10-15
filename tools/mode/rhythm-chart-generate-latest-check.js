#!/usr/bin/env node
// 譜面の作り方は最新リビジョンだけ、を見張る(2026-10-12 社長「段階を分けず、一気に古い版を外して最新だけにする」)。
//
//   node tools/mode/rhythm-chart-generate-latest-check.js
//
// 見ること:
//   ・生成器へ最新以外の --chart-revision を渡すと止まる(古い作り方は git の記録から取り出す・tools/mode/CLAUDE.md ⑩-2)
//   ・作った譜面の chartRevision は最新リビジョン
//   ・どの難易度もモンスターノーツが4個ちょうど(枠1〜4を1個ずつ。2026-10-11 社長「どの曲も基本4個入るルールだよ」・前の rev29-check)
// 公開中の譜面は生成器を通らないので、ここでは見ない(rhythm-released-chart-lock-check.js が指紋で見張る)
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../..');
const {CHART_REVISION_LATEST}=require('./rhythm-chart-v3-revision.js');

let failed=0;
const ok=(name,pass,detail='')=>{console.log(`${pass?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!pass)failed++;};

const trackId='monster_hero_theme',dashed='monster-hero-theme';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-latest-'));
const generate=(dir,extra=[])=>spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--write','--output-dir',dir,...extra],
  {cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
try{
  const old=path.join(tmp,'old');fs.mkdirSync(old);
  const refused=generate(old,['--chart-revision','21']);
  ok('最新以外の --chart-revision を渡すと止まり、何も書かない',refused.status!==0&&fs.readdirSync(old).length===0,String(refused.stderr||'').split('\n').find(l=>l.includes('作れない'))||'');
  const dir=path.join(tmp,'latest');fs.mkdirSync(dir);
  const made=generate(dir);
  ok('最新リビジョンで作れる',made.status===0,String(made.stderr||'').split('\n')[0]);
  if(made.status===0){
    const charts=Object.fromEntries(['easy','normal','hard','expert','master'].map(d=>[d,JSON.parse(fs.readFileSync(path.join(dir,`${dashed}-v3-chart-${d}.json`),'utf8'))]));
    ok(`作った譜面の chartRevision は最新(Rev.${CHART_REVISION_LATEST})`,Object.values(charts).every(c=>c.chartRevision===CHART_REVISION_LATEST),
      Object.values(charts).map(c=>c.chartRevision).join(','));
    const slots=Object.fromEntries(Object.entries(charts).map(([d,c])=>[d,(c.notes||[]).filter(n=>Number(n.monsterSlot)>0).map(n=>Number(n.monsterSlot)).sort((a,b)=>a-b).join(',')]));
    ok('どの難易度もモンスターノーツは枠1〜4を1個ずつ',Object.values(slots).every(s=>s==='1,2,3,4'),JSON.stringify(slots));
  }
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

if(failed){console.log(`\n${failed}件のNGがあります`);process.exit(1);}
console.log('\nすべてOK');
