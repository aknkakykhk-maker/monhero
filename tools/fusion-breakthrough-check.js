// 合体と同時に行う複数回限界突破の事前計算を、本番関数で検証する。
const { loadDyeModule } = require('./harness');
const {
  buildFusionBreakthroughPlan, totalBondXpForLevel, breakthroughItemCost,
  masuRebirthCost, INITIAL_MASU_LEVEL_CAP,
} = loadDyeModule();

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const masuAt = (level, cap = INITIAL_MASU_LEVEL_CAP, rebirthCount = 0) => ({
  id:'main', baseId:'Golem', name:'主', bondXp:totalBondXpForLevel(level), levelCap:cap,
  rebirthCount, distAptPoints:0, uniqueSkillPoints:0, uniqueSkillLevels:{},
});
const xpTo = (from, to) => totalBondXpForLevel(to) - totalBondXpForLevel(from);

const within = buildFusionBreakthroughPlan({ masu:masuAt(20), fusionXp:xpTo(20, 25), gold:999999, psycheOwned:999 });
check('上限内の通常合体では限界突破不要', within.count === 0 && within.plannedLevel === 25);

const one = buildFusionBreakthroughPlan({ masu:masuAt(30), fusionXp:xpTo(30, 34), gold:999999, psycheOwned:999 });
check('1回で足りるXPは限界突破1回', one.count === 1 && one.levelCap === 35);
check('1回分は既存の素材式と一致', one.psycheCost === breakthroughItemCost(1) && one.diamondCost === masuRebirthCost(30));

const multiple = buildFusionBreakthroughPlan({ masu:masuAt(30), fusionXp:xpTo(30, 43), gold:999999, psycheOwned:999 });
check('複数回必要なXPをまとめて算出', multiple.count === 3 && multiple.levelCap === 45 && multiple.plannedLevel === 43);
check('複数回の素材は既存式の合計', multiple.psycheCost === breakthroughItemCost(1)+breakthroughItemCost(2)+breakthroughItemCost(3));
check('複数回のダイヤは各上限Lvの既存費用合計', multiple.diamondCost === masuRebirthCost(30)+masuRebirthCost(35)+masuRebirthCost(40));
check('限界突破回数ぶん固有技ポイントを保留', multiple.nextMasu.uniqueSkillPoints === 3);

const psycheShort = buildFusionBreakthroughPlan({ masu:masuAt(30), fusionXp:xpTo(30, 43), gold:999999, psycheOwned:10 });
check('プシュケー不足量を返して実行不可', !psycheShort.canAfford && psycheShort.psycheShortage === multiple.psycheCost-10 && psycheShort.diamondShortage === 0);
const diamondShort = buildFusionBreakthroughPlan({ masu:masuAt(30), fusionXp:xpTo(30, 43), gold:1000, psycheOwned:999 });
check('ダイヤ不足量を返して実行不可', !diamondShort.canAfford && diamondShort.diamondShortage === multiple.diamondCost-1000 && diamondShort.psycheShortage === 0);
const bothShort = buildFusionBreakthroughPlan({ masu:masuAt(30), fusionXp:xpTo(30, 43), gold:0, psycheOwned:0 });
check('両方不足を同時に返す', !bothShort.canAfford && bothShort.diamondShortage > 0 && bothShort.psycheShortage > 0);

const legacy = buildFusionBreakthroughPlan({ masu:{ id:'old', baseId:'Golem', bondXp:0 }, fusionXp:0, gold:0 });
check('旧セーブの欠落項目は既定値へ正規化', legacy.count === 0 && legacy.levelCap === INITIAL_MASU_LEVEL_CAP && legacy.rebirthCount === 0);

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
