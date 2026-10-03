// 条件つきのプロフィールフレーム(モッチー・ムー・スエゾービート)を、実際の画面で買えるか確かめる(2026-10-03)。
//
//   ユーザー指示「各フレームを条件達成で買えるようにしたい」「ブリーダーポイント 1、ビートポイント 100」。
//   ① 条件を1つも満たしていない人 … ブリーダーP交換所にもビートP交換所にも、3枚とも「条件を達成すると買えます」の札が出て、買えない
//   ② 条件を満たした人 … 買えて、残高が引かれ、mh_profile_frame_owned_v1 に入る
//        スエゾービート(モンヒロビート10回クリア)をブリーダーPで / ムー(マスタークリア)をビートPで
//      条件を満たしていない枠(モッチー)は、ポイントが足りていても買えないまま
//
// 実行: node tools/market/frame-shop-browser-check.js(配信は tools/serve.py を :8899 で)
const path = require('path');
const { chromium } = require('playwright');
const { eventStorySeed } = require(path.join(__dirname, '..', 'boot', 'quiet-boot-seed'));

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

const seed = ({ conditions }) => {
  const put = (key, value) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
  // 日次アドバイスは、その日の最初に出て画面をふさぐ。見た扱いにする
  const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
  put('mh_daily_masu_advice_date_v1', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  put('mh_breeder_points', 5);
  put('mh_rhythm_event_points_v1', 500);
  if (conditions) {
    put('mh_rhythm_clear_total_v1', 10);   // スエゾービート: モンヒロビート10回クリア
    put('mh_clears_Master', 1);            // ムー: マスターをクリア
  }
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const fatal = [];

  const open = async (conditions) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => fatal.push(e.message));
    await page.addInitScript(seed, { conditions });
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

  // ===== ① 条件を1つも満たしていない人 =====
  {
    const { page, ctx } = await open(false);
    for (const [entry, label] of [['ブリーダーP', 'ブリーダーP交換所'], ['ビートP', 'ビートP交換所']]) {
      await openShop(page, entry);
      const cards = await frameCards(page);
      check(`① ${label}に3枚とも並ぶ`, cards.every(c => c.found), cards.map(c => `${c.name}:${c.found}`).join(' '));
      check(`① ${label}: 条件が未達成の3枚は「条件を達成すると買えます」の札で、買えない`,
        cards.every(c => c.locked && !c.buyEnabled), cards.map(c => `${c.name}:${c.locked}/${c.buyEnabled}`).join(' '));
    }
    // 新しい7枚(2026-10-03): 条件はブリーダーP交換所だけ。ビートP交換所は条件なし(スエゾー〜ミーア(ゴーレム含む)は100P・ラグナロクは1000P)
    const NEW6 = ['スエゾー', 'ゴーレム', 'ライガー', 'ハム', 'ピクシー', 'ミーア', 'ラグナロク'];
    await openShop(page, 'ブリーダーP');
    const bpNew = await frameCards(page, NEW6);
    check('① ブリーダーP交換所: 新しい7枚も並び、条件が未達成なので鍵つきで買えない',
      bpNew.every(c => c.found && c.locked && !c.buyEnabled), bpNew.map(c => `${c.name}:${c.found}/${c.locked}/${c.buyEnabled}`).join(' '));
    await openShop(page, 'ビートP');
    const beatNew = await frameCards(page, NEW6);
    check('① ビートP交換所: 新しい7枚は鍵が付かない(条件なし)', beatNew.every(c => c.found && !c.locked), beatNew.map(c => `${c.name}:${c.found}/${c.locked}`).join(' '));
    check('① ビートP交換所: スエゾー〜ミーア(ゴーレム含む)は100P(所持500P)で買える', beatNew.slice(0, 6).every(c => c.buyEnabled), beatNew.map(c => `${c.name}:${c.buyEnabled}`).join(' '));
    check('① ビートP交換所: ラグナロクは1000Pなので、500Pでは買えない', !beatNew[6].buyEnabled && /1000/.test(beatNew[6].text.replace(/,/g, '')), beatNew[6].text.slice(0, 40));
    check('① 未達成のあいだ、持ち物は何も増えない', ((await store(page, 'mh_profile_frame_owned_v1')) || []).length === 0);
    await ctx.close();
  }

  // ===== ② 条件を満たした人(スエゾービートとムー。モッチーは未達成のまま) =====
  {
    const { page, ctx } = await open(true);
    await openShop(page, 'ブリーダーP');
    let cards = await frameCards(page);
    const by = (n) => cards.find(c => c.name === n);
    check('② ブリーダーP交換所: スエゾービートとムーは買える札になる', !by('スエゾービート').locked && !by('ムー').locked && by('スエゾービート').buyEnabled && by('ムー').buyEnabled,
      cards.map(c => `${c.name}:${c.locked}/${c.buyEnabled}`).join(' '));
    check('② ブリーダーP交換所: モッチー(限界突破していない)は、ポイントが足りていても買えない', by('モッチー').locked && !by('モッチー').buyEnabled);

    // 起動時のログイン処理でブリーダーPが増えることがあるので、買う直前の値から1引かれるかを見る
    const bpBefore = await store(page, 'mh_breeder_points');
    // スエゾービートをブリーダーPで買う(確認の窓の「購入する」まで押す)
    const buyFirst = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('div')].filter(d => d.className.toString().includes('rounded-2xl') && (d.innerText || '').includes('スエゾービートのフレーム') && !(d.innerText || '').includes('モッチーのフレーム'));
      const card = cards[cards.length - 1];
      const b = card && [...card.querySelectorAll('button')].find(x => /購入|交換/.test(x.getAttribute('aria-label') || x.innerText || ''));
      if (!b || b.disabled) return false;
      b.scrollIntoView({ block: 'center' }); b.click(); return true;
    });
    await page.waitForTimeout(800);
    check('② スエゾービートの購入ボタンを押せる', buyFirst);
    const confirmed = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const b = dialog && [...dialog.querySelectorAll('button')].find(x => (x.textContent || '').trim() === '購入する');
      if (!b || b.disabled) return false; b.click(); return true;
    });
    await page.waitForTimeout(1200);
    check('② 確認の窓の「購入する」を押せる', confirmed);
    check(`② ブリーダーPが1だけ引かれる(${bpBefore} → ${bpBefore - 1})`, (await store(page, 'mh_breeder_points')) === bpBefore - 1, String(await store(page, 'mh_breeder_points')));
    check('② 買ったフレームが mh_profile_frame_owned_v1 に入る', ((await store(page, 'mh_profile_frame_owned_v1')) || []).includes('frame_suezo_beat'),
      JSON.stringify(await store(page, 'mh_profile_frame_owned_v1')));
    check('② ビートPは変わらない', (await store(page, 'mh_rhythm_event_points_v1')) === 500);

    // ムーをビートPで買う
    await openShop(page, 'ビートP');
    cards = await frameCards(page);
    check('② ビートP交換所: 買ったスエゾービートは「所持済み」で買えない', !by('スエゾービート') || !cards.find(c => c.name === 'スエゾービート').buyEnabled);
    const buyMoo = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('div')].filter(d => d.className.toString().includes('rounded-2xl') && (d.innerText || '').includes('ムーのフレーム') && !(d.innerText || '').includes('モッチーのフレーム') && !(d.innerText || '').includes('スエゾービートのフレーム'));
      const card = cards[cards.length - 1];
      const b = card && [...card.querySelectorAll('button')].find(x => /購入|交換/.test(x.getAttribute('aria-label') || x.innerText || ''));
      if (!b || b.disabled) return false;
      b.scrollIntoView({ block: 'center' }); b.click(); return true;
    });
    await page.waitForTimeout(800);
    check('② ムーの交換ボタンを押せる', buyMoo);
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const b = dialog && [...dialog.querySelectorAll('button')].find(x => /^(購入する|交換する)$/.test((x.textContent || '').trim()));
      if (b && !b.disabled) b.click();
    });
    await page.waitForTimeout(1200);
    check('② ビートPが100だけ引かれる(500 → 400)', (await store(page, 'mh_rhythm_event_points_v1')) === 400, String(await store(page, 'mh_rhythm_event_points_v1')));
    check('② ムーも mh_profile_frame_owned_v1 に入る', ((await store(page, 'mh_profile_frame_owned_v1')) || []).includes('frame_moo'));
    check('② モッチーは買えていない(条件未達成)', !((await store(page, 'mh_profile_frame_owned_v1')) || []).includes('frame_mocchi'));

    // ③ フレーム選択画面で選べる
    await page.evaluate(() => { const b = document.querySelector('button[aria-label="戻る"]'); if (b) b.click(); });
    await page.waitForTimeout(800);
    await ctx.close();
  }

  check('実行時エラーが出ていない', fatal.length === 0, fatal.slice(0, 2).join(' | '));
  await browser.close();
  const ng = results.filter(r => !r).length;
  console.log(ng === 0 ? '\nすべてOK' : `\n${ng}件NG`);
  process.exit(ng === 0 ? 0 : 1);
})();
