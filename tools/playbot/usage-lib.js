// Claude の使用量の記録(docs/playbot/dashboard/usage.json)を読み、日ごと・週ごと・部署ごとの量と%(目安)に直す。
// usage-page.js(ページ)と usage-snapshot.js(追記)が使う。
//
// usage.json の形(2026-10-13 社長「週間のクロードの使用率を目安でも良いから%で、日別と週別のグラフで見たい」):
//   snapshots:    [{ at:"2026-10-14 02:52", note?, sessions:{ <session_id>:{ name, dept?, cost_usd, used_tokens? } } }]
//                 窓口が毎晩 get_session の usage.cost_usd を書く。値は会話ごとの累積なので、前の記録との差がその間の使用量。
//                 新しく出てきた会話(交代など)は、0からの差(その値まるごと)を足す。dept が無ければ name から部署を決める
//   calibrations: [{ at:"2026-10-13 15:45", percent:69 }]
//                 社長が claude.ai の使用量画面で見た週の%。同じころ(前後60分)の記録が要る。
//                 同じ週の2点の差(%の差 ÷ そのあいだの使用量)で「1ドルあたり何%」を割り出す。1点だけのあいだは「割り出し中」。
//                 週の切り替わりちょうどの記録があれば、その週の1点目は「切り替わりで0%」として使える
//   weekResetDow / weekResetHour: 週の切り替わり(0=日曜〜6=土曜 / 0〜23時。日本時間)。未設定なら仮に月曜0時
//   recordStart:  "2026-10-15 20:00" — これより前の使用は%の計算(日ごと・週ごと)に入れない(割り出しには使う)
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
// 記録のあいだがこれより空いたら、残り%の線をつながない(毎晩の記録なら24時間あく)
const GAP_HOURS = 30;

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
function empty() { return { weekResetDow: null, weekResetHour: null, recordStart: null, calibrations: [], snapshots: [] }; }
function normalize(raw) {
  const out = empty();
  if (!raw || typeof raw !== 'object') return out;
  if (Number.isInteger(raw.weekResetDow) && raw.weekResetDow >= 0 && raw.weekResetDow <= 6) out.weekResetDow = raw.weekResetDow;
  if (Number.isInteger(raw.weekResetHour) && raw.weekResetHour >= 0 && raw.weekResetHour <= 23) out.weekResetHour = raw.weekResetHour;
  if (parseAt(raw.recordStart) != null) out.recordStart = raw.recordStart;
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
    if (!v || (!v.dept && !v.name)) problems.push(`${id} に name か dept(部署)を書く`);
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
      const k = deptKey(v.dept || v.name);
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

// 記録と記録のあいだの使用量のうち、[a, b) に入る分(時間で按分)。部署ごとも同じ割合
function portion(iv, a, b) {
  const lo = Math.max(iv.start, a), hi = Math.min(iv.end, b);
  if (hi <= lo) return null;
  const f = (hi - lo) / (iv.end - iv.start);
  return { total: iv.total * f, byDept: Object.fromEntries(Object.entries(iv.byDept).map(([k, v]) => [k, v * f])) };
}

// 時刻 t までの使用量の累計(最初の記録から)。記録のあいだは時間で按分
function cumulativeAt(ivs, t) {
  let sum = 0;
  for (const iv of ivs) {
    if (iv.end <= t) sum += iv.total;
    else if (iv.start < t) sum += iv.total * (t - iv.start) / (iv.end - iv.start);
  }
  return sum;
}

// 「1ドルあたり何%」。同じ週の2点(週の切り替わりちょうどの記録があれば、切り替わりの 0% も1点)の差で割り出す。
// 合わせ込みの時刻の前後60分に記録が無い点は使わない(使用量の累計が分からないため)。いちばん新しい組を使う
function percentPerUsd(data, ivs) {
  const snapTimes = data.snapshots.map((x) => parseAt(x.at));
  const first = snapTimes[0], last = snapTimes[snapTimes.length - 1];
  const near = (t) => snapTimes.some((st) => Math.abs(st - t) <= 60 * 60000);
  const points = [];
  for (const c of data.calibrations) {
    const t = parseAt(c.at);
    if (!near(t)) continue;
    points.push({ t, percent: c.percent, from: c });
  }
  // 週の切り替わり(0%)も点にする。その時刻の前後60分に記録があり、記録の範囲の中にあるときだけ
  for (const p of [...points]) {
    const ws = weekStartOf(p.t, data);
    if (ws >= first && ws <= last && near(ws) && !points.some((q) => q.t === ws)) points.push({ t: ws, percent: 0, reset: true });
  }
  points.sort((a, b) => a.t - b.t);
  for (let i = points.length - 1; i > 0; i--) {
    const b = points[i], a = points[i - 1];
    if (weekStartOf(a.t, data) !== weekStartOf(b.t, data) || b.reset) continue;
    const dp = b.percent - a.percent, dc = cumulativeAt(ivs, b.t) - cumulativeAt(ivs, a.t);
    if (dp > 0 && dc > 0) return { rate: dp / dc, from: b.from, base: a.reset ? { at: '週の切り替わり', percent: 0 } : a.from };
  }
  return null;
}

function summarize(data, now = null) {
  const ivs = intervals(data);
  const cal = percentPerUsd(data, ivs);
  const conv = (usd) => (cal ? usd * cal.rate : usd);
  const unit = cal ? '%' : 'ドル';
  const depts = [...DEPT_ORDER, OTHER];
  const from = data.recordStart ? parseAt(data.recordStart) : -Infinity;

  // 日ごと: 記録の終わりの日(夜中の記録は前日)に入れる。recordStart より前の分は入れない
  const dayMap = new Map();
  for (const iv of ivs) {
    const part = portion(iv, from, Infinity);
    if (!part) continue;
    const d = dayMap.get(iv.day) || { day: iv.day, total: 0, byDept: {} };
    d.total += part.total;
    for (const [k, v] of Object.entries(part.byDept)) d.byDept[k] = (d.byDept[k] || 0) + v;
    dayMap.set(iv.day, d);
  }
  const days = [...dayMap.values()].sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ ...d, label: md(d.day), value: conv(d.total), byDeptValue: Object.fromEntries(Object.entries(d.byDept).map(([k, v]) => [k, conv(v)])) }));

  // 週ごと: 週の切り替わりをまたぐ記録は、時間で按分して両方の週へ
  const weekMap = new Map();
  for (const iv of ivs) {
    for (let ws = weekStartOf(iv.start, data); ws < iv.end; ws += 7 * 86400000) {
      const part = portion(iv, Math.max(ws, from), ws + 7 * 86400000);
      if (!part) continue;
      const w = weekMap.get(ws) || { start: ws, total: 0, byDept: {} };
      w.total += part.total;
      for (const [k, v] of Object.entries(part.byDept)) w.byDept[k] = (w.byDept[k] || 0) + v;
      weekMap.set(ws, w);
    }
  }
  const weeks = [...weekMap.values()].sort((a, b) => a.start - b.start)
    .map((w) => ({ ...w, label: `${md(ymd(w.start))}〜`, value: conv(w.total), byDeptValue: Object.fromEntries(Object.entries(w.byDept).map(([k, v]) => [k, conv(v)])) }));

  // 今週の見込み: 今週ここまでの量 + (今週ここまでの1日あたり) × 週の切り替わりまでの残り日数
  const lastEnd = ivs.length ? ivs[ivs.length - 1].end : null;
  let forecast = null;
  if (lastEnd != null && weeks.length) {
    const ws = weekStartOf(now != null ? now : lastEnd, data);
    const cur = weeks.find((w) => w.start === ws);
    if (cur) {
      const begun = Math.max(ws, from);
      const elapsedDays = Math.max(0.25, (lastEnd - begun) / 86400000);
      const pace = cur.value / elapsedDays;
      const remain = Math.max(0, (ws + 7 * 86400000 - lastEnd) / 86400000);
      forecast = { soFar: cur.value, end: cur.value + pace * remain, remainDays: remain, weekLabel: cur.label, resetAt: ws + 7 * 86400000 };
    }
  }
  // 残り%の移り変わり(記録の時刻ごと)。週の使用%は、同じ週の合わせ込みがあればそこを起点に、無ければ週の始まり(0%)から足す。
  // 記録のあいだが GAP_HOURS より空いた所と、週の区切りでは線をつながない
  const line = [];
  if (cal) {
    const usedAt = (t) => {
      const ws = weekStartOf(t, data);
      const anchors = data.calibrations.map((c) => ({ t: parseAt(c.at), p: c.percent })).filter((c) => weekStartOf(c.t, data) === ws);
      if (anchors.length) {
        const a = anchors.reduce((best, c) => (Math.abs(c.t - t) < Math.abs(best.t - t) ? c : best));
        return a.p + cal.rate * (cumulativeAt(ivs, t) - cumulativeAt(ivs, a.t));
      }
      const base = Math.max(ws, from);
      if (t < base || !ivs.length || ivs[0].start > base) return null;
      return cal.rate * (cumulativeAt(ivs, t) - cumulativeAt(ivs, base));
    };
    const times = data.snapshots.map((x) => parseAt(x.at)).filter((t) => t >= from);
    // 週の始まりも点にする(残り100%)。前後の記録がそろっているときだけ
    const firstT = ivs.length ? ivs[0].start : Infinity;
    const lastT2 = ivs.length ? ivs[ivs.length - 1].end : -Infinity;
    for (let ws = weekStartOf(firstT, data) + 7 * 86400000; ws <= lastT2; ws += 7 * 86400000) if (ws >= from && !times.includes(ws)) times.push(ws);
    times.sort((x, y) => x - y);
    let prev = null;
    for (const t of times) {
      const u = usedAt(t);
      if (u == null) { prev = null; continue; }
      const used = Math.max(0, Math.min(100, u));
      const ws = weekStartOf(t, data);
      const isStart = t === ws;
      // 最初の点・記録が空いた所・週が変わった所(週の始まりの点を含む)では線を切る
      const brk = !prev || (t - prev.t) > GAP_HOURS * 3600000 || weekStartOf(prev.t, data) !== ws;
      line.push({ t, remain: isStart ? 100 : 100 - used, used: isStart ? 0 : used, brk, week: ws });
      prev = { t };
    }
  }
  const lastAt = data.snapshots.length ? data.snapshots[data.snapshots.length - 1].at : null;
  const resetNext = lastEnd != null ? weekStartOf(lastEnd, data) + 7 * 86400000 : null;
  return { days, weeks, depts, cal, unit, forecast, line, lastAt, resetNext, snapshots: data.snapshots.length, calibrations: data.calibrations.length, resetKnown: data.weekResetDow != null, data };
}

module.exports = { load, normalize, validateSnapshot, summarize, parseAt, ymd, md, DOW, DEPT_ORDER, OTHER, DEFAULT_FILE, deptKey, weekStartOf };
