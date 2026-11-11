#!/usr/bin/env node
// 社長の決めごと台帳(docs/rules/PRESIDENT_DECISIONS.md・300KB超)から、「進め方」と自分の部に関わる行だけを出す。
//
//   node tools/ctx.js decisions <部>            … 進め方(全部) + その部の語に当たる行(直近7日・新しい40件まで) + それより前の件数
//   node tools/ctx.js decisions <部> --days 30  … さかのぼる日数を変える
//   node tools/ctx.js decisions <部> --all      … その部に当たる行を全部
//   node tools/ctx.js decisions --grep <語>     … 台帳をその語で引く(部を問わない)
//
// 【なぜあるか】
// 「作業を始める前に台帳を読む」決まりのまま台帳が 300KB を超え、新しい会話が毎回まるごと読んでいた
// (それだけで会話1つぶんの文脈が埋まる)。決まりは変えず、読み方を「自分に関わる行だけ」にする
// (2026-11-11 社長「トークンを無駄に使わない仕組み」案A・F)。台帳そのものは消さない・削らない。
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, findDept, cut, deptList } = require('./lib');

const LEDGER = path.join(ROOT, 'docs', 'rules', 'PRESIDENT_DECISIONS.md');

function parse() {
  const lines = fs.readFileSync(LEDGER, 'utf8').split('\n');
  const how = [], body = [];
  let sec = '';
  for (const l of lines) {
    if (l.startsWith('## ')) { sec = l.slice(3).trim(); continue; }
    if (!l.trim()) continue;
    if (sec === '進め方') how.push(l);
    else if (sec) body.push(l);
  }
  return { how, body };
}
const dateOf = (l) => { const m = l.match(/(20\d\d-\d\d-\d\d)/); return m && l.indexOf(m[1]) < 12 ? m[1] : ''; };

function collect(dept, { days = 7, all = false, width = 220, cap = 40 } = {}) {
  const { how, body } = parse();
  const since = new Date(Date.now() + 9 * 3600000 - days * 86400000).toISOString().slice(0, 10);
  const hit = body.filter(l => dept['語'].some(k => l.includes(k)));
  const undated = hit.filter(l => !dateOf(l));
  const dated = hit.filter(l => dateOf(l));
  let recent = all ? dated : dated.filter(l => dateOf(l) >= since);
  if (!all && recent.length > cap) recent = recent.slice(-cap); // 新しいほうから cap 件(台帳は下が新しい)
  return { how: how.map(l => cut(l, width + 100)), undated: undated.map(l => cut(l, width)), recent: recent.map(l => cut(l, width)), older: dated.length - recent.length, since };
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const g = opt('--grep');
  if (g) {
    const { how, body } = parse();
    const hit = [...how, ...body].filter(l => l.includes(g));
    console.log(`# 台帳で「${g}」に当たる行 ${hit.length} 件` + (hit.length > 40 ? '(新しい40件)' : ''));
    for (const l of hit.slice(-40)) console.log(cut(l, 320));
    return;
  }
  const word = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--days');
  const d = findDept(word);
  if (!d) { console.error(`NG: 部を指定してください(node tools/ctx.js decisions <部>)。\n${deptList()}`); process.exit(1); }
  const r = collect(d, { days: Number(opt('--days')) || 7, all: argv.includes('--all') });
  console.log(`# 社長の決めごと(${d['部']}に関わる分)  正本: docs/rules/PRESIDENT_DECISIONS.md`);
  console.log('\n## 進め方(全員)');
  for (const l of r.how) console.log(l);
  if (r.undated.length) { console.log('\n## いつも守る中身の決めごと(この部の語に当たる行)'); for (const l of r.undated) console.log(l); }
  console.log(`\n## この部に関わる決めごと(${argv.includes('--all') ? '全部' : r.since + ' から'}・${r.recent.length} 件)`);
  for (const l of r.recent) console.log(l);
  if (r.older) console.log(`\n… それより前に ${r.older} 件。要るときだけ: node tools/ctx.js decisions --grep <語>(当たる語: ${d['語'].slice(0, 6).join('・')})`);
  console.log('\n社長が新しく決めたら、その場で台帳に1行足す(日付・社長のことば・何をするか)。');
}

if (require.main === module) main();
module.exports = { collect };
