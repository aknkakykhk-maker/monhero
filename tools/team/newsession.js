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

const HQ = 'session_0113GBaCCe57vnmvsZ6f3TFr';

// 会話の題(Claude アプリの一覧に出る)。2026-11-20 社長「API はセッション名わかりやすくして」:
//   台帳の番号(r1119-024②)や丸数字が題を埋め、API を使う会話かどうかが28字で切れて見えなかった。
//   API を使う仕事は頭に [API] を付け、番号と丸数字と中身のない括弧は題から外す(依頼文には残る)
const sessionTitle = (dept, who, job) => {
  const raw = String(job || '').replace(/\s+/g, ' ');
  const api = /API|Claude API|分析の入り口/i.test(raw);
  const clean = raw
    .replace(/r\d{4}-\d{3}[①-⑳]?/g, '')                 // 台帳の番号
    .replace(/^[①-⑳]/, '').replace(/[(（][^)）]*[)）]/g, (g) => g.replace(/[①-⑳]/g, '')) // 頭と括弧の中の丸数字
    .replace(/(?<=[(（・、,\s])\d{3}(?=[・、,)）\s]|$)/g, '')  // 番号の続き(「・018・030」)
    .replace(/[(（][^)）]*[)）]/g, (g) => g.replace(/(?:Claude\s*)?API(?:\s*分析|\s*点検)?\s*[・、+]?/gi, '')) // 括弧の中の API の語(頭の [API] と重なる)
    .replace(/[(（]\s*[・、,+\s]*[)）]/g, '')               // 中身のない括弧
    .replace(/[(（]\s*[・、,+\s]+/g, (m) => m[0]).replace(/[・、,+\s]+([)）])/g, '$1')
    .replace(/[・、,+]{2,}/g, '・')
    .replace(/[(（]\s*[)）]/g, '')
    .replace(/\s{2,}/g, ' ').trim();
  return `${api ? '[API] ' : ''}${dept} ${who}: ${cut(clean, 36)}`;
};

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
  P.push('・できた物から1つずつ PR にし、溜めてから出さない。ミハリの OK が届いたら窓口を待たずにマージする');
  P.push('・止め絵は枝の docs/progress/ にコミットし、関係する決めごと(台帳の行・参考の絵)ごとに止め絵のどこで満たすかを書いた突き合わせ表を一緒に送る。満たさない行は直してから');
  P.push('・作業はリポジトリの中だけでする(r1119-065)。一時置き場などリポジトリの外に作業用のコピー(git worktree・複製)を作らない。枝の切り替えはリポジトリの中で git checkout / git stash を使う。リポジトリの外へ cd しない(外へ移ってコマンドをつなげると、設定より優先される安全の決まりで毎回社長に許可の確認が出る)');
  P.push('・点検系は分析の API(tools/analysis/gateway-client.js)で回してよい(r1126-081)。作る作業には使わない。使った額は報告に');
  P.push('・見た目・文言だけの直しは、ミハリを待たずに公開してよい: gate が「要らない」なら、撮影と測る検査(success-shoot など)を通し、止め絵を自分の目で見て確かめてからマージ。「要る」(新機能・保存データ・ランキング)だけミハリへ');
  P.push('・判断や設計が要る・結果がおかしい・2回やって駄目 → 自分で続けず窓口へ');
  P.push(`・「会話が長くなった」という知らせが出たら、区切りで node tools/ctx.js handoff ${d.id} --write → 窓口へ`);
  P.push(`・社長の頼みは完了まで追う: node tools/ctx.js todo ${d.id}`);
  if (r.kind.id === 'run') P.push('・道具の出力は全部読まない(問題の大きい順の上位・件数だけ。2>&1 | tail)。道具が足りない・直したいときは自分で作り込まず窓口へ(道具づくりは別の会話)');
  if (r.kind.id === 'tool') P.push('・道具の出力は小さく作る(既定は要約・件数・問題の大きい順の上位だけ。全部は --all や --json で)。回す側は安いモデルなので、読む量がそのまま費用になる。作り終えたら回し方を1行で報告する');
  P.push('');
  P.push(`■報告: send_message は使わない(社長に毎回許可の確認が出る・r1119-015)。会話の最後の発言に書いて止まる(窓口が見回って読む・宛先 ${to || HQ})。短く「何を直したか・PR番号・済ませた頼みの id(追跡表)・更新履歴の要否(要るなら文案)・本番で見る所」`);
  return {
    title: sessionTitle(d['部'].replace(/\(.*$/, ''), who, job),
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
  console.log('permission_mode: auto    ← 必ず付ける(r1119-086・部の会話も自動で作り、社長に許可の画面を出さない)');
  // 2026-11-24 社長「Fable は俺の許可なしでは絶対に使わないで」(r1119-163)。表は Fable を出さない
  console.log('★ claude-fable-5-2 は社長の許可なしでは絶対に使わない。要ると思ったら、作る前に社長へ選択式(AskUserQuestion)で聞く。聞かずに使わない');
  console.log('prompt: ↓ここから下をそのまま');
  console.log(s.prompt);
}

if (require.main === module) main();
module.exports = { sessionTitle, build };
