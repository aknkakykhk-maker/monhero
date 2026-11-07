#!/usr/bin/env node
// AIコピー(ソラシドのアシカの5人目)の予測ダメージ「攻N」が、実際にコピーが撃つダメージと合うかを、クラシック(本編)の1戦で確かめる(2026-11-06)。
// 中身は sorashido-copy-predict-browser-check.js と同じ(MODE=classic で流す入口)。
//
//   node tools/battle/sorashido-copy-predict-classic-browser-check.js
process.env.MODE = 'classic';
require('./sorashido-copy-predict-browser-check.js');
