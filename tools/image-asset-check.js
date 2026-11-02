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
//   ⑤ ムービー(movies/*.mp4)も、実在・キャッシュキー・置きっぱなしを同じように見る
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

// WebP の縦横をファイルの頭から読む(VP8 / VP8L / VP8X)。読めなければ null
const webpSize = (buf) => {
  if (!buf || buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) }; }
  if (kind === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  return null;
};
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
    // WebP(行動カードの絵・2026-10-15)は canvas では開けないので、ファイルの頭(RIFF/WEBP と縦横)を読んで確かめる
    if (/\.webp$/i.test(file)) {
      const size = webpSize(fs.readFileSync(file));
      if (!size || !size.width || !size.height) broken.push(`${name} → ${url}`);
      continue;
    }
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
  'data/rhythm-mode.js', 'data/rhythm-event.js', 'data/changelog.js', 'src/game-system.jsx']
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

// --- ⑤ ムービー(movies/*.mp4)も、実在・キャッシュキー・置きっぱなしを同じように見る ---
// 覚醒ムーの必殺技ムービー(2026-09-25)。敵データの specialMovie から参照し、?v= は stamp-version.js が付ける
// HELL の説明の動画(2026-10-13・mp4 と webm)は data/rhythm-mode.js の RHYTHM_HELL_GUIDE_VIDEOS から
// 予告動画(2026-11-02)は data/changelog.js の video から
const movieHost = ['data/enemy-monsters.js', 'data/rhythm-mode.js', 'data/changelog.js'].map((rel) => fs.readFileSync(path.join(WEB_ROOT, rel), 'utf8')).join('\n');
const movieRefs = [...movieHost.matchAll(/["'](movies\/[^"'?]+\.(?:mp4|webm))(?:\?v=([0-9a-f]*))?["']/g)];
const movieMissing = [], movieStale = [];
for (const [, rel, key] of movieRefs) {
  const file = path.join(WEB_ROOT, rel);
  if (!fs.existsSync(file)) { movieMissing.push(rel); continue; }
  const want = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
  if (key !== want) movieStale.push(`${rel}(${key || 'キーなし'} ≠ ${want})`);
}
check('参照しているムービーがすべて実在する', movieMissing.length === 0, movieMissing.join(' / '));
check('ムービーのキャッシュキーが中身と一致している', movieStale.length === 0,
  movieStale.length ? `${movieStale.join(' / ')} — node tools/build.js で更新されます` : '');
const moviesRoot = path.join(WEB_ROOT, 'movies');
const movieFiles = fs.existsSync(moviesRoot) ? fs.readdirSync(moviesRoot).map((name) => `movies/${name}`) : [];
const movieOrphans = movieFiles.filter((rel) => !movieRefs.some(([, r]) => r === rel));
check('movies/ に使われていないファイルが残っていない', movieOrphans.length === 0, movieOrphans.join(' / '));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exitCode = failed ? 1 : 0;
