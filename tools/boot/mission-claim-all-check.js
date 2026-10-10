const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// ミッション画面の「すべて受け取る」と、受け取ったあとの「手に入れたもの」の窓を、実ブラウザで確かめる(2026-10-10・社長の選択)。
//
//   node tools/boot/mission-claim-all-check.js   (別の窓で tools/serve.py 8899 を起動しておく)
//
// 見るもの
//   ・3つのタブの達成済みを、ギフトボックスを経由せず1回で受け取る(ダイヤが増え、ギフトは受取済みになる)
//   ・窓は1回だけ出て、何をいくつ手に入れたかが並ぶ
//   ・受取履歴(sentDaily など)に入り、ギフトは固定IDのまま二重に作られない。二度押しでも二重に受け取れない
//   ・以前の作りでギフトボックスへ送ったまま受け取っていないミッションのギフトも、一緒に受け取る
//   ・ギフトボックスの「受け取る」でも窓が出る
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ミッションの定義と判定は本番のソースをそのまま動かす
const source = fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
const start = source.indexOf('const LOGIN_BONUS_REWARDS');
const end = source.indexOf('const STAT_POINT_GAIN');
const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.__m={MISSION_DEFS,normalizeMissions,missionClaimableList,summarizeClaimedGiftRewards};`, context);
const m = context.__m;

const seed = () => {
  if (localStorage.getItem('mh_check_seeded')) return;
  localStorage.setItem('mh_check_seeded', '1');
  const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set('mh_breeder_name', 'テスト'); set('mh_breeder_icon', 'Mocchi'); set('mh_onboarded', true);
  set('mh_tutorial_seen_v1', true); set('mh_battle_tutorial_seen_v1', true); set('mh_battle_tutorial_guide_shown_v1', true);
  set('mh_masu_migrated', true); set('mh_gold', 1000);
};

(async () => {
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(seed);
    const open = async () => {
      await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
      await page.waitForTimeout(3500);
    };
    const clickText = (re) => page.evaluate((p) => {
      const b = [...document.querySelectorAll('button')].find(x => new RegExp(p).test(x.textContent));
      if (b) b.click();
      return !!b;
    }, re);
    const read = (key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key);

    // タイトル → HOME(お知らせなどの重なりは閉じる)。auto-enhance-browser-check.js と同じ入り方
    const pointerDown = (sel) => page.evaluate((x) => {
      const b = x.aria ? document.querySelector(`button[aria-label="${x.aria}"]`) : [...document.querySelectorAll('button')].find(y => y.textContent.includes(x.text));
      if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return !!b;
    }, sel);
    const toHome = async () => {
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
          const b = buttons.find(x => /閉じる|次へ|確認|わかった|OK|はい|あとで|スキップ/.test(x.textContent)) || buttons.find(x => x.querySelector('svg')) || buttons[buttons.length - 1];
          if (b) b.click();
          return !!b;
        });
        await page.waitForTimeout(450);
        if (!closed) break;
      }
    };

    // ---- 1回目の起動で、その日の期間つきのミッションの保存を作らせる ----
    await open();
    const base = await read('mh_missions');
    check('起動するとミッションの保存ができる', !!base && base.version === 2);

    // 3つのタブとも全部達成した状態にする(カウントを十分に積み、ログイン日数も満たす)
    const done = JSON.parse(JSON.stringify(base));
    for (const type of ['daily', 'weekly', 'monthly']) Object.keys(done[type]).forEach((k) => { done[type][k] = 999; });
    done.weeklyLoginDays = Array.from({ length: 7 }, (_, i) => `2026-10-0${i + 1}`);
    done.monthlyLoginDays = Array.from({ length: 28 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
    // 以前の作りでギフトボックスへ送ったまま、まだ受け取っていないミッション(デイリーの1つ)
    const first = m.MISSION_DEFS.daily.find((d) => !d.complete);
    done.sentDaily = [first.id];
    const future = new Date(Date.now() + 864e5).toISOString();
    const backlogGift = { id: `gift_mission_daily_${done.dailyPeriod}_${first.id}`, source: 'mission', missionId: first.id, missionType: 'daily', periodId: done.dailyPeriod,
      title: '以前に送ったミッション報酬', description: 'テスト', rewards: [{ type: 'diamond', amount: 50 }], createdAt: new Date().toISOString(), expiresAt: future, claimedAt: null };
    await page.evaluate(([mi, g]) => {
      localStorage.setItem('mh_missions', JSON.stringify(mi));
      localStorage.setItem('mh_gifts', JSON.stringify([g]));
    }, [done, backlogGift]);
    await open();

    // 受け取れるはずのもの(本番の判定で数える)。デイリー→ウィークリー→マンスリーの順に数え直す
    const stateNow = m.normalizeMissions(await read('mh_missions'));
    const expectedIds = [];
    let expectedDiamond = 50; // 以前に送ったギフトの分
    for (const type of ['daily', 'weekly', 'monthly']) {
      m.missionClaimableList(stateNow, type).forEach((d) => { expectedIds.push(`${type}:${d.id}`); expectedDiamond += d.rewards.filter((r) => r.type === 'diamond').reduce((a, r) => a + r.amount, 0); });
    }
    check('受け取れるミッションがある', expectedIds.length > 3, `${expectedIds.length}件`);

    // ---- HOME → ミッション ----
    await toHome();
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /ミッション/.test(x.getAttribute('aria-label') || x.textContent)); b && b.click(); });
    await page.waitForTimeout(1200);
    check('ミッション画面に「すべて受け取る」がある', await page.locator('[data-mission-claim-all]').count() === 1);
    const label = await page.locator('[data-mission-claim-all]').innerText();
    check('受け取れる件数がボタンに出る', /すべて受け取る \(\d+\)/.test(label), label);
    check('以前の作りで送ったままのものは「ギフトボックスに届いています」と出る', await page.evaluate(() => /ギフトボックスに届いています/.test(document.body.innerText)));

    // ---- 二度押ししても1回分だけ ----
    const goldBefore = await read('mh_gold');
    await page.evaluate(() => { const b = document.querySelector('[data-mission-claim-all]'); b.click(); b.click(); });
    await page.waitForTimeout(2500);
    const goldAfter = await read('mh_gold');
    check('ダイヤが受け取った分だけ増える(二度押ししても1回分)', goldAfter - goldBefore === expectedDiamond, `増えた量 ${goldAfter - goldBefore} / 期待 ${expectedDiamond}`);
    check('「手に入れたもの」の窓が1つだけ出る', await page.locator('[data-reward-receipt]').count() === 1);
    const rows = await page.locator('[data-reward-receipt-row]').allInnerTexts();
    check('何をいくつ手に入れたかが並ぶ(ダイヤを含む)', rows.length > 0 && rows.some((t) => /ダイヤ/.test(t)), rows.join(' / '));
    const missionsAfter = await read('mh_missions');
    check('受取履歴(sentDaily など)に入る', expectedIds.every((x) => { const [t, id] = x.split(':'); return missionsAfter[t === 'daily' ? 'sentDaily' : t === 'weekly' ? 'sentWeekly' : 'sentMonthly'].includes(id); }));
    const giftsAfter = await read('mh_gifts');
    const ids = giftsAfter.map((g) => g.id);
    check('ギフトのIDは二重にならない', new Set(ids).size === ids.length);
    check('ミッションのギフトはすべて受取済み(受取待ちが残らない)', giftsAfter.filter((g) => g.source === 'mission' || g.id === backlogGift.id).every((g) => !!g.claimedAt));
    // 窓を閉じて、もう一度押せないこと
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /閉じる/.test(x.textContent)); b && b.click(); });
    await page.waitForTimeout(500);
    check('受け取ったあとは「すべて受け取る」が押せない', await page.locator('[data-mission-claim-all]').isDisabled());
    check('窓を閉じられる', await page.locator('[data-reward-receipt]').count() === 0);

    // ---- 読み込み直しても二重に受け取れない ----
    await open();
    check('読み込み直してもダイヤは増えない', (await read('mh_gold')) === goldAfter);

    // ---- ギフトボックスの「受け取る」でも窓が出る ----
    await page.evaluate((g) => {
      const list = JSON.parse(localStorage.getItem('mh_gifts') || '[]');
      list.unshift({ id: 'gift_check_plain', source: 'campaign', title: '確認用', description: 'テスト', rewards: [{ type: 'diamond', amount: 777 }], createdAt: new Date().toISOString(), expiresAt: g, claimedAt: null });
      localStorage.setItem('mh_gifts', JSON.stringify(list));
    }, future);
    await open();
    await toHome();
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /ギフト/.test(x.getAttribute('aria-label') || x.textContent)); b && b.click(); });
    await page.waitForTimeout(1200);
    const goldGift = await read('mh_gold');
    await page.evaluate(() => { const art = [...document.querySelectorAll('article')].find(a => a.textContent.includes('確認用')); const b = art && [...art.querySelectorAll('button')].find(x => /^受け取る$/.test(x.textContent.trim())); b && b.click(); });
    await page.waitForTimeout(2000);
    check('ギフトを受け取ると、ダイヤが増える', (await read('mh_gold')) - goldGift === 777);
    check('ギフトでも「手に入れたもの」の窓が出る', await page.locator('[data-reward-receipt]').count() === 1
      && (await page.locator('[data-reward-receipt-row]').allInnerTexts()).some((t) => /ダイヤ ×777/.test(t)));

    check('画面でエラーが出ていない', errors.length === 0, errors.join(' / ').slice(0, 200));
  } catch (e) {
    check('ブラウザで確認できた', false, String(e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
  }
  // 合計の関数(窓の中身)は本番の定義で確かめる
  const sum = m.summarizeClaimedGiftRewards([
    { rewards: [{ type: 'diamond', amount: 100 }, { type: 'skipTicketJo', amount: 1 }] },
    { rewards: [{ type: 'diamond', amount: 50 }] },
  ]);
  check('受け取った報酬を種類ごとに合計する', sum.length === 2 && sum.find((r) => r.type === 'diamond').amount === 150);
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
