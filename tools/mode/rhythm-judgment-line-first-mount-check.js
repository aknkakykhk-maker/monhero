#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..','..');
const file=path.join(ROOT,'monster-hero/data/rhythm-lane-svg.js');
const src=fs.readFileSync(file,'utf8');
const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
const ok=(name,value)=>{assert(value,name);console.log(`OK: ${name}`);};

new vm.Script(src,{filename:'rhythm-lane-svg.js'});
ok('lane SVG JSの構文が有効',true);
ok('判定ラインをSVGレーンへ複製しない',!src.includes('data-rhythm-svg-judgment'));
ok('DOM判定ラインをSVGの状態に応じて隠さない',!src.includes('data-rhythm-svg-ready')&&!src.includes('[data-rhythm-judgment-line]{opacity:0'));
ok('レーンSVGの初回・再マウント処理は共通',src.includes('if (currentArea) mount(currentArea)')&&src.includes("currentArea = document.querySelector('[data-rhythm-play-area]')"));
ok('判定ライン本体はプレイエリア内へ常時生成',game.includes('<div ref={judgmentLineRef} data-rhythm-judgment-line')&&game.includes("bottom-[12%]"));
ok('判定・入力・速度の値は変更しない',!src.includes('judgmentTimingOffsetMs=')&&!src.includes('noteSpeed=')&&!src.includes('RHYTHM_JUDGE_WINDOWS='));
console.log('OK: 初回と再プレイで共通のDOM判定ラインを表示');
