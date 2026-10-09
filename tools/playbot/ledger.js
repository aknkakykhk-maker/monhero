#!/usr/bin/env node
// 頼みごとの台帳(docs/playbot/dashboard/ledger.json)を1つの正にして、台帳の表(REQUESTS.md)と社長室の項目を作る。
//
// 2026-10-09 改善部の提案 C1(社長が選んだ)。1件の仕事を 台帳・社長室(board.json)・… に手で書き分けていて、
// 台帳の行が古いまま食い違っていたため。統括部長・各部は ledger.json の1件を書き換えるだけでよい。
//
//   node tools/playbot/ledger.js            台帳を確かめ、REQUESTS.md の表を作り直す
//   node tools/playbot/ledger.js --check    台帳に問題がある・REQUESTS.md の表が古いなら NG
//
// ledger.json の1件(配列の順は問わない。表と社長室は道具が並べる):
//   id       … 重ならない名前(頼みは r<年月日時刻> など)
//   種別     … 頼み(社長の頼みごと。台帳の表に出る) / 仕事(部の公開・作業・提案。社長室だけに出る)
//   日時     … 受けた日時 "2026-10-09 23:21"(日本時間。時刻が分からなければ "2026-10-08 午前" / 日付だけ)
//   件名     … 社長室に出す短い名前 / 頼み … 頼みごとの本文(頼みは件名か頼みのどちらかが要る)
//   部・担当 … "修理部" と "ドライバーくん2号"(台帳の表には「修理部:ドライバーくん2号」と出る)
//   いま     … 受けた / 班で作業中 / ユーザーの判断待ち / 公開済み / 取りやめ のどれか(ほかは止める)
//   PR       … ["#2426"](無ければ [])
//   公開     … 公開した日時(公開済みのとき。社長室の「公開したもの」に出る時刻)
//   見込み・結果 … 終わるまでは見込み、公開済み・取りやめでは結果
//   親       … 仕事がどの頼みから出たか(頼みの id)。子の仕事がある頼みは、社長室には子だけを出す
//   社長室   … false で社長室に出さない(公開から3日たったものは書かなくても出なくなる)
//   中身・見る場所・詳細・種類・案 … 社長室の項目と同じ(種類は 提案 / 質問。案は配列)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const LEDGER = path.join(ROOT, 'docs', 'playbot', 'dashboard', 'ledger.json');
const REQUESTS = path.join(ROOT, 'docs', 'playbot', 'REQUESTS.md');

const STATES = ['受けた', '班で作業中', 'ユーザーの判断待ち', '公開済み', '取りやめ'];
const KINDS = ['頼み', '仕事'];
const BOARD_KIND = { 受けた: '進行中', 班で作業中: '進行中', ユーザーの判断待ち: '判断待ち', 公開済み: '公開' };
const SHOW_DAYS = 3; // 公開から3日たったものは社長室から外す(ROUTINE.md「社長室」)
const TABLE_NOTE = '<!-- この表は node tools/playbot/ledger.js が docs/playbot/dashboard/ledger.json から作る。手で直さない -->';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})| (午前|午後))?$/;
function sortKey(s) {
  const m = DATE_RE.exec(s || '');
  if (!m) return '';
  const hm = m[4] ? `${m[4]}:${m[5]}` : m[6] === '午前' ? '09:00' : m[6] === '午後' ? '15:00' : '00:00';
  return `${m[1]}-${m[2]}-${m[3]} ${hm}`;
}
// 台帳の表は "10-09 23:21"、社長室は "10/09 23:21"
const short = (s, sep) => String(s || '').replace(/^\d{4}-(\d{2})-(\d{2})/, `$1${sep}$2`);
const who = (e) => (e.部 && !String(e.担当 || '').startsWith(e.部) ? `${e.部}:${e.担当}` : e.担当 || '');

function load() {
  const rows = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  if (!Array.isArray(rows)) throw new Error('ledger.json は配列にする');
  return rows;
}

function validate(rows) {
  const problems = [];
  const ids = new Set();
  for (const e of rows) {
    const at = `台帳「${e.id || '(id なし)'}」`;
    if (!e.id) problems.push(`${at}: id がありません`);
    else if (ids.has(e.id)) problems.push(`${at}: id が重なっています`);
    ids.add(e.id);
    if (!KINDS.includes(e.種別)) problems.push(`${at}: 種別は ${KINDS.join(' / ')} のどれか(いま「${e.種別}」)`);
    if (!STATES.includes(e.いま)) problems.push(`${at}: いまは ${STATES.join(' / ')} のどれか(いま「${e.いま}」)。説明は 見込み・結果 に書く`);
    if (!DATE_RE.test(e.日時 || '')) problems.push(`${at}: 日時は "2026-10-09 23:21" の形(いま「${e.日時}」)`);
    if (e.公開 && !DATE_RE.test(e.公開)) problems.push(`${at}: 公開は "2026-10-09 23:21" の形(いま「${e.公開}」)`);
    if (!e.件名 && !e.頼み) problems.push(`${at}: 件名か頼みのどちらかを書く`);
    if (!Array.isArray(e.PR) || e.PR.some((p) => !/^#\d+$/.test(p))) problems.push(`${at}: PR は ["#2426"] の形の配列(無ければ [])`);
    if (e.種類 && !['提案', '質問'].includes(e.種類)) problems.push(`${at}: 種類は 提案 / 質問 のどちらか`);
    if (e.案 && !Array.isArray(e.案)) problems.push(`${at}: 案は配列にする`);
    if (e.いま === 'ユーザーの判断待ち' && !e.種類) problems.push(`${at}: 判断待ちには種類(提案 / 質問)を付ける`);
  }
  for (const e of rows) {
    if (!e.親) continue;
    const p = rows.find((x) => x.id === e.親);
    if (!p) problems.push(`台帳「${e.id}」: 親「${e.親}」が台帳にありません`);
    else if (p.種別 !== '頼み') problems.push(`台帳「${e.id}」: 親「${e.親}」は頼みにする`);
  }
  return problems;
}

const childrenOf = (rows, id) => rows.filter((x) => x.親 === id);

// 台帳の表(REQUESTS.md)。頼みだけを新しい順に並べる。PR は子の仕事のものも合わせて出す
function requestsTable(rows) {
  const reqs = rows.filter((e) => e.種別 === '頼み').sort((a, b) => sortKey(b.日時).localeCompare(sortKey(a.日時)));
  const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '｜').replace(/\n/g, ' ');
  const out = ['| 受けた日時 | 頼み | 担当(班 / 直し係) | いま | 見込み・結果 |', '| --- | --- | --- | --- | --- |'];
  for (const e of reqs) {
    const prs = [...new Set([...e.PR, ...childrenOf(rows, e.id).flatMap((c) => c.PR)])];
    const done = e.いま === '公開済み' || e.いま === '取りやめ';
    const note = [done ? e.結果 : e.見込み, prs.length ? `PR ${prs.join('・')}` : ''].filter(Boolean).join(' / ');
    out.push(`| ${cell(short(e.日時, '-'))} | ${cell(e.頼み || e.件名)} | ${cell(who(e))} | ${cell(e.いま)} | ${cell(note)} |`);
  }
  return out;
}

function renderRequests(rows) {
  const md = fs.readFileSync(REQUESTS, 'utf8');
  const lines = md.split('\n');
  const first = lines.findIndex((l) => /^\|\s*受けた日時/.test(l));
  if (first < 0) throw new Error('REQUESTS.md に台帳の表(| 受けた日時 | …)がありません');
  let start = first;
  if (lines[start - 1] === '' && lines[start - 2] === TABLE_NOTE) start -= 2;
  let end = first;
  while (end < lines.length && /^\s*\|/.test(lines[end])) end++;
  const next = [...lines.slice(0, start), TABLE_NOTE, '', ...requestsTable(rows), ...lines.slice(end)].join('\n');
  return { md, next };
}

// 社長室の項目(board.json と同じ形)。today は "2026-10-10"
function boardRows(rows, today) {
  const limit = new Date(`${today}T00:00:00+09:00`).getTime() - SHOW_DAYS * 86400000;
  const out = [];
  for (const e of rows) {
    if (e.社長室 === false) continue;
    const 区分 = BOARD_KIND[e.いま];
    if (!区分) continue; // 取りやめは出さない
    if (e.種別 === '頼み' && childrenOf(rows, e.id).length) continue; // 子の仕事があれば、子だけを出す
    const when = 区分 === '公開' ? e.公開 || e.日時 : e.日時;
    if (区分 === '公開' && new Date(`${sortKey(when).replace(' ', 'T')}:00+09:00`).getTime() < limit) continue;
    const r = { id: e.id, 区分, 部: e.部 || '', 担当: e.担当 || '', 件名: e.件名 || e.頼み, 中身: e.中身 || (区分 === '公開' ? e.結果 : '') || '',
      見込み: e.見込み || '', PR: e.PR.join('・'), 見る場所: e.見る場所 || '', 日付: short(when, '/'), _key: sortKey(when) };
    for (const k of ['詳細', '種類', '案']) if (e[k] != null) r[k] = e[k];
    out.push(r);
  }
  out.sort((a, b) => b._key.localeCompare(a._key));
  return out.map(({ _key, ...r }) => r);
}

// 台帳に載っている PR(社長室に出ないものも含む)。社長室の「載せ忘れ」確かめに使う
const allPRs = (rows) => new Set(rows.flatMap((e) => e.PR));

// 「受けた」のままなのに、その件の PR がすべて main に入っている件(始めた・終わったを書き忘れている)。
// 班で作業中は、もとの提案の PR や途中の公開を持つことがあるので見ない
function staleRows(rows, mergedPRs) {
  return rows.filter((e) => e.いま === '受けた' && e.PR.length && e.PR.every((p) => mergedPRs.has(p)));
}

// 社長室の道具が呼ぶ。台帳を確かめ、REQUESTS.md を作り直し、社長室の項目を返す
function writeAll(today) {
  const rows = load();
  const problems = validate(rows);
  if (problems.length) throw new Error('台帳(ledger.json)に問題があります(node tools/playbot/ledger.js で確かめる):\n  - ' + problems.join('\n  - '));
  const { md, next } = renderRequests(rows);
  if (next !== md) fs.writeFileSync(REQUESTS, next);
  return { rows, board: boardRows(rows, today), prs: allPRs(rows) };
}

module.exports = { load, validate, boardRows, requestsTable, writeAll, staleRows, allPRs, STATES };

if (require.main === module) {
  const rows = load();
  const problems = validate(rows);
  if (problems.length) {
    console.error(`NG: 台帳に ${problems.length} 件の問題`);
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }
  const { md, next } = renderRequests(rows);
  const reqs = rows.filter((e) => e.種別 === '頼み').length;
  if (process.argv.includes('--check')) {
    if (next !== md) {
      console.error('NG: REQUESTS.md の表が台帳(ledger.json)と合っていません。node tools/playbot/ledger.js で作り直す(表は手で直さない)');
      process.exit(1);
    }
    console.log(`OK: 台帳 ${rows.length} 件(頼み ${reqs})・REQUESTS.md の表は台帳どおり`);
    process.exit(0);
  }
  if (next !== md) fs.writeFileSync(REQUESTS, next);
  console.log(`作り直した: REQUESTS.md の表(頼み ${reqs} 件 / 台帳 ${rows.length} 件)`);
}
