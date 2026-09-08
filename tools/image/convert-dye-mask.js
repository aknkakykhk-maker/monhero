const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 承認済みの染色マスクPNGを、このリポジトリの染色マスク仕様へ「色だけ」置き換える。
//
//   node image/convert-dye-mask.js <入力PNG> <出力PNG> --map 255,0,0=1 --map 0,220,255=2 --map 255,230,0=3
//   node image/convert-dye-mask.js <入力PNG> <出力PNG> --snap   … 下の判定と同じ読み方で純色へそろえる
//   node image/convert-dye-mask.js ... --dry-run   … 書き出さずに内訳だけ表示する
//
// 【なぜ要るか】
// DEVELOPMENT.md の「9. モンスター画像・円盤石・染色の標準フロー」で、マスクの色は
//   赤 = 染色1 / 緑 = 染色2 / 青 = 染色3 / 透明 = 対象外
// と決めてある(実際に読むのは game-system.jsx の _exactDyeMaskRegion)。
// 染色を4部位・5部位に分けるモンスター(パンドラなど)では、そこへ
//   黄 = 染色4 / マゼンタ = 染色5
// が加わる。_exactDyeMaskRegion はこの5色を拾う。
// ところがユーザー・ChatGPT 側で作った承認済みマスクは、別の色分け(黄・水色など)で
// 届くことがある。そのたびに手で塗り直すとマスクの形が変わってしまうため、
// 「形は1画素も触らず、色の対応だけを差し替える」この道具を通す。
//
// 【--snap は何をするか】
// 届いたマスクが最初から仕様どおりの5色でも、境界のアンチエイリアスや背景の黒が
// そのまま残っていることがある。--snap は _exactDyeMaskRegion とまったく同じ判定で
// 1画素ずつ「どの染色か」を読み、純色(または透明)へ書き直す。
// 判定そのものは本番と同じなので、**どの画素がどの染色になるかは1画素も変わらない**。
// 変わるのはファイルの中身だけで、色数が減るぶん配信サイズが大きく下がる
// (剣士モッチーの実測: 953KB → 35KB)。
//
// 【やらないこと】
//   ・マスクの形・範囲を描き直す、広げる、縮める
//   ・アンチエイリアスを作る(境界をぼかすと _exactDyeMaskRegion の判定から外れる)
//   ・対応表に無い色を勝手にどれかの染色へ寄せる(対象外として透明にし、件数を報告する)
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('../harness');
const { loadImage } = require('canvas');

// _exactDyeMaskRegion が拾える純色。ここ以外の値を書き出すと染色が効かない
const REGION_COLORS = { 1: [255, 0, 0], 2: [0, 255, 0], 3: [0, 0, 255], 4: [255, 255, 0], 5: [255, 0, 255] };
const REGION_IDS = Object.keys(REGION_COLORS).map(Number);
const ALPHA_MIN = 20; // これ未満は透明(=染色対象外)として扱う。読み取り側と同じしきい値

// game-system.jsx の _exactDyeMaskRegion と同じ判定。戻り値は染色番号(1〜5)、対象外は0
const exactRegion = (pixels, offset) => {
  if (pixels[offset + 3] < ALPHA_MIN) return 0;
  const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
  if (r > 200 && g < 80 && b < 80) return 1;
  if (g > 200 && r < 80 && b < 80) return 2;
  if (b > 200 && r < 80 && g < 80) return 3;
  if (r > 200 && g > 200 && b < 80) return 4;
  if (r > 200 && g < 80 && b > 200) return 5;
  return 0;
};

const parseArgs = (argv) => {
  const rest = [], map = new Map();
  let dryRun = false, snap = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') { dryRun = true; continue; }
    if (argv[i] === '--snap') { snap = true; continue; }
    if (argv[i] === '--map') {
      const [from, to] = String(argv[++i] || '').split('=');
      const rgb = String(from || '').split(',').map(Number);
      const region = Number(to);
      if (rgb.length !== 3 || rgb.some(n => !Number.isInteger(n) || n < 0 || n > 255) || !REGION_COLORS[region]) {
        console.error(`NG: --map の書き方が違います: ${argv[i]}（例: --map 255,230,0=3）`);
        process.exit(1);
      }
      map.set(rgb.join(','), region);
      continue;
    }
    rest.push(argv[i]);
  }
  return { input: rest[0], output: rest[1], map, dryRun, snap };
};

const main = async () => {
  const { input, output, map, dryRun, snap } = parseArgs(process.argv.slice(2));
  if (!input || !output || (map.size === 0 && !snap)) {
    console.error('使い方: node image/convert-dye-mask.js <入力PNG> <出力PNG> --map R,G,B=1 ... [--dry-run]');
    console.error('        node image/convert-dye-mask.js <入力PNG> <出力PNG> --snap [--dry-run]');
    process.exit(1);
  }
  if (snap && map.size > 0) { console.error('NG: --snap と --map は同時に使えません'); process.exit(1); }
  const inputPath = path.isAbsolute(input) ? input : path.join(TOOLS_DIR, '..', input);
  const outputPath = path.isAbsolute(output) ? output : path.join(TOOLS_DIR, '..', output);
  if (!fs.existsSync(inputPath)) { console.error(`NG: 入力が見つかりません: ${inputPath}`); process.exit(1); }

  const img = await loadImage(inputPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const d = imageData.data;

  const counts = { transparent: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, dropped: 0 };
  const droppedColors = new Map();
  for (let i = 0; i < img.width * img.height; i++) {
    const o = i * 4;
    if (d[o + 3] < ALPHA_MIN) { d[o] = 0; d[o + 1] = 0; d[o + 2] = 0; d[o + 3] = 0; counts.transparent++; continue; }
    const key = `${d[o]},${d[o + 1]},${d[o + 2]}`;
    const region = snap ? (exactRegion(d, o) || undefined) : map.get(key);
    if (!region) {
      // 対応表に無い色は「染色対象外」として透明にする。どの色がどれだけ落ちたかは必ず報告する
      droppedColors.set(key, (droppedColors.get(key) || 0) + 1);
      d[o] = 0; d[o + 1] = 0; d[o + 2] = 0; d[o + 3] = 0; counts.dropped++;
      continue;
    }
    const [r, g, b] = REGION_COLORS[region];
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    counts[region]++;
  }
  ctx.putImageData(imageData, 0, 0);

  const total = img.width * img.height;
  const pct = (n) => `${(n / total * 100).toFixed(2)}%`;
  console.log(`入力: ${path.relative(path.join(TOOLS_DIR, '..'), inputPath)} (${img.width}x${img.height})`);
  for (const region of REGION_IDS) {
    if (snap && counts[region] === 0) continue; // --snap は部位数を指定しないので、無い部位は出さない
    const from = snap
      ? `rgb(${REGION_COLORS[region].join(',')})`
      : ([...map.entries()].filter(([, r]) => r === region).map(([c]) => c).join(' / ') || '(指定なし)');
    console.log(`  染色${region} ← ${from.padEnd(16)} ${String(counts[region]).padStart(8)}画素 ${pct(counts[region])}`);
  }
  console.log(`  対象外(透明)                      ${String(counts.transparent).padStart(8)}画素 ${pct(counts.transparent)}`);
  if (counts.dropped > 0) {
    console.log(snap
      ? `  ⚠ どの染色にも当たらない色を透明にしました ${String(counts.dropped).padStart(8)}画素 ${pct(counts.dropped)}`
      : `  ⚠ 対応表に無い色を透明にしました   ${String(counts.dropped).padStart(8)}画素 ${pct(counts.dropped)}`);
    [...droppedColors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .forEach(([color, n]) => console.log(`      rgb(${color}) ${n}画素`));
  }
  if (dryRun) { console.log('\n--dry-run のため書き出していません'); return; }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
  console.log(`\n書き出しました: ${path.relative(path.join(TOOLS_DIR, '..'), outputPath)} (${(fs.statSync(outputPath).size / 1024).toFixed(0)}KB)`);
};

main().catch((e) => { console.error(e); process.exit(1); });
