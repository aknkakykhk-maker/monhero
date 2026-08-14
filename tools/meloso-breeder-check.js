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

// カード使用から敵ターン、次プレイヤーターン、効果消費後までを通す実戦相当モデル。
// 被ダメ軽減は防御・永続軽減・ガードの後に適用し、予約ターンだけ有効にする。
const enemyDamageBeforeTurnReduction = ({ attack, defense, permanentReduction=0 }) =>
  Math.max(1, Math.floor(Math.max(30, attack-defense*0.15)*(1-permanentReduction)));
const applyTurnDamageReduction = (damage, multiplier=1) => damage>0
  ? Math.max(1,Math.floor(damage*multiplier)) : 0;
const advanceCombatTurn = (state, { guard=0 }={}) => {
  const beforeReduction=enemyDamageBeforeTurnReduction(state);
  const damage=applyTurnDamageReduction(Math.max(0,beforeReduction-guard),state.turnBuffs.takenDamageMult||1);
  return {
    ...state,
    hp:Math.max(0,state.hp-damage),
    damage,
    turnBuffs:{...state.nextTurnBuffs},
    nextTurnBuffs:{},
  };
};
const useMeloso = (state, { level, usedCardCount, guard=0 }) => ({
  ...state,
  hp:Math.min(state.maxHp,state.hp+Math.floor(state.maxHp*0.3)),
  guts:Math.min(state.maxGuts,state.guts+Math.floor(state.maxGuts*0.3)),
  immediateGuard:guard,
  nextTurnBuffs:{
    ...(level>=1&&usedCardCount>=2?{takenDamageMult:0.5}:{}),
    ...(level>=2&&usedCardCount>=3?{melosoFullRecoveryMult:1}:{}),
  },
});
const startPlayerTurn = state => {
  const recovery=state.turnBuffs.melosoFullRecoveryMult||0;
  const {melosoFullRecoveryMult,...turnBuffs}=state.turnBuffs;
  return {...state,
    hp:Math.min(state.maxHp,state.hp+Math.floor(state.maxHp*recovery)),
    guts:Math.min(state.maxGuts,state.guts+Math.floor(state.maxGuts*recovery)),
    turnBuffs,
  };
};
const base={hp:40,guts:20,maxHp:100,maxGuts:100,attack:200,defense:100,permanentReduction:0.2,turnBuffs:{},nextTurnBuffs:{}};
const lv1=useMeloso(base,{level:0,usedCardCount:1,guard:25});
assert.deepStrictEqual([lv1.hp,lv1.guts,lv1.immediateGuard],[70,50,25]);
const lv1Enemy=advanceCombatTurn(lv1,{guard:lv1.immediateGuard});
assert.strictEqual(lv1Enemy.damage,123); // ガードなし148、ガード25を既存最終軽減の前に適用
const lv2Miss=advanceCombatTurn(useMeloso(base,{level:1,usedCardCount:1}));
assert.strictEqual(lv2Miss.turnBuffs.takenDamageMult,undefined);
let lv2=advanceCombatTurn(useMeloso(base,{level:1,usedCardCount:2}));
assert.strictEqual(lv2.damage,148); // 予約したターンの敵攻撃にはまだ適用しない
lv2=advanceCombatTurn(lv2);
assert.strictEqual(lv2.damage,74); // 防御・永続軽減後の148を50%軽減
lv2=advanceCombatTurn(lv2);
assert.strictEqual(lv2.damage,148); // 消費後は元へ戻る
const guardedLv2=advanceCombatTurn({...base,turnBuffs:{takenDamageMult:0.5}},{guard:40});
assert.strictEqual(guardedLv2.damage,54); // (148-40)×50%。攻撃力半減ではない
let lv3=advanceCombatTurn(useMeloso(base,{level:2,usedCardCount:3}));
lv3=startPlayerTurn(lv3);
assert.deepStrictEqual([lv3.hp,lv3.guts,lv3.turnBuffs.melosoFullRecoveryMult],[100,100,undefined]);
lv3=startPlayerTurn({...lv3,hp:60,guts:70});
assert.deepStrictEqual([lv3.hp,lv3.guts],[60,70]); // 全回復は1回だけ
assert(game.includes(`applyTurnDamageReduction(Math.max(0,rawDmg-guardValueOf(previewGuardFlat,previewGuardMult)))`));
assert(game.includes(`const fd=applyTurnDamageReduction(Math.abs(diff))`));
console.log('meloso breeder check: OK');
