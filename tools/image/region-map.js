const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 部位分けの目視確認用。getDyeRegionMasks の結果を部位ごとに色分けしたPNGを out/ に書き出す。
// 染色①=赤 / ②=緑 / ③=青 / ④=黄、どの部位にも属さない画素(無染色)=灰色で塗る。
// 左が元絵、右が部位マップの2枚並びになる。
//
//   node image/region-map.js            … 全モンスター
//   node image/region-map.js Iblis      … 指定モンスターのみ
const fs = require('fs');
const path = require('path');
const { loadDyeModule, loadEmbeddedImages, imageForBaseId, decodeDataUrl, createCanvas } = require('../harness');

const OUT = path.join(TOOLS_DIR, 'out');
const REGION_COLORS = [[229, 57, 53], [67, 160, 71], [30, 136, 229], [253, 216, 53], [142, 36, 170]];
const UNCOLORED = [130, 130, 130];

async function toImageData(dataUrl) {
  const img = await decodeDataUrl(dataUrl);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data, img };
}

(async () => {
  const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dye = loadDyeModule();
  const images = loadEmbeddedImages();
  const ids = targets.length ? targets : Object.keys(dye.MASU_COLOR_REGION_HUES);
  fs.mkdirSync(OUT, { recursive: true });

  for (const baseId of ids) {
    const dataUrl = imageForBaseId(baseId, images);
    if (!dataUrl) { console.log(`${baseId}: 画像が見つかりません(スキップ)`); continue; }
    const urls = await dye.getDyeRegionMasks(baseId, dataUrl);
    if (!urls) { console.log(`${baseId}: 部位マスクが生成されませんでした`); continue; }
    // マスクは表示サイズに合わせて縮小した解像度で作られるので、
    // 元絵もその解像度に合わせて読み直してから重ねる
    const maskSize = await decodeDataUrl(urls[0]);
    const srcImg = await decodeDataUrl(dataUrl);
    const w = maskSize.width, h = maskSize.height;
    const sc = createCanvas(w, h);
    const sctx = sc.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(srcImg, 0, 0, w, h);
    const src = { w, h, data: sctx.getImageData(0, 0, w, h).data, img: sc };
    // 各部位のマスクを1枚のラベル画像に畳み込む
    const label = new Int8Array(w * h).fill(-1);
    for (let r = 0; r < urls.length; r++) {
      const m = await toImageData(urls[r]);
      for (let i = 0; i < w * h; i++) if (m.data[i * 4 + 3] >= 20) label[i] = r;
    }

    const out = createCanvas(w * 2, h);
    const octx = out.getContext('2d');
    octx.fillStyle = '#101018';
    octx.fillRect(0, 0, w * 2, h);
    octx.drawImage(src.img, 0, 0);
    const mapData = octx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const a = src.data[i * 4 + 3];
      if (a < 20) continue;
      const c = label[i] >= 0 ? (REGION_COLORS[label[i]] || [255, 0, 255]) : UNCOLORED;
      mapData.data[i * 4] = c[0]; mapData.data[i * 4 + 1] = c[1]; mapData.data[i * 4 + 2] = c[2]; mapData.data[i * 4 + 3] = a;
    }
    octx.putImageData(mapData, w, 0);

    const file = path.join(OUT, `${baseId}-region-map.png`);
    fs.writeFileSync(file, out.toBuffer('image/png'));
    const legend = urls.map((_, i) => `染色${i + 1}=${['赤', '緑', '青', '黄', '紫'][i] || '?'}`).join(' / ');
    console.log(`${baseId.padEnd(10)} → ${path.relative(process.cwd(), file)}  (${legend} / 無染色=灰)`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
