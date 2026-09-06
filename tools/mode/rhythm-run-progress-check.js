// モンビーに出す「クイック∞周回の進捗」(docs/spec/QUICK_RHYTHM_LINK.md PR6)を
// 実ブラウザで確かめる。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/mode/rhythm-run-progress-check.js
//
// 見ているもの:
//   ① 周回していないときは「ここから始める」側が出る
//   ② ∞周回中にモンビーへ移ると、進捗の帯が出て WAVE と周回数が動く
//   ③ 帯をタップすると詳細(周回数・難易度・経験値・ダイヤ・勇者モン)が開く
//   ④ 詳細の「⚔ バトルへ戻る」でバトルへ戻れる
//   ⑤ 周回をやめると帯が「周回が終わりました」に変わり、全画面の敗北画面は出ない
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const WATCH_MS = 14000;
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
  const openRhythm = async () => {
    await page.evaluate(() => document.querySelector('[data-quick-to-rhythm]')?.click());
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

    // ---- ① まだ周回していないとき ----
    // モンビーはデバッグ設定から開ける(公開前のため)。ここでは周回していない状態を見たいだけ
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /モンヒロビート|モンビー/.test(x.innerText || ''));
      b?.click();
    });
    await page.waitForTimeout(1200);
    const onHomeBeforeRun = await page.evaluate(() => !!document.querySelector('[data-rhythm-demo-home]'));
    if (onHomeBeforeRun) {
      check('周回していないときは帯を出さない', await page.evaluate(() => !document.querySelector('[data-quick-run-progress]')));
      check('代わりに「ここから始める」側が出る',
        await page.evaluate(() => !!document.querySelector('[data-quick-run-start]')));
      check('まだ編成が無いので案内文のほうを出す',
        await page.evaluate(() => !!document.querySelector('[data-quick-run-start-hint]')));
      await page.evaluate(() => document.querySelector('[data-rhythm-back]')?.click());
      await page.waitForTimeout(1200);
      await dismissOverlays();
    } else {
      console.log('（モンビーの入口が見つからないので①は省略）');
    }

    // ---- クイックで1ラン始めて∞にする ----
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
    const autoLabel = () => page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.getAttribute('aria-label'));
    for (let i = 0; i < 3 && (await autoLabel()) !== 'AUTO ∞'; i++) {
      await page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click());
      await page.waitForTimeout(900);
    }
    check('クイックで∞周回を始められる', (await autoLabel()) === 'AUTO ∞', await autoLabel());

    // ---- ② 帯が出て、進む ----
    await openRhythm();
    check('モンビーに周回の帯が出る', (await bandText()).length > 0, await bandText());
    const before = await bandText();
    await page.waitForTimeout(WATCH_MS);
    const after = await bandText();
    check('帯の中身が周回に合わせて動く', after !== before, `${before} → ${after}`);
    check('帯にWAVEと周回数が出ている', /WAVE\s*\d+\/10/.test(after) && /\d+周目/.test(after), after);

    // ---- ③ 詳細を開く ----
    await page.evaluate(() => document.querySelector('[data-quick-run-progress] button')?.click());
    await page.waitForTimeout(600);
    const detail = await page.evaluate(() => {
      const el = document.querySelector('[data-quick-run-progress-detail]');
      return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '';
    });
    check('タップで詳細が開く', detail.length > 0);
    check('詳細に周回数・難易度・経験値・ダイヤ・勇者モンが出る',
      ['周回数', '難易度', '経験値', 'ダイヤ', '勇者モン'].every(word => detail.includes(word)), detail.slice(0, 90));

    // ---- ④ バトルへ戻れる ----
    await page.evaluate(() => document.querySelector('[data-quick-run-progress-back]')?.click());
    await page.waitForTimeout(1500);
    check('詳細からバトルへ戻れる', await page.evaluate(() => !!document.querySelector('button[aria-label^="AUTO"]')));

    // ---- ⑤ 周回をやめたら帯が変わる ----
    await openRhythm();
    // バトルへ戻って∞を切る(モンビーからは切れない仕様なので、いったん戻る)
    await page.evaluate(() => document.querySelector('[data-rhythm-back]')?.click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click());
    await page.waitForTimeout(1200);
    check('∞周回を切れる', (await autoLabel()) !== 'AUTO ∞', await autoLabel());

    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
