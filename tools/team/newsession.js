#!/usr/bin/env node
// 窓口が新しい会話を作るときの、モデルと依頼文(create_session に渡すもの)を作る。
//
//   node tools/ctx.js newsession <部> "<仕事の文>"            … title / model / prompt を出す
//   node tools/ctx.js newsession <部> "<仕事>" --name ナカヨシ10 … 会話の名前(担当の名前)
//   node tools/ctx.js newsession <部> "<仕事>" --kind design   … 種類を自分で決める(watch / small / build / design / final)
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
  P.push('■守ること');
  P.push('・サブエージェントは使わない。Supabase には触れない(SQL の本文・配り直しの頼みは窓口へ)');
  P.push('・デバッグの合言葉・社長個人の情報・API キーを、コード・コミット・PR・資料・報告のどこにも書かない');
  P.push('・マージするのは、自分が作った PR の作成の結果に出た番号だけ');
  P.push('・公開の前に node tools/ctx.js gate。「要る」と出たら、マージの前に窓口へ知らせる(ミハリが確認する)。「要らない」なら検査が通りしだい公開');
  P.push(`・同じ不具合を2回直して直らなかったら、3回目を自分でやらず窓口へ知らせる(要所のモデルの会話に替える)`);
  P.push(`・「会話が長くなった」という知らせが出たら、区切りで node tools/ctx.js handoff ${d.id} --write → 窓口へ`);
  P.push('');
  P.push(`■報告: send_message で ${to || HQ} へ。短く「何を直したか・PR番号・更新履歴の要否(要るなら文案)・本番で見る所」`);
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
  console.log('prompt: ↓ここから下をそのまま');
  console.log(s.prompt);
}

if (require.main === module) main();
module.exports = { build };
