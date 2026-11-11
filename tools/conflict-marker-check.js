// マージのぶつかりの印(行頭の <<<<<<< / ======= / >>>>>>>)が、配信されるファイルに残っていないかを見る。
// 経緯(2026-11-11): #5487 のマージで monster-hero/index.html に印が3か所残り、本番の起動が止まった。
//   生成物(index.html・asset-manifest.json・version.json など)は build が上書きしてくれると思い込みやすい。
//   構文を見る検査は、印が文字列やコメントの中に紛れると気づけないので、行頭の印そのものを機械で探す。
//
//   node tools/conflict-marker-check.js
//
// 見るもの: git が管理している monster-hero/ の .html .js .json .css .jsx(絵・音の入れ物は除く)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const EXT = /\.(html|js|json|css|jsx)$/;
const SKIP = /^monster-hero\/(images|audio)\//;
const MARK = /^(<{7}( |$)|>{7}( |$)|={7}$)/;

let files;
try {
  files = execFileSync('git', ['ls-files', 'monster-hero'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
} catch (_) {
  files = [];
  const walk = (d) => { for (const n of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const p = `${d}/${n.name}`; if (n.isDirectory()) { if (n.name !== 'node_modules') walk(p); } else files.push(p); } };
  walk('monster-hero');
}
files = files.filter(f => EXT.test(f) && !SKIP.test(f) && fs.existsSync(path.join(ROOT, f)));

const hits = [];
for (const f of files) {
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) if (MARK.test(lines[i].replace(/\r$/, ''))) hits.push(`${f}:${i + 1}  ${lines[i].slice(0, 40)}`);
}
if (hits.length) {
  console.log(`NG: ぶつかりの印が ${hits.length} か所残っています(解消して node tools/build.js を回し直す。生成物は node tools/merge-main.js が扱う)`);
  hits.slice(0, 20).forEach(h => console.log('  - ' + h));
  process.exit(1);
}
console.log(`OK: ぶつかりの印は残っていません(${files.length} ファイル)`);
