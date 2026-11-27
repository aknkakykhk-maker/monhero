#!/usr/bin/env node
// HOME の作り直し(r1126-073)の止め絵。home-review-shoot.js(点検 r1126-070)と同じ時刻・大きさで、
//   はじめの形(fold)・吹き出しを開いた形(say)・メニューを開いた形(menu)を撮る。
//   SHOT_DIR=<置き場> [ONLY_T=t2] [ONLY_VP=phone-tate] [MODES=fold,say,menu] [SCALE=2] node tools/browser/home-rebuild-shoot.js
//   置き場に <時刻>-<大きさ>-<形>.jpg と、部品の位置(boxes.json)を残す
const http = require('http'), path = require('path'), fs = require('fs');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8962;
const SHOT_DIR = process.env.SHOT_DIR || path.join(ROOT, 'docs/progress/home-rebuild-2026-11/shots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const shiftClock = (iso) => ({ content: `(() => { const off = Date.parse(${JSON.stringify(iso)}) - Date.now(); const RD = Date;
  class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
  D.parse = RD.parse; D.UTC = RD.UTC; window.Date = D; })();` });
const VPS = [
  { tag: 'phone-tate', viewport: { width: 390, height: 844 } },
  { tag: 'phone-yoko', viewport: { width: 844, height: 390 } },
  { tag: 'tablet-tate', viewport: { width: 820, height: 1180 } },
  { tag: 'tablet-yoko', viewport: { width: 1180, height: 820 } },
];
const TIMES = [
  { tag: 't1-1127-1907', iso: '2026-11-27T19:07:00+09:00' },
  { tag: 't2-1128-1005', iso: '2026-11-28T10:05:00+09:00' },
  { tag: 't3-1130-0005', iso: '2026-11-30T00:05:00+09:00' },
];
(async () => {
  const { chromium } = (() => { try { return require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch (e) { return require('playwright'); } })();
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const boxes = {};
  const onlyT = process.env.ONLY_T || '', onlyVp = process.env.ONLY_VP || '';
  const MODES = (process.env.MODES || 'fold,say,menu').split(',');
  for (const t of TIMES) for (const vp of VPS) {
    if ((onlyT && !onlyT.split(',').some((x) => t.tag.startsWith(x))) || (onlyVp && !onlyVp.split(',').includes(vp.tag))) continue;
    const ctx = await browser.newContext({ viewport: vp.viewport, hasTouch: true, isMobile: true, deviceScaleFactor: Number(process.env.SCALE || 1) });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(shiftClock(t.iso));
    // peer の形を撮るときは、助手どうしの会話が必ず始まるように乱数を小さく固定する(ふだんは4割。会話が出ない回を撮らないため)
    if (MODES.includes('peer')) await page.addInitScript(() => { Math.random = () => 0.05; });
    await page.addInitScript(() => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
      put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
      put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
      put('mh_rhythm_tutorial_seen_v1', true);
    });
    await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed()); await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 8; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(1500);
    for (const mode of MODES) {
      if (mode === 'say') { const b = page.locator('[data-home-assistant-toggle="show"]:not([data-home-peer-waiting])').first(); if (await b.count()) { await b.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(1200); } }
      if (mode === 'peer') { const b = page.locator('[data-home-peer-waiting], [data-home-peer-talk-mark]').first(); if (await b.count()) { await b.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(1000); } }
      if (mode === 'menu') { const h = page.locator('[data-home-assistant-toggle="hide"]').first(); if (await h.count()) { await h.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(500); }
        await page.locator('[data-home-menu-btn]').first().dispatchEvent('click').catch(() => {}); await page.waitForTimeout(600); }
      const name = `${t.tag}-${vp.tag}-${mode}`;
      await page.screenshot({ path: path.join(SHOT_DIR, `${name}.jpg`), type: 'jpeg', quality: 82 });
      if (mode === 'menu') await page.locator('[data-home-menu-shade]').first().dispatchEvent('click').catch(() => {});
      boxes[name] = await page.evaluate(() => {
        const out = [];
        const vis = (r) => r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
        document.querySelectorAll('button, [data-home-event-strip], [data-home-event-banner], [data-home-xmas-entry-strip], [role="tab"]').forEach((el) => {
          const r = el.getBoundingClientRect(); if (!vis(r)) return;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          out.push({ t: (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 40), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), fs });
        });
        return out;
      });
    }
    if (errors.length) console.log('エラー', t.tag, vp.tag, errors.slice(0, 2));
    console.log('撮った', t.tag, vp.tag);
    await ctx.close();
  }
  fs.writeFileSync(path.join(SHOT_DIR, 'boxes.json'), JSON.stringify(boxes, null, 1));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
