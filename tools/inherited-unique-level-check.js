const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { inheritedUniqueRunLevel, uniqueSkillAtLevel, MAX_UNIQUE_SKILL_LEVEL } = require('./harness').loadDyeModule();

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

assert(source.includes('const cur=inheritedUniqueRunLevel(resolveInheritedUniqueDefinition(slots[slotIdx]?.inheritedUniques?.[inhIdx]), inheritedUniqueEvo[key]);'), '強化処理が最新定義を解決して恒久Lvへフォールバックする');
assert(source.includes('if(diff>0&&(upgradePoints<=0||cur>=8)) return;'), 'Lv.8ではポイントを消費しない');
assert(source.includes('evoLevel:inheritedUniqueRunLevel(iu, slotIdx!=null ? evoMap[inhEvoKey(slotIdx,ii)] : null)'), '表示・固有技切替・buildDeckが共通Lv解決を使う');
assert(source.includes("mh_inherited_unique_level_compensation_pending_v1"), '補填の再開用pendingを保存する');
assert(source.includes("mh_inherited_unique_level_compensation_v1"), '補填済み専用フラグを保存する');
assert(!/setMasuMons\([^)]*inheritedUniqueEvo/.test(source), 'ラン内Lvをマスモンへ恒久保存しない');

console.log('OK: 継承固有技の恒久Lv反映・ラン内強化・Lv上限・補填の一度きり保存を確認しました');
