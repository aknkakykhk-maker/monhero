#!/usr/bin/env node
// MHB CHART ENGINE Rev.25(サビ前後の密度を保つ・長いノーツを増やす・2026-09-30)を見張る。
//   Rising Hope を Rev.24 と Rev.25 で作って比べる(CHUNITHM AIR の MASTER と比べて違いが見えた曲)。
//   ・曲全体のノーツ数はほぼ同じ(変えたのは配り方と種類だけ。どの難易度も Rev.24 の ±3% 以内)
//   ・MASTER はサビに入る前後(50〜60秒)と終盤(70〜80秒)の密度が、はじめの10秒に比べて上がる
//     (人の譜面は 1.62 / 1.73 倍。Rev.24 は 1.43 / 1.53 倍だった)
//   ・EXPERT / MASTER は HOLD・SLIDE が増える(MASTER は1.5倍以上)。SLIDE の材料にベースの伸びも使う
//   ・自動修正(step7)のあとも、押せない配置(同じ時刻に同じ場所)が出ない
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.25 以上',CHART_REVISION_CODE_LATEST>=25,String(CHART_REVISION_CODE_LATEST));

const TRACK='rising_hope',FILE='rising-hope',DIFFS=['easy','normal','hard','expert','master'];
const audio=JSON.parse(fs.readFileSync(path.join(__dirname,'authoring',`${FILE}-v3-audio.json`),'utf8'));
const gridMs=Number(audio.timing.gridMs),zeroMs=Number(audio.timing.beatZeroMs);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev25-'));
try{
  const run=(tool,args)=>spawnSync(process.execPath,[path.join(__dirname,tool),...args],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
  const generate=revision=>{
    const out=path.join(tmp,`gen-${revision}`);fs.mkdirSync(out);
    run('rhythm-chart-v3-generate.js',['--track',TRACK,'--chart-revision',String(revision),'--write','--output-dir',out]);
    return {dir:out,chart:difficulty=>JSON.parse(fs.readFileSync(path.join(out,`${FILE}-v3-chart-${difficulty}.json`),'utf8'))};
  };
  const a=generate(24),b=generate(25);
  ok('Rev.24 と Rev.25 で書き出しのリビジョンが違う',a.chart('master').chartRevision===24&&b.chart('master').chartRevision===25,
    `${a.chart('master').chartRevision} / ${b.chart('master').chartRevision}`);
  for(const d of DIFFS){
    const x=a.chart(d).notes.length,y=b.chart(d).notes.length;
    ok(`${d.toUpperCase()}: 曲全体のノーツ数は Rev.24 の ±3% 以内`,Math.abs(y-x)<=Math.max(2,Math.ceil(x*.03)),`${x} → ${y}`);
  }
  // 10秒ごとの密度(はじめの10秒を1とする)
  const perTen=chart=>{
    const times=chart.notes.map(n=>zeroMs+n.grid*gridMs);
    const count=(from,to)=>times.filter(t=>t>=from*1000&&t<to*1000).length;
    const first=count(0,10)||1;
    return {pre:count(50,60)/first,late:count(70,80)/first};
  };
  const pa=perTen(a.chart('master')),pb=perTen(b.chart('master'));
  ok('MASTER: サビに入る前後(50〜60秒)の密度が Rev.24 より上がる',pb.pre>pa.pre+.05,`${pa.pre.toFixed(2)} → ${pb.pre.toFixed(2)}倍`);
  ok('MASTER: 終盤(70〜80秒)の密度が Rev.24 より上がる',pb.late>pa.late+.05,`${pa.late.toFixed(2)} → ${pb.late.toFixed(2)}倍`);
  const longOf=chart=>chart.notes.filter(n=>n.type==='HOLD'||n.type==='SLIDE').length;
  const slideOf=chart=>chart.notes.filter(n=>n.type==='SLIDE').length;
  for(const [d,ratio] of [['expert',1.2],['master',1.5]]){
    const x=longOf(a.chart(d)),y=longOf(b.chart(d));
    ok(`${d.toUpperCase()}: HOLD・SLIDE が Rev.24 の${ratio}倍以上`,y>=x*ratio,`${x} → ${y}本`);
    ok(`${d.toUpperCase()}: SLIDE が Rev.24 より増える(ベースの伸びも材料にする)`,slideOf(b.chart(d))>slideOf(a.chart(d)),`${slideOf(a.chart(d))} → ${slideOf(b.chart(d))}本`);
  }
  // 自動修正(step7)のあと、同じ時刻・同じサブレーンに重なるノーツが無い
  const fixDir=path.join(tmp,'fix');fs.mkdirSync(fixDir);
  run('rhythm-chart-v2-step7-autofix.js',['--track',TRACK,'--source','v3','--input-dir',b.dir,'--write','--output-dir',fixDir]);
  for(const d of ['expert','master']){
    const file=path.join(fixDir,`${FILE}-v3-fixed-${d}.json`);
    if(!fs.existsSync(file)){ok(`${d.toUpperCase()}: 自動修正の結果がある`,false);continue;}
    const notes=JSON.parse(fs.readFileSync(file,'utf8')).notes;
    const clash=notes.filter((n,i)=>notes.some((o,j)=>j<i&&o.grid===n.grid&&o.subLane<n.subLane+(n.subLaneWidth||1)&&n.subLane<o.subLane+(o.subLaneWidth||1)));
    ok(`${d.toUpperCase()}: 自動修正のあと、同じ時刻に同じ場所へ重なるノーツが無い`,!clash.length,clash.map(n=>n.grid).join(', '));
  }
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.25(サビ前後の密度・長いノーツ)は期待どおり');
process.exit(failed?1:0);
