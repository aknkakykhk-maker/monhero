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
  'globalThis.__m={bondLevelInfo,totalBondXpForLevel,masuBondLevelInfo,reconcileMasuPoints,buildMasuRebirth,masuFusionCost,FUSION_COST_PER_LEVEL,REBIRTH_COST_PER_LEVEL,normalizeMasuProgression};',
].join('\n'), ctx);
const m = ctx.__m;

// --- ② 単価 ---
check('合体の単価は絆レベル1あたり50ダイヤ', m.FUSION_COST_PER_LEVEL === 50);
check('転生の単価は絆レベル1あたり50ダイヤ', m.REBIRTH_COST_PER_LEVEL === 50);
check('合体費用は(主Lv+副Lv)×50', m.masuFusionCost(10, 8) === 900, `${m.masuFusionCost(10, 8)}ダイヤ`);
check('以前の半額になっている', m.masuFusionCost(10, 8) * 2 === (10 + 8) * 100);

const atCap = { id: 1, baseId: 'Golem', bondXp: m.totalBondXpForLevel(30), levelCap: 30, rebirthCount: 0, distAptPoints: 0, statPoints: {}, uniqueSkillLevels: { own: 0 } };
const rebirth = m.buildMasuRebirth({ masu: atCap, skillKey: 'own', gold: 999999 });
check('転生費用は上限Lv×50', rebirth.ok && rebirth.cost === 1500, `${rebirth.cost}ダイヤ`);
check('ダイヤ不足なら転生できない', m.buildMasuRebirth({ masu: atCap, skillKey: 'own', gold: 1499 }).ok === false);
check('転生後は強化ポイント5で始まる', rebirth.ok && rebirth.nextMasu.distAptPoints === 5);

// --- ① 合体で上がったレベルぶんの強化ポイント ---
const lv10 = { id: 2, baseId: 'Golem', bondXp: m.totalBondXpForLevel(10), levelCap: 30, rebirthCount: 0, distAptPoints: 0, statPoints: {}, uniqueSkillLevels: { own: 0 } };
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
  m.reconcileMasuPoints({ ...lv10, distApt: ['B', 'C', 'C', 'C'], statPoints: { hp: 10 }, distAptPoints: 0 }).distAptPoints === 7);

// --- 画面・実処理の結線 ---
check('合体の実処理で強化ポイントを配る', has('distAptPoints: (m.distAptPoints || 0) + gainedLevels,'));
check('確認画面と実処理が同じ費用計算を使う', (source.match(/masuFusionCost\(mainLvl\.level, subLvl\.level\)/g) || []).length === 2);
check('古い×100の計算が残っていない', !has('(mainLvl.level + subLvl.level) * 100') && !has('const cost = level * 100;'));
check('確認画面は強化ポイントの増分を出したまま', has('{mainPointsNow} → {mainPointsNow + gainedLevels}'));

// --- 転生の消費ダイヤ ---
// 画面だけが「レベル×100」で計算していて、実際に引かれる額の倍が表示され、
// そのぶんダイヤを持っていないと転生ボタンを押せない状態になっていた
const rebirthCtx = {};
vm.createContext(rebirthCtx);
vm.runInContext([
  source.slice(source.indexOf('const FUSION_COST_PER_LEVEL ='), source.indexOf('const buildMasuRebirth =')),
  'globalThis.__r={FUSION_COST_PER_LEVEL,REBIRTH_COST_PER_LEVEL,masuFusionCost,masuRebirthCost};',
].join('\n'), rebirthCtx);
const R = rebirthCtx.__r;
check('転生の費用は「絆レベル × 単価」', R.masuRebirthCost(30) === 30 * R.REBIRTH_COST_PER_LEVEL, `Lv30 → ${R.masuRebirthCost(30)}ダイヤ`);
check('転生の費用は「レベル×100の半額」', R.masuRebirthCost(30) === 30 * 100 / 2, `${R.masuRebirthCost(30)} / ${30 * 100 / 2}`);
check('転生の費用は壊れた値でも0以上', R.masuRebirthCost(null) === 0 && R.masuRebirthCost(-5) === 0 && R.masuRebirthCost(undefined) === 0);
check('転生も確認画面と実処理で同じ費用計算を使う',
  has('const masuRebirthCost = (level) =>')
    && (source.match(/masuRebirthCost\(/g) || []).length === 2
    && has('const cost = masuRebirthCost(level);')
    && has('cost=masuRebirthCost(lvl.level)'));
check('転生の画面に古い×100の計算が残っていない', !has('cost=lvl.level*100'));
// 必要ダイヤは、押す前に気づける場所へ出す
check('転生の必要ダイヤを独立した枠で出す',
  has('<span className="text-slate-400">必要ダイヤ</span>') && has('<span className="text-slate-500">所持ダイヤ</span>')
    && has('ダイヤが足りません（あと '));
check('費用の内訳は単価をそのまま出す',
  has('（絆Lv.{lvl.level}）× {REBIRTH_COST_PER_LEVEL}')
    && has('× {FUSION_COST_PER_LEVEL}'));
// 説明に書いた倍率と、実際に使う単価がずれていないか(合体の説明が「×100」のままだった)
check('合体の説明に書いた倍率が実際の単価と合っている', !/[×x]\s*100(?!\d)/.test(
  source.slice(source.indexOf('必要ダイヤ</span>'), source.indexOf('ダイヤが足りません(所持'))));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
