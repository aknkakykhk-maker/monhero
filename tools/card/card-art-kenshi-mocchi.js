// 剣士モッチーのカード絵を、受け取った1枚(3枚並び)から、ほかのモンスターカードと同じ形の3枚(C-066・C-066S・C-066V)にする。
// 2026-10-26 社長「剣士モッチー、パックに追加して」。決まり(統括部長 経由):
//   ・番号は C-066(右下の「No.C-009」の字だけ描き直す。ほかの字はそのまま)
//   ・メイン モッチー/サブ ？？？(ジェントル C-020 と同じ)。混血の札(左上のメイン・右下のサブ)を、ほかの混血カードと同じ見た目で描き足す
//   ・足もとの赤い飾り(ギリシャ文字のような模様)はそのまま残す(モッチー・ジェントルと同じ見た目)
// やること:
//   1) 受け取った絵(tools/art-sources/card-battle/kenshi-mocchi/received-3in1.png)から3枚を切り出し、742×1038 にそろえて四隅を白く丸める
//   2) 混血の札は、ジェントル(card-battle-ja/C020.jpg)の札を形どおりに切り抜いて写す(中身が同じ「モッチー/メイン」「サブ/？？？」のため)。
//      置き場所は窓の角に合わせる(剣士モッチーは窓が少し上・右に大きい)
//   3) 右下の番号を消して(行ごとに左右の色をつなぐ)、同じ見た目(白い字・細い黒のふち)で「No.C-066」と描く
// 書き出し: tools/art-sources/card-battle/hybrid/C066.jpg・C066S.jpg・C066V.jpg(742×1038)。配信用に縮めるのは card-image-build.js
// 使い方: node tools/card/card-art-kenshi-mocchi.js --font-dir <noto-sans-jp の files> [--out <フォルダ>]
//   フォントは card-image-ja.js と同じ(npm pack @fontsource/noto-sans-jp@5.0.19 → package/files)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const sharp = require(path.join(ROOT, 'tools', 'node_modules', 'sharp'));
const SRC = path.join(ROOT, 'tools', 'art-sources', 'card-battle', 'kenshi-mocchi', 'received-3in1.png');
const GENTLE = path.join(ROOT, 'tools', 'art-sources', 'card-battle-ja', 'C020.jpg');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('--out', path.join(ROOT, 'tools', 'art-sources', 'card-battle', 'hybrid')));
const FONT_DIR = opt('--font-dir', null);
const W = 742, H = 1038;

// 受け取った絵の3枚の場所(左から ふつう・キラ・別絵キラ)。外の黒い所を除いたカードの外枠
const CARDS = [
  { file: 'C066.jpg', rect: { left: 6, top: 7, width: 594, height: 843 } },
  { file: 'C066S.jpg', rect: { left: 621, top: 6, width: 593, height: 844 } },
  { file: 'C066V.jpg', rect: { left: 1236, top: 7, width: 592, height: 842 } },
];
// ジェントルの札(742×1038 の座標)。seed は札の中のピンクの点、box は札が収まる範囲。dx・dy は剣士モッチーへ写すときのずらし
//   左上: 窓の左上の角が ジェントル(45,46)→剣士モッチー(41,35)
//   右下: 窓の右下が ジェントル(670,963)→剣士モッチー(673,956)
const TABS = [
  { name: 'main', seed: [120, 70], box: [58, 55, 196, 146], dx: -4, dy: -11 },
  { name: 'sub', seed: [600, 800], box: [536, 760, 682, 860], dx: 3, dy: -7 },
];
// 番号の字(剣士モッチーの 742×1038 の座標)。消す範囲と、描く右端・下端
const NUMBER = { erase: [542, 957, 737, 998], right: 734, base: 993, size: 33, text: 'No.C-066' };

// 札の形の切り抜き: seed からピンクに近い点をたどり、行ごとに左端〜右端を札とみなす(字の穴も埋まる)。まわりを2px広げて、ふちの影も入れる(背景のオレンジは入れない)
const tabMask = (px, w, h, tab) => {
  const [x0, y0, x1, y1] = tab.box;
  const at = (x, y) => (y * w + x) * 3;
  const s = at(tab.seed[0], tab.seed[1]);
  const ref = [px[s], px[s + 1], px[s + 2]];
  const near = (x, y) => { const i = at(x, y); const r = px[i], g = px[i + 1], b = px[i + 2]; return Math.abs(r - ref[0]) + Math.abs(g - ref[1]) + Math.abs(b - ref[2]) < 60 && b > r * 0.68; };
  const seen = new Uint8Array(w * h);
  const stack = [tab.seed];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    const k = y * w + x;
    if (seen[k] || !near(x, y)) continue;
    seen[k] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const mask = new Uint8Array(w * h);
  for (let y = y0; y <= y1; y++) {
    let a = -1, b = -1;
    for (let x = x0; x <= x1; x++) if (seen[y * w + x]) { if (a < 0) a = x; b = x; }
    if (a >= 0) for (let x = a; x <= b; x++) mask[y * w + x] = 1;
  }
  const grown = new Uint8Array(w * h);
  const G = 2;
  for (let y = y0 - G; y <= y1 + G; y++) for (let x = x0 - G; x <= x1 + G; x++) {
    let on = 0;
    for (let dy = -G; dy <= G && !on; dy++) for (let dx = -G; dx <= G && !on; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < h && xx >= 0 && xx < w && mask[yy * w + xx]) on = 1; }
    // 広げた所は、札のふちの影(暗い点)と札のピンク・明るいふちだけ。ジェントルの背景(うすいオレンジ)は入れない
    if (on && !mask[y * w + x]) { const i = at(x, y); const r = px[i], g2 = px[i + 1], b2 = px[i + 2]; if (!((r + g2 + b2) / 3 < 130 || b2 > r * 0.78)) on = 0; }
    if (on) grown[y * w + x] = 1;
  }
  return grown;
};

(async () => {
  if (!FONT_DIR) { console.error('--font-dir が要ります(card-image-ja.js と同じ Noto Sans JP)'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  // ジェントルの札(切り抜きの形と色)
  const g = await sharp(GENTLE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const masks = TABS.map((t) => tabMask(g.data, g.info.width, g.info.height, t));
  const corner = Buffer.from(`<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="30" ry="30" fill="#fff"/></svg>`);

  let playwright;
  try { playwright = require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch { playwright = require('playwright'); }
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const font = `data:font/woff2;base64,${fs.readFileSync(path.join(FONT_DIR, 'noto-sans-jp-japanese-500-normal.woff2')).toString('base64')}`;

  for (const c of CARDS) {
    // 1) 切り出して 742×1038・四隅を白く丸める
    const cut = await sharp(SRC).extract(c.rect).resize(W, H, { fit: 'fill' }).ensureAlpha().composite([{ input: corner, blend: 'dest-in' }]).png().toBuffer();
    const base = await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite([{ input: cut }]).removeAlpha().raw().toBuffer();
    // 2) 混血の札を写す
    TABS.forEach((t, k) => {
      const m = masks[k];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!m[y * W + x]) continue;
        const tx = x + t.dx, ty = y + t.dy;
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        const si = (y * W + x) * 3, ti = (ty * W + tx) * 3;
        base[ti] = g.data[si]; base[ti + 1] = g.data[si + 1]; base[ti + 2] = g.data[si + 2];
      }
    });
    // 3) 番号を消す(行ごとに、範囲のすぐ左とすぐ右の色をつなぐ)
    const [ex0, ey0, ex1, ey1] = NUMBER.erase;
    for (let y = ey0; y <= ey1; y++) {
      const li = (y * W + (ex0 - 1)) * 3, ri = (y * W + (ex1 + 1)) * 3;
      for (let x = ex0; x <= ex1; x++) {
        const t = (x - ex0 + 1) / (ex1 - ex0 + 2);
        const i = (y * W + x) * 3;
        for (let ch = 0; ch < 3; ch++) base[i + ch] = Math.round(base[li + ch] * (1 - t) + base[ri + ch] * t);
      }
    }
    const png = await sharp(base, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
    // 番号を描く(白い字・細い黒のふち。元の「No.C-009」と同じ右端・下端)
    const out = await page.evaluate(async ({ img, font, n }) => {
      const f = new FontFace('NotoJP', `url(${font})`, { weight: '500' });
      await f.load(); document.fonts.add(f);
      const im = new Image(); im.src = img; await im.decode();
      const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
      const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0);
      ctx.font = `500 ${n.size}px NotoJP`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = '#3a2a30'; ctx.strokeText(n.text, n.right, n.base);
      ctx.fillStyle = '#ffffff'; ctx.fillText(n.text, n.right, n.base);
      return cv.toDataURL('image/png');
    }, { img: `data:image/png;base64,${png.toString('base64')}`, font, n: NUMBER });
    await sharp(Buffer.from(out.split(',')[1], 'base64')).jpeg({ quality: 92 }).toFile(path.join(OUT, c.file));
    console.log(`書き出し: ${path.relative(ROOT, path.join(OUT, c.file))}`);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
