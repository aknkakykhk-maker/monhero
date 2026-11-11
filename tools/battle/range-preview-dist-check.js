#!/usr/bin/env node
// 距離撃(range_atk)を先に置いたターンの「予測ダメージ」が、実際と同じ敵の距離で計算されるかを見る(2026-11-11 バトルの監査)。
//
// 実際にあった食い違い: 実処理(processTurn)は、距離撃で敵を動かしたあとのカードを「動かしたあとの距離」で計算する
// (attackDistance)。予測(合計DMG・枠ごとの予測・AIコピーの「攻N」)は getDmg へ距離を渡しておらず、
// いつも「いまの敵の距離」で出していた。遠にいる敵へ「零への距離撃 → 零の子の攻撃」と置くと、
// 予測は距離の差3(×0.9)、実際は差0(×1.5)で、実際のほうが約1.67倍になる(逆の並びなら予測より小さくなる)。
//
// 見るもの:
//  1. 次のカードの距離を決める関数 attackDistanceAfterCard の中身
//  2. 本体の previewLocalBoosts をそのまま切り出して動かし、カードごとの距離(dist)が実処理の並びと同じになること
//  3. 実処理と予測の4か所(＋AIコピー)が、その距離を getDmg へ渡していること
//  4. 距離の倍率と距離撃の倍率を本体の式で検算して、予測と実際が同じ値になること
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
let failed = 0;
const check = (label, ok, note = '') => { if (!ok) failed++; console.log(`  ${ok ? 'OK' : 'NG'}  ${label}${note ? ` — ${note}` : ''}`); };

// ---- 1. 距離を決める関数 ----
const afterSrc = source.match(/const attackDistanceAfterCard = \(card, dist\) => [^\n]+;\n/);
check('attackDistanceAfterCard がある', !!afterSrc);
if (!afterSrc) { console.log('\n切り出せないので中止します'); process.exit(1); }
const attackDistanceAfterCard = Function(`${afterSrc[0]}\nreturn attackDistanceAfterCard;`)();
check('距離撃は指定の距離へ進める', attackDistanceAfterCard({ type: 'range_atk', rangeIdx: 0 }, 3) === 0);
check('指定の無い距離撃・通常技・固有技・ガードは距離を変えない',
  attackDistanceAfterCard({ type: 'range_atk' }, 3) === 3 && attackDistanceAfterCard({ type: 'atk' }, 2) === 2
  && attackDistanceAfterCard({ type: 'unique', monId: 'Zan' }, 1) === 1 && attackDistanceAfterCard({ type: 'guard' }, 1) === 1
  && attackDistanceAfterCard(null, 2) === 2);

// ---- 2. 本体の previewLocalBoosts を切り出して動かす ----
const head = source.indexOf('  const previewAttackStartDist = (card, dist) =>');
const tail = source.indexOf('  // 固有技のオリジナル強化の「〇〇特攻」を見るための', head);
check('previewLocalBoosts を切り出せる', head >= 0 && tail > head);
const boostsHead = source.indexOf('  const localBoostAppliesToSelf = (card) =>');
const boostsTail = source.indexOf('  // カード選択中のプレビュー専用。選択順に並べて', boostsHead);
check('boostsForCardDamage を切り出せる', boostsHead >= 0 && boostsTail > boostsHead);
if (failed) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }

const makePreview = ({ hand, selectedCards, cardAssignments, enemyDist }) => Function(
  'hand', 'selectedCards', 'cardAssignments', 'enemyDist', 'attackDistanceAfterCard',
  `const localBoostFromCard = (card) => (card && card.type==='unique' && card.monId==='Golem' ? { oryo: 0.075 } : null);
   const cardEffectMultiplier = (card, halved) => (halved ? 0.5 : 1);
   const makeHalveCounter = () => { let n = 0; return { peek: (card) => !!card && !card.isBreeder && n > 0, take(card) { const h = this.peek(card); if (card && !card.isBreeder) n++; return h; } }; };
   ${source.slice(boostsHead, boostsTail)}
   ${source.slice(head, tail)}
   return previewLocalBoosts;`
)(hand, selectedCards, cardAssignments, enemyDist, attackDistanceAfterCard);

const RANGE0 = { type: 'range_atk', rangeIdx: 0, mult: 1.2 };
const RANGE2 = { type: 'range_atk', rangeIdx: 2, mult: 1.2 };
const ATK = { type: 'atk', mult: 1.0 };
const STUN = { type: 'buff', subType: 'stun_atsu', isBreeder: true };
{
  const hand = [RANGE0, ATK, RANGE2, STUN, ATK];
  const p = makePreview({ hand, selectedCards: [0, 1, 2, 3], cardAssignments: { 0: 0, 1: 0, 2: 1, 3: 1 }, enemyDist: 3 })(4);
  check('1枚目の距離撃は、いまの距離(遠)で計算する', p.perCard[0].dist === 3, `dist=${p.perCard[0].dist}`);
  check('距離撃のあとの攻撃は、動かしたあとの距離(零)で計算する', p.perCard[1].dist === 0, `dist=${p.perCard[1].dist}`);
  check('2枚目の距離撃は、1枚目が動かしたあとの距離(零)から始める', p.perCard[2].dist === 0, `dist=${p.perCard[2].dist}`);
  check('あつの挑発も、ほかの攻撃と同じく動かしたあとの距離(中)で計算する', p.perCard[3].dist === 2, `dist=${p.perCard[3].dist}`);
  check('置く前のカード(保留)は、選んだカードを全部使ったあとの距離(中)で計算する', p.forPending.dist === 2 && p.final.dist === 2, `dist=${p.forPending.dist}`);
  check('補正(おりょう・被ダメ・連撃)の入れ物は今までどおり', p.perCard[1].oryo === 0 && p.perCard[1].dmgMod === 0 && p.perCard[1].combo === 0);
}
{
  // 保留中のカード自身が距離撃でも、自分のぶんでは進めない(まだ使っていない)
  const p = makePreview({ hand: [ATK, RANGE0], selectedCards: [0, 1], cardAssignments: { 0: 2 }, enemyDist: 3 })(1);
  check('保留中の距離撃は、自分の距離を先取りしない', p.forPending.dist === 3 && p.perCard[1].dist === 3, `dist=${p.forPending.dist}`);
  const none = makePreview({ hand: [ATK, ATK], selectedCards: [0, 1], cardAssignments: { 0: 1, 1: 2 }, enemyDist: 1 })(null);
  check('距離撃を使わないターンは、全部いまの距離のまま(今までと同じ)', none.perCard[0].dist === 1 && none.perCard[1].dist === 1 && none.forPending.dist === 1);
}

// ---- 3. 距離を getDmg へ渡しているか ----
check('実処理は同じ関数で次の距離を決める', source.includes('attackDistance=attackDistanceAfterCard(card,attackDistance);'));
check('実処理の攻撃は、その時点の距離を getDmg へ渡す', source.includes('const d=getDmg(card,slotIdx,activeMon,localOryoAdd,localDmgModAdd,halved,attackStartDist,fateDmgMult*copyDmgScale);'));
check('合計DMG(置いたカード)が距離を渡す', source.includes('getDmg(card,slotIdx,slots[slotIdx],b.oryo,b.dmgMod,halved,b.dist)'));
check('合計DMG(置く前のカード)が距離を渡す', source.includes('getDmg(pendingCardObj,i,s,boosts.forPending.oryo,boosts.forPending.dmgMod,pendingHalved,boosts.forPending.dist)'));
check('枠ごとの予測(置く前のカード)が距離を渡す', source.includes('getDmg(pendingCardObj,i,s,slotBoosts.forPending.oryo,slotBoosts.forPending.dmgMod,isSecondOrLater,slotBoosts.forPending.dist)'));
check('枠ごとの予測(置いたカード)が距離を渡す', source.includes('getDmg(card,i,s,b.oryo,b.dmgMod,halved,b.dist)'));
check('AIコピーの予測が、味方のカードのあとの距離から始めて自分の距離撃でも進める',
  source.includes('getDmg(card, copy.srcSlot, srcMon, b.oryo, b.dmgMod, false, run.dist, dmgScale)') && source.includes('run = { ...run, dist: attackDistanceAfterCard(card, run.dist) };'));
check('あつの挑発の実処理も、その時点の距離を getDmg へ渡す', source.includes('getDmg(card,slotIdx,stunMon,localOryoAdd,localDmgModAdd,false,attackDistance)'));
const previewCalls = (source.match(/getDmg\((?:card|pendingCardObj),(?:slotIdx|i),[^;]*?\);/g) || []).filter(c => !/attackStartDist|stunMon/.test(c));
check(`予測の getDmg は4か所とも距離つき(${previewCalls.length}か所)`, previewCalls.length === 4 && previewCalls.every(c => /\.dist\)/.test(c)), previewCalls.filter(c => !/\.dist\)/.test(c)).join(' / '));

// ---- 4. 本体の倍率で検算 ----
const rangeSrc = source.match(/const rangeAttackDamageMultiplier = \(card, attackStartDist\) => \{[\s\S]*?\n\};\n/);
check('距離撃の倍率の式を切り出せる', !!rangeSrc);
const distMultSrc = /\(\[1\.5,1\.3,1\.1,0\.9\]\[distDiff\]\|\|1\.0\)/.test(source);
check('距離の差の倍率は 1.5 / 1.3 / 1.1 / 0.9', distMultSrc);
if (rangeSrc && distMultSrc) {
  const rangeAttackDamageMultiplier = Function(`${rangeSrc[0]}\nreturn rangeAttackDamageMultiplier;`)();
  const dmg = (card, slotIdx, dist, atk = 1000) => Math.floor(atk * ([1.5, 1.3, 1.1, 0.9][Math.abs(slotIdx - dist)] || 1.0)
    * (card.type === 'range_atk' ? rangeAttackDamageMultiplier(card, dist) : (card.mult || 1)));
  const run = (hand, order, assign, enemyDist) => {
    // 実処理: 並びどおりに1枚ずつ、その時点の距離で
    let dist = enemyDist; const actual = [];
    order.forEach(idx => { actual.push(dmg(hand[idx], assign[idx], dist)); dist = attackDistanceAfterCard(hand[idx], dist); });
    // 予測: 本体の previewLocalBoosts が返す距離で
    const p = makePreview({ hand, selectedCards: order, cardAssignments: assign, enemyDist })(null);
    const predicted = order.map(idx => dmg(hand[idx], assign[idx], p.perCard[idx].dist));
    const old = order.map(idx => dmg(hand[idx], assign[idx], enemyDist));
    return { actual, predicted, old };
  };
  const a = run([RANGE0, ATK], [0, 1], { 0: 0, 1: 0 }, 3);
  check('遠の敵へ「零への距離撃 → 零の子の攻撃」: 予測＝実際', JSON.stringify(a.actual) === JSON.stringify(a.predicted), `実際 ${a.actual} / 予測 ${a.predicted}`);
  check('同じ並びで、直す前の数え方(動かす前の距離)は実際より小さかった', a.old[1] < a.actual[1], `直す前 ${a.old[1]} → 実際 ${a.actual[1]}`);
  let all = true, cases = 0;
  for (let enemyDist = 0; enemyDist < 4; enemyDist++) for (let r1 = 0; r1 < 4; r1++) for (let r2 = 0; r2 < 4; r2++) for (let s = 0; s < 4; s++) {
    const hand = [{ type: 'range_atk', rangeIdx: r1, mult: 1.3 }, { type: 'range_atk', rangeIdx: r2, mult: 1.1 }, ATK];
    for (const order of [[0, 1, 2], [0, 2, 1], [2, 0, 1], [1, 0, 2]]) {
      const r = run(hand, order, { 0: s, 1: (s + 1) % 4, 2: (s + 2) % 4 }, enemyDist); cases++;
      if (JSON.stringify(r.actual) !== JSON.stringify(r.predicted)) all = false;
    }
  }
  check(`距離4×距離撃2枚の行き先16×置く枠4×並び4の ${cases} 通りで、予測＝実際`, all);
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
