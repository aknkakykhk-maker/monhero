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
  // addInitScript は再読み込みのたびに走る。あとで書き換えた保存内容を上書きしないよう、
  // 一度そろえたら二度目からは何もしない(下で「リセット直後」を作って再読み込みするため)
  if (localStorage.getItem('mh_check_seeded')) return;
  localStorage.setItem('mh_check_seeded', '1');
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
      autoEnhance: { version: 2, enabled: true, order: ['atk', 'hp', 'def', 'guts', 'apt0', 'apt1', 'apt2', 'apt3'],
        statTargets: { hp: 620, atk: 129, def: 0, guts: 0 }, aptLimits: [null, null, null, null] } },
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
    check('優先順位のとおり、ちからが先に目標まで入る', after.statPoints.atk === 3 * 3);
    check('目標をこえて振らない', after.statPoints.hp === 2 * 10 && after.statPoints.def === 0 && after.statPoints.guts === 0);
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
    // 使い方案内は、保存が無いうちは必ず出る(既定値の取り違えで一度も出ない、を防ぐ)
    check('強化画面に、はじめての使い方案内が出る',
      await page.evaluate(() => /強化を毎回手で振るのが大変なら/.test(document.body.innerText)));
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
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /いまの値を/.test(b.textContent)).click());
    await page.waitForTimeout(700);
    const captured = await page.evaluate(masuOf, 'auto1');
    check('いまの値を目標として取り込める',
      captured.autoEnhance.statTargets.atk === 129 && captured.autoEnhance.statTargets.hp === 620,
      JSON.stringify(captured.autoEnhance.statTargets));
    check('画面に「いくつまで上げてよいか」で出ている',
      await page.evaluate(() => /ここまで/.test(document.body.innerText) && /素の値/.test(document.body.innerText)));

    // ---- 絆ポイントリセットの書を使ったあと、自動で振り直されてしまわないか ----
    // 500ダイヤの道具なので、使った直後に自動で振ると道具代ごと無駄になる
    await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('mh_masu_mons'));
      const target = list.find(m => m.id === 'auto1');
      target.distAptPoints = 6;
      target.statPoints = { hp: 0, atk: 0, def: 0, guts: 0 };
      target.bondResetAllocationSnapshot = { version: 1, apt: [0, 0, 0, 0], stat: { hp: 2, atk: 3, def: 0, guts: 0 } };
      localStorage.setItem('mh_masu_mons', JSON.stringify(list));
    });
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForTimeout(4000);
    const afterReset = await page.evaluate(masuOf, 'auto1');
    check('絆ポイントリセットの直後は自動で振らない',
      afterReset.distAptPoints === 6 && afterReset.statPoints.hp === 0 && afterReset.statPoints.atk === 0,
      `残り${afterReset.distAptPoints}P / ライフ+${afterReset.statPoints.hp} ちから+${afterReset.statPoints.atk}`);
    check('復元の下書きも消さずに残す', !!afterReset.bondResetAllocationSnapshot);

    // ---- 転生しても設定が残るか(この機能の目的そのもの) ----
    // 保存を「転生できるところまで育った個体」へ置き換えてから、神殿の転生を通す代わりに
    // 転生後の保存形(resetMasuForRebirth を通った形)を作り、読み直して設定が生きているか見る
    const beforeRebirth = await page.evaluate(masuOf, 'auto1');
    check('転生前に設定が入っている', beforeRebirth.autoEnhance && beforeRebirth.autoEnhance.enabled === true);
    await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('mh_masu_mons'));
      const target = list.find(m => m.id === 'auto1');
      // 転生は「振った強化を白紙に戻す」。設定(autoEnhance)だけは残っているはず。
      // resetMasuForRebirth は項目を並べて新しい保存形を作るので、絆ポイントリセットの
      // 下書き(bondResetAllocationSnapshot)は持ち越されない。ここも同じ形にそろえる
      target.statPoints = { hp: 0, atk: 0, def: 0, guts: 0 };
      target.distAptBoosts = [0, 0, 0, 0];
      target.distAptPoints = 10;
      delete target.bondResetAllocationSnapshot;
      localStorage.setItem('mh_masu_mons', JSON.stringify(list));
    });
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForTimeout(4000);
    const afterRebirth = await page.evaluate(masuOf, 'auto1');
    check('転生で白紙になっても、設定どおりに振り直される',
      afterRebirth.statPoints.atk === 9 && afterRebirth.statPoints.hp === 20,
      `ちから+${afterRebirth.statPoints.atk} ライフ+${afterRebirth.statPoints.hp}`);

    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('ブラウザで確認できた', false, String(e.message || e).split('\n')[0]);
  } finally {
    if (browser) await browser.close();
  }
  if (failed) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }
  console.log('\nすべてOK');
})();
