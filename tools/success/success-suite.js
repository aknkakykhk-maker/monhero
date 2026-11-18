#!/usr/bin/env node
// モンヒロサクセスの点検を1コマンドで束ねて回し、結果を1枚に要約する(2026-11-16)。
//   node tools/success/success-suite.js                  … 芯の3つ(soak・芯・sim)→ 画面通し → レイアウト の順に全部(15〜20分ほど)
//   node tools/success/success-suite.js --only soak,sim  … 名前を並べたものだけ(soak / core / sim / screen / layout)
//   node tools/success/success-suite.js --skip layout    … 名前のものを除く(短く済ませたいとき)
//   node tools/success/success-suite.js --quick          … レイアウトを縦390だけにする(SHOT_QUICK=1)
// 1つずつ順に回す(同時に回すと、ブラウザのポートと機械の負荷がぶつかる)。各検査の出力はそのまま出し、最後に要約を出す。
// 足りないファイル(ENOENT)や書けない環境(EPERM)で止まった検査は「環境不足」として分けて出す
//   (sparse checkout で docs/ や supabase/ が無いとき・サンドボックスで書き込みが止められたときなど)。
// 終了コード: 全部 OK のときだけ 0。実物の NG・環境不足のどちらかあれば 1(要約に理由が出る)。
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const DIR = __dirname;
const CHECKS = [
  { id: 'soak', name: '芯の通し', file: 'success-soak-check.js' },
  { id: 'core', name: '芯の決まり', file: 'monhero-success-check.js' },
  { id: 'sim', name: '試算の形', file: 'success-sim-check.js' },
  { id: 'screen', name: '画面の通し', file: 'success-screen-browser-check.js' },
  { id: 'layout', name: '画面の並び', file: 'success-layout-check.js' },
];
const args = process.argv.slice(2);
const argVal = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const only = (argVal('--only') || '').split(',').map((x) => x.trim()).filter(Boolean);
const skip = (argVal('--skip') || '').split(',').map((x) => x.trim()).filter(Boolean);
const quick = args.includes('--quick');
const targets = CHECKS.filter((c) => (!only.length || only.includes(c.id)) && !skip.includes(c.id));

const runOne = (c) => new Promise((resolve) => {
  const env = { ...process.env };
  if (quick && c.id === 'layout') env.SHOT_QUICK = '1';
  const started = Date.now();
  console.log(`\n===== ${c.name}(${c.file}) =====`);
  const child = spawn(process.execPath, [path.join(DIR, c.file)], { env });
  let out = '';
  child.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
  child.stderr.on('data', (d) => { out += d; process.stderr.write(d); });
  child.on('error', () => resolve({ ...c, status: 'env', detail: '起動できなかった', sec: 0 }));
  child.on('close', (code) => {
    const sec = Math.round((Date.now() - started) / 1000);
    const missing = [...new Set([...out.matchAll(/ENOENT[^'\n]*'([^']+)'/g)].map((m) => m[1]))];
    if (code && missing.length) { resolve({ ...c, status: 'env', detail: `足りないファイル: ${missing.slice(0, 3).join(' / ')}`, sec }); return; }
    if (code && /EPERM: operation not permitted, write/.test(out)) { resolve({ ...c, status: 'env', detail: '書けない環境で止まった(EPERM)', sec }); return; }
    const summary = out.split('\n').filter((l) => /^(OK|NG|\d+ 件OK)/.test(l)).pop() || '';
    resolve({ ...c, status: code ? 'ng' : 'ok', detail: summary.slice(0, 160), sec });
  });
});

(async () => {
  if (!targets.length) { console.log('回す検査がありません(--only / --skip の名前を確認: soak core sim screen layout)'); process.exit(1); }
  const results = [];
  for (const c of targets) results.push(await runOne(c));
  const mark = { ok: '✓', ng: '✗', env: '△' };
  const label = { ok: 'OK', ng: 'NG', env: '環境不足' };
  console.log('\n===== サクセス点検の要約 =====');
  results.forEach((r) => console.log(`${mark[r.status]} ${r.id.padEnd(7)} ${r.name}  ${r.sec}s  ${label[r.status]}${r.detail ? ` — ${r.detail}` : ''}`));
  const nOk = results.filter((r) => r.status === 'ok').length;
  const nNg = results.filter((r) => r.status === 'ng').length;
  const nEnv = results.filter((r) => r.status === 'env').length;
  console.log(`合計: OK ${nOk} / NG ${nNg} / 環境不足 ${nEnv}(全${results.length}件)`);
  process.exit(nNg || nEnv ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
