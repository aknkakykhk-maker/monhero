#!/usr/bin/env node
// オリジナルモンスター5体の技に、メイン血統の技にならった性能の差を付ける(2026-11-15 社長 r1115-099・案 docs/progress/r1115-075/README.md)。
//   node tools/assistant/original-tech-spread.js           … 案の表を出すだけ(材料は書き換えない)
//   node tools/assistant/original-tech-spread.js --write   … 材料 tools/assistant/techs2/tuned-draft.json を書き換える(そのあと assistant-masmon-techs-build.js)
// ① 同じ間合い・同じ評価(ダメージ・命中・ガッツダウン・クリティカル。画面の区切り MSA_TECH_GRADE_CUTS)で並んだ技の、2つ目からを直す。
//    手本は、その子のメイン血統の種の技のうち同じランクの技(無ければ ±1)。手本が「そのランクの平均からどれだけずれているか」を元の数字に足す。
//    消費ガッツ・間合い・技種・覚え方は変えない。直したあとも同じ評価が並ぶ手本は使わない(並ばない手本の中で、同じ間合い → ずれの大きい順)
// ② パンドラの零・近の空き升(ランク2〜5)に、ピクシー種の零・近の技をパンドラ用にした8技を足す(数字は元の技から 威力・命中・クリティカル +2)。
//    ランクと熟練の条件は決めた形(fixRank・needFix)で持ち、ほかの18技のランク分け(消費ガッツの順)は動かさない
// 何度回しても同じ結果(すでに直した技は、元の数字 orig から計算し直す)。
'use strict';
const fs = require('fs');
const path = require('path');
const DRAFT = path.join(__dirname, 'techs2', 'tuned-draft.json');
const WRITE = process.argv.includes('--write');
const draft = JSON.parse(fs.readFileSync(DRAFT, 'utf8'));
const CUTS = { power: [8, 11, 16, 21, 26, 33, 39, 51], hit: [-21, -18, -12, -8, -2, 2, 8, 13], gd: [3, 6, 8, 10, 12, 16, 21, 27], crit: [7, 8, 9, 11, 12, 18, 19, 26] }; // 56-monhero-success-manual.jsx と同じ
const G = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'];
const gr = (k, v) => { if (k === 'gd' && v <= 0) return '−'; let i = 0; while (i < CUTS[k].length && v >= CUTS[k][i]) i++; return G[i]; };
const Q = ['power', 'hit', 'gd', 'crit'];
const g4 = (x) => Q.map(q => gr(q, x[q])).join('・');
const D = ['零', '近', '中', '遠'];
// メイン血統の種(data/lineages.js の MONSTER_LINEAGE_MAP の main)
const MAIN = { Pandora: 'Pixie', KenshiMocchi: 'Mocchi', Eiki: 'Zan', Melody: 'Yggdrasil', Kuromy: 'Yggdrasil' };
// 技のランク: 作った技表から読む(技表を作る道具が決めた rank)
const { ASSISTANT_MASMON_TECHS: BUILT } = require(path.join(__dirname, '..', '..', 'monster-hero', 'data', 'assistant-masmon-techs.js'));
const rankOf = (sp, id) => { const t = (BUILT.species[sp] || []).find(x => x.id === id); return t ? t.rank : null; };
const typeName = (dev) => { const s = [['命中型', dev.hit / 6], ['クリティカル型', dev.crit / 5], ['ガッツダウン型', dev.gd / 5], ['重撃型', dev.power / 5]].sort((a, b) => b[1] - a[1]); return s[0][0]; };

const lines = [];
// ---- ① 性能の差 ----
for (const [sp, mainSp] of Object.entries(MAIN)) {
  const list = draft.species[sp]; const L = (BUILT.species[mainSp] || []);
  list.forEach(t => { if (t.orig) Object.assign(t, t.orig); delete t.orig; delete t.spread; }); // やり直せるように元へ
  const own = list.filter(t => !t.fixRank);
  const done = []; // 型の名前は手本のずれのいちばん大きい向き
  for (const d of [0, 1, 2, 3]) {
    const usedT = new Set(); const usedK = new Set(); // 同じ間合いの中で、同じ手本・同じ型を続けて使わない
    const inD = () => own.filter(t => (t.dist || []).includes(d));
    const groups = {}; inD().forEach(t => { (groups[g4(t)] = groups[g4(t)] || []).push(t); });
    Object.values(groups).filter(a => a.length > 1).forEach(a => a.slice(1).forEach(t => {
      const r = rankOf(sp, t.id) || 1;
      const pool = (rr) => L.filter(x => x.rank === rr);
      let same = pool(r); if (same.length < 3) same = [...pool(r), ...pool(r - 1), ...pool(r + 1)];
      const avg = {}; Q.forEach(q => { avg[q] = same.reduce((s, x) => s + x[q], 0) / same.length; });
      const cands = same.map(x => { const dev = {}; Q.forEach(q => { dev[q] = Math.round(x[q] - avg[q]); }); const n = { power: Math.max(4, t.power + dev.power), hit: t.hit + dev.hit, gd: Math.max(0, t.gd + dev.gd), crit: Math.max(4, t.crit + dev.crit) };
        return { x, dev, n, sameDist: (x.dist || []).includes(d), size: Math.abs(dev.power) / 5 + Math.abs(dev.hit) / 6 + Math.abs(dev.gd) / 5 + Math.abs(dev.crit) / 5 }; })
        .filter(c => !inD().some(o => o !== t && g4(o) === g4(c.n)))
        .map(c => ({ ...c, tn: typeName(c.dev) }))
        .sort((p, q) => (usedT.has(p.x.id) - usedT.has(q.x.id)) || (usedK.has(p.tn) - usedK.has(q.tn)) || (q.sameDist - p.sameDist) || (q.size - p.size) || p.x.id.localeCompare(q.x.id));
      const c = cands[0]; if (!c) { lines.push(`注意: ${sp} ${t.name} は手本が見つからない`); return; }
      const before = { ...t }; t.orig = Q.reduce((o, q) => ({ ...o, [q]: t[q] }), {}); Object.assign(t, c.n); t.spread = c.x.id; usedT.add(c.x.id); usedK.add(c.tn);
      done.push(`| ${D[d]} | ${t.name}(R${r}) | ${a[0].name} と同じ ${g4(before)} | ${c.tn}(手本 ${c.x.name}・${mainSp}) | ${Q.map(q => `${before[q]}→${t[q]}`).join('・')} | ${g4(t)} |`);
    }));
  }
  lines.push(`### ${sp}(メイン血統 ${mainSp})\n`);
  lines.push(done.length ? `| 間合い | 直した技 | いま | 型(手本) | 威力・命中・ガッツダウン・クリティカル | 直したあとの評価 |\n|---|---|---|---|---|---|\n${done.join('\n')}\n` : '同じ評価が並ぶ技は無い(直さない)\n');
}

// ---- ② パンドラの零・近の8技(ピクシー種の技から) ----
const px = Object.fromEntries((BUILT.species.Pixie || []).map(x => [x.name, x]));
const ADD = [
  ['pandora_o19', 'ダブルはり手', 0, 2, 'はり手', { power: 16, hit: 1, guts: 14, gd: 8, crit: 8 }, null],
  ['pandora_o20', 'アビスヒールレイド', 0, 3, 'ヒールレイド', null, 'pandora_o19'],
  ['pandora_o21', 'セラフ投げ飛ばし', 0, 4, '投げ飛ばし', null, 'pandora_o20'],
  ['pandora_o22', 'カオスファイトクラウド', 0, 5, 'ファイトクラウド', null, 'pandora_o21'],
  ['pandora_o23', 'セラフハイキック', 1, 2, 'ハイキック', null, null],
  ['pandora_o24', 'ルミナスバン', 1, 3, 'バン', null, 'pandora_o23'],
  ['pandora_o25', 'カオスビッグバン', 1, 4, 'ビッグバン', null, 'pandora_o24'],
  ['pandora_o26', 'ノヴァコズミックバン', 1, 5, 'コズミックバン', null, 'pandora_o25'],
];
const NEED = { 3: 25, 4: 40, 5: 50 };
const P = draft.species.Pandora.filter(t => !t.fixRank);
const added = ADD.map(([id, name, d, r, src, base, need]) => {
  const b = base || px[src]; if (!b) throw new Error(`ピクシーの技 ${src} が無い`);
  const t = { id, name, kind: (base ? 'pow' : px[src].kind), dist: [d], power: b.power + 2, hit: b.hit + 2, guts: b.guts, crit: b.crit + 2, gd: b.gd, ...(px[src] && px[src].moveTo != null ? { moveTo: px[src].moveTo } : {}), fixRank: r, ...(need ? { needFix: { [need]: NEED[r] } } : {}), from: px[src] ? px[src].id : null };
  lines.push(`| ${D[d]} | R${r} | ${name} | ${src}(${t.kind === 'pow' ? 'ちから' : 'かしこさ'}) | ${t.power}・${t.hit}・${t.guts}・${t.gd}・${t.crit} | ${g4(t)} | ${need ? `${ADD.find(x => x[0] === need)[1]}の熟練${NEED[r]}` : '—'} |`);
  return t;
});
lines.splice(lines.length - ADD.length, 0, '### パンドラの零・近の8技(ピクシー種から)\n\n| 間合い | ランク | 技名 | 元の技 | 威力・命中・ガッツ・ガッツダウン・クリティカル | 評価 | 熟練の条件 |\n|---|---|---|---|---|---|---|');
draft.species.Pandora = [...P, ...added];
console.log(lines.join('\n'));
if (WRITE) { fs.writeFileSync(DRAFT, JSON.stringify(draft, null, 1)); console.log(`\n書きました: ${path.relative(process.cwd(), DRAFT)}(このあと node tools/assistant/assistant-masmon-techs-build.js)`); }
