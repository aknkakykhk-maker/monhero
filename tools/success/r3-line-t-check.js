#!/usr/bin/env node
// モンサクの台詞の関数 msxR3Line(…) は { t, e } の入れ物を返す。画面に出すときは .t を取り出す。
// 入れ物のまま JSX に置くと React が「オブジェクトは子にできない」(#31)で止まり、その画面で保存が止まった育成は二度と開けなくなる
// (2026-11-14 Fable の点検: 月の大会で負けて「あきらめる」を押すと r3-cup の data-msx-r3-lostnote で止まった)。
//   node tools/success/r3-line-t-check.js
// 見ること: src/parts/*.jsx の msxR3Line(…) の呼び出しを1つずつ読み、
//   ① 呼び出しのすぐあとに .t が付いている、または
//   ② 変数に入れている(const x = msxR3Line(…))なら、その変数を {x} のまま JSX に置いていない
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const PARTS = path.join(ROOT, 'monster-hero', 'src', 'parts');
let failed = 0; let calls = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 括弧の対応を数えて、呼び出しの閉じ括弧の位置を返す(文字列の中の括弧は数えない)
const closeOf = (src, open) => {
  let depth = 0; let q = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
};

const bad = [];
for (const f of fs.readdirSync(PARTS).filter((x) => x.endsWith('.jsx'))) {
  const src = fs.readFileSync(path.join(PARTS, f), 'utf8');
  const re = /\bmsxR3Line\s*\(/g; let m;
  while ((m = re.exec(src))) {
    const before = src.slice(Math.max(0, m.index - 40), m.index);
    if (/(const|let|function)\s+msxR3Line\s*=?\s*$|const msxR3Line = $/.test(before + 'msxR3Line') || /const msxR3Line\s*=\s*\($/.test(src.slice(m.index, m.index + 30))) continue; // 定義そのもの
    if (/\b(const|let)\s+msxR3Line\b/.test(src.slice(Math.max(0, m.index - 12), m.index + 10))) continue;
    calls++;
    const open = src.indexOf('(', m.index); const close = closeOf(src, open);
    const line = src.slice(0, m.index).split('\n').length;
    if (close < 0) { bad.push(`${f}:${line} 閉じ括弧が見つからない`); continue; }
    const after = src.slice(close + 1, close + 4);
    if (after.startsWith('.t')) continue;
    const asg = before.match(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*$/);
    if (asg) {
      const name = asg[1];
      // 同じ関数の中で {name} を JSX の子に置いていないか(.t / && / ? を付けずに)
      const rest = src.slice(close, close + 4000);
      if (new RegExp(`\\{\\s*${name}\\s*\\}`).test(rest)) bad.push(`${f}:${line} ${name} を {${name}} のまま画面に出している(.t が要る)`);
      continue;
    }
    if (/return\s*$/.test(before)) continue; // 入れ物を返すだけの包み(使う側で .t を取る)
    bad.push(`${f}:${line} msxR3Line(…) に .t が付いていない`);
  }
}
check('msxR3Line の呼び出しを読めた', calls > 0, `${calls}か所`);
check('msxR3Line の入れ物をそのまま画面に出していない(.t を取り出している)', bad.length === 0, bad.join(' / '));
console.log(failed ? `\nNG: ${failed}件` : '\nすべて OK');
process.exit(failed ? 1 : 0);
