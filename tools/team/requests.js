#!/usr/bin/env node
// 社長の頼みの追跡表: 頼み1件ごとに「どの部のどの会話へ頼んだか・いまどこまでか・PR」を持ち、完了まで追う。
//
//   node tools/ctx.js todo                     … 完了でない頼みの数(部ごと)と、止まっている物の上位
//   node tools/ctx.js todo <部>                … その部の完了でない頼み(古い順・小さく)
//   node tools/ctx.js todo sync                … 台帳に足した行を表へ取り込む(未依頼で入る。頼んだ先は行の末尾の「(窓口経由・クラフト12)」から)
//   node tools/ctx.js todo add "<中身>" --dept dev --to クラフト15   … 台帳に載らない小さな頼みを1件足す
//   node tools/ctx.js todo set <id>[,<id>…] <状態> [--to 名前] [--pr 6130] [--memo "…"] [--dept 部]   … 状態を変える
//   node tools/ctx.js todo show <id>           … 1件の全部(台帳の行も)
//   node tools/ctx.js todo find <語>           … 中身・メモから探す(完了も含む)
//   node tools/ctx.js todo --all [部] / --json [部] / --count
//
// 状態: 未依頼 → 依頼済み → 作業中 → 確認待ち → 完了(ほかに やめた・上書き済み=後の決めごとで変わった)
//
// 【なぜあるか】(2026-11-14 社長「なんかお願いしたのに漏れてるの多いのは何で?」)
// 決めごとは台帳(docs/rules/PRESIDENT_DECISIONS.md)に書いていたが、「どの部に頼んだか・できたか」を追う物が無かった。
// 受けた会話が区切りで替わると、引き継ぎメモに載らなかった頼みはそのまま消えた(例: 11/13「大会の賞品にビートP」)。
// 前の頼みの台帳(docs/playbot/dashboard/ledger.json)は手で書く物で、10/22 から更新が止まっていた。
// 今度は「台帳の行 → 表」を機械で取り込み、取り込み忘れは検査(requests-check.js)で止め、
// newsession の依頼文・handoff のメモ・brief・窓口の知らせに自動で出す。人が覚えて追う物にしない。
// 決まり: docs/rules/REQUEST_TRACKING.md
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT, loadDepts, findDept, today, cut, deptList } = require('./lib');

const FILE = path.join(__dirname, 'requests.json');
const LEDGER = path.join(ROOT, 'docs', 'rules', 'PRESIDENT_DECISIONS.md');
const STATES = ['未依頼', '依頼済み', '作業中', '確認待ち', '完了', 'やめた', '上書き済み'];
const CLOSED = ['完了', 'やめた', '上書き済み'];
const STALE_DAYS = 2; // 依頼済み・作業中・確認待ちのまま、この日数を超えたら ★(止まっていないか窓口が確かめる)
const DATED = /^- (20\d\d-\d\d-\d\d) (.+)$/;
const HOW = /^(窓口の)?進め方[::]/; // 進め方の決めごとは錠(decision-locks.json)が受け持つ。追跡表には入れない

const hashOf = (line) => crypto.createHash('sha1').update(line).digest('hex').slice(0, 8);
const isOpen = (r) => !CLOSED.includes(r['状態']);
const daysSince = (d) => Math.floor((Date.parse(today()) - Date.parse(d)) / 86400000);

function load() {
  const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!Array.isArray(j['頼み'])) throw new Error('requests.json の「頼み」は配列にする');
  return j;
}
// 1件1行で書く(複数の会話が別の行を直しても、マージでぶつかりにくい)
function save(j) {
  const head = Object.entries(j).filter(([k]) => k !== '頼み').map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  const rows = j['頼み'].map(r => '  ' + JSON.stringify(r));
  fs.writeFileSync(FILE, ['{', ...head, ' "頼み": [', rows.join(',\n'), ' ]', '}', ''].join('\n'));
}

// 台帳の「中身の決めごと」の節の、日付で始まる行(進め方は除く)
function ledgerRows() {
  const out = [];
  let body = false;
  for (const line of fs.readFileSync(LEDGER, 'utf8').split('\n')) {
    if (/^## /.test(line)) { body = !/^## 進め方/.test(line); continue; }
    if (!body) continue;
    const m = DATED.exec(line);
    if (!m || HOW.test(m[2])) continue;
    out.push({ date: m[1], text: m[2], hash: hashOf(line) });
  }
  return out;
}

// 行の末尾の「(窓口経由・クラフト12)」から、頼んだ先の会話の名前と部を読む
function guessOwner(text, names) {
  const groups = text.match(/[((][^(())]*[))]/g) || [];
  for (const g of groups.reverse()) {
    for (const tok of g.slice(1, -1).split(/[・、,\s]/)) {
      const m = /^([^\d\s]+?)(\d*)$/.exec(tok.trim());
      if (m && names[m[1]] && m[1] !== '窓口') return { to: m[1] + m[2], dept: names[m[1]] };
    }
  }
  return { to: '', dept: 'hq' };
}

function nextId(rows, date) {
  const pre = 'r' + date.slice(5, 7) + date.slice(8, 10) + '-';
  const n = rows.filter(r => r.id.startsWith(pre)).reduce((a, r) => Math.max(a, Number(r.id.slice(pre.length)) || 0), 0);
  return pre + String(n + 1).padStart(3, '0');
}

// 台帳の行のうち、表に入れるべきなのにまだ無い物(検査と sync が使う)
//   「追跡の始まり」より前の行は、表の「対象のことば」に当たる物だけ(2026-11-09〜 のモンサクを突き合わせた分)
function missing(j, led) {
  const have = new Set(j['頼み'].map(r => r['台帳']).filter(Boolean));
  const since = j['追跡の始まり'];
  const from = j['さかのぼり'] || {};
  const re = from['語'] ? new RegExp(from['語']) : null;
  return (led || ledgerRows()).filter(l => !have.has(l.hash)
    && (l.date >= since || (re && l.date >= from['から'] && re.test(l.text))));
}

function sync(j) {
  const led = ledgerRows();
  const live = new Set(led.map(l => l.hash));
  // 台帳の行が直されて印が合わなくなった物は、同じ日付で頭がいちばん長く合う行へ付け替える
  const orphans = j['頼み'].filter(r => r['台帳'] && !live.has(r['台帳']));
  const relinked = [];
  for (const r of orphans) {
    const cands = missing(j, led).filter(l => l.date === r['日付']);
    let best = null, bestLen = 0;
    for (const l of cands) { let k = 0; while (k < l.text.length && k < r['中身'].length && l.text[k] === r['中身'][k]) k++; if (k > bestLen) { best = l; bestLen = k; } }
    if (best && bestLen >= 12) { r['台帳'] = best.hash; relinked.push(r.id); }
  }
  const added = [];
  for (const l of missing(j, led).sort((a, b) => a.date.localeCompare(b.date))) {
    const o = guessOwner(l.text, j['担当の名前']);
    const row = { id: nextId(j['頼み'], l.date), '日付': l.date, '台帳': l.hash, '中身': cut(l.text.replace(/\*\*/g, ''), 150), '部': o.dept, '会話': o.to, '状態': '未依頼', PR: [], 'メモ': '' };
    j['頼み'].push(row); added.push(row);
  }
  return { added, relinked };
}

const line = (r, width) => `- ${r.id} [${r['状態']}${stale(r) ? '★' : ''}] ${r['会話'] ? r['会話'] + ': ' : ''}${cut(r['中身'], width || 96)}${r.PR.length ? ' ' + r.PR.join(' ') : ''}`;
const stale = (r) => ['依頼済み', '作業中', '確認待ち'].includes(r['状態']) && daysSince(r['更新'] || r['日付']) > STALE_DAYS;
const rank = (r) => STATES.indexOf(r['状態']); // 未依頼がいちばん上

// その部の完了でない頼み(newsession・handoff・brief・フックが使う)
function openFor(deptId) {
  let j; try { j = load(); } catch (e) { return []; }
  return j['頼み'].filter(r => isOpen(r) && (!deptId || r['部'] === deptId)).sort((a, b) => rank(a) - rank(b) || a['日付'].localeCompare(b['日付']) || a.id.localeCompare(b.id));
}
// 依頼文・メモに差し込む行(多いときは上位だけ。残りは件数)
function linesFor(deptId, cap = 12, width = 96) {
  const rows = openFor(deptId);
  const out = rows.slice(0, cap).map(r => line(r, width));
  if (rows.length > cap) out.push(`- … ほか ${rows.length - cap} 件(node tools/ctx.js todo ${deptId} --all)`);
  return { total: rows.length, lines: out };
}
// 1行のまとめ(brief・窓口の知らせ)
function summary() {
  const rows = openFor();
  if (!rows.length) return '';
  const un = rows.filter(r => r['状態'] === '未依頼').length;
  const st = rows.filter(stale).length;
  return `社長の頼みで完了でない物: ${rows.length} 件(未依頼 ${un}${st ? `・止まっているかも★ ${st}` : ''})`;
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const VAL = ['--to', '--pr', '--memo', '--dept', '--date'];
  const pos = argv.filter((a, i) => !a.startsWith('--') && !VAL.includes(argv[i - 1]));
  const j = load();
  const rows = j['頼み'];
  const cmd = pos[0];

  if (argv.includes('--count')) { console.log(summary() || '社長の頼みで完了でない物: 0 件'); return; }

  if (cmd === 'sync') {
    const r = sync(j);
    if (r.added.length || r.relinked.length) save(j);
    if (r.relinked.length) console.log(`台帳の行が直されていた ${r.relinked.length} 件を付け替えた: ${r.relinked.join(' ')}`);
    console.log(`台帳から取り込んだ頼み: ${r.added.length} 件(状態は未依頼)`);
    for (const x of r.added.slice(0, 15)) console.log(`${line(x, 80)}  ← ${x['部']}`);
    if (r.added.length > 15) console.log(`… ほか ${r.added.length - 15} 件`);
    if (r.added.length) console.log('次: 頼んだら node tools/ctx.js todo set <id> 依頼済み --to <会話の名前>(部が違えば --dept)。窓口が自分で済ませた記録は … set <id> 完了 --memo 記録');
    return;
  }

  if (cmd === 'add') {
    const text = pos.slice(1).join(' ');
    const d = findDept(opt('--dept') || 'hq');
    if (!text || !d) { console.error(`NG: node tools/ctx.js todo add "<中身>" --dept <部> [--to <会話の名前>]\n${deptList()}`); process.exit(1); }
    const date = opt('--date') || today();
    const row = { id: nextId(rows, date), '日付': date, '台帳': '', '中身': cut(text, 150), '部': d.id, '会話': opt('--to') || '', '状態': opt('--to') ? '依頼済み' : '未依頼', PR: [], 'メモ': opt('--memo') || '', '更新': today() };
    rows.push(row); save(j);
    console.log('OK: ' + line(row));
    return;
  }

  if (cmd === 'set') {
    const ids = String(pos[1] || '').split(',').filter(Boolean);
    const state = pos[2];
    if (!ids.length || (state && !STATES.includes(state))) { console.error(`NG: node tools/ctx.js todo set <id>[,<id>…] <状態> [--to 名前] [--pr 番号] [--memo "…"] [--dept 部]\n状態: ${STATES.join(' / ')}`); process.exit(1); }
    const d = opt('--dept') ? findDept(opt('--dept')) : null;
    if (opt('--dept') && !d) { console.error(`NG: 部「${opt('--dept')}」が分からない。\n${deptList()}`); process.exit(1); }
    const bad = ids.filter(id => !rows.some(r => r.id === id));
    if (bad.length) { console.error(`NG: この id の頼みが無い: ${bad.join(' ')}`); process.exit(1); }
    for (const id of ids) {
      const r = rows.find(x => x.id === id);
      if (state) r['状態'] = state;
      if (d) r['部'] = d.id;
      if (opt('--to') !== undefined) r['会話'] = opt('--to');
      if (opt('--pr')) for (const p of String(opt('--pr')).split(',')) { const n = '#' + p.replace(/^#/, ''); if (!r.PR.includes(n)) r.PR.push(n); }
      if (opt('--memo') !== undefined) r['メモ'] = opt('--memo');
      r['更新'] = today();
      if (r['状態'] === '完了' && !r.PR.length && !r['メモ']) { console.error(`NG: ${id} を完了にするには、PR の番号(--pr)か、確かめた所のメモ(--memo)が要る(できたことを確かめずに完了にしない)。`); process.exit(1); }
      console.log('OK: ' + line(r));
    }
    save(j);
    return;
  }

  if (cmd === 'show') {
    const r = rows.find(x => x.id === pos[1]);
    if (!r) { console.error('NG: その id の頼みが無い'); process.exit(1); }
    for (const [k, v] of Object.entries(r)) console.log(`${k}: ${Array.isArray(v) ? v.join(' ') : v}`);
    const l = ledgerRows().find(x => x.hash === r['台帳']);
    if (l) console.log(`台帳の行: - ${l.date} ${l.text}`);
    return;
  }

  if (cmd === 'find') {
    const w = pos.slice(1).join(' ');
    const hit = rows.filter(r => (r['中身'] + r['メモ'] + r['会話']).includes(w));
    console.log(`# 「${w}」に当たる頼み ${hit.length} 件` + (hit.length > 30 ? '(新しい30件)' : ''));
    for (const r of hit.slice(-30)) console.log(line(r, 110) + (r['メモ'] ? `  〔${cut(r['メモ'], 60)}〕` : ''));
    return;
  }

  const d = cmd ? findDept(cmd) : null;
  if (cmd && !d) { console.error(`NG: 「${cmd}」が分からない(部の名前か sync / add / set / show / find)。\n${deptList()}`); process.exit(1); }
  const all = argv.includes('--all');
  if (argv.includes('--json')) { console.log(JSON.stringify(d ? openFor(d.id) : openFor())); return; }

  if (d) {
    const r = linesFor(d.id, all ? 9999 : 20, 110);
    console.log(`# ${d['部']}の完了でない頼み ${r.total} 件(未依頼が先・古い順。★は ${STALE_DAYS} 日を超えて動きなし)`);
    for (const l of r.lines) console.log(l);
    if (!r.total) console.log('- (なし)');
    console.log('\n状態を変える: node tools/ctx.js todo set <id> <状態> [--pr 番号] [--memo "…"](できたら窓口へ報告。窓口が 完了 にする)');
    return;
  }

  // 全体: 部ごとの数と、気にする物の上位
  const open = openFor();
  console.log(`# 社長の頼みの追跡表: 完了でない物 ${open.length} 件 / 全 ${rows.length} 件`);
  for (const dd of loadDepts()) {
    const mine = open.filter(r => r['部'] === dd.id);
    if (!mine.length) continue;
    const c = {}; for (const r of mine) c[r['状態']] = (c[r['状態']] || 0) + 1;
    console.log(`  ${dd.id.padEnd(15)} ${String(mine.length).padStart(3)} 件  ${STATES.filter(s => c[s]).map(s => `${s} ${c[s]}`).join('・')}${mine.some(stale) ? `  ★${mine.filter(stale).length}` : ''}`);
  }
  const top = open.filter(r => r['状態'] === '未依頼' || stale(r)).slice(0, all ? 9999 : 12);
  if (top.length) { console.log('\n先に見る物(未依頼・止まっているかも★):'); for (const r of top) console.log(line(r, 100)); }
  const un = missing(j).length;
  if (un) console.log(`\n★ 台帳にあって表に無い行が ${un} 件: node tools/ctx.js todo sync`);
  console.log('\n部ごと: node tools/ctx.js todo <部> / 取り込み: … todo sync / 状態: … todo set <id> <状態>');
}

if (require.main === module) { try { main(); } catch (e) { console.error('NG: ' + e.message); process.exit(1); } }
module.exports = { STATES, CLOSED, load, save, ledgerRows, missing, openFor, linesFor, summary, hashOf, guessOwner };
