#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const data=read('monster-hero/data/rhythm-mode.js'),game=read('monster-hero/src/game-system.jsx');
const context={};vm.runInNewContext(`${data}\nthis.out={RHYTHM_JUDGMENTS,RHYTHM_SCORE_WEIGHTS,RHYTHM_DIFFICULTIES,RHYTHM_SONGS};`,context);const D=context.out;
const logic=game.match(/const rhythmJudgeTap = [\s\S]*?\n};/)?.[0];check('純粋な判定・コンボ・スコア関数を抽出できる',!!logic);
if(logic){const c={RHYTHM_JUDGMENTS:D.RHYTHM_JUDGMENTS,RHYTHM_SCORE_WEIGHTS:D.RHYTHM_SCORE_WEIGHTS,RHYTHM_JUDGMENT_IDS:D.RHYTHM_JUDGMENTS.map(x=>x.id)};vm.runInNewContext(`${logic}\nthis.out={rhythmJudgeTap,rhythmFastSlow,rhythmComboAfter,rhythmCalculateScore};`,c);const L=c.out;
  // 判定の幅は 2026-09-05 にゆるくした（MARVELOUS 25→40 / EXCELLENT 50→75 /
  // GREAT 100→130 / GOOD 150→170）。見ているのは「境界のちょうど内側と外側」で変わらない。
  // 2026-09-05、ユーザー指示で2回目の緩和(まだ全然むずい)。
  // 40/75/130/170/200 → 55/100/150/200/240。見張るのは「境界の内と外で判定が変わる」こと。
  [[0,'MARVELOUS'],[55,'MARVELOUS'],[56,'EXCELLENT'],[100,'EXCELLENT'],[101,'GREAT'],[150,'GREAT'],[151,'GOOD'],[200,'GOOD'],[201,'BAD'],[240,'BAD'],[241,'MISS'],[-55,'MARVELOUS'],[-240,'BAD'],[-241,'MISS']].forEach(([ms,id])=>check(`判定境界 ${ms}ms = ${id}`,L.rhythmJudgeTap(ms)===id));
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

// --- 同じレーンを長押ししながら、別の指で同じレーンをタップできるか ---
// 2026-09-05、ユーザーからの質問「同じレーンを片手で長押ししてて別の指で同じレーンを
// タップしてもきくようになってる？」。実際に対応づけを動かして確かめる。
// 指の区別は touch.identifier / pointerId なので、同じレーンでも別の入力として扱われ、
// 押さえている最中のノーツ(activePointerIdが入っている)は候補から外れる、という2つで成り立つ。
{
  const ctx={};
  vm.runInNewContext(`${data}\nthis.out={rhythmMatchInputBatch};`,ctx);
  const match=ctx.out.rhythmMatchInputBatch;
  const key=(kind,id)=>`${kind}:${id}`;
  const notes=[
    {index:0,type:'HOLD',timeMs:1000,lane:2,subLane:4,subLaneWidth:2,done:false,activePointerId:null},
    {index:1,type:'TAP', timeMs:1500,lane:2,subLane:4,subLaneWidth:2,done:false,activePointerId:null},
  ];
  const first=match(notes,[{lane:2,subLaneCoordinate:5,inputKey:key('touch',1)}],1000,0);
  check('1本目の指が同じレーンのHOLDをつかむ',first[0].target===notes[0]);
  notes[0].activePointerId=key('touch',1);
  const second=match(notes,[{lane:2,subLaneCoordinate:5,inputKey:key('touch',2)}],1500,0);
  check('長押し中に、別の指で同じレーンをタップできる',
    second[0].target===notes[1]&&second[0].deltaMs===0);
  check('押さえている最中のノーツは、あとから来た指に取られない',
    notes[0].activePointerId===key('touch',1)&&second[0].target!==notes[0]);
  // 同じレーンに同時押しが来ても、2本の指がそれぞれ別のノーツへ割り当てられる
  const pair=[
    {index:0,type:'TAP',timeMs:2000,lane:2,subLane:4,subLaneWidth:2,done:false,activePointerId:null},
    {index:1,type:'TAP',timeMs:2000,lane:2,subLane:4,subLaneWidth:2,done:false,activePointerId:null},
  ];
  const both=match(pair,[
    {lane:2,subLaneCoordinate:4.5,inputKey:key('touch',3)},
    {lane:2,subLaneCoordinate:5.5,inputKey:key('touch',4)},
  ],2000,0);
  check('同じレーンの2本は別々のノーツへ割り当てられる',
    both[0].target===pair[0]&&both[1].target===pair[1]);
}
// 画面側でも、指ごとに別の入力として扱っていること(レーンでまとめていない)
check('タッチは指(identifier)ごとに別の入力として扱う',
  game.includes("const inputKey=rhythmInputKey('touch',touch.identifier);")
  &&game.includes('current.activeTouchInputs.has(inputKey)'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
