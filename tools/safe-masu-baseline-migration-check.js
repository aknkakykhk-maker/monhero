const fs = require('fs');
const { loadDyeModule } = require('./harness');
const m = loadDyeModule();
const { ALL_PLAYER_MONSTERS, DIST_APTITUDE_GRADES, diagnoseLegacyMasuBaselineMigration:diagnose,
  migrateSafeMasuBaselineRepresentations:migrate, mergeMasuIntoMon, masuPowerOf, monsterPowerOf, monsterPowerParts,
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
const oldPixie={...baseMasu('Pixie'),individualStats:{hp:250,atk:160,def:50,guts:130}};
const pixieDiagnosis=diagnose(oldPixie); const pixieOnce=migrate([oldPixie]); const migratedPixie=pixieOnce.nextMasuMons[0];
check('旧PixieはSAFE_EXACTから実移行',pixieDiagnosis.overallStatus==='SAFE_EXACT'&&pixieOnce.changed&&pixieOnce.summary.migrated===1);
check('旧Pixieは個体差-10を保持し現行G170の基礎部分G160へ追従',migratedPixie.individualStatOffsets.guts===-10&&mergeMasuIntoMon(migratedPixie).baseGuts-migratedPixie.statPoints.guts===160);
check('旧PixieはstatPointsも加算',mergeMasuIntoMon(migratedPixie).baseGuts===163);
check('旧Pixieは2回目無変更',!migrate(pixieOnce.nextMasuMons).changed&&snap(migrate(pixieOnce.nextMasuMons).nextMasuMons)===snap(pixieOnce.nextMasuMons));

const oldMitarashi={...baseMasu('Mitarashi'),individualStats:{hp:600,atk:120,def:120,guts:100}};
const mitarashiBefore=mergeMasuIntoMon(oldMitarashi); const mitarashiResult=migrate([oldMitarashi]); const migratedMitarashi=mitarashiResult.nextMasuMons[0]; const mitarashiAfter=mergeMasuIntoMon(migratedMitarashi);
check('旧MitarashiはSAFE_EXACTから実移行',diagnose(oldMitarashi).overallStatus==='SAFE_EXACT'&&mitarashiResult.changed&&mitarashiResult.summary.migrated===1);
check('旧Mitarashiは個体差を保持',snap(migratedMitarashi.individualStatOffsets)===snap({hp:0,atk:0,def:0,guts:0}));
check('旧Mitarashiの能力変化量はHP+30/攻+20/防-15/G-10',[30,20,-15,-10].every((delta,index)=>delta===[mitarashiAfter.baseHp-mitarashiBefore.baseHp,mitarashiAfter.baseAtk-mitarashiBefore.baseAtk,mitarashiAfter.baseDef-mitarashiBefore.baseDef,mitarashiAfter.baseGuts-mitarashiBefore.baseGuts][index]));
check('旧Mitarashiの総合力は移行後能力から現行式で再計算',masuPowerOf(migratedMitarashi)===monsterPowerOf(mitarashiAfter)&&monsterPowerOf(mitarashiAfter)===Math.round(monsterPowerParts(mitarashiAfter).total));

const currentPixie={...baseMasu('Pixie'),individualStats:{hp:250,atk:160,def:50,guts:170}};
const currentBefore=stats(currentPixie); const currentResult=migrate([currentPixie]);
check('現行ベース由来の再生個体は能力・総合力不変',currentResult.changed&&snap(stats(currentResult.nextMasuMons[0]))===snap(currentBefore));
const previouslyDeferred={...oldPixie};
for (const count of [34,35]) {
  const masu={...boosted,id:`bt-${count}`,breakthroughCount:count,bondXp:totalBondXpForLevel(40),distAptPoints:40};
  check(`${count}凸ポイント倍率ケース`,diagnose(masu).overallStatus==='SAFE_EXACT'&&migrate([masu]).summary.migrated===1);
}
const source=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
check('reconcile後に移行し専用フラグを使う',source.indexOf('migrateSafeMasuBaselineRepresentations(savedMasuMons)')>source.indexOf('savedMasuMons.map(reconcileMasuPoints)')&&source.includes('mh_masu_baseline_relative_migrated_v1'));
check('旧フラグtrue相当の前回保留個体も再診断して移行',migrate([previouslyDeferred]).changed&&source.includes("storeGet('mh_masu_baseline_relative_migrated_v1', false, false)"));
if (failed) process.exit(1); console.log('\nすべてOK');
