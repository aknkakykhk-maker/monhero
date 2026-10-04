#!/usr/bin/env node
// ジャックの更新履歴が、開始の時刻を過ぎたあとに読み込んだ画面で出ること(開始前は出ないこと)を実ブラウザで確かめる。
//
//   node tools/changelog/raid-jack-visible-check.js
//
// 2026-10-05・ユーザー指摘「もう公開してるのに更新情報に出てない」。
// 公開フラグ RELEASE_FLAGS.raidJack の判定が、読み込み時に まだ無い RAID_JACK_EVENT を触って例外になり、
// いつも偽を返していた(更新履歴は読み込み時に1回だけ判定するので、開始を過ぎても出なかった)。
// 時計を開始の前後へ動かして、読み込み直しのたびに正しく出入りするかを見る。
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..'), PORT = 8997;
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const probe = async (iso) => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.clock.install({ time: new Date(iso) });
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 40000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.waitForTimeout(800);
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /お知らせ|更新情報|更新履歴|✦/.test(x.innerText || '')); b && b.click(); });
      await page.waitForSelector('[data-changelog-list] article', { timeout: 10000 });
      await page.evaluate(() => { document.querySelectorAll('[data-changelog-list] button').forEach((b) => { if (/詳細/.test(b.innerText)) b.click(); }); });
      await page.waitForTimeout(500);
      const has = await page.evaluate(() => /カボチャの大王ジャックがあらわれました/.test(document.querySelector('[data-changelog-list]').innerText));
      await page.close();
      return has;
    };
    ok('開始の前(10/5 3:59)に読み込むと、ジャックの更新履歴は出ない', (await probe('2026-10-04T18:59:00Z')) === false);
    ok('開始のあと(10/5 4:01)に読み込むと、ジャックの更新履歴が出る', (await probe('2026-10-04T19:01:00Z')) === true);
  } finally { if (browser) await browser.close(); server.close(); }
  console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
