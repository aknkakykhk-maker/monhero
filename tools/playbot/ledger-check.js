#!/usr/bin/env node
// 頼みごとの台帳(ledger.json)の書き方と、台帳の表(REQUESTS.md)が台帳どおりかを確かめる(いまの5種類・日時の形・親の有無)。
//   node tools/playbot/ledger-check.js
'use strict';
const { spawnSync } = require('child_process');
const r = spawnSync(process.execPath, [require('path').join(__dirname, 'ledger.js'), '--check'], { stdio: 'inherit' });
process.exit(r.status == null ? 1 : r.status);
