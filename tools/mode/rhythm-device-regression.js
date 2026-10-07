// モンヒロビートの「実機の記録」を、前の版と同じ曲どうしで比べ、悪くなった版を見つける(2026-10-07)。
// ユーザー報告「昨日から色々直してかなりタップ抜けがひどくなった」を、プレイヤーより先に気づけるようにするための道具。
// ユーザー指示「今後音ゲー班がこういうの見つけて直してくれる仕組みを」。音ゲー班が日曜・水曜に回す(tools/playbot/ROUTINE.md)。
//
//   node tools/mode/rhythm-touch-diag.js --fetch           # 先にサーバーから新しい記録を手元へ足す(読むだけ。書き込みはしない)
//   node tools/mode/rhythm-device-regression.js            # 直近4日を、その前の10日と比べる
//   node tools/mode/rhythm-device-regression.js --recent 2 --base 7 [--rows <file>] [--json]
//
// 読むのは tools/mode/authoring/touchdiag/rows.jsonl(タッチの診断。数だけで、名前・ブリーダーIDは入っていない)。
// 同じ端末・同じ曲・同じ難易度のプレイだけを比べる(難しい曲を多く遊んだ日にMISSが増えて見えるのを、悪くなったと取り違えないため)。
// 見るもの:
//   MISS            … 届いたのにMISSも含めた数。1プレイあたりで比べる
//   入力なしMISS     … 押したのにゲームへ何も届かなかった(本当のタップ抜け)
//   拾い直し(touchOnly) … iPhoneがポインタの合図を出さず、タッチから拾い直した数。MISSと連動していれば、拾い直しの経路を疑う
//   ずれ(timing.biasMs) … 押したずれの中央値。0から大きく離れたら、時刻の補正を疑う(2026-10-07は -25〜-51ms だった)
// 「要注意」の目安: 同じ曲で1プレイあたりのMISSが、前の1.5倍以上かつ3以上増えた / ずれの中央値が前より20ms以上動いた。
// 要注意が出たら、その間に入った演奏まわりの変更(git log)も並べる。直し方の決まりは ROUTINE.md「音ゲー班だけの手順」。
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const argOf = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback; };
const ROWS_FILE = path.resolve(ROOT, argOf('rows', 'tools/mode/authoring/touchdiag/rows.jsonl'));
const RECENT_DAYS = Math.max(1, Number(argOf('recent', 4)) || 4);
const BASE_DAYS = Math.max(1, Number(argOf('base', 10)) || 10);
const NOW_MS = Number(argOf('now', '')) || Date.now();
const DAY = 24 * 3600 * 1000;
const MISS_RATIO = 1.5, MISS_PLUS = 3, BIAS_SHIFT_MS = 20;
const INPUT_PATHS = ['monster-hero/data/rhythm-mode.js', 'monster-hero/src/parts/30-rhythm-play.jsx', 'monster-hero/src/parts/14-audio.jsx'];

const readRows = () => {
  if (!fs.existsSync(ROWS_FILE)) return [];
  return fs.readFileSync(ROWS_FILE, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
};
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const jst = (ms) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(5, 16).replace('T', ' ');
const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const median = (list) => { if (!list.length) return null; const s = [...list].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = (v) => (v == null ? '-' : String(Math.round(v * 10) / 10));

// 1行を、比べるのに要る形へ。練習(アシスト)と、数が欠けた行は使わない
const plays = readRows().map((row) => {
  const s = row && typeof row.stats === 'object' ? row.stats : null;
  const at = Date.parse(row && row.created_at);
  if (!s || s.assist || !Number.isFinite(at) || num(s.misses) == null) return null;
  return {
    at, device: String(row.device_key || '').slice(0, 6), platform: row.platform || '?', build: row.app_build || '?',
    song: `${row.song_id || '?'} ${row.difficulty || '?'}`, notes: num(row.note_count) || 0,
    misses: num(s.misses), noInput: num(s.noInputMisses) || 0, touchOnly: num(s.touchOnly) || 0,
    bias: num(s.timing && s.timing.biasMs), fixes: Array.isArray(s.fixes) ? s.fixes : [],
  };
}).filter(Boolean);

const recentFrom = NOW_MS - RECENT_DAYS * DAY, baseFrom = recentFrom - BASE_DAYS * DAY;
const recent = plays.filter((p) => p.at >= recentFrom && p.at <= NOW_MS);
const base = plays.filter((p) => p.at >= baseFrom && p.at < recentFrom);

// 端末×曲×難易度ごとに、前と今を並べる
const groups = new Map();
for (const p of [...base, ...recent]) {
  const key = `${p.device}\u0000${p.song}`;
  const g = groups.get(key) || { device: p.device, platform: p.platform, song: p.song, base: [], recent: [] };
  (p.at < recentFrom ? g.base : g.recent).push(p);
  groups.set(key, g);
}
const rows = [];
for (const g of groups.values()) {
  if (!g.base.length || !g.recent.length) continue;
  const b = { miss: avg(g.base.map((p) => p.misses)), bias: median(g.base.map((p) => p.bias).filter((v) => v != null)) };
  const n = { miss: avg(g.recent.map((p) => p.misses)), bias: median(g.recent.map((p) => p.bias).filter((v) => v != null)) };
  const missWorse = n.miss >= b.miss * MISS_RATIO && n.miss - b.miss >= MISS_PLUS;
  const biasMoved = b.bias != null && n.bias != null && Math.abs(n.bias - b.bias) >= BIAS_SHIFT_MS;
  rows.push({ ...g, b, n, missWorse, biasMoved,
    touchOnlyNow: avg(g.recent.map((p) => p.touchOnly)), noInputNow: avg(g.recent.map((p) => p.noInput)) });
}
rows.sort((x, y) => (Number(y.missWorse) - Number(x.missWorse)) || ((y.n.miss - y.b.miss) - (x.n.miss - x.b.miss)));

// 端末ごとの日別の流れ(千ノーツあたり)。曲がそろわない参考値
const daily = new Map();
for (const p of [...base, ...recent]) {
  const key = `${p.device} ${jst(p.at).slice(0, 5)}`;
  const d = daily.get(key) || { plays: 0, notes: 0, misses: 0, noInput: 0, touchOnly: 0, bias: [] };
  d.plays++; d.notes += p.notes; d.misses += p.misses; d.noInput += p.noInput; d.touchOnly += p.touchOnly; if (p.bias != null) d.bias.push(p.bias);
  daily.set(key, d);
}

// 前の窓の最後のプレイから、今の窓の最初のプレイまでに入った演奏まわりの変更
const flagged = rows.filter((r) => r.missWorse || r.biasMoved);
let commits = [];
if (flagged.length) {
  const since = new Date(Math.min(...flagged.map((r) => Math.max(...r.base.map((p) => p.at))))).toISOString();
  const until = new Date(Math.max(...flagged.map((r) => Math.min(...r.recent.map((p) => p.at))))).toISOString();
  const res = spawnSync('git', ['log', 'origin/main', `--since=${since}`, `--until=${until}`, '--format=%h %ad %s', '--date=format:%m-%d %H:%M', '--', ...INPUT_PATHS], { cwd: ROOT, encoding: 'utf8' });
  commits = String(res.stdout || '').split('\n').filter(Boolean).filter((l) => !/^\w+ \S+ \S+ Merge /.test(l));
}

const result = {
  window: { recent: `${jst(recentFrom)}〜${jst(NOW_MS)}`, base: `${jst(baseFrom)}〜${jst(recentFrom)}` },
  plays: { recent: recent.length, base: base.length },
  compared: rows.map((r) => ({ device: r.device, platform: r.platform, song: r.song, basePlays: r.base.length, recentPlays: r.recent.length,
    missBefore: r.b.miss, missNow: r.n.miss, biasBefore: r.b.bias, biasNow: r.n.bias, touchOnlyNow: r.touchOnlyNow, noInputNow: r.noInputNow,
    missWorse: r.missWorse, biasMoved: r.biasMoved })),
  flagged: flagged.length, commits,
};
if (args.includes('--json')) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }

const out = [];
out.push(`# 実機の記録の比べ(同じ端末・同じ曲どうし)`);
out.push('');
out.push(`- 今: ${result.window.recent}(${recent.length}プレイ) / 前: ${result.window.base}(${base.length}プレイ)`);
if (!plays.length) out.push(`- 記録がありません。先に \`node tools/mode/rhythm-touch-diag.js --fetch\` を打つ`);
out.push(`- 要注意: ${flagged.length}件(MISSが前の${MISS_RATIO}倍以上かつ${MISS_PLUS}以上増えた / ずれの中央値が${BIAS_SHIFT_MS}ms以上動いた)`);
out.push('');
out.push('## 曲ごと(1プレイあたり)');
out.push('');
if (!rows.length) out.push('- 前と今の両方で遊んだ曲がまだありません(比べられない)');
for (const r of rows) {
  const mark = r.missWorse || r.biasMoved ? '⚠' : '・';
  out.push(`${mark} ${r.platform} ${r.device} ${r.song}: MISS ${r1(r.b.miss)} → ${r1(r.n.miss)}(${r.base.length}回 → ${r.recent.length}回)`
    + ` / ずれ ${r1(r.b.bias)} → ${r1(r.n.bias)}ms / 今の拾い直し ${r1(r.touchOnlyNow)} / 今の入力なしMISS ${r1(r.noInputNow)}`
    + `${r.missWorse ? ' ←MISSが増えた' : ''}${r.biasMoved ? ' ←ずれが動いた' : ''}`);
}
out.push('');
out.push('## 端末ごとの日別(千ノーツあたり・曲がそろわない参考値)');
out.push('');
for (const [k, d] of [...daily.entries()].sort()) {
  const per = (v) => r1(d.notes ? v / d.notes * 1000 : null);
  out.push(`- ${k}: ${d.plays}回 MISS ${per(d.misses)} / 入力なしMISS ${per(d.noInput)} / 拾い直し ${per(d.touchOnly)} / ずれの中央値 ${r1(median(d.bias))}ms`);
}
if (flagged.length) {
  out.push('');
  out.push('## その間に入った演奏まわりの変更(疑う順に見る)');
  out.push('');
  out.push(...(commits.length ? commits.map((c) => `- ${c}`) : ['- 見つからない(手元の main が古いなら git fetch origin main)']));
}
console.log(out.join('\n'));
