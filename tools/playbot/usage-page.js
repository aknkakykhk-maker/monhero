#!/usr/bin/env node
// Claude の使用率(目安)のページを作る。日ごと・週ごとの%と部署ごとの内訳、今週の見込み。
//
// 2026-10-13 社長「週間のクロードの使用率を目安でも良いから%で、日別と週別のグラフで見たい」。
// 中身は docs/playbot/dashboard/usage.json(書き方は usage-lib.js の頭)。窓口が毎晩 usage-snapshot.js で1行足し、
// これを回して Artifact で出し直す。社長室と同じく、スクリプトを使わない素の HTML(グラフは inline SVG)。
//
//   node tools/playbot/usage-page.js [--data <usage.json>] [--out <出力先>]
//   既定の出力先: docs/playbot/dashboard/usage.html
'use strict';
const fs = require('fs');
const path = require('path');
const U = require('./usage-lib.js');

const ROOT = path.join(__dirname, '..', '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const DATA = arg('--data') ? path.resolve(arg('--data')) : U.DEFAULT_FILE;
const OUT = arg('--out') ? path.resolve(arg('--out')) : path.join(ROOT, 'docs', 'playbot', 'dashboard', 'usage.html');

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function build(data) {
  const S = U.summarize(data);
  const isPct = S.unit === '%';
  const fmt = (v) => (isPct ? (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + '%' : '$' + v.toFixed(2));
  const fmtAxis = (v) => (isPct ? Math.round(v) + '%' : '$' + (v >= 10 ? Math.round(v) : v.toFixed(1)));

  function niceMax(v) {
    if (!(v > 0)) return isPct ? 10 : 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const m = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => x * p >= v);
    return m * p;
  }
  // 上の角だけ丸めた棒(データの端を丸め、地面側は角のまま)
  const bar = (x, y, w, h, r) => {
    if (h <= 0) return '';
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };

  // 棒グラフ1つ(1系列、または部署で積み上げ)。items: [{label, value, byDept?}]
  function chart(items, { stacked = false, labelEvery = 1, title }) {
    const W = 360, H = 200, L = 40, R = 8, T = 16, B = 26;
    const pw = W - L - R, ph = H - T - B;
    const max = niceMax(Math.max(...items.map((d) => d.value)));
    const n = items.length;
    const slot = pw / n;
    const bw = Math.max(4, Math.min(28, slot * 0.62));
    const y = (v) => T + ph - (v / max) * ph;
    const grid = [0, 0.5, 1].map((f) => {
      const v = max * f, yy = y(v);
      return `<line x1="${L}" x2="${W - R}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" class="${f === 0 ? 'base' : 'grid'}"/>`
        + `<text x="${L - 6}" y="${(yy + 4).toFixed(1)}" class="ax" text-anchor="end">${esc(fmtAxis(v))}</text>`;
    }).join('');
    const bars = items.map((d, i) => {
      const x = L + slot * i + (slot - bw) / 2;
      const tip = `${d.label} ${fmt(d.value)}`;
      let g;
      if (stacked) {
        // 下から部署の並び順に積む。段と段のあいだは面の色で2px あける
        const parts = S.depts.map((k, ci) => ({ k, ci, v: (d.byDeptValue && d.byDeptValue[k]) || 0 })).filter((p) => p.v > 0);
        let acc = 0;
        const last = parts.length - 1;
        g = parts.map((p, pi) => {
          const y0 = y(acc), y1 = y(acc + p.v);
          acc += p.v;
          const gap = pi === 0 ? 0 : 2;
          const h = Math.max(0, y0 - y1 - gap);
          const d2 = pi === last ? bar(x, y1, bw, h, 4) : `M${x},${y1}h${bw}v${h}h${-bw}Z`;
          return `<path d="${d2}" class="s${p.ci + 1}"><title>${esc(`${d.label} ${p.k} ${fmt(p.v)}`)}</title></path>`;
        }).join('');
      } else {
        g = `<path d="${bar(x, y(d.value), bw, y(0) - y(d.value), 4)}" class="s1"><title>${esc(tip)}</title></path>`;
      }
      // 触れる範囲は棒より広く(縦いっぱい)
      const hit = `<rect x="${(L + slot * i).toFixed(1)}" y="${T}" width="${slot.toFixed(1)}" height="${ph}" class="hit"><title>${esc(tip)}</title></rect>`;
      const lab = (i % labelEvery === 0 || i === n - 1) ? `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" class="ax" text-anchor="middle">${esc(d.label)}</text>` : '';
      const val = i === n - 1 ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(y(d.value) - 5).toFixed(1)}" class="val" text-anchor="middle">${esc(fmt(d.value))}</text>` : '';
      return hit + g + lab + val;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${grid}${bars}</svg>`;
  }

  const days = S.days.slice(-14);
  const weeks = S.weeks.slice(-8);
  const enough = S.days.length >= 2;
  const waiting = (what) => `<p class="empty">記録がたまると出ます(${esc(what)})。いまの記録は ${S.snapshots} 回。</p>`;

  const usedDepts = S.depts.filter((k) => days.some((d) => (d.byDeptValue[k] || 0) > 0));
  const legend = `<ul class="legend">${usedDepts.map((k) => `<li><span class="sw s${S.depts.indexOf(k) + 1}"></span>${esc(k)}</li>`).join('')}</ul>`;
  const thisWeek = S.forecast ? S.weeks.find((w) => w.label === S.forecast.weekLabel) : S.weeks[S.weeks.length - 1];
  const table = thisWeek ? `<table class="tbl"><caption>${esc(thisWeek.label)} の週・部署ごと</caption><thead><tr><th>部署</th><th>使用</th><th>割合</th></tr></thead><tbody>${
    S.depts.filter((k) => (thisWeek.byDeptValue[k] || 0) > 0).sort((a, b) => thisWeek.byDeptValue[b] - thisWeek.byDeptValue[a])
      .map((k) => `<tr><td><span class="sw s${S.depts.indexOf(k) + 1}"></span>${esc(k)}</td><td>${esc(fmt(thisWeek.byDeptValue[k]))}</td><td>${Math.round(thisWeek.byDeptValue[k] / thisWeek.value * 100)}%</td></tr>`).join('')
  }</tbody></table>` : '';

  const tiles = S.forecast ? `<div class="tiles">
      <div class="tile"><span>今週ここまで</span><b>${esc(fmt(S.forecast.soFar))}</b></div>
      <div class="tile"><span>このペースだと週末に</span><b class="${isPct && S.forecast.end >= 100 ? 'warn' : ''}">${esc(fmt(S.forecast.end))}</b></div>
      <div class="tile"><span>週の切り替わりまで</span><b>${S.forecast.remainDays.toFixed(1)}<small>日</small></b></div>
    </div>` : waiting('今週の見込み');

  const resetNote = S.resetKnown ? `週の切り替わり: 毎週${U.DOW[data.weekResetDow]}曜 ${data.weekResetHour}時` : '週の切り替わりはまだ聞いていないので、仮に月曜0時で区切っています';
  const calNote = S.cal ? `${esc(S.cal.from.at)} に社長の使用量画面で見た ${esc(S.cal.from.percent)}% に合わせています` : 'まだ社長の使用量画面の値で合わせていないので、%ではなくドル(目安の費用)で出しています';
  const updatedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return `<title>Claude 使用率</title>
<style>
:root{--bg:#f3f5f8;--panel:#ffffff;--fg:#18202c;--muted:#5b6676;--line:#dde2ea;--grid:#e8ecf2;--warn:#a35200;
--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--s4:#eda100;--s5:#e87ba4;--s6:#008300;--s7:#6250d6;--s8:#e34948;
--font-head:"M PLUS Rounded 1c","Hiragino Maru Gothic ProN","Hiragino Sans",sans-serif;--font-body:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,sans-serif}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#11161e;--panel:#19202b;--fg:#e8edf4;--muted:#9aa6b6;--line:#2a3442;--grid:#232c39;--warn:#ffb35c;
--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--s5:#d55181;--s6:#008300;--s7:#9085e9;--s8:#e66767;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#11161e;--panel:#19202b;--fg:#e8edf4;--muted:#9aa6b6;--line:#2a3442;--grid:#232c39;--warn:#ffb35c;
--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--s5:#d55181;--s6:#008300;--s7:#9085e9;--s8:#e66767;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--font-body);font-size:15px;line-height:1.6}
.wrap{max-width:44rem;margin:0 auto;padding:20px 16px 40px;display:flex;flex-direction:column;gap:22px}
h1,h2{font-family:var(--font-head);margin:0}
h1{font-size:24px;font-weight:800}
h2{font-size:17px;font-weight:800}
.lead,.note{margin:4px 0 0;color:var(--muted);font-size:13px}
.notice{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:13px;color:var(--muted)}
.notice b{color:var(--fg)}
section{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 14px 10px;display:flex;flex-direction:column;gap:8px;min-width:0}
svg{width:100%;height:auto;display:block;overflow:visible}
svg .grid{stroke:var(--grid);stroke-width:1}
svg .base{stroke:var(--line);stroke-width:1}
svg .ax{fill:var(--muted);font-size:10px;font-variant-numeric:tabular-nums}
svg .val{fill:var(--fg);font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}
svg .hit{fill:transparent}
svg .hit:hover{fill:var(--grid);opacity:.5}
${[1, 2, 3, 4, 5, 6, 7, 8].map((i) => `.s${i}{fill:var(--s${i});background:var(--s${i})}`).join('\n')}
.tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}
.tile span{font-size:12px;color:var(--muted)}
.tile b{font-family:var(--font-head);font-size:26px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}
.tile b small{font-size:13px;margin-left:2px}
.tile b.warn{color:var(--warn)}
.legend{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--muted)}
.legend li{display:flex;align-items:center;gap:5px}
.sw{display:inline-block;width:10px;height:10px;border-radius:3px;flex:none}
.tbl{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
.tbl caption{text-align:left;color:var(--muted);font-size:12px;padding-bottom:4px}
.tbl th,.tbl td{border-top:1px solid var(--line);padding:5px 6px;text-align:right}
.tbl th:first-child,.tbl td:first-child{text-align:left;display:flex;align-items:center;gap:6px}
.tbl th{color:var(--muted);font-weight:600}
.empty{margin:0;padding:18px 4px;color:var(--muted);font-size:13px;text-align:center}
@media (max-width:420px){.tile b{font-size:21px}}
</style>
<div class="wrap">
  <header>
    <h1>Claude 使用率(目安)</h1>
    <p class="lead">${esc(updatedAt)} 更新 / まとめ: 統括部長モンヒロくん</p>
  </header>
  <p class="notice"><b>目安です。</b>各部署の会話の使用量(費用の記録)を毎晩足し、${calNote}。${esc(resetNote)}。</p>
  ${tiles}
  <section>
    <h2>日ごと</h2>
    ${enough ? chart(days, { labelEvery: days.length > 7 ? 2 : 1, title: `日ごとの使用(${S.unit})` }) : waiting('日ごとのグラフ')}
    <p class="note">夜中の記録(2:52)は前の日の分として数えています。棒を押すと値が出ます。</p>
  </section>
  <section>
    <h2>週ごと</h2>
    ${S.weeks.length >= 1 && enough ? chart(weeks, { title: `週ごとの使用(${S.unit})` }) : waiting('週ごとのグラフ')}
  </section>
  <section>
    <h2>部署ごとの内訳(日ごと)</h2>
    ${enough ? legend + chart(days, { stacked: true, labelEvery: days.length > 7 ? 2 : 1, title: `部署ごとの内訳(${S.unit})` }) + table : waiting('部署ごとの内訳')}
  </section>
</div>
`;
}

module.exports = { build };

if (require.main === module) {
  const data = U.load(DATA);
  fs.writeFileSync(OUT, build(data));
  const S = U.summarize(data);
  console.log(`OK: ${path.relative(ROOT, OUT)}(記録 ${S.snapshots} 回 / 日 ${S.days.length} / 週 ${S.weeks.length} / ${S.cal ? '%で表示' : 'まだ合わせていないのでドルで表示'})`);
}
