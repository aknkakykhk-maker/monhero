#!/usr/bin/env node
// モンヒロビートのマルチの画面(フリーマッチの待ち・プライベートの部屋・選曲・マスモンを呼ぶ・結果)の文が、言葉の途中で折れていないか・字が切れていないかを、偽の通信で数える(本番の部屋は作らない)(2026-10-27・ビート部 リバースくん)。
// 数え方と道筋は ja-wrap-beat-screen-check.js が持ち、ここはその multi の部分を呼ぶだけ(1本で巡ると run-checks の上限600秒を超えるため分けた)。
//
//   node tools/boot/ja-wrap-beat-multi-check.js          # 320×568・375×667・390×844・844×390 で数える
//   node tools/boot/ja-wrap-beat-multi-check.js --list   # 折れた所・切れた所を全部出す
'use strict';
const { spawnSync } = require('child_process');
const r = spawnSync(process.execPath, [require('path').join(__dirname, 'ja-wrap-beat-screen-check.js'), '--part', 'multi', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status == null ? 1 : r.status);
