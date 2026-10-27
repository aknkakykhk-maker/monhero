// AIコピー(ソラシドのアシカの5人目)の、5つの遊び(クラシック系)だけの計算(33-ai-copy-classic.jsx)を確かめる。
//
//   node tools/battle/ai-copy-classic-check.js
//
// 見ること:
//   ・強さの元は「元の子1体の基礎の値」(勇者モンも供モンも)。育成ぶんは、その子がパーティへ足したぶんの割合で分けて足す
//   ・共通の summonAiCopy(mode:'classic')へ渡すと、ライフを持たないコピーになる(パーティのライフを使う)
//   ・コピーの攻撃はちからの比で縮む(選ぶ点は共通の aiCopyAutoScore。ai-copy-check.js が見る)
//   ・ガッツは使えば減り、ターンの終わりに上限まで戻る(上限を超えない)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const breeder = read('monster-hero/data/breeder.js');
const grabArray = (name) => { const i = breeder.indexOf(`const ${name} = `); return breeder.slice(i, breeder.indexOf('\n];', i) + 3).replace(/^const /, 'var '); };
const ctx = { console, Math, JSON, Object, Array, Number, String };
vm.createContext(ctx);
vm.runInContext(`${grabArray('SORASHIDO_TIERS')}
${read('monster-hero/src/parts/32-sorashido-copy.jsx')}
${read('monster-hero/src/parts/33-ai-copy.jsx')}
${read('monster-hero/src/parts/33-ai-copy-classic.jsx')}
globalThis.__s = { summonAiCopy, classicAiCopySrc, classicAiCopyIsAttack, classicAiCopyDamage, classicAiCopySpendGuts, classicAiCopyRegenGuts };`, ctx);
const s = ctx.__s;

const hero = { id: 'Golem', baseAtk: 200, baseDef: 100, baseGuts: 100, plusStats: { atk: 50, def: 50, guts: 10 } };
const ally = { id: 'Mocchi', baseAtk: 140, baseDef: 140, baseGuts: 140, plusStats: { atk: 50, def: 25, guts: 20 } };
const slots = [null, hero, ally, null];

// ---- 強さの元 ----
const plain = s.classicAiCopySrc({ slots, srcSlot: 2, heroId: 'Golem', party: { atk: 250, def: 125, maxGuts: 120 } });
check('育成なし: 供モンも基礎の値がそのまま', plain.atk === 140 && plain.def === 140 && plain.maxGuts === 140, JSON.stringify(plain));
const heroSrc = s.classicAiCopySrc({ slots, srcSlot: 1, heroId: 'Golem', party: { atk: 250, def: 125, maxGuts: 120 } });
check('育成なし: 勇者モンは基礎の値(合流ボーナスは見ない)', heroSrc.atk === 200 && heroSrc.def === 100 && heroSrc.maxGuts === 100, JSON.stringify(heroSrc));
const grown = s.classicAiCopySrc({ slots, srcSlot: 2, heroId: 'Golem', party: { atk: 500, def: 250, maxGuts: 240 } });
check('育成したぶんは、その子がパーティへ足したぶんの割合で足す', grown.atk === 190 && grown.def === 165 && grown.maxGuts === 160, JSON.stringify(grown));
const heroGrown = s.classicAiCopySrc({ slots, srcSlot: 1, heroId: 'Golem', party: { atk: 500, def: 250, maxGuts: 240 } });
check('勇者モンも同じ(基礎+育成ぶんの割合)', heroGrown.atk === 400 && heroGrown.def === 200 && heroGrown.maxGuts === 200, JSON.stringify(heroGrown));
const empty = s.classicAiCopySrc({ slots: [null, null, null, null], srcSlot: 0, heroId: null, party: { atk: 100 } });
check('空の枠・壊れた値でも 0 で返す', empty.atk === 0 && empty.def === 0 && empty.maxGuts === 0);

// ---- 共通の部品へ渡す ----
const sum = s.summonAiCopy({ aiCopy: null, zones: { deck: [], hand: [], discard: [] } }, {
  srcSlot: 1, srcMonsterId: 'Golem', name: 'ゴーレム', level: 0, src: heroSrc, uniqueCard: { id: 'u', uid: 'u', type: 'unique', guts: 30 }, turn: 2, mode: 'classic',
});
check('classic のコピーはライフを持たない', sum.aiCopy && sum.aiCopy.hp === undefined && sum.aiCopy.maxHp === undefined);
check('Lv1 のちから・ガッツは元の 60%', sum.aiCopy.atk === 120 && sum.aiCopy.maxGuts === 60 && sum.aiCopy.def === 50, JSON.stringify({ atk: sum.aiCopy.atk, def: sum.aiCopy.def, g: sum.aiCopy.maxGuts }));

// ---- 攻撃・点 ----
check('ダメージはちからの比で縮む', s.classicAiCopyDamage(1000, 120, 250) === 480);
check('パーティのちからが 0 でも落ちない', s.classicAiCopyDamage(1000, 120, 0) === 0);
check('撃てるのは攻撃(守り・回復・強めるは撃たない)', s.classicAiCopyIsAttack({ type: 'atk' }) && s.classicAiCopyIsAttack({ type: 'unique' }) && !s.classicAiCopyIsAttack({ type: 'guard' }) && !s.classicAiCopyIsAttack({ type: 'heal' }));

// ---- ガッツ ----
const c0 = { guts: 50, maxGuts: 60 };
check('使えば減る(0 より下へ行かない)', s.classicAiCopySpendGuts(c0, 20).guts === 30 && s.classicAiCopySpendGuts(c0, 99).guts === 0);
check('ターンの終わりに戻る(上限を超えない)', s.classicAiCopyRegenGuts({ guts: 10, maxGuts: 60 }, 0.2).guts === 22 && s.classicAiCopyRegenGuts(c0, 0.5).guts === 60);
check('コピーがいなければそのまま', s.classicAiCopyRegenGuts(null, 0.2) === null && s.classicAiCopySpendGuts(null, 5) === null);

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
