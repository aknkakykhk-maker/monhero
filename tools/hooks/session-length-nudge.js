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
// ★数えるのは「最後の要約(/compact・自動の要約も同じ)のあと」から(2026-11-11 社長「そこちゃんとしてくれないと信用できない」)。
//   要約すると会話は「要約文+そのあとのやりとり」まで軽くなるので、要約の前の数を引きずると、要約した直後でも
//   「やりとり890回」と出てしまう。トランスクリプトには、要約の境目の行({type:'system', subtype:'compact_boundary'})と、
//   要約文の行({isCompactSummary:true})が残る。どちらかを見つけたら、そこまでの数を捨てて数え直す(直後は0なので知らせない)
// 1段目(要約の目安)を超えたら「区切りで要約を」、2段目(替える目安)を超えたら「引き継ぎメモ → 新しい会話」と知らせる。
// 毎回は出さず「くり返し」回ごとに1回。
//
// 【止めない】知らせるだけ。何が起きても終了コード 0(このフックのせいで会話が止まらないように)。
//   echo '{"transcript_path":"<jsonl>"}' | node tools/hooks/session-length-nudge.js
'use strict';
const fs = require('fs');
const path = require('path');

function count(transcriptPath) {
  let prompts = 0, merges = 0, compacts = 0;
  const text = fs.readFileSync(transcriptPath, 'utf8');
  for (const line of text.split('\n')) {
    if (!line) continue;
    // 速く通すため、関係のない行は JSON にしない
    const isUser = line.includes('"type":"user"');
    const isMerge = line.includes('merge_pull_request');
    const maybeCompact = line.includes('compact_boundary') || line.includes('isCompactSummary');
    if (!isUser && !isMerge && !maybeCompact) continue;
    let e; try { e = JSON.parse(line); } catch (err) { continue; }
    // 要約の境目・要約文: 本文に「compact_boundary」と書いてあるだけの行(道具の結果・会話の文)は、外側の印を見るので当たらない
    if (e && ((e.type === 'system' && e.subtype === 'compact_boundary') || e.isCompactSummary === true)) {
      if (e.type === 'system') compacts++;
      prompts = 0; merges = 0;
      continue;
    }
    const c = e && e.message && e.message.content;
    if (e.type === 'user' && !e.isMeta && !e.isSidechain) {
      if (typeof c === 'string') prompts++;
      else if (Array.isArray(c) && c.some(b => b && b.type === 'text') && !c.some(b => b && b.type === 'tool_result')) prompts++;
    } else if (e.type === 'assistant' && Array.isArray(c)) {
      for (const b of c) if (b && b.type === 'tool_use' && /merge_pull_request$/.test(String(b.name || ''))) merges++;
    }
  }
  return { prompts, merges, compacts };
}

// 2段構え(2026-11-11 社長「会話を替えるのも無駄にならないか」):
//   1段目 … 同じ仕事が続くなら、公開の区切りで要約(/compact)をかけて軽くする(会話は替えない)
//   2段目 … とても長い・仕事の種類が変わる → 引き継ぎメモ1枚 → 新しい会話
function message(n, limit) {
  const every = n.prompts % limit['くり返し'] === 0;
  const after = n.compacts > 0 ? '最後の要約のあと、' : ''; // 要約したあとの数だと分かるように
  const over = [];
  if (n.prompts >= limit['やりとり']) over.push(`やりとり ${n.prompts} 回(目安 ${limit['やりとり']})`);
  if (n.merges >= limit['公開']) over.push(`公開 ${n.merges} 件(目安 ${limit['公開']})`);
  if (over.length) {
    if (!every && n.prompts !== limit['やりとり']) return '';
    return `【会話がとても長い】この会話は ${after}${over.join('・')}。いまの仕事の区切りがついたら、node tools/ctx.js handoff <自分の部> --write で引き継ぎメモを作り、窓口へ「会話を替えてほしい」と知らせる(docs/rules/SESSION_HANDOFF.md)。作業の途中では替えない。やりかけの仕事は先に終わらせる。`;
  }
  const soft = [];
  if (n.prompts >= limit['要約のやりとり']) soft.push(`やりとり ${n.prompts} 回`);
  if (n.merges >= limit['要約の公開']) soft.push(`公開 ${n.merges} 件`);
  if (!soft.length) return '';
  if (!every && n.prompts !== limit['要約のやりとり']) return '';
  return `【会話が長くなってきた】この会話は ${after}${soft.join('・')}。同じ仕事が続くなら、次に公開が済んだ区切りの報告の最後に「この会話に要約(/compact)をかけてほしい」と1行書き、node tools/ctx.js handoff <自分の部> --compact が出す指示文を添える(docs/rules/SESSION_HANDOFF.md)。仕事の種類が変わるなら、要約ではなく引き継ぎメモ → 新しい会話。`;
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
