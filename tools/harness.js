// game-system.jsx から染色もどきのロジックだけを Node 上に取り出すための共通ヘルパー。
// 本体はブラウザ用の1枚岩スクリプト(exportが無く、末尾でReactDOMのレンダリングまで実行する)なので、
// Babelで変換 → 末尾にエクスポート行を追記 → 最小限のブラウザスタブを載せたvmで実行、という手順を踏む。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const REPO_ROOT = path.resolve(__dirname, '..');
const GAME_SYSTEM = path.join(REPO_ROOT, 'monster-hero', 'src', 'game-system.jsx');

// ==== 編集元の部品(parts)と、連結生成物 game-system.jsx ====
// game-system.jsx は 25,000 行を超える1枚岩だったので、編集元を monster-hero/src/parts/*.jsx に分け、
// game-system.jsx は parts を parts.json の順に連結した「生成物」にした(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 2)。
// 生成物を残す理由: 検査 300 本以上と undefined-reference-check / render-error-check が game-system.jsx を
// 読む前提で書かれており、連結後の1枚を今までどおり置いておけば、それらを1本も書き換えずに済む。
// 部品ごとの区切りには目印の行(PART_MARK)を入れ、game-system.jsx 側を直接編集した場合でも
// parts へ書き戻せるようにしてある(build.js の syncPartsAndGameSystem)。
const PARTS_DIR = path.join(REPO_ROOT, 'monster-hero', 'src', 'parts');
const PARTS_MANIFEST = path.join(PARTS_DIR, 'parts.json');
const PART_MARK_PREFIX = '// ---- part: ';
const PART_MARK_SUFFIX = ' ----';
const partMark = (name) => `${PART_MARK_PREFIX}${name}${PART_MARK_SUFFIX}`;
const GENERATED_HEADER_KEY = 'generated-sha256:';

function readPartsManifest() {
  const manifest = JSON.parse(fs.readFileSync(PARTS_MANIFEST, 'utf8'));
  const names = (manifest.parts || []).map((p) => (typeof p === 'string' ? p : p.file));
  if (!names.length) throw new Error('parts.json に部品がありません');
  return names;
}

// parts を順に連結した本文(ヘッダ無し)。末尾は必ず改行1つにそろえる
function assembleParts() {
  return readPartsManifest().map((name) => {
    const body = fs.readFileSync(path.join(PARTS_DIR, name), 'utf8').replace(/\n*$/, '\n');
    return `${partMark(name)}\n${body}`;
  }).join('\n');
}

function sha16(text) {
  return require('crypto').createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function generatedHeader(hash) {
  return [
    '// ============================================================',
    '// このファイルは tools/build.js が monster-hero/src/parts/*.jsx を parts.json の順に連結して生成したものです。',
    '// 編集は parts/ 側で行い、`node tools/build.js` で作り直します。',
    '// (このファイルを直接編集した場合も、parts 側が未変更なら build.js が parts へ書き戻します)',
    `// ${GENERATED_HEADER_KEY} ${hash}`,
    '// ============================================================',
    '',
  ].join('\n');
}

// game-system.jsx を「ヘッダ」「本文」「ヘッダに書かれたハッシュ」に分ける。ヘッダが無ければ hash は null
function splitGeneratedFile(text) {
  const m = text.match(/^\/\/ =+\n(?:\/\/[^\n]*\n)*?\/\/ generated-sha256: ([0-9a-f]+)\n\/\/ =+\n\n?/);
  if (!m) return { header: '', body: text, hash: null };
  return { header: m[0], body: text.slice(m[0].length), hash: m[1] };
}

// 連結本文を目印の行で parts へ分け直す(game-system.jsx を直接編集したときの書き戻し)
function splitBodyIntoParts(body) {
  const names = readPartsManifest();
  const out = new Map();
  const re = new RegExp(`^${PART_MARK_PREFIX.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(.+?)${PART_MARK_SUFFIX.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'm');
  let rest = body;
  const first = rest.match(re);
  if (!first || first.index !== 0) throw new Error('game-system.jsx の先頭に部品の目印(// ---- part: ... ----)がありません。parts から作り直してください: node tools/build.js --from-parts');
  while (rest.length) {
    const m = rest.match(re);
    if (!m) break;
    const name = m[1];
    if (!names.includes(name)) throw new Error(`parts.json に無い部品の目印です: ${name}`);
    const afterMark = rest.slice(m.index + m[0].length + 1);
    const next = afterMark.match(re);
    const content = next ? afterMark.slice(0, next.index) : afterMark;
    // 連結時に部品のあいだへ入れた空行1つを外し、末尾は改行1つにそろえる
    out.set(name, content.replace(/\n*$/, '\n'));
    rest = next ? afterMark.slice(next.index) : '';
  }
  for (const name of names) if (!out.has(name)) throw new Error(`部品 ${name} の目印が game-system.jsx にありません`);
  return out;
}

// parts と game-system.jsx のどちらが新しいかを見て、そろえる。
//   ・どちらも未変更 → 何もしない
//   ・parts だけ変わった → game-system.jsx を作り直す
//   ・game-system.jsx だけ変わった(モバイルで直接編集など) → parts へ書き戻してから作り直す
//   ・両方が別々に変わった → 止める(どちらを正とするか人が決める)
// dryRun のときは書かず、必要な動作だけ返す
function syncPartsAndGameSystem({ dryRun = false, fromParts = false } = {}) {
  const assembled = assembleParts();
  const assembledHash = sha16(assembled);
  const exists = fs.existsSync(GAME_SYSTEM);
  const current = exists ? splitGeneratedFile(fs.readFileSync(GAME_SYSTEM, 'utf8')) : { body: '', hash: null };
  const bodyHash = sha16(current.body);
  const write = () => { if (!dryRun) fs.writeFileSync(GAME_SYSTEM, generatedHeader(assembledHash) + assembled); };
  if (fromParts || !exists || current.hash === null) { write(); return { action: 'assembled', reason: fromParts ? '--from-parts' : 'game-system.jsx にヘッダが無い(初回)' }; }
  if (bodyHash === assembledHash) {
    if (current.hash !== assembledHash) write(); // 本文は同じでヘッダのハッシュだけ古い
    return { action: 'none' };
  }
  const partsChanged = assembledHash !== current.hash;
  const jsxChanged = bodyHash !== current.hash;
  if (partsChanged && !jsxChanged) { write(); return { action: 'assembled', reason: 'parts が変わった' }; }
  if (jsxChanged && !partsChanged) {
    const pieces = splitBodyIntoParts(current.body);
    if (!dryRun) {
      for (const [name, content] of pieces) fs.writeFileSync(path.join(PARTS_DIR, name), content);
      fs.writeFileSync(GAME_SYSTEM, generatedHeader(sha16(assembleParts())) + assembleParts());
    }
    return { action: 'split', reason: 'game-system.jsx が直接編集されていたので parts へ書き戻した' };
  }
  throw new Error('parts と game-system.jsx の両方が別々に変更されています。どちらを正とするか決めて、parts を正にするなら `node tools/build.js --from-parts`、game-system.jsx を正にするなら parts を git checkout で戻してから `node tools/build.js` を実行してください');
}

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
  'EXACT_DYE_MASKS',
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
  'buildAutoRepeatBreakthroughSettingUpdate',
  'buildAutoRepeatBreakthroughUpdate',
  'BREAKTHROUGH_LEVEL_CAPS',
  'breakthroughLevelCap',
  'levelUpPointMultiplier',
  'levelBasedEnhancePoints',
  'gainedEnhancePointsBetweenLevels',
  'legacyRetroactiveLevelBasedEnhancePoints',
  'repairEnhancePointBandOvergrant',
  'ENHANCE_POINT_BAND_REPAIR_VERSION',
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
  'saveStoredValuesOrRollback',
  'saveTranscendFruitPair',
  'buildMarketItemPurchase',
  'saveMarketBalances',
  'CLEAR_PSYCHE_REWARD',
  'clearPsycheReward',
  'DIFFICULTY_SETTINGS',
  'SPECIES_CHALLENGE_DIFFICULTY_IDS',
  'SPECIES_CHALLENGE_PROGRESS_KEY',
  'normalizeSpeciesChallengeProgress',
  'speciesChallengeProfileSummary',
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
    // 本体は class X extends React.Component を持つ(エラー境界)。読み込み時に評価されるので土台だけ要る
    Component: class { setState() {} }, PureComponent: class { setState() {} },
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
    // `images/assistant/face/momosuke_${key}.PNG` のような組み立て式は、
    // そのままではファイル名にならない。実在確認の対象から外す。
    // (以前はこれも拾っており、たまたま同じ名前の後ろの行で上書きされて隠れていた。
    //  2026-09-05に breeder.js の直書きを定数へまとめたら表に出た)
    while ((m = re.exec(s))) { if (m[2].includes('${')) continue; map[m[1]] = m[2]; }
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

module.exports = { REPO_ROOT, GAME_SYSTEM, PARTS_DIR, PARTS_MANIFEST, readPartsManifest, assembleParts, syncPartsAndGameSystem, splitGeneratedFile, generatedHeader, transformGameSystem, loadDyeModule, loadEmbeddedImages, imageForBaseId, decodeDataUrl, imageFilePath, artSourcePath, createCanvas };
