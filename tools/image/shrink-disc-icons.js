const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 円盤石の絵(images/disc-icons/*-disc.PNG)を、画面で使う大きさまで縮める(2026-10-27 速さ部)。
//
//   node image/shrink-disc-icons.js            # 縮めたらどうなるかを出すだけ(書き換えない)
//   node image/shrink-disc-icons.js --write    # 実際に書き換える(そのあと node build.js でキャッシュキーを打ち直す)
//
// 【なぜ要るか】
// 円盤石の絵は 1254px 角(横長は 1536x1024)で、1枚 0.5〜0.75MB あった。HOME に着くと裏の先読み
// (imagePreloadQueue)が全部を取りに行くので、それだけで 8.7MB の通信になっていた(docs/progress/speed/README.md)。
// 画面での最大はアイコンの枠 112px(w-28)× 見せ方の拡大(MARKET_PROFILE_ICON_STYLES の円盤石は最大 1.49倍)
// × 3倍の画面 ≒ 500px なので、長い辺 768px あれば見た目は変わらない。
// 見せ方の値(scale / x / y)は絵の大きさに対する割合なので、縦横を同じ割合で縮めればそのまま使える。
//
// やること
//   ① 長い辺が 768px を超える円盤石の絵を、縦横比を保って 768px へ縮める
//   ② 元の絵と同じく 256色のパレットの PNG で書き出す(元の絵がパレットなので、フルカラーで書くと逆に大きくなる)
//   ③ 「元の絵をフルカラーのまま 768px へ縮めた物」と比べて差を測り、compress-images.js と同じ基準を下回れば書き換えない
// 土台(disc-stone-base.PNG)は make-disc-icon.js の材料なので触らない。
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
const DIR = path.join(REPO_ROOT, 'monster-hero/images/disc-icons');
const MAX_SIDE = 768;
const MIN_PSNR = 34;          // compress-images.js と同じ
const MAX_VISIBLE_RATIO = 12; // % 。256階調のうち8以上ずれた画素の割合
const write = process.argv.includes('--write');

const rgba = (input) => sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const compare = (a, b) => {
  let se = 0, visible = 0;
  const px = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    // 透明なところの色は見えないので、アルファを掛けてから比べる
    const aa = a[i + 3] / 255, ba = b[i + 3] / 255;
    let worst = Math.abs(a[i + 3] - b[i + 3]);
    for (let c = 0; c < 3; c++) {
      const d = a[i + c] * aa - b[i + c] * ba;
      se += d * d; worst = Math.max(worst, Math.abs(d));
    }
    se += (a[i + 3] - b[i + 3]) ** 2;
    if (worst > 8) visible++;
  }
  const mse = se / (px * 4);
  return { psnr: mse === 0 ? 99 : 10 * Math.log10(255 * 255 / mse), visibleRatio: visible / px * 100 };
};

(async () => {
  let before = 0, after = 0, changed = 0, kept = 0;
  for (const name of fs.readdirSync(DIR).filter((f) => /-disc\.png$/i.test(f)).sort()) {
    const file = path.join(DIR, name);
    const size = fs.statSync(file).size;
    const meta = await sharp(file).metadata();
    before += size;
    if (Math.max(meta.width, meta.height) <= MAX_SIDE) { after += size; console.log(`そのまま   ${name} (${meta.width}x${meta.height})`); continue; }
    const resize = meta.width >= meta.height ? { width: MAX_SIDE } : { height: MAX_SIDE };
    const reference = await sharp(file).resize({ ...resize, kernel: 'lanczos3' }).png().toBuffer();
    const out = await sharp(file).resize({ ...resize, kernel: 'lanczos3' }).png({ palette: true, quality: 95, effort: 10, compressionLevel: 9 }).toBuffer();
    const [ra, rb] = [await rgba(reference), await rgba(out)];
    const q = compare(ra.data, rb.data);
    const ok = q.psnr >= MIN_PSNR && q.visibleRatio <= MAX_VISIBLE_RATIO && out.length < size;
    const label = `${name} ${meta.width}x${meta.height} → ${rb.info.width}x${rb.info.height} ${(size / 1024).toFixed(0)}KB → ${(out.length / 1024).toFixed(0)}KB (PSNR ${q.psnr.toFixed(1)}dB・差>8 ${q.visibleRatio.toFixed(2)}%)`;
    if (!ok) { after += size; kept++; console.log(`見送り     ${label}`); continue; }
    after += out.length; changed++;
    console.log(`${write ? '書き換えた' : '縮められる'} ${label}`);
    if (write) fs.writeFileSync(file, out);
  }
  console.log(`\n合計 ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB(縮める ${changed}枚・見送り ${kept}枚)`);
  if (!write && changed) console.log('書き換えるには --write。書き換えたら node build.js でキャッシュキーを打ち直し、node image-asset-check.js を通す');
})().catch((e) => { console.error(e); process.exit(1); });
