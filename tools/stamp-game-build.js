// index.html の本体JSのキャッシュキー(GAME_BUILD)を、game-system.compiled.js の「中身のハッシュ」に合わせる(2026-10-27 速さ部)。
//
//   node stamp-game-build.js           … 打ち直す(ふつうは build.js が本体を書き出した直後に呼ぶ)
//   node stamp-game-build.js --check   … 打たれている値が本体の中身と合っているかだけ見る(合わなければ終了コード1)
//
// 【なぜ時刻ではなく中身か】
// 以前は stamp-version.js が「ビルドした時刻」(202610270126 の形)を打っていた。中身が同じでも作り直すたびに
// 版が変わり、事前ダウンロード(Service Worker)に本体をためても、版が合わずに取り直しになる。
// data/*.js・tailwind.css と同じく中身のハッシュにすれば「版が同じ = 中身が同じ」が必ず成り立ち、
// 版がぴったり同じときだけためた物を使う、という決まり(docs/progress/speed/download-plan.md)の土台になる。
// 時刻は BUILD_DATE と version.json に今までどおり残る(更新のお知らせはそちらで動く)。
//
// 【守ること】
// ・本体を書き出したあとに打つ(先に打つと、打った値と中身がずれる)
// ・index.html の先読み(__mhBoot.prefetch)と <script> の両方が同じ GAME_BUILD を使う(ずれると同じ本体を2回取る)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { REPO_ROOT } = require('./harness');

const COMPILED = path.join(REPO_ROOT, 'monster-hero', 'game-system.compiled.js');
const INDEX = path.join(REPO_ROOT, 'monster-hero', 'index.html');
const DECL = /var GAME_BUILD = '([^']*)';/;

const gameBuildOf = () => crypto.createHash('sha256').update(fs.readFileSync(COMPILED)).digest('hex').slice(0, 12);

function checkGameBuild() {
  if (!fs.existsSync(COMPILED)) return { ok: false, reason: 'game-system.compiled.js がありません' };
  const m = fs.readFileSync(INDEX, 'utf8').match(DECL);
  if (!m) return { ok: false, reason: 'index.html の GAME_BUILD 宣言が見つかりません' };
  const want = gameBuildOf();
  return m[1] === want ? { ok: true, value: want } : { ok: false, reason: `index.html の GAME_BUILD(${m[1]})が本体の中身(${want})と合いません` };
}

function stampGameBuild() {
  const index = fs.readFileSync(INDEX, 'utf8');
  if (!DECL.test(index)) throw new Error('index.html の GAME_BUILD 宣言が見つかりませんでした');
  const value = gameBuildOf();
  const next = index.replace(DECL, `var GAME_BUILD = '${value}';`);
  if (next !== index) fs.writeFileSync(INDEX, next);
  return { value, changed: next !== index };
}

module.exports = { gameBuildOf, checkGameBuild, stampGameBuild };

if (require.main === module) {
  if (process.argv.includes('--check')) {
    const r = checkGameBuild();
    console.log(r.ok ? `OK: GAME_BUILD は本体の中身のハッシュ(${r.value})` : `NG: ${r.reason}。node tools/build.js を実行してください`);
    process.exit(r.ok ? 0 : 1);
  }
  try {
    const r = stampGameBuild();
    console.log(`GAME_BUILD を ${r.value} にしました${r.changed ? '' : '(変わらず)'}`);
  } catch (e) { console.error(`NG: ${e.message}`); process.exit(1); }
}
