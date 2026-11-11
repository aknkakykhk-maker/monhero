// 助手のマスモンのオートバトルの計算(monster-hero/data/assistant-masmon-battle.js)を、
// ゲームの技データ(ally-monsters.js・skills.js)と一緒に Node で読み込む。画面は開かない。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA = path.join(ROOT, 'monster-hero', 'data');

// 絵の定数(EIKI_IMG など)は計算に要らないので、見つからない名前は空の文字で埋めて読み直す
const evalData = (files, exportNames) => {
  const src = files.map(f => fs.readFileSync(path.join(DATA, f), 'utf8')).join('\n;\n')
    + `\n;globalThis.__out = { ${exportNames.join(', ')} };`;
  const stubs = {};
  for (let i = 0; i < 400; i++) {
    const ctx = vm.createContext(Object.assign({}, stubs));
    try {
      vm.runInContext(src, ctx, { filename: 'data-bundle.js' });
      return ctx.__out;
    } catch (e) {
      const m = e instanceof Error || (e && e.name) ? /^(\w+) is not defined/.exec(String(e.message)) : null;
      if (!m) throw e;
      stubs[m[1]] = '';
    }
  }
  throw new Error('データの読み込みが終わらない');
};

let cached = null;
const load = () => {
  if (cached) return cached;
  const data = evalData(['ally-monsters.js'], ['ALL_PLAYER_MONSTERS']);
  // 技表: 本番(シュギョウの assistant-masmon-techs.js)があればそれ、無ければ仮(draft-techs.js)
  const techFile = path.join(DATA, 'assistant-masmon-techs.js');
  data.ASSISTANT_MASMON_TECHS = fs.existsSync(techFile)
    ? evalData(['assistant-masmon-techs.js'], ['ASSISTANT_MASMON_TECHS']).ASSISTANT_MASMON_TECHS
    : require('./draft-techs.js').makeDraftTechs(data.ALL_PLAYER_MONSTERS);
  const enginePath = path.join(DATA, 'assistant-masmon-battle.js');
  delete require.cache[enginePath];
  const engine = require(enginePath);
  const catalog = engine.buildCatalog(data);
  cached = { engine, catalog, data };
  return cached;
};

// 種から決まる「それらしい」マスモン(集計用)。総量 total を6能力に振る
const makeUnit = (engine, catalog, rng, opts = {}) => {
  const ids = Object.keys(catalog.species);
  const species = opts.species || ids[Math.floor(rng() * ids.length)];
  const total = opts.total || 1800;
  const w = engine.STAT_KEYS.map(() => 0.5 + rng());
  const sum = w.reduce((a, b) => a + b, 0);
  const stats = {};
  engine.STAT_KEYS.forEach((k, i) => { stats[k] = Math.min(999, Math.round(total * w[i] / sum)); });
  if (opts.stats) Object.assign(stats, opts.stats);
  return { species, name: catalog.species[species].name, lv: opts.lv || 1 + Math.floor(rng() * 99), stats };
};

module.exports = { ROOT, load, makeUnit };
