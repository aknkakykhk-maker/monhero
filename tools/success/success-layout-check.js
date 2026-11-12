#!/usr/bin/env node
// モンヒロサクセスの全画面を、縦390・横844・横667・幅320・大きい文字(1.3倍)で開き、押せる大きさ(44px)・字の小ささ(10px)・はみ出し・重なり・横画面の上の空白を見張る(1〜2分)。
//   本体は success-shoot.js(止め絵も撮れる)。SHOT_QUICK=1 で縦390だけ。直すところは出力の NG の行。
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const r = spawnSync(process.execPath, [path.join(__dirname, 'success-shoot.js')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const lines = (r.stdout || '').split('\n');
const ng = lines.filter((l) => l.startsWith('NG'));
console.log(lines.filter((l) => l.startsWith('SKIP')).join('\n') || `${lines.filter((l) => l.startsWith('OK')).length} 件OK / NG ${ng.length}件`);
ng.slice(0, 20).forEach((l) => console.log(l.slice(0, 220)));
if (r.stderr) console.log(r.stderr.slice(-500));
process.exit(r.status || 0);
