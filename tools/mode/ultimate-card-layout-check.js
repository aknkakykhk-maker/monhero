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
check('特殊ルール欄の外寸は51pxのまま', card.includes('h-[51px]'));
check('ULTIMATEだけを2列にして内容を枠内で隠さない',
  card.includes("setting.id==='ULTIMATE'?'grid grid-cols-2 gap-x-2':'block'")
  && card.includes("index===2?'col-span-2':''")
  && card.includes('overflow-hidden'));
check('重要な低下率・最低値・DISTANCE BREAK間隔を表示する',
  ['累計T×0.75%', '経過累計T×0.75%（最低25%）', 'WAVE T×0.75%', '35TごとLv強化（3距離）']
    .every(text => ultimateRules.includes(text)));
check('クイックULTIMATEの特殊ルール表示は従来どおり開始案内を使う',
  source.includes('quick&&hasExtremeSpecialRules(key)')
  && source.includes('specialDifficulty===ULTIMATE_SETTING.id'));

if (!process.exitCode) console.log('\nultimate card layout checks passed');
