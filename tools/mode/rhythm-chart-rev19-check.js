#!/usr/bin/env node
// MHB CHART ENGINE Rev.19(写した小節のリズムもそろえる・2026-09-28)を見張る。
//   ・繰り返しの小節では、元の小節で拾った位置の音を、候補の絞り込み(格子からのずれ30ms・拍の裏の弱い音)から外して加える
//   ・Rev.18 より同じフレーズの写し率が上がる。押せない配置を作らない。格子の刻み(難易度の決まり)は守る
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const {measure}=require('./rhythm-chart-quality-report.js');
const {measureFeel}=require('./rhythm-chart-feel-report.js');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.19 以上',CHART_REVISION_CODE_LATEST>=19);
const source=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-generate.js'),'utf8');
ok('加えるのは Rev.19 の繰り返しの小節だけ・格子の刻みは守る',/const barPool=rev19&&sourceOffsets/.test(source)&&/onset\.grid%P\.lattice===0\s*&&sourceOffsets\.has\(onset\.grid-bar\*BAR\)/.test(source));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev19-'));
try{
  let echo18=0,echo19=0,impossible=0,latticeBroken=0;
  for(const [trackId,dashed] of [['crossing_field','crossing-field'],['kindan_no_resistance','kindan-no-resistance']]){
    const audio=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-audio.json`),'utf8'));
    const generate=revision=>{
      const dir=path.join(tmp,`${trackId}-${revision}`);fs.mkdirSync(dir);
      spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--chart-revision',String(revision),'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
      return d=>JSON.parse(fs.readFileSync(path.join(dir,`${dashed}-v3-chart-${d}.json`),'utf8'));
    };
    const r18=generate(18),r19=generate(19);
    for(const d of ['hard','expert','master']){
      echo18+=measure(r18(d),audio).musicality.phraseEcho||0;
      const chart=r19(d);
      echo19+=measure(chart,audio).musicality.phraseEcho||0;
      impossible+=measureFeel(chart,audio,{withQuality:false}).impossible;
      // HARD の格子の刻みより細かい所に置いていないか(8分より細かい HARD の刻みは、生成器の policy が持つ)
      const lattice=Number(chart.policy&&chart.policy.lattice)||1;
      latticeBroken+=chart.notes.filter(note=>!note.chord&&note.grid%lattice!==0).length;
    }
  }
  ok('Rev.18 より同じフレーズの写し率が上がる(HARD〜MASTER の合計で 0.2 以上)',echo19>=echo18+.2,`${echo18.toFixed(3)} → ${echo19.toFixed(3)}`);
  ok('押せない配置を作らない',impossible===0,`${impossible}件`);
  ok('格子の刻みより細かい所に置かない',latticeBroken===0,`${latticeBroken}個`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.19(写した小節のリズムもそろえる)は期待どおり');
process.exit(failed?1:0);
