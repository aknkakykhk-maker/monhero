// キラ・レアキラの子を全部、場と同じ部品(cardKiraWrap)で並べて写す: node allkira.js <port> <png>
const { chromium } = require('playwright');
(async () => {
  const [port, out] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await b.newPage({ viewport: { width: 1000, height: 800 } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(`http://localhost:${port}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof cardKiraWrap === 'function' && typeof CARD_BATTLE_DATA === 'object', null, { timeout: 90000 });
  const n = await page.evaluate(() => {
    const db = CARD_BATTLE_DATA;
    const nos = Object.keys(db.monsters).filter((no) => cardKiraOf(db, no));
    const h = document.createElement('div'); h.id = 'h';
    h.style.cssText = 'position:absolute;left:0;top:0;width:1000px;z-index:2147483000;background:#1e1b3a;display:flex;flex-wrap:wrap;gap:6px;padding:8px';
    document.body.appendChild(h);
    const E = React.createElement;
    const cells = nos.map((no) => {
      const m = db.monsters[no]; const art = cardMonArt(m); const kira = cardKiraOf(db, no);
      const fit = art ? cardFieldArtTransform(art, false) : null;
      const img = E('img', { src: art, style: fit ? { transform: fit } : null, className: 'max-h-[106px] max-w-[126px] object-contain' });
      return E('div', { key: no, style: { width: 150, height: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' } },
        E('div', { className: 'relative flex h-[106px] w-full items-end justify-center' }, cardKiraWrap(kira, img, { src: art, transform: fit, calm: false })),
        E('div', { style: { color: '#fff', fontSize: 11, marginTop: 14 } }, `${no} ${m.name} ${kira}`));
    });
    ReactDOM.createRoot(h).render(E(React.Fragment, null, cells));
    return nos.length;
  });
  await page.waitForTimeout(3000);
  await page.locator('#h').screenshot({ path: out });
  console.log(n, errors.slice(0, 2));
  await b.close();
})();
