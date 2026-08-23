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
check('超越前の個体は交換できない', applyExchange(masu(), 10000, 5) === null);
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
check('未超越の個体は超越強化できない', applyPlan(masu({ transcendPoints: 5 }), { apt: [0, 0, 0, 0], stat: { hp: 1 } }) === null);
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
check('超越マークは画像の上側へ置き、虹★・転生バッジと重ならない',
  source.includes('.mh-transcend-badge{position:absolute;left:50%;top:-9px')
  && source.includes('.mh-rebirth-stars-overlay{position:absolute;left:0;right:0;bottom:1px}')
  && source.includes('.mh-reincarnate-badge{position:absolute;left:50%;bottom:-11px'));
check('超越演出はSafe Areaを考慮し、モーション軽減にも対応する',
  source.includes('.mh-transcend-animation{') && source.includes('env(safe-area-inset-top)')
  && source.includes('@media(prefers-reduced-motion:reduce){.mh-transcend-animation *')
  && source.includes('prefersReducedMotion()?900:4400'));
check('新しい画像・音声アセットを足していない',
  !/images\/[^'"`]*transcend/i.test(source) && !/audio\/[^'"`]*transcend/i.test(source));
check('ステータス表示は通常強化の(+○)と基礎+○を分けている',
  source.includes('const masuStatRow = (label, value, plus, color, transcendPlus = 0)')
  && source.includes('基礎+{transcendPlus}'));
check('強化画面で通常強化と超越強化を切り替えられる',
  source.includes('data-transcend-enhance-tabs') && source.includes("setGameState('MASU_TRANSCEND_ENHANCE')"));
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
check('ヘルプに超越の項目がある',
  help.includes("id: 'transcendence'") && help.includes('MASU_TRANSCENDENCE: ') && help.includes('MASU_TRANSCEND_ENHANCE: '));
check('ヘルプに解放条件・コスト・仕様が書いてある',
  ['限界突破35回（虹★5）と絆Lv.400', '虹のプシュケー 5,000個 と ダイヤ 1,000,000',
    'レベル上限が400から500', '虹のプシュケー1,000個を超越ポイント1', 'ライフ基礎+10',
    '通常の強化を白紙に戻しても', '転生しても超越した状態とLv上限500は維持']
    .every(text => help.includes(text)));
check('助手に超越の案内がある', assistants.includes('transcendence: {') && assistants.includes("help: 'masu/transcendence'"));
check('更新履歴に超越の追加が載っている',
  changelog.includes('新育成システム「超越」を追加しました')
  && changelog.includes("assistantNotice: { id:'update_notice_transcendence_v1', type:'feature' }"));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
