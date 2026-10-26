// パンドラのカード絵を、受け取った1枚(3枚並び)から、ほかのモンスターカードと同じ形の3枚(C-067・C-067S・C-067V)にする。
// 2026-10-26 社長「パンドラのカードを剣士モッチーと同じ形で足して」。決まり(統括部長 経由):
//   ・番号は C-067(右下の「No.C-005」の字だけ描き直す。ほかの字はそのまま)
//   ・右上の札は「空」の1字だけなので、ピクシー(C-005)と同じ「空中」の2字の札に描き直す
//   ・メイン ピクシー/サブ ？？？(本編の Pandora = メイン pixie/サブ unknown)。混血の札(左上のメイン・右下のサブ)を描き足す
//   ・足もとの赤い飾りはそのまま残す
// やること:
//   1) 受け取った絵(tools/art-sources/card-battle/pandora/received-3in1.png)から3枚を切り出し、742×1038 にそろえて四隅を白く丸める
//   2) 混血の札は、ほかの混血カードの札を形どおりに切り抜いて写す。札の色はメインの種族の色(ピクシーは赤)で、
//      「サブ/？？？」もメインと同じ色になる。左上はエンジェル(C-016 メイン ピクシー)、右下はムー(C-045 メイン ドラゴン=赤/サブ ？？？)の札を写す。
//      ムーの札は地にドラゴンのひび模様が透けているので、赤い地だけをならして(まわりの赤の平均にして)消す。白い字・黒いふちはそのまま
//   3) 右上の丸い札は、ピクシー(C-005)の「空中」の札を丸く切り抜き、パンドラの丸の大きさに縮めて重ねる
//   4) 右下の番号を消して(行ごとに左右の色をつなぐ)、同じ見た目(白い字・黒のふち)で「No.C-067」と描く
// 書き出し: tools/art-sources/card-battle/hybrid/C067.jpg・C067S.jpg・C067V.jpg(742×1038)。配信用に縮めるのは card-image-build.js
// 使い方: node tools/card/card-art-pandora.js --font-dir <noto-sans-jp の files> [--out <フォルダ>]
//   フォントは card-image-ja.js と同じ(npm pack @fontsource/noto-sans-jp@5.0.19 → package/files)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const sharp = require(path.join(ROOT, 'tools', 'node_modules', 'sharp'));
const SRC = path.join(ROOT, 'tools', 'art-sources', 'card-battle', 'pandora', 'received-3in1.png');
const JA = path.join(ROOT, 'tools', 'art-sources', 'card-battle-ja');
const PIXIE = path.join(ROOT, 'tools', 'art-sources', 'card-battle', 'pixie', 'C-005.jpg');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('--out', path.join(ROOT, 'tools', 'art-sources', 'card-battle', 'hybrid')));
const FONT_DIR = opt('--font-dir', null);
const W = 742, H = 1038;

// 受け取った絵の3枚の場所(左から ふつう・キラ・別絵キラ)と、札・番号のずらし。
//   main: 窓の左上の角 エンジェル(44,46)→パンドラ(ふつう 46,44/キラ・別絵キラ 42,48・42,46)
//   sub:  窓の右下 ムー(697,860)→パンドラ(702,834)。パンドラは窓の下が少し短い
//   num:  元の「No.C-005」の右端と下端
const CARDS = [
  { file: 'C067.jpg', rect: { left: 6, top: 7, width: 594, height: 843 }, main: [2, -2], sub: [5, -26], num: { right: 702, base: 977 } },
  { file: 'C067S.jpg', rect: { left: 621, top: 6, width: 593, height: 844 }, main: [-2, 2], sub: [5, -26], num: { right: 700, base: 975 } },
  { file: 'C067V.jpg', rect: { left: 1236, top: 7, width: 592, height: 842 }, main: [-2, 0], sub: [5, -26], num: { right: 696, base: 975 } },
];
// 写す札(742×1038 の座標)。seed は札の中の赤い点、box は札が収まる範囲。smooth はひび模様をならすか
const TABS = [
  { name: 'main', from: 'C016.jpg', seed: [120, 70], box: [52, 52, 202, 152] },
  { name: 'sub', from: 'C045.jpg', seed: [600, 800], box: [540, 762, 686, 858], smooth: true },
];
// 札の赤い地(字・ふち・影ではない所)
const isRedGround = (r, g, b) => r > 140 && g < 110 && b < 110 && r - g > 100;
// 赤い地だけを、まわり(半径 R)の赤い地の平均にする。2回かけて、ひびの線を消す
const smoothRed = (px, w, h, mask, R = 6) => {
  const out = Buffer.from(px);
  for (let pass = 0; pass < 2; pass++) {
    const src = Buffer.from(out);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (!mask[k] || !isRedGround(src[k * 3], src[k * 3 + 1], src[k * 3 + 2])) continue;
      let n = 0, sr = 0, sg = 0, sb = 0;
      for (let yy = Math.max(0, y - R); yy <= Math.min(h - 1, y + R); yy++) for (let xx = Math.max(0, x - R); xx <= Math.min(w - 1, x + R); xx++) {
        const j = yy * w + xx;
        if (!mask[j]) continue;
        const r = src[j * 3], g = src[j * 3 + 1], b = src[j * 3 + 2];
        if (!isRedGround(r, g, b)) continue;
        n++; sr += r; sg += g; sb += b;
      }
      out[k * 3] = Math.round(sr / n); out[k * 3 + 1] = Math.round(sg / n); out[k * 3 + 2] = Math.round(sb / n);
    }
  }
  return out;
};
// 右上の丸い札: ピクシー C-005 の丸(中心・半径)を、パンドラの丸へ
const BADGE = { from: { cx: 609, cy: 133, r: 66 }, to: { cx: 630, cy: 122, r: 62 } };
// 番号の字: 消す範囲(左右と上下)と大きさ
const NUMBER = { erase: [543, 947, 712, 986], size: 36, weight: 700, text: 'No.C-067' };

// 札の形の切り抜き: seed から赤に近い点をたどり、行ごとに左端〜右端を札とみなす(字の穴も埋まる)。
// まわりを広げて、札のふちの明るい所・影も入れる(窓の背景のうすいオレンジ・ムーの背景の模様は入れない)
const tabMask = (px, w, h, tab) => {
  const [x0, y0, x1, y1] = tab.box;
  const at = (x, y) => (y * w + x) * 3;
  const s = at(tab.seed[0], tab.seed[1]);
  const ref = [px[s], px[s + 1], px[s + 2]];
  const near = (x, y) => { const i = at(x, y); return Math.abs(px[i] - ref[0]) + Math.abs(px[i + 1] - ref[1]) + Math.abs(px[i + 2] - ref[2]) < 90; };
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
  const isRim = (x, y) => { const i = at(x, y); const r = px[i], g = px[i + 1], b = px[i + 2]; return (r + g + b) / 3 < 70 || (r > g * 1.45 && r > b * 1.45); };
  // 広げるのは、札から外へ「ふち(赤・明るい赤・影)」が続いているあいだだけ
  let cur = mask;
  for (let step = 0; step < 6; step++) {
    const nx = cur.slice();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * w + x;
      if (cur[k]) continue;
      if (!(cur[k - 1] || cur[k + 1] || cur[k - w] || cur[k + w])) continue;
      if (isRim(x, y)) nx[k] = 1;
    }
    cur = nx;
  }
  return cur;
};

(async () => {
  if (!FONT_DIR) { console.error('--font-dir が要ります(card-image-ja.js と同じ Noto Sans JP)'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const tabs = [];
  for (const t of TABS) {
    const g = await sharp(path.join(JA, t.from)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const mask = tabMask(g.data, g.info.width, g.info.height, t);
    tabs.push({ ...t, mask, px: t.smooth ? smoothRed(g.data, g.info.width, g.info.height, mask) : g.data });
  }
  // 右上の丸い札(ピクシー)を、パンドラの丸の大きさに縮めて丸く切り抜く(ふちは1px なじませる)
  const k = BADGE.to.r / BADGE.from.r;
  const half = Math.ceil(BADGE.from.r + 4);
  const side = Math.round(half * 2 * k);
  const badgeRgb = await sharp(PIXIE).extract({ left: BADGE.from.cx - half, top: BADGE.from.cy - half, width: half * 2, height: half * 2 }).resize(side, side).removeAlpha().png().toBuffer();
  const c = side / 2;
  const badgeMask = Buffer.from(`<svg width="${side}" height="${side}"><defs><filter id="f"><feGaussianBlur stdDeviation="0.6"/></filter></defs><circle cx="${c}" cy="${c}" r="${BADGE.to.r}" fill="#fff" filter="url(#f)"/></svg>`);
  const badge = await sharp(badgeRgb).ensureAlpha().composite([{ input: badgeMask, blend: 'dest-in' }]).png().toBuffer();
  const badgeAt = { left: Math.round(BADGE.to.cx - c), top: Math.round(BADGE.to.cy - c) };
  const corner = Buffer.from(`<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="30" ry="30" fill="#fff"/></svg>`);

  let playwright;
  try { playwright = require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch { playwright = require('playwright'); }
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const font = `data:font/woff2;base64,${fs.readFileSync(path.join(FONT_DIR, `noto-sans-jp-japanese-${NUMBER.weight}-normal.woff2`)).toString('base64')}`;

  for (const card of CARDS) {
    // 1) 切り出して 742×1038・四隅を白く丸める。右上の丸い札もここで重ねる
    const cut = await sharp(SRC).extract(card.rect).resize(W, H, { fit: 'fill' }).ensureAlpha().composite([{ input: corner, blend: 'dest-in' }]).png().toBuffer();
    const base = await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
      .composite([{ input: cut }, { input: badge, ...badgeAt }]).removeAlpha().raw().toBuffer();
    // 2) 混血の札を写す
    for (const t of tabs) {
      const [dx, dy] = card[t.name];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!t.mask[y * W + x]) continue;
        const tx = x + dx, ty = y + dy;
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        const si = (y * W + x) * 3, ti = (ty * W + tx) * 3;
        base[ti] = t.px[si]; base[ti + 1] = t.px[si + 1]; base[ti + 2] = t.px[si + 2];
      }
    }
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
    // 4) 番号を描く(白い字・黒のふち。元の「No.C-005」と同じ右端・下端)
    const out = await page.evaluate(async ({ img, font, n, at }) => {
      const f = new FontFace('NotoJP', `url(${font})`, { weight: String(n.weight) });
      await f.load(); document.fonts.add(f);
      const im = new Image(); im.src = img; await im.decode();
      const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
      const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0);
      ctx.font = `${n.weight} ${n.size}px NotoJP`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#2a1a1e'; ctx.strokeText(n.text, at.right, at.base);
      ctx.fillStyle = '#ffffff'; ctx.fillText(n.text, at.right, at.base);
      return cv.toDataURL('image/png');
    }, { img: `data:image/png;base64,${png.toString('base64')}`, font, n: NUMBER, at: card.num });
    await sharp(Buffer.from(out.split(',')[1], 'base64')).jpeg({ quality: 92 }).toFile(path.join(OUT, card.file));
    console.log(`書き出し: ${path.relative(ROOT, path.join(OUT, card.file))}`);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
