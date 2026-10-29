// オボロゲソウ(C-208・C-208S・C-208V)の配信用の絵を、届いた完成画像から作り直す(2026-10-29 社長「表示の不具合と、カードの切れ」)。
//   node tools/card/card-art-oborogesou-fix.js [--sheet <見比べの絵の出力先.png>]
// 届いた絵(tools/art-sources/card-battle/oborogesou/*.png)は上書きしない。書き出すのは monster-hero/images/card-battle/{l,s}/C208*.jpg だけ。
// 【直すこと】
//  (1) 3枚とも中身が右へ寄っていて、右のふちが細く、右下の「10」「No.C-208」がはしに付いていた(別絵キラははしから4ドット)。
//      右下の数字の右はしから絵のはしまでを 66 ドット(ふつうの版で左の名前の前と同じくらい)にそろえるぶん左へずらし、
//      右に空いた所は、そのカードの左のふちを鏡写しにして足す(別絵キラは絵の地が右はしまで来ていて、右はしを写すと羽が映った)。
//      左のふちに字(プラントの札)がかかる行は、その帯のすぐ下の同じ高さのところを写す
//  (2) キラ・別絵キラは右上の「地上」の丸の中に白い欠けがあった。ふつうの版のきれいな丸を、同じ大きさにして重ねる
//  ほかのモンスターのカードと同じく、角を丸くして外を白にする(card-image-build.js の大きさ・質)
const path = require('path');
const fs = require('fs');
const sharp = require('../node_modules/sharp');
const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'tools/art-sources/card-battle/oborogesou');
const OUT = path.join(ROOT, 'monster-hero/images/card-battle');
const SIZES = { s: [240, 336], l: [480, 672] }; // card-image-build.js と同じ
const MARGIN = 66; // 右下の数字の右はしから絵のはしまで
const RADIUS = 30; // 角の丸み(1092 幅で。配信の 480 幅で約 13 ドット = 剣士モッチー・パンドラの完成画像と同じ)
// 「地上」の丸(届いた絵の座標。中心と半径は目で測った)。ふつうの版の丸を写す
const BADGE = { normal: { x: 934, y: 206, r: 104 }, holo: { x: 947, y: 206, r: 104 }, rare_holo: { x: 973, y: 209, r: 112 } };
const VARIANTS = [['normal', ''], ['holo', 'S'], ['rare_holo', 'V']];

const load = async (name) => {
  const { data, info } = await sharp(path.join(SRC, `oborogesou_${name}.png`)).flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { px: data, w: info.width, h: info.height };
};
const lum = (px, i) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];

// (1) 左へ c ドットずらし、右の空きをふちの鏡写しで埋める
const shiftLeft = ({ px, w, h }) => {
  // 右下の数字(黒いふち取り)の右はし
  let numRight = 0;
  for (let y = 1250; y < Math.min(h, 1445); y += 1) for (let x = 800; x < w; x += 1) if (lum(px, (y * w + x) * 3) < 40) numRight = Math.max(numRight, x);
  const c = Math.max(0, MARGIN - (w - 1 - numRight));
  const out = Buffer.alloc(px.length);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w - c; x += 1) px.copy(out, (y * w + x) * 3, (y * w + x + c) * 3, (y * w + x + c) * 3 + 3);
  }
  // 左のふち(ずらしたあとの 0〜c-1 列)を鏡写しにして右へ。外側どうし・内側どうしが向き合う。字がかかる行は、その帯のすぐ下の同じ高さのところを写す(模様が続くように)
  const textRow = new Array(h).fill(false);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < c; x += 1) if (lum(out, (y * w + x) * 3) < 50 && y > 60 && y < h - 60) { textRow[y] = true; break; }
  for (let y = 0; y < h; y += 1) {
    let sy = y;
    if (textRow[y]) { let top = y; while (top > 0 && textRow[top - 1]) top -= 1; let bot = y; while (bot < h - 1 && textRow[bot + 1]) bot += 1; sy = Math.min(h - 1, bot + 1 + (y - top)); }
    for (let k = 0; k < c; k += 1) out.copy(out, (y * w + (w - 1 - k)) * 3, (sy * w + k) * 3, (sy * w + k) * 3 + 3);
  }
  return { px: out, w, h, c };
};

// (2) ふつうの版の丸を、ずれと大きさを合わせて重ねる(ふちは 3 ドットでぼかす)
const pasteBadge = (dst, src, from, to) => {
  const { w, h } = dst;
  const s = from.r / to.r;
  for (let y = Math.floor(to.y - to.r - 2); y <= to.y + to.r + 2; y += 1) {
    for (let x = Math.floor(to.x - to.r - 2); x <= to.x + to.r + 2; x += 1) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const d = Math.hypot(x - to.x, y - to.y);
      const a = Math.max(0, Math.min(1, (to.r - d) / 3));
      if (a <= 0) continue;
      const sx = Math.round(from.x + (x - to.x) * s), sy = Math.round(from.y + (y - to.y) * s);
      if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
      const di = (y * w + x) * 3, si = (sy * src.w + sx) * 3;
      for (let k = 0; k < 3; k += 1) dst.px[di + k] = Math.round(dst.px[di + k] * (1 - a) + src.px[si + k] * a);
    }
  }
};

(async () => {
  const sheetAt = process.argv.indexOf('--sheet');
  const sheet = [];
  const normal = shiftLeft(await load('normal'));
  for (const [name, suffix] of VARIANTS) {
    const img = name === 'normal' ? normal : shiftLeft(await load(name));
    if (name !== 'normal') {
      const b = BADGE[name], n = BADGE.normal;
      pasteBadge(img, normal, { ...n, x: n.x - normal.c }, { ...b, x: b.x - img.c });
    }
    const mask = Buffer.from(`<svg width="${img.w}" height="${img.h}"><rect width="100%" height="100%" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/></svg>`);
    const rounded = await sharp(img.px, { raw: { width: img.w, height: img.h, channels: 3 } }).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    const card = await sharp(rounded).flatten({ background: '#ffffff' }).png().toBuffer();
    for (const [key, [w, h]] of Object.entries(SIZES)) {
      await sharp(card).resize(w, h).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(OUT, key, `C208${suffix}.jpg`));
    }
    console.log(`C208${suffix}.jpg: 左へ ${img.c} ドット`);
    if (sheetAt > 0) sheet.push(await sharp(card).resize(480, 672).png().toBuffer());
  }
  if (sheetAt > 0) {
    const out = process.argv[sheetAt + 1];
    await sharp({ create: { width: 480 * 3 + 40, height: 672, channels: 3, background: '#ffffff' } })
      .composite(sheet.map((input, i) => ({ input, left: i * 500, top: 0 }))).png().toFile(out);
    console.log('見比べ:', path.relative(ROOT, out));
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
