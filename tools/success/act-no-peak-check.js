#!/usr/bin/env node
// トレーニング・修行の演出の場面では、ピーク中の炎(MsxPeakFx)を出さない(2026-11-14 社長 r1114-011)。
//   node tools/success/act-no-peak-check.js
// 演出の部品(56-monsuc-actfx.jsx のトレーニングの演出・56-monhero-success-r3-quest.jsx の修行の場面)にある育てる子の絵 MsxMonArt が、
// すべて noPeak つきであること。noPeak が無い MsxMonArt は、ピーク中だと炎(.msx-peakon)をまとう。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
let fail = 0;
const ck = (name, ok, d = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${d ? ` — ${d}` : ''}`); if (!ok) fail++; };
const FILES = ['56-monsuc-actfx.jsx', '56-monhero-success-r3-quest.jsx'];
for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, 'monster-hero', 'src', 'parts', f), 'utf8');
  const arts = [...src.matchAll(/<MsxMonArt\b[^>]*?\/>/g)].map((m) => m[0]);
  const bad = arts.filter((a) => !/\bnoPeak\b/.test(a));
  ck(`${f}: 育てる子の絵(${arts.length}か所)はすべて noPeak つき`, arts.length > 0 && bad.length === 0, bad.map((a) => a.slice(0, 60)).join(' / '));
}
// 演出の中で、ピークの炎の部品を直接置いていない
const act = fs.readFileSync(path.join(ROOT, 'monster-hero', 'src', 'parts', FILES[0]), 'utf8');
ck('トレーニングの演出に MsxPeakFx を直接置いていない', !/<MsxPeakFx\b/.test(act));
process.exit(fail ? 1 : 0);
