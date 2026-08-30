const fs=require('fs');
const g=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const h=fs.readFileSync('monster-hero/data/help.js','utf8');
const m=['data-rhythm-hud','data-rhythm-score','data-rhythm-combo','BEST {Number(bestRecord?.bestScore||0).toLocaleString()}','data-rhythm-judgment-display',"bottom:'calc(12% + 38px)'",'bg-gradient-to-r from-fuchsia-300 via-cyan-100 to-fuchsia-300',"borderBottom=pressed?'3px solid rgba(207,250,254,0.98)'","filter=pressed?'brightness(1.15)'","rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs)"];
for(const x of m){if(!g.includes(x)){console.error('missing:',x);process.exit(1);}}
if(!h.includes('判定表示を判定ライン付近へ置き、押しているレーンが発光'))process.exit(1);
console.log('OK: rhythm UI step A');
