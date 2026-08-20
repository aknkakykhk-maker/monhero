#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? 'OK' : 'NG'}: ${name}`);
  if (!condition) process.exitCode = 1;
};

const card = source.slice(
  source.indexOf("data-extreme-difficulty-card={setting.id}"),
  source.indexOf("data-extreme-difficulty-card={setting.id}") + 7000,
);
const ultimateRules = source.slice(
  source.indexOf("if (difficultyId===ULTIMATE_SETTING.id) return ["),
  source.indexOf("if (difficultyId===ULTIMATE_SETTING.id) return [") + 500,
);

check('極限難易度カードの外寸は382pxのまま', card.includes('h-[382px]'));
check('ULTIMATE説明は専用要約を固定高へ収める',
  source.includes("cardDescription:'累計ターンで敵が強化され、味方側の各効果が低下。35TごとにDISTANCE BREAKが進行する最高難度。'")
  && card.includes("setting.id==='ULTIMATE'?'mt-1 h-[32px] shrink-0':'mt-1 min-h-[35px]'")
  && card.includes('{setting.cardDescription||setting.description}'));
check('ULTIMATE特殊ルール欄へ説明後の余白と62pxの高さを確保する',
  card.includes("setting.id==='ULTIMATE'?'mt-1.5 h-[62px]':'mt-1 h-[51px]'")
  && card.includes('overflow-hidden'));
check('ULTIMATEルールは8px以上で読みやすく表示する',
  card.includes("setting.id==='ULTIMATE'?'text-[8px] leading-[9px]':'text-[9px] leading-[10px]'"));
check('重要な増減率・停止値・DISTANCE BREAK間隔を表示する',
  ['累計Tごと+0.75%', '累計Tごと-0.75pt', '経過Tごと-0.75pt（25%で停止）', 'WAVE Tごと-0.75pt', '35Tごと1距離の弱体Lv上昇']
    .every(text => ultimateRules.includes(text)));
check('曖昧な下限表現とBREAKの強化表現を使わない',
  !ultimateRules.includes('最低25%') && !ultimateRules.includes('Lv強化'));
check('クイックULTIMATEの特殊ルール表示は従来どおり開始案内を使う',
  source.includes('quick&&hasExtremeSpecialRules(key)')
  && source.includes('specialDifficulty===ULTIMATE_SETTING.id'));

if (!process.exitCode) console.log('\nultimate card layout checks passed');
