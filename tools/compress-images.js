// 配信する画像(PNG)を、見た目を落とさない範囲で軽くする。
//
//   node compress-images.js                 # images/ 以下すべてを対象に、実行結果だけ表示(書き換えない)
//   node compress-images.js --write         # 実際に書き換える
//   node compress-images.js assistant breeder-icons --write   # フォルダを絞る
//
// 【なぜ道具にするか】
// 書き出しツールが作るPNGは「32bitフルカラー・フィルタ無し」で保存されることが多く、
// 実際に使っている色数に対して極端に大きい。みゅあの立ち絵は1枚1.4MB、ききのアイコンは
// 2.4MBあった。GitHub Pagesは配信するファイルをそのまま送るので、これがそのまま
// 初回読み込みの重さになり、デプロイの所要時間にも効いてくる。
//
// やること
//   ① PNGを256色のパレット+ディザリングで書き直す(イラストは元から色数が少ないので効果が大きい)
//   ② 書き直した画像を実際にデコードし直し、元とどれだけ違うかを測る
//   ③ 基準を下回った画像は書き換えない(縮んでも見た目が変わるなら採用しない)
//
// 【なぜ「可逆圧縮」ではないのか】
// PNGの可逆圧縮(compressionLevel)だけでは、この絵はほとんど縮まない(むしろ増えることもある)。
// 実測でみゅあの立ち絵は 1458KB→1395KB(4%減)にしかならず、ききに至っては増えた。
// 減色は厳密には非可逆だが、下の基準どおり「差が見えない範囲」に収まっているかを
// 毎回測って確かめているので、見た目は落ちない。
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');

const REPO_ROOT = path.resolve(__dirname, '..');
const IMAGES_ROOT = path.join(REPO_ROOT, 'monster-hero/images');

// 採用してよい画質の下限。
//   PSNR      … 高いほど元に近い。40dB前後あれば並べて見比べても差が分からない
//   差>8の割合 … 256階調のうち8以上ずれた画素の割合。ディザリングによる点のばらつきなので
//                多少あっても縮小表示では見えないが、増えすぎていないかを見張る
const MIN_PSNR = 34;
const MAX_VISIBLE_RATIO = 12; // %
// これ以上小さくならないなら、書き換えずそのまま残す(無駄にキャッシュキーを変えないため)
const MIN_SAVING = 5; // %

const args = process.argv.slice(2);
const write = args.includes('--write');
const targets = args.filter((a) => !a.startsWith('--'));

const listPngs = (dir) => {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...listPngs(full));
    else if (/\.png$/i.test(name)) out.push(full);
  }
  return out;
};

// ブラウザと同じデコーダ(canvas)で読み込んで比べる。
// sharpの生データはアルファの前処理で誤差が乗るため、比較には使わない
const decode = async (src) => {
  const im = await loadImage(src);
  const cv = createCanvas(im.width, im.height);
  const ctx = cv.getContext('2d');
  ctx.drawImage(im, 0, 0);
  return ctx.getImageData(0, 0, im.width, im.height).data;
};

// 透明な部分は画面に出ないので、不透明な画素だけで比べる
const compare = (a, b) => {
  let se = 0, n = 0, visible = 0;
  for (let p = 0; p < a.length; p += 4) {
    if (a[p+3] < 250) continue;
    n++;
    let worst = 0;
    for (let k = 0; k < 3; k++) {
      const d = a[p+k] - b[p+k];
      se += d * d;
      if (Math.abs(d) > worst) worst = Math.abs(d);
    }
    if (worst > 8) visible++;
  }
  if (!n) return { psnr: Infinity, visible: 0 };
  return { psnr: se === 0 ? Infinity : 10 * Math.log10(65025 / (se / (n * 3))), visible: visible / n * 100 };
};

(async () => {
  const roots = targets.length
    ? targets.map((t) => path.join(IMAGES_ROOT, t))
    : [IMAGES_ROOT];
  for (const r of roots) {
    if (!fs.existsSync(r)) { console.log(`NG: ${path.relative(REPO_ROOT, r)} がありません`); process.exitCode = 1; return; }
  }
  const files = roots.flatMap((r) => (fs.statSync(r).isDirectory() ? listPngs(r) : [r])).sort();
  let before = 0, after = 0, changed = 0, skipped = 0, rejected = 0;
  for (const file of files) {
    const rel = path.relative(path.join(REPO_ROOT, 'monster-hero'), file);
    const orig = fs.statSync(file).size;
    before += orig;
    let buf;
    try {
      buf = await sharp(file).png({ palette: true, colors: 256, dither: 1.0, effort: 10 }).toBuffer();
    } catch (e) {
      console.log(`SKIP ${rel} — 読めませんでした (${e.message})`);
      after += orig; skipped++; continue;
    }
    const saving = (1 - buf.length / orig) * 100;
    if (saving < MIN_SAVING) {
      console.log(`そのまま ${rel} — ${(orig/1024).toFixed(0)}KB (${saving.toFixed(0)}%しか縮まない)`);
      after += orig; skipped++; continue;
    }
    const q = compare(await decode(file), await decode(buf));
    const ok = q.psnr >= MIN_PSNR && q.visible <= MAX_VISIBLE_RATIO;
    if (!ok) {
      console.log(`見送り ${rel} — PSNR ${q.psnr.toFixed(1)}dB / 差の見える画素 ${q.visible.toFixed(1)}% (基準 ${MIN_PSNR}dB・${MAX_VISIBLE_RATIO}%)`);
      after += orig; rejected++; continue;
    }
    console.log(`${write ? '圧縮' : '圧縮予定'} ${rel} — ${(orig/1024).toFixed(0)}KB → ${(buf.length/1024).toFixed(0)}KB (${saving.toFixed(0)}%減) / PSNR ${q.psnr === Infinity ? '∞' : q.psnr.toFixed(1)+'dB'} / 差の見える画素 ${q.visible.toFixed(1)}%`);
    if (write) fs.writeFileSync(file, buf);
    after += buf.length; changed++;
  }
  console.log(`\n${files.length}枚 — ${write ? '圧縮した' : '圧縮できる'} ${changed}枚 / そのまま ${skipped}枚 / 画質基準で見送り ${rejected}枚`);
  console.log(`合計 ${(before/1024/1024).toFixed(1)}MB → ${(after/1024/1024).toFixed(1)}MB (${((1-after/before)*100).toFixed(0)}%減)`);
  if (!write) console.log('※ --write を付けると実際に書き換えます');
  else console.log('※ 画像を書き換えたので node tools/build.js でキャッシュキーを更新してください');
})().catch((e) => { console.error(e); process.exit(1); });
