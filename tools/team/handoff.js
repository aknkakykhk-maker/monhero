#!/usr/bin/env node
// 会話を替えるときの引き継ぎメモの下書きを、台帳・最近の公開・残りの仕事から機械で作る。
//
//   node tools/ctx.js handoff <部>            … 下書きを画面に出す
//   node tools/ctx.js handoff <部> --write    … docs/progress/handoff/<部>-<日付>.md に書く(「手で書く所」を埋めてコミット)
//   node tools/ctx.js handoff <部> --latest   … いちばん新しい引き継ぎメモの場所を出す(新しい会話が読む)
//   node tools/ctx.js handoff <部> --compact  … 使わない(部署は要約しない。要約は窓口だけ)。打つと NG で止まる
//
// 【なぜあるか】
// 会話が長いまま続くと、毎回その全部を読み直す(窓口は数日分)。区切りでメモ1枚にして新しい会話へ替える
// (2026-11-11 社長「トークンを無駄に使わない仕組み」案A)。メモを一から書くと抜けるので、機械で分かる所
// (最近の公開・残りの仕事・社長の決めごと)は道具が埋め、人が書くのは「やりかけ・はまった所・返事待ち」だけにする。
// 目安と型: docs/rules/SESSION_HANDOFF.md
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, findDept, git, pathspecs, today, cut, deptList } = require('./lib');
const { collect } = require('./decisions');
const B = require('./branch-scan');

const OUT_DIR = path.join(ROOT, 'docs', 'progress', 'handoff');
const LEDGER = path.join(ROOT, 'docs', 'playbot', 'dashboard', 'ledger.json');

function openJobs(d) {
  let rows = [];
  try { rows = JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch (e) { return []; }
  const key = d['部'].replace(/\(.*$/, '');
  return rows.filter(x => !['公開済み', '取りやめ'].includes(x['いま']) && (String(x['部'] || '').includes(key) || String(x['担当'] || '').includes(d['部長'].replace(/くん$/, ''))));
}

function latest(d) {
  if (!fs.existsSync(OUT_DIR)) return '';
  const f = fs.readdirSync(OUT_DIR).filter(n => n.startsWith(d.id + '-') && n.endsWith('.md')).sort().pop();
  return f ? `docs/progress/handoff/${f}` : '';
}


// この会話が作った枝のうち、main に入っていない物と開いている PR(会話を替えるとき枝が抜けないように機械で載せる)
function ownBranches() {
  const prs = B.openPRs();
  const out = [];
  for (const n of B.ownNames()) {
    const ref = B.ok(['rev-parse', '--verify', '-q', `refs/heads/${n}`]) ? n : (B.ok(['rev-parse', '--verify', '-q', `refs/remotes/origin/${n}`]) ? `origin/${n}` : '');
    if (!ref || B.ok(['merge-base', '--is-ancestor', ref, 'origin/main'])) continue;
    const s = B.scan(ref);
    if (B.landed(s)) continue;
    const pr = prs && prs.find(p => p.head === n);
    out.push(`- \`${n}\` ${pr ? `PR #${pr.number}(開いている)` : (prs ? 'PR なし(★作るか捨てるか)' : 'PR は取れず')} / 本体の追加行 ${s.added} のうち main に ${Math.round(s.ratio * 100)}%`);
  }
  return { lines: out, prs };
}

function draft(d) {
  const L = [];
  const head = git(['rev-parse', '--short', 'HEAD']).trim();
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const dirty = git(['status', '--porcelain']).split('\n').filter(Boolean).length;
  L.push(`# 引き継ぎメモ: ${d['部']}(${today()})`, '');
  L.push(`次の会話は、CLAUDE.md → \`docs/depts/${d.id}.md\` → このメモ、の順に読んで始める。前の会話の中身は読みに行かない。`, '');
  L.push('## いまの状態(機械)', '');
  L.push(`- ブランチ \`${branch}\` / コミット \`${head}\` / 未コミットの変更 ${dirty} 件${dirty ? '(★替える前にコミットするか捨てる)' : ''}`, '');
  L.push('## 最近の公開(この部のファイルに触れたコミット・新しい順)', '');
  const log = d.files.length ? git(['log', '--no-merges', '-n', '12', '--format=%h %ad %s', '--date=format:%m/%d', 'HEAD', '--', ...pathspecs(d)]).split('\n').filter(Boolean) : [];
  if (log.length) for (const l of log) L.push(`- ${cut(l, 130)}`); else L.push('- (なし)');
  L.push('');
  // 社長の頼みの追跡表(完了でない物)。メモを書く人が忘れても、頼みは道具が入れる
  const todo = require('./requests').linesFor(d.id, 20, 110);
  L.push(`## 完了でない社長の頼み(追跡表・${todo.total} 件)`, '');
  if (todo.total) { for (const l of todo.lines) L.push(l); L.push('', '済んだ物は報告に id を書く(窓口が `node tools/ctx.js todo set <id> 完了 --pr <番号>` にする)。'); } else L.push('- (なし)');
  L.push('');
  L.push('## 残りの仕事', '');
  const jobs = openJobs(d);
  if (jobs.length) { L.push('頼みの台帳(docs/playbot/dashboard/ledger.json)で、まだ済んでいないもの:'); for (const x of jobs.slice(-12)) L.push(`- [${x['いま']}] ${cut(x['頼み'], 110)}${(x.PR || []).length ? ' ' + x.PR.join(' ') : ''}`); L.push(''); }
  if (d['板'].length) { L.push('仕事の板(細かい残りはここ。全文は開かず見出しから):'); for (const f of d['板']) L.push(`- \`${f}\``); L.push(''); }
  if (!jobs.length && !d['板'].length) L.push('- (台帳・板に残りなし)', '');
  const own = ownBranches();
  L.push(`## マージしていない自分の枝(機械・${own.lines.length} 件${own.prs ? '' : '・PR 一覧は取れず'})`, '');
  if (own.lines.length) { for (const l of own.lines.slice(0, 12)) L.push(l); L.push('', '★ PR なしの枝は、いまの main に合わせて入れ直して公開するか、捨てる理由を「手で書く所」に書く(枝のまま引き継がない)。'); } else L.push('- (なし)');
  L.push('');
  L.push('## 手で書く所(ここだけ人が書く。無ければ「なし」)', '');
  L.push('- やりかけ(どのファイルのどこまで・次の1手): ');
  L.push('- 社長・窓口の返事待ち(何を聞いているか): ');
  L.push('- はまった所・次の会話がやってはいけないこと: ');
  L.push('- 配り直し・SQL で窓口に頼んだまま済んでいないもの: ', '');
  const r = collect(d, { days: 5, cap: 12, width: 200 });
  L.push(`## 社長の決めごと(${r.since} から・この部に関わる分)`, '');
  if (r.recent.length) for (const l of r.recent) L.push(l); else L.push('- (この期間はなし)');
  L.push('', `全部は \`node tools/ctx.js decisions ${d.id}\`。`, '');
  return L.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const d = findDept(argv.find(a => !a.startsWith('--')));
  if (!d) { console.error(`NG: 部を指定してください(node tools/ctx.js handoff <部>)。\n${deptList()}`); process.exit(1); }
  if (argv.includes('--compact')) {
    // 要約は窓口の会話だけ(台帳 2026-11-11・2026-11-12 社長「ここ以外は要約しないんじゃないの？」)。部署は引き継ぎメモで会話を替える
    console.error('NG: 部署の会話は要約(/compact)しません(要約は窓口だけ)。区切りで node tools/ctx.js handoff ' + d.id + ' --write → 窓口へ「会話を替えてほしい」と知らせてください。');
    process.exit(1);
  }
  if (argv.includes('--latest')) { console.log(latest(d) || `(${d['部']}の引き継ぎメモはまだありません)`); return; }
  const text = draft(d);
  if (!argv.includes('--write')) { process.stdout.write(text); return; }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rel = `docs/progress/handoff/${d.id}-${today()}.md`;
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) { console.error(`NG: ${rel} はもうあります(上書きしません。直すならそのファイルを)。`); process.exit(1); }
  fs.writeFileSync(full, text);
  console.log(`OK: ${rel} に下書きを書いた。`);
  console.log('次: ①「手で書く所」を埋める ②コミットして公開(PR → マージ) ③窓口へ「会話を替えてほしい」と send_message(メモの場所を書く)');
  console.log(`窓口は: node tools/ctx.js newsession ${d.id} "<続きの仕事>" の出力で新しい会話を作る`);
}

if (require.main === module) main();
module.exports = { latest, draft };
