// アプリが裏に回って止まった∞周回が、戻ってきたときに自動で続くかを実ブラウザで確かめる
// (2026-09-11・ユーザー指示「オート周回中、アプリが裏に回ると止まるようにしてるけど
//  アプリに戻ったら自動で開始するようにしてほしい / ただし負けたときは自動では開始しない /
//  モンビー中もおなじ」)。
//
//   python3 -m http.server 8899 を起動した状態で
//   node tools/run/auto-resume-on-visible-check.js
//
// 見るのは3つ。
//   ① バトル画面で裏に回す → 止まる → 戻る → 自動で続く
//   ② モンヒロビートを開いたままでも同じ(帯が「止まりました」から周回の表示へ戻る)
//   ③ 自分でAUTO∞を切ったあとは、裏に回して戻っても始まらない
//      (「負けたときは自動で始めない」と同じ経路＝止まった理由が 'hidden' 以外なら続けない。
//       負けるまで遊ばせるのは時間がかかるので、同じ分かれ道をこちらで踏む)
//
// ★裏に回ったことは visibilityState でしか見ていないので、getter を差し替えて
//   visibilitychange を飛ばせば、実際のアプリ切り替えと同じ道を通る。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
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
  put('mh_quick_rhythm_intro_seen_v1', true);
  put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3);
  put('mh_quick_clears_Beginner', 3);
};

// 裏に回す・戻す。visibilityState を差し替えてから visibilitychange を飛ばす
const setHidden = (page, hidden) => page.evaluate((h) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.route('**cdn.tailwindcss.com**', (r) => r.abort()).catch(() => {});
  await page.addInitScript(seed);

  const clickMatching = (pattern) => page.evaluate((p) => {
    const b = [...document.querySelectorAll('button')].find((x) => new RegExp(p).test((x.innerText || '').replace(/\s+/g, ' ').trim()));
    if (b) b.click();
    return !!b;
  }, pattern);
  const clickExact = (label) => page.evaluate((wanted) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === wanted);
    if (b) b.click();
    return !!b;
  }, label);
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
  const autoLabel = () => page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.getAttribute('aria-label'));
  const bandText = () => page.evaluate(() => {
    const el = document.querySelector('[data-quick-run-progress],[data-quick-run-progress-header]');
    return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '';
  });

  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await page.evaluate(() => {
      [...document.querySelectorAll('button')].find((x) => x.textContent.includes('TAP TO START'))
        ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    await page.waitForTimeout(2200);
    await page.evaluate(() => document.querySelector('button[aria-label="トップ画面へ進む"]')
      ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(2200);
    await dismissOverlays();

    // ---- クイックで1周目を組み、∞周回にする ----
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

    // ---- ① バトル画面で 裏に回す → 戻る ----
    await setHidden(page, true);
    await page.waitForTimeout(1200);
    check('①裏に回すと∞周回が止まる', (await autoLabel()) !== 'AUTO ∞', await autoLabel());
    await setHidden(page, false);
    await page.waitForTimeout(1500);
    check('①戻ると自動で∞周回が続く', (await autoLabel()) === 'AUTO ∞', await autoLabel());

    // ---- ② モンヒロビートを開いたまま 裏に回す → 戻る ----
    await page.evaluate(() => document.querySelector('[data-quick-to-rhythm]')?.click());
    await page.waitForFunction(() => !!document.querySelector('[data-rhythm-demo-home]'), { timeout: 15000 }).catch(() => {});
    await dismissOverlays();
    check('②モンヒロビートを開けている', await page.evaluate(() => !!document.querySelector('[data-rhythm-demo-home]')));
    await setHidden(page, true);
    await page.waitForTimeout(1200);
    const stoppedBand = await bandText();
    check('②モンビー中に裏へ回すと帯が「止まりました」になる', /止まりました|終わりました/.test(stoppedBand), stoppedBand);
    await setHidden(page, false);
    await page.waitForTimeout(1500);
    const resumedBand = await bandText();
    check('②モンビー中でも戻ると自動で続く', /周目/.test(resumedBand) && !/止まりました|終わりました/.test(resumedBand), resumedBand);

    // ---- ③ 自分でAUTO∞を切ったあとは、戻っても始まらない ----
    //      (負けたときに始めないのと同じ分かれ道＝止まった理由が 'hidden' 以外)
    await page.evaluate(() => document.querySelector('[data-rhythm-back]')?.click());
    await page.waitForTimeout(2000);
    for (let i = 0; i < 4 && (await autoLabel()) === 'AUTO ∞'; i++) {
      await page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click());
      await page.waitForTimeout(900);
    }
    check('③自分でAUTO∞を切れる', (await autoLabel()) !== 'AUTO ∞', await autoLabel());
    await setHidden(page, true);
    await page.waitForTimeout(900);
    await setHidden(page, false);
    await page.waitForTimeout(1500);
    check('③自分で切ったあとは、戻っても勝手に始まらない', (await autoLabel()) !== 'AUTO ∞', await autoLabel());

    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
