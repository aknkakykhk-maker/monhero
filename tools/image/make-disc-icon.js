const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// モンスターの立ち絵を、全モンスター共通の円盤石の土台へ重ねて円盤石アイコンを作る。
//
//   node image/make-disc-icon.js images/monsters/kenshi-mocchi.png images/disc-icons/kenshi-mocchi-disc.PNG
//   node image/make-disc-icon.js <立ち絵> <出力> --fit 0.86   … キャラの大きさを変える(既定0.90)
//   node image/make-disc-icon.js <立ち絵> <出力> --y -0.03    … キャラの縦位置をずらす(枠に対する割合)
//   node image/make-disc-icon.js <立ち絵> <出力> --dry-run    … 書き出さず、測った値だけ出す
//
// 【なぜ道具にするか】
// data/breeder.js の BREEDER_MARKET_ITEMS 手前に「円盤石のiconは必ずDISC_STONE_BASEを土台にして、
// その上に全身を重ねて作る。他モンスターとキャラの縦位置(センタリング)が揃うように配置する」と
// 決めてあるが、その「揃える」を毎回手で合わせていた。DEVELOPMENT.md「同じ種類のものは、
// 絵ごとに手で合わせず『計算で』そろえる」のとおり、位置と倍率は測って決める。
//
// 【どう揃えるか】
//   ① 土台画像(1536x1024)から円盤の実体(透明でない範囲)を測り、正方形の枠いっぱいに置く
//   ② 立ち絵からも透明でない範囲を測り、その長辺が枠の --fit 倍になる倍率で中央へ置く
// どちらも「透明な余白を除いた実体」を基準にするので、元絵の余白の量が違っても同じ収まりになる。
//
// 【やらないこと】
//   ・土台の模様を消す・塗りつぶす(breeder.js の決まり)
//   ・立ち絵の縦横比を変える(倍率は縦横とも同じ)
//   ・出力の減色(配信前に node image/compress-images.js --write を通すこと)
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('../harness');
const { loadImage } = require('canvas');

const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
const WEB_ROOT = path.join(REPO_ROOT, 'monster-hero');
const BASE_REL = 'images/disc-icons/disc-stone-base.PNG';
// 出来上がりの一辺(px)。既存の円盤石(パンドラ1254x1254・エイキ1261x1247)と同じ大きさにそろえる
const SIZE = 1254;
const ALPHA_MIN = 16; // これ未満は「何も描かれていない」とみなす

const resolveRel = (rel) => (path.isAbsolute(rel) ? rel : path.join(WEB_ROOT, String(rel).split('?')[0]));

// 透明な余白を除いた「絵が本当にある範囲」を測る
const opaqueBounds = async (file) => {
  const img = await loadImage(file);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  let x1 = img.width, y1 = img.height, x2 = -1, y2 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (d[(y * img.width + x) * 4 + 3] < ALPHA_MIN) continue;
    if (x < x1) x1 = x; if (x > x2) x2 = x;
    if (y < y1) y1 = y; if (y > y2) y2 = y;
  }
  if (x2 < 0) throw new Error(`不透明な画素がありません: ${file}`);
  return { img, x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 };
};

const numberArg = (argv, name, fallback) => {
  const i = argv.indexOf(name);
  if (i < 0) return fallback;
  const value = Number(argv[i + 1]);
  if (!Number.isFinite(value)) { console.error(`NG: ${name} には数値を渡してください`); process.exit(1); }
  return value;
};

const main = async () => {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const fit = numberArg(argv, '--fit', 0.90);
  const yOffset = numberArg(argv, '--y', 0);
  const rest = argv.filter((a, i) => !a.startsWith('--') && !['--fit', '--y'].includes(argv[i - 1]));
  const [input, output] = rest;
  if (!input || !output) {
    console.error('使い方: node image/make-disc-icon.js <立ち絵> <出力PNG> [--fit 0.9] [--y 0] [--dry-run]');
    process.exit(1);
  }
  if (!(fit > 0 && fit <= 1)) { console.error('NG: --fit は0より大きく1以下で指定してください'); process.exit(1); }

  const inputPath = resolveRel(input);
  const outputPath = resolveRel(output);
  if (!fs.existsSync(inputPath)) { console.error(`NG: 立ち絵が見つかりません: ${inputPath}`); process.exit(1); }

  const base = await opaqueBounds(path.join(WEB_ROOT, BASE_REL));
  const art = await opaqueBounds(inputPath);

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // ① 円盤: 実体の長辺を枠いっぱいにして中央へ
  const baseScale = SIZE / Math.max(base.w, base.h);
  const bw = base.w * baseScale, bh = base.h * baseScale;
  ctx.drawImage(base.img, base.x, base.y, base.w, base.h, (SIZE - bw) / 2, (SIZE - bh) / 2, bw, bh);

  // ② キャラ: 実体の長辺が枠の fit 倍になる倍率で中央へ(--y のぶんだけ縦にずらす)
  const artScale = SIZE * fit / Math.max(art.w, art.h);
  const aw = art.w * artScale, ah = art.h * artScale;
  ctx.drawImage(art.img, art.x, art.y, art.w, art.h,
    (SIZE - aw) / 2, (SIZE - ah) / 2 + SIZE * yOffset, aw, ah);

  console.log(`土台: ${BASE_REL} (${base.img.width}x${base.img.height}) 円盤の実体 ${base.w}x${base.h}`);
  console.log(`立ち絵: ${path.relative(REPO_ROOT, inputPath)} (${art.img.width}x${art.img.height}) 実体 ${art.w}x${art.h}`);
  console.log(`重ね方: 枠${SIZE}px / キャラ倍率 ${artScale.toFixed(4)} (長辺が枠の${(fit * 100).toFixed(0)}%) / 縦ずらし ${(yOffset * 100).toFixed(1)}%`);
  if (dryRun) { console.log('\n--dry-run のため書き出していません'); return; }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
  const kb = (fs.statSync(outputPath).size / 1024).toFixed(0);
  console.log(`\n書き出しました: ${path.relative(REPO_ROOT, outputPath)} (${SIZE}x${SIZE}, ${kb}KB)`);
  console.log('配信前に node image/compress-images.js --write で減色し、node build.js でキャッシュキーを打ち直すこと');
};

main().catch((e) => { console.error(e); process.exit(1); });
