#!/usr/bin/env node
// 会話が長くなったら「区切りで引き継ぎメモを作って会話を替える」と1行だけ知らせる(Claude Code の UserPromptSubmit フック)。
//
// 【なぜあるか】
// 会話が長いまま続くと、毎回その全部を読み直す(窓口は数日分・部は公開を重ねた分)。「長くなったら替える」を
// 覚えておくのではなく、機械が数えて知らせる(2026-11-11 社長「トークンを無駄に使わない仕組み」案A)。
//
// 【数えるもの】(目安は tools/team/routing.json の「区切り」)
//   やりとり … 人・ほかの会話から届いた頼みの数(道具の結果は数えない)
//   公開     … PR をマージした回数
// どちらかが目安を超えたら知らせる。毎回は出さず「くり返し」回ごとに1回。
//
// 【止めない】知らせるだけ。何が起きても終了コード 0(このフックのせいで会話が止まらないように)。
//   echo '{"transcript_path":"<jsonl>"}' | node tools/hooks/session-length-nudge.js
'use strict';
const fs = require('fs');
const path = require('path');

function count(transcriptPath) {
  let prompts = 0, merges = 0;
  const text = fs.readFileSync(transcriptPath, 'utf8');
  for (const line of text.split('\n')) {
    if (!line) continue;
    // 速く通すため、関係のない行は JSON にしない
    const isUser = line.includes('"type":"user"');
    const isMerge = line.includes('merge_pull_request');
    if (!isUser && !isMerge) continue;
    let e; try { e = JSON.parse(line); } catch (err) { continue; }
    const c = e && e.message && e.message.content;
    if (e.type === 'user' && !e.isMeta && !e.isSidechain) {
      if (typeof c === 'string') prompts++;
      else if (Array.isArray(c) && c.some(b => b && b.type === 'text') && !c.some(b => b && b.type === 'tool_result')) prompts++;
    } else if (e.type === 'assistant' && Array.isArray(c)) {
      for (const b of c) if (b && b.type === 'tool_use' && /merge_pull_request$/.test(String(b.name || ''))) merges++;
    }
  }
  return { prompts, merges };
}

function message(n, limit) {
  const over = [];
  if (n.prompts >= limit['やりとり']) over.push(`やりとり ${n.prompts} 回(目安 ${limit['やりとり']})`);
  if (n.merges >= limit['公開']) over.push(`公開 ${n.merges} 件(目安 ${limit['公開']})`);
  if (!over.length) return '';
  if (n.prompts % limit['くり返し'] !== 0 && n.prompts !== limit['やりとり']) return '';
  return `【会話が長くなった】この会話は ${over.join('・')}。いまの仕事の区切りがついたら、node tools/ctx.js handoff <自分の部> --write で引き継ぎメモを作り、窓口へ「会話を替えてほしい」と知らせる(docs/rules/SESSION_HANDOFF.md)。やりかけの仕事は先に終わらせてよい。`;
}

function main() {
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch (e) { return; }
  let data; try { data = JSON.parse(input); } catch (e) { return; }
  const p = data && data.transcript_path;
  if (!p || !fs.existsSync(p)) return;
  const limit = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'team', 'routing.json'), 'utf8'))['区切り'];
  const msg = message(count(p), limit);
  if (msg) process.stdout.write(msg + '\n');
}

if (require.main === module) { try { main(); } catch (e) { /* 知らせるだけの道具。失敗しても止めない */ } process.exit(0); }
module.exports = { count, message };
