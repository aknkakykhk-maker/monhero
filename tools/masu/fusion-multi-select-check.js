const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../../monster-hero/src/game-system.jsx'), 'utf8');
const required = [
  ["const [fusionSubIds, setFusionSubIds] = useState([])", '複数副の選択状態'],
  ['fusionSubIds.length !== 1 || fusionSubIds[0] !== fusionSubId', '単体実処理の多重選択ガード'],
  ['setFusionSubIds(prev => prev.includes(id)', '選択ON/OFF'],
  ['masuMons.filter(m=>m.id!==fusionMainId)', '主自身の候補除外'],
  ['selectedSubs.reduce((sum, sub)=>sum+cappedBondXp(sub), 0)', '副XPの合計'],
  ['const plannedXp = cappedBondXp(main, totalSubXp)', '主へ加算した予定XP'],
  ['selectedSubs.length !== 1', '複数選択時の確認遷移停止'],
  ['副 <span className="text-violet-300">{selectedSubs.length}体</span>選択中', '選択数表示'],
  ['aria-pressed={selected}', '選択状態のアクセシビリティ'],
  ['setFusionSubIds([])', '画面遷移時の選択解除'],
];

const missing = required.filter(([needle]) => !source.includes(needle));
if (missing.length) {
  console.error(`FAIL: ${missing.map(([, label]) => label).join(' / ')}`);
  process.exit(1);
}

const guardPos = source.indexOf('fusionSubIds.length !== 1 || fusionSubIds[0] !== fusionSubId');
const firstSavePos = source.indexOf("storeSet('mh_masu_mons'", guardPos);
if (guardPos < 0 || firstSavePos < guardPos) {
  console.error('FAIL: 複数選択ガードが保存処理より前にありません');
  process.exit(1);
}

console.log('OK: 複数副の状態管理・集計プレビュー・単体実処理ガード・選択リセット');
