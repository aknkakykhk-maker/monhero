// 第6B-3: 能力・間合いを統合した個体全体の非保存診断を検査する。
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const from = source.indexOf('const getMasuColors =');
const to = source.indexOf('// 第4段階の既存個体ドライラン', from);
if (from < 0 || to <= from) throw new Error('統合診断を抽出できません');
const context = {
  console, Math, Number, Array, Object, String, JSON,
  ALL_PLAYER_MONSTERS:{
    Mocchi:{id:'Mocchi',baseHp:500,baseAtk:100,baseDef:100,baseGuts:120,distAptitude:['A','B','C','D'],plusStats:{},unique:null},
    Pixie:{id:'Pixie',baseHp:250,baseAtk:160,baseDef:50,baseGuts:170,distAptitude:['C','A','B','C'],plusStats:{},unique:null},
    Mitarashi:{id:'Mitarashi',baseHp:630,baseAtk:140,baseDef:105,baseGuts:90,distAptitude:['B','A','C','D'],plusStats:{},unique:null},
    Golem:{id:'Golem',baseHp:600,baseAtk:220,baseDef:150,baseGuts:70,distAptitude:['A','E','G','G'],plusStats:{},unique:null},
  },
  DIST_APTITUDE_GRADES:['G','F','E','D','C','B','A','S','S+','SS','SS+','M'],
  STAT_POINT_GAIN:{hp:10,atk:3,def:3,guts:3},
  masuBondLevelInfo:masu=>({level:Number(masu.bondXp||0)+1}), totalBreakthroughPoints:()=>0,
  ownReincarnateBonusPoints:()=>0, inheritedReincarnateBonusPointsOf:()=>0,
  uniqueSkillAtLevel:value=>value,
};
vm.createContext(context);
vm.runInContext(`${source.slice(from, to)}\nglobalThis.diagnose=diagnoseLegacyMasuBaselineMigration;`, context);
const diagnose = context.diagnose;
const check = (label, ok) => { if (!ok) throw new Error(`NG: ${label}`); console.log(`OK: ${label}`); };
const snapshot = value => JSON.stringify(value);
const baseMasu = (baseId, distApt) => {
  const bases = context.ALL_PLAYER_MONSTERS[baseId].distAptitude;
  const aptSpent = distApt.reduce((sum, grade, index) => sum + context.DIST_APTITUDE_GRADES.indexOf(grade) - context.DIST_APTITUDE_GRADES.indexOf(bases[index]), 0);
  return ({
  id:`test-${baseId}`, baseId, name:'検査', bondXp:aptSpent+7, distAptPoints:3, distApt:[...distApt],
  statPoints:{hp:10,atk:3,def:0,guts:6}, uniqueSkillLevels:{}, inheritedUniques:[],
}); };
const run = (label, input, overallStatus, individualStatus, aptitudeStatus) => {
  const before = snapshot(input);
  const result = diagnose(input);
  check(`${label}: 全体=${overallStatus}`, result.overallStatus === overallStatus);
  check(`${label}: 能力=${individualStatus}`, result.individualStats.status === individualStatus);
  check(`${label}: 間合い=${aptitudeStatus}`, result.aptitude.status === aptitudeStatus);
  check(`${label}: 入力オブジェクト非変更`, snapshot(input) === before);
  return result;
};

const oldNormal = baseMasu('Mocchi', ['A','S','C','D']);
let result = run('旧通常個体', oldNormal, 'SAFE_EXACT', 'ALREADY_MODERN', 'SAFE_EXACT');
check('旧通常個体: 移行不要な能力候補は空', snapshot(result.individualStats.proposedOffsets) === '{}');
check('旧通常個体: 間合い・ポイントを保全し総合力を再計算', Object.values(result.checks).every(Boolean));

const oldRegenerated = {...baseMasu('Mocchi',['A','B','C','D']),individualStats:{hp:450,atk:110,def:100,guts:108}};
result = run('旧再生個体', oldRegenerated, 'SAFE_EXACT', 'SAFE_EXACT', 'SAFE_EXACT');
check('旧再生個体: 4能力候補を返す', snapshot(result.individualStats.proposedOffsets) === '{"hp":-50,"atk":10,"def":0,"guts":-12}');
check('旧再生個体: 個体差を現行ベースへ適用', result.checks.statOffsetsCorrect && result.checks.statsMatchCurrentBase && result.checks.statDeltaMatchesBaseline);

const pixieCases = [
  ['旧', {hp:250,atk:160,def:50,guts:130}, 'SAFE_EXACT'],
  ['新', {hp:250,atk:160,def:50,guts:180}, 'SAFE_EXACT'],
  ['曖昧', {hp:250,atk:160,def:50,guts:154}, 'AMBIGUOUS'],
];
pixieCases.forEach(([label, individualStats, status]) => run(`ピクシー${label}`,
  {...baseMasu('Pixie',['C','A','B','C']),individualStats}, status === 'AMBIGUOUS' ? 'PARTIAL' : status === 'BLOCKED' ? 'BLOCKED' : 'SAFE_EXACT', status, 'SAFE_EXACT'));
const mitarashiCases = [
  ['旧', {hp:550,atk:110,def:110,guts:100}, 'SAFE_EXACT'],
  ['新', {hp:680,atk:150,def:100,guts:85}, 'SAFE_EXACT'],
  ['曖昧', {hp:620,atk:130,def:110,guts:95}, 'AMBIGUOUS'],
];
mitarashiCases.forEach(([label, individualStats, status]) => run(`ミタラシ${label}`,
  {...baseMasu('Mitarashi',['B','A','C','D']),individualStats}, status === 'AMBIGUOUS' ? 'PARTIAL' : status === 'BLOCKED' ? 'BLOCKED' : 'SAFE_EXACT', status, 'SAFE_EXACT'));

run('旧ゴーレム', baseMasu('Golem',['A','C','E','G']), 'PARTIAL', 'ALREADY_MODERN', 'AMBIGUOUS');
const modern = {...oldRegenerated,individualStatOffsets:{hp:-50,atk:10,def:0,guts:-12},distAptBoosts:[0,0,0,0]};
run('新形式個体', modern, 'ALREADY_MODERN', 'ALREADY_MODERN', 'ALREADY_MODERN');
run('壊れたデータ', {...oldNormal,statPoints:{hp:'broken'}}, 'BLOCKED', 'BLOCKED', 'BLOCKED');
run('新形式の旧能力スナップショット不一致', {...modern,individualStatOffsets:{hp:999,atk:10,def:0,guts:-12}}, 'ALREADY_MODERN', 'ALREADY_MODERN', 'ALREADY_MODERN');
['hp','atk','def','guts'].forEach(key => run(`statPoints ${key}不正刻み`, {...oldNormal,statPoints:{...oldNormal.statPoints,[key]:1}}, 'BLOCKED', 'BLOCKED', 'BLOCKED'));

const futureModern = {...modern,individualStats:{hp:-999,atk:-999,def:-999,guts:-999},distApt:['M','M','M','M']};
context.ALL_PLAYER_MONSTERS.Mocchi.baseHp += 100;
context.ALL_PLAYER_MONSTERS.Mocchi.distAptitude = ['S','C','B','E'];
run('将来ベース変更後の新形式個体', futureModern, 'ALREADY_MODERN', 'ALREADY_MODERN', 'ALREADY_MODERN');

const diagnosticSource = source.slice(source.indexOf('const diagnoseLegacyMasuBaselineMigration ='), to);
check('統合診断に保存処理がない', !/localStorage|mh_masu_mons|storeSet|setMasuMons/.test(diagnosticSource));
console.log('\nすべてOK');
