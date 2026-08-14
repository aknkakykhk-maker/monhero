const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  ALL_PLAYER_MONSTERS,
  resolveInheritedUniqueDefinition,
  uniqueSkillAtLevel,
  inheritedUniqueRunLevel,
  mergeMasuIntoMon,
  monsterPowerParts,
} = require('./harness').loadDyeModule();

const source = fs.readFileSync(path.join(__dirname, '../monster-hero/src/game-system.jsx'), 'utf8');
const monId = Object.keys(ALL_PLAYER_MONSTERS).find(id => ALL_PLAYER_MONSTERS[id]?.unique);
assert(monId, '固有技を持つ継承元が必要');
const original = ALL_PLAYER_MONSTERS[monId].unique;
const names = Array.from({ length:9 }, (_, level) => `最新固有技${level}`);
const latest = { ...original, name:'最新固有技', names, baseMult:9, baseGuts:45 };
const old0 = { ...original, monId, lineageId:'lineage-0', sourceMasuName:'継承元A', evoLevel:2, name:'旧固有技A', names:['旧名'], baseMult:1, baseGuts:3 };
const old1 = { ...original, monId, lineageId:'lineage-1', sourceMasuName:'継承元B', evoLevel:1, name:'旧固有技B', names:['旧名'], baseMult:2, baseGuts:4 };
const unknown = { name:'旧セーブ技', names:['旧セーブ技'], monId:'UNKNOWN_LEGACY_MON', lineageId:'legacy', sourceMasuName:'昔の個体', evoLevel:3, baseMult:2, baseGuts:10 };

try {
  ALL_PLAYER_MONSTERS[monId].unique = latest;
  const resolved = resolveInheritedUniqueDefinition(old0);
  assert.deepStrictEqual(
    { name:resolved.name, names:resolved.names, baseMult:resolved.baseMult, baseGuts:resolved.baseGuts },
    { name:latest.name, names:latest.names, baseMult:latest.baseMult, baseGuts:latest.baseGuts },
    '名称・倍率・消費は最新定義を使う',
  );
  assert.deepStrictEqual(
    { monId:resolved.monId, lineageId:resolved.lineageId, sourceMasuName:resolved.sourceMasuName, evoLevel:resolved.evoLevel },
    { monId, lineageId:'lineage-0', sourceMasuName:'継承元A', evoLevel:2 },
    '継承元と恒久Lvの履歴を維持する',
  );
  assert.strictEqual(resolveInheritedUniqueDefinition(unknown), unknown, '不明monIdは保存スナップショットへfallbackする');

  const masu = {
    id:'resolver-check', baseId:monId, name:'検査マスモン', statPoints:{},
    inheritedUniques:[old0, old1, unknown], uniqueSkillLevels:{ own:4, 'inh:0':5, 'inh:1':1, 'inh:2':3 },
  };
  const merged = mergeMasuIntoMon(masu);
  assert.strictEqual(merged.unique.name, names[4], '自前固有技も最新定義へ保存Lvを適用する');
  assert.deepStrictEqual(merged.inheritedUniques.map(u => u.name), [names[5], names[1], '旧セーブ技'], '配列順とinh:Nの対応を維持する');
  assert.strictEqual(merged.inheritedUniques[0].evoLevel, 5, 'uniqueSkillLevelsの恒久Lvを維持する');
  assert.strictEqual(uniqueSkillAtLevel(resolved, 5).mult, latest.baseMult + 2.5, '最新定義へ同じ恒久Lvを適用する');
  assert.strictEqual(inheritedUniqueRunLevel(merged.inheritedUniques[0], 6), 6, 'ラン中Lv強化を維持する');
  assert.strictEqual(masu.uniqueSkillLevels['inh:0'], 5, 'ラン中強化は恒久Lvを書き換えない');
  assert.deepStrictEqual(masu.inheritedUniques, [old0, old1, unknown], 'resolverは保存値を変更・並べ替えない');

  const beforeUniquePower = monsterPowerParts({ ...merged, inheritedUniques:merged.inheritedUniques.map((u, i) => ({ ...u, name:`旧${i}`, baseMult:1 })) }).unique;
  assert.strictEqual(monsterPowerParts(merged).unique, beforeUniquePower, '所持数とLvが同じなら総合力の固有技部分は変わらない');
  const newlyInherited = { ...uniqueSkillAtLevel(latest, 4), monId, lineageId:'new-lineage', sourceMasuName:'新規副' };
  ALL_PLAYER_MONSTERS[monId].unique = { ...latest, name:'合体後の最新名', names:Array(9).fill('合体後の最新名') };
  assert.strictEqual(resolveInheritedUniqueDefinition(newlyInherited).name, '合体後の最新名', '新規合体のスナップショットもresolverを使う');

  assert(source.includes('power: (() => { const p = monsterPowerOf(mergeMasuIntoMon(masu));'), '新規ランキングpowerは共通計算を使う');
  assert(source.includes('const shownPower = snapshotPower != null ? snapshotPower : monsterPowerOf(mon);'), '過去ランキングdetail.power表示を優先する');
  assert(!source.includes('savedUnique, ...current'), '最新定義を古いスナップショットで上書きしない');
} finally {
  ALL_PLAYER_MONSTERS[monId].unique = original;
}
console.log('OK: 継承固有技の最新定義追従・旧セーブfallback・Lv/順序/履歴/総合力/ランキング互換を確認しました');
