// game-system.jsx が「その場所からは見えない変数」を参照していないかを調べる。
//
// きっかけになった不具合:
//   マーケットに入ろうとすると進行不能になった。原因は、ある関数の中で定義した定数を
//   別の画面(コンポーネントの描画側)から参照していたこと。JavaScriptとしては構文が
//   正しいので check-syntax.js は通ってしまい、その画面を開いた瞬間だけ
//   ReferenceError になって画面が真っ白になっていた。
//
// ここではBabelでソースを解析し、スコープをたどってどこにも定義が無い名前を洗い出す。
// ブラウザやNodeが最初から持っている名前と、data/*.js が読み込み時に作る名前
// (ALL_PLAYER_MONSTERS など)は、実際にそのファイルを実行して集めた一覧で除外する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'monster-hero/src/game-system.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');

// --- data/*.js を実行して、そこで定義される名前を集める ---
// index.html が読む順にそのまま流す(前のファイルの定数を使うものがあるため)。
// 一覧を手で書いていたころは、data/*.js を1つ足すたびにここへ足し忘れ、
// 新しいデータの定数が「どこからも見えない変数」として誤検出されていた。
// 実際に配信される index.html の読み込み順から拾って、ずれないようにする。
const indexHtml = fs.readFileSync(path.join(root, 'monster-hero', 'index.html'), 'utf8');
const dataFiles = [...indexHtml.matchAll(/<script src="(data\/[^"?]+\.js)(?:\?[^"]*)?"/g)].map(m => m[1]);
if (dataFiles.length === 0) {
  console.error('NG: index.html から data/*.js の読み込みを拾えませんでした');
  process.exit(1);
}
const dataContext = {};
vm.createContext(dataContext);
const beforeKeys = new Set(Object.getOwnPropertyNames(dataContext));
for (const f of dataFiles) {
  const p = path.join(root, 'monster-hero', f);
  if (!fs.existsSync(p)) continue;
  // トップレベルの const/let は sandbox のプロパティにならないので、名前だけ拾う
  vm.runInContext(fs.readFileSync(p, 'utf8'), dataContext, { filename: f });
}
const dataNames = new Set();
for (const f of dataFiles) {
  const p = path.join(root, 'monster-hero', f);
  if (!fs.existsSync(p)) continue;
  const ast = parser.parse(fs.readFileSync(p, 'utf8'), { sourceType: 'script' });
  for (const node of ast.program.body) {
    if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) if (d.id.type === 'Identifier') dataNames.add(d.id.name);
    } else if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id) {
      dataNames.add(node.id.name);
    }
  }
}
for (const k of Object.getOwnPropertyNames(dataContext)) if (!beforeKeys.has(k)) dataNames.add(k);

// ブラウザ・Nodeが持っている名前
const GLOBALS = new Set([
  ...Object.getOwnPropertyNames(globalThis),
  'window','document','navigator','location','history','screen','localStorage','sessionStorage',
  'fetch','Image','Audio','AudioContext','webkitAudioContext','requestAnimationFrame','cancelAnimationFrame',
  'setTimeout','clearTimeout','setInterval','clearInterval','performance','crypto','console',
  'React','ReactDOM','alert','confirm','prompt','CustomEvent','Event','MutationObserver','ResizeObserver',
  'IntersectionObserver','matchMedia','getComputedStyle','structuredClone','queueMicrotask','btoa','atob',
  'TextEncoder','TextDecoder','URL','URLSearchParams','Blob','FileReader','XMLHttpRequest','WebSocket',
  'MonsterHeroGame','globalThis','undefined',
]);

const ast = parser.parse(source, { sourceType: 'script', plugins: ['jsx'] });

const missing = new Map(); // 名前 -> 最初に見つかった行
traverse(ast, {
  ReferencedIdentifier(p) {
    const name = p.node.name;
    // JSXの属性名やタグ名(小文字)は変数ではない
    if (p.parentPath.isJSXAttribute({ name: p.node })) return;
    if (p.parentPath.isJSXOpeningElement() && /^[a-z]/.test(name)) return;
    if (GLOBALS.has(name) || dataNames.has(name)) return;
    if (p.scope.hasBinding(name, true)) return;
    if (!missing.has(name)) missing.set(name, p.node.loc ? p.node.loc.start.line : 0);
  },
});

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

check('data/*.js の定数を読み込めている', dataNames.size > 30, `${dataNames.size}個`);
check('どこからも見えない変数を参照していない', missing.size === 0,
  [...missing].map(([n, line]) => `${n} (${line}行目)`).join(' / '));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
