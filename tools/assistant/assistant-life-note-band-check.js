// 助手ライフのお知らせの帯(data-assistant-life-note)が、どの画面でも濃い下地か確かめる(2026-11-08 ミハリの指摘「お知らせの帯の朝・夕・夜」)
//   薄い下地(bg-sky-400/10 など)だと、朝・夕の明るい空の上で水色の字が沈んで読めない。下地は bg-slate-950/90(9割の濃さ)にそろえる
//   node tools/assistant/assistant-life-note-band-check.js
const fs = require('fs'), path = require('path');
const dir = path.resolve(__dirname, '..', '..', 'monster-hero/src/parts');
let failed = 0, seen = 0;
for (const f of fs.readdirSync(dir).filter(n => /^56-assistant-life.*\.jsx$/.test(n))) {
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
  lines.forEach((ln, i) => {
    if (!/<p data-assistant-life-note\b/.test(ln)) return;
    seen++;
    const cls = (ln.match(/className="([^"]*)"/) || [])[1] || '';
    const ok = /\bbg-slate-950\/(9\d|100)\b/.test(cls) && /\btext-sky-100\b/.test(cls);
    console.log(`${ok ? 'OK' : 'NG'}: ${f}:${i + 1} お知らせの帯の下地が濃い${ok ? '' : ` — ${cls}`}`);
    if (!ok) failed++;
  });
}
if (seen < 3) { console.log(`NG: お知らせの帯が ${seen} か所しか見つからない(家の縦・横と居場所タブの3か所あるはず)`); failed++; }
console.log(failed ? `NG ${failed}件` : 'すべてOK');
process.exit(failed ? 1 : 0);
