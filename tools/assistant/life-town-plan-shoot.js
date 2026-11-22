#!/usr/bin/env node
// 助手ライフの作り直し 段9(町を型に載せる)の案の止め絵を撮る。ゲーム本体は変えない・読むだけ。
//   node tools/assistant/life-town-plan-shoot.js
//   出す物: docs/progress/assistant-life/step9-town/ の before.png(いまの町・本物の画面)・plan-a/b/c.png(案の見本 mock.html)・places.json(場所の位置)
// 前は本物の画面(偽のデータ・15:00)。案は mock.html(同じ地図の絵・顔の絵・型の字の4段)を 390×844 で撮る。
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..');
const OUT = path.join(root, 'docs/progress/assistant-life/step9-town');
const PORT = 9291;
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が無い'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(root, 'tools/boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require('./life-browser-shared');
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const MIX = { groups: [{ ids: ['mua', 'kiki'], place: 'cafe', doing: 'cafe' }, { ids: ['dra', 'sorashido', 'erubin'], place: 'cardroom', doing: 'card' }],
    solo: { momosuke: { doing: 'battle', place: 'battle' }, atsu: { doing: 'idle', place: 'home' }, kyuko: { doing: 'read', place: 'library' } } };
  const errs = [];
  // 前: いまの町(本物の画面)
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const jst = new Date(Date.now() + 9 * 3600000); jst.setUTCHours(15, 0, 0, 0);
    await page.clock.setFixedTime(new Date(jst.getTime() - 9 * 3600000));
    page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 160)));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = ['assistant_life_friend']; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    try {
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page); await waitFaces(page); await finishTalk(page);
      await page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, watched: [] } }); }, MIX);
      await page.waitForTimeout(600); await finishTalk(page);
      await page.locator('[data-home-assistant-life]').first().click({ timeout: 20000 });
      await page.locator('[data-assistant-life-typed-house]').waitFor({ timeout: 15000 });
      await page.locator('[data-alu-tab="where"], [data-alu-tabs] button:has-text("町")').first().click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, 'before.png') });
      const places = await page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-map-place]')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
        .map(e => { const r = e.getBoundingClientRect(); return { place: e.getAttribute('data-assistant-life-map-place'), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), label: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30) }; }));
      fs.writeFileSync(path.join(OUT, 'places.json'), JSON.stringify({ view: { w: 390, h: 844 }, places }, null, 1) + '\n');
      console.log(`前: before.png・場所 ${places.length}か所`);
    } catch (e) { errs.push(`前: ${String(e.message || e).split('\n')[0].slice(0, 160)}`); }
    await ctx.close();
  }
  // 案: mock.html?plan=a|b|c
  if (fs.existsSync(path.join(OUT, 'mock.html'))) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const p of ['a', 'b', 'c']) {
      await page.goto(`http://localhost:${PORT}/docs/progress/assistant-life/step9-town/mock.html?plan=${p}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `plan-${p}.png`) });
      const sizes = await page.evaluate(() => { const s = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.textContent.trim()) continue; const el = n.parentElement; if (el.closest('[aria-hidden="true"]')) continue; s.add(parseFloat(getComputedStyle(el).fontSize)); } return [...s].sort((a, b) => a - b); });
      console.log(`案${p.toUpperCase()}: plan-${p}.png 字 ${sizes.join('/')}px`);
    }
    await ctx.close();
  }
  await browser.close(); server.close();
  if (errs.length) { console.log(`NG: ${errs.join(' / ')}`); process.exit(1); }
  console.log('OK: 撮れた');
})();
