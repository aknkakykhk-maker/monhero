// エイキの染色が、承認済みマスクの「範囲」どおりに本番経路で効くかを画素単位で確かめる。
//
//   node tools/image/eiki-dye-mask-check.js
//   node tools/image/eiki-dye-mask-check.js --preview <出力PNG>   … 実際に染めた見本も書き出す
//
// ヤオビクニ・プラントと同じ考え方で、
//   ① 本番の getDyeRegionMasks が作る3枚のマスクを、
//   ② リポジトリへ置いた承認済みマスク(色だけ変換したもの)と重ねて
// 「どの画素がどの染色に割り当たったか」を比べる。
// エイキは EXACT_DYE_MASKS(承認済みPNGをそのまま使う)なので、色相の自動判定と違って
// ほぼ完全に一致するはずで、ずれるのは縮小・ならしのぶんの境界だけになる。
//
// --preview を付けると、本番の DyedMonsterImage と同じ重ね方
// (元絵の上に、染め直した絵を各マスクで抜いて重ねる)を再現した画像を書き出す。
// このサンドボックスではTailwindが読めず画面写真が撮れないため、
// 「染色①〜③がどこに乗るか」を目で確かめる手段として使う。
const fs = require('fs');
const path = require('path');
const { loadDyeModule, loadEmbeddedImages, imageForBaseId, decodeDataUrl, createCanvas, REPO_ROOT } = require('../harness');

const BASE_ID = 'Eiki';
const APPROVED_MASK_REL = 'images/monsters/eiki-dye-mask.PNG';
const LABELS = ['染色1（髪・腹部のリボン・桜装飾）', '染色2（刀身・足元のオーラ）', '染色3（鎧・足本体）', '染色対象外'];
// 承認済みマスク(1024x1536)は、本番では解析サイズへ縮めてから使う。縮小とならしのぶん、
// 部位と部位の境目は必ず数px分ずれる。エイキは刀身と足元のオーラが細長く、
// 染色②は面積のわりに周囲長が長いので、全体の一致率だけを見ても良し悪しが分からない。
// そこでプラントと同じように、ズレを「境目の帯の中か外か」に分けて別々に見る。
//   ・帯の外のズレ … 部位の取り違え(刀が鎧になる等)そのもの。ここは1画素も許さない
//   ・帯の中のズレ … 縮小とならしのぶん。丸ごとずれていないかだけを上限で見る
const BOUNDARY_MARGIN = 2;      // 境目とみなす距離(解析サイズでの画素数)
const MAX_BOUNDARY_MISMATCH_RATE = 0.30; // 帯の中のズレの上限
const MIN_ALL_MATCH_RATE = 0.97;         // 崩壊していないかだけを見る雑な下限
const ALPHA_THRESHOLD = 128;
// 染めた見本を作るときの色。染色①=赤 / ②=緑 / ③=青 で、どこが染まるか一目で分かるようにする
const PREVIEW_COLORS = ['custom:0:95:60', 'custom:120:95:55', 'custom:225:95:60'];

let failed = false;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed = true;
};

const pixelsAt = (image, width, height) => {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
};

// game-system.jsx の _exactDyeMaskRegion と同じ判定
const approvedRegion = (pixels, offset) => {
  if (pixels[offset + 3] < 20) return 3;
  const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
  if (r > 200 && g < 80 && b < 80) return 0;
  if (g > 200 && r < 80 && b < 80) return 1;
  if (b > 200 && r < 80 && g < 80) return 2;
  return 3;
};

const writePreview = async (source, masks, recoloredImages, outPath) => {
  const w = source.width, h = source.height;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, w, h);
  // DyedMonsterImage と同じ: 染め直した絵を、その部位のマスクで抜いて元絵の上へ重ねる
  for (let idx = 0; idx < masks.length; idx++) {
    if (!recoloredImages[idx]) continue;
    const layer = createCanvas(w, h);
    const lctx = layer.getContext('2d');
    lctx.drawImage(recoloredImages[idx], 0, 0, w, h);
    lctx.globalCompositeOperation = 'destination-in';
    lctx.drawImage(masks[idx], 0, 0, w, h);
    ctx.drawImage(layer, 0, 0);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log(`染めた見本を書き出しました: ${outPath}`);
};

(async () => {
  const previewIdx = process.argv.indexOf('--preview');
  const previewPath = previewIdx >= 0 ? process.argv[previewIdx + 1] : null;

  const dye = loadDyeModule();
  const images = loadEmbeddedImages();
  const imageUrl = imageForBaseId(BASE_ID, images);
  check('エイキの立ち絵が data/images から引ける', !!imageUrl, imageUrl || 'なし');

  const hues = dye.MASU_COLOR_REGION_HUES[BASE_ID];
  check('染色は3レイヤーとして登録されている', Array.isArray(hues) && hues.length === 3, `${hues ? hues.length : 0}レイヤー`);
  check('dyeRegionCount も3を返す', dye.dyeRegionCount(BASE_ID) === 3, String(dye.dyeRegionCount(BASE_ID)));

  const [source, approved, maskUrls] = await Promise.all([
    decodeDataUrl(imageUrl),
    decodeDataUrl(APPROVED_MASK_REL),
    dye.getDyeRegionMasks(BASE_ID, imageUrl),
  ]);
  check('本番経路が3枚のマスクを作る', Array.isArray(maskUrls) && maskUrls.length === 3, `${maskUrls ? maskUrls.length : 0}枚`);
  if (!maskUrls || maskUrls.length !== 3) { process.exit(1); }

  check('承認済みマスクと立ち絵の大きさが同じ',
    approved.width === source.width && approved.height === source.height,
    `立ち絵 ${source.width}x${source.height} / マスク ${approved.width}x${approved.height}`);

  const masks = await Promise.all(maskUrls.map(decodeDataUrl));
  const width = masks[0].width, height = masks[0].height;
  const sourcePixels = pixelsAt(source, width, height);
  const approvedPixels = pixelsAt(approved, width, height);
  const maskPixels = masks.map(mask => pixelsAt(mask, width, height));

  // 承認済みマスク側の「その画素がどの染色か」を先に作る(境目の帯を測るのに要る)
  const wantedAt = new Int8Array(width * height).fill(-1);
  for (let i = 0; i < width * height; i++) {
    if (sourcePixels[i * 4 + 3] < 20) continue; // 絵の外は見ない
    wantedAt[i] = approvedRegion(approvedPixels, i * 4);
  }
  // 半径 BOUNDARY_MARGIN 以内に別の染色があれば「境目の帯」
  const isBoundary = (i) => {
    const x = i % width, y = (i - x) / width, w = wantedAt[i];
    for (let dy = -BOUNDARY_MARGIN; dy <= BOUNDARY_MARGIN; dy++) {
      for (let dx = -BOUNDARY_MARGIN; dx <= BOUNDARY_MARGIN; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = wantedAt[ny * width + nx];
        if (n !== w) return true; // 絵の外(-1)との境も帯に入れる
      }
    }
    return false;
  };

  const expected = [0, 0, 0, 0], matched = [0, 0, 0, 0];
  const boundary = [0, 0, 0, 0], boundaryBad = [0, 0, 0, 0], innerBad = [0, 0, 0, 0];
  for (let i = 0; i < width * height; i++) {
    const wanted = wantedAt[i];
    if (wanted < 0) continue;
    expected[wanted]++;
    const onBoundary = isBoundary(i);
    if (onBoundary) boundary[wanted]++;
    let actual = 3, strongest = ALPHA_THRESHOLD - 1;
    maskPixels.forEach((pixels, region) => {
      if (pixels[i * 4 + 3] > strongest) { strongest = pixels[i * 4 + 3]; actual = region; }
    });
    if (actual === wanted) { matched[wanted]++; continue; }
    if (onBoundary) boundaryBad[wanted]++; else innerBad[wanted]++;
  }

  LABELS.forEach((label, region) => {
    const rate = expected[region] ? matched[region] / expected[region] : 1;
    const bRate = boundary[region] ? boundaryBad[region] / boundary[region] : 0;
    console.log(`${label}: ${(rate * 100).toFixed(2)}%一致 (${matched[region]}/${expected[region]}px)`
      + ` / 境目の外のズレ ${innerBad[region]}px / 境目の中のズレ ${boundaryBad[region]}px (帯${boundary[region]}px中 ${(bRate * 100).toFixed(1)}%)`);
    check(`${label}: 境目の外で部位を取り違えていない`, innerBad[region] === 0, `${innerBad[region]}px`);
    check(`${label}: 境目のズレが縮小ぶんの範囲`, bRate <= MAX_BOUNDARY_MISMATCH_RATE, `${(bRate * 100).toFixed(1)}%`);
  });
  const totalExpected = expected.reduce((a, b) => a + b, 0);
  const totalMatched = matched.reduce((a, b) => a + b, 0);
  const allRate = totalMatched / totalExpected;
  check(`3色同時: ${(allRate * 100).toFixed(2)}%一致 (${totalMatched}/${totalExpected}px)`, allRate >= MIN_ALL_MATCH_RATE);

  // 3つの部位がどれも「実際に塗る面積を持っている」こと。
  // 1つでも0pxなら、その染色スロットは画面に出しても何も変わらない状態になる
  [0, 1, 2].forEach(region => {
    check(`染色${region + 1} に塗る面積がある`, expected[region] > 0, `${expected[region]}px`);
  });

  if (previewPath) {
    const recoloredUrls = await Promise.all(
      PREVIEW_COLORS.map((color, idx) => Promise.resolve(dye.getRecoloredImage(imageUrl, color, BASE_ID, idx)))
    );
    check('3部位ぶんの染め直し画像が作れる', recoloredUrls.every(Boolean));
    const recoloredImages = await Promise.all(recoloredUrls.map(url => url ? decodeDataUrl(url) : null));
    await writePreview(source, masks, recoloredImages, path.isAbsolute(previewPath) ? previewPath : path.join(REPO_ROOT, previewPath));
  }

  console.log(failed ? '\nNGがあります' : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
