// 強化ポイントの「総数」の数え方が、どの経路でも同じであることを確認する。
//
//   node tools/masu/enhance-point-total-check.js
//
// 【なぜ要るか】
// 強化ポイントの総数を数える場所が3つある。
//
//   ・レベルアップしたとき(applyBondXpGain … バトル・合体・チケットの共通処理)
//   ・読み込み時の不足補填(reconcileMasuPoints)
//   ・転生で総数を作り直すとき(buildMasuReincarnation)
//
// ここが食い違うと、多く数える側で貯めたポイントが、少なく数える側を通った瞬間に消える。
// 実際に「限界突破34回以上なら1レベルにつき2〜3ポイント」という倍率が
// レベルアップにだけ効いていて、補填と転生は倍率なしで数えていたため、
// 倍率で稼いだぶんが転生のたびに丸ごと消え、レベルを上げ直しても戻らなかった。
// (Lv320・限界突破35の個体で、転生1回につき数百ポイント失われる状態だった)
//
// ここでは数え方が1つ(levelBasedEnhancePoints)にまとまっていることと、
// 実際に動かして「転生しても減らない」ことを確かめる。
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

// --- ① 数え方が1か所にまとまっているか ---
check('レベル由来の総数を出す共通関数がある',
  source.includes('const levelBasedEnhancePoints = (level, rebirthCount) =>')
    && source.includes('levelUpPointMultiplier(rebirthCount)'));
check('読み込み時の補填が共通関数を使う',
  source.includes('const earned = levelBasedEnhancePoints(masuBondLevelInfo(masu).level, masu.rebirthCount)'));
check('転生の総数計算が共通関数を使う',
  source.includes('const nextPoints = levelBasedEnhancePoints(nextLevel, normalized.rebirthCount)'));
// スキップチケットのレベルアップも、バトル・合体と同じ共通処理を通すこと。
// ここだけ「1レベル=1ポイント」で数えていた
check('スキップチケットのレベルアップも共通処理を通す',
  source.includes('return applyBondXpGain(mon, award.gain).masu;')
    && !source.includes('distAptPoints: (mon.distAptPoints || 0) + (after.level - before.level)'));
check('倍率なしで数え直している場所が残っていない',
  !source.includes('Math.max(0, Math.min(MAX_MASU_LEVEL_CAP, masuBondLevelInfo(masu).level) - 1)')
    && !source.includes('const nextPoints = (nextLevel - 1) +'));

// --- ② Lv400までで止まり、倍率が効いているか ---
check('Lv401以降は通常の強化ポイントを増やさない(超越ポイントの領域)',
  a.levelBasedEnhancePoints(400, 0) === a.levelBasedEnhancePoints(500, 0));
for (const n of [0, 33, 34, 35]) {
  const mult = a.levelUpPointMultiplier(n);
  check(`限界突破${n}回のレベル由来ぶんが 倍率${mult} で数えられる`,
    a.levelBasedEnhancePoints(320, n) === 319 * mult, `${a.levelBasedEnhancePoints(320, n)}点`);
}
check('壊れた値でも0未満にならない',
  a.levelBasedEnhancePoints(0, 0) === 0 && a.levelBasedEnhancePoints(null, null) === 0
    && a.levelBasedEnhancePoints(1, 35) === 0);

// --- ③ 実際に動かして、転生で減らないか ---
const GAIN = { hp:10, atk:3, def:3, guts:3 };
const totalPointsOf = (m) => {
  const rec = a.reconcileMasuPoints(a.normalizeMasuProgression(m));
  const boosts = (rec.distAptBoosts || [0,0,0,0]).reduce((s, v) => s + v, 0);
  const stat = Object.entries(rec.statPoints || {})
    .reduce((s, [k, v]) => s + Math.ceil((v || 0) / (GAIN[k] || 1)), 0);
  return boosts + stat + (rec.distAptPoints || 0);
};
const bad = [];
for (const level of [120, 150, 320, 399, 400, 450]) {
  for (const levelCap of [400, 500]) {
    if (levelCap < level) continue;
    for (const rebirthCount of [0, 33, 34, 35, 74]) {
      for (const reincarnateCount of [0, 4]) {
        for (const inheritedPoints of [0, 190]) {
          const masu = a.normalizeMasuProgression({
            id: 1, baseId: 'Snegurochka', levelCap, bondXp: a.totalBondXpForLevel(level),
            rebirthCount, reincarnateCount, inheritedReincarnateBonusPoints: inheritedPoints,
            distAptBoosts: [0,0,0,0], statPoints: { hp:0, atk:0, def:0, guts:0 }, distAptPoints: 0,
          });
          const before = totalPointsOf(masu);
          const r = a.buildMasuReincarnation({ masu, skillKey: null, gold: 10 ** 12 });
          if (!r.ok) continue;
          // 転生したあと、同じレベルまで上げ直す
          const back = { ...a.normalizeMasuProgression(r.nextMasu), bondXp: a.totalBondXpForLevel(level) };
          const after = totalPointsOf(back);
          if (after - before !== a.REINCARNATE_POINTS) {
            bad.push(`Lv${level}/上限${levelCap}/限界突破${rebirthCount}/転生${reincarnateCount}/継承${inheritedPoints}: ${before}→${after}`);
          }
        }
      }
    }
  }
}
check('どの条件でも、転生して同じレベルへ戻すと総数がちょうど転生ぶんだけ増える',
  bad.length === 0, bad.slice(0, 3).join(' / '));

// レベルアップの経路(バトル・合体で共通)でも、同じ倍率で配られること
const grown = a.applyBondXpGain(
  a.normalizeMasuProgression({ id:1, baseId:'Snegurochka', levelCap:400, rebirthCount:35, bondXp:0,
    distAptPoints:0, distAptBoosts:[0,0,0,0], statPoints:{ hp:0, atk:0, def:0, guts:0 } }),
  a.totalBondXpForLevel(320));
check('レベルアップで配られる量が共通関数と一致する',
  grown.masu.distAptPoints === a.levelBasedEnhancePoints(320, 35),
  `${grown.masu.distAptPoints} / ${a.levelBasedEnhancePoints(320, 35)}`);

// --- ④ ヘルプに倍率が書いてあるか ---
const helpSrc = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/help.js'), 'utf8');
check('倍率の一覧はヘルプへ手で書き写さず実データから作る',
  helpSrc.includes("{ t:'data', id:'levelUpPointMultipliers' }")
    && source.includes("case 'levelUpPointMultipliers':"));
check('限界突破の説明からも倍率へたどれる',
  helpSrc.includes('回数が進むと、レベルアップ1回でもらえる強化ポイントそのものが増えます'));

console.log(failed === 0 ? '\n強化ポイントの総数の数え方: PASS' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
