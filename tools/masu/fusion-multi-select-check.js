const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../../monster-hero/src/game-system.jsx'), 'utf8');
const required = [
  ["const [fusionSubIds, setFusionSubIds] = useState([])", '複数副の選択状態'],
  ["const [fusionInheritUniqueIds, setFusionInheritUniqueIds] = useState([])", '副ごとの継承選択状態'],
  ['const requestedSubIds = [...fusionSubIds]', '選択順の固定'],
  ['uniqueSubIds.size!==requestedSubIds.length', '重複IDの拒否'],
  ['uniqueSubIds.has(fusionMainId)', '主混入の拒否'],
  ['subs.some(sub=>!sub)', '存在しない副の拒否'],
  ['buildFusionInheritancePlan({ main, subs, selectedSubIds:fusionInheritUniqueIds })', '保存前の継承再計算'],
  ['inheritancePlan.entries.some(entry=>entry.requested&&!entry.eligible)', '保存前の継承条件検証'],
  ['fusionInheritUniqueIds.some(id=>!uniqueSubIds.has(id))', '選択外IDの拒否'],
  ['inheritCount:inheritancePlan.inheritCount', '実継承数による費用計算'],
  ['normalDiamondShortage', 'ダイヤ不足の全体中止'],
  ['for (const [subIndex, sub] of subs.entries())', '選択順での副処理'],
  ['const canInherit = !!inheritancePlan.entries[subIndex]?.inherited', '副ごとの実継承判定'],
  ['nextMain=appendInheritedUnique(nextMain, inheritedUnique, inheritedLevel)', '既存の固有技保存方式'],
  ['inherited:!!inheritedUnique', '副ごとの継承履歴'],
  ['snapshot.filter(m=>!removedIds.has(m.id))', '成功時の全副消費'],
  ['removeMasusFromAllPartySets(requestedSubIds)', '全副の編成解除'],
  ['setFusionInheritUniqueIds([])', '完了後の継承選択解除'],
  ['setFusionStep(\'sub\')', '主を維持して副選択へ戻る'],
  ['継承する固有技数</span>', '実継承数の表示'],
  ['継承対象</span>', '継承対象の表示'],
  ['固有技継承ダイヤ合計</span>', '継承費用合計の表示'],
  ['合体後ダイヤ残高</span>', '合体後残高の表示'],
  ['const preparedMain = withBreakthrough ? { ...main, ...breakthroughPlan.nextMasu } : main', '全副処理前の限界突破適用'],
  ['fusionXp:totalGainedXp', '全副合計XPによる突破再計算'],
  ['withBreakthrough && (breakthroughPlan.count < 1 || !breakthroughPlan.canAfford)', '素材・合計ダイヤ不足の全体中止'],
];
const missing = required.filter(([needle]) => !source.includes(needle));
if (missing.length) { console.error(`FAIL: ${missing.map(([, label]) => label).join(' / ')}`); process.exit(1); }
const validationPos = source.indexOf('uniqueSubIds.size!==requestedSubIds.length');
const savePos = source.indexOf("storeSet('mh_masu_mons'", validationPos);
const shortagePos = source.indexOf('diamondSummary.normalDiamondShortage', validationPos);
if (validationPos < 0 || shortagePos < validationPos || savePos < shortagePos) { console.error('FAIL: 全件・費用検証が保存処理より前にありません'); process.exit(1); }
if (source.includes('requestedSubIds.length>1 && (withBreakthrough || fusionInheritUnique)')) { console.error('FAIL: 複数副の固有技継承を禁止する旧ガードが残っています'); process.exit(1); }
if (source.includes('requestedSubIds.length>1 && withBreakthrough')) { console.error('FAIL: 複数副の限界突破合体を禁止するガードが残っています'); process.exit(1); }
if (source.includes('selectedSubs.length===1&&breakthroughPlan.count>0')) { console.error('FAIL: 複数副で限界突破の予定または実行ボタンが隠れています'); process.exit(1); }
console.log('OK: 複数副の限界突破・固有技個別選択・実継承数課金・全件事前検証・履歴・全副消費・選択解除');
