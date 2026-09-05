// 画像がPNGファイルとして正しく置かれているかを見張る検査。
//
// 2026年8月に、モンスターの絵やアイコンを data/*.js への base64 埋め込みから
// monster-hero/images/ 以下のPNGファイルへ移した(tools/image/extract-images.js)。
// ファイル参照は綴りを1文字まちがえても手元では気づけず、公開してから
// 「絵が出ない」ことになる(GitHub Pagesは大文字小文字を区別する)。
// そのため次を機械的に確認する。
//
//   ① データ側に base64 の画像が復活していないか
//   ② 変数が指すPNGが実在し、画像として読めるか
//   ③ キャッシュキー(?v=)が中身のハッシュと一致しているか
//      (ずれていると、絵を差し替えてもブラウザに残った古い絵が表示され続ける)
//   ④ images/ に置いてあるのにどこからも参照されていないファイルが無いか
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Image } = require('canvas');
const { REPO_ROOT, loadEmbeddedImages, imageFilePath } = require('./harness');

const WEB_ROOT = path.join(REPO_ROOT, 'monster-hero');
const DATA_FILES = [
  'data/images/images-ally.js',
  'data/images/images-enemy.js',
  'data/breeder.js',
];

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- ① base64 が復活していないか ---
const withBase64 = DATA_FILES.filter((rel) => {
  const p = path.join(WEB_ROOT, rel);
  return fs.existsSync(p) && /data:image\/[a-z+]+;base64,/.test(fs.readFileSync(p, 'utf8'));
});
check('データに base64 の画像が埋め込まれていない', withBase64.length === 0, withBase64.join(', '));

// --- ② 変数が指すPNGが実在して読めるか ---
const images = loadEmbeddedImages();
const entries = Object.entries(images).filter(([, v]) => typeof v === 'string' && v.startsWith('images/'));
check('画像の参照が集まっている', entries.length > 0, `${entries.length}件`);

const missing = [];
const broken = [];
for (const [name, url] of entries) {
  const file = imageFilePath(url);
  if (!fs.existsSync(file)) { missing.push(`${name} → ${url}`); continue; }
  try {
    const img = new Image();
    img.src = fs.readFileSync(file);
    if (!img.width || !img.height) broken.push(`${name} → ${url}`);
  } catch (e) {
    broken.push(`${name} → ${url} (${e.message})`);
  }
}
check('参照しているPNGがすべて実在する', missing.length === 0, missing.join(' / '));
check('参照しているPNGがすべて画像として読める', broken.length === 0, broken.join(' / '));

// --- ③ キャッシュキーが中身と一致しているか ---
const staleKeys = [];
for (const [name, url] of entries) {
  const [rel, query] = url.split('?');
  const file = path.join(WEB_ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const want = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
  const got = (query || '').replace(/^v=/, '');
  if (got !== want) staleKeys.push(`${name}(${got || 'キーなし'} ≠ ${want})`);
}
check('画像のキャッシュキーが中身と一致している', staleKeys.length === 0,
  staleKeys.length ? `${staleKeys.slice(0, 5).join(' / ')}${staleKeys.length > 5 ? ` ほか${staleKeys.length - 5}件` : ''} — node tools/build.js で更新されます` : '');

// --- ④ 参照されていないファイルが無いか ---
const files = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) { walk(full); continue; }
    if (!/\.(png|jpe?g|webp)$/i.test(name)) continue;
    files.push(path.relative(WEB_ROOT, full).split(path.sep).join('/'));
  }
};
const imagesRoot = path.join(WEB_ROOT, 'images');
if (fs.existsSync(imagesRoot)) walk(imagesRoot);

// images/ を参照しているファイルはここに全部並べる。1つでも抜けると、そこからしか
// 参照していない画像が「使われていない」と誤って出る(2026-09-05、曲のジャケットを
// data/rhythm-mode.js から参照したときに実際に起きた)。
// キャッシュキーを付ける側の一覧(tools/stamp-version.js の IMAGE_HOST_FILES)とは
// 役割が違うので別々に持つが、画像を参照するファイルを増やしたら**両方**へ足す。
const sources = [...DATA_FILES, 'data/assistants.js', 'data/ally-monsters.js', 'data/enemy-monsters.js',
  'data/rhythm-mode.js', 'src/game-system.jsx']
  .map((rel) => path.join(WEB_ROOT, rel))
  .filter((p) => fs.existsSync(p))
  .map((p) => fs.readFileSync(p, 'utf8'))
  .join('\n');
const referenced = new Set(entries.map(([, v]) => v.split('?')[0]));
for (const m of sources.matchAll(/["'`](images\/[^"'`\s)?]+\.(?:png|jpe?g|webp|PNG))(?:\?[^"'`\s)]*)?["'`]/g)) referenced.add(m[1]);
// 助手の表情画像のように「imageDir + 表情名」で組み立てるものは、フォルダごと参照済みとみなす
const referencedDirs = [...sources.matchAll(/imageDir:\s*["'`](images\/[^"'`]+)["'`]/g)].map((m) => m[1]);
// 検査用の正解見本・差し替え前の原本は配信フォルダに置かず tools/art-sources/ で管理する。
// そのため images/ に「どこからも参照されない画像」が残っていたら、それは消し忘れとみなす。
const orphans = files.filter((rel) => !referenced.has(rel)
  && !referencedDirs.some((d) => rel.startsWith(d + '/')));
check('images/ に使われていない画像が残っていない', orphans.length === 0, orphans.slice(0, 8).join(' / '));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exitCode = failed ? 1 : 0;
