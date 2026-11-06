// 数を選ぶ所の直接入力(2026-11-07 社長「お布施で選択する数値は直接入力できるようにしてほしい。上限はなしで。
// 同様に数値が絡む項目は基本直接入力できるようにしてほしい」)を見張る。
//   ① お布施の転生・神殿のまとめて転生に、画面の決め打ちの上限(以前は50回)が無い。持っているダイヤ・レベルで止まる
//   ② お布施のダイヤの欄は、全角数字・小数・カンマ・マイナスを安全に読む(数字のキーボードも出す)
//   ③ 魂格特性の段階・超越の変換ポイントも、共通の CountInput で打ち込める
//   ④ 確定のときは、画面の数ではなく持ち数で数え直す(今の守りのまま)
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const prog = read('monster-hero/src/parts/11-masu-progression.jsx');
const sb = { console, BREEDER_MARKET_ITEMS: [], ALL_PLAYER_MONSTERS: { Test: { id:'Test', distAptitude:['C','C','C','C'], baseHp:10, baseAtk:10, baseDef:10, baseGuts:10 } } };
vm.createContext(sb);
vm.runInContext(prog + '\nthis.__x={buildMasuOffering,buildMasuReincarnationBatch,totalBondXpForLevel,OFFERING_MAX_REINCARNATIONS,REINCARNATE_BATCH_MAX};', sb);
const { buildMasuOffering: build, buildMasuReincarnationBatch: batch, totalBondXpForLevel: total } = sb.__x;
let fail = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${ok ? '' : ' — ' + detail}`); if (!ok) fail++; };
const masu = (o = {}) => ({ id:'m1', baseId:'Test', name:'T', bondXp:0, distAptPoints:0, statPoints:{hp:0,atk:0,def:0,guts:0}, distAptBoosts:[0,0,0,0], rebirthCount:0, levelCap:30, ...o });

// ① 上限なし(見張りの数だけ)
check('お布施の転生・まとめて転生に、画面の決め打ちの上限(50回)が無い(見張りは1万回以上)',
  sb.__x.OFFERING_MAX_REINCARNATIONS >= 10000 && sb.__x.REINCARNATE_BATCH_MAX >= 10000);
const rich = masu({ bondXp:total(250), levelCap:250, rebirthCount:44 });
const many = build({ masu:rich, gold:1e12, ownedItems:{}, mode:'reincarnate', amount:80 });
check('お布施の転生は50回を超えても続けられる(ダイヤが足りれば)', many.ok && many.reincarnations === 80, JSON.stringify([many.reincarnations, many.stopReason]));
const poor = build({ masu:rich, gold:1e8, ownedItems:{}, mode:'reincarnate', amount:1e9 });
check('とても大きい回数を頼んでも、持っているダイヤで止まり、持ち数を超えて使わない', poor.ok && poor.spent <= 1e8 && poor.stopReason === 'funds' && poor.reincarnations > 0,
  JSON.stringify([poor.reincarnations, poor.spent, poor.stopReason]));
const b2 = batch({ masu:masu({ bondXp:total(100), levelCap:100 }), skillKey:'', gold:1e12, count:999 });
check('まとめて転生も大きい回数はレベルで止まる(Lv.100 が要る)', b2.ok && b2.count >= 1 && b2.count < 999, JSON.stringify(b2.count));

// ② お布施のダイヤの欄
const off = read('monster-hero/src/parts/62-screen-masu-offering.jsx');
const m = off.match(/const diamondDigits = ([^\n]+);/);
check('ダイヤの欄の読み方がある', !!m);
if (m) {
  const digits = (diamondText) => eval(m[1].replace(/;$/, ''));
  const cases = [['１２３', '123'], ['12.5', '12'], ['1,000', '1000'], ['-500', '500'], ['', ''], ['abc', ''], ['３．９', '3']];
  check('全角数字は半角に・小数点から先は切り捨て・カンマとマイナスは無視', cases.every(([inp, out]) => digits(inp) === out),
    cases.map(([inp]) => `${inp}→${digits(inp)}`).join(' / '));
}
check('ダイヤの欄は数字のキーボード(inputMode numeric・pattern)で、持っている数を超えない',
  /<input type="text" inputMode="numeric" pattern="\[0-9\]\*" enterKeyHint="done" autoComplete="off" data-offering-diamond-input/.test(off)
  && /const diamondAmount = Math\.min\(limits\.maxDiamonds,/.test(off));

// ③ 共通の CountInput
const soul = read('monster-hero/src/parts/63-screen-masu-soul-traits.jsx');
const trans = read('monster-hero/src/parts/64-screen-masu-transcend-enhance.jsx');
check('魂格特性の段階を打ち込める(0〜強化できる段階)', /<CountInput value=\{draft\} min=\{0\} max=\{maxUpgrade\} onChange=\{n=>setSoulTraitDraftLevels\(n\)\}/.test(soul));
check('超越の変換ポイントを打ち込める(1〜変換できる数)', /<CountInput value=\{exchangeWant\} min=\{1\} max=\{exchangeMax\} onChange=\{setWant\}/.test(trans));

// ④ 確定は持ち数で数え直す
const app = read('monster-hero/src/parts/60-app.jsx');
check('確定のときは持ち数で数え直す(魂格特性・超越の変換)',
  /const result = buildSoulTraitUpgrade\(masu, traitId, levels\);/.test(app)
  && /const have = ownedItemCount\(ownedItemsRef\.current, BREAKTHROUGH_ITEM_ID\);\n\s*const applied = applyTranscendExchange\(masu, have, wantedPoints\);/.test(app));

console.log(fail ? `\n${fail}件のNGがあります` : '\nすべてOK');
process.exit(fail ? 1 : 0);
