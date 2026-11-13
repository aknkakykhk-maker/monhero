#!/usr/bin/env node
// 古い技(いまの技表 assistant-masmon-techs.js)→ 新しい技(tuned-draft.json)の対応表の案(2026-11-13 バトル部)
//   node tools/masmon-battle/masmon-tech-idmap.js [--json=<先>]
// 保存の「覚えた技・熟練」を引き継ぐための案(引き継ぎの処理は助手部。消さない・一度きりの印)。
// 決め方: 同じ種類の中で、名前が同じ技 → 技種(ちから/かしこさ)が同じ → 届く間合いが重なる → 威力が近い、の順で1つ選ぶ。
//   新しい技の1つに古い技が2つ以上当たったら、熟練は大きいほうを引き継ぐ(足さない)
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, load } = require('./load.js');
const { data } = load();
const OLD = data.ASSISTANT_MASMON_TECHS.species;
const NEW = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/progress/msa-tech/tuned-draft.json'), 'utf8')).species;
const out = {};
let dup = 0;
for (const [sp, olds] of Object.entries(OLD)) {
  const news = NEW[sp] || [];
  out[sp] = {};
  const used = {};
  for (const o of olds) {
    const score = (n) => (n.name === o.name ? -10000 : 0) + (n.kind === o.kind ? 0 : 1000) + (n.dist.some(d => o.dist.includes(d)) ? 0 : 100) + Math.abs(n.power - o.power);
    const best = news.slice().sort((a, b) => score(a) - score(b))[0];
    if (!best) continue;
    out[sp][o.id] = best.id;
    if (used[best.id]) dup++;
    used[best.id] = true;
  }
}
const arg = process.argv.find(a => a.startsWith('--json='));
if (arg) fs.writeFileSync(arg.slice(7), JSON.stringify(out, null, 1));
const n = Object.values(out).reduce((a, m) => a + Object.keys(m).length, 0);
console.log(`古い技 ${n} → 新しい技へ対応(重なり ${dup} 件は熟練の大きいほうを引き継ぐ)`);
for (const sp of ['Mocchi', 'Pandora']) console.log(sp, Object.entries(out[sp] || {}).map(([a, b]) => `${OLD[sp].find(t => t.id === a).name}→${(NEW[sp].find(t => t.id === b) || {}).name}`).join(' / '));
