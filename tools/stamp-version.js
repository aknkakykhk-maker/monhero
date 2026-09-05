// BUILD_DATE、version.json、index.htmlの本体JSキャッシュキーを「今の日本時間」に揃える。
// CHANGELOGはユーザー向け更新だけの正本とし、デバッグ・内部修正では自動更新しない。
//
//   node stamp-version.js            … 現在時刻(JST)で更新する
//   node stamp-version.js --print    … 更新せず、いま打たれる値だけ表示する
//
// バナー用のbuild番号は全出荷で進める一方、更新履歴は必要な変更だけ別途編集する。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { REPO_ROOT, GAME_SYSTEM } = require('./harness');

// JSTの「YYYY-MM-DD HH:MM」を作る(実行環境のタイムゾーンに依存しないよう明示的に変換する)
function nowJst() {
  const p = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date()).reduce((a, x) => (a[x.type] = x.value, a), {});
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

const stamp = nowJst();

if (process.argv.includes('--print')) {
  console.log(stamp);
  process.exit(0);
}

const src = fs.readFileSync(GAME_SYSTEM, 'utf8');
const replaced = src.replace(/const BUILD_DATE = "[^"]*";/, `const BUILD_DATE = "${stamp}";`);
// 同じ分に2回実行すると置換後の内容が元と同じになる。これを「宣言が無い」と誤判定して
// 中断すると、build.js の変換まで走らず compiled が古いまま出荷されてしまう。
// 宣言が実在するかどうかで判定する。
if (!/const BUILD_DATE = "[^"]*";/.test(src)) {
  console.error('NG: BUILD_DATE の宣言が見つかりませんでした');
  process.exit(1);
}
const indexPath = path.join(REPO_ROOT, 'monster-hero', 'index.html');
const index = fs.readFileSync(indexPath, 'utf8');
const gameBuild = stamp.replace(/[- :]/g, '');
let replacedIndex = index.replace(/var GAME_BUILD = '[^']*';/, `var GAME_BUILD = '${gameBuild}';`);
if (!/var GAME_BUILD = '[^']*';/.test(index)) {
  console.error('NG: index.html の GAME_BUILD 宣言が見つかりませんでした');
  process.exit(1);
}
fs.writeFileSync(GAME_SYSTEM, replaced);
fs.writeFileSync(path.join(REPO_ROOT, 'monster-hero', 'version.json'), `{"build": "${stamp}"}\n`);

// data/*.js のキャッシュキー(?v=)を中身のハッシュに合わせる。
// 本体(game-system.compiled.js)はGAME_BUILDで毎回更新されるが、データ側は手書きの固定値だったため、
// data/breeder.js だけ古いままブラウザに残り「本体は新しいのにデータが古い」状態で
// 参照エラー → 画面が真っ暗、という不具合が起きた。
// 中身が変わったファイルだけキーが変わるので、変えていないファイルは再ダウンロードされない。
const dataKeys = [];
replacedIndex = replacedIndex.replace(/(<script src="(data\/[^"?]+\.js)\?v=)[^"]*(")/g, (match, head, relPath, tail) => {
  const filePath = path.join(REPO_ROOT, 'monster-hero', relPath);
  if (!fs.existsSync(filePath)) {
    console.error(`NG: index.html が参照している ${relPath} が見つかりませんでした`);
    process.exit(1);
  }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').slice(0, 12);
  dataKeys.push(`${relPath}=${hash}`);
  return `${head}${hash}${tail}`;
});
if (dataKeys.length === 0) {
  console.error('NG: index.html に data/*.js の読み込みが見つかりませんでした');
  process.exit(1);
}

fs.writeFileSync(indexPath, replacedIndex);

// 画像(images/*.png)のキャッシュキー(?v=)も中身のハッシュに合わせる。
// 絵を差し替えてもファイル名は同じなので、キーが無いとブラウザに残った古い絵が
// そのまま表示され続けてしまう。中身が変わった画像だけキーが変わる。
// data/*.js のハッシュを計算するより前に行うと、ここで書き換えた内容が
// 上のキーへ反映されないため、必ず後に置くこと(下で data/*.js を測り直す)。
const IMAGE_HOST_FILES = [
  'data/images/images-ally.js',
  'data/images/images-enemy.js',
  'data/breeder.js',
  // 曲えらびのジャケット(images/song-art/…)もここから参照している
  'data/rhythm-mode.js',
];
let imageCount = 0, imageChanged = 0;
for (const rel of IMAGE_HOST_FILES) {
  const hostPath = path.join(REPO_ROOT, 'monster-hero', rel);
  if (!fs.existsSync(hostPath)) continue;
  const before = fs.readFileSync(hostPath, 'utf8');
  const after = before.replace(/(["'])(images\/[^"'?]+\.(?:png|jpe?g|webp|PNG))(?:\?v=[0-9a-f]*)?\1/g, (match, quote, imgRel) => {
    const imgPath = path.join(REPO_ROOT, 'monster-hero', imgRel);
    if (!fs.existsSync(imgPath)) {
      console.error(`NG: ${rel} が参照している ${imgRel} が見つかりませんでした`);
      process.exit(1);
    }
    imageCount++;
    const h = crypto.createHash('sha256').update(fs.readFileSync(imgPath)).digest('hex').slice(0, 12);
    return `${quote}${imgRel}?v=${h}${quote}`;
  });
  if (after !== before) { fs.writeFileSync(hostPath, after); imageChanged++; }
}

// 画像のキーを書き換えたぶん data/*.js の中身も変わるので、index.html 側のキーを測り直す
if (imageChanged) {
  const index2 = fs.readFileSync(indexPath, 'utf8');
  const redone = index2.replace(/(<script src="(data\/[^"?]+\.js)\?v=)[^"]*(")/g, (match, head, relPath, tail) => {
    const filePath = path.join(REPO_ROOT, 'monster-hero', relPath);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').slice(0, 12);
    const i = dataKeys.findIndex(k => k.startsWith(relPath + '='));
    if (i >= 0) dataKeys[i] = `${relPath}=${hash}`;
    return `${head}${hash}${tail}`;
  });
  fs.writeFileSync(indexPath, redone);
}

console.log(`BUILD_DATE、version.json、GAME_BUILD を ${stamp} に更新しました（CHANGELOGは変更しません）`);
console.log(`data/*.js のキャッシュキー: ${dataKeys.join(' / ')}`);
console.log(`画像のキャッシュキー: ${imageCount}枚`);