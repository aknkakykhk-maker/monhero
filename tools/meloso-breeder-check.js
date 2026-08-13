const fs = require('fs');
const assert = require('assert');
const breeder = fs.readFileSync('monster-hero/data/breeder.js', 'utf8');
const game = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
assert(breeder.includes(`meloso: ["メロソの解析", "メロソの予測", "メロソの最適解"]`));
assert(breeder.includes(`id:'meloso',  baseName:"メロソの解析"`));
assert(breeder.includes(`icon:MELOPANMAN_ICON`) && breeder.includes(`subType:'heal_guard_meloso'`));
const starter = breeder.match(/const STARTER_TEACHING_IDS = \[([^\n]+)\]/)[1];
assert(!starter.includes('meloso') && starter.split(',').length === 6);
assert(breeder.includes(`id:'meloso', name:"ブリーダーカード「メロソ」", type:'breeder', icon:MELOPANMAN_ICON, cost:1500`));
assert(game.includes(`effectiveMaxHp*0.3*effMul`) && game.includes(`effectiveMaxGuts*0.3*effMul`));
assert(game.includes(`currentTurnGuardFlat+=GUARD_EVOLUTION[guardLevel].flat*effMul`));
assert(game.includes(`level>=1 && usedCards.length>=2`) && game.includes(`setNextTurnBuff('takenDamageMult',1-0.5*effMul)`));
assert(game.includes(`level>=2 && usedCards.length>=3`) && game.includes(`setNextTurnBuff('melosoFullRecoveryMult',effMul)`));
assert(game.includes(`card?.subType === 'heal_guard_meloso'`) && game.includes(`cardEffectMultiplier(card,halved)`));
assert(game.includes(`getTurnBuff('takenDamageMult',1.0)`) && game.includes(`getNextTurnBuff('melosoFullRecoveryMult',0)`));
assert(game.includes(`prev.length >= STARTER_TEACHING_IDS.length`));

// 本番と同じ予約値・state updaterの流れで、3枚条件から次ターン開始時の実値まで確認する。
const applyNextPlayerTurn = ({ hp, guts, maxHp, maxGuts, nextTurnBuffs }) => {
  let turnBuffs = null;
  const recoveryMult = nextTurnBuffs.melosoFullRecoveryMult || 0;
  if (recoveryMult > 0) {
    hp = Math.min(maxHp, hp + Math.floor(maxHp * recoveryMult));
    guts = Math.min(maxGuts, guts + Math.floor(maxGuts * recoveryMult));
  }
  const { melosoFullRecoveryMult, ...activeTurnBuffs } = nextTurnBuffs;
  turnBuffs = activeTurnBuffs;
  nextTurnBuffs = {};
  return { hp, guts, turnBuffs, nextTurnBuffs };
};
const playMelosoTurn = ({ level, usedCardCount, effectMultiplier, hp, guts }) => {
  const nextTurnBuffs = {};
  if (level >= 2 && usedCardCount >= 3) nextTurnBuffs.melosoFullRecoveryMult = effectMultiplier;
  return applyNextPlayerTurn({ hp, guts, maxHp:100, maxGuts:100, nextTurnBuffs });
};

assert.deepStrictEqual(playMelosoTurn({level:2,usedCardCount:3,effectMultiplier:1,hp:20,guts:20}), {
  hp:100, guts:100, turnBuffs:{}, nextTurnBuffs:{},
});
for (const [before, after] of [[20,70],[50,100],[80,100]]) {
  const result = playMelosoTurn({level:2,usedCardCount:3,effectMultiplier:0.5,hp:before,guts:before});
  assert.strictEqual(result.hp, after);
  assert.strictEqual(result.guts, after);
}
assert.deepStrictEqual(playMelosoTurn({level:2,usedCardCount:2,effectMultiplier:0.5,hp:20,guts:20}), {
  hp:20, guts:20, turnBuffs:{}, nextTurnBuffs:{},
});
assert(game.includes(`p+Math.floor(effectiveMaxHp*recoveryMult)`));
assert(game.includes(`p+Math.floor(effectiveMaxGuts*recoveryMult)`));
assert(!game.includes(`(effectiveMaxHp-p)*recoveryMult`) && !game.includes(`(effectiveMaxGuts-p)*recoveryMult`));
console.log('meloso breeder check: OK');
