// そのレベルから次レベルに必要なXP(基準値)。指数を上げるほど高レベルが急に重くなる。
// 10WAVE完全クリアを1周=100XPとして、Lv30到達までの周回数は次のように緩和してきている。
//   指数1.8(当初)  … ブリーダー約580周 / 絆約410周
//   指数1.6         … ブリーダー約190周 / 絆約130周
//   指数1.4(現在)  … ブリーダー約56周  / 絆約35周
// さらに絆側はBOND_XP_DISCOUNTを0.05→0.025へ引き下げたため、Lv30到達は約18周ぶんになっている。
const XP_CURVE_EXPONENT = 1.4;
const xpForLevel = (level) => Math.round(50 * Math.pow(level, XP_CURVE_EXPONENT));
// 緩和前(指数1.8)の必要XPで求めたレベル。今回の緩和で上がったレベル分の
// ブリーダーポイントを一度だけ遡って配るための計算にのみ使う
const legacyLevelBefore160 = (totalXp, discount) => {
  let level = 1, xp = totalXp;
  for (let i = 0; i < 200; i++) {
    const need = Math.max(1, Math.round(50 * Math.pow(level, 1.8) * discount));
    if (xp < need) break;
    xp -= need; level++;
  }
  return level;
};
// --- ブリーダーレベル: 上がり方を緩和するため、必要XPを基準値から割り引く
// (バランス調整用の係数。小さくするほど上げやすい。後日調整しやすいようここに1箇所だけ置く。
// 0.25 → 0.15 → 0.08 と緩和してきている)
const BREEDER_XP_DISCOUNT = 0.08;
const xpForBreederLevel = (level) => Math.max(1, Math.round(xpForLevel(level) * BREEDER_XP_DISCOUNT));
// ブリーダーレベルに意図した上限は無い。以前は200回で打ち切っていたため、
// Lv.201以降は経験値が貯まってもレベルが上がらなくなっていた。
//
// ただしその打ち切りは「壊れた保存値が来ても必ず止まる」安全弁も兼ねていた。
// NaN・Infinityは「xp < need」がいつまでも偽になるため、素直にwhileへ変えると
// その場で無限ループして画面が固まる。上限ではなく入力側で守る。
// MAX_SAFE_INTEGERはLv.360万ぶんに相当し、遊んで届く値ではないので実質的な上限にはならない。
const safeBreederXp = (totalXp) => {
  const value = Number(totalXp);
  return Number.isFinite(value) ? Math.min(Math.max(0, value), Number.MAX_SAFE_INTEGER) : 0;
};
const levelInfo = (totalXp) => {
  const safeTotal = safeBreederXp(totalXp);
  let level = 1, xp = safeTotal;
  while (true) {
    const need = xpForBreederLevel(level);
    if (xp < need) break;
    xp -= need; level++;
  }
  return { level, xpIntoLevel: xp, xpForNext: xpForBreederLevel(level), totalXp: safeTotal };
};
// 【超越】Lv400・虹★5(35凸)まで育てた個体だけが神殿で行える、限界の先の育成。
// 限界突破の上限(35凸)はそのままで、超越が伸ばすのは「Lv上限」だけ。
// MAX_MASU_LEVEL_CAP は限界突破の天井として400のまま使い続けるので、36凸は作られない。
const TRANSCEND_LEVEL_CAP = 500;
// 魂格STEP1: 超越Lv500の先を100Lvずつ解放できる個体データ基盤。
// STEP1では進化UI/素材消費はまだ実装せず、保存値・上限・XP・ポイント計算だけを用意する。
const SOUL_RANK_BASE_LEVEL = 500;
const SOUL_RANK_MAX_STAGE = 5;
const SOUL_RANK_LEVEL_CAP = 1000;
const SOUL_RANK_LEVELS_PER_STAGE = 100;
const SOUL_RANK_EVOLUTION_STAGES = Object.freeze([
  Object.freeze({ stage:1, label:'魂格Ⅰ', requiredLevel:500, levelCap:600, diamondCost:5000000, heroProofCost:20, accent:'#60a5fa' }),
  Object.freeze({ stage:2, label:'魂格Ⅱ', requiredLevel:600, levelCap:700, diamondCost:10000000, heroProofCost:30, accent:'#facc15' }),
  Object.freeze({ stage:3, label:'魂格Ⅲ', requiredLevel:700, levelCap:800, diamondCost:15000000, heroProofCost:40, accent:'#4ade80' }),
  Object.freeze({ stage:4, label:'魂格Ⅳ', requiredLevel:800, levelCap:900, diamondCost:20000000, heroProofCost:50, accent:'#f87171' }),
  Object.freeze({ stage:5, label:'魂格Ⅴ', requiredLevel:900, levelCap:1000, diamondCost:25000000, heroProofCost:60, accent:'#e879f9' }),
]);
const soulRankEvolutionForStage = (stage) => {
  const target = Math.floor(Number(stage) || 0);
  return target >= 1 && target <= SOUL_RANK_MAX_STAGE
    ? (SOUL_RANK_EVOLUTION_STAGES.find(step => step.stage === target) || null)
    : null;
};
const normalizeSoulRankStage = (value) =>
  Math.max(0, Math.min(SOUL_RANK_MAX_STAGE, Math.floor(Number(value) || 0)));
const soulRankLevelCap = (stage) =>
  SOUL_RANK_BASE_LEVEL + normalizeSoulRankStage(stage) * SOUL_RANK_LEVELS_PER_STAGE;
const normalizeSoulPointMaxReachedLevel = (value) =>
  Math.max(SOUL_RANK_BASE_LEVEL, Math.min(SOUL_RANK_LEVEL_CAP, Math.floor(Number(value) || SOUL_RANK_BASE_LEVEL)));
const SOUL_TRAIT_DEFINITIONS = Object.freeze([
  // 攻撃: 本人の攻撃だけへ適用。戦闘接続はSTEP4でこのIDを正本として行う。
  Object.freeze({ id:'allDamage', category:'attack', name:'闘魂', desc:'本人の全攻撃ダメージ +1%', costPerLevel:5, effectPerLevel:1, unit:'%' }),
  Object.freeze({ id:'uniqueDamage', category:'attack', name:'奥義', desc:'本人の固有技ダメージ +1%', costPerLevel:4, effectPerLevel:1, unit:'%' }),
  Object.freeze({ id:'normalDamage', category:'attack', name:'武技', desc:'本人の通常技・距離技ダメージ +1%', costPerLevel:4, effectPerLevel:1, unit:'%' }),
  Object.freeze({ id:'rangeZeroDamage', category:'attack', name:'零距離の極意', desc:'本人の零距離ダメージ +1%', costPerLevel:2, effectPerLevel:1, unit:'%' }),
  Object.freeze({ id:'rangeNearDamage', category:'attack', name:'近距離の極意', desc:'本人の近距離ダメージ +1%', costPerLevel:2, effectPerLevel:1, unit:'%' }),
  Object.freeze({ id:'rangeMidDamage', category:'attack', name:'中距離の極意', desc:'本人の中距離ダメージ +1%', costPerLevel:2, effectPerLevel:1, unit:'%' }),
  Object.freeze({ id:'rangeFarDamage', category:'attack', name:'遠距離の極意', desc:'本人の遠距離ダメージ +1%', costPerLevel:2, effectPerLevel:1, unit:'%' }),
  Object.freeze({ id:'comboFinalDamage', category:'attack', name:'連撃強化', desc:'本人の連撃・追撃の最終ダメージ +1%', costPerLevel:4, effectPerLevel:1, unit:'%' }),
  Object.freeze({ id:'critRate', category:'attack', name:'会心眼', desc:'本人の会心率 +1pt', costPerLevel:4, effectPerLevel:1, unit:'pt', maxLevel:90 }),
  Object.freeze({ id:'critDamage', category:'attack', name:'会心極', desc:'本人の会心ダメージ +1%', costPerLevel:3, effectPerLevel:1, unit:'%' }),
  // 防御: パーティ効果。同種合成・特殊防御統合はSTEP4で接続する。
  Object.freeze({ id:'partyDamageReduction', category:'defense', name:'鉄壁', desc:'パーティ被ダメージ -1%', costPerLevel:20, effectPerLevel:1, unit:'%' }),
  Object.freeze({ id:'partyEvasion', category:'defense', name:'残像', desc:'パーティ回避 +1pt', costPerLevel:30, effectPerLevel:1, unit:'pt', maxLevel:75 }),
  Object.freeze({ id:'partyReflect', category:'defense', name:'鏡返し', desc:'パーティ反射 +1pt', costPerLevel:60, effectPerLevel:1, unit:'pt', maxLevel:75 }),
  Object.freeze({ id:'partyAbsorb', category:'defense', name:'吸収', desc:'パーティ吸収 +1pt', costPerLevel:60, effectPerLevel:1, unit:'pt', maxLevel:75 }),
  Object.freeze({ id:'enemyDisable', category:'defense', name:'威圧', desc:'敵の行動不能率 +1pt', costPerLevel:25, effectPerLevel:1, unit:'pt', maxLevel:100 }),
  // 補助
  Object.freeze({ id:'gutsCostReduction', category:'support', name:'省気', desc:'本人のカード消費ガッツ -1%', costPerLevel:10, effectPerLevel:1, unit:'%', maxLevel:100 }),
  Object.freeze({ id:'autoGutsRecovery', category:'support', name:'自動ガッツ回復強化', desc:'パーティの実際の自動ガッツ回復量 +1%', costPerLevel:10, effectPerLevel:1, unit:'%' }),
  Object.freeze({ id:'coordination', category:'support', name:'連携', desc:'使用可能カード枚数 +1', costPerLevel:200, effectPerLevel:1, unit:'枚', maxLevel:1 }),
]);
const SOUL_TRAIT_BY_ID = Object.freeze(Object.fromEntries(SOUL_TRAIT_DEFINITIONS.map(trait => [trait.id, trait])));
const SOUL_TRAIT_CATEGORIES = Object.freeze([
  Object.freeze({ id:'attack', label:'攻撃' }),
  Object.freeze({ id:'defense', label:'防御' }),
  Object.freeze({ id:'support', label:'補助' }),
]);
const normalizeSoulTraitLevels = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  Object.entries(value).forEach(([rawKey, rawLevel]) => {
    const key = String(rawKey);
    const trait = SOUL_TRAIT_BY_ID[key];
    if (!trait) return;
    const level = Math.max(0, Math.floor(Number(rawLevel) || 0));
    const capped = Number.isFinite(trait.maxLevel) ? Math.min(trait.maxLevel, level) : level;
    if (capped > 0) out[key] = capped;
  });
  return out;
};
const soulPointEarned = (masu) =>
  Math.max(0, Math.min(500, normalizeSoulPointMaxReachedLevel(masu?.soulPointMaxReachedLevel) - SOUL_RANK_BASE_LEVEL));
const soulTraitLevel = (masu, traitId) =>
  Math.max(0, Math.floor(Number(normalizeSoulTraitLevels(masu?.soulTraitLevels)[traitId]) || 0));
const soulTraitEffectValue = (masu, traitId) => {
  const trait = SOUL_TRAIT_BY_ID[traitId];
  return trait ? soulTraitLevel(masu, traitId) * trait.effectPerLevel : 0;
};
const soulTraitSpentPoints = (masu) => {
  const levels = normalizeSoulTraitLevels(masu?.soulTraitLevels);
  return SOUL_TRAIT_DEFINITIONS.reduce((sum, trait) =>
    sum + Math.max(0, Math.floor(Number(levels[trait.id]) || 0)) * trait.costPerLevel, 0);
};
const soulTraitAvailablePoints = (masu) =>
  Math.max(0, soulPointEarned(masu) - soulTraitSpentPoints(masu));
// 壊れた保存で使用済みPが獲得済みPを上回っても、追加Pを生み出さず強化を止められる診断値。
const soulTraitPointStatus = (masu) => {
  const earned=soulPointEarned(masu), spent=soulTraitSpentPoints(masu);
  return { earned, spent, available:Math.max(0,earned-spent), overspent:spent>earned };
};
const maxSoulTraitUpgradeLevels = (masu, traitId) => {
  const normalized = normalizeMasuProgression(masu);
  const trait = SOUL_TRAIT_BY_ID[traitId];
  if (!trait || normalized.soulRankStage < 1) return 0;
  const byPoints = Math.floor(soulTraitAvailablePoints(normalized) / trait.costPerLevel);
  const current = soulTraitLevel(normalized, traitId);
  const byCap = Number.isFinite(trait.maxLevel) ? Math.max(0, trait.maxLevel - current) : byPoints;
  return Math.max(0, Math.min(byPoints, byCap));
};
const buildSoulTraitUpgrade = (masu, traitId, requestedLevels = 1) => {
  const normalized = normalizeMasuProgression(masu);
  const trait = SOUL_TRAIT_BY_ID[traitId];
  if (!trait || normalized.soulRankStage < 1) return null;
  const levels = Math.max(0, Math.floor(Number(requestedLevels) || 0));
  const maxLevels = maxSoulTraitUpgradeLevels(normalized, traitId);
  if (levels <= 0 || levels > maxLevels) return null;
  const currentLevel = soulTraitLevel(normalized, traitId);
  const nextLevel = currentLevel + levels;
  const cost = levels * trait.costPerLevel;
  const soulTraitLevels = { ...normalizeSoulTraitLevels(normalized.soulTraitLevels), [traitId]:nextLevel };
  return {
    trait, levels, cost, currentLevel, nextLevel,
    beforeEffect:currentLevel * trait.effectPerLevel,
    afterEffect:nextLevel * trait.effectPerLevel,
    beforeAvailable:soulTraitAvailablePoints(normalized),
    afterAvailable:soulTraitAvailablePoints(normalized) - cost,
    nextMasu:{ ...normalized, soulTraitLevels },
  };
};
const buildMasuSoulTraitReset = (masu) => {
  const normalized = normalizeMasuProgression(masu);
  const refundedPoints = soulTraitSpentPoints(normalized);
  if (refundedPoints <= 0) return null;
  return {
    refundedPoints,
    nextMasu:{ ...normalized, soulTraitLevels:{} },
  };
};
const SOUL_RANK_RESPEC_ITEM_ID = 'soul_rank_respec_scroll';
const SOUL_RANK_RESPEC_DIAMOND_COST = 1000000;
const buildSoulRankRespecProofExchange = (ownedItems, quantity = 1) => {
  const before = ownedItems && typeof ownedItems === 'object' && !Array.isArray(ownedItems) ? ownedItems : {};
  const count = Math.max(1, Math.floor(Number(quantity) || 1));
  const proofHave = ownedItemCount(before, HERO_PROOF_ITEM_ID);
  if (proofHave < count) return { ok:false, quantity:count, proofCost:count, ownedItems:before };
  return {
    ok:true,
    quantity:count,
    proofCost:count,
    ownedItems:{
      ...before,
      [HERO_PROOF_ITEM_ID]:proofHave - count,
      [SOUL_RANK_RESPEC_ITEM_ID]:ownedItemCount(before, SOUL_RANK_RESPEC_ITEM_ID) + count,
    },
  };
};
const TRANSCEND_PSYCHE_COST = 5000;
const TRANSCEND_DIAMOND_COST = 1000000;
// Lv400→401は通常式の10倍。以降1Lvごとに+0.1倍(Lv499→500で19.9倍)
const TRANSCEND_XP_BASE_MULTIPLIER = 10;
const TRANSCEND_XP_MULTIPLIER_STEP = 0.1;
// 虹のプシュケー1,000個 → 超越ポイント1(端数は消費しない)
const TRANSCEND_PSYCHE_PER_POINT = 1000;
const TRANSCEND_STAT_KEYS = Object.freeze(['hp', 'atk', 'def', 'guts']);
const isTranscended = (masu) => !!(masu && masu.transcended);
// 未超越は従来どおりLv400。超越済みは魂格0=Lv500、魂格Ⅰ〜Ⅴ=Lv600〜1000を上限にする。
// levelCap自体は既存保存値を使い続け、ここは壊れた/先行した値が段階を飛び越えないための最大値だけを返す。
const masuLevelCapLimit = (masu) => (isTranscended(masu)
  ? soulRankLevelCap(masu?.soulRankStage)
  : MAX_MASU_LEVEL_CAP);
// 旧セーブにはこれらの項目が無いので、必ず安全な初期値(0)へ落として読む
const normalizeTranscendStatPoints = (value) => Object.fromEntries(TRANSCEND_STAT_KEYS
  .map(key => [key, Math.max(0, Math.floor(Number(value?.[key]) || 0))]));
const normalizeTranscendAptBoosts = (value) => Array.from({ length: 4 },
  (_, index) => Math.max(0, Math.floor(Number(Array.isArray(value) ? value[index] : 0) || 0)));
// --- マスモンの絆レベル: ブリーダーレベルより上げやすくするため、必要XPを基準値から大幅に割り引く
// (バランス調整用の係数。小さくするほど上げやすい。後日調整しやすいようここに1箇所だけ置く。
// 0.35 → 0.175 → 0.10 → 0.05 → 0.025 と緩和してきている。係数を下げると同じ絆経験値でも絆レベルが上がるため、
// レベルアップ時に配る強化ポイントが後追いにならないよう、読み込み時にreconcileMasuPointsで
// 必ず不足分を補填している)
const BOND_XP_DISCOUNT = 0.025;
const xpForBondLevel = (level) => Math.max(1, Math.round(xpForLevel(level) * BOND_XP_DISCOUNT));
// Lv400〜499(既存の超越領域)だけ、通常式が出した必要経験値へ重い倍率を掛ける。
// 倍率は Lv400で10倍、以降1Lvごとに+0.1倍(Lv499→500で19.9倍)。
// Lv399以下は従来値を維持し、Lv500→501以降は下の魂格専用式へ切り替える。
const transcendXpMultiplier = (level) =>
  TRANSCEND_XP_BASE_MULTIPLIER + (level - MAX_MASU_LEVEL_CAP) * TRANSCEND_XP_MULTIPLIER_STEP;
const soulRankXpForBondLevel = (level) => {
  const current = Math.max(SOUL_RANK_BASE_LEVEL, Math.min(SOUL_RANK_LEVEL_CAP - 1, Math.floor(Number(level) || SOUL_RANK_BASE_LEVEL)));
  if (current < 600) return 160000 + (current - 500) * 250;
  if (current < 700) return 210000 + (current - 600) * 250;
  if (current < 800) return 265000 + (current - 700) * 500;
  if (current < 900) return 345000 + (current - 800) * 500;
  return 430000 + (current - 900) * 900;
};
const xpForBondLevelAt = (level) => {
  const current = Math.max(1, Math.floor(Number(level) || 1));
  const normal = xpForBondLevel(current);
  if (current < MAX_MASU_LEVEL_CAP) return normal;
  // Lv400〜499は既存の超越XP式を1も変えない。Lv500→501から魂格の正式式へ切り替える。
  if (current < SOUL_RANK_BASE_LEVEL) return Math.max(1, Math.round(normal * transcendXpMultiplier(current)));
  return soulRankXpForBondLevel(current);
};
const bondLevelInfo = (totalXp) => {
  // 壊れた保存値(NaN・Infinity・負数)で回り続けないよう、先に有限の0以上へ落とす
  const safeTotal = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1, xp = safeTotal;
  for (let i = 0; i < MAX_BOND_LEVEL_ITERATIONS; i++) {
    const need = xpForBondLevelAt(level);
    if (xp < need) break;
    xp -= need; level++;
  }
  return { level, xpIntoLevel: xp, xpForNext: xpForBondLevelAt(level), totalXp: safeTotal };
};
const INITIAL_MASU_LEVEL_CAP = 30;
// 魂格ⅤまでLv1000を数える。Lv1から数え上げるので、繰り返し回数は上限-1。
// 個体ごとの実上限は cappedBondXp / masuLevelCapLimit で別に止めるため、魂格0の既存超越個体はLv500のまま。
const MAX_BOND_LEVEL_ITERATIONS = SOUL_RANK_LEVEL_CAP - 1;
// 限界突破1回でレベル上限がいくつ上がるか
const BREAKTHROUGH_LEVEL_CAP_GAIN = 5;
const AUTO_REPEAT_BREAKTHROUGH_MIN_LEVEL = 35;
// AUTO∞で選べる上限は「数値上の5刻み」ではなく、実際の限界突破で到達できるlevelCapだけにする。
// Lv180以降は 200→230→270→330→400 と飛ぶため、Lv185/350などを表示すると実挙動とズレる。
// 参照先の breakthroughLevelCap / FINAL_BREAKTHROUGH_COUNT はこのファイル後方で定義されるが、
// この関数群が実行されるのはモジュール初期化完了後なので同じ正本を安全に再利用できる。
const autoRepeatBreakthroughReachableLevels = () => {
  const levels = [];
  for (let count = 1; count <= FINAL_BREAKTHROUGH_COUNT; count++) {
    const cap = breakthroughLevelCap(count);
    if (cap >= AUTO_REPEAT_BREAKTHROUGH_MIN_LEVEL && cap <= MAX_MASU_LEVEL_CAP && levels[levels.length - 1] !== cap) levels.push(cap);
  }
  return levels;
};
// ブリーダーLvの半分以下で、実際に到達できる最大levelCapを返す。
const autoRepeatBreakthroughLevelOptions = (breederLevel) => {
  const limit = Math.floor(Math.max(0, Number(breederLevel) || 0) / 2);
  return autoRepeatBreakthroughReachableLevels().filter(level => level <= limit);
};
const autoRepeatBreakthroughMaxLevel = (breederLevel) => {
  const levels = autoRepeatBreakthroughLevelOptions(breederLevel);
  return levels.length ? levels[levels.length - 1] : 0;
};
const normalizeAutoRepeatBreakthroughLevel = (value) => {
  const level = Math.floor(Number(value) || 0);
  if (level < AUTO_REPEAT_BREAKTHROUGH_MIN_LEVEL || level % BREAKTHROUGH_LEVEL_CAP_GAIN !== 0) return 0;
  // 旧仕様はLv180以降も5刻みを保存できた。たとえばLv185は実際にはLv180で止まっていたため、
  // 「指定値以下で到達できる最大cap」へ丸めれば、既存ユーザーの実効挙動を変えず現行仕様へ移せる。
  const levels = autoRepeatBreakthroughReachableLevels();
  let normalized = 0;
  for (const cap of levels) {
    if (cap > level) break;
    normalized = cap;
  }
  return normalized;
};
// AUTO∞自動限界突破の個体設定。
// 既存個体は数値の autoRepeatBreakthroughLevel が入っていれば fixed としてそのまま引き継ぐ。
// follow だけは保存した固定Lvを使わず、その時点のブリーダーLvから実効上限を求める。
const normalizeAutoRepeatBreakthroughMode = (value, levelValue) => {
  if (value === 'follow') return 'follow';
  if (value === 'off') return 'off';
  const level = normalizeAutoRepeatBreakthroughLevel(levelValue);
  if (value === 'fixed') return level > 0 ? 'fixed' : 'off';
  return level > 0 ? 'fixed' : 'off';
};
const MAX_UNIQUE_SKILL_LEVEL = 8;
// 固有技の強化ポイントは、技を上げるほかに「いまのガッツを戻す」ことにも使える。
// 育てきって技がすべてMAXになったあともポイントが余らないようにするための使い道。
// 最大ガッツそのものは増やさず、最大までの範囲で現在値だけを回復する。
const GUTS_RECOVERY_POINT_COST = 1; // 1回に使う強化ポイント
const GUTS_RECOVERY_AMOUNT = 10;    // 1回で戻る現在ガッツ
// UPGRADE_SKILLのAUTO配分を同期的に決める。画面に並んだ合法な技だけを受け取り、
// 1Pごとに候補を引き直すため、途中で上限へ達した技は以後の抽選から外れる。
const chooseAutoUniqueUpgradePlan = (uniques, upgradePoints, maxLevel = MAX_UNIQUE_SKILL_LEVEL, rng = Math.random) => {
  if (!Array.isArray(uniques) || !Number.isInteger(upgradePoints) || upgradePoints < 0
    || !Number.isInteger(maxLevel) || maxLevel < 0 || typeof rng !== 'function') return null;
  const levels = {};
  const allocations = {};
  for (const entry of uniques) {
    const key = typeof entry?.key === 'string' ? entry.key : '';
    const level = entry?.level;
    if (!key || Object.prototype.hasOwnProperty.call(levels, key)
      || !Number.isInteger(level) || level < 0 || level > maxLevel) return null;
    levels[key] = level;
  }
  let remainingPoints = upgradePoints;
  while (remainingPoints > 0) {
    const candidates = Object.keys(levels).filter(key => levels[key] < maxLevel);
    if (candidates.length === 0) break;
    const roll = rng();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
    const key = candidates[Math.floor(roll * candidates.length)];
    levels[key] += 1;
    allocations[key] = (allocations[key] || 0) + 1;
    remainingPoints -= 1;
  }
  return { allocations, levels, remainingPoints };
};
const INHERITED_UNIQUE_LEVEL_KEY_PREFIX = 'inhId:';
let inheritedUniqueIdSequence = 0;
const createInheritedUniqueId = () => {
  inheritedUniqueIdSequence += 1;
  const random = Math.floor(Math.random() * 0x100000000).toString(36);
  return `iu_${Date.now().toString(36)}_${inheritedUniqueIdSequence.toString(36)}_${random}`;
};
const inheritedUniqueLevelKey = (unique) => {
  const id = typeof unique?.inheritedUniqueId === 'string' ? unique.inheritedUniqueId.trim() : '';
  return id ? `${INHERITED_UNIQUE_LEVEL_KEY_PREFIX}${id}` : null;
};
// 恒久Lvは継承技自身のIDを正本にする。ID移行前だけ旧配列位置を読み、最後に従来どおり
// スナップショットのevoLevelへフォールバックする。
const resolveInheritedUniqueLevel = (masu, unique, index) => {
  const levels = masu?.uniqueSkillLevels && typeof masu.uniqueSkillLevels === 'object' ? masu.uniqueSkillLevels : {};
  const stableKey = inheritedUniqueLevelKey(unique);
  const value = stableKey && Object.prototype.hasOwnProperty.call(levels, stableKey)
    ? levels[stableKey]
    : (Object.prototype.hasOwnProperty.call(levels, `inh:${index}`) ? levels[`inh:${index}`] : unique?.evoLevel);
  return Math.max(0, Math.min(MAX_UNIQUE_SKILL_LEVEL, Math.floor(Number(value) || 0)));
};
const isValidInheritedUnique = (unique) => unique && typeof unique === 'object'
  && typeof unique.name === 'string' && unique.name.trim();

// ==================== 固有技設定(並び順・初期技) ====================
// 個体ごとに「どの順で見せるか」「バトル開始時にどれを構えるか」だけを覚える。
// 固有技Lv・技性能・消費ガッツ・継承元・固有技P・合体履歴には一切触らない。
//
// 技の識別は、恒久Lvと同じ安定キー(自前='own' / 継承='inhId:<inheritedUniqueId>')を使う。
// 配列位置(inh:0 など)は並び替えで意味が変わるため、保存する正本にはしない。
// ID移行前の壊れた記録だけは表示を欠かさないよう位置で仮のキーを付けるが、保存には残さない。
const OWN_UNIQUE_KEY = 'own';
const uniqueSettingKeyOf = (unique, index = 0) => inheritedUniqueLevelKey(unique) || `inh:${index}`;
const isStableUniqueSettingKey = (key) => key === OWN_UNIQUE_KEY
  || (typeof key === 'string' && key.startsWith(INHERITED_UNIQUE_LEVEL_KEY_PREFIX));
// 設定が無いときの並び(=これまでの並び)。自前が先頭で、続けて継承技を保存配列の順に並べる
const defaultUniqueSettingKeys = (masu) => [
  OWN_UNIQUE_KEY,
  ...(Array.isArray(masu?.inheritedUniques) ? masu.inheritedUniques : []).map((unique, index) => uniqueSettingKeyOf(unique, index)),
];
// 保存された並び順を、いま実際に持っている固有技へ合わせる(読むたびに行う。保存の一括書き換えはしない)。
//   設定が無い・壊れている → 従来順 ／ 保存に無い技(新しく増えた技) → 既存設定の後ろへ ／
//   いま持っていない技 → 無視 ／ 同じ技が二重 → 最初の1つだけ
const normalizeUniqueOrder = (masu) => {
  const current = defaultUniqueSettingKeys(masu);
  const known = new Set(current);
  const saved = Array.isArray(masu?.uniqueOrder) ? masu.uniqueOrder : [];
  const ordered = [];
  const seen = new Set();
  saved.forEach(key => {
    if (typeof key !== 'string' || !known.has(key) || seen.has(key)) return;
    seen.add(key); ordered.push(key);
  });
  current.forEach(key => { if (!seen.has(key)) { seen.add(key); ordered.push(key); } });
  return ordered;
};
// 初期技。設定が無い・いま持っていない技を指しているときは、これまでどおり自前の固有技へ戻す
const normalizeInitialUniqueKey = (masu) => {
  const key = typeof masu?.initialUniqueKey === 'string' ? masu.initialUniqueKey.trim() : '';
  return key && defaultUniqueSettingKeys(masu).includes(key) ? key : OWN_UNIQUE_KEY;
};
// 設定を書き戻す形。安定キーだけを保存し、位置で作った仮のキーは残さない
const buildUniqueSettingUpdate = (masu, { order, initialKey }) => {
  if (!masu) return null;
  return {
    ...masu,
    uniqueOrder: normalizeUniqueOrder({ ...masu, uniqueOrder:order }).filter(isStableUniqueSettingKey),
    initialUniqueKey: normalizeInitialUniqueKey({ ...masu, initialUniqueKey:initialKey }),
  };
};
// 「初期状態に戻す」= 自前を先頭かつ初期技、継承技は従来の標準順。
// 固有技Lv(uniqueSkillLevels)と固有技P(uniqueSkillPoints)には触れない
const buildUniqueSettingReset = (masu) => {
  if (!masu) return null;
  return {
    ...masu,
    uniqueOrder: defaultUniqueSettingKeys(masu).filter(isStableUniqueSettingKey),
    initialUniqueKey: OWN_UNIQUE_KEY,
  };
};
// 設定の安定キー → バトル中のスロット選択キー('own' / 'inh0' 等)。
// バトル側のキーは inheritedUniques の配列位置を指すので、並び替えても位置は動かさない。
// 指している技が見つからないときは、これまでどおり自前の固有技を使う
const battleUniqueKeyFromSettingKey = (mon, settingKey) => {
  if (!settingKey || settingKey === OWN_UNIQUE_KEY) return OWN_UNIQUE_KEY;
  const list = Array.isArray(mon?.inheritedUniques) ? mon.inheritedUniques : [];
  const index = list.findIndex((unique, i) => uniqueSettingKeyOf(unique, i) === settingKey);
  return index >= 0 ? `inh${index}` : OWN_UNIQUE_KEY;
};
// そのスロットで今えらばれている固有技のキー。ラン中に切り替えていればその選択、
// まだ切り替えていなければ、そのマスモンに設定された初期技(未設定なら自前)を使う
const activeSlotUniqueKey = (choice, slotIdx, mon) => (choice && choice[slotIdx])
  || battleUniqueKeyFromSettingKey(mon, mon?.initialUniqueKey);
// 個体ごとの並び順を、バトルで見せる候補の並びへ反映する。
// 並び順に無い技は元の順のまま末尾に残すので、候補が消えることはない
const sortUniqueOptionsByMasuOrder = (options, order) => {
  if (!Array.isArray(order) || order.length === 0) return options;
  const rank = new Map(order.map((key, index) => [key, index]));
  return options
    .map((option, index) => ({ option, index, rank: rank.has(option.settingKey) ? rank.get(option.settingKey) : Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => (a.rank - b.rank) || (a.index - b.index))
    .map(entry => entry.option);
};
// 画面に出す固有技の一覧(getRebirthSkillChoices と同じ key を持つもの)を設定の並び順にする。
// 並べ替えるのは表示だけで、key と固有技Lvの対応は動かさない
const orderUniqueChoicesByMasuOrder = (masu, choices) => {
  const rank = new Map(normalizeUniqueOrder(masu).map((key, index) => [key, index]));
  return (Array.isArray(choices) ? choices : [])
    .map((choice, index) => ({ choice, index, rank: rank.has(choice?.key) ? rank.get(choice.key) : Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => (a.rank - b.rank) || (a.index - b.index))
    .map(entry => entry.choice);
};
// 並び替え操作。ドラッグに頼らず「↑」「↓」1回ぶんだけ動かす
const moveUniqueOrderKey = (order, key, delta) => {
  const list = Array.isArray(order) ? [...order] : [];
  const from = list.indexOf(key);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) return list;
  list.splice(to, 0, list.splice(from, 1)[0]);
  return list;
};
// 構造ベースの冪等移行。旧inh:Nは互換用に残し、現在の配列対応を一度だけ安定ID側へ写す。
const migrateInheritedUniqueLevelIds = (masuMons, makeId = createInheritedUniqueId) => {
  let changed = false;
  const usedIds = new Set();
  const nextMasuMons = (Array.isArray(masuMons) ? masuMons : []).map(raw => {
    const inherited = Array.isArray(raw?.inheritedUniques) ? raw.inheritedUniques : [];
    const levels = raw?.uniqueSkillLevels && typeof raw.uniqueSkillLevels === 'object' ? { ...raw.uniqueSkillLevels } : {};
    let monsterChanged = false;
    const inheritedUniques = inherited.map((unique, index) => {
      if (!isValidInheritedUnique(unique)) return unique;
      let id = typeof unique.inheritedUniqueId === 'string' ? unique.inheritedUniqueId.trim() : '';
      if (!id || usedIds.has(id)) {
        do { id = String(makeId()); } while (!id || usedIds.has(id));
        monsterChanged = true;
      }
      usedIds.add(id);
      const nextUnique = id === unique.inheritedUniqueId ? unique : { ...unique, inheritedUniqueId:id };
      const stableKey = inheritedUniqueLevelKey(nextUnique);
      if (!Object.prototype.hasOwnProperty.call(levels, stableKey)) {
        levels[stableKey] = resolveInheritedUniqueLevel({ ...raw, uniqueSkillLevels:levels }, unique, index);
        monsterChanged = true;
      }
      return nextUnique;
    });
    if (!monsterChanged) return raw;
    changed = true;
    return { ...raw, inheritedUniques, uniqueSkillLevels:levels };
  });
  return { changed, nextMasuMons };
};
const appendInheritedUnique = (masu, unique, level, makeId = createInheritedUniqueId) => {
  const existingIds = new Set((Array.isArray(masu?.inheritedUniques) ? masu.inheritedUniques : [])
    .map(entry => entry?.inheritedUniqueId).filter(Boolean));
  let inheritedUniqueId;
  do { inheritedUniqueId = String(makeId()); } while (!inheritedUniqueId || existingIds.has(inheritedUniqueId));
  const inheritedUnique = { ...unique, inheritedUniqueId };
  return {
    ...masu,
    inheritedUniques:[...(Array.isArray(masu?.inheritedUniques) ? masu.inheritedUniques : []), inheritedUnique],
    uniqueSkillLevels:{
      ...(masu?.uniqueSkillLevels && typeof masu.uniqueSkillLevels === 'object' ? masu.uniqueSkillLevels : {}),
      [inheritedUniqueLevelKey(inheritedUnique)]:Math.max(0, Math.min(MAX_UNIQUE_SKILL_LEVEL, Math.floor(Number(level) || 0))),
    },
  };
};
// 継承固有技は保存時点の技定義をスナップショットとして持つが、元種が分かる記録は
// 現在の定義へ追従させる。古い記録や削除済みの種は、保存済みスナップショットを使い続ける。
// evoLevel は個体の育成結果なので、定義を更新しても必ず保存値を維持する。
const resolveInheritedUniqueDefinition = (unique) => {
  if (!unique || typeof unique !== 'object') return unique || null;
  const monId = unique.monId;
  const latest = monId && typeof ALL_PLAYER_MONSTERS !== 'undefined'
    ? ALL_PLAYER_MONSTERS[monId]?.unique
    : null;
  if (!latest) return unique;
  return {
    ...latest,
    monId,
    ...(unique.lineageId != null ? { lineageId:unique.lineageId } : {}),
    ...(unique.inheritedUniqueId != null ? { inheritedUniqueId:unique.inheritedUniqueId } : {}),
    ...(unique.sourceMasuName != null ? { sourceMasuName:unique.sourceMasuName } : {}),
    evoLevel: unique.evoLevel,
  };
};
const uniqueSkillAtLevel = (unique, level = 0) => {
  if (!unique) return null;
  const definition = resolveInheritedUniqueDefinition(unique);
  const lvl = Math.max(0, Math.min(MAX_UNIQUE_SKILL_LEVEL, Math.floor(Number(level) || 0)));
  const mult = definition.baseMult + lvl * 0.5;
  return {
    ...definition,
    name: definition.names?.[lvl] || definition.name,
    evoLevel: lvl,
    mult,
    guts: Math.floor(definition.baseGuts * (mult / definition.baseMult)),
    crit: 0.10 + 0.05 * lvl,
  };
};
// 継承固有技は、ラン内stateがまだ無い間もマスモンに保存された恒久Lvから始める。
// 0も有効なラン内値なので truthy 判定ではなく null/undefined のときだけ恒久Lvへ戻す。
const inheritedUniqueRunLevel = (unique, runLevel) => Math.max(0, Math.min(
  MAX_UNIQUE_SKILL_LEVEL,
  Math.floor(Number(runLevel != null ? runLevel : unique?.evoLevel) || 0),
));
// みゃるの薬系は進化するたび、データのdmgStepぶん自傷率が下がる。
// 表示と実戦処理で同じ計算を使い、進化後の説明と実効果がずれないようにする。
const myaruSelfDamageRate = (card, level = card?.evoLevel || 0) =>
  Math.max(0.1, card.selfDmg - level * card.dmgStep);
// 固有技の表示名は固有技Lvで変わるため、重複判定には技の出自を表す不変IDを使う。
// lineageId は今後データ側で明示でき、既存データは従来から保存されている monId へ安全にフォールバックする。
const uniqueLineageId = (unique, fallbackMonId = null) => unique?.lineageId || unique?.monId || fallbackMonId || null;
const normalizeInheritedUniqueLineages = (masuMons) => (Array.isArray(masuMons) ? masuMons : []).map(raw => {
  const masu = normalizeMasuProgression(raw);
  const base = (typeof ALL_PLAYER_MONSTERS !== 'undefined') ? ALL_PLAYER_MONSTERS[masu.baseId] : null;
  const ownedLineages = new Set([uniqueLineageId(base?.unique, masu.baseId)].filter(Boolean));
  const kept = [];
  const keptLevels = [];
  (Array.isArray(masu.inheritedUniques) ? masu.inheritedUniques : []).forEach((unique, index) => {
    const lineageId = uniqueLineageId(unique);
    if (!lineageId || ownedLineages.has(lineageId)) return;
    const level = resolveInheritedUniqueLevel(masu, unique, index);
    const existingIndex = kept.findIndex(entry => uniqueLineageId(entry) === lineageId);
    if (existingIndex < 0) {
      kept.push({ ...unique, lineageId });
      keptLevels.push(level);
    } else if (level > keptLevels[existingIndex]) {
      kept[existingIndex] = { ...unique, lineageId };
      keptLevels[existingIndex] = level;
    }
  });
  const uniqueSkillLevels = { ...masu.uniqueSkillLevels };
  kept.forEach((unique, index) => {
    const key = inheritedUniqueLevelKey(unique);
    if (key && !Object.prototype.hasOwnProperty.call(uniqueSkillLevels, key)) uniqueSkillLevels[key] = keptLevels[index];
  });
  return { ...masu, inheritedUniques:kept, uniqueSkillLevels };
});
const totalBondXpForLevel = (level) => {
  const target = Math.max(1, Math.min(SOUL_RANK_LEVEL_CAP, Math.floor(Number(level) || 1)));
  let total = 0;
  for (let current = 1; current < target; current++) total += xpForBondLevelAt(current);
  return total;
};
// 【限界突破と転生】
// 限界突破(旧「転生」): 上限に届いたらレベルはそのままで上限だけ +BREAKTHROUGH_LEVEL_CAP_GAIN する。
//   回数は rebirthCount に入れる。上限を上げた回数という意味は昔から変わらないので、
//   保存キーは変えない(名前だけ画面上で「限界突破」に改めた)。★の数がこの回数。
// 転生(新): 絆Lv REINCARNATE_MIN_LEVEL 以上で使える。レベルが REINCARNATE_LEVEL_DROP ぶん下がる
//   代わりに、振った強化をすべて振り直せる。回数は reincarnateCount(新しい項目)に入れ、
//   アイコンの「+N」で示す。
const MAX_MASU_LEVEL_CAP = 400;
// 限界突破でもらえる強化ポイント。初回(Lv30からの1回目)だけ多めにする
const BREAKTHROUGH_FIRST_POINTS = 5;
const BREAKTHROUGH_POINTS = 1;
const totalBreakthroughPoints = (count) => {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return n === 0 ? 0 : BREAKTHROUGH_FIRST_POINTS + BREAKTHROUGH_POINTS * (n - 1);
};
// ===== 限界突破の★ =====
// 5凸で1段階が完成し、次の段階では1個ずつ新しい色へ置き換わる(例: 6凸 = 黄1 + 青4)。
// 色は保存せず、保存してある rebirthCount から毎回組み立てる(表示用データを増やさない)。
// 「黄色」と「金」が見分けにくくならないよう、黄色は光沢を付けない素の黄色、
// 金は上が明るく下が暗い金属的な縁取りにして、色みも一段濃くしてある。
const BREAKTHROUGH_STARS_PER_TIER = 5;
const BREAKTHROUGH_STAR_TIERS = [
  { key:'blue',   label:'青', color:'#60a5fa', shadow:'0 1px 2px rgba(0,0,0,.85),0 0 3px #1d4ed8' },
  { key:'yellow', label:'黄色', color:'#fde047', shadow:'0 1px 2px rgba(0,0,0,.85)' },
  { key:'pink',   label:'ピンク', color:'#f472b6', shadow:'0 1px 2px rgba(0,0,0,.85),0 0 3px #db2777' },
  { key:'purple', label:'紫', color:'#c084fc', shadow:'0 1px 2px rgba(0,0,0,.85),0 0 3px #7e22ce' },
  { key:'red',    label:'赤', color:'#ef4444', shadow:'0 1px 2px rgba(0,0,0,.85),0 0 3px #991b1b' },
  { key:'gold',   label:'金', color:'#c88716', background:'linear-gradient(165deg,#fffdf0 3%,#f8e7a1 22%,#ffc83d 43%,#b66a08 70%,#fff0a8 86%,#7a3d05 100%)', shadow:'0 -1px 0 #fffbdc,0 1px 0 #5b2b03,0 0 5px rgba(255,174,24,.9)', stroke:'0.45px #6b3605' },
];
// 通常の限界突破で到達できる回数。段階数×5 = 30回で、そのときのレベル上限はLv.180
const BREAKTHROUGH_MAX_COUNT = BREAKTHROUGH_STAR_TIERS.length * BREAKTHROUGH_STARS_PER_TIER;
const BREAKTHROUGH_FINAL_LEVEL_CAP = INITIAL_MASU_LEVEL_CAP + BREAKTHROUGH_LEVEL_CAP_GAIN * BREAKTHROUGH_MAX_COUNT;
// 金★5のあと、虹★へ1個ずつ置き換わる5段階でLv.400へ到達する。
const FINAL_BREAKTHROUGH_COUNT = BREAKTHROUGH_MAX_COUNT + BREAKTHROUGH_STARS_PER_TIER;
const BREAKTHROUGH_LEVEL_CAPS = { 30:180, 31:200, 32:230, 33:270, 34:330, 35:400 };
const breakthroughLevelCap = (count) => {
  const n = Math.max(0, Math.min(FINAL_BREAKTHROUGH_COUNT, Math.floor(Number(count) || 0)));
  return n <= BREAKTHROUGH_MAX_COUNT
    ? INITIAL_MASU_LEVEL_CAP + n * BREAKTHROUGH_LEVEL_CAP_GAIN
    : BREAKTHROUGH_LEVEL_CAPS[n];
};
// 限界突破画面などの表示用。34凸でLv270→330帯が×2、35凸でLv330→400帯が×3になる。
// 実際の付与量は現在の凸数ではなく、下の「到達レベル帯」の共通関数を正本にする。
const levelUpPointMultiplier = (rebirthCount) => {
  const n = Math.max(0, Math.floor(Number(rebirthCount) || 0));
  return n >= 35 ? 3 : n >= 34 ? 2 : 1;
};
const ENHANCE_POINT_DOUBLE_LEVEL = 270;
const ENHANCE_POINT_TRIPLE_LEVEL = 330;
// 「そのレベルへ上がる1回」で得る通常強化ポイント。
// Lv2〜270は1、Lv271〜330は2、Lv331〜400は3。Lv401以降は超越ポイントの領域。
const levelEnhancePointMultiplier = (reachedLevel) => {
  const level = Math.max(1, Math.floor(Number(reachedLevel) || 1));
  return level > ENHANCE_POINT_TRIPLE_LEVEL ? 3 : level > ENHANCE_POINT_DOUBLE_LEVEL ? 2 : 1;
};
// 現在レベルまでに「レベル由来」で得ているべき通常強化ポイントの総数。
// 重要: 34/35凸になったからといって、過去のLv1〜270へ×2/×3を遡及適用しない。
const levelBasedEnhancePoints = (level) => {
  const capped = Math.max(1, Math.min(MAX_MASU_LEVEL_CAP, Math.floor(Number(level) || 1)));
  const single = Math.max(0, Math.min(capped, ENHANCE_POINT_DOUBLE_LEVEL) - 1);
  const doubled = Math.max(0, Math.min(capped, ENHANCE_POINT_TRIPLE_LEVEL) - ENHANCE_POINT_DOUBLE_LEVEL) * 2;
  const tripled = Math.max(0, capped - ENHANCE_POINT_TRIPLE_LEVEL) * 3;
  return single + doubled + tripled;
};
// バトル・チケット・合体などで複数レベルを一度にまたいでも、帯ごとの差分を正確に付与する。
const gainedEnhancePointsBetweenLevels = (beforeLevel, afterLevel) =>
  Math.max(0, levelBasedEnhancePoints(afterLevel) - levelBasedEnhancePoints(beforeLevel));
// 2026-08-29の不具合版(#827)が起動時補填に使ってしまった誤式。
// 既存セーブの「その不具合で増えた分だけ」を安全に特定して戻すために、移行処理からのみ使う。
const legacyRetroactiveLevelBasedEnhancePoints = (level, rebirthCount) =>
  Math.max(0, Math.min(MAX_MASU_LEVEL_CAP, Math.floor(Number(level) || 0)) - 1)
    * levelUpPointMultiplier(rebirthCount);
const RAINBOW_STAR_IMAGE = 'images/ui/breakthrough-rainbow-star.PNG';
// 凸数から★の並びを作る。新しい色を先頭に、残りは1つ前の段階の色で埋める
const breakthroughStars = (count) => {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n <= 0) return [];
  // 31～35凸は、完成済みの虹★で金★を先頭から1個ずつ置き換える。
  if (n > BREAKTHROUGH_MAX_COUNT) {
    const rainbowCount = Math.min(BREAKTHROUGH_STARS_PER_TIER, n - BREAKTHROUGH_MAX_COUNT);
    const rainbow = Array.from({ length:rainbowCount }, () => ({ key:'rainbow', image:RAINBOW_STAR_IMAGE }));
    const gold = BREAKTHROUGH_STAR_TIERS[BREAKTHROUGH_STAR_TIERS.length - 1];
    return rainbow.concat(Array.from({ length:BREAKTHROUGH_STARS_PER_TIER - rainbowCount }, () => gold));
  }
  const capped = Math.min(n, BREAKTHROUGH_MAX_COUNT);
  const tierIndex = Math.floor((capped - 1) / BREAKTHROUGH_STARS_PER_TIER);
  const filled = ((capped - 1) % BREAKTHROUGH_STARS_PER_TIER) + 1;
  const tier = BREAKTHROUGH_STAR_TIERS[tierIndex];
  const prev = tierIndex > 0 ? BREAKTHROUGH_STAR_TIERS[tierIndex - 1] : null;
  const stars = Array.from({ length: filled }, () => tier);
  // 1段階目(青)だけは前の色が無いので、5個に満たないまま出す
  if (prev) for (let i = filled; i < BREAKTHROUGH_STARS_PER_TIER; i++) stars.push(prev);
  return stars;
};
const isFinalBreakthroughCount = (count) => Math.max(0, Math.floor(Number(count) || 0)) >= FINAL_BREAKTHROUGH_COUNT;
const breakthroughStarStyle = (star) => ({
  color:star.color,
  textShadow:star.shadow,
  backgroundImage:star.background,
  WebkitBackgroundClip:star.background?'text':undefined,
  backgroundClip:star.background?'text':undefined,
  WebkitTextFillColor:star.background?'transparent':undefined,
  WebkitTextStroke:star.stroke,
});
// ===== 限界突破に使うアイテム「虹のプシュケー」 =====
// 所持数は他の消耗アイテムと同じ mh_owned_items({ itemId: 個数 })へ入れる。
// 新しい保存キーは作らないので、持っていない旧セーブは「0個」として読める。
// 必要数は限界突破1回ごとに増える。1回目5個・以降+1個で、
//   30回目 = 5 + 29×1 = 34個 / 最終限界突破(31回目) = 5 + 30×1 = 35個
const BREAKTHROUGH_ITEM_ID = 'rainbow_psyche';
// 魂格進化の素材。マーケットでは販売せず、高難度の実クリアでだけ増える。
// 所持数は他アイテムと同じ mh_owned_items の中へ入れ、新しい保存キーは作らない。
const HERO_PROOF_ITEM_ID = 'hero_proof';
const HERO_PROOF_ITEM = Object.freeze({
  id:HERO_PROOF_ITEM_ID,
  name:'勇者の証',
  emoji:'🏅',
  usage:'soulRank',
  desc:'魂格進化Ⅰ〜Ⅴに使う高難度クリア報酬。神殿の「魂格進化」で消費する。',
});
const HERO_PROOF_CLEAR_REWARDS = Object.freeze({
  extreme:Object.freeze({ GOD:1, RAGNAROK:2 }),
  speciesChallenge:Object.freeze({ GOD:1, RAGNAROK:2 }),
  pro:Object.freeze({ Master:1, GrandMaster:2, Hell:3, Legend:4 }),
});
const heroProofClearReward = ({
  runMode, difficulty, extremeDifficulty=null, speciesDifficulty=null,
  speciesSave=true, debug=false,
} = {}) => {
  if (debug || runMode === BATTLE_MODE_QUICK) return 0;
  if (runMode === BATTLE_MODE_SPECIES_CHALLENGE) {
    return speciesSave ? (HERO_PROOF_CLEAR_REWARDS.speciesChallenge[speciesDifficulty] || 0) : 0;
  }
  if (runMode === BATTLE_MODE_PRO) return HERO_PROOF_CLEAR_REWARDS.pro[difficulty] || 0;
  if (extremeDifficulty) return HERO_PROOF_CLEAR_REWARDS.extreme[extremeDifficulty] || 0;
  return 0;
};
// 超越ポイントリセットの書。マーケット(data/breeder.js)の同じIDを指す
const TRANSCEND_RESET_ITEM_ID = 'transcend_reset_scroll';
const BREAKTHROUGH_ITEM_BASE = 5;
const BREAKTHROUGH_ITEM_STEP = 1;
// nextCount は「これから行う限界突破が何回目か」(rebirthCount + 1)
const breakthroughItemCost = (nextCount) => {
  const n = Math.max(1, Math.floor(Number(nextCount) || 1));
  return BREAKTHROUGH_ITEM_BASE + (n - 1) * BREAKTHROUGH_ITEM_STEP;
};
// 合体XPを全量受け取るための限界突破を、既存の上限上昇・費用式だけでまとめて試算する。
// 合体確定時にも同じ結果を使い、表示と実際の消費がずれないようにする。
const buildFusionBreakthroughPlan = ({ masu, fusionXp = 0, gold = 0, psycheOwned = 0 }) => {
  const normalized = normalizeMasuProgression(masu);
  const beforeXp = cappedBondXp(normalized);
  const gain = Math.max(0, Math.floor(Number(fusionXp) || 0));
  const uncappedXp = beforeXp + gain;
  const plannedLevel = bondLevelInfo(uncappedXp).level;
  let levelCap = normalized.levelCap;
  let rebirthCount = normalized.rebirthCount;
  let psycheCost = 0;
  let diamondCost = 0;
  const diamondCosts = [];
  let gainedPoints = 0;
  while (plannedLevel > levelCap && levelCap < MAX_MASU_LEVEL_CAP) {
    rebirthCount += 1;
    psycheCost += breakthroughItemCost(rebirthCount);
    const nextDiamondCost = masuRebirthCost(levelCap);
    diamondCost += nextDiamondCost;
    diamondCosts.push(nextDiamondCost);
    gainedPoints += rebirthCount === 1 ? BREAKTHROUGH_FIRST_POINTS : BREAKTHROUGH_POINTS;
    levelCap = breakthroughLevelCap(rebirthCount);
  }
  const count = rebirthCount - normalized.rebirthCount;
  const psycheHave = ownedItemCount({ [BREAKTHROUGH_ITEM_ID]:psycheOwned }, BREAKTHROUGH_ITEM_ID);
  const goldHave = donationDiamondValue(gold);
  return {
    count, plannedLevel, levelCap, rebirthCount, psycheCost, diamondCost, diamondCosts, gainedPoints,
    psycheHave, goldHave,
    psycheShortage:Math.max(0, psycheCost - psycheHave),
    diamondShortage:Math.max(0, diamondCost - goldHave),
    canReceiveAll:plannedLevel <= levelCap,
    canAfford:plannedLevel <= levelCap && psycheHave >= psycheCost && goldHave >= diamondCost,
    nextPsyche:psycheHave - psycheCost,
    nextGold:goldHave - diamondCost,
    nextMasu:{
      ...normalized,
      levelCap,
      rebirthCount,
      distAptPoints:Math.max(0, Math.floor(Number(normalized.distAptPoints) || 0)) + gainedPoints,
      // まとめて突破するときは従来の「あとで決める」と同じく、固有技ポイントを保持する。
      uniqueSkillPoints:Math.max(0, Math.floor(Number(normalized.uniqueSkillPoints) || 0)) + count,
    },
  };
};
const ownedItemCount = (ownedItems, itemId) => Math.max(0, Math.floor(Number(ownedItems?.[itemId]) || 0));
// 魂格再編の書は同じマーケットで「ダイヤ購入」と「勇者の証1個→1冊交換」の2経路を持つ。
// どちらも所持先は既存 mh_owned_items の同じ itemId。交換用の別資産は作らない。
const buildSoulRankRespecExchange = (ownedItems, quantity = 1) => {
  const current = ownedItems && typeof ownedItems === 'object' && !Array.isArray(ownedItems) ? ownedItems : {};
  const count = Math.max(0, Math.floor(Number(quantity) || 0));
  const proofHave = ownedItemCount(current, HERO_PROOF_ITEM_ID);
  if (count <= 0 || proofHave < count) return { ok:false, count, proofHave, nextOwnedItems:current };
  return {
    ok:true, count, proofHave, nextProof:proofHave-count,
    nextOwnedItems:{
      ...current,
      [HERO_PROOF_ITEM_ID]:proofHave-count,
      [SOUL_RANK_RESPEC_ITEM_ID]:ownedItemCount(current, SOUL_RANK_RESPEC_ITEM_ID)+count,
    },
  };
};
const buildSoulRankRespecUse = (masu, ownedItems) => {
  const current = ownedItems && typeof ownedItems === 'object' && !Array.isArray(ownedItems) ? ownedItems : {};
  const scrollHave = ownedItemCount(current, SOUL_RANK_RESPEC_ITEM_ID);
  if (scrollHave <= 0) return { ok:false, reason:'魂格再編の書を所持していません。', scrollHave, nextOwnedItems:current };
  const reset = buildMasuSoulTraitReset(masu);
  if (!reset) return { ok:false, reason:'リセットする魂格特性がありません。', scrollHave, nextOwnedItems:current };
  return {
    ok:true,
    refundedPoints:reset.refundedPoints,
    nextMasu:reset.nextMasu,
    nextOwnedItems:{ ...current, [SOUL_RANK_RESPEC_ITEM_ID]:scrollHave-1 },
  };
};
// ===== 超越の実（種族チャレンジ報酬の所持データ基盤） =====
// 「種族」はモンスター1体ではなく主血統(モッチー種・ピクシー種…)を指す。
// 血統idを itemId の末尾へそのまま保持し、表示名の変更に影響されないようにする。
// data/lineages.js から生成するため、モンスター追加時に個別定義を足す必要はない。
const SPECIES_TRANSCEND_FRUIT_ITEM_ID_PREFIX = 'transcend_fruit_species_';
const RAINBOW_TRANSCEND_FRUIT_ITEM_ID = 'transcend_fruit_rainbow';
// 実際に登場する主血統だけを対象にする(プレイアブルモンスターがいない血統は作らない)。
// dexMainLineages はこのファイルの後ろで定義されるので、モジュール読み込み時ではなく
// 最初に必要になったときに作る。ここで即座に呼ぶと
// 「Cannot access 'dexMainLineages' before initialization」で画面が真っ白になる
const speciesChallengeLineages = () => dexMainLineages();
let _speciesTranscendFruitItems = null;
const speciesTranscendFruitItems = () => {
  if (!_speciesTranscendFruitItems) {
    _speciesTranscendFruitItems = Object.freeze(Object.fromEntries(
      speciesChallengeLineages().map(lineage => [lineage.id, Object.freeze({
        id:`${SPECIES_TRANSCEND_FRUIT_ITEM_ID_PREFIX}${lineage.id}`,
        name:`超越の実（${lineage.name}種）`,
        lineageId:lineage.id,
        // アイテム欄(ITEM_INVENTORY)に並べるための見た目。マーケットでは売らない
        // (種族チャレンジの初回クリア報酬でしか増えない)ので、BREEDER_MARKET_ITEMSには
        // 登録しない。usage:'transcendFruit' で「使う」ボタンの代わりに使う場所を案内する
        emoji:'🍇',
        usage:'transcendFruit',
        desc:`${lineage.name}種のマスモンに使える。1個で超越ポイント+1。マスモン詳細の「超越強化」から使う。`,
      })])
    ));
  }
  return _speciesTranscendFruitItems;
};
// 【後方互換】種族をモンスター1体単位で作っていたころの実(transcend_fruit_species_Mocchi 等)。
// もう配らないが、すでに持っている人の所持品を無効にしないため、使う側では受け付ける。
// 対応する血統のマスモンへ、新しい実と同じように使える。
const LEGACY_SPECIES_TRANSCEND_FRUIT_ITEMS = Object.freeze(Object.fromEntries(
  Object.keys(typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS : {}).map(baseId => [baseId, Object.freeze({
    id:`${SPECIES_TRANSCEND_FRUIT_ITEM_ID_PREFIX}${baseId}`,
    baseId,
  })])
));
const legacySpeciesTranscendFruitItemId = (baseId) => (
  typeof baseId === 'string' && Object.hasOwn(LEGACY_SPECIES_TRANSCEND_FRUIT_ITEMS, baseId)
    ? LEGACY_SPECIES_TRANSCEND_FRUIT_ITEMS[baseId].id
    : null
);
// 旧実は「モンスター1体ぶん」だが、いまの種族は主血統なので、同じ血統のマスモンへ広く使えるようにする。
// (ミタラシの旧実をモッチーのマスモンへ使う、など)。所持しているのに使い道が無い状態を作らないための後方互換で、
// 実の中身を書き換えたり別のidへ変換したりはしない(所持数はそのまま、消費するときだけ減る)。
// monsterLineageOf はこのファイルの後ろで定義されるので、呼ばれたときに解決する
const legacySpeciesTranscendFruitsForLineage = (baseId) => {
  const lineageId = typeof baseId === 'string' ? monsterLineageOf(baseId).main.id : null;
  if (!lineageId) return [];
  return Object.values(LEGACY_SPECIES_TRANSCEND_FRUIT_ITEMS)
    .filter(item => monsterLineageOf(item.baseId).main.id === lineageId);
};
const legacySpeciesTranscendFruitIdsForLineage = (baseId) => legacySpeciesTranscendFruitsForLineage(baseId).map(item => item.id);
const RAINBOW_TRANSCEND_FRUIT_ITEM = Object.freeze({ id:RAINBOW_TRANSCEND_FRUIT_ITEM_ID, name:'虹の超越の実', lineageId:null });
// 既存の虹の超越の実IDをそのままMARKET商品へ接続する。通貨は通常の虹ではないプシュケー。
BREEDER_MARKET_ITEMS.push({
  id:RAINBOW_TRANSCEND_FRUIT_ITEM_ID, name:RAINBOW_TRANSCEND_FRUIT_ITEM.name, type:'item', emoji:'🌈',
  cost:1000, currency:'psyche', usage:'transcendFruit',
  desc:'どの種族のマスモンにも使える。1個で超越ポイント+1',
});
// 実のidかどうかの判定も、種族の一覧と同じく最初に必要になったときに作る
let _transcendFruitItemIds = null;
const transcendFruitItemIds = () => {
  if (!_transcendFruitItemIds) {
    _transcendFruitItemIds = new Set([
      RAINBOW_TRANSCEND_FRUIT_ITEM_ID,
      ...Object.values(speciesTranscendFruitItems()).map(item => item.id),
      // すでに配ってしまった個体単位の実も、所持数を読める対象として残す
      ...Object.values(LEGACY_SPECIES_TRANSCEND_FRUIT_ITEMS).map(item => item.id),
    ]);
  }
  return _transcendFruitItemIds;
};
// 種族(主血統)idから実のidを引く
const speciesTranscendFruitItemId = (speciesId) => {
  const items = speciesTranscendFruitItems();
  return typeof speciesId === 'string' && Object.hasOwn(items, speciesId) ? items[speciesId].id : null;
};
// マスモン(個体)から、その子に使える種族の実のidを引く。baseId→主血統を経由する
const masuSpeciesTranscendFruitItemId = (baseId) => speciesTranscendFruitItemId(
  typeof baseId === 'string' ? monsterLineageOf(baseId).main.id : null
);
const transcendFruitOwnedCount = (ownedItems, itemId) => (
  transcendFruitItemIds().has(itemId) ? ownedItemCount(ownedItems, itemId) : 0
);
const changeTranscendFruitOwnedCount = (ownedItems, itemId, amount) => {
  const current = ownedItems && typeof ownedItems === 'object' && !Array.isArray(ownedItems) ? ownedItems : {};
  const n = Number(amount);
  if (!transcendFruitItemIds().has(itemId) || !Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return { ok:false, ownedItems:current };
  return { ok:true, ownedItems:{ ...current, [itemId]:transcendFruitOwnedCount(current, itemId) + n } };
};
const consumeTranscendFruit = (ownedItems, itemId, amount) => {
  const current = ownedItems && typeof ownedItems === 'object' && !Array.isArray(ownedItems) ? ownedItems : {};
  const n = Number(amount);
  const have = transcendFruitOwnedCount(current, itemId);
  if (!transcendFruitItemIds().has(itemId) || !Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || have < n) return { ok:false, ownedItems:current };
  return { ok:true, ownedItems:{ ...current, [itemId]:have - n } };
};
// 使用する実は呼び出し側が明示する。種族別の実が合わない場合に虹の実へ代用しない。
// 種族の実はその子の主血統のもの。個体単位で配っていたころの実も、同じ子へは使える
const useTranscendFruitOnMasu = (masu, ownedItems, itemId, amount) => {
  const currentItems = ownedItems && typeof ownedItems === 'object' && !Array.isArray(ownedItems) ? ownedItems : {};
  const n = Number(amount);
  const speciesItemId = masuSpeciesTranscendFruitItemId(masu?.baseId);
  const legacyItemIds = legacySpeciesTranscendFruitIdsForLineage(masu?.baseId);
  const itemMatches = itemId === RAINBOW_TRANSCEND_FRUIT_ITEM_ID
    || (speciesItemId !== null && itemId === speciesItemId)
    || legacyItemIds.includes(itemId);
  if (!masu || typeof masu !== 'object' || Array.isArray(masu) || !itemMatches
    || !Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return { ok:false, nextMasu:masu, nextOwnedItems:currentItems };
  }
  const consumed = consumeTranscendFruit(currentItems, itemId, n);
  if (!consumed.ok) return { ok:false, nextMasu:masu, nextOwnedItems:currentItems };
  return {
    ok:true,
    nextMasu:{ ...masu, transcendPoints:Math.max(0, Math.floor(Number(masu.transcendPoints) || 0)) + n },
    nextOwnedItems:consumed.ownedItems,
  };
};
// storeSet は保存先側の失敗を返さないことがあるため、2キーとも再読込してから成功とする。
// 片方でも期待値と違えば、消費前の組を両方へ書き戻して中途半端な保存を残さない。
// 複数の保存キーをまとめて更新する取引関数。storeGet / storeSet は引数で受け取る
// (純粋な部品として、検査からも差し替えて呼べるようにするため)。
//   entries: [{ key, before, next }, ...]
// 全部を並列に書く → 全部を読み戻して JSON で比べる → 1 つでも食い違うか例外が出たら
// 全部を before へ戻す(戻しは allSettled で最後まで試みる)。成立したときだけ true。
// 「マスモンだけ保存されてダイヤが減っていない」のような片方だけの状態を作らないための正本。
const saveStoredValuesOrRollback = async (entries, getValue, setValue) => {
  const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
  const list = Array.isArray(entries) ? entries : [];
  try {
    await Promise.all(list.map(({ key, next }) => setValue(key, next, false)));
    const saved = await Promise.all(list.map(({ key }) => getValue(key, null, false)));
    if (list.every(({ next }, i) => same(saved[i], next))) return true;
  } catch { /* rollback below */ }
  await Promise.allSettled(list.map(({ key, before }) => setValue(key, before, false)));
  return false;
};
const saveTranscendFruitPair = (beforeMasuMons, beforeOwnedItems, nextMasuMons, nextOwnedItems, getValue, setValue) =>
  saveStoredValuesOrRollback([
    { key:'mh_masu_mons', before:beforeMasuMons, next:nextMasuMons },
    { key:'mh_owned_items', before:beforeOwnedItems, next:nextOwnedItems },
  ], getValue, setValue);
const buildMarketItemPurchase = ({ item, gold=0, breederPoints=0, ownedItems={}, quantity=1 } = {}) => {
  const purchaseQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  const unitCost = Math.max(0, Math.floor(Number(item?.cost) || 0));
  const cost = unitCost * purchaseQuantity;
  const currency = item?.currency === 'psyche' ? 'psyche'
    : (item?.type === 'disc' || item?.type === 'assist' || item?.type === 'item') ? 'diamond' : 'breederPoint';
  const balances = { diamond:Math.max(0, Math.floor(Number(gold) || 0)), breederPoint:Math.max(0, Math.floor(Number(breederPoints) || 0)), psyche:ownedItemCount(ownedItems, BREAKTHROUGH_ITEM_ID) };
  if (!item || item.available === false || balances[currency] < cost) return { ok:false, currency, cost, gold:balances.diamond, breederPoints:balances.breederPoint, ownedItems };
  const nextItems = item.type === 'item' ? { ...ownedItems, [item.id]:ownedItemCount(ownedItems, item.id) + purchaseQuantity } : ownedItems;
  if (currency === 'psyche') nextItems[BREAKTHROUGH_ITEM_ID] = balances.psyche - cost;
  return { ok:true, currency, cost, quantity:purchaseQuantity, gold:currency === 'diamond' ? balances.diamond-cost : balances.diamond, breederPoints:currency === 'breederPoint' ? balances.breederPoint-cost : balances.breederPoint, ownedItems:nextItems };
};
const saveMarketBalances = (beforeGold, beforeItems, nextGold, nextItems, getValue, setValue) =>
  saveStoredValuesOrRollback([
    { key:'mh_gold', before:beforeGold, next:nextGold },
    { key:'mh_owned_items', before:beforeItems, next:nextItems },
  ], getValue, setValue);
const REINCARNATE_MIN_LEVEL = 100;
const REINCARNATE_LEVEL_DROP = 99;
const REINCARNATE_POINTS = 10;
const totalReincarnatePoints = (count) => Math.max(0, Math.floor(Number(count) || 0)) * REINCARNATE_POINTS;
// 転生で実際に得た強化ポイントを回数とは別に保存する。旧個体だけは当時の確定値
// (回数×10)へフォールバックし、以後は報酬量が変わっても保存済みの価値を再計算しない。
const ownReincarnateBonusPoints = (masu) => Number.isFinite(Number(masu?.reincarnateBonusPoints))
  ? Math.max(0, Math.floor(Number(masu.reincarnateBonusPoints)))
  : totalReincarnatePoints(masu?.reincarnateCount);
const inheritedReincarnateBonusPointsOf = (masu) => Math.max(0, Math.floor(Number(masu?.inheritedReincarnateBonusPoints) || 0));
const inheritedReincarnateCountOf = (masu) => Math.max(0, Math.floor(Number(masu?.inheritedReincarnateCount) || 0));
const transferableReincarnateBonus = (masu) => ({
  points: ownReincarnateBonusPoints(masu) + inheritedReincarnateBonusPointsOf(masu),
  count: Math.max(0, Math.floor(Number(masu?.reincarnateCount) || 0)) + inheritedReincarnateCountOf(masu),
});
const normalizeMasuProgression = (masu) => ({
  ...masu,
  // 旧booleanは曖昧な上限へ移行せずOFF。既存の数値設定は fixed として互換維持する。
  autoRepeatBreakthroughMode: normalizeAutoRepeatBreakthroughMode(masu?.autoRepeatBreakthroughMode, masu?.autoRepeatBreakthroughLevel),
  autoRepeatBreakthroughLevel: normalizeAutoRepeatBreakthroughLevel(masu?.autoRepeatBreakthroughLevel),
  rebirthCount: Math.max(0, Math.floor(Number(masu?.rebirthCount) || 0)),
  // 転生回数は後から足した項目なので、持っていない既存データは0として扱う
  reincarnateCount: Math.max(0, Math.floor(Number(masu?.reincarnateCount) || 0)),
  reincarnateBonusPoints: ownReincarnateBonusPoints(masu),
  inheritedReincarnateBonusPoints: inheritedReincarnateBonusPointsOf(masu),
  inheritedReincarnateCount: inheritedReincarnateCountOf(masu),
  levelCap: Math.min(masuLevelCapLimit(masu), Math.max(INITIAL_MASU_LEVEL_CAP, Math.floor(Number(masu?.levelCap) || INITIAL_MASU_LEVEL_CAP))),
  // 魂格の個体項目。旧セーブは魂格0・初到達Lv500・未振り分けとして読み、トップレベル保存キーは増やさない。
  soulRankStage: normalizeSoulRankStage(masu?.soulRankStage),
  soulPointMaxReachedLevel: normalizeSoulPointMaxReachedLevel(masu?.soulPointMaxReachedLevel),
  soulTraitLevels: normalizeSoulTraitLevels(masu?.soulTraitLevels),
  // 超越の項目。旧セーブには存在しないので、未超越・0として読む(移行処理はいらない)
  transcended: isTranscended(masu),
  transcendPoints: Math.max(0, Math.floor(Number(masu?.transcendPoints) || 0)),
  transcendStatPoints: normalizeTranscendStatPoints(masu?.transcendStatPoints),
  transcendAptBoosts: normalizeTranscendAptBoosts(masu?.transcendAptBoosts),
  uniqueSkillLevels: masu?.uniqueSkillLevels && typeof masu.uniqueSkillLevels === 'object' ? { ...masu.uniqueSkillLevels } : {},
  // 未使用の固有技ポイント。限界突破・転生でその場に上げなかったぶんをここへ貯めておき、
  // マスモンの詳細からいつでも使える。後から足した項目なので、持っていない既存データは0
  uniqueSkillPoints: Math.max(0, Math.floor(Number(masu?.uniqueSkillPoints) || 0)),
});
const buildAutoRepeatBreakthroughSettingUpdate = (masu, mode, level = 0) => {
  const normalizedMode = mode === 'follow' ? 'follow' : mode === 'fixed' ? 'fixed' : 'off';
  const normalizedLevel = normalizedMode === 'fixed' ? normalizeAutoRepeatBreakthroughLevel(level) : 0;
  return {
    ...masu,
    autoRepeatBreakthroughMode: normalizedMode === 'fixed' && normalizedLevel <= 0 ? 'off' : normalizedMode,
    autoRepeatBreakthroughLevel: normalizedLevel,
  };
};
// 従来の数値UI・古い呼び出しは fixed/OFF としてそのまま扱えるよう残す。
const buildAutoRepeatBreakthroughUpdate = (masu, level) => {
  const normalizedLevel = normalizeAutoRepeatBreakthroughLevel(level);
  return buildAutoRepeatBreakthroughSettingUpdate(masu, normalizedLevel > 0 ? 'fixed' : 'off', normalizedLevel);
};
// 固有技ポイントの仮配分を検証して反映した個体を返す。UI操作中は呼ばず、確定時だけ保存へ渡す。
const applyUniqueSkillPointPlan = (masu, plan, allowedSkillKeys) => {
  const normalized = normalizeMasuProgression(masu);
  if (!plan || typeof plan !== 'object' || !Array.isArray(allowedSkillKeys)) return null;
  const allowed = new Set(allowedSkillKeys.map(String));
  const allocations = {};
  let total = 0;
  for (const [rawKey, rawAmount] of Object.entries(plan)) {
    const key = String(rawKey);
    const amount = Math.max(0, Math.floor(Number(rawAmount) || 0));
    if (!allowed.has(key) || amount <= 0) continue;
    const current = Math.max(0, Math.floor(Number(normalized.uniqueSkillLevels[key]) || 0));
    if (current + amount > MAX_UNIQUE_SKILL_LEVEL) return null;
    allocations[key] = amount;
    total += amount;
  }
  if (total <= 0 || total > normalized.uniqueSkillPoints) return null;
  const uniqueSkillLevels = { ...normalized.uniqueSkillLevels };
  Object.entries(allocations).forEach(([key, amount]) => { uniqueSkillLevels[key] = Math.min(MAX_UNIQUE_SKILL_LEVEL, Math.max(0, Math.floor(Number(uniqueSkillLevels[key]) || 0)) + amount); });
  return { ...normalized, uniqueSkillLevels, uniqueSkillPoints: normalized.uniqueSkillPoints - total };
};
// 固有技へ配分済みのポイントだけを未使用へ戻す。個体のほかの育成情報はスプレッドでそのまま維持する。
const buildUniqueSkillPointReset = (masu) => {
  const normalized = normalizeMasuProgression(masu);
  const refundedPoints = Object.entries(normalized.uniqueSkillLevels)
    .reduce((sum, [key, level]) => {
      const legacyMatch = /^inh:(\d+)$/.exec(key);
      const stableShadowExists = legacyMatch && inheritedUniqueLevelKey(normalized.inheritedUniques?.[Number(legacyMatch[1])])
        && Object.prototype.hasOwnProperty.call(normalized.uniqueSkillLevels, inheritedUniqueLevelKey(normalized.inheritedUniques[Number(legacyMatch[1])]));
      return sum + (stableShadowExists ? 0 : Math.max(0, Math.floor(Number(level) || 0)));
    }, 0);
  if (refundedPoints <= 0) return null;
  return {
    refundedPoints,
    nextMasu: {
      ...normalized,
      uniqueSkillLevels: Object.fromEntries(Object.keys(normalized.uniqueSkillLevels).map(key => [key, 0])),
      uniqueSkillPoints: normalized.uniqueSkillPoints + refundedPoints,
    },
  };
};
// 転生では個体の識別情報・外見・固有技・履歴だけを残し、振った強化は白紙に戻す。
// オブジェクトスプレッドで旧育成値を残さないよう、維持対象を明示して新しい保存形を組み立てる。
// toLevel を渡すとそのレベル相当の絆経験値から再開する(渡さなければLv1へ戻す)。
const resetMasuForRebirth = (masu, { rebirthCount, reincarnateCount, reincarnateBonusPoints, levelCap, uniqueSkillLevels, uniqueSkillPoints, toLevel, distAptPoints } = {}) => {
  const base = (typeof ALL_PLAYER_MONSTERS !== 'undefined') ? ALL_PLAYER_MONSTERS[masu?.baseId] : null;
  const reset = {
    id: masu?.id,
    baseId: masu?.baseId,
    name: masu?.name,
    bondXp: totalBondXpForLevel(Math.max(1, Math.floor(Number(toLevel) || 1))),
    distAptPoints: Math.max(0, Math.floor(Number(distAptPoints ?? 5) || 0)),
    distApt: [...(base?.distAptitude || ['C','C','C','C'])],
    statPoints: { hp:0, atk:0, def:0, guts:0 },
    createdAt: masu?.createdAt,
    rebirthCount: Math.max(0, Math.floor(Number(rebirthCount ?? masu?.rebirthCount) || 0)),
    reincarnateCount: Math.max(0, Math.floor(Number(reincarnateCount ?? masu?.reincarnateCount) || 0)),
    reincarnateBonusPoints: Math.max(0, Math.floor(Number(reincarnateBonusPoints ?? ownReincarnateBonusPoints(masu)) || 0)),
    inheritedReincarnateBonusPoints: inheritedReincarnateBonusPointsOf(masu),
    inheritedReincarnateCount: inheritedReincarnateCountOf(masu),
    levelCap: Math.min(masuLevelCapLimit(masu), Math.max(INITIAL_MASU_LEVEL_CAP, Math.floor(Number(levelCap ?? masu?.levelCap) || INITIAL_MASU_LEVEL_CAP))),
    // 魂格は転生で失われない。初到達Lvを持ち越すことで魂格Pの二重取得も防ぐ。
    soulRankStage: normalizeSoulRankStage(masu?.soulRankStage),
    soulPointMaxReachedLevel: normalizeSoulPointMaxReachedLevel(masu?.soulPointMaxReachedLevel),
    soulTraitLevels: normalizeSoulTraitLevels(masu?.soulTraitLevels),
    // 超越は転生で失われない。状態・未使用の超越P・超越で上げた基礎値をそのまま持ち越す
    transcended: isTranscended(masu),
    transcendPoints: Math.max(0, Math.floor(Number(masu?.transcendPoints) || 0)),
    transcendStatPoints: normalizeTranscendStatPoints(masu?.transcendStatPoints),
    transcendAptBoosts: normalizeTranscendAptBoosts(masu?.transcendAptBoosts),
    uniqueSkillLevels: { ...(uniqueSkillLevels ?? masu?.uniqueSkillLevels ?? {}) },
    // 固有技のレベルは転生でも残るので、未使用のぶんもそのまま持ち越す
    uniqueSkillPoints: Math.max(0, Math.floor(Number(uniqueSkillPoints ?? masu?.uniqueSkillPoints) || 0)),
  };
  if (Array.isArray(masu?.colors)) reset.colors = [...masu.colors];
  else if (masu?.color != null) reset.color = masu.color;
  if (Array.isArray(masu?.inheritedUniques)) reset.inheritedUniques = masu.inheritedUniques.map(unique => ({ ...unique }));
  if (Array.isArray(masu?.fusionHistory)) reset.fusionHistory = masu.fusionHistory.map(entry => ({ ...entry }));
  if (masu?.individualStats && typeof masu.individualStats === 'object') reset.individualStats = { ...masu.individualStats };
  if (masu?.individualStatOffsets && typeof masu.individualStatOffsets === 'object') reset.individualStatOffsets = { ...masu.individualStatOffsets };
  if (Array.isArray(masu?.distAptBoosts)) reset.distAptBoosts = [0,0,0,0];
  return reset;
};
const migrateRebornMasuToFullReset = (masuMons) => (Array.isArray(masuMons) ? masuMons : []).map(raw => {
  const masu = normalizeMasuProgression(raw);
  return masu.rebirthCount > 0 ? resetMasuForRebirth(masu) : masu;
});
const cappedBondXp = (masu, gain = 0, maxLevel = null) => {
  const normalized = normalizeMasuProgression(masu);
  const currentXp = donationDiamondValue(normalized.bondXp);
  const requestedMaxLevel = maxLevel != null && Number.isFinite(Number(maxLevel))
    ? Math.max(1, Math.floor(Number(maxLevel))) : normalized.levelCap;
  const effectiveLevelCap = Math.min(normalized.levelCap, requestedMaxLevel);
  const cappedXp = Math.min(totalBondXpForLevel(effectiveLevelCap), currentXp + Math.max(0, Math.floor(Number(gain) || 0)));
  // AUTO∞など呼び出し側が一時的な上限を渡したとき、既存XPがその上限を超えていても巻き戻さない。
  // maxLevelを省略する通常報酬・チケット・合体は、従来どおり個体levelCapだけで頭打ちにする。
  return maxLevel == null ? cappedXp : Math.max(currentXp, cappedXp);
};
// 絆経験値の加算・レベル上限・強化ポイント付与を、通常バトル、チケット、合体で共有する。
// 戻り値に表示用の前後レベルと実際の付与量も含め、画面と保存値の計算がずれないようにする。
const transcendPointGainForReachedLevel = (reachedLevel) => {
  const level = Math.max(1, Math.floor(Number(reachedLevel) || 1));
  if (level <= MAX_MASU_LEVEL_CAP) return 0;
  if (level <= 500) return 1;
  if (level <= 600) return 2;
  if (level <= 700) return 3;
  if (level <= 800) return 4;
  if (level <= 900) return 5;
  return level <= SOUL_RANK_LEVEL_CAP ? 6 : 0;
};
const gainedTranscendPointsBetweenLevels = (fromLevel, toLevel) => {
  const from = Math.max(1, Math.floor(Number(fromLevel) || 1));
  const to = Math.max(from, Math.min(SOUL_RANK_LEVEL_CAP, Math.floor(Number(toLevel) || from)));
  let total = 0;
  for (let reached = from + 1; reached <= to; reached++) total += transcendPointGainForReachedLevel(reached);
  return total;
};
const applyBondXpGain = (masu, gain = 0, maxLevel = null) => {
  const normalized = normalizeMasuProgression(masu);
  const before = masuBondLevelInfo(normalized);
  const bondXp = cappedBondXp(normalized, gain, maxLevel);
  const after = bondLevelInfo(bondXp);
  const gainedLevels = Math.max(0, after.level - before.level);
  // Lv400までは今までどおり通常の強化ポイント。Lv401以降は通常Pを配らず、
  // 実際に上がったLv帯に応じて超越Pを1〜6P/Lvで配る。魂格段階そのものは倍率に使わない。
  const cap = MAX_MASU_LEVEL_CAP;
  const normalLevels = Math.max(0, Math.min(cap, after.level) - Math.min(cap, before.level));
  const gainedTranscendPoints = gainedTranscendPointsBetweenLevels(before.level, after.level);
  const gainedPoints = gainedEnhancePointsBetweenLevels(before.level, Math.min(cap, after.level));
  // 魂格PはLv501〜1000の「初到達」だけ。最高初到達Lvを正本にして、転生後の再到達では配らない。
  const previousSoulMax = normalizeSoulPointMaxReachedLevel(normalized.soulPointMaxReachedLevel);
  const nextSoulMax = Math.max(previousSoulMax, Math.min(SOUL_RANK_LEVEL_CAP, after.level));
  const gainedSoulPoints = Math.max(0, nextSoulMax - previousSoulMax);
  // 同一帯だけを上がった場合は従来UI用に×2/×3を返す。帯をまたぐ場合は誤解を避けて×表示を出さない。
  const sameBandMultiplier = normalLevels > 0 ? (gainedPoints / normalLevels) : 1;
  const pointMultiplier = Number.isInteger(sameBandMultiplier) ? sameBandMultiplier : 1;
  return {
    masu: {
      ...normalized,
      bondXp,
      soulPointMaxReachedLevel: nextSoulMax,
      distAptPoints: (normalized.distAptPoints || 0) + gainedPoints,
      ...(gainedTranscendPoints > 0
        ? { transcendPoints: Math.max(0, Math.floor(Number(normalized.transcendPoints) || 0)) + gainedTranscendPoints }
        : {}),
    },
    before,
    after,
    gainedLevels,
    gainedPoints,
    gainedTranscendPoints,
    gainedSoulPoints,
    pointMultiplier,
    xpGain: Math.max(0, bondXp - donationDiamondValue(normalized.bondXp)),
  };
};
// 周回終了時の絆経験値配布先を、表示処理やReact state更新から独立して一度だけ決定する。
// 優先順位は勇者モン(100%) > バトル参加マスモン(50%) > 編成内の控え(25%)。
// 同じ個体が複数枠に現れてもSetでまとめ、上位区分と下位区分の重複付与を防ぐ。
const buildRunBondAwards = ({ gain, heroMasuId, participantMasuIds, monsterRosterIds, masuMons }) => {
  const fullGain = Math.max(0, Math.floor(Number(gain) || 0));
  if (fullGain <= 0) return [];
  const ownedBondIds = new Set((Array.isArray(masuMons) ? masuMons : [])
    .filter(masu => masu && masu.id != null && Object.prototype.hasOwnProperty.call(masu, 'bondXp'))
    .map(masu => String(masu.id)));
  const heroId = heroMasuId != null && ownedBondIds.has(String(heroMasuId)) ? String(heroMasuId) : null;
  const participantIds = new Set((Array.isArray(participantMasuIds) ? participantMasuIds : [])
    .filter(id => id != null && ownedBondIds.has(String(id)) && String(id) !== heroId)
    .map(String));
  const rosterIds = new Set((Array.isArray(monsterRosterIds) ? monsterRosterIds : [])
    .filter(entry => typeof entry === 'string' && entry.startsWith('masu:'))
    .map(entry => entry.slice(5))
    .filter(id => ownedBondIds.has(String(id))));
  const awards = [];
  if (heroId) awards.push({ masuId:heroId, gain:fullGain, rate:1, showInResult:true });
  participantIds.forEach(masuId => awards.push({ masuId, gain:Math.max(1, Math.floor(fullGain / 2)), rate:0.5, showInResult:true }));
  rosterIds.forEach(masuId => {
    if (masuId === heroId || participantIds.has(masuId)) return;
    awards.push({ masuId, gain:Math.max(1, Math.floor(fullGain / 4)), rate:0.25, showInResult:false });
  });
  return awards;
};
const masuBondLevelInfo = (masu) => bondLevelInfo(cappedBondXp(masu));
// 旧セーブは単色の color を持っている。染色もどきの部位別対応より前に染めた分を染色①へ読み替える
const getMasuColors = (masu) => (masu && masu.colors) || (masu && masu.color ? [masu.color] : []);
// マスモンの個体基礎値を新旧どちらの保存形式からも解決する。
// 新形式があれば最新ベースへ差分を足し、無ければ完成値保存の individualStats をそのまま優先する。
// 超越で上げた基礎値は、種のベースデータも individualStats も書き換えず、
// 別項目(transcendStatPoints)として持ったまま「解決するとき」にだけ足す。
// こうしておくと、何が超越由来かが最後まで分かり、通常強化ぶん(statPoints)とも混ざらない。
const resolveMasuIndividualStats = (masu, base) => {
  const transcend = normalizeTranscendStatPoints(masu?.transcendStatPoints);
  const offsets = masu?.individualStatOffsets;
  if (offsets && typeof offsets === 'object' && !Array.isArray(offsets)) {
    const offset = (key) => Number.isFinite(Number(offsets[key])) ? Number(offsets[key]) : 0;
    return {
      hp: base.baseHp + offset('hp') + transcend.hp, atk: base.baseAtk + offset('atk') + transcend.atk,
      def: base.baseDef + offset('def') + transcend.def, guts: base.baseGuts + offset('guts') + transcend.guts,
    };
  }
  return {
    hp: (masu?.individualStats?.hp ?? base.baseHp) + transcend.hp,
    atk: (masu?.individualStats?.atk ?? base.baseAtk) + transcend.atk,
    def: (masu?.individualStats?.def ?? base.baseDef) + transcend.def,
    guts: (masu?.individualStats?.guts ?? base.baseGuts) + transcend.guts,
  };
};
// 間合い適性の段階。ここより下(個体値の解決・超越の基礎適性)から使うので、宣言をこの位置に置く。
const DIST_APTITUDE_GRADES = ['G','F','E','D','C','B','A','S','S+','SS','SS+','M'];
// 間合い適性も同様に、新形式の上昇段階数を最新ベースへ適用する。各値は0以上の整数としMで止める。
const raiseAptitudeGrade = (grade, steps) => {
  const current = Math.max(0, DIST_APTITUDE_GRADES.indexOf(grade));
  const up = Math.max(0, Math.floor(Number(steps) || 0));
  return DIST_APTITUDE_GRADES[Math.min(DIST_APTITUDE_GRADES.length - 1, current + up)];
};
// 超越で上げた「基礎」側の間合い適性。通常の強化ポイントで上げたぶんはこの上へ乗る。
// 段階の上限は既存どおりMで、それ以上へは上がらない。
const masuTranscendBaseAptitude = (masu, base) => {
  const baseApt = Array.isArray(base?.distAptitude) ? base.distAptitude.slice(0, 4) : ['C','C','C','C'];
  const boosts = normalizeTranscendAptBoosts(masu?.transcendAptBoosts);
  return baseApt.map((grade, index) => raiseAptitudeGrade(grade, boosts[index]));
};
const resolveMasuDistAptitude = (masu, base) => {
  const transcendBase = masuTranscendBaseAptitude(masu, base);
  if (Array.isArray(masu?.distAptBoosts)) return transcendBase
    .map((grade, index) => raiseAptitudeGrade(grade, masu.distAptBoosts[index]));
  // 旧形式(distAptに完成値を保存)の個体は、その値へ超越ぶんだけを足す
  const boosts = normalizeTranscendAptBoosts(masu?.transcendAptBoosts);
  return Array.isArray(masu?.distApt)
    ? masu.distApt.slice(0, 4).map((grade, index) => raiseAptitudeGrade(grade, boosts[index]))
    : transcendBase;
};
// マスモンの保存データへ、種の基礎データ(ALL_PLAYER_MONSTERS)と強化ポイントぶんを合成して
// 「モンスターらしいオブジェクト」を作る。詳細画面の表示も総合力の計算もこの結果を使うので、
// 画面に出ている現在値と総合力の元になる値が必ず一致する。
// idは元のモンスター種idのまま保つ(mainHero?.id==='Golem' 等の特性判定を壊さないため)。
const mergeMasuIntoMon = (masu) => {
  const base = ALL_PLAYER_MONSTERS[masu?.baseId];
  if (!base) return null;
  const sp = masu.statPoints || {};
  // 供モン時の合流ボーナスにも、通常強化と同じく超越で上げた基礎値を100%乗せる。
  // transcendStatPoints は実際の増加値なので倍率換算せず、そのまま1度だけ加算する。
  const tsp = normalizeTranscendStatPoints(masu?.transcendStatPoints);
  const individual = resolveMasuIndividualStats(masu, base);
  return {
    ...base,
    masuId: masu.id,
    masuName: masu.name,
    name: masu.name,
    baseHp: individual.hp + (sp.hp || 0),
    baseAtk: individual.atk + (sp.atk || 0),
    baseDef: individual.def + (sp.def || 0),
    baseGuts: individual.guts + (sp.guts || 0),
    plusStats: {
      hp: (base.plusStats?.hp || 0) + (sp.hp || 0) + tsp.hp,
      atk: (base.plusStats?.atk || 0) + (sp.atk || 0) + tsp.atk,
      def: (base.plusStats?.def || 0) + (sp.def || 0) + tsp.def,
      guts: (base.plusStats?.guts || 0) + (sp.guts || 0) + tsp.guts,
    },
    distAptitude: resolveMasuDistAptitude(masu, base),
    colors: getMasuColors(masu),
    unique: uniqueSkillAtLevel(base.unique, masu.uniqueSkillLevels?.own),
    // 壊れた保存データ(null や技の体を成さない要素)が混ざっていても落ちないようにする。
    inheritedUniques: (masu.inheritedUniques || []).map((unique, index) => uniqueSkillAtLevel(unique, resolveInheritedUniqueLevel(masu, unique, index))),
    // 固有技設定(並び順・初期技)。保存が無い個体はここで従来どおりの値になる
    uniqueOrder: normalizeUniqueOrder(masu),
    initialUniqueKey: normalizeInitialUniqueKey(masu),
    // STEP3: 魂格特性も個体解決結果へ載せる。詳細・一覧・総合力で同じ保存値を見るため。
    // 実戦効果そのものはSTEP4でこの同じ値へ接続する。
    soulTraitLevels: normalizeSoulTraitLevels(masu?.soulTraitLevels),
  };
};
// マスモン詳細で「元の値 ＋ 基礎UP(超越) ＋ 通常強化 ＝ 現在」を出すための内訳。★重要
// 新しい計算も保存も作らない。現在値は mergeMasuIntoMon の結果そのもので、
// 基礎UPと通常強化は保存済みの値をそのまま読む。元の値は引き算で求めるので、
// どんな個体でも 元 ＋ 基礎UP ＋ 通常強化 ＝ 現在 が必ず成り立つ。
// 個体データを持たないベースモンには null を返す(存在しない内訳を作らない)。
const masuGrowthBreakdown = (masu, mergedMon) => {
  if (!masu || !mergedMon) return null;
  const base = ALL_PLAYER_MONSTERS[masu.baseId];
  if (!base) return null;
  const sp = masu.statPoints || {};
  const tsp = normalizeTranscendStatPoints(masu.transcendStatPoints);
  const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  const stat = (key, label, currentValue, color) => {
    const baseUp = Math.max(0, num(tsp[key]));
    const enhance = Math.max(0, num(sp[key]));
    const current = num(currentValue);
    return { key, label, color, current, baseUp, enhance, origin: current - baseUp - enhance };
  };
  // 間合い適性は「段階」で積む。通常強化ぶんを別に持たない旧形式(distAptに完成値を保存)の個体は、
  // 保存されている完成値を元の適性として扱い、通常強化は0段階として出す(推測で分けない)。
  const aptBaseUps = normalizeTranscendAptBoosts(masu.transcendAptBoosts);
  const newFormat = Array.isArray(masu.distAptBoosts);
  const savedApt = Array.isArray(masu.distApt) ? masu.distApt : null;
  const apt = Array.from({ length: 4 }, (_, index) => {
    const baseUp = Math.max(0, num(aptBaseUps[index]));
    const enhance = newFormat ? Math.max(0, num(masu.distAptBoosts[index])) : 0;
    const originGrade = newFormat
      ? (base.distAptitude?.[index] || 'C')
      : (savedApt?.[index] || base.distAptitude?.[index] || 'C');
    const grade = mergedMon.distAptitude?.[index] || originGrade;
    // 段階はMで止まるので、足した段階の合計が現在の段階と合わないことがある
    const originIndex = Math.max(0, DIST_APTITUDE_GRADES.indexOf(originGrade));
    const capped = originIndex + baseUp + enhance > DIST_APTITUDE_GRADES.length - 1;
    return { index, originGrade, grade, baseUp, enhance, capped };
  });
  return {
    stats: [
      stat('hp', 'ライフ', mergedMon.baseHp, 'text-pink-400'),
      stat('atk', 'ちから', mergedMon.baseAtk, 'text-red-400'),
      stat('def', '丈夫さ', mergedMon.baseDef, 'text-emerald-400'),
      stat('guts', 'ガッツ', mergedMon.baseGuts, 'text-amber-400'),
    ],
    apt,
  };
};

// ==================== 血統と図鑑 ====================
// 血統の正本は data/lineages.js。ここは「引き方」だけを持つ。
// 血統はモンスターの種(baseId)に紐づくもので、マスモン(個体)へは保存しない。
// data/lineages.js を読めなかったときも画面が落ちないよう、必ず既定値へ落ちる。
const UNKNOWN_LINEAGE = Object.freeze({ id:'unknown', name:'？？？', rare:true });
const lineageCatalog = () => (typeof MONSTER_LINEAGES !== 'undefined' && MONSTER_LINEAGES) || {};
const lineageEntryMap = () => (typeof MONSTER_LINEAGE_MAP !== 'undefined' && MONSTER_LINEAGE_MAP) || {};
const lineageById = (id) => lineageCatalog()[id] || (id ? { id:String(id), name:String(id) } : UNKNOWN_LINEAGE);
// モンスターの種id(マスモンなら baseId)から主血統・副血統を引く。
// 将来の「○○血統限定モード」の参加判定もここを通す
const monsterLineageOf = (monsterId) => {
  const entry = lineageEntryMap()[monsterId];
  return {
    main: lineageById(entry?.main),
    sub: lineageById(entry?.sub != null ? entry.sub : entry?.main),
    known: !!entry,
  };
};
// 区分: 主血統と副血統が同じ → 純血 ／ どちらかがレア血統 → レア ／ それ以外 → 派生種
const monsterCategoryOf = (monsterId) => {
  const { main, sub } = monsterLineageOf(monsterId);
  if (main.rare || sub.rare) return 'rare';
  return main.id === sub.id ? 'pure' : 'derived';
};
const monsterCategoryName = (categoryId) =>
  (typeof MONSTER_CATEGORIES !== 'undefined' && MONSTER_CATEGORIES?.[categoryId]?.name) || '不明';
// 血統のアイコン。その血統を代表するプレイアブルモンスターがいるときだけ絵を使う。
// ドラゴン・ジョーカーのようにモンスターがいない血統は、絵を作らず名前だけで見せる
const lineageIconUrl = (lineage) => {
  const base = lineage?.monId && typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS[lineage.monId] : null;
  return base?.faceIconUrl || base?.iconUrl || null;
};
// 図鑑の説明。まだ書いていないモンスターは、空欄にせず調査中と伝える
const monsterDexDescription = (monsterId) =>
  (typeof MONSTER_DEX_DESCRIPTIONS !== 'undefined' && MONSTER_DEX_DESCRIPTIONS?.[monsterId])
  || 'この個体の記録はまだ集まっていません。調査が進むと図鑑へ追記されます。';
// 図鑑に並ぶモンスター。**主血統(種族)ごとにまとめて**並べる。
// 血統の並びは MONSTER_LINEAGES の定義順、同じ血統の中は ALL_PLAYER_MONSTERS の定義順。
// 以前は ALL_PLAYER_MONSTERS の定義順そのままだったので、モンスターを足した順に並び、
// 同じ種族が離れて出ていた(2026-09-08・ユーザー指摘「図鑑の全てが種族順になってない」。
// 剣士モッチーがモッチー・ミタラシと離れてエイキの隣に出ていた)。
// デバッグ専用個体(debugOnly)は図鑑に出さない。ここは図鑑だけでなく、血統の絞り込み
// (dexMainLineages)と種族チャレンジの種族一覧・メンバー表示も見ているので、
// 正式実装前のモンスターがそれらへ混ざらないよう、この1か所で除いている。
// 並び順は表示だけの話で、保存(mh_unlocked_monsters)は種のidを持つので影響しない
const dexMonsterList = () => {
  if (typeof ALL_PLAYER_MONSTERS === 'undefined') return [];
  const list = Object.values(ALL_PLAYER_MONSTERS).filter(mon => mon && !mon.debugOnly);
  // 血統の並びは「ALL_PLAYER_MONSTERS でその血統が最初に出てくる順」。
  // ここを血統カタログ(MONSTER_LINEAGES)の定義順にすると、カタログでは
  // プラントが dragon/joker より後ろに置かれているせいでプラント種だけが末尾へ動き、
  // 図鑑の絞り込みチップだけでなく、それを使っている種族チャレンジの種族タブと
  // 超越の実の並びまで巻き添えで変わってしまう(実測で確認)。
  // 初出順なら、今までのチップの並びが1つも変わらないまま図鑑だけが種族順になる
  const order = [];
  for (const mon of list) {
    const id = monsterLineageOf(mon.id).main?.id;
    if (id && !order.includes(id)) order.push(id);
  }
  const rank = (mon) => {
    const i = order.indexOf(monsterLineageOf(mon.id).main?.id);
    return i < 0 ? order.length : i;
  };
  // 同じ血統の中は、その血統を代表するモンスター(血統カタログの monId)を先頭にし、
  // あとは元の並びのまま。血統の絞り込みで「ウンディーネ」を選んだのに先頭が
  // スネグーラチカ、という分かりにくさをなくす(sortは安定だが添字で保険もかける)
  const isRepresentative = (mon) => lineageById(monsterLineageOf(mon.id).main?.id)?.monId === mon.id;
  return list
    .map((mon, i) => ({ mon, i }))
    .sort((a, b) => (rank(a.mon) - rank(b.mon))
      || ((isRepresentative(b.mon) ? 1 : 0) - (isRepresentative(a.mon) ? 1 : 0))
      || (a.i - b.i))
    .map(x => x.mon);
};
// 図鑑の絞り込みに出す主血統。実際に登場する主血統だけを、図鑑の並び順で並べる
const dexMainLineages = () => {
  const seen = new Set();
  return dexMonsterList().map(mon => monsterLineageOf(mon.id).main).filter(lineage => {
    if (!lineage || seen.has(lineage.id)) return false;
    seen.add(lineage.id); return true;
  });
};

// ==================== 総合力 ====================
// 「その個体がいま実際に持っている能力・育成結果」を1つの数値にした、表示・比較用の派生指標。
// 未使用の強化ポイントや育成の履歴(絆Lv・限界突破・転生・合体回数)には点を付けない。
// 保存はしない。いつでも現在の個体データから計算し直すので、能力・間合い適性・固有技Lvを
// 変えれば自動で追従し、絆ポイントリセットで能力が未使用ポイントへ戻れば同じだけ下がる。
//
// 計算に含めないもの: 未使用強化P / 絆Lv・絆XP / Lv上限 / 限界突破回数 / 転生回数 /
//   合体回数と合体で得たXP / 勇者特性 / 合流ボーナス(plusStats) / 染色 / 所持品・ダイヤ
const MONSTER_POWER_STAT_WEIGHT = { hp: 1, atk: 10 / 3, def: 10 / 3, guts: 10 / 3 };
// 間合い適性の段階ごとの点。Cを0として1段階ごとに10。4距離すべてを合計する
const MONSTER_POWER_APTITUDE = { M: 70, 'SS+': 60, SS: 50, 'S+': 40, S: 30, A: 20, B: 10, C: 0, D: -10, E: -20, F: -30, G: -40 };
const MONSTER_POWER_UNIQUE_OWNED = 100;   // 固有技を1つ持っていること自体の点(Lv0でも付く)
const MONSTER_POWER_UNIQUE_PER_LEVEL = 200 / 3; // 固有技の強化Lv1段階ごとの点
// 総合力に数える固有技の一覧。自前の固有技と、合体で継承した固有技を同じ基準で扱う。
// 壊れたデータ・存在しない技を架空の技として数えないよう、名前と倍率を持つものだけを通す。
const monsterPowerUniques = (mon) => [mon?.unique, ...((mon?.inheritedUniques) || [])]
  .filter(u => u && typeof u === 'object' && typeof u.name === 'string' && Number.isFinite(Number(u.baseMult)));
// 総合力の内訳。合計を出す前の各項目を返すので、検査や画面の説明にも使える
const monsterPowerParts = (mon) => {
  if (!mon) return { stat:0, aptitude:0, unique:0, soul:0, total:0 };
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const stat = num(mon.baseHp) * MONSTER_POWER_STAT_WEIGHT.hp
    + num(mon.baseAtk) * MONSTER_POWER_STAT_WEIGHT.atk
    + num(mon.baseDef) * MONSTER_POWER_STAT_WEIGHT.def
    + num(mon.baseGuts) * MONSTER_POWER_STAT_WEIGHT.guts;
  const apt = (Array.isArray(mon.distAptitude) ? mon.distAptitude : [])
    .slice(0, 4)
    .reduce((sum, grade) => sum + (MONSTER_POWER_APTITUDE[grade] ?? 0), 0);
  const uniques = monsterPowerUniques(mon);
  const uniquePower = uniques.length * MONSTER_POWER_UNIQUE_OWNED
    + uniques.reduce((sum, u) => sum + Math.max(0, Math.floor(num(u.evoLevel))), 0) * MONSTER_POWER_UNIQUE_PER_LEVEL;
  // 魂格特性は効果ごとに換算せず「使用済み魂格P×10」を一度だけ加える。
  const soulPower = soulTraitSpentPoints(mon) * 10;
  return { stat, aptitude:apt, unique:uniquePower, soul:soulPower, total:stat + apt + uniquePower + soulPower };
};
// 総合力の正本。解決済みのモンスター(ベースモンの定義、または mergeMasuIntoMon の結果)を渡す。
// 端数は最後にまとめて四捨五入する(項目ごとに丸めない)
const monsterPowerOf = (mon) => Math.round(monsterPowerParts(mon).total);
// 保存データのマスモンから総合力を出す。詳細画面と同じ解決(mergeMasuIntoMon)を通してから
// 同じ式へ渡すので、ベース値と強化値の二重加算は起きない
const masuPowerOf = (masu) => monsterPowerOf(mergeMasuIntoMon(masu));
// 第3段階で新旧表現を併記する新規個体は、保存前に能力・適性・総合力が一致することを確認する。
// 既存個体のロードには使わないため、旧データを補完・書換えする処理にはならない。
const masuBaselineRepresentationsMatch = (masu) => {
  if (!masu || !Array.isArray(masu.distAptBoosts)) return false;
  const legacy = { ...masu };
  delete legacy.individualStatOffsets;
  delete legacy.distAptBoosts;
  const oldResolved = mergeMasuIntoMon(legacy);
  const newResolved = mergeMasuIntoMon(masu);
  if (!oldResolved || !newResolved) return false;
  const values = mon => [mon.baseHp, mon.baseAtk, mon.baseDef, mon.baseGuts, ...mon.distAptitude];
  return JSON.stringify(values(oldResolved)) === JSON.stringify(values(newResolved))
    && monsterPowerOf(oldResolved) === monsterPowerOf(newResolved);
};
// 第6B-1段階の旧再生個体判定。createdAtには頼らず、保存済みの4能力が再生時の
// Math.round(base * (0.9～1.1)) で実際に生成できた歴代ベースだけを候補にする。
// Math.random() による0.9倍以上・1.1倍未満の生成区間と、Math.roundの区間が重なるか調べる。
const LEGACY_REGENERATION_STAT_BASELINES = {
  Pixie: [
    { id:'pre-2026-08-14', hp:250, atk:160, def:50, guts:140 },
    { id:'current', hp:250, atk:160, def:50, guts:170 },
  ],
  Mitarashi: [
    { id:'pre-2026-08-14', hp:600, atk:120, def:120, guts:100 },
    { id:'current', hp:630, atk:140, def:105, guts:90 },
  ],
};
const regenerationStatCouldBeGenerated = (value, baseValue) => {
  const stat = Number(value);
  const base = Number(baseValue);
  if (!Number.isInteger(stat) || !Number.isInteger(base) || base <= 0) return false;
  // 正数に対するMath.round(value)===statの区間は [stat-0.5, stat+0.5)。
  // 小数誤差を避けるため全境界を20倍した整数で比較する。
  return base * 18 < stat * 20 + 10 && base * 22 > stat * 20 - 10;
};
const diagnoseLegacyRegenerationStatBaseline = (masu) => {
  const statKeys = ['hp','atk','def','guts'];
  const base = ALL_PLAYER_MONSTERS[masu?.baseId];
  const historical = LEGACY_REGENERATION_STAT_BASELINES[masu?.baseId]
    || (base ? [{ id:'current', hp:base.baseHp, atk:base.baseAtk, def:base.baseDef, guts:base.baseGuts }] : []);
  const candidates = historical.filter(candidate => statKeys.every(key =>
    regenerationStatCouldBeGenerated(masu?.individualStats?.[key], candidate[key])));
  const result = {
    status: candidates.length === 1 ? 'SAFE_EXACT' : candidates.length > 1 ? 'AMBIGUOUS' : 'BLOCKED',
    candidates: candidates.map(candidate => ({ ...candidate })),
  };
  if (candidates.length === 1) {
    const candidate = candidates[0];
    result.individualStatOffsets = Object.fromEntries(statKeys.map(key =>
      [key, Number(masu.individualStats[key]) - candidate[key]]));
  }
  return result;
};
// 第6B-2段階の距離適性判定。候補を返すだけで、保存データへの補完・書込みは行わない。
// ゴーレムの旧形式は過去のベース変更前後を保存値だけでは区別できないため保留する。
const diagnoseLegacyDistAptBoosts = (masu) => {
  const checks = { validGrades:false, notBelowBase:false, withinCap:false, pointsConsistent:false, totalPointsPreserved:false, aptitudePreserved:false, powerPreserved:false };
  const reasons = [];
  const base = ALL_PLAYER_MONSTERS[masu?.baseId];
  const validAptitudes = value => Array.isArray(value) && value.length === 4
    && value.every(grade => DIST_APTITUDE_GRADES.includes(grade));
  const validBoosts = value => Array.isArray(value) && value.length === 4
    && value.every(boost => Number.isInteger(Number(boost)) && Number(boost) >= 0);
  if (!masu || typeof masu !== 'object' || !base || !validAptitudes(base.distAptitude)) {
    reasons.push('ベースの距離適性が有効な4距離の等級ではない');
    return { status:'BLOCKED', reasons, proposed:{}, checks };
  }
  const hasBoosts = Object.prototype.hasOwnProperty.call(masu, 'distAptBoosts');
  if (!hasBoosts && !validAptitudes(masu.distApt)) {
    reasons.push('保存済みdistAptが有効な4距離の等級ではない');
    return { status:'BLOCKED', reasons, proposed:{}, checks };
  }
  checks.validGrades = true;
  if (hasBoosts && !validBoosts(masu.distAptBoosts)) {
    reasons.push('distAptBoostsが0以上の整数4要素ではない');
    return { status:'BLOCKED', reasons, proposed:{}, checks };
  }
  if (!hasBoosts && masu.baseId === 'Golem') {
    reasons.push('ゴーレムは旧ベース適性A/C/E/Gと現行A/E/G/Gのどちらから強化されたか断定できない');
    return { status:'AMBIGUOUS', reasons, proposed:{}, checks };
  }
  const boosts = hasBoosts ? masu.distAptBoosts.map(Number) : masu.distApt.map((grade, index) =>
    DIST_APTITUDE_GRADES.indexOf(grade) - DIST_APTITUDE_GRADES.indexOf(base.distAptitude[index]));
  checks.notBelowBase = boosts.every(boost => boost >= 0);
  checks.withinCap = boosts.every((boost, index) =>
    DIST_APTITUDE_GRADES.indexOf(base.distAptitude[index]) + boost < DIST_APTITUDE_GRADES.length);
  const available = Number(masu.distAptPoints);
  if (!checks.notBelowBase) reasons.push('保存済みdistAptが現在のベースより低い');
  if (!checks.withinCap) reasons.push('投入段階を適用するとMを超える');
  if (!Number.isInteger(available) || available < 0) reasons.push('distAptPointsが0以上の整数ではない');
  if (reasons.length) return { status:'BLOCKED', reasons, proposed:{}, checks };

  const proposed = hasBoosts ? {} : { distAptBoosts:boosts };
  const candidate = { ...masu, ...proposed };
  const before = mergeMasuIntoMon(masu);
  const after = mergeMasuIntoMon(candidate);
  const recoveredBoostTotal = boosts.reduce((sum, value) => sum + value, 0);
  const proposedBoostTotal = (candidate.distAptBoosts || []).reduce((sum, value) => sum + Number(value), 0);
  const beforeReconciled = reconcileMasuPoints({ ...masu, statPoints:{ ...masu.statPoints } });
  const afterReconciled = reconcileMasuPoints({ ...candidate, statPoints:{ ...candidate.statPoints } });
  checks.pointsConsistent = beforeReconciled.distAptPoints === afterReconciled.distAptPoints;
  checks.totalPointsPreserved = recoveredBoostTotal === proposedBoostTotal
    && JSON.stringify(masu.statPoints) === JSON.stringify(candidate.statPoints)
    && masu.distAptPoints === candidate.distAptPoints;
  checks.aptitudePreserved = !!after && (hasBoosts || (!!before && JSON.stringify(before.distAptitude) === JSON.stringify(after.distAptitude)));
  checks.powerPreserved = !!after && Number.isFinite(monsterPowerOf(after))
    && (hasBoosts || (!!before && monsterPowerOf(before) === monsterPowerOf(after)));
  if (!checks.totalPointsPreserved || !checks.aptitudePreserved || !checks.powerPreserved) {
    reasons.push('候補適用前後で強化ポイント総量・距離適性・総合力を維持できない');
    return { status:'BLOCKED', reasons, proposed, checks };
  }
  return { status:'SAFE_EXACT', reasons, proposed, checks };
};
// 第6B-3段階の個体全体診断。能力と間合いを独立分類したうえで、安全と判定した候補だけを
// コピーへ適用し、能力は確定した生成時ベースとの個体差を現行ベースへ足し、
// 間合いは従来値を保つことを独立に再確認する。既存ポイントはどちらも変更しない。
// 通常個体は individualStats を持たないのが正常なので、能力側は移行済み相当として扱う。
const diagnoseLegacyMasuBaselineMigration = (masu) => {
  const statKeys = ['hp','atk','def','guts'];
  const hasOwn = key => !!masu && Object.prototype.hasOwnProperty.call(masu, key);
  const proposed = {};
  const individualStats = { status:'BLOCKED', proposedOffsets:{}, reasons:[] };
  const aptitude = { status:'BLOCKED', proposedBoosts:{}, reasons:[] };
  const checks = {
    statOffsetsCorrect:false,
    statsMatchCurrentBase:false,
    statDeltaMatchesBaseline:false,
    aptitudePreserved:false,
    powerRecalculated:false,
    statPointsPreserved:false,
    distAptPointsPreserved:false,
  };
  const base = ALL_PLAYER_MONSTERS[masu?.baseId];
  const validStatObject = value => value && typeof value === 'object' && !Array.isArray(value)
    && statKeys.every(key => Number.isFinite(Number(value[key])));
  const validIntegerStatOffsets = value => value && typeof value === 'object' && !Array.isArray(value)
    && statKeys.every(key => Number.isInteger(value[key]));
  const validStoredStatPoints = value => value && typeof value === 'object' && !Array.isArray(value)
    && statKeys.every(key => Number.isInteger(Number(value[key])) && Number(value[key]) >= 0
      && Number(value[key]) % STAT_POINT_GAIN[key] === 0);
  if (!masu || typeof masu !== 'object' || !base || !validStoredStatPoints(masu.statPoints)
    || !Number.isInteger(Number(masu.distAptPoints)) || Number(masu.distAptPoints) < 0) {
    const reason = '個体・ベース・statPoints・distAptPointsのいずれかが不正';
    individualStats.reasons.push(reason);
    aptitude.reasons.push(reason);
    return { individualStats, aptitude, overallStatus:'BLOCKED', checks };
  }

  const hasIndividualStats = hasOwn('individualStats');
  const hasOffsets = hasOwn('individualStatOffsets');
  if (!hasIndividualStats && !hasOffsets) {
    individualStats.status = 'ALREADY_MODERN';
    individualStats.reasons.push('通常個体は能力の移行が不要');
  } else if ((!hasOffsets && !validStatObject(masu.individualStats)) || (hasOffsets && !validIntegerStatOffsets(masu.individualStatOffsets))) {
    individualStats.reasons.push('individualStatsまたはindividualStatOffsetsの4能力が不正');
  } else if (hasOffsets) {
    const newResolved = mergeMasuIntoMon(masu);
    individualStats.status = newResolved && Number.isFinite(monsterPowerOf(newResolved)) ? 'ALREADY_MODERN' : 'BLOCKED';
    if (individualStats.status === 'BLOCKED') individualStats.reasons.push('現在ベースとindividualStatOffsetsから能力を解決できない');
  } else {
    const result = diagnoseLegacyRegenerationStatBaseline(masu);
    individualStats.status = result.status;
    individualStats.reasons = result.candidates.length ? [] : ['再生時の基礎値候補を特定できない'];
    if (result.status === 'SAFE_EXACT') {
      individualStats.proposedOffsets = { ...result.individualStatOffsets };
      proposed.individualStatOffsets = { ...result.individualStatOffsets };
      individualStats.confirmedBaseline = { ...result.candidates[0] };
    }
  }

  const aptResult = diagnoseLegacyDistAptBoosts(masu);
  aptitude.status = aptResult.status === 'SAFE_EXACT' && hasOwn('distAptBoosts') ? 'ALREADY_MODERN' : aptResult.status;
  aptitude.reasons = [...aptResult.reasons];
  if (aptResult.status === 'SAFE_EXACT' && !hasOwn('distAptBoosts')) {
    aptitude.proposedBoosts = [...aptResult.proposed.distAptBoosts];
    proposed.distAptBoosts = [...aptResult.proposed.distAptBoosts];
  }

  const before = mergeMasuIntoMon(masu);
  const preservesAptitudeCandidate = candidate => {
    const resolved = mergeMasuIntoMon(candidate);
    const statField = key => `base${key === 'hp' ? 'Hp' : key[0].toUpperCase() + key.slice(1)}`;
    return !!before && !!resolved
      && statKeys.every(key => before[statField(key)] === resolved[statField(key)])
      && JSON.stringify(before.distAptitude) === JSON.stringify(resolved.distAptitude)
      && monsterPowerOf(before) === monsterPowerOf(resolved)
      && JSON.stringify(masu.statPoints) === JSON.stringify(candidate.statPoints)
      && masu.distAptPoints === candidate.distAptPoints;
  };
  if (aptitude.status === 'SAFE_EXACT' && !preservesAptitudeCandidate({ ...masu, distAptBoosts:proposed.distAptBoosts })) {
    aptitude.status = 'BLOCKED';
    aptitude.proposedBoosts = {};
    aptitude.reasons.push('間合い候補の適用前後で能力・適性・総合力・既存ポイントを維持できない');
  }
  const safeProposed = {};
  if (individualStats.status === 'SAFE_EXACT') safeProposed.individualStatOffsets = proposed.individualStatOffsets;
  if (aptitude.status === 'SAFE_EXACT') safeProposed.distAptBoosts = proposed.distAptBoosts;
  const candidate = { ...masu, ...safeProposed };
  const after = mergeMasuIntoMon(candidate);
  const statField = key => `base${key === 'hp' ? 'Hp' : key[0].toUpperCase() + key.slice(1)}`;
  const currentBaseStat = key => Number(base[statField(key)]);
  const spentStat = key => Number(masu.statPoints[key]);
  const confirmedBaseline = individualStats.confirmedBaseline;
  checks.statOffsetsCorrect = individualStats.status !== 'SAFE_EXACT' || (!!confirmedBaseline && statKeys.every(key =>
    proposed.individualStatOffsets[key] === Number(masu.individualStats[key]) - Number(confirmedBaseline[key])));
  checks.statsMatchCurrentBase = !!after && (individualStats.status !== 'SAFE_EXACT' || statKeys.every(key =>
    after[statField(key)] === currentBaseStat(key) + proposed.individualStatOffsets[key] + spentStat(key)));
  checks.statDeltaMatchesBaseline = !!before && !!after && (individualStats.status !== 'SAFE_EXACT' || statKeys.every(key =>
    after[statField(key)] - before[statField(key)] === currentBaseStat(key) - Number(confirmedBaseline[key])));
  checks.aptitudePreserved = !!before && !!after && JSON.stringify(before.distAptitude) === JSON.stringify(after.distAptitude);
  checks.powerRecalculated = !!after && monsterPowerOf(after) === Math.round(monsterPowerParts(after).total);
  checks.statPointsPreserved = JSON.stringify(masu.statPoints) === JSON.stringify(candidate.statPoints);
  checks.distAptPointsPreserved = masu.distAptPoints === candidate.distAptPoints;
  if (individualStats.status === 'SAFE_EXACT' && (!checks.statOffsetsCorrect || !checks.statsMatchCurrentBase
    || !checks.statDeltaMatchesBaseline || !checks.statPointsPreserved || !checks.powerRecalculated)) {
    individualStats.status = 'BLOCKED';
    individualStats.proposedOffsets = {};
    individualStats.reasons.push('能力候補が個体差・現行ベース・能力変化量・既存statPoints・総合力と一致しない');
  }
  const statuses = [individualStats.status, aptitude.status];
  const overallStatus = statuses.includes('BLOCKED') ? 'BLOCKED'
    : statuses.every(status => status === 'ALREADY_MODERN') ? 'ALREADY_MODERN'
    : statuses.every(status => status === 'AMBIGUOUS') ? 'AMBIGUOUS'
    : statuses.includes('AMBIGUOUS') ? 'PARTIAL'
    : 'SAFE_EXACT';
  return { individualStats, aptitude, overallStatus, checks };
};
// 第6C段階の実移行。第6B診断が個体全体をSAFE_EXACTとした場合だけ、診断済みの
// 差分表現をコピーへ追加する。旧フィールドは残し、保存対象にする直前にも個体差、
// 基礎値差ぶんの能力変化、距離適性、既存ポイント、現行式による総合力を再確認する。
const migrateSafeMasuBaselineRepresentations = (masuMons, diagnose = diagnoseLegacyMasuBaselineMigration) => {
  const summary = { migrated:0, alreadyModern:0, partial:0, ambiguous:0, blocked:0, validationFailed:0 };
  if (!Array.isArray(masuMons)) return { nextMasuMons:masuMons, summary, changed:false };
  const statKeys = ['hp','atk','def','guts'];
  const statField = key => `base${key === 'hp' ? 'Hp' : key[0].toUpperCase() + key.slice(1)}`;
  const representation = masu => {
    const mon = mergeMasuIntoMon(masu);
    if (!mon) return null;
    return {
      stats: Object.fromEntries(statKeys.map(key => [key, mon[statField(key)]])),
      aptitude: Array.isArray(mon.distAptitude) ? mon.distAptitude.slice(0, 4) : [],
      power: monsterPowerOf(mon),
      powerPartsTotal: monsterPowerParts(mon).total,
      statPoints: JSON.stringify(masu.statPoints),
      distAptPoints: masu.distAptPoints,
    };
  };
  let changed = false;
  const nextMasuMons = masuMons.map(masu => {
    const diagnosis = diagnose(masu);
    if (diagnosis.overallStatus !== 'SAFE_EXACT') {
      const key = diagnosis.overallStatus === 'ALREADY_MODERN' ? 'alreadyModern'
        : diagnosis.overallStatus === 'PARTIAL' ? 'partial'
          : diagnosis.overallStatus === 'AMBIGUOUS' ? 'ambiguous' : 'blocked';
      summary[key] += 1;
      return masu;
    }
    const candidate = { ...masu };
    if (diagnosis.individualStats.status === 'SAFE_EXACT') {
      candidate.individualStatOffsets = { ...diagnosis.individualStats.proposedOffsets };
    }
    if (diagnosis.aptitude.status === 'SAFE_EXACT') {
      candidate.distAptBoosts = [...diagnosis.aptitude.proposedBoosts];
    }
    const before = representation(masu);
    const after = representation(candidate);
    const base = ALL_PLAYER_MONSTERS[masu?.baseId];
    const confirmedBaseline = diagnosis.individualStats.confirmedBaseline;
    const offsets = diagnosis.individualStats.proposedOffsets;
    const statPoints = masu.statPoints || {};
    const statsValid = diagnosis.individualStats.status !== 'SAFE_EXACT' || (!!base && !!confirmedBaseline
      && statKeys.every(key => after?.stats[key] === Number(base[statField(key)]) + Number(offsets[key]) + Number(statPoints[key])
        && after.stats[key] - before?.stats[key] === Number(base[statField(key)]) - Number(confirmedBaseline[key])));
    const existingFieldsPreserved = Object.keys(masu).every(key => JSON.stringify(candidate[key]) === JSON.stringify(masu[key]));
    const candidateDiagnosis = diagnoseLegacyMasuBaselineMigration(candidate);
    const matches = !!before && !!after
      && statsValid
      && JSON.stringify(before.aptitude) === JSON.stringify(after.aptitude)
      && after.power === Math.round(after.powerPartsTotal)
      && before.statPoints === after.statPoints
      && before.distAptPoints === after.distAptPoints
      && existingFieldsPreserved
      && candidateDiagnosis.overallStatus === 'ALREADY_MODERN';
    if (!matches) {
      summary.blocked += 1;
      summary.validationFailed += 1;
      return masu;
    }
    if (JSON.stringify(candidate) === JSON.stringify(masu)) {
      summary.alreadyModern += 1;
      return masu;
    }
    summary.migrated += 1;
    changed = true;
    return candidate;
  });
  return { nextMasuMons, summary, changed };
};
// 第4段階の既存個体ドライラン。候補を新しいオブジェクトとして組み立てるだけで、保存・補完は行わない。
// 旧形式は生成時点のベース定義を持たないため、現在ベースとの差が計算できても SAFE にはしない。
const diagnoseMasuBaselineMigration = (masu) => {
  const reasons = [];
  const proposed = {};
  const checks = { statsPreserved:false, aptitudePreserved:false, powerPreserved:false, pointsPreserved:false };
  const base = ALL_PLAYER_MONSTERS[masu?.baseId];
  const statKeys = ['hp','atk','def','guts'];
  const validFiniteObject = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
    && keys.every(key => Number.isFinite(Number(value[key])));
  const validAptitudes = value => Array.isArray(value) && value.length === 4
    && value.every(grade => DIST_APTITUDE_GRADES.includes(grade));
  const validBoosts = value => Array.isArray(value) && value.length === 4
    && value.every(boost => Number.isInteger(Number(boost)) && Number(boost) >= 0);
  if (!masu || typeof masu !== 'object' || !base || !validAptitudes(base.distAptitude)) {
    reasons.push('個体または最新ベース定義を正しく解決できない');
    return { status:'BLOCKED', reasons, proposed, checks };
  }

  const hasOffsets = Object.prototype.hasOwnProperty.call(masu, 'individualStatOffsets');
  const hasBoosts = Object.prototype.hasOwnProperty.call(masu, 'distAptBoosts');
  const hasIndividualStats = Object.prototype.hasOwnProperty.call(masu, 'individualStats');
  if (!validAptitudes(masu.distApt)) reasons.push('distAptが正しい4距離の等級配列ではない');
  if (hasBoosts && !validBoosts(masu.distAptBoosts)) reasons.push('distAptBoostsが0以上の整数4要素ではない');
  if (hasOffsets && !validFiniteObject(masu.individualStatOffsets, statKeys)) reasons.push('individualStatOffsetsの4能力が有限数ではない');
  if (hasIndividualStats && !validFiniteObject(masu.individualStats, statKeys)) reasons.push('individualStatsの4能力が有限数ではない');
  if (reasons.length) return { status:'BLOCKED', reasons, proposed, checks };

  if (!hasBoosts) {
    const boosts = masu.distApt.map((grade, index) => DIST_APTITUDE_GRADES.indexOf(grade) - DIST_APTITUDE_GRADES.indexOf(base.distAptitude[index]));
    if (boosts.some(boost => boost < 0)) {
      reasons.push('保存済みdistAptが最新ベースより低く、投入段階として復元できない');
      return { status:'BLOCKED', reasons, proposed, checks };
    }
    proposed.distAptBoosts = boosts;
    reasons.push('生成時点のベース適性が無いため、最新ベースとの差を投入ポイントと断定できない');
  }
  if (hasIndividualStats && !hasOffsets) {
    proposed.individualStatOffsets = {
      hp:Number(masu.individualStats.hp) - base.baseHp,
      atk:Number(masu.individualStats.atk) - base.baseAtk,
      def:Number(masu.individualStats.def) - base.baseDef,
      guts:Number(masu.individualStats.guts) - base.baseGuts,
    };
    reasons.push('再生時点のベース能力が無いため、最新ベースとの差を個体差と断定できない');
  }

  const candidate = { ...masu, ...proposed };
  const before = mergeMasuIntoMon(masu);
  const after = mergeMasuIntoMon(candidate);
  checks.statsPreserved = !!before && !!after && statKeys.every(key => before[`base${key === 'hp' ? 'Hp' : key[0].toUpperCase() + key.slice(1)}`] === after[`base${key === 'hp' ? 'Hp' : key[0].toUpperCase() + key.slice(1)}`]);
  checks.aptitudePreserved = !!before && !!after && JSON.stringify(before.distAptitude) === JSON.stringify(after.distAptitude);
  checks.powerPreserved = !!before && !!after && monsterPowerOf(before) === monsterPowerOf(after);
  const validStoredPoints = Number.isFinite(Number(masu.distAptPoints ?? 0)) && Number(masu.distAptPoints ?? 0) >= 0
    && statKeys.every(key => Number.isFinite(Number(masu.statPoints?.[key] ?? 0)) && Number(masu.statPoints?.[key] ?? 0) >= 0
      && Number(masu.statPoints?.[key] ?? 0) % STAT_POINT_GAIN[key] === 0)
    && ['bondXp','rebirthCount','reincarnateCount','reincarnateBonusPoints','inheritedReincarnateBonusPoints']
      .every(key => Number.isFinite(Number(masu[key] ?? 0)) && Number(masu[key] ?? 0) >= 0);
  checks.pointsPreserved = hasBoosts && validStoredPoints;

  if (!checks.statsPreserved || !checks.aptitudePreserved || !checks.powerPreserved) {
    reasons.push('候補適用後に能力・適性・総合力のいずれかを維持できない');
    return { status:'BLOCKED', reasons, proposed, checks };
  }
  if (!validStoredPoints) {
    reasons.push('保存済みの未使用ポイント・能力強化・絆・転生成果に不正な値がある');
    return { status:'BLOCKED', reasons, proposed, checks };
  }
  if (!hasBoosts || (hasIndividualStats && !hasOffsets)) {
    return { status:'ESTIMATED', reasons, proposed, checks };
  }
  if (!masuBaselineRepresentationsMatch(masu)) {
    reasons.push('新旧フィールドの能力・適性・総合力が一致しない');
    return { status:'BLOCKED', reasons, proposed, checks };
  }
  checks.pointsPreserved = true;
  reasons.push('第3段階以降の新形式で、新旧表現とポイント量が一致する');
  return { status:'SAFE', reasons, proposed, checks };
};
const diagnoseMasuBaselineMigrationList = (masuMons) => {
  const results = (Array.isArray(masuMons) ? masuMons : []).map(diagnoseMasuBaselineMigration);
  const counts = { SAFE:0, ESTIMATED:0, BLOCKED:0 };
  results.forEach(result => { counts[result.status] += 1; });
  return { counts, results };
};
// 一覧・詳細で出す桁区切りの表記
const formatMonsterPower = (power) => Number(power || 0).toLocaleString();

// 寄付一覧も表示と同じ masuPowerOf を使って並べる。コピーをソートするため、元の保存配列や
// IDで持っている選択状態には触れず、並べ替え後も同じ個体を選択・寄付できる。
const sortDonationMasuMons = (masuList, sortKey, sortDir, activeIds = []) => {
  const dir = sortDir === 'asc' ? 1 : -1;
  const activeSet = new Set(activeIds);
  const value = (masu) => sortKey === 'bondXp' ? donationDiamondValue(masu.bondXp)
    : sortKey === 'bond' ? masuBondLevelInfo(masu).level
    : sortKey === 'power' ? masuPowerOf(masu)
    : sortKey === 'name' ? (masu.name || '')
    : sortKey === 'lineage' ? ((ALL_PLAYER_MONSTERS[masu.baseId] || {}).name || '')
    : sortKey === 'active' ? (activeSet.has(`masu:${masu.id}`) ? 1 : 0)
    : (Number(masu.createdAt) || Number(masu.id) || 0);
  return [...masuList].sort((a, b) => {
    const av = value(a), bv = value(b);
    const compared = typeof av === 'string' ? av.localeCompare(bv, 'ja') : av - bv;
    return compared * dir;
  });
};

// 強化画面の数値直接入力を、0〜その項目へ振れる最大ポイントへ正規化する。
// inputMode=numeric でも貼り付けでは記号等が入り得るため、整数だけを受け付ける。
const directEnhancePointAmount = (rawValue, maxValue) => {
  const text = String(rawValue ?? '').trim();
  const max = Math.max(0, Math.floor(Number(maxValue) || 0));
  if (!/^\d+$/.test(text)) return 0;
  const parsed = Number(text);
  const wanted = Number.isFinite(parsed) ? Math.floor(parsed) : Number.MAX_SAFE_INTEGER;
  return Math.min(Math.max(0, wanted), max);
};

// 強化の下書き(plan)を当てはめた「強化後のマスモン」を、保存データに触れずに作る。
// 一括強化のプレビュー・1ポイント強化のプレビュー・実際の確定処理が、すべてこの1か所を通るので、
// 画面に出した「強化後の総合力」と、確定したあとの総合力が必ず一致する。
// 戻り値の masu は計算用のコピーで、これを保存しない限り実データは変わらない。
const applyEnhancePlanToMasu = (masu, plan) => {
  if (!masu) return null;
  const available = masu.distAptPoints || 0;
  const aptPlan = (plan && plan.apt) || [0, 0, 0, 0];
  const statPlan = (plan && plan.stat) || {};
  const wanted = aptPlan.reduce((a, b) => a + (b || 0), 0) + Object.values(statPlan).reduce((a, b) => a + (b || 0), 0);
  if (wanted <= 0 || wanted > available) return null;
  const base = ALL_PLAYER_MONSTERS[masu.baseId];
  const distApt = [...resolveMasuDistAptitude(masu, base || {})];
  const distAptBoosts = Array.isArray(masu.distAptBoosts) ? masu.distAptBoosts.slice(0, 4).map(v => Math.max(0, Math.floor(Number(v) || 0))) : null;
  let used = 0;
  aptPlan.forEach((n, idx) => {
    for (let i = 0; i < (n || 0); i++) {
      const cur = DIST_APTITUDE_GRADES.indexOf(distApt[idx] || 'C');
      if (cur < 0 || cur >= DIST_APTITUDE_GRADES.length - 1) break; // 上限Mに達したらそこで止める
      distApt[idx] = DIST_APTITUDE_GRADES[cur + 1];
      if (distAptBoosts) distAptBoosts[idx] = (distAptBoosts[idx] || 0) + 1;
      used++;
    }
  });
  const statPoints = { ...(masu.statPoints || {}) };
  Object.entries(statPlan).forEach(([key, n]) => {
    if (!STAT_POINT_KEYS[key]) return;
    for (let i = 0; i < (n || 0); i++) {
      statPoints[key] = (statPoints[key] || 0) + (STAT_POINT_GAIN[key] || 1);
      used++;
    }
  });
  if (used <= 0) return null;
  return { masu: { ...masu, distApt, ...(distAptBoosts ? { distAptBoosts } : {}), statPoints, distAptPoints: available - used }, used };
};
// ==================== 超越 ====================
// Lv400・虹★5(35凸)まで育てた個体だけが神殿で行える、限界の先の育成。
// 資格・コスト・次の状態はここだけで決め、画面はその結果を出すだけにする
// (押した瞬間の値と保存する値がずれないようにするため)。
const canTranscendMasu = (masu) => {
  if (!masu) return { ok:false, reason:'対象のマスモンが見つかりません。' };
  const normalized = normalizeMasuProgression(masu);
  if (normalized.transcended) return { ok:false, reason:'この個体はすでに超越しています。' };
  if (!isFinalBreakthroughCount(normalized.rebirthCount)) {
    return { ok:false, reason:`限界突破${FINAL_BREAKTHROUGH_COUNT}回（虹★${BREAKTHROUGH_STARS_PER_TIER}）まで進めると超越できます。` };
  }
  if (masuBondLevelInfo(masu).level < MAX_MASU_LEVEL_CAP) {
    return { ok:false, reason:`Lv.${MAX_MASU_LEVEL_CAP}に到達すると超越できます。` };
  }
  return { ok:true };
};
const buildMasuTranscendence = ({ masu, gold = 0, psycheOwned = 0 } = {}) => {
  const psycheCost = TRANSCEND_PSYCHE_COST;
  const diamondCost = TRANSCEND_DIAMOND_COST;
  const psycheHave = Math.max(0, Math.floor(Number(psycheOwned) || 0));
  const goldHave = Math.max(0, Math.floor(Number(gold) || 0));
  const info = { psycheCost, diamondCost, psycheHave, goldHave };
  const eligible = canTranscendMasu(masu);
  if (!eligible.ok) return { ...info, ok:false, reason:eligible.reason };
  if (psycheHave < psycheCost) return { ...info, ok:false, reason:`虹のプシュケーが足りません（あと ${(psycheCost - psycheHave).toLocaleString()}）。` };
  if (goldHave < diamondCost) return { ...info, ok:false, reason:`ダイヤが足りません（あと ${(diamondCost - goldHave).toLocaleString()}）。` };
  const normalized = normalizeMasuProgression(masu);
  return {
    ...info,
    ok: true,
    nextPsyche: psycheHave - psycheCost,
    nextGold: goldHave - diamondCost,
    fromLevelCap: normalized.levelCap,
    toLevelCap: TRANSCEND_LEVEL_CAP,
    // レベルは Lv.400 のまま。変わるのは上限だけ(Lv401へ勝手に上げない)
    nextMasu: { ...normalized, transcended: true, levelCap: TRANSCEND_LEVEL_CAP },
  };
};

// ==================== 魂格進化 ====================
// 魂格0(超越済みLv500)からⅠ〜Ⅴへ、現在段階の次の1段階だけ進める。
// 条件・コスト・次状態を1か所へ集約し、神殿UI・合体継承(後続STEP)でも同じ正本を使えるようにする。
const soulRankEvolutionStatus = (masu) => {
  if (!masu) return { ok:false, reason:'対象のマスモンが見つかりません。', next:null };
  const normalized = normalizeMasuProgression(masu);
  const next = soulRankEvolutionForStage(normalized.soulRankStage + 1);
  const level = masuBondLevelInfo(normalized).level;
  if (!normalized.transcended) return { ok:false, reason:'先に神殿で超越する必要があります。', normalized, level, next };
  if (!next) return { ok:false, reason:'魂格Ⅴまで進化済みです。', normalized, level, next:null };
  return {
    ok:true,
    normalized,
    level,
    next,
    levelReady:level >= next.requiredLevel,
    currentStage:normalized.soulRankStage,
    currentLabel:normalized.soulRankStage > 0 ? `魂格${['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'][normalized.soulRankStage]}` : '魂格なし',
  };
};
const buildMasuSoulRankEvolution = ({ masu, gold = 0, ownedItems = {} } = {}) => {
  const status = soulRankEvolutionStatus(masu);
  const goldHave = donationDiamondValue(gold);
  const heroProofHave = ownedItemCount(ownedItems, HERO_PROOF_ITEM_ID);
  const next = status.next;
  const info = {
    ...status,
    goldHave,
    heroProofHave,
    diamondCost:next?.diamondCost || 0,
    heroProofCost:next?.heroProofCost || 0,
  };
  if (!status.ok) return { ...info, ok:false };
  if (!status.levelReady) return { ...info, ok:false, reason:`Lv.${next.requiredLevel}に到達すると${next.label}へ進化できます。` };
  if (goldHave < next.diamondCost) return { ...info, ok:false, reason:`ダイヤが足りません（あと ${(next.diamondCost-goldHave).toLocaleString()}）。` };
  if (heroProofHave < next.heroProofCost) return { ...info, ok:false, reason:`勇者の証が足りません（あと ${(next.heroProofCost-heroProofHave).toLocaleString()}）。` };
  const nextOwnedItems = {
    ...(ownedItems && typeof ownedItems === 'object' && !Array.isArray(ownedItems) ? ownedItems : {}),
    [HERO_PROOF_ITEM_ID]:heroProofHave - next.heroProofCost,
  };
  return {
    ...info,
    ok:true,
    nextGold:goldHave - next.diamondCost,
    nextOwnedItems,
    fromStage:status.normalized.soulRankStage,
    toStage:next.stage,
    fromLevelCap:status.normalized.levelCap,
    toLevelCap:next.levelCap,
    // 魂格進化で実Lv・絆XP・最高初到達Lv・振り分けは変えない。解放段階と上限だけ更新する。
    nextMasu:{
      ...status.normalized,
      soulRankStage:next.stage,
      levelCap:next.levelCap,
    },
  };
};
// 虹のプシュケーを超越ポイントへ替える。100個ちょうどで1P、端数のプシュケーは消費しない
const transcendPsycheExchange = (psycheOwned, wantedPoints) => {
  const have = Math.max(0, Math.floor(Number(psycheOwned) || 0));
  const maxPoints = Math.floor(have / TRANSCEND_PSYCHE_PER_POINT);
  const points = Math.max(0, Math.min(maxPoints, Math.floor(Number(wantedPoints) || 0)));
  const psycheCost = points * TRANSCEND_PSYCHE_PER_POINT;
  return { ok: points > 0, points, psycheCost, maxPoints, nextPsyche: have - psycheCost };
};
// 交換を個体へ反映する。超越Pは個体ごとの育成値なので、必ず選んでいるその個体へ足す。
// 神殿で正式に超越しているかは問わない(超越強化はどのマスモンでも使える)。
const applyTranscendExchange = (masu, psycheOwned, wantedPoints) => {
  const normalized = normalizeMasuProgression(masu);
  const plan = transcendPsycheExchange(psycheOwned, wantedPoints);
  if (!plan.ok) return null;
  return { ...plan, nextMasu: { ...normalized, transcendPoints: normalized.transcendPoints + plan.points } };
};
// 超越ポイントの配分。通常の強化(applyEnhancePlanToMasu)と同じ下書きの形を使うが、
// 上げるのは「基礎値」側(transcendStatPoints / transcendAptBoosts)で、通常強化とは混ざらない。
// 1Pあたりの効果は通常の強化ポイントと同じ価値基準(ライフ+10 / ほか+3 / 適性1段階)。
const applyTranscendPlanToMasu = (masu, plan) => {
  const normalized = normalizeMasuProgression(masu);
  const base = (typeof ALL_PLAYER_MONSTERS !== 'undefined') ? ALL_PLAYER_MONSTERS[normalized.baseId] : null;
  if (!base) return null;
  const available = normalized.transcendPoints;
  const aptPlan = (plan && plan.apt) || [0, 0, 0, 0];
  const statPlan = (plan && plan.stat) || {};
  const wanted = aptPlan.reduce((a, b) => a + (b || 0), 0) + Object.values(statPlan).reduce((a, b) => a + (b || 0), 0);
  if (wanted <= 0 || wanted > available) return null;
  const baseApt = Array.isArray(base.distAptitude) ? base.distAptitude.slice(0, 4) : ['C','C','C','C'];
  const transcendAptBoosts = [...normalized.transcendAptBoosts];
  let used = 0;
  aptPlan.forEach((n, idx) => {
    for (let i = 0; i < (n || 0); i++) {
      const current = Math.max(0, DIST_APTITUDE_GRADES.indexOf(baseApt[idx] || 'C')) + transcendAptBoosts[idx];
      if (current >= DIST_APTITUDE_GRADES.length - 1) break; // 基礎の段階もMで止める
      transcendAptBoosts[idx] += 1;
      used++;
    }
  });
  const transcendStatPoints = { ...normalized.transcendStatPoints };
  Object.entries(statPlan).forEach(([key, n]) => {
    if (!STAT_POINT_KEYS[key]) return;
    for (let i = 0; i < (n || 0); i++) {
      transcendStatPoints[key] += (STAT_POINT_GAIN[key] || 1);
      used++;
    }
  });
  if (used <= 0) return null;
  return { masu: { ...normalized, transcendAptBoosts, transcendStatPoints, transcendPoints: available - used }, used };
};
// 超越で上げた基礎の合計段階数(表示・検査用)
const transcendAptBoostTotal = (masu) => normalizeTranscendAptBoosts(masu?.transcendAptBoosts)
  .reduce((sum, value) => sum + value, 0);
// 超越強化へ使った超越ポイントの合計。ステータスは1Pあたりの上昇量で割って本数へ戻す
const transcendSpentPoints = (masu) => {
  const stat = normalizeTranscendStatPoints(masu?.transcendStatPoints);
  const statSpent = TRANSCEND_STAT_KEYS.reduce((sum, key) => sum + Math.ceil((stat[key] || 0) / (STAT_POINT_GAIN[key] || 1)), 0);
  return statSpent + transcendAptBoostTotal(masu);
};
// 【超越ポイントリセットの書】使った超越Pをすべて未使用へ戻す。
// 戻すのは超越Pだけで、絆Lv・絆XP・Lv上限・超越済みかどうか・限界突破・転生回数・
// 通常の強化ポイント・固有技・染色・虹のプシュケーには一切触れない。
// 1Pも使っていなければ null を返し、呼び出し側でアイテムを消費させない。
const buildMasuTranscendReset = (masu) => {
  const normalized = normalizeMasuProgression(masu);
  const refunded = transcendSpentPoints(normalized);
  if (refunded <= 0) return null;
  return {
    refundedPoints: refunded,
    nextMasu: {
      ...normalized,
      transcendStatPoints: normalizeTranscendStatPoints(null),
      transcendAptBoosts: normalizeTranscendAptBoosts(null),
      transcendPoints: normalized.transcendPoints + refunded,
    },
  };
};
// リセット直前の「ポイントで上げた分」だけを、同じ個体の保存値へ小さなスナップショットとして残す。
// 絆XP・絆Lv・固有技などは含めず、旧形式の個体でも現行の下書き(plan)へ直せる形にそろえる。
const buildBondResetAllocationSnapshot = (masu, base) => {
  if (!masu || !base) return null;
  // 通常強化ぶんだけを数える。超越で上げた基礎はリセットの対象外なので、基準側へ含める
  const baseApt = masuTranscendBaseAptitude(masu, base);
  const resolvedApt = resolveMasuDistAptitude(masu, base);
  const apt = Array.isArray(masu.distAptBoosts)
    ? [0,1,2,3].map(i => Math.max(0, Math.floor(Number(masu.distAptBoosts[i]) || 0)))
    : [0,1,2,3].map(i => Math.max(0, DIST_APTITUDE_GRADES.indexOf(resolvedApt[i]) - DIST_APTITUDE_GRADES.indexOf(baseApt[i])));
  const stat = Object.fromEntries(Object.keys(STAT_POINT_KEYS).map(key => [key,
    Math.max(0, Math.ceil((Number(masu.statPoints?.[key]) || 0) / (STAT_POINT_GAIN[key] || 1)))
  ]));
  const total = apt.reduce((sum, value) => sum + value, 0) + Object.values(stat).reduce((sum, value) => sum + value, 0);
  return total > 0 ? { version:1, apt, stat } : null;
};
// 保存済みスナップショットを現在の上限と残りptへ安全に収めた下書きへ変換する。
// 完全に戻せない場合も不正なplanを作らず、omittedをUIで知らせる。
const buildBondResetRestorePlan = (masu, snapshot) => {
  if (!masu || !snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.apt) || !snapshot.stat || typeof snapshot.stat !== 'object') return null;
  let remaining = Math.max(0, Math.floor(Number(masu.distAptPoints) || 0));
  const base = ALL_PLAYER_MONSTERS[masu.baseId] || {};
  const currentApt = resolveMasuDistAptitude(masu, base);
  const plan = { apt:[0,0,0,0], stat:{hp:0,atk:0,def:0,guts:0} };
  let requested = 0;
  [0,1,2,3].forEach(idx => {
    const wanted = Math.max(0, Math.floor(Number(snapshot.apt[idx]) || 0));
    requested += wanted;
    const currentIndex = Math.max(0, DIST_APTITUDE_GRADES.indexOf(currentApt[idx] || 'C'));
    const capacity = Math.max(0, DIST_APTITUDE_GRADES.length - 1 - currentIndex);
    plan.apt[idx] = Math.min(wanted, capacity, remaining);
    remaining -= plan.apt[idx];
  });
  Object.keys(STAT_POINT_KEYS).forEach(key => {
    const wanted = Math.max(0, Math.floor(Number(snapshot.stat[key]) || 0));
    requested += wanted;
    plan.stat[key] = Math.min(wanted, remaining);
    remaining -= plan.stat[key];
  });
  const restored = plan.apt.reduce((sum, value) => sum + value, 0) + Object.values(plan.stat).reduce((sum, value) => sum + value, 0);
  return { plan, requested, restored, omitted:Math.max(0, requested - restored) };
};
// 絆ポイントリセットの保存値計算。新形式は投入段階数を直接返却し、新旧の適性表現を同時に戻す。
// 旧形式は従来どおり完成適性と最新ベースとの差から返却数を求める。
const buildMasuBondPointReset = (masu, base) => {
  if (!masu || !base) return null;
  const baseApt = base.distAptitude || ['C','C','C','C'];
  const aptSpent = Array.isArray(masu.distAptBoosts)
    ? masu.distAptBoosts.reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0)
    : (masu.distApt || baseApt).reduce((sum, g, i) => sum + Math.max(0, DIST_APTITUDE_GRADES.indexOf(g) - DIST_APTITUDE_GRADES.indexOf(baseApt[i])), 0);
  const statSpent = Object.entries(masu.statPoints || {}).reduce((sum, [key, val]) => sum + Math.ceil((val || 0) / (STAT_POINT_GAIN[key] || 1)), 0);
  const totalRefund = aptSpent + statSpent;
  if (totalRefund <= 0) return null;
  const allocationSnapshot = buildBondResetAllocationSnapshot(masu, base);
  return {
    refundedPoints: totalRefund,
    nextMasu: {
      ...masu,
      distApt: [...baseApt],
      ...(Array.isArray(masu.distAptBoosts) ? { distAptBoosts:[0,0,0,0] } : {}),
      statPoints: { hp:0, atk:0, def:0, guts:0 },
      distAptPoints: (masu.distAptPoints || 0) + totalRefund,
      bondResetAllocationSnapshot: allocationSnapshot,
    },
  };
};
// 下書きを当てはめたあとの総合力。当てはめられない(ポイント不足など)ときは現在の総合力を返す
const plannedMasuPowerOf = (masu, plan) => {
  const applied = applyEnhancePlanToMasu(masu, plan);
  return masuPowerOf(applied ? applied.masu : masu);
};
const migrateMasuLevelCaps = (masuMons, gold) => {
  const capXp = totalBondXpForLevel(INITIAL_MASU_LEVEL_CAP);
  let compensation = 0;
  const nextMasuMons = (Array.isArray(masuMons) ? masuMons : []).map(raw => {
    const masu = normalizeMasuProgression(raw);
    if (masu.rebirthCount === 0 && donationDiamondValue(masu.bondXp) > capXp) {
      compensation += donationDiamondValue(masu.bondXp) - capXp;
      return { ...masu, bondXp: capXp };
    }
    return { ...masu, bondXp: cappedBondXp(masu) };
  });
  return { nextMasuMons, compensation, nextGold: donationDiamondValue(gold) + compensation };
};
// 合体・転生の消費ダイヤ単価(絆レベル1あたり)。以前はどちらも100だったが、
// 周回で貯まるダイヤに対して重すぎたため半額にした。表示と実処理で同じ値を使う。
const FUSION_INHERIT_COST = 3000;
const FUSION_INHERIT_MIN_SUB_LEVEL = 30;
const REGENERATION_COST = 100;
const REGENERATION_DISC_IMAGE = 'images/disc-icons/stone-base.png';
const REBIRTH_COST_PER_LEVEL = 50;
const masuFusionCost = (_mainLevel, _subLevel, inherit = false) => inherit ? FUSION_INHERIT_COST : 0;
// 合体確認と確定処理で共有するダイヤ収支。画面には必ず差し引き前の所持数を見せる。
const buildFusionDiamondSummary = ({ masu, fusionXp = 0, gold = 0, psycheOwned = 0, mainLevel = 0, subLevel = 0, inherit = false, inheritCount = inherit ? 1 : 0 }) => {
  const goldBefore = donationDiamondValue(gold);
  const inheritCost = Math.max(0, Math.floor(Number(inheritCount) || 0)) * masuFusionCost(mainLevel, subLevel, true);
  const breakthroughPlan = buildFusionBreakthroughPlan({
    masu, fusionXp, gold:goldBefore - inheritCost, psycheOwned,
  });
  const breakthroughDiamondCost = breakthroughPlan.diamondCost;
  const totalDiamondCost = inheritCost + breakthroughDiamondCost;
  return {
    goldBefore, inheritCost, breakthroughDiamondCost, totalDiamondCost,
    diamondAfter:goldBefore - totalDiamondCost,
    diamondShortage:Math.max(0, totalDiamondCost - goldBefore),
    normalDiamondCost:inheritCost,
    normalDiamondAfter:goldBefore - inheritCost,
    normalDiamondShortage:Math.max(0, inheritCost - goldBefore),
    breakthroughPlan,
  };
};
// 選択順に継承可否を確定する。確認画面と保存直前の再検証で同じ判定を使い、
// 主が所持済み・同じ一括合体内で先に追加済みの同系統には費用を付けない。
const buildFusionInheritancePlan = ({ main, subs, selectedSubIds }) => {
  const selected = new Set(Array.isArray(selectedSubIds) ? selectedSubIds : []);
  const mainBase = main ? ALL_PLAYER_MONSTERS[main.baseId] : null;
  const ownedLineageIds = new Set([
    uniqueLineageId(mainBase?.unique, mainBase?.id),
    ...(Array.isArray(main?.inheritedUniques) ? main.inheritedUniques : []).map(unique=>uniqueLineageId(unique)),
  ].filter(Boolean));
  const entries = (Array.isArray(subs) ? subs : []).map(sub => {
    const subBase = sub ? ALL_PLAYER_MONSTERS[sub.baseId] : null;
    const lineageId = uniqueLineageId(subBase?.unique, subBase?.id);
    const eligible = !!sub && masuBondLevelInfo(sub).level >= FUSION_INHERIT_MIN_SUB_LEVEL && !!subBase?.unique;
    const requested = !!sub && selected.has(sub.id);
    const duplicate = !!lineageId && ownedLineageIds.has(lineageId);
    const inherited = requested && eligible && !!lineageId && !duplicate;
    if (inherited) ownedLineageIds.add(lineageId);
    return { sub, subBase, lineageId, eligible, requested, duplicate, inherited };
  });
  const inheritedEntries = entries.filter(entry=>entry.inherited);
  return { entries, inheritedEntries, inheritCount:inheritedEntries.length, inheritCost:inheritedEntries.length * FUSION_INHERIT_COST };
};
// 転生の消費ダイヤ。画面の表示と実処理で必ずこの関数を使う。
// (以前は画面だけが「レベル×100」で計算しており、実際に引かれる額の倍が表示され、
//  そのぶんダイヤを持っていないと転生ボタンを押せない状態になっていた)
const masuRebirthCost = (level) => Math.max(0, Math.floor(Number(level) || 0)) * REBIRTH_COST_PER_LEVEL;
// 限界突破: 上限に届いた個体の上限だけを上げる。レベル・振った強化はそのまま残し、
// 強化ポイントを初回5・以降1だけ足す(以前の「転生」はここでLv1へ戻していた)。
const buildMasuBreakthrough = ({ masu, skillKey, gold, psycheOwned = 0 }) => {
  if (!masu) return { ok:false, reason:'対象のマスモンが見つかりません。' };
  const normalized = normalizeMasuProgression(masu);
  const level = masuBondLevelInfo(normalized).level;
  // 何回目の限界突破かで、必要な虹のプシュケーの数が決まる
  const psycheCost = breakthroughItemCost(normalized.rebirthCount + 1);
  const psycheHave = Math.max(0, Math.floor(Number(psycheOwned) || 0));
  if (normalized.levelCap >= MAX_MASU_LEVEL_CAP) return { ok:false, reason:`レベル上限は Lv.${MAX_MASU_LEVEL_CAP} までです。`, psycheCost, psycheHave };
  if (level !== normalized.levelCap) return { ok:false, reason:`Lv.${normalized.levelCap}到達後に限界突破できます。`, psycheCost, psycheHave };
  const cost = masuRebirthCost(level);
  if (donationDiamondValue(gold) < cost) return { ok:false, reason:'ダイヤが不足しています。', psycheCost, psycheHave };
  if (psycheHave < psycheCost) return { ok:false, reason:`虹のプシュケーが不足しています（必要 ${psycheCost} / 所持 ${psycheHave}）。`, psycheCost, psycheHave };
  // 固有技をその場で上げるかどうかは自由。選ばなかったとき(と、選んだ技がもう最大のとき)は
  // 「未使用の固有技ポイント」として残し、あとでマスモンの詳細から使える。
  // 以前はここで突破そのものを止めていたため、全部の固有技が最大まで育っていると
  // 限界突破できなくなっていた
  const currentSkillLevel = Math.max(0, Math.floor(Number(normalized.uniqueSkillLevels[skillKey]) || 0));
  const raisesSkill = !!skillKey && currentSkillLevel < MAX_UNIQUE_SKILL_LEVEL;
  const uniqueSkillLevels = raisesSkill
    ? { ...normalized.uniqueSkillLevels, [skillKey]:currentSkillLevel + 1 }
    : { ...normalized.uniqueSkillLevels };
  const keptSkillPoints = Math.max(0, Math.floor(Number(normalized.uniqueSkillPoints) || 0)) + (raisesSkill ? 0 : 1);
  const nextCount = normalized.rebirthCount + 1;
  const gainedPoints = nextCount === 1 ? BREAKTHROUGH_FIRST_POINTS : BREAKTHROUGH_POINTS;
  const isFinal = nextCount === FINAL_BREAKTHROUGH_COUNT;
  const nextLevelCap = breakthroughLevelCap(nextCount);
  return {
    ok:true, cost, skillKey:raisesSkill ? skillKey : null, skillLevel:raisesSkill ? currentSkillLevel + 1 : null,
    raisesSkill, keptSkillPoints, gainedPoints, finalBreakthrough:isFinal,
    psycheCost, psycheHave, nextPsyche:psycheHave - psycheCost,
    nextGold:donationDiamondValue(gold) - cost,
    nextMasu:{
      ...normalized,
      rebirthCount: nextCount,
      levelCap: nextLevelCap,
      distAptPoints: Math.max(0, Math.floor(Number(normalized.distAptPoints) || 0)) + gainedPoints,
      uniqueSkillLevels,
      uniqueSkillPoints: keptSkillPoints,
    },
  };
};
// AUTO∞の自動限界突破候補を、呼び出し時点の最新残高から順番に確定する。
// 費用・素材数・次の上限はbuildMasuBreakthroughだけに計算させ、ここではAUTO専用上限だけを追加判定する。
const buildAutoRepeatBreakthroughs = ({
  masuIds, masuMons, gold, ownedItems, breederXp,
  reserveGold = 0, reservePsyche = 0,
}) => {
  let nextMasuMons = Array.isArray(masuMons) ? masuMons : [];
  let nextGold = donationDiamondValue(gold);
  let nextOwnedItems = { ...(ownedItems || {}) };
  const succeededMasuIds = [];
  const seen = new Set();
  const breederLevel = levelInfo(breederXp).level;
  const breederLevelLimit = breederLevel / 2;
  const followLevelLimit = autoRepeatBreakthroughMaxLevel(breederLevel);
  const protectedGold = donationDiamondValue(reserveGold);
  const protectedPsyche = Math.max(0, Math.floor(Number(reservePsyche) || 0));
  for (const rawId of Array.isArray(masuIds) ? masuIds : []) {
    const id = String(rawId);
    if (seen.has(id)) continue;
    seen.add(id);
    const masu = nextMasuMons.find(entry => String(entry.id) === id);
    if (!masu) continue;
    const normalized = normalizeMasuProgression(masu);
    const settingLevel = normalized.autoRepeatBreakthroughMode === 'follow'
      ? followLevelLimit
      : normalized.autoRepeatBreakthroughLevel;
    if (settingLevel <= 0 || normalized.autoRepeatBreakthroughMode === 'off') continue;
    const result = buildMasuBreakthrough({
      masu, skillKey:'', gold:nextGold,
      psycheOwned:ownedItemCount(nextOwnedItems, BREAKTHROUGH_ITEM_ID),
    });
    if (!result.ok || result.nextMasu.levelCap > settingLevel || result.nextMasu.levelCap > breederLevelLimit) continue;
    // 「いま残高があるか」ではなく、この1回を実行した後も保護残高以上残る場合だけ成立させる。
    if (result.nextGold < protectedGold || result.nextPsyche < protectedPsyche) continue;
    nextMasuMons = nextMasuMons.map(entry => String(entry.id) === id ? result.nextMasu : entry);
    nextGold = result.nextGold;
    nextOwnedItems = { ...nextOwnedItems, [BREAKTHROUGH_ITEM_ID]:result.nextPsyche };
    succeededMasuIds.push(masu.id);
  }
  return { nextMasuMons, nextGold, nextOwnedItems, succeededMasuIds };
};
// 転生: 絆Lv100以上の個体を、レベル99ぶん引き換えに白紙から育て直す。
// 振った強化はすべて戻り、強化ポイントは「新しいレベルぶん + これまでの限界突破ぶん + 10」で
// 配り直す(限界突破で得たポイントも振り直しの対象に含める、というユーザー指定に合わせる)。
const buildMasuReincarnation = ({ masu, skillKey, gold }) => {
  if (!masu) return { ok:false, reason:'対象のマスモンが見つかりません。' };
  const normalized = normalizeMasuProgression(masu);
  const level = masuBondLevelInfo(normalized).level;
  if (level < REINCARNATE_MIN_LEVEL) return { ok:false, reason:`Lv.${REINCARNATE_MIN_LEVEL}到達後に転生できます。` };
  const cost = masuRebirthCost(level);
  if (donationDiamondValue(gold) < cost) return { ok:false, reason:'ダイヤが不足しています。' };
  // 限界突破と同じで、固有技を上げるかどうかは自由。選ばなかったぶんはポイントとして残す
  const currentSkillLevel = Math.max(0, Math.floor(Number(normalized.uniqueSkillLevels[skillKey]) || 0));
  const raisesSkill = !!skillKey && currentSkillLevel < MAX_UNIQUE_SKILL_LEVEL;
  const uniqueSkillLevels = raisesSkill
    ? { ...normalized.uniqueSkillLevels, [skillKey]:currentSkillLevel + 1 }
    : { ...normalized.uniqueSkillLevels };
  const keptSkillPoints = Math.max(0, Math.floor(Number(normalized.uniqueSkillPoints) || 0)) + (raisesSkill ? 0 : 1);
  const nextLevel = Math.max(1, level - REINCARNATE_LEVEL_DROP);
  const nextCount = normalized.reincarnateCount + 1;
  // 振り直せる合計。レベル由来ぶんは reconcileMasuPoints と同じ levelBasedEnhancePoints で数える
  // (ここを別の式にすると、限界突破の倍率で稼いだぶんが転生のたびに消えてしまう)
  const nextOwnBonusPoints = normalized.reincarnateBonusPoints + REINCARNATE_POINTS;
  const nextPoints = levelBasedEnhancePoints(nextLevel)
    + totalBreakthroughPoints(normalized.rebirthCount) + nextOwnBonusPoints + normalized.inheritedReincarnateBonusPoints;
  return {
    ok:true, cost, skillKey:raisesSkill ? skillKey : null, skillLevel:raisesSkill ? currentSkillLevel + 1 : null,
    raisesSkill, keptSkillPoints,
    fromLevel:level, nextLevel, gainedPoints:REINCARNATE_POINTS, nextPoints,
    nextGold:donationDiamondValue(gold) - cost,
    nextMasu:resetMasuForRebirth(normalized, {
      reincarnateCount: nextCount,
      reincarnateBonusPoints: nextOwnBonusPoints,
      levelCap: normalized.levelCap, // 上限は据え置き(転生を重ねても上限は伸びない)
      toLevel: nextLevel,
      distAptPoints: nextPoints,
      uniqueSkillLevels,
      uniqueSkillPoints: keptSkillPoints,
    }),
  };
};

// 神殿の寄付で受け取るダイヤ。保存データが古い・破損している場合も負数やNaNを返さない。
const donationDiamondValue = (bondXp) => {
  const value = Number(bondXp);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
};
const donationPsycheValue = (masu) => Math.floor(masuBondLevelInfo(masu).level / 5);
const randomRegenerationStat = (baseValue, random = Math.random) => Math.round(baseValue * (0.9 + Math.max(0, Math.min(1, Number(random()) || 0)) * 0.2));
const buildRegeneratedMasu = (base, random = Math.random, now = Date.now()) => {
  if (!base) return null;
  // 乱数は完成値の4回だけ引き、offsetは確定した同じ値から算出する（再抽選しない）。
  const individualStats = { hp:randomRegenerationStat(base.baseHp,random), atk:randomRegenerationStat(base.baseAtk,random), def:randomRegenerationStat(base.baseDef,random), guts:randomRegenerationStat(base.baseGuts,random) };
  const masu = {
    id:`masu_regenerated_${now}_${Math.random().toString(36).slice(2,8)}`, baseId:base.id, name:base.name,
    bondXp:0, distAptPoints:0, distApt:[...(base.distAptitude || ['C','C','C','C'])],
    distAptBoosts:[0,0,0,0],
    statPoints:{hp:0,atk:0,def:0,guts:0},
    individualStats,
    individualStatOffsets:{ hp:individualStats.hp-base.baseHp, atk:individualStats.atk-base.baseAtk, def:individualStats.def-base.baseDef, guts:individualStats.guts-base.baseGuts },
    createdAt:now,
  };
  return masuBaselineRepresentationsMatch(masu) ? masu : null;
};
const rosterBaseId = (entryId, masuMons) => {
  if (typeof entryId !== 'string') return null;
  if (!entryId.startsWith('masu:')) return entryId;
  return masuMons.find(m => String(m.id) === entryId.slice(5))?.baseId || null;
};
const MONSTER_PARTY_SET_COUNT = 5;
const MONSTER_PARTY_SETS_KEY = 'mh_monster_roster_sets_v1';
const MONSTER_PARTY_SETS_MIGRATED_KEY = 'mh_monster_roster_sets_migrated_v1';
const defaultMonsterPartySetName = index => `セット${index + 1}`;
const normalizeMonsterPartySets = (saved, legacyRoster=[]) => {
  const source = saved && typeof saved === 'object' ? saved : null;
  const sourceRosters = Array.isArray(source?.rosters) ? source.rosters : null;
  const sourceNames = Array.isArray(source?.names) ? source.names : [];
  const activeValue = Number(source?.activeIndex);
  const activeIndex = Number.isInteger(activeValue) && activeValue >= 0 && activeValue < MONSTER_PARTY_SET_COUNT ? activeValue : 0;
  return {
    version: 1,
    activeIndex,
    names: Array.from({length:MONSTER_PARTY_SET_COUNT}, (_, index) => {
      const name = typeof sourceNames[index] === 'string' ? sourceNames[index].trim().slice(0, 20) : '';
      return name || defaultMonsterPartySetName(index);
    }),
    rosters: Array.from({length:MONSTER_PARTY_SET_COUNT}, (_, index) => {
      const roster = sourceRosters ? sourceRosters[index] : (index === 0 ? legacyRoster : []);
      return Array.isArray(roster) ? [...roster] : [];
    }),
  };
};
const repairRosterAfterDonation = (roster, donated, remainingMasuMons, unlockedMonsterIds, validBaseIds, requiredCount) => {
  const donatedEntry = `masu:${donated.id}`;
  if (!roster.includes(donatedEntry)) return { ok: true, roster: [...roster] };
  const next = roster.filter(id => id !== donatedEntry);
  const usedBases = new Set(next.map(id => rosterBaseId(id, remainingMasuMons)).filter(Boolean));
  const candidates = [donated.baseId, ...unlockedMonsterIds];
  for (const baseId of candidates) {
    if (next.length >= requiredCount) break;
    if (!validBaseIds.includes(baseId) || usedBases.has(baseId)) continue;
    next.splice(Math.min(roster.indexOf(donatedEntry), next.length), 0, baseId);
    usedBases.add(baseId);
  }
  const valid = next.length === requiredCount && next.every(id => {
    const baseId = rosterBaseId(id, remainingMasuMons);
    return baseId && validBaseIds.includes(baseId);
  }) && new Set(next.map(id => rosterBaseId(id, remainingMasuMons))).size === next.length;
  return valid ? { ok: true, roster: next } : { ok: false, reason: '有効なモンスターを8体編成できないため、寄付を中止しました。' };
};
// HOME放牧設定の保存値を所持個体だけへ正規化する。nullは機能導入前のセーブを表し、
// 従来の1体表示を維持するため先頭の表示可能個体1体で初期化する。
const normalizeHomePastureIds = (savedIds, masuMons, validBaseIds) => {
  const validBases = validBaseIds instanceof Set ? validBaseIds : new Set(validBaseIds || []);
  const ownedIds = (Array.isArray(masuMons) ? masuMons : []).filter(m=>validBases.has(m.baseId)).map(m=>String(m.id));
  if (!Array.isArray(savedIds)) return ownedIds.slice(0,1);
  const owned = new Set(ownedIds);
  return [...new Set(savedIds.map(String))].filter(id=>owned.has(id)).slice(0,5);
};

const buildMasuDonation = ({ masuMons, targetId, gold, monsterRosterIds, draftMonsterRoster, unlockedMonsterIds, validBaseIds, requiredCount }) => {
  const donated = masuMons.find(m => String(m.id) === String(targetId));
  if (!donated) return { ok: false, reason: '対象のマスモンはすでに所持していません。' };
  const nextMasuMons = masuMons.filter(m => String(m.id) !== String(targetId));
  const active = repairRosterAfterDonation(monsterRosterIds, donated, nextMasuMons, unlockedMonsterIds, validBaseIds, requiredCount);
  if (!active.ok) return active;
  const draft = repairRosterAfterDonation(draftMonsterRoster, donated, nextMasuMons, unlockedMonsterIds, validBaseIds, requiredCount);
  if (!draft.ok) return draft;
  const diamonds = donationDiamondValue(donated.bondXp);
  const psyche = donationPsycheValue(donated);
  return { ok: true, donated, diamonds, psyche, nextGold: donationDiamondValue(gold) + diamonds, nextMasuMons, nextRoster: active.roster, nextDraftRoster: draft.roster };
};
// 複数寄付も1体寄付の正本を順番に適用し、途中で1体でも寄付できなければ何も確定しない。
// 報酬計算・編成補正を別実装にせず、最後にまとめて保存できる完成形だけを返す。
const buildMasuDonations = ({ targetIds, ...state }) => {
  const ids = [...new Set((Array.isArray(targetIds) ? targetIds : []).map(String))];
  if (!ids.length) return { ok:false, reason:'寄付するマスモンを選んでください。' };
  let current = { ...state };
  const donated=[];
  let diamonds=0, psyche=0;
  for (const targetId of ids) {
    const result=buildMasuDonation({ ...current, targetId });
    if (!result.ok) return result;
    donated.push(result.donated); diamonds+=result.diamonds; psyche+=result.psyche;
    current={ ...current, masuMons:result.nextMasuMons, gold:result.nextGold, monsterRosterIds:result.nextRoster, draftMonsterRoster:result.nextDraftRoster };
  }
  return { ok:true, donated, diamonds, psyche, nextGold:current.gold, nextMasuMons:current.masuMons, nextRoster:current.monsterRosterIds, nextDraftRoster:current.draftMonsterRoster };
};
