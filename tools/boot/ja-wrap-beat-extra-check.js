#!/usr/bin/env node
// モンヒロビートの画面のうち、全国ランキング・マスモンランキングの窓・HELL の鍵・ノーツ図鑑・これまでの記録の文が、言葉の途中で折れていないか・字が切れていないかを数える(2026-10-27・ビート部 リバースくん)。
// 数え方と道筋は ja-wrap-beat-screen-check.js が持ち、ここはその extra の部分を呼ぶだけ(1本で巡ると run-checks の上限600秒を超えるため分けた)。
//
//   node tools/boot/ja-wrap-beat-extra-check.js          # 320×568・375×667・390×844・844×390 で数える
//   node tools/boot/ja-wrap-beat-extra-check.js --list   # 折れた所・切れた所を全部出す
'use strict';
const { spawnSync } = require('child_process');
const r = spawnSync(process.execPath, [require('path').join(__dirname, 'ja-wrap-beat-screen-check.js'), '--part', 'extra', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status == null ? 1 : r.status);
