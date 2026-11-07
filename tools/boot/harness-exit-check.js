#!/usr/bin/env node
'use strict';
// 本体を読み込む検査が、用を終えたらプロセスごと抜けるかを見張る(2026-11-07)。
//   #4832 で本体に「1コマごとに自分を呼び直す見張り」(10-core.jsx)が入り、harness の loadDyeModule で読み込む検査が
//   「すべてOK」と出たあと終わらず、run-checks が600秒の時間切れになった(種族チャレンジ・更新履歴のまとまり の検査など)。
//   ここでは本体を読み込むだけの小さなプロセスを立て、決めた秒数のうちに自分で抜けるかを見る。
//   落ちたら: 本体の読み込み時に、止まらないタイマー・繰り返し(setInterval・自分を呼び直す setTimeout / requestAnimationFrame)が
//   増えていないか、harness の代わりの関数が unref しているかを見る
const { spawnSync } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const LIMIT_MS = 90000;
const t0 = Date.now();
const r = spawnSync(process.execPath, ['-e', "require('./tools/harness').loadDyeModule(); console.log('loaded')"], { cwd: ROOT, timeout: LIMIT_MS, encoding: 'utf8' });
const ms = Date.now() - t0;
const loaded = /loaded/.test(r.stdout || '');
const exited = !r.error && r.status === 0;
console.log(`${loaded ? 'OK' : 'NG'}: 本体を読み込める${loaded ? '' : ` — ${(r.stderr || '').slice(0, 300)}`}`);
console.log(`${exited ? 'OK' : 'NG'}: 読み込んだあと、プロセスが自分で抜ける(${Math.round(ms / 1000)}秒・上限${LIMIT_MS / 1000}秒)${exited ? '' : ' — 止まらないタイマーが残っている見込み'}`);
const ok = loaded && exited;
console.log(ok ? '\nすべてOK' : '\nNGがあります');
process.exit(ok ? 0 : 1);
