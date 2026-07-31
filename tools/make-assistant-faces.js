// 助手(みゅあ)の表情画像から、吹き出し用の小さい顔アイコンを作る。
//
// monster-hero/images/assistant/myua_*.PNG は 1536x1024 の全身絵で1枚1.5MBある。
// 吹き出しの顔は48〜72pxしかないので、そのまま読むと表情を変えるたびに1.5MBを
// 取りに行くことになり、モバイル回線では待たされる。そこで顔まわりだけを正方形に
// 切り出し、256pxへ縮めたものを images/assistant/face/ へ書き出しておく。
//
//   node tools/make-assistant-faces.js
//
// 表情画像を差し替えたり増やしたりしたら、このコマンドを流し直す。
// 切り出す位置は透明でない範囲(＝キャラの輪郭)から自動で決めるので、
// 立ち位置が多少違ってもそのまま使える。
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'monster-hero/images/assistant');
const outDir = path.join(srcDir, 'face');
const OUT_SIZE = 256;      // 書き出す顔アイコンの一辺(px)。表示は最大72pxなので余裕がある
const ALPHA_MIN = 24;      // これ以上の不透明度をキャラの一部とみなす
const HEAD_RATIO = 0.46;   // キャラ全体の高さに対する「顔まわり」の一辺の比率

// 透明でない画素の範囲(左右上下)を返す
const opaqueBounds = (ctx, w, h) => {
  const data = ctx.getImageData(0, 0, w, h).data;
  let left = w, right = -1, top = h, bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < ALPHA_MIN) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < 0 ? null : { left, right, top, bottom };
};

// 頭の中心の横位置。上のほうだけを見て重心を取る(髪やスカートに引っ張られないようにする)
const headCenterX = (ctx, w, bounds) => {
  const band = Math.max(1, Math.round((bounds.bottom - bounds.top + 1) * 0.18));
  const data = ctx.getImageData(0, bounds.top, w, band).data;
  let sum = 0, count = 0;
  for (let y = 0; y < band; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < ALPHA_MIN) continue;
      sum += x; count++;
    }
  }
  return count ? sum / count : (bounds.left + bounds.right) / 2;
};

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(srcDir).filter(f => /^myua_.+\.png$/i.test(f)).sort();
  if (files.length === 0) { console.log('切り出す画像がありません'); return; }
  for (const file of files) {
    const img = await loadImage(path.join(srcDir, file));
    const src = createCanvas(img.width, img.height);
    const sctx = src.getContext('2d');
    sctx.drawImage(img, 0, 0);
    const bounds = opaqueBounds(sctx, img.width, img.height);
    if (!bounds) { console.log(`NG: ${file} は全部透明です`); continue; }
    const side = Math.round((bounds.bottom - bounds.top + 1) * HEAD_RATIO);
    const cx = headCenterX(sctx, img.width, bounds);
    let sx = Math.round(cx - side / 2);
    let sy = bounds.top;
    sx = Math.max(0, Math.min(img.width - side, sx));
    sy = Math.max(0, Math.min(img.height - side, sy));
    const out = createCanvas(OUT_SIZE, OUT_SIZE);
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(img, sx, sy, side, side, 0, 0, OUT_SIZE, OUT_SIZE);
    const buf = out.toBuffer('image/png', { compressionLevel: 9 });
    const outPath = path.join(outDir, file.replace(/\.png$/i, '.PNG'));
    fs.writeFileSync(outPath, buf);
    const before = fs.statSync(path.join(srcDir, file)).size;
    console.log(`${file} → face/${path.basename(outPath)}  切り出し ${side}px (${sx},${sy})  ${(before/1024/1024).toFixed(2)}MB → ${(buf.length/1024).toFixed(0)}KB`);
  }
};

run().catch(e => { console.error(e); process.exit(1); });
