// 縦の端末でモード選び・部屋の「🔄横」を押して、案内の帯を撮る(作業用)
const path = require('path'); const fs = require('fs'); const http = require('http');
const ROOT = '/home/user/monhero'; const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'));
const { quietBootSeed, updateNoticeSeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); }).listen(8977);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const [name, w, h] of [['tate', 390, 844], ['pc', 1280, 800]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.addInitScript(() => { const put = (k, v) => localStorage.setItem(k, JSON.stringify(v)); put('mh_breeder_name', 'けんさ'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_rhythm_tutorial_seen_v1', true); });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
    if (name === 'tate') await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const r = document.documentElement.style; [['top','47px'],['bottom','34px'],['left','0px'],['right','0px']].forEach(([k,v]) => r.setProperty(`--mh-safe-${k}`, v)); }); });
    await page.goto('http://localhost:8977/monster-hero/index.html', { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), undefined, { timeout: 90000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    for (let i = 0; i < 30; i++) {
      if (await page.$('[data-rhythm-mode-select]')) break;
      await page.evaluate(() => { const c = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /^(スキップ|受け取る|閉じる|OK)$/.test((e.innerText || '').trim())); if (c) { c.click(); return; } const x = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /モンヒロビート[\s\S]*音ゲー/.test(e.innerText || '')); if (x) x.click(); });
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(1500);
    const n = await page.$$eval('[data-rhythm-orientation-toggle]', (a) => a.length);
    console.log(name, 'toggle数', n);
    if (n) { await page.evaluate(() => document.querySelector('[data-rhythm-orientation-toggle]').click()); await page.waitForTimeout(2500); }
    await page.screenshot({ path: path.join(OUT, `mode-${name}.png`) });
    const note = await page.$eval('[data-rhythm-orientation-note]', (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }).catch(() => null);
    console.log(name, '案内', JSON.stringify(note));
    await page.close();
  }
  await browser.close(); srv.close();
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
