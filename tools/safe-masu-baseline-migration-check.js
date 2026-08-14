const fs = require('fs');
const { loadDyeModule } = require('./harness');
const m = loadDyeModule();
const { ALL_PLAYER_MONSTERS, DIST_APTITUDE_GRADES, diagnoseLegacyMasuBaselineMigration:diagnose,
  migrateSafeMasuBaselineRepresentations:migrate, mergeMasuIntoMon, masuPowerOf,
  totalBondXpForLevel } = m;
let failed = 0;
const check = (label, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${label}`); if (!ok) failed++; };
const snap = value => JSON.stringify(value);
const stats = masu => { const mon=mergeMasuIntoMon(masu); return [mon.baseHp,mon.baseAtk,mon.baseDef,mon.baseGuts,...mon.distAptitude,masuPowerOf(masu),snap(masu.statPoints),masu.distAptPoints]; };
const baseMasu = (baseId='Mocchi') => ({ id:`${baseId}-1`,baseId,name:baseId,bondXp:totalBondXpForLevel(10),distAptPoints:8,distApt:[...ALL_PLAYER_MONSTERS[baseId].distAptitude],statPoints:{hp:10,atk:3,def:3,guts:3},createdAt:1,rebirthCount:2,breakthroughCount:1 });
const boosted = baseMasu(); boosted.distApt[0]=DIST_APTITUDE_GRADES[DIST_APTITUDE_GRADES.indexOf(boosted.distApt[0])+1]; boosted.distAptPoints--;
const mocchi=ALL_PLAYER_MONSTERS.Mocchi;
const regenerated = {...baseMasu(),id:'regen',individualStats:{hp:Math.round(mocchi.baseHp*.9),atk:Math.round(mocchi.baseAtk*.9),def:Math.round(mocchi.baseDef*.9),guts:Math.round(mocchi.baseGuts*.9)}};
const both = {...regenerated,id:'both',distApt:[...boosted.distApt],distAptPoints:boosted.distAptPoints};
for (const [label,input,fields] of [['旧通常個体',boosted,['distAptBoosts']],['旧再生個体',regenerated,['individualStatOffsets','distAptBoosts']],['両方必要',both,['individualStatOffsets','distAptBoosts']]]) {
  const before=stats(input); const result=migrate([input]); const output=result.nextMasuMons[0];
  check(`${label}はSAFE_EXACT`,diagnose(input).overallStatus==='SAFE_EXACT');
  check(`${label}へ診断候補だけ追加`,result.summary.migrated===1&&fields.every(key=>Object.hasOwn(output,key)));
  check(`${label}の4能力・4距離・総合力・ポイント一致`,snap(stats(output))===snap(before));
  check(`${label}の旧フィールドを保持`,Object.keys(input).every(key=>snap(output[key])===snap(input[key])));
}
const modern=migrate([boosted]).nextMasuMons[0];
const partial={...baseMasu('Golem'),distApt:['A','C','E','G']};
const blocked={...baseMasu(),statPoints:{hp:1,atk:0,def:0,guts:0}};
for (const [label,input] of [['ALREADY_MODERN',modern],['PARTIAL',partial],['BLOCKED',blocked]]) {
  const result=migrate([input]); check(`${label}は完全無変更`,result.nextMasuMons[0]===input&&snap(result.nextMasuMons[0])===snap(input));
}
const ambiguousInput=baseMasu();
const ambiguousResult=migrate([ambiguousInput],()=>({overallStatus:'AMBIGUOUS'}));
check('AMBIGUOUSは完全無変更',ambiguousResult.nextMasuMons[0]===ambiguousInput&&ambiguousResult.summary.ambiguous===1);
const once=migrate([boosted]).nextMasuMons; const twice=migrate(once).nextMasuMons;
check('2回実行しても同一',snap(once)===snap(twice));
check('古い保存の再読込へ再適用可能',migrate([boosted]).changed&&snap(migrate([boosted]).nextMasuMons)===snap(once));
for (const [baseId,individualStats] of [['Pixie',{hp:250,atk:160,def:50,guts:130}],['Mitarashi',{hp:550,atk:110,def:110,guts:100}]]) {
  const legacy={...baseMasu(baseId),individualStats}; const result=migrate([legacy]);
  check(`${baseId}歴代ベースは保存前一致検査で保留`,diagnose(legacy).overallStatus==='SAFE_EXACT'&&!result.changed&&result.summary.validationFailed===1);
}
for (const count of [34,35]) {
  const masu={...boosted,id:`bt-${count}`,breakthroughCount:count,bondXp:totalBondXpForLevel(40),distAptPoints:40};
  check(`${count}凸ポイント倍率ケース`,diagnose(masu).overallStatus==='SAFE_EXACT'&&migrate([masu]).summary.migrated===1);
}
const source=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
check('reconcile後に移行し専用フラグを使う',source.indexOf('migrateSafeMasuBaselineRepresentations(savedMasuMons)')>source.indexOf('savedMasuMons.map(reconcileMasuPoints)')&&source.includes('mh_masu_baseline_relative_migrated_v1'));
if (failed) process.exit(1); console.log('\nすべてOK');
