// オート強化を実ブラウザで開いて、画面が出ること・保存されること・裏で本当に振られることを確かめる。
//
//   python3 tools/serve.py でリポジトリのルートを配信した状態で
//   node tools/masu/auto-enhance-browser-check.js
//
// 【なぜ道具にするか】
// オート強化は「強化ポイントが増えたら自動で振る」を1本の useEffect に集めている。
// ここが動いていなくても画面は何ごともなく出るし、JSの実行時エラーも出ないので
// render-error-check.js では拾えない。逆に条件を間違えると、振る先が無いのに
// 何度も保存し直す(繰り返し)という形で現れる。どちらも実際に開かないと分からないため、
// 「起動しただけで設定どおりに振られ、そのあと落ち着くか」をブラウザで測る。
// 画面のレイヤーが詳細モーダルと重なっていないかも、強化・超越強化と同じやり方で見る。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const seed = () => {
  localStorage.setItem('mh_breeder_name', JSON.stringify('テスト'));
  localStorage.setItem('mh_breeder_icon', JSON.stringify('Mocchi'));
  localStorage.setItem('mh_onboarded', JSON.stringify(true));
  localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
  localStorage.setItem('mh_masu_migrated', JSON.stringify(true));
  localStorage.setItem('mh_gold', JSON.stringify(99999));
  // 1体目 … オート強化ON。10P持たせ、ちから上限3P → ライフ上限2P の順で振られるはず(合計5P)
  // 2体目 … OFF。10P持ったまま1Pも動かないこと
  localStorage.setItem('mh_masu_mons', JSON.stringify([
    { id: 'auto1', baseId: 'Mocchi', name: 'オートON', bondXp: 0, rebirthCount: 0, levelCap: 30,
      distAptPoints: 10, statPoints: { hp: 0, atk: 0, def: 0, guts: 0 }, distAptBoosts: [0, 0, 0, 0],
      autoEnhance: { enabled: true, order: ['atk', 'hp', 'def', 'guts', 'apt0', 'apt1', 'apt2', 'apt3'],
        statLimits: { hp: 2, atk: 3, def: 0, guts: 0 }, aptLimits: [null, null, null, null] } },
    { id: 'auto2', baseId: 'Mocchi', name: 'オートOFF', bondXp: 0, rebirthCount: 0, levelCap: 30,
      distAptPoints: 10, statPoints: { hp: 0, atk: 0, def: 0, guts: 0 }, distAptBoosts: [0, 0, 0, 0] },
  ]));
};

// 画面をほぼ覆う「不透明な」レイヤーを数える(masu-enhance-layer-check.js と同じ測り方)
const fullScreenLayers = () => [...document.querySelectorAll('body *')].filter((el) => {
  const cs = getComputedStyle(el);
  if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
  if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.5) return false;
  const alpha = (cs.backgroundColor.match(/rgba?\([^)]*?,\s*([\d.]+)\)$/) || [, '1'])[1];
  if (Number(alpha) < 0.5) return false;
  const r = el.getBoundingClientRect();
  return r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9;
}).map((el) => `${el.getAttribute('data-auto-enhance') ? 'オート強化' : (el.className || '').toString().slice(0, 24)}@z${getComputedStyle(el).zIndex}`);

const masuOf = (id) => (JSON.parse(localStorage.getItem('mh_masu_mons')) || []).find((m) => m.id === id);

(async () => {
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(seed);
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });

    const pointerDown = (sel) => page.evaluate((s) => {
      const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`)
        : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
      if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return !!b;
    }, sel);
    const clickText = (re) => page.evaluate((p) => {
      const b = [...document.querySelectorAll('button')].find(x => new RegExp(p).test(x.textContent));
      if (b) b.click();
      return !!b;
    }, re);
    const clickAria = (a) => page.evaluate((x) => {
      const b = document.querySelector(`button[aria-label="${x}"]`);
      if (b) b.click();
      return !!b;
    }, a);
    const clickAny = (t) => page.evaluate((x) => {
      const e = [...document.querySelectorAll('button,article,[role=button]')].find(y => y.textContent.includes(x));
      if (e) e.click();
      return !!e;
    }, t);

    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2500);
    for (let i = 0; i < 30; i++) {
      const closed = await page.evaluate(() => {
        const overlay = [...document.querySelectorAll('body *')].filter((el) => {
          const cs = getComputedStyle(el);
          return cs.position === 'fixed' && Number(cs.zIndex || 0) >= 30000 && el.getBoundingClientRect().height > innerHeight * 0.3;
        }).pop();
        if (!overlay) return false;
        const buttons = [...overlay.querySelectorAll('button')];
        const b = buttons.find(x => /閉じる|とじる|つぎへ|次へ|確認|わかった|OK|はい|あとで|スキップ/.test(x.textContent))
          || buttons.find(x => x.querySelector('svg')) || buttons[buttons.length - 1];
        if (b) b.click();
        return !!b;
      });
      await page.waitForTimeout(450);
      if (!closed) break;
    }
    for (let i = 0; i < 5; i++) {
      if (await page.evaluate(() => !!document.querySelector('button[aria-label="M/B管理"]'))) break;
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.querySelector('svg') && /p-3/.test(x.className)); b && b.click(); });
      await page.waitForTimeout(800);
    }

    // ---- 起動しただけで、設定どおりに振られているか ----
    const after = await page.evaluate(masuOf, 'auto1');
    check('ONの個体は起動しただけで設定どおりに振られる',
      after.statPoints.atk === 9 && after.statPoints.hp === 20 && after.distAptPoints === 5,
      `ちから+${after.statPoints.atk} ライフ+${after.statPoints.hp} 残り${after.distAptPoints}P`);
    check('優先順位のとおり、ちからが先に上限まで入る', after.statPoints.atk === 3 * 3);
    check('上限を超えて振らない', after.statPoints.hp === 2 * 10 && after.statPoints.def === 0 && after.statPoints.guts === 0);
    const off = await page.evaluate(masuOf, 'auto2');
    check('OFFの個体は1Pも動かない', off.distAptPoints === 10 && off.statPoints.atk === 0);

    // ---- 振り終わったあと、繰り返し保存し続けていないか ----
    const before = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('mh_masu_mons'))));
    await page.waitForTimeout(2500);
    const still = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('mh_masu_mons'))));
    check('上限まで振ったら落ち着く(繰り返しにならない)', before === still);

    // ---- 画面を開けるか ----
    check('HOMEまで進める', await clickAria('M/B管理')); await page.waitForTimeout(1200);
    await clickText('^マスモン一覧'); await page.waitForTimeout(1500);
    await clickText('^確認$'); await page.waitForTimeout(700);
    check('マスモンの詳細を開ける', await clickAny('オートON'));
    await page.waitForTimeout(1500);
    check('強化を開ける', await clickAria('オートONを強化'));
    await page.waitForTimeout(1200);
    check('オート強化のタブがある', await clickText('^オート強化'));
    await page.waitForTimeout(1200);
    // ログインボーナスなど、起動のあとから重なってくるお知らせは先に閉じる。
    // ここで見たいのは「オート強化の上にマスモン詳細が重なっていないか」だけ
    for (let i = 0; i < 5; i++) {
      const closed = await page.evaluate(() => {
        const overlay = [...document.querySelectorAll('body *')].filter((el) => {
          const cs = getComputedStyle(el);
          return cs.position === 'fixed' && Number(cs.zIndex || 0) >= 40000 && el.getBoundingClientRect().height > innerHeight * 0.3;
        }).pop();
        if (!overlay) return false;
        const b = [...overlay.querySelectorAll('button')].find(x => /閉じる|とじる|わかった|OK|はい|あとで/.test(x.textContent));
        if (b) b.click();
        return !!b;
      });
      await page.waitForTimeout(500);
      if (!closed) break;
    }
    const layers = await page.evaluate(fullScreenLayers);
    check('オート強化で詳細が重なっていない', layers.length === 1 && layers[0].startsWith('オート強化'), layers.join(' + ') || 'なし');
    check('画面の中身が出ている', await page.evaluate(() => /優先順位と上限/.test(document.body.innerText)));
    check('8項目ぶんの上限を決められる',
      await page.locator('[data-auto-enhance-limit]').count() === 4
      && await page.evaluate(() => document.querySelectorAll('[data-auto-enhance="auto1"] select').length === 4));

    // ---- 画面から ON / OFF を切り替えると、その場で保存されるか ----
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /オート強化 ON/.test(b.textContent)).click());
    await page.waitForTimeout(700);
    check('画面からOFFにできて、その場で保存される', (await page.evaluate(masuOf, 'auto1')).autoEnhance.enabled === false);
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /オート強化 OFF/.test(b.textContent)).click());
    await page.waitForTimeout(700);
    check('画面からONへ戻せる', (await page.evaluate(masuOf, 'auto1')).autoEnhance.enabled === true);

    // ---- 優先順位の入れ替えが保存されるか ----
    await page.evaluate(() => document.querySelector('button[aria-label="ライフの優先順位を上げる"]').click());
    await page.waitForTimeout(700);
    const moved = await page.evaluate(masuOf, 'auto1');
    check('優先順位を入れ替えると保存される', moved.autoEnhance.order[0] === 'hp', moved.autoEnhance.order.join(','));

    // ---- いまの配分を上限として取り込めるか ----
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /いまの配分を/.test(b.textContent)).click());
    await page.waitForTimeout(700);
    const captured = await page.evaluate(masuOf, 'auto1');
    check('いまの配分を上限として取り込める',
      captured.autoEnhance.statLimits.atk === 3 && captured.autoEnhance.statLimits.hp === 2,
      JSON.stringify(captured.autoEnhance.statLimits));

    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('ブラウザで確認できた', false, String(e.message || e).split('\n')[0]);
  } finally {
    if (browser) await browser.close();
  }
  if (failed) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }
  console.log('\nすべてOK');
})();
