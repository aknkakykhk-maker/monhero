// モンヒロビートを開いたまま、クイック∞周回が**次の周へ入る**ことを確かめる
// (docs/spec/QUICK_RHYTHM_LINK.md PR6の続き)。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/mode/rhythm-run-loop-check.js
//
// 2026-09-07・ユーザー報告「周回が1周目が終わったあと2周目に入らない」。
// 原因は、次の周へ入る条件が championPresentationComplete(CHAMPION画面の報酬演出が
// 終わったときに立つ)を待っていたこと。モンヒロビートを開いていると画面を描かないので、
// 演出が動かず永久に立たなかった。
//
// ここは1周ぶん(数分)待つので、ほかの検査より時間がかかる。
// それでも「周回が続くか」は連携の土台なので、実際に通しで見る。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
// 1周(10WAVE)を待つ時間。×4速のBeginnerなら30秒ほどで1周する。
// 直っていれば2周目に入った時点で終わるので、この上限まで待つのは壊れているときだけ
const LOOP_TIMEOUT_MS = 3 * 60 * 1000;
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };

const seed = () => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3);
  put('mh_quick_clears_Beginner', 3);
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.route('**cdn.tailwindcss.com**', (r) => r.abort()).catch(() => {});
  await page.addInitScript(seed);

  const pointerDown = (find) => page.evaluate((f) => {
    const b = f.aria ? document.querySelector(`button[aria-label="${f.aria}"]`)
      : [...document.querySelectorAll('button')].find((x) => x.textContent.includes(f.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, find);
  const clickExact = (label) => page.evaluate((wanted) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === wanted);
    if (b) b.click();
    return !!b;
  }, label);
  const clickMatching = (pattern) => page.evaluate((p) => {
    const b = [...document.querySelectorAll('button')].find((x) => new RegExp(p).test((x.innerText || '').replace(/\s+/g, ' ').trim()));
    if (b) b.click();
    return !!b;
  }, pattern);
  const dismissOverlays = async () => {
    for (let i = 0; i < 12; i++) {
      const closed = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /^(確認|受け取る|閉じる|とじる|OK)$/.test((x.innerText || '').trim()));
        if (b) { b.click(); return true; }
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) { (dialog.querySelector('button') || dialog).click(); return true; }
        return false;
      });
      if (!closed) break;
      await page.waitForTimeout(400);
    }
  };
  const bandText = () => page.evaluate(() => {
    const el = document.querySelector('[data-quick-run-progress]');
    return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '';
  });
  const autoLabel = () => page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.getAttribute('aria-label'));

  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2200);
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2200);
    await dismissOverlays();

    await page.evaluate(() => document.querySelector('button[aria-label="バトル"]')?.click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const card = [...document.querySelectorAll('article')].find((a) => a.textContent.includes('クイックモード'));
      const b = card && [...card.querySelectorAll('button')].find((x) => /難易度を選ぶ/.test(x.textContent));
      b?.click();
    });
    await page.waitForTimeout(1300);
    await clickMatching('この難易度で挑戦');
    await page.waitForTimeout(1500);
    await page.evaluate(() => { [...document.querySelectorAll('article,button')].find((x) => /スエゾー/.test(x.textContent))?.click(); });
    await page.waitForTimeout(900);
    await clickMatching('勇者モンに選ぶ');
    await page.waitForTimeout(900);
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => /近距離|中距離|零距離|遠距離/.test(x.textContent))?.click(); });
    await page.waitForTimeout(1300);
    await dismissOverlays();
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => /新規習得/.test(x.textContent))?.click(); });
    await page.waitForTimeout(900);
    await clickExact('習得する');
    await page.waitForTimeout(1800);
    await page.waitForFunction(() => !!document.querySelector('button[aria-label^="AUTO"]'), { timeout: 25000 }).catch(() => {});
    for (let i = 0; i < 3 && (await autoLabel()) !== 'AUTO ∞'; i++) {
      await page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click());
      await page.waitForTimeout(900);
    }
    check('クイックで∞周回を始められる', (await autoLabel()) === 'AUTO ∞', await autoLabel());

    // モンヒロビートへ移り、そのまま1周ぶん待つ
    await page.evaluate(() => document.querySelector('[data-quick-to-rhythm]')?.click());
    await page.waitForFunction(() => !!document.querySelector('[data-rhythm-demo-home]'), { timeout: 15000 }).catch(() => {});
    await dismissOverlays();
    check('モンヒロビートへ移れる', await page.evaluate(() => !!document.querySelector('[data-rhythm-demo-home]')));

    // 帯の移り変わりを1秒ごとに記録する。「2周目に入らない」の実際の姿を見るため
    const startedAt = Date.now();
    const trail = [];
    let reached2 = false;
    while (Date.now() - startedAt < LOOP_TIMEOUT_MS) {
      const text = await bandText();
      const last = trail[trail.length - 1];
      if (!last || last.text !== text) trail.push({ at: Math.round((Date.now() - startedAt) / 1000), text });
      if (/2周目/.test(text)) { reached2 = true; break; }
      await page.waitForTimeout(1000);
    }
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    console.log('--- 帯の移り変わり ---');
    for (const t of trail) console.log(`  ${t.at}秒: ${t.text}`);
    check('モンヒロビートを開いたまま2周目へ入る', reached2, `${elapsed}秒で「${await bandText()}」`);
    check('モンヒロビートにいるあいだ画面が飛ばされない',
      await page.evaluate(() => !!document.querySelector('[data-rhythm-demo-home]')));

    // 2周目に入った状態でバトルへ戻り、∞周回が切れていないことを見る
    await page.evaluate(() => document.querySelector('[data-rhythm-back]')?.click());
    await page.waitForTimeout(2500);
    check('バトルへ戻っても∞周回が切れていない', (await autoLabel()) === 'AUTO ∞', await autoLabel());

    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
