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
//   ⑥ モンスターごとの演出(ゴースト・スネグーラチカ・剣士モッチー)は BATTLE_MONSTER_FX の1か所。タクティクスの枠だけ・軽量表示では出さない・止める設定で止める
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
const end = entries.indexOf('.filter((it) => it.count > 0);', start);
check('① 絵柄の表 BATTLE_STACK_MARKS と並べる関数がある', start >= 0 && end > start);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(entries.slice(start, end + '.filter((it) => it.count > 0);'.length) + '\nthis.T = BATTLE_STACK_MARKS; this.items = battleStackMarkItems;', ctx);
const want = ['cookie', 'note', 'bow', 'kenshi', 'trickAtk', 'trickDef', 'trickRegen', 'fateCombo', 'fateAtk', 'exTurns', 'avoid', 'konjo', 'aquaPrison', 'aquaFreeze', 'roar'];
check('① 味方6種(9つ)+残りターン・回数3つ+敵3種のマークがそろっている', want.every((k) => ctx.T[k] && typeof ctx.T[k].mark === 'string' && ctx.T[k].mark && typeof ctx.T[k].img === 'string' && ctx.T[k].label), want.filter((k) => !ctx.T[k]).join(','));
check('① 水牢は水滴・氷結は氷の結晶(社長の例のとおり)', ctx.T.aquaPrison.mark === '💧' && ctx.T.aquaFreeze.mark === '❄️');
const it = ctx.items({ cookie: 0, note: 3, bow: 0, roar: 2, unknown: 5 });
// ★2026-10-13 社長の決定: クッキー・黒音符も0なら出さない(もとは「×0」で出していた)
check('① 0のもの(クッキー・黒音符も)と知らない種類は出さない', JSON.stringify(it.map((x) => `${x.kind}${x.count}`)) === JSON.stringify(['note3', 'roar2']), JSON.stringify(it.map((x) => `${x.kind}${x.count}`)));

const battle = read('monster-hero/src/parts/71-screen-battle.jsx');
check('② 部品 BattleStackMarks がある(img があれば絵、なければ絵文字)', /const BattleStackMarks = /.test(battle) && /it\.img \? <img src=\{it\.img\}/.test(battle));
// ★2026-10-13: クラシックなど縦長の枠は、予測ダメージ・置いたカードと同じ縦積みの欄(data-tactics-slot-marks)の先頭へ移した
//   (社長「極限チャレンジ/GOD で 💥×1 が予測ダメージと重なる」)。重ならないことは stack-marks-overlap-browser-check.js が幅4種で測る
check('② 味方の枠に出している(タクティクスは絵の左下・ほかのモードは縦積みの欄の先頭)',
  // ★2026-10-29: タクティクス/レイドでは EX の効果の札(ExEffectChips・溜まる物も同じ札)にまとめた。ほかの遊びは今までどおり BattleStackMarks
  /\{tacticsNewLayout&&!slotExEffects&&<BattleStackMarks counts=\{allyStackCounts\[i\]\} side="ally"[^>]*className="mh-stack-marks-ally"\/>\}/.test(battle)
  && /\{!tacticsNewLayout&&!slotExEffects&&<BattleStackMarks counts=\{allyStackCounts\[i\]\} side="ally"[^>]*className="mh-stack-marks-flow"\/>\}/.test(battle)
  && /\{tacticsNewLayout&&slotExEffects&&<ExEffectChips items=\{slotExEffects\}/.test(battle));
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
check('⑥ 連撃パワーのマークは 💥(二刀流の演出 ⚔️ と分ける)', ctx.T.kenshi.mark === '💥');
check('⑥ 演出の表 BATTLE_MONSTER_FX(分身・プレゼント・剣の型)が1か所にある', /const BATTLE_MONSTER_FX = Object\.freeze\(\{[\s\S]{0,1200}avoidClone[\s\S]{0,800}present[\s\S]{0,800}swordStyle: Object\.freeze\(\{ sword:'🗡️', shield:'🗡️🛡️', dual:'⚔️' \}\)/.test(entries));
check('⑥ 演出はタクティクスの枠だけ・軽量表示と超省エネでは出さない・「待機中の動き：止める」で止める', /tacticsNewLayout&&!ecoBattleView&&!liteBattleView&&typeof tacticsSlotCountersAt==='function'&&<BattleMonsterFx /.test(battle) && /calm=\{battleFx\.idleMotion==='OFF'\}/.test(battle) && !/data-ultra-battle-view[\s\S]{0,4000}<BattleMonsterFx/.test(battle.slice(battle.indexOf('data-ultra-battle-view'), battle.indexOf('data-ultra-battle-view') + 4000)));
check('⑥ 分身の数は完全回避の残りから、プレゼントと型は詳細と同じ関数から作る', /if\(def&&def\.effect==='present'&&isTacticsExEffectActive\(/.test(sc + app.slice(app.indexOf('const tacticsSlotCountersAt'), app.indexOf('const tacticsSlotCountersAt') + 2000)) && /out\.swordStyle=tacticsExStyleOf\(/.test(app) && /const n = \(v, max\) => Math\.min\(max, Math\.max\(0, Math\.floor\(Number\(v\) \|\| 0\)\)\);\s*\n\s*const clones = n\(fx\.avoid, T\.avoidClone\.max\);/.test(battle));
check('⑦ 区切り2: モッチー・ミタラシのオーラ・ハムのグローブ・ミーアのスポットライト・ザンの残像・ライガーの雷が表にある', /aura: Object\.freeze\(\{[\s\S]{0,200}Mocchi:[\s\S]{0,120}Mitarashi:/.test(entries) && /glove: Object\.freeze\(\{ mark:'🥊', max:3 \}\)/.test(entries) && /spotlight: Object\.freeze/.test(entries) && /afterimage: Object\.freeze/.test(entries) && /thunder: Object\.freeze\(\{ mark:'⚡'/.test(entries));
check('⑦ 区切り2の中身は、効いているEXの種類と詳細と同じ関数(カウンター・ボルテージ・雷)から作る', /const eff=tacticsExActiveEffect\(tacticsExState,slotIdx,unit\.id,tacticsExNow\);/.test(app) && /tacticsExCounterOf\(tacticsExState/.test(app) && /tacticsExVoltageOf\(tacticsExState/.test(app) && /tacticsExThunderOf\(tacticsExState/.test(app) && /monId=\{s\?\.id\}/.test(battle));
check('⑧ 区切り3: エイキ・ピクシー・イブリース・アーク・メルホイップの演出と、ユグドラシルの葉っぱの盾が表にある', /scatter: Object\.freeze\(\{[\s\S]{0,200}Eiki:[\s\S]{0,200}Pixie:[\s\S]{0,200}Iblis:[\s\S]{0,200}Ark:[\s\S]{0,200}MelWhip:/.test(entries) && /leafShield: Object\.freeze\(\{ mark:'🍃', max:3 \}\)/.test(entries));
check('⑧ 世界樹の守りは、だれが使っても味方全員の枠へ残りターンを渡す', /!=='partyGuard'\) continue;[\s\S]{0,240}out\.leafShield=Math\.max\(/.test(app));
check('⑨ 区切り4: スエゾー・ゴーレム・オボロゲソウ・ヤオビクニの演出と、モノリスの盾の膜・プラントの若葉が表にある', /overlay: Object\.freeze\(\{[\s\S]{0,200}Suezo:[\s\S]{0,200}Golem:[\s\S]{0,200}Oboro:[\s\S]{0,200}Yaobikuni:/.test(entries) && /coverFilm: Object\.freeze/.test(entries) && /sprout: Object\.freeze\(\{ mark:'🌱', n:3 \}\)/.test(entries));
check('⑨ かばう膜はモノリス以外の味方の枠へ、若葉は味方全員の枠へ', /const coverSlot=tacticsExCoverSlot\([^\n]*\);\s*\n\s*if\(coverSlot!=null&&coverSlot!==slotIdx\) out\.coverFilm=true;/.test(app) && /==='partyBoost'\)\) out\.sprout=true;/.test(app));
check('⑩ 区切り5: パンドラの箱・ウンディーネの水の輪・メロディーのクッキー・クロミーの五線・スプーキーのコインが表にある', /pandoraBox: Object\.freeze/.test(entries) && /springRing: Object\.freeze/.test(entries) && /cookiePile: Object\.freeze/.test(entries) && /noteStaff: Object\.freeze/.test(entries) && /coinSpin: Object\.freeze/.test(entries));
check('⑩ メロディー・クロミー・スプーキーは枠の「マーク×数」と同じ数から作り、水の輪は生命の泉の対象の子の枠へ', /stacks=\{allyStackCounts\[i\]\}/.test(battle) && /==='lifeSpring'&&effs\?\.\[j\]\?\.target===slotIdx\)\) out\.springRing=true;/.test(app));
const html = read('monster-hero/index.html');
check('見た目のCSS(.mh-stack-mark)がある', /\.mh-stack-mark \{/.test(html) && /\.mh-stack-marks-flow \{/.test(html) && /\.mh-stack-marks\[data-stack-many="true"\] \.mh-stack-mark \{/.test(html));

if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
console.log('\nすべてOK');
