// 事前ダウンロード(Service Worker)が使う「音源と画像の一覧」を作る。
//
//   node tools/build-asset-manifest.js          … monster-hero/asset-manifest.json を作り直す
//   node tools/build-asset-manifest.js --check  … 書き出さず、いまの中身と合っているかだけ見る(古ければ終了コード1)
//
// build.js が毎回呼ぶ。手で書かない(ファイルを足すと書き忘れて、その絵だけ落とせなくなる)。
//
// 【中身】
//   files: { "audio/bgm-xxx.mp3": { v: "<中身の sha256 先頭12桁>", size: <バイト>, pack: "beat" | "battle" | "card" } }
//   packs: { beat: { bytes, count }, battle: {...}, card: {...}, all: {...} }
//   id:    一覧全体の指紋(どれか1つでも変われば変わる)
//
// v は stamp-version.js(画像)・stamp-audio-keys.js(音源)が URL に付ける ?v= と同じ計算にしてある。
// だから Service Worker は「URL の ?v= = 一覧の v」のものだけを本物として扱える。
// 中身が変わったファイルは v が変わるので、落とし直しになる(古い絵や音を出さない)。
//
// 【まとまりの分け方】(手で一覧を書かず、データから決める)
//   beat   … モンヒロビートの曲(rhythm-mode.js の bgmTrackId → BGM 一覧の src)とジャケット(images/song-art/)、
//             演奏画面の見た目(images/rhythm-look/)
//   battle … それ以外の音源と画像(バトル・HOME の BGM、モンスター、敵、演出、助手、アイコン、背景)
//   card   … MFバトルカードのカードの絵(images/card-battle/ の小さい版 s と大きい版 l。2026-10-25 社長「両方入れる」)
//             公開の印(RELEASE_FLAGS.cardBattle)が false のあいだは、ページ側(25-asset-cache.jsx)が遊ぶ人に見せず、
//             「全部」にも入れず、自動ダウンロードもしない(デバッグ端末だけ)。公開した日から自動で入る
//   all    … 全部
// movies/ は入れない。<video> は範囲指定(Range)で取るので、Service Worker から丸ごと返すと
// iPhone で再生できないことがあるため。
// images/card-battle/ は、バトルのまとまりに混ぜず、別のまとまり card にする(以前は一覧に入れていなかった)。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const GAME_DIR = path.join(REPO_ROOT, 'monster-hero');
const OUT_FILE = path.join(GAME_DIR, 'asset-manifest.json');
const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
const AUDIO_RE = /\.mp3$/i;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const rel = (full) => path.relative(GAME_DIR, full).split(path.sep).join('/');
const hashOf = (full) => crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex').slice(0, 12);

// モンヒロビートの曲が使う音源。bgmTrackId → BGM 一覧({ id:'...', ... src:'audio/...' })の src
function beatAudioSet() {
  const rhythm = fs.readFileSync(path.join(GAME_DIR, 'data', 'rhythm-mode.js'), 'utf8');
  const trackIds = new Set([...rhythm.matchAll(/bgmTrackId\s*:\s*['"]([^'"]+)['"]/g)].map(m => m[1]));
  const partsDir = path.join(GAME_DIR, 'src', 'parts');
  const srcById = new Map();
  for (const name of fs.readdirSync(partsDir).filter(n => n.endsWith('.jsx'))) {
    const text = fs.readFileSync(path.join(partsDir, name), 'utf8');
    for (const m of text.matchAll(/\{\s*id\s*:\s*'([^']+)'[^{}\n]*?\bsrc\s*:\s*'(audio\/[^'?]+\.mp3)'/g)) {
      if (!srcById.has(m[1])) srcById.set(m[1], m[2]);
    }
  }
  const set = new Set();
  const missing = [];
  for (const id of trackIds) {
    const src = srcById.get(id);
    if (src) set.add(src); else missing.push(id);
  }
  return { set, missing, trackCount: trackIds.size };
}

// ゲーム本体とデータ(core)。index.html が ?v=<版> 付きで読む同じサイトの JS・CSS を、その版のまま載せる
// (2026-10-27 社長「本体とデータもダウンロードに入れる」)。版を決めるのは index.html(毎回ネットから取る)で、
// SW は URL の版が一覧とぴったり同じときだけ、置き場 mh-code-v1 から返す。本体の版は GAME_BUILD(中身のハッシュ)
function coreFiles() {
  const index = fs.readFileSync(path.join(GAME_DIR, 'index.html'), 'utf8');
  const out = {};
  const add = (rel, v) => {
    const full = path.join(GAME_DIR, rel);
    if (!fs.existsSync(full) || !v) return;
    out[rel] = { v, size: fs.statSync(full).size, pack: 'core' };
  };
  for (const m of index.matchAll(/(?:src|href)="([a-z0-9][a-z0-9_\/.-]*\.(?:js|css))\?v=([0-9A-Za-z._-]+)"/gi)) add(m[1], m[2]);
  const build = (index.match(/var GAME_BUILD = '([^']+)';/) || [])[1];
  add('game-system.compiled.js', build);
  return out;
}

function buildManifest() {
  const beat = beatAudioSet();
  const files = {};
  const audio = walk(path.join(GAME_DIR, 'audio')).filter(f => AUDIO_RE.test(f));
  const images = [
    ...walk(path.join(GAME_DIR, 'images')),
    ...walk(path.join(GAME_DIR, 'data', 'images')),
  ].filter(f => IMAGE_RE.test(f));
  for (const full of [...audio, ...images].sort()) {
    const r = rel(full);
    const isBeat = beat.set.has(r) || r.startsWith('images/song-art/') || r.startsWith('images/rhythm-look/');
    const isCard = r.startsWith('images/card-battle/');
    files[r] = { v: hashOf(full), size: fs.statSync(full).size, pack: isCard ? 'card' : isBeat ? 'beat' : 'battle' };
  }
  const packs = { beat: { bytes: 0, count: 0 }, battle: { bytes: 0, count: 0 }, card: { bytes: 0, count: 0 }, all: { bytes: 0, count: 0 }, core: { bytes: 0, count: 0 } };
  for (const f of Object.values(files)) {
    packs[f.pack].bytes += f.size; packs[f.pack].count++;
    packs.all.bytes += f.size; packs.all.count++;
  }
  // 本体とデータは「全部」に数えない(設定の「ダウンロード」のまとまりではなく、遊んだときに SW がためる)
  for (const [k, f] of Object.entries(coreFiles())) {
    files[k] = f;
    packs.core.bytes += f.size; packs.core.count++;
  }
  const id = crypto.createHash('sha256')
    .update(Object.entries(files).map(([k, f]) => `${k}=${f.v}`).join('\n'))
    .digest('hex').slice(0, 12);
  return { manifest: { version: 1, id, packs, files }, beat };
}

function serialize(manifest) {
  // 1ファイル1行にして、差分が読める形にする
  const lines = Object.entries(manifest.files).map(([k, f]) => `    ${JSON.stringify(k)}: ${JSON.stringify(f)}`);
  return `{\n  "version": ${manifest.version},\n  "id": ${JSON.stringify(manifest.id)},\n  "packs": ${JSON.stringify(manifest.packs)},\n  "files": {\n${lines.join(',\n')}\n  }\n}\n`;
}

function run({ check = false } = {}) {
  const { manifest, beat } = buildManifest();
  if (beat.missing.length) {
    return { ok: false, reason: `モンヒロビートの曲の音源が BGM 一覧に見つかりません: ${beat.missing.join(', ')}` };
  }
  const text = serialize(manifest);
  const current = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';
  if (check) {
    return current === text
      ? { ok: true, manifest }
      : { ok: false, reason: 'monster-hero/asset-manifest.json が音源・画像の中身と合っていません' };
  }
  const changed = current !== text;
  if (changed) fs.writeFileSync(OUT_FILE, text);
  return { ok: true, changed, manifest };
}

module.exports = { run, buildManifest, coreFiles, OUT_FILE };

if (require.main === module) {
  const check = process.argv.includes('--check');
  const r = run({ check });
  if (!r.ok) { console.error(`NG: ${r.reason}。node tools/build.js を実行してください`); process.exit(1); }
  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  const p = r.manifest.packs;
  console.log(`${check ? 'OK' : (r.changed ? '書き出しました' : '最新でした')}: asset-manifest.json (${r.manifest.id}) モンヒロビート ${p.beat.count}件 ${mb(p.beat.bytes)}MB / バトル ${p.battle.count}件 ${mb(p.battle.bytes)}MB / バトルカード ${p.card.count}件 ${mb(p.card.bytes)}MB / 全部 ${mb(p.all.bytes)}MB / 本体とデータ ${p.core.count}件 ${mb(p.core.bytes)}MB`);
}
