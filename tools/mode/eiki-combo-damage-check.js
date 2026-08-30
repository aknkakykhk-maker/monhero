// エイキの連撃とスタックを「実際の数値」で確かめる。
//
//   node tools/mode/eiki-combo-damage-check.js
//
// 実装(game-system.jsx)の連撃ブロックそのものを切り出して動かし、
//   ・元ダメージ
//   ・各連撃のダメージ
//   ・スタック数と現在の加算値
// を並べて出す。式を検査側へ書き写すと本体を変えたときに検査だけが古くなるので、
// rollCombo と分岐の条件は実装から取り出したものをそのまま使う。
//
// 会心はランダム(rollCombo の中で card.crit||0.1 の確率で判定する)なので、
// 測定中だけ Math.random を 1 に固定して「会心しなかったとき」の倍率そのものを測る。
// 会心の乗り方はメイン攻撃と同じ既存処理なので、ここでは見ない。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- 実装から連撃ブロックを切り出す ---
// 囲っている if(...) ごと取る。中身だけを取ると閉じ括弧が余って関数にできない
const start = source.indexOf("        if (activeMon.id==='Zan' || (card.type==='unique' && card.monId==='Zan') || activeMon.id==='Eiki'");
const end = source.indexOf('        const globalComboRate=', start);
if (start < 0 || end < 0) { console.error('NG: 連撃ブロックを切り出せません'); process.exit(1); }
const block = source.slice(start, end);

// このブロックが読む外の値をすべて引数にして、そのまま動かせる関数にする
const runCombo = new Function(
  'd', 'card', 'activeMon', 'mainHero', 'slotIdx',
  'getPermaBuff', 'getTurnBuff', 'critRateBonus', 'critDmgBonus',
  'attackHits', 'state', 'pandoraSplitNormal',
  `let hasCrit=false, totalDmg=0;\n${block}\nreturn { totalDmg, hasCrit };`
);

const simulate = ({ heroId, activeId, cardType, cardMonId, d = 1000, comboDmgPct = 0 }) => {
  const attackHits = [];
  const perma = { comboDmgPct };
  const realRandom = Math.random;
  Math.random = () => 1; // 会心しない側に固定する(会心はメイン攻撃と同じ既存処理)
  let res;
  try {
    res = runCombo(
      d,
      { type: cardType, monId: cardMonId, crit: 0 },
      { id: activeId },
      { id: heroId },
      0,
      (key, def = 0) => perma[key] ?? def,
      (key, def = false) => def,
      0, 0,
      attackHits, null, false
    );
  } finally { Math.random = realRandom; }
  return { hits: attackHits.map(h => h.dmg), total: res.totalDmg };
};

const D = 1000;
console.log(`--- ① 桜花連舞(勇者=エイキ) 元ダメージ ${D} ---`);
const normal = simulate({ heroId: 'Eiki', activeId: 'Eiki', cardType: 'atk', cardMonId: undefined, d: D });
console.log(`  通常技      連撃 ${normal.hits.join(' + ')} = ${normal.total}`);
check('通常技: 10%×2 の連撃が2発', normal.hits.length === 2 && normal.hits.every(v => v === 100), normal.hits.join('/'));

const uniq = simulate({ heroId: 'Eiki', activeId: 'Eiki', cardType: 'unique', cardMonId: 'Eiki', d: D });
console.log(`  自身の固有技 連撃 ${uniq.hits.join(' + ')} = ${uniq.total}`);
// 桜花連舞 10%+10%+30% と 緋桜連華 15%+15% の合計5発
check('自身の固有技: 10%×2 + 30% + 15%×2 の連撃が5発', uniq.hits.length === 5, `${uniq.hits.length}発`);
check('その内訳が 100/100/300/150/150', JSON.stringify(uniq.hits) === JSON.stringify([100, 100, 300, 150, 150]), uniq.hits.join('/'));
check('固有技の連撃合計は元ダメージの80%', uniq.total === Math.floor(D * 0.8), `${uniq.total} / ${Math.floor(D * 0.8)}`);

console.log('--- ② 勇者がエイキでない場合 ---');
const notHero = simulate({ heroId: 'Zan', activeId: 'Eiki', cardType: 'atk', cardMonId: undefined, d: D });
console.log(`  エイキが供モンで通常技 連撃 ${notHero.hits.join(' + ') || 'なし'}`);
check('勇者がエイキでなければ桜花連舞は出ない', notHero.hits.length === 0, `${notHero.hits.length}発`);
const inherited = simulate({ heroId: 'Zan', activeId: 'Mocchi', cardType: 'unique', cardMonId: 'Eiki', d: D });
console.log(`  引き継いだエイキの固有技 連撃 ${inherited.hits.join(' + ')}`);
check('緋桜連華は引き継いだ固有技でも出る(15%×2)',
  JSON.stringify(inherited.hits) === JSON.stringify([150, 150]), inherited.hits.join('/'));
check('引き継ぎでは桜花連舞(10%×2・30%)は出ない', inherited.hits.length === 2);

console.log('--- ③ ザンへの影響が無いこと ---');
const zanNormal = simulate({ heroId: 'Zan', activeId: 'Zan', cardType: 'atk', cardMonId: undefined, d: D });
const zanUnique = simulate({ heroId: 'Zan', activeId: 'Zan', cardType: 'unique', cardMonId: 'Zan', d: D });
console.log(`  ザン通常技   連撃 ${zanNormal.hits.join(' + ')}`);
console.log(`  ザン固有技   連撃 ${zanUnique.hits.join(' + ')}`);
check('ザンの通常技は従来どおり30%×1', JSON.stringify(zanNormal.hits) === JSON.stringify([300]), zanNormal.hits.join('/'));
check('ザンの固有技は従来どおり30%+20%', JSON.stringify(zanUnique.hits) === JSON.stringify([300, 200]), zanUnique.hits.join('/'));

console.log('--- ④ 固有技を使うたびのスタック(連撃+3%) ---');
console.log('  スタック  加算値   固有技の連撃(10%/10%/30%/15%/15%)                 合計');
let ok3 = true;
for (let stack = 0; stack <= 5; stack++) {
  const bonus = 0.03 * stack;
  const r = simulate({ heroId: 'Eiki', activeId: 'Eiki', cardType: 'unique', cardMonId: 'Eiki', d: D, comboDmgPct: bonus });
  const want = [0.1, 0.1, 0.3, 0.15, 0.15].map(rate => Math.floor(D * (rate + bonus)));
  if (JSON.stringify(r.hits) !== JSON.stringify(want)) ok3 = false;
  console.log(`   ${String(stack).padStart(2)}回   +${(bonus * 100).toFixed(0).padStart(2)}%   ${r.hits.join(' / ').padEnd(44)} ${r.total}`);
}
check('スタックぶん(+3%/回)がすべての連撃へ同じように乗る', ok3);
// ザンの連斬と同じ仕組みなので、ザン側も同じように増える
const zanStacked = simulate({ heroId: 'Zan', activeId: 'Zan', cardType: 'unique', cardMonId: 'Zan', d: D, comboDmgPct: 0.09 });
check('同じスタックはザンの連撃にも従来どおり乗る(共通の仕組み)',
  JSON.stringify(zanStacked.hits) === JSON.stringify([390, 290]), zanStacked.hits.join('/'));

console.log('--- ⑤ 攻撃力+3%の積み方 ---');
// 攻撃力は連撃ブロックの外(固有技の効果)で積むので、ここでは積み方だけを確かめる
const effectLine = (source.match(/else if\(card\.monId==='Eiki'\)\{[^}]*\}/) || [])[0] || '';
console.log(`  実装: ${effectLine.replace(/\s+/g, ' ').slice(0, 120)}`);
check('固有技1回につき 連撃+3% と 攻撃+3% を1回ずつ積む',
  (effectLine.match(/addPermaBuff\('comboDmgPct',0\.03\*effMul\)/g) || []).length === 1
  && (effectLine.match(/addPermaBuff\('atkPct',0\.03\*effMul\)/g) || []).length === 1);
check('EXTREME等の効果倍率(effMul)を既存と同じようにかける', /0\.03\*effMul/.test(effectLine));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
