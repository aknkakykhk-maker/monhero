const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
for(const token of ["role:index===heroSlotIndex?'hero':'ally'",'masuId:s.masuId||null','const splitRankingParty','member?.role===\'hero\'','entry?.heroMasuId','供モンなし','供モン:','allies.slice(0,3)','編成情報なし'])assert(src.includes(token),token);
assert(!src.includes('パーティ:</span>{party.slice(0,3)'));
console.log('OK: role保存、旧記録互換、個体ID優先、供モン0〜3体、勇者重複防止を確認');
