#!/usr/bin/env node
// MHB CHART ENGINE Rev.24(大きな一発を左右対称の同時フリックに・2026-09-29)を見張る。
//   ・EASY〜HARD は Rev.23 と同じ譜面
//   ・EXPERT / MASTER には、同じ時刻に道の真ん中をはさんで左右対称に置いた2本の FLICK(mirrorFlick)の組がある
//     (MASTER は左の1本が左へ・右の1本が右へ払う。EXPERT は向きなし=上へ払う)
//   ・組の前後(EXPERT 0.75拍・MASTER 0.5拍)にはほかのノーツ・押さえの終わりが無い。組どうしは間を空け、1曲の上限を超えない
//   ・向きの付け直し(rhythm-side-flick.js)と自動修正(step7)のあとも、位置と向きがそのまま
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');
const {assignSideFlickDirs}=require('./rhythm-side-flick.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.24 以上',CHART_REVISION_CODE_LATEST>=24,String(CHART_REVISION_CODE_LATEST));

const TRACK='dullahan',SUB_LANES=12;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev24-'));
try{
  const run=(tool,args)=>spawnSync(process.execPath,[path.join(__dirname,tool),...args],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
  const generate=revision=>{
    const out=path.join(tmp,`gen-${revision}`);fs.mkdirSync(out);
    run('rhythm-chart-v3-generate.js',['--track',TRACK,'--chart-revision',String(revision),'--write','--output-dir',out]);
    return {dir:out,chart:difficulty=>JSON.parse(fs.readFileSync(path.join(out,`${TRACK}-v3-chart-${difficulty}.json`),'utf8'))};
  };
  const a=generate(23),b=generate(24);
  ok('EASY〜HARD は Rev.23 と同じノーツ',['easy','normal','hard'].every(d=>JSON.stringify(a.chart(d).notes)===JSON.stringify(b.chart(d).notes)));
  ok('Rev.23 には左右対称の同時フリックが無い',['expert','master'].every(d=>!a.chart(d).notes.some(n=>n.mirrorFlick)));
  const audio=JSON.parse(fs.readFileSync(path.join(__dirname,'authoring',`${TRACK}-v3-audio.json`),'utf8'));
  const beatGrids=Number(audio.timing.subdivisionsPerBeat)||4;
  const pairsOf=chart=>{
    const byGrid=new Map();
    for(const note of chart.notes)if(note.mirrorFlick){if(!byGrid.has(note.grid))byGrid.set(note.grid,[]);byGrid.get(note.grid).push(note);}
    return [...byGrid].map(([grid,notes])=>({grid,notes:notes.sort((x,y)=>x.subLane-y.subLane)}));
  };
  const endOf=note=>note.type==='HOLD'||note.type==='SLIDE'?note.grid+(Number(note.durationGrids)||0):note.grid;
  for(const [difficulty,clearBeats,max,directions] of [['expert',.75,3,false],['master',.5,5,true]]){
    const chart=b.chart(difficulty),pairs=pairsOf(chart),tag=difficulty.toUpperCase();
    ok(`${tag}: 左右対称の同時フリックが1組以上・上限(${max}組)以内`,pairs.length>=1&&pairs.length<=max,`${pairs.length}組`);
    ok(`${tag}: どの組も同じ時刻の FLICK 2本で、道の真ん中をはさんで左右対称`,pairs.every(({notes:[l,r],notes:all})=>all.length===2&&l.type==='FLICK'&&r.type==='FLICK'
      &&l.subLaneWidth===r.subLaneWidth&&l.subLane+l.subLaneWidth<=SUB_LANES/2&&r.subLane>=SUB_LANES/2&&l.subLane+r.subLane+r.subLaneWidth===SUB_LANES));
    ok(`${tag}: 向きは${directions?'左の1本が左・右の1本が右':'付けない(上へ払う)'}`,pairs.every(({notes:[l,r]})=>directions?l.flickDir==='left'&&r.flickDir==='right':!l.flickDir&&!r.flickDir));
    const clear=Math.round(beatGrids*clearBeats);
    const crowded=pairs.filter(({grid,notes})=>chart.notes.some(other=>!notes.includes(other)&&(other.grid===grid||(other.grid>grid?other.grid-grid<clear:grid-endOf(other)<clear))));
    ok(`${tag}: 組の前後${clearBeats}拍にほかのノーツ・押さえの終わりが無い`,!crowded.length,crowded.map(p=>p.grid).join(', '));
    // 向きの付け直しで変わらない
    const copy=JSON.parse(JSON.stringify(chart.notes));
    assignSideFlickDirs(copy,audio.timing);
    ok(`${tag}: 向きの付け直しのあとも向きがそのまま`,copy.filter(n=>n.mirrorFlick).every(n=>chart.notes.some(o=>o.mirrorFlick&&o.grid===n.grid&&o.subLane===n.subLane&&(o.flickDir||'')===(n.flickDir||''))));
  }
  // 自動修正(step7)のあとも位置と向きがそのまま
  const fixDir=path.join(tmp,'fix');fs.mkdirSync(fixDir);
  run('rhythm-chart-v2-step7-autofix.js',['--track',TRACK,'--source','v3','--input-dir',b.dir,'--write','--output-dir',fixDir]);
  for(const difficulty of ['expert','master']){
    const file=path.join(fixDir,`${TRACK}-v3-fixed-${difficulty}.json`);
    if(!fs.existsSync(file)){ok(`${difficulty.toUpperCase()}: 自動修正の結果がある`,false);continue;}
    const fixed=JSON.parse(fs.readFileSync(file,'utf8')).notes,before=b.chart(difficulty).notes.filter(n=>n.mirrorFlick);
    ok(`${difficulty.toUpperCase()}: 自動修正のあとも位置と向きがそのまま`,before.length>0&&before.every(n=>fixed.some(o=>o.mirrorFlick&&o.type==='FLICK'&&o.grid===n.grid&&o.subLane===n.subLane&&(o.flickDir||'')===(n.flickDir||''))),`${before.length}本`);
  }
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.24(左右対称の同時フリック)は期待どおり');
process.exit(failed?1:0);
