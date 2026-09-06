// AUTO設定の「モンビー中に回すクイック周回」を実ブラウザで確かめる
// (docs/spec/QUICK_RHYTHM_LINK.md PR5)。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/run/auto-quick-run-settings-browser-check.js
//
// 見ているもの:
//   ① M/B管理 → AUTO設定 に項目が出る
//   ② 勇者モン・距離・難易度をえらんで決定できる
//   ③ 読み込み直しても残っている(既存の mh_auto_settings_v1 へ足した項目が保存されている)
//   ④ 既存の項目(AUTO方針・供モン)を巻き込んで消していない
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };

// addInitScript は読み込み直しのたびに走るので、既に入っている値は上書きしない。
// 上書きすると「保存が残っているか」を確かめられなくなる
const seed = () => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3);
  put('mh_quick_clears_Beginner', 3);
  // 「前から使っている人」の保存値。quickRun は入れていない
  put('mh_auto_settings_v1', { strategy:'offense', allies:[{ rosterEntry:'Golem', slot:0 }, { rosterEntry:null, slot:null }, { rosterEntry:null, slot:null }] });
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
  const openAutoSettings = async () => {
    await page.evaluate(() => document.querySelector('button[aria-label="M/B管理"]')?.click());
    await page.waitForTimeout(1000);
    if (!(await page.evaluate(() => !!document.querySelector('#auto-quick-hero')))) {
      await clickMatching('AUTO設定');
      await page.waitForTimeout(1000);
    }
  };
  const savedQuickRun = () => page.evaluate(() => {
    try { return (JSON.parse(localStorage.getItem('mh_auto_settings_v1')) || {}).quickRun || null; }
    catch (e) { return null; }
  });

  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2200);
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2200);
    await dismissOverlays();

    await openAutoSettings();
    check('AUTO設定にクイック周回の項目が出る',
      await page.evaluate(() => !!document.querySelector('#auto-quick-hero') && !!document.querySelector('#auto-quick-difficulty')));
    check('まだ使えないと出ている',
      await page.evaluate(() => (document.body.innerText || '').includes('まだ使えません')));

    // クイックは通常の9段階だけでなく EXTREME〜ULTIMATE も選べる。
    // Legend までしか出ていなかった(2026-09-06・ユーザー指摘)
    const options = await page.evaluate(() => [...document.querySelectorAll('#auto-quick-difficulty option')]
      .filter(o => o.value).map(o => ({ value:o.value, disabled:o.disabled })));
    const values = options.map(o => o.value);
    check('クイックで遊べる難易度がすべて並ぶ',
      ['Beginner', 'Legend', 'EXTREME', 'NIGHTMARE', 'CHAOS', 'ULTIMATE'].every(id => values.includes(id)),
      values.join(','));
    check('未解放の難易度は一覧には出るが選べない',
      options.some(o => o.value === 'ULTIMATE' && o.disabled) && options.some(o => o.value === 'Beginner' && !o.disabled),
      options.filter(o => ['Beginner', 'ULTIMATE'].includes(o.value)).map(o => `${o.value}:${o.disabled ? '選べない' : '選べる'}`).join(' / '));

    // 勇者モン・距離・難易度をえらぶ
    await page.evaluate(() => {
      const s = document.querySelector('#auto-quick-hero');
      const option = [...s.options].find(o => o.value === 'Suezo') || [...s.options].find(o => o.value);
      s.value = option.value;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    // 配置距離は「零」を押す。0 を未設定と取り違えていないかもここで見える
    await page.evaluate(() => {
      const box = document.querySelector('#auto-quick-hero')?.closest('div');
      const b = box && [...box.querySelectorAll('button')].find(x => (x.innerText || '').trim() === '零');
      b?.click();
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const s = document.querySelector('#auto-quick-difficulty');
      const option = [...s.options].find(o => o.value === 'Beginner');
      s.value = option.value;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    check('3つそろうと使えると出る',
      await page.evaluate(() => (document.body.innerText || '').includes('モンヒロビートから周回を始められます')));

    await clickMatching('^決定$');
    await page.waitForTimeout(1200);
    const saved = await savedQuickRun();
    check('決定で保存される', !!saved && saved.heroRosterEntry === 'Suezo' && saved.distance === 0 && saved.difficulty === 'Beginner',
      JSON.stringify(saved));
    const wholeSaved = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_auto_settings_v1')); } catch (e) { return null; } });
    check('前から入っていたAUTO方針・供モンを消していない',
      !!wholeSaved && wholeSaved.strategy === 'offense' && wholeSaved.allies?.[0]?.rosterEntry === 'Golem' && wholeSaved.allies?.[0]?.slot === 0,
      JSON.stringify({ strategy: wholeSaved?.strategy, ally0: wholeSaved?.allies?.[0] }));

    // 読み込み直しても残っているか(seed で上書きしないよう、ここでは addInitScript を外す)
    await page.evaluate(() => localStorage.setItem('__mh_keep', '1'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2200);
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2200);
    await dismissOverlays();
    await openAutoSettings();
    const shown = await page.evaluate(() => ({
      hero: document.querySelector('#auto-quick-hero')?.value || '',
      difficulty: document.querySelector('#auto-quick-difficulty')?.value || '',
    }));
    check('読み込み直しても設定が残っている', shown.hero === 'Suezo' && shown.difficulty === 'Beginner', JSON.stringify(shown));

    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
