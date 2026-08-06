// 受け取ったモンスターのイラストを、ゲームで使う形(正方形・余白そろえ・透過)へ整えて
// monster-hero/images/monsters/ へ書き出す。
//
//   node import-monster-art.js <元画像> <モンスターID> [--size 1024] [--margin 0.06] [--dry-run]
//   例) node import-monster-art.js ../monster-hero/images/monsters/ark.PNG Ark
//
// 【なぜ道具にするか】
// 受け取る絵は縦横比も余白もばらばらで、書き出しツールの都合で画面のふちに
// 1pxの薄い枠が残っていることもある。そのままゲームへ入れると
//   ・横長のまま丸いアイコンに入れると左右が切れる
//   ・ふちの枠が丸枠の内側に線として出る
//   ・モンスターごとに大きさがまちまちで、並べたとき頭身がそろわない
// といったことが起きる。ここで機械的に整えることで、絵を差し替えるたびに
// 同じ品質へそろえられる。
//
// やること
//   ① 実際に絵が写っている範囲(不透明な画素の外接矩形)を測る
//   ② その中心を保ったまま正方形へ広げ、指定した余白を足す
//   ③ 指定サイズへ縮小し、透明部分の色にじみが出ないよう補間して書き出す
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const REPO_ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    if (key === 'dry-run') { flags[key] = true; continue; }
    flags[key] = args[++i];
  } else positional.push(args[i]);
}
const [srcPath, monsterId] = positional;
if (!srcPath || !monsterId) {
  console.log('使い方: node import-monster-art.js <元画像> <モンスターID> [--size 1024] [--margin 0.06] [--dry-run]');
  process.exit(1);
}
const SIZE = Math.max(64, Math.floor(Number(flags.size) || 1024));
const MARGIN = Math.max(0, Math.min(0.4, Number(flags.margin ?? 0.06)));
// 薄い枠やにじみを「絵の範囲」に含めないための足切り
const ALPHA_FLOOR = 32;

(async () => {
  const img = await loadImage(path.isAbsolute(srcPath) ? srcPath : path.join(process.cwd(), srcPath));
  const cv = createCanvas(img.width, img.height);
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;

  // ①-0 書き出しツールが残した「画面のふちの枠線」を先に消す。
  // 外周の数pxだけが薄く残っているケースで、これを絵の一部と数えてしまうと
  // 切り取り範囲が画像全体になり、被写体が小さく写ってしまう。
  // 枠線は「はしから数%以内にある、端から端まで埋まった1本の行/列」として現れるので、
  // 太さや位置を決め打ちせず、その条件に当てはまる行/列だけを消す
  // (実際、外周から2px内側に縦線が引かれている絵があった)。
  const rowOpaque = (y) => { let n = 0; for (let x = 0; x < img.width; x++) if (data[(y * img.width + x) * 4 + 3] >= ALPHA_FLOOR) n++; return n; };
  const colOpaque = (x) => { let n = 0; for (let y = 0; y < img.height; y++) if (data[(y * img.width + x) * 4 + 3] >= ALPHA_FLOOR) n++; return n; };
  const clearRow = (y) => { for (let x = 0; x < img.width; x++) data[(y * img.width + x) * 4 + 3] = 0; };
  const clearCol = (x) => { for (let y = 0; y < img.height; y++) data[(y * img.width + x) * 4 + 3] = 0; };
  const edgeBand = Math.max(4, Math.round(Math.min(img.width, img.height) * 0.02));
  let frameLines = 0;
  for (let i = 0; i < edgeBand; i++) {
    for (const y of [i, img.height - 1 - i]) if (rowOpaque(y) > img.width * 0.9) { clearRow(y); frameLines++; }
    for (const x of [i, img.width - 1 - i]) if (colOpaque(x) > img.height * 0.9) { clearCol(x); frameLines++; }
  }
  if (frameLines > 0) {
    const cleaned = ctx.createImageData(img.width, img.height);
    cleaned.data.set(data);
    ctx.putImageData(cleaned, 0, 0);
    console.log(`画面のふちの枠線を${frameLines}本 消しました`);
  }

  // ① 絵が写っている範囲を測る
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (data[(y * img.width + x) * 4 + 3] < ALPHA_FLOOR) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) { console.log('NG: 不透明な画素がありません'); process.exit(1); }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;

  // ② 中心を保ったまま正方形へ広げ、余白を足す
  const cx = x0 + bw / 2, cy = y0 + bh / 2;
  const side = Math.max(bw, bh) * (1 + MARGIN * 2);
  const sx = cx - side / 2, sy = cy - side / 2;

  console.log(`元画像 ${img.width}x${img.height} / 絵の範囲 ${bw}x${bh} (${x0},${y0}) → 正方形 ${Math.round(side)}px を ${SIZE}px へ`);
  if (flags['dry-run']) { console.log('--dry-run のため書き出していません'); return; }

  // ③ 書き出し。切り取り範囲が元画像からはみ出す分は透明のまま残る
  const out = createCanvas(SIZE, SIZE);
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(cv, sx, sy, side, side, 0, 0, SIZE, SIZE);
  // 縮小でごく薄く残った画素は、丸いアイコンのふちで灰色の線に見えるため落とす
  const od = octx.getImageData(0, 0, SIZE, SIZE);
  let cleared = 0;
  for (let i = 3; i < od.data.length; i += 4) {
    if (od.data[i] > 0 && od.data[i] < 8) { od.data[i] = 0; cleared++; }
  }
  octx.putImageData(od, 0, 0);

  const destRel = `images/monsters/${monsterId.toLowerCase()}.png`;
  const dest = path.join(REPO_ROOT, 'monster-hero', destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out.toBuffer('image/png'));
  console.log(`書き出しました: ${destRel} (${(fs.statSync(dest).size / 1024).toFixed(0)}KB) / ごく薄い画素を${cleared}個消しました`);
})().catch((e) => { console.error(e); process.exit(1); });
