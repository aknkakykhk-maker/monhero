const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 周回終了時の絆経験値配分を、本番ソースの計算関数と終了経路から検証する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const sourcePath = path.join(TOOLS_DIR, '..', 'monster-hero', 'src', 'game-system.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const prefix = source.slice(0, source.indexOf('// =====================================================================\n// AUDIO:'));
const reconcileSource = source.match(/const reconcileMasuPoints = \(masu\) => \{[\s\S]*?\n\};/)?.[0];
const context = {
  React: { createElement: () => null, useState(){}, useEffect(){}, useCallback(){}, useMemo(){}, useRef(){} },
  ALL_PLAYER_MONSTERS: { base: { distAptitude:['C','C','C','C'] } },
};
vm.createContext(context);
vm.runInContext(`${prefix}\nconst STAT_POINT_GAIN={hp:10,atk:3,def:3,guts:3};\n${reconcileSource}\nglobalThis.__bondRewards = { buildRunBondAwards, bondLevelInfo, levelInfo, cappedBondXp, applyBondXpGain, reconcileMasuPoints, totalBondXpForLevel, xpForLevel, xpForBondLevel, BOND_XP_DISCOUNT };`, context);
const { buildRunBondAwards, bondLevelInfo, levelInfo, cappedBondXp, applyBondXpGain, reconcileMasuPoints, totalBondXpForLevel, xpForLevel, xpForBondLevel, BOND_XP_DISCOUNT } = context.__bondRewards;

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const masuMons = [
  { id:'hero', bondXp:0, levelCap:30 },
  { id:'joined', bondXp:0, levelCap:30 },
  { id:'bench', bondXp:0, levelCap:30 },
  { id:'outside', bondXp:0, levelCap:30 },
  { id:'no-xp', levelCap:30 },
];
const awards = buildRunBondAwards({
  gain:101,
  heroMasuId:'hero',
  participantMasuIds:['hero','joined','joined'],
  monsterRosterIds:['masu:hero','masu:joined','masu:bench','masu:bench','masu:no-xp','Mocchi'],
  masuMons,
});
const byId = new Map(awards.map(award => [award.masuId, award]));
check('勇者モンへ100%付与', byId.get('hero')?.gain === 101 && byId.get('hero')?.rate === 1);
check('バトル参加マスモンへ50%を切り捨てて付与', byId.get('joined')?.gain === 50 && byId.get('joined')?.rate === 0.5);
check('編成内の控えマスモンへ25%を切り捨てて付与', byId.get('bench')?.gain === 25 && byId.get('bench')?.rate === 0.25);
check('参加個体へ50%と25%を重複付与しない', awards.filter(award => award.masuId === 'joined').length === 1);
check('同一個体の複数枠を一度にまとめる', awards.filter(award => award.masuId === 'bench').length === 1);
check('編成外と絆経験値を持たない個体は対象外', !byId.has('outside') && !byId.has('no-xp'));
check('控えはリザルト表示対象にしない', byId.get('bench')?.showInResult === false && byId.get('joined')?.showInResult === true);
check('0WAVE相当の獲得0では誰にも付与しない', buildRunBondAwards({ gain:0, heroMasuId:'hero', participantMasuIds:['joined'], monsterRosterIds:['masu:bench'], masuMons }).length === 0);

const levelStartXp = totalBondXpForLevel(2) - 1;
const levelingMasu = { id:'leveling', bondXp:levelStartXp, levelCap:30 };
const before = bondLevelInfo(levelingMasu.bondXp);
const afterXp = cappedBondXp(levelingMasu, 2);
const after = bondLevelInfo(afterXp);
const pointsAfter = 3 + (after.level - before.level);
check('レベル上昇数ぶん強化ポイントを加算できる', after.level - before.level === 1 && pointsAfter === 4);
const cappedMasu = { id:'capped', bondXp:totalBondXpForLevel(30) - 1, levelCap:30 };
check('既存のレベル上限で絆経験値を打ち止める', cappedBondXp(cappedMasu, 999999) === totalBondXpForLevel(30));

// トレーニングチケット(15XP)・修行チケット(150XP)も通常報酬と同じ共通処理を通す。
const xpJustBefore = level => totalBondXpForLevel(level) - 1;
const noLevel = applyBondXpGain({ id:'ticket-0', bondXp:totalBondXpForLevel(10), levelCap:30, distAptPoints:4 }, 1);
check('チケットでレベルが上がらなければ強化ポイント+0', noLevel.gainedLevels === 0 && noLevel.masu.distAptPoints === 4);
const oneLevel = applyBondXpGain({ id:'ticket-1', bondXp:xpJustBefore(10), levelCap:30, distAptPoints:4 }, 1);
check('トレーニングチケットで1レベル上昇ぶんを付与', oneLevel.gainedLevels === 1 && oneLevel.masu.distAptPoints === 5);
const threeStart = totalBondXpForLevel(10);
const threeGain = totalBondXpForLevel(13) - threeStart;
const threeLevels = applyBondXpGain({ id:'ticket-3', bondXp:threeStart, levelCap:30, distAptPoints:2 }, threeGain);
check('複数枚使用で3レベル上昇ぶんをすべて付与', threeLevels.before.level === 10 && threeLevels.after.level === 13 && threeLevels.gainedLevels === 3 && threeLevels.masu.distAptPoints === 5);
const largeTicket = applyBondXpGain({ id:'large-ticket', bondXp:xpJustBefore(10), levelCap:30, distAptPoints:0 }, 150);
check('修行チケットも共通処理で全上昇レベルぶんを付与', largeTicket.gainedLevels > 0 && largeTicket.masu.distAptPoints === largeTicket.gainedLevels);
const capArrival = applyBondXpGain({ id:'cap', bondXp:totalBondXpForLevel(29), levelCap:30, distAptPoints:7 }, 999999);
check('上限到達時は到達した1レベルぶんだけ付与', capArrival.after.level === 30 && capArrival.gainedLevels === 1 && capArrival.masu.distAptPoints === 8);
const deficient = { id:'old', baseId:'base', bondXp:totalBondXpForLevel(10), levelCap:30, distAptPoints:2, distApt:['C','C','C','C'], statPoints:{} };
const repairedOnce = reconcileMasuPoints(deficient);
const repairedTwice = reconcileMasuPoints(repairedOnce);
check('既存不足分はreconcileMasuPointsで不足分だけ補填', repairedOnce.distAptPoints === 9);
check('reconcileMasuPointsを再実行しても二重付与しない', repairedTwice.distAptPoints === repairedOnce.distAptPoints);
check('両チケットが共通処理を使い結果表示に実付与量を渡す',
  /const result = applyBondXpGain\(masu, gain\)/.test(source)
    && source.includes('強化ポイント +{preview.gainedPoints}')
    && /id:'training_ticket'[^\n]*bondXp:15/.test(fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero', 'data', 'breeder.js'), 'utf8'))
    && /id:'training_ticket_l'[^\n]*bondXp:150/.test(fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero', 'data', 'breeder.js'), 'utf8')));

// --- 虹★4・5のレベルアップ強化ポイント倍率 ---
const gainLevelsAt = (rebirthCount, from, to) => applyBondXpGain({
  id:`rainbow-${rebirthCount}`, rebirthCount, levelCap:rebirthCount === 34 ? 330 : 400,
  bondXp:totalBondXpForLevel(from), distAptPoints:0,
}, totalBondXpForLevel(to) - totalBondXpForLevel(from));
for (const [count, multiplier] of [[33,1],[34,2],[35,3]]) {
  const result = gainLevelsAt(count, count === 35 ? 330 : 270, count === 35 ? 331 : 271);
  check(`${count}凸は1Lvにつき+${multiplier}`, result.gainedLevels === 1 && result.gainedPoints === multiplier && result.masu.distAptPoints === multiplier);
}
const rainbow4Multi = gainLevelsAt(34,270,280);
const rainbow5Multi = gainLevelsAt(35,330,340);
check('34凸で複数Lv上昇は上昇Lv数×2', rainbow4Multi.gainedLevels === 10 && rainbow4Multi.gainedPoints === 20);
check('35凸で複数Lv上昇は上昇Lv数×3', rainbow5Multi.gainedLevels === 10 && rainbow5Multi.gainedPoints === 30);
check('Lv330までは虹4倍率', gainLevelsAt(34,329,330).gainedPoints === 2);
check('35凸後のLv331～400は虹5倍率', gainLevelsAt(35,331,400).gainedPoints === 69 * 3);
check('35凸/Lv400で停止', gainLevelsAt(35,400,401).gainedLevels === 0);
check('経験値取得方法に依存せず共通処理だけが倍率を決める',
  /const pointMultiplier = levelUpPointMultiplier\(masu\?\.rebirthCount\)/.test(source)
  && ['applyBondXpGain(masu, gain)','applyBondXpGain(prepared, gainedXp)','applyBondXpGain(m, award.gain, autoRepeatBondLevelCap)'].every(call=>source.includes(call)));

// --- 必要経験値の緩和(0.05 → 0.025) ---
// 1レベルぶんの必要XP = round(50 × Lv^1.4 × BOND_XP_DISCOUNT)。係数を下げると必要XPが下がる
check('絆の必要経験値の係数が0.025になっている', BOND_XP_DISCOUNT === 0.025);
check('必要経験値の式が基準値×係数のまま', xpForBondLevel(10) === Math.max(1, Math.round(xpForLevel(10) * BOND_XP_DISCOUNT)));
const prevXpForBondLevel = (level) => Math.max(1, Math.round(xpForLevel(level) * 0.05));
const prevTotalForLevel = (level) => { let total = 0; for (let i = 1; i < level; i++) total += prevXpForBondLevel(i); return total; };
check('各レベルの必要経験値が緩和前の半分ぶん(端数は切り上がる)',
  [2, 5, 10, 20, 29].every(lv => xpForBondLevel(lv) <= Math.ceil(prevXpForBondLevel(lv) / 2)));
// 1レベルごとに四捨五入するため厳密な1/2にはならない。ほぼ半分(誤差1%以内)であればよい
check('Lv30到達までの累計がほぼ半分',
  Math.abs(totalBondXpForLevel(30) / prevTotalForLevel(30) - 0.5) < 0.01,
  `${prevTotalForLevel(30)} → ${totalBondXpForLevel(30)}`);
const prevBondLevel = (totalXp) => { let level = 1, xp = totalXp; for (let i = 0; i < 200; i++) { const need = prevXpForBondLevel(level); if (xp < need) break; xp -= need; level++; } return level; };
check('同じ絆経験値なら緩和後のレベルが必ず緩和前以上',
  [0, 100, 500, 1500, 3000].every(xp => bondLevelInfo(xp).level >= prevBondLevel(xp)));
check('緩和で既存の絆経験値のレベルが実際に上がる', bondLevelInfo(prevTotalForLevel(10)).level > 10);

check('敗北・リタイアは共通の報酬関数を呼ぶ', /await awardRunRewards\(Math\.max\(0, wave - 1\)\)/.test(source) && /setGaveUp\(true\)/.test(source));
check('通常クリアと最終クリアの報酬経路が存在する', /await awardRunRewards\(10\)/.test(source) && /waveHistory/.test(source));
check('同期ロックで終了経路からの重複付与を防ぐ', /if \(rewardsAwardedRef\.current\) return;\s*rewardsAwardedRef\.current = true;/.test(source));
check('控えを既存リザルト配列へ追加していない', /bondAwards\.filter\(award => award\.rate === 0\.5 && award\.showInResult\)/.test(source));

// リザルトで「Lv.いくつ → いくつ」「累計経験値の変化」を出すための材料
check('レベル情報が累計経験値も持つ', bondLevelInfo(1234).totalXp === 1234 && levelInfo(5678).totalXp === 5678);
check('リザルトのバーがLv変化と累計を出す',
  source.includes('Lv.{levelBefore.level} → Lv.{levelAfter.level}')
    && source.includes('累計 {totalBefore.toLocaleString()} → {totalAfter.toLocaleString()}'));
check('リザルトのダイヤが増えた分も出す', source.includes('(+{(summary.goldAfter-summary.goldBefore).toLocaleString()})'));

process.exit(failed ? 1 : 0);
