#!/usr/bin/env node
// モンヒロバトルの窓に「👀 修行を見る」「📣 応援する」を足す案の止め絵(縦・横)。まだ作っていない機能の見本なので、本物の部品は使わない
//   出力: docs/progress/assistant-peer/masmon-train/cheer-mock-portrait.png・cheer-mock-landscape.png
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const out = path.join(root, 'docs/progress/assistant-peer/masmon-train');
const R = '../../../../monster-hero/';

const face = (id, s = 36) => `<img class="face" style="width:${s}px;height:${s}px" src="${R}images/assistant/${id}_normal.PNG">`;
const mon = (sp, cls = '') => `<img class="mon ${cls}" src="${R}images/monster-thumbs/${sp}.png">`;
const btnCol = `<div class="col"><button class="b-amber">⚔ マスモンで対戦(β)</button><button class="b-sky">💬 詳細を見る</button><button class="b-pink">🏡 部屋へ ›</button></div>`;
const row = (id, name, line, today, cheered, sel) => `
<div class="row${sel ? ' sel' : ''}">
  <div class="top">${face(id)}<div class="mid"><p class="nm">${name}</p><p class="sub">${line}</p><p class="today">${today}</p></div>${btnCol}</div>
  <div class="strip"><button class="b-watch">👀 修行を見る</button>${cheered ? `<button class="b-done" disabled>📣 応援済み・14時から</button>` : `<button class="b-cheer">📣 応援する <small>あと3回</small></button>`}</div>
</div>`;
const sheet = (cheered) => `
<div class="sheet"><div class="hd"><span>⚔ モンヒロバトル</span><span class="x">✕</span></div>
<p class="lead">いる助手は、マスモンを連れて修行をしています</p>
${row('kiki', 'きき', '⚔ みゅあと修行している', cheered ? '今日: パンチ 熟練+8(応援+2)・キックを覚えた' : '今日: パンチ 熟練+6・キックを覚えた', cheered, true)}
${row('myua', 'みゅあ', '⚔ ききと修行している', '今日はこれから修行します', false, false)}
${cheered ? `<div class="toast">${face('kiki', 30)}<p><b>きき</b>「ありがとう！ごろべえも張り切ってるよ」<br><span class="gain">パンチ 熟練 +2 ・ 💗 仲良し度 +8</span></p></div>` : ''}
</div>`;
const watch = `
<div class="sheet watch"><div class="hd"><span>👀 ききのマスモンの修行</span><span class="x">✕</span></div>
<div class="ring">
  <div class="side"><p class="tag">ごろべえ</p>${mon('golem')}<div class="bar"><i style="width:72%"></i></div><p class="g">ガッツ 41</p></div>
  <div class="vs"><p class="dist">距離 近</p><p class="hit">パンチ！<br><b>18</b></p></div>
  <div class="side"><p class="tag">ごろべえの影</p>${mon('golem', 'shadow')}<div class="bar"><i style="width:48%"></i></div><p class="g">ガッツ 22</p></div>
</div>
<div class="speed"><span class="on">★ 見せ場だけ</span><span>×1</span><span>×2</span><span class="skip">飛ばす ›</span></div>
<div class="log"><p class="h">今日の修行</p>
<p>💪 ちからの修行 … パンチ 熟練 <b>34 → 40</b> <span class="up">見習い → 一人前！</span></p>
<p>✨ <b>キック</b> を覚えた(ちから 180 に届いた)</p>
<p class="note">練習試合は見るだけ。何度見ても同じ結果です</p></div>
</div>`;
const CSS = `body{margin:0;background:#0b1220;font-family:system-ui,'Noto Sans JP',sans-serif;color:#fff}
.wrap{display:flex;gap:18px;padding:16px;align-items:flex-start}.wrap.land{flex-direction:column}
.cap{color:#fde68a;font:900 14px system-ui;margin:0 0 6px}
.phone{position:relative;overflow:hidden;border-radius:22px;border:3px solid #334155;background:#0b1020 url(${R}data/images/home-background.jpg) center/cover}
.phone::before{content:'';position:absolute;inset:0;background:#0b1020b0}
.sheet{position:absolute;left:10px;right:10px;bottom:10px;max-height:calc(100% - 20px);overflow:hidden;border-radius:20px;border:1px solid #ffffff22;background:#0f172af2;padding:10px 12px 12px;box-shadow:0 -6px 24px #000a}
.land .sheet{left:auto;right:12px;top:10px;width:520px}
.hd{display:flex;justify-content:space-between;font-weight:900;font-size:15px}.x{color:#94a3b8}
.lead{margin:2px 0 4px;font-size:11px;color:#cbd5e1;font-weight:700}
.row{margin-top:8px;border-radius:16px;border:1px solid #ffffff1a;background:#0f172ad9;padding:8px}.row.sel{border-color:#7dd3fc;box-shadow:0 0 0 2px #7dd3fcaa}
.top{display:flex;gap:8px;align-items:flex-start}.face{border-radius:50%;background:#1e293b;object-fit:cover;object-position:top;flex:none}
.mid{flex:1;min-width:0}.nm{margin:0;font-size:13px;font-weight:900}.sub{margin:1px 0 0;font-size:10.5px;color:#cbd5e1;font-weight:700}.today{margin:3px 0 0;font-size:10.5px;color:#fde68a;font-weight:800;line-height:1.35}
.col{display:flex;flex-direction:column;gap:4px;flex:none}
button{min-height:44px;border-radius:12px;padding:2px 10px;font:900 12px system-ui;color:#fff;border:0}
.b-amber{background:linear-gradient(90deg,#f59e0b,#f43f5e)}.b-sky{background:none;border:1px solid #7dd3fc99;color:#e0f2fe}.b-pink{background:none;border:1px solid #f9a8d499;color:#fce7f3}
.strip{display:flex;gap:6px;margin-top:6px}.strip button{flex:1}
.b-watch{background:linear-gradient(90deg,#0891b2,#4f46e5)}.b-cheer{background:linear-gradient(90deg,#f472b6,#fb923c)}.b-cheer small{font-size:10px;opacity:.85;margin-left:4px}
.b-done{background:#334155;color:#cbd5e1}
.toast{display:flex;gap:8px;align-items:center;margin-top:8px;border-radius:14px;background:#fdf2f8;color:#0f172a;padding:8px}.toast p{margin:0;font-size:12px;font-weight:800}.gain{color:#be185d;font-size:11.5px}
.watch .ring{display:flex;align-items:flex-end;justify-content:space-between;margin-top:8px;border-radius:16px;padding:10px 8px;background:radial-gradient(circle at 50% 80%,#7c2d12,#1e1b4b)}
.land .watch .ring{padding:6px 8px}
.side{width:40%;text-align:center}.tag{margin:0 0 2px;font-size:11px;font-weight:900}.mon{width:96px;height:96px;object-fit:contain}.land .mon{width:72px;height:72px}.shadow{filter:brightness(.15) drop-shadow(0 0 6px #a78bfa);transform:scaleX(-1)}
.bar{height:8px;border-radius:9px;background:#0008;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#22c55e,#a3e635)}.g{margin:2px 0 0;font-size:10px;color:#fde68a;font-weight:800}
.vs{text-align:center}.dist{margin:0;font-size:10px;color:#cbd5e1;font-weight:800}.hit{margin:4px 0 30px;font-size:13px;font-weight:900;color:#fef08a}.hit b{font-size:24px;color:#fff}
.speed{display:flex;gap:6px;margin-top:6px;font-size:11px;font-weight:900}.speed span{border-radius:10px;border:1px solid #ffffff33;padding:6px 8px}.speed .on{background:#fde68a;color:#0f172a}.speed .skip{margin-left:auto}
.log{margin-top:8px;border-radius:14px;background:#1e293b;padding:8px 10px;font-size:11.5px;font-weight:800}.log p{margin:3px 0}.log .h{color:#fde68a;font-size:12px}.up{color:#f472b6}.note{color:#94a3b8;font-size:10.5px}
.land .log p{margin:1px 0}
.land .toast{position:absolute;left:12px;right:12px;bottom:10px;margin:0;box-shadow:0 -4px 16px #000c}`;
const frames = (w, h, land) => [
  ['① 窓に帯が付く(応援の前)', sheet(false)],
  ['② 👀 修行を見る(練習試合・約20秒)', watch],
  ['③ 📣 応援したあと', sheet(true)],
].map(([cap, inner]) => `<div><p class="cap">${cap}</p><div class="phone" style="width:${w}px;height:${h}px">${inner}</div></div>`).join('');
const page = (w, h, land) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="wrap${land ? ' land' : ''}">${frames(w, h, land)}</div></body></html>`;

(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium' });
  for (const [name, w, h, land] of [['portrait', 390, 844, false], ['landscape', 844, 390, true]]) {
    const file = path.join(out, `cheer-mock-${name}.html`);
    fs.writeFileSync(file, page(w, h, land));
    const p = await b.newPage({ viewport: { width: land ? 900 : 1260, height: 900 }, deviceScaleFactor: 2 });
    await p.goto('file://' + file); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(out, `cheer-mock-${name}.png`), fullPage: true });
    await p.close(); fs.unlinkSync(file);
  }
  await b.close();
  console.log('OK: cheer-mock-portrait.png・cheer-mock-landscape.png を書いた');
})();
