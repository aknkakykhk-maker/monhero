// 見本の HTML を止め絵にする(縦スマホ 390×844・2倍)。 node docs/progress/home-review-2026-11/mock/shoot-mock.js
const path = require('path');
let pw; try { pw = require(path.resolve('tools/node_modules/playwright')); } catch (e) { pw = require('playwright'); }
(async () => {
  const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  for (const n of ['plan-a', 'plan-b', 'plan-c']) {
    await p.goto('file://' + path.resolve(__dirname, `${n}.html`)); await p.waitForTimeout(600);
    await p.screenshot({ path: path.resolve(__dirname, '..', `${n}.jpg`), type: 'jpeg', quality: 80 });
  }
  await b.close();
})();
// 比べ絵(今と3案を横に並べる)
(async () => {
  await new Promise((r) => setTimeout(r, 4000));
  const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1640, height: 904 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve(__dirname, 'compare.html')); await p.waitForTimeout(800);
  await p.screenshot({ path: path.resolve(__dirname, '..', 'compare-phone-tate.jpg'), type: 'jpeg', quality: 80 });
  await b.close();
})();
