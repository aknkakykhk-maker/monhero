// 絆Lvランキングの「種族別」タブを確認する。
//
//   node tools/ranking/bond-ranking-species-check.js
//
// 以前はモンスター1体ずつのタブ(モッチー / ミタラシ / ピクシー / ミーア …)だったが、
// 主血統(種族)ごとにまとめる形へ変えた(モッチー種にモッチーとミタラシ、
// ピクシー種にピクシー・ミーア・パンドラ、など)。
//
// タブの並びと中身は data/lineages.js の1か所だけが正本で、画面側は
// dexMainLineages() を通して引く。モンスターを足したときに
// MONSTER_LINEAGE_MAP へ1行足すだけでタブへ加わることを、ここで機械的に見張る。
// (画面側へ種族の一覧を書き写すと、モンスターを足すたびに2か所直す必要が出て、
//  片方だけ直して食い違う。実際に同種の見落としを何度も出している)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { REPO_ROOT } = require('../harness');

const web = path.join(REPO_ROOT, 'monster-hero');
const read = (rel) => fs.readFileSync(path.join(web, rel), 'utf8');
const source = read('src/game-system.jsx');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- データ側 ----
const ctx = {};
vm.createContext(ctx);
vm.runInContext([
  read('data/images/images-ally.js'), read('data/skills.js'),
  read('data/ally-monsters.js'), read('data/lineages.js'),
  'globalThis.OUT = { ALL_PLAYER_MONSTERS, MONSTER_LINEAGES, MONSTER_LINEAGE_MAP };',
].join('\n'), ctx);
const { ALL_PLAYER_MONSTERS, MONSTER_LINEAGES, MONSTER_LINEAGE_MAP } = ctx.OUT;

const monsterIds = Object.keys(ALL_PLAYER_MONSTERS);
const missing = monsterIds.filter(id => !MONSTER_LINEAGE_MAP[id]?.main);
check('すべてのモンスターに主血統がある(タブから漏れない)', missing.length === 0, missing.join(', '));

const groups = new Map();
for (const id of monsterIds) {
  const main = MONSTER_LINEAGE_MAP[id]?.main;
  if (!main) continue;
  if (!groups.has(main)) groups.set(main, []);
  groups.get(main).push(ALL_PLAYER_MONSTERS[id].name);
}
for (const [id, names] of groups) {
  console.log(`   ${(MONSTER_LINEAGES[id]?.name || id) + '種'}: ${names.join('・')}`);
}
check('種族タブがモンスターの数より少ない(まとまっている)', groups.size < monsterIds.length,
  `${groups.size}種族 / ${monsterIds.length}体`);
// 1体でも「複数のモンスターが同じ種族に入る」ことを確かめる。
// ここが全部1体ずつだと、まとめた意味が無い(=以前と同じ見え方に戻っている)
const merged = [...groups.entries()].filter(([, names]) => names.length >= 2);
check('複数のモンスターが同じ種族へまとまっている', merged.length > 0,
  merged.map(([id, names]) => `${MONSTER_LINEAGES[id]?.name}種=${names.length}体`).join(' / '));

// ---- 画面側 ----
// タブの並びは血統カタログから引く(画面側に種族名を書き写さない)
check('タブの選択肢を dexMainLineages から作っている',
  source.includes('const bondRankingLineages = useMemo(() => dexMainLineages(), []);'));
check('タブの見出しが「◯◯種」になっている',
  source.includes('label:`${l.name}種`'));
// 絞り込みは血統idで行う。名前で比べていると、同じ種族の別モンスターが弾かれる
check('絞り込みを血統idで行っている',
  source.includes('bondRankingAll.filter(x => bondEntryLineageId(x) === bondRankMonFilter)'));
check('モンスター名での絞り込みが残っていない',
  !source.includes("bondRankingAll.filter(x => x.monName === bondRankMonFilter)"));
// 記録にモンスターidが無い古い記録でも、名前から種を引き当てて種族を決められること
check('idの無い古い記録は名前から種族を引く',
  /bondEntryLineageId = useCallback\(\(entry\) => \{[\s\S]{0,400}ALL_PLAYER_MONSTERS\[id\]\?\.name === entry\?\.monName/.test(source));

// 種族の一覧を画面側へ直接書いていないこと(二重管理の防止)
const lineageNames = Object.values(MONSTER_LINEAGES).map(l => l.name);
const hardcoded = lineageNames.filter(name => source.includes(`'${name}種'`) || source.includes(`"${name}種"`));
check('画面側に種族名を書き写していない', hardcoded.length === 0, hardcoded.join(', '));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
