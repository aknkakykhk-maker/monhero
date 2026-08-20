// 敵・味方の全身画像について、キャンバス寸法・透過・既知の背景残りを検査する。
const fs = require('fs');
const path = require('path');
const { createCanvas, Image } = require('canvas');
const { REPO_ROOT, imageFilePath, loadEmbeddedImages } = require('../harness');

// 2026年8月に画像をbase64の埋め込みからPNGファイルへ移したため、
// 変数が指しているパスからファイルを読んで検査する
// 件数は決め打ちにしない(モンスターを1体足すたびにこの検査だけが落ちるため)。
// 代わりに「モンスター定義が使っている立ち絵が1枚残らず検査対象になっていること」を確かめる。
const files = ['images-ally.js', 'images-enemy.js'];
const images = [];
for (const file of files) {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/images', file), 'utf8');
  const matches = [...source.matchAll(/const\s+(\w+_IMG(?:_DATA)?)\s*=\s*"(images\/[^"]+)"/g)];
  if (matches.length === 0) throw new Error(`${file}: 全身画像の宣言が1件も見つかりません`);
  images.push(...matches.map(match => ({ name: match[1], url: match[2] })));
}
{
  const covered = new Set(images.map(i => i.url.split('?')[0]));
  const usedByMonsters = Object.entries(loadEmbeddedImages())
    .filter(([name]) => /_IMG(_DATA)?$/.test(name))
    .map(([, url]) => String(url).split('?')[0]);
  const missing = usedByMonsters.filter(url => !covered.has(url));
  if (missing.length) throw new Error(`検査から漏れている立ち絵があります: ${missing.join(', ')}`);
}

for (const { name, url } of images) {
  const file = imageFilePath(url);
  if (!fs.existsSync(file)) throw new Error(`${name}: ${url} がありません`);
  const image = new Image();
  image.src = fs.readFileSync(file);
  if (!image.width || !image.height) throw new Error(`${name}: PNGを読み込めません`);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  let visible = 0;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) visible++;
  if (!visible) throw new Error(`${name}: 可視画素がありません`);
  const corners = [[0, 0], [image.width - 1, 0], [0, image.height - 1], [image.width - 1, image.height - 1]];
  if (corners.some(([x, y]) => pixels[(y * image.width + x) * 4 + 3] > 8)) {
    throw new Error(`${name}: キャンバス隅に背景または消し残しがあります`);
  }
  console.log(`OK ${name.padEnd(20)} ${image.width}x${image.height} / 可視画素 ${visible}`);
}
console.log(`敵・味方の全身画像 ${images.length}件を確認しました`);
