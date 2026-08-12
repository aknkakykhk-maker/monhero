// 染色もどきの部位分けを目で確かめる。本番と同じ getDyeRegionMasks を実画像に対して呼び、
// 「元の絵」と「部位ごとに色を塗り分けた絵」を左右に並べたPNGを書き出す。
// 被覆率(dye-report.js)だけでは「どこが混ざっているか」が分からないので、部位定義を
// 足す・直すときはこれで場所を確かめる(染色①=赤・②=黄・③=青、無染色=元の絵のまま)。
//
//   node dye-region-map.js out.png Undine                    … 全身
//   node dye-region-map.js out.png Undine 0.1 0.3            … 縦0.1〜0.3だけ拡大
//   node dye-region-map.js out.png Undine 0.1 0.3 0.3 0.7    … 縦横を指定して拡大
const fs = require('fs');
const { loadDyeModule, loadEmbeddedImages, imageForBaseId, decodeDataUrl, createCanvas } = require('./harness');

// 片側の横幅(px)。拡大しても粗さが分かるよう大きめに描く
const PANEL = Number(process.env.DYE_MAP_WIDTH || 620);

(async () => {
  const [out, baseId, y0 = '0', y1 = '1', x0 = '0', x1 = '1'] = process.argv.slice(2);
  const dye = await loadDyeModule();
  const images = await loadEmbeddedImages();
  const dataUrl = imageForBaseId(baseId, images);
  if (!dataUrl) { console.error(`${baseId} の立ち絵が見つかりません`); process.exit(1); }
  const base = await decodeDataUrl(dataUrl);
  const urls = await dye.getDyeRegionMasks(baseId, dataUrl);
  const sx = Number(x0) * base.width, sw = (Number(x1) - Number(x0)) * base.width;
  const sy = Number(y0) * base.height, sh = (Number(y1) - Number(y0)) * base.height;
  const W = PANEL, H = Math.round(sh * (W / sw));
  const c = createCanvas(W * 2, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(base, sx, sy, sw, sh, 0, 0, W, H);
  ctx.drawImage(base, sx, sy, sw, sh, W, 0, W, H);
  const COLORS = ['#ff0000', '#ffff00', '#0000ff'];
  for (let i = 0; i < 3; i++) {
    if (!urls || !urls[i]) continue;
    const m = await decodeDataUrl(urls[i]);
    const t = createCanvas(W, H);
    const tc = t.getContext('2d');
    tc.fillStyle = COLORS[i];
    tc.fillRect(0, 0, W, H);
    tc.globalCompositeOperation = 'destination-in';
    // マスクは元画像を縮めた解像度なので、同じ相対位置で切り出して重ねる
    tc.drawImage(m, sx / base.width * m.width, sy / base.height * m.height, sw / base.width * m.width, sh / base.height * m.height, 0, 0, W, H);
    // マスクは絵の外側まで広がっている(重ねる染色画像が元絵の透明度を持つため、本番では
    // はみ出さない)。ここでも元絵の透明度で切り抜かないと、背景に四角い色板が出て誤読する
    tc.drawImage(base, sx, sy, sw, sh, 0, 0, W, H);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(t, W, 0);
    ctx.globalAlpha = 1;
  }
  fs.writeFileSync(out, c.toBuffer());
  console.log('書き出しました', out);
})().catch(e => { console.error(e); process.exit(1); });
