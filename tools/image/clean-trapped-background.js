const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 装飾の入り組んだ隙間に取り残された「背景の白」だけを透過する。
//
//   node image/clean-trapped-background.js images/monsters/pandora.PNG --dry-run
//   node image/clean-trapped-background.js images/monsters/pandora.PNG
//   node image/clean-trapped-background.js <PNG> --max-area 800 --sat 0.35
//
// 【なぜ要るか】
// 白い背景の上に描かれた絵が届くことがある。外周から白をたどって消す方法
// (image/make-disc-icon-transparent.js)は輪郭のはっきりした大きな背景には効くが、
// 星形の飾りの凹みのように「細い入口でしか外とつながっていない隙間」は消し残る。
// 実際にパンドラの頭上の輪(星のリング)で、星の凹み3か所に白い塊が残っていて、
// 市松模様の上に置くと白い欠けとして見えていた。
//
// 【どう見分けるか】
// 消してよい白(背景の残り)と、消してはいけない白(髪や翼のハイライト)は、
// 「何に囲まれているか」で分かれる。実測すると
//   輪の金色 … 彩度 0.56〜0.61
//   髪       … 彩度 0.06〜0.14
// と大きく離れるので、「彩度の高い装飾に十分囲まれている白の塊」だけを背景とみなす。
// 髪のハイライトは髪(低彩度)にしか囲まれていないので残る。
//
// ただし白と金の境目にはアンチエイリアスの中間色(薄い金＝彩度が低い)が1〜3px入るため、
// 「隣り合う1画素」だけを見ると装飾に接していないことになってしまう(実測で装飾率5%)。
// 塊のまわり RING_RADIUS 画素までを見て、そこに装飾色がどれだけあるかで判断する。
//
// 【やらないこと】
//   ・外からたどり着けない白(完全に閉じた内側)には触れない
//   ・半端な不透明度を作らない(透明にするか、そのまま残すかの2択)
//   ・面積の大きい塊には触れない(--max-area。ハイライトを丸ごと消す事故を防ぐ)
const fs = require('fs');
const path = require('path');
const { createCanvas, REPO_ROOT } = require('../harness');
const { loadImage } = require('canvas');

const WEB_ROOT = path.join(REPO_ROOT, 'monster-hero');
// 「白っぽい」とみなす条件。背景の白は真っ白に近く、彩度がほぼ無い
const WHITE_MIN = 226;   // RGBの最小値がこれより上
const WHITE_SPREAD = 18; // RGBの最大値と最小値の差がこれ未満
const ALPHA_MIN = 20;    // これ未満は透明とみなす
// 塊のまわり何画素までを「囲んでいる色」として見るか。
// 白と装飾の境目に入るアンチエイリアスの中間色を跨げる幅にする
const RING_RADIUS = 4;

const hsvSat = (r, g, b) => { const mx = Math.max(r, g, b); return mx ? (mx - Math.min(r, g, b)) / mx : 0; };

const parseArgs = (argv) => {
  const rest = [];
  let dryRun = false, maxArea = 800, sat = 0.35, touch = 0.15;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') { dryRun = true; continue; }
    if (argv[i] === '--max-area') { maxArea = Number(argv[++i]); continue; }
    if (argv[i] === '--sat') { sat = Number(argv[++i]); continue; }
    if (argv[i] === '--touch') { touch = Number(argv[++i]); continue; }
    rest.push(argv[i]);
  }
  return { input: rest[0], dryRun, maxArea, sat, touch };
};

const main = async () => {
  const { input, dryRun, maxArea, sat, touch } = parseArgs(process.argv.slice(2));
  if (!input || !Number.isFinite(maxArea) || !Number.isFinite(sat) || !Number.isFinite(touch)) {
    console.error('使い方: node image/clean-trapped-background.js <PNG> [--max-area N] [--sat 0.35] [--touch 0.15] [--dry-run]');
    process.exit(1);
  }
  const file = path.isAbsolute(input) ? input : path.join(WEB_ROOT, input);
  if (!fs.existsSync(file)) { console.error(`NG: 画像が見つかりません: ${file}`); process.exit(1); }

  const img = await loadImage(file);
  const W = img.width, H = img.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, W, H);
  const d = imageData.data;

  const isWhite = (o) => {
    const r = d[o], g = d[o + 1], b = d[o + 2];
    return Math.min(r, g, b) > WHITE_MIN && (Math.max(r, g, b) - Math.min(r, g, b)) < WHITE_SPREAD;
  };

  // ① 画像の外周から「透明 or 白っぽい」だけをたどる。
  //    外からたどり着けた白＝背景とつながっている白の候補
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x); stack.push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { stack.push(y * W); stack.push(y * W + W - 1); }
  while (stack.length) {
    const i = stack.pop();
    if (i < 0 || i >= W * H || seen[i]) continue;
    const o = i * 4;
    if (!(d[o + 3] < ALPHA_MIN || isWhite(o))) continue;
    seen[i] = 1;
    const x = i % W, y = (i - x) / W;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }

  // ② たどり着けた不透明な白を塊(連結成分)に分け、塊ごとに「何に接しているか」を数える
  const label = new Int32Array(W * H).fill(-1);
  const comps = [];
  for (let start = 0; start < W * H; start++) {
    if (label[start] >= 0 || !seen[start] || d[start * 4 + 3] < ALPHA_MIN) continue;
    const id = comps.length;
    const st = [start];
    label[start] = id;
    const pixels = [];
    let minx = W, maxx = -1, miny = H, maxy = -1;
    while (st.length) {
      const i = st.pop();
      pixels.push(i);
      const x = i % W, y = (i - x) / W;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx, o = j * 4;
        if (seen[j] && d[o + 3] >= ALPHA_MIN) { if (label[j] < 0) { label[j] = id; st.push(j); } continue; }
      }
    }
    // 塊のまわり RING_RADIUS 画素の枠を見て、「囲んでいる色」を数える。
    // 隣接1画素だけだとアンチエイリアスの中間色しか拾えない
    const own = new Set(pixels);
    let decor = 0, plain = 0;
    for (let y = Math.max(0, miny - RING_RADIUS); y <= Math.min(H - 1, maxy + RING_RADIUS); y++) {
      for (let x = Math.max(0, minx - RING_RADIUS); x <= Math.min(W - 1, maxx + RING_RADIUS); x++) {
        const j = y * W + x;
        if (own.has(j)) continue;
        const o = j * 4;
        if (d[o + 3] < ALPHA_MIN) continue;   // 透明は「囲んでいる色」に数えない
        if (seen[j]) continue;                // 同じ背景つながりの白も数えない
        if (hsvSat(d[o], d[o + 1], d[o + 2]) >= sat) decor++; else plain++;
      }
    }
    const around = decor + plain;
    comps.push({ id, pixels, n: pixels.length, box: [minx, miny, maxx, maxy], decor, plain,
      ratio: around ? decor / around : 0 });
  }

  // ③ 「彩度の高い装飾に十分囲まれていて、小さい塊」だけを背景の残りとみなす
  const targets = comps.filter(c => c.n <= maxArea && c.ratio >= touch);
  const kept = comps.filter(c => !targets.includes(c));
  comps.sort((a, b) => b.n - a.n);
  console.log(`${input} (${W}x${H})`);
  console.log(`外からたどり着けた白の塊: ${comps.length}個 / 合計${comps.reduce((s, c) => s + c.n, 0)}px`);
  console.log(`判定: 面積${maxArea}px以下 かつ まわり${RING_RADIUS}px の${(touch * 100).toFixed(0)}%以上が彩度${sat}以上`);
  for (const c of comps.slice(0, 12)) {
    const hit = targets.includes(c);
    console.log(`  ${hit ? '透過する' : 'そのまま'} 面積${String(c.n).padStart(5)} 範囲${c.box.join(',')}`
      + ` まわり=装飾${c.decor}/その他${c.plain} (装飾率${(c.ratio * 100).toFixed(0)}%)`);
  }
  const removed = targets.reduce((s, c) => s + c.n, 0);
  console.log(`\n透過する: ${targets.length}個 / ${removed}px`);
  console.log(`そのまま残す: ${kept.length}個 / ${kept.reduce((s, c) => s + c.n, 0)}px`);
  if (dryRun) { console.log('\n--dry-run のため書き換えていません'); return; }
  if (!removed) { console.log('\n透過するものがないので書き換えていません'); return; }

  for (const c of targets) for (const i of c.pixels) {
    const o = i * 4;
    d[o] = 0; d[o + 1] = 0; d[o + 2] = 0; d[o + 3] = 0;
  }
  ctx.putImageData(imageData, 0, 0);
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
  console.log(`\n書き換えました: ${input} (${(fs.statSync(file).size / 1024).toFixed(0)}KB)`);
  console.log('※ このあと node tools/build.js でキャッシュキーを更新すること');
};

main().catch((e) => { console.error(e); process.exit(1); });
