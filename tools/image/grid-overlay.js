const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 立ち絵に0.1刻みの目盛りを重ねたPNGを out/ に書き出す。
// 顔クロップの範囲(正規化座標0〜1)を目視で実測するための補助ツール。
//
//   node image/grid-overlay.js MOCCHI_IMG SUEZO_IMG ...
const fs = require('fs');
const path = require('path');
const { loadEmbeddedImages, decodeDataUrl, createCanvas } = require('../harness');

(async () => {
  const images = loadEmbeddedImages();
  const keys = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  fs.mkdirSync(path.join(TOOLS_DIR, 'out'), { recursive: true });

  for (const key of keys) {
    if (!images[key]) { console.log(`${key}: 見つかりません`); continue; }
    const img = await decodeDataUrl(images[key]);
    // 目盛りが潰れないよう、長辺600px程度に縮めて描く(位置の実測用なので画質は不要)
    const scale = 600 / Math.max(img.width, img.height);
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    ctx.lineWidth = 1;
    ctx.font = '11px sans-serif';
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * w, y = (i / 10) * h;
      ctx.strokeStyle = i % 5 === 0 ? 'rgba(255,0,0,0.9)' : 'rgba(0,128,255,0.45)';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.fillStyle = '#d00';
      ctx.fillText((i / 10).toFixed(1), Math.min(x + 2, w - 20), 12);
      ctx.fillText((i / 10).toFixed(1), 2, Math.min(y + 12, h - 2));
    }
    const out = path.join(TOOLS_DIR, 'out', `${key}-grid.png`);
    fs.writeFileSync(out, c.toBuffer('image/png'));
    console.log(`${key} (${img.width}x${img.height}) → ${path.relative(process.cwd(), out)}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
