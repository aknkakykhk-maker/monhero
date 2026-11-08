// 助手のマスモン案の表と画面の見本を、masmon-plan.json から作る(2026-11-08 助手部キズナ)
//   node docs/progress/assistant-peer/ux/masmon-mock.js   → masmon-table.png・masmon-screen.png
'use strict';
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..', '..', '..');
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'masmon-plan.json'), 'utf8')).assistants;
const ally = fs.readFileSync(path.join(root, 'monster-hero/data/ally-monsters.js'), 'utf8');
const nameOf = (id) => { const m = ally.match(new RegExp(`^\\s{2}${id}:\\s*(?:Object\\.freeze\\()?\\{[^\\n]*?name:\\s*["']([^"']+)`, 'm')); return m ? m[1] : id; };
const LIN = { mocchi: 'モッチー', suezo: 'スエゾー', golem: 'ゴーレム', tiger: 'ライガー', ham: 'ハム', pixie: 'ピクシー', monol: 'モノリス', plant: 'プラント', zan: 'ザン', ark: 'アーク', undine: 'ウンディーネ', yggdrasil: 'ユグドラシル', ghost: 'ゴースト', illumine: 'イルミネ', kyubi: 'キュービ' };
const IMG = { Mocchi: 'mocchi.png', Pixie: 'pixie.png', MelWhip: 'mel-whip.png', Golem: 'golem.png', Plant: 'plant.PNG', Undine: 'undine.PNG', Melody: 'melody.png', Mia: 'mia.PNG', Ham: 'ham.png', Suezo: 'suezo.png', Oboro: 'oboro.png', Mitarashi: 'mitarashi.png', Tiger: 'tiger.png', KenshiMocchi: 'kenshi-mocchi.png', Zan: 'zan.png', Illumine: 'illumine.png', Dreamy: 'dreamy.png', Kuromy: 'kuromy.png', Kyubi: 'kyubi.png', Orihime: 'orihime.png', Monol: 'monol.png', Ark: 'ark.png', Yggdrasil: 'yggdrasil.png', Ghost: 'ghost.png' };
const img = (id) => `../../../../monster-hero/images/monsters/${IMG[id] || 'mocchi.png'}`;
const face = (id, e = 'happy') => `../../../../monster-hero/images/assistant/${id === 'mua' ? 'myua' : id}_${e}.PNG`; // みゅあの絵は myua_*
// 文を句読点のまとまりで折る(言葉の途中で折らない)
const chunks = (t) => String(t).split(/(?<=[、。])/).map(x => `<span class="nw">${x}</span>`).join('<wbr>');
const CSS = `
:root{--ink:#f8fafc;--sub:#cbd5e1}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f172a;color:var(--ink);font-family:"Hiragino Maru Gothic ProN","M PLUS Rounded 1c","Noto Sans JP",sans-serif;padding:16px}
h1{font-size:20px;font-weight:900}.lead{font-size:12px;color:var(--sub);margin:4px 0 12px;line-height:1.5}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:760px}
.card{background:#1e1b4b;border:2px solid #334155;border-radius:16px;padding:10px 12px}
.hd{display:flex;align-items:center;gap:8px}.hd img{width:40px;height:40px;border-radius:50%;object-fit:cover;object-position:50% 8%;background:#fff;border:2px solid #fff}
.hd b{font-size:17px}.hd small{margin-left:auto;font-size:10.5px;color:#fde68a;font-weight:900;white-space:nowrap}
.mons{display:flex;gap:6px;margin-top:8px}
.mon{flex:1;background:#0b1020;border-radius:10px;padding:5px;text-align:center;position:relative;min-width:0}
.mon img{width:100%;height:58px;object-fit:contain;background:radial-gradient(circle,#cbd5e1 0,#64748b 70%);border-radius:8px}
.mon b{display:block;font-size:12px;white-space:nowrap}.mon i{display:block;font-style:normal;font-size:9.5px;color:#94a3b8;white-space:nowrap}
.mon .ld{position:absolute;left:4px;top:4px;font-size:9px;font-weight:900;background:#f472b6;border-radius:6px;padding:0 4px}
.row{margin-top:6px;font-size:11px;line-height:1.45;display:flex;gap:6px}.row .k{flex:none;width:44px;font-weight:900}.row .v{flex:1}.nw{white-space:nowrap}
.lk{color:#86efac}.ds{color:#fca5a5}.dk{color:#fde68a}
.chip{display:inline-block;white-space:nowrap;margin-right:6px}
.later{font-size:10px;color:#94a3b8;margin-top:4px}
`;
const table = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>助手のマスモン案</title><style>${CSS}</style></head><body>
<h1>助手のマスモン一覧・編成・デッキ・好きな血統と苦手な血統(案)</h1>
<p class="lead" style="width:760px">モンスターは実装済み(ALL_PLAYER_MONSTERS)からだけ。1人3体・🅿先頭が編成の先頭。ニックネームは助手が付けた名前の案。好き・苦手は血統ごと(持っているマスモンの血統は好きに入る)。数字(スコア・ランキング・強さ)には効かせません。</p>
<div class="grid">${plan.map(a => `<div class="card"><div class="hd"><img src="${face(a.id)}" alt=""><b>${a.name}</b><small>🃏 ${a.deck.name}</small></div>
<div class="mons">${a.team.map(m => `<div class="mon">${m.lead ? '<span class="ld">先頭</span>' : ''}<img src="${img(m.monster)}" alt=""><b>${m.nick}</b><i>${nameOf(m.monster)}</i></div>`).join('')}</div>
<p class="row lk"><span class="k">💗 好き</span><span class="v">${a.like.map(l => `<span class="chip">${LIN[l.lineage]}</span>`).join('')}</span></p>
<p class="row ds"><span class="k">💦 苦手</span><span class="v">${a.dislike.map(l => `<span class="chip">${LIN[l.lineage]}</span>`).join('')}</span></p>
<p class="row dk"><span class="k">🃏 方針</span><span class="v">${chunks(a.deck.plan)}</span></p>
${a.later ? `<p class="later">あとで: ${a.later.monster}(実装されたら4体目に)</p>` : ''}</div>`).join('')}</div></body></html>`;
fs.writeFileSync(path.join(__dirname, 'masmon-table.html'), table);
// 画面の見本: 部屋のシートの「🐾 マスモン」から開く。縦=マスモン一覧/横=編成とデッキ/🔄横=横を回して縦の端末に
const k = plan.find(a => a.id === 'kiki');
const tabs = (on) => `<div class="tb">${['🐾 マスモン', '⚔ 編成', '🃏 デッキ', '💗 好き・苦手'].map((t, i) => `<span class="${i === on ? 'on' : ''}">${t}</span>`).join('')}</div>`;
const list = (a) => a.team.map(m => `<div class="li"><img src="${img(m.monster)}" alt=""><div><b>${m.nick}${m.lead ? ' <em>先頭</em>' : ''}</b><i>${nameOf(m.monster)} ・ Lv.${m.lead ? 24 : 15}</i><p>${chunks(m.why)}</p></div></div>`).join('');
const team = (a) => `<div class="tm">${a.team.map(m => `<div class="sl">${m.lead ? '<em>先頭</em>' : ''}<img src="${img(m.monster)}" alt=""><b>${m.nick}</b></div>`).join('')}</div>`;
const deck = (a) => `<div class="dkb"><p class="dn">🃏 ${a.deck.name}</p><p>${chunks(a.deck.plan)}</p><p class="lk2">💗 ${a.like.map(l => LIN[l.lineage]).join('・')}</p><p class="ds2">💦 ${a.dislike.map(l => LIN[l.lineage]).join('・')}</p></div>`;
const SCSS = `${CSS}
.ph{background:linear-gradient(#1e1b4b,#0b1020 70%);border:3px solid #334155;border-radius:24px;overflow:hidden;position:relative;flex:none}
.top{padding:12px 14px 4px}.en{font-size:10px;letter-spacing:.2em;color:#f9a8d4;font-weight:900}.t{font-size:19px;font-weight:900;display:flex;align-items:center;gap:8px}
.t img{width:34px;height:34px;border-radius:50%;object-fit:cover;object-position:50% 8%;background:#fff}
.tb{display:flex;gap:4px;padding:6px 12px}.nw{white-space:nowrap}.tb span{flex:1;text-align:center;font-size:11px;font-weight:900;padding:6px 0;border-radius:10px;background:#1e293b;color:#94a3b8;white-space:nowrap}.tb .on{background:linear-gradient(90deg,#f472b6,#fb923c);color:#fff}
.li{display:flex;gap:10px;margin:8px 12px;background:#111827;border:1px solid #334155;border-radius:14px;padding:8px}
.li img{width:76px;height:76px;object-fit:contain;background:radial-gradient(circle,#cbd5e1 0,#64748b 70%);border-radius:10px}
.li b{font-size:15px}.li em{font-style:normal;font-size:10px;background:#f472b6;border-radius:6px;padding:0 5px;vertical-align:2px}.li i{display:block;font-style:normal;font-size:11px;color:#94a3b8}.li p{font-size:11.5px;margin-top:3px;line-height:1.4}
.tm{display:flex;gap:8px;padding:8px 12px}.sl{flex:1;background:#111827;border:1px solid #334155;border-radius:14px;text-align:center;padding:6px;position:relative}
.sl img{width:100%;height:96px;object-fit:contain;background:radial-gradient(circle,#cbd5e1 0,#64748b 70%);border-radius:10px}.sl b{font-size:13px;white-space:nowrap}.sl em{position:absolute;left:6px;top:6px;font-style:normal;font-size:10px;background:#f472b6;border-radius:6px;padding:0 5px}
.dkb{margin:8px 12px;background:#111827;border:1px solid #334155;border-radius:14px;padding:10px;font-size:12px;line-height:1.5}.dn{font-size:15px;font-weight:900;color:#fde68a}.lk2{color:#86efac;font-weight:900}.ds2{color:#fca5a5;font-weight:900}
.note{font-size:10.5px;color:#94a3b8;margin:6px 12px}
.cap{font-size:12px;color:#e2e8f0;margin-top:6px;width:390px;line-height:1.5}
.row2{display:flex;gap:16px;align-items:flex-start}
.rot{width:390px;height:844px;border:3px solid #334155;border-radius:24px;position:relative;overflow:hidden;background:#000}
.rot .ph{position:absolute;left:50%;top:50%;width:844px;height:390px;transform:translate(-50%,-50%) rotate(90deg);border:0;border-radius:0}
`;
const land = (a) => `<div class="ph" style="width:844px;height:390px"><div class="top"><p class="en">MASMON · ${a.id.toUpperCase()}</p><p class="t"><img src="${face(a.id)}" alt="">${a.name}のマスモン</p></div>${tabs(1)}
<div style="display:flex"><div style="flex:1.35">${team(a)}<p class="note">編成はいつも${a.name}が決める。相談されたら変わることも</p></div><div style="flex:1">${deck(a)}</div></div></div>`;
const screen = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>助手のマスモン画面の見本</title><style>${SCSS}</style></head><body>
<h1>助手のマスモン(部屋の「🐾 マスモン」から開く)見本</h1>
<p class="lead">見本の絵です(まだ作っていません)。プレイヤーのマスモン画面と同じ見せ方。見るだけで、プレイヤーのマスモン・セーブには触りません。</p>
<div class="row2">
<div><div class="ph" style="width:390px;height:844px"><div class="top"><p class="en">MASMON · ${k.id.toUpperCase()}</p><p class="t"><img src="${face(k.id)}" alt="">${k.name}のマスモン</p></div>${tabs(0)}${list(k)}
<p class="note">🔁 再生や育成は${k.name}の中だけ。ときどき中庭や部屋で一緒に遊んでいます</p>${deck(k)}</div><p class="cap"><b>縦</b>: ${chunks('マスモン一覧(ニックネーム・種類・Lv・わけ)。下にデッキと、好き・苦手')}</p></div>
<div><div style="display:flex;flex-direction:column;gap:6px">${land(k)}<p class="cap" style="width:844px"><b>横</b>: 編成(先頭+2体)とデッキを並べる</p>
<div class="row2"><div class="rot">${land(k)}</div><p class="cap" style="width:300px"><b>🔄横</b>: ${chunks('縦の端末で、横向きに回したとき。横と同じ並びを、回して見せる')}</p></div></div></div>
</div></body></html>`;
fs.writeFileSync(path.join(__dirname, 'masmon-screen.html'), screen);
(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  for (const [f, w] of [['masmon-table', 800], ['masmon-screen', 1320]]) {
    const p = await b.newPage({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 });
    await p.goto('file://' + path.join(__dirname, `${f}.html`)); await p.waitForTimeout(500);
    // 言葉の途中で折れていないか(1行のはずの所が2行になっていないか)
    const ng = await p.evaluate(() => [...document.querySelectorAll('.mon b,.mon i,.chip,.sl b,.tb span,.hd small')].filter(el => el.scrollWidth > el.clientWidth + 1 || el.getClientRects().length > 1).map(el => el.textContent));
    if (ng.length) console.log(`${f}: はみ出し・折れ`, ng);
    await p.screenshot({ path: path.join(__dirname, `${f}.png`), fullPage: true }); await p.close();
  }
  await b.close();
  console.log('書き出しました');
})();
