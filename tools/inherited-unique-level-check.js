const assert = require('assert');
const fs = require('fs');
const path = require('path');
const api = require('./harness').loadDyeModule();
const {
  inheritedUniqueRunLevel, uniqueSkillAtLevel, MAX_UNIQUE_SKILL_LEVEL,
  resolveInheritedUniqueLevel, inheritedUniqueLevelKey,
  migrateInheritedUniqueLevelIds, appendInheritedUnique,
  mergeMasuIntoMon, monsterPowerOf, ALL_PLAYER_MONSTERS,
} = api;

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const baseUnique = { name:'ブラッディクロス', names:Array.from({length:9}, (_, level) => `ブラッディクロス${level}`), baseMult:2, baseGuts:20 };

for (const level of [0, 3, 7, 8]) {
  assert.strictEqual(inheritedUniqueRunLevel({ ...baseUnique, evoLevel:level }, undefined), level, `恒久Lv.${level}をラン開始Lvにする`);
}
assert.strictEqual(inheritedUniqueRunLevel({ ...baseUnique, evoLevel:7 }, 8), 8, 'Lv.7をラン中にLv.8へ強化できる');
assert.strictEqual(inheritedUniqueRunLevel({ ...baseUnique, evoLevel:8 }, 9), MAX_UNIQUE_SKILL_LEVEL, 'Lv.8を上限にする');
assert.strictEqual(inheritedUniqueRunLevel({ ...baseUnique, evoLevel:7 }, 0), 0, '明示した下位Lv.0を恒久Lvへ戻さない');

const level8 = uniqueSkillAtLevel(baseUnique, inheritedUniqueRunLevel({ ...baseUnique, evoLevel:8 }, undefined));
assert.deepStrictEqual(
  { name:level8.name, mult:level8.mult, guts:level8.guts, crit:level8.crit },
  { name:'ブラッディクロス8', mult:6, guts:60, crit:0.5 },
  'カード名・威力・ガッツ・会心率にLv.8を使う',
);

assert(source.includes('const cur=inheritedUniqueRunLevel(slots[slotIdx]?.inheritedUniques?.[inhIdx], inheritedUniqueEvo[key]);'), '強化処理が恒久Lvへフォールバックする');
assert(source.includes('if(diff>0&&(upgradePoints<=0||cur>=8)) return;'), 'Lv.8ではポイントを消費しない');
assert(source.includes('evoLevel:inheritedUniqueRunLevel(iu, slotIdx!=null ? evoMap[inhEvoKey(slotIdx,ii)] : null)'), '表示・固有技切替・buildDeckが共通Lv解決を使う');
assert(source.includes("mh_inherited_unique_level_compensation_pending_v1"), '補填の再開用pendingを保存する');
assert(source.includes("mh_inherited_unique_level_compensation_v1"), '補填済み専用フラグを保存する');
assert(!/setMasuMons\([^)]*inheritedUniqueEvo/.test(source), 'ラン内Lvをマスモンへ恒久保存しない');

let sequence = 0;
const makeId = () => `test_${++sequence}`;
const skillA = { ...ALL_PLAYER_MONSTERS.Suezo.unique, monId:'Suezo', lineageId:'same-lineage', name:'技A', evoLevel:1 };
const skillB = { ...ALL_PLAYER_MONSTERS.Ham.unique, monId:'Ham', lineageId:'same-lineage', name:'技B', evoLevel:0 };
const legacy = {
  id:'legacy', baseId:'Golem', uniqueSkillPoints:11,
  uniqueSkillLevels:{ own:6, 'inh:0':5, 'inh:1':2 },
  inheritedUniques:[skillA, skillB],
};
const beforePower = monsterPowerOf(mergeMasuIntoMon(legacy));
const migrated = migrateInheritedUniqueLevelIds([legacy], makeId);
const migratedMasu = migrated.nextMasuMons[0];
const [migratedA, migratedB] = migratedMasu.inheritedUniques;
assert(migrated.changed, '旧形式を移行する');
assert.notStrictEqual(migratedA.inheritedUniqueId, migratedB.inheritedUniqueId, '同じlineageIdでも専用IDは別');
assert.strictEqual(resolveInheritedUniqueLevel(migratedMasu, migratedA, 0), 5, '技Aへ旧inh:0のLv5をコピー');
assert.strictEqual(resolveInheritedUniqueLevel(migratedMasu, migratedB, 1), 2, '技Bへ旧inh:1のLv2をコピー');
assert.strictEqual(migratedMasu.uniqueSkillLevels.own, 6, 'uniqueSkillLevels.ownを維持');
assert.strictEqual(migratedMasu.uniqueSkillPoints, 11, '未使用固有技ポイントを維持');
assert.strictEqual(migratedMasu.uniqueSkillLevels['inh:0'], 5, '旧inh:0を削除しない');
assert.strictEqual(migratedMasu.uniqueSkillLevels['inh:1'], 2, '旧inh:1を削除しない');
assert.strictEqual(migratedMasu.inheritedUniques.length, legacy.inheritedUniques.length, '移行前後で継承技所持数を維持');
assert.strictEqual(monsterPowerOf(mergeMasuIntoMon(migratedMasu)), beforePower, '移行前後で総合力を維持');

const reordered = { ...migratedMasu, inheritedUniques:[migratedB, migratedA] };
assert.deepStrictEqual(reordered.inheritedUniques.map((u, i) => resolveInheritedUniqueLevel(reordered, u, i)), [2, 5], '並び替えてもLvが移らない');
const afterDelete = { ...reordered, inheritedUniques:[migratedB] };
assert.strictEqual(resolveInheritedUniqueLevel(afterDelete, migratedB, 0), 2, '技Aの削除シミュレーション後も技BはLv2');

const sameMonLegacy = {
  id:'same-mon', baseId:'Golem', uniqueSkillLevels:{ own:4, 'inh:0':3, 'inh:1':7 }, uniqueSkillPoints:9,
  inheritedUniques:[{ ...skillA, lineageId:'duplicate' }, { ...skillA, lineageId:'duplicate' }],
};
const sameMon = migrateInheritedUniqueLevelIds([sameMonLegacy], makeId).nextMasuMons[0];
assert.notStrictEqual(sameMon.inheritedUniques[0].inheritedUniqueId, sameMon.inheritedUniques[1].inheritedUniqueId, '同じmonId・lineageIdでもIDは別');
const sameMonReordered = { ...sameMon, inheritedUniques:[sameMon.inheritedUniques[1], sameMon.inheritedUniques[0]] };
assert.deepStrictEqual(sameMonReordered.inheritedUniques.map((u, i) => resolveInheritedUniqueLevel(sameMonReordered, u, i)), [7, 3], '同じmonIdを並べ替えてもLv3/7を維持');

const unknownLegacy = { id:'unknown', uniqueSkillLevels:{own:2,'inh:0':4}, uniqueSkillPoints:3,
  inheritedUniques:[{name:'旧スナップショット技',baseMult:1.5,baseGuts:12,evoLevel:1}] };
const unknown = migrateInheritedUniqueLevelIds([unknownLegacy], makeId).nextMasuMons[0];
assert(unknown.inheritedUniques[0].inheritedUniqueId, 'monId不明の旧スナップショットにもIDを付与');
assert.strictEqual(resolveInheritedUniqueLevel(unknown, unknown.inheritedUniques[0], 0), 4, 'monId不明でもLvを維持');

const roundTrip = JSON.parse(JSON.stringify(migratedMasu));
assert.deepStrictEqual(
  roundTrip.inheritedUniques.map((u, i) => [u.inheritedUniqueId, resolveInheritedUniqueLevel(roundTrip, u, i)]),
  migratedMasu.inheritedUniques.map((u, i) => [u.inheritedUniqueId, resolveInheritedUniqueLevel(migratedMasu, u, i)]),
  '保存・再読込相当でIDとLvを維持',
);
const migratedAgain = migrateInheritedUniqueLevelIds([migratedMasu], makeId);
assert.strictEqual(migratedAgain.changed, false, '2回目の移行では変更しない');
assert.strictEqual(JSON.stringify(migratedAgain.nextMasuMons), JSON.stringify([migratedMasu]), '2回移行しても完全に同じ');
const restoredBackup = migrateInheritedUniqueLevelIds([JSON.parse(JSON.stringify(legacy))], makeId).nextMasuMons[0];
assert.deepStrictEqual(restoredBackup.inheritedUniques.map((u, i) => resolveInheritedUniqueLevel(restoredBackup, u, i)), [5, 2], '旧バックアップを再移行できる');

const newlyInherited = appendInheritedUnique({ id:'new', inheritedUniques:[], uniqueSkillLevels:{own:3}, uniqueSkillPoints:8 }, skillA, 7, makeId);
const newUnique = newlyInherited.inheritedUniques[0];
assert(newUnique.inheritedUniqueId && Object.prototype.hasOwnProperty.call(newlyInherited.uniqueSkillLevels, inheritedUniqueLevelKey(newUnique)), '新規合体相当でIDと安定Lvキーを同時作成');
assert.strictEqual(resolveInheritedUniqueLevel(newlyInherited, newUnique, 0), 7, '新規継承の現在Lvを安定キーへ保存');
assert.strictEqual(newlyInherited.uniqueSkillLevels.own, 3, '新規継承でもownを維持');
assert.strictEqual(newlyInherited.uniqueSkillPoints, 8, '新規継承でも未使用ポイントを維持');

const latestResolved = api.resolveInheritedUniqueDefinition({ ...skillA, inheritedUniqueId:'keep-id', name:'旧名' });
assert.strictEqual(latestResolved.name, ALL_PLAYER_MONSTERS.Suezo.unique.name, '最新元種の技定義へ追従');
assert.strictEqual(latestResolved.inheritedUniqueId, 'keep-id', '最新定義追従でも個体IDを維持');

console.log('OK: 継承固有技Lvの安定ID移行・並び替え・削除シミュレーション・重複・総合力回帰を確認しました');
