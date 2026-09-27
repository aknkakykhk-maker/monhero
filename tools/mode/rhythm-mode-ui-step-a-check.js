// モンヒロビートの画面(STEP A)の作りを確かめる。
const fs=require('fs');
const g=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const h=fs.readFileSync('monster-hero/data/help.js','utf8');
const css=fs.readFileSync('monster-hero/index.html','utf8');
const m=['data-rhythm-hud','data-rhythm-score','data-rhythm-combo','BEST {Number(bestScore||0).toLocaleString()}','data-rhythm-judgment-display',"bottom:'calc(var(--mh-judgment-line-bottom,12%) + 38px)'",'bg-gradient-to-r from-fuchsia-400 via-cyan-100 to-fuchsia-400','data-rhythm-sublane-feedback={subLane}',"rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs)"];
// 2026-09-27 に今の形へ合わせた: BEST はスコアの部品(RhythmHudScore)が bestScore で受ける・判定表示は判定ラインの高さ(設定)に合わせて置く・
// 判定ラインの色は fuchsia-400・道は6レーン(12サブレーン)
for(const x of m){if(!g.includes(x)){console.error('missing:',x);process.exit(1);}}
if(!css.includes('[data-rhythm-lane][data-pressed="true"] { filter:brightness(1.15)'))process.exit(1);
if(!h.includes('判定表示は判定ライン付近へ置き、FAST／SLOWと一緒に約0.45秒で消えます。押している位置に対応する12サブレーンの1本'))process.exit(1);
console.log('OK: rhythm UI step A');
