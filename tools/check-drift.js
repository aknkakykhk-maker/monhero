#!/usr/bin/env node
// 落ちた検査が「本体のどの文字の並びを探していて、それが今どうなっているか」を並べる。
//
//   node tools/check-drift.js tools/mode/rhythm-life-check.js            … その検査が探している文字の並びのうち、本体に無いものを出す
//   node tools/check-drift.js tools/mode/rhythm-life-check.js --all      … 見つかったものも含めて全部出す
//
// 【なぜ要るか】(2026-09-27)
// 検査の多くは、本体(monster-hero/src/game-system.jsx ほか)の文字の並びを includes('…') でそっくり探している。
// 名前の切り出し・引数の追加・札(chip)の形への作り替えだけで落ち、本物の不具合と見分けるのに毎回手で探していた
// (この日、main でずっと落ちていた検査を 60本近く見分けた。本物の不具合は3件で、残りはどれもこの形の古さだった)。
// ここでは、検査の中の文字の並び(includes / has / count に渡している '…' "…" `…`)を取り出し、
// 本体に無いものについて、本体でいちばん似ている行を隣に出す。「書き方が変わっただけ」か「消えた」かが一目で分かる。
//
// ★読むだけ。検査も本体も書き換えない。似ている行は目安(文字の2文字組の重なりで選ぶ)。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const target = process.argv[2];
const showAll = process.argv.includes('--all');
if (!target || !fs.existsSync(target)) {
  console.log('使い方: node tools/check-drift.js <検査のファイル> [--all]');
  process.exit(1);
}
const check = fs.readFileSync(target, 'utf8');

// 本体として探す先。検査がよく読むものをまとめて見る(生成物 game-system.jsx は parts の連結なので、行は parts から探す)
const SOURCES = [
  ...fs.readdirSync(path.join(ROOT, 'monster-hero/src/parts')).filter(f => f.endsWith('.jsx')).map(f => `monster-hero/src/parts/${f}`),
  ...fs.readdirSync(path.join(ROOT, 'monster-hero/data')).filter(f => f.endsWith('.js') && f !== 'rhythm-mode.js' && f !== 'changelog.js').map(f => `monster-hero/data/${f}`),
  'monster-hero/data/rhythm-mode.js',
  'monster-hero/index.html',
];
const texts = SOURCES.filter(f => fs.existsSync(path.join(ROOT, f))).map(f => ({ file: f, text: fs.readFileSync(path.join(ROOT, f), 'utf8') }));
const joined = fs.readFileSync(path.join(ROOT, 'monster-hero/src/game-system.jsx'), 'utf8') + '\n' + texts.map(t => t.text).join('\n');

// 検査の中の文字の並びを取り出す(includes / has / count / indexOf の最初の引数)
const unescape = s => s.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
const literals = [];
const re = /\b(?:includes|has|count|indexOf)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
let m;
while ((m = re.exec(check))) {
  if (m[1] === '`' && /\$\{/.test(m[2])) continue; // 値を埋め込んだ文字列は組み立てが要るので飛ばす
  const lit = unescape(m[2]);
  if (lit.length < 8) continue; // 短すぎるものはどこにでもあるので見ない
  const line = check.slice(0, m.index).split('\n').length;
  literals.push({ lit, line });
}

// 2文字組の集まりで似ている度合いを測る
const grams = s => { const g = new Map(); const t = s.replace(/\s+/g, ''); for (let i = 0; i < t.length - 1; i++) { const k = t.slice(i, i + 2); g.set(k, (g.get(k) || 0) + 1); } return g; };
const similarity = (a, b) => { let inter = 0, total = 0; for (const [k, v] of a) { inter += Math.min(v, b.get(k) || 0); total += v; } for (const v of b.values()) total += v; return total ? 2 * inter / total : 0; };
const lines = texts.flatMap(t => t.text.split('\n').map((l, i) => ({ file: t.file, no: i + 1, l })));
const nearest = lit => {
  const g = grams(lit);
  // 探す文字の並びの一部(識別子)を含む行から候補を絞る
  const words = (lit.match(/[A-Za-z_$][\w$]{3,}/g) || []).sort((a, b) => b.length - a.length).slice(0, 3);
  let pool = lines.filter(x => words.some(w => x.l.includes(w)));
  if (!pool.length) pool = lines;
  let best = null;
  for (const x of pool) {
    // 長い行は、探す文字の並びと同じくらいの長さの窓で比べる
    const s = x.l.trim();
    const win = Math.max(lit.length + 20, 60);
    for (let i = 0; i < Math.max(1, s.length - win + 1); i += Math.max(1, Math.floor(win / 3))) {
      const part = s.slice(i, i + win);
      const score = similarity(g, grams(part));
      if (!best || score > best.score) best = { ...x, part, score };
    }
  }
  return best;
};

let missing = 0;
for (const { lit, line } of literals) {
  const found = joined.includes(lit);
  if (found && !showAll) continue;
  if (!found) missing++;
  console.log(`${found ? 'ある' : '無い'}: 検査の ${line}行目 「${lit.slice(0, 140).replace(/\n/g, '⏎')}」`);
  if (!found) {
    const n = nearest(lit);
    if (n) console.log(`      いちばん似ている行: ${n.file}:${n.no}(似ている度合い ${Math.round(n.score * 100)}%)\n        「${n.part.slice(0, 180)}」`);
  }
}
console.log(`\n文字の並び ${literals.length}件のうち、本体に無いもの ${missing}件`);
