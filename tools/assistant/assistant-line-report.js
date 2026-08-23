#!/usr/bin/env node
// 助手のセリフが、どの場面に何本あるかを一覧にする。
//
//   node tools/assistant/assistant-line-report.js            少ない順に全場面
//   node tools/assistant/assistant-line-report.js --scene home   その場面の中身を全部出す
//   node tools/assistant/assistant-line-report.js --min 8        8本未満の場面だけ
//
// セリフは「多いほど遊んでいて飽きない」ので、増やすときは本数の少ない場面から
// 手を付けたい。ところが本文は ASSISTANT_SCENES の定義と、あとから合流する
// addAssistantLinePack の束に分かれているため、ファイルを読んでも実際の本数が分からない。
// ここでは本体と同じ assistantSceneLines() を通して、合流後の本数を数える。
//
// 足すときは data/assistants.js の `linesExtra` の束へ書く(場面の定義は触らなくてよい)。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${fs.readFileSync(path.join(ROOT, 'monster-hero/data/assistants.js'), 'utf8')}
globalThis.__a = { ASSISTANT_SCENES, ASSISTANT_LINE_PACKS, ASSISTANTS, assistantSceneLines, assistantLineMatchesBond };`, ctx);
const A = ctx.__a;

const args = process.argv.slice(2);
const argOf = (name) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : null; };
const onlyScene = argOf('--scene');
const min = Number(argOf('--min')) || 0;

const scenes = Object.keys(A.ASSISTANT_SCENES);
const linesOf = (scene) => A.assistantSceneLines(scene) || [];
const whoOf = (line) => line && line.who ? line.who : 'mua';

if (onlyScene) {
  if (!A.ASSISTANT_SCENES[onlyScene]) {
    console.log(`そんな場面は無い: ${onlyScene}`);
    console.log(`ある場面: ${scenes.join(', ')}`);
    process.exit(1);
  }
  const lines = linesOf(onlyScene);
  console.log(`■ ${onlyScene} … ${lines.length}本`);
  lines.forEach((line, i) => {
    const marks = [whoOf(line), line.e || 'normal'];
    if (line.bond) marks.push(`Lv${line.bond}以上`);
    if (line.w && line.w !== 1) marks.push(`出やすさ${line.w}`);
    console.log(`  ${String(i + 1).padStart(2)} [${marks.join(' / ')}] ${String(line.t || '').replace(/\n/g, ' / ')}`);
  });
  process.exit(0);
}

const rows = scenes.map((scene) => {
  const lines = linesOf(scene);
  const byWho = {};
  lines.forEach((line) => { const w = whoOf(line); byWho[w] = (byWho[w] || 0) + 1; });
  const bond = lines.filter((line) => Number(line.bond) > 0).length;
  return { scene, total: lines.length, byWho, bond };
}).sort((a, b) => a.total - b.total || a.scene.localeCompare(b.scene));

const shown = rows.filter((row) => row.total < (min || Infinity));
const list = min ? shown : rows;
const total = rows.reduce((n, row) => n + row.total, 0);

console.log(`場面 ${rows.length} / セリフ 合計 ${total}本 / 1場面あたり平均 ${(total / rows.length).toFixed(1)}本`);
console.log(`セリフ束: ${A.ASSISTANT_LINE_PACKS.map((p) => p.id).join(', ')}`);
console.log(min ? `\n■ ${min}本未満の場面（${shown.length}件）` : '\n■ 本数の少ない順');
console.log('  本数  仲良し度つき  場面');
list.forEach((row) => {
  const who = Object.entries(row.byWho).map(([w, n]) => `${w}:${n}`).join(' ');
  console.log(`  ${String(row.total).padStart(4)}  ${String(row.bond).padStart(10)}  ${row.scene}  (${who})`);
});
if (!min) {
  const few = rows.filter((row) => row.total <= 5);
  console.log(`\n5本以下の場面は ${few.length}件: ${few.map((row) => row.scene).join(', ') || 'なし'}`);
  console.log('足すときは data/assistants.js の linesExtra の束へ書く。1場面の中身は --scene <場面キー> で全部見られる。');
}
