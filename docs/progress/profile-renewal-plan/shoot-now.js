// 今のプロフィールとイベント回想を撮る(案の資料用・見るだけ)。
// node docs/progress/profile-renewal-plan/shoot-now.js  → now/ に縦(390×844)・横(844×390)の止め絵
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
require(path.join(ROOT, 'tools/shared-serve'));
const { chromium } = require('playwright');
const OUT = path.join(__dirname, 'now');
const PAGE_URL = 'http://127.0.0.1:8899/monster-hero/';
const seed = () => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
};
async function shoot(size, tag) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
  await page.addInitScript(seed);
  await page.addInitScript(require(path.join(ROOT, 'tools/boot/quiet-boot-seed')).quietBootSeed());
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 503, body: '{}' }));
  await page.route('**/rest/v1/**', r => r.request().method() !== 'GET' ? r.fulfill({ status: 201, body: '' }) : r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  const down = (f) => page.evaluate((s) => {
    const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  }, f);
  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
  await down({ text: 'TAP TO START' }); await page.waitForTimeout(2500);
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
  await down({ aria: 'トップ画面へ進む' }); await page.waitForTimeout(3000);
  for (let i = 0; i < 8; i++) {
    const c = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^(確認|受け取る|閉じる|あとで|スキップ|次へ|OK)$/.test(x.textContent.trim())); if (b) b.click(); return !!b; });
    await page.waitForTimeout(600); if (!c) break;
  }
  await page.evaluate(() => document.querySelector('button[aria-label="プロフィールを開く"]')?.click());
  await page.waitForTimeout(1500);
  // 画面の中のスクロールを順に送って何枚か撮る
  for (let n = 0; n < 6; n++) {
    await page.screenshot({ path: path.join(OUT, `profile-${tag}-${n + 1}.png`) });
    const more = await page.evaluate((h) => {
      const els = [...document.querySelectorAll('[data-mh-screen] *')].filter(e => e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY));
      const el = els[0]; if (!el) return false;
      const before = el.scrollTop; el.scrollTop += h * 0.8; return el.scrollTop > before;
    }, size.height);
    await page.waitForTimeout(400);
    if (!more) break;
  }
  const opened = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('イベント回想')); if (b) { b.click(); return true; } return false; });
  if (opened) {
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `replay-${tag}-groups.png`) });
    await page.evaluate(() => document.querySelector('[data-event-replay-group="update"]')?.click());
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `replay-${tag}-update.png`) });
  }
  await browser.close();
  console.log(tag, 'replay', opened);
}
(async () => {
  await shoot({ width: 390, height: 844 }, 'tate');
  await shoot({ width: 844, height: 390 }, 'yoko');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
