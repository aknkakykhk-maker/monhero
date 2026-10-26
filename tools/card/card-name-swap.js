// モンスターカードの下の名前の欄で、2つの字を入れ替える(2026-10-27 カード部パックくん)
//   社長の決定で種族の名前を「ケンタウロス」にそろえた。C-049・C-049S(キラ)の絵には「ケンタロウス」と刷ってあり、
//   違いは「ロ」と「ウ」の並びだけなので、絵に刷ってある字そのものを入れ替える(字の太さ・ふち・影が元のカードとまったく同じになる)。
//
//   node tools/card/card-name-swap.js           … 書き出す(tools/art-sources/card-battle-ja/<同じ名前>.jpg)
//   node tools/card/card-name-swap.js --out <フォルダ>  … 見本だけ別の所へ
//   そのあと node tools/card/card-image-build.js --build(card-battle-ja に同じ名前の絵があれば、元の絵の代わりに使う)
//
// やり方(座標は 742×1038 の元の絵の上)
//   ① 字の所 = 欄の地(緑)でない点。白い字・黒いふち・右下の影をまとめて拾う
//   ② 2つの字の所を消す: 欄の地は縦の木目なので、同じ列の上下の地の色をつないで埋める
//   ③ 字を、もう一方の字の場所へずらして置く。キラは字が左から右へ虹色に変わるので、置いた先の色に合わせて塗り直す
//   元の絵(tools/art-sources/card-battle/)は変えない
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const sharp = require(path.join(ROOT, 'tools', 'node_modules', 'sharp'));
const SRC = path.join(ROOT, 'tools', 'art-sources', 'card-battle');
const JA = path.join(ROOT, 'tools', 'art-sources', 'card-battle-ja');

// 入れ替える2つの字の列の範囲 [左, 右](ふちと影を含む)と、上下の範囲。名前の字は 33px おきに並んでいる
const SWAPS = [
  { file: 'centaur/C-049.jpg', a: [138, 170], b: [171, 203], y: [916, 966], name: 'ケンタロウス → ケンタウロス' },
  { file: 'centaur/C-049S.jpg', a: [138, 170], b: [171, 203], y: [916, 966], name: 'ケンタロウス → ケンタウロス(キラ)', rainbow: true },
];

const W = 742;
// 欄の地(緑)かどうか。白い字・黒いふち・影は緑みが少ない
const isGround = (r, g, b) => g - Math.max(r, b) > 22 && g > 50;

const swap = async ({ file, a, b, y: [yt, yb], rainbow }, outDir) => {
  const { data, info } = await sharp(path.join(SRC, file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const px = (x, y) => (y * W + x) * ch;
  const src = Buffer.from(data);
  const shift = a[0] - b[0];   // b の字を a へ動かす量(a の字は -shift)
  // ① 字の所(ふちの外側の1点まで広げる)
  const raw = (x, y) => { const i = px(x, y); return !isGround(src[i], src[i + 1], src[i + 2]); };
  const mask = new Map();
  for (const [x0, x1] of [a, b]) for (let y = yt; y <= yb; y++) for (let x = x0; x <= x1; x++) {
    let hit = false;
    for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1 && !hit; dx++) hit = raw(x + dx, y + dy);
    if (hit) mask.set(`${x},${y}`, true);
  }
  const inMask = (x, y) => mask.has(`${x},${y}`);
  // 字の明るい所の色(列ごと)。キラの虹色を、置いた先の列の色へ塗り直すのに使う
  const tint = [];
  for (let x = 40; x < 240; x++) {
    let s = [0, 0, 0], n = 0;
    for (let y = yt; y <= yb; y++) { const i = px(x, y); const l = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]; if (l > 150 && !isGround(src[i], src[i + 1], src[i + 2])) { s = s.map((v, c) => v + src[i + c]); n++; } }
    tint[x] = n ? s.map((v) => v / n) : null;
  }
  // となり ±6 列をならす(JPEG のむらで縦すじが出ないように)
  const tintAt = (x) => {
    let s = [0, 0, 0], n = 0;
    for (let d = -6; d <= 6; d++) if (tint[x + d]) { s = s.map((v, c) => v + tint[x + d][c]); n++; }
    return n ? s.map((v) => v / n) : [255, 255, 255];
  };
  // ② 消す: 同じ列で、上と下のいちばん近い地の色をつなぐ
  for (const [x0, x1] of [a, b]) for (let x = x0; x <= x1; x++) {
    for (let y = yt; y <= yb; y++) {
      if (!inMask(x, y)) continue;
      let u = y; while (u > yt - 20 && inMask(x, u)) u--;
      let d = y; while (d < yb + 20 && inMask(x, d)) d++;
      const t = (y - u) / (d - u), iu = px(x, u), id = px(x, d), i = px(x, y);
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(src[iu + c] * (1 - t) + src[id + c] * t);
    }
  }
  // ③ 置く: 字の点(地でない点だけ。広げた1点ぶんは置かない)を相手の場所へ。キラは、色を置いた先の列の字の色に合わせる
  const put = ([x0, x1], dx) => {
    for (let y = yt; y <= yb; y++) for (let x = x0; x <= x1; x++) {
      if (!raw(x, y)) continue;
      const tx = x + dx, i = px(x, y), j = px(tx, y);
      const from = rainbow ? tintAt(x) : [1, 1, 1], to = rainbow ? tintAt(tx) : [1, 1, 1];
      for (let c = 0; c < 3; c++) data[j + c] = Math.max(0, Math.min(255, Math.round(src[i + c] * (to[c] / Math.max(1, from[c])))));
    }
  };
  put(b, shift);
  put(a, -shift);
  const out = path.join(outDir, path.basename(file));
  await sharp(data, { raw: { width: W, height: info.height, channels: ch } }).jpeg({ quality: 95 }).toFile(out);
  return out;
};

(async () => {
  const k = process.argv.indexOf('--out');
  const outDir = k > 0 ? process.argv[k + 1] : JA;
  fs.mkdirSync(outDir, { recursive: true });
  for (const s of SWAPS) console.log(`書き出し: ${path.relative(ROOT, await swap(s, outDir))}(${s.name})`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
