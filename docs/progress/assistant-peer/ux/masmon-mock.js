// 助手のマスモン案の表と画面の見本を、masmon-plan.json から作る(2026-11-08 助手部キズナ)
//   node docs/progress/assistant-peer/ux/masmon-mock.js   → masmon-table.png・masmon-screen.png
// 染色は、プレイヤーと同じ染色のマスク(images/monsters/<名前>-dye-mask・赤緑青の3部位)で色を付けて見せる(見本用の描き方)
'use strict';
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..', '..', '..');
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'masmon-plan.json'), 'utf8')).assistants;
const ally = fs.readFileSync(path.join(root, 'monster-hero/data/ally-monsters.js'), 'utf8');
const nameOf = (id) => { const m = ally.match(new RegExp(`^\\s{2}${id}:\\s*(?:Object\\.freeze\\()?\\{[^\\n]*?name:\\s*["']([^"']+)`, 'm')); return m ? m[1] : id; };
const lin = fs.readFileSync(path.join(root, 'monster-hero/data/lineages.js'), 'utf8');
const MAP = Object.fromEntries([...lin.matchAll(/^\s*(\w+):\s*\{\s*main:'(\w+)'/gm)].map(m => [m[1], m[2]]));
const LIN = { mocchi: 'モッチー', suezo: 'スエゾー', golem: 'ゴーレム', tiger: 'ライガー', ham: 'ハム', pixie: 'ピクシー', monol: 'モノリス', plant: 'プラント', zan: 'ザン', ark: 'アーク', undine: 'ウンディーネ', yggdrasil: 'ユグドラシル', ghost: 'ゴースト', illumine: 'イルミネ', kyubi: 'キュービ' };
const IMG = { Mocchi: 'mocchi.png', Pixie: 'pixie.png', MelWhip: 'mel-whip.png', Golem: 'golem.png', Plant: 'plant.PNG', Undine: 'undine.PNG', Melody: 'melody.png', Mia: 'mia.PNG', Ham: 'ham.png', Suezo: 'suezo.png', Oboro: 'oboro.png', Mitarashi: 'mitarashi.png', Tiger: 'tiger.png', KenshiMocchi: 'kenshi-mocchi.png', Zan: 'zan.png', Illumine: 'illumine.png', Dreamy: 'dreamy.png', Kuromy: 'kuromy.png', Kyubi: 'kyubi.png', Orihime: 'orihime.png', Monol: 'monol.png', Ark: 'ark.png', Yggdrasil: 'yggdrasil.png', Ghost: 'ghost.png' };
const MDIR = path.join(root, 'monster-hero/images/monsters');
const maskOf = (id) => { const base = (IMG[id] || '').replace(/\.(png|PNG)$/, '').toLowerCase(); const f = fs.readdirSync(MDIR).find(x => x.toLowerCase().startsWith(`${base}-dye-mask`)); return f ? `../../../../monster-hero/images/monsters/${f}` : null; };
const img = (id) => `../../../../monster-hero/images/monsters/${IMG[id] || 'mocchi.png'}`;
const face = (id, e = 'happy') => `../../../../monster-hero/images/assistant/${id === 'mua' ? 'myua' : id}_${e}.PNG`; // みゅあの絵は myua_*
const chunks = (t) => String(t).split(/(?<=[、。])/).map(x => `<span class="nw">${x}</span>`).join('<wbr>');
// 染めた絵は、ゲーム本体の染色の部品で作った PNG(ux/dyed/・masmon-dye-shots.js が書く)
const mon = (m, cls = '', who = null) => `<img class="${cls}" src="dyed/${who}-${m.monster}.png" alt="">`;
const baseImg = (m) => `<img src="dyed/${m.monster}-base.png" alt="">`;
const SW = { red: '#ef4444', orange: '#f97316', yellow: '#eab308', lime: '#84cc16', green: '#22c55e', teal: '#14b8a6', cyan: '#06b6d4', sky: '#38bdf8', blue: '#3b82f6', purple: '#a855f7', magenta: '#d946ef', pink: '#ec4899', black: '#18181b', white: '#ffffff', gray: '#a1a1aa' };
const swc = (c) => { const [k, l] = c.split('_'); const h = SW[k] || '#888'; return l ? `color-mix(in srgb, ${h} 45%, white)` : h; };
const swatch = (m) => `<span class="sw">${m.dye.colors.map(c => `<i style="background:${swc(c)}"></i>`).join('')}</span><span class="swn">${m.dye.colors.length}枠</span>`;
const DYE_JS = `<script>document.body.dataset.ready = '1';</script>`;
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f172a;color:#f8fafc;font-family:"Hiragino Maru Gothic ProN","M PLUS Rounded 1c","Noto Sans JP",sans-serif;padding:16px}
h1{font-size:20px;font-weight:900}.lead{font-size:12px;color:#cbd5e1;margin:4px 0 12px;line-height:1.5}
.nw{white-space:nowrap}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:780px}
.card{background:#1e1b4b;border:2px solid #334155;border-radius:16px;padding:10px 12px}
.hd{display:flex;align-items:center;gap:8px}.hd img{width:40px;height:40px;border-radius:50%;object-fit:cover;object-position:50% 8%;background:#fff;border:2px solid #fff}.hd b{font-size:17px}
.sec{margin-top:7px;font-size:10.5px;font-weight:900;color:#f9a8d4;letter-spacing:.05em}
.mons{display:flex;gap:6px;margin-top:4px}
.mon{flex:1;background:#0b1020;border-radius:10px;padding:5px;text-align:center;position:relative;min-width:0}
.mon img,.mon canvas{width:100%;height:58px;object-fit:contain;background:radial-gradient(circle,#cbd5e1 0,#64748b 70%);border-radius:8px;display:block}
.mon b{display:block;font-size:12px;white-space:nowrap}.mon i{display:block;font-style:normal;font-size:9.5px;color:#94a3b8;white-space:nowrap}
.mon .ld{position:absolute;left:4px;top:4px;font-size:9px;font-weight:900;background:#f472b6;border-radius:6px;padding:0 4px;z-index:1}
.mon .g{font-size:9.5px;color:#fde68a;white-space:nowrap}
.sw{display:inline-flex;gap:2px;margin-top:2px}.sw i{width:10px;height:10px;border-radius:50%;border:1px solid #0008;display:inline-block}.swn{font-size:9px;color:#94a3b8;margin-left:3px}
.row{margin-top:5px;font-size:11px;line-height:1.5;display:flex;gap:6px}.row .k{flex:none;width:40px;font-weight:900}.row .v{flex:1}
.cl{color:#fde68a}.cl .k{width:64px}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;border:1px solid #0008;margin-right:3px;vertical-align:-1px}.lk{color:#86efac}.ds{color:#fca5a5}.lk small,.ds small{color:#94a3b8;font-size:9.5px}
.deck{margin-top:7px;background:#0b1020;border:1px dashed #a78bfa;border-radius:10px;padding:6px 8px;font-size:11px;line-height:1.5}
.deck b{color:#c4b5fd}.deck .dn{color:#fde68a;font-weight:900}
.later{font-size:10px;color:#94a3b8;margin-top:4px}
`;
const LBL = { red: '赤', orange: '橙', yellow: '黄', lime: '黄緑', green: '緑', teal: '青緑', cyan: 'シアン', sky: '空色', blue: '青', purple: '紫', magenta: 'マゼンタ', pink: 'ピンク', black: '黒', white: '白', gray: '薄灰' };
const colorName = (c) => { const [k, l] = c.split('_'); return l ? `薄${LBL[k]}` : LBL[k]; };
const likeRow = (list, cls, label) => `<p class="row ${cls}"><span class="k">${label}</span><span class="v">${list.length ? list.map(x => { if (x.lineage) return `<span class="nw">${LIN[x.lineage]}種<small>(種ぜんぶ)</small></span>`; const n = nameOf(x.monster), l = LIN[MAP[x.monster]]; return `<span class="nw">${n}${n === l ? '' : `<small>→ ${l}種も少し</small>`}</span>`; }).join('<wbr> ・ ') : '<span class="nw">なし<small>(強いモンスターに寄る)</small></span>'}</span></p>`;
const colorRow = (a) => `<p class="row cl"><span class="k">🎨好きな色</span><span class="v">${(a.favColors || []).map(c => `<span class="nw"><i class="dot" style="background:${swc(c.color)}"></i>${colorName(c.color)}</span>`).join('<wbr> ・ ')}</span></p>`;
const table = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>助手のマスモン案</title><style>${CSS}</style></head><body>
<h1>助手のマスモン(育成・染色)と、MFバトルカードのデッキ(案)</h1>
<p class="lead" style="width:780px">${chunks('🐾 マスモンは助手が育てている個体(実装済みのモンスターだけ・1人3体)。Lv と育ち方が日々の育成と相談の答えで伸び、プレイヤーと同じ染色の仕組み・同じ枠数(種類ごとに3枠か5枠)で、助手の好みの色に染める。🃏 デッキは MFバトルカードのカードの組み方で、マスモンとは別もの(マスモンからは作らない)。💗 好き・💦 苦手はモンスター単位で、その血統にも少し広がる(「→ ○○種も少し」。モンスターと血統が同じ名前のときは書かない)。反応の台詞だけで、数字には効かない。')}</p>
<div class="grid">${plan.map(a => `<div class="card"><div class="hd"><img src="${face(a.id)}" alt=""><b>${a.name}</b></div>
<p class="sec">🐾 マスモン(育成・染色)</p>
<div class="mons">${a.team.map(m => `<div class="mon">${m.lead ? '<span class="ld">先頭</span>' : ''}${mon(m, '', a.id)}<b>${m.nick}</b><i>${nameOf(m.monster)} ・ Lv.${m.lv}</i><span class="g">${m.grow.replace(/\(.*\)/, '')}</span><br>${swatch(m)}</div>`).join('')}</div>
${likeRow(a.likeMon, 'lk', '💗好き')}${likeRow(a.dislikeMon, 'ds', '💦苦手')}${colorRow(a)}
<div class="deck"><span class="dn">🃏 ${a.deck.name}</span> <b>(MFバトルカード・マスモンとは別)</b><br>${chunks(a.deck.plan)}<br><span class="nw">好きなカード: ${a.deck.cardFavorite}(MFバトルカードのカード)</span> <span class="nw">・ よく入れるカード: ${a.deck.cards}</span></div>
${a.later ? `<p class="later">あとで: ${a.later.monster}(好き。実装されたらマスモンの4体目に)</p>` : ''}</div>`).join('')}</div>${DYE_JS}</body></html>`;
fs.writeFileSync(path.join(__dirname, 'masmon-table.html'), table);
// 画面の見本: 部屋のシートの「🐾 マスモン」から開く。縦=マスモン(育った様子・染めた姿)/横=編成/🔄横=デッキ(カード。マスモンとは別)
const k = plan.find(a => a.id === 'kiki');
const tabs = (on) => `<div class="tb">${['🐾 マスモン', '⚔ 編成', '🃏 デッキ', '💗 好き・苦手'].map((t, i) => `<span class="${i === on ? 'on' : ''}">${t}</span>`).join('')}</div>`;
const bars = (m) => { const v = { 攻撃型: [62, 92, 55, 48], 防御型: [70, 45, 90, 50], ガッツ型: [60, 50, 52, 88], ライフ型: [92, 50, 60, 50], すばやさ型: [58, 70, 45, 75] }[m.grow.replace(/\(.*\)/, '')] || [60, 60, 60, 60]; return `<div class="bars">${['ライフ', '攻撃', '防御', 'ガッツ'].map((n, i) => `<span><em>${n}</em><i><b style="width:${v[i]}%"></b></i></span>`).join('')}</div>`; };
const SCSS = `${CSS}
.ph{background:linear-gradient(#1e1b4b,#0b1020 70%);border:3px solid #334155;border-radius:24px;overflow:hidden;position:relative;flex:none}
.top{padding:12px 14px 4px}.en{font-size:10px;letter-spacing:.2em;color:#f9a8d4;font-weight:900}.t{font-size:19px;font-weight:900;display:flex;align-items:center;gap:8px}
.t img{width:34px;height:34px;border-radius:50%;object-fit:cover;object-position:50% 8%;background:#fff}
.tb{display:flex;gap:4px;padding:6px 12px}.tb span{flex:1;text-align:center;font-size:11px;font-weight:900;padding:6px 0;border-radius:10px;background:#1e293b;color:#94a3b8;white-space:nowrap}.tb .on{background:linear-gradient(90deg,#f472b6,#fb923c);color:#fff}
.li{display:flex;gap:10px;margin:8px 12px;background:#111827;border:1px solid #334155;border-radius:14px;padding:8px}
.li img,.li canvas{width:84px;height:84px;object-fit:contain;background:radial-gradient(circle,#cbd5e1 0,#64748b 70%);border-radius:10px;flex:none}
.li b{font-size:15px}.li em{font-style:normal;font-size:10px;background:#f472b6;border-radius:6px;padding:0 5px;vertical-align:2px}.li .s{display:block;font-size:11px;color:#94a3b8}.li .gg{font-size:11px;color:#fde68a;font-weight:900}
.bars{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;margin-top:3px}.bars span{display:flex;align-items:center;gap:4px;font-size:9.5px}.bars em{font-style:normal;width:30px;color:#cbd5e1;background:none;padding:0;white-space:nowrap;vertical-align:0;font-size:9.5px;flex:none}.bars i{flex:1;height:5px;background:#334155;border-radius:3px;overflow:hidden}.bars b{display:block;height:100%;background:linear-gradient(90deg,#fde68a,#fb923c)}
.ba div{min-width:0}.ba{display:flex;gap:8px;align-items:center;margin:4px 12px;background:#111827;border:1px solid #334155;border-radius:14px;padding:8px;font-size:11px}
.ba img,.ba canvas{width:70px;height:70px;object-fit:contain;background:radial-gradient(circle,#cbd5e1 0,#64748b 70%);border-radius:10px;flex:none}
.tm{display:flex;gap:8px;padding:8px 12px}.sl{flex:1;background:#111827;border:1px solid #334155;border-radius:14px;text-align:center;padding:6px;position:relative}
.sl img,.sl canvas{width:100%;height:110px;object-fit:contain;background:radial-gradient(circle,#cbd5e1 0,#64748b 70%);border-radius:10px;display:block}.sl b{font-size:13px;white-space:nowrap}.sl em{position:absolute;left:6px;top:6px;font-style:normal;font-size:10px;background:#f472b6;border-radius:6px;padding:0 5px;z-index:1}.sl i{display:block;font-style:normal;font-size:10px;color:#fde68a}
.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:6px 14px}.cdi{width:100%;height:118px;object-fit:contain;display:block;filter:drop-shadow(0 2px 4px #0009)}
.cd{height:118px;object-fit:contain;width:100%;padding:0;border:0;background:none;display:block;border-radius:8px;background:linear-gradient(160deg,#4c1d95,#1e1b4b);border:2px solid #a78bfa;display:flex;flex-direction:column;justify-content:flex-end;padding:4px;font-size:9.5px;font-weight:900;text-align:center}
.cd.m{background:linear-gradient(160deg,#9a3412,#1e1b4b);border-color:#fb923c}
.note{font-size:10.5px;color:#94a3b8;margin:6px 12px;line-height:1.5}
.cap{font-size:12px;color:#e2e8f0;margin-top:6px;line-height:1.5}
.row2{display:flex;gap:16px;align-items:flex-start}
.rot{width:390px;height:844px;border:3px solid #334155;border-radius:24px;position:relative;overflow:hidden;background:#000;flex:none}
.rot .ph{position:absolute;left:50%;top:50%;width:844px;height:390px;transform:translate(-50%,-50%) rotate(90deg);border:0;border-radius:0}
`;
const lead = k.team.find(m => m.lead);
const portrait = `<div class="ph" style="width:390px;height:844px"><div class="top"><p class="en">MASMON · ${k.id.toUpperCase()}</p><p class="t"><img src="${face(k.id)}" alt="">${k.name}のマスモン</p></div>${tabs(0)}
${k.team.map(m => `<div class="li">${mon(m, '', k.id)}<div style="flex:1;min-width:0"><b>${m.nick}${m.lead ? ' <em>先頭</em>' : ''}</b><span class="s">${nameOf(m.monster)} ・ Lv.${m.lv} ${swatch(m)}</span><span class="gg">📈 ${m.grow}</span>${bars(m)}</div></div>`).join('')}
<div class="ba">${baseImg(lead)}→${mon(lead, '', k.id)}<div>${chunks(`🎨 ${k.name}が${lead.nick}を染めた。左が元の色。染め方はプレイヤーと同じ。`)}</div></div>
<p class="note">${chunks(`🔁 育成・再生・染色は${k.name}の中だけ。プレイヤーのマスモン・セーブには触りません。`)}</p></div>`;
const land = `<div class="ph" style="width:844px;height:390px"><div class="top"><p class="en">MASMON · ${k.id.toUpperCase()}</p><p class="t"><img src="${face(k.id)}" alt="">${k.name}のマスモン</p></div>${tabs(1)}
<div class="tm">${k.team.map(m => `<div class="sl">${m.lead ? '<em>先頭</em>' : ''}${mon(m, '', k.id)}<b>${m.nick}</b><i>Lv.${m.lv} ・ ${m.grow.replace(/\(.*\)/, '')}</i></div>`).join('')}</div>
<p class="note">${chunks(`⚔ 編成は${k.name}が決める。相談されたら変わることも。`)}</p></div>`;
const deckCards = ['C-003', 'C-003S', 'F119', 'F263', '032', '033', '034', '035', '247', '246']; // 本物のカード(card-battle-cards.js の no)。ゴーレムのカードと技・ききの場のカード // 本物のカード名(card-battle-cards.js)。ゴーレムの技と、ききの場のカード
const rotDeck = `<div class="ph" style="width:844px;height:390px"><div class="top"><p class="en">DECK · ${k.id.toUpperCase()}</p><p class="t"><img src="${face(k.id)}" alt="">${k.name}のデッキ</p></div>${tabs(2)}
<p class="note" style="margin-top:2px"><b style="color:#fde68a">🃏 ${k.deck.name}</b> ・ ${chunks(k.deck.plan)}<br>${chunks('MFバトルカードのカード(マスモンとは別もの)。カードの絵はMFバトルカードの画面と同じ。中身はカード部と決める。')}</p>
<div class="cards">${deckCards.map(c => `<img class="cdi" src="../../../../monster-hero/images/card-battle/l/${c}.jpg" alt="">`).join('')}</div></div>`;
const screen = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>助手のマスモン画面の見本</title><style>${SCSS}</style></head><body>
<h1>助手のマスモン・デッキ(部屋の「🐾 マスモン」から開く)見本</h1>
<p class="lead">${chunks('見本の絵です(まだ作っていません)。プレイヤーのマスモン画面と同じ見せ方。マスモン(育てている個体)とデッキ(カード)はタブで分けます。')}</p>
<div class="row2">
<div><div>${portrait}</div><p class="cap" style="width:390px">${chunks('縦: 🐾 マスモン。Lv・育ち方・能力のゲージ(育った様子)と、染めた姿。')}</p></div>
<div style="display:flex;flex-direction:column;gap:6px">${land}<p class="cap" style="width:844px">${chunks('横: ⚔ 編成(先頭+2体)。')}</p>
<div class="row2"><div class="rot">${rotDeck}</div><p class="cap" style="width:300px">${chunks('🔄横: 縦の端末で、横向きに回したとき。ここでは 🃏 デッキのタブ(カードの並び・マスモンとは別)。')}</p></div></div>
</div>${DYE_JS}</body></html>`;
fs.writeFileSync(path.join(__dirname, 'masmon-screen.html'), screen);
(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  for (const [f, w] of [['masmon-table', 820], ['masmon-screen', 1320]]) {
    const p = await b.newPage({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 });
    await p.goto('file://' + path.join(__dirname, `${f}.html`));
    await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 30000 });
    const errs = await p.evaluate(() => [...document.querySelectorAll('canvas[data-err]')].map(c => c.dataset.src + ' ' + c.dataset.err));
    if (errs.length) console.log(`${f}: 染色の失敗`, errs);
    const ng = await p.evaluate(() => [...document.querySelectorAll('.mon b,.mon i,.mon .g,.nw,.sl b,.tb span')].filter(el => el.scrollWidth > el.clientWidth + 1 || el.getClientRects().length > 1).map(el => el.textContent));
    if (ng.length) console.log(`${f}: はみ出し・折れ`, ng.slice(0, 8));
    await p.screenshot({ path: path.join(__dirname, `${f}.png`), fullPage: true }); await p.close();
  }
  await b.close();
  console.log('書き出しました');
})();
