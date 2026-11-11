// 検査が「実際に読んでいるファイル」から、変更に要る検査を選ぶための索引(2026-11-11)。
//
// 【なぜ要るか】
// run-checks.js --changed は、変えたファイルの名前から語を取り出し、その語を名前に含む検査を選んでいた。
// 2026-11-11 に数えたら、変えたファイルを名指しで読んでいる検査のうち 43%(1615件中697件)が選ばれていなかった
// (例: 82-card-battle-core.jsx を読む検査51本中49本。60-app.jsx を読む検査137本中72本。
//  「app」「core」は語として捨てているので当たらず、当たる語は上限40本で切られる)。
// 検査の中身を見れば「何を読んでいるか」は機械で分かるので、それで選ぶ。
//
// 【2つの段】
//  direct … 検査のソースが、そのファイルを名指ししている(parts の '60-app.jsx'・'data/help.js'・require('./lib'))。
//            確実に要るので、--changed の上限(--limit)の外で必ず選ぶ
//  ident  … 検査が本体全体(game-system.jsx・harness)を読み、探している関数名・定数名が、ある parts の中で
//            1か所だけ定義されている。たぶん要るので、語の当たりより前に並べる(上限の内)
//
// 決めごと: 検査の中身や判定は変えない。ここは「どれを回すか」を決めるだけ。
const fs = require('fs');
const path = require('path');

const TOOLS_DIR = __dirname;
const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
const PARTS_DIR = path.join(REPO_ROOT, 'monster-hero/src/parts');
const DATA_DIR = path.join(REPO_ROOT, 'monster-hero/data');

// require される数がこれより多い道具(harness.js など)は、変えたときに全部を上限の外で回すと重すぎるので ident 段へ回す
const LIB_DIRECT_MAX = 40;

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function listFiles(dir, re, prefix) {
  try { return fs.readdirSync(dir).filter(f => re.test(f)).map(f => prefix + f); } catch { return []; }
}

// 本体の parts で定義されている名前 → 定義しているファイル(1か所だけのもの)
function partDefinitions() {
  const defs = new Map();
  for (const rel of listFiles(PARTS_DIR, /\.jsx$/, 'monster-hero/src/parts/')) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    const re = /(?:^|[\s;(,{])(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]{7,})/g;
    let m;
    const put = (name) => {
      const prev = defs.get(name);
      if (prev === undefined) defs.set(name, rel);
      else if (prev !== rel) defs.set(name, null); // 2か所以上で定義 → 手がかりにしない
    };
    while ((m = re.exec(src))) put(m[1]);
    // 画面を開く検査がボタンを押す目印(data-…)。1つのファイルにしか無いものだけを手がかりにする
    const dre = /\b(data-[a-z0-9]+(?:-[a-z0-9]+)+)\b/g;
    const local = new Set();
    while ((m = dre.exec(src))) local.add(m[1]);
    for (const d of local) put(d);
  }
  return defs;
}

// checks: run-checks の検査コマンド('mode/x-check.js' や 'build.js --check')の一覧
function buildDepIndex(checks) {
  const parts = listFiles(PARTS_DIR, /\.jsx$/, 'monster-hero/src/parts/');
  const data = listFiles(DATA_DIR, /\.js$/, 'monster-hero/data/')
    .concat(listFiles(path.join(DATA_DIR, 'images'), /\.js$/, 'monster-hero/data/images/'));
  const defs = partDefinitions();
  const direct = new Map(); // ファイル -> Set(検査)
  const ident = new Map();
  const libUsers = new Map(); // tools/ の道具 -> Set(検査)
  const sources = new Map(); // 検査 -> ソース(絵・音のファイル名で引くため)
  const add = (map, file, c) => { if (!map.has(file)) map.set(file, new Set()); map.get(file).add(c); };
  // data のファイル名は「help.js」のように短いので、data のすぐ後に書いてあるときだけ名指しとみなす
  // ('data/help.js'・path.join(…,'data','help.js')・'data/images/images-ally.js')
  const dataRes = data.map(rel => {
    const sub = rel.replace(/^monster-hero\/data\//, '');
    const parts2 = sub.split('/').map(escRe);
    return { rel, re: new RegExp(`data['"]?\\s*[,/]\\s*['"]?${parts2.join(`['"]?\\s*[,/]\\s*['"]?`)}\\b`) };
  });
  for (const c of checks) {
    const file = path.join(TOOLS_DIR, c.split(' ')[0]);
    let src = '';
    try { src = fs.readFileSync(file, 'utf8'); } catch { continue; }
    sources.set(c, src);
    for (const rel of parts) if (src.includes(path.basename(rel))) add(direct, rel, c);
    for (const { rel, re } of dataRes) if (re.test(src)) add(direct, rel, c);
    // 検査が require する tools/ の道具
    const reqRe = /require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
    let m;
    while ((m = reqRe.exec(src))) {
      let target = path.resolve(path.dirname(file), m[1]);
      if (!/\.(js|json)$/.test(target)) target += '.js';
      const relLib = path.relative(REPO_ROOT, target).split(path.sep).join('/');
      if (relLib.startsWith('tools/') && fs.existsSync(target)) add(libUsers, relLib, c);
    }
    // 探している名前(文字列・正規表現の中)が、parts のどこか1か所で定義されているもの
    const own = new Set();
    const ownRe = /(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/g;
    while ((m = ownRe.exec(src))) own.add(m[1]);
    const litRe = /'((?:[^'\\\n]|\\.){8,300})'|"((?:[^"\\\n]|\\.){8,300})"|`([^`]{8,300})`|\/((?:[^/\n\\]|\\.){8,300})\//g;
    const seen = new Set();
    while ((m = litRe.exec(src))) {
      const lit = m[1] || m[2] || m[3] || m[4] || '';
      for (const id of (lit.match(/[A-Za-z_$][\w$]{7,}/g) || []).concat(lit.match(/\bdata-[a-z0-9]+(?:-[a-z0-9]+)+\b/g) || [])) {
        if (seen.has(id)) continue;
        seen.add(id);
        if (own.has(id) || !/[a-z][A-Z]|^[A-Z][A-Z0-9_]+$|^data-/.test(id)) continue;
        const rel = defs.get(id);
        if (rel && !(direct.get(rel) && direct.get(rel).has(c))) add(ident, rel, c);
      }
    }
  }
  for (const [lib, users] of libUsers) for (const c of users) add(users.size <= LIB_DIRECT_MAX ? direct : ident, lib, c);
  // 絵・音・そのほかのファイル(索引に無いもの)は、ファイル名(拡張子つき)をソースに書いている検査を、その場で探す
  const named = (rel) => {
    if (direct.has(rel)) return direct.get(rel);
    const base = path.basename(rel);
    const out = new Set();
    if (/^monster-hero\/(images|audio|data)\//.test(rel) && base.length >= 6 && /\.[a-z0-9]{2,4}$/.test(base)) {
      const re = new RegExp(`(^|[^\\w.-])${escRe(base)}(?![\\w.-])`);
      for (const [c, src] of sources) if (re.test(src)) out.add(c);
    }
    direct.set(rel, out);
    return out;
  };
  return { direct, ident, named };
}

module.exports = { buildDepIndex, LIB_DIRECT_MAX };
