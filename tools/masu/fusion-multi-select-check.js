const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../../monster-hero/src/game-system.jsx'), 'utf8');
const required = [
  ["const [fusionSubIds, setFusionSubIds] = useState([])", '複数副の選択状態'],
  ['const requestedSubIds = [...fusionSubIds]', '選択順の固定'],
  ['uniqueSubIds.size!==requestedSubIds.length', '重複IDの拒否'],
  ['uniqueSubIds.has(fusionMainId)', '主混入の拒否'],
  ['subs.some(sub=>!sub)', '存在しない副の拒否'],
  ['for (const sub of subs)', '選択順での副処理'],
  ['applyBondXpGain(nextMain, gainedXp)', '既存XP計算の反復利用'],
  ['transferableReincarnateBonus(sub)', '副ごとの転生由来ポイント'],
  ['fusionHistory: [...(nextMain.fusionHistory || []),', '副ごとの合体履歴'],
  ['snapshot.filter(m=>!removedIds.has(m.id))', '全副の消費'],
  ['removeMasusFromAllPartySets(requestedSubIds)', '全副の編成解除'],
  ['setFusionSubIds([])', '完了後の副選択解除'],
  ['副の数</span>', '確認画面の副数'],
  ['合計獲得予定XP</span>', '確認画面の合計XP'],
  ['実際に入るXP</span>', '確認画面の実加算XP'],
  ['失われるXP</span>', '確認画面の喪失XP'],
  ['合体後予定Lv</span>', '確認画面の予定Lv'],
  ['d.subCount>1?`副${d.subCount}体を合体し、`', '複数合体の結果表示'],
  ['requestedSubIds.length>1 && (withBreakthrough || fusionInheritUnique)', '複数副の対象外機能ガード'],
];
const missing = required.filter(([needle]) => !source.includes(needle));
if (missing.length) {
  console.error(`FAIL: ${missing.map(([, label]) => label).join(' / ')}`);
  process.exit(1);
}
const validationPos = source.indexOf('uniqueSubIds.size!==requestedSubIds.length');
const savePos = source.indexOf("storeSet('mh_masu_mons'", validationPos);
if (validationPos < 0 || savePos < validationPos) {
  console.error('FAIL: 全件検証が保存処理より前にありません');
  process.exit(1);
}
console.log('OK: 複数副の通常合体・全件事前検証・XP/転生ポイント/履歴・全副消費/編成解除・対象外機能ガード');
