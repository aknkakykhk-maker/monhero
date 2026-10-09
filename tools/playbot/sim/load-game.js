// ゲームの「純粋な部品」(parts.json で pure:true)とデータを、ブラウザなしで読み込む。
// 式はゲームのコードをそのまま使う(写して作り変えない)。React の中にある式だけ sim/formulas.js へ行番号つきで写す。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const DATA = ['data/skills.js', 'data/ally-monsters.js', 'data/enemy-monsters.js'];
const PARTS = ['17-release-changelog-login-missions.jsx', '18-points-and-auto.jsx', '19-difficulties-and-rules.jsx', '22-enemy-and-bond-entries.jsx', '32-tactics-units.jsx'];

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
  let src = '';
  for (const f of DATA) src += `${fs.readFileSync(path.join(GAME, f), 'utf8')}\n;\n`;
  // 16-ranking-detail-and-widgets.jsx の間合い適性の倍率(画面の部品と同じファイルにあるので、この1行だけ取り出す)
  const p16 = fs.readFileSync(path.join(GAME, 'src', 'parts', '16-ranking-detail-and-widgets.jsx'), 'utf8');
  src += `${(p16.match(/^const DIST_APTITUDE_MULT = .*$/m) || ['const DIST_APTITUDE_MULT = {};'])[0]}\n`;
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
