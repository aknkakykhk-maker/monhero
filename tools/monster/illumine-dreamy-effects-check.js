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
vm.runInContext(`${allies.replace(/\b[A-Z0-9_]+_(IMG|ICON|FACE_ICON)\b/g, "'img'")}\nglobalThis.M=ALL_PLAYER_MONSTERS;globalThis.N=HERO_ATK_NAMES;globalThis.D=UPCOMING_MONSTER_DRAFTS;`, sd);
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
vm.runInContext(`${bond.slice(start, end)}\nglobalThis.x={KUSABI_MAX,KUSABI_MAX_EX,hasKusabiTrait,kusabiCountOf,kusabiComboOf,kusabiEvasionOf,seleneChaserOf,dreamPainTakenOf,startDreamPain,tickDreamPain,dreamPainTakenBonus};`, k);
const x = k.x;
check('上限は6(ジエンドのあいだは12)', x.KUSABI_MAX === 6 && x.KUSABI_MAX_EX === 12 && x.kusabiCountOf(9) === 6 && x.kusabiCountOf(-1) === 0 && x.kusabiCountOf(15, 12) === 12);
check('ジエンドで12個になれば、連撃は12回・回避率+180%', x.kusabiComboOf(12).count === 12 && x.kusabiEvasionOf(12) === 180);
check('特性を持つのはイルミネとドリーミィだけ', x.hasKusabiTrait('Illumine') && x.hasKusabiTrait('Dreamy') && !x.hasKusabiTrait('Zan'));
check('楔1つごとに与ダメ15%の連撃が1回(楔0なら無し)', x.kusabiComboOf(0) === null
  && x.kusabiComboOf(3).count === 3 && near(x.kusabiComboOf(3).rate, 0.15));
check('楔1つごとに回避率+15%(6つで+90%)', x.kusabiEvasionOf(1) === 15 && x.kusabiEvasionOf(6) === 90);
const s0 = x.seleneChaserOf(0), s3 = x.seleneChaserOf(3);
check('セレーネチェイサーは(楔+1)倍(楔0で5%×1・+1% / 楔3で5%×4・+4%)',
  s0.combo.count === 1 && near(s0.combo.rate, 0.05) && near(s0.comboDmgAdd, 0.01)
  && s3.combo.count === 4 && near(s3.comboDmgAdd, 0.04));
check('ドリームペインは楔0で+40%、楔3で+160%、楔6で+280%(2026-10-27 社長「楔1つごとも40%」)',
  near(x.dreamPainTakenOf(0), 0.4) && near(x.dreamPainTakenOf(3), 1.6) && near(x.dreamPainTakenOf(6), 2.8));
{
  let d = x.startDreamPain(3);
  const seq = [x.dreamPainTakenBonus(d)];
  for (let i = 0; i < 4; i++) { d = x.tickDreamPain(d); seq.push(x.dreamPainTakenBonus(d)); }
  check('ドリームペインは使ったターンは効かず、次のターンから3ターン', JSON.stringify(seq.map(v => Math.round(v * 100))) === '[0,160,160,160,0]',
    JSON.stringify(seq));
}
check('黒音符の連撃の入口(withBlackNoteCombo)で楔の連撃も足す', /const withBlackNoteCombo = \(exCombos, combo, extra = null\)/.test(bond));

// ---------- ③ 本体の分岐 ----------
check('本人の攻撃が当たったら楔を付ける(通常の攻撃・あつの挑発)',
  /if \(finalD>0\) gainKusabi\(slotIdx,activeMon\?\.id\);/.test(app) && /if\(d>0\) gainKusabi\(slotIdx,stunMon\?\.id\);/.test(app));
check('攻撃のヒット列(予測・あつの挑発・通常の攻撃)の3か所すべてに楔の連撃を足す',
  (app.match(/kusabiCombosAt\(slotIdx,(mon|stunMon|activeMon)\?\.id,card\)/g) || []).length === 3);
check('受ける子が持ち主なら回避率を上げる', /existingEvasion:\(defenseHeroId==='Tiger'\?50:0\)\+kusabiEvasion/.test(app));
check('持ち主が回避したら楔を0へ戻す', /if \(isEvasion && hasKusabiTrait\(defenseHeroId\)[\s\S]{0,200}writeKusabiKey\(kusabiDefenseKey,0\)/.test(app));
check('WAVEが変わると楔とドリームペインを消す(4か所)',
  (app.match(/resetKusabi\(\); resetDreamPain\(\);/g) || []).length >= 4);
check('セレーネチェイサーで連撃ダメージを積む', /card\.monId===SELENE_CHASER_MONSTER_ID\)\{const sc=seleneChaserOf\(kusabiBeforeAttack\); addPermaBuff\('comboDmgPct'/.test(app));
check('ドリームペインをかける', /card\.monId===DREAM_PAIN_MONSTER_ID\)\{const dp=writeDreamPain/.test(app));
check('ドリームペインを敵の被ダメージに足す', /\+additionalDmgMod\+dreamPainTakenBonus\(dreamPainRef\.current\)/.test(app));
check('ターンが進むとドリームペインを進める', /writeDreamPain\(tickDreamPain\(dreamPainRef\.current\)\)/.test(app));
check('敵の絵の隅に楔とドリームペインのマークを出す', /kusabi: \(isTacticsMode\(runMode\) \? \[0, 1, 2, 3\] : \[null\]\)\.reduce\(\(most, i\) => Math\.max\(most, kusabiAt\(i\)\), 0\)/.test(app) && /dreamPain: dreamPainView\.wait === 0/.test(app)
  && /kusabi:\s+Object\.freeze\(\{ mark:/.test(bond) && /dreamPain:\s+Object\.freeze\(\{ mark:/.test(bond));

// ---------- ④ タクティクスのEX(2026-10-22 社長の決定) ----------
const tactics2 = tactics;
check('ジエンド: 3ターン・5回・ヘイト−30・楔が2倍', /Illumine: Object\.freeze\(\{\s*id: 'illumine_the_end',\s*name: 'ジエンド',[\s\S]{0,800}maxUses: 5, unlimited: false, withCards: true, duration: 'turns', turns: 3,\s*hateDown: 30,\s*effect: 'kusabiDouble'/.test(tactics2));
check('ミルフィーシールド: 3ターン・5回・ちから丈夫さ+5%と楔1つごとに+5%', /Dreamy: Object\.freeze\(\{\s*id: 'dreamy_millefeuille_shield',\s*name: 'ミルフィーシールド',[\s\S]{0,900}maxUses: 5, unlimited: false, withCards: true, duration: 'turns', turns: 3,\s*millefeuille: Object\.freeze\(\{ statBase: 0\.05, statPer: 0\.05 \}\),\s*effect: 'millefeuille'/.test(tactics2));
check('2つとも効果を実装済みの一覧に入っている', /'kusabiDouble', 'millefeuille'\]\);/.test(tactics2));
check('ジエンドのあいだは楔が1回で2つ・上限12', /const cap = kusabiCapAt\(slotIdx\), before = kusabiAt\(slotIdx\), after = kusabiCountOf\(before \+ \(cap > KUSABI_MAX \? 2 : 1\), cap\);/.test(app));
check('ジエンドを使うとヘイトを下げる', /def\.hateDown>0\)\{ const h=\[\.\.\.tacticsHateRef\.current\]; h\[slotIdx\]=Math\.max\(0,/.test(app));
check('ミルフィーシールドは使った瞬間の楔とシールドを控える', /const millefeuilleSnapshot=def\.millefeuille\?\{ kusabi:/.test(app) && /\.\.\.\(def\.millefeuille\?millefeuilleSnapshot:\{\}\)/.test(app));
check('受けるダメージはシールドから先に減る', /const shieldHit=spendTacticsExShield\(tacticsExStateRef\.current,slotIdx,fd,/.test(app));
check('ミルフィーシールドのちから・丈夫さは味方全員の上げ幅に入る', /e\.effect !== 'millefeuille'\) \|\| !isTacticsExEffectActive/.test(tactics2));
check('ライフ・ガッツの上限は別の項目(exShieldRate)で足し、上げ下げを戦闘中に見直す', /const shield = withShield \? Number\(unit && unit\.exShieldRate\)/.test(tactics2)
  && /const shield = syncTacticsExShieldMaxRates\(result\.units,/.test(app));
{
  // 純関数: 定義をそろえる・使う・シールドを削る(本体の関数を抜き出して動かす)
  const t = {};
  vm.createContext(t);
  const cut = (from, to) => { const i = tactics2.indexOf(from), j = tactics2.indexOf(to, i); return i >= 0 && j > i ? tactics2.slice(i, j) : ''; };
  try {
    vm.runInContext(`const tacticsSafeInt=(v,d=0)=>{const n=Math.floor(Number(v));return Number.isFinite(n)?n:d;};
${cut('const createTacticsExState', 'const sameTacticsExTurn')}
const isTacticsExEffectActive=()=>true;
${cut('// ---- ドリーミィ(millefeuille): ミルフィーシールド ----', '// ---- イルミネ(kusabiDouble): ジエンド ----')}
${cut('const tacticsExPartyStatRate', '// ---- ドリーミィ(millefeuille)')}
${cut('// ミルフィーシールドの上限アップ', '// ターン数で切れる効果の')}
globalThis.y={spendTacticsExShield,tacticsExShieldAt,tacticsExPartyStatRate,syncTacticsExShieldMaxRates};`, t);
    const st = { uses:{}, effects:{ 2:{ monId:'Dreamy', effect:'millefeuille', shields:{ 0:300, 1:500 } } } };
    const a = t.y.spendTacticsExShield(st, 0, 120, null), b = t.y.spendTacticsExShield(a.state, 0, 400, null);
    check('シールドは受けたぶんだけ減り、足りないぶんはライフへ', a.absorbed === 120 && a.rest === 0 && t.y.tacticsExShieldAt(a.state, 0, null) === 180
      && b.absorbed === 180 && b.rest === 220 && t.y.tacticsExShieldAt(b.state, 1, null) === 500);
    // 全ステータス(ちから・丈夫さ・ライフ上限・ガッツ上限)は、シールドが残っている子だけ(2026-10-22 社長)
    const st2 = { uses:{}, effects:{ 2:{ monId:'Dreamy', effect:'millefeuille', partyStatRate:0.2, shields:{ 0:300, 1:0 } } } };
    check('ちから・丈夫さのアップはシールドが残っている子だけ', Math.abs(t.y.tacticsExPartyStatRate(st2, null, 0) - 0.2) < 1e-9 && t.y.tacticsExPartyStatRate(st2, null, 1) === 0);
    const units = [{ id:'A', exShieldRate:0 }, { id:'B', exShieldRate:0.2 }, null, { id:'D', downed:true }];
    const sync = t.y.syncTacticsExShieldMaxRates(units, st2, null), again = t.y.syncTacticsExShieldMaxRates(sync.units, st2, null);
    check('ライフ・ガッツの上限アップもシールドに合わせて上げ下げする(壊れた子は戻す・何度走っても同じ)',
      sync.changed && Math.abs(sync.units[0].exShieldRate - 0.2) < 1e-9 && sync.units[1].exShieldRate === 0 && !again.changed);
  } catch (e) { check('シールドの関数を動かせる', false, String(e).slice(0, 120)); }
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
