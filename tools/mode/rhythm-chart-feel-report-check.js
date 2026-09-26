#!/usr/bin/env node
// 気持ちよさの物差し(rhythm-chart-feel-report.js)が、正解の分かっている小さな譜面で正しく数えるかを確かめる(2026-09-26)。
//   ・横フリック: 次のノーツへ向かう向きは自然、逆向きは不自然、もう片方の指へ向かって払うのは「ぶつかる」
//   ・単調さ: 同じ動きの並びが、リズムを変えて繰り返したときだけ数える(リズムも同じなら「同じフレーズは同じ形」)
//   ・公開曲で2回測って同じ結果になる(乱数を使わない)
'use strict';
const path=require('path');
const fs=require('fs');
const {measureFeel,feelReportFor}=require('./rhythm-chart-feel-report.js');

let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// 120BPM・16分の格子(1グリッド125ms)
const audio={timing:{bpm:120,beatMs:500,beatZeroMs:0,subdivisionsPerBeat:4,gridMs:125,beatsPerBar:4}};
const chartOf=notes=>({difficulty:'MASTER',laneCount:6,notes});
const tap=(grid,subLane,extra={})=>({type:'TAP',grid,subLane,subLaneWidth:2,...extra});
const measure=notes=>measureFeel(chartOf(notes),audio,{withQuality:false});

// ── 1. 横フリック ──
{
  const toward=measure([tap(0,2),{...tap(4,4),type:'FLICK',flickDir:'right'},tap(6,8)]);
  ok('次のノーツへ向かう右フリックは自然',toward.sideFlick.count===1&&toward.sideFlick.naturalRate===1&&toward.sideFlick.basis.next===1,JSON.stringify(toward.sideFlick.basis));
  const away=measure([tap(0,2),{...tap(4,4),type:'FLICK',flickDir:'left'},tap(6,8)]);
  ok('次のノーツと逆へ払う左フリックは不自然',away.sideFlick.naturalRate===0);
  ok('不自然なフリックは区間の気になる理由に出る',away.worst.length===1&&away.worst[0].flickOff===1,JSON.stringify(away.worst.map(seg=>seg.details)));
  // もう片方の指が HOLD で 3.5 レーンを押さえている所へ、2.5 レーンから右へ払う
  const collide=measure([{type:'HOLD',grid:0,subLane:6,subLaneWidth:2,durationGrids:16},{...tap(4,4),type:'FLICK',flickDir:'right'}]);
  ok('押さえている指へ向かって払うと「ぶつかる」',collide.sideFlick.collide===1&&collide.sideFlick.naturalRate===0);
  const plain=measure([tap(0,2),{...tap(4,4),type:'FLICK'},tap(6,8)]);
  ok('向きの無いフリックは数えない',plain.sideFlick.count===0&&plain.sideFlick.naturalRate===null);
}

// ── 2. 単調さ ──
{
  // 上がって下がる動き(右・右・左・左)を2回。1回目は8分、2回目は16分(リズムが違う)
  const phrase=(start,gap)=>[0,2,4,2,0].map((sub,i)=>tap(start+i*gap,sub));
  const different=measure([...phrase(0,2),...phrase(16,1)]);
  ok('リズムを変えて同じ動きを繰り返すと単調に数える',different.monotony.repeat4>0,`4小節 ${different.monotony.repeat4}`);
  const same=measure([...phrase(0,2),...phrase(16,2)]);
  ok('リズムも同じ繰り返しは数えない(同じフレーズは同じ形)',same.monotony.repeat4===0&&same.monotony.repeat8===0);
  const jack=measure([0,2,4,6,8,10,12,14,16,18].map(grid=>tap(grid,4)));
  ok('同じ所の連打(縦連)は単調に数えない',jack.monotony.grams===0);
}

// ── 3. 公開曲で毎回同じ結果 ──
{
  const trackId='monster_hero_theme';
  const file=path.join(__dirname,'authoring','monster-hero-theme-v3-fixed-master.json');
  if(fs.existsSync(file)){
    const a=feelReportFor(trackId,{difficulty:'MASTER'}),b=feelReportFor(trackId,{difficulty:'MASTER'});
    ok('公開曲を2回測って同じ結果',JSON.stringify(a)===JSON.stringify(b));
    const m=a.difficulties.MASTER;
    ok('公開曲の MASTER で横フリックを数えている',m.sideFlick.count>0,`${m.sideFlick.count}本`);
    ok('区間の気になり点が出る',m.segments.length>0&&m.segments.every(seg=>Number.isFinite(seg.concern)));
  }else ok('公開曲の譜面がある',false,file);
}

console.log(failed?`\n✗ ${failed}件NG`:'\n✓ 気持ちよさの物差しは期待どおり');
process.exit(failed?1:0);
