// 案の止め絵(mock.html)を撮って、いまの画面と並べた比べ絵を作る。
// node docs/progress/profile-renewal-plan/shoot-mock.js
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
require(path.join(ROOT, 'tools/shared-serve'));
const { chromium } = require('playwright');
const OUT = path.join(__dirname, 'shots');
const URL = 'http://127.0.0.1:8899/docs/progress/profile-renewal-plan/mock.html';
const IDS = ['A-top', 'A-rec', 'A-replay', 'B-top', 'B-replay', 'B-song', 'C-top', 'C-replay'];
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const [tag, vp] of [['tate', { width: 390, height: 844 }], ['yoko', { width: 844, height: 390 }]]) {
    const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
    for (const id of IDS) {
      await page.goto(`${URL}#${id}`); await page.reload();
      await page.waitForLoadState('networkidle'); await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, `${id}-${tag}.png`) });
    }
    await page.close();
  }
  await browser.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
