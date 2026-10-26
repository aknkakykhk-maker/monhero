// キュービ・オリヒメを濃い色で染めた全身を、灰色の背景に並べて書き出す(マスクの確かめ用。ゲームと同じ染め方)
//   node docs/progress/kyubi-orihime/mask-tools/dark-dye.js <出力フォルダ>
// 左: 元の絵 / 右: ①濃い赤 ②紺 ③深緑 ④焦げ茶 ⑤赤紫 で染めた絵(隣り合う部位の色が見分けやすい組み合わせ)
const path = require('path');
const sharp = require(path.resolve(__dirname, '../../../../tools/node_modules/sharp'));
const { loadDyeModule, decodeDataUrl, createCanvas, loadEmbeddedImages, imageForBaseId } = require(path.resolve(__dirname, '../../../../tools/harness'));
const c = (h, s, v) => `custom:${h}:${s}:${v}`;
const COLORS = [c(0, 85, 50), c(225, 85, 40), c(140, 75, 35), c(25, 85, 35), c(320, 80, 45)];
const OUT = process.argv[2];
(async () => {
  const dye = loadDyeModule(); const images = loadEmbeddedImages();
  for (const baseId of ['Kyubi', 'Orihime']) {
    const url = imageForBaseId(baseId, images);
    const src = await decodeDataUrl(url); const W = src.width, H = src.height;
    const d = createCanvas(W, H), dx = d.getContext('2d'); dx.drawImage(src, 0, 0);
    const masks = await dye.getDyeRegionMasks(baseId, url);
    for (let i = 0; i < 5; i++) {
      const [re, ma] = await Promise.all([decodeDataUrl(await dye.getRecoloredImage(url, COLORS[i], baseId, i)), decodeDataUrl(masks[i])]);
      const t = createCanvas(W, H), tx = t.getContext('2d');
      tx.drawImage(re, 0, 0, W, H); tx.globalCompositeOperation = 'destination-in'; tx.imageSmoothingEnabled = true; tx.drawImage(ma, 0, 0, W, H);
      dx.drawImage(t, 0, 0);
    }
    const out = createCanvas(W * 2 + 60, H + 40), o = out.getContext('2d');
    o.fillStyle = '#808080'; o.fillRect(0, 0, out.width, out.height);
    o.drawImage(src, 20, 20); o.drawImage(d, W + 40, 20);
    const f = path.join(OUT, `${baseId.toLowerCase()}-dark-dye.jpg`);
    await sharp(out.toBuffer('image/png')).jpeg({ quality: 85 }).toFile(f); console.log(f);
  }
})();
