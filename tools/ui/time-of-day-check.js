// 時間帯で変わる雰囲気・いまの時刻(monster-hero/src/parts/44-time-of-day.jsx)の見張り。2026-11-07 演出担当ハナビ
// 守ること(社長・統括):
//  ・区切りは日本時間で 朝5:00〜 / 昼10:00〜 / 夕16:00〜 / 夜19:00〜4:59。端末の時間帯の設定に左右されない
//  ・お話・モンヒロビートの演奏中とリザルト・バトル中・カードの場には色を重ねない(遊ぶ表示の見やすさ・演奏中の重さ)
//  ・色は CSS の層だけ(混ぜ方 mix-blend-mode・ぼかし backdrop-filter を使わない。古い端末でも軽い)
//  ・保存は新しいキー mh_time_of_day_v1 だけ。画面を切り替えない
//  ・時刻の札は置いてよい画面(HOME・プロフィール・助手ライフの家)にだけ置く
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const PARTS = path.join(ROOT, 'monster-hero/src/parts');
const SRC = fs.readFileSync(path.join(PARTS, '44-time-of-day.jsx'), 'utf8');
const errors = [];
const ng = (m) => errors.push(m);

// 1) 区切りと日本時間
const head = SRC.slice(0, SRC.indexOf('// ---------- 設定と「いま」'));
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${head}\nthis.at=timeOfDayAt;this.clock=timeOfDayClockText;this.norm=normalizeTimeOfDaySettings;this.KEY=TIME_OF_DAY_STORAGE_KEY;`, ctx);
const jst = (h, m) => Date.UTC(2026, 10, 7, h - 9, m); // 日本時間 h:m の時刻
const cases = [[4, 59, 'night'], [5, 0, 'morning'], [9, 59, 'morning'], [10, 0, 'day'], [15, 59, 'day'], [16, 0, 'evening'], [18, 59, 'evening'], [19, 0, 'night'], [23, 59, 'night'], [0, 0, 'night']];
for (const [h, m, want] of cases) { const got = ctx.at(jst(h, m)).id; if (got !== want) ng(`日本時間 ${h}:${String(m).padStart(2, '0')} は ${want} のはずが ${got}`); }
if (ctx.clock(jst(21, 4)) !== '21:04') ng(`時刻の文字が日本時間になっていない(${ctx.clock(jst(21, 4))})`);
if (/getHours\(|getMinutes\(|toLocaleTimeString|getTimezoneOffset/.test(head)) ng('端末の時間帯に左右される数え方(getHours など)を使っている');
const n0 = ctx.norm(null), n1 = ctx.norm({ mood: 'off', clock: 'x' }), n2 = ctx.norm([1]);
if (n0.mood !== 'on' || n0.clock !== 'on' || n1.mood !== 'off' || n1.clock !== 'on' || n2.mood !== 'on') ng('設定の読み(無い・壊れている・知らない値は on)が違う');
if (ctx.KEY !== 'mh_time_of_day_v1') ng('保存キーが mh_time_of_day_v1 でない');

// 2) 色の層を重ねない所・重い書き方
const css = (SRC.match(/const TIME_OF_DAY_CSS = `([\s\S]*?)`;/) || [])[1] || '';
if (!css) ng('TIME_OF_DAY_CSS が見つからない');
for (const sel of ['data-rhythm-stage', 'data-rhythm-play', 'data-rhythm-result', 'data-battle-stage-bg', 'data-story-bg', 'data-event-story', 'data-card-battle', 'data-card-field-bg', 'rhythm-lane', 'data-rhythm-note']) {
  if (css.includes(sel)) ng(`遊ぶ画面(${sel})に色を重ねている`);
}
for (const cat of ['"battle"', '"rhythm"']) if (css.includes(`data-mh-theme-category=${cat}`)) ng(`塗りを寄せる画面に ${cat} が入っている`);
css.split('\n').filter(l => l.includes('.mh-home-')).forEach(l => { if ((l.match(/\{/g) || []).length !== (l.match(/\}/g) || []).length) ng(`.mh-home- を含む CSS の行が1行で閉じていない(home-layout-check の組み立てを壊す): ${l.trim().slice(0, 60)}`); });
if (/mix-blend-mode|backdrop-filter|filter:\s*blur/.test(css)) ng('混ぜ方・ぼかしを使っている(古い端末で重い)');

// 3) 保存・画面の切り替え
if (/setGameState|localStorage|sessionStorage/.test(SRC)) ng('44-time-of-day.jsx が画面を切り替える・直接保存している');
const keys = SRC.match(/'mh_[a-z0-9_]+'/g) || [];
if (keys.some(k => k !== "'mh_time_of_day_v1'")) ng(`ほかの保存キーに触れている: ${keys.join(' ')}`);

// 4) 時刻の札の置き場所(HOME・プロフィールだけ)
const where = fs.readdirSync(PARTS).filter(f => f.endsWith('.jsx') && f !== '44-time-of-day.jsx')
  .filter(f => /<TimeOfDayClock\b/.test(fs.readFileSync(path.join(PARTS, f), 'utf8')));
const allowed = new Set(['69-screen-home.jsx', '56-screen-profile.jsx', '56-assistant-life.jsx', '56-assistant-life-house.jsx']); // 家(助手ライフ)はナカヨシ5が置く(家の画面は 56-assistant-life-house.jsx)
where.filter(f => !allowed.has(f)).forEach(f => ng(`時刻の札を置いてよい画面の外に置いている: ${f}`));
if (!where.includes('69-screen-home.jsx')) ng('HOME に時刻の札が無い');
const app = fs.readFileSync(path.join(PARTS, '60-app.jsx'), 'utf8');
if ((app.match(/<TimeOfDayRoot\b/g) || []).length !== 1) ng('TimeOfDayRoot は 60-app.jsx に1つだけ置く');

if (errors.length) { console.log(`NG: 時間帯の雰囲気 ${errors.length}件`); errors.forEach(e => console.log(`  - ${e}`)); process.exit(1); }
console.log('OK: 時間帯の雰囲気(日本時間の区切り・遊ぶ画面に重ねない・軽い書き方・札の置き場所)');
