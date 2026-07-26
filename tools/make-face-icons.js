// 立ち絵から顔部分を切り出して、正方形の顔アイコン(faceIconUrl)を生成し
// data/images-ally.js の _FACE_ICON 宣言を差し替える。
//
//   node make-face-icons.js --preview   … out/ にプレビューPNGを書くだけ(データは変更しない)
//   node make-face-icons.js             … images-ally.js に書き戻す
//
// 2026年に高解像度イラストへ差し替えた6体は、顔クロップを別途用意しておらず
// faceIconUrl に立ち絵をそのまま入れていた(プロフィールアイコン選択画面で全身が
// 小さく縮んで表示されてしまっていた)。この6体分の顔アイコンをここで作る。
const fs = require('fs');
const path = require('path');
const { REPO_ROOT, loadEmbeddedImages, decodeDataUrl, createCanvas, loadDyeModule } = require('./harness');

// 出力する顔アイコンの一辺(px)。表示は最大でも60px程度だが、高DPI端末でも
// にじまないよう余裕をもって256pxにしている(旧来の顔アイコンは128px)
const SIZE = 256;
// 顔が枠にぴったり付かないよう左右上下に取る余白(一辺に対する割合)
const PAD = 0.03;
// 顔アイコンを作るときに、MASU_COLOR_EXCLUDE(染色対象外の背景装飾)を透明にするモンスター。
// イブリースは頭の右後ろに背景の飾り(淡い紫の円)があり、顔だけ切り出すと
// 四角く途切れた薄い板のように写り込んでしまうため、切り出す前に消しておく
const STRIP_BACKGROUND = { IBLIS: 'Iblis' };

// 立ち絵に対する顔の範囲(正規化座標 [x0, y0, x1, y1])。
// tools/grid-overlay.js で目盛りを重ねた画像を出し、元絵から目視で実測した値。
const FACE_BOXES = {
  // 頭(葉っぱの帽子の上端)から胸元まで。頭だけだと横長すぎて正方形の枠が
  // 上下スカスカになるため、少しだけ体を入れてバストアップにしている
  MOCCHI: [0.14, 0.045, 0.685, 0.50],
  // 全身がほぼ頭なので、球状の頭部だけを取り、下の柄(しっぽ)は落とす
  SUEZO: [0.215, 0.20, 0.785, 0.715],
  // 角の先端〜あご。翼・体は含めない
  PIXIE: [0.35, 0.105, 0.63, 0.325],
  // 頭の岩ブロック(上端〜あご下)。肩の上端が少し入る程度
  GOLEM: [0.37, 0.02, 0.615, 0.285],
  // 頭頂のクレスト〜あご下。ほおが枠に接しないよう左右に余裕をもたせる
  MITARASHI: [0.225, 0.03, 0.76, 0.47],
  // 頭上の輪から、角・もふもふの襟・顔まで(背景の飾りはSTRIP_BACKGROUNDで消してから切り出す)
  IBLIS: [0.235, 0.16, 0.745, 0.535],
};

// MASU_COLOR_EXCLUDE に合致する画素(背景の飾り)を透明にした元画像を作る
function stripBackground(img, baseId, dye) {
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, img.width, img.height);
  const d = imgData.data;
  let removed = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    const o = i * 4;
    if (d[o + 3] < 20) continue;
    const [hh, ss, vv] = dye._rgbToHsv(d[o], d[o + 1], d[o + 2]);
    const x = (i % img.width) / img.width, y = ((i / img.width) | 0) / img.height;
    if (dye._isExcludedDyePixel(baseId, hh, ss, vv, x, y)) { d[o + 3] = 0; removed++; }
  }
  ctx.putImageData(imgData, 0, 0);
  return { canvas: c, removed };
}

async function makeFaceIcon(dataUrl, box, name, dye) {
  let img = await decodeDataUrl(dataUrl);
  if (STRIP_BACKGROUND[name]) {
    const { canvas, removed } = stripBackground(img, STRIP_BACKGROUND[name], dye);
    console.log(`  背景の飾りを ${removed}px 透明化しました`);
    img = canvas;
  }
  const [x0, y0, x1, y1] = box;
  const sx = Math.round(x0 * img.width), sy = Math.round(y0 * img.height);
  const sw = Math.round((x1 - x0) * img.width), sh = Math.round((y1 - y0) * img.height);

  const c = createCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // 縦横比を保ったまま、余白を除いた範囲に収まるよう縮小して中央に置く
  const avail = SIZE * (1 - PAD * 2);
  const scale = Math.min(avail / sw, avail / sh);
  const dw = sw * scale, dh = sh * scale;
  ctx.drawImage(img, sx, sy, sw, sh, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
  return c;
}

(async () => {
  const preview = process.argv.includes('--preview');
  const images = loadEmbeddedImages();
  const dye = loadDyeModule();
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });

  const filePath = path.join(REPO_ROOT, 'monster-hero', 'data', 'images-ally.js');
  let src = fs.readFileSync(filePath, 'utf8');
  let changed = 0;

  for (const [name, box] of Object.entries(FACE_BOXES)) {
    const srcKey = `${name}_IMG`;
    if (!images[srcKey]) { console.log(`${srcKey}: 見つかりません(スキップ)`); continue; }
    const canvas = await makeFaceIcon(images[srcKey], box, name, dye);
    const buf = canvas.toBuffer('image/png');
    const dataUrl = 'data:image/png;base64,' + buf.toString('base64');

    fs.writeFileSync(path.join(__dirname, 'out', `${name}_FACE_ICON.png`), buf);
    console.log(`${name.padEnd(10)} 顔クロップ ${SIZE}x${SIZE}  ${(buf.length / 1024).toFixed(0)} KB`);

    if (preview) continue;
    // `const NAME_FACE_ICON = 何か;` を新しい dataURL で差し替える
    const decl = new RegExp(`(const\\s+${name}_FACE_ICON\\s*=\\s*)(?:"[^"]*"|'[^']*'|\`[^\`]*\`|[A-Za-z0-9_$]+)(\\s*;)`);
    if (!decl.test(src)) { console.log(`  ⚠ ${name}_FACE_ICON の宣言が見つかりませんでした`); continue; }
    src = src.replace(decl, `$1"${dataUrl}"$2`);
    changed++;
  }

  if (preview) { console.log('\n--preview のため images-ally.js は変更していません'); return; }
  fs.writeFileSync(filePath, src);
  console.log(`\n${changed}件の _FACE_ICON を顔クロップに差し替えました → ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB`);
})().catch((e) => { console.error(e); process.exit(1); });
