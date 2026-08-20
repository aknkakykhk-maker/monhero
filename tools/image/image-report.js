// monster-hero/images/ 以下のPNGの棚卸し。フォルダごとのサイズ順一覧と、
// 「まったく同じ絵が別名で2枚置かれていないか」を出す。
//
// 2026年8月に画像をJSへのbase64埋め込みからPNGファイルへ移した(tools/image/extract-images.js)。
// 立ち絵(_IMG)・全身アイコン(_ICON)・顔アイコン(_FACE_ICON)は同じ絵を使うモンスターが
// 多いため、同じ絵は変数の別名(const MOCCHI_ICON = MOCCHI_IMG;)で共有し、
// ファイルは1枚だけ置く。ここでその原則が崩れていないかを確認できる。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { REPO_ROOT, loadEmbeddedImages } = require('../harness');

const IMAGES_ROOT = path.join(REPO_ROOT, 'monster-hero', 'images');

// images/ 以下のPNGを全部拾う
const files = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) { walk(full); continue; }
    if (!/\.(png|jpe?g|webp)$/i.test(name)) continue;
    files.push(full);
  }
};
if (fs.existsSync(IMAGES_ROOT)) walk(IMAGES_ROOT);

// どこかから参照されているパスを集める。定数に直接書かれているものだけでなく、
// 助手の表情画像のように「imageDir + 表情名」で組み立てるものもあるため、
// imageDir に指定されたフォルダの中身はまとめて参照済みとして扱う
const sources = ['data/images/images-ally.js', 'data/images/images-enemy.js', 'data/breeder.js',
  'data/assistants.js', 'data/ally-monsters.js', 'data/enemy-monsters.js', 'src/game-system.jsx']
  .map(rel => path.join(REPO_ROOT, 'monster-hero', rel))
  .filter(p => fs.existsSync(p))
  .map(p => fs.readFileSync(p, 'utf8'))
  .join('\n');
const referenced = new Set(Object.values(loadEmbeddedImages()).map(v => String(v).split('?')[0]));
// キャッシュキー(`?v=...`)が付いた書き方も拾う。これを取りこぼすと、マーケットの
// アイコン商品のように data/breeder.js から直接パスで参照している画像を
// 「どこからも参照されていない」と誤って報告してしまう
for (const m of sources.matchAll(/["'`](images\/[^"'`\s)?]+\.(?:png|jpe?g|webp|PNG))(?:\?[^"'`\s)]*)?["'`]/g)) referenced.add(m[1]);
const referencedDirs = new Set();
for (const m of sources.matchAll(/imageDir:\s*["'`](images\/[^"'`]+)["'`]/g)) referencedDirs.add(m[1]);
const isReferenced = (rel) => referenced.has(rel) || [...referencedDirs].some(d => rel.startsWith(d + '/'));

const byDir = new Map();
const byHash = new Map();
let total = 0;
for (const full of files) {
  const rel = path.relative(path.join(REPO_ROOT, 'monster-hero'), full).split(path.sep).join('/');
  const bytes = fs.readFileSync(full);
  const hash = crypto.createHash('md5').update(bytes).digest('hex');
  total += bytes.length;
  const dir = path.dirname(rel);
  if (!byDir.has(dir)) byDir.set(dir, []);
  byDir.get(dir).push({ rel, size: bytes.length, hash });
  if (!byHash.has(hash)) byHash.set(hash, []);
  byHash.get(hash).push(rel);
}

for (const dir of [...byDir.keys()].sort()) {
  const list = byDir.get(dir).sort((a, b) => b.size - a.size);
  const sum = list.reduce((a, x) => a + x.size, 0);
  console.log(`=== ${dir}  ${(sum / 1024 / 1024).toFixed(2)} MB / ${list.length}枚 ===`);
  for (const x of list) {
    const used = isReferenced(x.rel) ? '' : '  ← どこからも参照されていない';
    console.log(`  ${(x.size / 1024).toFixed(0).padStart(6)} KB  ${path.basename(x.rel)}${used}`);
  }
  console.log('');
}

const dups = [...byHash.values()].filter(v => v.length > 1);
if (dups.length) {
  console.log('同じ中身のファイルが複数あります(片方を消して変数の別名で共有できます):');
  dups.forEach(v => console.log('  ' + v.join(' = ')));
} else {
  console.log('同じ中身のファイルの重複はありません');
}
console.log(`\n合計 ${(total / 1024 / 1024).toFixed(2)} MB / ${files.length}枚`);
