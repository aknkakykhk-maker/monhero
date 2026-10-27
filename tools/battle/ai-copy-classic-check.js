// AIコピー(ソラシドのアシカの5人目)の、5つの遊び(クラシック系)だけの計算(33-ai-copy-classic.jsx)を確かめる。
//
//   node tools/battle/ai-copy-classic-check.js
//
// 見ること:
//   ・強さの元は「元の子1体のぶん」: 勇者モンは基礎、供モンは合流ボーナス。育成ぶんはその割合で分ける
//   ・共通の summonAiCopy(mode:'classic')へ渡すと、ライフを持たないコピーになる(パーティのライフを使う)
//   ・コピーの攻撃はちからの比で縮む / 選ぶ点は 固有技 > 攻撃 > 強める > 守り・回復
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
globalThis.__s = { summonAiCopy, classicAiCopySrc, classicAiCopyScore, classicAiCopyIsAttack, classicAiCopyDamage, classicAiCopySpendGuts, classicAiCopyRegenGuts };`, ctx);
const s = ctx.__s;

const hero = { id: 'Golem', baseAtk: 200, baseDef: 100, baseGuts: 100, plusStats: { atk: 50, def: 50, guts: 10 } };
const ally = { id: 'Mocchi', baseAtk: 140, baseDef: 140, baseGuts: 140, plusStats: { atk: 50, def: 25, guts: 20 } };
const slots = [null, hero, ally, null];

// ---- 強さの元 ----
const plain = s.classicAiCopySrc({ slots, srcSlot: 2, heroId: 'Golem', party: { atk: 250, def: 125, maxGuts: 120 } });
check('育成なし: 供モンは合流ボーナスのぶんがそのまま', plain.atk === 50 && plain.def === 25 && plain.maxGuts === 20, JSON.stringify(plain));
const heroSrc = s.classicAiCopySrc({ slots, srcSlot: 1, heroId: 'Golem', party: { atk: 250, def: 125, maxGuts: 120 } });
check('育成なし: 勇者モンは基礎の値(合流ボーナスは見ない)', heroSrc.atk === 200 && heroSrc.def === 100 && heroSrc.maxGuts === 100, JSON.stringify(heroSrc));
const grown = s.classicAiCopySrc({ slots, srcSlot: 2, heroId: 'Golem', party: { atk: 500, def: 250, maxGuts: 240 } });
check('育成したぶんは、その子のぶんの割合で分ける', grown.atk === 100 && grown.def === 50 && grown.maxGuts === 40, JSON.stringify(grown));
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
const sc = (type) => s.classicAiCopyScore({ type });
check('選ぶ点: 固有技 > 攻撃 > 強める > 守り・回復', sc('unique') > sc('atk') && sc('atk') > sc('buff') && sc('buff') > sc('guard') && sc('guard') === sc('heal'));
check('撃てるのは攻撃(守り・回復・強めるは撃たない)', s.classicAiCopyIsAttack({ type: 'atk' }) && s.classicAiCopyIsAttack({ type: 'unique' }) && !s.classicAiCopyIsAttack({ type: 'guard' }) && !s.classicAiCopyIsAttack({ type: 'heal' }));

// ---- ガッツ ----
const c0 = { guts: 50, maxGuts: 60 };
check('使えば減る(0 より下へ行かない)', s.classicAiCopySpendGuts(c0, 20).guts === 30 && s.classicAiCopySpendGuts(c0, 99).guts === 0);
check('ターンの終わりに戻る(上限を超えない)', s.classicAiCopyRegenGuts({ guts: 10, maxGuts: 60 }, 0.2).guts === 22 && s.classicAiCopyRegenGuts(c0, 0.5).guts === 60);
check('コピーがいなければそのまま', s.classicAiCopyRegenGuts(null, 0.2) === null && s.classicAiCopySpendGuts(null, 5) === null);

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
