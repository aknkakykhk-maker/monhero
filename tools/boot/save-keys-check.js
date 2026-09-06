const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 保存キー(mh_*)の一覧が docs/spec/SAVE_DATA.md に載っているかを確かめる。
//
//   node tools/boot/save-keys-check.js
//
// 【なぜ要るか】
// 保存キーは既存プレイヤーのデータそのものなので、名前を変えない・消さない・意味を変えないが最優先
// (CLAUDE.md ⑦)。ところが「どんなキーがあるか」は本体とデータに散らばった文字列でしか分からず、
// 2026-09-06 の監査では 90 個のうち 49 個が SAVE_DATA.md に載っていなかった。
// キーを足すときに一覧へも足すことを機械的に求め、「文書を見れば全部分かる」状態を保つ。
//
// 【見かた】
// ・monster-hero/src/parts/*.jsx と monster-hero/data/*.js の中の 'mh_…' / "mh_…" / `mh_…` を集める
// ・テンプレート文字列の途中で切れたもの(mh_hs_ など末尾が _)は「動的キーの接頭辞」として、
//   SAVE_DATA.md にその接頭辞が書いてあればよい(mh_hs_<難易度> のような書き方で載せる)
// ・保存キーではない mh_ 文字列(URL のクエリなど)は NOT_STORAGE_KEYS に理由つきで書く
const fs = require('fs');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const SPEC = path.join(root, 'docs/spec/SAVE_DATA.md');
const NOT_STORAGE_KEYS = {
  mh_: 'storeList / バックアップが使う接頭辞そのもの',
  mh_refresh: '更新のときに URL へ付けるクエリ。localStorage には保存しない',
};

const files = [
  ...fs.readdirSync(path.join(root, 'monster-hero/src/parts')).filter(f => f.endsWith('.jsx')).map(f => path.join('monster-hero/src/parts', f)),
  ...fs.readdirSync(path.join(root, 'monster-hero/data')).filter(f => f.endsWith('.js')).map(f => path.join('monster-hero/data', f)),
];
const used = new Map(); // key -> [files]
for (const rel of files) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const m of src.matchAll(/['"`](mh_[A-Za-z0-9_]*)/g)) {
    const key = m[1];
    if (!used.has(key)) used.set(key, new Set());
    used.get(key).add(rel);
  }
}
const spec = fs.readFileSync(SPEC, 'utf8');

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

check('保存キーの文字列を本体とデータから拾えている', used.size > 50, `${used.size}個`);

const missing = [];
for (const key of [...used.keys()].sort()) {
  if (NOT_STORAGE_KEYS[key]) continue;
  // 動的キーの接頭辞(末尾が _)は、SAVE_DATA.md に接頭辞として書いてあればよい
  if (!spec.includes(key)) missing.push(key);
}
check('本体・データが使う保存キーがすべて SAVE_DATA.md に載っている', missing.length === 0,
  missing.length ? `載っていない: ${missing.join(', ')}` : `${used.size - Object.keys(NOT_STORAGE_KEYS).length}個`);

// 逆方向(文書にあるがコードに無い)は、旧形式の読み取り互換で残すキーもあるので NG にはせず知らせるだけ
const documented = new Set([...spec.matchAll(/`(mh_[A-Za-z0-9_]*)/g)].map(m => m[1]));
const stale = [...documented].filter(k => ![...used.keys()].some(u => u === k || k.startsWith(u)));
if (stale.length) console.log(`(参考) SAVE_DATA.md にあるがコードに文字列が無いキー: ${stale.join(', ')}`);

console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
