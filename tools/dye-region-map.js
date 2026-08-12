// 染色もどきの部位分けを目で確かめる。本番と同じ getDyeRegionMasks を実画像に対して呼び、
// 「元の絵」と「部位ごとに色を塗り分けた絵」を左右に並べたPNGを書き出す。
// 被覆率(dye-report.js)だけでは「どこが混ざっているか」が分からないので、部位定義を
// 足す・直すときはこれで場所を確かめる(染色①=赤・②=黄・③=青)。
//
//   node dye-region-map.js out.png Undine          … 全身
//   node dye-region-map.js out.png Undine 0.1 0.3  … 縦0.1〜0.3の範囲だけ拡大
const fs = require('fs');
const { loadDyeModule, loadEmbeddedImages, imageForBaseId, decodeDataUrl, createCanvas } = require('./harness');

(async () => {
  const [out, baseId, y0 = '0', y1 = '1'] = process.argv.slice(2);
  const dye = await loadDyeModule();
  const images = await loadEmbeddedImages();
  const dataUrl = imageForBaseId(baseId, images);
  const base = await decodeDataUrl(dataUrl);
  const urls = await dye.getDyeRegionMasks(baseId, dataUrl);
  const W = 560;
  const cropY = [Number(y0) * base.height, Number(y1) * base.height];
  const ch = cropY[1] - cropY[0];
  const f = W / base.width;
  const H = Math.round(ch * f);
  const c = createCanvas(W * 2, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(base, 0, cropY[0], base.width, ch, 0, 0, W, H);
  ctx.drawImage(base, 0, cropY[0], base.width, ch, W, 0, W, H);
  const COLORS = ['#ff0000', '#ffff00', '#0000ff'];
  for (let i = 0; i < 3; i++) {
    if (!urls || !urls[i]) continue;
    const m = await decodeDataUrl(urls[i]);
    const t = createCanvas(W, H);
    const tc = t.getContext('2d');
    tc.fillStyle = COLORS[i];
    tc.fillRect(0, 0, W, H);
    tc.globalCompositeOperation = 'destination-in';
    tc.drawImage(m, 0, cropY[0] / base.height * m.height, m.width, ch / base.height * m.height, 0, 0, W, H);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(t, W, 0);
    ctx.globalAlpha = 1;
  }
  fs.writeFileSync(out, c.toBuffer());
  console.log('書き出しました', out);
})().catch(e => { console.error(e); process.exit(1); });
