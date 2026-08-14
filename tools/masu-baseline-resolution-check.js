// マスモン基礎値・間合い適性の新旧保存形式と、最新ベース追従を本番ロジックで確認する。
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const from = source.indexOf('const getMasuColors =');
const to = source.indexOf('const migrateMasuLevelCaps');
if (from < 0 || to <= from) throw new Error('解決ロジックを抽出できません');
const base = { id:'Test', name:'Test', baseHp:100, baseAtk:50, baseDef:80, baseGuts:40, distAptitude:['A','B','C','D'], plusStats:{}, unique:null };
const context = {
  Math, Number, Array, Object, String,
  ALL_PLAYER_MONSTERS:{Test:base},
  DIST_APTITUDE_GRADES:['G','F','E','D','C','B','A','S','S+','SS','SS+','M'],
  STAT_POINT_GAIN:{hp:10,atk:3,def:3,guts:3}, STAT_POINT_KEYS:{hp:'HP',atk:'攻',def:'防',guts:'G'},
  uniqueSkillAtLevel:value=>value, cappedBondXp:()=>0, bondLevelInfo:()=>({level:1}),
};
vm.createContext(context);
vm.runInContext(`${source.slice(from,to)}\nglobalThis.api={resolveMasuIndividualStats,resolveMasuDistAptitude,mergeMasuIntoMon,masuPowerOf};`, context);
const { mergeMasuIntoMon, masuPowerOf } = context.api;
const check = (label, ok) => { if (!ok) throw new Error(`NG: ${label}`); console.log(`OK: ${label}`); };
const oldNormal = {id:'normal',baseId:'Test',name:'通常',statPoints:{hp:10,atk:3,def:0,guts:0},distApt:['A','S','C','D']};
const oldNormalResolved = mergeMasuIntoMon(oldNormal);
check('旧形式の通常マスモン', JSON.stringify([oldNormalResolved.baseHp,oldNormalResolved.baseAtk,oldNormalResolved.baseDef,oldNormalResolved.baseGuts,oldNormalResolved.distAptitude]) === JSON.stringify([110,53,80,40,oldNormal.distApt]));
const oldRegen = {...oldNormal,id:'regen',individualStats:{hp:93,atk:54,def:77,guts:42}};
const oldRegenResolved = mergeMasuIntoMon(oldRegen);
check('旧形式の再生個体はindividualStatsを維持', JSON.stringify([oldRegenResolved.baseHp,oldRegenResolved.baseAtk,oldRegenResolved.baseDef,oldRegenResolved.baseGuts]) === JSON.stringify([103,57,77,42]));
const oldPower = masuPowerOf(oldRegen);
check('旧形式の総合力が従来式と一致', oldPower === Math.round(103 + 57*10/3 + 77*10/3 + 42*10/3 + 20 + 30 + 0 - 10));
const modern = {...oldNormal,id:'modern',individualStats:{hp:999,atk:999,def:999,guts:999},individualStatOffsets:{hp:10,atk:-3,def:3,guts:-3},distApt:['M','M','M','M'],distAptBoosts:[0,2,0,1]};
let resolved = mergeMasuIntoMon(modern);
check('新形式はbase+offsetを旧完成値より優先', JSON.stringify([resolved.baseHp,resolved.baseAtk,resolved.baseDef,resolved.baseGuts]) === JSON.stringify([120,50,83,37]));
check('新形式はbase適性+boostを旧完成値より優先', JSON.stringify(resolved.distAptitude) === JSON.stringify(['A','S','C','C']));
base.baseHp=120; base.baseAtk=60; base.baseDef=90; base.baseGuts=45; base.distAptitude=['S','C','B','SS+'];
resolved = mergeMasuIntoMon(modern);
check('ベース変更後もoffsetを維持して追従', JSON.stringify([resolved.baseHp,resolved.baseAtk,resolved.baseDef,resolved.baseGuts]) === JSON.stringify([140,60,93,42]));
check('ベース適性変更後もboostを維持して追従', JSON.stringify(resolved.distAptitude) === JSON.stringify(['S','A','B','M']));
check('間合い適性はMを超えない', mergeMasuIntoMon({...modern,distAptBoosts:[99,99,99,99]}).distAptitude.every(g=>g==='M'));
console.log('\nすべてOK');
