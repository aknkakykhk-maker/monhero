const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// HOME画面の背景(data/images/home-background.png)をJPEGへ変換して軽くする。
//
//   node image/home-background-to-jpeg.js           # 変換後のサイズ・画質を表示するだけ(書き換えない)
//   node image/home-background-to-jpeg.js --write   # 実際に .jpg を作り、元の .png を消す
//
// 【なぜ専用ツールか】
// compress-images.js の256色パレット化はイラスト向けで、背景のような写真調・グラデーションの
// 多い絵には向かない(色数を落とすと縞模様が出る)。実測でも PSNR 33.9dB・差の見える画素 20.1%
// (q85)までしか落とせず、compress-images.js が使っている基準(34dB以上・12%未満)を満たせなかった。
// 背景に透明度は使っていない(hasAlpha:false)ので、JPEGへ形式ごと変えるほうが向いている。
//
// やること
//   ① 候補の品質(80〜98)を低いほうから順に試し、基準を満たす最初の(=最も軽い)品質を採用する
//   ② 採用した画像を実際にデコードし直し、元とどれだけ違うかを測る(基準を下回れば書き換えない)
//   ③ 参照している game-system.jsx 側の拡張子も一緒に .jpg へ書き換える
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');
const { REPO_ROOT, GAME_SYSTEM } = require('../harness');

const SRC = path.join(REPO_ROOT, 'monster-hero/data/images/home-background.png');
const DST = path.join(REPO_ROOT, 'monster-hero/data/images/home-background.jpg');

// compress-images.js と同じ基準をそのまま使う
const MIN_PSNR = 34;
const MAX_VISIBLE_RATIO = 12; // %
const QUALITIES = [80, 85, 88, 90, 92, 95, 98];

const decode = async (src) => {
  const im = await loadImage(src);
  const cv = createCanvas(im.width, im.height);
  const ctx = cv.getContext('2d');
  ctx.drawImage(im, 0, 0);
  return ctx.getImageData(0, 0, im.width, im.height).data;
};
const compare = (a, b) => {
  let se = 0, n = 0, visible = 0;
  for (let p = 0; p < a.length; p += 4) {
    if (a[p + 3] < 250) continue;
    n++;
    let worst = 0;
    for (let k = 0; k < 3; k++) { const d = a[p + k] - b[p + k]; se += d * d; if (Math.abs(d) > worst) worst = Math.abs(d); }
    if (worst > 8) visible++;
  }
  if (!n) return { psnr: Infinity, visible: 0 };
  return { psnr: se === 0 ? Infinity : 10 * Math.log10(65025 / (se / (n * 3))), visible: visible / n * 100 };
};

(async () => {
  const write = process.argv.includes('--write');
  if (!fs.existsSync(SRC)) { console.log(`NG: ${path.relative(REPO_ROOT, SRC)} がありません(すでに変換済みかもしれません)`); process.exitCode = 1; return; }

  const orig = fs.statSync(SRC).size;
  const a = await decode(SRC);
  let chosen = null;
  for (const q of QUALITIES) {
    const buf = await sharp(SRC).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    const tmp = SRC + `.probe-q${q}.jpg`;
    fs.writeFileSync(tmp, buf);
    const b = await decode(tmp);
    fs.unlinkSync(tmp);
    const { psnr, visible } = compare(a, b);
    console.log(`  q${q}: ${(buf.length / 1024).toFixed(0)}KB / PSNR ${psnr === Infinity ? '∞' : psnr.toFixed(1)}dB / 差の見える画素 ${visible.toFixed(1)}%`);
    if (psnr >= MIN_PSNR && visible <= MAX_VISIBLE_RATIO) { chosen = { q, buf, psnr, visible }; break; }
  }

  if (!chosen) {
    console.log(`NG: どの品質でも基準(PSNR${MIN_PSNR}dB以上・差の見える画素${MAX_VISIBLE_RATIO}%未満)を満たせません。書き換えません`);
    process.exitCode = 1; return;
  }

  console.log(`${write ? '変換' : '変換予定'}: home-background.png → home-background.jpg — q${chosen.q} / ${(orig / 1024).toFixed(0)}KB → ${(chosen.buf.length / 1024).toFixed(0)}KB (${((1 - chosen.buf.length / orig) * 100).toFixed(0)}%減) / PSNR ${chosen.psnr.toFixed(1)}dB / 差の見える画素 ${chosen.visible.toFixed(1)}%`);

  if (!write) { console.log('※ --write を付けると実際に変換します'); return; }

  fs.writeFileSync(DST, chosen.buf);
  fs.unlinkSync(SRC);

  // game-system.jsx 側の参照も .jpg へ揃える
  const jsx = fs.readFileSync(GAME_SYSTEM, 'utf8');
  const next = jsx.split('data/images/home-background.png').join('data/images/home-background.jpg');
  const hits = jsx.split('data/images/home-background.png').length - 1;
  if (hits === 0) { console.log('NG: game-system.jsx に data/images/home-background.png の参照が見つかりません(手で確認してください)'); process.exitCode = 1; return; }
  fs.writeFileSync(GAME_SYSTEM, next);
  console.log(`game-system.jsx の参照を ${hits}か所 .jpg へ書き換えました。node tools/build.js を実行してください`);
})();
