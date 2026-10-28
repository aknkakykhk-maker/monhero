// スマホ縦画面の実コンポーネントで、全8弾の中身/提供割合の順序・詳細・画像を確かめる。
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const PORT = Number(process.env.CARD_PORT) || 9007;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, `.${decodeURIComponent(req.url.split('?')[0])}`);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  const { chromium } = require('playwright');
  let browser;
  await new Promise((r) => server.listen(PORT, r));
  try {
    browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // 本番の保存/通信には書かない。売り場のコンポーネントだけをローカルで描く。
    await page.route(/supabase\.co\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof CardPackContents === 'function' && typeof CardPackRateSheet === 'function');
    await page.evaluate(() => {
      document.getElementById('root').style.display = 'none';
      const host = document.createElement('div'); host.id = 'card-order-test'; document.body.append(host);
      window.cardOrderRoot = ReactDOM.createRoot(host);
      window.cardOrderMount = (id, mode) => {
        const db = CARD_BATTLE_DATA, pack = cardPackOf(id), rates = cardPackCardRates(db, id);
        cardOrderRoot.render(React.createElement(mode === 'contents' ? CardPackContents : CardPackRateSheet,
          { key: `${id}:${mode}`, db, pack, collection: { 'C-208': 1 }, onClose: () => {} }));
        return { mon: cardPackDisplayRows(db, pack, rates.mon).map((x) => x.no), tech: cardPackDisplayRows(db, pack, rates.tech).map((x) => x.no),
          rates: Object.fromEntries([...rates.mon, ...rates.tech].map((x) => [x.no, Number((x.p * 100).toFixed(3))])) };
      };
    });
    for (const width of [390, 375]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 667 });
      for (let i = 1; i <= 8; i++) {
        let contents;
        for (const mode of ['contents', 'rates']) {
          const want = await page.evaluate(({ id, mode }) => cardOrderMount(id, mode), { id: `p${i}`, mode });
          await page.locator(`[data-card-shop-sheet="${mode}"]`).waitFor();
          const selector = mode === 'contents' ? '[data-card-shop-item]' : '[data-card-rate-row]';
          const ids = await page.locator(selector).evaluateAll((els) => els.map((e) => e.getAttribute('data-card-shop-item') || e.getAttribute('data-card-rate-row')));
          assert.deepEqual(ids, [...want.mon, ...want.tech]);
          if (mode === 'contents') {
            contents = ids;
            await page.waitForFunction(() => [...document.querySelectorAll('[data-card-shop-item] img')].every((im) => im.complete && im.naturalWidth > 0));
            assert.equal(await page.locator('[data-card-shop-item="C-208"][data-card-shop-missing]').count(), 0);
          } else {
            assert.deepEqual(ids, contents, '中身と提供割合は同じ順');
            const values = await page.locator(selector).evaluateAll((els) => Object.fromEntries(els.map((e) => [e.getAttribute('data-card-rate-row'), parseFloat(e.lastElementChild.textContent)])));
            assert.deepEqual(values, want.rates, '画面の提供割合も変わらない');
          }
          // 下のほうのカードでも詳細が開き、閉じたら元の一覧に戻れる。
          await page.locator(selector).last().click();
          await page.locator('[data-card-detail]').waitFor();
          await page.locator('[data-card-detail]').click({ position: { x: 10, y: 10 } });
          assert.equal(await page.locator(`[data-card-shop-sheet="${mode}"]`).count(), 1);
          assert.equal(await page.locator('[data-card-shop-sheet-close]').isVisible(), true);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
          assert.equal(overflow, false, '横にはみ出さない');
          if (process.env.CARD_SHOT_DIR && i === 5) {
            fs.mkdirSync(process.env.CARD_SHOT_DIR, { recursive: true });
            await page.locator('[data-card-shop-sheet] > div > div').nth(1).evaluate((e) => { e.scrollTop = 0; });
            await page.screenshot({ path: path.join(process.env.CARD_SHOT_DIR, `pack5-${mode}-${width}.png`) });
          }
        }
        console.log(`OK: ${width}px 第${i}弾 中身/提供割合の一致・全画像・詳細・横はみ出しなし`);
      }
    }
    assert.deepEqual(errors, []);
    console.log('すべてOK');
  } finally { if (browser) await browser.close(); await new Promise((r) => server.close(r)); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
