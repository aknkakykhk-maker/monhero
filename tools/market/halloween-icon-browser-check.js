// ハロウィンの衣装のアイコン販売を、実際の画面で確かめる(2026-10-04)。時計を動かして3つの時間を見る。
//   ① 開始の前 … ビートP交換所に「アイコン」タブが無い
//   ② 期間中 … ビートP交換所に「アイコン」タブが出て、みゅあ・きき・ももすけ(ハロウィン)が1000Pで並ぶ。
//        買うと8表情ぜんぶ mh_market_icons に入り、ポイントは1000だけ減り、所持済みになる。ブリーダーP交換所のアイコンには並ばない
//   ③ 終わったあと … ビートP交換所に「アイコン」タブが無く、ブリーダーP交換所のアイコンに3キャラが1ptで並ぶ
// (元の組み立ては assistant-costume-browser-check.js と同じ。下の1行目以降の説明は、そちらの古い説明のまま)
// 以下、組み立ての説明:
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

  const iconCards = (page) => page.evaluate(() => {
    return ['みゅあ（ハロウィン）のアイコン', 'きき（ハロウィン）のアイコン', 'ももすけ（ハロウィン）のアイコン', 'スネグーラチカ（ハロウィン）のアイコン'].map(n => {
      const card = [...document.querySelectorAll('div')].reverse().find(d => d.className.toString().includes('rounded-2xl') && d.className.toString().includes('border') && (d.innerText || '').includes(n));
      const text = card ? card.innerText.replace(/\s+/g, ' ') : '';
      const buy = card ? [...card.querySelectorAll('button')].find(b => /購入|交換/.test(b.getAttribute('aria-label') || b.innerText || '')) : null;
      return { name: n, found: !!card, text, buyEnabled: !!buy && !buy.disabled };
    });
  });
  const EXPR = ['normal', 'happy', 'wink', 'excited', 'surprise', 'troubled', 'angry', 'crying'];

  // ===== ① 開始の前 =====
  {
    const { page, ctx } = await open('2026-10-04T07:59:00+09:00');
    await goShop(page, 'ビートP');
    check('① 開始の前は、ビートP交換所に「アイコン」タブが無い', !(await tabs(page)).includes('アイコン'));
    await ctx.close();
  }

  // ===== ② 期間中 =====
  {
    const { page, ctx } = await open('2026-10-10T12:00:00+09:00');
    await goShop(page, 'ビートP');
    check('② ビートP交換所に「アイコン」タブが出る', (await tabs(page)).includes('アイコン'));
    await clickText(page, 'アイコン');
    // 2026-10-04 ユーザー指摘「文字列が悪い」: タブの文字が途中で割れない / 商品名の「（…）」が行をまたがない
    const wraps = await page.evaluate(() => {
      const linesOf = (el) => { const tops = new Set(); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) { for (let i = 0; i < n.data.length; i++) { if (/\u200b/.test(n.data[i])) continue; const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const b = r.getBoundingClientRect(); if (b.width) tops.add(Math.round(b.top)); } } return tops.size; };
      const tabs = [...document.querySelectorAll('[role="tab"]')].map(b => ({ label: (b.innerText || '').trim(), lines: linesOf(b) }));
      const cut = [];
      document.querySelectorAll('[data-event-point-icon]').forEach(card => {
        const name = [...card.querySelectorAll('div')].find(d => /ハロウィン/.test(d.innerText || '') && d.className.toString().includes('font-black') && d.className.toString().includes('text-center'));
        if (!name) return;
        const chars = []; const w = document.createTreeWalker(name, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) for (let i = 0; i < n.data.length; i++) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const b = r.getBoundingClientRect(); if (b.width) chars.push({ c: n.data[i], top: Math.round(b.top) }); }
        const open = chars.find(x => x.c === '（'), close = chars.find(x => x.c === '）');
        if (!open || !close || open.top !== close.top) cut.push((name.innerText || '').replace(/\s+/g, ' '));
      });
      return { tabs, cut };
    });
    check('② タブの文字が途中で割れない(どのタブも1行)', wraps.tabs.length >= 7 && wraps.tabs.every(t => t.lines === 1), JSON.stringify(wraps.tabs));
    check('② 商品名の「（…）」が行をまたがない', wraps.cut.length === 0, wraps.cut.join(' | '));
    let cards = await iconCards(page);
    check('② 4キャラが並ぶ', cards.every(c => c.found), cards.map(c => `${c.name}:${c.found}`).join(' '));
    check('② 4キャラとも1000Pで買える', cards.every(c => c.buyEnabled && /1,?000/.test(c.text)), cards.map(c => `${c.name}:${c.buyEnabled}`).join(' '));
    const buy = await page.evaluate(() => {
      const card = [...document.querySelectorAll('div')].reverse().find(d => d.className.toString().includes('rounded-2xl') && d.className.toString().includes('border') && (d.innerText || '').includes('みゅあ（ハロウィン）のアイコン'));
      const b = card && [...card.querySelectorAll('button')].find(x => /購入|交換/.test(x.getAttribute('aria-label') || x.innerText || ''));
      if (!b || b.disabled) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true;
    });
    await page.waitForTimeout(800);
    check('② みゅあ(ハロウィン)の交換ボタンを押せる', buy);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /^(購入する|交換する)$/.test((x.textContent || '').trim()));
      if (b && !b.disabled) b.click();
    });
    await page.waitForTimeout(1500);
    check('② ビートPが1000だけ引かれる(2500 → 1500)', (await store(page, 'mh_rhythm_event_points_v1')) === 1500, String(await store(page, 'mh_rhythm_event_points_v1')));
    const icons = (await store(page, 'mh_market_icons')) || [];
    check('② 8表情ぜんぶ mh_market_icons に入る(通常のみゅあのアイコンは入らない)', EXPR.every(k => icons.includes(`myua_halloween_${k}`)) && !icons.includes('myua_normal') && !icons.includes('mua'), JSON.stringify(icons));
    cards = await iconCards(page);
    check('② 買ったみゅあは「所持済み」で買えない。ほかの3キャラは買える', !cards[0].buyEnabled && cards[1].buyEnabled && cards[2].buyEnabled && cards[3].buyEnabled, cards.map(c => `${c.name}:${c.buyEnabled}`).join(' '));
    await goShop(page, 'ブリーダー');
    const breederText = await page.evaluate(() => document.body.innerText);
    check('② ブリーダーP交換所には、ハロウィンのアイコンがまだ並ばない', !breederText.includes('（ハロウィン）'));
    await ctx.close();
  }

  // ===== ③ 終わったあと =====
  {
    const { page, ctx } = await open('2026-11-01T04:00:00+09:00');
    await goShop(page, 'ビートP');
    check('③ 終わったあとは、ビートP交換所に「アイコン」タブが無い', !(await tabs(page)).includes('アイコン'));
    await goShop(page, 'ブリーダー');
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText||'').trim() === '確認'); if (b) b.click(); });
    await page.waitForTimeout(600);
    const cards = await iconCards(page);
    check('③ ブリーダーP交換所に4キャラ(ハロウィン)が1ptで並び、買える', cards.every(c => c.found && c.buyEnabled && /\b1\b/.test(c.text)), cards.map(c => `${c.name}:${c.found}:${c.buyEnabled}:${c.text.slice(0, 40)}`).join(' | '));
    await ctx.close();
  }

  check('実行時エラーが出ていない', fatal.length === 0, fatal.slice(0, 2).join(' | '));
  await browser.close();
  const ng = results.filter(r => !r).length;
  console.log(ng === 0 ? '\nすべてOK' : `\n${ng}件NG`);
  process.exit(ng === 0 ? 0 : 1);
})();
