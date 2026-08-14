// 第6B-2: 旧distAptからdistAptBoosts候補を作る純粋判定を検査する。
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const from = source.indexOf('const getMasuColors =');
const to = source.indexOf('// 第4段階の既存個体ドライラン', from);
if (from < 0 || to <= from) throw new Error('距離適性判定を抽出できません');
const context = {
  console, Math, Number, Array, Object, String, JSON,
  ALL_PLAYER_MONSTERS:{
    Test:{id:'Test',baseHp:100,baseAtk:50,baseDef:80,baseGuts:40,distAptitude:['A','B','C','D'],plusStats:{},unique:null},
    Golem:{id:'Golem',baseHp:600,baseAtk:220,baseDef:150,baseGuts:70,distAptitude:['A','E','G','G'],plusStats:{},unique:null},
  },
  DIST_APTITUDE_GRADES:['G','F','E','D','C','B','A','S','S+','SS','SS+','M'],
  uniqueSkillAtLevel:value=>value,
};
vm.createContext(context);
vm.runInContext(`${source.slice(from, to)}\nglobalThis.diagnose=diagnoseLegacyDistAptBoosts;`, context);
const diagnose = context.diagnose;
const check = (label, ok) => { if (!ok) throw new Error(`NG: ${label}`); console.log(`OK: ${label}`); };
const snapshot = value => JSON.stringify(value);
const normal = {id:'normal',baseId:'Test',name:'通常',distApt:['A','S','C','D'],distAptPoints:3,statPoints:{hp:10}};
const original = snapshot(normal);
let result = diagnose(normal);
check('通常種の強化済み候補はSAFE_EXACT', result.status === 'SAFE_EXACT' && snapshot(result.proposed.distAptBoosts) === '[0,2,0,0]');
check('全安全条件を満たす', Object.values(result.checks).every(Boolean));
check('入力を変更しない', snapshot(normal) === original);
result = diagnose({...normal,distApt:['A','B','C','D']});
check('通常種の未強化候補はSAFE_EXACT', result.status === 'SAFE_EXACT' && snapshot(result.proposed.distAptBoosts) === '[0,0,0,0]');
check('不正等級と4距離未満をBLOCKED', [['A','X','C','D'],['A','B','C']].every(distApt => diagnose({...normal,distApt}).status === 'BLOCKED'));
check('ベースより低い値をBLOCKED', diagnose({...normal,distApt:['B','S','C','D']}).status === 'BLOCKED');
check('M超過候補をBLOCKED', diagnose({...normal,distApt:['A','S','C','D'],distAptBoosts:[0,99,0,0]}).status === 'BLOCKED');
check('distAptPoints不整合をBLOCKED', [-1,1.5,NaN].every(distAptPoints => diagnose({...normal,distAptPoints}).status === 'BLOCKED'));
const oldGolem = {id:'old-golem',baseId:'Golem',distApt:['A','C','E','G'],distAptPoints:0};
check('旧形式ゴーレムはAMBIGUOUS', diagnose(oldGolem).status === 'AMBIGUOUS');
const newGolem = {...oldGolem,distApt:['A','E','G','G'],distAptBoosts:[0,0,0,0]};
check('新形式ゴーレムはSAFE_EXACT', diagnose(newGolem).status === 'SAFE_EXACT');
check('新形式のdistAptとboostの矛盾はBLOCKED', diagnose({...newGolem,distApt:['M','E','G','G']}).status === 'BLOCKED');
const diagnosticSource = source.slice(source.indexOf('const diagnoseLegacyDistAptBoosts ='), to);
check('判定に保存処理がない', !/localStorage|mh_masu_mons|setMasuMons/.test(diagnosticSource));
console.log('\nすべてOK');
