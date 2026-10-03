// ハロウィンの衣装(助手の着替え)を、実際の画面で確かめる(2026-10-04)。時計を動かして3つの時間を見る。
//   ① 開始の前(10/4 7:59) … プロフィールに「着替え」が無く、ビートP交換所にも「着替え」タブが無い
//   ② 期間中(10/10) … ビートP交換所に3着が並び、1000Pで買える(ダイヤショップには並ばない)。
//        買うと mh_assistant_costume_owned_v1 に入り、プロフィールから着替えると吹き出しの顔が衣装の絵になる
//   ③ 終わったあと(11/1 4:00) … ビートP交換所には並ばず、ダイヤショップの「着替え」タブに100000ダイヤで並ぶ
//
// 実行: node tools/market/assistant-costume-browser-check.js(配信は tools/serve.py を :8899 で)
const path = require('path');
const { chromium } = require('playwright');
const { eventStorySeed } = require(path.join(__dirname, '..', 'boot', 'quiet-boot-seed'));

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

const seed = ({ conditions }) => {
  void conditions;
  const put = (key, value) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
  // 日次アドバイスは、その日の最初に出て画面をふさぐ。見た扱いにする
  const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
  put('mh_daily_masu_advice_date_v1', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  put('mh_breeder_points', 5);
  put('mh_rhythm_event_points_v1', 2500);
  put('mh_gold', 300000);
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const fatal = [];

  const open = async (nowText) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.clock.setFixedTime(new Date(nowText));
    const page = await ctx.newPage();
    page.on('pageerror', e => fatal.push(e.message));
    await page.addInitScript(seed, { conditions: false });
    await page.addInitScript(eventStorySeed());
    const down = (f) => page.evaluate((s) => {
      const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`)
        : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
      if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return !!b;
    }, f);
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await down({ text: 'TAP TO START' });
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
    await down({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(3000);
    let quiet = 0;
    for (let i = 0; i < 40 && quiet < 2; i++) {
      const closed = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) {
          const inner = [...dialog.querySelectorAll('button')];
          if (inner.length) { inner[inner.length - 1].click(); return true; }
        }
        const b = [...document.querySelectorAll('button')].find(x => /^(受け取る|閉じる|あとで|スキップ|次へ|確認|OK|今は見ない)$/.test((x.innerText || '').replace(/\s+/g, ' ').trim()));
        if (b) b.click();
        return !!b;
      });
      await page.waitForTimeout(closed ? 500 : 900);
      quiet = closed ? 0 : quiet + 1;
    }
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="マーケット"]'), { timeout: 30000 });
    return { page, ctx };
  };
  const clickText = async (page, label, { exact = true } = {}) => {
    const ok = await page.evaluate(({ label, exact }) => {
      const norm = (el) => (el.innerText || '').replace(/\s+/g, ' ').trim();
      const b = [...document.querySelectorAll('button')].find(x => exact ? (norm(x) === label || ((x.innerText || '').split('\n')[0] || '').trim() === label) : norm(x).includes(label));
      if (b) b.click();
      return !!b;
    }, { label, exact });
    await page.waitForTimeout(1000);
    return ok;
  };
  const openShop = async (page, entry) => {
    // マーケットの入口へ戻ってから目的の売り場へ入る
    await page.evaluate(() => { const b = document.querySelector('button[aria-label="マーケット"]'); if (b) b.click(); });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button[aria-label="戻る"]')].find(x => x.closest('.mh-screen-head')); if (b && !document.body.innerText.includes('ダイヤで購入')) b.click(); });
    await clickText(page, entry, { exact: false });
    await clickText(page, 'フレーム');
  };
  const frameCards = (page, names = ['モッチー', 'ムー', 'スエゾービート']) => page.evaluate((names) => {
    return names.map(n => {
      const card = [...document.querySelectorAll('div')].reverse().find(d => d.className.toString().includes('rounded-2xl') && d.className.toString().includes('border') && (d.innerText || '').replace(/\u200b/g, '').includes(`${n}のフレーム`) && !names.some(m => m !== n && m !== 'ムー' && (d.innerText || '').replace(/\u200b/g, '').includes(`${m}のフレーム`)));
      const text = card ? card.innerText.replace(/\s+/g, ' ').replace(/\u200b/g, '') : '';
      const buy = card ? [...card.querySelectorAll('button')].find(b => /購入|交換/.test(b.getAttribute('aria-label') || b.innerText || '')) : null;
      return { name: n, found: !!card, text, locked: text.includes('条件を達成すると買えます'), buyEnabled: !!buy && !buy.disabled, buyLabel: buy ? (buy.getAttribute('aria-label') || buy.innerText) : '' };
    });
  }, names);
  const store = (page, key) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, key);


  const tabs = (page) => page.evaluate(() => [...document.querySelectorAll('button')].map(b => (b.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
  const costumeCards = (page) => page.evaluate(() => {
    return ['ハロウィンの魔女', 'ハロウィンのうさ耳フード', 'ハロウィンの小悪魔'].map(n => {
      const card = [...document.querySelectorAll('div')].reverse().find(d => d.className.toString().includes('rounded-2xl') && d.className.toString().includes('border') && (d.innerText || '').includes(n));
      const text = card ? card.innerText.replace(/\s+/g, ' ') : '';
      const buy = card ? [...card.querySelectorAll('button')].find(b => /購入|交換/.test(b.getAttribute('aria-label') || b.innerText || '')) : null;
      return { name: n, found: !!card, text, buyEnabled: !!buy && !buy.disabled };
    });
  });
  const goShop = async (page, entry) => {
    await page.evaluate(() => { const b = document.querySelector('button[aria-label="マーケット"]'); if (b) b.click(); });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button[aria-label="戻る"]')].find(x => x.closest('.mh-screen-head')); if (b && !document.body.innerText.includes('ダイヤで購入')) b.click(); });
    await page.waitForTimeout(600);
    await clickText(page, entry, { exact: false });
  };

  // ===== ① 開始の前 =====
  {
    const { page, ctx } = await open('2026-10-04T07:59:00+09:00');
    await goShop(page, 'ビートP');
    check('① 開始の前は、ビートP交換所に「着替え」タブが無い', !(await tabs(page)).includes('着替え'));
    await goShop(page, 'ダイヤ');
    check('① 開始の前は、ダイヤショップにも「着替え」タブが無い', !(await tabs(page)).includes('着替え'));
    await ctx.close();
  }

  // ===== ② 期間中 =====
  {
    const { page, ctx } = await open('2026-10-10T12:00:00+09:00');
    await goShop(page, 'ダイヤ');
    check('② 期間中は、ダイヤショップに「着替え」タブが出ない(ビートP交換所だけで売る)', !(await tabs(page)).includes('着替え'));
    await goShop(page, 'ビートP');
    check('② ビートP交換所に「着替え」タブが出る', (await tabs(page)).includes('着替え'));
    await clickText(page, '着替え');
    let cards = await costumeCards(page);
    check('② 3着が並ぶ', cards.every(c => c.found), cards.map(c => `${c.name}:${c.found}`).join(' '));
    check('② 3着とも1000Pで買える', cards.every(c => c.buyEnabled && /1,?000/.test(c.text)), cards.map(c => `${c.name}:${c.buyEnabled}`).join(' '));
    const buy = await page.evaluate(() => {
      const card = [...document.querySelectorAll('div')].reverse().find(d => d.className.toString().includes('rounded-2xl') && d.className.toString().includes('border') && (d.innerText || '').includes('ハロウィンの魔女'));
      const b = card && [...card.querySelectorAll('button')].find(x => /購入|交換/.test(x.getAttribute('aria-label') || x.innerText || ''));
      if (!b || b.disabled) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true;
    });
    await page.waitForTimeout(800);
    if (process.env.COSTUME_DEBUG) console.log(await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button, button')].slice(-12).map(b => (b.innerText||'').replace(/\s+/g,' ').trim() + '|' + (b.getAttribute('aria-label')||'')).join(' ;; ')));
    check('② 魔女の交換ボタンを押せる', buy);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /^(購入する|交換する)$/.test((x.textContent || '').trim()));
      if (b && !b.disabled) b.click();
    });
    await page.waitForTimeout(1500);
    check('② ビートPが1000だけ引かれる(2500 → 1500)', (await store(page, 'mh_rhythm_event_points_v1')) === 1500, String(await store(page, 'mh_rhythm_event_points_v1')));
    check('② 魔女が mh_assistant_costume_owned_v1 に入る', ((await store(page, 'mh_assistant_costume_owned_v1')) || []).join() === 'mua_halloween_2026', JSON.stringify(await store(page, 'mh_assistant_costume_owned_v1')));
    cards = await costumeCards(page);
    check('② 買った魔女は「所持済み」で買えない。ほかの2着は買える', !cards[0].buyEnabled && cards[1].buyEnabled && cards[2].buyEnabled, cards.map(c => `${c.name}:${c.buyEnabled}`).join(' '));

    // プロフィールから着替える
    await page.evaluate(() => { const b = document.querySelector('button[aria-label="戻る"]'); if (b) b.click(); });
    await page.waitForTimeout(800);
    await page.evaluate(() => { const b = document.querySelector('button[aria-label="戻る"]'); if (b) b.click(); });
    await page.waitForTimeout(800);
    const opened = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /プロフィール/.test(x.getAttribute('aria-label') || '')); if (b) { b.click(); return true; } return false; });
    await page.waitForTimeout(1500);
    const tile = await page.evaluate(() => !!document.querySelector('[data-profile-tile="costume"]'));
    check('② プロフィールに「着替え」のタイルが出る', opened && tile, `opened=${opened}`);
    await page.evaluate(() => document.querySelector('[data-profile-tile="costume"]')?.click());
    await page.waitForTimeout(1000);
    const opts = await page.evaluate(() => [...document.querySelectorAll('[data-assistant-costume-option]')].map(b => `${b.getAttribute('data-assistant-costume-option')}:${b.getAttribute('data-assistant-costume-locked')}`));
    check('② 着替えの窓に「元の服」と魔女が並ぶ(魔女は持っているので鍵なし)', opts.join() === 'original:no,mua_halloween_2026:no', opts.join());
    await page.evaluate(() => document.querySelector('[data-assistant-costume-option="mua_halloween_2026"]')?.click());
    await page.waitForTimeout(1200);
    check('② 魔女を着ると mh_assistant_costume_worn_v1 に残る', (await store(page, 'mh_assistant_costume_worn_v1'))?.mua === 'mua_halloween_2026', JSON.stringify(await store(page, 'mh_assistant_costume_worn_v1')));
    const face = await page.evaluate(() => [...document.querySelectorAll('img')].map(i => i.getAttribute('src') || '').filter(s => s.includes('assistant/halloween/face/myua_')));
    check('② 着替えの窓の「いま着ている服」の顔が衣装の絵になる', face.length > 0, face[0] || '(なし)');
    const shot = process.env.COSTUME_SHOT;
    if (shot) await page.screenshot({ path: shot });
    await ctx.close();
  }

  // ===== ③ 終わったあと =====
  {
    const { page, ctx } = await open('2026-11-01T04:00:00+09:00');
    await goShop(page, 'ビートP');
    check('③ 終わったあとは、ビートP交換所に「着替え」タブが無い', !(await tabs(page)).includes('着替え'));
    await goShop(page, 'ダイヤ');
    check('③ ダイヤショップに「着替え」タブが出る', (await tabs(page)).includes('着替え'));
    await clickText(page, '着替え');
    const cards = await costumeCards(page);
    check('③ 3着が100000ダイヤで並ぶ', cards.every(c => c.found && /100,?000/.test(c.text)), cards.map(c => `${c.name}:${c.found}:${c.text.slice(0, 30)}`).join(' | '));
    await ctx.close();
  }

  check('実行時エラーが出ていない', fatal.length === 0, fatal.slice(0, 2).join(' | '));
  await browser.close();
  const ng = results.filter(r => !r).length;
  console.log(ng === 0 ? '\nすべてOK' : `\n${ng}件NG`);
  process.exit(ng === 0 ? 0 : 1);
})();
