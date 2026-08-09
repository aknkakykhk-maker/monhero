#!/usr/bin/env node
const fs = require('fs');
const ally = fs.readFileSync('monster-hero/data/ally-monsters.js', 'utf8');
const breeder = fs.readFileSync('monster-hero/data/breeder.js', 'utf8');
const game = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const help = fs.readFileSync('monster-hero/data/help.js', 'utf8');
const checks = [
  ['基礎能力・適性・合流値', /Snegurochka:[\s\S]*?baseHp:400, baseGuts:150, baseAtk:135, baseDef:80[\s\S]*?plusStats:\{hp:150,atk:40,def:10,guts:40\}[\s\S]*?distAptitude:\['D','E','B','A'\]/.test(ally)],
  ['通常技9段階', /Snegurochka: \["アイスブレード"[\s\S]*?"ジングルベル"\]/.test(ally)],
  ['固有技9段階・倍率・消費', /name:"アイスアロー"[\s\S]*?baseMult:2\.2,baseGuts:44[\s\S]*?"メリークリスマス"/.test(ally)],
  ['マーケット1500ダイヤ', /id:'Snegurochka'[\s\S]*?type:'disc'[\s\S]*?cost:1500/.test(breeder)],
  ['移動封印はMOVEを失敗し行動済みを維持', /intent\.type==='MOVE' && \(getWaveBuff\('iceLockTurns'\)>0\|\|immediateEffects\.iceLockActive\)[\s\S]*?移動できない！/.test(game)],
  ['封印は5ターンから減算しWAVEでリセット', /iceLockTurns:5/.test(game) && /iceLockTurns:immediateEffects\.iceLockActive\?4/.test(game) && /setWaveBuffs\(\{\}\)/.test(game)],
  ['消費ガッツ3%累積・安全な下限', /Math\.max\(0\.1, 1 - 0\.03\*getPermaBuff\('snegurochkaGutsDiscountStacks'\)\)/.test(game)],
  ['勇者限定AND条件・既存距離倍率と別乗算', /mainHero\?\.id==='Snegurochka'[\s\S]*?getWaveBuff\('iceLockTurns'\)>0\|\|activatesIceLock[\s\S]*?slotIdx===attackStartDist \? 1\.5 : 1\.0[\s\S]*?\*iceRulerMult/.test(game)],
  ['専用水攻撃モーション', /atkMotion:'waterBurst'/.test(ally) && /@keyframes waterBurstAttack/.test(game) && /@keyframes waterBurstLunge/.test(game)],
  ['ヘルプに特性・固有効果', help.includes('勇者特性「氷海の支配者」') && help.includes('スネグーラチカ「絶氷の楔」')],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'OK' : 'NG'}: ${name}`);
if (failed.length) process.exit(1);
