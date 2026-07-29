// BUILD_DATE、version.json、index.htmlの本体JSキャッシュキーを「今の日本時間」に揃える。
//
//   node stamp-version.js            … 現在時刻(JST)で更新する
//   node stamp-version.js --print    … 更新せず、いま打たれる値だけ表示する
//
// これまで手で書き換えていたため、実際より先の時刻(未来の日時)が入ってしまい、
// 更新履歴に「まだ来ていない時刻」が表示されることがあった。
// 出荷手順ではこれを実行して、changelog.js に追記する日時もこの値に合わせる。
const fs = require('fs');
const path = require('path');
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
if (replaced === src) {
  console.error('NG: BUILD_DATE の宣言が見つかりませんでした');
  process.exit(1);
}
const indexPath = path.join(REPO_ROOT, 'monster-hero', 'index.html');
const index = fs.readFileSync(indexPath, 'utf8');
const gameBuild = stamp.replace(/[- :]/g, '');
const replacedIndex = index.replace(/var GAME_BUILD = '[^']*';/, `var GAME_BUILD = '${gameBuild}';`);
if (replacedIndex === index) {
  console.error('NG: index.html の GAME_BUILD 宣言が見つかりませんでした');
  process.exit(1);
}
fs.writeFileSync(GAME_SYSTEM, replaced);
fs.writeFileSync(path.join(REPO_ROOT, 'monster-hero', 'version.json'), `{"build": "${stamp}"}\n`);
fs.writeFileSync(indexPath, replacedIndex);

console.log(`BUILD_DATE、version.json、GAME_BUILD を ${stamp} に更新しました`);
console.log('※ data/changelog.js に追記する日時もこの値に合わせてください');
