// MFバトルカード: card-perf-measure.js の結果(PERF_OUT の JSON)2つを並べて、直す前と後の表(Markdown)を出す。
//   node tools/card/card-perf-compare.js docs/progress/card-perf/before-portrait.json docs/progress/card-perf/after-portrait.json
// 1回あたりの平均(はじめの2回は温まりなので外す)と、30回のはじめ3回 → おわり3回の差(増え続けないか)を出す
const fs = require('fs');
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
if (!a || !b) { console.log('使い方: node tools/card/card-perf-compare.js <前.json> <後.json>'); process.exit(1); }
const avg = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const rows = (d, k) => (d[k] || []).slice(1);
const per = (d, k, f) => { const r = rows(d, k); const w = r.length >= 6 ? r.slice(2) : r; const v = w.map((x) => x[f]).filter((x) => Number.isFinite(x)); return v.length ? avg(v) : null; };
const drift = (d, k, f) => { const r = rows(d, k).map((x) => x[f]).filter((x) => Number.isFinite(x)); return r.length >= 6 ? avg(r.slice(-3)) - avg(r.slice(0, 3)) : null; };
const fmt = (v, dg = 1) => (v === null ? '—' : v.toFixed(dg));
const ITEMS = [
  ['JS のメモリ(MB)', 'heapMB', 2, true], ['DOM の数', 'nodes', 0, true], ['イベントの受け口', 'listeners', 0, true], ['setInterval', 'intervals', 0, true],
  ['スクリプトの時間(ms)', 'scriptMs', 0, false], ['スタイルの計算(ms)', 'styleMs', 0, false], ['レイアウト(ms)', 'layoutMs', 0, false], ['本体の仕事の合計(ms)', 'taskMs', 0, false],
  ['長いタスク(件)', 'longN', 1, false], ['長いタスクの合計(ms)', 'longMs', 0, false], ['長いタスクの最大(ms)', 'longMax', 0, false], ['長いコマの最大(ms)', 'loafMax', 0, false],
];
for (const [k, title] of [['battles', 'フリー対戦(オート×4)1回あたり'], ['loops', '画面の行き来 1回あたり']]) {
  console.log(`\n### ${title}(前 ${rows(a, k).length}回 / 後 ${rows(b, k).length}回・CPU 4倍遅く)\n`);
  console.log('| 見るもの | 前 | 後 | 30回で増えた量(前 → 後) |');
  console.log('| --- | --- | --- | --- |');
  for (const [name, f, dg, showDrift] of ITEMS) {
    const pa = per(a, k, f), pb = per(b, k, f);
    if (pa === null && pb === null) continue;
    console.log(`| ${name} | ${fmt(pa, dg)} | ${fmt(pb, dg)} | ${showDrift ? `${fmt(drift(a, k, f), dg)} → ${fmt(drift(b, k, f), dg)}` : ''} |`);
  }
}
