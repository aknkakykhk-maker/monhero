#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const data=read('monster-hero/data/rhythm-mode.js'),game=read('monster-hero/src/game-system.jsx');
const context={};vm.runInNewContext(`${data}\nthis.out={RHYTHM_JUDGMENTS,RHYTHM_SCORE_WEIGHTS,RHYTHM_DIFFICULTIES,RHYTHM_SONGS};`,context);const D=context.out;
const logic=game.match(/const rhythmJudgeTap = [\s\S]*?\n};/)?.[0];check('純粋な判定・コンボ・スコア関数を抽出できる',!!logic);
if(logic){const c={RHYTHM_JUDGMENTS:D.RHYTHM_JUDGMENTS,RHYTHM_SCORE_WEIGHTS:D.RHYTHM_SCORE_WEIGHTS,RHYTHM_JUDGMENT_IDS:D.RHYTHM_JUDGMENTS.map(x=>x.id)};vm.runInNewContext(`${logic}\nthis.out={rhythmJudgeTap,rhythmFastSlow,rhythmComboAfter,rhythmCalculateScore};`,c);const L=c.out;
  [[0,'MARVELOUS'],[25,'MARVELOUS'],[26,'EXCELLENT'],[50,'EXCELLENT'],[51,'GREAT'],[100,'GREAT'],[101,'GOOD'],[150,'GOOD'],[151,'BAD'],[200,'BAD'],[201,'MISS'],[-25,'MARVELOUS'],[-200,'BAD'],[-201,'MISS']].forEach(([ms,id])=>check(`判定境界 ${ms}ms = ${id}`,L.rhythmJudgeTap(ms)===id));
  check('早押し/遅押しをFAST/SLOWへ分類',L.rhythmFastSlow(-1)==='FAST'&&L.rhythmFastSlow(1)==='SLOW'&&L.rhythmFastSlow(0)===null);
  check('GOODまでコンボ継続、BAD/MISSで切断',['MARVELOUS','EXCELLENT','GREAT','GOOD'].every(id=>L.rhythmComboAfter(4,id)===5)&&['BAD','MISS'].every(id=>L.rhythmComboAfter(4,id)===0));
  const all={MARVELOUS:10,EXCELLENT:0,GREAT:0,GOOD:0,BAD:0,MISS:0};check('判定90%＋コンボ10%でALL MARVELOUSがmaxScore一致',L.rhythmCalculateScore({judgments:all,maxCombo:10,totalNotes:10,maxScore:600000})===600000);
  check('判定90%とコンボ10%を個別に反映',L.rhythmCalculateScore({judgments:{...all,MARVELOUS:0},maxCombo:10,totalNotes:10,maxScore:600000})===60000&&L.rhythmCalculateScore({judgments:all,maxCombo:0,totalNotes:10,maxScore:600000})===540000);
}
const chart=D.RHYTHM_SONGS[0].difficulties.EASY;
check('20〜30秒・5レーン・複数/連続を含むTAP限定譜面',chart.durationMs>=20000&&chart.durationMs<=30000&&chart.notes.length>0&&chart.notes.every(n=>n.type==='TAP'&&n.lane>=0&&n.lane<5)&&new Set(chart.notes.map(n=>n.lane)).size===5&&chart.notes.some((n,i)=>i&&n.timeMs===chart.notes[i-1].timeMs));
check('±200ms超の未処理ノーツを自動MISS',/songTimeMs-\(note\.timeMs\+settings\.judgmentTimingOffsetMs\)>200\)applyJudgment\(note,'MISS'/.test(game));
check('songTimeはAudioContext.currentTimeと実再生開始時刻が正本',game.includes('startedAt=ctx.currentTime')&&game.includes('offsetSeconds+(playing?ctx.currentTime-startedAt:0)')&&game.includes('songTimeMs:()=>songTimeSeconds()*1000'));
check('判定処理はDate.now/setInterval/CSS animationを基準にしない',!logic?.includes('Date.now')&&!logic?.includes('setInterval')&&game.includes('requestAnimationFrame(tick)'));
check('既存BGM track IDを再利用しループしない',game.includes('const startRhythmTrack = async (key,rhythmVolumePct=100)')&&game.includes('nextSource.buffer=buffer; nextSource.loop=false')&&D.RHYTHM_SONGS[0].bgmTrackId==='atsu_cup_theme');
check('デバッグ限定の開始導線・通常公開OFF',game.includes('data-rhythm-tap-start')&&game.includes("gameState==='RHYTHM_DEBUG'")&&game.includes('const RHYTHM_MODE_PUBLIC_RELEASE = false'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
