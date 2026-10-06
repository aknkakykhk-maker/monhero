#!/usr/bin/env node
// 押したレーンの光(サブレーンの台形)が、横向きの「道の幅」に追いつくことを見張る(2026-10-07)。
//
//   node tools/mode/rhythm-glow-road-width-check.js
//
// ユーザー報告「押している位置に発光位置がずれている。縦だとずれない・横にするとずれる」。
// 光の台形は演奏画面を作るときに一度だけ切り抜かれ、「広い」(倍率1)のまま残っていた。
// 判定は選んだ道の幅(ふつう .92 / 細い .86)で測るので、外側のサブレーンほど指の位置と光がずれていた。
// 実ブラウザで画面を90度回して確かめたとき、細い幅で外側4サブレーンが光の外になった(直したあとは0)。
// 直したのは rhythmLayoutPlayArea(幅が変わるたびに呼ばれる)。そこで光の台形も切り直す。
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const runtime=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const play=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};

const layout=runtime.match(/const rhythmLayoutPlayArea=area=>\{[\s\S]*?\n\};/)?.[0]||'';
check('rhythmLayoutPlayArea を取り出せる',layout.length>200);
check('光の台形(data-rhythm-sublane-feedback)を切り直している',/querySelectorAll\('\[data-rhythm-sublane-feedback\]'\)/.test(layout));
check('切り直しは rhythmSubLanePolygon(判定と同じ投影)で作る',/style\.clipPath=rhythmSubLanePolygon\(subLane\)/.test(layout));
check('光の台形の番号は属性から読む(並びに頼らない)',/getAttribute\('data-rhythm-sublane-feedback'\)/.test(layout));
check('レーンの切り抜き・サブレーン境界も同じ関数で切り直している(光だけが取り残されない)',
  /rhythmLanePolygon\(index\)/.test(layout)&&/rhythmBoundaryLinePolygon\(index\+\.5\)/.test(layout));
check('道の幅が変わると rhythmLayoutPlayArea を呼ぶ(演奏画面側)',
  /React\.useLayoutEffect\(\(\)=>\{[\s\S]{0,200}rhythmLayoutPlayArea\(area\)[\s\S]{0,300}\},\[roadFactor\]\)/.test(play));
check('光の台形の初期値は演奏画面側のメモで作る(幅が変わったら上の関数が上書きする)',/clipPath:rhythmSubLanePolygon\(subLane\)/.test(play));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
