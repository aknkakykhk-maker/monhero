// プラントの立ち絵から「透過の掃除」と「3色染色マスク」を作り直すツール。
//
//   node tools/image/make-plant-dye-mask.js
//
// 生成物は2つ。
//   monster-hero/images/monsters/plant.PNG           … 薄い霞と離れたゴミを消した本体
//   monster-hero/images/monsters/plant-dye-mask.PNG  … 赤=花 / 緑=葉と茎 / 青=白い体
//
// プラントは色相だけでは部位を分けられない。花の内側(淡いピンク)と体(ほぼ白)は
// どちらも低彩度で、色の閾値だけだと互いに混ざってしまう。そこで
// 「緑(葉と茎)で分断されたひとかたまり」という形の情報を使い、
// いちばん下にある大きな塊を体、それ以外の大きな塊を花として切り分けている。
// 根(茶)と口の中(濃い赤〜舌)は元の色のまま残す。
//
// 読み込む元は配信中の絵ではなく、手を入れていない原本
// tools/art-sources/monsters/PLANT.PNG。配信中の絵を読んで同じ場所へ書き戻すと、
// Canvasが半透明画素の色を丸める(乗算済みα)ぶんだけ結果が少しずつ変わってしまい、
// 何度流しても同じ絵にならなくなるため。
const fs = require('fs');
const path = require('path');
const { createCanvas, REPO_ROOT, artSourcePath } = require('../harness');
const { loadImage } = require('canvas');

const SOURCE_PATH = artSourcePath('monsters', 'PLANT.PNG');
const BODY_REL = 'images/monsters/plant.PNG';
const MASK_REL = 'images/monsters/plant-dye-mask.PNG';
const BODY_PATH = path.join(REPO_ROOT, 'monster-hero', BODY_REL);
const MASK_PATH = path.join(REPO_ROOT, 'monster-hero', MASK_REL);

// 透過の掃除。α32未満しか無い塊は「離れたゴミ」として丸ごと消し、
// 残った絵のうちα24以下は輪郭の外側へ広がる霞として消す(本物の縁のなめらかさは残る)。
const ISLAND_MAX_ALPHA = 32;
const HAZE_MAX_ALPHA = 24;
// 「花あつかい」の塊のうち、これより小さいものは花ではない(根のふちの明るい部分など)
const MIN_FLOWER_COMPONENT = 3000;
// 塗り分けを広げたあと、これより小さく取り残された島は見た目のゴミになるので染めない
const MIN_REGION_ISLAND = 1500;

const NONE = 0, FLOWER = 1, GREEN = 2, BODY = 3, ROOT = 4, MOUTH = 5;
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const rgbToHsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, mx ? d / mx : 0, mx];
};

// 同じ条件でつながっている画素をひとかたまりにまとめる(4近傍)
const labelComponents = (width, height, sameGroup) => {
  const size = width * height;
  const label = new Int32Array(size).fill(-1);
  const stack = new Int32Array(size);
  const components = [];
  for (let start = 0; start < size; start++) {
    if (label[start] >= 0 || !sameGroup(start, start)) continue;
    const id = components.length;
    let top = 0, count = 0, sumX = 0, sumY = 0;
    stack[top++] = start; label[start] = id;
    while (top) {
      const p = stack[--top];
      count++;
      const x = p % width, y = (p - x) / width;
      sumX += x; sumY += y;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (label[q] < 0 && sameGroup(p, q)) { label[q] = id; stack[top++] = q; }
      }
    }
    components.push({ id, size: count, cx: sumX / count, cy: sumY / count });
  }
  return { label, components };
};

(async () => {
  if (!fs.existsSync(SOURCE_PATH)) throw new Error(`原本がありません: ${SOURCE_PATH}`);
  const image = await loadImage(SOURCE_PATH);
  const width = image.width, height = image.height, total = width * height;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  const alpha = new Uint8Array(total);
  for (let i = 0; i < total; i++) alpha[i] = pixels[i * 4 + 3];

  // ---- ① 透過の掃除 ----
  const alphaGroups = labelComponents(width, height, (_, q) => alpha[q] >= 1);
  const groupMaxAlpha = new Uint8Array(alphaGroups.components.length);
  for (let i = 0; i < total; i++) {
    const id = alphaGroups.label[i];
    if (id >= 0 && alpha[i] > groupMaxAlpha[id]) groupMaxAlpha[id] = alpha[i];
  }
  let removedIslands = 0, removedHaze = 0;
  for (let i = 0; i < total; i++) {
    if (alpha[i] === 0) continue;
    if (groupMaxAlpha[alphaGroups.label[i]] < ISLAND_MAX_ALPHA) { alpha[i] = 0; removedIslands++; continue; }
    if (alpha[i] <= HAZE_MAX_ALPHA) { alpha[i] = 0; removedHaze++; }
  }
  console.log(`透過の掃除: 離れたゴミ ${removedIslands}px / 薄い霞 ${removedHaze}px を消した`);

  // ---- ② 色で部位のあたりを付ける ----
  const kind = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (alpha[i] < 128) { kind[i] = NONE; continue; }
    const [h, s, v] = rgbToHsv(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]);
    if (s >= 0.22 && h >= 75 && h <= 185) { kind[i] = GREEN; continue; }        // 葉と茎
    if (s >= 0.25 && h >= 18 && h <= 50 && v <= 0.80) { kind[i] = ROOT; continue; } // 根(茶)
    kind[i] = FLOWER;   // 残り(赤・白・黄)はいったん花あつかい。次の段で体を切り分ける
  }

  // ---- ③ 形で花と体を切り分ける ----
  // 花あつかいの画素は緑の茎で分断されるため、体(球根)は独立した塊になる。
  // 大きな塊のうちいちばん下にあるものが体。
  const flowerGroups = labelComponents(width, height, (p, q) => kind[q] === FLOWER && kind[p] === FLOWER);
  const bigGroups = flowerGroups.components.filter(c => c.size > MIN_FLOWER_COMPONENT).sort((a, b) => b.cy - a.cy);
  if (bigGroups.length < 2) throw new Error('花と体を切り分けられませんでした(大きな塊が足りません)');
  const bodyId = bigGroups[0].id;
  console.log('花あつかいの大きな塊: ' + bigGroups.map(c => `#${c.id} ${c.size}px 中心y=${(c.cy / height).toFixed(2)}`).join(' / '));
  let droppedSeeds = 0;
  for (let i = 0; i < total; i++) {
    if (kind[i] !== FLOWER) continue;
    if (flowerGroups.label[i] === bodyId) { kind[i] = BODY; continue; }
    if (flowerGroups.components[flowerGroups.label[i]].size < MIN_FLOWER_COMPONENT) { kind[i] = NONE; droppedSeeds++; }
  }
  console.log(`小さすぎる「花あつかい」を無染色に戻した: ${droppedSeeds}px`);
  // 体の中の口(彩度の高い赤)は染めずに元の色のまま残す
  for (let i = 0; i < total; i++) {
    if (kind[i] !== BODY) continue;
    const [h, s] = rgbToHsv(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]);
    if (s >= 0.30 && (h >= 330 || h <= 25)) kind[i] = MOUTH;
  }

  // ---- ④ 縁にすき間を作らないよう、決まっていない画素を最も近い部位へ寄せる ----
  const region = new Int8Array(total).fill(-1);   // 0=花 1=緑 2=体
  for (let i = 0; i < total; i++) {
    if (kind[i] === FLOWER) region[i] = 0;
    else if (kind[i] === GREEN) region[i] = 1;
    else if (kind[i] === BODY) region[i] = 2;
  }
  const queue = new Int32Array(total);
  let head = 0, tail = 0;
  for (let i = 0; i < total; i++) if (region[i] >= 0) queue[tail++] = i;
  while (head < tail) {
    const p = queue[head++];
    const x = p % width, y = (p - x) / width;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const q = ny * width + nx;
      if (region[q] >= 0) continue;
      if (alpha[q] < HAZE_MAX_ALPHA) continue;                  // 透明なところは塗らない
      if (kind[q] === ROOT || kind[q] === MOUTH) continue;       // 根と口は元の色のまま
      region[q] = region[p];
      queue[tail++] = q;
    }
  }
  // 取り残された小さな島は見た目のゴミになるので染めない
  const regionGroups = labelComponents(width, height, (p, q) => region[q] >= 0 && region[q] === region[p]);
  let droppedIslands = 0;
  for (let i = 0; i < total; i++) {
    if (region[i] >= 0 && regionGroups.components[regionGroups.label[i]].size < MIN_REGION_ISLAND) {
      region[i] = -1; droppedIslands++;
    }
  }
  console.log(`取り残しの島を無染色に戻した: ${droppedIslands}px`);

  // ---- ⑤ 書き出し ----
  const bodyCanvas = createCanvas(width, height);
  const bodyContext = bodyCanvas.getContext('2d');
  const bodyData = bodyContext.createImageData(width, height);
  for (let i = 0; i < total; i++) {
    bodyData.data[i * 4] = pixels[i * 4];
    bodyData.data[i * 4 + 1] = pixels[i * 4 + 1];
    bodyData.data[i * 4 + 2] = pixels[i * 4 + 2];
    bodyData.data[i * 4 + 3] = alpha[i];
  }
  bodyContext.putImageData(bodyData, 0, 0);
  fs.writeFileSync(BODY_PATH, bodyCanvas.toBuffer('image/png'));

  const maskCanvas = createCanvas(width, height);
  const maskContext = maskCanvas.getContext('2d');
  const maskData = maskContext.createImageData(width, height);
  const COLORS = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
  const counts = [0, 0, 0];
  for (let i = 0; i < total; i++) {
    const r = region[i];
    if (r < 0) { maskData.data[i * 4 + 3] = 0; continue; }
    maskData.data[i * 4] = COLORS[r][0];
    maskData.data[i * 4 + 1] = COLORS[r][1];
    maskData.data[i * 4 + 2] = COLORS[r][2];
    maskData.data[i * 4 + 3] = 255;
    counts[r]++;
  }
  maskContext.putImageData(maskData, 0, 0);
  fs.writeFileSync(MASK_PATH, maskCanvas.toBuffer('image/png'));

  console.log(`書き出し: ${BODY_REL} / ${MASK_REL}`);
  console.log(`マスクの画素数 花=${counts[0]} 葉と茎=${counts[1]} 体=${counts[2]}`);
  console.log('この後 node tools/build.js でキャッシュキーを更新すること');
})().catch(error => { console.error(error); process.exit(1); });
