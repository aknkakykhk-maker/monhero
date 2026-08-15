// ブリーダーカード「メロソ」の定義・実処理・次ターン予約の流れを確認する。
//
//   node meloso-breeder-check.js
//
// 【このファイルの読み方】
// 前半は game-system.jsx / breeder.js の実コードに対する照合。
// 後半は「本体と同じ式を書き写したモデル」でカード使用→敵ターン→次ターンまでを通す。
// モデルは本体の計算式が変わると意味を失うため、書き写した式が実コードに残っているかを
// 必ず先に照合する(DRIFT GUARD)。ここが落ちたらモデル側を新しい式へ直すこと。
const fs = require('fs');
const assert = require('assert');
const breeder = fs.readFileSync('monster-hero/data/breeder.js', 'utf8');
const game = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const help = fs.readFileSync('monster-hero/data/help.js', 'utf8');

// ---- カード定義 ----
assert(breeder.includes(`meloso: ["メロソの解析", "メロソの予測", "メロソの最適解"]`));
assert(breeder.includes(`id:'meloso',  baseName:"メロソの解析"`));
assert(breeder.includes(`icon:MELOPANMAN_ICON`) && breeder.includes(`subType:'heal_guard_meloso'`));
const starter = breeder.match(/const STARTER_TEACHING_IDS = \[([^\n]+)\]/)[1];
assert(!starter.includes('meloso') && starter.split(',').length === 6);
assert(breeder.includes(`id:'meloso', name:"ブリーダーカード「メロソ」", type:'breeder', icon:MELOPANMAN_ICON, cost:1500`));

// ---- 実処理 ----
assert(game.includes(`effectiveMaxHp*0.3*effMul`) && game.includes(`effectiveMaxGuts*0.3*effMul`));
assert(game.includes(`currentTurnGuardFlat+=GUARD_EVOLUTION[guardLevel].flat*effMul`));
assert(game.includes(`level>=1 && usedCards.length>=2`) && game.includes(`setNextTurnBuff('takenDamageMult',1-0.5*effMul)`));
assert(game.includes(`level>=2 && usedCards.length>=3`) && game.includes(`setNextTurnBuff('melosoFullRecoveryMult',effMul)`));
assert(game.includes(`card?.subType === 'heal_guard_meloso'`) && game.includes(`cardEffectMultiplier(card,halved)`));
assert(game.includes(`getTurnBuff('takenDamageMult',1.0)`) && game.includes(`getNextTurnBuff('melosoFullRecoveryMult',0)`));
assert(game.includes(`prev.length >= STARTER_TEACHING_IDS.length`));
// ガッツは消費を先に反映してから回復する(ゲージが上がってから下がる見え方にしない)
const gutsCostAt = game.indexOf(`setGuts(p=>Math.max(0,p-getCardGuts(card)));`);
const melosoAt = game.indexOf(`if (card.id==='meloso')`);
assert(gutsCostAt > 0 && melosoAt > gutsCostAt, 'ガッツの消費より先にメロソの回復が走っている');
// 回復後のライフはローカル値で持ち回り、敵ターンへ引数で渡す(古いstateを読ませない)
assert(game.includes(`hpBeforeEnemyAttack=Math.min(effectiveMaxHp,hpBeforeEnemyAttack+cardHeal)`));
assert(/await handleEnemyTurn\([^)]*hpBeforeEnemyAttack\)/.test(game));

// ---- 次ターン予約の消費は「更新関数の外」で1回だけ行う ----
// Reactの更新関数はレンダーが中断・再実行されるともう一度呼ばれることがある。
// そこで回復すると二重に適用され、EXTREMEのLv3が50%回復のはずが100%回復になる。
assert(!/setNextTurnBuffs\(\s*[A-Za-z_$][\w$]*\s*=>/.test(game),
  'setNextTurnBuffs の更新関数の中で副作用を行っている(回復が二重に適用されうる)');
assert(game.includes(`const pendingNextTurnBuffs = nextTurnBuffsRef.current;`),
  '次ターン予約はrefから読むこと');
assert(game.includes(`writeNextTurnBuffs({});`), '消費後はrefとstateの両方を空にすること');
// stateとrefがずれないよう、書き込みは必ずwriteNextTurnBuffsを通す
const rawSetCalls = (game.match(/setNextTurnBuffs\(/g) || []).length;
assert.strictEqual(rawSetCalls, 1,
  `setNextTurnBuffs を直接呼んでいる箇所が${rawSetCalls}件ある(writeNextTurnBuffs の中だけにすること)`);

// ---- ヘルプ ----
// 数えているのは「使った枚数」であって成立判定ではない。実装と文言を食い違わせない
assert(help.includes('そのターンに使ったカードが合計2枚・3枚になったとき'));
assert(!help.includes('実際に使用成立したカードが合計2枚・3枚'));
// EXTREMEでは被ダメージ軽減も半分(50%減ではなく25%減)になることを明記する
assert(help.includes('50%減ではなく25%減'));
// 予約したターンにWAVEが終わると効果が消えることを明記する
assert(help.includes('次のWAVEへ持ち越されません'));

// ================= 本体と同じ式を書き写したモデル =================
// DRIFT GUARD: 下のモデルが写している式が実コードに残っているか先に確かめる。
// 丈夫さのバランス調整で式が変わると、モデルだけ古いまま通り続けてしまうため。
assert(game.includes(`const defenseRate = Math.min(0.5,effectiveDef*0.00015);`),
  '丈夫さの割合軽減の式が変わっている。モデル側も新しい式へ直すこと');
assert(game.includes(`Math.max(30,(atkVal-effectiveDef*0.5)*(1-defenseRate))`),
  '丈夫さの固定軽減と下限の式が変わっている。モデル側も新しい式へ直すこと');
assert(game.includes(`Math.max(1,Math.floor(dmgBase*Math.max(0.01,(1.0-getPermaBuff('dmgCutPct')))*iceLockEnemyDamageMult))`),
  '永続軽減の適用が変わっている。モデル側も新しい式へ直すこと');
assert(game.includes(`? Math.max(1,Math.floor(damage*getTurnBuff('takenDamageMult',1.0)))`),
  '次ターン被ダメージ軽減の適用が変わっている。モデル側も新しい式へ直すこと');
assert(game.includes(`applyTurnDamageReduction(Math.max(0,rawDmg-guardValueOf(previewGuardFlat,previewGuardMult)))`));
assert(game.includes(`const fd=applyTurnDamageReduction(Math.abs(diff))`));

// getIncomingDamageBeforeTurnReduction と同じ計算(丈夫さ→固定軽減→割合軽減→永続軽減)
const enemyDamageBeforeTurnReduction = ({ attack, defense, permanentReduction=0 }) => {
  const defenseRate = Math.min(0.5, defense*0.00015);
  const dmgBase = Math.max(30, (attack - defense*0.5) * (1 - defenseRate));
  return Math.max(1, Math.floor(dmgBase * Math.max(0.01, 1 - permanentReduction)));
};
// applyTurnDamageReduction と同じ計算
const applyTurnDamageReduction = (damage, multiplier=1) => damage>0
  ? Math.max(1,Math.floor(damage*multiplier)) : 0;

// 次ターン予約を今ターンへ引き継ぎ、Lv3回復を1回だけ適用して消費する
const startPlayerTurn = state => {
  const recovery=state.turnBuffs.melosoFullRecoveryMult||0;
  const {melosoFullRecoveryMult,...turnBuffs}=state.turnBuffs;
  return {...state,
    hp:Math.min(state.maxHp,state.hp+Math.floor(state.maxHp*recovery)),
    guts:Math.min(state.maxGuts,state.guts+Math.floor(state.maxGuts*recovery)),
    turnBuffs,
  };
};
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
// effMul はブリーダーカード効果倍率(EXTREMEなら0.5、それ以外は1)
const useMeloso = (state, { level, usedCardCount, guard=0, effMul=1 }) => ({
  ...state,
  hp:Math.min(state.maxHp,state.hp+Math.floor(state.maxHp*0.3*effMul)),
  guts:Math.min(state.maxGuts,state.guts+Math.floor(state.maxGuts*0.3*effMul)),
  immediateGuard:guard,
  nextTurnBuffs:{
    ...(level>=1&&usedCardCount>=2?{takenDamageMult:1-0.5*effMul}:{}),
    ...(level>=2&&usedCardCount>=3?{melosoFullRecoveryMult:effMul}:{}),
  },
});

const base={hp:40,guts:20,maxHp:100,maxGuts:100,attack:200,defense:100,permanentReduction:0.2,turnBuffs:{},nextTurnBuffs:{}};
// 丈夫さ100: 固定軽減50 → 150 → 割合1.5%減 → 147.75 → 永続20%減 → 118
assert.strictEqual(enemyDamageBeforeTurnReduction(base), 118);

// Lv1(予約なし): 30%回復とそのターンのガードだけ
const lv1=useMeloso(base,{level:0,usedCardCount:1,guard:25});
assert.deepStrictEqual([lv1.hp,lv1.guts,lv1.immediateGuard],[70,50,25]);
const lv1Enemy=advanceCombatTurn(lv1,{guard:lv1.immediateGuard});
assert.strictEqual(lv1Enemy.damage,93); // ガードなし118、ガード25を引いて93

// Lv2: 2枚に満たなければ予約しない
const lv2Miss=advanceCombatTurn(useMeloso(base,{level:1,usedCardCount:1}));
assert.strictEqual(lv2Miss.turnBuffs.takenDamageMult,undefined);
let lv2=advanceCombatTurn(useMeloso(base,{level:1,usedCardCount:2}));
assert.strictEqual(lv2.damage,118); // 予約したターンの敵攻撃にはまだ適用しない
lv2=advanceCombatTurn(lv2);
assert.strictEqual(lv2.damage,59);  // 防御・永続軽減後の118を50%軽減
lv2=advanceCombatTurn(lv2);
assert.strictEqual(lv2.damage,118); // 消費後は元へ戻る
// ガードが上回れば軽減の前に0まで落ちる
const guardedLv2=advanceCombatTurn({...base,turnBuffs:{takenDamageMult:0.5}},{guard:130});
assert.strictEqual(guardedLv2.damage,0);

// Lv3: 3枚で被ダメ軽減と次ターン回復の両方が成立する
const lv3Reserved=useMeloso(base,{level:2,usedCardCount:3});
assert.strictEqual(lv3Reserved.nextTurnBuffs.takenDamageMult,0.5);
assert.strictEqual(lv3Reserved.nextTurnBuffs.melosoFullRecoveryMult,1);
let lv3=advanceCombatTurn(lv3Reserved);
lv3=startPlayerTurn(lv3);
assert.deepStrictEqual([lv3.hp,lv3.guts,lv3.turnBuffs.melosoFullRecoveryMult],[100,100,undefined]);
assert.strictEqual(lv3.turnBuffs.takenDamageMult,0.5); // 軽減はこのターン有効なまま残る
lv3=startPlayerTurn({...lv3,hp:60,guts:70});
assert.deepStrictEqual([lv3.hp,lv3.guts],[60,70]); // 全回復は1回だけ

// EXTREME(ブリーダーカード効果倍率0.5): 回復・軽減・予約のすべてが半分になる
const ex=useMeloso({...base,hp:20,guts:20},{level:2,usedCardCount:3,guard:0,effMul:0.5});
assert.deepStrictEqual([ex.hp,ex.guts],[35,35]); // 30%ではなく15%回復
assert.strictEqual(ex.nextTurnBuffs.takenDamageMult,0.75); // 50%減ではなく25%減
assert.strictEqual(ex.nextTurnBuffs.melosoFullRecoveryMult,0.5);
let exTurn=advanceCombatTurn(ex);
assert.strictEqual(exTurn.damage,118);
const exAfter=startPlayerTurn(exTurn);
// 予約したターンの敵攻撃で118受けているので 35-118 → 0、そこへ最大値の50%が入る
assert.deepStrictEqual([exAfter.hp,exAfter.guts],[50,85]);
exTurn=advanceCombatTurn(exAfter);
assert.strictEqual(exTurn.damage,88); // 118の25%減

// 回復量は「不足分の割合」ではなく「最大値の割合」を現在値へ加える
assert(game.includes(`p+Math.floor(effectiveMaxHp*recoveryMult)`));
assert(game.includes(`p+Math.floor(effectiveMaxGuts*recoveryMult)`));
assert(!game.includes(`(effectiveMaxHp-p)*recoveryMult`) && !game.includes(`(effectiveMaxGuts-p)*recoveryMult`));
for (const [before, after] of [[20,70],[50,100],[80,100]]) {
  const r = startPlayerTurn({...base,hp:before,guts:before,turnBuffs:{melosoFullRecoveryMult:0.5}});
  assert.strictEqual(r.hp, after);
  assert.strictEqual(r.guts, after);
}

console.log('meloso breeder check: OK');
