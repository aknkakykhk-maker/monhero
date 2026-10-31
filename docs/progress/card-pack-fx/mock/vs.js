const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const rec = process.argv[3]; const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, ...(rec ? { recordVideo: { dir: `raw-${rec}`, size: { width: 390, height: 844 } } } : {}) }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('http://localhost:'+(process.argv[2]||8899)+'/monster-hero/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof CardVsMonsters === 'function', null, { timeout: 90000 });
  await page.evaluate(() => { const h = document.createElement('div'); h.id = 'h'; h.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#120d2a;display:flex;flex-direction:column'; document.body.appendChild(h);
    ReactDOM.createRoot(h).render(React.createElement(CardVsIntro, { db: CARD_BATTLE_DATA, intro: { mode: 'pvp', foe: { name: 'エー', monsters: ['C-029S', 'C-008V', 'C-021S'] }, me: { name: 'ビー', monsters: ['C-001V', 'C-006S', 'C-010'] } }, onDone: () => {} })); });
  await page.waitForTimeout(rec ? 3800 : 2600);
  console.log(await page.evaluate(() => document.querySelectorAll('#h [data-card-kira-sil]').length), errors.slice(0, 2));
  await page.screenshot({ path: 'vs-'+(process.argv[2]||8899)+'.png' }); await ctx.close(); await b.close();
})();
