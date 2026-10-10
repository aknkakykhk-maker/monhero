// 「モンヒロ社 部署紹介」のページを作る(社長が見る、部署ごとのプロフィール)。
//
// 中身は docs/playbot/dashboard/departments.json(部署ごとの紹介)と scores.json(部員の点。部ごとに足す)。
// 統括部長が部の働きを見て JSON を書き足し、これを回して、Artifact で同じ URL へ出し直す。
// 社長室と同じく、スクリプトを使わない素の HTML(社長の iPhone で開けるように)。
//
//   node tools/playbot/department-profiles.js [--out <出力先>]
//   既定の出力先: docs/playbot/dashboard/departments.html
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'docs', 'playbot', 'dashboard');
const outArg = process.argv.indexOf('--out');
const OUT = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : path.join(DIR, 'departments.html');

const read = (name) => JSON.parse(fs.readFileSync(path.join(DIR, name + '.json'), 'utf8'));
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const depts = read('departments');
// 成績は「できごとの記録」から数え直してから読む(scores.json を手で直さない。scoreboard.js)
require('./scoreboard.js').writeAll();
const scores = read('scores');
const updatedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// 性格(2026-10-10 社長「今後は部員ごとに性格もいれてもらえると楽しそう」): 部長性格 と 部員[].性格 を出す
// 部ごとの点: 所属が部の名前に含まれる部員の点を足す
const pointsOf = (d) => scores.filter((s) => d.部.includes(s.所属)).reduce((a, s) => a + (Number(s.点) || 0), 0);
const STATE = { 作業中: 'ok', 待機: 'idle', 休眠: 'idle', いつも: 'ok', 返事待ち: 'warn' };
const list = (items) => `<ul>${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;

const cards = depts.map((d) => {
  const pts = pointsOf(d);
  const members = d.部員.length
    ? `<div class="members">${d.部員.map((m) => `<span class="member"><b>${esc(m.名前)}</b>${esc(m.担当)}${m.性格 ? `<i class="trait">${esc(m.性格)}</i>` : ''}</span>`).join('')}</div>` : '';
  return `
  <article class="dept" id="${esc(d.id)}" style="--dc:${esc(d.色)}">
    <header class="dept-head">
      <div class="dept-name"><h2>${esc(d.部)}</h2><span class="chip ${STATE[d.状態] || 'idle'}">${esc(d.状態)}</span></div>
      <p class="boss">${esc(d.部長)}${d.id !== 'sleep' && d.id !== 'hq' ? `<span class="pts">部の点 ${pts < 0 ? '−' + Math.abs(pts) : pts}</span>` : ''}</p>
      ${d.部長性格 ? `<p class="trait-boss">性格: ${esc(d.部長性格)}</p>` : ''}
      <p class="hito">${esc(d.ひとこと)}</p>
    </header>
    ${members}
    <div class="cols">
      <section><h3>得意なこと</h3>${list(d.得意)}</section>
      <section><h3>これまでの働き</h3>${list(d.これまで)}</section>
    </div>
    <section><h3>気をつけること</h3>${list(d.気をつけること)}</section>
    <p class="sess">セッション: ${esc(d.セッション)}</p>
  </article>`;
}).join('');

const html = `<title>モンヒロ社 部署紹介</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;800&display=swap">
<style>
/* 社内報の部署紹介: 部ごとに色帯の札。上に目次、札の中は「ひとこと → 部員 → 得意/働き → 気をつけること」 */
:root{--bg:#f3f5f8;--panel:#ffffff;--fg:#18202c;--muted:#5b6676;--line:#dde2ea;--ok:#17803d;--warn:#a35200;
--font-head:"M PLUS Rounded 1c","Hiragino Maru Gothic ProN","Hiragino Sans",sans-serif;--font-body:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,sans-serif}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#11161e;--panel:#19202b;--fg:#e8edf4;--muted:#9aa6b6;--line:#2a3442;--ok:#5fd28a;--warn:#ffb35c;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#11161e;--panel:#19202b;--fg:#e8edf4;--muted:#9aa6b6;--line:#2a3442;--ok:#5fd28a;--warn:#ffb35c;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--font-body);font-size:15px;line-height:1.65}
.wrap{max-width:60rem;margin:0 auto;padding:20px 16px 48px;display:flex;flex-direction:column;gap:18px}
h1,h2,h3{font-family:var(--font-head);margin:0;text-wrap:balance}
h1{font-size:26px;font-weight:800}
h2{font-size:20px;font-weight:800}
h3{font-size:13px;font-weight:800;color:var(--muted);letter-spacing:.04em}
p{margin:0}
.lead{color:var(--muted);font-size:13px;margin-top:4px}
.toc{display:flex;flex-wrap:wrap;gap:6px}
.toc a{font-size:13px;text-decoration:none;color:var(--fg);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:2px 10px}
.dept{background:var(--panel);border:1px solid var(--line);border-top:6px solid var(--dc);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:12px;min-width:0;scroll-margin-top:12px}
.dept-head{display:flex;flex-direction:column;gap:4px}
.dept-name{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.dept-name h2{color:var(--dc)}
.boss{font-weight:700;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}
.pts{font-size:12px;font-weight:400;color:var(--muted);font-variant-numeric:tabular-nums}
.hito{font-size:14px}
.chip{display:inline-block;border:1px solid currentColor;border-radius:999px;padding:0 9px;font-size:12px;line-height:20px}
.chip.ok{color:var(--ok)}.chip.warn{color:var(--warn)}.chip.idle{color:var(--muted)}
.members{display:flex;flex-wrap:wrap;gap:6px}
.member{display:flex;flex-direction:column;font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:10px;padding:4px 10px;min-width:0}
.member b{font-size:14px;color:var(--fg)}
.member .trait{font-style:normal;font-size:11px;color:var(--muted);margin-top:2px;max-width:16em}
.trait-boss{margin:2px 0 0;font-size:13px;color:var(--muted)}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));gap:12px}
section{display:flex;flex-direction:column;gap:4px;min-width:0}
ul{margin:0;padding-left:1.2em;font-size:14px;display:flex;flex-direction:column;gap:2px}
.sess{font-size:11px;color:var(--muted);overflow-wrap:anywhere}
</style>
<div class="wrap">
  <header>
    <h1>モンヒロ社 部署紹介</h1>
    <p class="lead">${esc(updatedAt)} 更新 / まとめ: 統括部長:モンヒロくん。部の点は成績表(10/9から)の部員の点を足したもの。</p>
  </header>
  <nav class="toc">${depts.map((d) => `<a href="#${esc(d.id)}">${esc(d.部)}</a>`).join('')}</nav>
  ${cards}
</div>
`;
fs.writeFileSync(OUT, html);
console.log('OK: ' + path.relative(ROOT, OUT) + ' (' + depts.length + ' 部署)');
