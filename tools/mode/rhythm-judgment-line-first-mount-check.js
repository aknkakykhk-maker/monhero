#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..','..');
const file=path.join(ROOT,'monster-hero/data/rhythm-lane-svg.js');
const src=fs.readFileSync(file,'utf8');
const ok=(name,value)=>{assert(value,name);console.log(`OK: ${name}`);};

new vm.Script(src,{filename:'rhythm-lane-svg.js'});
ok('lane SVG JSの構文が有効',true);
ok('元の判定ラインはSVG ready後だけ隠す',src.includes('[data-rhythm-play-area][data-rhythm-svg-ready="true"] [data-rhythm-judgment-line]{opacity:0!important;box-shadow:none!important}'));
ok('判定ラインを無条件にopacity 0へしない',!src.includes('\n      [data-rhythm-judgment-line]{opacity:0!important'));
ok('SVG判定グループと表示領域を確認してからreadyにする',src.includes("svg.querySelector('[data-rhythm-svg-judgment]')")&&src.includes('rect.width > 0 && rect.height > 0')&&src.includes("area.dataset.rhythmSvgReady = 'true'"));
ok('初回マウント後は2フレーム待って再確認する',src.includes('requestAnimationFrame(() => requestAnimationFrame(verify))'));
ok('初回失敗時はSVGを1回作り直し最大4回まで確認する',src.includes('attempts === 2 && svg')&&src.includes('svg.remove()')&&src.includes('mount(area)')&&src.includes('attempts < 4'));
ok('新しいプレイエリアではready属性を一度外す',src.includes("area.removeAttribute('data-rhythm-svg-ready')"));
ok('判定・入力・速度の値は変更しない',!src.includes('judgmentTimingOffsetMs=')&&!src.includes('noteSpeed=')&&!src.includes('RHYTHM_JUDGE_WINDOWS='));
console.log('OK: 初回プレイの判定ライン表示fallback');
