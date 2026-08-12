// ヤオビクニの本番染色マスクを、リポジトリに保存した正解見本と画素単位で比較する。
// 正解PNGは検査時にだけ読み込み、ゲーム実行時には利用しない。
const { loadDyeModule, loadEmbeddedImages, imageForBaseId, decodeDataUrl, createCanvas } = require('./harness');

const LABELS = ['染色1（緑の髪・腕・尻尾・上衣）', '染色2（ピンクの髪）', '染色3（肌）', '染色対象外'];
const ALPHA_THRESHOLD = 128;
// 縮小解析と高解像度マスクへの補間で境界画素に差が出るため、各部位95%以上を合格とする。
const MIN_REGION_MATCH_RATE = 0.95;
// 半透明輪郭は本番の高解像度マスクで外側へ2px塗り足すため、対象外との境だけ一致率が下がる。
const MIN_UNCOLORED_MATCH_RATE = 0.80;
const MIN_ALL_MATCH_RATE = 0.97;

const pixelsAt = (image, width, height) => {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
};

const referenceRegion = (pixels, offset) => {
  if (pixels[offset + 3] < 20) return 3;
  const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
  if (r > 200 && g < 80) return 0;
  if (g > 200 && r < 80 && b < 80) return 1;
  if (b > 200) return 2;
  return 3;
};

(async () => {
  const dye = loadDyeModule();
  const images = loadEmbeddedImages();
  const imageUrl = imageForBaseId('Yaobikuni', images);
  const [source, reference, maskUrls] = await Promise.all([
    decodeDataUrl(imageUrl),
    decodeDataUrl('images/monsters/yaobikuni-dye-mask.PNG'),
    dye.getDyeRegionMasks('Yaobikuni', imageUrl),
  ]);
  if (!maskUrls || maskUrls.length !== 3) throw new Error('ヤオビクニの3色マスクを生成できませんでした');
  const masks = await Promise.all(maskUrls.map(decodeDataUrl));
  const width = masks[0].width, height = masks[0].height;
  const sourcePixels = pixelsAt(source, width, height);
  const referencePixels = pixelsAt(reference, width, height);
  const maskPixels = masks.map(mask => pixelsAt(mask, width, height));
  const expected = [0, 0, 0, 0], matched = [0, 0, 0, 0];

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    if (sourcePixels[offset + 3] < 20) continue;
    const wanted = referenceRegion(referencePixels, offset);
    expected[wanted]++;
    let actual = 3, strongest = ALPHA_THRESHOLD - 1;
    maskPixels.forEach((pixels, region) => {
      if (pixels[offset + 3] > strongest) {
        strongest = pixels[offset + 3];
        actual = region;
      }
    });
    if (actual === wanted) matched[wanted]++;
  }

  let failed = false;
  LABELS.forEach((label, region) => {
    const rate = matched[region] / expected[region];
    console.log(`${label}のみ: ${(rate * 100).toFixed(2)}%一致 (${matched[region]}/${expected[region]}px)`);
    const minimum = region === 3 ? MIN_UNCOLORED_MATCH_RATE : MIN_REGION_MATCH_RATE;
    if (rate < minimum) failed = true;
  });
  const totalExpected = expected.reduce((sum, count) => sum + count, 0);
  const totalMatched = matched.reduce((sum, count) => sum + count, 0);
  const allRate = totalMatched / totalExpected;
  console.log(`3色同時: ${(allRate * 100).toFixed(2)}%一致 (${totalMatched}/${totalExpected}px)`);
  if (allRate < MIN_ALL_MATCH_RATE) failed = true;
  if (failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exit(1); });
