#!/usr/bin/env node
// 成績表の部員ごとの表と scores.json が「できごとの記録」の足し算と一致しているか(手で数えた点が混ざっていないか)。
//   node tools/playbot/scoreboard-check.js
'use strict';
const { spawnSync } = require('child_process');
const r = spawnSync(process.execPath, [require('path').join(__dirname, 'scoreboard.js'), '--check'], { stdio: 'inherit' });
process.exit(r.status == null ? 1 : r.status);
