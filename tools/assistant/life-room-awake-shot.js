// 部屋に入った画面(起きているとき)の止め絵(r1115-018)。8人ぶんを並べる
//   node tools/assistant/life-room-awake-shot.js [出力先.png]   幅は SHOT_W(既定390)
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9269, W = Number(process.env.SHOT_W) || 390;
const out = path.resolve(process.argv[2] || path.join(root, 'docs/progress/assistant-room/r1115-018/room-awake.png'));
const IDS = (process.env.SHOT_IDS || 'mua,kiki,momosuke,dra,atsu,kyuko,sorashido,erubin').split(',');
(async () => {
  const { chromium } = require('playwright');
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const page = await browser.newPage({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
  await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
  await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await toHome(page); await waitFaces(page); await finishTalk(page);
  await page.evaluate((ids) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: [], solo: Object.fromEntries(ids.map(id => [id, { doing: 'idle', place: 'home' }])), watched: [] } }); }, IDS);
  await page.waitForTimeout(800); await finishTalk(page);
  await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
  await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const shots = [];
  for (const id of IDS) {
    // 部屋の状態は時間で書き換わるので、開く直前に「家でひとり・起きている」へ戻す
    await page.evaluate((ids) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: [], solo: Object.fromEntries(ids.map(i => [i, { doing: 'idle', place: 'home' }])), watched: [] } }); }, IDS);
    await page.waitForTimeout(300);
    await page.locator(`[data-assistant-life-room="${id}"]`).first().click({ timeout: 3000 }); await page.waitForTimeout(1200);
    shots.push([id, await page.screenshot({ clip: { x: 0, y: 0, width: W, height: 520 } })]);
    await page.locator('[data-assistant-life-roomview-close]').click().catch(() => {}); await page.waitForTimeout(400);
  }
  const p2 = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const cw = Math.min(380, Math.floor(1560 / Math.min(4, shots.length)) - 10);
  await p2.setContent(`<body style="margin:0;background:#111"><div id="all" style="display:flex;flex-wrap:wrap;gap:8px;padding:10px;width:${(cw + 8) * Math.min(4, shots.length)}px">${shots.map(([id, b]) => `<div style="color:#fff;font:bold 14px sans-serif">${id}<img src="data:image/png;base64,${b.toString('base64')}" style="width:${cw}px;display:block;border:1px solid #444"></div>`).join('')}</div>`);
  await p2.waitForTimeout(500);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await p2.locator('#all').screenshot({ path: out });
  await browser.close(); server.close(); console.log('書き出し:', path.relative(root, out));
})().catch(e => { console.error(e); process.exit(1); });
