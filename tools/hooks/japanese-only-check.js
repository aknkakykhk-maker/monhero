#!/usr/bin/env node
// 返答を終える直前(Claude Code の Stop フック)に、今回の返答に英語の文が混ざっていないかを見る。
//
// 【なぜあるか】
// CLAUDE.md「会話言語」でチャットは日本語に固定しているのに、作業の合間の一言や最後の報告が
// 英語になることが何度も起きた(2026-09-24 ユーザー指摘「二度と日本語以外使わないようにしろ」)。
// 気をつけるだけでは防げなかったので、機械で止める。
//
// 【見るもの】
// 最後にユーザーが書いたメッセージより後の、アシスタントの文章(text ブロック)すべて。
// 作業の途中の一言も含む。コードブロック・`インラインコード`・URL・ファイルのパスは除く。
// 残った文に「英単語が4語以上つづく所」があれば英語の文とみなし、停止を止めて書き直させる。
//
// 【止め方】
// 標準出力へ {"decision":"block","reason":...} を出すと、Claude は終われずに続きを書く。
// 書き直しでもまだ英語が残るとき(stop_hook_active が true)は、無限に止め続けないよう
// 止めずに警告だけ出す。
//
//   echo '{"transcript_path":"<jsonl>"}' | node tools/hooks/japanese-only-check.js
'use strict';
const fs = require('fs');

// 日本語の文の中に出てきてよい英語の固有名・ボタン名(4語以上つづくもの)。増やすときはここへ
const ALLOWED_PHRASES = [
  /Monster Hero -Another-/gi,
  /Build and deploy Pages/gi,
  /Generated with Claude Code/gi,
  /Co-Authored-By:[^\n]*/gi,
];

const stripCode = (text) => String(text || '')
  .replace(/```[\s\S]*?```/g, ' ')          // コードブロック
  .replace(/`[^`\n]*`/g, ' ')               // インラインコード
  .replace(/https?:\/\/\S+/g, ' ')          // URL
  .replace(/(?:^|\s)[\w.~-]*\/[\w./~-]+/g, ' ') // パス
  .replace(/\[[^\]]*\]\([^)]*\)/g, ' ');    // マークダウンのリンク

const englishRuns = (text) => {
  let t = stripCode(text);
  for (const re of ALLOWED_PHRASES) t = t.replace(re, ' ');
  // 英単語(2文字以上を含む)が空白・カンマ・ピリオドでつながって4語以上
  const re = /[A-Za-z][A-Za-z'’-]*(?:[ ,.:;!?()]+[A-Za-z][A-Za-z'’-]*){3,}/g;
  return (t.match(re) || []).filter(run => run.split(/[^A-Za-z'’-]+/).filter(w => w.length >= 2).length >= 4);
};

const readStdin = () => { try { return fs.readFileSync(0, 'utf8'); } catch { return ''; } };

const main = () => {
  let input = {};
  try { input = JSON.parse(readStdin() || '{}'); } catch { input = {}; }
  const path = input.transcript_path;
  if (!path || !fs.existsSync(path)) return;
  const lines = fs.readFileSync(path, 'utf8').split('\n').filter(Boolean);
  const entries = [];
  for (const line of lines) { try { entries.push(JSON.parse(line)); } catch { /* 壊れた行は読み飛ばす */ } }
  // 最後の「ユーザーが書いた」メッセージ(ツールの結果ではないもの)の位置
  const isUserText = (e) => e.type === 'user' && e.message && (
    typeof e.message.content === 'string'
    || (Array.isArray(e.message.content) && e.message.content.some(c => c && c.type === 'text')));
  let start = 0;
  for (let i = entries.length - 1; i >= 0; i--) { if (isUserText(entries[i]) && !entries[i].isMeta) { start = i + 1; break; } }
  const texts = [];
  for (const e of entries.slice(start)) {
    if (e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
    for (const c of e.message.content) if (c && c.type === 'text' && c.text) texts.push(c.text);
  }
  const found = texts.flatMap(englishRuns);
  if (found.length === 0) return;
  const sample = found.slice(0, 3).map(s => `「${s.slice(0, 60)}」`).join(' ');
  if (input.stop_hook_active) {
    process.stdout.write(JSON.stringify({ systemMessage: `日本語チェック: まだ英語の文が残っています ${sample}` }));
    return;
  }
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `CLAUDE.md「会話言語」違反: 今回の返答に英語の文が混ざっています ${sample}。`
      + 'ユーザーへの説明・報告・作業中の一言はすべて日本語で書くこと。英語で書いた部分の内容を、日本語で書き直して伝え直してください。'
      + '(コード・パス・URL・識別子の引用は `` で囲めば対象外)',
  }));
};

main();
