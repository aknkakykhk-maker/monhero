// 検査の一覧(棚卸し)を作る(2026-11-11)。
//
//   node tools/checks-inventory.js [--json <run-checks の --json 出力>] [--out docs/ops/checks]
//
// 1本ごとに「何を見るか・かかった秒数・ブラウザを使うか・いつも回すか・CI で回るか・最近30日で直された回数・
// 今回の結果・名指しで読む本体のファイル数・ソースがいちばん似ている検査」を並べ、inventory.tsv と要約(INVENTORY.md)へ書く。
// 「直された回数」は落ちた回数の代わり(落ちた記録は残っていないので、検査のファイルが書き換わった回数で見る)。
// 似ている検査は、字句の8語の並びがどれだけ重なるか(小さいほうの何割が大きいほうに含まれるか)。0.75 以上だけ出す。
// 決めごと: 見て書くだけ。検査も選び方も変えない。消すかどうかは人が INVENTORY.md を見て決める。
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const TOOLS = __dirname;
const ROOT = path.resolve(TOOLS, '..');
const rc = require('./run-checks');
const { buildDepIndex } = require('./run-checks-deps');

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const outDir = path.resolve(ROOT, opt('--out') || 'docs/ops/checks');
const jsonFile = opt('--json');

const areas = rc.discoverAreas();
const all = [];
const areaOf = new Map();
for (const [name, list] of areas) if (!['required', 'ci', 'always', 'docs'].includes(name)) for (const c of list) if (!all.includes(c)) { all.push(c); areaOf.set(c, name); }
const always = new Set(areas.get('always'));
const ci = new Set(areas.get('ci'));
const required = new Set(areas.get('required'));

const run = jsonFile ? JSON.parse(fs.readFileSync(jsonFile, 'utf8')) : null;
const result = new Map((run ? run.results : []).map(r => [r.command, r]));
const times = (() => { try { return JSON.parse(fs.readFileSync(path.join(TOOLS, 'run-checks-times.json'), 'utf8')).times || {}; } catch { return {}; } })();

// 最近30日で書き換わった回数
const churn = new Map();
const log = spawnSync('git', ['log', '--since=30 days ago', '--no-merges', '--name-only', '--format=', '--', 'tools'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).stdout || '';
for (const f of log.split('\n')) if (f.startsWith('tools/')) { const c = f.slice(6); churn.set(c, (churn.get(c) || 0) + 1); }

const idx = buildDepIndex(all);
const directCount = new Map();
for (const [, set] of idx.direct) for (const c of set) directCount.set(c, (directCount.get(c) || 0) + 1);

const src = new Map(all.map(c => [c, (() => { try { return fs.readFileSync(path.join(TOOLS, c.split(' ')[0]), 'utf8'); } catch { return ''; } })()]));
const descOf = (s) => { for (const l of s.split('\n').slice(0, 40)) { const t = l.trim(); if (t.startsWith('//')) { const b = t.replace(/^\/\/\s?/, '').trim(); if (b && !/^TOOLS_DIR|^node tools/.test(b)) return b; } } return ''; };
const browserOf = (s) => /require\(['"]playwright['"]\)|localhost:8899|chromium/.test(s);

// 似ている検査
const grams = new Map();
for (const c of all) {
  const t = src.get(c).replace(/\/\/[^\n]*/g, '').match(/[\w$]+|[^\s\w]/g) || [];
  const set = new Set();
  for (let i = 0; i + 8 <= t.length; i++) set.add(t.slice(i, i + 8).join(' '));
  grams.set(c, set);
}
const similar = new Map();
for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
  const a = grams.get(all[i]), b = grams.get(all[j]);
  if (a.size < 50 || b.size < 50) continue;
  const [s, l] = a.size < b.size ? [a, b] : [b, a];
  if (s.size / l.size < 0.3) continue;
  let n = 0; for (const x of s) if (l.has(x)) n++;
  const v = n / s.size;
  if (v < 0.75) continue;
  for (const [x, y] of [[all[i], all[j]], [all[j], all[i]]]) if (!similar.has(x) || similar.get(x).v < v) similar.set(x, { other: y, v });
}

const rows = all.map(c => {
  const r = result.get(c);
  const sec = r && Number.isFinite(r.sec) ? r.sec : times[c];
  return {
    c, area: areaOf.get(c), desc: descOf(src.get(c)).replace(/\t/g, ' ').slice(0, 120), sec: Number.isFinite(sec) ? sec : null,
    browser: browserOf(src.get(c)), always: always.has(c), ci: ci.has(c), required: required.has(c),
    churn: churn.get(c.split(' ')[0]) || 0, status: r ? r.status : '', direct: directCount.get(c) || 0,
    similar: similar.has(c) ? `${similar.get(c).other}(${similar.get(c).v.toFixed(2)})` : '',
  };
});

fs.mkdirSync(outDir, { recursive: true });
const head = ['検査', '領域', '何を見るか', '秒', 'ブラウザ', 'いつも', 'CI', '必須', '30日で直された回数', '今回', '名指しで読む本体のファイル', '似ている検査'];
fs.writeFileSync(path.join(outDir, 'inventory.tsv'), [head.join('\t'), ...rows.map(r => [r.c, r.area, r.desc, r.sec == null ? '' : r.sec, r.browser ? '○' : '', r.always ? '○' : '', r.ci ? '○' : '', r.required ? '○' : '', r.churn, r.status, r.direct, r.similar].join('\t'))].join('\n') + '\n');

const sum = (list) => Math.round(list.reduce((a, r) => a + (r.sec || 0), 0));
const byArea = new Map();
for (const r of rows) { if (!byArea.has(r.area)) byArea.set(r.area, []); byArea.get(r.area).push(r); }
const lines = [];
lines.push('# 検査の一覧(棚卸し)', '');
lines.push(`作り方: \`node tools/checks-inventory.js${jsonFile ? ' --json <全部回した結果>' : ''}\`(${new Date().toISOString().slice(0, 10)})。1本ごとの表は [inventory.tsv](inventory.tsv)。`, '');
lines.push(`- 検査 ${rows.length}本(ブラウザを使う ${rows.filter(r => r.browser).length}本・いつも回す ${rows.filter(r => r.always).length}本・CI ${rows.filter(r => r.ci).length}本)`);
lines.push(`- 1本ずつ回したときの合計 ${Math.round(sum(rows) / 60)}分(秒数が分かる ${rows.filter(r => r.sec != null).length}本)`);
if (run) lines.push(`- 今回: OK ${rows.filter(r => r.status === 'OK').length} / NG ${rows.filter(r => r.status === 'NG').length} / TIMEOUT ${rows.filter(r => r.status === 'TIMEOUT').length} / SKIP ${rows.filter(r => r.status === 'SKIP').length}`);
lines.push('', '## 領域ごと', '', '| 領域 | 本数 | ブラウザ | 合計(分) | 30日で直された回数 |', '| --- | ---: | ---: | ---: | ---: |');
for (const [a, list] of [...byArea].sort((x, y) => sum(y[1]) - sum(x[1]))) lines.push(`| ${a} | ${list.length} | ${list.filter(r => r.browser).length} | ${(sum(list) / 60).toFixed(1)} | ${list.reduce((n, r) => n + r.churn, 0)} |`);
lines.push('', '## 重い検査(上位20本)', '', '| 検査 | 秒 | 何を見るか |', '| --- | ---: | --- |');
for (const r of rows.filter(r => r.sec != null).sort((a, b) => b.sec - a.sec).slice(0, 20)) lines.push(`| ${r.c} | ${r.sec} | ${r.desc.slice(0, 60)} |`);
lines.push('', '## よく直される検査(30日で5回以上)', '', '書き方が本体の小さな変化に弱い(文字の並びをそのまま探している等)ものが多い。直すときは docs/rules/BUILD_CHECKS.md「検査を書くとき・直すときの決めごと」へ。', '', '| 検査 | 回数 |', '| --- | ---: |');
for (const r of rows.filter(r => r.churn >= 5).sort((a, b) => b.churn - a.churn)) lines.push(`| ${r.c} | ${r.churn} |`);
lines.push('', '## ソースがよく似ている組(0.75以上)', '', '似ているだけで、見ている中身(縦画面と横画面・相手の顔ぶれ・モンスターごと)は別のことが多い。**消すのは、同じことを別の検査が確実に見ているときだけ。**', '', '| 検査 | 似ている検査(重なり) |', '| --- | --- |');
const shown = new Set();
for (const r of rows.filter(r => r.similar).sort((a, b) => a.c.localeCompare(b.c))) { const k = [r.c, r.similar.replace(/\(.*$/, '')].sort().join('|'); if (shown.has(k)) continue; shown.add(k); lines.push(`| ${r.c} | ${r.similar} |`); }
if (run) {
  const bad = rows.filter(r => r.status && !['OK', 'SKIP'].includes(r.status));
  lines.push('', '## 今回落ちた検査', '', bad.length ? '| 検査 | 結果 |\n| --- | --- |' : '(なし)');
  for (const r of bad) lines.push(`| ${r.c} | ${r.status} |`);
}
fs.writeFileSync(path.join(outDir, 'INVENTORY.md'), lines.join('\n') + '\n');
console.log(`書いた: ${path.relative(ROOT, outDir)}/INVENTORY.md・inventory.tsv(検査 ${rows.length}本)`);
