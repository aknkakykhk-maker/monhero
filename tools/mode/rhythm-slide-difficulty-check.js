#!/usr/bin/env node
// SLIDE/HOLDの「追従」が、難易度ごとにやさしくなっているかを本番の関数で確かめる。
//
//   node tools/mode/rhythm-slide-difficulty-check.js
//
// 【なぜ要るか】(2026-09-11・ユーザー指摘)
// 「スライドノーツの判定幅が細か過ぎてかなりむずい / 難易度によって細かさを調整してほしい /
//   もちろん難しい曲なら細かくてもいい」
//
// それまで追従の許容も猶予も全難易度で同じ値だった。しかも難易度差は譜面の帯の幅だけで
// 付いていて、**MASTERがいちばん厳しい**状態だった(HARD/EXPERTは幅3=±1.07レーンが主、
// MASTERは幅2=±0.82レーンが主)。
//
// もうひとつ、これがいちばん効いた直し:
// 追従のレーン座標を**指のその場の高さ**で測っていたため、判定ラインの上の正しい位置に
// 指があっても、指が上へ流れただけでレーン座標が外へ膨らんでいた。端のレーンでは
// 判定ラインの140px上で0.556レーン狂い、幅2の許容0.82レーンの68%を
// 「横に一切ずれていないのに」食いつぶしていた。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const prefix=source.split('const emptyRhythmChart',1)[0];
const ctx={console,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}};
vm.createContext(ctx);
vm.runInContext(prefix+'\nthis.out={rhythmLaneCoordinateAtPoint,rhythmTrackingLaneCoordinateAtPoint,'
  +'rhythmSlideTrackingTolerance,rhythmSlideTrackingFor,RHYTHM_SLIDE_TRACKING_BY_DIFFICULTY,'
  +'RHYTHM_SLIDE_TOLERANCE_LANES,RHYTHM_MID_TRACKING_GRACE_MS,RHYTHM_JUDGMENT_LINE_Y_RATIO,'
  +'RHYTHM_DIFFICULTIES};',ctx);
const O=ctx.out;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const DIFF_IDS=O.RHYTHM_DIFFICULTIES.map(d=>d.id);
const slide=(bonus,width=2)=>({type:'SLIDE',timeMs:0,endTimeMs:1000,lane:2,subLaneWidth:width,
  _rhythmSlideToleranceBonusLanes:bonus});

console.log('--- 難易度ごとの追従設定 ---');
ok('難易度の全IDぶん用意してある',DIFF_IDS.every(id=>O.RHYTHM_SLIDE_TRACKING_BY_DIFFICULTY[id]),DIFF_IDS.join('/'));
const bonuses=DIFF_IDS.map(id=>O.rhythmSlideTrackingFor(id).toleranceBonusLanes);
const graces=DIFF_IDS.map(id=>O.rhythmSlideTrackingFor(id).graceMs);
ok('やさしい難易度ほど許容が広い(単調)',bonuses.every((x,i)=>i===0||x<=bonuses[i-1]),bonuses.join(' → '));
ok('やさしい難易度ほど猶予が長い(単調)',graces.every((x,i)=>i===0||x<=graces[i-1]),graces.join(' → ')+'ms');
ok('EASYとMASTERで差が付いている',bonuses[0]>bonuses[bonuses.length-1]&&graces[0]>graces[graces.length-1]);

console.log('\n--- MASTERはこれまでどおり(易しくしない) ---');
const master=O.rhythmSlideTrackingFor('MASTER');
ok('MASTERの許容ボーナスは0',master.toleranceBonusLanes===0);
ok('MASTERの猶予は従来の値',master.graceMs===O.RHYTHM_MID_TRACKING_GRACE_MS,`${master.graceMs}ms`);
ok('MASTERの幅2の許容は従来の±0.82レーン',
  Math.abs(O.rhythmSlideTrackingTolerance(slide(0),500)-O.RHYTHM_SLIDE_TOLERANCE_LANES)<1e-9);

console.log('\n--- 焼き込み前のノーツでも壊れない ---');
ok('ボーナスが無いノーツは従来どおり',
  Math.abs(O.rhythmSlideTrackingTolerance({type:'SLIDE',timeMs:0,endTimeMs:1000,lane:2,subLaneWidth:2},500)
    -O.RHYTHM_SLIDE_TOLERANCE_LANES)<1e-9);
ok('壊れた値(NaN/負)は0として扱う',
  Math.abs(O.rhythmSlideTrackingTolerance(slide(NaN),500)-O.RHYTHM_SLIDE_TOLERANCE_LANES)<1e-9
  &&Math.abs(O.rhythmSlideTrackingTolerance(slide(-5),500)-O.RHYTHM_SLIDE_TOLERANCE_LANES)<1e-9);
ok('知らない難易度IDはMASTER扱い(安全側)',
  O.rhythmSlideTrackingFor('???').graceMs===master.graceMs
  &&O.rhythmSlideTrackingFor(undefined).toleranceBonusLanes===0);
ok('帯が太いほど許容も広い(従来の性質)',
  O.rhythmSlideTrackingTolerance(slide(0,3),500)>O.rhythmSlideTrackingTolerance(slide(0,2),500));

console.log('\n--- 追従は判定ラインの高さで測る（上下ずれが横ずれに化けない） ---');
const rect={left:0,top:0,width:374,height:700};
const yJ=rect.top+rect.height*O.RHYTHM_JUDGMENT_LINE_Y_RATIO;
// 端のレーン(0)の中心が判定ライン上に来るxを探す
let xEdge=null;
for(let x=0;x<=rect.width;x+=0.05){const v=O.rhythmLaneCoordinateAtPoint(x,yJ,rect);if(v!==null&&Math.abs(v)<0.002){xEdge=x;break;}}
ok('端のレーンの中心xを特定できる',xEdge!==null,xEdge===null?'':`x=${xEdge.toFixed(2)}px`);
if(xEdge!==null){
  const drift=up=>{const v=O.rhythmTrackingLaneCoordinateAtPoint(xEdge,yJ-up,rect);return v===null?Infinity:Math.abs(v);};
  const driftOld=up=>{const v=O.rhythmLaneCoordinateAtPoint(xEdge,yJ-up,rect);return v===null?Infinity:Math.abs(v);};
  for(const up of [70,140,210,280]){
    ok(`判定ラインの${up}px上でも狂わない`,drift(up)<0.01,
      `いま ${drift(up).toFixed(3)} レーン / 直す前 ${driftOld(up)===Infinity?'範囲外':driftOld(up).toFixed(3)+' レーン'}`);
  }
  ok('直す前は実際に狂っていた(この検査が意味を持つ)',driftOld(140)>0.3);
  ok('判定ラインの高さそのものでは、直す前と同じ結果',Math.abs(drift(0)-driftOld(0))<1e-9);
}

console.log('\n--- 実装ガード ---');
ok('追従だけが判定ラインの高さで測る関数を通る',
  /const laneCoordinate=\(clientX,clientY\)=>\{[\s\S]*?rhythmTrackingLaneCoordinateAtPoint\(clientX,clientY,rect\)/.test(source));
ok('猶予はノーツへ焼き込んだ値を読む',/_rhythmTrackingGraceMs/.test(source));
ok('許容は難易度の土台と速さの上乗せを足す',/\+rhythmSlideToleranceBonus\(note,chartTimeMs\)/.test(source));
ok('速さの上乗せはその時刻の区間から作る',/const rhythmSlideLaneSpeedAt=\(note,chartTimeMs\)=>/.test(source));
ok('譜面データそのものは触っていない(焼き込みは演奏開始時)',
  fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8')
    .includes('rhythmSlideTrackingFor(difficulty.id)'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
