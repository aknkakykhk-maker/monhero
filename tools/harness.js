// game-system.jsx から染色もどきのロジックだけを Node 上に取り出すための共通ヘルパー。
// 本体はブラウザ用の1枚岩スクリプト(exportが無く、末尾でReactDOMのレンダリングまで実行する)なので、
// Babelで変換 → 末尾にエクスポート行を追記 → 最小限のブラウザスタブを載せたvmで実行、という手順を踏む。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const REPO_ROOT = path.resolve(__dirname, '..');
const GAME_SYSTEM = path.join(REPO_ROOT, 'monster-hero', 'src', 'game-system.jsx');

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
  'getRecoloredImage',
  '_classifyDyePixel',
  '_isExcludedDyePixel',
  '_getSmoothParams',
  '_rgbToHsv',
  '_hsvToRgb',
  '_hueDist',
  'isImageIconValue',
  'cardIconNode',
  'rankingPartyColors',
  'rankingMasuDetail',
  'rankingDetailToMasu',
  'RANKING_DETAIL_VERSION',
  'RANKING_FUSION_MAX',
  'normalizeFusionHistory',
  'fusionHistoryHasDetail',
  'mergeMasuIntoMon',
  'monsterPowerOf',
  'monsterPowerParts',
  'masuPowerOf',
  'masuBondLevelInfo',
  'uniqueSkillAtLevel',
  'resolveInheritedUniqueDefinition',
  'resolveInheritedUniqueLevel',
  'inheritedUniqueLevelKey',
  'migrateInheritedUniqueLevelIds',
  'appendInheritedUnique',
  'INHERITED_UNIQUE_LEVEL_KEY_PREFIX',
  'inheritedUniqueRunLevel',
  'MAX_UNIQUE_SKILL_LEVEL',
  'getMonsterAptPct',
  'formatAptBonus',
  'DIST_APTITUDE_GRADES',
  'totalBondXpForLevel',
  'bondLevelInfo',
  'levelInfo',
  'xpForBreederLevel',
  'migrateMasuLevelCaps',
  'buildMasuBreakthrough',
  'buildAutoRepeatBreakthroughs',
  'buildFusionBreakthroughPlan',
  'buildFusionDiamondSummary',
  'buildMasuReincarnation',
  'reconcileMasuPoints',
  'totalBreakthroughPoints',
  'totalReincarnatePoints',
  'cappedBondXp',
  'MAX_MASU_LEVEL_CAP',
  'REINCARNATE_MIN_LEVEL',
  'REINCARNATE_LEVEL_DROP',
  'REINCARNATE_POINTS',
  'BREAKTHROUGH_FIRST_POINTS',
  'BREAKTHROUGH_POINTS',
  'BREAKTHROUGH_LEVEL_CAP_GAIN',
  'autoRepeatBreakthroughMaxLevel',
  'autoRepeatBreakthroughLevelOptions',
  'BREAKTHROUGH_LEVEL_CAPS',
  'breakthroughLevelCap',
  'levelUpPointMultiplier',
  'applyBondXpGain',
  'diagnoseLegacyDistAptBoosts',
  'diagnoseLegacyMasuBaselineMigration',
  'migrateSafeMasuBaselineRepresentations',
  'regenerationStatCouldBeGenerated',
  'ALL_PLAYER_MONSTERS',
  'BREAKTHROUGH_STAR_TIERS',
  'BREAKTHROUGH_STARS_PER_TIER',
  'BREAKTHROUGH_MAX_COUNT',
  'BREAKTHROUGH_FINAL_LEVEL_CAP',
  'FINAL_BREAKTHROUGH_COUNT',
  'RAINBOW_STAR_IMAGE',
  'breakthroughStars',
  'isFinalBreakthroughCount',
  'INITIAL_MASU_LEVEL_CAP',
  'masuBondLevelInfo',
  'normalizeMasuProgression',
  'masuRebirthCost',
  'BREAKTHROUGH_ITEM_ID',
  'BREAKTHROUGH_ITEM_BASE',
  'BREAKTHROUGH_ITEM_STEP',
  'breakthroughItemCost',
  'ownedItemCount',
  'SPECIES_TRANSCEND_FRUIT_ITEM_ID_PREFIX',
  'RAINBOW_TRANSCEND_FRUIT_ITEM_ID',
  // 種族(主血統)ごとの実は、読み込み順の都合で最初に呼ばれたときに作る関数になっている
  'speciesTranscendFruitItems',
  'LEGACY_SPECIES_TRANSCEND_FRUIT_ITEMS',
  'legacySpeciesTranscendFruitItemId',
  'RAINBOW_TRANSCEND_FRUIT_ITEM',
  'speciesTranscendFruitItemId',
  'masuSpeciesTranscendFruitItemId',
  'speciesChallengeLineages',
  'transcendFruitOwnedCount',
  'changeTranscendFruitOwnedCount',
  'consumeTranscendFruit',
  'useTranscendFruitOnMasu',
  'saveTranscendFruitPair',
  'buildMarketItemPurchase',
  'saveMarketBalances',
  'CLEAR_PSYCHE_REWARD',
  'clearPsycheReward',
  'DIFFICULTY_SETTINGS',
  'SPECIES_CHALLENGE_DIFFICULTY_IDS',
  'SPECIES_CHALLENGE_PROGRESS_KEY',
  'normalizeSpeciesChallengeProgress',
  'isSpeciesChallengeCleared',
  'isSpeciesChallengeFirstRewardClaimed',
  'SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS',
  'speciesChallengeFirstClearReward',
  'finalizeSpeciesChallengeClearReward',
  'persistSpeciesChallengeClearReward',
  // 種族チャレンジのランキング識別(種族×難易度)。既存のdifficulty列へ入れるキーを作る
  'BATTLE_MODE_SPECIES_CHALLENGE',
  'SPECIES_CHALLENGE_PUBLIC_RELEASE',
  'SPECIES_RANKING_PREFIX',
  'speciesChallengeRankingDifficulty',
  'parseSpeciesChallengeRankingDifficulty',
  'rankingDifficultyForMode',
  'rankingDifficultyBase',
  'rankingDifficultyKey',
  'RANKING_DIFFICULTY_KEYS',
  // 旧(モンスター1体単位)の超越の実を、同じ血統のマスモンへ使えるようにするための後方互換
  'legacySpeciesTranscendFruitsForLineage',
  'legacySpeciesTranscendFruitIdsForLineage',
  'monsterLineageOf',
  'dexMainLineages',
  'BREEDER_MARKET_ITEMS',
];

// ブラウザAPIの最小スタブ。canvasだけは node-canvas で本物と同じように動かす
function makeBrowserStubs() {
  // 正規ビルドはCanvasを使わない。画像系チェックを実行するときだけ読み込み、
  // Babelだけを用意した軽量な環境でも build.js を実行できるようにする。
  const { createCanvas, Image, loadImage } = require('canvas');
  const noop = () => {};
  // 本体は new window.Image() に "images/monsters/xxx.png?v=..." のような
  // 配信時の相対パスを渡す。node-canvas の Image はブラウザと違って
  // 相対パスもキャッシュキー(?v=)も解決できず、そのまま渡すと必ず onerror になり
  // 染色マスクが1体も作れなくなる(画像をbase64から実ファイルへ移したときに壊れた)。
  // ここで実ファイルの絶対パスへ直してから本物のsrcへ渡す。
  class BrowserImage extends Image {
    set src(value) {
      const str = String(value);
      super.src = (str.startsWith('data:') || path.isAbsolute(str)) ? str : imageFilePath(str);
    }
    get src() { return super.src; }
  }
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
    Image: BrowserImage, document: documentStub, React, ReactDOM,
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
  return { windowStub, documentStub, React, ReactDOM, Image: BrowserImage };
}

// 画像系ツール向けの互換エクスポート。canvas は呼び出されたときだけ読み込み、
// 正規ビルドや構文チェックからネイティブ依存を切り離したままにする。
function createCanvas(...args) {
  return require('canvas').createCanvas(...args);
}

// index.html が本体より先に読み込むデータ(読み込み順もそのまま)
const DATA_FILES = [
  'data/images/images-ally.js',
  'data/images/images-enemy.js',
  'data/ally-monsters.js',
  // 血統(種族)の正本。種族チャレンジ・超越の実・図鑑の絞り込みがここを引く。
  // 読み込まないと主血統がすべて「？？？」に落ちて、検査が静かに素通りする
  'data/lineages.js',
  'data/breeder.js',
  'data/enemy-monsters.js',
  'data/skills.js',
  'data/changelog.js',
  'data/help.js',
  'data/assistants.js',
];

let _cached = null;

// game-system.jsx を実行し、染色関連のシンボルを返す(何度呼んでも1回だけ実行する)
function loadDyeModule() {
  if (_cached) return _cached;
  const code = transformGameSystem();
  const { windowStub, documentStub, React, ReactDOM, Image } = makeBrowserStubs();
  const sandbox = {
    window: windowStub, document: documentStub, React, ReactDOM, Image,
    localStorage: windowStub.localStorage, navigator: windowStub.navigator, location: windowStub.location,
    matchMedia: windowStub.matchMedia, requestAnimationFrame: windowStub.requestAnimationFrame,
    cancelAnimationFrame: windowStub.cancelAnimationFrame, devicePixelRatio: 1,
    setTimeout, clearTimeout, setInterval, clearInterval, console, Math, Date, JSON,
    atob: (value) => Buffer.from(value, 'base64').toString('binary'),
    fetch: windowStub.fetch, AudioContext: windowStub.AudioContext, webkitAudioContext: windowStub.AudioContext,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  // 本体は index.html で data/*.js を先に読み込んでから動く前提なので、同じ順番で先に流し込む。
  // これが無いと ALL_PLAYER_MONSTERS などを参照する関数を取り出したときだけ落ちる。
  for (const rel of DATA_FILES) {
    const p = path.join(REPO_ROOT, 'monster-hero', rel);
    if (!fs.existsSync(p)) continue;
    vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: rel });
  }
  const exportLine = `\n;globalThis.__dyeExports = { ${EXPORTED_NAMES.join(', ')} };\n`;
  vm.runInContext(code + exportLine, sandbox, { filename: 'game-system.jsx', timeout: 120000 });
  _cached = sandbox.__dyeExports;
  return _cached;
}

// data/images-*.js が持つ画像の場所を { 変数名: monster-hero/ からの相対パス } で取り出す。
// 2026年8月に画像をbase64の埋め込みからPNGファイルへ移したため、値はdataURLではなくパスになる。
// 別名(const MOCCHI_ICON = MOCCHI_IMG;)も辿って、実体のパスへ解決する。
function loadEmbeddedImages() {
  const files = ['images/images-ally.js', 'images/images-enemy.js', 'breeder.js'];
  const map = {};
  const aliases = [];
  for (const f of files) {
    const p = path.join(REPO_ROOT, 'monster-hero', 'data', f);
    if (!fs.existsSync(p)) continue;
    const s = fs.readFileSync(p, 'utf8');
    const re = /(?:const\s+)?([A-Za-z0-9_$]+)\s*[:=]\s*["'`]((?:data:image\/[a-z+]+;base64,[^"'`]*)|(?:images\/[^"'`]+))["'`]/g;
    let m;
    while ((m = re.exec(s))) map[m[1]] = m[2];
    const reAlias = /const\s+([A-Za-z0-9_$]+)\s*=\s*([A-Za-z0-9_$]+)\s*;/g;
    while ((m = reAlias.exec(s))) aliases.push([m[1], m[2]]);
  }
  // 別名は定義順に並んでいるので、前から解決すれば多段の別名も辿れる
  for (const [name, target] of aliases) if (map[target] !== undefined) map[name] = map[target];
  return map;
}

// MASU_COLOR_REGION_HUES のキー(baseId)から、検証に使う立ち絵の場所を引く。
// 変数名は SUEZO_IMG のように baseId の大文字スネークケース + _IMG になっている
function imageForBaseId(baseId, images) {
  const upper = baseId.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
  return images[`${upper}_IMG`] || images[`${upper}_ICON`] || null;
}

// loadEmbeddedImages が返した値(PNGのパス、または昔ながらのdataURL)を
// node-canvas の Image として読む
async function decodeDataUrl(src) {
  const { loadImage } = require('canvas');
  if (typeof src === 'string' && src.startsWith('data:')) {
    return loadImage(Buffer.from(src.split(',')[1], 'base64'));
  }
  return loadImage(imageFilePath(src));
}

// 画像のパス(images/... 。?v= が付いていても可)を実ファイルの絶対パスへ直す。
// 検査用の見本画像のように配信フォルダの外にあるものは、絶対パスをそのまま渡せる
function imageFilePath(rel) {
  const clean = String(rel).split('?')[0];
  return path.isAbsolute(clean) ? clean : path.join(REPO_ROOT, 'monster-hero', clean);
}

// 配信しない原本・見本画像の置き場(tools/art-sources/)。
// 例: artSourcePath('dye-masks', 'undine-dye-mask.PNG')
function artSourcePath(...parts) {
  return path.join(REPO_ROOT, 'tools', 'art-sources', ...parts);
}

module.exports = { REPO_ROOT, GAME_SYSTEM, transformGameSystem, loadDyeModule, loadEmbeddedImages, imageForBaseId, decodeDataUrl, imageFilePath, artSourcePath, createCanvas };
