// 魂格システム STEP1「基盤」の回帰検査。
//
//   node tools/masu/soul-rank-step1-check.js
//
// STEP1だけを確認する:
// - 個体データ正規化 / 旧セーブ互換
// - 魂格0〜Vに対応できるLv500〜1000上限基盤
// - Lv500以降の正式XP
// - Lv501以降の魂格P初到達 / 二重取得防止
// - Lv401以降のLv帯別超越P
// - 転生保持
// - 既存の共通絆XP経路を使うこと
const fs = require('fs');
const path = require('path');
const { REPO_ROOT, loadDyeModule } = require('../harness');

const source = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
const appPart = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
const a = loadDyeModule();

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const xpAt = (level) => a.totalBondXpForLevel(level + 1) - a.totalBondXpForLevel(level);
const makeSoulMasu = (level, stage = 5, over = {}) => a.normalizeMasuProgression({
  id:'soul-step1', baseId:'Snegurochka', name:'魂格テスト',
  transcended:true, soulRankStage:stage, levelCap:a.soulRankLevelCap(stage),
  bondXp:a.totalBondXpForLevel(level), soulPointMaxReachedLevel:500, soulTraitLevels:{},
  rebirthCount:35, reincarnateCount:0, distAptPoints:0, distAptBoosts:[0,0,0,0],
  statPoints:{hp:0,atk:0,def:0,guts:0}, ...over,
});
const gainTo = (masu, toLevel) =>
  a.applyBondXpGain(masu, Math.max(0, a.totalBondXpForLevel(toLevel) - (masu.bondXp || 0)));

// ---- 1. 個体データと上限 ----
check('魂格段階は0〜5へ正規化する',
  a.normalizeSoulRankStage(-9) === 0 && a.normalizeSoulRankStage(3.9) === 3 && a.normalizeSoulRankStage(99) === 5);
check('魂格段階ごとの上限は500/600/700/800/900/1000',
  [500,600,700,800,900,1000].every((cap, stage) => a.soulRankLevelCap(stage) === cap));
check('旧個体は魂格0・最高初到達Lv500・特性なしとして読む', (() => {
  const legacy = a.normalizeMasuProgression({
    id:'legacy', baseId:'Snegurochka', transcended:true, levelCap:500,
    bondXp:a.totalBondXpForLevel(500), rebirthCount:35,
  });
  return legacy.soulRankStage === 0 && legacy.soulPointMaxReachedLevel === 500
    && JSON.stringify(legacy.soulTraitLevels) === '{}' && legacy.levelCap === 500;
})());
check('壊れた魂格値は安全側へ正規化する', (() => {
  const broken = a.normalizeMasuProgression({
    id:'broken', baseId:'Snegurochka', transcended:true, soulRankStage:99, levelCap:9999,
    soulPointMaxReachedLevel:9999, soulTraitLevels:{ allDamage:'3', focus:3, normalDamage:0, critDamage:'x' },
  });
  return broken.soulRankStage === 5 && broken.levelCap === 1000
    && broken.soulPointMaxReachedLevel === 1000
    && broken.soulTraitLevels.allDamage === 3
    && !Object.prototype.hasOwnProperty.call(broken.soulTraitLevels, 'focus')
    && !Object.prototype.hasOwnProperty.call(broken.soulTraitLevels, 'normalDamage')
    && !Object.prototype.hasOwnProperty.call(broken.soulTraitLevels, 'critDamage');
})());
check('魂格0の既存超越個体はLv500を越えない',
  a.masuBondLevelInfo({ ...makeSoulMasu(500, 0), levelCap:9999, bondXp:Number.MAX_SAFE_INTEGER }).level === 500);
check('魂格IはLv600、魂格VはLv1000まで数えられる',
  a.masuBondLevelInfo({ ...makeSoulMasu(600, 1), bondXp:a.totalBondXpForLevel(1000) }).level === 600
  && a.masuBondLevelInfo(makeSoulMasu(1000, 5)).level === 1000);
check('Lv1001以降はSTEP1で作らない',
  a.totalBondXpForLevel(1001) === a.totalBondXpForLevel(1000)
  && a.bondLevelInfo(Number.MAX_SAFE_INTEGER).level === 1000);

// ---- 2. XP ----
check('Lv499→500の既存XPは148,971のまま', xpAt(499) === 148971, String(xpAt(499)));
for (const [level, expected] of [
  [500,160000],[599,184750],[600,210000],[699,234750],[700,265000],
  [799,314500],[800,345000],[899,394500],[900,430000],[999,519100],
]) {
  check(`Lv${level}→${level + 1} = ${expected.toLocaleString()} XP`, xpAt(level) === expected, String(xpAt(level)));
}
for (const [from, to, expected] of [
  [500,600,17237500],[600,700,22237500],[700,800,28975000],
  [800,900,36975000],[900,1000,47455000],[500,1000,152880000],
]) {
  const actual = a.totalBondXpForLevel(to) - a.totalBondXpForLevel(from);
  check(`Lv${from}→${to}累計 = ${expected.toLocaleString()} XP`, actual === expected, actual.toLocaleString());
}

// ---- 3. 魂格P ----
const first = gainTo(makeSoulMasu(500, 1), 505);
check('Lv500→505初到達で魂格P+5',
  first.gainedSoulPoints === 5 && first.masu.soulPointMaxReachedLevel === 505);
check('魂格Pを別の所持数として重複保存しない',
  !Object.prototype.hasOwnProperty.call(first.masu, 'soulPoints')
  && !Object.prototype.hasOwnProperty.call(first.masu, 'soulPoint'));
const reborn = a.resetMasuForRebirth({ ...first.masu, soulTraitLevels:{ allDamage:2 } }, { toLevel:500 });
check('転生で魂格段階・初到達Lv・特性を保持する',
  reborn.soulRankStage === 1 && reborn.soulPointMaxReachedLevel === 505
  && reborn.soulTraitLevels.allDamage === 2 && reborn.levelCap === 600);
const replay = gainTo(reborn, 505);
check('転生後にLv505へ再到達しても魂格Pは二重取得しない',
  replay.gainedSoulPoints === 0 && replay.masu.soulPointMaxReachedLevel === 505);
const newReach = gainTo(reborn, 507);
check('過去最高Lv505を越えた506〜507だけ魂格P+2',
  newReach.gainedSoulPoints === 2 && newReach.masu.soulPointMaxReachedLevel === 507);
const maxSoul = gainTo(makeSoulMasu(500, 5), 1000);
check('Lv501〜1000の魂格Pは最大500P',
  maxSoul.gainedSoulPoints === 500 && maxSoul.masu.soulPointMaxReachedLevel === 1000);

// ---- 4. 超越P ----
for (const [level, expected] of [
  [401,1],[500,1],[501,2],[600,2],[601,3],[700,3],
  [701,4],[800,4],[801,5],[900,5],[901,6],[1000,6],
]) {
  check(`Lv${level}到達時の超越P = ${expected}`,
    a.transcendPointGainForReachedLevel(level) === expected,
    String(a.transcendPointGainForReachedLevel(level)));
}
check('Lv499→501はLv500の1P + Lv501の2P = 3P',
  a.gainedTranscendPointsBetweenLevels(499, 501) === 3);
check('魂格Vでも低Lv帯は実Lv帯の倍率を使う',
  gainTo(makeSoulMasu(850, 5, { soulPointMaxReachedLevel:1000 }), 851).gainedTranscendPoints === 5
  && gainTo(makeSoulMasu(900, 5, { soulPointMaxReachedLevel:1000 }), 901).gainedTranscendPoints === 6);
check('魂格Pは再取得不可だが超越Pは転生後も再取得できる',
  replay.gainedSoulPoints === 0 && replay.gainedTranscendPoints === 10);
check('Lv401以降は通常強化Pを追加しない',
  gainTo(makeSoulMasu(500, 1), 505).gainedPoints === 0);

// ---- 5. 共通XP経路 / 保存互換 ----
check('バトル・合体・AUTO∞・スキップは共通applyBondXpGainを通る',
  ['applyBondXpGain(masu, gain)','applyBondXpGain(nextMain, gainedXp)',
   'applyBondXpGain(m, award.gain, autoRepeatBondLevelCap)','applyBondXpGain(mon, award.gain).masu']
    .every(call => source.includes(call)));
check('新規マスモンも魂格の初期値を明示する',
  appPart.includes('soulRankStage: 0')
  && appPart.includes('soulPointMaxReachedLevel: SOUL_RANK_BASE_LEVEL')
  && appPart.includes('soulTraitLevels: {}'));
check('魂格STEP1で新しいmh_*保存キーを増やしていない',
  !/['"]mh_soul/i.test(source));

// STEP1検査は基盤だけを固定する。STEP2以降が追加されても、この回帰条件自体は維持する。

console.log(failed ? `\n${failed}件のNGがあります` : '\n魂格STEP1: すべてOK');
process.exit(failed ? 1 : 0);
