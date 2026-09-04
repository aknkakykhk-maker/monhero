#!/usr/bin/env node
// ノーツの幅まわりの約束を確かめる。実機で全難易度を遊んでもらった指摘(2026-09-04)への対応。
//
//   ・「ノーツ最大はいま3だっけ？ 上限無くして全幅とかもありにして」
//      → 幅の上限を4(=2レーンぶん)から全幅(=10サブレーン=5レーン)へ広げた
//   ・「ホールド、スライドは途中から広がったり小さくなったりもほしい」
//      → SLIDEは以前から出来ていた。HOLDに holdPoints を足して同じことが出来るようにした
//
// 判定の作り(窓・スコア・コンボ)は変えていないので、それも変わっていないことを見張る。
//
//   node tools/mode/rhythm-note-width-variety-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const source=read('monster-hero/data/rhythm-mode.js');
const editor=read('monster-hero/debug/rhythm-invalid-placement.js');
const authoring=read('monster-hero/debug/rhythm-chart-authoring-ui.js');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};
const close=(a,b,tolerance=1e-9)=>Math.abs(Number(a)-Number(b))<=tolerance;

const ctx={};vm.createContext(ctx);vm.runInContext(source,ctx);
const run=code=>vm.runInContext(code,ctx);

// --- 幅の上限 ---
check('幅の上限は全幅(10サブレーン=5レーン)',run('RHYTHM_MAX_SUB_LANE_WIDTH')===10);
for(const width of [1,2,3,4,5,6,7,8,9,10]){
  const span=run(`rhythmProjectSubLaneSpan(0,${width},1)`);
  check(`TAP/HOLD/FLICKは幅${width}をそのまま出せる`,span.subLaneWidth===width);
}
check('全幅ノーツはレーンの端から端までを占める',(()=>{
  const span=run('rhythmProjectSubLaneSpan(0,10,1)');
  return close(span.left,0)&&close(span.right,1)&&close(span.center,.5);
})());
check('幅が右端をはみ出すときは左へ寄せて収める',(()=>{
  const span=run('rhythmProjectSubLaneSpan(6,8,1)');
  return span.subLane===2&&span.subLaneWidth===8;
})());
check('SLIDEも幅1〜10を受け付ける',[1,2,3,4,5,6,7,8,9,10].every(width=>
  run(`rhythmSlideWidth({type:'SLIDE',subLaneWidth:${width}})`)===width));
check('幅として書けない値(0・11・小数)はこれまでどおり幅2へ戻す',
  [0,11,2.5,'abc',null].every(value=>run(`rhythmSlideWidth({type:'SLIDE',subLaneWidth:${JSON.stringify(value)}})`)===2));
check('譜面エディタの不正配置チェックも幅1〜10を通す',
  /const validWidth=value=>integer\(value\)&&Number\(value\)>=1&&Number\(value\)<=10;/.test(editor)
  &&editor.includes('幅は1〜10の整数が必要です')&&!editor.includes('幅は1〜4の整数'));
check('譜面エディタの幅の選択肢が10まである',
  [1,2,3,4,5,6,7,8,9,10].every(width=>authoring.includes(`<option>${width}</option>`)||authoring.includes(`<option selected>${width}</option>`)));

// --- HOLDの途中で幅が変わる(holdPoints) ---
const taper=note=>JSON.stringify({type:'HOLD',timeMs:1000,endTimeMs:5000,lane:2,subLane:4,subLaneWidth:2,...note});
const widening=taper({holdPoints:[{timeMs:1000,subLane:4,subLaneWidth:2},{timeMs:5000,subLane:0,subLaneWidth:10}]});
const bump=taper({holdPoints:[
  {timeMs:1000,subLane:4,subLaneWidth:2},{timeMs:2000,subLane:1,subLaneWidth:8},
  {timeMs:4000,subLane:1,subLaneWidth:8},{timeMs:5000,subLane:4,subLaneWidth:2}]});

check('holdPointsが2点以上あるHOLDだけを可変幅として扱う',
  run(`rhythmNoteHasHoldPoints(${widening})`)===true
  &&run(`rhythmNoteHasHoldPoints(${taper({})})`)===false
  &&run(`rhythmNoteHasHoldPoints(${taper({holdPoints:[{timeMs:1000,subLaneWidth:2}]})})`)===false
  &&run(`rhythmNoteHasHoldPoints({type:'SLIDE',holdPoints:[{timeMs:1},{timeMs:2}]})`)===false);
check('幅を時間で直線に補間する',(()=>{
  const mid=run(`rhythmHoldSpanAt(${widening},3000)`);
  return close(mid.subLaneWidth,6)&&close(mid.subLane,2);
})());
check('途中で広がってから細くなる形も書ける',(()=>{
  const a=run(`rhythmHoldSpanAt(${bump},1500)`),b=run(`rhythmHoldSpanAt(${bump},3000)`),c=run(`rhythmHoldSpanAt(${bump},4500)`);
  return close(a.subLaneWidth,5)&&close(b.subLaneWidth,8)&&close(c.subLaneWidth,5);
})());
check('始点より前・終点より後は端の点の幅で止まる',(()=>{
  const before=run(`rhythmHoldSpanAt(${widening},0)`),after=run(`rhythmHoldSpanAt(${widening},9999)`);
  return close(before.subLaneWidth,2)&&close(after.subLaneWidth,10);
})());
check('holdPointsが無いHOLDはこれまでどおり一定の幅',(()=>{
  const a=run(`rhythmHoldSpanAt(${taper({})},1000)`),b=run(`rhythmHoldSpanAt(${taper({})},5000)`);
  return a.subLaneWidth===2&&b.subLaneWidth===2&&a.subLane===4&&b.subLane===4;
})());
check('点に幅を書かなければノーツ本体の幅を使う',(()=>{
  const note=taper({subLaneWidth:6,holdPoints:[{timeMs:1000},{timeMs:5000,subLaneWidth:2}]});
  return close(run(`rhythmHoldSpanAt(${note},1000)`).subLaneWidth,6);
})());
check('見た目の幅(rhythmNoteVisualSpan)もその時刻の幅になる',(()=>{
  const head=run(`rhythmNoteVisualSpan(${widening},2,1,1000)`),tail=run(`rhythmNoteVisualSpan(${widening},2,1,5000)`);
  return close(head.width,.2)&&close(tail.width,1);
})());
check('途中追従の的も、その時刻の幅になる(細くなる帯を見逃さない)',(()=>{
  const head=run(`rhythmHoldTrackedLane(${widening},1000)`),tail=run(`rhythmHoldTrackedLane(${widening},5000)`);
  return close(head.half,.5)&&close(tail.half,2.5)&&close(head.center,2)&&close(tail.center,2);
})());
check('holdPointsが無ければ追従の的も従来どおり',(()=>{
  const at=run(`rhythmHoldTrackedLane(${taper({})},3000)`);
  return close(at.half,.5)&&close(at.center,2);
})());

// --- 判定・入力の受け付けは「始点の帯」のまま(変えていない) ---
check('入力の受け付け幅は始点の帯のまま(途中で広がっても取りやすくならない)',(()=>{
  const notes=[{...JSON.parse(widening),index:0,done:false,activePointerId:null}];
  const inside=run(`rhythmMatchInputBatch(${JSON.stringify(notes)},[{lane:2,subLaneCoordinate:5,inputKey:'touch:1'}],1000,0).map(x=>x.target&&x.target.index)`);
  const outside=run(`rhythmMatchInputBatch(${JSON.stringify(notes)},[{lane:0,subLaneCoordinate:1,inputKey:'touch:1'}],1000,0).map(x=>x.target&&x.target.index)`);
  return inside[0]===0&&outside[0]===null;
})());
check('判定窓・離しの判定は変えていない',
  run('RHYTHM_RELEASE_MAX_MS')===200&&run(`rhythmJudgeRelease(0)`)==='MARVELOUS'&&run(`rhythmJudgeRelease(999)`)==='MISS');
check('FLICKの成立距離・時間も変えていない',run('RHYTHM_FLICK_DISTANCE_PX')===24&&run('RHYTHM_FLICK_MAX_MS')===450);
check('途中追従の猶予と余白も変えていない',run('RHYTHM_MID_TRACKING_GRACE_MS')===120&&run('RHYTHM_HOLD_TRACKING_MARGIN_LANES')===.15);

// --- 幅広ノーツは形でも分かる ---
check('幅5サブレーン以上を「幅広ノーツ」として扱う',run('RHYTHM_WIDE_NOTE_SUB_LANES')===5
  &&run(`rhythmNoteIsWide({type:'TAP',subLaneWidth:5})`)===true
  &&run(`rhythmNoteIsWide({type:'TAP',subLaneWidth:4})`)===false
  &&run(`rhythmNoteIsWide({type:'SLIDE',subLaneWidth:6})`)===true
  &&run(`rhythmNoteIsWide({type:'SLIDE',subLaneWidth:2})`)===false);
check('幅広ノーツは角を落とした棒にして、両端へ明るい縁を置く',
  source.includes('[data-rhythm-note][data-rhythm-note-wide="1"]>span:last-child{border-radius:7px!important}')
  &&source.includes('[data-rhythm-note][data-rhythm-note-wide="1"]>span:last-child::before')
  &&source.includes('[data-rhythm-note][data-rhythm-note-wide="1"]>span:last-child::after'));
check('プレイ画面のノーツへ data-rhythm-note-wide を付けている',
  read('monster-hero/src/game-system.jsx').includes(`data-rhythm-note-wide={rhythmNoteIsWide(note)?'1':undefined}`));

// --- 帯の描画が「時刻」を基準に幅を変える ---
check('帯は幅が変わる時刻の高さを必ず頂点にする',
  source.includes('const holdAnchors=')&&source.includes('holdAnchors.map(anchor=>anchor.ratio)')
  &&source.includes('const yAtMs=timeMs=>')&&source.includes('rhythmProjectTravelProgress(1-(Number(timeMs)-visualTime)/travelMs)'));
check('幅の変わり目は高さの比ではなく実際の落下曲線から出す',
  source.includes('rhythmHoldSpanAt(note,timeMs)')&&source.includes('.sort((a,b)=>a.ratio-b.ratio)'));

// --- 確認用のデバッグ譜面 ---
const songs=run('RHYTHM_SONGS');
const song=songs.find(entry=>entry.songId==='wide_width_test');
check('デバッグ曲「WIDE / TAPER TEST」がある',!!song&&song.displayName==='WIDE / TAPER TEST');
if(song){
  const easy=song.difficulties.EASY.notes,hard=song.difficulties.HARD.notes,expert=song.difficulties.EXPERT.notes;
  check('EASYに全幅(10)のノーツがある',easy.some(note=>note.subLaneWidth===10),`最大幅${Math.max(...easy.map(note=>note.subLaneWidth))}`);
  check('EASYは幅2から全幅まで段階を並べている',[2,4,6,8,10].every(width=>easy.some(note=>note.subLaneWidth===width)));
  check('HARDに「広がるHOLD」と「細くなるHOLD」の両方がある',(()=>{
    const withPoints=hard.filter(note=>Array.isArray(note.holdPoints));
    const grows=withPoints.some(note=>note.holdPoints[note.holdPoints.length-1].subLaneWidth>note.holdPoints[0].subLaneWidth);
    const shrinks=withPoints.some(note=>note.holdPoints[note.holdPoints.length-1].subLaneWidth<note.holdPoints[0].subLaneWidth);
    return withPoints.length>=4&&grows&&shrinks;
  })());
  check('HARDに「途中で広がってから細くなる」HOLDがある',hard.some(note=>Array.isArray(note.holdPoints)&&note.holdPoints.length>=3
    &&Math.max(...note.holdPoints.map(point=>point.subLaneWidth))>note.holdPoints[0].subLaneWidth
    &&note.holdPoints[note.holdPoints.length-1].subLaneWidth<Math.max(...note.holdPoints.map(point=>point.subLaneWidth))));
  check('HARDに終点フリック付きの可変幅HOLDがある',hard.some(note=>note.endFlick===true&&Array.isArray(note.holdPoints)));
  check('EXPERTに全幅のSLIDEと幅が変わるSLIDEがある',
    expert.some(note=>note.type==='SLIDE'&&note.subLaneWidth===10)
    &&expert.some(note=>note.type==='SLIDE'&&note.slidePoints.some(point=>point.subLaneWidth===10)&&note.slidePoints.some(point=>point.subLaneWidth===2)));
  check('確認用の譜面はすべて幅1〜10・レーン内に収まる',[...easy,...hard,...expert].every(note=>{
    if(note.type==='SLIDE')return note.slidePoints.every(point=>point.lane>=0&&point.lane<=4);
    const width=Number(note.subLaneWidth);
    return Number.isInteger(width)&&width>=1&&width<=10&&note.subLane>=0&&note.subLane+width<=10
      &&(!note.holdPoints||note.holdPoints.every(point=>{
        const pointWidth=point.subLaneWidth??width,pointSubLane=point.subLane??note.subLane;
        return Number.isInteger(pointWidth)&&pointWidth>=1&&pointWidth<=10&&pointSubLane>=0&&pointSubLane+pointWidth<=10;
      }));
  }));
}
check('既存の正式候補v1の譜面は1つも変えていない',(()=>{
  const v1=songs.find(entry=>entry.songId==='monster_hero_theme_candidate');
  if(!v1)return false;
  return ['EASY','NORMAL','HARD'].every(id=>v1.difficulties[id].notes.every(note=>
    note.type==='SLIDE'||(Number(note.subLaneWidth)>=1&&Number(note.subLaneWidth)<=4)));
})());

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
