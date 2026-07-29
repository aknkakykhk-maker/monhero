#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const enemySource = fs.readFileSync('monster-hero/data/enemy-monsters.js', 'utf8');

const section = (from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert(start >= 0 && end > start, `section not found: ${from}`);
  return source.slice(start, end);
};

const difficulties = section('const DIFFICULTY_SETTINGS = {', '\n};').match(/^\s{2}[A-Za-z]+:/gm) || [];
assert.strictEqual(difficulties.length, 9, 'all existing difficulties must remain available');
assert(source.includes('[...new Set(ENEMY_SEQUENCE)]'), 'debug enemies must derive from the normal enemy sequence');
assert(source.includes('ENEMY_DATA[key]'), 'debug enemies must reuse existing enemy definitions');
assert(enemySource.includes('Durahan:') && enemySource.includes('Moo:'), 'Dullahan and Moo must remain valid enemy definitions');
assert(source.includes("enemy?.id === 'Durahan'"), 'Dullahan must use its dedicated BGM route');
assert(source.includes("hp <= 0 || gaveUp"), 'defeat and give-up must use the game-over BGM route');

const startDebug = section('const startDebugBattle = () => {', '\n  };');
assert(!/storeSet|submitRunScoreOnce|awardRunRewards|recordClearOnce/.test(startDebug), 'debug start must not persist or submit data');
assert(startDebug.includes('getActiveMonsterList()') && startDebug.includes('getActiveTeachingCards()'), 'debug party must reuse saved formations');
const defeatEffect = section('// Save score on game end', '\n\n\n  const cardLimit');
assert(defeatEffect.indexOf('debugBattleRef.current') < defeatEffect.indexOf('awardRunRewards'), 'debug defeat must branch before reward processing');
const giveUp = section('const handleGiveUp = useCallback', '\n\n  const handleRetry');
assert(giveUp.indexOf('debugBattleRef.current') < giveUp.indexOf('awardRunRewards'), 'debug give-up must branch before reward processing');
const nextWave = section('const handleNextWave = async () => {', '\n  };');
assert(nextWave.indexOf('debugBattleRef.current') < nextWave.indexOf('awardRunRewards'), 'debug victory must branch before reward processing');
assert(source.includes("debugBattleRef.current=false;setDebugBattle(false)"), 'normal battle entry must clear debug mode');
assert(source.includes("debugBattleRef.current = false;\n    debugResultRef.current = false;"), 'leaving a debug battle must clear synchronous flags');
assert(source.includes("debugBattle&&<span") && source.includes('>DEBUG</span>'), 'battle HUD must identify debug mode');
assert(source.includes('同じ条件でもう一度') && source.includes('デバッグ設定へ戻る') && source.includes('ヘルプへ戻る'), 'debug result actions must all be present');
assert(source.includes('>💊</button>'), 'hidden help entry must use the pill emoji');
console.log('OK: debug battle isolation, enemy reuse, BGM routes, navigation, and normal-mode reset');
