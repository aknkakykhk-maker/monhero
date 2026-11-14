#!/usr/bin/env node
// 社長の頼みの追跡表(tools/team/requests.json)の見張り。
//   node tools/team/requests-check.js
//
// 【なぜあるか】2026-11-14 社長「なんかお願いしたのに漏れてるの多いのは何で?」。台帳に書いた決めごとを
// 「だれに頼んだか・できたか」まで追う表を作った。表が台帳から置いていかれる・道具から頼みが出なくなる、を止める。
//
// 【確かめること】
//   A 表の形: id が重ならない・状態と部が決まった物・完了には PR かメモ(確かめずに完了にしない)
//   B 取り込み忘れ: 台帳の「追跡の始まり」からの行(と、さかのぼった分)が、全部表に入っている(無ければ todo sync)
//   C 古い印: 表の「台帳」の印が、台帳の行にいまもある(台帳の行を直したら todo sync が付け替える)
//   D 自動で出る: 完了でない頼みが newsession の依頼文・handoff のメモ・brief・窓口の知らせに出る
//   F 聞く前に引く: node tools/ctx.js asked <語> が台帳の決めごとを出し、窓口の手引きに打ち方がある
//   E 止め絵の点検: 見る所の5つ(言葉の途中の折れ・下の空き・数字のそろえ方・参考との比べ・台帳の決めごと)が道具と窓口の手引きにある
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, loadDepts } = require('./lib');
const R = require('./requests');

let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) { failed++; console.log(`NG: ${name}${detail ? ' — ' + detail : ''}`); } };

const j = R.load();
const rows = j['頼み'];
const depts = new Set(loadDepts().map(d => d.id));

// A
const ids = new Set(); const bad = [];
for (const r of rows) {
  if (!/^r\d{4}-\d{3}$/.test(r.id || '') || ids.has(r.id)) bad.push(`${r.id}: id が重なる・形が違う`);
  ids.add(r.id);
  if (!R.STATES.includes(r['状態'])) bad.push(`${r.id}: 状態「${r['状態']}」は無い`);
  if (!depts.has(r['部'])) bad.push(`${r.id}: 部「${r['部']}」は無い`);
  if (!/^20\d\d-\d\d-\d\d$/.test(r['日付'] || '') || !r['中身'] || !Array.isArray(r.PR)) bad.push(`${r.id}: 日付・中身・PR の形`);
  if (r['状態'] === '完了' && !r.PR.length && !r['メモ']) bad.push(`${r.id}: 完了なのに PR もメモも無い`);
  if (['上書き済み', 'やめた'].includes(r['状態']) && !r['メモ']) bad.push(`${r.id}: ${r['状態']}なのに理由(メモ)が無い`);
}
check('A 表の形', bad.length === 0, bad.slice(0, 5).join(' / ') + (bad.length > 5 ? ` ほか${bad.length - 5}件` : ''));

// B・C
const led = R.ledgerRows();
const miss = R.missing(j, led);
check('B 台帳の行が表に入っている', miss.length === 0, `${miss.length} 件が未取り込み(node tools/ctx.js todo sync)。例: ${miss.slice(0, 2).map(l => l.date + ' ' + l.text.slice(0, 30)).join(' / ')}`);
const live = new Set(led.map(l => l.hash));
const orphan = rows.filter(r => r['台帳'] && !live.has(r['台帳']));
check('C 表の印が台帳にある', orphan.length === 0, `${orphan.length} 件(台帳の行が直された。node tools/ctx.js todo sync で付け替える): ${orphan.slice(0, 5).map(r => r.id).join(' ')}`);

// D(完了でない頼みがある部で確かめる。無ければ道具がつながっていることだけ見る)
const open = R.openFor().filter(r => r['部'] !== 'hq');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
check('D newsession が追跡表を読む', /linesFor\(/.test(src('tools/team/newsession.js')));
check('D handoff が追跡表を読む', /requests'\)\.linesFor\(/.test(src('tools/team/handoff.js')));
check('D brief が数を出す', /team\/requests'\)\.summary\(\)/.test(src('tools/ctx.js')));
check('D 窓口の知らせが数を出す', /todoNote\(\)/.test(src('tools/hooks/session-length-nudge.js')));
if (open.length) {
  const d = loadDepts().find(x => x.id === open[0]['部']);
  const p = require('./newsession').build(d, '見張りの試し').prompt;
  check('D 依頼文に完了でない頼みが入る', p.includes('■この部の完了でない頼み') && p.includes(open[0].id));
  const m = require('./handoff').draft(d);
  check('D 引き継ぎメモに完了でない頼みが入る', m.includes('## 完了でない社長の頼み') && m.includes(open[0].id));
  const hook = require('../hooks/session-length-nudge.js');
  const limit = JSON.parse(src('tools/team/routing.json'))['区切り'];
  const msg = hook.message({ prompts: 3, tokens: (Number(limit['窓口の要約のトークン']) || 500000) + 1000, prevTokens: 0, compacts: 0 }, limit, { hq: true });
  check('D 窓口の「長くなってきた」に数が入る', /社長の頼みで完了でない物: \d+ 件/.test(msg));
  const b = spawnSync('node', ['tools/ctx.js', 'brief'], { cwd: ROOT, encoding: 'utf8' }).stdout || '';
  check('D brief に数が出る', /社長の頼みで完了でない物: \d+ 件/.test(b));
}

// E
const { POINTS } = require('./still-check');
const hq = src('docs/depts/hq.md');
for (const w of ['言葉の途中の折れ', '下の空き', '数字のそろえ方', '参考との比べ', '台帳の決めごと']) {
  check(`E 止め絵の点検「${w}」が道具にある`, POINTS.some(p => p.includes(w)));
  check(`E 止め絵の点検「${w}」が窓口の手引きにある`, hq.includes(w));
}
check('E 窓口の手引きに todo がある', hq.includes('node tools/ctx.js todo sync'));

// F 聞く前に引く道具: 台帳にある語で行が出る・窓口の手引きに打ち方がある
{
  const out = spawnSync('node', ['tools/ctx.js', 'asked', 'モンヒロサクセス', '略称'], { cwd: ROOT, encoding: 'utf8' }).stdout || '';
  check('F asked が台帳の決めごとを出す', /決めごと [1-9]\d* 件/.test(out) && out.includes('聞かずに'));
  check('F 窓口の手引きに asked がある', hq.includes('node tools/ctx.js asked'));
}

if (failed) { console.log(`\nNG: 追跡表の見張りで ${failed} 件(docs/rules/REQUEST_TRACKING.md)`); process.exit(1); }
console.log(`OK: 追跡表(全 ${rows.length} 件・完了でない物 ${R.openFor().length} 件)は台帳とそろっていて、依頼文・メモ・brief・窓口の知らせに出る`);
