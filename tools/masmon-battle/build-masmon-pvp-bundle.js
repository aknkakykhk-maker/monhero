#!/usr/bin/env node
// 助手のマスモンのフレンド対戦(2026-11-11 タイセン): サーバの上の関数(supabase/functions/masmon-pvp)が試合を回すための、
// 計算の本体の写し(engine.js)を作る。手で写さない(計算を直したら、次のビルドで写しも追従する)。
//   入れる物: 計算の本体(monster-hero/data/assistant-masmon-battle.js)をそのまま包んだもの + 技データの写し(buildCatalog の結果)
//            + 技の習得条件(assistant-masmon-techs.js の learn。登録の見張りに使う)
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
  const { catalog, data } = require('./load.js').load();
  // 技の習得条件(learn)。対戦の計算は読まないが、登録の見張り(技の習得条件)に使う。種類 → 技 id → learn
  //   (第2版: 同じ技 id が種類ごとに違う覚え方になるので、種類ごとに持つ)
  const learn = {};
  for (const [spName, sp] of Object.entries((data.ASSISTANT_MASMON_TECHS || {}).species || {})) {
    for (const t of (Array.isArray(sp) ? sp : sp.techs || [])) if (t && t.id && t.learn) (learn[spName] = learn[spName] || {})[t.id] = t.learn;
  }
  // 第1版の技 id → 第2版の技 id(古い端末・登録ずみの編成に残る古い id を、サーバが読み替えるため)
  const idmap = (data.ASSISTANT_MASMON_TECHS || {}).idmap || {};
  const src = fs.readFileSync(SRC, 'utf8');
  const body = [
    '// 自動で作った写し(tools/masmon-battle/build-masmon-pvp-bundle.js)。手で直さない。直すのは monster-hero/data/assistant-masmon-battle.js と技データ',
    '// deno-lint-ignore-file',
    'const __mod = { exports: {} };',
    '(function (module) {',
    src,
    '})(__mod);',
    'export const ASSISTANT_MASMON_BATTLE = __mod.exports;',
    `export const MASMON_PVP_CATALOG = ${JSON.stringify({ ...catalog, idmap })};`,
    `export const MASMON_PVP_LEARN = ${JSON.stringify(learn)};`,
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
