const R = require('./rows.js');
const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/★/g,'<b class="k">★</b>').replace(/◆/g,'<b class="o">◆</b>');
const sec = (t, rows) => `<h2>${t}</h2><table><tr><th>ターン</th><th>参考(同じ位置の半月)</th><th>いまのモンサク</th><th>案(うちの名前)</th></tr>${rows.map(r=>`<tr><td class="n">${r[0]}</td><td>${esc(r[1])}</td><td class="now">${esc(r[2])}</td><td class="an">${esc(r[3])}</td></tr>`).join('')}</table>`;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:18px;background:#fff;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;color:#1e1b4b;width:1500px}
h1{font-size:24px;margin:0 0 4px}.lead{font-size:14px;margin:0 0 4px;line-height:1.6}
h2{font-size:18px;margin:14px 0 4px;background:#1e1b4b;color:#fff;padding:3px 10px;border-radius:6px}
table{border-collapse:collapse;width:100%;font-size:13px;line-height:1.45}
th{background:#e0e7ff;padding:4px;border:1px solid #c7d2fe}td{border:1px solid #c7d2fe;padding:4px 6px;vertical-align:top;word-break:keep-all;overflow-wrap:anywhere}
td.n{text-align:center;font-weight:900;width:44px}td:nth-child(2){width:36%}td.now{width:22%;color:#475569}td.an{background:#fefce8}
b.k{color:#ca8a04}b.o{color:#dc2626}
</style><h1>モンサクの大会の名前と並び(参考 → うち)・案</h1>
<p class="lead">うちは1ターン=1か月のまま。期の中の位置(1〜12ターン目)を、参考の同じ位置の半月にそろえる(Fable の突き合わせと同じ)。<b class="k">★</b> = 名前は参考のまま。<b class="o">◆</b> = オリジナル(参考の中の団体・固有の大会の名前〔IMa・毎育新聞・レジェンド・ダービー・四大の名前〕と、うちに無い仕組み〔地形・性格・オーラ〕の所)。<br>
並び: ふだんは銀と銅の2つ・山場の月だけ増やす/期末の日はほかの大会なし/四大・選抜・記念・チャンピオンズの月を参考の位置へ。いまの「◯◯自慢」「間合い(◯)」「タイプ」は、名前を外して札の印(条件・得意)で見せる。アイテム名は変えない。</p>
${sec('ジュニア期', R.junior)}${sec('ミドル期', R.middle)}${sec('プロ期', R.pro)}${sec('最後の期', R.final)}`;
require('fs').writeFileSync(__dirname + '/table.html', html);
