// プラントの正式RGBマスクが、本番の3領域へ同じ座標・同じ色順で反映されることを検査する。
// あわせて「透過の掃除」(薄い霞・離れたゴミが残っていないか)も見る。
// 作り直しは node tools/image/make-plant-dye-mask.js。
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { loadDyeModule, loadEmbeddedImages, imageForBaseId, decodeDataUrl, createCanvas, REPO_ROOT } = require('../harness');

const BODY_REL = 'images/monsters/plant.PNG';
const MASK_REL = 'images/monsters/plant-dye-mask.PNG';
const MASK_PATH = path.join(REPO_ROOT, 'monster-hero', MASK_REL);
const LABELS = ['染色1（赤・花）', '染色2（緑・葉と茎）', '染色3（青・白い体）', '染色対象外（根と口）'];
// 正本を本番解析サイズ(384px)へ縮小するときの補間と、本番側のならし処理で、
// 部位と部位の境目は必ず数px分ズレる。プラントは細い茎と花びらが多く周囲長が長く、
// 絵の4分の1が「境目の帯」に入るため、全体の一致率だけを見ても良し悪しが分からない。
// そこで、ズレを「境目の帯の中か外か」に分けて別々に見る。
//   ・帯の外(内側)のズレ … 部位の取り違え(花が体になる等)そのもの。1画素も許さない
//   ・帯の中のズレ       … 縮小とならしのぶん。丸ごとずれていないかだけを上限で見る
// 境目とみなす距離(本番の解析サイズでの画素数)。ならし処理の半径ぶん。
const BOUNDARY_MARGIN = 2;
// 帯の中のズレの上限。実測4.5%で、マスクが1px単位でずれた程度でも跳ね上がる
const MAX_BOUNDARY_MISMATCH_RATE = 0.20;
// 全体の一致率は「崩壊していないか」だけを見る雑な下限。本命は上の2つ
const MIN_MATCH_RATE = 0.95;
// 透過の掃除で消したはずの薄い霞。境界の1〜24は残っていてはいけない。
const HAZE_MAX_ALPHA = 24;
// 見た目のゴミになる小さな島(離れた塊)は残っていてはいけない。
const MAX_ISLAND_PIXELS = 64;

const pixelsAt = (image, width, height) => {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
};

const expectedRegion = (pixels, offset) => {
  if (pixels[offset + 3] < 20) return 3;
  const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
  if (r > 200 && g < 80 && b < 80) return 0;
  if (g > 200 && r < 80 && b < 80) return 1;
  if (b > 200 && r < 80 && g < 80) return 2;
  throw new Error(`正式マスクにRGB3色以外の不透明画素があります: offset=${offset}`);
};

// 本体PNGの透過が掃除済みか(霞が無いか・離れた小さな塊が無いか)を見る
const checkAlphaHygiene = (image) => {
  const width = image.width, height = image.height, total = width * height;
  const pixels = pixelsAt(image, width, height);
  let haze = 0;
  for (let i = 0; i < total; i++) {
    const a = pixels[i * 4 + 3];
    if (a >= 1 && a <= HAZE_MAX_ALPHA) haze++;
  }
  const label = new Int32Array(total).fill(-1);
  const stack = new Int32Array(total);
  const sizes = [];
  for (let start = 0; start < total; start++) {
    if (label[start] >= 0 || pixels[start * 4 + 3] < 1) continue;
    const id = sizes.length;
    let top = 0, count = 0;
    stack[top++] = start; label[start] = id;
    while (top) {
      const p = stack[--top];
      count++;
      const x = p % width, y = (p - x) / width;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (label[q] < 0 && pixels[q * 4 + 3] >= 1) { label[q] = id; stack[top++] = q; }
      }
    }
    sizes.push(count);
  }
  const islands = sizes.filter(size => size <= MAX_ISLAND_PIXELS);
  console.log(`透過: 薄い霞(α1〜${HAZE_MAX_ALPHA}) ${haze}px / 塊 ${sizes.length}個(うち${MAX_ISLAND_PIXELS}px以下 ${islands.length}個)`);
  let failed = false;
  if (haze > 0) { console.error(`NG: 薄い霞が${haze}px残っています`); failed = true; }
  if (islands.length > 0) { console.error(`NG: 離れた小さな塊が${islands.length}個残っています`); failed = true; }
  return failed;
};

(async () => {
  const imageDefinitions = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/images/images-ally.js'), 'utf8');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(MASK_PATH)).digest('hex').slice(0, 12);
  if (!imageDefinitions.includes(`const PLANT_DYE_MASK = "${MASK_REL}?v=${hash}";`)) {
    throw new Error('PLANT_DYE_MASKの参照またはキャッシュキーが正式PNGと一致しません');
  }
  const gameSystem = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
  if (!/const EXACT_DYE_MASKS = Object\.freeze\(\{[^}]*Plant:PLANT_DYE_MASK[^}]*\}\)/.test(gameSystem)) {
    throw new Error('EXACT_DYE_MASKSにPlantが登録されていません');
  }

  const dye = loadDyeModule();
  const images = loadEmbeddedImages();
  const imageUrl = imageForBaseId('Plant', images);
  const [source, reference, maskUrls] = await Promise.all([
    decodeDataUrl(imageUrl), decodeDataUrl(MASK_REL), dye.getDyeRegionMasks('Plant', imageUrl),
  ]);
  if (source.width !== reference.width || source.height !== reference.height) {
    throw new Error(`本体と正式マスクのサイズが一致しません: ${source.width}x${source.height} / ${reference.width}x${reference.height}`);
  }
  if (!maskUrls || maskUrls.length !== 3) throw new Error('プラントの3色マスクを生成できませんでした');

  let failed = checkAlphaHygiene(source);

  const masks = await Promise.all(maskUrls.map(decodeDataUrl));
  const width = masks[0].width, height = masks[0].height;
  const sourcePixels = pixelsAt(source, width, height);
  const referencePixels = pixelsAt(reference, width, height);
  const maskPixels = masks.map(mask => pixelsAt(mask, width, height));
  const expected = [0, 0, 0, 0], matched = [0, 0, 0, 0];

  // 先に「その画素がどの部位であるべきか」を並べておく(-1=絵の外)
  const wantedAt = new Int8Array(width * height).fill(-1);
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    if (sourcePixels[offset + 3] < 20) continue;
    wantedAt[i] = expectedRegion(referencePixels, offset);
  }
  // 部位が変わる境目、または絵の外に接している画素かどうか
  const nearBoundary = (index) => {
    const x = index % width, y = (index - x) / width;
    for (let dy = -BOUNDARY_MARGIN; dy <= BOUNDARY_MARGIN; dy++) {
      for (let dx = -BOUNDARY_MARGIN; dx <= BOUNDARY_MARGIN; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
        const other = wantedAt[ny * width + nx];
        if (other !== wantedAt[index]) return true;
      }
    }
    return false;
  };

  let insideMismatch = 0, boundaryPixels = 0, boundaryMismatch = 0;
  const insideSamples = [];
  for (let i = 0; i < width * height; i++) {
    const wanted = wantedAt[i];
    if (wanted < 0) continue;
    const offset = i * 4;
    expected[wanted]++;
    let actual = 3, strongest = 127;
    maskPixels.forEach((pixels, region) => {
      if (pixels[offset + 3] > strongest) { strongest = pixels[offset + 3]; actual = region; }
    });
    const onBoundary = nearBoundary(i);
    if (onBoundary) boundaryPixels++;
    if (actual === wanted) { matched[wanted]++; continue; }
    if (onBoundary) { boundaryMismatch++; continue; }
    insideMismatch++;
    if (insideSamples.length < 8) insideSamples.push(`(${i % width},${(i / width) | 0}) 期待=${wanted} 実際=${actual}`);
  }

  LABELS.forEach((label, region) => {
    if (!expected[region]) throw new Error(`${label}の画素が1つもありません`);
    const rate = matched[region] / expected[region];
    console.log(`${label}: ${(rate * 100).toFixed(2)}%一致 (${matched[region]}/${expected[region]}px)`);
    if (rate < MIN_MATCH_RATE) failed = true;
  });
  const totalExpected = expected.reduce((sum, count) => sum + count, 0);
  const totalMatched = matched.reduce((sum, count) => sum + count, 0);
  const allRate = totalMatched / totalExpected;
  console.log(`3色同時: ${(allRate * 100).toFixed(2)}%一致 (${totalMatched}/${totalExpected}px)`);
  console.log(`境目から${BOUNDARY_MARGIN}px以上内側のズレ: ${insideMismatch}px`);
  if (insideMismatch > 0) {
    console.error(`NG: 部位の内側で取り違えています: ${insideSamples.join(' / ')}`);
    failed = true;
  }
  const boundaryRate = boundaryMismatch / boundaryPixels;
  console.log(`境目の帯: ${boundaryPixels}px(絵の${(boundaryPixels / totalExpected * 100).toFixed(1)}%) / そのうちズレ ${boundaryMismatch}px (${(boundaryRate * 100).toFixed(1)}%)`);
  if (boundaryRate > MAX_BOUNDARY_MISMATCH_RATE) {
    console.error(`NG: 境目のズレが上限${(MAX_BOUNDARY_MISMATCH_RATE * 100).toFixed(0)}%を超えています。マスクが絵に対してずれていないか確認してください`);
    failed = true;
  }
  if (allRate < MIN_MATCH_RATE || failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exit(1); });
