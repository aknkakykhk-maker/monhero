#!/usr/bin/env node
// 助手ライフ「開いたトップの家の場面」と「できごとを小さな場面にする」案の止め絵(縦・横)。
//   まだ作っていない形の見本なので、本物の部品は使わない(ナカヨシ20・#5377)。台詞は下書き(本番はココロ2が助手ごとの口調で書く)
//   出力: docs/progress/assistant-life/top-scene/ の top-tate.jpg・top-yoko.jpg・event-tate.jpg・event-yoko.jpg
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const out = path.join(root, 'docs/progress/assistant-life/top-scene');
const R = '../../../../monster-hero/';
fs.mkdirSync(out, { recursive: true });

const face = (id, s = 34, cls = '') => `<img class="face ${cls}" style="width:${s}px;height:${s}px" src="${R}images/assistant/face/${id}_normal.PNG">`;
const stand = (id, mood, cls) => `<img class="stand ${cls}" src="${R}images/assistant/${id}_${mood}.PNG">`;

// 8人の部屋(夕方 18時台の例)。home=true は家にいる(顔とやっていること)、false は留守(行き先の札)
const ROOMS = [
  { id: 'myua', n: 'みゅあ', home: false, at: '🍰 おやつ<wbr>屋さん' },
  { id: 'kiki', n: 'きき', home: true, doing: '📖', note: '本を読んでいる' },
  { id: 'momosuke', n: 'もも', home: false, at: '🎵 練習<wbr>スタジオ' },
  { id: 'dra', n: 'ドラ', home: true, doing: '💤', note: '昼寝の続き' },
  { id: 'atsu', n: 'あつ', home: false, at: '🌄 ひなたの丘', ev: true },
  { id: 'kyuko', n: 'きゅうこ', home: true, doing: '🃏', note: 'カードの研究' },
  { id: 'sorashido', n: 'ソラシド', home: false, at: '⚔ モンヒロ<wbr>バトル', sub: '修行中' },
  { id: 'erubin', n: 'えるびん', home: false, at: '🌄 ひなたの丘', ev: true },
];
const room = (r) => r.home
  ? `<div class="room lit">${face(r.id, 38)}<span class="bub">${r.doing}</span><p class="rn">${r.n}</p><p class="rd">${r.note}</p></div>`
  : `<div class="room out${r.ev ? ' ev' : ''}">${face(r.id, 30, 'dim')}<p class="rn">${r.n}</p><p class="sign">${r.at}</p>${r.sub ? `<p class="rd">${r.sub}</p>` : ''}${r.ev ? '<span class="evmark">❗</span>' : ''}</div>`;
const scene = (land) => `
<div class="scene${land ? ' l' : ''}">
  <p class="scap">🏡 みんなのいま <span>夕方 18:31</span></p>
  <div class="roof"></div>
  <div class="house"><div class="floor">${ROOMS.slice(0, 4).map(room).join('')}</div><div class="floor">${ROOMS.slice(4).map(room).join('')}</div></div>
  <div class="outside">
    <span class="spot ev">${face('atsu', 22)}${face('erubin', 22)} 🌄 ひなたの丘 ❗</span>
    <span class="spot">${face('myua', 22)} 🍰</span><span class="spot">${face('momosuke', 22)} 🎵</span><span class="spot">${face('sorashido', 22)} ⚔</span>
  </div>
  <p class="sum">家に3人 ・ おでかけ5人 ・ 次にみんなが動くのは 20:00</p>
</div>`;
const eventCard = `
<section class="card ev">
  <p class="h">🌇 夕方のできごと <span>あと約1時間</span></p>
  <div class="row"><span class="t">❗ いま</span><span class="f">ひなたの丘で、あつとえるびんが夕日を見ています<br><span class="g">→ 見ると 🤝 ふれあい1回 ・ 🧺 3/7日</span></span><span class="btn">見に行く ▶</span></div>
</section>`;
const benefit = `
<section class="card">
  <div class="row"><span class="t">⏰ いま</span><span class="f">🎵 ももすけがビートに。券なしで一緒に遊べる</span><span class="arr">▶</span></div>
  <p class="more">📅 今日 ・ 🌱 次のごほうび ▼</p>
</section>`;
const todo = `
<p class="lbl">今日やれること <span>朝4時に戻る</span></p>
<div class="todo"><b class="o">👀 見守る<small>今2組</small></b><b class="s">💬 声をかける<small>無料</small></b><b class="gr">🎁 贈る<small>5回</small></b><b class="p">🎵 ビート<small>券なし</small></b></div>`;
const tabs = `<div class="tabs"><b class="on">🏡<br>家</b><b>🗺<br>町</b><b>🤝<br>きずな</b><b>🏘<br>フレンド</b><b>📖<br>紹介</b></div>`;
const header = `<div class="hdr"><span class="back">←</span><span class="ttl">助手ライフ</span><span class="clk">🌇 18:31</span></div>`;

// できごと(推奨案A): ① 札 → ② 場面(2人の掛け合い) → ③ 選ぶ → ④ 返事
const talk = (id, n, mood, line) => `<div class="tk">${face(id, 30)}<p><b>${n}</b>「${line}」</p></div>`;
const evScene = (step) => `
<div class="evbox">
  <div class="stage">${stand('atsu', step === 4 ? 'excited' : 'happy', 'a')}${stand('erubin', 'happy', 'b')}<p class="place">🌄 ひなたの丘 ・ 夕方</p></div>
  <div class="talks">
    ${talk('atsu', 'あつ', '', '夕日やば笑 空ぜんぶオレンジなんだけど')}
    ${talk('erubin', 'えるびん', '', 'ほんとだね☺️ 今日もいっぱい動いたもんね')}
    ${step >= 3 ? talk('atsu', 'あつ', '', '◯◯も来た！ ちょうどいい、写真撮ろ<span style="white-space:nowrap">( *\'ω\'*)ノ</span>') : '<p class="next">▼ タップで続き</p>'}
    ${step === 3 ? '<div class="pick"><b>📸 3人で撮る</b><b>🌇 ふたりを撮ってあげる</b></div>' : ''}
    ${step === 4 ? `${talk('atsu', 'あつ', '', 'いい顔〜笑 これ待ち受けにしよ')}${talk('erubin', 'えるびん', '', 'みんなで撮れて、うれしいな☺️')}<p class="gain">🤝 ふれあい1回 ・ 🧺 4/7日 ・ 💗 あつ・えるびん 少し</p>` : ''}
  </div>
</div>`;
const rare = `
<div class="evbox rare">
  <p class="rtag">✨ めずらしいできごと(ときどき)</p>
  <div class="stage night">${stand('kyuko', 'surprise', 'a')}${stand('sorashido', 'excited', 'b')}<p class="place">🌌 中庭 ・ 夜 ・ 流れ星</p></div>
  <div class="talks">${talk('kyuko', 'きゅうこ', '', 'あ、いまの見た？ 流れ星…！')}${talk('sorashido', 'ソラシド', '', 'うぉぉぉ！ 見ました！ 願いごと間に合ったかな〜')}<p class="gain">✨ 思い出アルバムに「流れ星の夜」</p></div>
</div>`;

const CSS = `body{margin:0;background:#0b1220;font-family:system-ui,'Noto Sans JP',sans-serif;color:#fff}
.wrap{display:flex;gap:18px;padding:16px;align-items:flex-start;flex-wrap:wrap}.wrap.land{flex-direction:column}
.cap{color:#fde68a;font:900 14px system-ui;margin:0 0 6px;max-width:390px}
.phone{position:relative;overflow:hidden;border-radius:22px;border:3px solid #334155;background:linear-gradient(#2b1a4a,#b4604a 60%,#3b2a1a)}
.face{border-radius:50%;background:#1e293b;object-fit:cover;object-position:top;flex:none;border:2px solid #fff8}
.hdr{display:flex;align-items:center;gap:10px;padding:10px 14px 4px}.back{font-size:20px}.ttl{font-size:22px;font-weight:900}.clk{margin-left:auto;border:1px solid #fff5;border-radius:14px;padding:3px 10px;font-weight:900;font-size:13px;background:#0006}
.scene{position:relative;margin:4px 10px 6px;border-radius:18px;padding:6px 8px 8px;background:linear-gradient(#f59e0b55,#7c2d1255);border:1.5px solid #fcd34d88}
.scap{margin:0 0 2px;font-weight:900;font-size:13px;color:#fde68a}.scap span{font-size:10.5px;color:#e2e8f0;margin-left:6px}
.roof{height:26px;margin:0 6px;background:linear-gradient(#7f1d1d,#991b1b);clip-path:polygon(50% 0,100% 100%,0 100%)}
.house{background:#5b3a24;border:3px solid #3f2617;border-top:0;padding:4px;border-radius:0 0 8px 8px}
.floor{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:4px}.floor:last-child{margin:0}
.room{position:relative;height:118px;word-break:keep-all;border-radius:6px;text-align:center;padding:3px 2px;box-sizing:border-box}
.room.lit{background:linear-gradient(#fde68a,#fbbf24);color:#422006}.room.out{background:#1e1b2e;color:#cbd5e1;border:1px dashed #64748b}
.room.ev{border:2px solid #fbbf24;box-shadow:0 0 10px #fbbf24aa}
.room .face{margin-top:2px}.room .face.dim{opacity:.45;filter:grayscale(.7)}.room.lit .face{width:48px!important;height:48px!important;margin-top:6px}.bub{position:absolute;right:4px;top:2px;font-size:15px;background:#fff;border-radius:10px;padding:0 3px}
.rn{margin:2px 0 0;font-size:11px;font-weight:900}.rd{margin:0;font-size:9.5px;font-weight:800;line-height:1.2}.sign{margin:3px 0 2px;font-size:10px;font-weight:900;background:#0f172a;border-radius:6px;padding:3px 2px;color:#fde68a;line-height:1.2}
.evmark{position:absolute;right:-2px;top:-6px;font-size:16px}
.outside{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.spot{display:flex;align-items:center;gap:2px;background:#0f172acc;border-radius:12px;padding:2px 6px 2px 2px;font-size:11px;font-weight:900}.spot .face{border-width:1px}.spot.ev{border:1.5px solid #fbbf24;color:#fde68a}
.sum{margin:4px 0 0;font-size:10.5px;font-weight:800;color:#e2e8f0}
.card{margin:0 10px 6px;border:1.5px solid #fcd34d99;border-radius:14px;background:#020617d9;padding:5px}.card.ev{border-color:#fbbf24}
.card .h{margin:0 2px;font-weight:900;font-size:13px;color:#fde68a}.card .h span{font-size:10.5px;color:#cbd5e1;margin-left:4px}
.row{display:flex;align-items:center;gap:6px;min-height:44px;margin-top:3px;border-radius:10px;background:#ffffff14;padding:3px 6px;font-size:12px;font-weight:800;line-height:1.35}
.t{width:46px;flex:none;text-align:center;color:#fde68a;font-size:11px;font-weight:900}.f{flex:1}.g{color:#6ee7b7;font-size:10.5px}
.btn{flex:none;background:#fbbf24;color:#0f172a;border-radius:10px;padding:10px 8px;font-size:11.5px;font-weight:900}.arr{color:#fde68a}
.more{margin:3px 4px 0;text-align:right;font-size:11px;font-weight:900;color:#fde68a}
.lbl{margin:2px 14px 3px;font-size:11.5px;font-weight:900;display:flex;justify-content:space-between}.lbl span{color:#94a3b8;font-size:10.5px}
.todo{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:0 10px 6px}.todo b{border-radius:12px;padding:6px 4px;font-size:11.5px;min-height:44px;line-height:1.25}.todo small{display:block;font-size:9.5px;opacity:.9}
.o{background:linear-gradient(135deg,#fb7185,#f59e0b)}.s{background:linear-gradient(135deg,#38bdf8,#6366f1)}.gr{background:linear-gradient(135deg,#34d399,#16a34a)}.p{background:linear-gradient(135deg,#c084fc,#ec4899)}
.tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:0 10px}.tabs b{text-align:center;border:1px solid #ffffff22;border-radius:12px;background:#0f172a;font-size:11px;padding:4px 0;min-height:44px;line-height:1.3}.tabs .on{border-color:#f9a8d4}
.l2{display:flex;gap:8px;padding:0 8px}.l2 .left{width:420px;flex:none}.l2 .right{flex:1;min-width:0}
.scene.l{margin:4px 0 0}.scene.l .room{height:96px}.l2 .card,.l2 .todo,.l2 .tabs{margin-left:0;margin-right:0}.l2 .lbl{margin:2px 2px}
.l2 .todo b{font-size:10.5px;padding:4px 3px}
.evbox{margin:8px 10px;border-radius:18px;background:#0f172af2;border:1px solid #ffffff22;overflow:hidden}
.stage{position:relative;overflow:hidden;height:230px;background:url(${R}images/story-bg/monhero_plaza_evening.jpg) center/cover}.stage.night{background:url(${R}images/story-bg/monhero_night.jpg) center/cover}
.stand{position:absolute;bottom:-60px;height:280px}.stand.a{left:10px}.stand.b{right:10px}
.place{position:absolute;left:50%;top:6px;transform:translateX(-50%);margin:0;background:#000a;border-radius:10px;padding:2px 8px;font-size:11px;font-weight:900;white-space:nowrap}
.talks{padding:6px 8px 8px}.tk{display:flex;gap:6px;align-items:flex-start;margin:4px 0}.tk p{margin:0;background:#fff;color:#0f172a;border-radius:12px;padding:5px 8px;font-size:12px;font-weight:800;line-height:1.4}.tk b{color:#be185d;margin-right:2px}
.next{margin:4px 0 0;text-align:center;font-size:11px;color:#94a3b8;font-weight:800}
.pick{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}.pick b{min-height:44px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(90deg,#f59e0b,#f43f5e);font-size:12px;text-align:center}
.gain{margin:6px 0 0;border-radius:10px;background:#fdf2f8;color:#be185d;padding:5px 8px;font-size:11.5px;font-weight:900}
.rare{border-color:#c4b5fd}.rtag{margin:0;padding:4px 8px;background:#4c1d95;font-size:12px;font-weight:900}
.land .evbox{display:flex;margin:6px;height:calc(100% - 12px)}.land .stage{width:460px;height:100%;flex:none}.land .stand{height:300px;bottom:-60px}.land .stand.a{left:-20px}.land .stand.b{right:-20px}.land .talks{flex:1;overflow:hidden}.land .rare{display:block}.land .rare .stage{height:130px;width:auto}`;

const phone = (cap, w, h, inner) => `<div><p class="cap">${cap}</p><div class="phone" style="width:${w}px;height:${h}px">${inner}</div></div>`;
const topTate = phone('開いたトップ(縦)・推奨: 家の断面図', 390, 844, `${header}${scene(false)}${eventCard}${benefit}${todo}${tabs}`);
const topYoko = phone('開いたトップ(横)・左に家の場面、右に札とボタン', 844, 390, `<div class="l2"><div class="left">${header}${scene(true)}</div><div class="right" style="padding-top:8px">${eventCard}${benefit}${todo}${tabs}</div></div>`);
const evT = [
  ['① 札の「見に行く ▶」', `${header}${scene(false)}${eventCard}`],
  ['② 場面: 2人の掛け合い(タップで進む)', `${header}${evScene(2)}`],
  ['③ 返事を選ぶ(2択)', `${header}${evScene(3)}`],
  ['④ 選んだ返事で台詞が変わる', `${header}${evScene(4)}`],
  ['⑤ ときどき: めずらしいできごと', `${header}${rare}`],
];
const page = (body, land) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="wrap${land ? ' land' : ''}">${body}</div></body></html>`;

(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  const jobs = [
    ['top-tate', page(topTate, false), 460],
    ['top-yoko', page(topYoko, true), 900],
    ['event-tate', page(evT.map(([c, i]) => phone(c, 390, 620, i)).join(''), false), 2100],
    ['event-yoko', page(evT.slice(1, 4).map(([c, i]) => phone(c, 844, 390, i.replace(header, ''))).join(''), true), 900],
  ];
  for (const [name, html, vw] of jobs) {
    const file = path.join(out, `${name}.html`);
    fs.writeFileSync(file, html);
    const p = await b.newPage({ viewport: { width: vw, height: 300 }, deviceScaleFactor: 2 });
    await p.goto('file://' + file); await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 85, fullPage: true });
    await p.close(); fs.unlinkSync(file);
  }
  await b.close();
  console.log('OK: top-tate・top-yoko・event-tate・event-yoko を書いた →', path.relative(root, out));
})();
