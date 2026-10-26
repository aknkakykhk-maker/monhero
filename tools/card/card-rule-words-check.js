// MFバトルカード: ヘルプ・ルールの画面の言葉が、新しく決まったルールと食い違っていないかを見張る(2026-10-27 フキダシくん)。
// ルールの計算(82)だけ直して、プレイヤーが読む文(ヘルプ・ルールの画面・練習試合の台詞・カードの補足)が古いまま残るのを防ぐ。
//
//   node tools/card/card-rule-words-check.js
//
// 見ているもの(ルールが main に入ったものから足す。控え: docs/progress/card-fukidashi-backlog.md)
//   ① 混血のメイン・サブ(台帳 2026-10-27・#3865): 攻撃・特殊=メイン、防御・回避=サブだけ。サブ「？？？」の子は純血扱い
//      ヘルプ・ルールの画面に「サブの種族の技も使える」(メインの防御・回避も使えるように読める)が残っていない
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
let fails = 0;
const ok = (c, msg) => { if (!c) { fails += 1; console.log(`NG: ${msg}`); } };

const help = fs.readFileSync(path.join(GAME, 'data', 'help.js'), 'utf8');
const rules = fs.readFileSync(path.join(GAME, 'src', 'parts', '88-card-rules.jsx'), 'utf8');
const tutorial = fs.readFileSync(path.join(GAME, 'src', 'parts', '86-card-tutorial.jsx'), 'utf8');
const places = [['ヘルプ', help], ['ルールの画面', rules], ['練習試合の台詞', tutorial]];

// ① 混血のメイン・サブ
for (const [name, src] of places) {
  ok(!/サブの種族の技も使/.test(src), `${name}に「サブの種族の技も使える」が残っている(メインの防御・回避も使えるように読める。混血の防御・回避はサブだけ)`);
}
for (const [name, src] of [['ヘルプ', help], ['ルールの画面', rules]]) {
  ok(/防御・回避はサブの種族の技を使|回避・防御はサブの種族の技を使/.test(src), `${name}に「防御・回避はサブの種族の技を使う」が無い`);
  ok(/メインの種族の(防御・回避|回避・防御)は使え(ない|ません)/.test(src), `${name}に「メインの種族の防御・回避は使えない」が無い`);
  ok(/サブが「？？？」/.test(src), `${name}に、サブが「？？？」の混血は純血扱い(防御・回避もメインの種族)の説明が無い`);
}

if (fails) { console.log(`\n${fails} 件 NG`); process.exit(1); }
console.log('OK: MFバトルカードのヘルプ・ルールの画面の言葉が、新しいルール(混血のメイン・サブ)とそろっている');
