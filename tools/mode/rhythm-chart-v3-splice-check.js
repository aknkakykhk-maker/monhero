#!/usr/bin/env node
// 区間の差し替え(rhythm-chart-v3-splice.js・2026-09-26・ROADMAP の段5)を見張る。
//   ・継ぎ合わせた譜面の気になり点は、候補0(いまの作り方)より多くならない
//   ・同じ名札の区切りは同じ候補を採る(1番と2番で形がそろう)
//   ・継ぎ合わせた譜面に押せない配置が無い
//   ・--output-dir を渡さなければ何も書かない(authoring/ も公開データも触らない)
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const {spliceCharts}=require('./rhythm-chart-v3-splice.js');
const {simulateNotes}=require('./rhythm-hand-simulate.js');
const {useRuntimeSlideLanes}=require('./rhythm-hand-model.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const trackId='monster_hero_theme',dashed='monster-hero-theme';
const audio=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-audio.json`),'utf8'));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-splice-'));
try{
  const charts=[];
  for(let v=0;v<3;v++){
    const dir=path.join(tmp,`v${v}`);fs.mkdirSync(dir);
    const result=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--chart-revision','10','--variant',String(v),
      '--difficulty','MASTER','--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
    if(result.status!==0){ok(`候補${v}を作れる`,false);continue;}
    charts.push(JSON.parse(fs.readFileSync(path.join(dir,`${dashed}-v3-chart-master.json`),'utf8')));
  }
  const result=spliceCharts(charts,audio);
  ok('継ぎ合わせた譜面の気になり点は候補0より多くならない',result.after<=result.before,`${result.before} → ${result.after}`);
  ok('ほかの候補を採った区切りがある(差し替えが働く)',result.chosen.some(k=>k!==0),result.chosen.join(''));
  const sections=audio.structure.sections.slice().sort((a,b)=>a.startBar-b.startBar);
  const byLabel=new Map();let consistent=true;
  sections.forEach((section,i)=>{const label=section.label;if(!byLabel.has(label))byLabel.set(label,result.chosen[i]);else if(byLabel.get(label)!==result.chosen[i]&&result.chosen[i]!==0&&byLabel.get(label)!==0)consistent=false;});
  ok('同じ名札の区切りは同じ候補(押せないので候補0へ戻したものを除く)',consistent);
  useRuntimeSlideLanes(true);
  const impossible=simulateNotes(result.notes,audio.timing).issues.filter(issue=>issue.severity==='impossible').length;
  useRuntimeSlideLanes(false);
  ok('継ぎ合わせた譜面に押せない配置が無い',impossible===0,`${impossible}件`);
  ok('ノーツの数は候補とほぼ同じ',Math.abs(result.notes.length-charts[0].notes.length)<=charts[0].notes.length*.03,`${charts[0].notes.length} → ${result.notes.length}`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
{
  const source=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-splice.js'),'utf8');
  const writes=source.match(/writeFileSync\([^\n]*/g)||[];
  ok('書き出すのは --output-dir を渡したときだけ',writes.length===1&&/if\(outputDir\)\{/.test(source)&&!/authoring\/[^'`]*-v3-(chart|fixed)/.test(source));
}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ 区間の差し替えは期待どおり');
process.exit(failed?1:0);
