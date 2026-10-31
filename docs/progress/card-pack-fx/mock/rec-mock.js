const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = '/home/user/monhero', FX = __dirname;
const PORT = 8972;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/mock/') ? path.join(FX, u.slice(6)) : path.join(ROOT, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const LEN = { shineA: 7000, shineB: 7000, listA: 6000, listB: 6000, breeder: 7000 };
(async () => {
  const { chromium } = require('playwright');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  if (!fs.existsSync(path.join(FX, 'pack.png'))) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof CardPackArt === 'function' && typeof ReactDOM !== 'undefined', null, { timeout: 90000 });
    await page.evaluate(() => { const d = document.createElement('div'); d.id = '__p'; d.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;padding:0;background:transparent'; document.body.appendChild(d);
      ReactDOM.createRoot(d).render(React.createElement(CardPackArt, { db: CARD_BATTLE_DATA, pack: cardPackOf('p1'), width: 210 })); });
    await page.waitForTimeout(1500);
    await page.locator('#__p > *').first().screenshot({ path: path.join(FX, 'pack.png'), omitBackground: true });
    await page.close();
  }
  for (const v of process.argv.slice(2)) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: path.join(FX, `raw-${v}`), size: { width: 390, height: 844 } } });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/mock/mock.html?v=${v}`);
    if (LEN[v]) await page.waitForTimeout(LEN[v]); else await page.waitForFunction(() => window.__done === true, null, { timeout: 60000 });
    await page.waitForTimeout(300);
    await ctx.close();
  }
  await browser.close(); server.close();
})();
