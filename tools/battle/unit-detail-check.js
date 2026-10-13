#!/usr/bin/env node
// バトル中のモンスターの詳細(2026-10-13 社長の依頼「モンスターをタップすると能力含め詳細バフも見れるようにして」)の作りを見る。
//
//   node tools/battle/unit-detail-check.js
//
// 実際に開いて見るのは unit-detail-browser-check.js。ここはブラウザでは作りにくい所と、値の出どころを見る。
//   ① 味方の枠のタップは「カードの置き場所の操作」が先。詳細はカードを選んでいないとき(pendingCard==null)・
//      引きずっていないとき・練習中でないときだけ開く。タクティクスは今までどおり EX の窓が先
//   ② 敵のタップは、戦闘の動きの最中・オート・練習中には開かない
//   ③ ちから・丈夫さの「いま」は、ダメージの計算と同じ掛け算(トリックスタート・運命・丈夫さ+%)から作る
//   ④ 強化の札は1つの関数(battleBuffChips)から作り、帯と詳細の両方がそれを使う
//   ⑤ 敵の攻撃力の「元の値」は、図鑑の素の値(baseAtk)ではなく、咆哮で上がる前の値(atkBeforeRoar)
//   ⑥ 枠の「マーク×数」の地は薄く(不透明度0.5以下)、字に縁取りがある
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const battle = read('monster-hero/src/parts/71-screen-battle.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const html = read('monster-hero/index.html');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ① 味方の枠のタップの順番
const tapStart = battle.indexOf('if(pendingCard!=null && canAssign){');
const exBranch = battle.indexOf('} else if(pendingCard==null && !dragState?.active && tacticsExInfo && tacticsExInfo(i)){', tapStart);
const detailBranch = battle.indexOf("} else if(pendingCard==null && !dragState?.active && battleTutorialStep==null && typeof battleUnitStatusOf==='function' && battleUnitStatusOf(i)){", tapStart);
check('① 枠のタップは、カードの置き場所の操作 → EX の窓 → 詳細 の順', tapStart > 0 && exBranch > tapStart && detailBranch > exBranch && detailBranch - tapStart < 3000,
  `${tapStart} / ${exBranch} / ${detailBranch}`);
check('① 詳細を開くのは setUnitDetail({side:\'ally\',slot:i}) だけ', detailBranch > 0 && /setUnitDetail\(\{side:'ally',slot:i\}\)/.test(battle.slice(detailBranch, detailBranch + 400)));

// ② 敵のタップ
const enemyTap = battle.match(/data-enemy-tap-detail onClick=\{\(\)=>\{[\s\S]{0,400}?setUnitDetail\(\{side:'enemy'\}\); \}\}/);
check('② 敵のタップは、動きの最中・オート・練習中には開かない', !!enemyTap && /isBusy\|\|autoBattle\|\|battleTutorialStep!=null\|\|!enemy\) return;/.test(enemyTap[0]), enemyTap ? enemyTap[0].slice(0, 200) : '見つからない');

// ③ 値の出どころ
const fnStart = app.indexOf('const battleUnitStatusOf = (slotIdx) => {');
const fn = fnStart > 0 ? app.slice(fnStart, app.indexOf('\n  };\n', fnStart)) : '';
const attackerAtk = (app.match(/const attackerAtk=\([\s\S]*?;\n/) || [''])[0];
check('③ battleUnitStatusOf がある', fn.length > 0);
for (const f of ['trickStartAtkMult(trickStartStacksAt(slotIdx))', "fateAtkMult("]) {
  check(`③ ちからは攻撃の計算と同じ ${f} を掛ける`, fn.includes(f) && attackerAtk.includes(f.replace("fateAtkMult(", 'fateAtkMult(')), f);
}
check('③ 丈夫さは被ダメージの計算と同じ「丈夫さ+%(defPct)× トリックスタート」', /resolveEffectiveMaxStat\([^;]*getPermaBuff\('defPct'\)\)/.test(fn) && fn.includes('trickStartDefMult(trickStartStacksAt(') && /const guardDefFor[\s\S]{0,600}resolveEffectiveMaxStat\(normalizeTacticsUnit\(unit\)\.def, getPermaBuff\('defPct'\)\)/.test(app));
check('③ 詳細の値はバトル画面へ渡している', /battleUnitStatusOf=\{battleUnitStatusOf\} battleEnemyStatus=\{battleEnemyStatus\}/.test(app));

// ④ 強化の札は1か所
check('④ 強化の札を作る関数 battleBuffChips がある', /const battleBuffChips = \(\) => \{/.test(battle));
check('④ 帯は battleBuffChips() を使う', /const chips=battleBuffChips\(\);/.test(battle));
check('④ 詳細も battleBuffChips() を使う(タクティクスの切り替え・ほかのモードの窓)', (battle.match(/chips=\{battleBuffChips\(\)\}/g) || []).length >= 2);
check('④ 札を1枚ずつ足す chip(...) は battleBuffChips の中だけ', (() => {
  const a = battle.indexOf('const battleBuffChips = () => {');
  const b = battle.indexOf('            return chips;\n  };', a);
  const outside = battle.slice(0, a) + battle.slice(b);
  return a > 0 && b > a && !/\bchip\('/.test(outside);
})());

// ⑤ 敵の攻撃力の元の値
const enemyFn = (app.match(/const battleEnemyStatus = \(\) => \([\s\S]*?\n  \} : null\);/) || [''])[0];
check('⑤ 敵の元の攻撃力は atkBeforeRoar を使い、図鑑の baseAtk は使わない', /atkBeforeRoar/.test(enemyFn) && !/baseAtk/.test(enemyFn));
check('⑤ 咆哮で攻撃力を上げるときに、上がる前の値を atkBeforeRoar に残す', /atkBeforeRoar:Number\.isFinite\(Number\(prev\.atkBeforeRoar\)\)\?prev\.atkBeforeRoar:Math\.max\(0,Number\(prev\.atk\)\|\|0\),atk:Math\.floor\(Math\.max\(0,Number\(prev\.atk\)\|\|0\)\*TACTICS_ROAR_ATK_RATE\)/.test(app));

// ⑥ 札の濃さ
const mark = (html.match(/\.mh-stack-mark \{[\s\S]*?\}/) || [''])[0];
const alpha = Number((mark.match(/background: rgba\([^)]*,\s*([\d.]+)\)/) || [])[1]);
check('⑥ マーク×数の地は薄い(不透明度0.5以下)', Number.isFinite(alpha) && alpha <= 0.5, String(alpha));
check('⑥ 字に縁取り(text-shadow)がある', /text-shadow:/.test(mark));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
