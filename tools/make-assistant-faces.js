// 助手(みゅあ・きき…)の表情画像から、吹き出し用の小さい顔アイコンを作る。
//
// monster-hero/images/assistant/<prefix>_*.PNG は 1536x1024 の全身絵で1枚1.5MBある。
// 吹き出しの顔は48〜72pxしかないので、そのまま読むと表情を変えるたびに1.5MBを
// 取りに行くことになり、モバイル回線では待たされる。そこで顔まわりだけを正方形に
// 切り出し、256pxへ縮めたものを images/assistant/face/ へ書き出しておく。
//
//   node tools/make-assistant-faces.js
//
// 表情画像を差し替えたり増やしたりしたら、このコマンドを流し直す。
// 切り出す位置は透明でない範囲(＝キャラの輪郭)から自動で決めるので、
// 立ち位置が多少違ってもそのまま使える。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createCanvas, loadImage } = require('canvas');
// 書き出しは減色(パレット)PNGにする。
// canvas の toBuffer は RGBA のままなので、同じ絵でも 3倍近く重くなる
// (実測: みゅあ normal で 43KB → 121KB)。吹き出しは 48〜72px でしか出さないので、
// 256色まで落としても見た目は変わらない。ここを通さないと、このツールを流すたびに
// 配信物が重くなっていく(2026-09-05に実際そうなっていた)
let sharp = null;
try { sharp = require('sharp'); } catch { /* 無ければ減色せずに書き出す */ }

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'monster-hero/images/assistant');
const outDir = path.join(srcDir, 'face');
const OUT_SIZE = 256;      // 書き出す顔アイコンの一辺(px)。表示は最大72pxなので余裕がある
const ALPHA_MIN = 24;      // これ以上の不透明度をキャラの一部とみなす
const HEAD_RATIO = 0.46;   // キャラ全体の高さに対する「顔まわり」の一辺の比率
// キャラの上端から、この比率だけ下げた位置を切り出しの上端にする。
// 負の値を書くと「キャラの上端より上」から切り出す(バストアップの絵で顔を枠の中央へ
// 下ろしたいときに使う)。枠が画像からはみ出す場合は下の clamp が画像の中へ収める。
// みゅあはうさ耳が高く伸びているため、上端から切ると耳が枠の真ん中に来て顔が下へ押し出され、
// 丸く切ったときに顔が中心から外れてしまう。少し下げて顔が真ん中に来るようにする
const HEAD_TOP_SKIP = 0.09;
// 助手ごとに切り出し方が違うとき(髪や耳の伸び方が違う)は、ここへ上書きを足す。
// 書かなければ上の既定値をそのまま使う
const PER_ASSISTANT = {
  // myua: { headRatio: 0.46, headTopSkip: 0.09 },
  // ききは頭上のリボンがみゅあのうさ耳よりさらに高く伸びているため、既定の
  // headTopSkip(0.09)のままだとリボンの分量に押し出されて顔が下へ寄り、
  // 丸く切ったときに顎が枠外へ出てしまう。skipを広げてリボンの先まで
  // 読み飛ばし、ratioも広げてみゅあと同じくらい引いた(=顔が枠に占める
  // 割合が近い)構図にした。数値はheadFill/headCx/headCyをみゅあの
  // 実測値(63%/45%/53%)と突き合わせて選んだ
  kiki: { headRatio: 0.60, headTopSkip: 0.14 },
  // ももすけは元絵が正方形(512x512)のバストアップで、みゅあ・ききの全身絵(1536x1024)とは
  // 構図がまったく違う。全身絵は「キャラの高さ＝ほぼ画像の高さ」なので ratio 0.46 で
  // 頭まわりだけが切り出せるが、ももすけはキャラの高さ(288px)の大半が既に頭なので、
  // 同じ感覚の ratio では顔だけの大写しになる。
  //
  // 2026-09-05に絵を差し替えたとき、この違いのせいで顔アイコンの占有が
  // 91〜93% になっていた(みゅあ63〜70% / きき61〜66%)。ももすけだけ顔が大きく、
  // 3人を並べたときにそろって見えない。
  // 頭の高さより広く切り出す(ratio>1)ことで、みゅあ・ききと同じくらいの
  // 「引き」にそろえる。skipを負にしているのは、キャラの上端より上まで枠を広げて
  // 顔を枠の中央へ下ろすため(そうしないと顔が上に寄る)。
  //
  // 数値は8表情ぶんを tools/assistant-face-check.js で実測して選んだ。
  //   ももすけ 占有66〜70% / 肌の縦55〜58%
  //   みゅあ   占有63〜70% / 肌の縦53〜55%
  //   きき     占有61〜66% / 肌の縦59〜61%
  // ratio を上げると引きが強くなって占有が下がり、skip を上げると顔が上へ寄る。
  momosuke: { headRatio: 0.98, headTopSkip: 0.00 },
};

// どの接頭辞を処理するかは data/assistants.js の ASSISTANTS から取る。
// 助手を増やしたとき、このツール側を書き換えなくても顔が作られるようにするため
const assistantPrefixes = () => {
  try {
    const src = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(`${src}\nglobalThis.__p = ASSISTANTS.map(a => a.imagePrefix).filter(Boolean);`, ctx);
    return [...new Set(ctx.__p)];
  } catch (e) {
    console.log(`data/assistants.js を読めませんでした(${e.message})。myua だけを処理します`);
    return ['myua'];
  }
};

// 透明でない画素の範囲(左右上下)を返す
const opaqueBounds = (ctx, w, h) => {
  const data = ctx.getImageData(0, 0, w, h).data;
  let left = w, right = -1, top = h, bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < ALPHA_MIN) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < 0 ? null : { left, right, top, bottom };
};

// 顔の中心の横位置。切り出す枠のうち「顔がある高さ」だけを見て重心を取る。
// 頭のてっぺんだけを見ると、片側へ倒れた耳やアホ毛に引っ張られて中心がずれる
const headCenterX = (ctx, w, top, side) => {
  const y0 = Math.round(top + side * 0.30);
  const band = Math.max(1, Math.round(side * 0.50));
  const data = ctx.getImageData(0, y0, w, band).data;
  let sum = 0, count = 0;
  for (let y = 0; y < band; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < ALPHA_MIN) continue;
      sum += x; count++;
    }
  }
  return count ? sum / count : w / 2;
};

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const prefixes = assistantPrefixes();
  const pattern = new RegExp(`^(${prefixes.join('|')})_.+\\.png$`, 'i');
  const files = fs.readdirSync(srcDir).filter(f => pattern.test(f)).sort();
  if (files.length === 0) { console.log('切り出す画像がありません'); return; }
  console.log(`対象の助手: ${prefixes.join(', ')}`);
  for (const file of files) {
    const prefix = prefixes.find(p => file.toLowerCase().startsWith(`${p.toLowerCase()}_`));
    const tune = PER_ASSISTANT[prefix] || {};
    const headRatio = Number.isFinite(tune.headRatio) ? tune.headRatio : HEAD_RATIO;
    const headTopSkip = Number.isFinite(tune.headTopSkip) ? tune.headTopSkip : HEAD_TOP_SKIP;
    const img = await loadImage(path.join(srcDir, file));
    const src = createCanvas(img.width, img.height);
    const sctx = src.getContext('2d');
    sctx.drawImage(img, 0, 0);
    const bounds = opaqueBounds(sctx, img.width, img.height);
    if (!bounds) { console.log(`NG: ${file} は全部透明です`); continue; }
    const height = bounds.bottom - bounds.top + 1;
    const side = Math.round(height * headRatio);
    let sy = Math.round(bounds.top + height * headTopSkip);
    const cx = headCenterX(sctx, img.width, sy, side);
    let sx = Math.round(cx - side / 2);
    sx = Math.max(0, Math.min(img.width - side, sx));
    sy = Math.max(0, Math.min(img.height - side, sy));
    const out = createCanvas(OUT_SIZE, OUT_SIZE);
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(img, sx, sy, side, side, 0, 0, OUT_SIZE, OUT_SIZE);
    let buf = out.toBuffer('image/png', { compressionLevel: 9 });
    if (sharp) {
      // 透明のふちを残したまま256色へ落とす(palette:true)。
      // effort を上げるほど小さくなるが時間がかかる。8枚×助手数なので 7 で十分速い
      buf = await sharp(buf).png({ palette: true, colours: 256, effort: 7, compressionLevel: 9 }).toBuffer();
    }
    const outPath = path.join(outDir, file.replace(/\.png$/i, '.PNG'));
    fs.writeFileSync(outPath, buf);
    const before = fs.statSync(path.join(srcDir, file)).size;
    console.log(`${file} → face/${path.basename(outPath)}  切り出し ${side}px (${sx},${sy})  ${(before/1024/1024).toFixed(2)}MB → ${(buf.length/1024).toFixed(0)}KB`);
  }
};

run().catch(e => { console.error(e); process.exit(1); });
