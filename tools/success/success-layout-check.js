#!/usr/bin/env node
// run-checks-timeout: 900
// モンヒロサクセスの全画面を、縦390・横844・横667・幅320・大きい文字(1.3倍)で開き、押せる大きさ(44px)・字の小ささ(10px)・はみ出し・重なり・横画面の上の空白を見張る。
//   本体は success-shoot.js(止め絵も撮れる)。SHOT_QUICK=1 で縦390だけ。直すところは出力の NG の行。
//   撮る大きさは7通り・場面は40あまりで、1つの流れで回すと12分かかり run-checks の上限(600秒)を超えた(2026-11-14)。
//   見る物は減らさず、大きさごとに分けて4つの子(それぞれ別のポートの配信)で同時に回す。1本ずつ回すと同じ結果になる。
'use strict';
const { spawn } = require('child_process');
const path = require('path');
// 大きさの名札('base' は縦390)を、時間が同じくらいになるよう4組に分ける。ポートはほかの検査と重ならない 19871〜19874
const GROUPS = [['base', 'big'], ['land', 'landbig'], ['land667', 's320'], ['s320big', 'ip']]; // ip: iPhone の縦 390×664(2026-11-14 編成の7体目が切れた)
const BASE_PORT = 19871;
const runOne = (sizes, i) => new Promise((resolve) => {
  const env = { ...process.env, SHOT_SIZES: sizes.join(','), SHOT_PORT: String(BASE_PORT + i) };
  const c = spawn(process.execPath, [path.join(__dirname, 'success-shoot.js')], { env });
  let out = ''; let err = '';
  c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { err += d; });
  c.on('close', (code) => resolve({ out, err, code: code || 0 }));
});
(async () => {
  const groups = process.env.SHOT_QUICK ? [['base']] : GROUPS;
  const rs = await Promise.all(groups.map((g, i) => runOne(g, i)));
  const lines = rs.flatMap((r) => r.out.split('\n'));
  const ng = lines.filter((l) => l.startsWith('NG'));
  const skip = lines.filter((l) => l.startsWith('SKIP'));
  console.log(skip.join('\n') || `${lines.filter((l) => l.startsWith('OK')).length} 件OK / NG ${ng.length}件`);
  ng.slice(0, 20).forEach((l) => console.log(l.slice(0, 220)));
  rs.forEach((r) => { if (r.err) console.log(r.err.slice(-500)); });
  // 子が NG の行を出さずに落ちたとき(配信の失敗など)も、そのまま落とす
  process.exit(rs.some((r) => r.code) || ng.length ? 1 : 0);
})();
