// マスモン基礎値・間合い適性の新旧保存形式、新規生成、強化・リセット・転生を本番ロジックで確認する。
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const slice = (fromText, toText) => {
  const from = source.indexOf(fromText);
  const to = source.indexOf(toText, from);
  if (from < 0 || to <= from) throw new Error(`ロジックを抽出できません: ${fromText}`);
  return source.slice(from, to);
};
const base = { id:'Test', name:'Test', baseHp:100, baseAtk:50, baseDef:80, baseGuts:40, distAptitude:['A','B','C','D'], plusStats:{}, unique:null };
const context = {
  console, Math, Number, Array, Object, String, JSON,
  ALL_PLAYER_MONSTERS:{Test:base},
  DIST_APTITUDE_GRADES:['G','F','E','D','C','B','A','S','S+','SS','SS+','M'],
  STAT_POINT_GAIN:{hp:10,atk:3,def:3,guts:3}, STAT_POINT_KEYS:{hp:'HP',atk:'攻',def:'防',guts:'G'},
  uniqueSkillAtLevel:value=>value, cappedBondXp:()=>0, bondLevelInfo:()=>({level:1}),
  totalBondXpForLevel:level=>(level-1)*100, ownReincarnateBonusPoints:masu=>masu.reincarnateBonusPoints||0,
  inheritedReincarnateBonusPointsOf:masu=>masu.inheritedReincarnateBonusPoints||0,
  inheritedReincarnateCountOf:masu=>masu.inheritedReincarnateCount||0,
  INITIAL_MASU_LEVEL_CAP:30, MAX_MASU_LEVEL_CAP:200,
};
vm.createContext(context);
const resolution = slice('const getMasuColors =', 'const migrateMasuLevelCaps');
const regeneration = slice('const randomRegenerationStat =', 'const rosterBaseId =');
const rebirthReset = slice('const resetMasuForRebirth =', 'const migrateRebornMasuToFullReset');
vm.runInContext(`${rebirthReset}\n${resolution}\n${regeneration}\nglobalThis.api={resolveMasuIndividualStats,resolveMasuDistAptitude,mergeMasuIntoMon,masuPowerOf,masuBaselineRepresentationsMatch,diagnoseMasuBaselineMigration,diagnoseMasuBaselineMigrationList,applyEnhancePlanToMasu,buildBondResetRestorePlan,buildMasuBondPointReset,buildRegeneratedMasu,resetMasuForRebirth};`, context);
const api = context.api;
const check = (label, ok) => { if (!ok) throw new Error(`NG: ${label}`); console.log(`OK: ${label}`); };
const snapshot = value => JSON.stringify(value);
const stats = mon => [mon.baseHp,mon.baseAtk,mon.baseDef,mon.baseGuts];

const oldNormal = {id:'normal',baseId:'Test',name:'通常',statPoints:{hp:10,atk:3,def:0,guts:0},distApt:['A','S','C','D']};
const oldNormalSaved = snapshot(oldNormal);
let resolved = api.mergeMasuIntoMon(oldNormal);
check('旧通常個体は従来値のまま', snapshot([...stats(resolved),resolved.distAptitude]) === snapshot([110,53,80,40,oldNormal.distApt]));
const oldRegen = {...oldNormal,id:'regen',individualStats:{hp:93,atk:54,def:77,guts:42}};
const oldRegenSaved = snapshot(oldRegen);
resolved = api.mergeMasuIntoMon(oldRegen);
check('旧再生個体はindividualStatsの従来値を維持', snapshot(stats(resolved)) === snapshot([103,57,77,42]));
check('旧形式の総合力が従来式と一致', api.masuPowerOf(oldRegen) === Math.round(103 + 57*10/3 + 77*10/3 + 42*10/3 + 20 + 30 + 0 - 10));
check('旧個体を解決しただけでは保存内容を書き換えない', snapshot(oldNormal)===oldNormalSaved && snapshot(oldRegen)===oldRegenSaved);

const newNormal = {...oldNormal,id:'new-normal',distAptBoosts:[0,0,0,0],distApt:[...base.distAptitude]};
check('新規通常個体のdistAptとboost=0が一致', api.masuBaselineRepresentationsMatch(newNormal));
let randomCalls=0;
const draws=[0.75,0.2,0.9,0.1];
const regenerated=api.buildRegeneratedMasu(base,()=>{ const value=draws[randomCalls]; randomCalls++; return value; },1234);
check('新規再生は乱数を4能力につき一度だけ使う', randomCalls===4);
check('新規再生の完成値とbase+offsetが一致', snapshot(regenerated.individualStats)===snapshot({hp:105,atk:47,def:86,guts:37}) && api.masuBaselineRepresentationsMatch(regenerated));
check('新規再生の距離適性はboost=0で旧表現と一致', snapshot(regenerated.distAptBoosts)===snapshot([0,0,0,0]) && snapshot(regenerated.distApt)===snapshot(base.distAptitude));
const newDiagnosis=api.diagnoseMasuBaselineMigration({...regenerated,distAptPoints:5});
check('第3段階以降の正常な新形式個体はSAFE', newDiagnosis.status==='SAFE' && Object.values(newDiagnosis.checks).every(Boolean));
const legacyRegen={...regenerated}; delete legacyRegen.individualStatOffsets; delete legacyRegen.distAptBoosts;
check('生成直後の4能力・4適性・総合力が新旧で一致', snapshot(stats(api.mergeMasuIntoMon(regenerated)))===snapshot(stats(api.mergeMasuIntoMon(legacyRegen))) && snapshot(api.mergeMasuIntoMon(regenerated).distAptitude)===snapshot(api.mergeMasuIntoMon(legacyRegen).distAptitude) && api.masuPowerOf(regenerated)===api.masuPowerOf(legacyRegen));

const enhanced1=api.applyEnhancePlanToMasu({...newNormal,distAptPoints:4},{apt:[0,1,0,0]}).masu;
check('距離適性を1段階強化するとboostと完成値が同期', enhanced1.distAptBoosts[1]===1 && enhanced1.distApt[1]==='A' && api.mergeMasuIntoMon(enhanced1).distAptitude[1]==='A');
const enhancedMany=api.applyEnhancePlanToMasu(enhanced1,{apt:[0,3,0,0]}).masu;
check('複数段階強化でもboostと完成値が同期しMを超えない', enhancedMany.distAptBoosts[1]===4 && enhancedMany.distApt[1]==='SS' && api.mergeMasuIntoMon(enhancedMany).distAptitude[1]==='SS');
const capped=api.applyEnhancePlanToMasu({...newNormal,distApt:['A','M','C','D'],distAptBoosts:[0,5,0,0],distAptPoints:2},{apt:[0,2,0,0]});
check('適性はMまでの分だけ強化してMを超えない', capped.used===1 && capped.masu.distAptBoosts[1]===6 && capped.masu.distApt[1]==='M' && api.mergeMasuIntoMon(capped.masu).distAptitude[1]==='M');
const reset=api.buildMasuBondPointReset({...enhancedMany,statPoints:{hp:10,atk:3,def:0,guts:0}},base);
check('リセットは使用済みポイントを全量返して新旧適性を基礎値へ戻す', reset.refundedPoints===6 && snapshot(reset.nextMasu.distAptBoosts)===snapshot([0,0,0,0]) && snapshot(reset.nextMasu.distApt)===snapshot(base.distAptitude) && reset.nextMasu.distAptPoints===6);
check('リセット直前の4距離・4能力配分だけを個体へ保持する', snapshot(reset.nextMasu.bondResetAllocationSnapshot)===snapshot({version:1,apt:[0,4,0,0],stat:{hp:1,atk:1,def:0,guts:0}}) && !Object.hasOwn(reset.nextMasu.bondResetAllocationSnapshot,'bondXp'));
const restoredDraft=api.buildBondResetRestorePlan(reset.nextMasu,reset.nextMasu.bondResetAllocationSnapshot);
check('復元は以前の構成を保存値とは別の下書きにする', restoredDraft.restored===6 && restoredDraft.omitted===0 && snapshot(restoredDraft.plan)===snapshot({apt:[0,4,0,0],stat:{hp:1,atk:1,def:0,guts:0}}) && reset.nextMasu.statPoints.hp===0);
const shortDraft=api.buildBondResetRestorePlan({...reset.nextMasu,distAptPoints:3},reset.nextMasu.bondResetAllocationSnapshot);
check('ポイント不足では上限内の分だけ復元し不足数を返す', shortDraft.restored===3 && shortDraft.omitted===3 && shortDraft.plan.apt.reduce((a,b)=>a+b,0)===3);
check('壊れた旧セーブのスナップショットは復元対象にしない', api.buildBondResetRestorePlan(reset.nextMasu,{apt:[1],stat:{}})===null);
const oldReset=api.buildMasuBondPointReset(oldNormal,base);
check('旧形式リセットは新フィールドを追加しない', oldReset && !Object.hasOwn(oldReset.nextMasu,'distAptBoosts'));
const reincarnated=api.resetMasuForRebirth({...enhancedMany,individualStats:regenerated.individualStats,individualStatOffsets:regenerated.individualStatOffsets,colors:['red'],fusionHistory:[{id:1}],inheritedUniques:[{name:'技'}]}, {toLevel:2,distAptPoints:9});
check('転生は育成成果を維持して新旧適性を基礎値へ戻す', snapshot(reincarnated.distAptBoosts)===snapshot([0,0,0,0]) && snapshot(reincarnated.distApt)===snapshot(base.distAptitude) && snapshot(reincarnated.individualStats)===snapshot(regenerated.individualStats) && snapshot(reincarnated.individualStatOffsets)===snapshot(regenerated.individualStatOffsets) && reincarnated.distAptPoints===9 && reincarnated.inheritedUniques.length===1 && reincarnated.fusionHistory.length===1);

const legacyNormalForDiagnosis={...oldNormal,distAptPoints:4,bondXp:300,rebirthCount:1,reincarnateCount:1,reincarnateBonusPoints:5};
const legacyNormalSnapshot=snapshot(legacyNormalForDiagnosis);
const legacyNormalDiagnosis=api.diagnoseMasuBaselineMigration(legacyNormalForDiagnosis);
check('旧通常個体は最新ベースとの差から距離適性候補を計算できる', legacyNormalDiagnosis.status==='ESTIMATED' && snapshot(legacyNormalDiagnosis.proposed.distAptBoosts)===snapshot([0,2,0,0]));
check('生成時ベース不明ならポイントを断定せずSAFEにしない', legacyNormalDiagnosis.checks.pointsPreserved===false);
check('仮想候補で4能力・4距離適性・総合力を維持する', legacyNormalDiagnosis.checks.statsPreserved && legacyNormalDiagnosis.checks.aptitudePreserved && legacyNormalDiagnosis.checks.powerPreserved);
check('診断は入力オブジェクトを変更しない', snapshot(legacyNormalForDiagnosis)===legacyNormalSnapshot);
const legacyRegenDiagnosis=api.diagnoseMasuBaselineMigration({...oldRegen,distAptPoints:2});
check('旧再生個体は完成値からoffset候補を計算するがSAFEにしない', legacyRegenDiagnosis.status==='ESTIMATED' && snapshot(legacyRegenDiagnosis.proposed.individualStatOffsets)===snapshot({hp:-7,atk:4,def:-3,guts:2}));
check('旧再生個体の候補でも完成4能力と総合力を維持する', legacyRegenDiagnosis.checks.statsPreserved && legacyRegenDiagnosis.checks.powerPreserved);
const malformedDiagnosis=api.diagnoseMasuBaselineMigration({...oldNormal,distApt:['B','S','C','D']});
check('最新ベースより低い旧適性はBLOCKED', malformedDiagnosis.status==='BLOCKED');
check('不正等級・配列欠損・4距離でない適性はBLOCKED', [null,['A','B','C'],['A','B','C','X']].every(distApt=>api.diagnoseMasuBaselineMigration({...oldNormal,distApt}).status==='BLOCKED'));
const inconsistentNew=api.diagnoseMasuBaselineMigration({...newNormal,distApt:['M','B','C','D'],distAptPoints:0});
check('新形式でも旧フィールドと不一致ならBLOCKED', inconsistentNew.status==='BLOCKED');
const summary=api.diagnoseMasuBaselineMigrationList([{...regenerated,distAptPoints:5},legacyNormalForDiagnosis,{...oldNormal,distApt:['B','S','C','D']}]);
check('全個体ドライランは3分類を集計する', snapshot(summary.counts)===snapshot({SAFE:1,ESTIMATED:1,BLOCKED:1}) && summary.results.length===3);
check('診断ロジックにmh_masu_mons書込みが無い', !slice('const diagnoseMasuBaselineMigration =', '// 一覧・詳細で出す桁区切りの表記').includes('localStorage') && !slice('const diagnoseMasuBaselineMigration =', '// 一覧・詳細で出す桁区切りの表記').includes('mh_masu_mons'));

const beforeOld=stats(api.mergeMasuIntoMon(oldRegen));
base.baseHp=120; base.baseAtk=60; base.baseDef=90; base.baseGuts=45; base.distAptitude=['S','C','B','SS+'];
check('旧形式はベース変更後も保存済み完成値を維持', snapshot(stats(api.mergeMasuIntoMon(oldRegen)))===snapshot(beforeOld) && snapshot(api.mergeMasuIntoMon(oldNormal).distAptitude)===snapshot(oldNormal.distApt));
check('新形式だけ能力差分と適性boostを維持して追従', snapshot(stats(api.mergeMasuIntoMon(regenerated)))===snapshot([125,57,96,42]) && snapshot(api.mergeMasuIntoMon(enhanced1).distAptitude)===snapshot(['S','B','B','SS+']));
check('追従後も適性はMを超えない', api.mergeMasuIntoMon({...newNormal,distAptBoosts:[99,99,99,99]}).distAptitude.every(g=>g==='M'));
console.log('\nすべてOK');
