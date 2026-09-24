const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 敵の絵が、バトル画面で「どれくらいの大きさに見えるか」を並べて出す道具。
//
//   node tools/image/enemy-art-size-report.js                     … 配信中の敵
//   node tools/image/enemy-art-size-report.js <PNG> <PNG> …        … 指定した絵も一緒に
//
// 【なぜ要るか】
// 絵は長辺160pxにそろえてあるが、それは「枠にどう収まるか」をそろえただけで、
// **体の大きさ感**はそろわない。鎌・耳・広げた腕のように細長いものが付いていると、
// 長辺をそこに取られて本体が小さく見える(デルピエロがそうなった)。
//
// そこで、実際の表示と同じ56pxの枠へ収めたときに**色が乗る面積**を数える。
// 面積が小さいほど「小さく見える」。配信中の敵は13%〜68%とばらついているので、
// 新しい敵もその幅に収まっていれば手を入れなくてよい。
// 外れたものだけ ENEMY_ART_LAYOUT(22-enemy-and-bond-entries.jsx)の scale で持ち上げる
// (ムーが 2.75 倍で入っているのと同じ仕組み)。
const fs = require('fs');
const path = require('path');
const sharp = require(path.join(TOOLS_DIR, 'node_modules/sharp'));

const ROOT = path.resolve(TOOLS_DIR, '..');
const ENEMY_DIR = path.join(ROOT, 'monster-hero/images/enemies');
const BOX = 56; // バトル画面・全WAVE詳細で敵の絵を収めている枠(w-14 h-14)

const measure = async (label, file) => {
  const { data, info } = await sharp(file)
    .resize({ width: BOX, height: BOX, fit: 'inside' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let on = 0;
  for (let i = 0; i < info.width * info.height; i += 1) if (data[i * 4 + 3] > 40) on += 1;
  return { label, w: info.width, h: info.height, area: on, rate: on / (BOX * BOX) };
};

(async () => {
  const rows = [];
  for (const f of fs.readdirSync(ENEMY_DIR).filter(f => f.endsWith('.png'))) {
    rows.push(await measure(f.replace('.png', ''), path.join(ENEMY_DIR, f)));
  }
  for (const f of process.argv.slice(2)) rows.push(await measure(path.basename(f, '.png') + ' *', f));
  rows.sort((a, b) => b.rate - a.rate);
  const pct = (r) => `${Math.round(r * 100)}%`;
  console.log(`${BOX}px の枠に収めたときに色が乗る面積（大きいほど大きく見える）\n`);
  for (const r of rows) {
    console.log(`  ${pct(r.rate).padStart(4)}  ${String(r.area).padStart(4)}px  ${r.w}x${r.h}  ${r.label}`);
  }
  const rates = rows.map(r => r.rate).sort((a, b) => a - b);
  const mid = rates[Math.floor(rates.length / 2)];
  console.log(`\n  まんなか ${pct(mid)} / いちばん小さい ${pct(rates[0])} / いちばん大きい ${pct(rates[rates.length - 1])}`);
  console.log('  ※ 印は引数で指定した絵（まだ配信フォルダに入っていないもの）');
})();
