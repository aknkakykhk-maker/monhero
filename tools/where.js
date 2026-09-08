#!/usr/bin/env node
// 大きいファイルを開かずに「どこに何があるか」だけを返す道具。
//
// このリポジトリには1ファイルで数MBのものがある(とくに src/parts/60-app.jsx は
// 15000行あまりが丸ごと1つの関数)。全文を開くと、AIエージェントの文脈も人の
// 集中力もそこで尽きる。「探す」と「読む」を分けるためのもの。
//
// 使い方:
//   node tools/where.js <語>                … 定義(const / function / 画面)を名前で探す
//   node tools/where.js --text <語>         … 本文をふつうに検索する
//   node tools/where.js --outline <ファイル> … そのファイルの骨格(定義の一覧)を出す
//   node tools/where.js --screens           … 画面(gameState)の名前を一覧にする
//
// 見つけた行番号を使って、必要なところだけを読むこと。
//   sed -n '1200,1320p' monster-hero/src/parts/60-app.jsx
//
// 出力は既定で40件、1行110字まで(--limit N / --width N で変えられる)。
// 生成物(game-system.jsx / *.compiled.js)は常に対象外。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEARCH_ROOTS = ['monster-hero/src/parts', 'monster-hero/data'];
const EXCLUDE = /(game-system\.jsx|\.compiled\.js|node_modules|\.min\.js)/;

// 定義らしい行。const/let/var の代入、function 宣言、オブジェクトの中の関数、Reactのフック。
const DEF_RE = /^(\s*)(?:export\s+)?(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=|([A-Za-z_$][\w$]*)\s*:\s*(?:\(|async|function))/;

function collectFiles() {
  const out = [];
  for (const rel of SEARCH_ROOTS) {
    const dir = path.join(ROOT, rel);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (EXCLUDE.test(full)) continue;
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        for (const inner of fs.readdirSync(full)) {
          const f = path.join(full, inner);
          if (!EXCLUDE.test(f) && /\.(jsx?|json)$/.test(inner) && fs.statSync(f).isFile()) out.push(f);
        }
      } else if (/\.(jsx?)$/.test(name)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

function relOf(f) { return path.relative(ROOT, f); }

function eachLine(file, fn) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) fn(lines[i], i + 1);
}

function cut(s, width) {
  const t = s.replace(/\s+$/, '');
  return t.length > width ? t.slice(0, width) + ' …' : t;
}

function printHits(hits, limit, width) {
  if (hits.length === 0) { console.log('見つかりませんでした。--text で本文も探せます。'); return; }
  for (const h of hits.slice(0, limit)) {
    console.log(`${h.file}:${h.line}  ${cut(h.text.trim(), width)}`);
  }
  if (hits.length > limit) {
    console.log(`… ほか ${hits.length - limit} 件(--limit ${Math.min(hits.length, limit * 3)} で増やせます)`);
  }
  console.log(`\n読むときは全文を開かず、行番号で切り出すこと:  sed -n '開始,終了p' <ファイル>`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 20).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
    process.exit(0);
  }

  let limit = 40, width = 110, mode = 'def', word = null, target = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') limit = Number(argv[++i]) || limit;
    else if (a === '--width') width = Number(argv[++i]) || width;
    else if (a === '--text') mode = 'text';
    else if (a === '--screens') mode = 'screens';
    else if (a === '--outline') { mode = 'outline'; target = argv[++i]; }
    else if (!word) word = a;
  }

  const files = collectFiles();

  if (mode === 'outline') {
    if (!target) { console.error('NG: --outline にはファイルを渡してください'); process.exit(1); }
    const file = path.isAbsolute(target) ? target : path.join(ROOT, target);
    if (!fs.existsSync(file)) { console.error(`NG: ${target} がありません`); process.exit(1); }
    const hits = [];
    eachLine(file, (text, line) => {
      const m = DEF_RE.exec(text);
      if (!m) return;
      const indent = m[1].length;
      if (indent > 4) return; // 深いところは骨格ではない
      const name = m[2] || m[3] || m[4];
      hits.push({ file: relOf(file), line, text: `${' '.repeat(indent)}${name}` });
    });
    console.log(`# ${relOf(file)} の骨格 (${hits.length}件)`);
    printHits(hits, limit, width);
    return;
  }

  if (mode === 'screens') {
    const seen = new Map();
    for (const f of files) {
      eachLine(f, (text, line) => {
        const re = /setGameState\(\s*'([A-Z][A-Z0-9_]*)'|gameState\s*===\s*'([A-Z][A-Z0-9_]*)'/g;
        let m;
        while ((m = re.exec(text))) {
          const name = m[1] || m[2];
          if (!seen.has(name)) seen.set(name, `${relOf(f)}:${line}`);
        }
      });
    }
    console.log(`# 画面(gameState)の一覧 (${seen.size}件)  ※場所は最初に出てきたところ`);
    for (const [name, at] of [...seen].sort()) console.log(`${name.padEnd(28)} ${at}`);
    return;
  }

  if (!word) { console.error('NG: 探す語を渡してください'); process.exit(1); }
  const needle = word.toLowerCase();
  const hits = [];
  for (const f of files) {
    eachLine(f, (text, line) => {
      if (!text.toLowerCase().includes(needle)) return;
      if (mode === 'text') { hits.push({ file: relOf(f), line, text }); return; }
      const m = DEF_RE.exec(text);
      if (!m) return;
      const name = m[2] || m[3] || m[4];
      if (name && name.toLowerCase().includes(needle)) hits.push({ file: relOf(f), line, text });
    });
  }
  console.log(`# 「${word}」${mode === 'text' ? 'を含む行' : 'の定義'} (${hits.length}件)`);
  printHits(hits, limit, width);
}

main();
