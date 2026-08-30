const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');

assert(source.includes('const getAttackPredictedDmg = useCallback'), '攻撃1枚の共通予測関数が必要');
assert(source.includes("mainHero?.id==='Zan' && mon?.id==='Zan'"), 'ザン勇者特性の連撃を予測する');
assert(source.includes("card.type==='unique' && card.monId==='Zan'"), '連斬の連撃を予測する');
assert(source.includes("mainHero?.id==='Eiki' && mon?.id==='Eiki'"), 'エイキ勇者特性の連撃を予測する');
assert(source.includes("card.type==='unique' && card.monId==='Eiki'"), 'エイキ固有技の連撃を予測する');
assert(source.includes("const pandoraSplitNormal=mainHero?.id==='Pandora' && mon?.id==='Pandora' && ['atk','range_atk'].includes(card.type)"), 'パンドラ勇者の通常攻撃分割を予測する');
assert(source.includes('const mainBaseDmg=pandoraSplitNormal?Math.floor(baseDmg*0.5):baseDmg;'), 'パンドラ通常攻撃の1ヒット目を分割前ダメージの50%にする');
assert(source.includes('if (pandoraSplitNormal) total += extraHit(0.5+comboDmgBonus)'), 'パンドラ通常攻撃の連撃を分割前ダメージ基準で予測する');
assert(source.includes("card.monId==='Ark'||card.monId==='Iblis'"), '贖罪の追撃を予測する');
assert((source.match(/getAttackPredictedDmg\(/g)||[]).length >= 4, '合計と個別表示が共通予測関数を使う');
assert(source.includes('const plannedDmg=applyTurnDamageReduction(Math.max(0,rawDmg-guardValueOf'), '敵の予定ダメージへガードとターン軽減を実処理と同じ順で反映する');
assert(source.includes('(予定: ${plannedDmg})'), '敵予告は軽減後の予定値を表示する');

const pandoraPredictedDmg=(baseDmg,comboDmgBonus=0)=>
  Math.floor(baseDmg*0.5)+Math.floor(baseDmg*(0.5+comboDmgBonus));
assert.strictEqual(pandoraPredictedDmg(1000),1000, 'パンドラ通常攻撃は500 + 500になる');
assert.strictEqual(pandoraPredictedDmg(1000,0.03),1030, '連撃ダメージ+3%時は500 + 530になる');

// 確定追加ヒットを持つ全モンスター系統の代表値。ランダム会心は予測対象外。
const extraHit=(baseDmg,rate)=>Math.floor(baseDmg*rate);
const deterministicPreview=({kind,baseDmg=1000,combo=0})=>{
  let total=baseDmg;
  if(kind==='zanHero') total+=extraHit(baseDmg,0.3+combo);
  if(kind==='zanUnique') total+=extraHit(baseDmg,0.2+combo);
  if(kind==='eikiHeroNormal') total+=extraHit(baseDmg,0.1+combo)*2;
  if(kind==='eikiHeroUnique') total+=extraHit(baseDmg,0.1+combo)*2+extraHit(baseDmg,0.3+combo)+extraHit(baseDmg,0.15+combo)*2;
  if(kind==='eikiInheritedUnique') total+=extraHit(baseDmg,0.15+combo)*2;
  if(kind==='pandoraUnique') total+=extraHit(baseDmg,1+combo);
  if(kind==='atonement') total+=Math.floor(baseDmg*0.2);
  if(kind==='globalCombo') total+=extraHit(baseDmg,combo);
  return total;
};
assert.strictEqual(deterministicPreview({kind:'zanHero'}),1300, 'ザン勇者の予測はメイン+30%');
assert.strictEqual(deterministicPreview({kind:'zanUnique'}),1200, 'ザン固有技の予測はメイン+20%');
assert.strictEqual(deterministicPreview({kind:'eikiHeroNormal'}),1200, 'エイキ通常技の予測はメイン+10%×2');
assert.strictEqual(deterministicPreview({kind:'eikiHeroUnique'}),1800, 'エイキ自身の固有技予測はメイン+10%×2+30%+15%×2');
assert.strictEqual(deterministicPreview({kind:'eikiInheritedUnique'}),1300, '継承したエイキ固有技の予測はメイン+15%×2');
assert.strictEqual(deterministicPreview({kind:'pandoraUnique'}),2000, 'パンドラ固有技の予測はメイン+100%');
assert.strictEqual(deterministicPreview({kind:'atonement'}),1200, 'アーク/イブリース固有技の予測はメイン+20%');
assert.strictEqual(deterministicPreview({kind:'globalCombo',combo:0.07}),1070, 'きき全体連撃の予測はメイン+全体連撃率');
assert.strictEqual(deterministicPreview({kind:'eikiHeroUnique',combo:0.03}),1949, '連撃強化はエイキの5連撃すべてへ加算する（各ヒット切り捨て）');

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

// 固有技は「効果を足してから、その同じカードで攻撃する」。processTurnの
//   if(card.type==='unique'){ …localOryoAdd+=boost… } の直後に getDmg(...,localOryoAdd,...)
// という並びがそのまま自分への適用になっている。おりょう・ききのバフカードは自分では
// 攻撃しないので、この違いはダメージに出ない。
const appliesToSelf = (card) => card.type==='unique';

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
    const boost=localBoostFromCard(card);
    // 固有技は自分の効果を先に乗せる
    if (boost&&appliesToSelf(card)) { oryo+=(boost.oryo||0)*effMul; dmgMod+=(boost.dmgMod||0)*effMul; combo+=(boost.combo||0)*effMul; }
    if (card.isAttack) {
      const dmg=Math.floor(baseAtk*(1+oryo)*(1+dmgMod));
      const comboHit=Math.floor(dmg*combo);
      totalDmg+=dmg+comboHit;
      perCardDmg.push(dmg+comboHit);
    }
    if (boost&&!appliesToSelf(card)) { oryo+=(boost.oryo||0)*effMul; dmgMod+=(boost.dmgMod||0)*effMul; combo+=(boost.combo||0)*effMul; }
    if (isPenalty) penaltyCnt++;
  }
  return { totalDmg, perCardDmg };
};

// previewLocalBoosts + boostsForCardDamage と同じ「そのカードのダメージを出すときの値」を作るスキャン。
// 固有技は自分のぶんを含める(含めないと、実行した瞬間だけダメージが増える)
const runPreviewOrder = (orderedCards, baseAtk=100) => {
  let oryo=0, dmgMod=0, combo=0, penaltyCnt=0, totalDmg=0;
  const perCardDmg=[];
  for (const card of orderedCards) {
    const isPenalty=!card.isBreeder;
    const halved=isPenalty&&penaltyCnt>0;
    const effMul=cardEffectMultiplier(card,halved);
    const boost=localBoostFromCard(card);
    const own=(boost&&appliesToSelf(card))?boost:null;
    if (card.isAttack) {
      // その時点までの累計に、自分に乗るぶん(固有技)を足した値で予測する
      const useOryo=oryo+(own?(own.oryo||0)*effMul:0);
      const useDmgMod=dmgMod+(own?(own.dmgMod||0)*effMul:0);
      const useCombo=combo+(own?(own.combo||0)*effMul:0);
      const dmg=Math.floor(baseAtk*(1+useOryo)*(1+useDmgMod));
      const comboHit=Math.floor(dmg*useCombo);
      totalDmg+=dmg+comboHit;
      perCardDmg.push(dmg+comboHit);
    }
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

// ケース3: 固有技は自分の効果を自分にも乗せる。
// 予測がここを含めないと「カードを選んでいるときは低く、実行した瞬間に増える」ことになる
// (実際の報告: ゴーレムの攻撃アップぶん +7.5% / モッチー・ミタラシ +10%)
for (const [label, card, expected] of [
  ['ゴーレム1枚', golem, Math.floor(100*1.075)],
  ['モッチー1枚', mocchi, Math.floor(100*1.1)],
]) {
  const actual=runProcessTurnOrder([card]);
  const predicted=runPreviewOrder([card]);
  assert.deepStrictEqual(predicted, actual, `${label}: 予測と実行がずれている`);
  assert.strictEqual(actual.perCardDmg[0], expected,
    `${label}: 固有技が自分の効果を自分に乗せていない(実行=${actual.perCardDmg[0]} / 期待=${expected})`);
}

// ケース4: 2枚目以降の半減もバフの量に正しく反映されること(ゴーレムが2枚目なら半分の効果)
{
  const filler = { type:'atk', isBreeder:false, isAttack:false }; // 攻撃はしないがpenaltyCntだけ進める枠
  const order=[filler, golem, attack];
  const actual=runProcessTurnOrder(order);
  const predicted=runPreviewOrder(order);
  assert.deepStrictEqual(predicted, actual, '2枚目以降半減時: 予測と実行がずれている');
  // filler(1枚目、非ブリーダー) → 何もしない。golem(2枚目、非ブリーダーなので半減) →
  // oryo += 0.075*0.5 = 0.0375。固有技は自分にも乗るので golem 自身も 1.0375 倍(perCardDmg[0])、
  // attack(3枚目、golemの後)も同じぶんを受け取る(perCardDmg[1])
  assert.strictEqual(actual.perCardDmg[0], Math.floor(100*1.0375), '2枚目以降半減時: ゴーレム自身に半減後の効果が乗っていない');
  assert.strictEqual(actual.perCardDmg[1], Math.floor(100*1.0375), '2枚目以降半減時: ゴーレムの効果が半分になっていない');
}

// ケース5: 保留中(タップしただけでまだ置いていない)のカードも、置いたときの値で予測する。
// 保留カードは積み上げにも枚数にも数えないが、自分に乗る効果だけは含める(forPending)
{
  const order=[kiki, golem];           // ききを選んだ状態で、ゴーレムを保留にしている想定
  const actual=runProcessTurnOrder(order);
  const predicted=runPreviewOrder(order);
  assert.deepStrictEqual(predicted, actual, '保留カード: 予測と実行がずれている');
  // きき(ブリーダー、combo+0.03) → ゴーレム(自分の+7.5%が乗り、ききの連撃も乗る)
  const base=Math.floor(100*1.075);
  assert.strictEqual(actual.perCardDmg[0], base+Math.floor(base*0.03),
    '保留カード: 手前のバフと自分の効果の両方が乗っていない');
}

// DRIFT GUARD: 上のモデルが前提にしている「固有技だけが自分に乗る」判定と、
// 予測側がそれを使っていることを実コードで確かめる
assert(source.includes("const localBoostAppliesToSelf = (card) => card?.type==='unique';"),
  '固有技だけが自分に乗る、という判定が実コードから消えている');
assert(source.includes('const boostsForCardDamage = (base, card, halved) => {'),
  'そのカードのダメージに使う補正をまとめる関数が必要');
assert(source.includes('perCard[idx]=boostsForCardDamage({oryo,dmgMod,combo},card,halved);'),
  '選択済みカードの予測が自分のぶんを含めていない');
assert(/forPending:boostsForCardDamage\(\{oryo,dmgMod,combo\},pendingCard,pendingHalved\)/.test(source),
  '保留カードの予測が自分のぶんを含めていない');
assert(!/getDmg\(pendingCardObj,[^)]*\.final\./.test(source),
  '保留カードの予測が forPending ではなく final を使っている(自分のぶんが抜ける)');

console.log('battle damage preview checks passed');
