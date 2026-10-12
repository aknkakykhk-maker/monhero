#!/usr/bin/env node
// バトルの「マーク×数」(2026-10-12 社長の依頼「スタックがいくら貯まってるのか一目でわかるように」)の作りを見張る。
//
//   node tools/battle/stack-marks-check.js
//
// 実際に貯めて数が合うかは monster/melody-kuromy-browser-check.js、置き場所の静止画は docs/proto/stack-marks/。ここは作りの約束を見る。
//   ① 絵柄は BATTLE_STACK_MARKS の1か所(mark=絵文字・img=差し替え用の画像パス)。味方6種+敵3種がそろっている
//   ② 味方の枠(タクティクス・ほかのモード)・敵のライフの帯・超省エネの両方に出している(画面の直し忘れを防ぐ)
//   ③ 数の出どころが強化の札・敵の状態と同じ(クッキー・黒音符・旋律・トリック・運命・連撃パワー / 水牢・氷結・咆哮)
//   ④ 静止画用の差し込み口は自動操作のブラウザ(navigator.webdriver)のときだけ作る
//   ⑤ 残りターン(EX・⏳nT)・残り回数(完全回避👻・根性🔥・EX×数)も同じ作りで出す(2026-10-12 社長の追加依頼)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const entries = read('monster-hero/src/parts/22-enemy-and-bond-entries.jsx');
const start = entries.indexOf('const BATTLE_STACK_MARKS = Object.freeze({');
const end = entries.indexOf('.filter((it) => it.count > 0 || it.showZero);', start);
check('① 絵柄の表 BATTLE_STACK_MARKS と並べる関数がある', start >= 0 && end > start);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(entries.slice(start, end + '.filter((it) => it.count > 0 || it.showZero);'.length) + '\nthis.T = BATTLE_STACK_MARKS; this.items = battleStackMarkItems;', ctx);
const want = ['cookie', 'note', 'bow', 'kenshi', 'trickAtk', 'trickDef', 'trickRegen', 'fateCombo', 'fateAtk', 'exTurns', 'avoid', 'konjo', 'aquaPrison', 'aquaFreeze', 'roar'];
check('① 味方6種(9つ)+残りターン・回数3つ+敵3種のマークがそろっている', want.every((k) => ctx.T[k] && typeof ctx.T[k].mark === 'string' && ctx.T[k].mark && typeof ctx.T[k].img === 'string' && ctx.T[k].label), want.filter((k) => !ctx.T[k]).join(','));
check('① 水牢は水滴・氷結は氷の結晶(社長の例のとおり)', ctx.T.aquaPrison.mark === '💧' && ctx.T.aquaFreeze.mark === '❄️');
const it = ctx.items({ cookie: 0, note: 3, bow: 0, roar: 2, unknown: 5 });
check('① クッキー・黒音符は0でも出し、ほかの0と知らない種類は出さない', JSON.stringify(it.map((x) => `${x.kind}${x.count}`)) === JSON.stringify(['cookie0', 'note3', 'roar2']), JSON.stringify(it.map((x) => `${x.kind}${x.count}`)));

const battle = read('monster-hero/src/parts/71-screen-battle.jsx');
check('② 部品 BattleStackMarks がある(img があれば絵、なければ絵文字)', /const BattleStackMarks = /.test(battle) && /it\.img \? <img src=\{it\.img\}/.test(battle));
check('② 味方の枠に出している(タクティクスとほかのモードで置き場所を分ける)', /<BattleStackMarks counts=\{allyStackCounts\[i\]\} side="ally"[^>]*tacticsNewLayout\?'mh-stack-marks-ally':'mh-stack-marks-ally mh-stack-marks-ally-top'/.test(battle));
check('② 敵はライフの帯に出している(通常と超省エネの2か所)', (battle.match(/<BattleStackMarks counts=\{enemyStackCounts\} side="enemy"/g) || []).length === 2);
check('② 超省エネの味方の欄にも出している', /data-ultra-ally-slots[\s\S]{0,700}<BattleStackMarks counts=\{allyStackCounts\[i\]\}/.test(battle));
check('③ 味方の数は強化の札と同じ出どころから作る', ['sweetStackView', 'bowStackView', 'trickStartView', "getPermaBuff('fateStacks', null)", "getPermaBuff('kenshiComboPower')"].every((w) => battle.slice(battle.indexOf('const allyStackCounts = (() => {'), battle.indexOf('const allyStackCounts = (() => {') + 3000).includes(w)));
const app = read('monster-hero/src/parts/60-app.jsx');
const ec = app.slice(app.indexOf('const enemyStackCounts = (() => {'), app.indexOf('const enemyStackCounts = (() => {') + 900);
check('③ 敵の数は敵の状態と同じ出どころ(アクアフィールド・咆哮)から作る', /tacticsExAquaOf\(/.test(ec) && /aq\.route === 'prison'/.test(ec) && /aq\.route === 'freeze'/.test(ec) && /enemy\.roarStacks/.test(ec));
check('④ 静止画用の差し込み口は navigator.webdriver のときだけ作る', /navigator\.webdriver !== true\) return undefined;\s*\n[^\n]*\n\s*window\.__mhStackMarksDebug = /.test(app));
check('⑤ 残りターンは「nT」で出し、1になったら data-stack-last で目立たせる', ctx.T.exTurns.unit === 'T' && /it\.unit === 'T' \? `\$\{it\.count\}T`/.test(battle) && /data-stack-last=\{it\.unit === 'T' && it\.count === 1/.test(battle));
const sc = app.slice(app.indexOf('const tacticsSlotCountersAt = (slotIdx) => {'), app.indexOf('const tacticsSlotCountersAt = (slotIdx) => {') + 1200);
check('⑤ EXの残りターン・完全回避・根性の残りを、詳細と同じ関数から作る', /tacticsExRemainOf\(/.test(sc) && /tacticsExAvoidLeftOf\(/.test(sc) && /tacticsExKonjoLeftOf\(/.test(sc) && /tacticsSlotCountersAt\(i\)/.test(battle));
check('⑤ 使っていないEXの札に、残り回数(EX×数)を出す', /uses:Number\.isFinite\(remaining\.left\)\?remaining\.left:null/.test(app) && (battle.match(/slotExInfo\.badge\.uses!=null\?`×\$\{slotExInfo\.badge\.uses\}`/g) || []).length === 2);
check('⑤ 敵の水牢・氷結にも、名前の横の札に残りターンを出す', /add\('aquaPrison'[^\n]*`\$\{aquaNow\.turnsLeft\}T`\);/.test(app) && /add\('aquaFreeze'[^\n]*`\$\{aquaNow\.turnsLeft\}T`\);/.test(app));
const html = read('monster-hero/index.html');
check('見た目のCSS(.mh-stack-mark)がある', /\.mh-stack-mark \{/.test(html) && /\.mh-stack-marks-ally-top \{/.test(html));

if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
console.log('\nすべてOK');
