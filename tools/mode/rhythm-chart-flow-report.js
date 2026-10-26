#!/usr/bin/env node
// 手の流れを狙う配置(rhythm-chart-v3-generate.js の --flow・曲の一覧の flowPlacement)の効き目を、オン/オフで比べる(2026-10-21)。
// 社長「新しい譜面から流れを狙う」(Arcaea の譜面は流れで押せる配置になっている)。
//
//   node tools/mode/rhythm-chart-flow-report.js --track rose --difficulty EXPERT,MASTER [--variant 0] [--json]
//
// 曲の解析(authoring/<曲>-v3-audio.json)から、同じ曲・同じ難易度をオフ/オンで作って(書き込みなし・作業用のフォルダへ)比べる。
// 公開中の譜面(rhythm-mode.js)には何も書かない。数えるもの:
//   流れの割合 … 速い続き(半拍以内)の1歩のうち、階段・なで(隣へ同じ向き)・往復(隣で折り返す)・左右交互(真ん中をまたぐ)の割合
//   跳び      … 速い続きで、同じ側のまま1.6レーンより大きく動く1歩
//   連打      … 速い続きで、同じ所(0.25レーン未満)を叩き直す1歩
//   押せない・交差・届きにくい … 横持ちの親指2本の物差し(rhythm-ref-tiers.js の thumbCheck・横持ち)の数
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const {thumbCheck,THUMB_PROFILES}=require('./rhythm-ref-tiers.js');
const args=process.argv.slice(2),argOf=(n,d=null)=>{const i=args.indexOf(n);return i>=0&&i+1<args.length?args[i+1]:d;};
const LANE_CENTER=3,FAST_BEAT=.5;

// 生成器で1譜面を作る(書き込みなし)。flow が真なら --flow を付ける
const generate=(track,difficulty,variant,flow)=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mh-flow-'));
  const r=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',track,'--difficulty',difficulty,'--variant',String(variant),'--output-dir',dir,'--write',...(flow?['--flow',...(argOf('--flow-tune')?['--flow-tune',argOf('--flow-tune')]:[])]:['--no-flow'])],{encoding:'utf8',maxBuffer:64*1024*1024});
  if(r.status!==0){fs.rmSync(dir,{recursive:true,force:true});throw new Error(`${track} ${difficulty} を作れなかった: ${String(r.stderr||r.stdout).slice(-300)}`);}
  const file=path.join(dir,`${track.replace(/_/g,'-')}-v3-chart-${difficulty.toLowerCase()}.json`);
  const chart=JSON.parse(fs.readFileSync(file,'utf8'));fs.rmSync(dir,{recursive:true,force:true});return chart;};

const centerOf=n=>(Number(n.subLane)+Number(n.subLaneWidth||2)/2)/2;
// 流れの数え方(生成器の flowCostFor と同じ区切り)
const flowStats=(notes,beatGrids)=>{
  const flow=[];
  for(const n of notes.slice().sort((a,b)=>a.grid-b.grid)){const last=flow[flow.length-1],c=centerOf(n);
    if(last&&last.grid===n.grid){last.sum+=c;last.count++;continue;}flow.push({grid:n.grid,sum:c,count:1});}
  const out={fast:0,stair:0,swing:0,alternate:0,jump:0,jack:0};let lastDir=0;
  for(let i=1;i<flow.length;i++){const a=flow[i-1],b=flow[i];if(b.grid-a.grid>beatGrids*FAST_BEAT){lastDir=0;continue;}
    const ca=a.sum/a.count,cb=b.sum/b.count,d=cb-ca,dir=Math.sign(d);out.fast++;
    if(Math.abs(d)<.25)out.jack++;
    else if(Math.abs(d)<=1.6){if(lastDir!==0&&dir===lastDir)out.stair++;else out.swing++;}
    else if((ca<LANE_CENTER+.5)!==(cb<LANE_CENTER+.5)&&Math.abs(d)<=3.5)out.alternate++;
    else out.jump++;
    lastDir=Math.abs(d)<.25?lastDir:dir;}
  out.flowRatio=out.fast?(out.stair+out.swing+out.alternate)/out.fast:0;return out;};

// 横持ちの物差しへ渡す形(時刻は拍の頭から格子で数える)
const toThumb=(chart,audio)=>{const t=audio.timing,gridMs=t.gridMs||t.beatMs/t.subdivisionsPerBeat,T=g=>t.beatZeroMs+g*gridMs;
  return chart.notes.map(n=>n.type==='SLIDE'?{k:'s',hand:null,pts:n.slidePoints.map(p=>[T(p.grid),p.lane,p.subLaneWidth??2,0,0])}
    :n.type==='HOLD'?{k:'h',t:T(n.grid),sub:n.subLane,w:n.subLaneWidth,end:T(n.grid+n.durationGrids),sky:0}
    :n.type==='FLICK'?{k:'f',t:T(n.grid),sub:n.subLane,w:n.subLaneWidth,args:[T(n.grid),n.subLane,n.subLaneWidth],sky:0}
    :{k:'t',t:T(n.grid),sub:n.subLane,w:n.subLaneWidth,sky:0});};

const measure=(chart,audio)=>{const t=audio.timing,beatGrids=t.subdivisionsPerBeat||4;
  const st=flowStats(chart.notes,beatGrids),th=thumbCheck(toThumb(chart,audio),THUMB_PROFILES.landscape,t.beatMs);
  const n=k=>th.issues.filter(i=>i.kind===k).length;
  return {notes:chart.notes.length,...st,impossible:n('impossible'),cross:n('cross'),reach:n('reach')};};

if(require.main===module){
  const track=argOf('--track');if(!track){console.error('--track <曲> が要る');process.exit(1);}
  const diffs=String(argOf('--difficulty','EXPERT,MASTER')).split(',').map(s=>s.trim().toUpperCase()).filter(Boolean);
  const variant=Number(argOf('--variant',0))||0;
  const audio=JSON.parse(fs.readFileSync(path.join(__dirname,'authoring',`${track.replace(/_/g,'-')}-v3-audio.json`),'utf8'));
  const rows=[];
  for(const d of diffs){const off=measure(generate(track,d,variant,false),audio),on=measure(generate(track,d,variant,true),audio);rows.push({track,difficulty:d,off,on});}
  if(args.includes('--json')){console.log(JSON.stringify(rows));process.exit(0);}
  const pct=x=>`${(x*100).toFixed(1)}%`;
  for(const r of rows){console.log(`${r.track} ${r.difficulty}`);
    for(const [k,f] of [['ノーツ',x=>x.notes],['流れの割合',x=>pct(x.flowRatio)],['  階段・なで',x=>x.stair],['  往復',x=>x.swing],['  左右交互',x=>x.alternate],['跳び',x=>x.jump],['連打',x=>x.jack],['押せない',x=>x.impossible],['腕の交差',x=>x.cross],['届きにくい',x=>x.reach]])
      console.log(`  ${k.padEnd(8,'　')} オフ ${String(f(r.off)).padStart(6)}  オン ${String(f(r.on)).padStart(6)}`);}
}
module.exports={flowStats,measure,generate};
