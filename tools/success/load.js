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
  return ctx.__out;
};
const load = () => {
  if (cached) return cached;
  const deps = loadDeps();
  delete require.cache[CORE];
  const mod = require(CORE);
  const SUC = mod.create({ calc: deps.MASMON_CALC, apt: deps.AMG_APT, init: deps.AMG_INIT });
  cached = { mod, SUC, deps };
  return cached;
};

module.exports = { ROOT, CORE, load, loadDeps, sliceConst };
