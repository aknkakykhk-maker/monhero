const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 立ち絵の外側に残った透明な余白を切り落とし、他のモンスターと同じくらいの
// 大きさで並ぶようにする。染色マスクがある場合は同じ矩形で一緒に切る。
//
//   node image/trim-art-margin.js images/monsters/eiki.png --mask images/monsters/eiki-dye-mask.PNG
//   node image/trim-art-margin.js images/monsters/eiki.png --dry-run     … 測るだけ
//   node image/trim-art-margin.js images/monsters/eiki.png --pad 8       … 余白を8px残す(既定0)
//
// 【なぜ要るか】
// 立ち絵は共通枠(MonsterArtFrame)へ object-fit: contain で収める。絵の外側に
// 透明な余白があると、その余白ごと枠へ収まってしまい、絵だけが他より小さく並ぶ。
// 実際にエイキは上109px・下209pxの余白があり、共通枠で他の0.89倍にしかならなかった。
// これは `node tools/monster/monster-art-fit-check.js` が拾う。
//
// 【やらないこと】
//   ・絵そのものの拡大・縮小・描き直し(切るのは透明な画素だけ)
//   ・立ち絵と染色マスクで別々の矩形を使うこと(必ず同じ矩形で切る。ずれると染色が壊れる)
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('../harness');
const { loadImage } = require('canvas');

const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
const WEB_ROOT = path.join(REPO_ROOT, 'monster-hero');
const ALPHA_MIN = 16; // これ未満は「何も描かれていない」とみなす

const resolve = (rel) => (path.isAbsolute(rel) ? rel : path.join(WEB_ROOT, rel));

const opaqueBounds = async (file) => {
  const img = await loadImage(file);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  let x1 = img.width, y1 = img.height, x2 = -1, y2 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (d[(y * img.width + x) * 4 + 3] < ALPHA_MIN) continue;
    if (x < x1) x1 = x; if (x > x2) x2 = x;
    if (y < y1) y1 = y; if (y > y2) y2 = y;
  }
  if (x2 < 0) throw new Error(`不透明な画素がありません: ${file}`);
  return { img, x1, y1, x2, y2 };
};

const cropTo = async (file, rect) => {
  const img = await loadImage(file);
  const canvas = createCanvas(rect.w, rect.h);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false; // 等倍で切り出すだけ。1画素も作り変えない
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  return canvas.toBuffer('image/png');
};

const main = async () => {
  const argv = process.argv.slice(2);
  const rest = [];
  let mask = null, pad = 0, dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') { dryRun = true; continue; }
    if (argv[i] === '--mask') { mask = argv[++i]; continue; }
    if (argv[i] === '--pad') { pad = Number(argv[++i]); continue; }
    rest.push(argv[i]);
  }
  const art = rest[0];
  if (!art || !Number.isFinite(pad) || pad < 0) {
    console.error('使い方: node image/trim-art-margin.js <立ち絵> [--mask <染色マスク>] [--pad N] [--dry-run]');
    process.exit(1);
  }
  const artPath = resolve(art);
  if (!fs.existsSync(artPath)) { console.error(`NG: 立ち絵が見つかりません: ${artPath}`); process.exit(1); }

  const { img, x1, y1, x2, y2 } = await opaqueBounds(artPath);
  const rect = {
    x: Math.max(0, x1 - pad),
    y: Math.max(0, y1 - pad),
  };
  rect.w = Math.min(img.width, x2 + 1 + pad) - rect.x;
  rect.h = Math.min(img.height, y2 + 1 + pad) - rect.y;

  console.log(`立ち絵: ${art} (${img.width}x${img.height})`);
  console.log(`  透明な余白: 上${y1} 下${img.height - 1 - y2} 左${x1} 右${img.width - 1 - x2}`);
  console.log(`  切り出す範囲: x=${rect.x} y=${rect.y} ${rect.w}x${rect.h}（余白を${pad}px残す）`);
  if (rect.w === img.width && rect.h === img.height) { console.log('  切る余白がありません'); return; }

  if (mask) {
    const maskPath = resolve(mask);
    if (!fs.existsSync(maskPath)) { console.error(`NG: 染色マスクが見つかりません: ${maskPath}`); process.exit(1); }
    const maskImg = await loadImage(maskPath);
    if (maskImg.width !== img.width || maskImg.height !== img.height) {
      console.error(`NG: 染色マスクの大きさが立ち絵と違います (${maskImg.width}x${maskImg.height})。同じ矩形で切れません`);
      process.exit(1);
    }
    console.log(`染色マスク: ${mask} — 同じ矩形で切ります`);
  }
  if (dryRun) { console.log('\n--dry-run のため書き出していません'); return; }

  fs.writeFileSync(artPath, await cropTo(artPath, rect));
  console.log(`\n書き換えました: ${art} → ${rect.w}x${rect.h} (${(fs.statSync(artPath).size / 1024).toFixed(0)}KB)`);
  if (mask) {
    const maskPath = resolve(mask);
    fs.writeFileSync(maskPath, await cropTo(maskPath, rect));
    console.log(`書き換えました: ${mask} → ${rect.w}x${rect.h} (${(fs.statSync(maskPath).size / 1024).toFixed(0)}KB)`);
  }
  console.log('※ このあと node tools/build.js でキャッシュキーを更新し、顔アイコンを作り直すこと');
};

main().catch((e) => { console.error(e); process.exit(1); });
