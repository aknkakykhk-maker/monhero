#!/usr/bin/env node
// MFバトルカードの週の区切りを、月曜5:00 から 月曜4:00 へ切り替える(2026-11-07 社長「ぜんぶ4時に統一」→ 週は次の週から)。
//   ① 2026-11-09 04:00 JST より前は月曜5:00区切り、その瞬間から月曜4:00区切り。週の鍵(月曜の日付)は前も後も変わらない
//   ② 切り替えの週(2026-11-02 の週)だけ1時間短い。週が抜けたり重なったりしない
//   ③ 週間報酬は、切り替えのあとに 11/2 の週を1回だけ(正しい期間で)数える。二重にも、取りこぼしにもならない
// 使い方: node tools/card/card-week-switch-check.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PARTS = path.resolve(__dirname, '../../monster-hero/src/parts');
const part = (f) => fs.readFileSync(path.join(PARTS, f), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
// 「const 名前 = …」を1つ取り出す(1行の物はその行、ブロックの物は行頭の「};」まで)
const take = (src, name) => {
  const i = src.indexOf(`\nconst ${name} = `);
  if (i < 0) return null;
  const first = src.slice(i + 1, src.indexOf('\n', i + 1));
  if (/;(\s*\/\/.*)?$/.test(first) && !/\{\s*$/.test(first)) return first;
  const end = src.indexOf('\n};', i);
  return end < 0 ? null : src.slice(i + 1, end + 3);
};
const want = (file, names) => names.map((n) => { const b = take(part(file), n); check(`${file} から ${n} を取り出せる`, !!b); return b || ''; }).join('\n');
const code = [
  want('82-card-battle-core.jsx', ['CARD_WEEK_START_HOUR_JST', 'CARD_WEEK_START_HOUR_JST_OLD', 'CARD_WEEK_SWITCH_MS', 'cardWeekStartHourAt', 'cardWeekKeyJst']),
  want('90-card-rank.jsx', ['CARD_WEEKLY_REWARD_FROM_MS', 'CARD_WEEK_MS', 'CARD_WEEKLY_CLAIM_MS', 'cardWeekStartOfKey', 'cardWeekStartMs', 'cardWeekEndMs', 'cardWeeklyClaimId', 'cardWeeksAwaitingReward']),
].join('\n');
const ctx = {};
vm.createContext(ctx);
try { vm.runInContext(`${code}\nthis.E = { CARD_WEEK_SWITCH_MS, CARD_WEEK_MS, cardWeekKeyJst, cardWeekStartMs, cardWeekEndMs, cardWeeksAwaitingReward };`, ctx); }
catch (e) { check('取り出した関数が動く', false, e.message); process.exit(1); }
const E = ctx.E;
const J = (s) => Date.parse(`${s}+09:00`);
const iso = (ms) => new Date(ms).toISOString();
const H = 3600000;

// ①
check('切り替えの日時は 2026-11-09(月)4:00 JST', E.CARD_WEEK_SWITCH_MS === J('2026-11-09T04:00:00'));
const keys = [
  ['2026-11-02T04:59:00', '2026-10-26'], ['2026-11-02T05:00:00', '2026-11-02'], ['2026-11-08T23:00:00', '2026-11-02'],
  ['2026-11-09T03:59:59', '2026-11-02'], ['2026-11-09T04:00:00', '2026-11-09'], ['2026-11-09T04:30:00', '2026-11-09'],
  ['2026-11-16T03:59:00', '2026-11-09'], ['2026-11-16T04:00:00', '2026-11-16'], ['2026-11-16T04:30:00', '2026-11-16'],
];
const badKey = keys.filter(([t, k]) => E.cardWeekKeyJst(J(t)) !== k);
check('週の鍵: 切り替えより前は月曜5:00、以後は月曜4:00で変わる', badKey.length === 0, badKey.map(([t]) => `${t}→${E.cardWeekKeyJst(J(t))}`).join(' / '));
// ②
check('切り替えの週は 11/2 5:00 〜 11/9 4:00', E.cardWeekStartMs(J('2026-11-05T12:00:00')) === J('2026-11-02T05:00:00') && E.cardWeekEndMs(J('2026-11-02T05:00:00')) === J('2026-11-09T04:00:00'));
check('次の週から 月曜4:00 〜 次の月曜4:00(7日)', E.cardWeekStartMs(J('2026-11-10T12:00:00')) === J('2026-11-09T04:00:00') && E.cardWeekEndMs(J('2026-11-09T04:00:00')) === J('2026-11-16T04:00:00'));
check('前の週は今までどおり 月曜5:00 〜 月曜5:00', E.cardWeekStartMs(J('2026-10-28T12:00:00')) === J('2026-10-26T05:00:00') && E.cardWeekEndMs(J('2026-10-26T05:00:00')) === J('2026-11-02T05:00:00'));
{
  let t = E.cardWeekStartMs(J('2026-10-05T12:00:00')), ok = true, seen = new Set();
  for (let k = 0; k < 12; k++) {
    const end = E.cardWeekEndMs(t);
    if (E.cardWeekStartMs(t) !== t || E.cardWeekStartMs(end - 1) !== t || seen.has(E.cardWeekKeyJst(t))) { ok = false; break; }
    seen.add(E.cardWeekKeyJst(t)); t = end;
  }
  check('週が抜けも重なりもなくつながる(切り替えの前後12週)', ok && seen.size === 12, [...seen].join(' '));
}
// ③
{
  const a1 = E.cardWeeksAwaitingReward(J('2026-11-09T04:30:00'), []);
  check('切り替えのすぐあと: 11/2 の週を1回だけ、正しい期間で', a1.length === 1 && a1[0].key === '2026-11-02' && a1[0].id === 'card_weekly_2026-11-02' && a1[0].startMs === J('2026-11-02T05:00:00') && a1[0].endMs === J('2026-11-09T04:00:00'),
    JSON.stringify(a1.map((w) => [w.key, iso(w.startMs), iso(w.endMs)])));
  check('切り替えの直前は、まだ 11/2 の週を配らない', E.cardWeeksAwaitingReward(J('2026-11-09T03:59:00'), []).length === 0);
  const a2 = E.cardWeeksAwaitingReward(J('2026-11-16T04:30:00'), []);
  check('次の週のあと: 11/2 の週と 11/9 の週を1回ずつ', a2.map((w) => w.key).join(',') === '2026-11-02,2026-11-09' && a2[1].startMs === J('2026-11-09T04:00:00') && a2[1].endMs === J('2026-11-16T04:00:00'),
    JSON.stringify(a2.map((w) => [w.key, iso(w.startMs), iso(w.endMs)])));
  check('受け取った週は二度出ない', E.cardWeeksAwaitingReward(J('2026-11-16T04:30:00'), ['card_weekly_2026-11-02']).map((w) => w.key).join(',') === '2026-11-09');
  check('受け取りの期限(終わってから14日)を過ぎた週は出ない', !E.cardWeeksAwaitingReward(J('2026-11-23T04:00:00'), []).some((w) => w.key === '2026-11-02'));
  check('記録がそろう前の週(10/26)は配らない', !E.cardWeeksAwaitingReward(J('2026-11-09T04:30:00'), []).some((w) => w.key === '2026-10-26'));
}
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
