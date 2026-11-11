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
// 部署は目安を超えたら「引き継ぎメモ → 新しい会話」、窓口は「要約してよいかを社長に聞く」と知らせる(部署に要約は勧めない)。
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

// 部署: 目安を超えたら(または仕事の種類が変わったら)引き継ぎメモ1枚 → 新しい会話。要約は頼まない
// 窓口: 会話を替えず、要約してよいかを社長に選択式で聞く
// 窓口の会話かどうか(2026-11-12 社長「やるときは質問で俺に聞いて自動でそっちでやるって仕組みだったよね？」)。
// 窓口は会話を替えずに要約で続ける(台帳 2026-11-11)。クラウドの会話の番号は環境変数に「cse_<番号>」で入る
function isHq(hqSession, env) {
  const id = String(hqSession || '').replace(/^session_/, '');
  const now = String((env || {}).CLAUDE_CODE_REMOTE_SESSION_ID || '').replace(/^(cse|session)_/, '');
  return !!id && now === id;
}

function message(n, limit, opts) {
  const every = n.prompts % limit['くり返し'] === 0;
  const after = n.compacts > 0 ? '最後の要約のあと、' : ''; // 要約したあとの数だと分かるように
  if (opts && opts.hq) {
    // 窓口: 「替える」は出さない。目安を超えたら、要約してよいかを社長に選択式で聞くことだけを知らせる
    const hit = n.prompts >= limit['やりとり'] || n.merges >= limit['公開'];
    if (!hit || (!every && n.prompts !== limit['やりとり'])) return '';
    return `【窓口・会話が長くなってきた】この会話は ${after}やりとり ${n.prompts} 回・公開 ${n.merges} 件。窓口は会話を替えない。いまの仕事の区切りで、AskUserQuestion で「この会話を要約(/compact)してよいか」を社長に選んでもらう(許可されたら、残すもの・捨てるものを入れた /compact の1行をコピーできる形で出す)。文末で頼まない・「替える」を勧めない。いっぱいになったら自動の要約(700000)が走る。`;
  }
  // 部署: 要約(/compact)は頼まない。要約は窓口の会話だけ(台帳 2026-11-11「各部署は長くなったら引き継ぎメモで会話を替える」・
  //   2026-11-12 社長「ここ以外は要約しないんじゃないの？」)。目安を超えたら、区切りで引き継ぎメモ → 窓口が新しい会話を作る
  const over = [];
  if (n.prompts >= limit['やりとり']) over.push(`やりとり ${n.prompts} 回(目安 ${limit['やりとり']})`);
  if (n.merges >= limit['公開']) over.push(`公開 ${n.merges} 件(目安 ${limit['公開']})`);
  if (!over.length) return '';
  if (!every && n.prompts !== limit['やりとり']) return '';
  return `【会話がとても長い】この会話は ${after}${over.join('・')}。いまの仕事の区切りがついたら、node tools/ctx.js handoff <自分の部> --write で引き継ぎメモを作り、窓口へ「会話を替えてほしい」と知らせる(docs/rules/SESSION_HANDOFF.md)。要約(/compact)は頼まない(要約は窓口の会話だけ)。作業の途中では替えない。やりかけの仕事は先に終わらせる。`;
}

function main() {
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch (e) { return; }
  let data; try { data = JSON.parse(input); } catch (e) { return; }
  const p = data && data.transcript_path;
  if (!p || !fs.existsSync(p)) return;
  const limit = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'team', 'routing.json'), 'utf8'))['区切り'];
  const routing = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'team', 'routing.json'), 'utf8'));
  const msg = message(count(p), limit, { hq: isHq(routing['窓口の会話'], process.env) });
  if (msg) process.stdout.write(msg + '\n');
}

if (require.main === module) { try { main(); } catch (e) { /* 知らせるだけの道具。失敗しても止めない */ } process.exit(0); }
module.exports = { count, message, isHq };
