// モンサクの試合を、ゲーム本体と「同じ式」で組み立てる(r1115-202 H2)。
//   本体の parts から msxR3Fight(試合の入力を作る)と monsucOdds(試合の前の予想)をそのまま切り出して Node で動かす。
//   試算の道具(monsuc-balance-sim.js・monsuc-odds-check.js)は、ここを通して本番と同じ強化・ルールで戦う
//   (前は道具の側で入力を書き写していて、アシストの上乗せ・覚醒・aptUp・MONSUC_MATCH_RULE がずれていた)。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { sliceConst } = require('./load');

const PARTS = path.join(__dirname, '..', '..', 'monster-hero', 'src', 'parts');
// 括弧を含まない1行の const(数・new Map())
const oneLine = (src, name) => { const m = new RegExp(`^const ${name} = [^;]*;`, 'm').exec(src); if (!m) throw new Error(`${name} が見つからない`); return m[0]; };
const read = (f) => fs.readFileSync(path.join(PARTS, f), 'utf8');

// catalog … engine.buildCatalog の結果(ゲームの msxR3Catalog の代わり)
const makeGameFight = (catalog) => {
  const store = read('56-monhero-success-r3-store.jsx');
  const cup = read('56-monhero-success-cup.jsx');
  const code = [
    sliceConst(cup, 'MONSUC_MATCH_RULE'), sliceConst(cup, 'MSC_FORECAST'), oneLine(cup, 'MSC_ODDS_N'), oneLine(cup, 'mscOddsCache'), sliceConst(cup, 'monsucOdds'),
    sliceConst(store, 'MSX_R3_GEAR'), sliceConst(store, 'msxR3BoostOn'), sliceConst(store, 'msxR3TechGear'), sliceConst(store, 'msxR3Fight'),
    'globalThis.__out = { MONSUC_MATCH_RULE, MSC_FORECAST, monsucOdds, msxR3Fight, MSX_R3_GEAR };',
  ].join('\n');
  const ctx = vm.createContext({ msxR3Catalog: () => catalog, msxMonName: (id) => id, ambwFramesOf: () => [], Map, JSON, Math, Object, Array, Number, String, Boolean });
  vm.runInContext(code, ctx, { filename: 'game-fight.js' });
  return ctx.__out;
};

module.exports = { makeGameFight };
