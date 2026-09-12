// 曲えらびの一覧を、別の画面から戻ったときに「見ていた場所」から続けられるかを見る。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/mode/rhythm-song-list-scroll-check.js
//
// 2026-09-07・ユーザー報告
//   「曲を選んでいて全国ランキング等を押すと選択されたままは維持されるけど
//     スクロールが初期位置に戻るからどこまで確認してたかわかりづらくなる」
//
// 一覧は「同じ並びを3つ重ねて輪にする」作りで、開くたびに"まん中の先頭"へ立たせる。
// そのため画面を離れて戻ると必ず先頭に見えていた。
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
  put('mh_rhythm_tutorial_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.addInitScript(seed);

  const pointerDown = (find) => page.evaluate((f) => {
    const b = f.aria ? document.querySelector(`button[aria-label="${f.aria}"]`)
      : [...document.querySelectorAll('button')].find((x) => x.textContent.includes(f.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, find);
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
  const listTop = () => page.evaluate(() => {
    const el = document.querySelector('[data-rhythm-song-list]');
    return el ? Math.round(el.scrollTop) : -1;
  });
  const openRhythm = async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /モンヒロビート|モンビー/.test(x.innerText || ''));
      b?.click();
    });
    await page.waitForFunction(() => !!document.querySelector('[data-rhythm-demo-home]'), { timeout: 15000 }).catch(() => {});
    await dismissOverlays();
  };

  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2200);
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2200);
    await dismissOverlays();

    await openRhythm();
    check('曲えらびを開ける', (await listTop()) >= 0);
    await page.waitForTimeout(800);

    // このサンドボックスは外部CDNのTailwindが届かず、一覧に高さが付かない
    // (scrollHeight <= clientHeight でスクロールできない)。
    // 見たいのは「戻ったときに位置が残るか」なので、高さだけこちらで与えて確かめる
    const giveHeight = () => page.evaluate(() => {
      const el = document.querySelector('[data-rhythm-song-list]');
      if (!el) return false;
      el.style.height = '300px';
      el.style.overflowY = 'auto';
      return true;
    });
    await giveHeight();
    await page.waitForTimeout(300);
    // 下のほうまで送る
    await page.evaluate(() => {
      const el = document.querySelector('[data-rhythm-song-list]');
      if (!el) return -1;
      el.scrollTop = el.scrollTop + 260;
      el.dispatchEvent(new Event('scroll', { bubbles: true }));
      return Math.round(el.scrollTop);
    });
    // 輪の寄せ直し(140ms後)が走りきるのを待つ
    await page.waitForTimeout(900);
    const scrolled = await listTop();
    check('一覧を下へ送れる', scrolled > 0, `${scrolled}px`);

    // 遊びかた(別の画面)へ移って戻る。全国ランキングも同じく画面を離れる操作
    await page.evaluate(() => document.querySelector('[data-rhythm-demo-help]')?.click());
    await page.waitForTimeout(1200);
    const leftHome = await page.evaluate(() => !document.querySelector('[data-rhythm-demo-home]'));
    check('別の画面へ移れる', leftHome);
    await page.evaluate(() => { document.querySelector('[data-rhythm-demo-help-back]')?.click(); });
    await page.waitForFunction(() => !!document.querySelector('[data-rhythm-demo-home]'), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);
    check('曲えらびへ戻れている', await page.evaluate(() => !!document.querySelector('[data-rhythm-song-list]')));
    // 戻ったあとも高さを与えないと、位置を測れない(上と同じ理由)
    await giveHeight();
    await page.waitForTimeout(500);
    const after = await listTop();
    // ぴったり同じでなくてよい。先頭へ戻っていない＝見ていたあたりに居ればよい
    check('戻ってきても見ていた場所から続けられる', Math.abs(after - scrolled) < 60,
      `${scrolled}px → ${after}px`);

    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
