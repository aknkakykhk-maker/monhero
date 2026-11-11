#!/usr/bin/env node
// 部署別の手引き(docs/depts/<部>.md)を、部の一覧(tools/team/depts.json)から作る・確かめる。
//
//   node tools/ctx.js dept              … 部の一覧
//   node tools/ctx.js dept <部>         … その部の手引きを出す(部の id・名前・部長の名前のどれでも)
//   node tools/ctx.js dept --of <ファイル> … そのファイルを受け持つ部
//   node tools/team/dept-guide.js --write … docs/depts/*.md を作り直す(depts.json を直したら打つ)
//   node tools/team/dept-guide.js --check … 書いてあるファイル・入口の関数・資料が実在するか、手引きが古くないか
//
// 【なぜあるか】
// 新しい会話が「自分の部はどのファイルを見ればよいか」を毎回 grep で探し、関係のない決まりまで読んでいた
// (2026-11-11 社長「トークンを無駄に使わない仕組み」案F)。部ごとに1枚にして、最初にそれだけ読めば始められるようにする。
// 手で書いた資料は古くなるので、正本は depts.json に1つだけ持ち、--check が実在を確かめる(rules-index-check.js から呼ぶ)。
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, loadDepts, expand, toRegex, findDept, deptsOfFile, git, deptList } = require('./lib');

const OUT_DIR = path.join(ROOT, 'docs', 'depts');

const fileSizeNote = (rel) => {
  try { const s = fs.statSync(path.join(ROOT, rel)).size; return s > 400 * 1024 ? `(${(s / 1024 / 1024).toFixed(1)}MB・開かない)` : ''; } catch (e) { return ''; }
};

function render(d) {
  const L = [];
  L.push(`# ${d['部']}の手引き`, '');
  L.push('<!-- このファイルは tools/team/depts.json から作っている。直すのは depts.json。作り直し: node tools/team/dept-guide.js --write -->', '');
  L.push(`部長: ${d['部長']} / 受け持ち: ${d['受け持ち']}`, '');
  L.push('## 最初に打つもの', '', '```');
  L.push(`node tools/ctx.js decisions ${d.id}     社長の決めごと(進め方 + この部に関わる行だけ)`);
  L.push('node tools/ctx.js brief               いまの状態');
  L.push('```', '');
  if (d.files.length) {
    L.push('## 受け持つファイル', '');
    for (const p of d.files) {
      const e = expand(p);
      L.push(`- \`${e}\`${e.includes('*') ? '' : fileSizeNote(e)}`);
    }
    L.push('');
  }
  if (d['入口'].length) {
    L.push('## 入口の関数', '', '本体だけ読む: `node tools/ctx.js read <名前>` / 使っている場所: `node tools/ctx.js refs <名前>`', '');
    L.push(d['入口'].map(n => `\`${n}\``).join(' / '), '');
  }
  L.push('## 回す検査', '');
  for (const c of d['検査']) L.push(`- ${c}`);
  L.push('- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)', '');
  L.push('## 関係する決まり', '');
  for (const r of d['決まり']) L.push(`- ${r}`);
  L.push('');
  if (d['資料'].length) {
    L.push('## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)', '');
    for (const f of d['資料']) L.push(`- [\`${f}\`](../../${f})`);
    L.push('');
  }
  if (d['板'].length) {
    L.push('## 仕事の板・残りの仕事', '');
    for (const f of d['板']) L.push(`- [\`${f}\`](../../${f})`);
    L.push('');
  }
  L.push('会話が長くなったら: `node tools/ctx.js handoff ' + d.id + ' --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))', '');
  return L.join('\n');
}

function renderIndex(depts) {
  const L = ['# 部署別の手引き', '',
    '<!-- このファイルは tools/team/depts.json から作っている。作り直し: node tools/team/dept-guide.js --write -->', '',
    '新しい会話は、CLAUDE.md のあと**自分の部の1枚だけ**を読んで始める。ほかの部の手引きは読まない。',
    'どの部のファイルか分からないとき: `node tools/ctx.js dept --of <ファイル>`', '',
    '| 部 | 部長 | 受け持ち | 手引き |', '| --- | --- | --- | --- |'];
  for (const d of depts) L.push(`| ${d['部']} | ${d['部長']} | ${d['受け持ち']} | [\`${d.id}.md\`](${d.id}.md) |`);
  L.push('', '部を足す・受け持ちを変えるとき: `tools/team/depts.json` を直して `node tools/team/dept-guide.js --write`。', '');
  return L.join('\n');
}

function check() {
  const problems = [];
  const depts = loadDepts();
  const tracked = git(['ls-files']).split('\n').filter(Boolean);
  const ids = new Set();
  for (const d of depts) {
    if (ids.has(d.id)) problems.push(`部の id が重なっています: ${d.id}`);
    ids.add(d.id);
    const mine = [];
    for (const p of d.files) {
      const re = toRegex(p);
      const hit = tracked.filter(f => re.test(f));
      if (!hit.length) problems.push(`${d.id}: 受け持つファイル「${p}」に当たるファイルがありません`);
      mine.push(...hit);
    }
    // 入口の関数が、受け持つファイルのどこかで定義されているか
    const srcs = mine.filter(f => /\.(jsx|js|ts)$/.test(f) && !/authoring\//.test(f));
    for (const name of d['入口']) {
      const re = new RegExp(`(?:function|const|let|class)\\s+${name}\\b`);
      if (!srcs.some(f => { try { return re.test(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { return false; } })) {
        problems.push(`${d.id}: 入口の関数「${name}」の定義が、受け持つファイルに見つかりません`);
      }
    }
    for (const f of [...d['資料'], ...d['板']]) if (!fs.existsSync(path.join(ROOT, f))) problems.push(`${d.id}: 資料「${f}」がありません`);
    const out = path.join(OUT_DIR, `${d.id}.md`);
    if (!fs.existsSync(out)) problems.push(`docs/depts/${d.id}.md がありません(node tools/team/dept-guide.js --write)`);
    else if (fs.readFileSync(out, 'utf8') !== render(d)) problems.push(`docs/depts/${d.id}.md が depts.json と合っていません(node tools/team/dept-guide.js --write)`);
  }
  const idx = path.join(OUT_DIR, 'README.md');
  if (!fs.existsSync(idx) || fs.readFileSync(idx, 'utf8') !== renderIndex(depts)) problems.push('docs/depts/README.md が depts.json と合っていません(node tools/team/dept-guide.js --write)');
  // ゲーム本体の部品が、どの部にも入っていないまま増えていないか
  const orphans = tracked.filter(f => /^monster-hero\/src\/parts\/.*\.jsx$/.test(f) && !deptsOfFile(f).length);
  for (const f of orphans) problems.push(`どの部の受け持ちにも入っていない部品があります: ${f}(tools/team/depts.json の files に足す)`);
  return { problems, depts: depts.length };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--write')) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const depts = loadDepts();
    for (const d of depts) fs.writeFileSync(path.join(OUT_DIR, `${d.id}.md`), render(d));
    fs.writeFileSync(path.join(OUT_DIR, 'README.md'), renderIndex(depts));
    console.log(`OK: docs/depts/ に ${depts.length} 部の手引きを書いた`);
    return;
  }
  if (argv.includes('--check')) {
    const r = check();
    if (r.problems.length) { console.error(`NG: 部署別の手引きに ${r.problems.length} 件の問題`); for (const p of r.problems) console.error(`  - ${p}`); process.exit(1); }
    console.log(`OK: 部署別の手引き ${r.depts} 部(ファイル・入口の関数・資料が実在し、depts.json と合っている)`);
    return;
  }
  const of = argv.indexOf('--of');
  if (of >= 0) {
    const f = path.relative(ROOT, path.resolve(argv[of + 1] || '')).replace(/\\/g, '/');
    const ds = deptsOfFile(f);
    console.log(ds.length ? ds.map(d => `${d.id}  ${d['部']}(部長 ${d['部長']})  → docs/depts/${d.id}.md`).join('\n') : `どの部の受け持ちにも入っていません: ${f}`);
    return;
  }
  const word = argv.find(a => !a.startsWith('--'));
  if (!word) { console.log('部の一覧(node tools/ctx.js dept <部> でその部の手引き):\n' + deptList()); return; }
  const d = findDept(word);
  if (!d) { console.error(`NG: 「${word}」に当たる部がありません。\n${deptList()}`); process.exit(1); }
  process.stdout.write(render(d));
}

if (require.main === module) main();
module.exports = { check, render };
