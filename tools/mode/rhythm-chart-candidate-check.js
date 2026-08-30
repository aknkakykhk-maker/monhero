#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
const candidates=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring/atsu-cup-theme-onset-candidates.json'),'utf8'));
const timingSource=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-timing.js'),'utf8');
const ctx={Object,Number,Math};vm.createContext(ctx);vm.runInContext(`${timingSource}\nthis.__timing=RHYTHM_TIMING_DATA.atsu_cup_theme;this.__at=rhythmTimingAt;`,ctx);
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
check('あつ杯テーマの候補データ',candidates.trackId==='atsu_cup_theme'&&candidates.bpm===169&&candidates.beatZeroMs===40);
check('16分グリッド候補',candidates.subdivisionsPerBeat===4&&candidates.algorithm==='time-domain-onset-grid-v1');
check('282候補を保持',candidates.candidateCount===282&&candidates.candidates.length===282);
const indexes=candidates.candidates.map(row=>row[0]);
check('候補は昇順・重複なし',indexes.every((v,i)=>i===0||v>indexes[i-1]));
check('全候補が閾値以上',candidates.candidates.every(row=>Number(row[1])>=candidates.threshold));
check('実オンセットとの差は45ms以内',candidates.candidates.every(row=>Math.abs(Number(row[2]))<=45));
check('全候補を固定タイミングへ復元可能',candidates.candidates.every(row=>{const grid=Number(row[0]),beat=Math.floor(grid/4),sub=grid%4,t=ctx.__at('atsu_cup_theme',beat,sub,4);return Number.isFinite(t)&&t>=0&&t<=ctx.__timing.audioDurationMs;}));
check('候補抽出データはゲーム本体へ直接ロードしない',!fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8').includes('atsu-cup-theme-onset-candidates.json'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
