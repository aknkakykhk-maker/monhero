#!/usr/bin/env node
// 助手のコメントの入/切(台帳 r1119-132)の案の止め絵を撮る。ゲーム本体は変えない・撮るときだけ画面に案の見本を重ねる。
//   node tools/assistant/comment-toggle-plan-shoot.js
//   出す物: docs/progress/assistant-comment-toggle/ の plan-a-tate.png / plan-a-yoko.png / plan-b-… / plan-c-…
//   1枚に「いま」「入(案)」「切(案)」を左から並べる。見本の所には桃色の「見本」の札を付ける
// 場面の開き方は tools/browser/visual-scenes.js と同じ(HOME から人と同じボタンを押す。合言葉・DEBUG MENU は使わない)
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'docs/progress/assistant-comment-toggle');
const WORK = path.join(ROOT, 'tools/out/comment-toggle-plan');
const PORT = Number(process.env.SHOOT_PORT) || 9317;
let playwright;
try { playwright = require('playwright'); } catch (e) { console.log('SKIP: playwright が無い'); process.exit(0); }
const { SCENES } = require('../browser/visual-scenes');
const { openSession } = require('../playbot/lib/session');
const { prepareVeteran } = require('../playbot/lib/seeds');
const SIZES = [{ tag: 'tate', w: 390, h: 844, name: '縦' }, { tag: 'yoko', w: 844, h: 390, name: '横' }];
const FREEZE = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

// ---- 画面に重ねる見本(ページの中で動く) ----
// mode: 'none' いま / 'a-on' 案A 入 / 'a-off' 案A 切 / 'b-on' 案B 入 / 'b-off' 案B 切
//   案A … 顔の下に小さな「隠す」(HOME と同じ形)。切は顔の丸いボタン+💬だけ残る
//   案B … 右上の「▴」でたたむ(マーケット・神殿と同じ形)。切は小さな顔+「💬 ○○のひとこと ▾」
//   掛け合いの見本(peer=true)… 画面の下に2人の掛け合いの札。案A は「隠す」、案B は「今日は出さない」
function overlay({ mode, peer }) {
  const tag = (el) => { const t = document.createElement('span'); t.textContent = '見本'; t.style.cssText = 'position:absolute;z-index:99;right:-4px;top:-10px;padding:1px 6px;border-radius:9px;background:#ec4899;color:#fff;font:900 9px sans-serif;pointer-events:none'; el.style.position = el.style.position || 'relative'; el.appendChild(t); };
  const b = document.querySelector('[data-assistant-bubble]');
  if (b && mode !== 'none') {
    const faceBtn = b.querySelector('button');
    const bubble = b.children[1];
    const color = (bubble && getComputedStyle(bubble).borderTopColor) || '#f472b6';
    const img = faceBtn && faceBtn.querySelector('img');
    const name = ((bubble && bubble.querySelector('span.tracking-widest')) || {}).textContent || 'みゅあ';
    const face = (size) => { const d = document.createElement('span'); d.style.cssText = `display:inline-block;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;border:2px solid ${color};background:#0f172a;flex:none`; if (img) { const i = img.cloneNode(); i.style.cssText = 'width:100%;height:100%;object-fit:cover'; d.appendChild(i); } return d; };
    if (mode === 'a-on' && faceBtn) {
      const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;flex:none';
      faceBtn.parentNode.insertBefore(wrap, faceBtn); wrap.appendChild(faceBtn);
      const hide = document.createElement('span'); hide.textContent = '隠す';
      hide.style.cssText = `position:relative;display:inline-flex;align-items:center;min-height:22px;padding:0 9px;border-radius:999px;border:1px solid ${color};color:${color};background:rgba(15,23,42,.92);font:900 10px sans-serif`;
      wrap.appendChild(hide); tag(hide);
    }
    if (mode === 'a-off') {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;min-height:44px';
      const btn = document.createElement('span'); btn.style.cssText = 'position:relative;display:inline-block'; btn.appendChild(face(40));
      const mark = document.createElement('span'); mark.textContent = '💬'; mark.style.cssText = `position:absolute;right:-6px;bottom:-4px;width:20px;height:20px;border-radius:50%;border:1px solid ${color};background:#0f172a;font-size:11px;display:flex;align-items:center;justify-content:center`;
      btn.appendChild(mark); row.appendChild(btn); tag(btn);
      b.replaceWith(row);
    }
    if (mode === 'b-on' && bubble) {
      b.style.position = 'relative';
      const t = document.createElement('span'); t.textContent = '▴';
      t.style.cssText = 'position:absolute;right:4px;top:0;z-index:10;min-width:24px;min-height:24px;border-radius:999px;display:flex;align-items:center;justify-content:center;font:900 10px sans-serif;color:#cbd5e1;background:rgba(15,23,42,.8);border:1px solid rgba(255,255,255,.2)';
      b.appendChild(t); tag(t);
    }
    if (mode === 'b-off') {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%';
      row.appendChild(face(32));
      const pill = document.createElement('span'); pill.textContent = `💬 ${name.trim()}のひとこと ▾`;
      pill.style.cssText = `position:relative;display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid ${color};color:${color};background:rgba(15,23,42,.92);font:900 10px sans-serif`;
      row.appendChild(pill); tag(pill);
      b.replaceWith(row);
    }
  }
  if (peer && mode !== 'none') {
    const land = innerWidth > innerHeight;
    const card = document.createElement('div');
    card.style.cssText = `position:fixed;z-index:70000;left:${land ? 'auto' : '12px'};right:12px;bottom:${land ? '10px' : '96px'};width:${land ? '330px' : 'auto'};padding:8px 10px;border-radius:16px;border:2px solid #38bdf8;background:rgba(2,6,23,.95);color:#fff;font:700 11px sans-serif`;
    const off = mode === 'a-off' || mode === 'b-off';
    if (off) {
      card.style.cssText += ';border-style:dashed;border-color:#64748b;color:#94a3b8;text-align:center';
      card.textContent = mode === 'a-off' ? '(掛け合いは出ません・設定で「入」に戻せます)' : '(今日はもう出ません・明日の朝4:00から戻ります)';
    } else {
      card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><b style="color:#7dd3fc;font-size:10px">助手どうしの掛け合い</b><span data-peer-x style="display:flex;gap:6px"></span></div>'
        + '<div>ドラ「きき、今日のおやつ何？」</div><div style="color:#cbd5e1">きき「…ないしょ」</div>';
      const box = card.querySelector('[data-peer-x]');
      const pill = (t, c) => { const s = document.createElement('span'); s.textContent = t; s.style.cssText = `position:relative;min-height:22px;display:inline-flex;align-items:center;padding:0 8px;border-radius:999px;border:1px solid ${c};color:${c};font:900 10px sans-serif`; return s; };
      const extra = pill(mode === 'a-on' ? '隠す' : '今日は出さない', '#f472b6');
      box.appendChild(extra); box.appendChild(pill('×', '#94a3b8')); tag(extra);
    }
    document.body.appendChild(card);
  }
}

// 案C: 設定の「助手のひとこと」の下に、行を2つ足した見本(画面には何も足さない)
function overlaySettings({ mode }) {
  const heads = [...document.querySelectorAll('b')].filter((x) => /助手のひとこと|ホームの助手コメント/.test(x.textContent));
  const anchor = heads.length ? heads[heads.length - 1].closest('div') : null;
  if (!anchor) return false;
  anchor.scrollIntoView({ block: 'start' });
  if (mode === 'none') return true;
  const row = (title, note, on) => {
    const d = document.createElement('div');
    d.className = anchor.className; d.style.position = 'relative'; d.style.marginTop = '8px';
    const opt = (lab, sub, sel) => `<span style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:52px;border-radius:12px;font:900 11px sans-serif;${sel ? 'border:1px solid #22d3ee;background:rgba(8,145,178,.35);color:#fff' : 'border:1px solid rgba(255,255,255,.15);background:rgba(15,23,42,.6);color:#cbd5e1'}">${lab}<small style="font-size:10px;opacity:.8">${sub}</small></span>`;
    d.innerHTML = `<b style="display:block;font:900 13px sans-serif;color:#e2e8f0">${title}</b><p style="margin-top:4px;font:700 10px/1.6 sans-serif;color:#94a3b8">${note}</p><div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:8px">${opt('切', '出さない', !on)}${opt('入', 'これまでどおり', on)}</div>`;
    const t = document.createElement('span'); t.textContent = '見本'; t.style.cssText = 'position:absolute;right:6px;top:6px;padding:1px 6px;border-radius:9px;background:#ec4899;color:#fff;font:900 9px sans-serif'; d.appendChild(t);
    return d;
  };
  const on = mode === 'c-on';
  const r1 = row('助手どうしの掛け合い', 'ホーム・マーケット・モンヒロビート・マスモン一覧・MFバトルカードの入口で、ときどき助手が2人で話す札です。', on);
  const r2 = row('ミッションの1日1行', 'ミッションのデイリーで、助手がその日のミッションを1行で教えてくれる吹き出しです。', on);
  anchor.after(r1); r1.after(r2);
  return true;
}

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

// 撮る組: [案, 場面, 見本の作り方, 掛け合いの見本も出すか]
const PLANS = [
  { id: 'a', scene: 'mb-dex', modes: ['none', 'a-on', 'a-off'], peer: true, labels: ['いま', '案A 入(顔の下に「隠す」)', '案A 切(顔+💬だけ)'] },
  { id: 'b', scene: 'mb-dex', modes: ['none', 'b-on', 'b-off'], peer: true, labels: ['いま', '案B 入(右上の▴でたたむ)', '案B 切(たたんだ形)'] },
  { id: 'c', scene: 'settings', modes: ['none', 'c-on', 'c-off'], settings: true, labels: ['いまの設定', '案C 入', '案C 切'] },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(WORK, { recursive: true });
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const shots = {}; // `${plan}-${size}` → [{ file, label }]
  for (const size of SIZES) {
    let seed = 777; const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 2 ** 32; };
    const report = { headed: false, shotNo: 0, issues: [], issueKeys: new Set(), steps: [], screens: new Map() };
    const s = await openSession({ playwright, pageUrl: `http://localhost:${PORT}/monster-hero/index.html`, port: PORT, out: path.join(WORK, '_bot', size.tag), rand, persona: `cplan-${size.tag}`, report, viewport: { width: size.w, height: size.h } });
    try {
      await prepareVeteran(s); await s.boot();
      for (const plan of PLANS) {
        const sc = SCENES.find((x) => x.id === plan.scene);
        const list = [];
        for (let i = 0; i < plan.modes.length; i++) {
          const mode = plan.modes[i];
          await s.backHome(); await s.dismissOverlays(10);
          const ok = await sc.go(s).catch(() => false);
          if (!ok) { console.log(`開けなかった: ${plan.scene} ${size.tag}`); continue; }
          await s.page.addStyleTag({ content: FREEZE }).catch(() => {});
          await s.page.evaluate(() => { scrollTo(0, 0); document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }); }).catch(() => {});
          await s.wait(900);
          if (plan.settings) await s.page.evaluate(overlaySettings, { mode });
          else await s.page.evaluate(overlay, { mode, peer: plan.peer });
          await s.wait(400);
          const file = path.join(WORK, `${plan.id}-${size.tag}-${i}.png`);
          await s.page.screenshot({ path: file });
          list.push({ file, label: plan.labels[i] });
        }
        shots[`${plan.id}-${size.tag}`] = list;
      }
    } finally { await s.browser.close().catch(() => {}); }
  }
  // 3枚を横に並べて1枚にする(字の札つき)
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 })).newPage();
  for (const [key, list] of Object.entries(shots)) {
    if (!list.length) continue;
    const land = key.endsWith('yoko');
    const html = `<html><body style="margin:0;background:#111827;font-family:sans-serif;display:flex;${land ? 'flex-direction:column' : ''};gap:14px;padding:14px;width:max-content">${list.map((x) => `<figure style="margin:0"><figcaption style="color:#fff;font:900 15px sans-serif;margin-bottom:6px">${x.label}</figcaption><img src="data:image/png;base64,${fs.readFileSync(x.file).toString('base64')}" style="display:block;border:1px solid #374151"></figure>`).join('')}</body></html>`;
    await page.setContent(html);
    const dims = await page.evaluate(() => ({ w: document.body.scrollWidth, h: document.body.scrollHeight }));
    await page.setViewportSize({ width: dims.w, height: dims.h });
    await page.screenshot({ path: path.join(OUT, `plan-${key}.png`) });
    console.log(`書いた: docs/progress/assistant-comment-toggle/plan-${key}.png`);
  }
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
