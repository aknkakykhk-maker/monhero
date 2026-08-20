const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const api = require('../harness').loadDyeModule();
const { resolveInheritedUniqueDefinition, uniqueSkillAtLevel, ALL_PLAYER_MONSTERS } = api;
const source = fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');

const monId = Object.keys(ALL_PLAYER_MONSTERS).find(id => ALL_PLAYER_MONSTERS[id]?.unique);
assert(monId, '固有技を持つモンスターが必要');
const latest = ALL_PLAYER_MONSTERS[monId].unique;
const snapshot = {
  ...latest,
  monId,
  name: '旧スナップショット名',
  baseMult: Number(latest.baseMult) + 99,
  baseGuts: Number(latest.baseGuts) + 99,
  evoLevel: 4,
  sourceMasuName: '継承元',
};
const resolved = resolveInheritedUniqueDefinition(snapshot);
assert.strictEqual(resolved.name, latest.name, 'monIdから最新の固有技名を参照する');
assert.strictEqual(resolved.baseMult, latest.baseMult, 'monIdから最新の固有技性能を参照する');
assert.strictEqual(resolved.evoLevel, 4, '保存済みの継承固有技Lvを維持する');
assert.strictEqual(resolved.sourceMasuName, '継承元', '継承元の個体情報を維持する');

const legacy = { name:'旧技', baseMult:1.25, baseGuts:20, evoLevel:3 };
assert.strictEqual(resolveInheritedUniqueDefinition(legacy), legacy, 'monIdのない旧スナップショットへフォールバックする');
assert.strictEqual(uniqueSkillAtLevel(snapshot, 4).baseMult, latest.baseMult, '全利用経路の共通関数がresolverを通る');
assert(source.includes('ALL_PLAYER_MONSTERS[monId]?.unique'), '最新定義の参照元を固定する');
assert(source.includes('const definition = resolveInheritedUniqueDefinition(unique);'), '固有技の全利用経路を共通resolverへ接続する');

console.log('OK: 継承固有技の最新定義追従・旧スナップショットfallback・Lv維持・resolver共通化を確認しました');
