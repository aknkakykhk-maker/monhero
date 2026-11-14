// 眼鏡の人(ドラ)の寝顔の止め絵(2026-11-11 社長「ドラはメガネ外してメガネをどこかに置いてメガネ3の字になってるみたいに」)
//   node tools/assistant/life-sleep-glasses-shot.js [出力先.png]
//   ドラが家で寝ている様子にして、家の部屋の顔・大きな部屋のベッド・場面の立ち絵・地図の全身を、前(重ねを隠す)と後で撮って1枚に並べる
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9268;
const W = Number(process.env.SHOT_W) || 390;
const out = path.resolve(process.argv[2] || path.join(root, 'docs/progress/assistant-peer/lifeux/sleep-glasses-dra.png'));
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
  const HIDE = '[data-assistant-life-sleep-glasses-off],[data-assistant-life-sleep-glasses-put],[data-assistant-life-roomview-nightstand]{display:none!important}';
  const shots = {};
  for (const mode of ['before', 'after']) {
    const page = await browser.newPage({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2 });
    page.on('pageerror', e => console.log('pageerror:', e.message));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    if (mode === 'before') await page.addStyleTag({ content: HIDE });
    await page.evaluate(() => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: [], solo: Object.fromEntries(['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'].map(id => [id, { doing: 'sleep', place: 'home' }])), watched: [] } }); });
    await page.waitForTimeout(800); await finishTalk(page);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const S = shots[mode] = {};
    S.house = await page.locator('[data-assistant-life-room="dra"]').first().screenshot();
    await page.locator('[data-assistant-life-icon="where"]').click(); await page.waitForTimeout(1800);
    const fig = page.locator('[data-assistant-life-map-fig]:has(img[src*="dra_normal"])').first();
    if (!(await fig.count())) console.log('地図の絵:', await page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-map-fig] img')].map(e => e.getAttribute('src').split('/').pop().slice(0, 30)).join(',')));
    const bb = (await fig.count()) ? await fig.boundingBox() : null;
    if (bb) S.map = await page.screenshot({ clip: { x: Math.max(0, bb.x - 50), y: Math.max(0, bb.y - 40), width: bb.width + 100, height: bb.height + 70 } });
    await page.locator('[data-assistant-life-map-back]').click(); await page.waitForTimeout(600);
    await page.locator('[data-assistant-life-room="dra"]').first().click({ timeout: 3000 }); await page.waitForTimeout(1500);
    S.bed = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: 520 } });
    if (process.env.SHOT_DEBUG) fs.writeFileSync(out.replace(/\.png$/, `-dbg-${mode}.png`), await page.screenshot());
    // 場面の立ち絵: 寝ている部屋で「ようす」を見る
    const peek = page.locator('[data-assistant-life-room-act="peek"], [data-assistant-life-do="peek"]').first();
    if (await peek.count()) { await peek.click().catch(() => {}); await page.waitForTimeout(2500); }
    if (await page.locator('[data-assistant-life-scene-stand="dra"]').count()) S.scene = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: 620 } });
    else console.log(`${mode}: 場面の立ち絵が出ませんでした`);
    if (process.env.SHOT_DEBUG) console.log(mode, await page.evaluate(() => [...document.querySelectorAll('.mhl-scene [data-assistant-life-sleep-glasses-off], .mhl-scene img.st')].map(e => e.tagName + ' ' + getComputedStyle(e).filter + ' op=' + getComputedStyle(e).opacity + ' anim=' + getComputedStyle(e).animationName + ' ' + (e.firstElementChild ? e.firstElementChild.outerHTML.slice(0, 160) : '')).join('\n')));
    await page.close();
  }
  // 1枚に並べる(上: 前/下: 後)
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
  const KEYS = [['house', '家の部屋(顔)', 330], ['bed', '大きな部屋(ベッド)', 330], ['scene', '場面(ようすを見る)', 300], ['map', '地図(全身・みんなで家にいるとき)', 330]];
  const img = (b, w) => b ? `<img src="data:image/png;base64,${b.toString('base64')}" style="width:${w}px;display:block;border-radius:6px">` : '<div style="color:#f88">(撮れず)</div>';
  const row = (mode, label) => `<div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px"><div style="width:44px;color:#fff;font:bold 20px sans-serif;padding-top:30px">${label}</div>${KEYS.map(([k, t, w]) => `<div><div style="color:#cbd5e1;font:14px sans-serif;margin-bottom:4px">${t}</div>${img(shots[mode][k], w)}</div>`).join('')}</div>`;
  await page.setContent(`<body style="margin:0;background:#111"><div id="all" style="display:inline-block;padding:14px"><div style="color:#fff;font:bold 18px sans-serif;margin-bottom:10px">ドラの寝顔: 眼鏡を外して「3」の目に・外した眼鏡はそばに置く</div>${row('before', '前')}${row('after', '後')}</div></body>`);
  await page.waitForTimeout(500);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.locator('#all').screenshot({ path: out });
  await browser.close(); server.close();
  console.log('書き出し:', path.relative(root, out));
})().catch(e => { console.error(e); process.exit(1); });
