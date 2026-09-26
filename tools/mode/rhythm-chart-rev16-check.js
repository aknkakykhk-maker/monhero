#!/usr/bin/env node
// MHB CHART ENGINE Rev.16(出だしの歯止めを、格子から少しずれた音・拍の間の音にも効かせる・2026-09-27)を見張る。
//   ・作り方の最新が Rev.16 以上になっている
//   ・頭の音がそろって格子からずれている曲(戦場の疾風)で、Rev.15 までは最初のノーツが3秒を超え、Rev.16 では3秒以内に来る
//   ・Rev.16 で足した頭のノーツは 1.8秒より後・格子から 43ms 以内の音の上
//   ・頭を足しても作り方は大きく変わらない(ノーツ数の差が3%以内。後ろの並びは頭に合わせて少し変わる)
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');

const ROOT=path.resolve(__dirname,'..','..');
const TRACK='senjou_no_shippuu',DASHED='senjou-no-shippuu',DIFFICULTY='EASY';
const FIRST_NOTE_LIMIT_MS=3000,EARLIEST_MS=1800,MAX_OFFSET_MS=43;
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.16 以上',CHART_REVISION_CODE_LATEST>=16,`Rev.${CHART_REVISION_CODE_LATEST}`);

const audio=JSON.parse(fs.readFileSync(path.join(ROOT,`tools/mode/authoring/${DASHED}-v3-audio.json`),'utf8'));
const {beatZeroMs,gridMs}=audio.timing;
const msOf=grid=>beatZeroMs+grid*gridMs;
// 作者用の置き場所は触らず、使い捨ての場所へ作る
const generate=revision=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`mhb-rev16-${revision}-`));
  try{
    const run=spawnSync(process.execPath,[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),'--track',TRACK,
      '--chart-revision',String(revision),'--difficulty',DIFFICULTY,'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8'});
    if(run.status!==0)return null;
    return JSON.parse(fs.readFileSync(path.join(dir,`${DASHED}-v3-chart-${DIFFICULTY.toLowerCase()}.json`),'utf8'));
  }catch{return null;}
  finally{fs.rmSync(dir,{recursive:true,force:true});}
};
const rev15=generate(15),rev16=generate(16);
ok('Rev.15 と Rev.16 で譜面を作れる',!!rev15&&!!rev16);
if(rev15&&rev16){
  const first15=msOf(rev15.notes[0].grid),first16=msOf(rev16.notes[0].grid);
  ok('Rev.15 までは最初のノーツが3秒を超えている(頭の音が格子からずれていて候補に残らない)',first15>FIRST_NOTE_LIMIT_MS,`${Math.round(first15)}ms`);
  ok('Rev.16 では最初のノーツが3秒以内に来る',first16<=FIRST_NOTE_LIMIT_MS,`${Math.round(first16)}ms`);
  const headGrid=rev16.notes[0].grid;
  const onset=audio.onsets.filter(o=>o.grid===headGrid).sort((a,b)=>Math.abs(a.gridOffsetMs)-Math.abs(b.gridOffsetMs))[0];
  ok('頭のノーツは 1.8秒より後で、格子から43ms以内に実際に鳴っている音の上',
    first16>=EARLIEST_MS&&!!onset&&Math.abs(onset.gridOffsetMs)<=MAX_OFFSET_MS,
    onset?`${Math.round(first16)}ms・ずれ ${onset.gridOffsetMs}ms`:'音が無い');
  // 頭に1つ入ると、あとの段(形の選び方など)はそれを前提に進むので、後ろの並びも少し変わる(1b の既存の歯止めと同じ)。
  // 見るのは「作り方が大きく変わっていない」こと: ノーツ数の差が3%以内
  const diff=Math.abs(rev16.notes.length-rev15.notes.length)/rev15.notes.length;
  ok('頭を足しても作り方は大きく変わらない(ノーツ数の差が3%以内)',diff<=.03,
    `Rev.15 ${rev15.notes.length}個 / Rev.16 ${rev16.notes.length}個`);
}
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
