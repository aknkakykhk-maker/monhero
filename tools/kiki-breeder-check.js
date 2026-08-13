#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const breederSource = fs.readFileSync('monster-hero/data/breeder.js','utf8');
const gameSource = fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
assert(breederSource.includes(`kiki: ["ききの応援", "ききの本気", "ききの全力全開"]`));
assert(breederSource.includes(`id:'kiki',    baseName:"ききの応援"`));
assert(breederSource.includes(`subType:'buff_kiki'`));
assert(breederSource.includes(`evoLevel:0, guts:20`));
const starter=breederSource.match(/const STARTER_TEACHING_IDS = \[([^\n]+)\]/)[1];
assert(!starter.includes('kiki') && starter.split(',').length===6, '初期6人を維持し、ききを含めない');
assert(breederSource.includes(`id:'kiki', name:"ブリーダーカード「きき」", type:'breeder', icon:KIKI_FACE_ICON, cost:1500`));
assert(breederSource.includes(`images/breeder-icons/kiki.PNG?v=35362d7b6e3e`));
[
  "getPermaBuff('globalComboDmgPct')",
  "addPermaBuff('globalComboDmgPct',comboAdd)",
  "skillName:'全体連撃'",
  "全体連撃 +{Math.round(getPermaBuff('globalComboDmgPct')*100)}%",
  "kikiCardBonusTurns",
  'heroCardBonus + kikiCardBonus',
  "prev.length >= STARTER_TEACHING_IDS.length",
  "getAttackPredictedDmg(card,slots[slotIdx],baseDmg)",
].forEach(text=>assert(gameSource.includes(text),`実装結線が不足: ${text}`));
assert(gameSource.includes("total += extraHit(getPermaBuff('globalComboDmgPct'))"),'共通予測に全体連撃を含める');
assert(gameSource.includes("kiki: { transform:'translate(0%, 19%) scale(2.37)'"),'ききのブリーダーカードだけをプロフィールと同じ顔寄りの構図にする');
assert(gameSource.includes('BREEDER_CARD_ICON_STYLES[cardId]'),'画像パスではなくブリーダーカードIDで専用表示を適用する');
assert(gameSource.includes('cardIconNode(t.icon,40,t.id)'),'編成画面のカード一覧へ専用表示を適用する');
assert(gameSource.includes('cardIconNode(c.icon,32,c.id)'),'バトル中のカードへ専用表示を適用する');
assert(gameSource.includes("0.3+comboDmgBonus")&&gameSource.includes("0.2+comboDmgBonus"),'ザン既存補正を維持する');
assert(!/globalComboDmgPct[^\n]*comboDmgPct|comboDmgPct[^\n]*globalComboDmgPct/.test(gameSource),'ザン補正と全体連撃を混ぜない');
console.log('kiki breeder check: OK');
