#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const enemies = fs.readFileSync('monster-hero/data/enemy-monsters.js', 'utf8');
const difficultyBlock = source.slice(source.indexOf('const DIFFICULTY_SETTINGS = {'), source.indexOf('\n};', source.indexOf('const DIFFICULTY_SETTINGS = {')));
const expectedPower = { Beginner:0.25, Easy:0.5, Normal:1, Hard:1.5, Expert:3, Master:5, GrandMaster:6.5, Hell:8, Legend:10 };

for (const [key, power] of Object.entries(expectedPower)) {
  const match = difficultyBlock.match(new RegExp(`\\b${key}:\\s*\\{[^\\n]*?power:\\s*([0-9.]+)`));
  assert(match, `${key} power setting`);
  assert.strictEqual(Number(match[1]), power, `${key} power`);
}

const enemyStats = Object.fromEntries([...enemies.matchAll(/(\w+):\s*\{[^\n]*?baseHp:(\d+),\s*baseAtk:(\d+)/g)]
  .map(([, key, hp, atk]) => [key, { hp:Number(hp), atk:Number(atk) }]));
for (const difficulty of ['GrandMaster', 'Hell', 'Legend']) {
  const power = expectedPower[difficulty];
  for (const enemyKey of ['Dino', 'Moo']) {
    const base = enemyStats[enemyKey];
    assert(base, `${enemyKey} base stats`);
    assert.strictEqual(Math.floor(base.hp * power), base.hp * power, `${difficulty} ${enemyKey} HP floor result`);
    assert.strictEqual(Math.floor(base.atk * power), base.atk * power, `${difficulty} ${enemyKey} attack floor result`);
  }
}

assert(source.includes('const newEnemy=createBattleEnemy(w,difficulty,forcedEnemyKey,debugExtremeRef.current?EXTREME_DEBUG_SETTING.power:null)'), 'battle must use shared enemy creation and only override power for EXTREME');
const enemyFactoryBlock = source.slice(source.indexOf('const createBattleEnemy ='), source.indexOf('\n};', source.indexOf('const createBattleEnemy =')) + 3);
const createBattleEnemy = Function(
  'ENEMY_SEQUENCE', 'ENEMY_DATA', 'normalizeBattleDifficulty', 'DIFFICULTY_SETTINGS',
  `${enemyFactoryBlock}; return createBattleEnemy;`
)(['Dino'], { Dino:{ name:'Dino', baseHp:100, baseAtk:20 } }, difficulty => difficulty, Object.fromEntries(
  Object.entries(expectedPower).map(([difficulty, power]) => [difficulty, { power }])
));
for (const [difficulty, power] of Object.entries(expectedPower)) {
  for (const powerOverride of [null, undefined]) {
    const enemy = createBattleEnemy(1, difficulty, null, powerOverride);
    assert.strictEqual(enemy.maxHp, Math.floor(100 * power), `${difficulty} ${powerOverride} override HP`);
    assert.strictEqual(enemy.atk, Math.floor(20 * power), `${difficulty} ${powerOverride} override attack`);
    assert(enemy.maxHp > 0 && enemy.atk > 0, `${difficulty} normal enemy stats must be positive`);
  }
}
const extremeEnemy = createBattleEnemy(1, 'Normal', null, 13);
assert.strictEqual(extremeEnemy.maxHp, 1300, 'EXTREME HP must use power override 13');
assert.strictEqual(extremeEnemy.atk, 260, 'EXTREME attack must use power override 13');
// 難易度カードのWAVE1プレビューは廃止し、敵の情報は「全WAVE詳細」だけで見せる
assert(!source.includes('createBattleEnemy(1,key)'), '難易度カードにWAVE1の敵情報を戻していないこと');
assert(source.includes('createBattleEnemy(index+1,safeDifficulty)'), '全WAVE詳細が共通の敵生成を使う');
assert(source.includes('createBattleEnemy(index+1,safeDifficulty)'), 'all-wave preview must use shared enemy creation');
assert(source.includes("Moo: { scanScale:2.75, waveDetailScale:2"), 'Moo must have context-specific scan and wave scales');
assert(source.includes("enemyArtStyle(scanEnemy.id,'scan')"), 'scan must request scan art context');
assert(source.includes("enemyArtStyle(enemy.id,'waveDetail')"), 'wave detail must request its own art context');
assert(source.includes("w-[min(92vw,380px)]"), 'Moo scan container must be responsive');

console.log('OK: difficulty powers, nullish override fallback, EXTREME x13, shared battle generation, and context-specific Moo art layout');
