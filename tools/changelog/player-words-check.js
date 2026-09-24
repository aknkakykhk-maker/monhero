// 更新履歴の文面が「作業報告」になっていないか(プレイヤーの言葉で書けているか)を見る。
//
//   node tools/changelog/player-words-check.js
//
// 2026-09-18・ユーザー指摘「更新情報はよくあーいう形になってるから、今後はプレイヤー向けに
// 出すようにして」。そのとき出してしまった実物がこれ。
//
//   「助手のセリフを400本以上追加しました」
//     ・全部で1,691本から2,095本になります。
//     ・全60場面へ3本ずつ足しています。
//     ・ドラのセリフは今回そのままです。      ← 31分後に嘘になった
//
// プレイヤーは「場面」も「本数」も知らないし、作り手の作業量は伝えるものではない。
// 書き忘れと違って**画面はふつうに動いてしまう**ので、気づけるのはここだけ。
// 決めごとは docs/rules/CHANGELOG_HELP.md「更新履歴はプレイヤーの言葉で書く」。
//
// ★誤検出を出さないことを最優先にしている。数字そのものは禁止していない
//   (報酬の個数・必要ポイント・難易度の倍率・曲のレベルとノーツ数などは、
//    プレイヤーが判断に使う数字なので当然書いてよい)。
//   見るのは「ゲームの外の数え方」と「開発工程の語」と「作業の都合」の3つだけ。
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${src}\nglobalThis.__c = CHANGELOG;`, ctx);
const entries = Array.isArray(ctx.__c) ? ctx.__c : [];

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ゲームの外の数え方。場面数・セリフの本数・ファイル数は、遊ぶ人には意味がない
const INTERNAL_COUNT = /全\d+場面|\d+場面へ|\d+場面ぶん|\d+場面それぞれ|セリフを\d+本|セリフが\d+本|\d+本のセリフ|\d+ファイル|スクリプト\d+本/;
// 開発工程の語。コードの中身と、作る側の道具の話
const DEV_WORDS = /addAssistantLinePack|ASSISTANT_SCENES|RELEASE_FLAGS|localStorage|gameState|pointerEvents|useEffect|リポジトリ|コミット|プルリクエスト|リファクタ|キャッシュキー|ソースコード|内部的に|検査を足|検査を追加|テストを足|テストを追加/;
// 作業の都合。読む側には関係がなく、あとから嘘になる
const WORK_EXCUSE = /さきほど|先ほど|今回は見送|今回はそのまま|次回に回|作業の都合|開発の都合/;

const RULES = [
  ['ゲームの外の数え方', INTERNAL_COUNT],
  ['開発の言葉', DEV_WORDS],
  ['作業の都合', WORK_EXCUSE],
];

// dev:true は「プレイヤーがまだ触っていない機能の作業メモ」で、どちらのタブにも出ない。
// そこは作り手向けの記録なので対象外
const shown = entries.filter(e => e && !e.dev);
check('更新履歴を読み込めた', shown.length > 0, `${shown.length}件`);

for (const [label, re] of RULES) {
  const hits = [];
  for (const e of shown) {
    for (const text of [e.title || '', ...(e.items || [])]) {
      const m = String(text).match(re);
      if (m) hits.push(`${e.date} 「${String(e.title || '').slice(0, 24)}」 → ${m[0]}`);
    }
  }
  check(`${label}が本文に出ていない`, hits.length === 0, hits.slice(0, 6).join(' / '));
}

// ★「同じ日の同じ話が2件へ割れていないか」は、ここでは見ない。
//   一度つくってみたが、別々のもの(「新アシストカード「メロソ」を追加」と
//   「新アシストカード「きき」を追加」)まで同じ話と判断してしまった。
//   1つの出来事かどうかは中身を読まないと分からず、機械には向かない。
//   誤検出する検査は結局ゆるめられて意味を失うので、ここは決めごと
//   (docs/rules/CHANGELOG_HELP.md)に任せて、確実に言えることだけを見る。

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
