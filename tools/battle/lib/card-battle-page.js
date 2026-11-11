// カードバトル(クイックモード・いちばん下の難易度)を実際のブラウザで開くところまでをまとめたもの。
// battle-feel-perf.js が使う。道筋は auto-run-browser-check.js と同じ
// (ふだんの入口 → モンヒロバトル → クイック → 難易度 → 勇者モン → 距離 → カードを覚える → バトル)。
const { serve, loadPlaywright } = require('./tactics-battle-page');

// viewport … 画面の大きさ(縦持ち 390x844 / 横持ち 844x390)。storage … 最初から入れておく保存値
async function openCardBattle({ root, port, storage = {}, viewport = { width: 390, height: 844 } } = {}) {
  const playwright = loadPlaywright();
  if (!playwright) return { skip: 'playwright が入っていないので確かめられません' };
  const server = await serve(root, port);
  const errors = [];
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  const base = {
    mh_breeder_name: 'テスト', mh_breeder_icon: 'Mocchi', mh_onboarded: true, mh_tutorial_seen_v1: true,
    mh_battle_tutorial_seen_v1: true, mh_battle_tutorial_guide_shown_v1: true,
    mh_monster_roster: ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi'],
    mh_clears_Beginner: 3, mh_quick_clears_Beginner: 3, ...storage,
  };
  await page.addInitScript((pairs) => { for (const [k, v] of Object.entries(pairs)) localStorage.setItem(k, JSON.stringify(v)); }, base);
  const close = async () => { try { await browser.close(); } catch {} server.close(); };
  const clickMatching = (pattern) => page.evaluate((p) => {
    const b = [...document.querySelectorAll('button')].find((x) => new RegExp(p).test((x.innerText || '').replace(/\s+/g, ' ').trim()));
    if (b) b.click();
    return !!b;
  }, pattern);
  const pointerDown = (sel, text) => page.evaluate(([s, t]) => {
    const b = s ? document.querySelector(s) : [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  }, [sel, text]);
  const dismiss = async () => {
    for (let i = 0; i < 12; i += 1) {
      const closed = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /^(確認|受け取る|閉じる|OK|あとで読む|スキップ|とじる)$/.test((x.innerText || x.getAttribute('aria-label') || '').trim()));
        if (b) { b.click(); return true; }
        return false;
      });
      if (!closed) break;
      await page.waitForTimeout(450);
    }
  };
  try {
    await page.goto(`http://localhost:${port}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 60000 });
    await pointerDown(null, 'TAP TO START');
    await page.waitForTimeout(2200);
    await pointerDown('button[aria-label="トップ画面へ進む"]');
    await page.waitForTimeout(2200);
    await dismiss();
    await page.evaluate(() => document.querySelector('button[aria-label="モンヒロバトル"]')?.click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector('[data-battle-system="systemQuick"]')?.click());
    await page.waitForTimeout(1300);
    await clickMatching('この難易度で挑戦');
    await page.waitForTimeout(1500);
    await page.evaluate(() => { [...document.querySelectorAll('article,button')].find((x) => /スエゾー/.test(x.textContent))?.click(); });
    await page.waitForTimeout(900);
    await clickMatching('勇者モンに選ぶ');
    await page.waitForTimeout(900);
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => /近距離|中距離|零距離|遠距離/.test(x.textContent))?.click(); });
    await page.waitForTimeout(1300);
    await dismiss();
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => /新規習得/.test(x.textContent))?.click(); });
    await page.waitForTimeout(900);
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '習得する')?.click(); });
    await page.waitForTimeout(3500);
    const inBattle = await page.evaluate(() => !!document.querySelector('button[aria-label^="AUTO"]'));
    return { browser, ctx, page, errors, inBattle, close };
  } catch (e) {
    await close();
    throw e;
  }
}

module.exports = { openCardBattle };
