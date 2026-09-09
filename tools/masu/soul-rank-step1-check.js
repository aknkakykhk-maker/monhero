// 魂格システム STEP1「基盤」の回帰検査。
// UI・神殿進化・勇者の証・魂格特性の実戦効果は後続STEPの対象。
const { loadDyeModule } = require('../harness');
const {
  TRANSCEND_LEVEL_CAP, SOUL_RANK_MAX_STAGE, SOUL_RANK_MAX_LEVEL_CAP, soulRankLevelCap,
  normalizeMasuProgression, normalizeSoulRankStage, normalizeSoulPointMaxReachedLevel, normalizeSoulTraitLevels,
  xpForBondLevelAt, totalBondXpForLevel, bondLevelInfo, masuBondLevelInfo,
  applyBondXpGain, gainedTranscendPointsBetweenLevels, resetMasuForRebirth,
} = loadDyeModule();

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const xpTo = (from, to) => totalBondXpForLevel(to) - totalBondXpForLevel(from);
const makeMasu = (level, over = {}) => ({
  id:'soul-step1', baseId:'Mocchi', name:'魂格テスト', bondXp:totalBondXpForLevel(level),
  levelCap:TRANSCEND_LEVEL_CAP, transcended:true, rebirthCount:35, distAptPoints:0,
  statPoints:{ hp:0, atk:0, def:0, guts:0 }, distAptBoosts:[0,0,0,0], transcendPoints:0, ...over,
});

const legacy = normalizeMasuProgression(makeMasu(500));
check('旧個体は魂格0として読む', legacy.soulRankStage === 0);
check('旧個体の魂格P最高初到達Lvは500', legacy.soulPointMaxReachedLevel === 500);
check('旧個体の魂格特性は空', Object.keys(legacy.soulTraitLevels || {}).length === 0);
const broken = normalizeMasuProgression(makeMasu(500, {
  levelCap:9999, soulRankStage:99, soulPointMaxReachedLevel:9999,
  soulTraitLevels:{ attack:2.9, guard:-4, stringLevel:'3', '':7 },
}));
check('魂格段階は0〜5へ正規化', broken.soulRankStage === 5 && normalizeSoulRankStage(-2) === 0 && normalizeSoulRankStage(3.9) === 3);
check('魂格P最高初到達Lvは500〜1000へ正規化', broken.soulPointMaxReachedLevel === 1000 && normalizeSoulPointMaxReachedLevel(-1) === 500);
check('魂格特性段階は非負整数へ正規化し空IDを捨てる',
  broken.soulTraitLevels.attack === 2 && broken.soulTraitLevels.guard === 0
  && broken.soulTraitLevels.stringLevel === 3 && !Object.prototype.hasOwnProperty.call(broken.soulTraitLevels, ''));
check('配列など壊れた魂格特性は空へ落とす',
  Object.keys(normalizeSoulTraitLevels([])).length === 0 && Object.keys(normalizeSoulTraitLevels(null)).length === 0);

check('魂格はⅠ〜Ⅴの5段階', SOUL_RANK_MAX_STAGE === 5 && SOUL_RANK_MAX_LEVEL_CAP === 1000);
for (let stage = 0; stage <= 5; stage++) {
  const expected = 500 + stage * 100;
  check(`魂格stage ${stage} の許可上限はLv${expected}`, soulRankLevelCap(stage) === expected);
  const normalized = normalizeMasuProgression(makeMasu(500, { soulRankStage:stage, levelCap:1000 }));
  check(`魂格stage ${stage} のlevelCapはLv${expected}を超えない`, normalized.levelCap === expected, `Lv${normalized.levelCap}`);
}
check('未超越なら魂格値が壊れていてもLv400上限',
  normalizeMasuProgression(makeMasu(400, { transcended:false, soulRankStage:5, levelCap:1000 })).levelCap === 400);
check('魂格0の超越個体は余剰XPを貯めずLv500で止まる', (() => {
  const result = applyBondXpGain(makeMasu(500), 999999999);
  return result.after.level === 500 && result.masu.bondXp === totalBondXpForLevel(500);
})());

check('既存のLv499→500 XPは変更しない', xpForBondLevelAt(499) === 148971, String(xpForBondLevelAt(499)));
[
  [500,160000],[599,184750],[600,210000],[699,234750],[700,265000],
  [799,314500],[800,345000],[899,394500],[900,430000],[999,519100],
].forEach(([level, expected]) => check(`Lv${level}→${level + 1} XP`, xpForBondLevelAt(level) === expected, String(xpForBondLevelAt(level))));
check('Lv500→600累計XP', xpTo(500,600) === 17237500, xpTo(500,600).toLocaleString());
check('Lv600→700累計XP', xpTo(600,700) === 22237500, xpTo(600,700).toLocaleString());
check('Lv700→800累計XP', xpTo(700,800) === 28975000, xpTo(700,800).toLocaleString());
check('Lv800→900累計XP', xpTo(800,900) === 36975000, xpTo(800,900).toLocaleString());
check('Lv900→1000累計XP', xpTo(900,1000) === 47455000, xpTo(900,1000).toLocaleString());
check('Lv500→1000累計は152,880,000XP', xpTo(500,1000) === 152880000, xpTo(500,1000).toLocaleString());
check('共通レベル計算は壊れた巨大XPでもLv1000を超えない', bondLevelInfo(Number.MAX_SAFE_INTEGER).level === 1000);

const stage1 = makeMasu(500, { soulRankStage:1, levelCap:600, soulPointMaxReachedLevel:500 });
const firstFive = applyBondXpGain(stage1, xpTo(500,505));
check('Lv500→505初到達で魂格P+5', firstFive.gainedSoulPoints === 5 && firstFive.masu.soulPointMaxReachedLevel === 505);
check('同時にLv帯どおり超越P+10', firstFive.gainedTranscendPoints === 10);
const replayFive = applyBondXpGain(makeMasu(500, {
  soulRankStage:1, levelCap:600, soulPointMaxReachedLevel:505, transcendPoints:10,
}), xpTo(500,505));
check('再到達では魂格Pを二重取得しない', replayFive.gainedSoulPoints === 0 && replayFive.masu.soulPointMaxReachedLevel === 505);
check('再到達でも超越PはLv帯どおり再取得する', replayFive.gainedTranscendPoints === 10);
const nextTwo = applyBondXpGain({ ...replayFive.masu }, xpTo(505,507));
check('過去最高を超えたLv506〜507だけ魂格P+2', nextTwo.gainedSoulPoints === 2 && nextTwo.masu.soulPointMaxReachedLevel === 507);
const allSoul = applyBondXpGain(makeMasu(500, { soulRankStage:5, levelCap:1000, soulPointMaxReachedLevel:500 }), xpTo(500,1000));
check('Lv501〜1000の魂格Pは最大500P', allSoul.gainedSoulPoints === 500 && allSoul.masu.soulPointMaxReachedLevel === 1000);

[
  [400,500,100],[500,600,200],[600,700,300],[700,800,400],[800,900,500],[900,1000,600],
].forEach(([from,to,expected]) => check(`Lv${from + 1}〜${to}の超越Pは合計${expected}`,
  gainedTranscendPointsBetweenLevels(from,to) === expected, String(gainedTranscendPointsBetweenLevels(from,to))));
check('Lv401〜1000の超越P合計は2100', gainedTranscendPointsBetweenLevels(400,1000) === 2100);
const crossBand = applyBondXpGain(makeMasu(595, { soulRankStage:2, levelCap:700, soulPointMaxReachedLevel:595 }), xpTo(595,605));
check('Lv595→605は実Lv帯で超越Pを合算する',
  crossBand.gainedTranscendPoints === 25 && crossBand.gainedSoulPoints === 10,
  `超越P+${crossBand.gainedTranscendPoints} / 魂格P+${crossBand.gainedSoulPoints}`);
const lowLevelStage5 = applyBondXpGain(makeMasu(500, { soulRankStage:5, levelCap:1000, soulPointMaxReachedLevel:1000 }), xpTo(500,501));
check('魂格ⅤでもLv501到達は6Pでなく2P', lowLevelStage5.gainedTranscendPoints === 2);

const reborn = resetMasuForRebirth(makeMasu(650, {
  soulRankStage:2, levelCap:700, soulPointMaxReachedLevel:650, soulTraitLevels:{ attack:7 }, transcendPoints:321,
}), { toLevel:550, levelCap:700 });
check('転生で魂格段階・上限を維持', reborn.soulRankStage === 2 && reborn.levelCap === 700);
check('転生で魂格P最高初到達Lvを維持', reborn.soulPointMaxReachedLevel === 650);
check('転生で魂格特性を維持', reborn.soulTraitLevels.attack === 7);
check('転生で既存の超越Pも維持', reborn.transcendPoints === 321);
check('転生後の実Lvだけ指定どおり下がる', masuBondLevelInfo(reborn).level === 550);

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exitCode = failed ? 1 : 0;
