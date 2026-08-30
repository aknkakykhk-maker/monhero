// 強化ポイントの総数・レベル帯・転生・既存セーブ補正が全経路で一致することを確認する。
//
//   node tools/masu/enhance-point-total-check.js
//
// 正本:
//   Lv.1→270   : 1レベルにつき1P
//   Lv.270→330 : 1レベルにつき2P（虹★4 / 34凸で解放）
//   Lv.330→400 : 1レベルにつき3P（虹★5 / 35凸で解放）
//
// 「現在35凸だからLv1から全部×3」のような遡及計算は禁止する。
const fs = require('fs');
const path = require('path');
const { REPO_ROOT, loadDyeModule } = require('../harness');
const source = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
const a = loadDyeModule();

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- ① 正本がレベル帯になっているか ---
check('総数の正本は現在の凸倍率を掛けない',
  source.includes('const levelBasedEnhancePoints = (level) =>')
    && source.includes('const gainedEnhancePointsBetweenLevels = (beforeLevel, afterLevel) =>')
    && !source.includes('const levelBasedEnhancePoints = (level, rebirthCount) =>'));
check('実レベルアップは前後レベルの差分を使う',
  source.includes('const gainedPoints = gainedEnhancePointsBetweenLevels(before.level, Math.min(cap, after.level));'));
check('読み込み補填も同じ正本を使う',
  source.includes('const earned = levelBasedEnhancePoints(masuBondLevelInfo(masu).level)'));
check('転生も同じ正本を使う',
  source.includes('const nextPoints = levelBasedEnhancePoints(nextLevel)'));
check('合体プレビューも同じ差分を使う',
  source.includes('const gainedLevelPoints = gainedEnhancePointsBetweenLevels(mainLvl.level, afterLvl.level);'));
check('スキップチケットも共通XP処理を通る',
  source.includes('return applyBondXpGain(mon, award.gain).masu;'));

const expectedByLevel = new Map([
  [1, 0], [150, 149], [270, 269], [271, 271], [330, 389], [331, 392], [400, 599], [500, 599],
]);
for (const [level, expected] of expectedByLevel) {
  check(`Lv${level}までのレベル由来P = ${expected}`, a.levelBasedEnhancePoints(level) === expected,
    `${a.levelBasedEnhancePoints(level)}`);
}
check('壊れた値でも0未満にならない',
  a.levelBasedEnhancePoints(0) === 0 && a.levelBasedEnhancePoints(null) === 0);

// 境界を1回・複数Lvでまたぐケース。
for (const [from, to, expected] of [
  [150,151,1], [269,270,1], [270,271,2], [269,271,3],
  [329,330,2], [330,331,3], [329,331,5], [398,400,6], [400,450,0],
]) {
  check(`Lv${from}→${to} の通常P = ${expected}`,
    a.gainedEnhancePointsBetweenLevels(from, to) === expected,
    `${a.gainedEnhancePointsBetweenLevels(from, to)}`);
}

// --- ② applyBondXpGain（バトル・合体・チケット共通）の実動作 ---
const makeMasu = (level, rebirthCount, over = {}) => a.normalizeMasuProgression({
  id:'m1', baseId:'Snegurochka', levelCap: rebirthCount >= 35 ? 400 : rebirthCount >= 34 ? 330 : 270,
  bondXp:a.totalBondXpForLevel(level), rebirthCount, reincarnateCount:0,
  distAptPoints:0, distAptBoosts:[0,0,0,0], statPoints:{hp:0,atk:0,def:0,guts:0}, ...over,
});
const levelTo = (m, to) => a.applyBondXpGain(m, a.totalBondXpForLevel(to) - (m.bondXp || 0));
check('35凸でもLv150→151は+1（過去帯へ×3しない）', levelTo(makeMasu(150,35),151).gainedPoints === 1);
check('34凸のLv320→325は+10', levelTo(makeMasu(320,34),325).gainedPoints === 10);
check('35凸のLv390→395は+15', levelTo(makeMasu(390,35),395).gainedPoints === 15);
check('35凸でLv269→271を一気に跨いでも+3', levelTo(makeMasu(269,35),271).gainedPoints === 3);

// --- ③ 実報告4個体を総数で固定する ---
const expectedTotal = (level, rebirthCount, reincarnateCount, inherited = 0) =>
  a.levelBasedEnhancePoints(level) + a.totalBreakthroughPoints(rebirthCount)
    + reincarnateCount * a.REINCARNATE_POINTS + inherited;
check('ヤオビクニ Lv150/35凸/転生4 = 228P', expectedTotal(150,35,4) === 228);
check('ウンディーネ Lv150/34凸/転生4 = 227P', expectedTotal(150,34,4) === 227);
check('パンドラ Lv232/33凸/転生7 = 338P', expectedTotal(232,33,7) === 338);
check('スネグーラチカ Lv331/35凸/転生5 = 481P', expectedTotal(331,35,5) === 481);

// --- ④ 転生で減らず、同じLvへ戻すと転生+10だけ増える ---
const GAIN = { hp:10, atk:3, def:3, guts:3 };
const totalPointsOf = (m) => {
  const rec = a.reconcileMasuPoints(a.normalizeMasuProgression(m));
  const boosts = (rec.distAptBoosts || [0,0,0,0]).reduce((s, v) => s + v, 0);
  const stat = Object.entries(rec.statPoints || {})
    .reduce((s, [k, v]) => s + Math.ceil((v || 0) / (GAIN[k] || 1)), 0);
  return boosts + stat + (rec.distAptPoints || 0);
};
const bad = [];
for (const level of [120,150,269,270,271,320,330,331,399,400]) {
  for (const rebirthCount of [0,33,34,35]) {
    const cap = rebirthCount >= 35 ? 400 : rebirthCount >= 34 ? 330 : 270;
    if (level > cap || level < a.REINCARNATE_MIN_LEVEL) continue;
    for (const reincarnateCount of [0,4]) {
      for (const inheritedPoints of [0,190]) {
        const masu = makeMasu(level, rebirthCount, {
          levelCap:cap, reincarnateCount, inheritedReincarnateBonusPoints:inheritedPoints,
        });
        const before = totalPointsOf(masu);
        const r = a.buildMasuReincarnation({ masu, skillKey:null, gold:10 ** 12 });
        if (!r.ok) { bad.push(`転生不可 Lv${level}/凸${rebirthCount}`); continue; }
        const back = { ...a.normalizeMasuProgression(r.nextMasu), bondXp:a.totalBondXpForLevel(level) };
        const after = totalPointsOf(back);
        if (after - before !== a.REINCARNATE_POINTS) {
          bad.push(`Lv${level}/凸${rebirthCount}/転生${reincarnateCount}/継承${inheritedPoints}: ${before}→${after}`);
        }
      }
    }
  }
}
check('転生→同じLvまで育て直すと総数はちょうど+10', bad.length === 0, bad.slice(0,4).join(' / '));

// --- ⑤ #827で既に増えたセーブの自動補正 ---
const badTotal = (level, rebirthCount, reincarnateCount, inherited = 0) =>
  a.legacyRetroactiveLevelBasedEnhancePoints(level, rebirthCount)
    + a.totalBreakthroughPoints(rebirthCount) + reincarnateCount * a.REINCARNATE_POINTS + inherited;
const yaobiBad = makeMasu(150,35,{ reincarnateCount:4, distAptPoints:526 });
const yaobiFixed = a.repairEnhancePointBandOvergrant(yaobiBad);
check('未使用Pだけで戻せるヤオビクニ相当は配分を崩さず526→228',
  yaobiFixed.distAptPoints === 228 && yaobiFixed.enhancePointBandRepairVersion === a.ENHANCE_POINT_BAND_REPAIR_VERSION);

// スネグー相当: 765P使用済み + 314P未使用 = 1079P。過剰598Pが未使用だけでは足りないので通常強化を白紙へ。
const snegBad = makeMasu(331,35,{
  reincarnateCount:5, distAptPoints:314,
  statPoints:{hp:1700, atk:867, def:621, guts:252}, // 170+289+207+84 = 750P
  distAptBoosts:[0,9,6,0], // 15P、合計使用765P
});
check('テスト前提: スネグー誤式総数は1079', badTotal(331,35,5) === 1079);
const snegFixed = a.repairEnhancePointBandOvergrant(snegBad);
check('過剰分を使用済みなら通常強化だけ白紙にして正しい481Pを返す',
  snegFixed.distAptPoints === 481
    && Object.values(snegFixed.statPoints).every(v => v === 0)
    && snegFixed.distAptBoosts.every(v => v === 0)
    && snegFixed.enhancePointBandRepairVersion === a.ENHANCE_POINT_BAND_REPAIR_VERSION,
  `unused=${snegFixed.distAptPoints}`);
check('補正済み個体へ二重適用しない', a.repairEnhancePointBandOvergrant(snegFixed) === snegFixed);

const legit = makeMasu(331,35,{ reincarnateCount:5, distAptPoints:481 });
check('誤式の総数まで増えていない正規個体は減らさない', a.repairEnhancePointBandOvergrant(legit) === legit);
const withLegacyExtra = makeMasu(331,35,{ reincarnateCount:5, distAptPoints:1079 + 12 });
const extraFixed = a.repairEnhancePointBandOvergrant(withLegacyExtra);
check('不具合以前からの余剰12Pは保持して481+12へ戻す', extraFixed.distAptPoints === 493, `${extraFixed.distAptPoints}`);

// --- ⑥ Lv401以降は通常Pを増やさず超越Pだけ ---
const transcended = makeMasu(400,35,{ levelCap:500, transcended:true });
const beyond = a.applyBondXpGain(transcended, a.totalBondXpForLevel(402) - transcended.bondXp);
check('Lv400→402は通常P+0・超越P+2', beyond.gainedPoints === 0 && beyond.gainedTranscendPoints === 2);

// --- ⑦ ヘルプと起動修復導線 ---
const helpSrc = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/help.js'), 'utf8');
check('ヘルプは倍率一覧を実データから表示する',
  helpSrc.includes("{ t:'data', id:'levelUpPointMultipliers' }") && source.includes("case 'levelUpPointMultipliers':"));
check('起動時はreconcileより先に既知過剰補正を行う',
  source.indexOf('savedMasuMons.map(repairEnhancePointBandOvergrant)') >= 0
    && source.indexOf('savedMasuMons.map(repairEnhancePointBandOvergrant)') < source.indexOf('savedMasuMons.map(reconcileMasuPoints)'));

console.log(failed === 0 ? '\n強化ポイントのレベル帯・転生・既存セーブ補正: PASS' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
