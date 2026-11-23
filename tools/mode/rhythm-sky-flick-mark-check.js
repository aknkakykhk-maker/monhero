#!/usr/bin/env node
// 空中のフリックの印(2026-11-23 r1119-148 社長の選択「案A 地上と同じ山形」)。ソースを読むだけ(すぐ終わる)。見るもの:
//   ・空中の箱(案Z・ガラスの箱)のフリックは drawSkyFlickMark で印を重ねる(前の、向きに関係ない小さな白い三角に戻っていない)
//   ・印は地上と同じ焼いた絵: 横フリックは sideChevronSprite(向き)、上フリックは arrowSprite('flick', …FLICK_ARROW_…)
//   ・箱の幅に合わせて大きくする(横は箱の幅の 0.72 倍・上は 0.34 倍)・奥の小さい箱でも下限 0.45 倍
//   ・絵を貼るだけ(drawImage)なので、2D と GPU(webgl の描き口)で同じに出る
// 止め絵: docs/progress/beat/sky-flick-2026-11-23/(after-A-*.png は 2D、*-gpu.png は GPU)。撮り方は rhythm-listen-play-check.js --shot(--gpu)
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../monster-hero/data/rhythm-mode.js'), 'utf8');
let ng = 0; const ok = (c, l) => { console.log(`${c ? 'OK' : 'NG'}: ${l}`); if (!c) ng++; };
const i = src.indexOf('const drawSkyFlickMark=('), body = i >= 0 ? src.slice(i, src.indexOf('\n  };', i)) : '';
ok(i >= 0, '空中のフリックの印を描く drawSkyFlickMark がある');
ok(/if\(note\.type==='FLICK'\|\|note\._rhythmOriginalType==='FLICK'\)drawSkyFlickMark\(note,geo\.head,o\);/.test(src), 'ガラスの箱のフリックは drawSkyFlickMark で印を重ねる');
ok(!/ay=hd\.cy-fh\/2-3,aw=Math\.max\(4,fh\*\.7\)/.test(src), '前の小さな白い三角は残っていない');
ok(/dir\?sideChevronSprite\(dir\):arrowSprite\('flick',26,19,FLICK_ARROW_GLOWS,FLICK_ARROW_FILL\)/.test(body), '印は地上と同じ絵(横=山形・上=桃色の矢印)');
ok(/Math\.max\(\.45,\(W\*\(dir\?\.72:\.34\)\)\/sprite\.tw\)/.test(body), '箱の幅に合わせて大きくする(下限あり)');
ok(/ctx\.drawImage\(sprite\.canvas,/.test(body) && !/beginPath|fill\(\)/.test(body), '絵を貼るだけ(2D と GPU で同じ)');
console.log(ng ? `\n${ng}件のNGがあります` : '\nすべてOK');
process.exitCode = ng ? 1 : 0;
