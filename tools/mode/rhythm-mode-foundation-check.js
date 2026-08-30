#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};

const data=read('monster-hero/data/rhythm-mode.js');
const game=read('monster-hero/src/game-system.jsx');
const context={};
vm.runInNewContext(`${data}\nthis.out={RHYTHM_LANE_COUNT,RHYTHM_NOTE_TYPES,RHYTHM_DIFFICULTIES,RHYTHM_JUDGMENTS,RHYTHM_SCORE_WEIGHTS,RHYTHM_SONGS};`,context);
const D=context.out;
check('5レーン・4ノーツ種別',D.RHYTHM_LANE_COUNT===5&&D.RHYTHM_NOTE_TYPES.join(',')==='TAP,HOLD,FLICK,SLIDE');
check('5難易度と最大スコア',JSON.stringify(D.RHYTHM_DIFFICULTIES.map(x=>[x.id,x.maxScore]))===JSON.stringify([['EASY',600000],['NORMAL',700000],['HARD',800000],['EXPERT',900000],['MASTER',1000000]]));
check('判定幅とスコア率',JSON.stringify(D.RHYTHM_JUDGMENTS.map(x=>[x.id,x.windowMs,x.scoreRate]))===JSON.stringify([['MARVELOUS',25,1],['EXCELLENT',50,.98],['GREAT',100,.9],['GOOD',150,.7],['BAD',200,.3],['MISS',null,0]]));
check('判定90%＋コンボ10%',D.RHYTHM_SCORE_WEIGHTS.judgment===.9&&D.RHYTHM_SCORE_WEIGHTS.combo===.1);
const song=D.RHYTHM_SONGS[0];
check('あつ杯テーマを既存track IDでテスト登録',D.RHYTHM_SONGS.length===1&&song.displayName==='あつ杯テーマ'&&song.bgmTrackId==='atsu_cup_theme'&&game.includes("id:'atsu_cup_theme', name:'あつ杯テーマ'"));
check('全難易度に正式譜面フィールド',D.RHYTHM_DIFFICULTIES.every(x=>song.difficulties[x.id]&&'level' in song.difficulties[x.id]&&Array.isArray(song.difficulties[x.id].notes)&&song.difficulties[x.id].totalNotes===song.difficulties[x.id].notes.length));

const touchHandlers={};
const laneEvents=Array.from({length:5},()=>[]);
let lanes;
const playArea={
  getBoundingClientRect:()=>({left:0,width:500}),
  querySelectorAll:()=>lanes,
  closest:selector=>selector==='[data-rhythm-play-area]'?playArea:null,
};
lanes=laneEvents.map(events=>({
  closest:selector=>selector==='[data-rhythm-play-area]'?playArea:null,
  dispatchEvent:event=>{events.push(event);return true;},
}));
class FakePointerEvent{constructor(type,init){this.type=type;Object.assign(this,init);}}
const browserContext={
  document:{addEventListener:(type,handler,options)=>{touchHandlers[type]={handler,options};}},
  window:{},
  PointerEvent:FakePointerEvent,
};
vm.runInNewContext(data,browserContext);
check('native複数タッチbridgeをcapture/passive:falseで登録',
  touchHandlers.touchstart?.options?.capture===true&&touchHandlers.touchstart?.options?.passive===false&&
  touchHandlers.touchend?.options?.capture===true&&touchHandlers.touchend?.options?.passive===false);
let prevented=0,stopped=0;
const simultaneousTouches=[
  {identifier:11,clientX:50,clientY:100,target:lanes[0]},
  {identifier:22,clientX:450,clientY:100,target:lanes[4]},
];
touchHandlers.touchstart?.handler({
  changedTouches:simultaneousTouches,target:playArea,cancelable:true,
  preventDefault:()=>prevented++,stopImmediatePropagation:()=>stopped++,
});
const downA=laneEvents[0][0],downB=laneEvents[4][0];
check('同一touchstartの2本指を別レーンへ独立pointerdown化',
  downA?.type==='pointerdown'&&downB?.type==='pointerdown'&&
  downA.pointerType==='pen'&&downB.pointerType==='pen'&&downA.pointerId!==downB.pointerId);
check('元TouchEventを止めて二重判定を防ぐ',prevented===1&&stopped===1);
touchHandlers.touchend?.handler({
  changedTouches:simultaneousTouches,target:playArea,cancelable:true,
  preventDefault:()=>prevented++,stopImmediatePropagation:()=>stopped++,
});
check('2本指の終了も元レーンへ独立pointerup化',
  laneEvents[0][1]?.type==='pointerup'&&laneEvents[4][1]?.type==='pointerup'&&
  laneEvents[0][1].pointerId===downA?.pointerId&&laneEvents[4][1].pointerId===downB?.pointerId);

const logic=game.match(/const RHYTHM_SETTINGS_KEY = [\s\S]*?const rhythmBestRecord = \(records,songId,difficultyId\) => normalizeRhythmBestRecord\(records\?\.\[songId\]\?\.\[difficultyId\]\);/)?.[0];
check('normalizeロジックを抽出できる',!!logic);
if(logic){const c={RHYTHM_SONGS:D.RHYTHM_SONGS,RHYTHM_DIFFICULTIES:D.RHYTHM_DIFFICULTIES};vm.runInNewContext(`${logic}\nthis.out={DEFAULT_RHYTHM_SETTINGS,normalizeRhythmSettings,normalizeRhythmBestRecord,normalizeRhythmBestRecords};`,c);const L=c.out;
  const settings=L.normalizeRhythmSettings({noteSpeed:'bad',noteSize:999,fastSlowDisplay:'yes',effectAmount:'MAX'});
  check('設定normalizeが欠損・不正値を既定値へ戻す',JSON.stringify(settings)===JSON.stringify(L.DEFAULT_RHYTHM_SETTINGS));
  const record=L.normalizeRhythmBestRecord({bestScore:-1,maxCombo:'12.9',clear:1,MARVELOUS:'7',judgments:{MISS:-3}});
  check('BEST normalizeが型・負数を安全化',record.bestScore===0&&record.maxCombo===12&&record.clear===false&&record.judgments.MARVELOUS===7&&record.judgments.MISS===0);
  const all=L.normalizeRhythmBestRecords(null);
  check('未プレイのsongId×難易度を生成',D.RHYTHM_DIFFICULTIES.every(x=>all[song.songId][x.id].bestScore===0));
}
const index=read('monster-hero/index.html');
const rhythmScript=index.indexOf('<script src="data/rhythm-mode.js?');
const gameScript=index.indexOf("script.src = 'game-system.compiled.js");
check('データファイルを本体より先に読み込む',rhythmScript>0&&gameScript>rhythmScript);
check('入口はデバッグ設定だけ',game.includes('data-debug-rhythm-mode')&&game.includes("gameState==='RHYTHM_DEBUG'")&&!/gameState==='HOME'[\s\S]{0,1200}data-debug-rhythm-mode/.test(game));
check('通常公開フラグはOFF',game.includes('const RHYTHM_MODE_PUBLIC_RELEASE = false'));
check('独立した新規保存キー',game.includes("'mh_rhythm_settings_v1'")&&game.includes("'mh_rhythm_best_v1'"));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
