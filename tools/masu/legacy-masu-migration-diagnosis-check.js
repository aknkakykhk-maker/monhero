// 第6B-3: 本番ロジックで能力・間合いを統合した個体全体の非保存診断を検査する。
const fs = require('fs');
const { loadDyeModule } = require('../harness');
const {
  ALL_PLAYER_MONSTERS, DIST_APTITUDE_GRADES, diagnoseLegacyMasuBaselineMigration:diagnose,
  mergeMasuIntoMon,
} = loadDyeModule();
const check = (label, ok) => { if (!ok) throw new Error(`NG: ${label}`); console.log(`OK: ${label}`); };
const snapshot = value => JSON.stringify(value);
const base = ALL_PLAYER_MONSTERS.Mocchi;
const statKeys = ['hp','atk','def','guts'];
const baseStats = {hp:base.baseHp,atk:base.baseAtk,def:base.baseDef,guts:base.baseGuts};
const boostedApt = [...base.distAptitude];
const aptIndex = boostedApt.findIndex(grade => grade !== 'M');
boostedApt[aptIndex] = DIST_APTITUDE_GRADES[DIST_APTITUDE_GRADES.indexOf(boostedApt[aptIndex]) + 1];
const baseMasu = distApt => ({
  id:'test-Mocchi',baseId:'Mocchi',name:'検査',bondXp:0,distAptPoints:3,distApt:[...distApt],
  statPoints:{hp:10,atk:3,def:0,guts:6},uniqueSkillLevels:{},inheritedUniques:[],
});
const run = (label,input,overallStatus,individualStatus,aptitudeStatus) => {
  const before=snapshot(input); const result=diagnose(input);
  check(`${label}: 全体=${overallStatus}`,result.overallStatus===overallStatus);
  check(`${label}: 能力=${individualStatus}`,result.individualStats.status===individualStatus);
  check(`${label}: 間合い=${aptitudeStatus}`,result.aptitude.status===aptitudeStatus);
  check(`${label}: 入力オブジェクト非変更`,snapshot(input)===before);
  return result;
};
const oldNormal=baseMasu(boostedApt);
let result=run('旧通常個体',oldNormal,'SAFE_EXACT','ALREADY_MODERN','SAFE_EXACT');
check('旧通常個体は既存ポイントを完全維持',result.checks.statPointsPreserved&&result.checks.distAptPointsPreserved);
const oldRegenerated={...baseMasu(base.distAptitude),individualStats:{hp:Math.round(base.baseHp*.9),atk:Math.round(base.baseAtk*1.1-0.01),def:base.baseDef,guts:Math.round(base.baseGuts*.9)}};
result=run('旧再生個体',oldRegenerated,'SAFE_EXACT','SAFE_EXACT','SAFE_EXACT');
check('旧再生個体は整数offset候補を返す',statKeys.every(key=>Number.isInteger(result.individualStats.proposedOffsets[key])));
const offsets={...result.individualStats.proposedOffsets};
const modern={...oldRegenerated,individualStatOffsets:offsets,distAptBoosts:[0,0,0,0]};
run('正規の新形式個体',modern,'ALREADY_MODERN','ALREADY_MODERN','ALREADY_MODERN');
for (const bad of [1.5,NaN,Infinity]) {
  run(`individualStatOffsets不正値 ${String(bad)}`,{...modern,individualStatOffsets:{...offsets,hp:bad}},'BLOCKED','BLOCKED','ALREADY_MODERN');
}
['hp','atk','def','guts'].forEach(key=>run(`statPoints ${key}不正刻み`,{...oldNormal,statPoints:{...oldNormal.statPoints,[key]:1}},'BLOCKED','BLOCKED','BLOCKED'));
const oldGolem={...baseMasu(['A','C','E','G']),baseId:'Golem'};
run('旧ゴーレム',oldGolem,'PARTIAL','ALREADY_MODERN','AMBIGUOUS');

const beforeResolved=mergeMasuIntoMon(modern);
const originalBase={baseHp:base.baseHp,baseAtk:base.baseAtk,baseDef:base.baseDef,baseGuts:base.baseGuts,distAptitude:[...base.distAptitude]};
base.baseHp+=100; base.baseAtk+=20; base.baseDef+=10; base.baseGuts+=5;
base.distAptitude=base.distAptitude.map((grade,index)=>index===aptIndex?DIST_APTITUDE_GRADES[Math.min(DIST_APTITUDE_GRADES.length-1,DIST_APTITUDE_GRADES.indexOf(grade)+1)]:grade);
const futureResult=run('将来ベース変更後の正規新形式個体',modern,'ALREADY_MODERN','ALREADY_MODERN','ALREADY_MODERN');
const afterResolved=mergeMasuIntoMon(modern);
check('将来ベース変更後も整数offsetを維持して能力が追従',snapshot(modern.individualStatOffsets)===snapshot(offsets)&&afterResolved.baseHp-beforeResolved.baseHp===100&&afterResolved.baseAtk-beforeResolved.baseAtk===20&&afterResolved.baseDef-beforeResolved.baseDef===10&&afterResolved.baseGuts-beforeResolved.baseGuts===5);
check('将来ベース変更後もboostを維持して距離適性が追従',snapshot(modern.distAptBoosts)==='[0,0,0,0]'&&snapshot(afterResolved.distAptitude)===snapshot(base.distAptitude)&&futureResult.aptitude.status==='ALREADY_MODERN');
Object.assign(base,originalBase);
const source=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const diagnosticSource=source.slice(source.indexOf('const diagnoseLegacyMasuBaselineMigration ='),source.indexOf('// 第4段階の既存個体ドライラン'));
check('統合診断に保存処理がない',!/localStorage|mh_masu_mons|storeSet|setMasuMons/.test(diagnosticSource));
console.log('\nすべてOK');
