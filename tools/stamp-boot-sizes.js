// 起動時に読み込むファイルの実サイズ(バイト)を index.html の __mhBoot へ書き込む。
//
// 【なぜ必要か】
// ローディングのゲージは「実際に受け取ったバイト数 ÷ 全体のバイト数」で動かしている。
// 全体のバイト数を手で書くと、絵や曲を差し替えるたびにずれていき、
// 「100%になったのにまだ読み込んでいる」「途中で100%を超える」といった状態になる。
// ここでビルドのたびに実ファイルから測り直すことで、そのずれが起きないようにする。
//
// 対象は index.html が読み込む同一オリジンのスクリプトと、起動時に必ず取りにいく
// タイトル画像・タイトルBGM。外部CDN(Tailwind)は大きさが分からないので数に入れない。
const fs = require('fs');
const path = require('path');
const { REPO_ROOT } = require('./harness');

const WEB_ROOT = path.join(REPO_ROOT, 'monster-hero');
const INDEX = path.join(WEB_ROOT, 'index.html');
// スクリプト以外で、起動が終わるまでに必ず読み込むもの
const EXTRA_FILES = [
  'game-system.compiled.js',
  'data/images/title-screen-clean.PNG',
  // タイトルBGM。BGMアレンジで別の曲に差し替えられるが、どの曲もおおよそ同じ大きさなので
  // ゲージの重みとしてはこの1曲ぶんで足りる
  'audio/bgm-title-theme.mp3',
];

const stampBootSizes = () => {
  let html = fs.readFileSync(INDEX, 'utf8');
  const files = [];
  for (const m of html.matchAll(/<script src="((?!https?:)[^"?]+)(?:\?[^"]*)?"/g)) files.push(m[1]);
  for (const f of EXTRA_FILES) if (!files.includes(f)) files.push(f);

  const sizes = {};
  const missing = [];
  for (const rel of files) {
    const full = path.join(WEB_ROOT, rel);
    if (!fs.existsSync(full)) { missing.push(rel); continue; }
    sizes[rel] = fs.statSync(full).size;
  }
  if (missing.length) {
    console.error(`NG: 起動時に読み込むファイルが見つかりません: ${missing.join(' / ')}`);
    process.exit(1);
  }
  const line = `  var SIZES = ${JSON.stringify(sizes)}; /* BOOT_SIZES */`;
  if (!/^ *var SIZES = .*\/\* BOOT_SIZES \*\/$/m.test(html)) {
    console.error('NG: index.html に BOOT_SIZES の目印が見つかりませんでした');
    process.exit(1);
  }
  html = html.replace(/^ *var SIZES = .*\/\* BOOT_SIZES \*\/$/m, line);
  fs.writeFileSync(INDEX, html);
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  return { count: files.length, total };
};

module.exports = { stampBootSizes };

if (require.main === module) {
  const r = stampBootSizes();
  console.log(`起動時に読み込むファイルの実サイズを index.html へ書き込みました: ${r.count}件 / 合計 ${(r.total / 1024 / 1024).toFixed(2)}MB`);
}
