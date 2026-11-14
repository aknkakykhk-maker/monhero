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
  // 窓口はトークン数で数える(2026-11-12 社長「トークン数で管理するんじゃないの？」)。
  //   tokens … いまの文脈の大きさ(最後の返事の usage: input + cache_read + cache_creation)
  //   prevTokens … ひとつ前の頼みを受けた時点の文脈の大きさ(節目をまたいだ時だけ知らせるため)
  let tokens = 0, prevTokens = 0;
  const text = fs.readFileSync(transcriptPath, 'utf8');
  for (const line of text.split('\n')) {
    if (!line) continue;
    // 速く通すため、関係のない行は JSON にしない
    const isUser = line.includes('"type":"user"');
    const isMerge = line.includes('merge_pull_request');
    const maybeCompact = line.includes('compact_boundary') || line.includes('isCompactSummary');
    const hasUsage = line.includes('"usage"');
    if (!isUser && !isMerge && !maybeCompact && !hasUsage) continue;
    let e; try { e = JSON.parse(line); } catch (err) { continue; }
    // 要約の境目・要約文: 本文に「compact_boundary」と書いてあるだけの行(道具の結果・会話の文)は、外側の印を見るので当たらない
    if (e && ((e.type === 'system' && e.subtype === 'compact_boundary') || e.isCompactSummary === true)) {
      if (e.type === 'system') compacts++;
      prompts = 0; merges = 0; tokens = 0; prevTokens = 0;
      continue;
    }
    const c = e && e.message && e.message.content;
    if (e.type === 'user' && !e.isMeta && !e.isSidechain) {
      const isPrompt = typeof c === 'string' || (Array.isArray(c) && c.some(b => b && b.type === 'text') && !c.some(b => b && b.type === 'tool_result'));
      if (isPrompt) { prompts++; prevTokens = tokens; }
    } else if (e.type === 'assistant') {
      if (Array.isArray(c)) for (const b of c) if (b && b.type === 'tool_use' && /merge_pull_request$/.test(String(b.name || ''))) merges++;
      const u = e.message && e.message.usage;
      if (u && !e.isSidechain) {
        const t = (Number(u.input_tokens) || 0) + (Number(u.cache_read_input_tokens) || 0) + (Number(u.cache_creation_input_tokens) || 0);
        if (t > 0) tokens = t;
      }
    }
  }
  return { prompts, merges, compacts, tokens, prevTokens };
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
    // 窓口: 「替える」は出さない。トークン数が目安(routing.json「窓口の要約のトークン」)を超えたら、要約してよいかを社長に選択式で聞く
    //   (2026-11-12 社長「トークン数で管理するんじゃないの？」→ 50万で聞く・そのあとは5万ごと)。目安の節目をまたいだ1回だけ出す
    const first = Number(limit['窓口の要約のトークン']) || 500000;
    const step = Number(limit['窓口の要約のくり返しトークン']) || 50000;
    const band = (t) => (t >= first ? Math.floor((t - first) / step) + 1 : 0);
    const t = Number(n.tokens) || 0;
    if (!band(t) || band(t) <= band(Number(n.prevTokens) || 0)) return '';
    return `${todoNote()}【窓口・会話が長くなってきた】この会話の文脈は 約${Math.round(t / 10000)}万トークン(目安 ${Math.round(first / 10000)}万)。窓口は会話を替えない。いまの仕事の区切りで、AskUserQuestion で「この会話を要約(/compact)してよいか」を社長に選んでもらう(許可されたら、残すもの・捨てるものを入れた /compact の1行をコピーできる形で出す)。文末で頼まない・「替える」を勧めない。いっぱいになったら自動の要約(${Number(limit['窓口の自動の要約']) || 700000})が走る。`;
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

// 社長の頼みで完了でない物の数(追跡表)。要約で小さな頼みが落ちないように、窓口の「長くなってきた」の知らせの頭に付ける
//   (2026-11-14 社長「お願いしたのに漏れてるの多い」)
function todoNote() {
  try { const t = require('../team/requests').summary(); return t ? `【${t}。要約の前に node tools/ctx.js todo で確かめ、/compact の「残すもの」に「追跡表を見る」と入れる】\n` : ''; } catch (e) { return ''; }
}

// 窓口の自動の要約の設定を見張る(2026-11-12・決めごとの錠)。台帳 2026-11-11「窓口の autoCompactWindow は 700000」は
// 窓口の端末のユーザー設定(~/.claude/settings.json)にあり、リポジトリの検査から見えない。入れ物が作り直されると設定が消えても
// だれも気づかないので、窓口の会話でだけ、値が決めごとと違えば知らせる(最初の頼みと、そのあと「くり返し」回ごと)。
//   value … いまの設定の値(無ければ undefined)
function autoCompactNotice(value, n, limit, opts) {
  if (!(opts && opts.hq)) return '';
  const want = Number(limit['窓口の自動の要約']) || 700000;
  if (Number(value) === want) return '';
  const k = Number(n.prompts) || 0;
  if (k !== 1 && k % limit['くり返し'] !== 0) return '';
  return `【窓口・自動の要約の設定が決めごとと違う】ユーザー設定(~/.claude/settings.json)の autoCompactWindow は ${value === undefined ? '未設定' : value}。台帳の決めごとは ${want}(文脈がそこまでたまったら自動で要約)。設定を ${want} に直す(直せないときは、社長に選択式で知らせる)。`;
}
function readAutoCompact(home) {
  try { return JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8')).autoCompactWindow; } catch (e) { return undefined; }
}

function main() {
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch (e) { return; }
  let data; try { data = JSON.parse(input); } catch (e) { return; }
  const p = data && data.transcript_path;
  if (!p || !fs.existsSync(p)) return;
  const limit = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'team', 'routing.json'), 'utf8'))['区切り'];
  const routing = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'team', 'routing.json'), 'utf8'));
  const n = count(p);
  const opts = { hq: isHq(routing['窓口の会話'], process.env) };
  const msg = [message(n, limit, opts), autoCompactNotice(readAutoCompact(require('os').homedir()), n, limit, opts)].filter(Boolean).join('\n');
  if (msg) process.stdout.write(msg + '\n');
}

if (require.main === module) { try { main(); } catch (e) { /* 知らせるだけの道具。失敗しても止めない */ } process.exit(0); }
module.exports = { count, message, isHq, autoCompactNotice, readAutoCompact, todoNote };
