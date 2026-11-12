// モンヒロサクセスの台本(docs/progress/player-raise/script/*.js)を、ゲームが読む1つのファイルにまとめる。
//   node tools/success/success-script-bundle.js          … monster-hero/data/monhero-success-script.js を作り直す
//   node tools/success/success-script-bundle.js --check  … 台本と食い違っていないかだけ見る(違えば NG)
// 正本は docs の台本。ゲーム側のファイルは手で直さない(台本を直したら、これを打つ)。
// まとめたファイルは index.html では読まない。育成の画面を開いたときにだけ読む(56-monhero-success-store.jsx)。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'docs', 'progress', 'player-raise', 'script');
const OUT = path.join(ROOT, 'monster-hero', 'data', 'monhero-success-script.js');
// [ファイル, 中の名前, まとめたときの名前]
const FILES = [
  ['turn.js', 'MONSUC_SCRIPT_TURN', 'turn'],
  ['turn-bond12.js', 'MONSUC_SCRIPT_TURN_BOND12', 'turnBond12'],
  ['scenario.js', 'MONSUC_SCRIPT_SCENARIO', 'scenario'],
  ['cheer.js', 'MONSUC_SCRIPT_CHEER', 'cheer'],
  ['issa.js', 'MONSUC_SCRIPT_ISSA', 'issa'],
  ['random.js', 'MONSUC_SCRIPT_RANDOM', 'random'],
  ['rival.js', 'MONSUC_SCRIPT_RIVAL', 'rival'],
  ['mon.js', 'MONSUC_SCRIPT_MON', 'mon'],
  ['heads.js', 'MONSUC_SCRIPT_HEADS', 'heads'],
];

const build = () => {
  const parts = FILES.map(([file, name, key]) => {
    const src = fs.readFileSync(path.join(DIR, file), 'utf8').replace(/^if \(typeof module[^\n]*\n?/m, '');
    if (!src.includes(`const ${name}`)) throw new Error(`${file} に ${name} が無い`);
    return `  // ---- ${file} ----\n${src.trim()}\n  out.${key} = ${name};`;
  });
  return [
    '// モンヒロサクセスの台本(まとめ)。★このファイルは tools/success/success-script-bundle.js が作る。手で直さない',
    '// 正本: docs/progress/player-raise/script/*.js。育成の画面を開いたときにだけ読む(index.html では読まない)',
    '(function (root) {',
    '  \'use strict\';',
    '  const out = {};',
    parts.join('\n'),
    '  if (typeof monsucScriptHeadOf === \'function\') out.headOf = monsucScriptHeadOf;',
    '  const api = Object.freeze(out);',
    '  if (typeof module !== \'undefined\' && module.exports) module.exports = api;',
    '  if (root) root.MONHERO_SUCCESS_SCRIPT = api;',
    '})(typeof globalThis !== \'undefined\' ? globalThis : this);',
    '',
  ].join('\n');
};

const text = build();
if (process.argv.includes('--check')) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (now !== text) { console.log('NG: monhero-success-script.js が台本と食い違っている → node tools/success/success-script-bundle.js'); process.exit(1); }
  console.log('OK: monhero-success-script.js は台本と同じ');
} else {
  fs.writeFileSync(OUT, text);
  // 読めるか確かめる
  delete require.cache[OUT];
  const api = require(OUT);
  const n = Object.values(api).filter(Array.isArray).reduce((a, x) => a + x.length, 0);
  console.log(`作った: ${path.relative(ROOT, OUT)}(${n}行・${Math.round(text.length / 1024)}KB)`);
}
