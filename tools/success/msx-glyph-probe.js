#!/usr/bin/env node
// モンサクのボタンの字の「真ん中ずれ」を、DOM の矩形と描いた画素の2方式で測る(2026-11-16 正式化)。
//   ▶ のような字は字幅の中で字形が寄っているので、CSS で中央でも見た目がずれる。直す量(padding-left)を実測で決めるための道具。
//   node tools/success/msx-glyph-probe.js --scene s0        … ストーリー選択(S0)の「次へ ▶」
//   node tools/success/msx-glyph-probe.js --scene birth     … 誕生の「育成を始める ▶」
//   node tools/success/msx-glyph-probe.js --scene s0 --pads 0,4,5    … padding-left の候補を並べて比べる(既定 0,3,4,5,6)
//   node tools/success/msx-glyph-probe.js --scene s0 --sizes base    … 大きさを絞る(既定 base,ip)
// 測り方: DOM = テキスト矩形の union の中心とボタンの中心の差(msx-ui-rules と同じ。ボタンの文字は 3px まで)。
//   画素 = msx-btn-pixel(実際に描いた字の画素の外枠の中心。許容は msx-btn-pixel 側の TOL)。
// 終了コード: 候補のどれか(padding 0 = 現行を含む)が両方式とも合格なら 0、どれも駄目なら 1。
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.GLYPH_PORT) || 19893;
const { chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'));
const { quietBootSeed, updateNoticeSeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));
const { measureBtnPixels } = require('./msx-btn-pixel');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const args = process.argv.slice(2);
const argVal = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const SCENE = argVal('--scene', 's0');
const PADS = (argVal('--pads', '0,3,4,5,6')).split(',').map((x) => x.trim()).filter(Boolean);
const SIZES = (argVal('--sizes', 'base,ip')).split(',').map((x) => x.trim()).filter(Boolean)
  .map((t) => (t === 'ip' ? { tag: 'ip', w: 390, h: 664 } : { tag: 'base', w: 390, h: 844 }));
const SCENES = {
  s0: { selector: '[data-msx-scenario-next]', label: '次へ' },
  birth: { selector: '[data-msx-birth-next]', label: '育成を始める' },
};
if (!SCENES[SCENE]) { console.error(`--scene は ${Object.keys(SCENES).join(' / ')} のどれか`); process.exit(1); }
const SELECTOR = argVal('--selector', SCENES[SCENE].selector);
const LABEL = argVal('--label', SCENES[SCENE].label);
// msx-ui-rules の offBtn と同じ測り方(テキスト矩形の union とボタンの中心の差)。ページの中で動く
const offBtnOf = (b) => {
  const R = b.getBoundingClientRect();
  const rs = []; const walk = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!(n.nodeValue || '').trim()) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); rs.push(...[...rg.getClientRects()].filter((q) => q.width > 0 && q.height > 0));
  }
  if (!rs.length) return null;
  const L = Math.min(...rs.map((q) => q.left)); const Rr = Math.max(...rs.map((q) => q.right)); const T = Math.min(...rs.map((q) => q.top)); const B = Math.max(...rs.map((q) => q.bottom));
  return { dx: (L + Rr) / 2 - (R.left + R.right) / 2, dy: (T + B) / 2 - (R.top + R.bottom) / 2 };
};
const boot = async (page) => {
  await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
  await page.addInitScript(() => { try {
    localStorage.setItem('mh_monsuc_beta_v1', JSON.stringify({ v: 1, seen: { open: 1, firstend: 1, prep: 1, scn: 1 } }));
    localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Undine', 'Kyubi', 'Hare', 'Plant', 'Ghost', 'Snegurochka']));
  } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => typeof MonheroSuccessScreen === 'function' && typeof msxLoad === 'function', undefined, { timeout: 90000 });
  await page.evaluate(() => {
    const el = Object.assign(document.createElement('div'), { id: 'msx-shot' });
    document.body.appendChild(el);
    window.__msxRoot = ReactDOM.createRoot(el);
    window.__msxRoot.render(React.createElement(MonheroSuccessScreen, { onClose() {}, callNameOf: () => 'けんささん', bondLvOf: () => 4, debug: false }));
  });
  await page.waitForSelector('[data-msx-view="home"]', { timeout: 30000 });
};
const gotoScene = async (page) => {
  const click = (reSrc) => page.evaluate((src) => { const re = new RegExp(src); const b = [...document.querySelectorAll('.msx button')].find((x) => re.test(x.innerText || '') && !x.disabled); if (b) b.click(); return !!b; }, reSrc);
  if (SCENE === 's0') {
    await click('新しく育成を(?:始|はじ)める');
    await page.waitForSelector('[data-msx-scenario-next]', { timeout: 15000 });
  } else { // birth: new → next×6 → begin → スキップで「育成を始める」を出す
    await click('新しく育成を(?:始|はじ)める'); await page.waitForTimeout(400);
    for (let i = 0; i < 6; i++) { await page.evaluate(() => { const b = [...document.querySelectorAll('.msx button')].find((x) => /▶$/.test((x.innerText || '').trim()) && !x.disabled); if (b) b.click(); }); await page.waitForTimeout(300); }
    await click('育成を(?:始|はじ)める'); await page.waitForTimeout(600);
    await page.waitForSelector('[data-msx-birth-next]', { timeout: 15000 });
    await page.evaluate(() => { const k = document.querySelector('[data-msx-birth-skip]'); if (k) k.click(); });
    await page.waitForFunction((sel) => { const b = document.querySelector(sel); return b && !b.disabled; }, SELECTOR, { timeout: 15000 }).catch(() => {});
  }
  await page.waitForTimeout(500);
};
(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  let anyPass = false;
  for (const sz of SIZES) {
    const page = await browser.newPage({ viewport: { width: sz.w, height: sz.h } });
    await boot(page);
    await gotoScene(page);
    for (const pad of PADS) {
      await page.evaluate(({ sel, p }) => { const b = document.querySelector(sel); if (b) b.style.paddingLeft = p ? `${p}px` : ''; }, { sel: SELECTOR, p: pad });
      await page.waitForTimeout(250);
      const domRes = await page.evaluate(({ sel, src }) => { const b = document.querySelector(sel); return b ? eval(`(${src})`)(b) : null; }, { sel: SELECTOR, src: offBtnOf.toString() });
      const bad = await measureBtnPixels(page);
      const mine = bad.filter((x) => x.includes(LABEL));
      const domOk = domRes && Math.abs(domRes.dx) < 3 && Math.abs(domRes.dy) < 3;
      const pxOk = mine.length === 0;
      if (domOk && pxOk) anyPass = true;
      console.log(`${sz.tag} padding-left=${pad || '0'}: DOM dx=${domRes ? domRes.dx.toFixed(1) : '?'} dy=${domRes ? domRes.dy.toFixed(1) : '?'}(${domOk ? 'OK' : 'NG'}) / 画素 ${pxOk ? 'OK' : `NG ${mine.join(' | ')}`}`);
    }
    await page.close();
  }
  await browser.close(); server.close();
  console.log(anyPass ? 'OK: 両方式とも合格する候補がある' : 'NG: 両方式とも合格する候補が無い');
  process.exit(anyPass ? 0 : 1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
