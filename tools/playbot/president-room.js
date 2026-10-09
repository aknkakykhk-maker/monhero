// 「モンヒロ社 社長室」のページを作る。社長が見る報告のまとめ(アーティファクト1枚)。
//
// 中身は docs/playbot/dashboard/ の3つの JSON(board: 判断待ち・進行中・公開 / teams: 各部の様子 / scores: 成績)。
// 統括部長:モンヒロくんが JSON を直してこれを回し、出来たページを Artifact で同じ URL へ出し直す。
// スクリプトを使わない素の HTML にしてある(2026-10-09 ダッシュボード型が社長の iPhone で「対応していないブラウザ」になったため)。
//
//   node tools/playbot/president-room.js [--out <出力先>]
//   既定の出力先: docs/playbot/dashboard/president-room.html
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'docs', 'playbot', 'dashboard');
const outArg = process.argv.indexOf('--out');
const OUT = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : path.join(DIR, 'president-room.html');

function readRows(name) {
  const rows = JSON.parse(fs.readFileSync(path.join(DIR, name + '.json'), 'utf8'));
  if (!Array.isArray(rows)) throw new Error(name + '.json は配列にする');
  return rows;
}
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const board = readRows('board');
const teams = readRows('teams');
const scores = readRows('scores').map((r) => ({ ...r, 点: Number(r.点) || 0, 本物: Number(r.本物) || 0 }))
  .sort((a, b) => b.点 - a.点 || b.本物 - a.本物);
const updatedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const byKind = (k) => board.filter((r) => r.区分 === k);
const decide = byKind('判断待ち');
const proposals = decide.filter((r) => r.種類 === '提案').length;
const work = byKind('進行中');
const shipped = byKind('公開');

// 判断待ちの種類。提案 = 部が出した改良・調整の案(案を `案` に並べる) / 質問 = 部が進め方を聞いている
const KIND = { 提案: '提案', 質問: '質問' };
const meta = (parts) => parts.filter(Boolean).map((p) => `<span>${esc(p)}</span>`).join('');
const decideHtml = decide.length
  ? decide.map((r) => `
      <article class="card decide" id="${esc(r.id)}">
        <span class="chip warn">${esc(KIND[r.種類] || '決めてほしいこと')}</span>
        <h3>${esc(r.件名)}</h3>
        <p>${esc(r.中身)}</p>${Array.isArray(r.案) && r.案.length ? `
        <ol class="options">${r.案.map((o) => `<li>${esc(o)}</li>`).join('')}</ol>` : ''}
        <div class="meta">${meta([r.部 + ' ' + r.担当, r.見る場所, r.日付])}</div>
      </article>`).join('')
  : '<p class="empty">いま決めてほしいことはありません。</p>';

const listHtml = (rows, fields) => rows.length
  ? `<ul class="list">${rows.map((r) => `
      <li id="${esc(r.id)}">
        <div class="row-title">${esc(r.件名)}</div>
        ${r.中身 ? `<div class="row-body">${esc(r.中身)}</div>` : ''}
        <div class="meta">${meta(fields.map((f) => (r[f] ? (f === 'PR' ? 'PR ' + r[f] : f === '見込み' ? '見込み ' + r[f] : r[f]) : '')))}</div>
      </li>`).join('')}</ul>`
  : '<p class="empty">ありません。</p>';

const PILL = { 作業中: 'ok', 返事待ち: 'warn', 止まっている: 'bad' };
const teamHtml = `<ul class="list">${teams.map((t) => `
      <li>
        <div class="row-title"><span class="team">${esc(t.部)}</span><span class="chip ${PILL[t.状態] || 'idle'}">${esc(t.状態)}</span></div>
        <div class="row-body">${esc(t.いま)}</div>
        <div class="meta">${meta([t.部長, t.部員 && t.部員 !== '—' ? '部員 ' + t.部員 : '', t.最後の報告 && t.最後の報告 !== '—' ? '最後の報告 ' + t.最後の報告 : ''])}</div>
      </li>`).join('')}</ul>`;

const lo = Math.min(0, ...scores.map((r) => r.点));
const hi = Math.max(1, ...scores.map((r) => r.点));
const span = hi - lo;
const zero = (-lo / span) * 100;
const scoreHtml = scores.map((r, i) => {
  const w = (Math.abs(r.点) / span) * 100;
  const left = r.点 < 0 ? zero - w : zero;
  const cls = i === 0 ? 'top' : r.点 < 0 ? 'neg' : '';
  return `
      <div class="bar-row">
        <span class="bar-name">${esc(r.名前)}</span>
        <span class="bar-track"><span class="bar-zero" style="left:${zero.toFixed(2)}%"></span><span class="bar ${cls}" style="left:${left.toFixed(2)}%;width:${Math.max(w, 0.8).toFixed(2)}%"></span></span>
        <span class="bar-val">${r.点 < 0 ? '−' + Math.abs(r.点) : r.点}</span>
      </div>`;
}).join('');
const mvp = scores[0];

const html = `<title>モンヒロ社 社長室</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;800&display=swap">
<style>
/* 社長の机の上の報告書: 上から「決める→動いている→終わった→部→成績」。スマホ1列、広い画面は2列 */
:root{--bg:#f3f5f8;--panel:#ffffff;--fg:#18202c;--muted:#5b6676;--line:#dde2ea;--accent:#2a56c6;--warn:#a35200;--warn-bg:#fff4e5;--ok:#17803d;--bad:#b42318;--track:#e8ecf2;
--font-head:"M PLUS Rounded 1c","Hiragino Maru Gothic ProN","Hiragino Sans",sans-serif;--font-body:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,sans-serif}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#11161e;--panel:#19202b;--fg:#e8edf4;--muted:#9aa6b6;--line:#2a3442;--accent:#7fa2ff;--warn:#ffb35c;--warn-bg:#2d2416;--ok:#5fd28a;--bad:#ff8a7a;--track:#232c39;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#11161e;--panel:#19202b;--fg:#e8edf4;--muted:#9aa6b6;--line:#2a3442;--accent:#7fa2ff;--warn:#ffb35c;--warn-bg:#2d2416;--ok:#5fd28a;--bad:#ff8a7a;--track:#232c39;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--font-body);font-size:15px;line-height:1.6}
.wrap{max-width:68rem;margin:0 auto;padding:20px 16px 40px;display:flex;flex-direction:column;gap:28px}
h1,h2,h3{font-family:var(--font-head);margin:0;text-wrap:balance}
h1{font-size:26px;font-weight:800;letter-spacing:.02em}
h2{font-size:18px;font-weight:800}
h3{font-size:16px;font-weight:800}
.lead{margin:4px 0 0;color:var(--muted);font-size:13px}
.counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.count{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;text-decoration:none;color:inherit}
.count b{font-family:var(--font-head);font-size:28px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}
.count span{font-size:12px;color:var(--muted)}
.count.warn b{color:var(--warn)}
section{display:flex;flex-direction:column;gap:10px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr));gap:10px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;min-width:0}
.card.decide{background:var(--warn-bg);border-color:var(--warn)}
.card p{margin:0}
.options{margin:0;padding-left:1.4em;display:flex;flex-direction:column;gap:2px;font-size:14px}
.chip{display:inline-block;align-self:flex-start;border:1px solid currentColor;border-radius:999px;padding:0 9px;font-size:12px;line-height:20px;white-space:nowrap}
.chip.warn{color:var(--warn)}.chip.ok{color:var(--ok)}.chip.bad{color:var(--bad)}.chip.idle{color:var(--muted)}
.meta{display:flex;flex-wrap:wrap;gap:2px 12px;font-size:12px;color:var(--muted)}
.list{list-style:none;margin:0;padding:0;background:var(--panel);border:1px solid var(--line);border-radius:12px}
.list li{padding:12px 16px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:3px;min-width:0}
.list li:first-child{border-top:0}
.row-title{font-weight:700;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.team{font-family:var(--font-head);font-weight:800}
.row-body{font-size:14px}
.empty{margin:0;color:var(--muted)}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,26rem),1fr));gap:28px;align-items:start}
.mvp{display:flex;flex-direction:column;gap:2px}
.mvp b{font-family:var(--font-head);font-size:24px;font-weight:800}
.bars{display:flex;flex-direction:column;gap:6px}
.bar-row{display:grid;grid-template-columns:minmax(0,8.5em) minmax(0,1fr) 2.6em;align-items:center;gap:8px;font-size:13px}
.bar-name{overflow-wrap:anywhere;color:var(--muted)}
.bar-track{position:relative;height:14px;background:var(--track);border-radius:7px}
.bar-zero{position:absolute;top:-3px;bottom:-3px;width:1px;background:var(--muted)}
.bar{position:absolute;top:0;bottom:0;border-radius:7px;background:var(--muted);opacity:.55}
.bar.top{background:var(--accent);opacity:1}
.bar.neg{background:var(--bad);opacity:.8}
.bar-val{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}
.note{font-size:12px;color:var(--muted);margin:0}
</style>
<div class="wrap">
  <header>
    <h1>モンヒロ社 社長室</h1>
    <p class="lead">${esc(updatedAt)} 更新 / まとめ: 統括部長:モンヒロくん。決めたいことは、チャットでそのまま伝えてください。</p>
  </header>

  <nav class="counts" aria-label="件数">
    <a class="count warn" href="#decide"><b>${decide.length}</b><span>社長の判断待ち${proposals ? `(うち提案 ${proposals})` : ''}</span></a>
    <a class="count" href="#work"><b>${work.length}</b><span>進行中</span></a>
    <a class="count" href="#shipped"><b>${shipped.length}</b><span>公開したもの</span></a>
  </nav>

  <section id="decide">
    <h2>社長の判断待ち(提案・質問)</h2>
    <p class="note">部からの提案は「提案」、進め方の確認は「質問」の札で出ます。決めたら、チャットで番号や案を伝えてください。</p>
    <div class="cards">${decideHtml}
    </div>
  </section>

  <div class="cols">
    <section id="work">
      <h2>進行中の作業</h2>
      ${listHtml(work, ['担当', '見込み', 'PR'])}
    </section>
    <section id="shipped">
      <h2>公開したもの</h2>
      ${listHtml(shipped, ['担当', 'PR', '見る場所'])}
      <p class="note">本番: https://aknkakykhk-maker.github.io/monhero/</p>
    </section>
  </div>

  <div class="cols">
    <section id="teams">
      <h2>各部の様子</h2>
      ${teamHtml}
    </section>
    <section id="scores">
      <h2>成績表</h2>
      <div class="card">
        <div class="mvp"><span class="note">いま点がいちばん高い部員</span><b>${mvp ? esc(mvp.名前) : '—'}</b><span class="note">${mvp ? esc(mvp.所属) + ' / ' + mvp.点 + '点' : ''}</span></div>
        <div class="bars">${scoreHtml}
        </div>
        <p class="note">本物の不具合 +3 / 社長が選んだ改良の公開 +2 / 見間違い −1 / 指示違反 −5(10/9から)</p>
      </div>
    </section>
  </div>
</div>
`;
fs.writeFileSync(OUT, html);
console.log('OK: ' + path.relative(ROOT, OUT) + ' (判断待ち ' + decide.length + ' / 進行中 ' + work.length + ' / 公開 ' + shipped.length + ')');

// 載せ忘れの見張り(2026-10-09 社長「社長室の内容は更新内容ちゃんとしてくれないと困る」。部が報告を送らずに公開した件が漏れた)。
// 今日 main に入った PR のうち、board.json のどこにも番号が無いものを並べる。統括部長の記録用の PR(window-requests)と部の記録だけの PR(playbot-history)は除く。
try {
  const { execSync } = require('child_process');
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const log = execSync(`git log origin/main --first-parent --since="${today} 00:00 +0900" --format=%s`, { cwd: ROOT, encoding: 'utf8' });
  const listed = new Set((JSON.stringify(board).match(/#\d+/g) || []));
  const missing = log.split('\n').filter((s) => s && !/window-requests|playbot-history/.test(s))
    .map((s) => ({ s, n: (s.match(/#(\d+)/) || [])[0] })).filter((x) => x.n && !listed.has(x.n));
  if (missing.length) {
    console.log('要確認: 今日公開されたのに社長室に載っていない PR が ' + missing.length + ' 件(載せるか、載せない理由があればそのまま):');
    missing.forEach((x) => console.log('  ' + x.s));
  }
} catch (e) {
  console.log('要確認: 公開の載せ忘れを確かめられなかった(' + e.message.split('\n')[0] + ')');
}
