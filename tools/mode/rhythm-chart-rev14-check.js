#!/usr/bin/env node
// MHB CHART ENGINE Rev.14(手と種類の仕上げ・2026-09-26)を見張る。
//   ・手のモデル: SLIDE の曲線(ゲーム本体と同じ式)と親指の左右は、切り替えたときだけ効く(既定は今までどおり)
//   ・親指の左右: 左の指が右の指より右で叩く割り振りを避ける
//   ・自動修正は Rev.14 の譜面で、SLIDE の曲線の途中の近さも見る
//   ・終点フリックは旋律の息継ぎ・語尾に付き、HOLD の太さの形は伴奏の強さの変化と合う(Rev.13 より合う)
//   ・候補(--variant)が HARD でも分かれる(Rev.13 は候補0と1が同じ譜面)
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const hm=require('./rhythm-hand-model.js');
const {simulateNotes}=require('./rhythm-hand-simulate.js');
const {CHART_REVISION_CODE_LATEST,handModelFlagsForRevision}=require('./rhythm-chart-v3-revision.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.14 以上',CHART_REVISION_CODE_LATEST>=14);
ok('手のモデルの読み方: Rev.13 は曲線・左右なし、Rev.14 はあり',
  JSON.stringify(handModelFlagsForRevision(13))===JSON.stringify({runtimeSlideLanes:true,slideEase:false,handSides:false})
  &&JSON.stringify(handModelFlagsForRevision(14))===JSON.stringify({runtimeSlideLanes:true,slideEase:true,handSides:true}));

// ── 1. 手のモデル ──
{
  const slide={type:'SLIDE',grid:0,lane:0,subLaneWidth:2,durationGrids:8,slidePoints:[{grid:0,lane:0,subLaneWidth:2,ease:'in'},{grid:8,lane:4,subLaneWidth:2}]};
  const before=hm.setHandModelFlags({runtimeSlideLanes:false,slideEase:false,handSides:false});
  const linear=hm.slideLaneAtGrid(slide,4);
  hm.setHandModelFlags({runtimeSlideLanes:false,slideEase:true,handSides:false});
  const eased=hm.slideLaneAtGrid(slide,4);
  hm.setHandModelFlags(before);
  ok('SLIDE の途中は、曲線なしなら直線、ありならゲーム本体と同じ式(in は2乗)',linear===2&&eased===1,`直線 ${linear} / 曲線 ${eased}`);
  // 決まった種から作る短い並び200通りで、左の指が右の指より右で叩いた回数を数える
  const timing={bpm:120,beatMs:500,beatZeroMs:0,subdivisionsPerBeat:4,gridMs:125,beatsPerBar:4};
  let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
  const sequences=[];
  for(let k=0;k<200;k++){let grid=0;const list=[];for(let i=0;i<6;i++){grid+=1+Math.floor(rnd()*3);list.push({type:'TAP',grid,subLane:Math.floor(rnd()*11),subLaneWidth:2});}sequences.push(list);}
  const crossedWith=flags=>{
    const prev=hm.setHandModelFlags(flags);
    try{
      let crossed=0;
      for(const notes of sequences){
        const sim=simulateNotes(notes,timing);
        const lane=[null,null];
        notes.forEach((note,index)=>{const f=sim.assignments.get(index);if(f==null)return;lane[f]=(note.subLane+1)/2;if(lane[0]!=null&&lane[1]!=null&&lane[0]-lane[1]>.5)crossed++;});
      }
      return crossed;
    }finally{hm.setHandModelFlags(prev);}
  };
  const crossOff=crossedWith({runtimeSlideLanes:true,slideEase:true,handSides:false}),crossOn=crossedWith({runtimeSlideLanes:true,slideEase:true,handSides:true});
  ok('親指の左右を区別すると、交差する割り振りを避ける',crossOff>0&&crossOn*2<=crossOff,
    `200通りの並びで交差した回数 区別なし ${crossOff} / 区別あり ${crossOn}`);
  const autofix=fs.readFileSync(path.join(__dirname,'rhythm-chart-v2-step7-autofix.js'),'utf8');
  ok('自動修正は曲線のとき、SLIDE の途中のグリッドも見る',/if\(slideEaseEnabled\(\)&&\(held\.type==='SLIDE'\|\|other\.type==='SLIDE'\)\)for\(let g=Math\.ceil\(from\);g<to;g\+\+\)stops\.add\(g\);/.test(autofix));
}

// ── 2. 生成器 ──
{
  const trackId='monster_hero_theme',dashed='monster-hero-theme';
  const audio=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-audio.json`),'utf8'));
  const BEAT=audio.timing.subdivisionsPerBeat;
  const pitch=new Map((audio.pitchCurve||[]).map(p=>[p.grid,p]));
  const breath=endGrid=>{let clear=0,total=0;for(let g=endGrid+1;g<=endGrid+BEAT/2;g++){const p=pitch.get(g);total++;if(p&&p.clarity>=.5&&p.hz>0)clear++;}return total>0&&clear/total<.5;};
  const onsets=audio.onsets.filter(o=>o.grid!=null);
  const trend=note=>{const s=note.grid,e=note.grid+note.durationGrids,th=(e-s)/3;const m=(a,b)=>{const l=onsets.filter(o=>o.grid>a&&o.grid<=b).map(o=>o.strength);return l.length?l.reduce((x,y)=>x+y,0)/l.length:0;};
    const s1=m(s,s+th),s2=m(s+th,s+2*th),s3=m(s+2*th,e);return {open:s3>s1,close:s1>s3,swell:s2>Math.max(s1,s3),pinch:s2<Math.min(s1,s3),pulse:false}[note.holdTaper];};
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev14-'));
  try{
    const generate=(revision,variant=0,difficulty=null)=>{
      const dir=path.join(tmp,`r${revision}v${variant}${difficulty||''}`);fs.mkdirSync(dir);
      const result=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--chart-revision',String(revision),'--variant',String(variant),
        ...(difficulty?['--difficulty',difficulty]:[]),'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
      return {status:result.status,chart:d=>JSON.parse(fs.readFileSync(path.join(dir,`${dashed}-v3-chart-${d}.json`),'utf8'))};
    };
    const r13=generate(13),r14=generate(14);
    ok('Rev.13・Rev.14 とも作れる',r13.status===0&&r14.status===0);
    const rate=(r,pick,good)=>{let n=0,g=0;for(const d of ['hard','expert','master'])for(const note of r.chart(d).notes)if(pick(note)){n++;if(good(note))g++;}return {n,rate:n?g/n:0};};
    const end13=rate(r13,n=>n.endFlick,n=>breath(n.grid+(n.durationGrids||0))),end14=rate(r14,n=>n.endFlick,n=>breath(n.grid+(n.durationGrids||0)));
    ok('終点フリックは旋律の息継ぎに付く(Rev.13 より合う)',end14.n>0&&end14.rate>=.8&&end14.rate>end13.rate,`Rev.13 ${end13.n}本・${Math.round(end13.rate*100)}% → Rev.14 ${end14.n}本・${Math.round(end14.rate*100)}%`);
    const hold13=rate(r13,n=>!!n.holdTaper,trend),hold14=rate(r14,n=>!!n.holdTaper,trend);
    ok('HOLD の太さの形は伴奏の強さの変化と合う(Rev.13 より合う)',hold14.n>0&&hold14.rate===1&&hold14.rate>hold13.rate,`Rev.13 ${Math.round(hold13.rate*100)}% → Rev.14 ${Math.round(hold14.rate*100)}%`);
    const lanesDiffer=revision=>{
      const a=generate(revision,0,'HARD').chart('hard').notes,b=generate(revision,1,'HARD').chart('hard').notes;
      const m=new Map(a.map(n=>[`${n.grid}:${n.type}`,n.subLane]));
      return b.filter(n=>m.has(`${n.grid}:${n.type}`)&&m.get(`${n.grid}:${n.type}`)!==n.subLane).length;
    };
    const d13=lanesDiffer(13),d14=lanesDiffer(14);
    ok('候補が HARD でもよく分かれる(Rev.13 の倍以上)',d14>=Math.max(1,d13*2),`レーンが違うノーツ Rev.13 ${d13} → Rev.14 ${d14}`);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.14(手と種類の仕上げ)は期待どおり');
process.exit(failed?1:0);
