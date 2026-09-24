#!/usr/bin/env node
// 新しい味方モンスターの数値を決めるとき、既存20種のどのあたりに来るかを見るための表。
//
//   node tools/monster/monster-stats-table.js
//   node tools/monster/monster-stats-table.js --hp 300 --guts 180 --atk 175 --def 60 --name 仮の子
//       … 仮の値を差し込んで、合計の順位と各項目の位置を出す
//   node tools/monster/monster-stats-table.js --like Mia
//       … 指定した子に近い3種だけを並べる
//
// 【なぜ要るか】(2026-09-24 ユーザー指示「こっちで設定するものは比較対象を出してもらうと分かりやすい」)
// 能力値・特性・固有技はユーザーが決めるものだが(.claude/skills/monster-add/SKILL.md §0)、
// 「ライフ300」とだけ言われても、それが既存の中で高いのか低いのかは誰も覚えていない。
// 決めてもらう前に、この表を出して「どの帯に来るか」を数字で見せる。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA = path.join(ROOT, 'monster-hero', 'data');

const loadMonsters = () => {
  const box = {};
  vm.createContext(box);
  for (const f of ['images/images-ally.js', 'ally-monsters.js', 'lineages.js']) {
    vm.runInContext(fs.readFileSync(path.join(DATA, f), 'utf8'), box);
  }
  vm.runInContext('globalThis.__m=ALL_PLAYER_MONSTERS;globalThis.__l=MONSTER_LINEAGE_MAP;', box);
  return { monsters: box.__m, lineages: box.__l };
};

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : null; };
const num = (name) => { const v = opt(name); return v === null ? null : Number(v); };

const { monsters, lineages } = loadMonsters();
const pad = (v, n) => String(v).padStart(n);
// 全角の名前は2文字ぶんの幅で数える(ターミナルで列がそろうように)
const padName = (s, width) => {
  let w = 0;
  for (const ch of s) w += /[\x00-\x7F]/.test(ch) ? 1 : 2;
  return s + ' '.repeat(Math.max(0, width - w));
};

const rows = Object.values(monsters).map(m => ({
  id: m.id, name: m.name,
  hp: m.baseHp, guts: m.baseGuts, atk: m.baseAtk, def: m.baseDef,
  sum: m.baseHp + m.baseGuts + m.baseAtk + m.baseDef,
  plus: m.plusStats, apt: m.distAptitude.join(''),
  mult: m.unique.baseMult, cost: m.unique.baseGuts,
  lineage: (lineages[m.id] || {}).main || '?',
  isNew: false,
}));

const newHp = num('hp'), newGuts = num('guts'), newAtk = num('atk'), newDef = num('def');
if (newHp !== null || newGuts !== null || newAtk !== null || newDef !== null) {
  rows.push({
    id: '(new)', name: opt('name') || '新しい子',
    hp: newHp || 0, guts: newGuts || 0, atk: newAtk || 0, def: newDef || 0,
    sum: (newHp || 0) + (newGuts || 0) + (newAtk || 0) + (newDef || 0),
    plus: null, apt: opt('apt') || '----',
    mult: num('mult') || 0, cost: num('cost') || 0,
    lineage: opt('lineage') || '?', isNew: true,
  });
}

let shown = rows.slice().sort((a, b) => b.sum - a.sum);
const like = opt('like');
if (like) {
  const base = rows.find(r => r.id === like || r.name === like);
  if (!base) { console.error(`そのモンスターは居ません: ${like}`); process.exit(1); }
  shown = rows.slice()
    .sort((a, b) => Math.abs(a.sum - base.sum) - Math.abs(b.sum - base.sum))
    .slice(0, 4)
    .sort((a, b) => b.sum - a.sum);
}

console.log('合計  ' + padName('名前', 16) + 'ライフ ガッツ ちから 丈夫さ  間合い  固有技     主血統');
console.log('-'.repeat(82));
for (const r of shown) {
  const mark = r.isNew ? '★' : '  ';
  console.log(mark + pad(r.sum, 4) + '  ' + padName(r.name, 16)
    + pad(r.hp, 5) + pad(r.guts, 6) + pad(r.atk, 6) + pad(r.def, 6)
    + '  ' + r.apt + '  ×' + String(r.mult).padEnd(4) + '消' + pad(r.cost, 3) + '  ' + r.lineage);
}

// 各項目が「いまどの幅に収まっているか」。新しい値がその外へ出るときは、外れている旨を言う。
const stats = ['hp', 'guts', 'atk', 'def', 'sum'];
const labels = { hp: 'ライフ', guts: 'ガッツ', atk: 'ちから', def: '丈夫さ', sum: '合計' };
const olds = rows.filter(r => !r.isNew);
console.log('\n【いまの幅】');
for (const k of stats) {
  const vals = olds.map(r => r[k]).sort((a, b) => a - b);
  const mid = vals[Math.floor(vals.length / 2)];
  const line = `${labels[k]}: ${vals[0]} 〜 ${vals[vals.length - 1]}（まんなか ${mid}）`;
  const mine = rows.find(r => r.isNew);
  if (!mine) { console.log('  ' + line); continue; }
  const v = mine[k];
  const below = vals.filter(x => x < v).length;
  const out = v < vals[0] ? '  ← いちばん低い' : v > vals[vals.length - 1] ? '  ← いちばん高い' : '';
  console.log('  ' + line + ` / 新しい子 ${v}（下から${below + 1}番目）${out}`);
}

// 間合い適性は零・近・中・遠の順。A(得意)〜G(苦手)
console.log('\n【間合い適性 零/近/中/遠】A が得意、G が苦手');
const aptCount = {};
for (const r of olds) r.apt.split('').forEach((c, i) => { (aptCount[i] = aptCount[i] || {})[c] = (aptCount[i][c] || 0) + 1; });
const rangeNames = ['零', '近', '中', '遠'];
for (let i = 0; i < 4; i++) {
  const c = aptCount[i] || {};
  const parts = Object.keys(c).sort().map(k => `${k}:${c[k]}体`);
  console.log(`  ${rangeNames[i]}  ` + parts.join(' / '));
}
console.log('\n供モン加算(plusStats)の幅:');
for (const k of ['hp', 'atk', 'def', 'guts']) {
  const vals = olds.map(r => r.plus[k]).sort((a, b) => a - b);
  console.log(`  ${k}: ${vals[0]} 〜 ${vals[vals.length - 1]}`);
}
