#!/usr/bin/env node
// モンヒロサクセスの試算(success-sim.js)が回り、ねらいの形から外れていないかの見張り(数秒)。
//   ・編成なしの子は C 前後(総合力の中央値が 6,000〜8,000)
//   ・編成が強いほど育つ(編成なし < B 6体 < M 6体)
//   ・デビュー戦でゲームオーバーになるのは編成なしでも1割未満
//   ・ランダムイベント(monhero-success-events.js)は1回の育成で 約20回(15〜28)
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'suc-')), 'sim.json');
const r = spawnSync(process.execPath, [path.join(__dirname, 'success-sim.js'), '--runs', '80', '--only', 'none,B6,M6', '--json', out], { encoding: 'utf8' });
if (r.status !== 0) { console.error('NG success-sim-check: 試算が止まった'); console.error((r.stderr || '').slice(-800)); process.exit(1); }
const res = JSON.parse(fs.readFileSync(out, 'utf8')).results;
const errors = [];
const none = res[0]; const b6 = res.find(x => x.label.startsWith('B 6体(')); const m6 = res.find(x => x.label.startsWith('M 6体'));
if (!(none.powerMedian >= 6000 && none.powerMedian < 8000)) errors.push(`編成なしの総合力の中央値が C(6,000〜7,999)でない: ${none.powerMedian}`);
if (!(none.powerMedian < b6.powerMedian && b6.powerMedian < m6.powerMedian)) errors.push(`編成が強いほど育つ形でない: ${none.powerMedian} / ${b6.powerMedian} / ${m6.powerMedian}`);
const evn = none.randomEvents ? none.randomEvents.perRun : null;
if (!(evn >= 15 && evn <= 28)) errors.push(`ランダムイベントが1回の育成で 約20回(15〜28)でない: ${evn}`);
if (!((none.end.gameover || 0) < 10)) errors.push(`編成なしのゲームオーバーが1割を超えた: ${none.end.gameover}%`);
if (errors.length) { console.error('NG success-sim-check'); errors.forEach(e => console.error('  - ' + e)); process.exit(1); }
console.log(`OK success-sim-check: 総合力の中央値 編成なし ${none.powerMedian} / B 6体 ${b6.powerMedian} / M 6体 ${m6.powerMedian}・ランダムイベント ${evn}回`);
