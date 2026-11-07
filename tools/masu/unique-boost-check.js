#!/usr/bin/env node
// 固有技のオリジナル強化(2026-11-07 社長)の決めごとを、本体の関数を動かして確かめる。
//   ① 種類は3タブ・全19種類。上げ幅・1目盛りのP・上限は社長の答えどおり(連撃数 10,000Pで+1本・+2本まで/効果の長さ 5,000Pで+1ターン・+1まで)
//   ② 確定: Lv.8 の技だけ・効かない種類(灰色)・上限超え・P不足・今より下げる は弾く。成功したらそのぶん固有技Pが減る
//   ③ 総合力: 使った固有技P 100Pごとに +1000。内わけに出す
//   ④ スキルポイントリセット券: 固有技Lvとオリジナル強化をすべて戻し、使ったPを全部返す
//   ⑤ 転生しても残る(積んでいない個体に項目を足さない)/保存の形: 壊れた値は読むときに捨てる
//   ⑥ 合体: 副の技(自前+前に引き継いだ技)から1つ選べ、強化も移る。主と同じ系統は選べない
//   ⑦ バトルの効き方: 〇〇特攻の条件・連撃数の本数・効果の確率・カードからどの技かを決める
// 使い方: node tools/masu/unique-boost-check.js
'use strict';
const path = require('path');
const { loadDyeModule } = require(path.join(__dirname, '..', 'harness'));
const X = loadDyeModule();
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const D = X.UNIQUE_BOOST_BY_ID;

// ① 種類
const tabs = {};
X.UNIQUE_BOOST_DEFINITIONS.forEach(def => { (tabs[def.tab] = tabs[def.tab] || []).push(def.name); });
check('タブは攻撃・特攻・補助の3つ', Object.keys(tabs).join(',') === 'attack,slayer,support', Object.keys(tabs).join(','));
check('攻撃: 威力・会心ダメージ・会心率・連撃ダメージ・連撃数', tabs.attack.join(',') === '威力,会心ダメージ,会心率,連撃ダメージ,連撃数', tabs.attack.join(','));
check('特攻: ムー特攻・イベボス特攻・溜めくずし・動けない敵へ・とどめ・間合いの極意・勇者の誇り・極限への挑戦',
  tabs.slayer.join(',') === 'ムー特攻,イベボス特攻,溜めくずし,動けない敵へ,とどめ,間合いの極意,勇者の誇り,極限への挑戦', tabs.slayer.join(','));
check('補助: 省気・効果の強さ・回復の量・効果の長さ・効果の確率・見切り', tabs.support.join(',') === '省気,効果の強さ,回復の量,効果の長さ,効果の確率,見切り', tabs.support.join(','));
check('威力は100Pで+0.1%(社長の物差し)', D.power.stepCost === 100 && D.power.perStep === 0.1);
check('連撃数は10,000Pで+1本・+2本まで', D.comboCount.stepCost === 10000 && D.comboCount.perStep === 1 && X.uniqueBoostMaxSteps(D.comboCount) === 2);
check('効果の長さは5,000Pで+1ターン・+1ターンまで', D.effectDuration.stepCost === 5000 && X.uniqueBoostMaxSteps(D.effectDuration) === 1);
check('上限: 会心率+50pt・省気−50%・効果の強さ/回復の量+100%・効果の確率+25pt・見切り+20pt',
  X.uniqueBoostMaxSteps(D.critRate) === 500 && X.uniqueBoostMaxSteps(D.gutsSave) === 1250 && X.uniqueBoostMaxSteps(D.effectPower) === 1000
  && X.uniqueBoostMaxSteps(D.healAmount) === 1000 && X.uniqueBoostMaxSteps(D.effectChance) === 500 && X.uniqueBoostMaxSteps(D.evade) === 400);
check('威力・会心ダメージ・〇〇特攻は上限なし', ['power', 'critDamage', 'mooSlayer', 'eventBossSlayer', 'finisher'].every(id => X.uniqueBoostMaxSteps(D[id]) === Infinity));
check('連撃ダメージ・連撃数は連撃を持つ技だけ(ゴーレムは灰色・ザンは押せる)',
  !X.uniqueBoostAppliesTo(D.comboCount, 'Golem') && X.uniqueBoostAppliesTo(D.comboCount, 'Zan') && !X.uniqueBoostAppliesTo(D.comboDamage, 'Golem'));
check('ゴーレム(合掌)で灰色: 連撃ダメージ・連撃数・回復の量・効果の長さ・効果の確率',
  X.UNIQUE_BOOST_DEFINITIONS.filter(def => !X.uniqueBoostAppliesTo(def, 'Golem')).map(def => def.id).join(',') === 'comboDamage,comboCount,healAmount,effectDuration,effectChance');
check('値の見せ方', X.formatUniqueBoostValue(D.power, 8) === '+0.8%' && X.formatUniqueBoostValue(D.critDamage, 3) === '+0.39%'
  && X.formatUniqueBoostValue(D.gutsSave, 10) === '−0.40%' && X.formatUniqueBoostValue(D.comboCount, 1) === '+1本' && X.formatUniqueBoostValue(D.effectDuration, 1) === '+1ターン',
  [X.formatUniqueBoostValue(D.power, 8), X.formatUniqueBoostValue(D.critDamage, 3), X.formatUniqueBoostValue(D.gutsSave, 10)].join(' '));
check('要約は2つまで+「ほか」', X.uniqueBoostSummaryText({ power: 8, mooSlayer: 6, critRate: 1 }) === '威力+0.8%・会心率+0.1pt ほか', X.uniqueBoostSummaryText({ power: 8, mooSlayer: 6, critRate: 1 }));

// ② 確定
const base = (o = {}) => ({ id: 'm1', baseId: 'Golem', name: 'ゴレ', bondXp: 0, levelCap: 30, uniqueSkillLevels: { own: 8 }, uniqueSkillPoints: 1027, ...o });
const r1 = X.applyUniqueBoostPlan(base(), 'own', { power: 8, mooSlayer: 1 });
check('確定するとそのぶん固有技Pが減る(900P)', r1 && r1.cost === 900 && r1.nextMasu.uniqueSkillPoints === 127 && r1.nextMasu.uniqueSkillBoosts.own.power === 8, JSON.stringify(r1 && r1.nextMasu.uniqueSkillBoosts));
check('Lv.8 でない技には積めない', X.applyUniqueBoostPlan(base({ uniqueSkillLevels: { own: 7 } }), 'own', { power: 1 }) === null);
check('その技に効かない種類(灰色)は弾く', X.applyUniqueBoostPlan(base(), 'own', { comboCount: 1 }) === null);
check('P不足は弾く', X.applyUniqueBoostPlan(base({ uniqueSkillPoints: 99 }), 'own', { power: 1 }) === null);
check('上限を超えると弾く', X.applyUniqueBoostPlan(base({ uniqueSkillPoints: 1e6 }), 'own', { critRate: 501 }) === null);
check('今より下げることはできない', X.applyUniqueBoostPlan(r1.nextMasu, 'own', { power: 7 }) === null);
check('持っていない技のキーは弾く', X.applyUniqueBoostPlan(base(), 'inhId:nope', { power: 1 }) === null);
check('知らない種類は弾く', X.applyUniqueBoostPlan(base(), 'own', { unknown: 1 }) === null);

// ③ 総合力
const parts0 = X.monsterPowerParts(X.mergeMasuIntoMon(base()));
const parts1 = X.monsterPowerParts(X.mergeMasuIntoMon(r1.nextMasu));
check('総合力: 使った固有技P 900 → +9,000(100Pごとに+1000)', parts1.boostSpent === 900 && parts1.boost === 9000 && Math.round(parts1.total - parts0.total) === 9000, `${parts1.boostSpent} ${parts1.boost} ${parts1.total - parts0.total}`);
check('総合力: 強化なしは内わけ0', parts0.boost === 0 && parts0.boostSpent === 0);

// ④ リセット券
const reset = X.buildUniqueSkillPointReset(r1.nextMasu);
check('リセット券: Lv(8P)とオリジナル強化(900P)をすべて返す', reset && reset.refundedPoints === 908 && reset.refundedBoostPoints === 900
  && reset.nextMasu.uniqueSkillPoints === 127 + 908 && reset.nextMasu.uniqueSkillLevels.own === 0 && Object.keys(reset.nextMasu.uniqueSkillBoosts).length === 0,
  JSON.stringify(reset && { r: reset.refundedPoints, p: reset.nextMasu.uniqueSkillPoints, b: reset.nextMasu.uniqueSkillBoosts }));
check('リセット券: 強化を持たない個体に項目を足さない', !('uniqueSkillBoosts' in X.buildUniqueSkillPointReset(base()).nextMasu));

// ⑤ 転生・保存の形
const reborn = X.resetMasuForRebirth(r1.nextMasu);
check('転生してもオリジナル強化は残る', reborn.uniqueSkillBoosts && reborn.uniqueSkillBoosts.own.power === 8 && reborn.uniqueSkillPoints === 127);
check('積んでいない個体は転生で項目が増えない', !('uniqueSkillBoosts' in X.resetMasuForRebirth(base())));
const broken = X.normalizeUniqueSkillBoosts({ uniqueSkillBoosts: { own: { power: '3', critRate: 9999, x: 5, mooSlayer: -2 }, '': { power: 1 }, bad: null } });
check('壊れた値は読むときに捨てる(上限で丸める)', JSON.stringify(broken) === JSON.stringify({ own: { power: 3, critRate: 500 } }), JSON.stringify(broken));
check('保存が無い個体は空', JSON.stringify(X.normalizeUniqueSkillBoosts({})) === '{}' && JSON.stringify(X.normalizeUniqueSkillBoosts(null)) === '{}');

// ⑥ 合体
const XP30 = X.totalBondXpForLevel(30);
const inhZan = { name: 'リバースレイド', monId: 'Zan', lineageId: 'Zan', baseMult: 2, baseGuts: 10, names: ['リバースレイド'], inheritedUniqueId: 'z1', sourceMasuName: 'ザンさん' };
const sub = { id: 's1', baseId: 'Pixie', name: 'ピクシーさん', bondXp: XP30, levelCap: 30, inheritedUniques: [inhZan],
  uniqueSkillLevels: { own: 8, 'inhId:z1': 8 }, uniqueSkillPoints: 340, uniqueSkillBoosts: { 'inhId:z1': { comboCount: 1, power: 5 } } };
const main = { id: 'mm', baseId: 'Golem', name: '主', bondXp: XP30, levelCap: 30, uniqueSkillLevels: { own: 8 } };
const planOwn = X.buildFusionInheritancePlan({ main, subs: [sub], selectedSubIds: ['s1'] });
check('合体: 何も選ばなければ、これまでどおり副の自前の技', planOwn.entries[0].chosenKey === 'own' && planOwn.entries[0].inherited && planOwn.entries[0].lineageId === 'Pixie');
check('合体: 副の技の一覧は 自前+前に引き継いだ技', planOwn.entries[0].options.map(o => o.key).join(',') === 'own,inhId:z1');
const planInh = X.buildFusionInheritancePlan({ main, subs: [sub], selectedSubIds: ['s1'], choiceBySubId: { s1: 'inhId:z1' } });
const chosen = planInh.entries[0].chosen;
check('合体: 副が前に引き継いだ技を選べる(Lvと強化つき)', planInh.entries[0].inherited && chosen.monId === 'Zan' && chosen.level === 8 && chosen.boosts.comboCount === 1 && chosen.boosts.power === 5);
const mainZan = { ...main, baseId: 'Zan' };
const planDup = X.buildFusionInheritancePlan({ main: mainZan, subs: [sub], selectedSubIds: ['s1'], choiceBySubId: { s1: 'inhId:z1' } });
check('合体: 主と同じ系統の技は選べない(費用もかからない)', planDup.entries[0].options.find(o => o.key === 'inhId:z1').duplicate && !planDup.entries[0].inherited && planDup.inheritCount === 0);
const moved = X.withInheritedUniqueBoosts({ ...main, inheritedUniques: [{ ...inhZan, inheritedUniqueId: 'new1' }] }, 'inhId:new1', chosen.boosts);
check('合体: 強化は主に付いた新しい技のキーへ移る', moved.uniqueSkillBoosts['inhId:new1'].comboCount === 1 && !moved.uniqueSkillBoosts['inhId:z1']);
check('合体: 強化が無い技なら項目を足さない', !('uniqueSkillBoosts' in X.withInheritedUniqueBoosts(main, 'inhId:x', {})));

// ⑦ バトル
const ub = (steps, ctx, card = { type: 'unique', monId: 'Zan' }) => X.uniqueBoostProfile({ id: 'b', baseId: 'Zan', uniqueSkillLevels: { own: 8 }, uniqueSkillBoosts: { own: steps } }, card, ctx);
const sl = { mooSlayer: 10, eventBossSlayer: 10, chargeBreak: 10, immobileSlayer: 10, finisher: 10, rangeMatch: 10, heroPride: 10, extremeChallenge: 10 };
const near = (a, b) => Math.abs(a - b) < 1e-9;
check('特攻: 条件が何も合わなければ0', near(ub(sl, {}).damagePct, 0));
check('ムー特攻はムー・覚醒ムーだけ(ジャックはイベボス特攻)', near(ub(sl, { enemyId: 'Moo' }).damagePct, 2) && near(ub(sl, { enemyId: 'AwakenedMoo' }).damagePct, 2) && near(ub(sl, { enemyId: 'Jack' }).damagePct, 2)
  && near(ub({ mooSlayer: 10 }, { enemyId: 'Jack' }).damagePct, 0) && near(ub({ eventBossSlayer: 10 }, { enemyId: 'Jack' }).damagePct, 2));
check('イベボス特攻はレイドの戦いなら相手に関係なく効く', near(ub({ eventBossSlayer: 10 }, { enemyId: 'Slime', eventBattle: true }).damagePct, 2));
check('とどめはライフ3割以下だけ', near(ub({ finisher: 10 }, { enemyHpRatio: 0.3 }).damagePct, 2) && near(ub({ finisher: 10 }, { enemyHpRatio: 0.31 }).damagePct, 0));
check('溜めくずし・動けない敵へ・間合いの極意・勇者の誇り・極限への挑戦', near(ub(sl, { enemyCharging: true }).damagePct, 2) && near(ub(sl, { enemyImmobile: true }).damagePct, 2)
  && near(ub(sl, { sameDistance: true }).damagePct, 1.5) && near(ub(sl, { isHero: true }).damagePct, 1.5) && near(ub(sl, { extreme: true }).damagePct, 1.5));
check('連撃数は本数で返す・ゴーレムの技には効かない', ub({ comboCount: 2 }, {}).comboExtra === 2 && ub({ comboCount: 2 }, {}, { type: 'unique', monId: 'Golem' }).comboExtra === 0);
const hits = (n) => X.buildAttackHits({ d: 1000, card: { type: 'unique', monId: 'Zan' }, attackerId: 'Suezo', heroId: 'Golem', comboDmgBonus: 0.09, boostExtraCombos: n });
check('連撃数: 元のダメージの10%の連撃が本数ぶん増える(連撃ダメージ補正は足さない)', hits(2).length === hits(0).length + 2 && hits(2).slice(-2).every(h => h.dmg === 100), hits(2).map(h => h.dmg).join(','));
check('連撃数: 固有技以外の札には付かない', X.buildAttackHits({ d: 1000, card: { type: 'atk' }, attackerId: 'Suezo', heroId: 'Golem', boostExtraCombos: 2 }).length === 1);
check('効果の確率: コインの表は 50%+強化ぶん', X.rollFateCoin(() => 0.6, 0) === 'tails' && X.rollFateCoin(() => 0.6, 15) === 'heads' && X.rollFateCoin(() => 0.9, 99) === 'tails');
{ let n = 0; const seq = [0.05, 0.99]; const rnd = () => seq[n++ % seq.length];
  check('効果の確率: 運命の輪はその確率で大当たり(ダメージ3倍)', X.rollFateWheel(rnd, 10).id === 'dmg3' && X.rollFateWheel(() => 0.99, 0).id === 'atk'); }
check('カードからどの技か: 自前は own・引き継いだ技は inhId', X.uniqueBoostKeyOfCard({ type: 'unique' }) === 'own' && X.uniqueBoostKeyOfCard({ type: 'unique', inheritedUniqueId: 'z1' }) === 'inhId:z1' && X.uniqueBoostKeyOfCard({ type: 'atk' }) === null);
const ap = X.attackBoostProfile({ id: 'b', baseId: 'Zan', uniqueSkillLevels: { own: 8 }, uniqueSkillBoosts: { own: { power: 100, gutsSave: 250, critRate: 50, critDamage: 100 } } }, { type: 'unique', monId: 'Zan' }, 0, {});
check('魂格の補正と重ねる: 威力+10%・省気−10%・会心率+5pt・会心ダメ+13%', near(ap.damageMultiplier, 1.1) && near(ap.gutsCostMultiplier, 0.9) && near(ap.critRateBonus, 0.05) && near(ap.critDamageBonus, 0.13),
  JSON.stringify({ d: ap.damageMultiplier, g: ap.gutsCostMultiplier, r: ap.critRateBonus, c: ap.critDamageBonus }));
const other = X.attackBoostProfile({ id: 'b', baseId: 'Zan', uniqueSkillLevels: { own: 8 }, uniqueSkillBoosts: { own: { power: 100 } } }, { type: 'unique', monId: 'Zan', inheritedUniqueId: 'q' }, 0, {});
check('強化は積んだ技だけに効く(同じ子の別の技には効かない)', near(other.damageMultiplier, 1));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
