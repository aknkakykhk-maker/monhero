// BUILD_DATE、version.json、更新履歴の最新リリース、index.htmlの本体JSキャッシュキーを「今の日本時間」に揃える。
//
//   node stamp-version.js            … 現在時刻(JST)で更新する
//   node stamp-version.js --print    … 更新せず、いま打たれる値だけ表示する
//
// これまで手で書き換えていたため、実際より先の時刻(未来の日時)が入ってしまい、
// 更新履歴に「まだ来ていない時刻」が表示されることがあった。
// 出荷手順ではこれを実行して、changelog.js に追記する日時もこの値に合わせる。
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
const changelogPath = path.join(REPO_ROOT, 'monster-hero', 'data', 'changelog.js');
const changelog = fs.readFileSync(changelogPath, 'utf8');
const firstDateMatch = changelog.match(/date: "([^"]+)"/);
if (!firstDateMatch) {
  console.error('NG: changelog.js の最新エントリ日時が見つかりませんでした');
  process.exit(1);
}
// 同じ日時で並ぶ update / issue は同一リリース。先頭から連続する全エントリを一緒に更新する。
const latestDate = firstDateMatch[1];
let inLatestRelease = true;
const replacedChangelog = changelog.replace(/date: "([^"]+)"/g, (match, date) => {
  if (!inLatestRelease || date !== latestDate) {
    inLatestRelease = false;
    return match;
  }
  return `date: "${stamp}"`;
});
fs.writeFileSync(GAME_SYSTEM, replaced);
fs.writeFileSync(path.join(REPO_ROOT, 'monster-hero', 'version.json'), `{"build": "${stamp}"}\n`);
fs.writeFileSync(changelogPath, replacedChangelog);

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

console.log(`BUILD_DATE、version.json、更新履歴、GAME_BUILD を ${stamp} に更新しました`);
console.log(`data/*.js のキャッシュキー: ${dataKeys.join(' / ')}`);
