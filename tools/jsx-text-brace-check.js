// JSXの中に、閉じ忘れ・閉じすぎでできた「{」「}」がそのまま文字として
// 混ざっていないかを調べる。
//
// 条件を足すつもりで `{cond&&<div>…</div>}` の開き側だけ書き忘れると、
// 余った `}` はJSXの本文(ただの文字)として扱われるため、構文エラーにならない。
// 実際に、バトル画面のモードのタブへ条件を足したときに `}` が画面へ出てしまい、
// さらに条件自体も効いていない(ランキングでもタブが残る)という不具合を出した。
// check-syntax.js は文法として正しいので気づけない。ここで機械的に見つける。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'monster-hero/src/game-system.jsx');
const source = fs.readFileSync(file, 'utf8');

const ast = parser.parse(source, {
  sourceType: 'script',
  plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
});

const findings = [];
traverse(ast, {
  JSXText(p) {
    const raw = p.node.value;
    if (!/[{}]/.test(raw)) return;
    const line = p.node.loc.start.line;
    // その行の中身を、どこがおかしいか分かる形で残す
    const around = source.split('\n')[line - 1].trim().slice(0, 120);
    findings.push({ line, text: raw.trim().slice(0, 40), around });
  },
});

if (findings.length === 0) {
  console.log('OK: JSXの本文に「{」「}」が混ざっていない');
  console.log('\nすべてOK');
  process.exit(0);
}

for (const f of findings) {
  console.log(`NG: ${path.relative(root, file)}:${f.line} に「${f.text}」が文字として出ています`);
  console.log(`    ${f.around}`);
}
console.log('\n条件を足すときは、開き `{cond&&` と閉じ `}` が対になっているか確かめてください');
console.log(`\n${findings.length}件のNGがあります`);
process.exit(1);
