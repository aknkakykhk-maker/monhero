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
assert(breederSource.includes(`id:'kiki', name:"アシストカード「きき」", type:'assist', icon:KIKI_FACE_ICON, cost:1500`));
assert(breederSource.includes(`images/breeder-icons/kiki.PNG?v=35362d7b6e3e`));
// ききのカード上限+1は、その+1ぶんをどのモンスターへ重ねて使ってもよい
// (以前はハムの連続攻撃だけが同じスロットへの複数割当を許していて、
//  ききの+1は「違うモンスターにしか使えない」状態になっていた)
assert(gameSource.includes("const slotMaxUses = (mon) => ((mainHero?.id==='Ham'&&mon?.id==='Ham')||kikiCardBonus>0) ? cardLimit : 1;"),
  'ききのカード上限+1が同じモンスターへ重ねて使えない(slotMaxUsesが古いまま)');
assert((gameSource.match(/=slotMaxUses\((?:targetMon|s)\);/g)||[]).length===3,
  'カード割当のチェック箇所(ドラッグ・予測・スロット表示)がslotMaxUsesに揃っていない');
// カードをタップしたときの説明文(getDynamicDesc)も、バランス調整後の継続ターン数と一致していること
assert(gameSource.includes("if(t.id==='kiki') return `次の${level+2}ターン 使用可能カード枚数 +1・全体連撃 ${3+level*2}%アップ（バトル中永続・使用ごとに加算）`;"),
  'ききのカード説明(getDynamicDesc)が継続ターン数の変更に追随していない');
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
assert(gameSource.includes('const KIKI_FACE_ICON_ADJUSTMENT = Object.freeze({ scale:2.37, x:0, y:19 })'),'ききの顔寄り調整値を1か所で定義する');
assert(gameSource.includes('kiki: KIKI_FACE_ICON_ADJUSTMENT')&&gameSource.includes('kiki_icon: KIKI_FACE_ICON_ADJUSTMENT'),'アシストカードと既存プロフィール用設定で同じ調整値を再利用する');
assert(gameSource.includes('ASSIST_CARD_ICON_STYLES[cardId]'),'画像パスではなくアシストカードIDで専用表示を適用する');
assert(gameSource.includes("item.type==='assist'&&ASSIST_CARD_ICON_STYLES[item.id]?<AssistCardIcon"),'マーケット一覧と拡大表示へアシストカード専用表示を適用する');
assert((gameSource.match(/item\.type==='assist'&&ASSIST_CARD_ICON_STYLES\[item\.id\]\?<AssistCardIcon/g)||[]).length===2,'マーケット一覧と拡大表示の両方へ適用する');
assert(gameSource.includes('cardIconNode(t.icon,40,t.id)'),'編成画面のカード一覧へ専用表示を適用する');
assert(gameSource.includes('cardIconNode(c.icon,32,c.id)'),'バトル中のカードへ専用表示を適用する');
assert(gameSource.includes("0.3+comboDmgBonus")&&gameSource.includes("0.2+comboDmgBonus"),'ザン既存補正を維持する');
assert(!/globalComboDmgPct[^\n]*comboDmgPct|comboDmgPct[^\n]*globalComboDmgPct/.test(gameSource),'ザン補正と全体連撃を混ぜない');
console.log('kiki assist check: OK');
