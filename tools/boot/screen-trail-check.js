#!/usr/bin/env node
// 画面の出来事の記録(MH_SCREEN_TRAIL・10-core.jsx)が、つながったままかを見る(2026-11-07)。
//
//   node tools/boot/screen-trail-check.js
//
// 【なぜ要るか】
// 社長「モンビー中に音は流れてるのにいきなりホームに戻された」。再現できず、次に起きたときの手がかりを残すために足した。
// 記録はどこで抜けても画面は動くので、気づけない。画面の切り替え・エラーの受け止め・回転・演奏の始まり・演奏の診断(stats.scr)の
// 5か所につながっていることと、新しいキーが保存の一覧に載っていることを見る。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const ok = (name, cond) => { console.log(`${cond ? 'OK' : 'NG'}: ${name}`); if (!cond) failed++; };
const core = read('monster-hero/src/parts/10-core.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const eb = read('monster-hero/src/parts/50-error-boundary.jsx');
const play = read('monster-hero/src/parts/30-rhythm-play.jsx');
const data = read('monster-hero/data/rhythm-mode.js');
ok('記録の本体がある(最近30件・新しいキー mh_screen_trail_v1)', /const MH_SCREEN_TRAIL_KEY='mh_screen_trail_v1'/.test(core) && /const MAX=30;/.test(core));
ok('画面が隠れた・戻った・描き直しの止まり・WebGL を記録する', /visibilitychange/.test(core) && /push\('gap'/.test(core) && /webglcontextlost/.test(core));
ok('画面(gameState)を変えるたびに、どの処理が変えたかを記録する', /MH_SCREEN_TRAIL\.push\('gs', `\$\{next\}<\$\{gameStateCaller\(\)\}`\)/.test(app));
ok('画面のエラーを受け止めたら記録する', /MH_SCREEN_TRAIL\.push\('err'/.test(eb));
ok('自前の回転(🔄 横)を記録する', /MH_SCREEN_TRAIL\.push\('rot'/.test(data));
ok('演奏の始まりを記録し、演奏の診断に stats.scr として足す', /MH_SCREEN_TRAIL\.push\('play','start:'/.test(play) && /scr:MH_SCREEN_TRAIL\.compact\(MH_SCREEN_TRAIL\.sinceLast\('play','start'\)\)/.test(play));
ok('新しいキーが保存の一覧(SAVE_DATA.md)に載っている', /`mh_screen_trail_v1`/.test(read('docs/spec/SAVE_DATA.md')));
console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
