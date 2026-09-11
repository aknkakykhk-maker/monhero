const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// モッチーの正式マスク(images/monsters/mocchi-dye-mask.PNG)から「目」を染色対象外にする。
//
//   node image/mocchi-eye-unmask.js           … 何を外すかを表示するだけ(書き換えない)
//   node image/mocchi-eye-unmask.js --write   … マスクPNGを書き換える
//
// 【なぜ要るか】
// 2026-09-11 にユーザーから「モッチーの目が染色範囲に入っていて、白などで染めると
// 目が薄くなる」と指摘があった。実際、目(瞳と中の白いハイライト)が丸ごと染色①(体)に
// 入っていたため、体の色を変えると瞳まで一緒に染まっていた。
//
// 【目の決め方】
// 位置を手で書き写すと絵を差し替えたときに合わなくなるので、元絵から機械的に決める。
//   ① 明度0.55未満の画素を集めて連結成分に分ける
//   ② いちばん大きい2つを目とする(左右の高さと面積が釣り合わなければ止める)
//   ③ その輪郭の内側にある穴(白いハイライト)を埋める
//   ④ 輪郭のアンチエイリアスぶん、外へ3px広げる
// 何度実行しても結果は同じ(すでに透明な画素は触らない)。
//
// 【あわせて要ること】
// 外した範囲は image/dye-edge-check の「内側の塗り残し」に数えられてしまうので、
// 15-dye-and-art.jsx の MOCCHI_EYE_BOXES を notBbox として宣言してある
// (「狙って染めない範囲」の宣言。ウンディーネの UNDINE_EYE_BOXES と同じ役目)。
const path = require('path');
const fs = require('fs');
const { decodeDataUrl, createCanvas, loadEmbeddedImages, imageForBaseId, REPO_ROOT } = require(path.join(TOOLS_DIR, 'harness.js'));

const WRITE = process.argv.includes('--write');
const MASK_REL = 'images/monsters/mocchi-dye-mask.PNG';
const MASK_PATH = path.join(REPO_ROOT, 'monster-hero', MASK_REL);
const DARK_V_MAX = 0.55; // これより暗い画素を「目の候補」とする
const GROW = 3;          // 輪郭のアンチエイリアスぶん外へ広げる画素数

const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];

(async () => {
  const art = await decodeDataUrl(imageForBaseId('Mocchi', loadEmbeddedImages()));
  const n = art.width, nh = art.height;
  const ad = (() => {
    const c = createCanvas(n, nh), g = c.getContext('2d');
    g.drawImage(art, 0, 0);
    return g.getImageData(0, 0, n, nh).data;
  })();

  // ① 暗い画素を連結成分に分ける
  const dark = new Uint8Array(n * nh);
  for (let p = 0; p < n * nh; p++) {
    if (ad[p * 4 + 3] < 32) continue;
    if (Math.max(ad[p * 4], ad[p * 4 + 1], ad[p * 4 + 2]) / 255 < DARK_V_MAX) dark[p] = 1;
  }
  const label = new Int32Array(n * nh).fill(-1);
  const comps = [];
  for (let s = 0; s < n * nh; s++) {
    if (!dark[s] || label[s] >= 0) continue;
    const id = comps.length, queue = [s];
    label[s] = id;
    let count = 0, minx = n, miny = nh, maxx = 0, maxy = 0;
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k], x = i % n, y = (i / n) | 0;
      count++;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= nh) continue;
        const j = ny * n + nx;
        if (dark[j] && label[j] < 0) { label[j] = id; queue.push(j); }
      }
    }
    comps.push({ id, count, minx, miny, maxx, maxy });
  }
  comps.sort((a, b) => b.count - a.count);
  const eyes = comps.slice(0, 2);

  // ② 左右の目として釣り合っているかを確かめる(絵を差し替えたときの誤爆よけ)
  if (eyes.length < 2) throw new Error('暗い塊が2つ見つかりませんでした');
  if (Math.abs(eyes[0].miny - eyes[1].miny) > nh * 0.02 || Math.abs(eyes[0].count - eyes[1].count) > eyes[0].count * 0.25) {
    throw new Error(`左右の目として釣り合わない塊を拾いました: ${JSON.stringify(eyes)}`);
  }

  const eye = new Uint8Array(n * nh);
  for (let p = 0; p < n * nh; p++) if (label[p] === eyes[0].id || label[p] === eyes[1].id) eye[p] = 1;

  // ③ 輪郭の内側の穴(白いハイライト)を埋める
  for (const e of eyes) {
    const x0 = Math.max(0, e.minx - 1), y0 = Math.max(0, e.miny - 1);
    const x1 = Math.min(n - 1, e.maxx + 1), y1 = Math.min(nh - 1, e.maxy + 1);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const outside = new Uint8Array(w * h), queue = [];
    const add = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = y * w + x;
      if (outside[i] || eye[(y + y0) * n + (x + x0)]) return;
      outside[i] = 1; queue.push([x, y]);
    };
    for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
    for (let y = 0; y < h; y++) { add(0, y); add(w - 1, y); }
    for (let k = 0; k < queue.length; k++) {
      const [x, y] = queue[k];
      for (const [dx, dy] of neighbors) add(x + dx, y + dy);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!outside[y * w + x]) eye[(y + y0) * n + (x + x0)] = 1;
  }

  // ④ アンチエイリアスぶん外へ広げる
  for (let step = 0; step < GROW; step++) {
    const grow = [];
    for (let p = 0; p < n * nh; p++) {
      if (!eye[p]) continue;
      const x = p % n, y = (p / n) | 0;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= nh) continue;
        const j = ny * n + nx;
        if (!eye[j]) grow.push(j);
      }
    }
    for (const j of grow) eye[j] = 1;
  }
  let eyeCount = 0;
  for (let p = 0; p < n * nh; p++) if (eye[p]) eyeCount++;

  // ⑤ マスクPNGのその範囲を透明にする
  const mask = await decodeDataUrl(MASK_REL);
  const mw = mask.width, mh = mask.height;
  const mc = createCanvas(mw, mh), mg = mc.getContext('2d');
  mg.imageSmoothingEnabled = false;
  mg.drawImage(mask, 0, 0);
  const image = mg.getImageData(0, 0, mw, mh), md = image.data;
  let cleared = 0;
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const sx = Math.min(n - 1, Math.floor((x + 0.5) * n / mw));
    const sy = Math.min(nh - 1, Math.floor((y + 0.5) * nh / mh));
    if (!eye[sy * n + sx]) continue;
    const o = (y * mw + x) * 4;
    if (md[o + 3] === 0) continue;
    md[o] = 0; md[o + 1] = 0; md[o + 2] = 0; md[o + 3] = 0;
    cleared++;
  }
  mg.putImageData(image, 0, 0);

  const box = (e) => `x ${(e.minx / n).toFixed(3)}-${(e.maxx / n).toFixed(3)} / y ${(e.miny / nh).toFixed(3)}-${(e.maxy / nh).toFixed(3)}`;
  console.log(`元絵 ${n}x${nh} / マスク ${mw}x${mh}`);
  console.log(`目として外す範囲 ${eyeCount}px(元絵の${(eyeCount / (n * nh) * 100).toFixed(2)}%)`);
  console.log(`  ${box(eyes[1])}`);
  console.log(`  ${box(eyes[0])}`);
  console.log(`マスクで透明にする画素 ${cleared}`);
  if (WRITE) {
    fs.writeFileSync(MASK_PATH, mc.toBuffer('image/png'));
    console.log(`書き換えました: monster-hero/${MASK_REL}`);
    console.log('このあと node tools/build.js でキャッシュキーを更新すること');
  } else {
    console.log('(--write を付けると書き換えます)');
  }
})().catch((e) => { console.error(e); process.exit(1); });
