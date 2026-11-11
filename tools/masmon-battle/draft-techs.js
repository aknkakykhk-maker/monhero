// 助手のマスモンの技表の「仮」(検査と集計のためだけ。ゲームには入れない)(2026-11-11 タタカイ)。
// 本番の技表 monster-hero/data/assistant-masmon-techs.js(ASSISTANT_MASMON_TECHS・シュギョウ担当)ができたら、
// load.js はそちらを読む。数字は MF2 の技の幅(消費10〜55・命中−25〜+22・クリ5〜30・GD5〜45)の中で置いた。
'use strict';
const makeDraftTechs = (ALL_PLAYER_MONSTERS) => {
  const G = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'S+', 'SS', 'SS+', 'M'];
  const species = {};
  for (const id of Object.keys(ALL_PLAYER_MONSTERS).sort()) {
    const apt = (ALL_PLAYER_MONSTERS[id].distAptitude || ['C', 'C', 'C', 'C']).map(g => G.indexOf(g));
    let best = 0;
    apt.forEach((v, i) => { if (v > apt[best]) best = i; });
    const near = best === 0 ? 1 : best === 3 ? 2 : (apt[best - 1] >= apt[best + 1] ? best - 1 : best + 1);
    const bigKind = best <= 1 ? 'pow' : 'wise';
    const other = bigKind === 'pow' ? 'wise' : 'pow';
    const k = id.toLowerCase();
    species[id] = [
      { id: `${k}_01`, name: '仮・軽打', kind: 'pow', dist: [0, 1], power: 12, hit: 8, guts: 12, crit: 5, gd: 3, learn: { start: true } },
      { id: `${k}_02`, name: '仮・遠撃', kind: 'wise', dist: [2, 3], power: 14, hit: 4, guts: 16, crit: 5, gd: 5, learn: { start: true } },
      { id: `${k}_03`, name: '仮・大技', kind: bigKind, dist: [best], power: 34, hit: -14, guts: 42, crit: 12, gd: 8 },
      { id: `${k}_04`, name: '仮・ガッツ崩し', kind: other, dist: [Math.min(best, near), Math.max(best, near)], power: 10, hit: 2, guts: 22, crit: 5, gd: 28 },
      { id: `${k}_05`, name: '仮・会心', kind: 'pow', dist: [1, 2], power: 18, hit: 16, guts: 24, crit: 22, gd: 5 },
    ];
  }
  return { version: 0, draft: true, species };
};
module.exports = { makeDraftTechs };
