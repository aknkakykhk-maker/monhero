#!/usr/bin/env node
// 使用量の記録(docs/playbot/dashboard/usage.json)へ1行足し、使用率のページ(usage.html)を作り直す。窓口が毎晩使う。
//
//   node tools/playbot/usage-snapshot.js --add '{"at":"2026-10-14 02:52","sessions":{"session_…":{"name":"窓口 統括部長モンヒロくん","dept":"窓口","cost_usd":12.3,"used_tokens":456789}}}'
//       毎晩の記録(get_session の usage.cost_usd。値は累積のまま書く)。同じ at の記録があれば置き換える
//   node tools/playbot/usage-snapshot.js --calibrate '{"at":"2026-10-14 09:00","percent":37}'
//       社長が claude.ai の使用量画面で見た週の%。total_cost_usd を省くと、その時点の週の合計を記録から数える
//   node tools/playbot/usage-snapshot.js --reset <曜日0〜6(0=日)> <時0〜23>
//       週の切り替わり(社長に聞いて書く)
//   いずれも --data <usage.json> で別のファイルに書ける(試すとき)
'use strict';
const fs = require('fs');
const path = require('path');
const U = require('./usage-lib.js');

const argv = process.argv.slice(2);
const at = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const FILE = at('--data') ? path.resolve(at('--data')) : U.DEFAULT_FILE;
const fail = (msg) => { console.error('NG: ' + msg); process.exit(1); };

const raw = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const data = { weekResetDow: null, weekResetHour: null, calibrations: [], snapshots: [], ...raw };

function parseJson(s, what) {
  try { return JSON.parse(s); } catch (e) { return fail(`${what} の JSON が読めません(${e.message})`); }
}

if (at('--add') != null) {
  const snap = parseJson(at('--add'), '--add');
  const problems = U.validateSnapshot(snap);
  if (problems.length) fail('記録の形が違います:\n  - ' + problems.join('\n  - '));
  data.snapshots = data.snapshots.filter((s) => s.at !== snap.at);
  data.snapshots.push(snap);
  data.snapshots.sort((a, b) => U.parseAt(a.at) - U.parseAt(b.at));
  console.log(`足した: ${snap.at} の記録(会話 ${Object.keys(snap.sessions).length} 件)`);
} else if (at('--calibrate') != null) {
  const c = parseJson(at('--calibrate'), '--calibrate');
  if (U.parseAt(c.at) == null) fail('at は "2026-10-14 09:00" の形(日本時間)にする');
  if (!Number.isFinite(c.percent) || c.percent < 0 || c.percent > 100) fail('percent は 0〜100 の数にする');
  if (c.total_cost_usd != null && !(Number.isFinite(c.total_cost_usd) && c.total_cost_usd > 0)) fail('total_cost_usd は正の数にする(省けば記録から数える)');
  data.calibrations = data.calibrations.filter((x) => x.at !== c.at);
  data.calibrations.push(c);
  console.log(`合わせた: ${c.at} に週 ${c.percent}%`);
} else if (argv.includes('--reset')) {
  const ri = argv.indexOf('--reset');
  const dow = Number(argv[ri + 1]), hour = Number(argv[ri + 2]);
  if (!Number.isInteger(dow) || dow < 0 || dow > 6 || !Number.isInteger(hour) || hour < 0 || hour > 23) fail('--reset <曜日0〜6(0=日)> <時0〜23>');
  data.weekResetDow = dow; data.weekResetHour = hour;
  console.log(`週の切り替わり: 毎週${U.DOW[dow]}曜 ${hour}時`);
} else {
  fail('--add / --calibrate / --reset のどれかを付ける(使い方はこのファイルの頭)');
}

fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
// ページも作り直す(出し直しは窓口が Artifact で)
const page = require('./usage-page.js');
const out = path.join(path.dirname(FILE), 'usage.html');
fs.writeFileSync(out, page.build(U.normalize(data)));
console.log('作り直した: ' + path.relative(process.cwd(), out));
