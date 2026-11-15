#!/usr/bin/env node
// オリジナルモンスター5体の技を、メイン血統の技の表と同じ並びにする(2026-11-15 社長 r1115-146・147・151・153①)。
//   node tools/assistant/original-tech-align.js           … 何をどう変えるかを出すだけ
//   node tools/assistant/original-tech-align.js --write   … 材料 tools/assistant/techs2/tuned-draft.json を書き換える(そのあと assistant-masmon-techs-build.js)
// 決め方(案の表 docs/progress/r1115-146/table3.md・作る道具 original-tech-cell-plan.js と同じ対応):
//   ・対応: もとのマスが同じ技を先に → 同じ間合いでランクが近い → 名前 → 技の種類 → 威力(r1115-151⑥)
//   ・組になった技: 間合い・ランク・当たったあとの移動は主血統の技と同じ。威力・命中・会心 = 主血統 +2、消費ガッツ・ガッツダウン = 主血統と同じ。
//     初めから覚えている技は「主血統で初めからの技」と組になった技(r1115-151・初めの技はランク1の技に入れ替え)
//   ・組の無い専用技: 性能はいまのまま。同じマスにほかの技があり、空いているマスがあれば、ランクの差が小さい空きへ移す(r1115-153①)。無ければ重なる(⇄)
//   ・技の id・名前・技の種類は変えない(覚えた技・熟練の保存はそのまま)。ランクが変わった技の修行の条件は、技表を作る道具がランクから付け直す
//   何度回しても同じ結果(主血統の技表と、この道具が最初に書いた元の数字 alignOrig から計算し直す)
'use strict';
const fs = require('fs');
const path = require('path');
const DRAFT = path.join(__dirname, 'techs2', 'tuned-draft.json');
const WRITE = process.argv.includes('--write');
const draft = JSON.parse(fs.readFileSync(DRAFT, 'utf8'));
const { ASSISTANT_MASMON_TECHS: B } = require(path.join(__dirname, '..', '..', 'monster-hero', 'data', 'assistant-masmon-techs.js'));
const MAIN = { Pandora: 'Pixie', KenshiMocchi: 'Mocchi', Eiki: 'Zan', Melody: 'Yggdrasil', Kuromy: 'Yggdrasil' };
const D = ['零', '近', '中', '遠'];
const KEYS = ['dist', 'power', 'hit', 'guts', 'crit', 'gd', 'moveTo', 'learn', 'fixRank', 'needFix', 'rank'];
const lines = [];
for (const [sp, mainSp] of Object.entries(MAIN)) {
  const list = draft.species[sp];
  // やり直せるように、最初に書いたときの元の数字へ戻してから計算する
  list.forEach((t) => { if (t.alignOrig) { for (const k of KEYS) delete t[k]; Object.assign(t, JSON.parse(JSON.stringify(t.alignOrig))); } });
  const built = B.species[sp]; const base = B.species[mainSp];
  const rankNow = (t) => (t.alignOrig && Number.isInteger(t.alignOrig.rankBuilt) ? t.alignOrig.rankBuilt : (built.find((x) => x.id === t.id) || {}).rank);
  const own = list.map((t) => ({ t, rank: rankNow(t), d: t.dist[0] }));
  const pairs = [];
  for (const m of base) for (const o of own) {
    const sameCell = o.rank === m.rank && o.d === m.dist[0] ? 10000 : 0;
    const sameDist = o.d === m.dist[0] ? 1000 - Math.abs(o.rank - m.rank) * 200 : 0;
    const nameHit = o.t.name.includes(m.name) ? 100 + m.name.length : 0;
    pairs.push({ m, o, score: sameCell + sameDist + nameHit + (o.t.kind === m.kind ? 10 : 0) - Math.abs(o.t.power - m.power) / 5 - Math.abs(o.rank - m.rank) * 2 });
  }
  pairs.sort((a, b) => b.score - a.score);
  const usedM = new Set(); const pairOf = new Map();
  for (const p of pairs) { if (usedM.has(p.m.id) || pairOf.has(p.o.t.id)) continue; usedM.add(p.m.id); pairOf.set(p.o.t.id, p.m); }
  const cellTaken = new Map(); // "rank-dist" → 技の数
  const put = (r, d) => cellTaken.set(`${r}-${d}`, (cellTaken.get(`${r}-${d}`) || 0) + 1);
  for (const o of own) {
    const t = o.t;
    if (!t.alignOrig) { const keep = {}; for (const k of KEYS) if (t[k] !== undefined) keep[k] = JSON.parse(JSON.stringify(t[k])); keep.rankBuilt = o.rank; t.alignOrig = keep; }
    const m = pairOf.get(t.id);
    delete t.needFix; delete t.orig; delete t.spread;
    if (m) {
      t.dist = m.dist.slice(); t.power = m.power + 2; t.hit = m.hit + 2; t.crit = m.crit + 2; t.guts = m.guts; t.gd = m.gd;
      if (m.moveTo != null) t.moveTo = m.moveTo; else delete t.moveTo;
      t.fixRank = m.rank; t.rank = m.rank;
      if (m.learn && m.learn.start) t.learn = { start: true }; else delete t.learn;
      put(m.rank, m.dist[0]);
      if (o.rank !== m.rank || o.d !== m.dist[0]) lines.push(`${sp}: ${t.name} ${o.rank}${D[o.d]} → ${m.rank}${D[m.dist[0]]}(${m.name}+2)`);
    }
  }
  // 組の無い専用技: 空きマスがあれば移す(r1115-153①)
  for (const o of own.filter((x) => !pairOf.has(x.t.id))) {
    const t = o.t; delete t.learn; // 初めの技は主血統の初めの技と組になった技だけ
    let r = o.rank, d = o.d;
    if (cellTaken.get(`${r}-${d}`)) {
      const empty = [];
      for (let rr = 1; rr <= 5; rr++) for (let dd = 0; dd < 4; dd++) if (!cellTaken.get(`${rr}-${dd}`)) empty.push({ rr, dd, cost: Math.abs(rr - r) * 2 + Math.abs(dd - d) });
      empty.sort((a, b) => a.cost - b.cost || a.rr - b.rr || a.dd - b.dd);
      if (empty.length) { lines.push(`${sp}: ${t.name}(専用・重なり)${r}${D[d]} → ${empty[0].rr}${D[empty[0].dd]}(空きへ)`); r = empty[0].rr; d = empty[0].dd; t.dist = [d]; }
      else lines.push(`${sp}: ${t.name}(専用)${r}${D[d]} のまま重なる(⇄)`);
    }
    t.fixRank = r; t.rank = r; put(r, d);
  }
  const dup = [...cellTaken.entries()].filter(([, n]) => n > 1).map(([k, n]) => `ランク${k.split('-')[0]}・${D[k.split('-')[1]]}×${n}`);
  const empty = []; for (let rr = 1; rr <= 5; rr++) for (let dd = 0; dd < 4; dd++) if (!cellTaken.get(`${rr}-${dd}`)) empty.push(`${rr}${D[dd]}`);
  lines.push(`${sp}: 重なり ${dup.length ? dup.join('・') : 'なし'} / 空き ${empty.length ? empty.join('・') : 'なし'}`);
}
console.log(lines.join('\n'));
if (WRITE) { fs.writeFileSync(DRAFT, JSON.stringify(draft, null, 1) + '\n'); console.log('書いた: tools/assistant/techs2/tuned-draft.json'); }
