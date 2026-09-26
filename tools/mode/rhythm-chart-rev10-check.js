#!/usr/bin/env node
// MHB CHART ENGINE Rev.10(動きの使い回しを避ける・2026-09-26・ROADMAP の段4)を見張る。
//   ・実際に Rev.9 と Rev.10 で作り、Rev.10 は「リズムの違う所で同じ動きの並び」(気持ちよさの物差しの単調さ)がはっきり減る
//   ・ノーツの数はほとんど変わらない(置き場所を選び直すだけ)・押せない配置を作らない
//   ・写しの数(同じフレーズは同じ形)は減らさない
'use strict';
const fs=require('fs');
const os=require('os');
const path=require('path');
const {spawnSync}=require('child_process');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');
const {measureFeel}=require('./rhythm-chart-feel-report.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

ok('作り方の最新は Rev.10 以上',CHART_REVISION_CODE_LATEST>=10);
{
  const source=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-generate.js'),'utf8');
  ok('写しと形の記憶は使い回しに数えない',/const mono=motionVariety&&!attempt\.fromMemory&&!attempt\.fromCopy\?motionRepeatsFor\(placed,trial\):0;/.test(source));
}

const trackId='monster_hero_theme',dashed='monster-hero-theme';
const audio=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-audio.json`),'utf8'));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev10-'));
try{
  const generate=revision=>{
    const dir=path.join(tmp,`rev${revision}`);fs.mkdirSync(dir);
    const result=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--chart-revision',String(revision),'--write','--output-dir',dir],
      {cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
    return {status:result.status,stdout:result.stdout||'',chart:d=>JSON.parse(fs.readFileSync(path.join(dir,`${dashed}-v3-chart-${d}.json`),'utf8'))};
  };
  const rev9=generate(9),rev10=generate(10);
  ok('Rev.9・Rev.10 とも作れる',rev9.status===0&&rev10.status===0);
  let before=0,after=0,notes9=0,notes10=0,impossible=0,copies9=0,copies10=0;
  for(const d of ['hard','expert','master']){
    const c9=rev9.chart(d),c10=rev10.chart(d);
    const f9=measureFeel(c9,audio,{withQuality:false}),f10=measureFeel(c10,audio,{withQuality:false});
    before+=f9.monotony.repeat8;after+=f10.monotony.repeat8;
    notes9+=c9.notes.length;notes10+=c10.notes.length;impossible+=f10.impossible;
    copies9+=(c9.shapes||[]).filter(s=>s.phraseCopyOf!=null).length;copies10+=(c10.shapes||[]).filter(s=>s.phraseCopyOf!=null).length;
  }
  ok('Rev.10 は動きの使い回し(8小節)がはっきり減る',after<=before*.75,`HARD〜MASTER の合計 ${before.toFixed(3)} → ${after.toFixed(3)}`);
  ok('ノーツの数はほとんど変わらない',Math.abs(notes10-notes9)<=notes9*.02,`${notes9} → ${notes10}`);
  ok('押せない配置を作らない(生成直後・両手のシミュレート)',impossible===0,`${impossible}件`);
  ok('写しの数(同じフレーズは同じ形)を減らさない',copies10>=copies9,`${copies9} → ${copies10}`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.10(動きの使い回しを避ける)は期待どおり');
process.exit(failed?1:0);
