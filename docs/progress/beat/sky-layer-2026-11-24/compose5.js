#!/usr/bin/env node
// r1119-165 本番の確かめ: 2D と WebGL の「今」「案J の見本」「直したあと」を、全体と空中の判定線の所の拡大で並べる(資料用)
//   node docs/progress/beat/sky-layer-2026-11-24/compose5.js   → check-{yoko,tate,rot}.jpg
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../../../..');
const { chromium } = (() => { try { return require(path.join(ROOT, 'tools/node_modules/playwright')); } catch { return require('playwright'); } })();
const COLS = [['now3', '2D 今'], ['an-J', '案J の見本(2D)'], ['real-2d', '2D 直したあと'], ['before-gl', 'WebGL 今'], ['real-gl', 'WebGL 直したあと']];
const CROP = { yoko: [450, 160, 600, 300], tate: [100, 880, 400, 400], rot: [280, 440, 400, 400] };
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  for (const s of ['yoko', 'tate', 'rot']) {
    const [cx, cy, cw, ch] = CROP[s], fw = s === 'yoko' ? 380 : 220, zw = 330, W = s === 'yoko' ? 1688 : 780;
    const cells = COLS.map(([k, label]) => { const src = `data:image/jpeg;base64,${fs.readFileSync(path.join(__dirname, `${k}-${s}.jpg`)).toString('base64')}`;
      return `<figure><figcaption>${label}</figcaption><img class="full" src="${src}"><div class="zoom" style="width:${zw}px;height:${zw * ch / cw}px"><img src="${src}" style="position:absolute;left:${-cx * zw / cw}px;top:${-cy * zw / cw}px;width:${W * zw / cw}px"></div></figure>`; }).join('');
    await page.setContent(`<style>body{margin:0;background:#0b0820;font:bold 15px sans-serif;color:#f5f3ff}main{display:grid;grid-template-columns:repeat(5,${Math.max(fw, zw)}px);gap:14px;padding:14px;width:max-content}figure{margin:0}figcaption{padding:4px 2px 8px}.full{width:${fw}px;display:block;border:1px solid #4c1d95}.zoom{position:relative;overflow:hidden;margin-top:10px;border:2px solid #f0abfc}h1{font-size:17px;margin:14px 14px 0}</style><h1>Rebellion HELL 3:44 地上の HOLD が空中の判定線を通る所(${{ yoko: '横', tate: '縦', rot: '🔄横' }[s]})・下は拡大。WebGL はソフトの GPU で1コマが遅く、止まる時刻が少し違う</h1><main>${cells}</main>`);
    await page.screenshot({ path: path.join(__dirname, `check-${s}.jpg`), type: 'jpeg', quality: 82, fullPage: true });
    console.log(`check-${s}.jpg`);
  }
  await browser.close();
})();
