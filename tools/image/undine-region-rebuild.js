const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// ウンディーネの染色マスクを作り直す。
//
//   node image/undine-region-rebuild.js           … 何がどう変わるかを表示するだけ
//   node image/undine-region-rebuild.js --write   … 見本PNGと埋め込みマップを書き換える
//
// 【なぜ要るか】
// 2026-09-11 に image/dye-edge-check が「輪郭の塗り残し 22.89%(上限5%)」で落ちていた。
// 実測で切り分けたところ、原因は解像度ではなく**見本マスクが髪の毛先・腕のヒレ・
// 尾びれのふちを塗っていない**ことだった(見本を原寸で使っても30.18%)。
//
// 【やること】2段階。どちらも何度実行しても結果は同じ。
//   ① 見本(tools/art-sources/dye-masks/undine-dye-mask.PNG)の塗り残しを、
//      いちばん近い部位で埋める。埋める相手は dye-edge-check が塗り残しとして数える画素
//      (彩度0.1以上・明度0.25以上)だけ。白いハイライトと黒い輪郭線は触らない。
//      目(notBbox で「狙って染めない」と宣言した範囲)も埋めない
//   ② 埋めた見本から UNDINE_EXACT_REGION_2BIT(2bit/画素)を作り直して
//      15-dye-and-art.jsx へ書き戻す。縮小はふつうの多数決(同数なら部位を残す)
//
// 実測: 輪郭 22.89%→0.57% / 内側 2.18%→0%。大きさは 256x384 のままなので
// 起動時に読むJSは増えていない(base64で32KB)。
const path = require('path');
const fs = require('fs');
const { decodeDataUrl, artSourcePath, createCanvas, loadEmbeddedImages, imageForBaseId, loadDyeModule, REPO_ROOT } = require(path.join(TOOLS_DIR, 'harness.js'));

const WRITE = process.argv.includes('--write');
const REF_PATH = artSourcePath('dye-masks', 'undine-dye-mask.PNG');
const SRC_PATH = path.join(REPO_ROOT, 'monster-hero', 'src', 'parts', '15-dye-and-art.jsx');
const MAP_W = 256, MAP_H = 384;   // 埋め込みマップの大きさ(いまの値と同じ)
const PURE = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const regionOf = (d, o) => {
  const r = d[o], g = d[o + 1], b = d[o + 2], a = d[o + 3];
  if (a < 20) return -1;
  if (r > 200 && g < 80 && b < 80) return 0;
  if (g > 200 && r < 80 && b < 80) return 1;
  if (b > 200 && r < 80 && g < 80) return 2;
  return -1;
};

(async () => {
  const dye = loadDyeModule();
  const art = await decodeDataUrl(imageForBaseId('Undine', loadEmbeddedImages()));
  const ref = await decodeDataUrl(REF_PATH);
  const n = art.width, nh = art.height;
  const ad = (() => {
    const c = createCanvas(n, nh), g = c.getContext('2d');
    g.drawImage(art, 0, 0);
    return g.getImageData(0, 0, n, nh).data;
  })();
  const rc = createCanvas(n, nh), rg = rc.getContext('2d');
  rg.imageSmoothingEnabled = false;
  rg.drawImage(ref, 0, 0, n, nh);
  const refImage = rg.getImageData(0, 0, n, nh), rd = refImage.data;

  // 「狙って染めない」と宣言した範囲(目)は埋めない
  const hues = dye.MASU_COLOR_REGION_HUES.Undine || [];
  const skip = hues.flatMap((def) => (Array.isArray(def) ? def : [def])
    .flatMap((a) => (a && a.notBbox) ? (Array.isArray(a.notBbox[0]) ? a.notBbox : [a.notBbox]) : []));
  const isSkipped = (x, y) => skip.some(([x0, y0, x1, y1]) => {
    const nx = x / n, ny = y / nh;
    return nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1;
  });

  // ① 塗り残しをいちばん近い部位で埋める
  const want = new Uint8Array(n * nh);
  const region = new Int8Array(n * nh).fill(-1);
  for (let p = 0; p < n * nh; p++) {
    if (ad[p * 4 + 3] < 32) continue;
    region[p] = regionOf(rd, p * 4);
    const r = ad[p * 4], g = ad[p * 4 + 1], b = ad[p * 4 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const s = mx === 0 ? 0 : (mx - mn) / mx, v = mx / 255;
    if (s < 0.1 || v < 0.25) continue;              // 白いハイライト・黒い輪郭線は触らない
    const x = p % n, y = (p / n) | 0;
    if (skip.length && isSkipped(x, y)) continue;   // 目は埋めない
    want[p] = 1;
  }
  let front = [];
  for (let p = 0; p < n * nh; p++) if (region[p] >= 0) front.push(p);
  let filled = 0, rounds = 0;
  while (front.length && rounds < 4000) {
    const next = [];
    for (const i of front) {
      const x = i % n, y = (i / n) | 0;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= nh) continue;
        const j = ny * n + nx;
        if (region[j] < 0 && want[j]) { region[j] = region[i]; next.push(j); filled++; }
      }
    }
    front = next; rounds++;
  }
  for (let p = 0; p < n * nh; p++) {
    const o = p * 4;
    if (region[p] < 0) {
      if (regionOf(rd, o) >= 0) { rd[o] = 0; rd[o + 1] = 0; rd[o + 2] = 0; rd[o + 3] = 0; }
      continue;
    }
    const c = PURE[region[p]];
    rd[o] = c[0]; rd[o + 1] = c[1]; rd[o + 2] = c[2]; rd[o + 3] = 255;
  }
  rg.putImageData(refImage, 0, 0);

  // ② 埋めた見本から2bitのマップを作る(0/1/2=染色1/2/3・3=対象外)
  const bytes = new Uint8Array(Math.ceil(MAP_W * MAP_H / 4));
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const x0 = Math.floor(x * n / MAP_W), x1 = Math.max(x0 + 1, Math.floor((x + 1) * n / MAP_W));
    const y0 = Math.floor(y * nh / MAP_H), y1 = Math.max(y0 + 1, Math.floor((y + 1) * nh / MAP_H));
    const tally = [0, 0, 0, 0];
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const r = regionOf(rd, (yy * n + xx) * 4);
      tally[r < 0 ? 3 : r]++;
    }
    let v = 0;                                   // ふつうの多数決。同数なら部位を残す
    for (let k = 1; k < 4; k++) if (tally[k] > tally[v]) v = k;
    const i = y * MAP_W + x;
    bytes[i >> 2] |= (v & 3) << ((i & 3) * 2);
  }
  const base64 = Buffer.from(bytes).toString('base64');

  console.log(`元絵 ${n}x${nh} / 見本 ${ref.width}x${ref.height}`);
  console.log(`埋めた画素 ${filled}(広げた回数 ${rounds})`);
  console.log(`埋め込みマップ ${MAP_W}x${MAP_H} → ${bytes.length}バイト / base64 ${base64.length}文字`);
  if (!WRITE) { console.log('(--write を付けると書き換えます)'); return; }

  fs.writeFileSync(REF_PATH, rc.toBuffer('image/png'));
  let source = fs.readFileSync(SRC_PATH, 'utf8');
  const sizeRe = /const UNDINE_EXACT_REGION_SIZE = \[\d+, ?\d+\];/;
  const dataRe = /const UNDINE_EXACT_REGION_2BIT = "[^"]*";/;
  if (!sizeRe.test(source) || !dataRe.test(source)) throw new Error('UNDINE_EXACT_REGION_* が見つかりません');
  source = source.replace(sizeRe, `const UNDINE_EXACT_REGION_SIZE = [${MAP_W}, ${MAP_H}];`)
    .replace(dataRe, `const UNDINE_EXACT_REGION_2BIT = "${base64}";`);
  fs.writeFileSync(SRC_PATH, source);
  console.log('見本PNGと 15-dye-and-art.jsx を書き換えました');
  console.log('このあと node tools/build.js を通すこと');
})().catch((e) => { console.error(e); process.exit(1); });
