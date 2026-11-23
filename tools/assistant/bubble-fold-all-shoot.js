#!/usr/bin/env node
// 💬▲▼ を全画面に(台帳 r1119-135)の前後の止め絵を撮る。
//   node tools/assistant/bubble-fold-all-shoot.js            前 = origin/main の版 / 後 = 今の作業ツリー
//   BEFORE_REV=<コミット> で前の版を変えられる
//   出す物: docs/progress/assistant-comment-toggle/fold-<場面>-<tate|yoko>.png(左から 前 / 後(開いている) / 後(💬▼で畳んだ))
// 場面の開き方は tools/browser/visual-scenes.js と同じ(HOME から人と同じボタンを押す。合言葉・DEBUG MENU は使わない)
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'docs/progress/assistant-comment-toggle');
const WORK = path.join(ROOT, 'tools/out/bubble-fold-all');
const PORT = Number(process.env.SHOOT_PORT) || 9318;
let playwright;
try { playwright = require('playwright'); } catch (e) { console.log('SKIP: playwright が無い'); process.exit(0); }
const serveRev = require('../browser/serve-rev');
const { SCENES } = require('../browser/visual-scenes');
const { openSession } = require('../playbot/lib/session');
const { prepareVeteran } = require('../playbot/lib/seeds');
const SIZES = [{ tag: 'tate', w: 390, h: 844 }, { tag: 'yoko', w: 844, h: 390 }];
const SHOTS = [{ id: 'mb-dex', name: 'モンスター図鑑' }, { id: 'mission', name: 'ミッション' }, { id: 'market', name: 'マーケット' }, { id: 'settings', name: '設定' }];
const FREEZE = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

let fromRev = null;
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (f.startsWith(ROOT) && serveRev.serve(fromRev, ROOT, f, res, MIME[path.extname(f)])) return;
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

async function pass(label, size, out) {
  let seed = 4242; const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 2 ** 32; };
  const report = { headed: false, shotNo: 0, issues: [], issueKeys: new Set(), steps: [], screens: new Map() };
  const s = await openSession({ playwright, pageUrl: `http://localhost:${PORT}/monster-hero/index.html`, port: PORT, out: path.join(WORK, '_bot', `${label}-${size.tag}`), rand, persona: `fold-${label}-${size.tag}`, report, viewport: { width: size.w, height: size.h } });
  try {
    await prepareVeteran(s); await s.boot();
    for (const sh of SHOTS) {
      const sc = SCENES.find((x) => x.id === sh.id);
      const shoot = async (suffix) => {
        await s.backHome(); await s.dismissOverlays(10);
        if (!(await sc.go(s).catch(() => false))) { console.log(`開けなかった: ${sh.id} ${size.tag} ${label}`); return; }
        await s.page.addStyleTag({ content: FREEZE }).catch(() => {});
        await s.page.evaluate(() => { scrollTo(0, 0); document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }); }).catch(() => {});
        await s.wait(900);
        const file = path.join(WORK, `${sh.id}-${size.tag}-${label}${suffix}.png`);
        await s.page.screenshot({ path: file });
        out[`${sh.id}-${size.tag}`] = out[`${sh.id}-${size.tag}`] || [];
        out[`${sh.id}-${size.tag}`].push({ file, label: suffix ? '後(💬▼で畳んだ)' : label === 'before' ? '前' : '後(開いている・💬▲)' });
      };
      await shoot('');
      if (label === 'after') {
        // 💬▲ を押して畳み、同じ画面を撮る。撮ったら開き直す(次の大きさ・次の場面へ持ち越さない)
        const folded = await s.page.evaluate(() => { const b = document.querySelector('[data-bubble-collapse]'); if (!b) return false; b.click(); return true; });
        if (folded) {
          await s.wait(500);
          const file = path.join(WORK, `${sh.id}-${size.tag}-after-fold.png`);
          await s.page.screenshot({ path: file });
          out[`${sh.id}-${size.tag}`].push({ file, label: '後(💬▼で畳んだ)' });
          await s.page.evaluate(() => { const b = document.querySelector('[data-bubble-collapsed] button'); if (b) b.click(); });
          await s.wait(300);
        }
      }
    }
  } finally { await s.browser.close().catch(() => {}); }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(WORK, { recursive: true });
  const server = await serve();
  const out = {};
  for (const size of SIZES) {
    process.env.SHOT_REV = process.env.BEFORE_REV || 'origin/main';
    fromRev = serveRev.make(ROOT);
    await pass('before', size, out);
    delete process.env.SHOT_REV; fromRev = null;
    await pass('after', size, out);
  }
  const browser = await playwright.chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 })).newPage();
  for (const [key, list] of Object.entries(out)) {
    const land = key.endsWith('yoko');
    const name = (SHOTS.find((x) => key.startsWith(`${x.id}-`)) || {}).name || key;
    const html = `<html><body style="margin:0;background:#111827;font-family:sans-serif;padding:14px;width:max-content"><h1 style="color:#f9a8d4;font:900 17px sans-serif;margin:0 0 10px">${name}(${land ? '横' : '縦'})</h1><div style="display:flex;${land ? 'flex-direction:column' : ''};gap:14px">${list.map((x) => `<figure style="margin:0"><figcaption style="color:#fff;font:900 15px sans-serif;margin-bottom:6px">${x.label}</figcaption><img src="data:image/png;base64,${fs.readFileSync(x.file).toString('base64')}" style="display:block;border:1px solid #374151"></figure>`).join('')}</div></body></html>`;
    await page.setContent(html);
    const dims = await page.evaluate(() => ({ w: document.body.scrollWidth, h: document.body.scrollHeight }));
    await page.setViewportSize({ width: dims.w, height: dims.h });
    await page.screenshot({ path: path.join(OUT, `fold-${key}.png`) });
    console.log(`書いた: docs/progress/assistant-comment-toggle/fold-${key}.png`);
  }
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
