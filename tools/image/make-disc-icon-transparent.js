// 円盤石アイコンの「白い背景」を透過にするツール。
//
//   node tools/image/make-disc-icon-transparent.js            … 背景が残っている絵をすべて直す
//   node tools/image/make-disc-icon-transparent.js mia-disc   … 名前を指定して直す
//   node tools/image/make-disc-icon-transparent.js --dry-run  … 直さず、対象と結果の見込みだけ出す
//
// 円盤石の絵は白い背景の上に描かれた状態で届くことがある。そのまま置くと、
// マーケットの丸枠・詳細のどちらでも白い四角がそのまま出てしまう
// (実際にミーアの円盤石アイコンがそうなっていた)。
//
// 「白い画素をすべて消す」とキャラクターの白い部分(肌・翼・目)まで抜けてしまうので、
// 絵の外周から白いところだけをたどって塗りつぶし、たどり着けた画素だけを背景とみなす。
// 円盤の内側にある白は、周りを石で囲まれていて外からたどり着けないので残る。
//
// 円盤の縁は元絵の時点でほとんどぼけていない(白255 → 210 → 72 と1画素で変わる)ため、
// 半端な不透明度は作らず、透明か不透明かのどちらかにする。そのぶん何度流しても
// 結果が変わらない(Canvasは不透明・完全透明の画素なら色を丸めない)。
const fs = require('fs');
const path = require('path');
const { createCanvas, REPO_ROOT } = require('../harness');
const { loadImage } = require('canvas');

const DISC_DIR = path.join(REPO_ROOT, 'monster-hero', 'images', 'disc-icons');
// 背景とみなす白さ。RGBのいちばん低い値がこれ以上なら「白」。
// 実測では背景が253〜255、円盤の縁の いちばん明るいところが210なので、あいだを取る
const BACKGROUND_MIN_CHANNEL = 235;
// 透明とみなす不透明度。すでに背景を抜いてある絵をもう一度流しても同じ結果になるよう、
// 透明な画素も背景の続きとしてたどる
const TRANSPARENT_MAX_ALPHA = 20;
// これ以上背景が残っていたら「抜けていない」とみなす。全体に対する割合
const ALREADY_DONE_RATE = 0.001;

const isBackgroundLike = (pixels, index) => {
  const offset = index * 4;
  if (pixels[offset + 3] <= TRANSPARENT_MAX_ALPHA) return true;
  return Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) >= BACKGROUND_MIN_CHANNEL;
};

// 外周から白いところだけをたどって、背景の画素に印を付ける
const findBackground = (pixels, width, height) => {
  const total = width * height;
  const background = new Uint8Array(total);
  const stack = new Int32Array(total);
  let top = 0;
  const push = (index) => {
    if (background[index] || !isBackgroundLike(pixels, index)) return;
    background[index] = 1;
    stack[top++] = index;
  };
  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1); }
  while (top) {
    const p = stack[--top];
    const x = p % width, y = (p - x) / width;
    if (x > 0) push(p - 1);
    if (x < width - 1) push(p + 1);
    if (y > 0) push(p - width);
    if (y < height - 1) push(p + width);
  }
  return background;
};

// 拡張子が .PNG のものと .png のものが混ざっているので、実際にあるファイル名を引く
const discFilePath = (name) => {
  for (const ext of ['.PNG', '.png']) {
    const file = path.join(DISC_DIR, name + ext);
    if (fs.existsSync(file)) return file;
  }
  return null;
};

const processOne = async (name, dryRun) => {
  const file = discFilePath(name);
  const image = await loadImage(file);
  const width = image.width, height = image.height, total = width * height;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, width, height);
  const pixels = data.data;

  const background = findBackground(pixels, width, height);
  let removed = 0, alreadyTransparent = 0;
  for (let i = 0; i < total; i++) {
    if (!background[i]) continue;
    if (pixels[i * 4 + 3] <= TRANSPARENT_MAX_ALPHA) { alreadyTransparent++; continue; }
    removed++;
  }
  const rate = removed / total;
  console.log(`${name}: ${width}x${height} / 背景として消せる白 ${removed}px (${(rate * 100).toFixed(1)}%) / すでに透明 ${alreadyTransparent}px`);
  if (removed === 0) { console.log('   → すでに背景が抜けている。何もしない'); return false; }
  if (dryRun) { console.log('   → --dry-run のため書き換えない'); return false; }

  for (let i = 0; i < total; i++) {
    if (!background[i]) continue;
    const offset = i * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = pixels[offset + 3] = 0;
  }
  context.putImageData(data, 0, 0);
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
  console.log(`   → 書き出した: images/disc-icons/${path.basename(file)}`);
  return true;
};

(async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const names = args.filter(arg => !arg.startsWith('--')).map(arg => arg.replace(/\.png$/i, ''));
  const targets = names.length
    ? names
    : fs.readdirSync(DISC_DIR).filter(file => /\.png$/i.test(file)).map(file => file.replace(/\.png$/i, '')).sort();

  let changed = 0;
  for (const name of targets) {
    if (!discFilePath(name)) throw new Error(`円盤石の絵がありません: ${name}`);
    if (await processOne(name, dryRun)) changed++;
  }
  console.log(changed ? `\n${changed}枚を書き換えた。この後 node tools/build.js でキャッシュキーを更新すること`
    : '\n書き換えたものはない');
})().catch(error => { console.error(error); process.exit(1); });
