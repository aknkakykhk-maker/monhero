#!/usr/bin/env node
// 「開かずに済ませる」ための入口。where.js（探す）の続きで、**必要なところだけ切り出す**。
//
// このリポジトリには 60-app.jsx(1.5MB) や RHYTHM_MODE.md(0.5MB) のように、
// 一度でも全文を開くと以降のやりとり全部にその中身が乗り続けるファイルがある。
// where.js は「どこにあるか」までは返すが、そこから先は人が sed の範囲を当て推量していた。
// 範囲を外すと読み直しになり、結局2回ぶん流れ込む。ここはその当て推量を無くすためのもの。
//
//   node tools/ctx.js brief                  … いまの状態（ブランチ・変更・通すべき検査）を数行で
//   node tools/ctx.js find <語>              … 定義を探す（where.js へ委譲）
//   node tools/ctx.js text <語>              … 本文を探す（where.js --text へ委譲）
//   node tools/ctx.js read <ファイル> <名前>  … その定義の本体だけを切り出す（終端は自動判定）
//   node tools/ctx.js read <ファイル> <行>    … その行の前後だけ（-C で幅、既定20行）
//   node tools/ctx.js toc <ファイル>          … 見出し／骨格の一覧（.md も .js も）
//   node tools/ctx.js doc <ファイル> <見出し> … その節だけ
//   node tools/ctx.js rules [語]             … ルール（CLAUDE.md / AGENTS.md / docs/rules）の該当節だけ
//   node tools/ctx.js diff [パス…]           … 生成物を除いた差分（素の git diff の代わり）
//
// 共通のオプション: --max <行数>（切り出しの上限） --width <字数>（1行の上限）
// 出力は必ず上限で止め、「どこを見れば続きがあるか」を最後に出す。全文を出さないための道具なので、
// --max を大きくするのは本当に必要なときだけにする。

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// build.js が作り直すぶん。中身を読む意味が無く、差分に出ると数MB流れ込む
const GENERATED = [
  'monster-hero/game-system.compiled.js',
  'monster-hero/src/game-system.jsx',
  'monster-hero/tailwind.css',
  'monster-hero/version.json',
  'tools/package-lock.json',
];

const DEFAULT_MAX = 200;
const DEFAULT_WIDTH = 200;

function resolveFile(rel) {
  if (!rel) return null;
  const cands = [path.resolve(ROOT, rel), path.resolve(process.cwd(), rel), path.resolve(rel)];
  for (const c of cands) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
}

function relOf(file) { return path.relative(ROOT, file) || path.basename(file); }

function readLines(file) { return fs.readFileSync(file, 'utf8').split('\n'); }

function cut(s, width) {
  const t = String(s).replace(/\s+$/, '');
  return t.length > width ? t.slice(0, width) + ' …' : t;
}

// 行番号つきで範囲を出す。上限を超えたら止めて、続きの見かたを出す
function printRange(file, lines, from, to, opts, note) {
  const rel = relOf(file);
  const total = to - from + 1;
  const shown = Math.min(total, opts.max);
  const end = from + shown - 1;
  console.log(`=== ${rel}:${from}-${to}  ${total}行${note ? '  ' + note : ''} ===`);
  for (let i = from; i <= end; i++) console.log(`${String(i).padStart(6)}  ${cut(lines[i - 1] ?? '', opts.width)}`);
  if (end < to) console.log(`… 残り ${to - end} 行は省略。続きは  sed -n '${end + 1},${to}p' ${rel}`);
}

// ---- 定義の終わりを見つける -------------------------------------------------
// 文字列・コメント・テンプレートリテラル・正規表現リテラルを飛ばしながら括弧を数える。
// JSX の本文にある「{」「}」は式の開閉なので釣り合っている（釣り合っていない状態は
// jsx-text-brace-check.js が別に弾く不具合）。
function findBlockEnd(lines, startLine, hardCap) {
  let depth = 0, started = false;
  let inBlockComment = false, quote = null;
  const limit = Math.min(lines.length, startLine + hardCap);
  for (let ln = startLine; ln <= limit; ln++) {
    const s = lines[ln - 1] ?? '';
    // その行の途中でいったん深さ0に戻っても、同じ行でまた開くなら終わりではない。
    //   function F({ a, b }) {      ← 「})」で0に戻るが、直後の「{」で本体が始まる
    let candidate = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i], n = s[i + 1];
      if (inBlockComment) { if (c === '*' && n === '/') { inBlockComment = false; i++; } continue; }
      if (quote) {
        if (c === '\\') { i++; continue; }
        if (c === quote) quote = null;
        continue;
      }
      if (c === '/' && n === '/') break;                       // 行コメント
      if (c === '/' && n === '*') { inBlockComment = true; i++; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '`') { quote = '`'; continue; }
      if (c === '/' ) {
        // 正規表現リテラルらしいか（直前が演算子・開き括弧なら、割り算ではない）。
        // JSX の自己終了タグ「…}/>」を正規表現と取り違えると、その先の「)」「}」を食べて
        // 括弧の数が合わなくなる。直前の「}」と、直後が「>」の形は正規表現から外す。
        const before = s.slice(0, i).replace(/\s+$/, '');
        if (n !== '>' && (/[(,=:[!&|?{;+\-*%^~]$/.test(before) || before === '')) {
          for (let j = i + 1; j < s.length; j++) {
            if (s[j] === '\\') { j++; continue; }
            if (s[j] === '[') { while (j < s.length && s[j] !== ']') { if (s[j] === '\\') j++; j++; } continue; }
            if (s[j] === '/') { i = j; break; }
          }
        }
        continue;
      }
      if (c === '{' || c === '(' || c === '[') { depth++; started = true; candidate = false; continue; }
      if (c === '}' || c === ')' || c === ']') {
        depth--;
        if (started && depth <= 0) candidate = true;
        continue;
      }
    }
    if (candidate && depth <= 0) return ln;
    // 括弧が開かないまま「;」で終わる1行定義
    if (!started && /[;,]\s*(\/\/.*)?$/.test(s)) return ln;
  }
  return null;
}

// 括弧の数え上げが外れたときの控え。「次に出てくる同じ深さの定義の手前」までを本体とみなす
// （素のインデントだけで見ると、引数リストが複数行にまたがる関数で必ず外れる）
const OUTLINE_RE = /^(\s*)(?:export\s+)?(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=|([A-Za-z_$][\w$]*)\s*:\s*(?:\(|async|function))/;

function findIndentEnd(lines, startLine, hardCap) {
  const base = (lines[startLine - 1] || '').match(/^\s*/)[0].length;
  const limit = Math.min(lines.length, startLine + hardCap);
  for (let ln = startLine + 1; ln <= limit; ln++) {
    const s = lines[ln - 1];
    if (!s || !s.trim()) continue;
    const indent = s.match(/^\s*/)[0].length;
    if (indent > base) continue;
    if (OUTLINE_RE.test(s) || /^\s*[})\]];?\s*$/.test(s)) return ln - 1;
  }
  return Math.min(lines.length, limit);
}

// 範囲の中にある定義の一覧。長すぎて切った定義の「中の地図」を出すために使う
function outlineOf(lines, from, to, baseIndent, limit) {
  const out = [];
  for (let ln = from + 1; ln <= to && out.length < limit; ln++) {
    const m = OUTLINE_RE.exec(lines[ln - 1] || '');
    if (!m) continue;
    const indent = m[1].length;
    if (indent > baseIndent + 4) continue;
    out.push({ line: ln, name: m[2] || m[3] || m[4], indent });
  }
  return out;
}

const NAME_DEF_RE = name => new RegExp(
  `^\\s*(?:export\\s+)?(?:async\\s+)?(?:` +
  `function\\s+${name}\\b` +
  `|(?:const|let|var)\\s+${name}\\b` +
  `|${name}\\s*:\\s*(?:\\(|async|function|\\{)` +
  `|${name}\\s*\\([^)]*\\)\\s*\\{` +
  `)`);

function cmdRead(argv, opts) {
  const file = resolveFile(argv[0]);
  if (!file) { console.error(`NG: ${argv[0]} が見つかりません`); process.exit(1); }
  const target = argv[1];
  const lines = readLines(file);

  if (!target) { console.error('NG: 定義の名前か行番号を渡してください'); process.exit(1); }

  // 行番号 / 行範囲
  const asRange = /^(\d+)(?:[-:,](\d+))?$/.exec(target);
  if (asRange) {
    const a = Number(asRange[1]);
    if (asRange[2]) { printRange(file, lines, a, Number(asRange[2]), opts); return; }
    const c = opts.context;
    printRange(file, lines, Math.max(1, a - c), Math.min(lines.length, a + c), opts, `(${a}行目の前後${c}行)`);
    return;
  }

  // 名前で定義を探す
  const re = NAME_DEF_RE(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const hits = [];
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) hits.push(i + 1);
  if (!hits.length) {
    console.log(`「${target}」の定義が ${relOf(file)} に見つかりませんでした。`);
    console.log(`探すなら:  node tools/ctx.js find ${target}    /    node tools/ctx.js text ${target}`);
    process.exit(1);
  }
  if (hits.length > 3) {
    console.log(`「${target}」らしい定義が ${hits.length} 件あります。行番号を指定してください:`);
    for (const ln of hits.slice(0, 20)) console.log(`  ${relOf(file)}:${ln}  ${cut(lines[ln - 1].trim(), opts.width)}`);
    return;
  }
  for (const start of hits) {
    const cap = 20000;
    const byBrace = findBlockEnd(lines, start, cap);
    const end = byBrace || findIndentEnd(lines, start, cap);
    printRange(file, lines, start, end, opts, byBrace ? '' : '(括弧が閉じきらないので次の定義の手前まで)');
    // 上限で切ったときは、中にある定義の地図を出す。当て推量で sed を打ち直さずに済む
    if (end - start + 1 > opts.max) {
      const base = (lines[start - 1] || '').match(/^\s*/)[0].length;
      const inner = outlineOf(lines, start, end, base, 30);
      if (inner.length) {
        console.log(`--- この中にある定義 (${inner.length}件) ---`);
        for (const d of inner) console.log(`${String(d.line).padStart(6)}  ${' '.repeat(Math.max(0, d.indent - base))}${d.name}`);
        console.log(`読むときは  node tools/ctx.js read ${relOf(file)} <名前>  か  node tools/ctx.js read ${relOf(file)} <行>`);
      }
    }
    console.log('');
  }
}

// ---- 見出し / 骨格 ----------------------------------------------------------
function mdHeadings(lines) {
  const out = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i];
    if (/^\s*```/.test(s)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.*)$/.exec(s);
    if (m) out.push({ line: i + 1, level: m[1].length, title: m[2].trim() });
  }
  return out;
}

function cmdToc(argv, opts) {
  const file = resolveFile(argv[0]);
  if (!file) { console.error(`NG: ${argv[0]} が見つかりません`); process.exit(1); }
  const rel = relOf(file);
  const lines = readLines(file);
  if (/\.md$/i.test(file)) {
    const hs = mdHeadings(lines);
    console.log(`# ${rel} の見出し (${hs.length}件 / 全${lines.length}行)`);
    for (const h of hs.slice(0, opts.max)) {
      const next = hs.find(x => x.line > h.line);
      const len = (next ? next.line : lines.length + 1) - h.line;
      console.log(`${String(h.line).padStart(6)}  ${'  '.repeat(h.level - 1)}${cut(h.title, opts.width - 20)}  (${len}行)`);
    }
    if (hs.length > opts.max) console.log(`… ほか ${hs.length - opts.max} 件`);
    console.log(`\n節だけ読む:  node tools/ctx.js doc ${rel} <見出しの一部>`);
    return;
  }
  if (/\.json$/i.test(file)) {
    let data; try { data = JSON.parse(lines.join('\n')); } catch { console.error('NG: JSONとして読めません'); process.exit(1); }
    const keys = Array.isArray(data) ? [`(配列 ${data.length}件)`] : Object.keys(data);
    console.log(`# ${rel} のトップレベル (${keys.length}件)`);
    for (const k of keys.slice(0, opts.max)) console.log(`  ${k}`);
    if (keys.length > opts.max) console.log(`… ほか ${keys.length - opts.max} 件`);
    return;
  }
  // js / jsx は where.js の骨格に任せる（作りを1か所にまとめる）
  const r = spawnSync('node', [path.join(__dirname, 'where.js'), '--outline', rel, '--limit', String(opts.max)], { cwd: ROOT, encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  if (r.stderr) process.stderr.write(r.stderr);
}

function cmdDoc(argv, opts) {
  const file = resolveFile(argv[0]);
  if (!file) { console.error(`NG: ${argv[0]} が見つかりません`); process.exit(1); }
  const needle = argv.slice(1).join(' ');
  if (!needle) return cmdToc(argv, opts);
  const lines = readLines(file);
  const hs = mdHeadings(lines);
  const lower = needle.toLowerCase();
  const found = hs.filter(h => h.title.toLowerCase().includes(lower));
  if (!found.length) {
    console.log(`「${needle}」を含む見出しがありません。一覧:  node tools/ctx.js toc ${relOf(file)}`);
    process.exit(1);
  }
  for (const h of found.slice(0, 5)) {
    const next = hs.find(x => x.line > h.line && x.level <= h.level);
    printRange(file, lines, h.line, (next ? next.line - 1 : lines.length), opts);
    console.log('');
  }
  if (found.length > 5) console.log(`… ほか ${found.length - 5} 件の見出しが一致しています`);
}

// ---- ルール -----------------------------------------------------------------
function ruleFiles() {
  const out = [];
  for (const rel of ['CLAUDE.md', 'AGENTS.md']) if (fs.existsSync(path.join(ROOT, rel))) out.push(path.join(ROOT, rel));
  const dir = path.join(ROOT, 'docs/rules');
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.md')) out.push(path.join(dir, f));
  return out;
}

function cmdRules(argv, opts) {
  const needle = argv.join(' ').toLowerCase();
  const files = ruleFiles();
  if (!needle) {
    console.log('# ルールの見出し一覧（節だけ読むには  node tools/ctx.js rules <語>）');
    for (const f of files) {
      const lines = readLines(f);
      const hs = mdHeadings(lines);
      console.log(`\n[${relOf(f)}]  ${lines.length}行 / ${(fs.statSync(f).size / 1024).toFixed(1)}KB`);
      for (const h of hs) if (h.level <= 3) console.log(`${String(h.line).padStart(6)}  ${'  '.repeat(h.level - 1)}${cut(h.title, opts.width - 20)}`);
    }
    return;
  }
  // 一致した「行」を、それを含むいちばん内側の見出しへ結び付ける。
  // 見出しの本文で見ると、いちばん外側の見出し（＝ファイル全体）が必ず当たってしまう。
  let shown = 0, hitTotal = 0;
  for (const f of files) {
    const lines = readLines(f);
    const hs = mdHeadings(lines);
    const owners = new Set();
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].toLowerCase().includes(needle)) continue;
      let owner = null;
      for (const h of hs) { if (h.line <= i + 1) owner = h; else break; }
      if (owner) owners.add(owner.line);
    }
    for (const line of [...owners].sort((a, b) => a - b)) {
      hitTotal++;
      if (shown >= 4) continue;
      const h = hs.find(x => x.line === line);
      const next = hs.find(x => x.line > h.line && x.level <= h.level);
      printRange(f, lines, h.line, next ? next.line - 1 : lines.length, opts);
      console.log('');
      shown++;
    }
  }
  if (hitTotal > shown) console.log(`… ほか ${hitTotal - shown} 節が一致しています。語を絞ってください。`);
  if (hitTotal) return;
  if (!shown) console.log(`「${argv.join(' ')}」に触れているルールの節はありません。一覧:  node tools/ctx.js rules`);
}

// ---- git --------------------------------------------------------------------
function git(args, opts = {}) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  return (r.stdout || '').replace(/\n$/, '');
}

function excludePathspec() { return GENERATED.map(p => `:(exclude)${p}`); }

function cmdDiff(argv, opts) {
  const paths = argv.filter(a => !a.startsWith('--'));
  const staged = argv.includes('--staged') || argv.includes('--cached');
  const withGenerated = argv.includes('--all');
  const base = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : null;
  const range = base ? [base] : [];
  const spec = ['--', ...(paths.length ? paths : ['.']), ...(withGenerated ? [] : excludePathspec())];
  const flags = staged ? ['--cached'] : [];

  const stat = git(['diff', ...flags, ...range, '--stat', ...spec]);
  console.log(stat || '（差分なし）');
  if (!withGenerated) {
    const gen = git(['diff', ...flags, ...range, '--name-only', '--', ...GENERATED]).split('\n').filter(Boolean);
    if (gen.length) console.log(`\n生成物 ${gen.length} 件は省略（build.js が作り直すぶん）: ${gen.map(p => path.basename(p)).join(', ')}`);
  }
  const files = git(['diff', ...flags, ...range, '--name-only', ...spec]).split('\n').filter(Boolean);
  if (!files.length) return;
  console.log('');
  let budget = opts.max;
  for (const f of files) {
    if (budget <= 0) { console.log(`… 残り ${files.length - files.indexOf(f)} ファイルは上限（--max ${opts.max}行）で省略`); break; }
    const body = git(['diff', ...flags, ...range, '--', f]).split('\n');
    const perFile = Math.min(body.length, budget, 200);
    console.log(body.slice(0, perFile).map(l => cut(l, opts.width)).join('\n'));
    if (perFile < body.length) console.log(`… ${f} の残り ${body.length - perFile} 行は省略（git diff -- ${f}）`);
    budget -= perFile;
  }
}

function cmdBrief(argv, opts) {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']) || '（追跡先なし）';
  console.log(`ブランチ: ${branch}  →  ${upstream}`);
  const status = git(['status', '--porcelain']).split('\n').filter(Boolean);
  const gen = status.filter(l => GENERATED.some(g => l.includes(g)));
  const src = status.filter(l => !GENERATED.some(g => l.includes(g)));
  console.log(`未コミットの変更: ${src.length} 件（ほかに生成物 ${gen.length} 件）`);
  for (const l of src.slice(0, 20)) console.log(`  ${cut(l, opts.width)}`);
  if (src.length > 20) console.log(`  … ほか ${src.length - 20} 件`);
  console.log('\n直近のコミット:');
  for (const l of git(['log', '--oneline', '-3']).split('\n').filter(Boolean)) console.log(`  ${cut(l, opts.width)}`);
  console.log('\n次に打つもの:');
  console.log('  node tools/run-checks.js --changed     … 変更内容から必要な検査を選んで回す');
  console.log('  node tools/ctx.js diff                 … 生成物を除いた差分を見る');
  console.log('  node tools/ctx.js rules <語>           … 関係するルールの節だけ読む');
}

function cmdWhere(sub, argv, opts) {
  const args = [path.join(__dirname, 'where.js')];
  if (sub === 'text') args.push('--text');
  args.push(...argv, '--limit', String(Math.min(opts.max, 60)), '--width', String(opts.width));
  const r = spawnSync('node', args, { cwd: ROOT, encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  if (r.stderr) process.stderr.write(r.stderr);
  process.exitCode = r.status || 0;
}

function usage() {
  const src = fs.readFileSync(__filename, 'utf8').split('\n').slice(1);
  const head = [];
  for (const l of src) { if (!l.startsWith('//')) break; head.push(l.replace(/^\/\/ ?/, '')); }
  console.log(head.join('\n'));
}

function main() {
  const argv = process.argv.slice(2);
  const opts = { max: DEFAULT_MAX, width: DEFAULT_WIDTH, context: 20 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--max') opts.max = Number(argv[++i]) || opts.max;
    else if (a === '--width') opts.width = Number(argv[++i]) || opts.width;
    else if (a === '-C' || a === '--context') opts.context = Number(argv[++i]) || opts.context;
    else rest.push(a);
  }
  const sub = rest.shift();
  switch (sub) {
    case undefined: case '--help': case '-h': case 'help': return usage();
    case 'brief': return cmdBrief(rest, opts);
    case 'find': case 'text': return cmdWhere(sub, rest, opts);
    case 'read': return cmdRead(rest, opts);
    case 'toc': return cmdToc(rest, opts);
    case 'doc': return cmdDoc(rest, opts);
    case 'rules': return cmdRules(rest, opts);
    case 'diff': return cmdDiff(rest, opts);
    default:
      console.error(`NG: 知らないコマンド「${sub}」`);
      usage();
      process.exit(1);
  }
}

if (require.main === module) main();

// 検査から終端判定だけを使えるようにしておく（作りを1か所にまとめるため）
if (require.main !== module) module.exports = { findBlockEnd, findIndentEnd, outlineOf, mdHeadings, OUTLINE_RE };
