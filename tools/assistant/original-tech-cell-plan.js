#!/usr/bin/env node
// オリジナルモンスターの技を、メイン血統の「元の技」と同じマス(ランク×間合い)へ寄せる案を出す(2026-11-15 社長 r1115-146②)。読むだけ・何も書き換えない
//   node tools/assistant/original-tech-cell-plan.js [--md]
//   対応の付け方: メイン血統の技1つずつに、オリジナルの技から「名前の重なり(元の技の名前を含む)> 技の種類が同じ > 威力が近い」で1つ選ぶ。
//   選ばれた技はその元の技のマスへ。残った技は、空きマスのうちランクの差が1までで、いまのマスに近い所(ランクの差+間合いの差が小さい順)へ。無ければいまのマスのまま(重なる)
'use strict';
const path = require('path');
const { ASSISTANT_MASMON_TECHS: B } = require(path.join(__dirname, '..', '..', 'monster-hero', 'data', 'assistant-masmon-techs.js'));
const MAIN = { Pandora: 'Pixie', KenshiMocchi: 'Mocchi', Eiki: 'Zan', Melody: 'Yggdrasil', Kuromy: 'Yggdrasil' };
const D = ['零', '近', '中', '遠'];
const MD = process.argv.includes('--md');
const cellOf = (t) => `${t.rank}-${t.dist[0]}`;
const out = [];
for (const [sp, mainSp] of Object.entries(MAIN)) {
  const own = B.species[sp].slice(); const base = B.species[mainSp];
  const left = new Set(own.map(t => t.id)); const plan = {};
  // 名前の重なりが強い組から順に決める
  const pairs = [];
  for (const m of base) for (const t of own) {
    const nameHit = t.name.includes(m.name) ? 100 + m.name.length : 0;
    const score = nameHit + (t.kind === m.kind ? 10 : 0) - Math.abs(t.power - m.power) / 5 - Math.abs(t.rank - m.rank) * 2 - (t.dist[0] === m.dist[0] ? 0 : 3);
    pairs.push({ m, t, score, nameHit });
  }
  pairs.sort((a, b) => b.score - a.score);
  const usedM = new Set();
  for (const p of pairs) {
    if (usedM.has(p.m.id) || !left.has(p.t.id)) continue;
    usedM.add(p.m.id); left.delete(p.t.id);
    plan[p.t.id] = { to: `${p.m.rank}-${p.m.dist[0]}`, base: p.m, why: p.nameHit ? '名前' : '似た性能' };
  }
  // 残った技: 空きマスへ
  const taken = new Set(Object.values(plan).map(x => x.to));
  for (const t of own.filter(x => left.has(x.id))) {
    const empty = [];
    for (let r = 1; r <= 5; r++) for (let d = 0; d < 4; d++) if (!taken.has(`${r}-${d}`) && Math.abs(r - t.rank) <= 1) empty.push({ k: `${r}-${d}`, cost: Math.abs(r - t.rank) * 2 + Math.abs(d - t.dist[0]) });
    empty.sort((a, b) => a.cost - b.cost);
    const to = empty.length ? empty[0].k : cellOf(t);
    taken.add(to); plan[t.id] = { to, base: null, why: empty.length ? '空きへ' : 'いまのまま(重なる)' };
  }
  const rows = own.map(t => {
    const p = plan[t.id]; const [r, d] = p.to.split('-').map(Number); const moved = r !== t.rank || d !== t.dist[0];
    const b = p.base ? `${p.base.name}(威力${p.base.power}・命中${p.base.hit}・ガッツ${p.base.guts}・会心${p.base.crit}・GD${p.base.gd})` : '—';
    return { t, r, d, moved, b, why: p.why };
  }).sort((a, b) => a.r - b.r || a.d - b.d);
  const cnt = {}; rows.forEach(x => { const k = `${x.r}-${x.d}`; cnt[k] = (cnt[k] || 0) + 1; });
  const dup = Object.entries(cnt).filter(([, n]) => n > 1).map(([k, n]) => `ランク${k.split('-')[0]}・${D[k.split('-')[1]]}(${n}技)`);
  out.push(`### ${sp}(${own.length}技)← メイン血統 ${mainSp}(${base.length}技)`);
  out.push(`動かす技 ${rows.filter(x => x.moved).length} / 動かしたあとの重なり: ${dup.length ? dup.join('・') : 'なし'}`);
  out.push('', '| 技 | いま | 案 | 元の技(メイン血統) | 決め方 | いまの性能(威力・命中・ガッツ・会心・GD) |', '| --- | --- | --- | --- | --- | --- |');
  for (const x of rows) out.push(`| ${x.t.name} | ${x.t.rank}・${D[x.t.dist[0]]} | ${x.moved ? '**' : ''}${x.r}・${D[x.d]}${x.moved ? '**' : ''} | ${x.b} | ${x.why} | ${x.t.power}・${x.t.hit}・${x.t.guts}・${x.t.crit}・${x.t.gd} |`);
  out.push('');
}
// --table3(r1115-147): 主血統の技 | いまのオリジナルの技 | 直した後(間合い・ランクは主血統の技と同じ。性能は主血統の技の 威力・命中・会心 +2、ガッツ・GD は同じ。r1115-099 と同じ寄せ方)
if (process.argv.includes('--table3')) {
  const t3 = ['# r1115-146・147 オリジナルモンスターの技を、メイン血統の技の表と同じ並びにする案(下書き)', '',
    '対応の付け方(r1115-151): もとのマスが同じ技を先に → 同じ間合いでランクが近い技 → 名前 → 技の種類 → 威力が近い。直した後: 間合い・ランクは対応する主血統の技と同じ。性能は 威力・命中・会心 = 主血統の技 +2、消費ガッツ・ガッツダウン = 主血統の技と同じ。技の id・名前・技の種類(ちから/かしこさ)は変えない。',
    '主血統より技が多い子は、対応の無い技が残る(表の下。①の印と入れ替えで扱う)', ''];
  const perf = (x) => `威力${x.power}・命中${x.hit}・ガッツ${x.guts}・会心${x.crit}・GD${x.gd}`;
  for (const [sp, mainSp] of Object.entries(MAIN)) {
    const own = B.species[sp]; const base = B.species[mainSp];
    const pairs = [];
    for (const m of base) for (const t of own) {
      // r1115-151: 名前でなく「もとのマスが同じ技を先に」。同じマス(ランク・間合い)> 同じ間合いでランクが近い > 名前 > 技の種類 > 威力が近い
      const sameCell = t.rank === m.rank && t.dist[0] === m.dist[0] ? 10000 : 0;
      const sameDist = t.dist[0] === m.dist[0] ? 1000 - Math.abs(t.rank - m.rank) * 200 : 0;
      const nameHit = t.name.includes(m.name) ? 100 + m.name.length : 0;
      pairs.push({ m, t, score: sameCell + sameDist + nameHit + (t.kind === m.kind ? 10 : 0) - Math.abs(t.power - m.power) / 5 - Math.abs(t.rank - m.rank) * 2 });
    }
    pairs.sort((a, b) => b.score - a.score);
    const usedM = new Map(); const usedT = new Set();
    for (const p of pairs) { if (usedM.has(p.m.id) || usedT.has(p.t.id)) continue; usedM.set(p.m.id, p.t); usedT.add(p.t.id); }
    t3.push(`## ${sp}(${own.length}技)← メイン血統 ${mainSp}(${base.length}技)`, '', '| 主血統の技(ランク・間合い・性能) | いまのオリジナルの技 | 直した後 |', '| --- | --- | --- |');
    for (const m of base.slice().sort((a, b) => a.rank - b.rank || a.dist[0] - b.dist[0])) {
      const t = usedM.get(m.id);
      const after = t ? `${t.name}: ${m.rank}・${m.dist.map(d => D[d]).join('')}・威力${m.power + 2}・命中${m.hit + 2}・ガッツ${m.guts}・会心${m.crit + 2}・GD${m.gd}${m.moveTo != null ? `・当たると${D[m.moveTo]}へ` : ''}` : '(対応する技なし)';
      t3.push(`| ${m.name}(${m.rank}・${m.dist.map(d => D[d]).join('')}・${perf(m)}) | ${t ? `${t.name}(${t.rank}・${t.dist.map(d => D[d]).join('')}・${perf(t)})` : '—'} | ${after} |`);
    }
    const rest = own.filter(t => !usedT.has(t.id));
    if (rest.length) { t3.push('', `対応の無い技(${rest.length}): ` + rest.map(t => `${t.name}(${t.rank}・${D[t.dist[0]]})`).join('・') + ' … いまのランク・間合い・性能のまま(重なるマスは①の印と入れ替え)'); }
    t3.push('');
  }
  console.log(t3.join('\n'));
  process.exit(0);
}
console.log(MD ? out.join('\n') : out.filter(l => l.startsWith('###') || l.startsWith('動かす')).join('\n'));
