#!/usr/bin/env node
// run-checks-timeout: 900
// モンヒロサクセスの全画面を、縦390・横844・横667・幅320・大きい文字(1.3倍)で開き、押せる大きさ(44px)・字の小ささ(10px)・はみ出し・重なり・横画面の上の空白を見張る。
//   本体は success-shoot.js(止め絵も撮れる)。SHOT_QUICK=1 で縦390だけ。直すところは出力の NG の行。
//   撮る大きさは7通り・場面は40あまりで、1つの流れで回すと12分かかり run-checks の上限(600秒)を超えた(2026-11-14)。
//   見る物は減らさず、大きさごとに分けて4つの子(それぞれ別のポートの配信)で同時に回す。1本ずつ回すと同じ結果になる。
//
// flake の切り分け(2026-11-16): 並列の過負荷でだけ落ちる NG(単独では通る)が何件か出たので、
//   最初の実行で出た NG は「場面×大きさ」の組ごとに単独で再実行し、消えたものを flake・残ったものを実物として分けて出す。
//   実物だけが失敗の数に入る。切り分けは最大 MAX_RETRY 組・RETRY_BUDGET_MS までで、残りは「未切り分け」として失敗に数える。
//   --no-retry で切り分けを止める(最初の NG がそのまま失敗になる)。
// 低並列モード: --jobs N(または LAYOUT_JOBS=N)で同時に回す組の数を絞る。--jobs 1 で1組ずつ(遅いが一番軽い)。
'use strict';
const { spawn } = require('child_process');
const path = require('path');
// 大きさの名札('base' は縦390)を、時間が同じくらいになるよう4組に分ける。ポートはほかの検査と重ならない 19871〜19874
const GROUPS = [['base', 'big'], ['land', 'landbig'], ['land667', 's320'], ['s320big', 'ip']]; // ip: iPhone の縦 390×664(2026-11-14 編成の7体目が切れた)
const BASE_PORT = 19871;
const RETRY_PORT = 19881; // 単独再実行用(最初の実行と重ならない)
const MAX_RETRY = 12;
const RETRY_BUDGET_MS = 240000;

const args = process.argv.slice(2);
const argVal = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const JOBS = Math.max(1, Math.min(4, Number(argVal('--jobs') || process.env.LAYOUT_JOBS || 4) || 4));
const NO_RETRY = args.includes('--no-retry') || process.env.LAYOUT_NO_RETRY === '1';

const runShoot = (sizes, port, extraEnv = {}) => new Promise((resolve) => {
  const env = { ...process.env, SHOT_SIZES: sizes.join(','), SHOT_PORT: String(port), ...extraEnv };
  const c = spawn(process.execPath, [path.join(__dirname, 'success-shoot.js')], { env });
  let out = ''; let err = '';
  c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { err += d; });
  c.on('close', (code) => resolve({ out, err, code: code || 0 }));
  c.on('error', () => resolve({ out, err, code: 1 }));
});

// 同時に JOBS 本までで jobs を回す
const runPool = async (jobs, worker) => {
  const results = new Array(jobs.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(JOBS, jobs.length) }, async () => {
    while (next < jobs.length) { const i = next++; results[i] = await worker(jobs[i], i); }
  });
  await Promise.all(lanes);
  return results;
};

// NG の行「NG: S0(base): 検査名 — 詳細」から場面と大きさを取り出す(大きさの名札が無い行は base)
const parseNg = (line) => {
  const m = /^NG: ([A-Za-z0-9]+)(?:\(([^)]+)\))?:/.exec(line);
  return m ? { scene: m[1], size: m[2] || 'base', key: line.split(' — ')[0] } : null;
};

(async () => {
  const groups = process.env.SHOT_QUICK ? [['base']] : GROUPS;
  const rs = await runPool(groups, (g, i) => runShoot(g, BASE_PORT + i));
  const lines = rs.flatMap((r) => r.out.split('\n'));
  const skip = lines.filter((l) => l.startsWith('SKIP'));
  const okCount = lines.filter((l) => l.startsWith('OK')).length;
  // 子の最後の「NG N件」の行は子の要約なので、NG の項目としては数えない
  const isNgItem = (l) => l.startsWith('NG') && !/^NG \d+件$/.test(l);
  let ngLines = lines.filter(isNgItem);
  rs.forEach((r) => { if (r.err) console.log(r.err.slice(-500)); });
  if (skip.length && !lines.some((l) => l.startsWith('OK'))) { console.log(skip.join('\n')); process.exit(0); }

  // NG の行を出さずに落ちた組(配信の失敗など)は、その組を丸ごと単独で回し直す
  let crashed = false;
  for (let i = 0; i < groups.length; i++) {
    if (rs[i].code && !rs[i].out.split('\n').some((l) => l.startsWith('NG'))) {
      console.log(`組 ${groups[i].join('+')} の子が NG を出さずに落ちたので、単独で回し直します`);
      const again = await runShoot(groups[i], RETRY_PORT + 20 + i);
      if (again.code && !again.out.split('\n').some((l) => l.startsWith('NG'))) crashed = true;
      ngLines = ngLines.concat(again.out.split('\n').filter(isNgItem));
    }
  }

  // flake の切り分け: NG を場面×大きさの組ごとに単独再実行する
  const real = []; const flake = []; const unknown = [];
  if (ngLines.length && !NO_RETRY) {
    const byKey = new Map();
    ngLines.forEach((l) => { const p = parseNg(l); const k = p ? `${p.scene}|${p.size}` : `?|${l}`; if (!byKey.has(k)) byKey.set(k, { ...p, lines: [] }); byKey.get(k).lines.push(l); });
    const keys = [...byKey.keys()];
    const started = Date.now();
    let retried = 0;
    for (const k of keys) {
      const g = byKey.get(k);
      if (!g.scene || retried >= MAX_RETRY || Date.now() - started > RETRY_BUDGET_MS) { unknown.push(...g.lines); continue; }
      retried++;
      const r = await runShoot([g.size], RETRY_PORT + (retried % 8), { SHOT_ONLY: g.scene });
      const reNg = r.out.split('\n').filter(isNgItem);
      if (r.code && !reNg.length) { crashed = true; unknown.push(...g.lines); continue; }
      const reKeys = new Set(reNg.map((l) => (parseNg(l) || {}).key));
      g.lines.forEach((l) => { const p = parseNg(l); (p && reKeys.has(p.key) ? real : flake).push(l); });
      // 再実行で初めて出た NG(最初の実行では出なかった組の項目)も実物に足す
      reNg.forEach((l) => { const p = parseNg(l); if (p && !g.lines.some((x) => (parseNg(x) || {}).key === p.key)) real.push(l); });
    }
  } else {
    real.push(...ngLines);
  }

  console.log(`${okCount} 件OK / NG ${real.length + unknown.length}件`
    + (flake.length ? ` (flake ${flake.length}件は単独再実行で消えた)` : '')
    + (unknown.length ? ` (未切り分け ${unknown.length}件)` : ''));
  real.slice(0, 20).forEach((l) => console.log(l.slice(0, 220)));
  unknown.slice(0, 20).forEach((l) => console.log(`未切り分け ${l.slice(0, 200)}`));
  flake.slice(0, 20).forEach((l) => console.log(`flake ${l.slice(0, 200)}`));
  process.exit(real.length || unknown.length || crashed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
