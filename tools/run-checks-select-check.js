// run-checks.js --changed の選び方を見張る(2026-11-11)。
//
//   node tools/run-checks-select-check.js
//
// きっかけ: 2026-11-11 に数えたら、変えたファイルを名指しで読んでいる検査のうち 43%(1615件中697件)が
// --changed で選ばれていなかった(ファイル名の語だけで選び、当たる語は上限40本で切っていたため)。
// また playbot/sim/hate-sim-check.js は、どの領域にも入らず一度も回っていなかった。
// 選び方は画面に出ないので、壊れても誰も気づかない。ここで機械に確かめさせる。
//
//   ① parts・data のファイルを1つ変えたとき、そのファイルを名指しで読む検査が必ず選ばれる
//      (名指しの見つけ方は run-checks-deps.js とは別に、ここで素朴に書く。片方の取りこぼしをもう片方で拾う)
//   ② tools/ の *-check.js は、どれかの領域に入っている(一度も回らない検査を作らない)
//   ③ FORCE_CHECKS・必須検査・いつも回す検査に書いた検査が、ファイルとして在る
//   ④ 検査そのものを変えたら、その検査が選ばれる
const fs = require('fs');
const path = require('path');
const TOOLS = __dirname;
const ROOT = path.resolve(TOOLS, '..');
const rc = require('./run-checks');
const { buildDepIndex } = require('./run-checks-deps');

let failed = 0;
const ck = (name, ok, detail) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${ok || !detail ? '' : `\n    ${detail}`}`); if (!ok) failed++; };

const areas = rc.discoverAreas();
const all = [];
for (const [name, list] of areas) if (!['required', 'ci'].includes(name)) for (const c of list) if (!all.includes(c)) all.push(c);
const idx = buildDepIndex(all);

// ② どこにも入らない検査
const files = [];
(function walk(dir, rel) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) { if (!['node_modules', 'art-sources', 'out'].includes(f)) walk(full, rel + f + '/'); }
    else if (f.endsWith('-check.js')) files.push(rel + f);
  }
})(TOOLS, '');
const orphan = files.filter(f => !all.includes(f));
ck(`tools/ の *-check.js ${files.length}本が、どれかの領域に入っている`, !orphan.length, `どこにも入らない: ${orphan.join(', ')}`);

// ③ 書いた検査が在る
const listed = new Set([...rc.REQUIRED, ...rc.alwaysChecks(), ...rc.FORCE_CHECKS.flatMap(r => r.checks)]);
const missing = [...listed].filter(c => !fs.existsSync(path.join(TOOLS, c.split(' ')[0])));
ck(`必須・いつも回す・FORCE_CHECKS に書いた検査 ${listed.size}本が在る`, !missing.length, missing.join(', '));

// ① 名指しで読む検査の漏れ
const parts = fs.readdirSync(path.join(ROOT, 'monster-hero/src/parts')).filter(f => f.endsWith('.jsx'));
const sources = new Map(all.map(c => [c, (() => { try { return fs.readFileSync(path.join(TOOLS, c.split(' ')[0]), 'utf8'); } catch { return ''; } })()]));
const users = new Map(); // 変えたファイル -> 名指しで読む検査
const addUser = (f, c) => { if (!users.has(f)) users.set(f, new Set()); users.get(f).add(c); };
for (const [c, src] of sources) {
  for (const p of parts) if (src.includes(p)) addUser(`monster-hero/src/parts/${p}`, c);
  const re = /['"`/](data\/(?:images\/)?[A-Za-z0-9_-]+\.js)['"`]/g;
  let m;
  while ((m = re.exec(src))) if (fs.existsSync(path.join(ROOT, 'monster-hero', m[1]))) addUser(`monster-hero/${m[1]}`, c);
}
let pairs = 0;
const misses = [];
for (const [f, cs] of users) {
  const picked = new Set(rc.planForChanges([f], areas, false, 40, idx).picked);
  for (const c of cs) { pairs++; if (!picked.has(c)) misses.push(`${f} → ${c}`); }
}
ck(`ファイルを1つ変えたとき、名指しで読む検査が選ばれる(${users.size}ファイル・${pairs}組)`, !misses.length && pairs > 500,
  misses.length ? `漏れ ${misses.length}件: ${misses.slice(0, 8).join(' / ')}` : `組が少なすぎる(${pairs})。名指しの見つけ方が壊れていないか`);

// ④ 検査そのものを変えたら選ばれる
const sample = ['card/card-pvp-check.js', 'playbot/sim/hate-sim-check.js', 'run-checks-select-check.js'].filter(c => all.includes(c));
const selfMiss = sample.filter(c => !rc.planForChanges([`tools/${c}`], areas, false, 40, idx).picked.includes(c));
ck(`検査そのものを変えたら、その検査が選ばれる(${sample.length}本)`, sample.length === 3 && !selfMiss.length, `選ばれない: ${selfMiss.join(', ')}`);

// 選び方を変えたら、この検査が選ばれる
const own = rc.planForChanges(['tools/run-checks-deps.js'], areas, false, 40, idx).picked.includes('run-checks-select-check.js');
ck('run-checks-deps.js を変えたら、この検査が選ばれる', own);

console.log(failed ? `\nNG ${failed}件` : '\nすべて OK');
process.exit(failed ? 1 : 0);
