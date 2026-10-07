// 絆Lv・総合力ランキングで、同じ人の同じモンスターが1体だけ並ぶかを見る(2026-10-07)。
// ユーザー報告「ききがランキングにいっぱいいる」→ 指示「1人同モンスター1体。モッチー、ミタラシは並ぶけど
// モッチー、モッチーとはならない」。並べ替え済みの一覧から、人(ブリーダーID)×モンスターごとに先頭の1体だけ残す。
//   node tools/ranking/bond-ranking-one-per-monster-check.js
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..', '..');
const supa = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/26-supabase.jsx'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
const a = supa.indexOf('const pickTopPerBreederMonster');
assert(a >= 0, 'pickTopPerBreederMonster が 26-supabase.jsx に無い');
const b = supa.indexOf('\n};', a) + 3;
const ctx = {
  // 人の見分けは本体と同じ考え: IDがあればID、無ければ名前(ここではIDだけを素直に返す)
  breederIdBridgeFrom: () => new Map(),
  resolveBreederIdFor: (e) => e.breederId || null,
};
vm.createContext(ctx);
vm.runInContext(`${supa.slice(a, b)}\n;globalThis.pick = pickTopPerBreederMonster;`, ctx);

const rows = [
  { userName: 'きき', breederId: 'k1', monsterId: 'Suezo', bondLevel: 500 },
  { userName: 'みゅあ', breederId: 'm1', monsterId: 'Suezo', bondLevel: 400 },
  { userName: 'きき', breederId: 'k1', monsterId: 'Mitarashi', bondLevel: 300 },
  { userName: 'きき', breederId: 'k1', monsterId: 'Mocchi', bondLevel: 200 },
  { userName: 'みゅあ', breederId: 'm1', monsterId: 'Suezo', bondLevel: 9 },
  { userName: 'きき', breederId: 'k1', monsterId: 'Suezo', bondLevel: 1 },
  { userName: 'きき', breederId: 'k1', monsterId: 'Suezo', bondLevel: 1 },
  { userName: 'きき', breederId: 'k2', monsterId: 'Suezo', bondLevel: 1 },   // 同じ名前でも別のID=別の人
  { userName: 'むかし', monsterId: 'Golem', bondLevel: 5 },                   // IDの無い古い行は名前で見分ける
  { userName: 'むかし', monsterId: 'Golem', bondLevel: 3 },
];
const before = JSON.stringify(rows);
const out = ctx.pick(rows);
const sig = [...out].map((e) => `${e.userName}/${e.breederId || '-'}/${e.monsterId}/${e.bondLevel}`);
assert.deepStrictEqual(sig, [
  'きき/k1/Suezo/500', 'みゅあ/m1/Suezo/400', 'きき/k1/Mitarashi/300', 'きき/k1/Mocchi/200',
  'きき/k2/Suezo/1', 'むかし/-/Golem/5',
], `並びが違う: ${sig.join(' , ')}`);
assert.strictEqual(JSON.stringify(rows), before, '受け取った一覧を書き換えている');
assert.strictEqual(ctx.pick(null).length, 0);
assert.strictEqual(ctx.pick([null, undefined]).length, 0);
console.log('  OK  同じ人の同じモンスターは先頭の1体だけ(スエゾーが4体→1体)');
console.log('  OK  違うモンスター(モッチー・ミタラシ)は同じ人でもそれぞれ残る');
console.log('  OK  同じ名前でもIDが違えば別の人 / IDの無い古い行は名前で見分ける');

// 画面は絆Lvも総合力もこれを通してから種族で絞る(総合力は総合力で並べたあとに通す)
assert(/pickTopPerBreederMonster\(bondRankingAll\)/.test(app), '絆Lvの一覧が pickTopPerBreederMonster を通っていない');
assert(/pickTopPerBreederMonster\(collectPowerRankingEntries\(bondRankingAll\)\)/.test(app), '総合力の一覧が並べ替えのあとに pickTopPerBreederMonster を通っていない');
assert(/bondRankingShown\.filter\(x => bondEntryLineageId\(x\) === bondRankMonFilter\)/.test(app), '種族タブが1体にまとめる前の一覧を絞っている');
console.log('  OK  絆Lv・総合力の画面がどちらもこれを通している');
console.log('OK: 絆Lv・総合力ランキングは1人1モンスター1体');
