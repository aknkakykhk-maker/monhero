// モンヒロサクセスの計算の芯(monster-hero/data/monhero-success.js)を Node で読み込む。画面は開かない。
// 使い回す部品(助手マスモンの MASMON_CALC・AMG_APT・AMG_INIT)はゲーム本体の parts にあるので、そこから切り出して渡す。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const PARTS = path.join(ROOT, 'monster-hero', 'src', 'parts');
const CORE = path.join(ROOT, 'monster-hero', 'data', 'monhero-success.js');

// 「const 名前 = 」から始まる1文を、括弧の数を数えて切り出す
const sliceConst = (src, name) => {
  const at = src.indexOf(`const ${name} = `);
  if (at < 0) throw new Error(`${name} が見つからない`);
  let depth = 0; let started = false;
  for (let i = at; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '{' || c === '[') { depth += 1; started = true; }
    else if (c === ')' || c === '}' || c === ']') depth -= 1;
    else if (c === ';' && started && depth === 0) return src.slice(at, i + 1);
  }
  throw new Error(`${name} の終わりが見つからない`);
};

let cached = null;
const loadDeps = () => {
  const calcSrc = fs.readFileSync(path.join(PARTS, '56-assistant-life-masmon-calc.jsx'), 'utf8');
  const growSrc = fs.readFileSync(path.join(PARTS, '56-assistant-life-masmon-grow.jsx'), 'utf8');
  const code = [sliceConst(calcSrc, 'MASMON_CALC'), sliceConst(growSrc, 'AMG_APT'), sliceConst(growSrc, 'AMG_INIT'), sliceConst(growSrc, 'AMG_APT_MULT'),
    'globalThis.__out = { MASMON_CALC, AMG_APT, AMG_INIT, AMG_APT_MULT };'].join('\n');
  const ctx = vm.createContext({});
  vm.runInContext(code, ctx, { filename: 'success-deps.js' });
  // 技表(助手マスモンの修行・対戦と同じ表)
  const tctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'monster-hero', 'data', 'assistant-masmon-techs.js'), 'utf8') + '\n;globalThis.__t = ASSISTANT_MASMON_TECHS;', tctx, { filename: 'assistant-masmon-techs.js' });
  // タイプの表(タクティクスの MONSTER_TYPE_OF)・図鑑(間合いの適性・下書きの印)・大会の常連(台本 第3弾)
  const tyCtx = vm.createContext({});
  vm.runInContext(sliceConst(fs.readFileSync(path.join(PARTS, '32-tactics-units.jsx'), 'utf8'), 'MONSTER_TYPE_OF') + '\n;globalThis.__ty = MONSTER_TYPE_OF;', tyCtx);
  const ALL_PLAYER_MONSTERS = require('../masmon-battle/load.js').load().data.ALL_PLAYER_MONSTERS;
  const regFile = path.join(ROOT, 'monster-hero', 'data', 'monhero-success-regulars.js');
  const reg = fs.existsSync(regFile) ? require(regFile) : { MONSUC_REGULARS: [], MONSUC_REGULAR_CUPS: {} };
  return { ...ctx.__out, ASSISTANT_MASMON_TECHS: tctx.__t, MONSTER_TYPE_OF: tyCtx.__ty, ALL_PLAYER_MONSTERS, MONSUC_REGULARS: reg.MONSUC_REGULARS, MONSUC_REGULAR_CUPS: reg.MONSUC_REGULAR_CUPS };
};
const depsFor = (deps, extra) => ({ calc: deps.MASMON_CALC, apt: deps.AMG_APT, init: deps.AMG_INIT, techs: deps.ASSISTANT_MASMON_TECHS,
  types: deps.MONSTER_TYPE_OF, monsters: deps.ALL_PLAYER_MONSTERS, regulars: deps.MONSUC_REGULARS, cupNames: deps.MONSUC_REGULAR_CUPS, ...(extra || {}) });
const load = () => {
  if (cached) return cached;
  const deps = loadDeps();
  delete require.cache[CORE];
  const mod = require(CORE);
  const SUC = mod.create(depsFor(deps));
  cached = { mod, SUC, deps };
  return cached;
};

module.exports = { ROOT, CORE, load, loadDeps, sliceConst, depsFor };
