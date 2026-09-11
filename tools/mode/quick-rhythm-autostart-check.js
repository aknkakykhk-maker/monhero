// AUTO設定の「モンヒロビートを開いたら自動で始める」が、実際のブラウザで働くかを確かめる
// (2026-09-11・ユーザー指示「オート設定にモンビー中のオート周回を設定している場合に
//  モンビーを開いたら自動でクイックに入る機能を追加したい」)。
//
//   python3 -m http.server 8899 を起動した状態で
//   node tools/mode/quick-rhythm-autostart-check.js
//
// 見るのは2つだけ。
//   ON  … HOMEからモンヒロビートを開くと、何も押さずに周回の帯が出る
//   OFF … 同じ設定でもスイッチがOFFなら、帯は出ず「始める」ボタンのままである
//
// ★静的な検査(tools/auto-settings-check.js)だけでは「設定を読めているか」までしか分からない。
//   自動で始まる仕組みは**押す場所が無い**ので、実際に開いて確かめないと壊れても気づけない。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };

// 事前設定つきのセーブを作る。autoStart だけを入れ替えて2回動かす
const seedFor = (autoStart) => (`(() => {
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
  // Beginner をチャレンジでクリア済みにしておく(クイックの Beginner が解放される)
  put('mh_clears_Beginner', 3);
  put('mh_quick_clears_Beginner', 3);
  put('mh_auto_settings_v1', {
    strategy: 'random',
    allies: [{ rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }],
    breakthroughReserve: { gold: 0, psyche: 0 },
    quickRun: { heroRosterEntry: 'Suezo', distance: 2, difficulty: 'Beginner', autoStart: ${autoStart ? 'true' : 'false'} },
  });
})()`);

const openRhythmFromHome = async (page) => {
  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('TAP TO START'));
    b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    document.querySelector('button[aria-label="トップ画面へ進む"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  await page.waitForTimeout(2200);
  // ログインボーナスなどの重なりを閉じる
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
  // HOMEの施設からモンヒロビートを開く(ここから先は何も押さない)
  await page.evaluate(() => document.querySelector('button[aria-label="モンヒロビート"]')?.click());
  await page.waitForFunction(() => !!document.querySelector('[data-rhythm-demo-home]'), { timeout: 20000 }).catch(() => {});
};

const bandExists = (page) => page.evaluate(() => !!document.querySelector('[data-quick-run-progress],[data-quick-run-progress-header]'));
const startButtonExists = (page) => page.evaluate(() => !!document.querySelector('[data-quick-run-start-button]'));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const fatal = [];
  try {
    // ---- ON: 開いただけで周回が始まる ----
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      page.on('pageerror', (e) => fatal.push(e.message));
      await page.route('**cdn.tailwindcss.com**', (r) => r.abort()).catch(() => {});
      await page.addInitScript(seedFor(true));
      await openRhythmFromHome(page);
      check('ONのとき、モンヒロビートを開けている', await page.evaluate(() => !!document.querySelector('[data-rhythm-demo-home]')));
      // 何も押さずに待つ。始まっていれば周回の帯が出る
      await page.waitForFunction(() => !!document.querySelector('[data-quick-run-progress],[data-quick-run-progress-header]'), { timeout: 20000 }).catch(() => {});
      const band = await page.evaluate(() => {
        const el = document.querySelector('[data-quick-run-progress],[data-quick-run-progress-header]');
        return el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '';
      });
      check('ONのとき、何も押さずに周回が始まる', await bandExists(page), band || '帯が出ない');
      check('ONのとき、1周目から数えはじめる', /1周目/.test(band), band);
      check('ONのとき、「始める」ボタンは出ない', !(await startButtonExists(page)));
      await page.close();
    }

    // ---- OFF: 同じ事前設定でも勝手には始まらない ----
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      page.on('pageerror', (e) => fatal.push(e.message));
      await page.route('**cdn.tailwindcss.com**', (r) => r.abort()).catch(() => {});
      await page.addInitScript(seedFor(false));
      await openRhythmFromHome(page);
      check('OFFのとき、モンヒロビートを開けている', await page.evaluate(() => !!document.querySelector('[data-rhythm-demo-home]')));
      await page.waitForTimeout(6000);
      check('OFFのとき、勝手に周回が始まらない', !(await bandExists(page)));
      check('OFFのとき、「始める」ボタンは出ている', await startButtonExists(page));
      await page.close();
    }

    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
  }
  const failed = results.filter((ok) => !ok).length;
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
