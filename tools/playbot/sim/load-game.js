// ゲームの「純粋な部品」(parts.json で pure:true)とデータを、ブラウザなしで読み込む。
// 式はゲームのコードをそのまま使う(写して作り変えない)。React の中にある式だけ sim/formulas.js へ行番号つきで写す。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const DATA = ['data/skills.js', 'data/ally-monsters.js', 'data/enemy-monsters.js'];
const PARTS = ['17-release-changelog-login-missions.jsx', '18-points-and-auto.jsx', '19-difficulties-and-rules.jsx', '22-enemy-and-bond-entries.jsx', '32-tactics-units.jsx'];

// [ファイル, [名前…]]。どれも純粋な定義(画面・state を触らない)
const PICKS = [
  ['10-core.jsx', ['BATTLE_MODE_TACTICS', 'BATTLE_MODE_TACTICS_SPECIES', 'BATTLE_MODE_TACTICS_PRO', 'TACTICS_BATTLE_MODES',
    'BATTLE_MODE_RAID_JACK_A', 'BATTLE_MODE_RAID_JACK_B', 'RAID_JACK_BATTLE_MODES', 'isRaidJackMode', 'isTacticsMode', 'resolveEffectiveMaxStat']],
  ['15-dye-and-art.jsx', ['RANGE_LABELS', 'rangeAttackDamageMultiplier']],
  ['11-masu-progression.jsx', ['combineSoulProbabilityPoints', 'buildUnifiedSpecialDefense', 'rollUnifiedSpecialDefense',
    'MONSTER_POWER_STAT_WEIGHT', 'MONSTER_POWER_APTITUDE', 'MONSTER_POWER_UNIQUE_OWNED', 'MONSTER_POWER_UNIQUE_PER_LEVEL', 'monsterPowerUniques']],
];
// 「const 名前 = …」の1つの定義を、かっこの数が釣り合うところ(行末が ; )まで切り出す
function pickConst(text, name) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`const ${name} `) || l.startsWith(`const ${name}=`));
  if (start < 0) throw new Error(`見つからない: ${name}`);
  let depth = 0;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i].replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')) { if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--; }
    if (depth <= 0 && /;\s*(\/\/.*)?$/.test(lines[i])) return lines.slice(start, i + 1).join('\n');
  }
  throw new Error(`終わりが見つからない: ${name}`);
}

function loadGame() {
  // 画像の定数など、計算に関係のない名前は undefined のまま通す
  const base = { console, Math, Date, JSON, Object, Array, Number, String, Boolean, Set, Map, WeakMap, Symbol, RegExp, Error, Infinity, NaN, parseInt, parseFloat, isFinite, Promise };
  const sandbox = new Proxy(base, {
    has: () => true,
    get: (t, k) => (k in t ? t[k] : (k === Symbol.unscopables ? undefined : undefined)),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  base.globalThis = base;
  const ctx = vm.createContext(sandbox);
  // ★よく使う組み込み(Math・Number・Object…)は、先にスクリプトの const として置く。
  //   置かないと、呼ぶたびに上の Proxy(has: () => true)を通って探すので、EX の関数を何度も呼ぶ
  //   シミュレーターが 10 倍ほど遅くなった(2026-10-10。計算の中身は変わらない)
  const FAST = ['Math', 'Number', 'Object', 'Array', 'String', 'Boolean', 'JSON', 'Set', 'Map', 'Symbol', 'isFinite', 'parseInt', 'parseFloat'];
  let src = `const ${FAST.map((k) => `${k} = globalThis.${k}`).join(', ')};\n`;
  for (const f of DATA) src += `${fs.readFileSync(path.join(GAME, f), 'utf8')}\n;\n`;
  // 16-ranking-detail-and-widgets.jsx の間合い適性の倍率(画面の部品と同じファイルにあるので、この1行だけ取り出す)
  const p16 = fs.readFileSync(path.join(GAME, 'src', 'parts', '16-ranking-detail-and-widgets.jsx'), 'utf8');
  src += `${(p16.match(/^const DIST_APTITUDE_MULT = .*$/m) || ['const DIST_APTITUDE_MULT = {};'])[0]}\n`;
  // 画面の部品と同じファイルにある定義のうち、計算に要るものだけを名前で取り出す。
  // ★isTacticsMode が無いと createBattleEnemy(…, {mode:'tacticsPro'}) がクラシックの敵(ディノなど)を返す
  //   (2026-10-09 に気づいた。desk.md の敵の数字はこの直し前のもの)
  for (const [file, names] of PICKS) {
    const text = fs.readFileSync(path.join(GAME, 'src', 'parts', file), 'utf8');
    for (const name of names) src += `${pickConst(text, name)}\n`;
  }
  for (const f of PARTS) src += `${fs.readFileSync(path.join(GAME, 'src', 'parts', f), 'utf8')}\n;\n`;
  // const で宣言した名前は globalThis に載らないので、使うものを書き出す
  const names = [...src.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  src += `\n;globalThis.__G = {${[...new Set(names)].map((n) => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',')}};`;
  if (process.env.SIM_DUMP) fs.writeFileSync(process.env.SIM_DUMP, src);
  vm.runInContext(src, ctx, { filename: 'game-pure.js' });
  return base.__G;
}

module.exports = { loadGame };
if (require.main === module) {
  const G = loadGame();
  const keys = Object.keys(G).filter((k) => G[k] !== undefined);
  console.log(`読み込めた名前: ${keys.length}`);
  for (const k of ['ALL_PLAYER_MONSTERS', 'TACTICS_ENEMY_DATA', 'TACTICS_ENEMY_SEQUENCE', 'DIFFICULTY_SETTINGS', 'createBattleEnemy', 'chooseEnemyAction', 'tacticsEnemyPowerMultiplier', 'createTacticsUnit', 'BASE_ATK_EVOLUTION', 'getMonsterAptPct', 'TACTICS_EX_SKILLS', 'buildAttackHits']) console.log(k, typeof G[k]);
}
