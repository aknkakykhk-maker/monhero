#!/usr/bin/env node
// 今の助手どうしの台本の書き直し一覧(docs/progress/assistant-peer/lines/tsumugi-rewrite.txt の edit 行)を、data/assistants.js の台本へ当てる(ツムギ 2026-11-07)。
// id は変えない(思い出アルバム mh_assistant_peer_album_v1 が id で覚えているため)。話す人がちがう行は当てずに止める。
//
// 行の番号の数え方(一覧の edit <id> <行> と同じ):
//   <数字>        … その台本の lines の中の { who, e, t } を上から数える(1から)
//   makeup<数字>  … けんか(ASSISTANT_PEER_QUARRELS)の makeup の中を上から数える
//   reply<n>-<m>  … choice の n 番目の返事の reply の中の m 行目
//   edit reaction-<助手>-<gift|token|play> | <表情> <セリフ> … ASSISTANT_PEER_REACTIONS
// tag / add の行は読まない(新しい仕組みの鍵と「距離をおく」の案。取り込みの側で使う)。
//
//   node tools/assistant/peer-rewrite-apply.js [一覧のファイル]           当てられるかだけ確かめる(書かない)
//   node tools/assistant/peer-rewrite-apply.js [一覧のファイル] --write   data/assistants.js に書く(試すときは、あとで git checkout で戻す)
// ★今の台本は公開中なので、ゲームへは --write で直接書かない。書き直しの表 ASSISTANT_PEER_REWRITES を
//   node tools/assistant/peer-rewrite-table.js で作り、公開の印 assistantLife が真のときだけ使う(ナカヨシ4 2026-11-07)。
//   当て方の本体 applyEdits はその道具からも使う
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const P = path.join(root, 'monster-hero', 'data', 'assistants.js');
const args = process.argv.slice(2);
const write = args.includes('--write');
const list = args.find((a) => !a.startsWith('--')) || path.join(root, 'docs', 'progress', 'assistant-peer', 'lines', 'tsumugi-rewrite.txt');
const readEdits = (file) => fs.readFileSync(file, 'utf8').split('\n').filter((l) => /^edit /.test(l));
function applyEdits(s, edits) {
  const esc = (t) => t.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const LINE = /\{ who:'(\w+)', e:'(\w+)', t:'((?:[^'\\]|\\.)*)' \}/g;
  let ok = 0;
  const ng = [];
  for (const l of edits) {
    let m = l.match(/^edit reaction-(\w+)-(gift|token|play) \| (\S+) (.*)$/);
    if (m) {
      const [, who, kind, e, t] = m;
      const at = s.search(new RegExp('^  ' + who + ':\\s+\\{ gift:', 'm'));
      const re = new RegExp(kind + ":\\{ e:'(\\w+)', t:'((?:[^'\\\\]|\\\\.)*)' \\}", 'g');
      re.lastIndex = Math.max(0, at);
      const mm = at < 0 ? null : re.exec(s);
      if (!mm || s.slice(at, mm.index).includes('\n')) { ng.push(`反応が見つからない: ${l}`); continue; }
      s = s.slice(0, mm.index) + `${kind}:{ e:'${e}', t:'${esc(t)}' }` + s.slice(mm.index + mm[0].length);
      ok++;
      continue;
    }
    m = l.match(/^edit (\S+) (\S+) \| (\S+) (\S+) (.*)$/);
    if (!m) { ng.push(`形がちがう: ${l}`); continue; }
    const [, id, label, who, e, t] = m;
    const at = s.indexOf(`id:'${id}'`);
    if (at < 0) { ng.push(`id が無い: ${id}`); continue; }
    const next = s.indexOf('{ id:', at + 5);
    const end = next < 0 ? s.length : next;
    let from = at;
    let n;
    let stopAt = end;
    if (/^makeup\d+$/.test(label)) { from = s.indexOf('makeup:', at); n = Number(label.slice(6)); }
    else if (/^reply\d+-\d+$/.test(label)) {
      const [a, b] = label.slice(5).split('-').map(Number);
      let p = at;
      for (let i = 0; i < a && p >= 0; i++) p = s.indexOf('reply:', p + 1);
      from = p; n = b;
      const after = p < 0 ? -1 : s.indexOf('reply:', p + 1);
      if (after > 0 && after < end) stopAt = after;
    } else if (/^\d+$/.test(label)) n = Number(label);
    else { ng.push(`行の番号の形がちがう: ${l}`); continue; }
    if (from < 0 || from > end) { ng.push(`その段が無い: ${l}`); continue; }
    LINE.lastIndex = from;
    let k = 0, mm;
    while ((mm = LINE.exec(s)) && mm.index < stopAt) { k++; if (k === n) break; }
    if (!mm || mm.index >= stopAt || k !== n) { ng.push(`行が無い: ${l}`); continue; }
    if (mm[1] !== who) { ng.push(`話す人がちがう(元は ${mm[1]}): ${l}`); continue; }
    s = s.slice(0, mm.index) + `{ who:'${who}', e:'${e}', t:'${esc(t)}' }` + s.slice(mm.index + mm[0].length);
    ok++;
  }
  return { s, ok, ng };
}
if (require.main === module) {
  const edits = readEdits(list);
  const { s, ok, ng } = applyEdits(fs.readFileSync(P, 'utf8'), edits);
  if (write && ng.length === 0) fs.writeFileSync(P, s);
  console.log(`当てられる: ${ok} / ${edits.length}${write ? (ng.length ? '(NG があるので書かなかった)' : '(data/assistants.js に書いた)') : '(確かめだけ。書くときは --write)'}`);
  if (ng.length) { console.log(ng.join('\n')); process.exit(1); }
}
module.exports = { applyEdits, readEdits, defaultList: path.join(root, 'docs', 'progress', 'assistant-peer', 'lines', 'tsumugi-rewrite.txt') };
