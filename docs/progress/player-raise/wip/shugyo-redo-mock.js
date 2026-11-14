// 修行の画面の作り直し案(止め絵)。本物のページを開き、助手の顔などの絵の場所だけ借りて、案の画面を組んで撮る
const path = require('path'); const fs = require('fs'); const http = require('http');
const ROOT = '/home/user/monhero'; const OUT = process.env.OUT || require('path').join(__dirname, '..', 'shots', 'shugyo-redo-2026-11-14'); // 案の止め絵の置き場(q-data.json もここ)
const { chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'));
const D = JSON.parse(fs.readFileSync(path.join(OUT, 'q-data.json'), 'utf8'));
const M = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

const DIST = ['零', '近', '中', '遠'];
const ST = { life: ['❤️', 'ライフ'], pow: ['💪', 'ちから'], wise: ['🧠', 'かしこさ'], hit: ['🎯', '命中'], eva: ['💨', '回避'], tough: ['🛡️', '丈夫さ'] };
const learn = Object.fromEntries(D.learn.map((l) => [l.id, l]));
const got = new Set(D.techs);
const course = D.courses[0];
const stg = (st) => st.map((k) => `${ST[k][0]}${ST[k][1]}`).join(' & ');
const want = ['sk-0401']; // 案では「もちき」を1つ選んだところ
const tech = (id) => D.all.find((t) => t.id === id);
const pct = (r) => `${Math.round(r * 100)}%`;

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{width:390px;height:844px;overflow:hidden;background:linear-gradient(180deg,#1b1640,#120f2b);color:#fff;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;font-weight:700}
.hd{display:flex;align-items:center;gap:8px;padding:10px 12px 6px}
.hd .bk{border:1px solid #ffffff33;border-radius:99px;padding:5px 12px;font-size:13px;background:#ffffff12}
.hd .t{font-size:16px;font-weight:900;flex:1}
.hd .tk{font-size:12px;background:#f9731633;border:1px solid #fb923c;border-radius:99px;padding:3px 10px}
.say{display:flex;gap:8px;align-items:center;margin:2px 12px 8px}
.say img{width:44px;height:44px;border-radius:50%;border:2px solid #fff;background:#fff;object-fit:cover}
.say .b{flex:1;background:#fffdf5;color:#1e1b4b;border-radius:12px;padding:6px 10px;font-size:12.5px;line-height:1.45}
.sec{margin:0 12px 8px;padding:8px 10px;border-radius:14px;background:#ffffff0d;border:1px solid #ffffff1f}
.sec h3{font-size:12px;color:#f9a8d4;margin-bottom:6px;display:flex;align-items:center;gap:6px}
.sec h3 i{font-style:normal;display:inline-flex;width:18px;height:18px;border-radius:50%;background:#f472b6;color:#fff;font-size:11px;align-items:center;justify-content:center}
.tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.tabs b{display:block;text-align:center;padding:7px 0;border-radius:10px;font-size:12.5px;background:#ffffff14;border:1px solid #ffffff22}
.tabs b.on{background:linear-gradient(180deg,#fde047,#f59e0b);color:#422006;border-color:#fde047}
.flow{display:flex;align-items:center;gap:4px;margin-top:6px;font-size:11px}
.flow span{flex:1;text-align:center;padding:4px 2px;border-radius:8px;background:#0f0b2299;border:1px solid #ffffff22}
.flow em{font-style:normal;color:#94a3b8}
.slots{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.slot{min-height:58px;border-radius:12px;padding:6px 8px;border:2px dashed #ffffff40;font-size:11px;color:#cbd5e1;display:flex;flex-direction:column;justify-content:center;gap:2px}
.slot.on{border:2px solid #fde047;background:#fde04718;color:#fff}
.slot .n{font-size:14px;font-weight:900}
.slot .r{font-size:18px;font-weight:900;color:#fde047}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.col h4{text-align:center;font-size:12px;padding:3px 0;margin-bottom:4px;border-radius:8px;background:#ffffff1a}
.card{border-radius:10px;padding:5px 4px;margin-bottom:5px;text-align:center;font-size:10.5px;line-height:1.3;background:#ffffff10;border:1px solid #ffffff22;min-height:46px;display:flex;flex-direction:column;justify-content:center}
.card .p{font-size:15px;font-weight:900;color:#86efac}
.card.ok{background:#16a34a22;border-color:#4ade80}
.card.sel{background:#fde04722;border:2px solid #fde047}
.card.sel .p{color:#fde047}
.card.got{opacity:.55}
.card.got .p{font-size:11px;color:#cbd5e1}
.card.lock{opacity:.35}
.card .rk{font-size:9.5px;color:#cbd5e1}
.ft{position:absolute;left:0;right:0;bottom:0;padding:8px 12px 14px;background:linear-gradient(180deg,#120f2b00,#120f2b 30%)}
.go{display:flex;align-items:center;justify-content:center;gap:8px;border-radius:16px;padding:12px 0;background:linear-gradient(90deg,#f472b6,#fb923c);font-size:17px;font-weight:900;box-shadow:0 4px 0 #9d174d}
.go small{font-size:12px;background:#0003;border-radius:99px;padding:2px 8px}
.sub{font-size:11px;color:#cbd5e1;text-align:center;margin-top:5px}
.tag{position:absolute;right:12px;top:52px;z-index:9;background:#22d3ee;color:#083344;font-size:11px;font-weight:900;border-radius:6px;padding:2px 8px}
.steps{display:flex;gap:4px;margin:0 12px 8px}
.steps span{flex:1;text-align:center;font-size:11.5px;padding:6px 0;border-radius:10px;background:#ffffff10;color:#94a3b8}
.steps span.on{background:#f472b6;color:#fff}
.steps span.done{background:#ffffff22;color:#fff}
.list .row{display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:6px;border-radius:12px;background:#16a34a1f;border:1px solid #4ade8099}
.list .row.sel{background:#fde04722;border:2px solid #fde047}
.list .row .d{width:28px;height:28px;border-radius:8px;background:#ffffff22;display:flex;align-items:center;justify-content:center;font-size:13px}
.list .row .nm{flex:1;font-size:14px}
.list .row .nm small{display:block;font-size:10.5px;color:#cbd5e1}
.list .row .bar{width:86px}
.list .row .bar i{display:block;height:7px;border-radius:4px;background:#ffffff22;overflow:hidden}
.list .row .bar i u{display:block;height:100%;background:#4ade80}
.list .row .bar b{display:block;text-align:right;font-size:16px;color:#86efac}
.list .row.sel .bar b{color:#fde047}
.fold{display:flex;justify-content:space-between;padding:9px 10px;border-radius:12px;background:#ffffff0d;border:1px solid #ffffff22;font-size:12px;color:#cbd5e1;margin-bottom:6px}
.dest{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.dest .c{border-radius:12px;padding:8px;background:#ffffff10;border:1px solid #ffffff22;font-size:11px;line-height:1.5}
.dest .c.on{border:2px solid #fde047;background:#fde04714}
.dest .c b{display:block;font-size:14px}
.note{font-size:10.5px;color:#cbd5e1;margin-top:4px;line-height:1.5}
`;

const head = (face, tag) => `<div class="tag">${tag}</div><div class="hd"><span class="bk">← もどる</span><span class="t">⚔ 修行</span><span class="tk">🎫 チケット ${D.tickets}枚</span></div>
<div class="say"><img src="${face}" alt=""><div class="b">「覚えたい技を<b>1つ</b>選んでね。<b>2つ</b>選ぶと超修行!」</div></div>`;
const foot = (sub) => `<div class="ft"><div class="go">⚔ 修行する <small>🎫 ${D.tickets} → ${D.tickets - 1}</small></div><div class="sub">${sub}</div></div>`;

// 案A: 間合いごとの4列の札(参考動画の組み立て)。選んだ技の枠2つを上に大きく
const A = (face) => {
  const cols = DIST.map((dn, d) => {
    const ts = D.all.filter((t) => t.dist.includes(d)).sort((a, b) => a.rank - b.rank);
    return `<div class="col"><h4>${dn}</h4>${ts.slice(0, 4).map((t) => {
      const l = learn[t.id]; const cls = want.includes(t.id) ? 'sel' : got.has(t.id) ? 'got' : l ? 'ok' : 'lock';
      return `<div class="card ${cls}">${t.name}<span class="rk">R${t.rank}</span>${got.has(t.id) ? '<span class="p">覚えた</span>' : l ? `<span class="p">${pct(l.rate)}</span>` : '<span class="p">🔒</span>'}</div>`;
    }).join('')}</div>`;
  }).join('');
  return `${head(face, '案A 4列の札')}
<div class="sec"><h3><i>1</i>行き先</h3><div class="tabs">${D.courses.map((c, i) => `<b class="${i ? '' : 'on'}">${c.name}</b>`).join('')}</div>
<div class="flow"><span>第1段<br>${stg(course.stages[0])}</span><em>▶</em><span>第2段<br>${stg(course.stages[1])}</span><em>▶</em><span>技のくじ</span></div></div>
<div class="sec"><h3><i>2</i>覚えたい技(2つで🔥超修行・のこり${D.superLeft}回)</h3><div class="slots">
<div class="slot on"><span>えらんだ技</span><span class="n">💪 ${tech(want[0]).name}</span><span class="r">${pct(learn[want[0]].rate)}</span></div>
<div class="slot">＋ もう1つ選ぶと超修行<br>(2つとも ${pct(learn[want[0]].superRate)} に上がる)</div></div></div>
<div class="sec" style="padding-bottom:4px"><h3>覚えられる技(緑の札をタップ)</h3><div class="grid">${cols}</div></div>
${foot('技を選ばなくても、能力は上がります')}`;
};

// 案B: 3つの手順に分ける(いまは ②技 の画面)。行き先は ① で大きな札から選ぶ
const B = (face) => {
  const rows = D.learn.map((l) => { const t = tech(l.id); return `<div class="row ${want.includes(l.id) ? 'sel' : ''}"><span class="d">${DIST[t.dist[0]]}</span><span class="nm">${t.kind === 'pow' ? '💪' : '🧠'} ${t.name}<small>R${t.rank}・ガッツ ${t.guts}</small></span><span class="bar"><b>${pct(l.rate)}</b><i><u style="width:${Math.round(l.rate * 100)}%"></u></i></span></div>`; }).join('');
  return `${head(face, '案B 手順を3つに分ける')}
<div class="steps"><span class="done">① 行き先 炎の谷 ✓</span><span class="on">② 技をえらぶ</span><span>③ 修行する</span></div>
<div class="sec"><h3>いま覚えられる技(${D.learn.length}つ)</h3><div class="list">${rows}</div>
<div class="fold"><span>🔒 まだ覚えられない技</span><span>${D.all.length - D.learn.length - got.size}つ ▼</span></div>
<div class="fold"><span>✅ 覚えた技</span><span>${got.size}つ ▼</span></div>
<div class="note">ランクが高い技ほど覚えにくい。能力・忠誠度・人気が仕上がっているほど、行き先の旬の季節ほど覚えやすい。</div></div>
<div class="sec"><h3>①で選んだ行き先</h3><div class="dest"><div class="c on"><b>🔥 炎の谷</b>第1段 ${stg(course.stages[0])}<br>第2段 ${stg(course.stages[1])}</div><div class="c">「近」の間合い適性が<br>ときどき1段上がる</div></div></div>
${foot('次へ:③で「修行する」を押すと始まります')}`;
};

// 案C: 1画面のまま、覚えられる技を先頭に大きく・まだの技はたたむ。行き先は下の札に小さく
const C = (face) => {
  const rows = D.learn.map((l) => { const t = tech(l.id); return `<div class="row ${want.includes(l.id) ? 'sel' : ''}"><span class="d">${DIST[t.dist[0]]}</span><span class="nm">${t.kind === 'pow' ? '💪' : '🧠'} ${t.name}<small>R${t.rank}・${want.includes(l.id) ? '選んでいる' : 'タップで選ぶ'}</small></span><span class="bar"><b>${pct(l.rate)}</b><i><u style="width:${Math.round(l.rate * 100)}%"></u></i></span></div>`; }).join('');
  return `${head(face, '案C 覚えられる技を先頭に')}
<div class="sec"><h3><i>1</i>覚えたい技をえらぶ(2つで🔥超修行)</h3><div class="list">${rows}</div>
<div class="fold"><span>🔒 まだ覚えられない技(ランクが上がると出る)</span><span>${D.all.length - D.learn.length - got.size}つ ▼</span></div></div>
<div class="sec"><h3><i>2</i>行き先(上がる能力が変わる)</h3><div class="dest">${D.courses.map((c, i) => `<div class="c ${i ? '' : 'on'}"><b>${['🔥', '❄️', '🍃', '✨'][i]} ${c.name}</b>${stg(c.stages[0])}<br>${stg(c.stages[1])}</div>`).join('')}</div></div>
${foot('えらんだ技: もちき 78% ・ 技を選ばなくても能力は上がります')}`;
};

(async () => {
  const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': M[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8977);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:8977/monster-hero/index.html', { waitUntil: 'load', timeout: 90000 });
  await p.waitForFunction(() => typeof msxFace === 'function' && typeof assistantFaceImage === 'function', null, { timeout: 90000 });
  const face = await p.evaluate(() => msxFace('mua', 'happy'));
  for (const [n, f] of [['A', A], ['B', B], ['C', C]]) {
    await p.evaluate(({ css, html }) => { document.head.innerHTML = `<meta charset="utf-8"><style>${css}</style>`; document.body.innerHTML = html; }, { css: CSS, html: f(`/monster-hero/${face}`.replace('/monster-hero//', '/')) });
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, `q-plan-${n}.png`) });
  }
  await b.close(); srv.close();
  console.log('撮った: A B C');
})();
