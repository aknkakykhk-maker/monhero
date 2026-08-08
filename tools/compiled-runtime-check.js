// 配信用コードが、index.html で用意していない JSX ランタイムを参照していないことを確認する。
// Babel の development/automatic 出力を誤って配信すると、構文は正しくても初回実行時に
// jsxDEV などが未定義になり、React がマウントされる前にゲーム全体が停止する。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const compiled = fs.readFileSync(path.join(root, 'monster-hero', 'game-system.compiled.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'monster-hero', 'index.html'), 'utf8');

const checks = [
  ['jsxDEV を参照しない', !/\bjsxDEV(?:_[A-Za-z0-9_$]+)?\s*\(/.test(compiled)],
  ['automatic JSX runtime を参照しない', !/(?:react\/jsx-(?:dev-)?runtime|\b_jsxs?\s*\()/.test(compiled)],
  ['React の classic runtime で要素を生成する', /\bReact\.createElement\s*\(/.test(compiled)],
  ['React をゲーム本体より先に読み込む', index.indexOf('vendor/react.production.min.js') >= 0 && index.indexOf('vendor/react.production.min.js') < index.indexOf('game-system.compiled.js')],
  ['ReactDOM をゲーム本体より先に読み込む', index.indexOf('vendor/react-dom.production.min.js') >= 0 && index.indexOf('vendor/react-dom.production.min.js') < index.indexOf('game-system.compiled.js')],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK' : 'NG'}: ${label}`);
  failed ||= !ok;
}
process.exit(failed ? 1 : 0);
