#!/usr/bin/env node
// r1119-165 の止め絵を、今・案A・案B・案C の4枚ずつ1枚に並べる(資料用)。node docs/progress/beat/sky-layer-2026-11-24/compose.js
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../../../..');
const { chromium } = (() => { try { return require(path.join(ROOT, 'tools/node_modules/playwright')); } catch { return require('playwright'); } })();
const LABEL = { D: '案D 面を今の半分 + 地上を3割暗く', E: '案E 面を今の3分の1 + 地上を3割暗く', F: '案F 面を消してふちだけ + 地上を2割5分暗く', now: '今', A: '案A ガラスの層(地上はすりガラスの向こう)', B: '案B 地上を沈める(重なる所の地上を暗く)', C: '案C 描く順だけ(空中をいつも上に)' };
// node compose.js D,E,F で2回目の案(初期設定と全部のせ)を並べる
const SET = (process.argv[2] || 'A,B,C').split(',');
const FILE = (k, s) => path.join(__dirname, `${k === 'now' ? 'now' : 'an-' + k}-${s}.jpg`);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  const sizes = SET[0] === 'A' ? ['yoko', 'tate', 'rot'] : ['yoko', 'tate', 'rot', 'yoko-max', 'tate-max', 'rot-max'];
  for (const s of sizes) { const [cols, w] = s.startsWith('yoko') ? [2, 840] : [4, 380];
    const cells = ['now', ...SET].map(k => `<figure><figcaption>${LABEL[k]}</figcaption><img src="data:image/jpeg;base64,${fs.readFileSync(FILE(k, s)).toString('base64')}"></figure>`).join('');
    await page.setContent(`<style>body{margin:0;background:#0b0820;font:bold 18px sans-serif;color:#f5f3ff}main{display:grid;grid-template-columns:repeat(${cols},${w}px);gap:14px;padding:14px;width:max-content}figure{margin:0}figcaption{padding:4px 2px 8px;line-height:1.3}img{width:${w}px;display:block;border:1px solid #4c1d95}</style><main>${cells}</main>`);
    const el = await page.$('main'); await el.screenshot({ path: path.join(__dirname, `compare${SET[0] === 'A' ? '' : '2'}-${s}.jpg`), type: 'jpeg', quality: 82 });
    console.log(`compare${SET[0] === 'A' ? '' : '2'}-${s}.jpg`);
  }
  await browser.close();
})();
