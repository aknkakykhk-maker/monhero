#!/usr/bin/env node
// 助手のマスモンのフレンド対戦(2026-11-11 タイセン): サーバの上の関数(supabase/functions/masmon-pvp)が試合を回すための、
// 計算の本体の写し(engine.js)を作る。手で写さない(計算を直したら、次のビルドで写しも追従する)。
//   入れる物: 計算の本体(monster-hero/data/assistant-masmon-battle.js)をそのまま包んだもの + 技データの写し(buildCatalog の結果)
//   端末とサーバで同じ計算・同じ技データになる(端末も同じ buildCatalog を同じ技データから作る)
//
//   node tools/masmon-battle/build-masmon-pvp-bundle.js           作り直す
//   node tools/masmon-battle/build-masmon-pvp-bundle.js --check   いまの部品と合っているかだけ見る
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'monster-hero', 'data', 'assistant-masmon-battle.js');
const OUT = path.join(ROOT, 'supabase', 'functions', 'masmon-pvp', 'engine.js');

const make = () => {
  if (!fs.existsSync(SRC)) return { ok: false, reason: 'monster-hero/data/assistant-masmon-battle.js が無い' };
  const { catalog } = require('./load.js').load();
  const src = fs.readFileSync(SRC, 'utf8');
  const body = [
    '// 自動で作った写し(tools/masmon-battle/build-masmon-pvp-bundle.js)。手で直さない。直すのは monster-hero/data/assistant-masmon-battle.js と技データ',
    '// deno-lint-ignore-file',
    'const __mod = { exports: {} };',
    '(function (module) {',
    src,
    '})(__mod);',
    'export const ASSISTANT_MASMON_BATTLE = __mod.exports;',
    `export const MASMON_PVP_CATALOG = ${JSON.stringify(catalog)};`,
    '',
  ].join('\n');
  return { ok: true, body };
};

const run = ({ check = false } = {}) => {
  const r = make();
  if (!r.ok) return r;
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (check) return cur === r.body ? { ok: true } : { ok: false, reason: 'フレンド対戦のサーバの関数の写し(masmon-pvp/engine.js)が古い(node tools/build.js で作り直す)' };
  if (cur !== r.body) fs.writeFileSync(OUT, r.body);
  return { ok: true, changed: cur !== r.body };
};

module.exports = { run, OUT };

if (require.main === module) {
  const r = run({ check: process.argv.includes('--check') });
  if (!r.ok) { console.error('NG ' + r.reason); process.exit(1); }
  console.log(r.changed ? '作り直した: ' + path.relative(ROOT, OUT) : 'OK ' + path.relative(ROOT, OUT));
}
