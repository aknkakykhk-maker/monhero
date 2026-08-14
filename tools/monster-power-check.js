// 総合力(モンスターの育成結果を1つの数値にした派生指標)の計算式を、実装から取り出して検算する。
//
// 【なぜ道具にするか】
// 総合力は保存せず、そのときの個体データから毎回計算する派生値なので、式が1か所ずれても
// 例外は出ない。「なんとなく数字が違う」としか分からず、しかも詳細・一覧・強化プレビュー・
// 将来のランキングが同じ数字を出しているかは目視では確かめられない。
// 加点する対象と加点しない対象の切り分け(未使用の強化ポイントは0点、など)も同じ理由で、
// ここで1つずつ機械的に確かめる。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- 実装から総合力まわりだけを切り出して動かす ---
const source = read('monster-hero/src/game-system.jsx');
const from = source.indexOf('const uniqueSkillAtLevel');
const to = source.indexOf('const inheritedUniqueRunLevel', from); // uniqueSkillAtLevel と継承技resolverまで
const powerFrom = source.indexOf('const masuBondLevelInfo = (masu) => bondLevelInfo(cappedBondXp(masu));');
const powerTo = source.indexOf('const migrateMasuLevelCaps');
check('総合力の実装を取り出せる', from >= 0 && to > from && powerFrom > 0 && powerTo > powerFrom);
if (!(from >= 0 && to > from && powerFrom > 0 && powerTo > powerFrom)) { console.log('\n1件のNGがあります'); process.exit(1); }

const ctx = { Math, Number, Array, Object, String, console };
vm.createContext(ctx);
vm.runInContext([
  read('monster-hero/data/images/images-ally.js'),
  read('monster-hero/data/skills.js'),
  read('monster-hero/data/ally-monsters.js'),
  // 総合力が使う道具(固有技のレベル解決)と、総合力そのもの
  source.slice(from, to),
  'const cappedBondXp = () => 0; const bondLevelInfo = () => ({ level: 1 });',
  (source.match(/const MAX_UNIQUE_SKILL_LEVEL = \d+;/) || [''])[0],
  "const DIST_APTITUDE_GRADES = ['G','F','E','D','C','B','A','S','S+','SS','SS+','M'];",
  "const STAT_POINT_GAIN = { hp: 10, atk: 3, def: 3, guts: 3 };",
  "const STAT_POINT_KEYS = { hp: 'ライフ', atk: 'ちから', def: '丈夫さ', guts: 'ガッツ' };",
  source.slice(powerFrom, powerTo),
  'globalThis.api = { monsterPowerOf, masuPowerOf, monsterPowerParts, mergeMasuIntoMon, applyEnhancePlanToMasu, plannedMasuPowerOf, ALL_PLAYER_MONSTERS, MONSTER_POWER_APTITUDE };',
].join('\n'), ctx);
const { monsterPowerOf, masuPowerOf, monsterPowerParts, mergeMasuIntoMon, applyEnhancePlanToMasu, plannedMasuPowerOf, ALL_PLAYER_MONSTERS: MONS, MONSTER_POWER_APTITUDE } = ctx.api;

// 検算に使う土台のマスモン。ベースモンはゴーレム(4距離が A/E/G/G でばらついている)
const BASE_ID = 'Golem';
const baseMon = MONS[BASE_ID];
const makeMasu = (patch = {}) => ({
  id: 'test', baseId: BASE_ID, name: 'テスト', bondXp: 0,
  distAptPoints: 0, distApt: [...baseMon.distAptitude],
  statPoints: { hp: 0, atk: 0, def: 0, guts: 0 },
  uniqueSkillLevels: {}, inheritedUniques: [],
  rebirthCount: 0, reincarnateCount: 0, levelCap: 30, fusionHistory: [],
  ...patch,
});
const base = makeMasu();
const basePower = masuPowerOf(base);
console.log(`基準にするマスモン: ${baseMon.name} 素の状態 → 総合力 ${basePower}`);

// --- ① 能力1あたりの点 ---
const withStat = (key, n) => masuPowerOf(makeMasu({ statPoints: { hp: 0, atk: 0, def: 0, guts: 0, [key]: n } }));
check('ライフ1 = +1', withStat('hp', 1) - basePower === 1, `${withStat('hp', 1) - basePower}`);
check('ライフ10(強化P1つぶん) = +10', withStat('hp', 10) - basePower === 10, `${withStat('hp', 10) - basePower}`);
check('ちから3(強化P1つぶん) = +10', withStat('atk', 3) - basePower === 10, `${withStat('atk', 3) - basePower}`);
check('丈夫さ3(強化P1つぶん) = +10', withStat('def', 3) - basePower === 10, `${withStat('def', 3) - basePower}`);
check('ガッツ3(強化P1つぶん) = +10', withStat('guts', 3) - basePower === 10, `${withStat('guts', 3) - basePower}`);

// --- ② 間合い適性 ---
const gradesUp = (idx, steps) => {
  const apt = [...baseMon.distAptitude];
  const order = ['G','F','E','D','C','B','A','S','S+','SS','SS+','M'];
  apt[idx] = order[Math.min(order.length - 1, order.indexOf(apt[idx]) + steps)];
  return masuPowerOf(makeMasu({ distApt: apt }));
};
check('間合い適性1段階 = +10', gradesUp(0, 1) - basePower === 10, `${gradesUp(0, 1) - basePower}`);
check('間合い適性3段階 = +30', gradesUp(1, 3) - basePower === 30, `${gradesUp(1, 3) - basePower}`);
check('段階ごとの点が仕様どおり',
  MONSTER_POWER_APTITUDE.M === 70 && MONSTER_POWER_APTITUDE['SS+'] === 60 && MONSTER_POWER_APTITUDE.SS === 50
  && MONSTER_POWER_APTITUDE['S+'] === 40 && MONSTER_POWER_APTITUDE.S === 30 && MONSTER_POWER_APTITUDE.A === 20
  && MONSTER_POWER_APTITUDE.B === 10 && MONSTER_POWER_APTITUDE.C === 0 && MONSTER_POWER_APTITUDE.D === -10
  && MONSTER_POWER_APTITUDE.E === -20 && MONSTER_POWER_APTITUDE.F === -30 && MONSTER_POWER_APTITUDE.G === -40);
// 4距離すべてを合計しているか(配置した距離だけではない)
const aptOnly = (grades) => monsterPowerParts({ baseHp: 0, baseAtk: 0, baseDef: 0, baseGuts: 0, distAptitude: grades, unique: null, inheritedUniques: [] }).aptitude;
check('4距離すべてを加算する', aptOnly(['A','C','E','G']) === -40, `A/C/E/G = ${aptOnly(['A','C','E','G'])} (期待 -40)`);
check('1距離だけを見ていない', aptOnly(['A','A','A','A']) === 80 && aptOnly(['C','C','C','A']) === 20);

// --- ③ 固有技 ---
const own = baseMon.unique;
check('固有技1個(Lv0)で +100', monsterPowerParts({ baseHp:0,baseAtk:0,baseDef:0,baseGuts:0,distAptitude:['C','C','C','C'], unique:{...own, evoLevel:0}, inheritedUniques:[] }).unique === 100);
const lv3 = monsterPowerParts({ baseHp:0,baseAtk:0,baseDef:0,baseGuts:0,distAptitude:['C','C','C','C'], unique:{...own, evoLevel:3}, inheritedUniques:[] }).unique;
check('固有技Lv3段階 = +200', Math.round(lv3 - 100) === 200, `${(lv3 - 100).toFixed(2)}`);
// 自前Lv3 + 継承Lv2 → 技所持 2×100、技Lv (3+2)×200/3
const mixed = masuPowerOf(makeMasu({
  uniqueSkillLevels: { own: 3, 'inh:0': 2 },
  inheritedUniques: [{ ...MONS.Suezo.unique, sourceMasuName: 'テストスエゾー' }],
}));
const expectMixed = Math.round(monsterPowerParts(mergeMasuIntoMon(base)).stat + monsterPowerParts(mergeMasuIntoMon(base)).aptitude + 2 * 100 + 5 * (200 / 3));
check('自前Lv3+継承Lv2 = 技所持200 + 技Lv 5段階', mixed === expectMixed, `${mixed} (期待 ${expectMixed})`);
check('継承固有技も自前と同じ基準', masuPowerOf(makeMasu({ inheritedUniques: [{ ...MONS.Suezo.unique }] })) - basePower === 100);
// 壊れた継承データを架空の技として数えない
check('壊れた継承データは数えない',
  masuPowerOf(makeMasu({ inheritedUniques: [null, {}, { name: 'こわれ' }, 'x'] })) === basePower,
  `${masuPowerOf(makeMasu({ inheritedUniques: [null, {}, { name: 'こわれ' }, 'x'] }))} (期待 ${basePower})`);

// --- ④ 総合力に含めないもの ---
check('未使用強化Pを増やしても総合力は変わらない', masuPowerOf(makeMasu({ distAptPoints: 99 })) === basePower);
check('絆XP(絆Lv)だけでは増えない', masuPowerOf(makeMasu({ bondXp: 999999 })) === basePower);
check('Lv上限だけでは増えない', masuPowerOf(makeMasu({ levelCap: 100 })) === basePower);
check('限界突破回数だけでは増えない', masuPowerOf(makeMasu({ rebirthCount: 9 })) === basePower);
check('転生回数だけでは増えない', masuPowerOf(makeMasu({ reincarnateCount: 9 })) === basePower);
check('合体回数・合体で得たXPだけでは増えない', masuPowerOf(makeMasu({ fusionHistory: [{ subName: 'x', xpGained: 99999, inherited: false }] })) === basePower);
check('染色では増えない', masuPowerOf(makeMasu({ colors: ['blue', 'red', 'green'] })) === basePower);
// 勇者特性・合流ボーナスは式に出てこない
const powerSrc = source.slice(powerFrom, powerTo);
check('勇者特性を計算に含めていない', !/trait/.test(powerSrc));
check('合流ボーナス(plusStats)を計算に含めていない', !/plusStats/.test(powerSrc.slice(powerSrc.indexOf('const monsterPowerParts'))));

// --- ⑤ 丸め ---
check('最後だけ四捨五入する',
  /const monsterPowerOf = \(mon\) => Math\.round\(monsterPowerParts\(mon\)\.total\);/.test(source)
  && !/Math\.round\([^)]*MONSTER_POWER_STAT_WEIGHT/.test(powerSrc));
// 3で割り切れない値でも、項目ごとに丸めず最後にまとめて丸める
const oddStat = monsterPowerParts({ baseHp: 0, baseAtk: 1, baseDef: 1, baseGuts: 1, distAptitude: ['C','C','C','C'], unique: null, inheritedUniques: [] });
check('項目ごとに丸めていない', Math.abs(oddStat.stat - 10) < 1e-9, `ちから1+丈夫さ1+ガッツ1 = ${oddStat.stat}`);

// --- ⑥ ベースモンとマスモンで同じ式を使う ---
check('ベースモンでも総合力を出せる', Object.keys(MONS).every(id => Number.isFinite(monsterPowerOf(MONS[id]))));
check('素のマスモンはベースモンと同じ総合力', basePower === monsterPowerOf(baseMon), `${basePower} / ${monsterPowerOf(baseMon)}`);
check('ベース値と強化値を二重に足していない',
  masuPowerOf(makeMasu({ statPoints: { hp: 100, atk: 0, def: 0, guts: 0 } })) - basePower === 100);

// --- ⑦ 強化プレビュー ---
const withPoints = makeMasu({ distAptPoints: 5 });
const plan = { apt: [1, 0, 1, 0], stat: { hp: 1, atk: 1 } };
const beforePower = masuPowerOf(withPoints);
const previewPower = plannedMasuPowerOf(withPoints, plan);
check('一括強化のプレビューが実データを変更しない',
  withPoints.distAptPoints === 5 && withPoints.statPoints.hp === 0 && withPoints.distApt.join('/') === baseMon.distAptitude.join('/'),
  JSON.stringify({ pts: withPoints.distAptPoints, hp: withPoints.statPoints.hp }));
const applied = applyEnhancePlanToMasu(withPoints, plan);
check('確定後の総合力がプレビュー値と一致する', masuPowerOf(applied.masu) === previewPower, `${masuPowerOf(applied.masu)} / ${previewPower}`);
check('プレビューの増分が強化P×10', previewPower - beforePower === 4 * 10, `+${previewPower - beforePower} (強化P4点)`);
check('確定でポイントが減る', applied.masu.distAptPoints === 1 && applied.used === 4, `残り${applied.masu.distAptPoints} 使用${applied.used}`);
// 未使用ポイントが総合力0点なので、能力へ振ると上がり、戻せば下がる(絆ポイントリセットの整合)
const afterReset = makeMasu({ distAptPoints: 4 });
check('強化を未使用ポイントへ戻すと総合力は下がる', masuPowerOf(afterReset) === basePower && masuPowerOf(applied.masu) > basePower,
  `リセット後 ${masuPowerOf(afterReset)} / 強化後 ${masuPowerOf(applied.masu)}`);
check('ポイント不足の下書きは当てはめない', applyEnhancePlanToMasu(makeMasu({ distAptPoints: 1 }), { apt: [2, 0, 0, 0], stat: {} }) === null);

// 再生個体はベースモンと異なる基礎値を保存している。強化の下書き・確定のどちらでも
// individualStats を維持し、その値へ statPoints を加えた結果を使う。
const regenerated = makeMasu({
  distAptPoints: 2,
  individualStats: {
    hp: baseMon.baseHp + 10,
    atk: baseMon.baseAtk - 3,
    def: baseMon.baseDef + 3,
    guts: baseMon.baseGuts - 3,
  },
});
const regeneratedPlan = { apt: [0, 0, 0, 0], stat: { hp: 1, atk: 1 } };
const regeneratedPreview = plannedMasuPowerOf(regenerated, regeneratedPlan);
const regeneratedApplied = applyEnhancePlanToMasu(regenerated, regeneratedPlan);
check('再生個体の強化で individualStats を変更しない',
  JSON.stringify(regeneratedApplied.masu.individualStats) === JSON.stringify(regenerated.individualStats));
const regeneratedResolved = mergeMasuIntoMon(regeneratedApplied.masu);
check('再生個体の解決値は individualStats + statPoints',
  regeneratedResolved.baseHp === regenerated.individualStats.hp + 10
  && regeneratedResolved.baseAtk === regenerated.individualStats.atk + 3
  && regeneratedResolved.baseDef === regenerated.individualStats.def
  && regeneratedResolved.baseGuts === regenerated.individualStats.guts);
check('再生個体も一括強化プレビューと確定後の総合力が一致する',
  masuPowerOf(regeneratedApplied.masu) === regeneratedPreview,
  `${masuPowerOf(regeneratedApplied.masu)} / ${regeneratedPreview}`);

// --- ⑧ 画面が同じ共通関数を使っているか(式のコピーが無いこと) ---
const uses = (needle) => (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
// 重みを掛けている場所(=式そのもの)は monsterPowerParts の中だけ。
// ヘルプの表は同じ定数を「表示」しているだけなので、掛け算の回数で見分ける
check('総合力の式は1か所だけ',
  uses('* MONSTER_POWER_STAT_WEIGHT.') === 4 && uses('const monsterPowerParts') === 1 && uses('const monsterPowerOf') === 1,
  `重みの掛け算 ${uses('* MONSTER_POWER_STAT_WEIGHT.')}回`);
// 一覧カードは画面ごとに書かず renderMonsterCardBody 1か所で総合力を出す。
// 画面ごとに書き写していたころ、勇者モン選択だけ総合力が出ていなかった
check('一覧カードが共通関数を使う',
  /masuPowerOf\(masu\)\s*:\s*monsterPowerOf\(base\)/.test(source)
  && /monsterCardPower\(power\)/.test(source)
  && (source.match(/monsterCardPower\(/g) || []).length === 1);
// ランキングは記録時点の総合力(powerOverride)を渡せるが、渡されなければ共通の計算に落ちる
check('詳細の上部サマリーが共通関数を使う',
  /const power = powerOverride !== undefined \? powerOverride : monsterPowerOf\(mon\);/.test(source));
check('並べ替えが共通関数を使う', /power: masuPowerOf\(masu\)/.test(source) && /power: monsterPowerOf\(base\)/.test(source));
check('並べ替えに総合力がある', /\{ key: 'power', label: '総合力' \}/.test(source) && /monsterSortKey === 'power'/.test(source));
check('強化画面が共通関数を使う', /const currentPower = masuPowerOf\(masu\);/.test(source) && /plannedMasuPowerOf\(masu, plan\)/.test(source));
check('強化画面の現在値が共通の個体基礎値解決を使う',
  /const resolvedIndividualStats = resolveMasuIndividualStats\(masu, base\);/.test(source)
  && /const currentStatValue = \(key\) => \(resolvedIndividualStats\[key\]\|\|0\)/.test(source));
check('確定処理も下書き適用の共通関数を通る', /const applied = applyEnhancePlanToMasu\(masu, plan\);/.test(source));
check('総合力をセーブデータへ保存していない', !/storeSet\([^)]*power/i.test(source) && !/power:\s*masuPowerOf[^)]*\}\s*;\s*\n\s*storeSet/.test(source));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exitCode = failed ? 1 : 0;
