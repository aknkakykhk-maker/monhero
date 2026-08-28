const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// エンドゲーム育成「超越」を確認する。
//
//   node tools/masu/transcendence-check.js
//
// 見ているもの:
//   ① 資格(35凸・Lv400・未超越)とコスト(虹のプシュケー5,000 / ダイヤ1,000,000)
//   ② Lv上限(未超越はLv400で停止 / 超越済みはLv500まで、Lv501にはならない)
//   ③ 必要経験値(Lv399以下は一切変えない / Lv400以降だけ超越倍率)
//   ④ ポイント(Lv401以降は通常強化Pを配らず超越P。reconcileも誤補填しない)
//   ⑤ 虹のプシュケー→超越Pの交換
//   ⑥ 超越Pで上げた基礎値(通常リセット・転生で消えない / Mを超えない / 総合力+10相当)
//   ⑦ 旧セーブが未超越として正常に読めること
//   ⑧ 35凸のまま36凸を作っていないこと
//
// 式をこのファイルへ書き写すと、本体を変えたときにテストだけ古くなる。
// そのため計算は必ず本体から切り出した実装を動かして確かめる。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const help = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const changelog = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');
const assistants = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
const breeder = fs.readFileSync(path.join(root, 'monster-hero/data/breeder.js'), 'utf8');
const TRANSCEND_STAT_KEYS_ALL = ['hp', 'atk', 'def', 'guts'];

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const slice = (from, to) => {
  const i = source.indexOf(from);
  const j = source.indexOf(to, i);
  if (i < 0 || j <= i) {
    console.log(`NG: 本体から切り出せませんでした（${from}）`);
    process.exit(1);
  }
  return source.slice(i, j);
};

// ---- 本体の実装をそのまま動かす ----
const sandbox = {
  console,
  ALL_PLAYER_MONSTERS: {
    Test: { id: 'Test', name: 'テスト種', baseHp: 600, baseAtk: 220, baseDef: 200, baseGuts: 180,
      distAptitude: ['C', 'C', 'C', 'C'], plusStats: {}, unique: null },
  },
  DIST_APTITUDE_GRADES: ['G','F','E','D','C','B','A','S','S+','SS','SS+','M'],
  INITIAL_MASU_LEVEL_CAP: 30,
  MAX_UNIQUE_SKILL_LEVEL: 8,
  BREAKTHROUGH_STARS_PER_TIER: 5,
  uniqueSkillAtLevel: (unique) => unique,
  resolveInheritedUniqueLevel: () => 0,
  totalReincarnatePoints: (n) => Math.max(0, Math.floor(Number(n) || 0)),
  donationDiamondValue: (v) => Math.max(0, Math.floor(Number(v) || 0)),
  STAT_POINT_GAIN: { hp: 10, atk: 3, def: 3, guts: 3 },
  STAT_POINT_KEYS: { hp: 'ライフ', atk: 'ちから', def: '丈夫さ', guts: 'ガッツ' },
};
vm.createContext(sandbox);
vm.runInContext([
  slice('const XP_CURVE_EXPONENT', 'const xpForBreederLevel'),
  slice('// 【超越】Lv400', 'const INITIAL_MASU_LEVEL_CAP'),
  slice('const MAX_BOND_LEVEL_ITERATIONS', 'const MAX_UNIQUE_SKILL_LEVEL'),
  slice('const totalBondXpForLevel', '// 【限界突破と転生】'),
  slice('const MAX_MASU_LEVEL_CAP = 400;', 'const RAINBOW_STAR_IMAGE'),
  slice('const isFinalBreakthroughCount', 'const breakthroughStarStyle'),
  slice('const ownReincarnateBonusPoints', 'const migrateRebornMasuToFullReset'),
  slice('const cappedBondXp', '// 絆経験値の加算'),
  slice('const applyBondXpGain', '// 周回終了時の絆経験値配布先'),
  'const masuBondLevelInfo = (masu) => bondLevelInfo(cappedBondXp(masu));',
  // mergeMasuIntoMon は固有技設定(並び順・初期技)も解決するので、その正規化もそのまま持ち込む
  "const INHERITED_UNIQUE_LEVEL_KEY_PREFIX = 'inhId:';",
  slice('const inheritedUniqueLevelKey = (unique) =>', 'const isValidInheritedUnique'),
  slice('const OWN_UNIQUE_KEY =', '// 構造ベースの冪等移行'),
  slice('const getMasuColors', '// ==================== 総合力'),
  slice('const MONSTER_POWER_STAT_WEIGHT', '// 保存データのマスモンから総合力'),
  'const masuPowerOf = (masu) => monsterPowerOf(mergeMasuIntoMon(masu));',
  slice('const applyEnhancePlanToMasu', '// ==================== 超越'),
  slice('// ==================== 超越', '// リセット直前の'),
  slice('const buildBondResetAllocationSnapshot', '// 保存済みスナップショットを'),
  slice('const reconcileMasuPoints', 'const RANGE_STYLES'),
].join('\n'), sandbox);
const G = (name) => vm.runInContext(name, sandbox);

const totalXp = G('totalBondXpForLevel');
const xpAt = G('xpForBondLevelAt');
const xpNormal = G('xpForBondLevel');
const bondInfo = G('bondLevelInfo');
const levelOf = G('masuBondLevelInfo');
const canTranscend = G('canTranscendMasu');
const buildTranscend = G('buildMasuTranscendence');
const exchange = G('transcendPsycheExchange');
const applyExchange = G('applyTranscendExchange');
const applyPlan = G('applyTranscendPlanToMasu');
const applyBondXp = G('applyBondXpGain');
const applyEnhance = G('applyEnhancePlanToMasu');
const merge = G('mergeMasuIntoMon');
const powerOf = G('masuPowerOf');
const normalize = G('normalizeMasuProgression');
const resetForRebirth = G('resetMasuForRebirth');
const reconcile = G('reconcileMasuPoints');
const snapshot = G('buildBondResetAllocationSnapshot');
const MAX_CAP = G('MAX_MASU_LEVEL_CAP');
const TRANSCEND_CAP = G('TRANSCEND_LEVEL_CAP');
const PSYCHE_COST = G('TRANSCEND_PSYCHE_COST');
const DIAMOND_COST = G('TRANSCEND_DIAMOND_COST');

const masu = (over = {}) => ({
  id: 'm1', baseId: 'Test', name: 'テスト', bondXp: totalXp(MAX_CAP), distAptPoints: 0,
  statPoints: { hp: 0, atk: 0, def: 0, guts: 0 }, distAptBoosts: [0, 0, 0, 0],
  rebirthCount: 35, levelCap: MAX_CAP, ...over,
});
const transcended = (over = {}) => masu({ transcended: true, levelCap: TRANSCEND_CAP, ...over });

// ---- ① 資格とコスト ----
check('35凸・Lv400なら超越できる', canTranscend(masu()).ok);
check('34凸では超越できない', !canTranscend(masu({ rebirthCount: 34 })).ok, canTranscend(masu({ rebirthCount: 34 })).reason);
check('35凸でもLv399では超越できない', !canTranscend(masu({ bondXp: totalXp(399) })).ok);
check('超越済みは再超越できない', !canTranscend(transcended()).ok);
check('コストは虹のプシュケー5,000・ダイヤ1,000,000', PSYCHE_COST === 5000 && DIAMOND_COST === 1000000);
check('プシュケー4,999では成立しない', !buildTranscend({ masu: masu(), gold: DIAMOND_COST, psycheOwned: 4999 }).ok);
check('プシュケー5,000なら条件を満たす', buildTranscend({ masu: masu(), gold: DIAMOND_COST, psycheOwned: 5000 }).ok);
check('ダイヤ999,999では成立しない', !buildTranscend({ masu: masu(), gold: 999999, psycheOwned: PSYCHE_COST }).ok);
check('ダイヤ1,000,000なら条件を満たす', buildTranscend({ masu: masu(), gold: 1000000, psycheOwned: PSYCHE_COST }).ok);
const success = buildTranscend({ masu: masu(), gold: DIAMOND_COST + 7, psycheOwned: PSYCHE_COST + 3 });
check('成功時はちょうど5,000 / 1,000,000だけ消費する',
  success.nextPsyche === 3 && success.nextGold === 7, `psyche→${success.nextPsyche} / gold→${success.nextGold}`);
check('失敗時は消費量を返さない（プシュケーもダイヤも減らさない）', (() => {
  const failure = buildTranscend({ masu: masu(), gold: 0, psycheOwned: 0 });
  return failure.ok === false && failure.nextPsyche === undefined && failure.nextGold === undefined;
})());

// ---- ② Lv上限と限界突破 ----
check('超越してもレベルは400のまま・上限だけ500になる',
  levelOf(success.nextMasu).level === MAX_CAP && success.nextMasu.levelCap === TRANSCEND_CAP,
  `Lv${levelOf(success.nextMasu).level} / ${success.nextMasu.levelCap}`);
check('未超越はLv400で止まる', levelOf(masu({ bondXp: totalXp(MAX_CAP) + 99999999 })).level === MAX_CAP);
check('超越済みはLv500まで伸びる', levelOf(transcended({ bondXp: totalXp(TRANSCEND_CAP) })).level === TRANSCEND_CAP);
check('Lv501にはならない',
  levelOf(transcended({ bondXp: totalXp(TRANSCEND_CAP) + 99999999 })).level === TRANSCEND_CAP
  && bondInfo(Number.MAX_SAFE_INTEGER).level <= TRANSCEND_CAP);
check('限界突破は35回のまま・36凸を作っていない',
  success.nextMasu.rebirthCount === 35 && G('FINAL_BREAKTHROUGH_COUNT') === 35
  && G('breakthroughLevelCap')(36) === G('breakthroughLevelCap')(35)
  && !/FINAL_BREAKTHROUGH_COUNT\s*=\s*36/.test(source));
check('限界突破の天井(MAX_MASU_LEVEL_CAP)は400のまま', MAX_CAP === 400);
check('超越済みでも限界突破の対象にならない（上限がMAXを超えているため）',
  source.includes('if (normalized.levelCap >= MAX_MASU_LEVEL_CAP) return { ok:false')
  && normalize(transcended()).levelCap > MAX_CAP);

// ---- ③ 必要経験値 ----
check('Lv399以下の必要XPは変更前と一致する',
  [1, 30, 100, 250, 399].every(level => xpAt(level) === xpNormal(level)),
  `399→400=${xpAt(399)}`);
check('Lv301→Lv400の累計XPが変わっていない', totalXp(400) - totalXp(301) === 451913,
  `${(totalXp(400) - totalXp(301)).toLocaleString()}`);
[[400, 54930], [401, 55671], [409, 61770], [499, 148971]].forEach(([level, want]) => {
  check(`Lv${level}→${level + 1} = ${want.toLocaleString()} XP`, xpAt(level) === want, `${xpAt(level).toLocaleString()}`);
});
check('Lv400以降は「通常式 × (10 + (Lv-400)×0.1)」で出す',
  [400, 420, 470, 499].every(level => xpAt(level) === Math.round(xpNormal(level) * (10 + (level - 400) * 0.1))));
// 依頼書の累計値(583,227 / 9,847,764)は上のレベル別の値の合計と一致しないため、
// レベル別の式(依頼書の計算順序どおり)を正として、その合計を記録する
check('Lv400→410の累計は各レベルの必要XPの合計',
  totalXp(410) - totalXp(400) === [400,401,402,403,404,405,406,407,408,409].reduce((sum, level) => sum + xpAt(level), 0),
  `${(totalXp(410) - totalXp(400)).toLocaleString()}`);
check('Lv400→500の累計は各レベルの必要XPの合計', (() => {
  let sum = 0;
  for (let level = 400; level < 500; level++) sum += xpAt(level);
  return totalXp(500) - totalXp(400) === sum;
})(), `${(totalXp(500) - totalXp(400)).toLocaleString()}`);

// ---- ④ ポイント ----
const levelUp = (from, to, over = {}) => applyBondXp(transcended({ bondXp: totalXp(from), ...over }), totalXp(to) - totalXp(from));
check('Lv400→401で通常の強化ポイントは増えない', levelUp(400, 401).gainedPoints === 0);
check('Lv400→401で超越ポイントが+1', levelUp(400, 401).gainedTranscendPoints === 1);
check('複数レベル上がったぶんだけ超越ポイントが増える', levelUp(400, 412).gainedTranscendPoints === 12);
check('400をまたぐと400までは通常P・401以降は超越P', (() => {
  const result = levelUp(398, 402);
  return result.gainedPoints === 2 * 3 && result.gainedTranscendPoints === 2; // 35凸は通常Pが×3
})());
check('35凸のLvUP強化ポイント×3はLv400までそのまま', (() => {
  const result = applyBondXp(masu({ bondXp: totalXp(390) }), totalXp(395) - totalXp(390));
  return result.pointMultiplier === 3 && result.gainedPoints === 15 && !result.gainedTranscendPoints;
})());
check('34凸の×2も変わらない', (() => {
  const result = applyBondXp(masu({ rebirthCount: 34, levelCap: 330, bondXp: totalXp(320) }), totalXp(325) - totalXp(320));
  return result.pointMultiplier === 2 && result.gainedPoints === 10;
})());
check('reconcileはLv401以降を通常強化ポイントとして補填しない', (() => {
  const atCap = reconcile(transcended({ bondXp: totalXp(MAX_CAP), distAptPoints: 0 }));
  const beyond = reconcile(transcended({ bondXp: totalXp(450), distAptPoints: 0 }));
  return atCap.distAptPoints === beyond.distAptPoints;
})(), `Lv400=${reconcile(transcended({ bondXp: totalXp(MAX_CAP) })).distAptPoints} / Lv450=${reconcile(transcended({ bondXp: totalXp(450) })).distAptPoints}`);
check('reconcileはLv400までの不足はこれまでどおり補填する',
  reconcile(masu({ bondXp: totalXp(100), distAptPoints: 0 })).distAptPoints > 0);

// ---- ⑤ 交換 ----
check('虹のプシュケー1,000個 → 超越ポイント1', exchange(1000, 1).points === 1 && exchange(1000, 1).psycheCost === 1000);
check('10,000個 → 10ポイント', exchange(10000, 10).points === 10 && exchange(10000, 10).psycheCost === 10000);
check('999個では交換できない', !exchange(999, 1).ok && exchange(999, 1).psycheCost === 0);
check('MAX交換は1,000個単位で端数を残す', (() => {
  const plan = exchange(10999, Number.MAX_SAFE_INTEGER);
  return plan.points === 10 && plan.psycheCost === 10000 && plan.nextPsyche === 999;
})());
check('所持数がマイナスにならない', exchange(-50, 5).points === 0 && exchange(0, 5).nextPsyche === 0);
// 超越強化は「神殿で正式に超越したか」とは切り離してある。どのマスモンでも使える
check('超越前の個体でも交換できる', (() => {
  const applied = applyExchange(masu({ transcendPoints: 0, rebirthCount: 0, bondXp: 0 }), 10000, 5);
  return !!applied && applied.points === 5 && applied.psycheCost === 5000
    && applied.nextMasu.transcendPoints === 5 && applied.nextMasu.transcended !== true;
})());
check('交換した超越Pは選んだ個体へ入る', (() => {
  const applied = applyExchange(transcended({ transcendPoints: 2 }), 5000, 5);
  return applied.nextMasu.transcendPoints === 7 && applied.nextPsyche === 0;
})());

// ---- ⑥ 基礎強化 ----
const withPoints = transcended({ transcendPoints: 20 });
const basePower = powerOf(withPoints);
[['hp', 10], ['atk', 3], ['def', 3], ['guts', 3]].forEach(([key, gain]) => {
  const applied = applyPlan(withPoints, { apt: [0, 0, 0, 0], stat: { [key]: 1 } });
  check(`超越P1で ${key} の基礎+${gain}`, applied.masu.transcendStatPoints[key] === gain && applied.masu.transcendPoints === 19);
  check(`  総合力が+10相当になる`, powerOf(applied.masu) - basePower === 10, `${powerOf(applied.masu) - basePower}`);
});
const aptApplied = applyPlan(withPoints, { apt: [1, 0, 0, 0], stat: {} });
check('超越P1で間合い適性が1段階上がる',
  merge(aptApplied.masu).distAptitude[0] === 'B' && powerOf(aptApplied.masu) - basePower === 10);
check('間合い適性はMを超えない', (() => {
  let current = transcended({ transcendPoints: 50 });
  for (let i = 0; i < 20; i++) {
    const applied = applyPlan(current, { apt: [1, 0, 0, 0], stat: {} });
    if (!applied) break;
    current = applied.masu;
  }
  const grades = sandbox.DIST_APTITUDE_GRADES;
  return merge(current).distAptitude[0] === grades[grades.length - 1]
    && current.transcendAptBoosts[0] === grades.indexOf('M') - grades.indexOf('C');
})(), `boost=${(() => { let c = transcended({ transcendPoints: 50 }); for (let i = 0; i < 20; i++) { const a = applyPlan(c, { apt: [1, 0, 0, 0], stat: {} }); if (!a) break; c = a.masu; } return c.transcendAptBoosts[0]; })()}`);
check('持っている超越Pを超えて振れない', applyPlan(transcended({ transcendPoints: 1 }), { apt: [0, 0, 0, 0], stat: { hp: 2 } }) === null);
check('未超越・低Lvの個体でも超越強化できる', (() => {
  const plain = masu({ transcendPoints: 5, rebirthCount: 0, bondXp: 0, levelCap: 30 });
  const applied = applyPlan(plain, { apt: [1, 0, 0, 0], stat: { hp: 1 } });
  return !!applied && applied.used === 2 && applied.masu.transcendStatPoints.hp === 10
    && applied.masu.transcendAptBoosts[0] === 1 && applied.masu.transcendPoints === 3;
})());
// 超越強化しただけでは「超越済み」にならない(マーク・Lv上限500・Lv401以降を勝手に開けない)
check('超越強化しても transcended は false のまま・Lv上限も変わらない', (() => {
  const plain = masu({ transcendPoints: 5, rebirthCount: 0, bondXp: totalXp(200), levelCap: 200 });
  const applied = applyPlan(plain, { apt: [0, 0, 0, 0], stat: { hp: 3 } });
  const after = normalize(applied.masu);
  return after.transcended === false && after.levelCap === 200
    && levelOf(applied.masu).level === 200;
})());
check('超越強化した基礎値は能力と総合力へ反映される', (() => {
  const plain = masu({ transcendPoints: 5, rebirthCount: 0, bondXp: 0, levelCap: 30 });
  const applied = applyPlan(plain, { apt: [0, 0, 0, 0], stat: { hp: 1 } });
  return merge(applied.masu).baseHp - merge(plain).baseHp === 10
    && powerOf(applied.masu) - powerOf(plain) === 10;
})());
// あとから正式に超越しても、それまでの超越強化と未使用の超越Pを引き継ぐ
check('未超越で貯めた超越P・基礎値は、正式な超越で失われない', (() => {
  const grown = applyPlan(masu({ transcendPoints: 8 }), { apt: [2, 0, 0, 0], stat: { hp: 1, atk: 1 } }).masu;
  const result = buildTranscend({ masu: grown, gold: DIAMOND_COST, psycheOwned: PSYCHE_COST });
  const after = normalize(result.nextMasu);
  return result.ok && after.transcended === true
    && after.transcendPoints === normalize(grown).transcendPoints
    && after.transcendStatPoints.hp === normalize(grown).transcendStatPoints.hp
    && after.transcendStatPoints.atk === normalize(grown).transcendStatPoints.atk
    && after.transcendAptBoosts[0] === normalize(grown).transcendAptBoosts[0];
})());
check('正式な超越で超越Pを二重に配らない', (() => {
  const grown = masu({ transcendPoints: 4 });
  const result = buildTranscend({ masu: grown, gold: DIAMOND_COST, psycheOwned: PSYCHE_COST });
  return normalize(result.nextMasu).transcendPoints === 4;
})());
check('超越強化は通常の強化ポイント・statPointsに触らない', (() => {
  const before = transcended({ transcendPoints: 5, distAptPoints: 7, statPoints: { hp: 30, atk: 0, def: 0, guts: 0 } });
  const applied = applyPlan(before, { apt: [1, 0, 0, 0], stat: { hp: 1 } });
  return applied.masu.distAptPoints === 7 && applied.masu.statPoints.hp === 30
    && JSON.stringify(applied.masu.distAptBoosts) === JSON.stringify([0, 0, 0, 0]);
})());
check('通常リセットで戻す対象に超越ぶんを含めない', (() => {
  // 通常強化で適性を1段階、超越で1段階上げた個体のスナップショットは「通常ぶんの1」だけ
  const withTranscend = applyPlan(transcended({ transcendPoints: 3, distAptPoints: 2 }), { apt: [1, 0, 0, 0], stat: {} }).masu;
  const withNormal = applyEnhance(withTranscend, { apt: [1, 0, 0, 0], stat: {} }).masu;
  const snap = snapshot(withNormal, sandbox.ALL_PLAYER_MONSTERS.Test);
  return merge(withNormal).distAptitude[0] === 'A' && snap.apt[0] === 1;
})());
check('通常リセット相当で超越の基礎値は消えない', (() => {
  const enhanced = applyPlan(transcended({ transcendPoints: 3 }), { apt: [1, 0, 0, 0], stat: { hp: 1 } }).masu;
  // 絆ポイントリセットは statPoints / distAptBoosts / distAptPoints だけを戻す
  const reset = { ...enhanced, statPoints: { hp: 0, atk: 0, def: 0, guts: 0 }, distAptBoosts: [0, 0, 0, 0], distAptPoints: 9 };
  return reset.transcendStatPoints.hp === 10 && merge(reset).distAptitude[0] === 'B'
    && normalize(reset).transcendPoints === 1;
})());
check('転生しても超越状態・上限500・超越の基礎値・未使用超越Pが残る', (() => {
  const enhanced = applyPlan(transcended({ transcendPoints: 3 }), { apt: [1, 0, 0, 0], stat: { hp: 1 } }).masu;
  const reborn = resetForRebirth(enhanced, { toLevel: 351 });
  return reborn.transcended === true && reborn.levelCap === TRANSCEND_CAP
    && reborn.transcendStatPoints.hp === 10 && reborn.transcendAptBoosts[0] === 1
    && reborn.transcendPoints === 1 && merge(reborn).distAptitude[0] === 'B'
    && levelOf(reborn).level === 351;
})());
check('転生後もLv400を超えれば超越カーブを使う', (() => {
  const reborn = resetForRebirth(transcended(), { toLevel: 351 });
  return levelOf(applyBondXp(reborn, totalXp(401) - totalXp(351)).masu).level === 401;
})());
// 未超越のまま超越強化した個体でも、恒久の育成結果として残ること
check('未超越の超越強化も、通常リセット相当で消えない', (() => {
  const enhanced = applyPlan(masu({ transcendPoints: 3, rebirthCount: 0, bondXp: 0, levelCap: 30 }),
    { apt: [1, 0, 0, 0], stat: { hp: 1 } }).masu;
  const reset = { ...enhanced, statPoints: { hp: 0, atk: 0, def: 0, guts: 0 }, distAptBoosts: [0, 0, 0, 0], distAptPoints: 9 };
  return normalize(reset).transcendStatPoints.hp === 10 && merge(reset).distAptitude[0] === 'B'
    && normalize(reset).transcendPoints === 1 && normalize(reset).transcended === false;
})());
// 転生は超越Pの振り直し手段ではない。使用済みを未使用へ戻してはいけない
check('転生しても使用済み超越Pを未使用へ戻さない', (() => {
  // ライフ20P・ちから10P・適性5Pを使い、未使用15Pを残した状態から転生する
  const spent = applyPlan(transcended({ transcendPoints: 50 }),
    { apt: [5, 0, 0, 0], stat: { hp: 20, atk: 10 } }).masu;
  const before = normalize(spent);
  const reborn = normalize(resetForRebirth(before, { toLevel: 351 }));
  return before.transcendPoints === 15
    && reborn.transcendPoints === 15
    && reborn.transcendStatPoints.hp === 20 * 10 && reborn.transcendStatPoints.atk === 10 * 3
    && reborn.transcendAptBoosts[0] === 5;
})());
check('転生では通常強化だけが振り直される', (() => {
  const grown = applyEnhance(applyPlan(transcended({ transcendPoints: 20, distAptPoints: 30 }),
    { apt: [1, 0, 0, 0], stat: { hp: 1 } }).masu, { apt: [2, 0, 0, 0], stat: { hp: 3 } }).masu;
  const reborn = resetForRebirth(normalize(grown), { toLevel: 351, distAptPoints: 400 });
  return reborn.statPoints.hp === 0 && reborn.distAptBoosts[0] === 0 && reborn.distAptPoints === 400
    && reborn.transcendStatPoints.hp === 10 && reborn.transcendAptBoosts[0] === 1;
})());
check('転生後にLv401以降を育て直すと、上がったぶんだけ超越Pを再獲得する', (() => {
  // Lv450 → 転生 → Lv351。351→450 で 400を超えたぶん(50レベル)だけ超越Pが入る
  const grown = transcended({ bondXp: totalXp(450), transcendPoints: 0 });
  const reborn = resetForRebirth(normalize(grown), { toLevel: 351 });
  const relevel = applyBondXp(reborn, totalXp(450) - totalXp(351));
  const ok450 = levelOf(relevel.masu).level === 450 && normalize(relevel.masu).transcendPoints === 50;
  // Lv500 → 転生 → Lv401。401→500 は 99レベルぶん
  const reborn2 = resetForRebirth(normalize(transcended({ bondXp: totalXp(500) })), { toLevel: 401 });
  const relevel2 = applyBondXp(reborn2, totalXp(500) - totalXp(401));
  return ok450 && levelOf(relevel2.masu).level === 500 && normalize(relevel2.masu).transcendPoints === 99;
})());
check('転生した瞬間には超越Pを配り直さない', (() => {
  const reborn = resetForRebirth(normalize(transcended({ bondXp: totalXp(450), transcendPoints: 3 })), { toLevel: 351 });
  return normalize(reborn).transcendPoints === 3;
})());
check('未超越の超越強化も、転生・限界突破で消えない', (() => {
  const enhanced = applyPlan(masu({ transcendPoints: 3, rebirthCount: 3, bondXp: totalXp(200), levelCap: 200 }),
    { apt: [1, 0, 0, 0], stat: { hp: 1 } }).masu;
  const reborn = resetForRebirth(enhanced, { toLevel: 101 });
  // 限界突破は levelCap を上げるだけ。超越の項目には触れない
  const broken = { ...reborn, rebirthCount: 4, levelCap: reborn.levelCap + 5 };
  return reborn.transcendStatPoints.hp === 10 && reborn.transcendAptBoosts[0] === 1
    && reborn.transcendPoints === 1 && reborn.transcended !== true
    && normalize(broken).transcendStatPoints.hp === 10 && normalize(broken).transcended === false;
})());
// 正式超越後は、これまでどおりLv401以降のレベルアップで同じ超越Pへ足される
check('正式超越後のLv401以降は、既存の超越Pへ足される', (() => {
  const grown = applyPlan(masu({ transcendPoints: 6 }), { apt: [0, 0, 0, 0], stat: { hp: 1 } }).masu;
  const after = buildTranscend({ masu: grown, gold: DIAMOND_COST, psycheOwned: PSYCHE_COST }).nextMasu;
  const leveled = applyBondXp(after, totalXp(403) - totalXp(400)).masu;
  return normalize(after).transcendPoints === 5 && normalize(leveled).transcendPoints === 8
    && levelOf(leveled).level === 403;
})());

// ---- ⑥-2 超越ポイントリセットの書 ----
const buildReset = G('buildMasuTranscendReset');
const spentOf = G('transcendSpentPoints');
check('超越Pを1つも使っていなければリセットできない（本を減らさない）',
  buildReset(transcended({ transcendPoints: 9 })) === null && buildReset(masu()) === null);
check('使用済み超越Pをすべて未使用へ戻す', (() => {
  // ライフ20P・距離5P・未使用15P → リセット後は未使用40P
  const spent = applyPlan(transcended({ transcendPoints: 40 }), { apt: [5, 0, 0, 0], stat: { hp: 20 } }).masu;
  const before = normalize(spent);
  const reset = buildReset(spent);
  const after = normalize(reset.nextMasu);
  return before.transcendPoints === 15 && spentOf(before) === 25 && reset.refundedPoints === 25
    && after.transcendPoints === 40
    && TRANSCEND_STAT_KEYS_ALL.every(key => after.transcendStatPoints[key] === 0)
    && after.transcendAptBoosts.every(value => value === 0);
})());
check('リセットしても超越済み・Lv・XP・通常強化・限界突破・転生回数は変わらない', (() => {
  const grown = applyEnhance(applyPlan(transcended({ transcendPoints: 10, distAptPoints: 20, reincarnateCount: 2 }),
    { apt: [1, 0, 0, 0], stat: { hp: 2 } }).masu, { apt: [3, 0, 0, 0], stat: { hp: 4 } }).masu;
  const before = normalize(grown);
  const after = normalize(buildReset(grown).nextMasu);
  return after.transcended === true && after.levelCap === before.levelCap
    && after.bondXp === before.bondXp && levelOf(after).level === levelOf(before).level
    && after.statPoints.hp === before.statPoints.hp && after.distAptBoosts[0] === before.distAptBoosts[0]
    && after.distAptPoints === before.distAptPoints
    && after.rebirthCount === before.rebirthCount && after.reincarnateCount === before.reincarnateCount;
})());
check('リセットで能力・適性・総合力が超越前の値へ戻る', (() => {
  const plain = transcended({ transcendPoints: 6 });
  const spent = applyPlan(plain, { apt: [2, 0, 0, 0], stat: { hp: 2 } }).masu;
  const after = buildReset(spent).nextMasu;
  return merge(spent).baseHp - merge(plain).baseHp === 20
    && merge(after).baseHp === merge(plain).baseHp
    && merge(after).distAptitude[0] === merge(plain).distAptitude[0]
    && powerOf(after) === powerOf(plain);
})());
check('正式超越していない個体でもリセットできる', (() => {
  const plain = masu({ transcendPoints: 5, rebirthCount: 0, bondXp: 0, levelCap: 30 });
  const spent = applyPlan(plain, { apt: [1, 0, 0, 0], stat: { hp: 1 } }).masu;
  const after = normalize(buildReset(spent).nextMasu);
  return after.transcendPoints === 5 && after.transcended === false && after.levelCap === 30;
})());
// UI・保存のつくり
check('リセットの入口と確認シートが超越強化の画面にある',
  source.includes('data-transcend-reset-open') && source.includes('data-transcend-reset-sheet')
  && source.includes('data-transcend-reset-commit')
  && source.includes('リセットする超越強化がありません'));
check('確認シートに使用済み・リセット後・所持数を出す',
  source.includes('使用済み超越P') && source.includes('リセット後の未使用超越P')
  && source.includes('超越ポイントリセットの書'));
check('虹のプシュケーは返さないと明記している', source.includes('交換に使った虹のプシュケーは戻りません'));
check('連打しても2冊消費しない（処理ロック）',
  source.includes('transcendResetProcessingRef.current = true')
  && source.includes('if (transcendResetProcessingRef.current) return null;'));
check('保存が済んでからアイテムを減らす（片方だけの状態を作らない）', (() => {
  const from = source.indexOf('const useTranscendResetScroll');
  const body = source.slice(from, source.indexOf('// 絆経験値のチケット', from));
  return body.indexOf("await storeSet('mh_masu_mons'") < body.indexOf("await storeSet('mh_owned_items'")
    && body.indexOf("await storeSet('mh_owned_items'") < body.indexOf('setOwnedItems(nextItems)')
    && !/storeSet\('mh_gold'|BREAKTHROUGH_ITEM_ID/.test(body);
})());
check('新しい保存キーを作っていない（mh_masu_mons と mh_owned_items だけ）', (() => {
  const from = source.indexOf('const useTranscendResetScroll');
  const body = source.slice(from, source.indexOf('// 絆経験値のチケット', from));
  const keys = [...new Set((body.match(/storeSet\('([^']+)'/g) || []).map(t => t.slice(10, -1)))].sort();
  return keys.length === 2 && keys[0] === 'mh_masu_mons' && keys[1] === 'mh_owned_items';
})());
check('マーケットに超越ポイントリセットの書がある（10,000ダイヤ）',
  breeder.includes("id:'transcend_reset_scroll'") && breeder.includes('name:"超越ポイントリセットの書"')
  && /transcend_reset_scroll[^}]*cost:10000/.test(breeder)
  && /transcend_reset_scroll[^}]*usage:'transcendReset'/.test(breeder));

// ---- ⑦ 旧セーブ ----
check('超越項目が無い既存マスモンは未超越として読める', (() => {
  const legacy = { id: 'old', baseId: 'Test', name: '旧', bondXp: totalXp(MAX_CAP), rebirthCount: 35, levelCap: MAX_CAP, statPoints: {}, distApt: ['C','C','C','C'] };
  const normalized = normalize(legacy);
  return normalized.transcended === false && normalized.transcendPoints === 0
    && normalized.levelCap === MAX_CAP
    && JSON.stringify(normalized.transcendAptBoosts) === JSON.stringify([0, 0, 0, 0])
    && JSON.stringify(normalized.transcendStatPoints) === JSON.stringify({ hp: 0, atk: 0, def: 0, guts: 0 });
})());
check('旧セーブでも能力・適性・総合力が変わらない', (() => {
  const legacy = { id: 'old', baseId: 'Test', name: '旧', bondXp: totalXp(200), rebirthCount: 35, levelCap: MAX_CAP, statPoints: { hp: 50 }, distApt: ['B','C','C','C'] };
  const resolved = merge(legacy);
  return resolved.baseHp === 650 && resolved.distAptitude[0] === 'B' && powerOf(legacy) > 0;
})());
check('壊れた超越項目でもNaN・負数にならない', (() => {
  const broken = normalize(masu({ transcended: true, transcendPoints: -5, transcendStatPoints: { hp: NaN, atk: 'x' }, transcendAptBoosts: 'こわれた値' }));
  return broken.transcendPoints === 0 && broken.transcendStatPoints.hp === 0 && broken.transcendStatPoints.atk === 0
    && JSON.stringify(broken.transcendAptBoosts) === JSON.stringify([0, 0, 0, 0]);
})());
check('既存の保存キーを改名・削除していない',
  ['mh_masu_mons', 'mh_owned_items', 'mh_gold'].every(key => source.includes(`'${key}'`))
  && !/mh_transcend/i.test(source));

// ---- 画面・案内 ----
check('神殿に「超越」の入口がある', source.includes("setGameState('MASU_TRANSCENDENCE')") && source.includes('mh-transcend-link'));
check('超越ページは神殿のBGMを継続する', source.includes("MASU_TRANSCENDENCE: 'temple'"));
check('確認画面にコストと取り消し不可の注意を出す',
  source.includes('data-transcend-confirm') && source.includes('超越は取り消せません')
  && source.includes('{TRANSCEND_PSYCHE_COST.toLocaleString()}') && source.includes('{TRANSCEND_DIAMOND_COST.toLocaleString()}'));
check('二重実行を処理ロックで防ぐ',
  source.includes('if (transcendProcessingRef.current || !transcendSelectedId) return;')
  && source.includes('transcendProcessingRef.current = true;'));
check('保存が済んでから演出を出す（保存失敗時はロックを外して消費しない）', (() => {
  const at = source.indexOf('const executeMasuTranscendence');
  const body = at < 0 ? '' : source.slice(at, at + 2600);
  return body.indexOf("storeSet('mh_masu_mons'") < body.indexOf('setTranscendAnimation(')
    && body.includes('catch {') && body.includes('transcendProcessingRef.current=false;');
})());
check('超越マークは共通コンポーネントを使い回す',
  (source.match(/<TranscendenceBadge/g) || []).length >= 4 && source.includes('const TranscendenceBadge ='));
// マークはモンスターの絵(まるく切り抜き)に重ねない。丸の外になる右上の角へ置く。
// 虹★・転生バッジは絵の下なので、そちらとも当たらない
check('超越マークは絵の外(右上の角)へ置き、虹★・転生バッジと重ならない',
  source.includes('.mh-transcend-badge{position:absolute;right:-7px;top:-7px')
  && source.includes('.mh-transcend-badge.is-small{width:15px;height:15px;right:-8px;top:-8px')
  && source.includes('.mh-rebirth-stars-overlay{position:absolute;left:0;right:0;bottom:1px}')
  && source.includes('.mh-reincarnate-badge{position:absolute;left:50%;bottom:-11px'));
check('超越演出はSafe Areaを考慮し、モーション軽減にも対応する',
  source.includes('.mh-transcend-animation{') && source.includes('env(safe-area-inset-top)')
  && source.includes('@media(prefers-reduced-motion:reduce){.mh-transcend-animation *')
  && source.includes('prefersReducedMotion()?900:4400'));
check('新しい画像・音声アセットを足していない',
  !/images\/[^'"`]*transcend/i.test(source) && !/audio\/[^'"`]*transcend/i.test(source));
// 通常強化(statPoints)と超越で上げた基礎(transcendStatPoints)は、混ぜずに別々に見せる。
// 2026年8月にマスモン詳細を作り直し、行の中の(+○)から
// 「ピンクの基礎バッジ／緑の強化バッジ＋タップで開く内訳」へ変わった
check('ステータス表示は通常強化と基礎UP(超越)を分けている',
  source.includes('const masuGrowthBreakdown = (masu, mergedMon) => {')
  && source.includes('const tsp = normalizeTranscendStatPoints(masu.transcendStatPoints);')
  && source.includes('const baseUp = Math.max(0, num(tsp[key]));')
  && source.includes('const enhance = Math.max(0, num(sp[key]));')
  && source.includes("kind === 'base' ? '基礎' : '強化'"));
check('内訳は 元 ＋ 基礎UP ＋ 通常強化 ＝ 現在 になっている',
  source.includes('origin: current - baseUp - enhance')
  && source.includes("growthTermBlock('＋', '基礎UP（永久）'")
  && source.includes("growthTermBlock('＋', '強化（使用）'"));
check('強化画面で通常強化と超越強化を切り替えられる',
  source.includes('data-transcend-enhance-tabs') && source.includes("setGameState('MASU_TRANSCEND_ENHANCE')"));
// 超越強化はどのマスモンでも使える。「超越済みのときだけタブを出す」に戻していないか見張る
check('超越強化のタブを超越済み限定にしていない',
  !source.includes('{normalizeMasuProgression(masu).transcended&&<div data-transcend-enhance-tabs')
  && !/const applyTranscendPlanToMasu[\s\S]{0,200}?if \(!normalized\.transcended\) return null;/.test(source)
  && !/const applyTranscendExchange[\s\S]{0,200}?if \(!normalized\.transcended\) return null;/.test(source)
  && !source.includes("if (!base || !normalized.transcended) { setGameState('MASU_ENHANCE')"));
// 超越強化しただけの個体に超越マークを出さない(マークは神殿で正式に超越した証)
check('超越強化の画面では超越済みのときだけマークを出す', (() => {
  // 見張るのは超越強化の画面だけ(デバッグの見本は「超越済みの見た目」をわざと出している)
  const from = source.indexOf("gameState==='MASU_TRANSCEND_ENHANCE'");
  const screen = source.slice(from, source.indexOf("gameState==='MASU_ENHANCE'&&masuMonDetail", from));
  return screen.includes('<TranscendenceBadge transcended={normalized.transcended} small/>')
    && !/<TranscendenceBadge transcended\s*\/>/.test(screen)
    && !screen.includes('<TranscendenceBadge transcended small/>');
})());
check('まだ超越していない個体には、超越そのものとの違いを画面で伝える',
  source.includes('data-transcend-not-yet') && source.includes('まだ神殿で超越していませんが、超越強化はいつでも使えます'));
// 詳細モーダル(z=31000)は強化画面(z=30000)より手前に出る。除外し忘れると超越強化が
// まるごと隠れて、閉じたときに暗い画面だけが残る。実際にその不具合を出している
check('強化画面を開いているあいだは詳細モーダルを重ねない',
  source.includes("const MASU_ENHANCE_STATES = ['MASU_ENHANCE','MASU_TRANSCEND_ENHANCE']")
  && source.includes('{masuMonDetail&&!MASU_ENHANCE_STATES.includes(gameState)&&')
  && !source.includes("{masuMonDetail&&gameState!=='MASU_ENHANCE'&&"));
check('超越強化はまとめて振れる（1Pずつ何十回も押させない）',
  source.includes('data-transcend-unit={unit}') && source.includes("{[1,5,10,'MAX'].map(unit=><button type=\"button\" key={unit} data-transcend-unit=")
  && source.includes('PressRepeatButton aria-label={`${label}の基礎値を上げる`}'));
// 交換は振り分けと混ざらないよう専用のシートへ分けている
check('プシュケーの変換は専用のシートで行う',
  source.includes('data-transcend-exchange-open') && source.includes('data-transcend-exchange-sheet')
  && source.includes('data-transcend-exchange-commit')
  && source.indexOf('data-transcend-exchange-sheet') > source.indexOf('data-transcend-commit'));
check('超越の実の本番導線は所持時だけ超越強化内に表示する',
  source.includes('{hasTranscendFruit&&<button data-transcend-fruit-open')
  && source.includes('data-transcend-fruit-sheet') && source.includes('data-transcend-fruit-select={itemId}'));
check('超越の実は種類を明示選択して1・10・MAXを使う',
  source.includes("setTranscendFruitItemId('')")
  && source.includes("[[1,'1'],[10,'10'],[selectedFruitHave,'MAX']]")
  && source.includes('if (amount > 1) { setTranscendFruitConfirmAmount(amount); return; }'));
check('超越の実の保存は既存2キーを再読込検証し、失敗時は両方を戻してからstateへ反映しない',
  source.includes('const saved = await saveTranscendFruitPair(')
  && source.includes("getValue('mh_masu_mons', null, false)")
  && source.includes("getValue('mh_owned_items', null, false)")
  && source.includes("setValue('mh_masu_mons', beforeMasuMons, false)")
  && source.includes("setValue('mh_owned_items', beforeOwnedItems, false)")
  && source.includes('if (!saved) {')
  && source.includes('transcendFruitProcessingRef.current = true'));
check('超越の実シートはSafe Area内を縦スクロールでき、ボタンは44px以上',
  source.includes('data-transcend-fruit-sheet') && source.includes('min-h-[64px]')
  && source.includes('data-transcend-fruit-amount={label}') && source.includes('min-h-[44px]'));
check('プシュケー変換シートは低い画面でもSafe Area内を縦スクロールできる',
  source.includes("maxHeight:'calc(100% - env(safe-area-inset-top))'")
    && source.includes('overflow-y-auto overscroll-contain')
    && source.includes("paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'"));
check('ヘルプに超越の項目がある',
  help.includes("id: 'transcendence'") && help.includes('MASU_TRANSCENDENCE: ') && help.includes('MASU_TRANSCEND_ENHANCE: '));
check('ヘルプに解放条件・コスト・仕様が書いてある',
  ['限界突破35回（虹★5）と絆Lv.400', '虹のプシュケー 5,000個 と ダイヤ 1,000,000',
    'レベル上限が400から500', '虹のプシュケー1,000個を超越ポイント1', 'ライフ基礎+10',
    '通常の強化を白紙に戻しても', '転生しても超越した状態とLv上限500は維持']
    .every(text => help.includes(text)));
// 「超越しないと超越強化できない」という古い説明を残さない
check('ヘルプに超越強化がいつでも使えると書いてある',
  help.includes('超越強化はいつでも使えます')
  && help.includes('どのマスモンでも「通常強化」と「超越強化」を切り替えられます')
  && !help.includes('超越済みの個体だけが交換でき')
  && !help.includes('超越済みの個体では「通常強化」と「超越強化」'));
check('助手に超越の案内がある', assistants.includes('transcendence: {') && assistants.includes("help: 'masu/transcendence'"));
check('更新履歴に超越の追加が載っている',
  changelog.includes('新育成システム「超越」を追加しました')
  && changelog.includes("assistantNotice: { id:'update_notice_transcendence_v1', type:'feature' }"));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
