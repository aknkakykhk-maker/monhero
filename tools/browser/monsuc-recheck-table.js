#!/usr/bin/env node
// モンサクの見た目 API 点検の結果(visual-api-monsuc.js の api-findings.json)を、受け持ちの部ごとの表にする道具(r1119-033)。
//   node tools/browser/monsuc-recheck-table.js --in <置き場>/api-findings.json --out docs/progress/kensa/<日付の置き場>
//       … findings-<部>.md を書く。列は「件の番号・場面・何が悪いか・直し方・優先度・状態」。状態は「未」で始める
//   前の点検(--prev docs/progress/kensa/monsuc-visual-api-2026-11)の表に、同じ場面の縦で近い中身があれば「前から」と書く(機械の目安)
//   低は表に入れない(社長の決め r1119-033 で直すのは高と中)。件数だけ数える
//   状態の書き換え(直した/確かめ済み/未)は、表の該当の行を手で直す。番号は部の頭文字 + 連番で、出し直しても同じ順なら同じになる
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const opt = (n, d = '') => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const IN = opt('--in'), OUT = opt('--out'), PREV = opt('--prev', 'docs/progress/kensa/monsuc-visual-api-2026-11');
if (!IN || !OUT) { console.log('使い方はこのファイルの先頭を見てください'); process.exit(1); }

// 受け持ち(前の点検の findings-*.md と同じ分け方)
const DEPTS = [
  { file: 'ikusei', id: '育', name: '④育成の型・アシモン・メモモン・編成2/6', hints: ['育成の型', '編成', 'メモモン'], areas: ['育成の毎ターン', '修行', '引退', '入口・モンサクのホーム'] },
  { file: 'battle', id: 'バ', name: '②バトル(大会の試合・組み合わせ)', hints: ['バトル'], areas: ['大会・ヒーローズファイナル'] },
  { file: 'window', id: '窓', name: '⑥窓・合体・閉じる', hints: ['窓・閉じる', '合体'], areas: ['マスモンボックス・詳細・メモモン・合体・お別れ・編成'] },
  { file: 'event', id: 'イ', name: '⑤イベント図鑑・お話', hints: ['イベント図鑑', 'お話'], areas: ['イベント図鑑', 'お話(みゅあ編)'] },
  { file: 'start', id: '開', name: '⑦育成の開始1/6・3/6〜6/6・言葉・染色', hints: ['育成の開始', '言葉', '染色'], areas: ['育成の開始1/6〜6/6', 'ランキング', 'ヘルプ・助手の説明'] },
];
const FLOW_DEPT = { SQE: 'event', SQV: 'event', S6: 'event', G4: 'event', N2: 'event', SQT: 'ikusei', SQC: 'battle' };
const deptOf = (f) => {
  const h = DEPTS.find((d) => d.hints.includes(f.owner_hint));
  if (h) return h;
  const fl = /〔(?:msx|r3|arc)-(SQ[A-Z]|S6|G4|N2)〕/.exec(f.scene || '');
  if (fl && FLOW_DEPT[fl[1]]) return DEPTS.find((d) => d.file === FLOW_DEPT[fl[1]]);
  return DEPTS.find((d) => d.areas.includes(f.area)) || DEPTS[0];
};

const codes = (s) => (String(s || '').match(/〔[^〕]+〕/g) || []).map((x) => x.slice(1, -1));
const grams = (s) => { const t = String(s || '').replace(/[\s、。「」()()・]/g, ''); const g = new Set(); for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2)); return g; };
const sim = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / Math.max(1, Math.min(a.size, b.size)); };

// 前の点検の行(縦を含む物だけ。横だけの件は r1119-026 で対象外)
const prev = [];
if (fs.existsSync(PREV)) for (const f of fs.readdirSync(PREV).filter((x) => /^findings-.*\.md$/.test(x))) {
  for (const line of fs.readFileSync(path.join(PREV, f), 'utf8').split('\n')) {
    const c = line.split('|').map((x) => x.trim());
    if (c.length < 7 || !/^(高|中|低)$/.test(c[1])) continue;
    if (!/tate|縦|全部/.test(c[3])) continue;
    prev.push({ codes: codes(c[2]), scene: c[2], g: grams(c[4]) });
  }
}
const seenBefore = (f) => {
  const cs = codes(f.scene), g = grams(f.what);
  return prev.some((p) => (cs.some((c) => p.codes.includes(c)) || (!cs.length && p.scene === f.scene)) && sim(g, p.g) >= 0.3);
};

const src = JSON.parse(fs.readFileSync(IN, 'utf8'));
// <置き場>/overrides.json … 道具の空振り・偽のデータのせいの件を、目で確かめて扱いを変える
//   [{ "match": "場面と中身にかける正規表現", "drop": true } または { "match": ..., "priority": "中", "note": "書き足す注" }]
const OVR = fs.existsSync(path.join(OUT, 'overrides.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'overrides.json'), 'utf8')) : [];
let dropped = 0;
const all = (src.findings || []).filter((f) => f.machine_verdict !== '空振り').map((f) => {
  const o = OVR.find((x) => new RegExp(x.match).test(`${f.scene} ${f.what}`));
  if (!o) return f;
  if (o.drop) { dropped++; return null; }
  return { ...f, priority: o.priority || f.priority, what: `${f.what}${o.note ? `〔ミハリ: ${o.note}〕` : ''}` };
}).filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const esc = (s) => String(s || '').replace(/\|/g, '／').replace(/\n/g, ' ');
const order = { 高: 0, 中: 1, 低: 2 };
const summary = [];
for (const d of DEPTS) {
  const mine = all.filter((f) => deptOf(f) === d).sort((a, b) => order[a.priority] - order[b.priority] || String(a.scene).localeCompare(String(b.scene)));
  const rows = mine.filter((f) => f.priority === '高' || f.priority === '中');
  const low = mine.length - rows.length;
  const hi = rows.filter((f) => f.priority === '高').length;
  const before = rows.filter(seenBefore).length;
  summary.push({ dept: d, hi, mid: rows.length - hi, low, before });
  const md = [`# ${d.name} の受け持ち(モンサクの見た目 API 点検のやり直し 2026-11-20)`, '',
    '- 正本の説明は [README.md](README.md)。**直していない**。API の見立てを部ごとに並べた。直すのは高と中の全部(r1119-033)',
    `- 高 ${hi}・中 ${rows.length - hi}(低 ${low} は表に入れていない)/ うち「前から」${before}`,
    '- 状態: 未 = まだ / 直した = 部が直して PR を出した / 確かめ済み = ミハリが API でもう一度見て消えたのを確かめた',
    '- 場面の〔msx-S2P〕などは撮影の道具の名札。1画面だけ見直す: `node tools/browser/monsuc-visual-pr.js --scenes msx:S2P`', '',
    '| 件の番号 | 場面 | 何が悪いか | 直し方 | 優先度 | 状態 |', '|---|---|---|---|---|---|',
    ...rows.map((f, i) => `| ${d.id}-${String(i + 1).padStart(2, '0')} | ${esc(f.scene)}${(f.sizes || []).length ? `(${f.sizes.join('・')})` : ''} | ${esc(f.what)}${seenBefore(f) ? '【前から】' : ''}${f.viewpoint ? `(観点${f.viewpoint})` : ''} | ${esc(f.fix)} | ${f.priority} | 未 |`)];
  fs.writeFileSync(path.join(OUT, `findings-${d.file}.md`), md.join('\n') + '\n');
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary.map((s) => ({ file: s.dept.file, name: s.dept.name, hi: s.hi, mid: s.mid, low: s.low, before: s.before })), null, 1));
console.log(`上書きで外した件 ${dropped}`);
for (const s of summary) console.log(`${s.dept.name}: 高 ${s.hi}・中 ${s.mid}・低 ${s.low}(前から ${s.before})`);
