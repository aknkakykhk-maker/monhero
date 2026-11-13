#!/usr/bin/env node
// 技の性能の段(G・F・E・D・C・B・A・S・SS)の区切りを、技表の全部の技の分布から決める。2026-11-13 ジン(社長「MF みたいにダメージ・命中・ガッツダウン・クリティカルを文字の段で」)
//   node tools/masmon-battle/masmon-tech-grades.js [技表の js]   … 区切りの表(下から 5%・12%・22%・36%・52%・70%・86%・97% の所)と段ごとの技の数
//   ダメージ=power・命中=hit(命中の補正)・ガッツダウン=gd(0 の技は「−」・区切りは 0 でない技だけで決める)・クリティカル=crit
//   出力は小さく: 表と、画面に写す1行(MSA_TECH_GRADE_CUTS)だけ
'use strict';
const fs = require('fs'); const path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', '..', 'monster-hero', 'data', 'assistant-masmon-techs.js');
const T = new Function(`${fs.readFileSync(file, 'utf8')};return ASSISTANT_MASMON_TECHS;`)();
const sp = T.species || T; const all = [];
for (const v of Object.values(sp)) for (const t of (Array.isArray(v) ? v : (v.techs || []))) all.push(t);
// 2026-11-13 社長「最低は G にして、上は SS まで」: 9段。SS は上位3%・S は次の11%(札に S が並びすぎないように)
const GRADES = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'], QS = [0.05, 0.12, 0.22, 0.36, 0.52, 0.70, 0.86, 0.97];
const KEYS = [['power', 'ダメージ'], ['hit', '命中'], ['gd', 'ガッツダウン'], ['crit', 'クリティカル']];
const cuts = {};
console.log(`技の数 ${all.length}(${path.basename(file)})\n`);
console.log('| 項目 | ' + GRADES.map((g, i) => (i === 0 ? `${g}` : g)).join(' | ') + ' |');
console.log('|' + ' --- |'.repeat(GRADES.length + 1));
for (const [k, label] of KEYS) {
  const vals = all.map(t => Number(t[k]) || 0).filter(v => (k === 'gd' ? v > 0 : true)).sort((a, b) => a - b);
  // 区切り = 技表にある値の境目のうち、「その値より下の技の割合」がねらいの割合にいちばん近いもの(以上でその段)。
  //   同じ値の技が固まっているので、どの段にも1つ以上の値が残るように、前の区切りより上・後ろの段の分を残して選ぶ
  const uniq = [...new Set(vals)], below = (v) => vals.filter(x => x < v).length / vals.length;
  const c = []; let from = 1;
  QS.forEach((q, qi) => {
    const last = uniq.length - (QS.length - qi);   // 後ろの段のために残す
    let bi = from; for (let i = from; i <= last; i++) if (Math.abs(below(uniq[i]) - q) < Math.abs(below(uniq[bi]) - q)) bi = i;
    c.push(uniq[bi]); from = bi + 1;
  });
  cuts[k] = c;
  const lo = vals[0], hi = vals[vals.length - 1];
  const rng = GRADES.map((g, i) => { const a = i === 0 ? lo : c[i - 1], b = i < c.length ? c[i] - 1 : hi; return `${a}〜${b}`; });
  const cnt = GRADES.map((g, i) => vals.filter(v => (i === 0 || v >= c[i - 1]) && (i >= c.length || v < c[i])).length);
  console.log(`| ${label}(${k}) | ` + rng.map((r, i) => `${r}(${cnt[i]})`).join(' | ') + ' |');
}
const zero = all.filter(t => !(Number(t.gd) > 0)).length;
console.log(`\nガッツダウン 0 の技: ${zero}(「−」)`);
console.log(`\nconst MSA_TECH_GRADE_CUTS = ${JSON.stringify(cuts)};`);
