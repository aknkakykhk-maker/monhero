// 町の地図で、場所の上に並ぶ助手の絵の大きさ(r1115-031)。8人が見えるように、場所をちらして撮る
//   node tools/assistant/life-town-faces-shot.js [出力先.png]   幅は SHOT_W(既定390)・SHOT_SLEEP=1 で寝ている姿
//   あわせて、各人の「見えている顔の高さ」(顔の絵の測り方どおり)を一覧で出す
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9272, W = Number(process.env.SHOT_W) || 390, SLEEP = !!process.env.SHOT_SLEEP;
const out = path.resolve(process.argv[2] || path.join(root, 'docs/progress/assistant-room/r1115-031/town.png'));
const PLACES = { mua: 'plaza', kiki: 'plaza', dra: 'garden', atsu: 'garden', kyuko: 'hill', momosuke: 'cafe', sorashido: 'library', erubin: 'clinic' };
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
  const page = await browser.newPage({ viewport: { width: W, height: 844 }, deviceScaleFactor: Number(process.env.SHOT_DSF) || 2 });
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
  await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
  await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await toHome(page); await waitFaces(page); await finishTalk(page);
  const setLife = () => page.evaluate(({ places, sleep }) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: [], solo: Object.fromEntries(Object.entries(places).map(([id, place]) => [id, { doing: sleep ? 'sleep' : 'idle', place: sleep ? 'home' : place }])), watched: [] } }); }, { places: PLACES, sleep: SLEEP });
  await setLife(); await page.waitForTimeout(800); await finishTalk(page);
  await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
  await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200); await setLife();
  await page.locator('[data-assistant-life-icon="where"]').click(); await page.waitForTimeout(2500); await setLife(); await page.waitForTimeout(1200);
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-map-fig]')].map(fig => { const img = fig.querySelector('img'), r = fig.getBoundingClientRect(); const src = img ? (img.getAttribute('src') || '').split('/').slice(-2).join('/') : ''; return { src, w: Math.round(r.width), h: Math.round(r.height) }; }));
  console.log(rows.map(r => `${r.src} ${r.w}x${r.h}`).join('\n'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  if (process.env.SHOT_FIGS) { // 8人の絵だけを同じ倍率で並べる(顔の大きさの見比べ用)
    const figs = page.locator('[data-assistant-life-map-fig]'); const n = await figs.count(); const bufs = [];
    for (let i = 0; i < n; i++) { const bb = await figs.nth(i).boundingBox(); bufs.push(await page.screenshot({ clip: { x: bb.x - 6, y: bb.y - 4, width: bb.width + 12, height: bb.height + 8 } })); }
    const p2 = await browser.newPage({ viewport: { width: 1700, height: 700 }, deviceScaleFactor: 1 });
    await p2.setContent(`<body style="margin:0;background:#334"><div id="a" style="display:flex;flex-wrap:wrap;width:1650px;gap:6px;padding:8px;align-items:flex-start">${bufs.map(b => `<img src="data:image/png;base64,${b.toString('base64')}">`).join('')}</div>`);
    await p2.waitForTimeout(400); await p2.locator('#a').screenshot({ path: process.env.SHOT_FIGS });
  }
  await browser.close(); server.close(); console.log('書き出し:', path.relative(root, out));
})().catch(e => { console.error(e); process.exit(1); });
