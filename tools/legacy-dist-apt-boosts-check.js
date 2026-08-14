// 第6B-2: 本番ロジックで旧distAptからdistAptBoosts候補を作る純粋判定を検査する。
const fs = require('fs');
const { loadDyeModule } = require('./harness');
const {
  ALL_PLAYER_MONSTERS, DIST_APTITUDE_GRADES, diagnoseLegacyDistAptBoosts:diagnose,
  applyBondXpGain, totalBondXpForLevel, reconcileMasuPoints,
} = loadDyeModule();
const check = (label, ok) => { if (!ok) throw new Error(`NG: ${label}`); console.log(`OK: ${label}`); };
const snapshot = value => JSON.stringify(value);
const base = ALL_PLAYER_MONSTERS.Mocchi;
const upgraded = [...base.distAptitude];
const upgradeIndex = upgraded.findIndex(grade => grade !== 'M');
upgraded[upgradeIndex] = DIST_APTITUDE_GRADES[DIST_APTITUDE_GRADES.indexOf(upgraded[upgradeIndex]) + 1];
const normal = {id:'normal',baseId:'Mocchi',name:'通常',bondXp:0,distApt:upgraded,distAptPoints:3,statPoints:{hp:10,atk:3,def:0,guts:6}};
const original = snapshot(normal);
let result = diagnose(normal);
check('通常種の強化済み候補はSAFE_EXACT', result.status === 'SAFE_EXACT' && result.proposed.distAptBoosts.reduce((a,b)=>a+b,0) === 1);
check('全安全条件を満たす', Object.values(result.checks).every(Boolean));
check('statPoints/distAptPointsと入力を変更しない', snapshot(normal) === original);
result = diagnose({...normal,distApt:[...base.distAptitude]});
check('通常種の未強化候補はSAFE_EXACT', result.status === 'SAFE_EXACT' && snapshot(result.proposed.distAptBoosts) === '[0,0,0,0]');
check('不正等級と4距離未満をBLOCKED', [[...upgraded.slice(0,3),'X'],upgraded.slice(0,3)].every(distApt => diagnose({...normal,distApt}).status === 'BLOCKED'));
const below = [...base.distAptitude];
below[upgradeIndex] = DIST_APTITUDE_GRADES[DIST_APTITUDE_GRADES.indexOf(below[upgradeIndex]) - 1];
check('ベースより低い値をBLOCKED', diagnose({...normal,distApt:below}).status === 'BLOCKED');
check('M超過候補をBLOCKED', diagnose({...normal,distAptBoosts:[99,0,0,0]}).status === 'BLOCKED');
check('distAptPoints不正をBLOCKED', [-1,1.5,NaN].every(distAptPoints => diagnose({...normal,distAptPoints}).status === 'BLOCKED'));
const golemBase = ALL_PLAYER_MONSTERS.Golem;
const oldGolem = {id:'old-golem',baseId:'Golem',distApt:['A','C','E','G'],distAptPoints:0};
check('旧形式ゴーレムはAMBIGUOUS', diagnose(oldGolem).status === 'AMBIGUOUS');
const newGolem = {...oldGolem,distApt:[...golemBase.distAptitude],distAptBoosts:[0,0,0,0]};
check('新形式ゴーレムはSAFE_EXACT', diagnose(newGolem).status === 'SAFE_EXACT');

const gainedAt = (rebirthCount, fromLevel) => applyBondXpGain({
  id:`rainbow-${rebirthCount}`, baseId:'Mocchi', rebirthCount,
  levelCap:rebirthCount === 34 ? 330 : 400, bondXp:totalBondXpForLevel(fromLevel),
  distApt:[...base.distAptitude], distAptPoints:0, statPoints:{hp:0,atk:0,def:0,guts:0},
}, totalBondXpForLevel(fromLevel + 1) - totalBondXpForLevel(fromLevel)).masu;
for (const [count, level, points] of [[34,270,2],[35,330,3]]) {
  const masu = gainedAt(count, level);
  const before = reconcileMasuPoints({...masu});
  const diagnosis = diagnose(masu);
  const candidate = {...masu,...diagnosis.proposed};
  const after = reconcileMasuPoints(candidate);
  check(`${count}凸のLvUP×${points}実受取個体を誤BLOCKしない`, masu.distAptPoints === points && diagnosis.status === 'SAFE_EXACT');
  check(`${count}凸候補のreconcile結果と既存ポイントを維持`, before.distAptPoints === after.distAptPoints && snapshot(masu.statPoints) === snapshot(candidate.statPoints) && masu.distAptPoints === candidate.distAptPoints);
}
const source = fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const diagnosticSource = source.slice(source.indexOf('const diagnoseLegacyDistAptBoosts ='), source.indexOf('// 第4段階の既存個体ドライラン'));
check('独自earned計算式と保存処理がない', !/const earned|totalBreakthroughPoints|ownReincarnateBonusPoints|localStorage|mh_masu_mons|setMasuMons/.test(diagnosticSource));
console.log('\nすべてOK');
