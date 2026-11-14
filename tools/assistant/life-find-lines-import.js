// 助手ライフの拾い物・贈り物のひとこと(助手ごと・場面ごと2本)を 56-assistant-life-finds.jsx へ取り込む(2026-11-14 ナカヨシ・キズナ2と相談)
//   node tools/assistant/life-find-lines-import.js          取り込む(ASSISTANT_LIFE_FIND_LINES_BY の1行を書き直す)
//   node tools/assistant/life-find-lines-import.js --check  書き直さずに、行ファイルと部品がそろっているか・口調の目印だけ見る
// 読むファイル: docs/progress/assistant-peer/lines/life-find-lines.txt(形: <助手> <trip|gift|masmon> | <ひとこと>)
// 見るもの: 全助手 × 3場面 × 2本がそろう / 40字まで / { } を含まない / ほかの助手の一人称・口ぐせの目印が混ざらない / 1本に「笑」と半角 w を両方付けない
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const LINES = path.join(root, 'docs/progress/assistant-peer/lines/life-find-lines.txt');
const PART = path.join(root, 'monster-hero/src/parts/56-assistant-life-finds.jsx');
const check = process.argv.includes('--check');
const KINDS = ['trip', 'gift', 'masmon'];
const ctx = vm.createContext({});
vm.runInContext(`${fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8')}\nthis.ids = ASSISTANTS.map(a => a.id);`, ctx);
const ids = ctx.ids;
// 目印 → その目印を使ってよい助手だけ
const MARKS = [[/おで/, ['dra']], [/あたし/, ['mua']], [/もも/, ['momosuke']], [/でつ|まつ/, ['kiki']], [/ぢゃん|まぢ/, ['mua']], [/ｗ/, ['mua']], [/自分から/, ['sorashido']]];
const ng = [];
const by = Object.fromEntries(ids.map(id => [id, Object.fromEntries(KINDS.map(k => [k, []]))]));
fs.readFileSync(LINES, 'utf8').split('\n').forEach((raw, i) => {
  const l = raw.trim(); if (!l || l.startsWith('#')) return;
  const at = `life-find-lines.txt:${i + 1}`;
  const m = l.match(/^(\w+) (\w+) \| (.+)$/);
  if (!m) { ng.push(`${at} 形が違う`); return; }
  const [, who, kind, t] = m;
  if (!by[who] || !KINDS.includes(kind)) { ng.push(`${at} 知らない助手か場面`); return; }
  if ([...t].length > 40) ng.push(`${at} 40字超え`);
  if (/[{}]/.test(t)) ng.push(`${at} 使えない文字`);
  for (const [re, ok] of MARKS) if (re.test(t) && !ok.includes(who)) ng.push(`${at} ほかの助手の目印 ${re.source}`);
  if (/笑/.test(t) && /w/.test(t)) ng.push(`${at} 笑と w を両方付けている`);
  by[who][kind].push(t);
});
for (const id of ids) for (const k of KINDS) if (by[id][k].length !== 2) ng.push(`${id} ${k} が ${by[id][k].length} 本(2本)`);
const line = `const ASSISTANT_LIFE_FIND_LINES_BY = Object.freeze(${JSON.stringify(by)});`;
const src = fs.readFileSync(PART, 'utf8');
const re = /^const ASSISTANT_LIFE_FIND_LINES_BY = .*$/m;
if (!re.test(src)) ng.push('部品に ASSISTANT_LIFE_FIND_LINES_BY の行が無い');
else if (check && src.match(re)[0] !== line) ng.push('部品の行が行ファイルと違う(取り込みを打つ)');
if (ng.length) { ng.slice(0, 20).forEach(s => console.log(`NG: ${s}`)); console.log(`NG ${ng.length} 件`); process.exit(1); }
if (!check) fs.writeFileSync(PART, src.replace(re, line));
console.log(`OK: 拾い物・贈り物のひとこと ${ids.length}人 × ${KINDS.length}場面 × 2本${check ? '(そろっている)' : 'を取り込んだ'}`);
