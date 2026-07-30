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

assert(source.includes('const newEnemy=createBattleEnemy(w,difficulty,forcedEnemyKey)'), 'battle must use shared enemy creation');
assert(source.includes('createBattleEnemy(1,key)'), 'WAVE 1 preview must use shared enemy creation');
assert(source.includes('createBattleEnemy(index+1,safeDifficulty)'), 'all-wave preview must use shared enemy creation');
assert(source.includes('const ENEMY_ART_SCALE = { Moo: 2 }'), 'Moo scale must have one shared definition');
assert.strictEqual((source.match(/enemyArtStyle\(enemy\.id\)/g) || []).length, 2, 'scan and all-wave view must reuse shared art style');
assert(!source.includes("clamp(252px,70vw,280px)"), 'scan-only Moo sizing must be removed');

console.log('OK: difficulty powers, WAVE 1/10 calculations, shared battle generation, and shared Moo art scale');
