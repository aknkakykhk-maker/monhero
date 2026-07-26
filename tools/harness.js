// game-system.jsx から染色もどきのロジックだけを Node 上に取り出すための共通ヘルパー。
// 本体はブラウザ用の1枚岩スクリプト(exportが無く、末尾でReactDOMのレンダリングまで実行する)なので、
// Babelで変換 → 末尾にエクスポート行を追記 → 最小限のブラウザスタブを載せたvmで実行、という手順を踏む。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');
const { createCanvas, Image, loadImage } = require('canvas');

const REPO_ROOT = path.resolve(__dirname, '..');
const GAME_SYSTEM = path.join(REPO_ROOT, 'monster-hero', 'game-system.jsx');

// game-system.jsx をBabelで変換する。構文エラーはここで例外になる(check-syntax.jsもこれを使う)
function transformGameSystem() {
  const src = fs.readFileSync(GAME_SYSTEM, 'utf8');
  const out = babel.transformSync(src, {
    filename: 'game-system.jsx',
    presets: [[require.resolve('@babel/preset-react'), { runtime: 'classic' }]],
    babelrc: false,
    configFile: false,
    compact: false,
    sourceType: 'script',
  });
  return out.code;
}

// vm上でトップレベルのconstを取り出すために末尾へ追記する行。
// ここに並べた名前が game-system.jsx から消えたら、その時点でReferenceErrorになって気付ける。
const EXPORTED_NAMES = [
  'BUILD_DATE',
  'MASU_COLOR_REGION_HUES',
  'MASU_COLOR_EXCLUDE',
  'MASU_COLOR_SMOOTH',
  'MASU_COLOR_REGION_SIZE_OVERRIDES',
  'dyeRegionCount',
  'getDyeRegionMasks',
  '_classifyDyePixel',
  '_isExcludedDyePixel',
  '_getSmoothParams',
  '_rgbToHsv',
  '_hsvToRgb',
  '_hueDist',
];

// ブラウザAPIの最小スタブ。canvasだけは node-canvas で本物と同じように動かす
function makeBrowserStubs() {
  const noop = () => {};
  const makeEl = (tag) => {
    if (tag === 'canvas') return createCanvas(1, 1);
    return {
      tagName: String(tag).toUpperCase(), style: {}, dataset: {}, children: [], classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
      appendChild: noop, removeChild: noop, setAttribute: noop, getAttribute: () => null,
      addEventListener: noop, removeEventListener: noop, remove: noop,
    };
  };
  const documentStub = {
    createElement: makeEl,
    createElementNS: (_ns, tag) => makeEl(tag),
    head: makeEl('head'),
    body: makeEl('body'),
    documentElement: makeEl('html'),
    getElementById: () => makeEl('div'),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop,
  };
  // Reactは「呼ばれても落ちない」だけあれば十分(コンポーネントの中身は実行しない)
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    Fragment: 'Fragment',
    useState: (v) => [typeof v === 'function' ? v() : v, noop],
    useEffect: noop, useCallback: (f) => f, useMemo: (f) => f(), useRef: (v) => ({ current: v }),
    useReducer: (_r, v) => [v, noop], useContext: () => ({}), createContext: () => ({}),
    memo: (c) => c, forwardRef: (c) => c,
  };
  const ReactDOM = { createRoot: () => ({ render: noop, unmount: noop }), render: noop };
  const windowStub = {
    Image, document: documentStub, React, ReactDOM,
    localStorage: (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() }; })(),
    location: { href: 'http://localhost/', search: '', hash: '', reload: noop },
    navigator: { userAgent: 'node', language: 'ja' },
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
    addEventListener: noop, removeEventListener: noop,
    requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: clearTimeout,
    setTimeout, clearTimeout, setInterval, clearInterval,
    devicePixelRatio: 1, innerWidth: 390, innerHeight: 844,
    fetch: () => Promise.reject(new Error('fetch is stubbed')),
    AudioContext: function () { return { createOscillator: () => ({ connect: noop, start: noop, stop: noop, frequency: { value: 0, setValueAtTime: noop } }), createGain: () => ({ connect: noop, gain: { value: 0, setValueAtTime: noop, exponentialRampToValueAtTime: noop } }), destination: {}, currentTime: 0, resume: () => Promise.resolve(), state: 'running' }; },
  };
  return { windowStub, documentStub, React, ReactDOM };
}

let _cached = null;

// game-system.jsx を実行し、染色関連のシンボルを返す(何度呼んでも1回だけ実行する)
function loadDyeModule() {
  if (_cached) return _cached;
  const code = transformGameSystem();
  const { windowStub, documentStub, React, ReactDOM } = makeBrowserStubs();
  const sandbox = {
    window: windowStub, document: documentStub, React, ReactDOM, Image,
    localStorage: windowStub.localStorage, navigator: windowStub.navigator, location: windowStub.location,
    matchMedia: windowStub.matchMedia, requestAnimationFrame: windowStub.requestAnimationFrame,
    cancelAnimationFrame: windowStub.cancelAnimationFrame, devicePixelRatio: 1,
    setTimeout, clearTimeout, setInterval, clearInterval, console, Math, Date, JSON,
    fetch: windowStub.fetch, AudioContext: windowStub.AudioContext, webkitAudioContext: windowStub.AudioContext,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  const exportLine = `\n;globalThis.__dyeExports = { ${EXPORTED_NAMES.join(', ')} };\n`;
  vm.runInContext(code + exportLine, sandbox, { filename: 'game-system.jsx', timeout: 120000 });
  _cached = sandbox.__dyeExports;
  return _cached;
}

// data/images-*.js に埋め込まれた base64 画像を { 変数名: dataURL } で取り出す
function loadEmbeddedImages() {
  const files = ['images-ally.js', 'images-enemy.js', 'breeder.js'];
  const map = {};
  for (const f of files) {
    const p = path.join(REPO_ROOT, 'monster-hero', 'data', f);
    if (!fs.existsSync(p)) continue;
    const s = fs.readFileSync(p, 'utf8');
    const re = /(?:const\s+)?([A-Za-z0-9_$]+)\s*[:=]\s*["'`](data:image\/[a-z+]+;base64,[^"'`]*)/g;
    let m;
    while ((m = re.exec(s))) map[m[1]] = m[2];
  }
  return map;
}

// MASU_COLOR_REGION_HUES のキー(baseId)から、検証に使う立ち絵のdataURLを引く。
// 変数名は SUEZO_IMG のように baseId の大文字スネークケース + _IMG になっている
function imageForBaseId(baseId, images) {
  const upper = baseId.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
  return images[`${upper}_IMG`] || images[`${upper}_ICON`] || null;
}

// dataURL を node-canvas の Image として読む
async function decodeDataUrl(dataUrl) {
  return loadImage(Buffer.from(dataUrl.split(',')[1], 'base64'));
}

module.exports = { REPO_ROOT, GAME_SYSTEM, transformGameSystem, loadDyeModule, loadEmbeddedImages, imageForBaseId, decodeDataUrl, createCanvas };
