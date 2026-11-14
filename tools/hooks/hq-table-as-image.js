#!/usr/bin/env node
// 窓口の会話で、返答に表の記法(| --- | の行)が残っていたら、終える前に止める(Claude Code の Stop フック)。
//
// 【なぜあるか】
// 台帳「進め方」の決めごと「表は画像(PNG)で見せる。送る前に拡大して、文字の切れ・単語の途中の改行がないか確かめる」は、
// 窓口が覚えて守るだけだった(決めごとの錠では「人が守る」)。社長に返事を出すのは窓口の会話なので、そこで機械が止める
// (2026-11-12 社長「決めたことを無視しないでちゃんと決めごととしての仕組み作ってね」)。
//
// 【動く所】窓口の会話だけ(tools/team/routing.json の「窓口の会話」と、環境変数 CLAUDE_CODE_REMOTE_SESSION_ID が同じとき)。
//   部署の会話・手元の端末では何もしない(部署の報告は窓口あてで、社長に見せる形にするのは窓口)。
// 【見るもの】最後に人が書いたメッセージより後の、返答の文章。コードブロックの中は見ない。
//   表の区切りの行(| --- | --- | の形・2列以上)が1つでもあれば表とみなす。
// 【止め方】標準出力へ {"decision":"block","reason":...}。書き直してもまだ残るとき(stop_hook_active)は、
//   止め続けないよう知らせるだけにする。入力が読めないなど判断がつかないときは何もしない(会話を止めない)。
//   echo '{"transcript_path":"<jsonl>"}' | CLAUDE_CODE_REMOTE_SESSION_ID=cse_<窓口> node tools/hooks/hq-table-as-image.js
'use strict';
const fs = require('fs');
const path = require('path');

const strip = (s) => String(s || '').replace(/^(cse|session)_/, '');
const isHq = (hqSession, env) => { const id = strip(hqSession); return !!id && strip((env || {}).CLAUDE_CODE_REMOTE_SESSION_ID) === id; };

// 表の区切りの行(コードブロックの外・2列以上)を返す。無ければ ''
function findTable(text) {
  const t = String(text || '').replace(/```[\s\S]*?```/g, '');
  for (const line of t.split('\n')) {
    if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line) && line.includes('|')) return line.trim();
  }
  return '';
}

// 最後に人が書いたメッセージより後の、返答の文章
function lastReplyTexts(transcriptPath) {
  const entries = [];
  for (const line of fs.readFileSync(transcriptPath, 'utf8').split('\n')) { if (!line) continue; try { entries.push(JSON.parse(line)); } catch (e) { /* 壊れた行は読み飛ばす */ } }
  const isUserText = (e) => e.type === 'user' && !e.isMeta && e.message && (
    typeof e.message.content === 'string'
    || (Array.isArray(e.message.content) && e.message.content.some(c => c && (c.type === 'text' || c.type === 'image'))));
  let start = 0;
  for (let i = entries.length - 1; i >= 0; i--) { if (isUserText(entries[i])) { start = i + 1; break; } }
  const texts = [];
  for (const e of entries.slice(start)) {
    if (e.type !== 'assistant' || e.isSidechain || !e.message || !Array.isArray(e.message.content)) continue;
    for (const c of e.message.content) if (c && c.type === 'text' && c.text) texts.push(c.text);
  }
  return texts;
}

function main() {
  let input;
  try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (e) { return; }
  const hq = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'team', 'routing.json'), 'utf8'))['窓口の会話'];
  if (!isHq(hq, process.env)) return;
  const p = input && input.transcript_path;
  if (!p || !fs.existsSync(p)) return;
  const hit = lastReplyTexts(p).map(findTable).find(Boolean);
  if (!hit) return;
  if (input.stop_hook_active) {
    process.stdout.write(JSON.stringify({ systemMessage: '表のチェック: 返答にまだ表の記法が残っています(表は画像で見せる決めごと)' }));
    return;
  }
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: '台帳「進め方」: 表は画像(PNG)で見せる。今回の返答に表の記法(| --- | の行)が残っています。'
      + '表を画像(PNG)にして送り直してください(送る前に拡大して、文字の切れ・単語の途中の改行がないか確かめる)。'
      + '画像にするほどでもない内容なら、表をやめて箇条書きで書き直してください。',
  }));
}

if (require.main === module) { try { main(); } catch (e) { /* 判断がつかないときは止めない */ } process.exit(0); }
module.exports = { findTable, isHq, lastReplyTexts };
