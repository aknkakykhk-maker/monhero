const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');

assert(source.includes('const getAttackPredictedDmg = useCallback'), '攻撃1枚の共通予測関数が必要');
assert(source.includes("mainHero?.id==='Zan' && mon?.id==='Zan'"), 'ザン勇者特性の連撃を予測する');
assert(source.includes("card.type==='unique' && card.monId==='Zan'"), '連斬の連撃を予測する');
assert(source.includes("card.monId==='Ark'||card.monId==='Iblis'"), '贖罪の追撃を予測する');
assert((source.match(/getAttackPredictedDmg\(/g)||[]).length >= 4, '合計と個別表示が共通予測関数を使う');
assert(source.includes('const plannedDmg=applyTurnDamageReduction(Math.max(0,rawDmg-guardValueOf'), '敵の予定ダメージへガードとターン軽減を実処理と同じ順で反映する');
assert(source.includes('(予定: ${plannedDmg})'), '敵予告は軽減後の予定値を表示する');
console.log('battle damage preview checks passed');
