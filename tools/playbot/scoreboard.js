#!/usr/bin/env node
// 成績表の「できごとの記録」だけを正にして、部員ごとの表と scores.json を足し算で作り直す(手で数えない)。
//
// 2026-10-09 改善部の提案 C2(社長が選んだ)。部員の表と記録が食い違い、MVP・降格をその点で決めていたため。
// 統括部長は docs/playbot/SCOREBOARD.md の「できごとの記録」へ1行足すだけでよい。表は道具が書く。
//
//   node tools/playbot/scoreboard.js            部員ごとの表(SCOREBOARD.md)と scores.json を作り直す
//   node tools/playbot/scoreboard.js --check    作り直すと変わるなら NG(手で表を直した・記録を足して回し忘れた)
//
// 記録の1行: | 日付 | 名前 | できごと | 点 | 根拠 | 種類 |
//   種類は 本物 / 公開 / ボット直し / 見込み / 見間違い / 違反 のどれか。
//   種類の列が無い・空の行は点から決める(+3の倍数=本物 / +2の倍数=公開 / −5の倍数=違反 /
//   +1=ボット直し / −1=見間違い。できごとに「見込み」とあれば ±1 は見込み)。
//   1行にまとめて +27(本物9件)のように書いてよい。件数は 点 ÷ 1件の点。
// 名簿(名前と所属)は docs/playbot/dashboard/departments.json の部長・部員から取る。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const MD = path.join(ROOT, 'docs', 'playbot', 'SCOREBOARD.md');
const DEPTS = path.join(ROOT, 'docs', 'playbot', 'dashboard', 'departments.json');
const SCORES = path.join(ROOT, 'docs', 'playbot', 'dashboard', 'scores.json');

// 種類ごとの1件の点(成績表の「点の数え方」と同じ)。見込みは当たり +1 / 外れ −1 で、表には差し引きを書く
const KINDS = { 本物: 3, 公開: 2, ボット直し: 1, 見込み: 1, 見間違い: -1, 違反: -5 };
const COLS = ['本物', '公開', 'ボット直し', '見込み', '見間違い', '違反'];
const TABLE_HEAD = '## 部員ごとの成績';
const RECORD_HEAD = '## できごとの記録';

const num = (s) => Number(String(s).replace(/[−–]/g, '-').replace(/[+＋\s]/g, ''));
const cells = (line) => line.replace(/^\s*\||\|\s*$/g, '').split('|').map((c) => c.trim());

function roster() {
  const out = [];
  const seen = new Set();
  for (const d of JSON.parse(fs.readFileSync(DEPTS, 'utf8'))) {
    if (d.id === 'hq' || d.id === 'sleep') continue; // 統括部長と休みの部は点を付けない
    const names = [...String(d.部長 || '').split('/'), ...(d.部員 || []).map((m) => m.名前)].map((s) => s.trim()).filter(Boolean);
    for (const n of names) if (!seen.has(n)) { seen.add(n); out.push({ 名前: n, 所属: d.部 }); }
  }
  return out;
}

function sectionLines(md, head) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => l.startsWith(head));
  if (i < 0) throw new Error(`SCOREBOARD.md に「${head}」がありません`);
  let j = i + 1;
  while (j < lines.length && !lines[j].startsWith('## ')) j++;
  return { lines, i, j };
}

function readRecords(md, problems) {
  const { lines, i, j } = sectionLines(md, RECORD_HEAD);
  const rows = lines.slice(i + 1, j).filter((l) => /^\s*\|/.test(l));
  const header = cells(rows[0] || '');
  const at = (name) => header.indexOf(name);
  const out = [];
  for (const line of rows.slice(2)) {
    const c = cells(line);
    const rec = { 日付: c[at('日付')], 名前: c[at('名前')], できごと: c[at('できごと')], 点: num(c[at('点')]), 根拠: c[at('根拠')] || '', 種類: at('種類') >= 0 ? (c[at('種類')] || '') : '' };
    const where = `記録「${rec.日付} ${rec.名前} ${String(rec.できごと).slice(0, 20)}…」`;
    if (!Number.isFinite(rec.点) || rec.点 === 0) { problems.push(`${where} の点が数字になっていません(${c[at('点')]})`); continue; }
    if (!rec.種類) {
      if (/見込み/.test(rec.できごと) && Math.abs(rec.点) === 1) rec.種類 = '見込み';
      else if (rec.点 > 0 && rec.点 % 3 === 0) rec.種類 = '本物';
      else if (rec.点 > 0 && rec.点 % 2 === 0) rec.種類 = '公開';
      else if (rec.点 < 0 && rec.点 % 5 === 0) rec.種類 = '違反';
      else if (rec.点 === 1) rec.種類 = 'ボット直し';
      else if (rec.点 === -1) rec.種類 = '見間違い';
      else { problems.push(`${where} の種類を点(${rec.点})から決められません。種類の列に書いてください`); continue; }
    }
    if (!(rec.種類 in KINDS)) { problems.push(`${where} の種類「${rec.種類}」は ${COLS.join(' / ')} のどれかにする`); continue; }
    const per = KINDS[rec.種類];
    const count = rec.種類 === '見込み' ? 1 : rec.点 / per;
    if (rec.種類 === '見込み' ? Math.abs(rec.点) !== 1 : !(Number.isInteger(count) && count > 0)) {
      problems.push(`${where} の点 ${rec.点} が種類「${rec.種類}」(1件 ${per > 0 ? '+' : ''}${per})と合いません`);
      continue;
    }
    rec.件数 = rec.種類 === '見込み' ? rec.点 : count; // 見込みは当たり +1 / 外れ −1 の差し引き
    out.push(rec);
  }
  return out;
}

function tally(records, people, problems) {
  const byName = new Map(people.map((p) => [p.名前, { ...p, ...Object.fromEntries(COLS.map((k) => [k, 0])), 点: 0, 記録: 0 }]));
  for (const r of records) {
    const row = byName.get(r.名前);
    if (!row) { problems.push(`記録の名前「${r.名前}」が名簿(departments.json の部長・部員)にありません。名前の書き方をそろえるか、名簿に足す`); continue; }
    row[r.種類] += r.件数;
    row.点 += r.点;
    row.記録++;
  }
  return [...byName.values()];
}

const signed = (n) => (n < 0 ? '−' + Math.abs(n) : String(n));

function tableLines(rows) {
  const scored = rows.filter((r) => r.記録 > 0).sort((a, b) => b.点 - a.点 || b.本物 - a.本物);
  const zeroByDept = new Map();
  for (const r of rows.filter((r) => r.記録 === 0)) (zeroByDept.get(r.所属) || zeroByDept.set(r.所属, []).get(r.所属)).push(r.名前);
  const out = [
    '| 名前 | 所属 | 本物 | 公開 | ボット直し | 見込み | 見間違い | 違反 | 点 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  scored.forEach((r, i) => out.push(`| ${r.名前} | ${r.所属} | ${COLS.map((k) => signed(r[k])).join(' | ')} | ${i === 0 ? `**${signed(r.点)}**` : signed(r.点)} |`));
  for (const [dept, names] of zeroByDept) out.push(`| ${names.join(' / ')} | ${dept} | 0 | 0 | 0 | 0 | 0 | 0 | 0 |`);
  return { out, scored };
}

function build() {
  const problems = [];
  const md = fs.readFileSync(MD, 'utf8');
  const records = readRecords(md, problems);
  const rows = tally(records, roster(), problems);
  const { out, scored } = tableLines(rows);
  const { lines, i, j } = sectionLines(md, TABLE_HEAD);
  // 見出しの直後の説明(表より前の文)はそのまま残し、表だけを置き換える
  const body = lines.slice(i + 1, j);
  const firstTable = body.findIndex((l) => /^\s*\|/.test(l));
  const before = firstTable < 0 ? body.filter((l) => l.trim()) : body.slice(0, firstTable).filter((l) => l.trim());
  const note = '<!-- この表は node tools/playbot/scoreboard.js が「できごとの記録」から作る。手で直さない -->';
  const intro = before.filter((l) => l.trim() !== note);
  const section = [lines[i], '', ...(intro.length ? [...intro, ''] : []), note, '', ...out, ''];
  const nextMd = [...lines.slice(0, i), ...section, ...lines.slice(j)].join('\n');
  const scores = scored.map((r) => ({ 名前: r.名前, 所属: r.所属, 本物: r.本物, 公開: r.公開, ボット直し: r.ボット直し, 見込み: r.見込み, 見間違い: r.見間違い, 違反: r.違反, 点: r.点 }));
  return { md, nextMd, scores, problems, records };
}

// 社長室・部署紹介の道具が、作り直す前に呼ぶ。記録に問題があれば止める(古い点のまま出さない)
function writeAll() {
  const { md, nextMd, scores, problems } = build();
  if (problems.length) throw new Error('成績表の記録に問題があります(node tools/playbot/scoreboard.js で確かめる):\n  - ' + problems.join('\n  - '));
  if (nextMd !== md) fs.writeFileSync(MD, nextMd);
  const text = JSON.stringify(scores, null, 1) + '\n';
  if (!fs.existsSync(SCORES) || fs.readFileSync(SCORES, 'utf8') !== text) fs.writeFileSync(SCORES, text);
  return scores;
}

module.exports = { build, writeAll, KINDS };

if (require.main === module) {
  const check = process.argv.includes('--check');
  const { md, nextMd, scores, problems, records } = build();
  const scoresText = JSON.stringify(scores, null, 1) + '\n';
  const curScores = fs.existsSync(SCORES) ? fs.readFileSync(SCORES, 'utf8') : '';
  if (problems.length) {
    console.error(`NG: 成績表の記録に ${problems.length} 件の問題`);
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }
  if (check) {
    const stale = [];
    if (nextMd !== md) stale.push('SCOREBOARD.md の部員ごとの表');
    if (scoresText !== curScores) stale.push('docs/playbot/dashboard/scores.json');
    if (stale.length) {
      console.error(`NG: ${stale.join('・')} が「できごとの記録」と合っていません。node tools/playbot/scoreboard.js で作り直す(表は手で直さない)`);
      process.exit(1);
    }
    console.log(`OK: 成績表は記録 ${records.length} 行の足し算と一致(${scores.length} 人に点)`);
    process.exit(0);
  }
  fs.writeFileSync(MD, nextMd);
  fs.writeFileSync(SCORES, scoresText);
  console.log(`作り直した: 記録 ${records.length} 行 → 部員ごとの表・scores.json(${scores.length} 人に点)`);
  for (const s of scores) console.log(`  ${s.名前}(${s.所属}) ${signed(s.点)}`);
}
