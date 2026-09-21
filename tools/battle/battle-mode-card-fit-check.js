const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// モード選択のカード(BATTLE_MODE_SELECT)が、いちばん小さい端末でも崩れずに読めるかを実ブラウザで測る。
//
//   node tools/battle/battle-mode-card-fit-check.js
//
// 【なぜ要るか】
// 2026-09-21 にユーザーから「文字列が悪い」と写真つきで報告された。
//   ・モード名が長すぎて見出しが2行に折り返していた(「タクティクス種族チャ／レンジ」)
//   ・カードの中のボタン「🏆 タクティクス種族チャレンジのランキング」が横にあふれて切れていた
// どちらもエラーは出ず、大きい端末では気づけない。カードの中の幅は 176px しかないので、
// 名前を1つ長くするだけで簡単にこうなる。
//
// 【測るもの】
//   ① モードカードの見出しが1行に収まる(折り返さない)
//   ② カードの中のボタンの文字が切れない(横にあふれていない)
//   ③ カードの中身がカードの下からはみ出さない
//
// 見ているのは**画面の中央にいるカード**。カルーセルは同じ並びを3組つないでいるので、
// 端の組は縮んで表示されており、そのまま測ると別の数字になる。
const path = require('path');
const { chromium } = require('playwright');
const { quietBootSeed } = require(path.join(TOOLS_DIR, 'boot/quiet-boot-seed'));

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const VIEWPORTS = [[375, 667], [390, 844]];
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

const seed = () => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_masu_migrated', true);
};

// 画面の中央にいるカードだけを測る
const measureCards = () => {
  const all = [...document.querySelectorAll('[data-battle-mode]')];
  const mid = window.innerWidth / 2;
  const best = {};
  for (const card of all) {
    const id = card.getAttribute('data-battle-mode');
    const rect = card.getBoundingClientRect();
    if (rect.width < 10) continue;
    const dist = Math.abs(rect.left + rect.width / 2 - mid);
    if (!best[id] || dist < best[id].dist) best[id] = { card, dist };
  }
  return Object.keys(best).map((id) => {
    const card = best[id].card;
    const cardRect = card.getBoundingClientRect();
    const head = card.querySelector('h3');
    const headRect = head ? head.getBoundingClientRect() : null;
    const lineHeight = head ? parseFloat(getComputedStyle(head).lineHeight) : 0;
    const cut = [...card.querySelectorAll('button')].map((b) => {
      // 文字は中の span が持っていることがある(whitespace-nowrap で横へあふれる)
      const inner = b.querySelector('span') || b;
      const rect = b.getBoundingClientRect();
      return {
        text: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24),
        cut: inner.scrollWidth > inner.clientWidth + 1,
        below: Math.round(rect.bottom - cardRect.bottom),
      };
    }).filter((b) => b.cut || b.below > 0);
    return {
      id,
      title: head ? head.innerText.replace(/\s+/g, ' ').trim() : '',
      lines: headRect && lineHeight ? Math.round(headRect.height / lineHeight) : 0,
      cut,
    };
  });
};

const openHome = async (page) => {
  const pointerDown = (sel) => page.evaluate((s) => {
    const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`)
      : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, sel);
  await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
  await pointerDown({ text: 'TAP TO START' });
  await page.waitForTimeout(2500);
  await pointerDown({ aria: 'トップ画面へ進む' });
  await page.waitForTimeout(2500);
  // お知らせが重なっていたら、ダイアログの中だけを押して閉じる
  for (let i = 0; i < 8; i++) {
    const closed = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return false;
      const b = [...dialog.querySelectorAll('button')].find(x => /受け取|閉じる|あとで|スキップ|確認|OK/.test(x.textContent));
      if (b) b.click();
      return !!b;
    });
    await page.waitForTimeout(600);
    if (!closed) break;
  }
  // 告知からよその画面へ飛んでいることがあるので、HOMEへ戻るまで「戻る」を押す
  for (let i = 0; i < 6; i++) {
    if (await page.evaluate(() => !!document.querySelector('button[aria-label="モンヒロバトル"]'))) break;
    await page.evaluate(() => { document.querySelector('button[aria-label="戻る"]')?.click(); });
    await page.waitForTimeout(800);
  }
};

// 公開前の仕組み(タクティクス)は、デバッグのバトルモードからしか開けない
const openDebugBattle = async (page) => {
  await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
  await page.locator('footer button[aria-label=""]').dispatchEvent('click');
  await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
  await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
  await page.locator('[data-debug-battle-mode]').dispatchEvent('click');
  await page.waitForTimeout(1500);
};

const openSystem = async (page, systemId) => {
  await page.evaluate((id) => { document.querySelector(`[data-battle-system="${id}"]`)?.click(); }, systemId);
  await page.waitForTimeout(1600);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium',
  });
  for (const [width, height] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.addInitScript(seed);
    await page.addInitScript(quietBootSeed());
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await openHome(page);
    // 公開中の仕組みも、公開前の仕組みも、同じデバッグの入口からまとめて見る
    await openDebugBattle(page);
    // クイックは中のモードが1つだけで、モード選択を飛ばして難易度へ直行する(direct)ので対象外
    for (const systemId of ['systemClassic', 'systemTactics']) {
      await openSystem(page, systemId);
      const cards = await page.evaluate(measureCards);
      if (!cards.length) { check(`${width}px ${systemId}: カードが出る`, false, 'カードが見つからない'); continue; }
      for (const card of cards) {
        check(`${width}px ${card.id}: 見出しが1行に収まる`, card.lines === 1, `「${card.title}」${card.lines}行`);
        check(`${width}px ${card.id}: カードの中の文字が切れない`, card.cut.length === 0,
          card.cut.map(b => `${b.text}${b.cut ? '(横に切れ)' : ''}${b.below > 0 ? `(下へ${b.below}px)` : ''}`).join(' / '));
      }
      await page.evaluate(() => { document.querySelector('button[aria-label="戻る"]')?.click(); });
      await page.waitForTimeout(1400);
    }
    await page.close();
  }
  await browser.close();
  const ng = results.filter(ok => !ok).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
