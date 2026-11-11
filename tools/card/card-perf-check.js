// MFバトルカード: 長く遊んでも重くならないかを見張る(2026-11-11 カード部カルク 軽量化・部長ソランドの条件)。
//   node tools/card/card-perf-check.js                 対戦5回+画面の行き来30回(縦 390×844・5〜10分)
//   PERF_BATTLES=3 PERF_LOOPS=10 node tools/card/card-perf-check.js   回数を変える
//
// 測るのは tools/card/card-perf-measure.js(同じ道具を回して、出てきた数字で決める)
//   ① 行き来30回で JS のメモリが横ばい(傾き 0.15MB/回 以下か増え 1MB 以下・どちらでも増え 4MB 以下。直す前は 0.04MB/回・1.1MB)
//   ② 対戦を続けても JS のメモリが横ばい(傾き 0.3MB/回 以下か増え 1.5MB 以下)
//   ①② とも、はじめの2回は温まり(少し増えてから横ばいになる)なので外す(6回以上のとき)
//   ③ DOM の数・イベントの受け口・setInterval・rAF が回数とともに増え続けない(おわりがはじめ+許し以内)
//   ④ 実行時エラーが無い・最後まで回った
//   ⑤ 重い作りに戻っていない: 82 の cardAiMonWave が全モンスターを毎回探さない(引き表)・84 の字合わせが 0.5px ずつ縮めない(半分ずつ絞る)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const slope = (ys) => { const n = ys.length; if (n < 2) return 0; const xm = (n - 1) / 2; const ym = ys.reduce((a, b) => a + b, 0) / n; let num = 0, den = 0; ys.forEach((y, i) => { num += (i - xm) * (y - ym); den += (i - xm) ** 2; }); return num / den; };
const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

// ⑤ 作りの見張り(ブラウザなしで先に見る)
const core = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/82-card-battle-core.jsx'), 'utf8');
const wave = core.slice(core.indexOf('const cardAiMonWave = '), core.indexOf('\n};', core.indexOf('const cardAiMonWave = ')));
check('⑤ 82 の cardAiMonWave が種族の引き表を使う(呼ぶたびに全モンスターを探さない)', /cardAiBaseWaveTable\(db\)/.test(wave) && !/Object\.values\(db\.monsters\)/.test(wave));
const screen = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/84-screen-card-battle.jsx'), 'utf8');
const fitSrc = screen.slice(screen.indexOf('const CardFitLabel = '), screen.indexOf('\n};', screen.indexOf('const CardFitLabel = ')));
check('⑤ 84 の字合わせ(CardFitLabel)が半分ずつ絞る(0.5px ずつ縮めて毎回測らない)', /\(lo \+ hi\) >> 1/.test(fitSrc) && !/while \(s > min && el\.scrollWidth/.test(fitSrc));

let pw = null;
try { pw = require('playwright'); } catch { /* 下で SKIP */ }
if (!pw) { console.log('SKIP: playwright が無いので、画面の測りは飛ばします'); process.exit(failed ? 1 : 0); }

const out = path.join(os.tmpdir(), `card-perf-check-${process.pid}.json`);
const B = Number(process.env.PERF_BATTLES || 5), L = Number(process.env.PERF_LOOPS || 30);
const r = spawnSync(process.execPath, [path.join(__dirname, 'card-perf-measure.js')], {
  env: { ...process.env, PERF_BATTLES: String(B), PERF_LOOPS: String(L), PERF_CPU: process.env.PERF_CPU || '1', PERF_OUT: out, CARD_PORT: process.env.CARD_PORT || '8963' },
  encoding: 'utf8', timeout: 40 * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
});
if (!fs.existsSync(out)) { check('④ 測る道具が最後まで回った', false, String(r.stdout || '').split('\n').filter((x) => /止まった|Error/.test(x)).slice(0, 3).join(' / ') || `終了 ${r.status}`); process.exit(1); }
const d = JSON.parse(fs.readFileSync(out, 'utf8'));
fs.unlinkSync(out);
const battles = d.battles.slice(1), loops = d.loops.slice(1);
// はじめの2回は温まり(読み込み・計算の覚え込みで少し増える。直す前の30回でも同じ形)なので、メモリの判定から外す
const warm = (rows) => (rows.length >= 6 ? rows.slice(2) : rows);
check('④ 最後まで回った', battles.length === B && loops.length === L, `対戦 ${battles.length}/${B}・行き来 ${loops.length}/${L}${/止まった/.test(r.stdout) ? `・${(r.stdout.match(/止まった[^\n]*/) || [''])[0]}` : ''}`);
check('④ 実行時エラーが無い', !d.errors.length, d.errors.slice(0, 3).join(' / '));

if (loops.length >= 4) {
  const h = warm(loops).map((x) => x.heapMB);
  const s = slope(h), grow = avg(h.slice(-3)) - avg(h.slice(0, 3));
  check(`① 行き来${loops.length}回で JS のメモリが横ばい(はじめの2回を除く)`, (s <= 0.15 || grow <= 1) && grow <= 4, `${h[0]}→${h[h.length - 1]}MB・傾き ${s.toFixed(3)}MB/回・増え ${grow.toFixed(2)}MB`);
}
if (battles.length >= 3) {
  const h = warm(battles).map((x) => x.heapMB);
  const s = slope(h), grow = avg(h.slice(-2)) - avg(h.slice(0, 2));
  check(`② 対戦${battles.length}回で JS のメモリが横ばい(はじめの2回を除く)`, s <= 0.3 || grow <= 1.5, `${h[0]}→${h[h.length - 1]}MB・傾き ${s.toFixed(3)}MB/回・増え ${grow.toFixed(2)}MB`);
}
// ③ はじめの3回とおわりの3回を比べる(許しの幅は、画面のちがい・吹き出しの有り無しで動く分)
const ALLOW = { nodes: 120, listeners: 30, intervals: 1, raf: 2 };
for (const [name, rows] of [['対戦', battles], ['行き来', loops]]) {
  if (rows.length < 4) continue;
  const bad = Object.entries(ALLOW).filter(([k, a]) => avg(rows.slice(-3).map((x) => x[k])) > avg(rows.slice(0, 3).map((x) => x[k])) + a)
    .map(([k]) => `${k} ${rows[0][k]}→${rows[rows.length - 1][k]}`);
  check(`③ ${name}: DOM・受け口・タイマーが増え続けない`, !bad.length, bad.join(' / ') || Object.keys(ALLOW).map((k) => `${k} ${rows[0][k]}→${rows[rows.length - 1][k]}`).join(' / '));
}
console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
process.exit(failed ? 1 : 0);
