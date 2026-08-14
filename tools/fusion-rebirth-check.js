// 合体・転生まわりの検証。
//   ① 合体で絆レベルが上がったぶんの強化ポイントが実際に増えるか
//      (確認画面には「強化ポイント +N」と出るのに、実処理では増えていなかった)
//   ② 合体・転生の消費ダイヤ単価が半額(絆レベル1あたり50ダイヤ)になっているか
// 判定は本番の定義をNode上で動かして確かめ、画面側の結線はソースで確認する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);

// --- 本番の定義をそのまま動かす ---
const ctx = {
  // reconcileMasuPointsが参照する種データ。適性は全部Cにして「振っていない」状態にする
  ALL_PLAYER_MONSTERS: { Golem: { distAptitude: ['C', 'C', 'C', 'C'] } },
  DIST_APTITUDE_GRADES: ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'S+', 'SS', 'SS+', 'M'],
  STAT_POINT_GAIN: { hp: 10, atk: 3, def: 3, guts: 3 },
};
vm.createContext(ctx);
const grab = (a, b) => source.slice(source.indexOf(a), source.indexOf(b));
vm.runInContext([
  grab('const XP_CURVE_EXPONENT', 'const bondLevelInfo ='),
  grab('const bondLevelInfo =', 'const rosterBaseId ='),
  grab('const reconcileMasuPoints', 'const RANGE_STYLES'),
  'globalThis.__m={bondLevelInfo,totalBondXpForLevel,masuBondLevelInfo,reconcileMasuPoints,buildMasuBreakthrough,masuFusionCost,FUSION_INHERIT_COST,FUSION_INHERIT_MIN_SUB_LEVEL,REBIRTH_COST_PER_LEVEL,normalizeMasuProgression};',
].join('\n'), ctx);
const m = ctx.__m;

// --- ② 費用 ---
// 合体は「技を引き継がなければ無料・引き継ぐときだけ定額」に変わった(絆レベル単価では計算しない)
check('技を引き継がない合体は無料', m.masuFusionCost(10, 8) === 0, `${m.masuFusionCost(10, 8)}ダイヤ`);
check('技を引き継ぐ合体は定額', m.masuFusionCost(10, 8, true) === m.FUSION_INHERIT_COST && m.FUSION_INHERIT_COST === 3000,
  `${m.masuFusionCost(10, 8, true)}ダイヤ`);
check('技継承には副モンの絆レベル条件がある', m.FUSION_INHERIT_MIN_SUB_LEVEL === 30);
check('限界突破の単価は絆レベル1あたり50ダイヤ', m.REBIRTH_COST_PER_LEVEL === 50);

const atCap = { id: 1, baseId: 'Golem', bondXp: m.totalBondXpForLevel(30), levelCap: 30, rebirthCount: 0, distAptPoints: 0, statPoints: {}, uniqueSkillLevels: { own: 0 } };
const rebirth = m.buildMasuBreakthrough({ masu: atCap, skillKey: 'own', gold: 999999, psycheOwned: 999999 });
check('転生費用は上限Lv×50', rebirth.ok && rebirth.cost === 1500, `${rebirth.cost}ダイヤ`);
check('ダイヤ不足なら転生できない', m.buildMasuBreakthrough({ masu: atCap, skillKey: 'own', gold: 1499, psycheOwned: 999999 }).ok === false);
check('転生後は強化ポイント5で始まる', rebirth.ok && rebirth.nextMasu.distAptPoints === 5);

// --- ① 合体で上がったレベルぶんの強化ポイント ---
const lv10 = { id: 2, baseId: 'Golem', bondXp: m.totalBondXpForLevel(10), levelCap: 30, rebirthCount: 0, distAptPoints: 0, distAptBoosts:[0,0,0,0], statPoints: {}, uniqueSkillLevels: { own: 0 } };
check('絆Lv10なら未使用ポイントは9まで補填される', m.reconcileMasuPoints(lv10).distAptPoints === 9, `${m.reconcileMasuPoints(lv10).distAptPoints}pt`);

// 合体でレベルが上がった記録(fusionBondLevels)があっても、その分を差し引かない
const fused = { ...lv10, fusionBondLevels: 4 };
check('合体で上げたレベルも強化ポイントの対象', m.reconcileMasuPoints(fused).distAptPoints === 9, `${m.reconcileMasuPoints(fused).distAptPoints}pt`);
check('過去に合体したマスモンも不足分を受け取れる',
  m.reconcileMasuPoints({ ...lv10, fusionBondLevels: 4, distAptPoints: 5 }).distAptPoints === 9);
check('すでに足りているなら増やさない',
  m.reconcileMasuPoints({ ...lv10, distAptPoints: 9 }).distAptPoints === 9
    && m.reconcileMasuPoints({ ...lv10, distAptPoints: 20 }).distAptPoints === 20);
// 振り済みのポイントは二重に配らない
check('振り済みのぶんは重複して配らない',
  m.reconcileMasuPoints({ ...lv10, distAptBoosts:[1,0,0,0], distApt: ['B', 'C', 'C', 'C'], statPoints: { hp: 10 }, distAptPoints: 0 }).distAptPoints === 7);

// --- 画面・実処理の結線 ---
// 上がったレベルぶんの強化ポイントは applyBondXpGain がまとめて配る。合体もそこを通す
check('合体の実処理で強化ポイントを配る', has('distAptPoints: (masu.distAptPoints || 0) + gainedPoints') && has('applyBondXpGain(prepared, gainedXp)'));
check('確認画面と実処理が同じ費用計算を使う', (source.match(/buildFusionDiamondSummary\(\{/g) || []).length === 2
  && has('const buildFusionDiamondSummary ='));
check('合体結果へ通常・限界突破それぞれの実消費額を渡す',
  has('cost: withBreakthrough ? diamondSummary.totalDiamondCost : diamondSummary.normalDiamondCost,')
    && !/inherited:\s*!!inheritedUnique,\s*cost,/.test(source));
check('古い×100の計算が残っていない', !has('(mainLvl.level + subLvl.level) * 100') && !has('const cost = level * 100;'));
check('確認画面はレベル上昇と転生継承を合わせた強化ポイント増分を表示', has('{mainPointsNow} → {mainPointsNow + gainedLevelPoints + reincarnateTransfer.points}'));

// --- レベル上限(levelCap)をどこでも通しているか ---
// 転生していないマスモンの上限は30、1回転生で35。上限を超えた絆経験値をそのまま
// レベルとして扱うと、合体の確認画面が「絆Lv.41になる(実際は上限35で止まる)」と
// 出したり、上がらないレベルぶんの強化ポイントを見せたりしてしまう
const capCtx = {};
vm.createContext(capCtx);
vm.runInContext([
  grab('const donationDiamondValue =', 'const rosterBaseId ='),
  grab('const XP_CURVE_EXPONENT', 'const masuFusionCost'),
  'globalThis.__c={bondLevelInfo,cappedBondXp,masuBondLevelInfo,normalizeMasuProgression,totalBondXpForLevel,INITIAL_MASU_LEVEL_CAP,BREAKTHROUGH_LEVEL_CAP_GAIN};',
].join('\n'), capCtx);
const C = capCtx.__c;
const capOf = (rebirthCount) => C.INITIAL_MASU_LEVEL_CAP + rebirthCount * C.BREAKTHROUGH_LEVEL_CAP_GAIN;
check('転生していないマスモンの上限は初期値', capOf(0) === C.INITIAL_MASU_LEVEL_CAP, `Lv.${capOf(0)}`);
check('1回限界突破すると上限が上がる', capOf(1) === C.INITIAL_MASU_LEVEL_CAP + C.BREAKTHROUGH_LEVEL_CAP_GAIN, `Lv.${capOf(1)}`);
// 実際に起きていたケース(転生1回・上限35の主に、副の1324XPを足す)
{
  const main = { id:1, bondXp:2529, rebirthCount:1, levelCap:capOf(1) };
  const sub = { id:2, bondXp:1324, rebirthCount:0, levelCap:capOf(0) };
  const after = C.cappedBondXp(main, C.cappedBondXp(sub));
  const afterLevel = C.bondLevelInfo(after).level;
  check('合体後のレベルが上限を超えない', afterLevel <= main.levelCap, `絆Lv.${afterLevel} / 上限Lv.${main.levelCap}`);
  check('上限を無視した計算とは違う値になる', C.bondLevelInfo(2529 + 1324).level > afterLevel,
    `上限なし Lv.${C.bondLevelInfo(2529 + 1324).level} → 上限あり Lv.${afterLevel}`);
  check('上限までの強化ポイントしか増えない',
    afterLevel - C.masuBondLevelInfo(main).level === 1, `+${afterLevel - C.masuBondLevelInfo(main).level}`);
}
check('上限を超えて絆経験値を持っていてもレベルは上限で止まる', (() => {
  const masu = { id:1, bondXp:999999, rebirthCount:0, levelCap:capOf(0) };
  return C.masuBondLevelInfo(masu).level === capOf(0);
})());
// 画面・実処理のどこでも、マスモンのレベルは上限つきの関数から取る
{
  const lines = source.split('\n');
  const bad = [];
  lines.forEach((line, i) => {
    // 修行(TRAINING_*)は別担当のため対象外
    if (line.includes("gameState==='TRAINING_")) return;
    if (/bondLevelInfo\((masu|m|mon|sub|main)\.bondXp/.test(line) && !/masuBondLevelInfo/.test(line)) bad.push(i + 1);
  });
  check('マスモンのレベルは上限つきの関数から取る', bad.length === 0, bad.join(', '));
}
check('合体の費用も上限つきのレベルで計算する',
  has('const mainLvl = masuBondLevelInfo(main);') && has('const subLvl = masuBondLevelInfo(sub);')
    && (source.match(/const mainLvl = masuBondLevelInfo\(main\);/g) || []).length === 2);
check('確認画面と実処理が同じ「合体後」を出す',
  has('const afterXp = cappedBondXp(fusionMain, gainedXp);') && has('const afterXp = cappedBondXp(main, subXp);'));
check('上限で入らない絆経験値を事前に知らせる',
  has('const wastedXp = Math.max(0, (beforeXp + subXp) - afterXp);')
    && has('超過する {wastedXp.toLocaleString()} XP は失われます'));
check('確認画面に上限を出す', has('上限 Lv.{mainCap}</div>'));

// --- 転生の消費ダイヤ ---
// 画面だけが「レベル×100」で計算していて、実際に引かれる額の倍が表示され、
// そのぶんダイヤを持っていないと転生ボタンを押せない状態になっていた
const rebirthCtx = {};
vm.createContext(rebirthCtx);
vm.runInContext([
  grab('const FUSION_INHERIT_COST =', 'const buildMasuBreakthrough ='),
  'globalThis.__r={FUSION_INHERIT_COST,REBIRTH_COST_PER_LEVEL,masuFusionCost,masuRebirthCost};',
].join('\n'), rebirthCtx);
const R = rebirthCtx.__r;
check('転生の費用は「絆レベル × 単価」', R.masuRebirthCost(30) === 30 * R.REBIRTH_COST_PER_LEVEL, `Lv30 → ${R.masuRebirthCost(30)}ダイヤ`);
check('転生の費用は「レベル×100の半額」', R.masuRebirthCost(30) === 30 * 100 / 2, `${R.masuRebirthCost(30)} / ${30 * 100 / 2}`);
check('転生の費用は壊れた値でも0以上', R.masuRebirthCost(null) === 0 && R.masuRebirthCost(-5) === 0 && R.masuRebirthCost(undefined) === 0);
// 限界突破と転生はどちらも同じ費用計算を使う。画面側だけ別の式で出すと、
// 表示と実際に引かれる額が食い違う(以前それで「押せないのに足りているように見える」不具合が出た)
check('限界突破・転生とも確認画面と実処理で同じ費用計算を使う',
  has('const masuRebirthCost = (level) =>')
    && (source.match(/masuRebirthCost\(/g) || []).length === 5
    && (source.match(/const cost = masuRebirthCost\(level\);/g) || []).length === 2
    && (source.match(/cost=masuRebirthCost\(lvl\.level\)/g) || []).length === 2,
  `masuRebirthCost の使用箇所 ${(source.match(/masuRebirthCost\(/g) || []).length}`);
check('転生の画面に古い×100の計算が残っていない', !has('cost=lvl.level*100'));
// 必要ダイヤは、押す前に気づける場所へ出す
check('転生の必要ダイヤを独立した枠で出す',
  has('<span className="text-slate-400">必要ダイヤ</span>') && has('<span className="text-slate-500">所持ダイヤ</span>')
    && has('ダイヤが足りません（あと '));
check('費用の内訳は定義した値をそのまま出す',
  has('（絆Lv.{lvl.level}）× {REBIRTH_COST_PER_LEVEL}')
    && has('${FUSION_INHERIT_COST} ダイヤ'));
// 説明に書いた倍率と、実際に使う単価がずれていないか(合体の説明が「×100」のままだった)
const fusionConfirmSource = source.slice(source.indexOf("if (fusionStep==='confirm')"), source.indexOf("if (fusionStep==='anim')"));
check('合体の説明に書いた倍率が実際の単価と合っている', !/[×x]\s*100(?!\d)/.test(fusionConfirmSource));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
