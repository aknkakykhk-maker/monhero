#!/usr/bin/env node
const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// Tailwind を CDN から静的CSSへ切り替えられるかの判断材料を作る(切替はしない)。
//
//   node tools/layout/tailwind-static-report.js
//
// 【なぜ要るか】
// いまは cdn.tailwindcss.com からスクリプトを読み、ブラウザの中でCSSを作っている
// (docs/refactor/TECH_DEBT_AUDIT.md TD-13)。起動のたびにその時間がかかるうえ、
// 外部CDNが落ちれば見た目が全部崩れる。静的CSSにすれば両方とも無くなるが、
// **Tailwind が見つけられないクラス**があると、そこだけ崩れる。
//
// Tailwind はソースを「文字列として」見る。だから
//   `flex ${open ? 'opacity-100' : 'opacity-0'}`   … 拾える(どちらも文字列で書いてある)
//   `bg-${color}-500`                               … 拾えない(組み立てている)
// の後者が危ない。ここではその後者だけを数えて、場所を出す。
const fs = require('fs');
const path = require('path');
const { PARTS_DIR, readPartsManifest } = require(path.join(TOOLS_DIR, 'harness'));

const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
const CSS = path.join(__dirname, '.tailwind-for-checks.css');

// className={`...`} のテンプレートリテラルを取り出す
const TEMPLATE = /className=\{`([^`]*)`\}/g;
// クラス名の途中に ${...} が入っているか。
// 「${ の直前が空白でない」または「} の直後が空白でない」なら、名前を組み立てている
const isBuilt = (text) => {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '$' || text[i + 1] !== '{') continue;
    let depth = 1, j = i + 2;
    for (; j < text.length && depth > 0; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
    }
    const before = i === 0 ? ' ' : text[i - 1];
    const after = j >= text.length ? ' ' : text[j];
    if (!/\s/.test(before) || !/\s/.test(after)) return true;
    i = j - 1;
  }
  return false;
};

const files = readPartsManifest().map((name) => ({ name, src: fs.readFileSync(path.join(PARTS_DIR, name), 'utf8') }));
// data/*.js も Tailwind の content に入っているので同じように見る
for (const f of fs.readdirSync(path.join(REPO_ROOT, 'monster-hero', 'data')).filter((n) => n.endsWith('.js'))) {
  files.push({ name: `data/${f}`, src: fs.readFileSync(path.join(REPO_ROOT, 'monster-hero', 'data', f), 'utf8') });
}

// index.html の <style> にある自前のクラス名を集める。
// mh-soul-rank-badge や ark-holy-rain のような自前クラスを組み立てていても、
// Tailwind の静的化とは関係がない(そのCSSは index.html に直接書いてある)
const indexHtml = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero', 'index.html'), 'utf8');
const styleBlocks = [...indexHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const ownClasses = new Set([...styleBlocks.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
// 自前CSSの大半は index.html ではなく parts の中にある(JSから <style> を注入している)。
// CSSのルールの書き出し「.クラス名 {」を拾う。JS側で「.名前 {」と書くことはまず無い
for (const { src } of []) void src; // (下で files を作ってから集める)
// 組み立ての前半が自前クラスの一部なら、Tailwind とは関係ないとみなす
const looksOwnClass = (head) => {
  if (!head) return false;
  for (const name of ownClasses) if (name.startsWith(head) || head.startsWith(name)) return true;
  return false;
};

for (const { src } of files) {
  for (const m of src.matchAll(/\.([a-zA-Z][\w-]{2,})\s*[,{]/g)) ownClasses.add(m[1]);
}

let total = 0, built = 0, tailwindRisk = 0;
const byFile = new Map();
const samples = [];
const riskSamples = [];
for (const { name, src } of files) {
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    TEMPLATE.lastIndex = 0;
    let m;
    while ((m = TEMPLATE.exec(line))) {
      total++;
      if (!isBuilt(m[1])) continue;
      built++;
      byFile.set(name, (byFile.get(name) || 0) + 1);
      if (samples.length < 8) samples.push(`${name}:${i + 1}  ${m[1].replace(/\s+/g, ' ').slice(0, 78)}`);
      // 組み立てている箇所ごとに、その直前の断片が自前クラスかどうかを見る
      const text = m[1];
      for (let k = 0; k < text.length; k++) {
        if (text[k] !== '$' || text[k + 1] !== '{') continue;
        const head = (text.slice(0, k).match(/[\w-]+$/) || [''])[0];
        // ${…} の中身を取り出す。クォート付きの文字列を返しているなら、
        // クラス名そのものはソースに文字として書いてあるので Tailwind は拾える。
        //   `w-full${cond ? ' m-auto' : ''}`   … 安全(' m-auto' と書いてある)
        //   `is-stage-${stage}`                … 組み立てている(拾えない)
        let depth = 1, e = k + 2;
        for (; e < text.length && depth > 0; e++) {
          if (text[e] === '{') depth++;
          else if (text[e] === '}') depth--;
        }
        const inside = text.slice(k + 2, e - 1);
        const returnsLiteral = /['"]/.test(inside);
        if (head && !looksOwnClass(head) && !returnsLiteral) {
          tailwindRisk++;
          if (riskSamples.length < 10) riskSamples.push(`${name}:${i + 1}  …${head}\${…}  ← ${text.replace(/\s+/g, ' ').slice(0, 62)}`);
        }
      }
    }
  });
}

console.log('=== Tailwind 静的化の判断材料 ===');
if (fs.existsSync(CSS)) {
  console.log(`静的CSSの大きさ: ${Math.round(fs.statSync(CSS).size / 1024)} KB`);
  console.log('  (node tools/layout/build-tailwind-for-checks.js で作ったもの。配信物には入っていない)');
} else {
  console.log('静的CSS: 未生成。先に node tools/layout/build-tailwind-for-checks.js を実行すること');
}
console.log(`className の テンプレートリテラル: ${total} 箇所`);
console.log(`  うち クラス名を組み立てているもの: ${built} 箇所`);
console.log(`  そのうち **自前CSSでは説明がつかないもの(静的化で本当に欠ける候補)**: ${tailwindRisk} 箇所`);
console.log(`  (index.html と parts の CSS から集めた自前クラス ${ownClasses.size} 種で切り分けた)`);
if (byFile.size) {
  console.log('  ファイル別:');
  [...byFile.entries()].sort((a, b) => b[1] - a[1]).forEach(([n, c]) => console.log(`    ${String(c).padStart(4)}  ${n}`));
}
if (samples.length) {
  console.log('  組み立てている例:');
  samples.forEach((s) => console.log(`    ${s}`));
}
if (riskSamples.length) {
  console.log('  本当に欠ける候補の例:');
  riskSamples.forEach((s) => console.log(`    ${s}`));
} else if (built) {
  console.log('  → 本当に欠ける候補は0件。組み立てているのは、すべて自前CSSのクラスか、クラス名を文字として書いた条件式だった');
}
console.log('\n※ これは報告だけの道具。CDNから静的CSSへの切替はしない(REFACTOR_MASTER_PLAN.md STEP 7-4)。');
