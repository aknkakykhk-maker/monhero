// モンヒロサクセスの台本(docs/progress/player-raise/script/*.js・正本)を、ゲームが読む形(生成物)へ組み立てる。
//   node tools/success/build-script.js          … monster-hero/data/monhero-success-script-<common|助手>.js を作り直す
//   node tools/success/build-script.js --check  … 台本と食い違っていないかだけ見る(違えば NG で止まる)
// 生成物は手で直さない。台本を直したら、これを打つ。読み方・選び方は data/monhero-success-script-engine.js。
// 分け方: 助手の行(who が助手)・その助手のシナリオ(scn.<助手>.*)・博士とのかけ合い(issa.tease.<助手>*)は助手ごとのファイルへ。
//         地の文・選択肢の札・イッサ博士・モンスターの声・ライバルの持ち主の行(ev.rival.owner.*)・見出しの表は common へ。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'docs', 'progress', 'player-raise', 'script');
const OUT_DIR = path.join(ROOT, 'monster-hero', 'data');
const ASSTS = ['mua', 'atsu', 'kiki', 'momosuke', 'dra', 'kyuko', 'sorashido', 'erubin'];
const KEEP = ['id', 'who', 'e', 'face', 'c', 'end', 'bond', 't']; // ゲームに要る項目だけ(並びもこの順)

const readAll = () => {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js') && f !== 'heads.js').sort();
  const rows = [];
  for (const f of files) {
    const p = path.join(DIR, f);
    delete require.cache[p];
    const list = Object.values(require(p)).find(Array.isArray);
    if (!list) throw new Error(`${f} に台本の配列が無い`);
    for (const r of list) rows.push(r);
  }
  const hp = path.join(DIR, 'heads.js'); delete require.cache[hp];
  const heads = require(hp).MONSUC_SCRIPT_HEADS.map(h => ({ prefix: h.prefix, head: h.head, label: h.label }));
  return { rows, heads, files };
};
const partOf = (r) => {
  const m = /^scn\.([a-z]+)\./.exec(r.id) || /^issa\.tease\.([a-z]+?)\d*\./.exec(r.id);
  if (m && ASSTS.includes(m[1])) return m[1];
  if (r.id.startsWith('ev.rival.owner.')) return 'common';
  return ASSTS.includes(r.who) ? r.who : 'common';
};
const slim = (r) => { const o = {}; for (const k of KEEP) if (r[k] !== undefined) o[k] = r[k]; return o; };

const render = (key, rows, heads) => [
  `// モンヒロサクセスの台本(${key === 'common' ? '共通' : `助手 ${key}`})。★tools/success/build-script.js が作る生成物。手で直さない`,
  '// 正本: docs/progress/player-raise/script/*.js。読み方は data/monhero-success-script-engine.js',
  '(function (root) {',
  '  \'use strict\';',
  '  const rows = [',
  ...rows.map(r => `    ${JSON.stringify(slim(r))},`),
  '  ];',
  heads ? `  const heads = ${JSON.stringify(heads)};` : '  const heads = null;',
  '  const part = Object.freeze({ rows: Object.freeze(rows), heads });',
  '  if (root) { root.MONSUC_SCRIPT_PARTS = root.MONSUC_SCRIPT_PARTS || {}; root.MONSUC_SCRIPT_PARTS[' + JSON.stringify(key) + '] = part; }',
  '  if (typeof module !== \'undefined\' && module.exports) module.exports = part;',
  '})(typeof globalThis !== \'undefined\' ? globalThis : this);',
  '',
].join('\n');

const build = () => {
  const { rows, heads } = readAll();
  const by = { common: [] }; for (const a of ASSTS) by[a] = [];
  for (const r of rows) by[partOf(r)].push(r);
  const out = {};
  for (const [k, list] of Object.entries(by)) out[path.join(OUT_DIR, `monhero-success-script-${k}.js`)] = render(k, list, k === 'common' ? heads : null);
  return { out, by, total: rows.length };
};

if (require.main === module) {
  const { out, by, total } = build();
  if (process.argv.includes('--check')) {
    const bad = Object.entries(out).filter(([p, text]) => !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text).map(([p]) => path.basename(p));
    if (bad.length) { console.log(`NG: 台本の生成物が台本と食い違っている(${bad.join(', ')})→ node tools/success/build-script.js`); process.exit(1); }
    console.log(`OK: 台本の生成物 ${Object.keys(out).length}ファイルは台本と同じ(${total}本)`);
  } else {
    for (const [p, text] of Object.entries(out)) fs.writeFileSync(p, text);
    console.log(`作った: ${Object.entries(by).map(([k, l]) => `${k} ${l.length}本(${Math.round(Buffer.byteLength(out[path.join(OUT_DIR, `monhero-success-script-${k}.js`)]) / 1024)}KB)`).join(' / ')}`);
  }
}

module.exports = { build, partOf, ASSTS, DIR, OUT_DIR };
