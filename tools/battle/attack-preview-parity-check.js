#!/usr/bin/env node
// 図鑑の「攻撃アクション」で見せる演出が、本番バトルとまったく同じ動きになっているかを見る。
//
// 実際にあった不具合: ザン・エイキ・剣士モッチーは本番だと固有技でも
// 「共通のタメ → 残像ダッシュ(zanComboDash)」へ移るのに、プレビュー側だけ
// motion を渡す分岐へ入れてしまい specialLunge(ただの突進)になっていた。
// 見た目だけの違いなので構文検査では拾えず、遊んだ人が気づくまで分からない。
//
// ここでは本番バトル(processTurn)の分岐をソースから読み取って形を確かめたうえで、
// プレビューの手順を実際に動かし、1コマずつ同じCSSアニメーションになるか突き合わせる。
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const grab = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));

const ctx = { WATER_BURST_MOTION_MS:680, ARK_HOLY_RAIN_MOTION_MS:900, MIA_SONG_NOTES_MOTION_MS:760 };
vm.createContext(ctx);
vm.runInContext(grab('const attackMotionAnimation =', 'const rpgMotionName =')
  + '\nglobalThis.__p={attackMotionAnimation,attackMotionPreviewSequence,attackMotionUniquePreviewSequence};', ctx);
const { attackMotionAnimation:animOf, attackMotionPreviewSequence:normalSeq, attackMotionUniquePreviewSequence:uniqueSeq } = ctx.__p;

let failed = 0;
const check = (label, ok, note='') => { if(!ok) failed++; console.log(`${ok?'OK':'NG'}: ${label}${note?` — ${note}`:''}`); };

// --- 本番バトルの分岐が、ここで前提にしている形のままか ---
const comboBranch = grab('const isComboDashMotion = ', '// 数値を出す間隔。');
check('本番はザン系(ザン・エイキ・剣士モッチー)を専用の連撃経路で見せている',
  comboBranch.includes("const isComboDashMotion = hitMotion==='zanCombo' || hitMotion==='eikiSakuraCombo' || hitMotion==='kenshiTwinBlade';")
  && comboBranch.includes('setAttackAnim({slotIndex: animSlot, zanCombo: !isTwinBlade, twinBlade: isTwinBlade, sakura:'));
check('本番はザン系の固有技でも、共通のタメを先に見せてから連撃へ移る',
  /if \(hit\.isUnique\) \{[\s\S]{0,320}setAttackAnim\(\{slotIndex: animSlot, charge:true\}\);[\s\S]{0,120}await battleWait\(650\);/.test(comboBranch));
check('本番はザン系以外の固有技を「タメ → motionを渡す」で見せている',
  src.includes('setAttackAnim({slotIndex: animSlot, charge:true});')
  && src.includes('setAttackAnim({slotIndex: animSlot, charge:false, motion, twinBlade:isKenshiTwin, sakura:'));

// 本番バトルが作る anim を、上で確かめた分岐そのままに組み立てる
const battleAnims = (motion, isUnique) => {
  const isComboDash = motion==='zanCombo' || motion==='eikiSakuraCombo' || motion==='kenshiTwinBlade';
  if (isComboDash) {
    const isTwinBlade = motion==='kenshiTwinBlade';
    const dash = { zanCombo:!isTwinBlade, twinBlade:isTwinBlade, sakura:motion==='eikiSakuraCombo' };
    return isUnique ? [{charge:true}, dash] : [dash];
  }
  const isKenshiTwin = motion==='kenshiTwinBlade';
  const swing = { motion, twinBlade:isKenshiTwin, sakura:motion==='eikiSakuraCombo' };
  return isUnique ? [{charge:true}, {charge:false, ...swing}] : [swing];
};
// 専用コンポーネント(パンドラ・アーク・水・ミーア)は枠を動かさないので undefined が正解。
// 見分けが付くよう、そのまま比べずに印を付ける
const shape = (anim) => animOf(anim) || `専用演出(${anim.motion||'-'})`;

// 種類は本編のモンスターデータ(ally-monsters.js)から集める。モンスターを足したら自動で対象が増える
const ally = fs.readFileSync('monster-hero/data/ally-monsters.js', 'utf8');
const kinds = [...new Set([...ally.matchAll(/atkMotion:'([A-Za-z]+)'/g)].map(m => m[1]))].sort();
check('本編のatkMotionを全種そろえて比べている', kinds.length >= 8, kinds.join(' / '));

for (const kind of kinds) {
  const realNormal = battleAnims(kind, false).map(shape);
  const prevNormal = normalSeq(kind).map(step => shape(step.anim));
  check(`${kind}: 通常攻撃がバトルと同じ動き`, JSON.stringify(realNormal)===JSON.stringify(prevNormal),
    JSON.stringify(realNormal)===JSON.stringify(prevNormal) ? '' : `本番 ${JSON.stringify(realNormal)} / プレビュー ${JSON.stringify(prevNormal)}`);

  const realUnique = battleAnims(kind, true).map(shape);
  const prevUnique = uniqueSeq(kind).map(step => shape(step.anim));
  check(`${kind}: 固有技がバトルと同じ動き(タメ→専用モーション)`, JSON.stringify(realUnique)===JSON.stringify(prevUnique),
    JSON.stringify(realUnique)===JSON.stringify(prevUnique) ? '' : `本番 ${JSON.stringify(realUnique)} / プレビュー ${JSON.stringify(prevUnique)}`);
}

// 固有技のプレビューは必ずタメから始まり、通常攻撃のプレビューにはタメを入れない
check('固有技のプレビューは必ず共通のタメから始まる',
  kinds.every(kind => uniqueSeq(kind)[0]?.anim?.charge===true && uniqueSeq(kind)[0]?.ms===650));
check('通常攻撃のプレビューにはタメを入れない',
  kinds.every(kind => normalSeq(kind).every(step => step.anim?.charge!==true)));
check('どの手順も1コマずつ時間が入っている',
  kinds.every(kind => [...normalSeq(kind), ...uniqueSeq(kind)].every(step => Number(step.ms) > 0)));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
