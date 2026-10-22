// シミュレーター(sim/battle.js)に、ゲームと同じヘイトが入っているかを確かめる(2026-10-22 社長「ヘイトをシミュレーターに入れて」)。
//
//   node tools/playbot/sim/hate-sim-check.js
//
//   ① 数字・式を書き写していない: 本体から写した関数(G.tacticsHateStep・tacticsHateWaveStart・tacticsHateCardGain・tacticsHateExGain・
//      withTacticsTarget にヘイトを渡す)だけを使う。TACTICS_HATE の数字(k・decay など)を battle.js に書いていない
//   ② ゲームと同じ5か所でつながっている: 使ったカード(同じ子の2枚目は半分)・EX・与ダメージ(そのターンのぶん)・
//      敵が狙う直前に1ターンぶん進める・WAVE の始めに0(勇者だけ下地)
//   ③ ゲームと同じく既定で入。hate:false で切れる。入と切で結果が変わる(狙いにヘイトが効いている)
//   ④ ヘイトを進める式が本体と同じ(タンクの倍率・勇者の下地・倒れた子は0・上限)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const src = fs.readFileSync(path.join(__dirname, 'battle.js'), 'utf8');
const { loadGame } = require('./load-game');
const G = loadGame();
// ①
check('① 本体の関数を使う', ['G.tacticsHateStep(', 'G.tacticsHateWaveStart(', 'G.tacticsHateCardGain(', 'G.tacticsHateExGain(', 'G.TACTICS_TARGET_LOW_HP_BIAS, st.hateOn ? st.hate : null'].every((k) => src.includes(k)));
check('① ヘイトの数字を書き写していない', !/TACTICS_HATE\.(k|decay|cap|action|hero|exByEffect)|decay:\s*0\.\d|\bk:\s*25\b/.test(src));
// ②
const adv = src.slice(src.indexOf('function advanceIntents('), src.indexOf('\n}\n', src.indexOf('function advanceIntents(')));
check('② 敵が狙う直前に1ターンぶん進める', /stepHate\(st\);[^\n]*\n\s*const aimed = aim\(st,/.test(adv));
check('② 使ったカード(同じ子の2枚目は半分)', /addHate\(st, slot, G\.tacticsHateCardGain\(card, st\.units\[slot\] && st\.units\[slot\]\.id, effMul\)\)/.test(src) && /const effMul = halved \? 0\.5 : 1;/.test(src));
check('② EX を使った', /addHate\(st, slot, G\.tacticsHateExGain\(def\.effect, mon\.id\)\);[^\n]*\n\s*st\.ex = G\.applyTacticsExUse\(/.test(src));
check('② 与ダメージはそのターンのぶん(dmgBySlot の増えたぶん)', /const dealt = \[0, 1, 2, 3\]\.map\(\(i\) => Math\.max\(0, \(st\.dmgBySlot\[i\] \|\| 0\) - \(st\.hateDmgMark\[i\] \|\| 0\)\)\);/.test(src));
check('② WAVE の始めはタイプで決める(ゲームと同じく盤面の子の id を渡す)', /resetHate\(st\);/.test(src) && /G\.tacticsHateWaveStart\(st\.units\.map\(\(u\) => u && u\.id\)\)/.test(src));
// ③
const { simulateRun } = require('./battle');
let diff = 0, wOn = 0, wOff = 0;
for (let i = 0; i < 40; i++) {
  const a = simulateRun({ heroId: 'Monol', allies: ['Mocchi', 'Pixie', 'Ham'], difficulty: 'Expert', seed: i, exMode: 'best' });
  const b = simulateRun({ heroId: 'Monol', allies: ['Mocchi', 'Pixie', 'Ham'], difficulty: 'Expert', seed: i, exMode: 'best', hate: false });
  if (a.wave !== b.wave || a.turns !== b.turns || a.taken !== b.taken) diff++;
  wOn += a.wave; wOff += b.wave;
}
check('③ 既定で入(hate を渡さないと入)', /hateOn: hate !== false && typeof aimHook !== 'function'/.test(src) && /heroId, allies = \[\], hate = true,/.test(src));
check('③ 入と切で結果が変わる(狙いにヘイトが効いている)', diff >= 10, `40回中 ${diff}回で違う(平均 WAVE 入 ${(wOn / 40).toFixed(2)} / 切 ${(wOff / 40).toFixed(2)})`);
// ④
const units = [G.createTacticsUnit({ id: 'Monol', hp: 500, def: 100, atk: 50, guts: 100 }), G.createTacticsUnit({ id: 'Mocchi', hp: 400, def: 50, atk: 80, guts: 100 }), null, null];
const h0 = G.tacticsHateWaveStart(['Monol', 'Mocchi', null, null]);
const h1 = G.tacticsHateStep([0, 0, 0, 0], { gains: [10, 0, 0, 0], dealt: [0, 100, 0, 0] }, units, ['Monol', 'Mocchi', null, null]);
check('④ WAVE の始めはモノリス 30・モッチー 20、タンク(モノリス)の増え方は倍率 1.5', JSON.stringify(h0) === JSON.stringify([30, 20, 0, 0]) && Math.abs(h1[0] - 1.5 * 10) < 1e-9, JSON.stringify(h1.map((x) => Math.round(x * 10) / 10)));
console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
process.exit(failed ? 1 : 0);
