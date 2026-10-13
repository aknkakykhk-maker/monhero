// Claude の使用量の記録(docs/playbot/dashboard/usage.json)を読み、日ごと・週ごと・部署ごとの量と%(目安)に直す。
// usage-page.js(ページ)と usage-snapshot.js(追記)が使う。
//
// usage.json の形(2026-10-13 社長「週間のクロードの使用率を目安でも良いから%で、日別と週別のグラフで見たい」):
//   snapshots:    [{ at:"2026-10-14 02:52", sessions:{ <session_id>:{ name, dept, cost_usd, used_tokens } } }]
//                 窓口が毎晩 get_session の usage.cost_usd を書く。値は会話ごとの累積なので、前の記録との差がその間の使用量
//   calibrations: [{ at:"2026-10-14 09:00", percent:37, total_cost_usd:123.4 }]
//                 社長が claude.ai の使用量画面で見た週の%。total_cost_usd はその時点の週の合計(省けば記録から数える)。
//                 percent ÷ total_cost_usd が「1ドルあたり何%」。いちばん新しいものを使う
//   weekResetDow / weekResetHour: 週の切り替わり(0=日曜〜6=土曜 / 0〜23時。日本時間)。未設定なら仮に月曜0時
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_FILE = path.join(ROOT, 'docs', 'playbot', 'dashboard', 'usage.json');
// 夜中の記録(2:52 など)は前の日の分として数える。この時刻より前の記録は前日のもの
const DAY_CUTOFF_HOUR = 6;
// 部署の並び。色はこの順で固定(部署が増えても塗り替えない)。8番目以降は「その他」にまとめる
const DEPT_ORDER = ['窓口', 'ビート部', 'バトル部', '見回り部', '守り部', '研究所', '修理部'];
const OTHER = 'その他';

const AT_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
// 日本時間の "YYYY-MM-DD HH:MM" を、日本時間の壁時計のまま数える(UTC として扱うことで時差を持ち込まない)
function parseAt(s) {
  const m = AT_RE.exec(String(s || ''));
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}
const ymd = (t) => new Date(t).toISOString().slice(0, 10);
const md = (s) => `${+s.slice(5, 7)}/${+s.slice(8, 10)}`;
const DOW = ['日', '月', '火', '水', '木', '金', '土'];

function load(file = DEFAULT_FILE) {
  if (!fs.existsSync(file)) return empty();
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return normalize(raw);
}
function empty() { return { weekResetDow: null, weekResetHour: null, calibrations: [], snapshots: [] }; }
function normalize(raw) {
  const out = empty();
  if (!raw || typeof raw !== 'object') return out;
  if (Number.isInteger(raw.weekResetDow) && raw.weekResetDow >= 0 && raw.weekResetDow <= 6) out.weekResetDow = raw.weekResetDow;
  if (Number.isInteger(raw.weekResetHour) && raw.weekResetHour >= 0 && raw.weekResetHour <= 23) out.weekResetHour = raw.weekResetHour;
  out.calibrations = Array.isArray(raw.calibrations) ? raw.calibrations.filter((c) => c && parseAt(c.at) != null && Number.isFinite(c.percent)) : [];
  out.snapshots = Array.isArray(raw.snapshots) ? raw.snapshots.filter((s) => s && parseAt(s.at) != null && s.sessions && typeof s.sessions === 'object') : [];
  out.snapshots.sort((a, b) => parseAt(a.at) - parseAt(b.at));
  out.calibrations.sort((a, b) => parseAt(a.at) - parseAt(b.at));
  return out;
}

function validateSnapshot(s) {
  const problems = [];
  if (!s || typeof s !== 'object') return ['記録は {at, sessions} のオブジェクトにする'];
  if (parseAt(s.at) == null) problems.push(`at は "2026-10-14 02:52" の形(日本時間)にする(いま「${s.at}」)`);
  if (!s.sessions || typeof s.sessions !== 'object' || Array.isArray(s.sessions)) problems.push('sessions は { <session_id>: {name, dept, cost_usd, used_tokens} } にする');
  else for (const [id, v] of Object.entries(s.sessions)) {
    if (!/^session_/.test(id)) problems.push(`sessions の鍵「${id}」は session_ で始まる id にする`);
    if (!v || !Number.isFinite(v.cost_usd) || v.cost_usd < 0) problems.push(`${id} の cost_usd は0以上の数にする`);
    if (v && v.used_tokens != null && !Number.isFinite(v.used_tokens)) problems.push(`${id} の used_tokens は数にする(無ければ書かない)`);
    if (!v || !v.dept) problems.push(`${id} に dept(部署)を書く`);
  }
  return problems;
}

const deptKey = (d) => {
  const s = String(d || '');
  if (/窓口|本社/.test(s)) return '窓口';
  const hit = DEPT_ORDER.find((x) => s.includes(x));
  return hit || OTHER;
};

// 記録と記録のあいだの使用量を、部署ごとに出す。新しく出てきた会話は、その値まるごとがその間の使用量。
// 値が減った会話(作り直しなど)は、減ったあとの値を新しく使った分として数える
function intervals(data) {
  const out = [];
  const snaps = data.snapshots;
  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i - 1].sessions, cur = snaps[i].sessions;
    const byDept = {};
    let total = 0;
    for (const [id, v] of Object.entries(cur)) {
      const before = prev[id] && Number.isFinite(prev[id].cost_usd) ? prev[id].cost_usd : 0;
      const d = v.cost_usd >= before ? v.cost_usd - before : v.cost_usd;
      if (!(d > 0)) continue;
      const k = deptKey(v.dept);
      byDept[k] = (byDept[k] || 0) + d;
      total += d;
    }
    const end = parseAt(snaps[i].at);
    out.push({ start: parseAt(snaps[i - 1].at), end, day: ymd(end - DAY_CUTOFF_HOUR * 3600000), byDept, total });
  }
  return out;
}

function weekStartOf(t, data) {
  const dow = data.weekResetDow == null ? 1 : data.weekResetDow;
  const hour = data.weekResetHour == null ? 0 : data.weekResetHour;
  const d = new Date(t);
  let start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour);
  const back = (d.getUTCDay() - dow + 7) % 7;
  start -= back * 86400000;
  if (start > t) start -= 7 * 86400000;
  return start;
}

// 1ドルあたり何%か。いちばん新しい合わせ込みを使う。total_cost_usd が無ければ、その週の記録の合計で割る
function percentPerUsd(data, ivs) {
  for (let i = data.calibrations.length - 1; i >= 0; i--) {
    const c = data.calibrations[i];
    const at = parseAt(c.at);
    let total = Number.isFinite(c.total_cost_usd) ? c.total_cost_usd : null;
    if (total == null) {
      const ws = weekStartOf(at, data);
      total = ivs.filter((iv) => iv.end > ws && iv.end <= at).reduce((a, iv) => a + iv.total, 0);
    }
    if (total > 0) return { rate: c.percent / total, from: c };
  }
  return null;
}

function summarize(data, now = null) {
  const ivs = intervals(data);
  const cal = percentPerUsd(data, ivs);
  const conv = (usd) => (cal ? usd * cal.rate : usd);
  const unit = cal ? '%' : 'ドル';
  const depts = [...DEPT_ORDER, OTHER];

  const dayMap = new Map();
  for (const iv of ivs) {
    const d = dayMap.get(iv.day) || { day: iv.day, total: 0, byDept: {} };
    d.total += iv.total;
    for (const [k, v] of Object.entries(iv.byDept)) d.byDept[k] = (d.byDept[k] || 0) + v;
    dayMap.set(iv.day, d);
  }
  const days = [...dayMap.values()].sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ ...d, label: md(d.day), value: conv(d.total), byDeptValue: Object.fromEntries(Object.entries(d.byDept).map(([k, v]) => [k, conv(v)])) }));

  const weekMap = new Map();
  for (const iv of ivs) {
    const ws = weekStartOf(iv.end, data);
    const w = weekMap.get(ws) || { start: ws, total: 0, byDept: {}, days: new Set() };
    w.total += iv.total;
    w.days.add(iv.day);
    for (const [k, v] of Object.entries(iv.byDept)) w.byDept[k] = (w.byDept[k] || 0) + v;
    weekMap.set(ws, w);
  }
  const weeks = [...weekMap.values()].sort((a, b) => a.start - b.start)
    .map((w) => ({ ...w, label: `${md(ymd(w.start))}〜`, value: conv(w.total), byDeptValue: Object.fromEntries(Object.entries(w.byDept).map(([k, v]) => [k, conv(v)])) }));

  // 今週の見込み: 今週ここまでの量 + (今週の記録のある日の平均) × 週末までの残り日数
  const lastEnd = ivs.length ? ivs[ivs.length - 1].end : null;
  const nowT = now != null ? now : lastEnd;
  let forecast = null;
  if (nowT != null && weeks.length) {
    const ws = weekStartOf(nowT, data);
    const cur = weeks.find((w) => w.start === ws);
    if (cur) {
      const elapsedDays = Math.max(1, (lastEnd - ws) / 86400000);
      const pace = cur.value / elapsedDays;
      const remain = Math.max(0, (ws + 7 * 86400000 - lastEnd) / 86400000);
      forecast = { soFar: cur.value, end: cur.value + pace * remain, remainDays: remain, weekLabel: cur.label, resetAt: ws + 7 * 86400000 };
    }
  }
  return { days, weeks, depts, cal, unit, forecast, snapshots: data.snapshots.length, resetKnown: data.weekResetDow != null, data };
}

module.exports = { load, normalize, validateSnapshot, summarize, parseAt, ymd, md, DOW, DEPT_ORDER, OTHER, DEFAULT_FILE, deptKey, weekStartOf };
