// 助手ライフの作り直しの配置図(layout.html)を、画面ごとの PNG に撮る。
// 使い方: node docs/progress/assistant-life/overhaul-design/shoot.js
// 出す物: 同じ置き場の layout-<画面>.png(前の止め絵・後の縦・後の PC を横に並べた1枚)
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const dir = __dirname;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(dir, 'layout.html'));
  await page.waitForLoadState('networkidle');
  const ids = await page.$$eval('section[id^="s-"]', (els) => els.map((e) => e.id));
  for (const id of ids) {
    const out = path.join(dir, `layout-${id.slice(2)}.png`);
    await page.locator('#' + id).screenshot({ path: out });
    console.log('撮った', path.relative(process.cwd(), out));
  }
  await browser.close();
})();
