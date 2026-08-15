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

// ==========================================================================
// おりょう・ゴーレム・モッチー/ミタラシ・ききは「使ったターンからすぐ効く」設計だが、
// カード選択中の予測(合計DMG)は以前この4枚の同ターン即時ぶんを一切見ていなかった。
// 実行(processTurn)は先に使ったバフカードの効果を後続の攻撃へ正しく乗せるのに、
// 予測はカードを選ぶたびその場のpermaBuffsしか読まないため、
// 「バフカードを攻撃カードより先に使ったときだけ、実行後の数字が予測より増える」不具合があった。
//
// これを直した localBoostFromCard / previewLocalBoosts が、実処理(processTurn)と
// 同じ並び順・同じ半減規則で値を作れているかを、実際に式を書き写して検算する。
// ==========================================================================

assert(source.includes('const localBoostFromCard = (card) => {'), '同ターン即時ボーナスの共通定義が必要');
assert(source.includes('const previewLocalBoosts = (excludeIdx=null) => {'), 'カード選択中のプレビュー用スキャンが必要');

// DRIFT GUARD: 下のモデルが書き写している式が実コードに残っているか先に確かめる。
// 効果量を調整したときは、このファイルの期待値も一緒に直すこと。
assert(source.includes("if (card.subType==='atk_buff') return { oryo: card.baseValue };"),
  'おりょうの力の値の出どころが変わっている。モデル側も直すこと');
assert(source.includes("if (card.type==='unique' && card.monId==='Golem') return { oryo: 0.075 };"),
  'ゴーレムの与ダメージ増加(0.075)が変わっている。モデル側も直すこと');
assert(source.includes("if (card.type==='unique' && (card.monId==='Mocchi'||card.monId==='Mitarashi')) return { dmgMod: 0.1 };"),
  'モッチー/ミタラシの敵被ダメ増加(0.1)が変わっている。モデル側も直すこと');
assert(/return \{ combo: 0\.03\+level\*0\.02 \};/.test(source),
  'ききの応援の全体連撃(0.03+Lv*0.02)が変わっている。モデル側も直すこと');

// processTurn側が数字を直接持たず、共通定義(localBoostFromCard)を参照していること。
// ここが切れると、2つの値がバラバラに調整されて再びずれる
assert(source.includes("const boost=localBoostFromCard(card).oryo*effMul; addPermaBuff('atkPct',boost); localOryoAdd+=boost;"),
  'おりょうの力がlocalBoostFromCardを参照していない');
assert(source.includes("const comboAdd=localBoostFromCard(card).combo*effMul;"),
  'ききの応援がlocalBoostFromCardを参照していない');
assert(source.includes("const boost=localBoostFromCard(card).dmgMod*effMul; addWaveBuff('enemyTakenDmgBonus',boost); localDmgModAdd+=boost;"),
  'モッチー/ミタラシの固有技がlocalBoostFromCardを参照していない');
assert(source.includes("const boost=localBoostFromCard(card).oryo*effMul; addPermaBuff('atkPct',boost); localOryoAdd+=boost; addPopup('闘志UP!'"),
  'ゴーレムの固有技がlocalBoostFromCardを参照していない');

// 4箇所すべてのプレビューが、もうgetDmg(...,0,0,...)を固定で渡していないこと
// (直っていない箇所が1つでも残っていると、そこだけ古いズレが再発する)
const zeroZeroCalls = (source.match(/getDmg\([^)]*,0,0,/g) || []).length;
assert.strictEqual(zeroZeroCalls, 0,
  `getDmg へ additionalOryo/additionalDmgMod を 0,0 で固定している箇所が${zeroZeroCalls}件残っている`);

// ==========================================================================
// 実際に式を書き写して、実行(processTurn)と予測(previewLocalBoosts)が
// 同じ並び順で同じ結果を出すことを検算する
// ==========================================================================
const cardEffectMultiplier = (card, halved, breederEffMul=1) =>
  card.isBreeder ? breederEffMul : (halved ? 0.5 : 1);

const localBoostFromCard = (card) => {
  if (card.subType==='atk_buff') return { oryo: 0.1 }; // おりょうの力Lv0相当
  if (card.subType==='buff_kiki') return { combo: 0.03 }; // ききの応援Lv0相当
  if (card.type==='unique' && card.monId==='Golem') return { oryo: 0.075 };
  if (card.type==='unique' && (card.monId==='Mocchi'||card.monId==='Mitarashi')) return { dmgMod: 0.1 };
  return null;
};

// processTurnと同じ「並び順どおりに1回だけ回す」実行モデル。
// 攻撃カードの最終ダメージは baseAtk*(1+dmgModがそのターン加算されたぶん)*(1+oryoがそのターン加算されたぶん) とし、
// comboは別ヒットとして加算する簡略モデル(本物と同じ4値の受け渡し方だけを見る)
const runProcessTurnOrder = (orderedCards, baseAtk=100) => {
  let oryo=0, dmgMod=0, combo=0, penaltyCnt=0, totalDmg=0;
  const perCardDmg=[];
  for (const card of orderedCards) {
    const isPenalty=!card.isBreeder;
    const halved=isPenalty&&penaltyCnt>0;
    const effMul=cardEffectMultiplier(card,halved);
    if (card.isAttack) {
      const dmg=Math.floor(baseAtk*(1+oryo)*(1+dmgMod));
      const comboHit=Math.floor(dmg*combo);
      totalDmg+=dmg+comboHit;
      perCardDmg.push(dmg+comboHit);
    }
    const boost=localBoostFromCard(card);
    if (boost) { oryo+=(boost.oryo||0)*effMul; dmgMod+=(boost.dmgMod||0)*effMul; combo+=(boost.combo||0)*effMul; }
    if (isPenalty) penaltyCnt++;
  }
  return { totalDmg, perCardDmg };
};

// previewLocalBoostsと同じ「そのカードの手前までを積む」スキャン。
// getDmg/getAttackPredictedDmgへ渡す値を作る側を模す
const runPreviewOrder = (orderedCards, baseAtk=100) => {
  let oryo=0, dmgMod=0, combo=0, penaltyCnt=0, totalDmg=0;
  const perCardDmg=[];
  for (const card of orderedCards) {
    const isPenalty=!card.isBreeder;
    const halved=isPenalty&&penaltyCnt>0;
    const effMul=cardEffectMultiplier(card,halved);
    if (card.isAttack) {
      // ここが今回の修正点: 0,0固定ではなく、その時点までの累計(oryo/dmgMod/combo)を渡す
      const dmg=Math.floor(baseAtk*(1+oryo)*(1+dmgMod));
      const comboHit=Math.floor(dmg*combo);
      totalDmg+=dmg+comboHit;
      perCardDmg.push(dmg+comboHit);
    }
    const boost=localBoostFromCard(card);
    if (boost) { oryo+=(boost.oryo||0)*effMul; dmgMod+=(boost.dmgMod||0)*effMul; combo+=(boost.combo||0)*effMul; }
    if (isPenalty) penaltyCnt++;
  }
  return { totalDmg, perCardDmg };
};

const golem = { type:'unique', monId:'Golem', isBreeder:false, isAttack:true };
const mocchi = { type:'unique', monId:'Mocchi', isBreeder:false, isAttack:true };
const kiki = { subType:'buff_kiki', isBreeder:true, isAttack:false };
const oryo = { subType:'atk_buff', isBreeder:true, isAttack:false };
const attack = { type:'atk', isBreeder:false, isAttack:true };

// ケース1: バフカードを攻撃より先に使う → 修正前は予測が実行結果より少なかった
for (const [label, order] of [
  ['ゴーレム→攻撃', [golem, attack]],
  ['きき→攻撃', [kiki, attack]],
  ['モッチー→攻撃', [mocchi, attack]],
  ['おりょう→攻撃', [oryo, attack]],
  ['きき→ゴーレム→攻撃', [kiki, golem, attack]],
]) {
  const actual=runProcessTurnOrder(order);
  const predicted=runPreviewOrder(order);
  assert.deepStrictEqual(predicted, actual,
    `${label}: 予測と実行がずれている(予測=${JSON.stringify(predicted)} / 実行=${JSON.stringify(actual)})`);
}

// ケース2: バフカードを攻撃より後に使う → その回の攻撃には乗らない(予測・実行とも変化なし)
for (const [label, order] of [
  ['攻撃→ゴーレム', [attack, golem]],
  ['攻撃→きき', [attack, kiki]],
]) {
  const actual=runProcessTurnOrder(order);
  const predicted=runPreviewOrder(order);
  assert.deepStrictEqual(predicted, actual, `${label}: 予測と実行がずれている`);
  assert.strictEqual(actual.perCardDmg[0], 100, `${label}: 先に使った攻撃にバフが乗ってしまっている`);
}

// ケース3: 2枚目以降の半減もバフの量に正しく反映されること(ゴーレムが2枚目なら半分の効果)
{
  const filler = { type:'atk', isBreeder:false, isAttack:false }; // 攻撃はしないがpenaltyCntだけ進める枠
  const order=[filler, golem, attack];
  const actual=runProcessTurnOrder(order);
  const predicted=runPreviewOrder(order);
  assert.deepStrictEqual(predicted, actual, '2枚目以降半減時: 予測と実行がずれている');
  // filler(1枚目、非ブリーダー) → 何もしない。golem(2枚目、非ブリーダーなので半減) →
  // 自分自身は未強化の100のまま(perCardDmg[0])、oryo += 0.075*0.5 = 0.0375 が積み上がる。
  // attack(3枚目、golemの後)がそのぶんを受け取る(perCardDmg[1])
  assert.strictEqual(actual.perCardDmg[0], 100, '2枚目以降半減時: ゴーレム自身に自分の効果が乗ってしまっている');
  assert.strictEqual(actual.perCardDmg[1], Math.floor(100*1.0375), '2枚目以降半減時: ゴーレムの効果が半分になっていない');
}

console.log('battle damage preview checks passed');
