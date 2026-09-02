const fs=require('fs');
const g=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const h=fs.readFileSync('monster-hero/data/help.js','utf8');
const css=fs.readFileSync('monster-hero/index.html','utf8');
const m=['data-rhythm-hud','data-rhythm-score','data-rhythm-combo','BEST {Number(bestRecord?.bestScore||0).toLocaleString()}','data-rhythm-judgment-display',"bottom:'calc(12% + 38px)'",'bg-gradient-to-r from-fuchsia-300 via-cyan-100 to-fuchsia-300','data-rhythm-sublane-feedback={subLane}',"rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs)"];
for(const x of m){if(!g.includes(x)){console.error('missing:',x);process.exit(1);}}
if(!css.includes('[data-rhythm-lane][data-pressed="true"] { filter:brightness(1.15)'))process.exit(1);
if(!h.includes('判定表示は判定ライン付近へ置き、FAST／SLOWと一緒に約0.45秒で消えます。押している位置に対応する10サブレーンの1本'))process.exit(1);
console.log('OK: rhythm UI step A');
