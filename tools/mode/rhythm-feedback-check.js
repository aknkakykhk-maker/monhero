#!/usr/bin/env node
// 音ゲーの「手ごたえ」まわりを確かめる。
//
//   node tools/mode/rhythm-feedback-check.js
//
// 実機で遊んでもらって出た報告に対応するもの。
//
//   ・フリックが成功したのか音で分からない（HOLD / SLIDE の終わりも同じ）
//   ・最後まで取れたときに、ちょっとした手ごたえ（光）がほしい
//   ・オプションの数値が±ボタンでしか変えられなくて面倒
//
// 判定・スコア・コンボの数え方には一切関与しないので、そこを触っていないことも見張る。
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
const rhythm=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- 1. 取れたときの音 ---
check('取れたときの音(playClear)がタップ音とは別に用意されている',
  /const playClear=\(\)=>\{/.test(rhythm)&&rhythm.includes('playClear,'));
check('タップ音と同じ設定(音量・ON/OFF・全体ミュート)を読む',(()=>{
  const body=rhythm.slice(rhythm.indexOf('const playClear=()=>{'),rhythm.indexOf('// フルコンボ等を達成して曲を終えたとき'));
  return body.includes('readSettings()')&&body.includes('settings.enabled')&&body.includes('settings.volume')
    &&body.includes('rhythmAudioGloballyEnabled()');
})());
check('専用の保存キーを増やしていない',!/mh_[a-z_]*clear/i.test(rhythm));
check('タップ音とは違う音になっている(高さが変わって抜ける)',(()=>{
  const body=rhythm.slice(rhythm.indexOf('const playClear=()=>{'),rhythm.indexOf('// フルコンボ等を達成して曲を終えたとき'));
  return body.includes('exponentialRampToValueAtTime(1975.53')&&body.includes('setValueAtTime(1318.51');
})());
check('鳴らすのはHOLD / SLIDE / FLICKだけで、TAPでは鳴らさない',
  game.includes("const clearedGesture=judgment!=='MISS'&&(note.type==='HOLD'||rhythmNoteIsSlide(note)||note._rhythmOriginalType==='FLICK');")
  &&game.includes('if(clearedGesture){')&&game.includes('RHYTHM_NOTE_SE_RUNTIME.playClear();'));
check('MISSでは鳴らさない',game.includes("judgment!=='MISS'&&(note.type==='HOLD'"));

// --- 2. 取れたときの光 ---
check('光は演出量の設定に従う(MINIMAL・軽量モードでは出さない)',
  game.includes("if(!settings.lightweightMode&&settings.effectAmount!=='MINIMAL')note._rhythmClearAt="));
check('音は演出量の設定に関わらず鳴る(手ごたえは残す)',(()=>{
  const block=game.slice(game.indexOf('if(clearedGesture){'),game.indexOf('if(settings.vibrationEnabled'));
  return block.indexOf('playClear()')<block.indexOf('lightweightMode');
})());
check('光っているあいだは消さず、判定ラインに置いたまま光らせる',
  game.includes('const clearFlash=note.done&&Number.isFinite(note._rhythmClearAt)&&songTimeMs-note._rhythmClearAt<RHYTHM_CLEAR_FLASH_MS;')
  &&game.includes('if(clearFlash)yPx=travel.judgmentY;'));
check('光る時間はCSSのアニメーションと同じ長さ',(()=>{
  const ms=Number((game.match(/const RHYTHM_CLEAR_FLASH_MS=(\d+);/)||[])[1]);
  const css=Number((rhythm.match(/\[data-rhythm-note\]\[data-rhythm-clear\] > span:last-child\{animation:rhythm-clear-pop \.(\d+)s/)||[])[1]);
  return Number.isFinite(ms)&&Number.isFinite(css)&&Math.abs(ms-css*10)<=10;
})(),`JS ${(game.match(/const RHYTHM_CLEAR_FLASH_MS=(\d+);/)||[])[1]}ms`);
check('やり直したときに光の印も捨てる',
  game.includes("el._rhythmClearFlag=undefined;delete el.dataset.rhythmClear;"));
check('光は入力を邪魔しない(ノーツ本体の表示だけを変える)',
  rhythm.includes('[data-rhythm-note][data-rhythm-clear] > span:last-child{animation:rhythm-clear-pop'));

// --- 3. 判定・スコアを変えていない ---
check('判定窓・スコア・コンボの計算に触っていない',
  !/rhythmJudgeTap=|rhythmJudgeRelease=|rhythmComboAfter=|RHYTHM_JUDGMENTS=/.test(
    game.slice(game.indexOf('const clearedGesture='),game.indexOf('if(settings.vibrationEnabled'))));

// --- 4. オプションのスライダー ---
const context={};
vm.createContext(context);
const snapSrc=game.slice(game.indexOf('const rhythmSnapOptionValue='),game.indexOf('const RhythmOptionsScreen')>0?game.indexOf('const RhythmOptionsScreen'):game.indexOf('const rhythmSnapOptionValue=')+600);
vm.runInContext(`${snapSrc.slice(0,snapSrc.indexOf('};')+2)}\nthis.out={rhythmSnapOptionValue};`,context);
const {rhythmSnapOptionValue}=context.out;
check('スライダーの値がその項目の目盛りに丸まる',
  rhythmSnapOptionValue(6.04,1,12,.1)===6&&rhythmSnapOptionValue(6.06,1,12,.1)===6.1
  &&rhythmSnapOptionValue(37.4,0,100,1)===37,
  `6.04→${rhythmSnapOptionValue(6.04,1,12,.1)} / 6.06→${rhythmSnapOptionValue(6.06,1,12,.1)}`);
check('範囲の外・数値でない値は必ず範囲の中へ収める',
  rhythmSnapOptionValue(-50,0,100,1)===0&&rhythmSnapOptionValue(999,0,100,1)===100
  &&rhythmSnapOptionValue('abc',1,12,.1)===1&&rhythmSnapOptionValue(NaN,0,100,1)===0);
check('小数の目盛りでも誤差が残らない',
  [1,1.1,2.5,6,11.9,12].every(v=>rhythmSnapOptionValue(v,1,12,.1)===v),
  [1,1.1,2.5,6,11.9,12].map(v=>rhythmSnapOptionValue(v,1,12,.1)).join(' / '));
check('つまんで動かせるスライダーがある',
  game.includes('<input type="range" data-rhythm-option-slider={key}')
  &&game.includes('onChange={e=>set(key,rhythmSnapOptionValue(e.target.value,min,max,step))}'));
check('微調整用の±ボタンも残っている',
  game.includes('aria-label={`${key}を下げる`}')&&game.includes('aria-label={`${key}を上げる`}')
  &&game.includes('rhythmStepOptionValue(value,min,max,step,direction)'));
check('スライダーは指で掴める大きさのつまみを持つ',(()=>{
  const size=Number((rhythm.match(/\.mh-rhythm-range::-webkit-slider-thumb\{[^}]*width:(\d+)px/)||[])[1]);
  return size>=24;
})(),`${(rhythm.match(/\.mh-rhythm-range::-webkit-slider-thumb\{[^}]*width:(\d+)px/)||[])[1]}px`);
check('いまの値までを色で塗り分ける',game.includes('linear-gradient(90deg,#d946ef 0%,#22d3ee ${percent}%'));
// 音量・速度・サイズ・判定ずれのすべてがこの部品を通る
const usesStepper=[...game.matchAll(/stepper\('([a-zA-Z]+)'/g)].map(m=>m[1]);
check('音量・ノーツ速度・サイズ・判定ずれのすべてがスライダーになる',
  ['bgmVolume','noteSeVolume','noteSpeed','noteSize','judgmentTimingOffsetMs'].every(k=>usesStepper.includes(k)),
  usesStepper.join(' / '));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
