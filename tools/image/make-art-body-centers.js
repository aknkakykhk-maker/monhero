// 立ち絵(モンスター)の「体の範囲」を測って、一覧を書く(2026-10-31 ルールくん)。
//
//   node tools/image/make-art-body-centers.js          … 測って、data/images/images-ally.js の <art-body-centers> の間に書く
//   node tools/image/make-art-body-centers.js --check  … 書かずに、一覧が今の絵と合っているかだけ見る
//   node tools/image/make-art-body-centers.js --sheet <png>  … 全部の絵に体の範囲と中心を描いた一覧の写真を作る(目で確かめる用)
//
// 【なぜ要るか】
// MFバトルカードのキラ・レアキラの立ち絵の光(84 の CardKiraLayer。後ろで回る光の線・光の粒・星)は、光の中心を
// モンスターの体の真ん中に合わせる(2026-10-31 社長「モンスターのセンター位置をちゃんと合わせて。ライガーみたいに尻尾があるやつは注意」)。
// 絵の四角の真ん中や、中身の範囲(ART_CONTENT_BOXES)の真ん中だと、尻尾・羽・角のように細く長く伸びた所に引っぱられてずれる。
//
// 【測り方】
// ・透けていない画素(不透明度が CUT を超える)ごとに、絵のふちまでの近さ(厚み)を測る
// ・中心は、厚みの2乗で重みをつけた重心(尻尾・羽・茎のように細く伸びた所は、ほとんど数えない)
// ・体の範囲は、厚みが最大の THICK 倍以上ある所を囲み、その厚みの分だけ広げた四角
// ・値は [中心の横, 中心の縦, 体の左, 体の上, 体の右, 体の下](画像の幅・高さに対する割合・小数3桁)。キーは images/ の下の道
// ・元の絵は変えない
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const GAME = path.join(REPO, 'monster-hero');
const IMAGES_ALLY = path.join(GAME, 'data', 'images', 'images-ally.js');
const sharp = require(path.join(REPO, 'tools', 'node_modules', 'sharp'));
const BEGIN = '// <art-body-centers>';
const END = '// </art-body-centers>';
const CUT = 64;
const THICK = 0.35;

const listFiles = () => fs.readdirSync(path.join(GAME, 'images', 'monsters')).filter((f) => /\.png$/i.test(f)).sort().map((f) => `images/monsters/${f}`);

// 体の重心: 透けていない画素を、その画素から絵のふちまでの近さ(厚み)の2乗で重みをつけて平均する。
// 尻尾・羽・茎のように細い所は厚みが小さいので、ほとんど数えない。体の範囲は、厚みが最大の THICK 倍以上の所を囲み、その厚みの分だけ広げた四角
const bodyOf = async (rel) => {
  const meta = await sharp(path.join(GAME, rel)).metadata();
  const W0 = meta.width, H0 = meta.height;
  const S = Math.min(1, 240 / Math.max(W0, H0));
  const w = Math.max(1, Math.round(W0 * S)), h = Math.max(1, Math.round(H0 * S));
  const { data } = await sharp(path.join(GAME, rel)).ensureAlpha().resize(w, h, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  // ふちまでの近さ(2回なめる chamfer 距離。外は 0)
  const INF = 1e9;
  const d = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = data[i * 4 + 3] > CUT ? INF : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (d[i]) d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414); }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (d[i]) d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414); }
  let max = 0;
  for (let i = 0; i < w * h; i++) if (d[i] > max) max = d[i];
  const r = (v) => Math.round(v * 1000) / 1000;
  if (!(max > 0)) return { w: W0, h: H0, v: [0.5, 0.5, 0, 0, 1, 1] };
  let sx = 0, sy = 0, sw = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = d[y * w + x];
    if (!v) continue;
    const k = v * v; sx += (x + 0.5) * k; sy += (y + 0.5) * k; sw += k;
    if (v >= max * THICK) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const m = max * THICK;
  const c = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return { w: W0, h: H0, v: [r(sx / sw / w), r(sy / sw / h), r(c(x0 - m, 0, w) / w), r(c(y0 - m, 0, h) / h), r(c(x1 + 1 + m, 0, w) / w), r(c(y1 + 1 + m, 0, h) / h)] };
};

const keyOf = (rel) => rel.replace(/^images\//, '');
const blockOf = (entries) => `${BEGIN}\n// 立ち絵の体の範囲 [中心の横, 中心の縦, 体の左, 体の上, 体の右, 体の下(画像に対する割合)]。尻尾・羽など細く伸びた所は入れない。\n`
  + `// キーは images/ の下の道。tools/image/make-art-body-centers.js が作る(手で書かない)\n`
  + `// 使う所: MFバトルカードのキラ・レアキラの立ち絵の光の中心(84-screen-card-battle.jsx の cardKiraBodyOf)\n`
  + `const ART_BODY_CENTERS = {\n${entries.map(([k, v]) => `  ${JSON.stringify(keyOf(k))}: [${v.join(', ')}],`).join('\n')}\n};\n${END}`;

const writeBlock = (text, block) => {
  const a = text.indexOf(BEGIN), b = text.indexOf(END);
  if (a >= 0 && b > a) return text.slice(0, a) + block + text.slice(b + END.length);
  return `${text.replace(/\s*$/, '')}\n${block}\n`;
};

const sheet = async (out, rows) => {
  const T = 180;
  const cols = 10;
  const tiles = [];
  for (const [rel, b] of rows) {
    const img = await sharp(path.join(GAME, rel)).resize(T, T, { fit: 'contain', background: { r: 40, g: 40, b: 60, alpha: 1 } }).png().toBuffer();
    const s = Math.min(T / b.w, T / b.h), ox = (T - b.w * s) / 2, oy = (T - b.h * s) / 2;
    const X = (f) => ox + f * b.w * s, Y = (f) => oy + f * b.h * s;
    const [cx, cy, x0, y0, x1, y1] = b.v;
    const svg = `<svg width="${T}" height="${T + 14}" xmlns="http://www.w3.org/2000/svg"><rect x="${X(x0)}" y="${Y(y0)}" width="${X(x1) - X(x0)}" height="${Y(y1) - Y(y0)}" fill="none" stroke="#0f0" stroke-width="1.5"/>`
      + `<line x1="${X(cx) - 10}" y1="${Y(cy)}" x2="${X(cx) + 10}" y2="${Y(cy)}" stroke="#f0f" stroke-width="3"/><line x1="${X(cx)}" y1="${Y(cy) - 10}" x2="${X(cx)}" y2="${Y(cy) + 10}" stroke="#f0f" stroke-width="3"/>`
      + `<line x1="${T / 2}" y1="0" x2="${T / 2}" y2="${T}" stroke="#ff0" stroke-width="1" stroke-dasharray="3 3"/>`
      + `<text x="3" y="${T + 11}" font-size="10" fill="#fff">${path.basename(rel)}</text></svg>`;
    tiles.push(await sharp({ create: { width: T, height: T + 14, channels: 4, background: '#202030' } }).composite([{ input: img, top: 0, left: 0 }, { input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer());
  }
  const H = T + 14;
  const W = cols * T, HH = Math.ceil(tiles.length / cols) * H;
  await sharp({ create: { width: W, height: HH, channels: 4, background: '#000' } }).composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * T, top: Math.floor(i / cols) * H }))).png().toFile(out);
};

(async () => {
  const files = listFiles();
  const rows = [];
  for (const rel of files) rows.push([rel, await bodyOf(rel)]);
  const si = process.argv.indexOf('--sheet');
  if (si >= 0) {
    const only = process.argv[si + 2] ? new Set(process.argv[si + 2].split(',')) : null;
    await sheet(process.argv[si + 1], only ? rows.filter(([r]) => only.has(path.basename(r))) : rows);
    console.log(`写真: ${process.argv[si + 1]}`);
    return;
  }
  const block = blockOf(rows.map(([rel, b]) => [rel, b.v]));
  const text = fs.readFileSync(IMAGES_ALLY, 'utf8');
  const next = writeBlock(text, block);
  if (process.argv.includes('--check')) {
    if (next !== text) { console.log('NG: data/images/images-ally.js の ART_BODY_CENTERS が今の立ち絵と合っていません(node tools/image/make-art-body-centers.js で作り直す)'); process.exit(1); }
    console.log(`OK: ART_BODY_CENTERS は今の立ち絵と合っている(${rows.length}枚)`);
    return;
  }
  if (next !== text) fs.writeFileSync(IMAGES_ALLY, next);
  console.log(`書き出し: ART_BODY_CENTERS ${rows.length}枚 → data/images/images-ally.js`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
