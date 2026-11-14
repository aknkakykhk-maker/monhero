#!/usr/bin/env node
// 窓口が新しい会話を作るときの、モデルと依頼文(create_session に渡すもの)を作る。
//
//   node tools/ctx.js newsession <部> "<仕事の文>"            … title / model / prompt を出す
//   node tools/ctx.js newsession <部> "<仕事>" --name ナカヨシ10 … 会話の名前(担当の名前)
//   node tools/ctx.js newsession <部> "<仕事>" --kind design   … 種類を自分で決める(watch / small / run / build / design / final / tool)
//   node tools/ctx.js newsession <部> "<仕事>" --failed 2      … 同じ不具合を直した回数
//   node tools/ctx.js newsession <部> "<仕事>" --to <session>  … 報告先(既定は窓口。社員なら部長の会話)
//
// 【なぜあるか】
// 依頼文を毎回手で書くと、長くなり(共通の決まりを貼り直す)、モデルも毎回同じ高いものになっていた。
// モデルは表(routing.json)から、読むものは「CLAUDE.md・部の手引き1枚・決めごとの絞り込み・引き継ぎメモ」だけに
// 機械でそろえる(2026-11-11 社長「トークンを無駄に使わない仕組み」案A・B・F)。
'use strict';
const { findDept, cut, deptList } = require('./lib');
const { pick } = require('./model-pick');
const { latest } = require('./handoff');
const { linesFor } = require('./requests');

const HQ = 'session_014GTmSNS2ae9tRr57k3zFjC';

function build(d, job, { name, kind, failed, to } = {}) {
  const r = pick(job, { kind, failed });
  const memo = latest(d);
  const who = name || d['部長'];
  const P = [];
  P.push(`あなたは「${who}」。モンヒロ社(ゲーム「モンスターヒーロー」の開発)の${d['部']}の担当です。窓口(統括部長モンヒロくん ${HQ})からの依頼です。会話・報告・コミットはすべて日本語。`);
  P.push('');
  P.push('■最初に読むもの(これだけ。ほかは要るときに要る節だけ)');
  P.push('1. CLAUDE.md(自動で読まれる)');
  P.push(`2. docs/depts/${d.id}.md(受け持つファイル・入口の関数・回す検査・関係する決まり)`);
  P.push(`3. node tools/ctx.js decisions ${d.id}(社長の決めごと。台帳の全文は開かない)`);
  if (memo) P.push(`4. ${memo}(前の会話の引き継ぎメモ。前の会話そのものは読みに行かない)`);
  P.push('');
  P.push('■仕事');
  P.push(job);
  P.push('');
  // この部の完了でない頼み(追跡表)。会話が替わっても頼みが消えないように、依頼文に毎回入れる(2026-11-14 社長「お願いしたのに漏れてるの多い」)
  const todo = linesFor(d.id, 6, 60);
  if (todo.total && d.id !== 'hq') {
    P.push(`■この部の完了でない頼み(追跡表・${todo.total} 件。今回の仕事に入る物は一緒に済ませ、入らない物は報告に「残り」と書く)`);
    for (const l of todo.lines) P.push(l);
    P.push('');
  }
  P.push('■守ること');
  P.push('・サブエージェントは使わない。Supabase には触れない(SQL の本文・配り直しの頼みは窓口へ)');
  P.push('・デバッグの合言葉・社長個人の情報・API キーを、コード・コミット・PR・資料・報告のどこにも書かない');
  P.push('・マージするのは、自分が作った PR の作成の結果に出た番号だけ');
  P.push('・公開の前に node tools/ctx.js gate。「要る」と出たら、マージの前に窓口へ知らせる(ミハリが確認する)。「要らない」なら検査が通りしだい公開');
  P.push('・画面の文(ボタン・見出し・説明など)は、漢字で書ける所は漢字にする(戻る・閉じる・次へ・選ぶ)。台詞だけは個性で変えてよい');
  P.push('・見た目の止め絵を窓口へ送るときは、関係する決めごと(台帳の行と参考の絵)を1行ずつ並べ、止め絵のどこで満たしているかを書いた突き合わせ表を一緒に送る。満たしていない行は直してから送る');
  P.push('・判断や設計が要ると分かった・結果がおかしい・2回やってうまくいかない → 自分で続けず窓口へ知らせる(上のモデルの会話に替える)');
  P.push(`・「会話が長くなった」という知らせが出たら、区切りで node tools/ctx.js handoff ${d.id} --write → 窓口へ`);
  P.push(`・社長の頼みは追跡表で完了まで追う: node tools/ctx.js todo ${d.id} で自分の部の完了でない頼みを見る`);
  if (r.kind.id === 'run') P.push('・道具の出力は全部読まない(問題の大きい順の上位・件数だけ。2>&1 | tail)。道具が足りない・直したいときは自分で作り込まず窓口へ(道具づくりは別の会話)');
  if (r.kind.id === 'tool') P.push('・道具の出力は小さく作る(既定は要約・件数・問題の大きい順の上位だけ。全部は --all や --json で)。回す側は安いモデルなので、読む量がそのまま費用になる。作り終えたら回し方を1行で報告する');
  P.push('');
  P.push(`■報告: send_message で ${to || HQ} へ。短く「何を直したか・PR番号・済ませた頼みの id(追跡表)・更新履歴の要否(要るなら文案)・本番で見る所」`);
  return {
    title: `${d['部'].replace(/\(.*$/, '')} ${who}: ${cut(job.replace(/\s+/g, ' '), 28)}`,
    model: r.kind.model,
    kind: r.kind,
    why: r.why,
    prompt: P.join('\n'),
  };
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const VAL = ['--name', '--kind', '--failed', '--to'];
  const pos = argv.filter((a, i) => !a.startsWith('--') && !VAL.includes(argv[i - 1]));
  const d = findDept(pos[0]);
  const job = pos.slice(1).join(' ');
  if (!d || !job) { console.error(`NG: node tools/ctx.js newsession <部> "<仕事の文>"\n${deptList()}`); process.exit(1); }
  let s;
  try { s = build(d, job, { name: opt('--name'), kind: opt('--kind'), failed: Number(opt('--failed')) || 0, to: opt('--to') }); } catch (e) { console.error('NG: ' + e.message); process.exit(1); }
  console.log('# create_session に渡すもの');
  console.log(`title: ${s.title}`);
  console.log(`model: ${s.model}    ← ${s.kind['名前']}(${s.why})`);
  if (s.model === 'claude-fable-5-2') {
    // 2026-11-11 社長「Fable を使うときは、決まりから外れている場合は俺に聞いてね」
    console.log('★ claude-fable-5-2 を使ってよいのは次の3つだけ。どれに当たるかを確かめてから作る:');
    console.log('   ①何度も回す点検・見張りの道具/仕組みを作る・強化する1回 ②新機能の公開前の最終確認(1回) ③同じ不具合を2回直しても直らない');
    console.log('   どれにも当たらないなら、窓口が社長に選択式(AskUserQuestion)で聞いてから。聞かずに使わない(docs/rules/MODEL_ROUTING.md)');
  }
  console.log('prompt: ↓ここから下をそのまま');
  console.log(s.prompt);
}

if (require.main === module) main();
module.exports = { build };
