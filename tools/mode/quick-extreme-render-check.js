#!/usr/bin/env node
const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// クイック難易度カルーセルは、中央カードが変わるだけでゲーム本体全体を再描画する。
// EXTREME/NIGHTMAREが通常難易度表に無い状態でも、その再描画で参照する表示・報酬値を
// 解決できることを固定する（実ブラウザ検査とは別の、今回の遷移に特化した回帰検査）。
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`NG: ${message}`);
    process.exitCode = 1;
  } else console.log(`OK: ${message}`);
};

const normal = {
  Legend: { label:'Legend', power:10, score:18, gold:4 },
};
const extreme = {
  EXTREME: { label:'EXTREME', power:13, xp:20, gold:4.5, psyche:30 },
  NIGHTMARE: { label:'NIGHTMARE', power:15, xp:25, gold:6, psyche:40 },
};
const quick = { ...normal, ...extreme };
const order = Object.keys(quick);
const renderQuickCard = (difficulty, unlocked) => {
  const setting = quick[difficulty];
  return {
    label: setting.label,
    enemyPower: setting.power,
    xpReward: setting.xp ?? setting.score,
    goldReward: setting.gold,
    psycheReward: setting.psyche ?? 25,
    buttonDisabled: !unlocked,
  };
};

for (const [from, to] of [['Legend','EXTREME'], ['EXTREME','Legend'], ['EXTREME','NIGHTMARE'], ['NIGHTMARE','EXTREME']]) {
  const next = order[order.indexOf(from) + Math.sign(order.indexOf(to) - order.indexOf(from))];
  assert(next === to && renderQuickCard(next, false).label === to, `${from} → ${to} の選択と未解放カード描画`);
}
assert(renderQuickCard('EXTREME', true).buttonDisabled === false, '解放済みEXTREMEの挑戦ボタン');
assert(renderQuickCard('NIGHTMARE', true).buttonDisabled === false, '解放済みNIGHTMAREの挑戦ボタン');
assert(renderQuickCard('EXTREME', true).xpReward * 1.5 === 30 && renderQuickCard('EXTREME', true).goldReward * 1.5 === 6.75 && renderQuickCard('EXTREME', true).psycheReward === 30, 'EXTREMEの表示・実付与倍率');
assert(renderQuickCard('NIGHTMARE', true).xpReward * 1.5 === 37.5 && renderQuickCard('NIGHTMARE', true).goldReward * 1.5 === 9 && renderQuickCard('NIGHTMARE', true).psycheReward === 40, 'NIGHTMAREの表示・実付与倍率');

// クイック対応表の引き方は quickDifficultySetting に1本化されている
// (ULTIMATEだけ QUICK_ULTIMATE_SETTING を返すため、直接の添字引きでは足りない)
assert(source.includes('const activeDifficultySetting = quickDifficultySetting(safeDifficulty);'), '再描画時の難易度設定をクイック対応表から解決');
assert(/const quickDifficultySetting = \(difficultyId\) => difficultyId===ULTIMATE_SETTING\.id[\s\S]{0,120}QUICK_DIFFICULTY_SETTINGS\[difficultyId\]/.test(source), 'クイック対応表の解決はULTIMATEも含めて1か所にまとまっている');
assert(!source.includes('DIFFICULTY_SETTINGS[safeDifficulty].score') && !source.includes('DIFFICULTY_SETTINGS[safeDifficulty].gold'), '再描画経路に通常難易度表の危険な直接参照がない');
assert(source.includes("const label=extreme?extremePreviewSetting.label:QUICK_DIFFICULTY_SETTINGS[safeDifficulty].label"), '全WAVE詳細がクイック極限難易度のラベルを解決');
assert(source.includes('createBattleEnemy(index+1,waveDifficulty,null,powerOverride)'), '全WAVE詳細が共通の敵生成経路を使う');

if (!process.exitCode) console.log('\nquick extreme render checks passed');
