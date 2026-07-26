// data/images-*.js の中で、まったく同じ base64 が複数の変数に重複して埋め込まれている箇所を
// 「先に定義した変数への参照」に書き換える。画像そのものは1バイトも変えないため、
// 表示・染色の結果は完全に同一で、ファイルサイズだけが減る。
//
//   node dedupe-images.js --dry-run   … 何が置き換わるか表示するだけ
//   node dedupe-images.js             … 実際に書き換える
//
// 立ち絵(_IMG)→全身アイコン(_ICON)→顔アイコン(_FACE_ICON)の順に宣言されているので、
// 常に「最初に現れた変数」を実体として残せば、参照が定義より前に来ることはない。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { REPO_ROOT } = require('./harness');

const FILES = ['images/images-ally.js', 'images/images-enemy.js', 'breeder.js'];
const dryRun = process.argv.includes('--dry-run');

// `const NAME = "data:image/...;base64,...."` の宣言を、文字列リテラルの範囲込みで拾う
function findDeclarations(src) {
  const re = /const\s+([A-Za-z0-9_$]+)\s*=\s*(["'`])(data:image\/[a-z+]+;base64,)/g;
  const decls = [];
  let m;
  while ((m = re.exec(src))) {
    const quote = m[2];
    const valueStart = m.index + m[0].length - m[3].length; // 引用符の直後
    const valueEnd = src.indexOf(quote, valueStart);
    if (valueEnd < 0) continue;
    decls.push({
      name: m[1],
      // 置き換える範囲は開き引用符から閉じ引用符まで
      literalStart: valueStart - 1,
      literalEnd: valueEnd + 1,
      payload: src.slice(valueStart, valueEnd),
    });
  }
  return decls;
}

let totalSaved = 0;
for (const f of FILES) {
  const p = path.join(REPO_ROOT, 'monster-hero', 'data', f);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  const decls = findDeclarations(src);

  const firstByHash = new Map();
  const edits = [];
  for (const d of decls) {
    const hash = crypto.createHash('md5').update(d.payload).digest('hex');
    if (!firstByHash.has(hash)) { firstByHash.set(hash, d.name); continue; }
    edits.push({ ...d, target: firstByHash.get(hash) });
  }

  if (!edits.length) { console.log(`${f}: 重複なし`); continue; }

  // 後ろから書き換えれば、前方のインデックスがずれない
  let out = src;
  for (const e of [...edits].reverse()) {
    out = out.slice(0, e.literalStart) + e.target + out.slice(e.literalEnd);
  }
  const saved = src.length - out.length;
  totalSaved += saved;
  console.log(`${f}: ${edits.length}件を参照に置き換え  ${(src.length / 1024 / 1024).toFixed(2)} MB → ${(out.length / 1024 / 1024).toFixed(2)} MB (-${(saved / 1024 / 1024).toFixed(2)} MB)`);
  for (const e of edits) console.log(`  ${e.name} = ${e.target}`);
  if (!dryRun) fs.writeFileSync(p, out);
}

console.log(`\n合計 ${(totalSaved / 1024 / 1024).toFixed(2)} MB 削減${dryRun ? '(--dry-run のため書き込みなし)' : ''}`);
