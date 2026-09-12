// 曲えらびを横持ちにしたときの置きかたを実ブラウザで確かめる。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/mode/rhythm-landscape-layout-check.js
//
// 2026-09-07・ユーザー報告と提案
//   「縦横固定ボタンを押すと横画面時右側の難易度選択のほうスクロールができなくなる」
//   「横画面の場合、上側タブに空きがあるからその辺を利用できないか？
//     ただし縦画面の場合は空きがないから難しい？」
//
// ★ここは **Tailwind の landscape: に頼らない** ことが肝心。
//   このサンドボックスは外部CDNのTailwindが届かないので、素のCSS(index.html)で
//   出し分けているかどうかを、実際の見え方で確かめられる。
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
  // 実際に見えているか(display だけでなく大きさも見る)
  const shown = (selector) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && el.getBoundingClientRect().width > 0;
  }, selector);
  const styleOf = (selector, prop) => page.evaluate(([s, p]) => {
    const el = document.querySelector(s);
    return el ? getComputedStyle(el)[p] : '';
  }, [selector, prop]);

  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2200);
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2200);
    await dismissOverlays();

    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /モンヒロビート|モンビー/.test(x.innerText || ''));
      b?.click();
    });
    await page.waitForFunction(() => !!document.querySelector('[data-rhythm-demo-home]'), { timeout: 15000 }).catch(() => {});
    await dismissOverlays();
    check('曲えらびを開ける', await page.evaluate(() => !!document.querySelector('[data-rhythm-song-select]')));

    // ---- 出し分けのCSSが効いているか ----
    // 周回していないと帯そのものが無いので、同じ目印のダミーを差し込んで見え方を測る。
    // (1周回すのに数分かかるうえ、ここで見たいのは「どちらが出るか」だけ)
    await page.evaluate(() => {
      const host = document.querySelector('[data-rhythm-demo-home]') || document.body;
      for (const name of ['data-quick-run-progress-header', 'data-quick-run-band-portrait',
        'data-quick-run-start-header', 'data-quick-run-start-portrait']) {
        if (document.querySelector(`[${name}]`)) continue;
        const el = document.createElement('div');
        el.setAttribute(name, '');
        el.setAttribute('data-check-dummy', '');
        el.textContent = 'x';
        host.appendChild(el);
      }
    });
    await page.waitForTimeout(200);
    check('縦持ちはヘッダーの下に出す（ヘッダー側は隠す）',
      (await styleOf('[data-quick-run-progress-header]', 'display')) === 'none'
      && (await styleOf('[data-quick-run-band-portrait]', 'display')) !== 'none',
      `ヘッダー側:${await styleOf('[data-quick-run-progress-header]', 'display')} / 下:${await styleOf('[data-quick-run-band-portrait]', 'display')}`);
    // 周回していないときの「ここから始める」も同じ置き分け(2026-09-07)
    check('縦持ちは「始める」もヘッダーの下に出す',
      (await styleOf('[data-quick-run-start-header]', 'display')) === 'none'
      && (await styleOf('[data-quick-run-start-portrait]', 'display')) !== 'none',
      `ヘッダー側:${await styleOf('[data-quick-run-start-header]', 'display')} / 下:${await styleOf('[data-quick-run-start-portrait]', 'display')}`);

    // ---- 縦横ボタンで横持ちにする ----
    const before = await page.evaluate(() => document.querySelector('[data-mh-view-rotation]')?.getAttribute('data-mh-view-rotation'));
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /縦|横/.test((x.innerText || '').trim()));
      b?.click();
    });
    await page.waitForTimeout(1200);
    const rotated = await page.evaluate(() => document.querySelector('[data-mh-view-rotation]')?.getAttribute('data-mh-view-rotation'));
    check('縦横ボタンで横持ちへ切り替わる', rotated === 'true', `${before} → ${rotated}`);

    // ★右側(選んでいる曲・難易度)が中でスクロールできること
    const detail = await page.evaluate(() => {
      const el = document.querySelector('[data-rhythm-song-detail]');
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        overflowY: style.overflowY,
        minHeight: style.minHeight,
        scrollable: el.scrollHeight > el.clientHeight + 1,
        clientHeight: Math.round(el.clientHeight),
        scrollHeight: Math.round(el.scrollHeight),
      };
    });
    check('横持ちの右側は中でスクロールする作りになっている',
      !!detail && (detail.overflowY === 'auto' || detail.overflowY === 'scroll'), detail ? detail.overflowY : 'なし');
    check('右側が器の高さで止まっている（下が切れっぱなしにならない）',
      !!detail && detail.minHeight === '0px', detail ? `min-height:${detail.minHeight}` : 'なし');
    // 中身が器より高いときは、実際にスクロールできる状態になっているはず
    if (detail && detail.scrollHeight > detail.clientHeight + 1) {
      const moved = await page.evaluate(() => {
        const el = document.querySelector('[data-rhythm-song-detail]');
        const before = el.scrollTop;
        el.scrollTop = before + 80;
        return el.scrollTop > before;
      });
      check('実際に右側を動かせる', moved, `${detail.clientHeight}px の器に ${detail.scrollHeight}px`);
    } else {
      console.log('（右側の中身が器に収まっているのでスクロールは起きない。作りだけ確認）');
    }

    // 横持ちでは、一覧の上ではなくヘッダー側へ出す。
    // ★両方出る・両方消えるのが一番困るので、必ず片方だけであることを見る
    check('横持ちはヘッダーの空きへ入れる（下側は隠す）',
      (await styleOf('[data-quick-run-progress-header]', 'display')) === 'block'
      && (await styleOf('[data-quick-run-band-portrait]', 'display')) === 'none',
      `ヘッダー側:${await styleOf('[data-quick-run-progress-header]', 'display')} / 下:${await styleOf('[data-quick-run-band-portrait]', 'display')}`);
    check('横持ちは「始める」もヘッダーの空きへ入れる',
      (await styleOf('[data-quick-run-start-header]', 'display')) === 'block'
      && (await styleOf('[data-quick-run-start-portrait]', 'display')) === 'none',
      `ヘッダー側:${await styleOf('[data-quick-run-start-header]', 'display')} / 下:${await styleOf('[data-quick-run-start-portrait]', 'display')}`);

    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
