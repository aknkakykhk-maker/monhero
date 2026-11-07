#!/usr/bin/env node
// 1日の切り替わりは、ぜんぶ朝4時(日本時間)にそろえる(2026-11-07 社長「バトルカードの日付変更線を4時にして。てかぜんぶ4時に統一して」)。
//   ① 共通の jstDayKey4 と、1日で数える物の日付キーが、どの時刻でも同じ日を返す(3:59 は前の日、4:00 からその日)
//   ② 切り替えの夜の持ち越し: 前は0時区切りだった物は、0:00〜4:00 に「次の日」の日付で保存されている。
//      それを「今日はもう受け取った」と扱い、4:00 にその日へ追いついたあとも二重に数えない。取り逃しもしない
//   ③ 前の区切り(0時・5時)の式が、そろえた所に戻っていない
//   週の区切り(月曜5:00)・大会の時刻表は社長の判断待ちなので、ここでは見ない。
// 使い方: node tools/build.js のあと node tools/boot/day-boundary-check.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const PARTS = path.join(ROOT, 'monster-hero/src/parts');
const part = (f) => fs.readFileSync(path.join(PARTS, f), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 「const 名前 = …」を1つ取り出す。1行で終わる物はその行、ブロックの物は行頭の「};」まで
const take = (src, name) => {
  const i = src.indexOf(`\nconst ${name} = `);
  if (i < 0) return null;
  const lineEnd = src.indexOf('\n', i + 1);
  const first = src.slice(i + 1, lineEnd);
  if (/;\s*$/.test(first) && !/\{\s*$/.test(first)) return first;
  const end = src.indexOf('\n};', i);
  return end < 0 ? null : src.slice(i + 1, end + 3);
};
const want = (file, names) => {
  const src = part(file);
  return names.map((n) => { const b = take(src, n); check(`${file} から ${n} を取り出せる`, !!b); return b || ''; }).join('\n');
};

const code = [
  want('17-release-changelog-login-missions.jsx', ['loginBonusPeriodKey', 'jstDayKey4', 'jstDayCarry', 'playtimeDayKey', 'playtimeDayOf']),
  want('21-assistant.jsx', ['assistantBubbleDayKey']),
  want('33-rhythm-buddy.jsx', ['rhythmBuddyDayKey']),
  want('35-raid-jack.jsx', ['raidJackDayKey']),
  want('82-card-battle-core.jsx', ['cardIsPlainObject', 'cardNormalizePoint', 'cardDayCarry', 'cardNormalizeDaily']),
  want('84-screen-card-battle.jsx', ['cardTodayJst']),
  want('96-card-tactics.jsx', ['CARD_AUTO_REWARD_RESET_DAY', 'CARD_AUTO_REWARD_RESET_MARK', 'cardAutoRewardNormalize']),
].join('\n');
const ctx = { Date: class extends Date { static now() { return ctx.__now; } } };
ctx.__now = 0;
vm.createContext(ctx);
try {
  vm.runInContext(`${code}\nthis.E = { loginBonusPeriodKey, jstDayKey4, jstDayCarry, playtimeDayKey, playtimeDayOf, assistantBubbleDayKey, rhythmBuddyDayKey, raidJackDayKey, cardDayCarry, cardNormalizeDaily, cardTodayJst, cardAutoRewardNormalize };`, ctx);
} catch (e) { check('取り出した関数が動く', false, e.message); console.log(`\n${failed}件のNGがあります`); process.exit(1); }
const E = ctx.E;
const jst = (s) => Date.parse(`${s}+09:00`);

// ① どの日付キーも jstDayKey4 と同じ日を返す
const keys = {
  ログインボーナス: (t) => E.loginBonusPeriodKey(t),
  遊んだ時間: (t) => E.playtimeDayKey(t),
  助手の吹き出し: (t) => E.assistantBubbleDayKey(t),
  ビートの相棒: (t) => E.rhythmBuddyDayKey(t),
  レイドジャック: (t) => E.raidJackDayKey(t),
  バトルカード: (t) => { ctx.__now = t; return E.cardTodayJst(); },
};
const times = ['2026-11-07T03:59:59', '2026-11-07T04:00:00', '2026-11-07T23:59:00', '2026-11-08T00:00:00', '2026-11-08T00:30:00', '2026-11-08T03:59:00', '2026-11-08T04:00:00', '2026-12-31T23:59:00', '2027-01-01T03:59:00', '2027-01-01T04:00:00'];
check('jstDayKey4 は 3:59 まで前の日、4:00 からその日', E.jstDayKey4(jst('2026-11-08T03:59:59')) === '2026-11-07' && E.jstDayKey4(jst('2026-11-08T04:00:00')) === '2026-11-08');
for (const [label, fn] of Object.entries(keys)) {
  const bad = times.filter((s) => fn(jst(s)) !== E.jstDayKey4(jst(s)));
  check(`${label}の日付キーが朝4時区切り(jstDayKey4 と同じ)`, bad.length === 0, bad.map((s) => `${s}→${fn(jst(s))}`).join(' / '));
}

// ② 切り替えの夜の持ち越し
const carries = { jstDayCarry: E.jstDayCarry, cardDayCarry: E.cardDayCarry, playtimeDayOf: (saved, today) => E.playtimeDayOf(saved, jst(`${today}T12:00:00`)) };
const cases = [
  ['2026-11-08', '2026-11-07', '2026-11-08'], // 0時区切りで0:30に書いた次の日 → その日のまま
  ['2026-11-07', '2026-11-07', '2026-11-07'],
  ['2026-11-06', '2026-11-07', '2026-11-07'],
  ['2026-11-09', '2026-11-07', '2026-11-07'], // 2日以上先(時計のずれ)は持ち越さない
  ['2027-01-01', '2026-12-31', '2027-01-01'], // 年をまたぐ
  [null, '2026-11-07', '2026-11-07'], ['', '2026-11-07', '2026-11-07'], ['x', '2026-11-07', '2026-11-07'], [5, '2026-11-07', '2026-11-07'],
];
for (const [name, fn] of Object.entries(carries)) {
  const bad = cases.filter(([s, t, w]) => fn(s, t) !== w);
  check(`${name} の持ち越しが決まりどおり`, bad.length === 0, bad.map(([s, t]) => `${s}/${t}→${fn(s, t)}`).join(' / '));
}

// バトルカードの毎日の分: 11/7 23:00 に勝ち、11/8 0:30(前の0時区切り)に保存 → 公開後 1:00・4:00・翌4:00 と見ていく
{
  const atNight = { day: '2026-11-08', cpuPoint: 500, pvpPoint: 0, firstWin: true, foes: { a: 1 }, quickLoops: 2 };
  ctx.__now = jst('2026-11-08T01:00:00');
  const d1 = E.cardNormalizeDaily(atNight, E.cardTodayJst());
  check('切り替えの夜(1:00): 0:30 に書いた分は受け取り済みのまま(はじめての勝ちを二重に付けない)', d1.day === '2026-11-08' && d1.firstWin === true && d1.cpuPoint === 500 && d1.quickLoops === 2, JSON.stringify(d1));
  ctx.__now = jst('2026-11-08T04:00:00');
  const d2 = E.cardNormalizeDaily(d1, E.cardTodayJst());
  check('4:00 にその日へ追いついても、同じ日のまま(数え直さない)', d2.day === '2026-11-08' && d2.firstWin === true && d2.cpuPoint === 500, JSON.stringify(d2));
  ctx.__now = jst('2026-11-09T04:00:00');
  const d3 = E.cardNormalizeDaily(d2, E.cardTodayJst());
  check('次の日の4:00 には新しい1日になる(取り逃さない)', d3.day === '2026-11-09' && d3.firstWin === false && d3.cpuPoint === 0, JSON.stringify(d3));
  ctx.__now = jst('2026-11-09T03:59:00');
  const d4 = E.cardNormalizeDaily(d2, E.cardTodayJst());
  check('次の日の3:59 はまだ前の日のまま', d4.day === '2026-11-08' && d4.firstWin === true, JSON.stringify(d4));
  check('壊れた保存は今日の空の記録になる', E.cardNormalizeDaily('x', '2026-11-07').day === '2026-11-07' && E.cardNormalizeDaily({ day: 3 }, '2026-11-07').cpuPoint === 0);
}
// オートのごほうび(1日3回)
//   2026-11-07: 切り替えの夜に0時区切りで書いた「11/7」の回数が、4:00 を過ぎても今日の分として残った(社長「リセットされてない」)。
//   持ち越しをやめ、11/7 のあいだだけ印 r の無い 11/7 の回数を0として読む(一度きり。数えると印が付く)
{
  const old7 = { v: 1, day: '2026-11-07', n: 3 };
  const a = E.cardAutoRewardNormalize(old7, '2026-11-07');
  check('オートのごほうび: 11/7 は、印の無い 11/7 の回数を0に戻す(今日の分を全員リセット)', a.day === '2026-11-07' && a.n === 0, JSON.stringify(a));
  const marked = { v: 1, day: '2026-11-07', n: 2, r: '20261107' };
  check('オートのごほうび: 戻したあとに数えた分(印あり)はそのまま(二重に戻らない)', E.cardAutoRewardNormalize(marked, '2026-11-07').n === 2);
  const c = E.cardAutoRewardNormalize(old7, '2026-11-08');
  check('オートのごほうび: 次の日は0回から', c.n === 0 && c.day === '2026-11-08');
  const d8 = { v: 1, day: '2026-11-08', n: 3 };
  check('オートのごほうび: 11/8 からは戻しをしない(同じ日の3回はそのまま)', E.cardAutoRewardNormalize(d8, '2026-11-08').n === 3);
  check('オートのごほうび: 11/8 は印が無くても戻さない', E.cardAutoRewardNormalize({ v: 1, day: '2026-11-08', n: 1 }, '2026-11-08').n === 1);
  check('オートのごほうび: 次の日の日付が残っていても持ち越さない(今日の0回)', E.cardAutoRewardNormalize(d8, '2026-11-07').n === 0 && E.cardAutoRewardNormalize(d8, '2026-11-07').day === '2026-11-07');
  check('オートのごほうび: 壊れた保存は0回', E.cardAutoRewardNormalize('x', '2026-11-07').n === 0 && E.cardAutoRewardNormalize({ day: '2026-11-07', n: -1, r: '20261107' }, '2026-11-07').n === 0);
}

// ③ 持ち越しを通す所と、前の区切りの式が戻っていないか(本文を見る)
const src = (f) => part(f);
const app = src('60-app.jsx');
check('モンヒロビートのランク: 今日は jstDayKey4 と持ち越しで決める', /const raw = await storeGet\(BEAT_RANK_KEY[^\n]*\n[^\n]*\n\s*const today = jstDayCarry\(normalizeBeatRank\(raw\)\.day, jstDayKey4\(\)\);/.test(app));
check('毎日のマス助言: 端末の時計でなく jstDayKey4 と持ち越しで決める', /const today = jstDayCarry\(shownDate, jstDayKey4\(\)\);/.test(app) && !/const today = localCalendarDate\(\);/.test(app));
check('バトルカードのレベル: 持ち越しを通す', /const today = cardDayCarry\(cur\.day, today0\);/.test(src('96-card-tactics.jsx')));
check('助手と対戦の日の勝ち数: 持ち越しを通す', /const dayKey = cardDayCarry\(d\.day\.key, today\);/.test(src('90-card-rank.jsx')));
check('遊んだ時間: 持ち越しを通す', (src('17-release-changelog-login-missions.jsx').match(/playtimeDayOf\(base\.today\.day, now\)/g) || []).length === 2);
const oldForms = [
  ['84-screen-card-battle.jsx', /Date\.now\(\) \+ 9 \* 3600 \* 1000\)\.toISOString\(\)\.slice\(0, 10\)/],
  ['60-app.jsx', /const today = new Date\(Date\.now\(\) \+ 9 \* 3600 \* 1000\)\.toISOString\(\)\.slice\(0, 10\);/],
  ['21-assistant.jsx', /\(9 - 5\) \* 3600000/],
  ['33-rhythm-buddy.jsx', /9 \* 3600 \* 1000 - 5 \* 3600 \* 1000/],
  ['35-raid-jack.jsx', /9 \* 3600 \* 1000 - 5 \* 3600 \* 1000/],
];
for (const [f, re] of oldForms) check(`${f} に前の区切り(0時・5時)の日付キーが残っていない`, !re.test(src(f)));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
