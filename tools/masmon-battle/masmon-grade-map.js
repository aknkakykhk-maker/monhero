#!/usr/bin/env node
// 技の等級 → 対戦の芯の数 の写し表と、資料の技で作った仮の技表での釣り合いの試算(2026-11-13 バトル部)
//   node tools/masmon-battle/masmon-grade-map.js            写し表と、種類ごとの勝率(いまの技表 → 仮の技表)の上下だけ
//   node tools/masmon-battle/masmon-grade-map.js --json=<先> 仮の技表(芯の形)を書き出す(技表の作り直しは助手部の道具。これは試算用)
//
// 写し方: 資料(docs/reference/line-mf/monster-skill-data)の全852技で、等級(G〜SS・半段の「+」つき17段)ごとの累積の真ん中の位置を取り、
//   いまの技表(240技)の同じ位置の数を当てる(分位で写す)。技の強さの全体の幅はいまのまま、資料の並びだけを移す。
//   消費ガッツは資料の数をそのまま(8〜55・芯の範囲 5〜60 に入る)。間合いは資料の1つ(零・近・中・遠)。移動先(moveTo)は芯がまだ読まない
// 種類の技: 25種は資料の「主血統の共通技(unique でない)+その種類が owners にいる固有技」。オリジナル5種は docs/progress/msa-tech/originals-draft.json
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, load } = require('./load.js');

const REF = path.join(ROOT, 'docs/reference/line-mf/monster-skill-data');
const GR = ['G', 'G+', 'F', 'F+', 'E', 'E+', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S', 'S+', 'SS'];
const DIST = { 零: 0, 近: 1, 中: 2, 遠: 3 };
const ATTR = { damage: 'power', accuracy: 'hit', gutsDown: 'gd', critical: 'crit' };

const all = [];
for (const f of fs.readdirSync(path.join(REF, 'monster-skills-by-blood')).sort()) all.push(...JSON.parse(fs.readFileSync(path.join(REF, 'monster-skills-by-blood', f), 'utf8')).skills);
const mons = JSON.parse(fs.readFileSync(path.join(REF, '1_monsters.json'), 'utf8')).monsters;
const { engine, data } = load();
const NOW = data.ASSISTANT_MASMON_TECHS;
const nowTechs = Object.values(NOW.species).flat();

// 分位で写す
const quant = (sorted, p) => { const x = p * (sorted.length - 1), i = Math.floor(x), f = x - i; return sorted[i] + (sorted[Math.min(sorted.length - 1, i + 1)] - sorted[i]) * f; };
const MAP = {};
for (const [g, k] of Object.entries(ATTR)) {
  const cnt = GR.map(x => all.filter(s => s[g] === x).length), n = cnt.reduce((a, b) => a + b, 0);
  const vals = nowTechs.map(t => t[k]).sort((a, b) => a - b);
  let acc = 0; MAP[k] = {};
  GR.forEach((x, i) => { const mid = (acc + cnt[i] / 2) / n; acc += cnt[i]; MAP[k][x] = Math.round(quant(vals, Math.min(1, Math.max(0, mid)))); });
  // 資料に無い段(数 0)は前後の間を埋めたまま。並びが逆にならないように前の段以上にそろえる
  let prev = -Infinity; for (const x of GR) { MAP[k][x] = Math.max(prev, MAP[k][x]); prev = MAP[k][x]; }
}
const gv = (k, g) => { const x = String(g || '').trim(); return MAP[k][x] != null ? MAP[k][x] : MAP[k].C; };
const techOf = (s, id) => ({ id, name: s.name, kind: s.kind, dist: [s.dist], power: gv('power', s.dmg), hit: gv('hit', s.acc), guts: s.guts, crit: gv('crit', s.cri), gd: gv('gd', s.gd), ...(s.moveTo != null ? { moveTo: s.moveTo } : {}), ...(s.start ? { learn: { start: true } } : {}) });

// 仮の技表
const ORIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/progress/msa-tech/originals-draft.json'), 'utf8'));
const ORIG_ID = Object.fromEntries(Object.entries(ORIG.species).map(([id, v]) => [v.jp, id]));
const table = {};
const A = data.ALL_PLAYER_MONSTERS;
for (const [sp, m] of Object.entries(A)) {
  const mo = mons.find(x => x.name === m.name);
  if (mo) {
    const list = all.filter(s => (s.blood === mo.mainBlood && !s.unique && !(s.owners || []).length) || (s.owners || []).includes(mo.id)).sort((a, b) => a.rank - b.rank || a.guts - b.guts);
    table[sp] = list.map((s, i) => techOf({ name: s.name, kind: s.skillType === 'かしこさ' ? 'wise' : 'pow', dist: DIST[s.range] ?? 1, guts: s.guts, dmg: s.damage, acc: s.accuracy, gd: s.gutsDown, cri: s.critical, moveTo: s.moveTo != null ? DIST[s.moveTo] : null, start: i < 2 }, s.skillId));
  }
}
ORIG.rows.forEach((r) => {
  const sp = ORIG_ID[r.sp]; table[sp] = table[sp] || [];
  table[sp].push(techOf({ name: r.nm, kind: r.kind === 'かしこさ' ? 'wise' : 'pow', dist: DIST[r.range] ?? 1, guts: r.guts, dmg: r.dmg, acc: r.acc, gd: r.gd, cri: r.cri, moveTo: r.moveTo ? DIST[r.moveTo] : null, start: table[sp].length < 2 }, `${sp.toLowerCase()}_o${String(table[sp].length + 1).padStart(2, '0')}`));
});

// ── --tune: 釣り合いの調整(2026-11-13 社長「技性能は結構差があるからしっかり精査してバランス調整していいよ。ただ個性がなくならないように」)
//   ① 種類ごとの平均(命中・削り・会心・威力あたりのガッツ)を、全体の平均へ SHRINK の分だけ寄せる(種類の順位は変わらない=得意は残る)
//   ② 零・近の技が1つも無い種類は、いちばん近い間合いの技を1つずつ広げる(届かない間合いで何もできない時間を減らす)
//   ③ 種類ごとの威力の倍率を、試算の勝率から少しずつ決める(0.8〜1.25)。直した所は FIX に残して一覧に出す
const TUNE = process.argv.includes('--tune');
const ORIG_SET = new Set(Object.keys(ORIG.species));
const SHRINK = 0.5;
const BAND = [0.38, 0.70];
const BAND_ORIG = [0.48, 0.52]; // オリジナル5種は50%前後(社長 2026-11-13) // 勝率をこの中へ(社長「いまと同じくらいの幅」・ゴースト系は70%前後)
const SHRINK_HIT = 0.7; // 命中だけ7割寄せる(社長 2026-11-13「ゴースト系はもう少し下げる。削りの強さは個性として残す」)
const FIX = {};
const N_TUNE = Number((process.argv.find(a => a.startsWith('--tn=')) || '--tn=6').slice(5));
const meanOf = (list, f) => list.reduce((a, t) => a + f(t), 0) / Math.max(1, list.length);
const LIM = engine.TECH_LIMITS;
const clampK = (k, v) => Math.max(LIM[k][0], Math.min(LIM[k][1], Math.round(v)));
if (TUNE) {
  globalThis.__before = Object.fromEntries(['hit', 'gd', 'crit'].map(k => [k, Object.fromEntries(Object.entries(table).map(([sp, l]) => [sp, meanOf(l, t => t[k])]))]));
  const allT = Object.values(table).flat();
  const g = { hit: meanOf(allT, t => t.hit), gd: meanOf(allT, t => t.gd), crit: meanOf(allT, t => t.crit), eff: meanOf(allT, t => t.power / t.guts) };
  for (const [sp, list] of Object.entries(table)) {
    const fx = FIX[sp] = { notes: [] };
    for (const k of ['hit', 'gd', 'crit']) {
      const d = (meanOf(list, t => t[k]) - g[k]) * (k === 'hit' ? SHRINK_HIT : SHRINK);
      if (Math.abs(d) >= 1) { list.forEach(t => { t[k] = clampK(k, t[k] - d); }); fx.notes.push(`${{ hit: '命中', gd: '削り', crit: '会心' }[k]} ${d > 0 ? '−' : '+'}${Math.abs(Math.round(d))}`); }
    }
    const e = meanOf(list, t => t.power / t.guts), r = (g.eff + (e - g.eff) * (1 - SHRINK)) / e;
    // 威力/ガッツ を target に寄せる = ガッツを e/target 倍(効率がよすぎる種類ほど重くする)
    if (Math.abs(r - 1) >= 0.03) { list.forEach(t => { t.guts = clampK('guts', t.guts / r); }); fx.notes.push(`ガッツ ×${Math.round(100 / r) / 100}`); }
    for (const d of [0, 1]) if (!list.some(t => t.dist.includes(d))) {
      const near = list.filter(t => t.dist.every(x => x > d)).sort((a, b) => Math.min(...a.dist) - Math.min(...b.dist) || a.guts - b.guts)[0];
      if (near) { near.dist = [...new Set([d, ...near.dist])].sort(); fx.notes.push(`${near.name} を${['零', '近'][d]}にも届く`); }
    }
    fx.mul = 1;
  }
}
const jsonArg = process.argv.find(a => a.startsWith('--json='));
if (jsonArg) { fs.writeFileSync(jsonArg.slice(7), JSON.stringify({ map: MAP, species: table }, null, 1)); console.log('書き出し:', jsonArg.slice(7)); }

// 試算: 能力をそろえた1対1の総当たり(種類と技だけの差)。いまの技表と仮の技表で、種類ごとの勝率
const N = Number((process.argv.find(a => a.startsWith('--n=')) || '--n=12').slice(4));
const rate = (techs) => {
  const catalog = engine.buildCatalog({ ALL_PLAYER_MONSTERS: A, ASSISTANT_MASMON_TECHS: { species: techs } });
  const ids = Object.keys(catalog.species), w = {}, g = {};
  const unit = (sp) => ({ species: sp, name: sp, lv: 50, stats: { life: 350, pow: 350, wise: 350, hit: 350, eva: 350, tough: 350 }, techs: catalog.species[sp].techs.map(t => t.id) });
  for (const a of ids) for (const b of ids) {
    if (a === b) continue;
    for (let k = 0; k < N; k++) {
      const r = engine.simulate({ seed: `gm-${a}-${b}-${k}`, catalog, teamA: { assistantId: 'atsu', members: [unit(a)] }, teamB: { assistantId: 'atsu', members: [unit(b)] } });
      w[a] = (w[a] || 0) + (r.winner === 'A' ? 1 : r.winner === 'draw' ? 0.5 : 0); w[b] = (w[b] || 0) + (r.winner === 'B' ? 1 : r.winner === 'draw' ? 0.5 : 0);
      g[a] = (g[a] || 0) + 1; g[b] = (g[b] || 0) + 1;
    }
  }
  return Object.fromEntries(ids.map(i => [i, Math.round(w[i] / g[i] * 1000) / 10]));
};
const r0 = rate(NOW.species);
let r1 = rate(table);
if (TUNE) {
  const base = Object.fromEntries(Object.entries(table).map(([sp, l]) => [sp, l.map(t => t.power)]));
  for (let it = 0; it < N_TUNE; it++) {
    for (const sp of Object.keys(table)) {
      const fx = FIX[sp]; const w = r1[sp] / 100;
      // 帯(BAND)の外に出た種類だけ、帯の端へ戻す(真ん中へ寄せきらない=強い・弱いの順は残す)
      const isOrig = ORIG_SET.has(sp), band = isOrig ? BAND_ORIG : BAND;
      const tgt = Math.max(band[0], Math.min(band[1], w));
      const want = fx.mul * (1 + (tgt - w) * 0.8);
      fx.mul = Math.max(0.8, Math.min(1.25, want));
      // オリジナル5種は倍率が上限・下限に当たったら、命中とガッツの重さで足りない分を足す(社長「オリジナル5種をまん中へ」)
      if (isOrig && want !== fx.mul) {
        const up = want > fx.mul ? 1 : -1;
        table[sp].forEach(t => { t.hit = clampK('hit', t.hit + 2 * up); t.guts = clampK('guts', t.guts * (1 - 0.04 * up)); });
        fx.hitAdd = (fx.hitAdd || 0) + 2 * up; fx.gutsMul = (fx.gutsMul || 1) * (1 - 0.04 * up);
      }
      table[sp].forEach((t, i) => { t.power = clampK('power', base[sp][i] * fx.mul); });
    }
    r1 = rate(table);
    const v = Object.values(r1); console.log(`  調整 ${it + 1}回目: ${Math.min(...v)}〜${Math.max(...v)}%`);
  }
  for (const fx of Object.values(FIX)) { if (Math.abs(fx.mul - 1) >= 0.02) fx.notes.push(`威力 ×${Math.round(fx.mul * 100) / 100}`); if (fx.hitAdd) fx.notes.push(`命中 ${fx.hitAdd > 0 ? '+' : ''}${fx.hitAdd}(上乗せ)`); if (fx.gutsMul && Math.abs(fx.gutsMul - 1) >= 0.02) fx.notes.push(`ガッツ ×${Math.round(fx.gutsMul * 100) / 100}(上乗せ)`); }
}
if (jsonArg && TUNE) fs.writeFileSync(jsonArg.slice(7), JSON.stringify({ map: MAP, fix: FIX, species: table }, null, 1));
const P = (k, list) => `${k}: ` + GR.filter(x => all.some(s => s[Object.keys(ATTR).find(a => ATTR[a] === list)] === x)).map(x => `${x}=${MAP[list][x]}`).join(' ');
console.log('■ 等級 → 数(資料の並びを、いまの技表の幅へ分位で写す)');
for (const k of Object.values(ATTR)) console.log(' ', P(k, k));
const ids = Object.keys(r1).sort((a, b) => r1[b] - r1[a]);
const spread = (r) => { const v = Object.values(r); return `${Math.min(...v)}〜${Math.max(...v)}%`; };
console.log(`■ 種類ごとの勝率(能力をそろえた1対1の総当たり・各 ${N} 戦) いま ${spread(r0)} → 仮 ${spread(r1)}`);
const orig = new Set(Object.keys(ORIG.species));
const line = (i) => `${orig.has(i) ? '★' : ' '}${A[i].name} ${r0[i]}→${r1[i]}%(技 ${table[i].length})`;
console.log('  上位5:', ids.slice(0, 5).map(line).join(' / '));
console.log('  下位5:', ids.slice(-5).map(line).join(' / '));
console.log('  オリジナル5種:', ids.filter(i => orig.has(i)).map(line).join(' / '));
if (TUNE) { console.log('■ 直した所'); for (const i of ids) console.log(`  ${orig.has(i) ? '★' : ' '}${A[i].name} ${r1[i]}%: ${FIX[i].notes.join('・') || 'なし'}`); }
// 個性(種類の得意)が残っているか: 種類ごとの平均の順位を、直す前と比べる
if (TUNE && globalThis.__before) {
  const rk = (o) => Object.keys(o).sort((a, b) => o[b] - o[a]);
  for (const k of ['hit', 'gd', 'crit']) { const after = Object.fromEntries(Object.entries(table).map(([sp, l]) => [sp, meanOf(l, t => t[k])])); const b = rk(globalThis.__before[k]), a2 = rk(after); const same = b.filter((x, i) => a2[i] === x).length; console.log(`  ${k} の種類の順位: ${same}/${b.length} が同じ(上位3 ${b.slice(0, 3).map(x => A[x].name).join('・')} → ${a2.slice(0, 3).map(x => A[x].name).join('・')})`); }
}
