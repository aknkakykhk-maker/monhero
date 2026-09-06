const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 与ダメージの「予測表示」と「実処理」が同じヒット列(同じ合計)になることを、乱数を固定して確かめる。
//
//   node tools/battle/damage-parity-check.js
//
// 【なぜ要るか】
// 予測(getAttackPredictedDmg)と実処理(processTurn の攻撃ブロック)は、勇者特性・固有技の連撃・全体連撃を
// 別々に書いている(docs/refactor/BATTLE_DAMAGE_MAP.md)。片方だけ直すと「予測と実際が違う」になる。
// 一本化(STEP 5)の前後で等価であることを固定するため、本体から両方を切り出し、同じ入力で回して比べる。
//
// 【見かた】
// ・会心の乱数は Math.random を差し替えて固定する(会心なし / 確定会心)。予測は乱数会心を乗せない仕様なので、
//   「会心なし」と「guaranteedCrit」の2通りで一致すればよい
// ・贖罪の追撃(アーク・イブリースの固有技)は実処理側では固有技の効果ブロックの中にあり、ここでは切り出さない。
//   予測側の floor(mainDmg×0.2) を差し引いて比べる
const fs = require('fs');
const path = require('path');
const { GAME_SYSTEM } = require(path.join(TOOLS_DIR, 'harness'));

const source = fs.readFileSync(GAME_SYSTEM, 'utf8');
let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const slice = (from, to, fromIndex = 0) => {
  const i = source.indexOf(from, fromIndex); if (i < 0) throw new Error(`見つからない: ${from}`);
  const j = source.indexOf(to, i); if (j < 0) throw new Error(`見つからない: ${to}`);
  return { text: source.slice(i, j), start: i, end: j };
};

// --- 予測: useCallback の中の関数だけを取り出す ---
const pred = slice('const getAttackPredictedDmg = useCallback(', ', [mainHero, turnBuffs, permaBuffs]);');
const predictedArrow = pred.text.slice('const getAttackPredictedDmg = useCallback('.length);
const makePredicted = (mainHero, getPermaBuff, getTurnBuff) => Function('mainHero', 'getPermaBuff', 'getTurnBuff', 'Math', `return (${predictedArrow});`)(mainHero, getPermaBuff, getTurnBuff, Math);

// --- 実処理: processTurn の攻撃ブロック(会心判定 〜 全体連撃)を取り出す ---
const anchor = source.indexOf("const d=getDmg(card,slotIdx,activeMon,localOryoAdd,localDmgModAdd,halved,attackStartDist)");
if (anchor < 0) throw new Error('processTurn の攻撃ブロックが見つからない');
const act = slice("const critRateBonus=getPermaBuff('critRatePct'), critDmgBonus=getPermaBuff('critDmgPct');", 'if (rangeMoveTarget!=null)', anchor);
const makeActual = (rng) => Function('d', 'card', 'activeMon', 'mainHero', 'getPermaBuff', 'getTurnBuff', 'localGlobalComboAdd', 'slotIdx', 'Math', `
  let totalDmg = 0, hasCrit = false; const attackHits = [];
  ${act.text}
  return { totalDmg, attackHits, hasCrit };
`)
  .bind(null);
const mathWith = (random) => Object.assign(Object.create(Math), { random, floor: Math.floor, max: Math.max, min: Math.min });

check('予測と実処理の両方を本体から切り出せる', predictedArrow.includes('extraHit') && act.text.includes('rollCombo'));

const heroes = ['Zan', 'Eiki', 'Pandora', 'Ark', 'Golem'];
const uniqueOwners = ['Zan', 'Eiki', 'Pandora', 'Ark', 'Iblis', 'Suezo'];
const cards = [{ type: 'atk' }, { type: 'range_atk', rangeIdx: 1 }, ...uniqueOwners.map(id => ({ type: 'unique', monId: id }))];
let cases = 0; const mismatches = [];
for (const heroId of heroes) for (const attackerId of [heroId, 'Suezo']) for (const card of cards)
  for (const d of [100, 333]) for (const combo of [0, 0.05]) for (const global of [0, 0.1]) for (const localGlobal of [0, 0.03])
    for (const critMode of ['none', 'guaranteed']) {
      const perma = { comboDmgPct: combo, globalComboDmgPct: global, critDmgPct: 0.1, critRatePct: 0 };
      const turn = { guaranteedCrit: critMode === 'guaranteed' };
      const getPermaBuff = (k, def = 0) => (k in perma ? perma[k] : def);
      const getTurnBuff = (k, def) => (k in turn ? turn[k] : def);
      const mainHero = { id: heroId }; const mon = { id: attackerId };
      const predicted = makePredicted(mainHero, getPermaBuff, getTurnBuff)(card, mon, d, localGlobal);
      const M = mathWith(() => 1); // 乱数会心は起きない(guaranteedCrit だけが会心)
      const actual = makeActual()(d, card, mon, mainHero, getPermaBuff, getTurnBuff, localGlobal, 1, M);
      // 贖罪の追撃は予測にだけ入っている(実処理では固有技の効果ブロック側)
      const atonement = card.type === 'unique' && (card.monId === 'Ark' || card.monId === 'Iblis')
        ? Math.floor((() => { const split = heroId === 'Pandora' && attackerId === 'Pandora' && ['atk', 'range_atk'].includes(card.type); const mb = split ? Math.floor(d * 0.5) : d; return turn.guaranteedCrit ? Math.floor(mb * 1.6) : mb; })() * 0.2)
        : 0;
      cases++;
      if (predicted - atonement !== actual.totalDmg) mismatches.push(`${heroId}/${attackerId}/${card.type}${card.monId ? ':' + card.monId : ''} d=${d} combo=${combo} global=${global}+${localGlobal} ${critMode}: 予測${predicted - atonement} ≠ 実${actual.totalDmg}`);
    }
check(`乱数を固定すると予測と実処理の合計が一致する(${cases} 通り)`, mismatches.length === 0, mismatches.slice(0, 5).join(' / '));

// ヒット列の順序(メイン → 連撃 → 全体連撃)と本数の代表例
{
  const perma = { comboDmgPct: 0, globalComboDmgPct: 0.1, critDmgPct: 0, critRatePct: 0 };
  const getPermaBuff = (k, def = 0) => (k in perma ? perma[k] : def); const getTurnBuff = (k, def) => def;
  const hits = makeActual()(100, { type: 'unique', monId: 'Eiki' }, { id: 'Eiki' }, { id: 'Eiki' }, getPermaBuff, getTurnBuff, 0, 1, mathWith(() => 1)).attackHits;
  const names = hits.map(h => h.skillName || 'main').join(',');
  check('エイキ勇者の固有技: メイン → 桜花連舞×2 → +30% → 緋桜連華×2 → 全体連撃 の順と本数', hits.length === 7 && hits[0].dmg === 100, names);
}

console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
