// data/*.js に埋め込まれた base64 画像の棚卸し。サイズ順の一覧と、
// 「まったく同じ実体が複数の変数に重複して埋め込まれていないか」を出す。
// 立ち絵(_IMG)・全身アイコン(_ICON)・顔アイコン(_FACE_ICON)は同じ絵を使う
// モンスターが多く、そのままだと同じ base64 が3回埋め込まれてファイルが無駄に膨らむ。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { REPO_ROOT } = require('./harness');

const FILES = ['images/images-ally.js', 'images/images-enemy.js', 'breeder.js'];
let grandTotal = 0, grandWaste = 0;

for (const f of FILES) {
  const p = path.join(REPO_ROOT, 'monster-hero', 'data', f);
  if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, 'utf8');
  const re = /(?:const\s+)?([A-Za-z0-9_$]+)\s*[:=]\s*["'`](data:image\/[a-z+]+;base64,([^"'`]*))/g;
  const groups = new Map();
  let m;
  while ((m = re.exec(s))) {
    const hash = crypto.createHash('md5').update(m[2]).digest('hex');
    if (!groups.has(hash)) groups.set(hash, { keys: [], b64: m[3].length });
    groups.get(hash).keys.push(m[1]);
  }
  const list = [...groups.values()].sort((a, b) => b.b64 - a.b64);
  const waste = list.reduce((acc, g) => acc + g.b64 * (g.keys.length - 1), 0);
  grandTotal += s.length; grandWaste += waste;
  console.log(`=== ${f}  ${(s.length / 1024 / 1024).toFixed(2)} MB / 実体${list.length}件 ===`);
  for (const g of list) {
    const dup = g.keys.length > 1 ? `  ← ${g.keys.length}重複` : '';
    console.log(`  ${(g.b64 * 3 / 4 / 1024).toFixed(0).padStart(6)} KB  ${g.keys.join(', ')}${dup}`);
  }
  if (waste > 0) console.log(`  重複により無駄になっている量: ${(waste / 1024 / 1024).toFixed(2)} MB\n`);
  else console.log('  重複なし\n');
}

console.log(`合計 ${(grandTotal / 1024 / 1024).toFixed(2)} MB のうち、重複による無駄は ${(grandWaste / 1024 / 1024).toFixed(2)} MB`);
console.log(`重複を「変数への参照」に置き換えれば、画質を一切落とさずに ${(grandWaste / 1024 / 1024).toFixed(2)} MB 削減できます`);
