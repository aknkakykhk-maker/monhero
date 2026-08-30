// モッチーの正式RGBマスクが、本番の3領域へ同じ座標・同じ色順で反映されることを検査する。
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { loadDyeModule, loadEmbeddedImages, imageForBaseId, decodeDataUrl, createCanvas, REPO_ROOT } = require('../harness');

const MASK_REL = 'images/monsters/mocchi-dye-mask.PNG';
const MASK_PATH = path.join(REPO_ROOT, 'monster-hero', MASK_REL);
const LABELS = ['染色1（赤）', '染色2（緑）', '染色3（青）', '染色対象外（透明）'];
// 1024pxの正本を本番解析サイズへ縮小する境界の補間差だけを許容する。
//
// この一致率は「本番の解析解像度」で数えているため、解析を細かくするほど
// 境目の画素が増えて下がる。2026年8月に正式マスク経路の解析を384→768pxへ上げたとき、
// 見た目は良くなったのにここだけ 99.87%→99.68% と下がった
// (原寸で測ると 染め残し0.08%→0.02%、取り違え0.17%→0.09% と実際は改善している)。
// そのため、ここは「マスクが丸ごとずれていないか」を見る粗い監視として基準を置き直す。
// 実際の精度は解像度に左右されない image/dye-precision-check.js が原寸で見張る。
const MIN_REGION_MATCH_RATE = 0.99;
const MIN_UNCOLORED_MATCH_RATE = 0.99;
const MIN_ALL_MATCH_RATE = 0.99;

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

(async () => {
  const imageDefinitions = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/images/images-ally.js'), 'utf8');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(MASK_PATH)).digest('hex').slice(0, 12);
  if (!imageDefinitions.includes(`const MOCCHI_DYE_MASK = "${MASK_REL}?v=${hash}";`)) {
    throw new Error('MOCCHI_DYE_MASKの参照またはキャッシュキーが正式PNGと一致しません');
  }

  const dye = loadDyeModule();
  const images = loadEmbeddedImages();
  const imageUrl = imageForBaseId('Mocchi', images);
  const [source, reference, maskUrls] = await Promise.all([
    decodeDataUrl(imageUrl), decodeDataUrl(MASK_REL), dye.getDyeRegionMasks('Mocchi', imageUrl),
  ]);
  if (source.width !== reference.width || source.height !== reference.height) {
    throw new Error(`本体と正式マスクのサイズが一致しません: ${source.width}x${source.height} / ${reference.width}x${reference.height}`);
  }
  if (!maskUrls || maskUrls.length !== 3) throw new Error('モッチーの3色マスクを生成できませんでした');
  const masks = await Promise.all(maskUrls.map(decodeDataUrl));
  const width = masks[0].width, height = masks[0].height;
  const sourcePixels = pixelsAt(source, width, height);
  const referencePixels = pixelsAt(reference, width, height);
  const maskPixels = masks.map(mask => pixelsAt(mask, width, height));
  const expected = [0, 0, 0, 0], matched = [0, 0, 0, 0];

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    if (sourcePixels[offset + 3] < 20) continue;
    const wanted = expectedRegion(referencePixels, offset);
    expected[wanted]++;
    let actual = 3, strongest = 127;
    maskPixels.forEach((pixels, region) => {
      if (pixels[offset + 3] > strongest) { strongest = pixels[offset + 3]; actual = region; }
    });
    if (actual === wanted) matched[wanted]++;
  }

  let failed = false;
  LABELS.forEach((label, region) => {
    const rate = matched[region] / expected[region];
    console.log(`${label}のみ: ${(rate * 100).toFixed(2)}%一致 (${matched[region]}/${expected[region]}px)`);
    if (rate < (region === 3 ? MIN_UNCOLORED_MATCH_RATE : MIN_REGION_MATCH_RATE)) failed = true;
  });
  const totalExpected = expected.reduce((sum, count) => sum + count, 0);
  const totalMatched = matched.reduce((sum, count) => sum + count, 0);
  const allRate = totalMatched / totalExpected;
  console.log(`3色同時: ${(allRate * 100).toFixed(2)}%一致 (${totalMatched}/${totalExpected}px)`);
  if (allRate < MIN_ALL_MATCH_RATE || failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exit(1); });
