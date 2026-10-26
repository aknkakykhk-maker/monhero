// 染色マスクの見直し(dye-mask-review.js)と仕上げ直し(refine-dye-mask.js)で共通に使う部品(2026-10-26)。
// どちらも「いまゲームが実際に使っている部位分け」を原寸の部位図にしてから始める。
const { loadDyeModule, decodeDataUrl, createCanvas, loadEmbeddedImages, imageForBaseId } = require('../harness');

let _dye = null, _images = null;
const dyeModule = () => (_dye || (_dye = loadDyeModule()));
const embeddedImages = () => (_images || (_images = loadEmbeddedImages()));

const getData = (img, W, H, smooth = true) => {
  const c = createCanvas(W, H), x = c.getContext('2d');
  x.imageSmoothingEnabled = smooth;
  x.drawImage(img, 0, 0, W, H);
  return x.getImageData(0, 0, W, H).data;
};

// 原寸の部位図: -2 = 透明, -1 = 染めない(不透明), 0.. = 部位。
// ゲームと同じく、解析サイズで作ったマスクを補間つきで原寸へ引き伸ばし、アルファ128以上をその部位とする
const labelMap = (srcData, maskDatas, W, H) => {
  const L = new Int8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (srcData[i * 4 + 3] < 128) { L[i] = -2; continue; }
    let best = -1, ba = 127;
    for (let r = 0; r < maskDatas.length; r++) { const a = maskDatas[r][i * 4 + 3]; if (a > ba) { ba = a; best = r; } }
    L[i] = best;
  }
  return L;
};

// いまゲームが使っている部位分けを読む
const currentLabels = async (baseId) => {
  const dye = dyeModule();
  const url = imageForBaseId(baseId, embeddedImages());
  if (!url) return null;
  const src = await decodeDataUrl(url);
  const W = src.width, H = src.height;
  const masks = await dye.getDyeRegionMasks(baseId, url);
  const maskImgs = await Promise.all(masks.map(decodeDataUrl));
  const srcData = getData(src, W, H);
  const L = labelMap(srcData, maskImgs.map(m => getData(m, W, H)), W, H);
  return { dye, url, src, W, H, srcData, masks, maskW: maskImgs[0].width, L };
};

// 部位図を、配信マスクの約束の色(赤=① / 緑=② / 青=③ / 黄=④ / マゼンタ=⑤ / 透明=染めない)の PNG にする
const MASK_COLORS = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [255, 0, 255]];
const labelsToMaskCanvas = (L, W, H) => {
  const c = createCanvas(W, H), x = c.getContext('2d');
  const id = x.createImageData(W, H), d = id.data;
  for (let i = 0; i < W * H; i++) {
    if (L[i] < 0) continue;
    const col = MASK_COLORS[L[i]];
    d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  return c;
};

module.exports = { dyeModule, embeddedImages, getData, labelMap, currentLabels, labelsToMaskCanvas, MASK_COLORS, decodeDataUrl, createCanvas };
