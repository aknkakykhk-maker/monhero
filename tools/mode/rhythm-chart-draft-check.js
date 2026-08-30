#!/usr/bin/env node
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const draft=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring/atsu-cup-theme-easy-draft.json'),'utf8'));
const source=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring/atsu-cup-theme-onset-candidates.json'),'utf8'));
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
check('EASY制作ドラフト',draft.trackId==='atsu_cup_theme'&&draft.difficulty==='EASY');
check('100ノーツ',draft.noteCount===100&&draft.points.length===100);
check('自動生成を完成譜面扱いしない',draft.reviewRequired===true&&draft.runtimeConnected===false&&draft.noteTypePlan==='TAP_ONLY');
check('169BPM/40ms基準',draft.bpm===169&&draft.beatZeroMs===40&&draft.subdivisionsPerBeat===4);
const ids=draft.points.map(p=>p[0]);
check('時系列・重複なし',ids.every((v,i)=>i===0||v>ids[i-1]));
check('EASY最小間隔は1拍',ids.every((v,i)=>i===0||v-ids[i-1]>=draft.profile.minGridGap));
const sourceMap=new Map(source.candidates.map(row=>[row[0],row]));
check('全点が実音源候補由来',draft.points.every(row=>JSON.stringify(sourceMap.get(row[0]))===JSON.stringify(row)));
const step=(60000/169)/4,firstMs=40+ids[0]*step,lastMs=40+ids[ids.length-1]*step;
check('開始猶予と終了余白を確保',firstMs>=draft.profile.minTimeMs&&lastMs<=144640-draft.profile.endPaddingMs);
check('現行ゲーム譜面には未接続',!fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8').includes('atsu-cup-theme-easy-draft'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
