#!/usr/bin/env node
// イルミネ・ドリーミィの「効き目」を見張る(2026-10-22 社長の決定。いまは案の段階・公開はきゅうこのお話と同時)。
//
//   node tools/monster/illumine-dreamy-effects-check.js
//
// 説明文(traitDesc・effectDesc)を書いただけでは何も起きず、効き目は本体の分岐が作る。
// どれか1か所書き忘れても画面はふつうに動いてしまうので、ここで1本ずつ確かめる。
//   ① 登録(能力値・供モン加算・間合い・固有技・技名・タイプ・モンビーの能力)
//   ② 楔の決めごと(上限6・連撃15%×数・回避+15%×数・セレーネチェイサー・ドリームペイン)を純関数で計算する
//   ③ 本体の分岐(楔を付ける・連撃・回避率・回避で0・WAVEで0・固有技の効果・被ダメージ・ターンの進み・敵のマーク)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let failed = 0;
const check = (label, ok, note = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${label}${note ? ` — ${note}` : ''}`); };
const near = (a, b) => Math.abs(a - b) < 1e-9;

const allies = read('monster-hero/data/ally-monsters.js');
const rhythm = read('monster-hero/data/rhythm-mode.js');
const bond = read('monster-hero/src/parts/22-enemy-and-bond-entries.jsx');
const tactics = read('monster-hero/src/parts/32-tactics-units.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');

// ---------- ① 登録 ----------
const sd = {};
vm.createContext(sd);
vm.runInContext(`${allies.replace(/\b[A-Z_]+_(IMG|ICON|FACE_ICON)\b/g, "'img'")}\nglobalThis.M=ALL_PLAYER_MONSTERS;globalThis.N=HERO_ATK_NAMES;globalThis.D=UPCOMING_MONSTER_DRAFTS;`, sd);
const { M, N, D } = sd;
// 公開まではどちらか一方にいればよい(案の段階 → 公開で ALL_PLAYER_MONSTERS へ移る)
const I = M.Illumine || D.Illumine, R = M.Dreamy || D.Dreamy;
check('2体がいる(案の段階か本体)', !!I && !!R);
check('能力値が社長の決定(イルミネ 330/120/130/50・ドリーミィ 360/130/115/60)',
  I && I.baseHp === 330 && I.baseGuts === 120 && I.baseAtk === 130 && I.baseDef === 50
  && R && R.baseHp === 360 && R.baseGuts === 130 && R.baseAtk === 115 && R.baseDef === 60);
check('供モン加算と間合い適性', JSON.stringify(I?.plusStats) === '{"hp":110,"atk":40,"def":10,"guts":40}'
  && JSON.stringify(R?.plusStats) === '{"hp":120,"atk":35,"def":15,"guts":40}'
  && I?.distAptitude.join('') === 'BCAE' && R?.distAptitude.join('') === 'BDDA');
check('固有技(イルミネ ×2.3・消費46 / ドリーミィ ×2.6・消費52)と9段階の名前',
  I?.unique?.baseMult === 2.3 && I?.unique?.baseGuts === 46 && I?.unique?.monId === 'Illumine' && I?.unique?.names?.length === 9
  && R?.unique?.baseMult === 2.6 && R?.unique?.baseGuts === 52 && R?.unique?.monId === 'Dreamy' && R?.unique?.names?.length === 9
  && R.unique.names[0] === 'おもちゃの爆弾');
check('通常技は9段階ずつ', N.Illumine?.length === 9 && N.Dreamy?.length === 9);
check('勇者特性は2体とも「影潜」', I?.trait === '影潜' && R?.trait === '影潜');
check('タイプ(イルミネ シャドウ/アタッカー・ドリーミィ サポーター/シャドウ)',
  /Illumine: \{ main: 'shadow', sub: 'attacker' \}/.test(tactics) && /Dreamy: \{ main: 'supporter', sub: 'shadow' \}/.test(tactics));
check('モンヒロビートの能力(イルミネ血統=我慢・ドリーミィだけ必死)',
  /illumine:'GAMAN'/.test(rhythm) && /Dreamy:'HISSHI'/.test(rhythm));

// ---------- ② 楔の決めごと(純関数) ----------
const start = bond.indexOf('const KUSABI_TRAIT_MONSTER_IDS');
const end = bond.indexOf('// 楔の効き目の短い文');
check('楔の決めごとを抜き出せる', start > 0 && end > start);
const k = {};
vm.createContext(k);
vm.runInContext(`${bond.slice(start, end)}\nglobalThis.x={KUSABI_MAX,hasKusabiTrait,kusabiCountOf,kusabiComboOf,kusabiEvasionOf,seleneChaserOf,dreamPainTakenOf,startDreamPain,tickDreamPain,dreamPainTakenBonus,withExtraCombos};`, k);
const x = k.x;
check('上限は6', x.KUSABI_MAX === 6 && x.kusabiCountOf(9) === 6 && x.kusabiCountOf(-1) === 0);
check('特性を持つのはイルミネとドリーミィだけ', x.hasKusabiTrait('Illumine') && x.hasKusabiTrait('Dreamy') && !x.hasKusabiTrait('Zan'));
check('楔1つごとに与ダメ15%の連撃が1回(楔0なら無し)', x.kusabiComboOf(0) === null
  && x.kusabiComboOf(3).count === 3 && near(x.kusabiComboOf(3).rate, 0.15));
check('楔1つごとに回避率+15%(6つで+90%)', x.kusabiEvasionOf(1) === 15 && x.kusabiEvasionOf(6) === 90);
const s0 = x.seleneChaserOf(0), s3 = x.seleneChaserOf(3);
check('セレーネチェイサーは(楔+1)倍(楔0で5%×1・+1% / 楔3で5%×4・+4%)',
  s0.combo.count === 1 && near(s0.combo.rate, 0.05) && near(s0.comboDmgAdd, 0.01)
  && s3.combo.count === 4 && near(s3.comboDmgAdd, 0.04));
check('ドリームペインは楔0で+20%、楔3で+80%、楔6で+140%',
  near(x.dreamPainTakenOf(0), 0.2) && near(x.dreamPainTakenOf(3), 0.8) && near(x.dreamPainTakenOf(6), 1.4));
{
  let d = x.startDreamPain(3);
  const seq = [x.dreamPainTakenBonus(d)];
  for (let i = 0; i < 4; i++) { d = x.tickDreamPain(d); seq.push(x.dreamPainTakenBonus(d)); }
  check('ドリームペインは使ったターンは効かず、次のターンから3ターン', JSON.stringify(seq.map(v => Math.round(v * 100))) === '[0,80,80,80,0]',
    JSON.stringify(seq));
}
check('連撃を足すとき null は足さない', JSON.stringify(x.withExtraCombos(null, [null, { count: 1, rate: 0.1 }])) === '[{"count":1,"rate":0.1}]'
  && x.withExtraCombos(null, [null]) === null);

// ---------- ③ 本体の分岐 ----------
check('本人の攻撃が当たったら楔を付ける(通常の攻撃・あつの挑発)',
  /if \(finalD>0\) gainKusabi\(slotIdx,activeMon\?\.id\);/.test(app) && /if\(d>0\) gainKusabi\(slotIdx,stunMon\?\.id\);/.test(app));
check('攻撃のヒット列(予測・あつの挑発・通常の攻撃)の3か所すべてに楔の連撃を足す',
  (app.match(/kusabiCombosAt\(slotIdx,(mon|stunMon|activeMon)\?\.id,card\)/g) || []).length === 3);
check('受ける子が持ち主なら回避率を上げる', /existingEvasion:\(defenseHeroId==='Tiger'\?50:0\)\+kusabiEvasion/.test(app));
check('持ち主が回避したら楔を0へ戻す', /if \(isEvasion && hasKusabiTrait\(defenseHeroId\)[\s\S]{0,200}writeKusabiKey\(kusabiDefenseKey,0\)/.test(app));
check('WAVEが変わると楔とドリームペインを消す(4か所)',
  (app.match(/resetFateWheel\(\); resetEnemyConfuse\(\); resetKusabi\(\); resetDreamPain\(\);/g) || []).length === 4);
check('セレーネチェイサーで連撃ダメージを積む', /card\.monId===SELENE_CHASER_MONSTER_ID\)\{const sc=seleneChaserOf\(kusabiBeforeAttack\); addPermaBuff\('comboDmgPct'/.test(app));
check('ドリームペインをかける', /card\.monId===DREAM_PAIN_MONSTER_ID\)\{const dp=writeDreamPain/.test(app));
check('ドリームペインを敵の被ダメージに足す', /\+dreamPainTakenBonus\(dreamPainRef\.current\)\+/.test(app));
check('ターンが進むとドリームペインを進める', /writeDreamPain\(tickDreamPain\(dreamPainRef\.current\)\)/.test(app));
check('敵の絵の隅に楔とドリームペインのマークを出す', /kusabi: Object\.values\(kusabiView/.test(app) && /dreamPain: dreamPainView\.wait === 0/.test(app)
  && /kusabi:\s+Object\.freeze\(\{ mark:/.test(bond) && /dreamPain:\s+Object\.freeze\(\{ mark:/.test(bond));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
