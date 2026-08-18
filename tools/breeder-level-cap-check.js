// ブリーダーレベルに実質的な上限が無いことを確認する。
//
//   node tools/breeder-level-cap-check.js
//
// 【背景】
// levelInfo が「200回まで」というループの安全策で頭打ちになっており、
// Lv.201に到達すると経験値を貯めてもレベルアップしなくなっていた。
// ブリーダーレベルに意図した上限は無いため、ループ回数の上限を撤廃した。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const help = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const changelog = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const slice = (from, to) => {
  const i = source.indexOf(from);
  const j = source.indexOf(to, i);
  return i >= 0 && j > i ? source.slice(i, j) : '';
};

// ---- levelInfo が回数上限を持たないこと ----
const levelInfoSrc = slice('const levelInfo = (totalXp) => {', 'const bondLevelInfo');
check('levelInfo を取り出せる', levelInfoSrc.length > 0);
check('levelInfo に固定回数の for ループ(旧・200回打ち切り)が残っていない',
  !/for\s*\(let i\s*=\s*0;\s*i\s*<\s*\d+;\s*i\+\+\)/.test(levelInfoSrc));
check('levelInfo は need を満たせなくなるまで回す while ループになっている',
  /while\s*\(true\)\s*\{/.test(levelInfoSrc));

// ---- 実際に計算関数を取り出して動かす ----
const calcSrc = `
const XP_CURVE_EXPONENT = 1.4;
${slice('const xpForLevel', 'const legacyLevelBefore160')}
${slice('const BREEDER_XP_DISCOUNT', 'const safeBreederXp')}
${slice('const safeBreederXp', 'const bondLevelInfo')}
module.exports={xpForBreederLevel,levelInfo};`;
const mod = { exports: {} };
new Function('module', 'exports', calcSrc)(mod, mod.exports);
const L = mod.exports;

// Lv.251ちょうどに到達する累計XPを作り、旧実装なら頭打ちになっていたはずのラインを超える
let need = 0;
for (let l = 1; l <= 250; l++) need += L.xpForBreederLevel(l);
const info = L.levelInfo(need);
check('Lv.201を超えてレベルアップする(以前はここで頭打ちだった)', info.level > 201, `Lv.${info.level}`);
check('Lv.251ちょうどの経験値でLv.251になる', info.level === 251 && info.xpIntoLevel === 0, `Lv.${info.level} / 端数${info.xpIntoLevel}`);

// 極端に大きい経験値でも有限時間で終わる(無限ループしない)ことも確認
const t0 = Date.now();
const big = L.levelInfo(1e13);
check('極端に大きい経験値でも短時間で計算が終わる(無限ループしない)',
  Date.now() - t0 < 2000 && Number.isFinite(big.level) && big.level > 1000, `Lv.${big.level} / ${Date.now() - t0}ms`);

// ★重要: 上限撤廃で失われた安全弁の代わり。
// NaN・Infinityは「xp < need」がいつまでも偽になるため、守りが無いとここで固まる。
// 以前は「200回まで」のループ上限がたまたまこれを防いでいた。
for (const [label, value] of [['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity],
  ['文字列', 'こわれた値'], ['null', null], ['undefined', undefined], ['マイナス', -5000]]) {
  const start = Date.now();
  let result = null, hung = false;
  try {
    result = L.levelInfo(value);
  } catch (e) {
    result = { level: `例外: ${e.message}` };
  }
  hung = Date.now() - start > 1000;
  check(`壊れた保存値(${label})でも固まらずLv.1に落ち着く`,
    !hung && result && result.level === 1 && result.xpIntoLevel === 0,
    hung ? '1秒以上かかった(無限ループの疑い)' : `Lv.${result && result.level} / 端数${result && result.xpIntoLevel}`);
}
check('正しい数値の文字列は数値として扱う(既存の保存値を壊さない)',
  L.levelInfo('1000').level === L.levelInfo(1000).level, `文字列Lv.${L.levelInfo('1000').level} / 数値Lv.${L.levelInfo(1000).level}`);

// ---- ヘルプ・更新履歴 ----
check('ヘルプに「ブリーダーレベルに上限はない」旨がある', help.includes('ブリーダーレベルに上限はありません'));
check('更新履歴にこの修正がある', changelog.includes('ブリーダーレベルがLv.201から上がらなくなる不具合を修正'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
