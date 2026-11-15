#!/usr/bin/env node
// 保存した子のアシスト {id, lv, n} を画面に出すとき、目盛りは必ず fromSaved で読む(r1115-097)。
//   node tools/success/assist-saved-display-check.js
// ① 画面の部品で valueOf / valueText に保存の物の a.lv・a そのものを渡していない(valueOf(a)・valueText(a.id, a.lv) は旧い段の値や 0 になる)
// ② 表で、最大の目盛り n の保存の物を fromSaved → valueText に通すと、最大の値の文字になる(1目盛りの値に落ちない)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const AT = require(path.join(ROOT, 'monster-hero', 'data', 'monhero-success-assist.js'));
let fail = 0;
const ck = (name, ok, d = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${d ? ` — ${d}` : ''}`); if (!ok) fail++; };
const dir = path.join(ROOT, 'monster-hero', 'src', 'parts');
const BAD = [/valueOf\(\s*a\s*\)/, /valueOf\(\s*a\.id\s*,\s*a\.lv\s*\)/, /valueText\(\s*a\.id\s*,\s*a\.lv\s*\)/, /valueText\([^)]*valueOf\(\s*a\s*\)/];
const hits = [];
for (const f of fs.readdirSync(dir).filter((x) => /^56-.*\.jsx$/.test(x))) {
  fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((ln, i) => { if (BAD.some((r) => r.test(ln))) hits.push(`${f}:${i + 1}`); });
}
ck('保存のアシストの値を、目盛りを読まずに出している所が無い', hits.length === 0, hits.join(' '));
const ids = Object.keys(AT.BY_ID).filter((id) => AT.BY_ID[id].max > 1).slice(0, 40);
const bad = ids.filter((id) => { const a = AT.BY_ID[id]; const saved = AT.toSaved(id, a.max); return AT.valueText(id, AT.fromSaved(saved)) !== AT.valueText(id, a.max); });
ck('最大の目盛りで保存した物は、最大の値の文字で出る', bad.length === 0, bad.join(','));
process.exit(fail ? 1 : 0);
