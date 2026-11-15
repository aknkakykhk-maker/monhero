#!/usr/bin/env node
// アシスト効果の合計の上限(2026-11-15 社長 r1115-104)が効いているかを見る。
//   node tools/success/monsuc-assist-cap-check.js
// ① 上限の数字はアシストの表 data/monhero-success-assist.js の CAP の1か所だけ(芯に数字を書いていない)
// ② 6体が同じ効果を最大で持ち、同じトレーニングに集まったとき、その効果の分が表の上限で止まる(伸びの補正・失敗率・体力消費・トレ後回復)
// ③ 上限のある効果の説明の文に「編成の合計 ◯まで」が出る。上限の無い効果には出ない
'use strict';
const fs = require('fs');
const path = require('path');
const { load } = require('./load');
const ROOT = path.resolve(__dirname, '..', '..');
const AT = require(path.join(ROOT, 'monster-hero', 'data', 'monhero-success-assist.js'));
const { SUC } = load();
const ng = [];
// ①
const core = fs.readFileSync(path.join(ROOT, 'monster-hero', 'data', 'monhero-success.js'), 'utf8');
if (/ASSIST_CAP\s*=/.test(core)) ng.push('芯に上限の表(ASSIST_CAP)が残っている。数字はアシストの表の CAP だけ');
if (!AT.CAP || typeof AT.CAP !== 'object' || !Object.keys(AT.CAP).length) ng.push('アシストの表に CAP が無い');
// ②
const K = SUC.KEYS;
const run = (assists) => {
  const team = Array.from({ length: 6 }, (_, i) => ({ kind: 'raised', species: ['Undine', 'Mocchi', 'Golem', 'Pixie', 'Tiger', 'Kyubi'][i], stats: Object.fromEntries(K.map(k => [k, 300])), lv: 30, loy: 80, pop: 50, techs: [], assists }));
  const s = SUC.newRun({ id: 'cap-check', species: 'Mocchi', aid: 'mua', team, aidBondLv: 1 });
  const card = { kind: 'train', stat: 'pow', members: [0, 1, 2, 3, 4, 5], aid: false };
  return { s, card };
};
const maxN = (id) => AT.BY_ID[id].v.length;
const addOf = (id) => { const a = run([{ id, n: maxN(id) }]); const b = run([]); return Math.round((SUC.cardMult(a.s, a.card).add - SUC.cardMult(b.s, b.card).add) * 1000) / 10; };
for (const id of ['sokoji', 'kunpow', 'kizuna']) {
  const cap = AT.CAP[id] && AT.CAP[id].v; const one = AT.BY_ID[id].v[maxN(id) - 1];
  const got = addOf(id);
  if (!(cap < one * 6)) continue; // 6体でも届かない上限は見ない
  if (got > cap + 0.5) ng.push(`${AT.BY_ID[id].name}: 6体で +${got}% (上限 ${cap}%)`);
  console.log(`${AT.BY_ID[id].name}: 1体 +${one}% × 6体 → +${got}%(上限 ${cap}%)`);
}
{ // 失敗率ダウン: 体力が少なく失敗しやすいときに、下がり方が上限で止まる
  const a = run([{ id: 'ochitsuki', n: maxN('ochitsuki') }]); const b = run([]);
  [a, b].forEach(x => { x.s.hp = Math.round(x.s.hpMax * 0.2); });
  const fa = SUC.failRateOf(a.s, a.card); const fb = SUC.failRateOf(b.s, b.card); const cut = Math.round((1 - fa / fb) * 1000) / 10;
  const cap = AT.CAP.ochitsuki.v; if (cut > cap + 0.5) ng.push(`失敗率ダウン: 6体で −${cut}%(上限 ${cap}%)`);
  console.log(`失敗率ダウン: 6体 → −${cut}%(上限 ${cap}%)`);
}
// ③
Object.keys(AT.BY_ID).forEach((id) => { const t = AT.describe(id, 1); const has = /編成の合計 [\d.]+%?まで/.test(t); if (AT.CAP[id] && !has) ng.push(`${AT.BY_ID[id].name}: 説明に上限が無い`); if (!AT.CAP[id] && has) ng.push(`${AT.BY_ID[id].name}: 上限の無い効果に上限の文`); });
if (ng.length) { ng.forEach(x => console.log(`NG: ${x}`)); console.log(`NG ${ng.length}件`); process.exit(1); }
console.log(`OK: アシスト効果の合計の上限(表の ${Object.keys(AT.CAP).length} 種)が効いている`);
