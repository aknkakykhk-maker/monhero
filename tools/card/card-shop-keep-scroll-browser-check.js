// MFバトルカードの売り場で、下のほうのパック・スターターを買って開ける画面から戻ると、一覧のいちばん上に戻されていた
// (2026-10-30 社長「パックを買って戻ったら上に戻される」)。開ける画面へ行くと売り場ごと消えるので、タブも最初に戻っていた。
//
//   node tools/card/card-shop-keep-scroll-browser-check.js
//
//   縦(390×844)・横(844×390)の両方で
//   ① パックのタブで、いちばん下のパックを買って開け、閉じて戻ると、パックのタブのまま、そのパックが一覧の中に見えている
//   ② スターターのタブで、いちばん下の持っていないスターターを買って戻ると、スターターのタブのまま、そのスターターが見えている
//   ③ ふつうにマーケットを出て入り直したときは、いちばん上・最初のタブから(覚えた位置は1回だけ使う)
//   ④ 実行時エラーが無い。本物へは何も送らない(Supabase は全部偽物)
const http = require('http');
const path = require('path');
const fs = require('fs');
const { quietBootSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8957;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require(path.join(root, 'tools', 'node_modules', 'playwright')); } catch { try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていない'); return; } }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    for (const vp of [{ width: 390, height: 844, name: '縦' }, { width: 844, height: 390, name: '横' }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.route(/supabase\.co\//, (r) => r.fulfill({ status: r.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' }));
    await ctx.addInitScript(() => {
      if (localStorage.getItem('mh_breeder_name')) return;
      const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
      s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
      s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
    });
    await ctx.addInitScript(quietBootSeed());
    const open = async () => {
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(String(e)));
      const sleep = (ms) => page.waitForTimeout(ms);
      const dismiss = async () => {
        for (let i = 0; i < 8; i++) {
          const b = page.getByRole('button', { name: /^(受け取る|閉じる|はじめる|OK|スキップ|あとで読む)$/ }).first();
          if (await b.count() === 0 || !(await b.isVisible().catch(() => false))) break;
          await b.dispatchEvent('click').catch(() => {}); await sleep(250);
        }
      };
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = page.getByRole('button', { name: 'トップ画面へ進む' });
      const home = page.locator('[data-home-card-battle]');
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.click().catch(() => {}); await dismiss(); await sleep(500); }
      for (let i = 0; i < 4; i++) { await sleep(500); await dismiss(); }
      await home.click();
      await page.locator('[data-card-top]').first().waitFor({ timeout: 20000 });
      await sleep(600); await dismiss();
      if (await page.locator('[data-card-top="starter"]').count()) {
        await page.locator('[data-card-kit="speed"]').click();
        await page.getByRole('button', { name: /にする$/ }).click();
        await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
        await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
        await page.locator('[data-card-quit]').click();
        await page.getByRole('button', { name: /^飛ばす$/ }).last().click();
        await page.locator('[data-card-top="result"]').waitFor({ timeout: 15000 });
        await page.getByRole('button', { name: /トップへ/ }).first().click();
        await page.locator('[data-card-top="top"]').waitFor({ timeout: 15000 });
      }
      return { page, sleep, dismiss };
    };
    const t = await open();
    const { page, sleep } = t;
    const shop = page.locator('[data-card-shop]');
    const enter = async () => { await page.locator('[data-card-market-open]').click(); await shop.waitFor({ timeout: 15000 }); await sleep(700); };
    // 一覧の中に見えているか(上下とも一覧の枠の内側に、少しでもかかっていればよい)
    const seen = (sel) => page.evaluate((sel) => {
      const box = document.querySelector('[data-card-shop]'), row = document.querySelector(sel);
      if (!box || !row) return { ok: false, why: '無い' };
      const b = box.getBoundingClientRect(), r = row.getBoundingClientRect();
      return { ok: r.bottom > b.top + 8 && r.top < b.bottom - 8, top: Math.round(box.scrollTop), tab: box.getAttribute('data-card-shop-tab') };
    }, sel);
    const scrollTo = (sel) => page.evaluate((sel) => {
      const box = document.querySelector('[data-card-shop]'), row = document.querySelector(sel);
      box.scrollTop = row.offsetTop - box.offsetTop - 20; return box.scrollTop;
    }, sel);
    const pressBuy = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].reverse().find((x) => /^(買う|購入する|はい|開ける|買って開ける|交換する)$/.test(x.textContent.trim())); if (b) b.click(); return !!b; });
    const goMarketTop = async () => {
      // 売り場から MFバトルカードのトップへ戻る(左上の戻る)
      await page.getByRole('button', { name: /^(戻る|もどる|←|トップへ)/ }).first().click().catch(() => {});
      await page.locator('[data-card-top="top"]').waitFor({ timeout: 15000 });
    };
    await page.evaluate(() => localStorage.setItem('mh_rhythm_event_points_v1', '999999'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    { const top = page.getByRole('button', { name: 'トップ画面へ進む' }); const home = page.locator('[data-home-card-battle]');
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.click().catch(() => {}); await t.dismiss(); await sleep(500); }
      for (let i = 0; i < 4; i++) { await sleep(500); await t.dismiss(); }
      await home.click(); await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 }); await sleep(500); await t.dismiss(); }

    // ① パック
    await enter();
    const lastPack = await page.evaluate(() => { const r = [...document.querySelectorAll('[data-card-shop-packs] [data-card-shop-pack]')]; return r.length ? r[r.length - 1].getAttribute('data-card-shop-pack') : null; });
    const packSel = `[data-card-shop-pack="${lastPack}"]`;
    const before = await scrollTo(packSel);
    check(`${vp.name}: ① いちばん下のパックまで一覧を送れる(${lastPack})`, !!lastPack && before > 50, `scrollTop=${before}`);
    await page.locator(`[data-card-shop-buy="${lastPack}-1"]`).click(); await sleep(400);
    check(`${vp.name}: ① 確認の窓で買える`, await pressBuy());
    await require(path.join(__dirname, 'lib/starter-open-pass.js'))(page);
    await shop.waitFor({ timeout: 15000 }); await sleep(800);
    const p1 = await seen(packSel);
    check(`${vp.name}: ① 戻るとパックのタブのまま、買ったパックが見えている`, p1.ok && p1.tab === 'pack', JSON.stringify(p1));

    // ② スターター
    await page.getByRole('tab', { name: 'スターター' }).click().catch(async () => page.getByRole('button', { name: 'スターター' }).first().click()); await sleep(600);
    const kit = await page.evaluate(() => { const r = [...document.querySelectorAll('[data-card-shop-starter]:not([data-card-shop-starter-owned])')].filter((el) => el.querySelector('[data-card-shop-starter-buy]:not([disabled])')); return r.length ? r[r.length - 1].getAttribute('data-card-shop-starter') : null; });
    if (!kit) check(`${vp.name}: ② 買えるスターターがある`, false);
    else {
      const kitSel = `[data-card-shop-starter="${kit}"]`;
      const kb = await scrollTo(kitSel);
      await page.locator(`[data-card-shop-starter-buy="${kit}"]`).click(); await sleep(400);
      check(`${vp.name}: ② スターターの確認の窓で買える`, await pressBuy());
      await require(path.join(__dirname, 'lib/starter-open-pass.js'))(page);
      await shop.waitFor({ timeout: 15000 }); await sleep(800);
      const p2 = await seen(kitSel);
      check(`${vp.name}: ② 戻るとスターターのタブのまま、買ったスターターが見えている`, p2.ok && p2.tab === 'starter', `${JSON.stringify(p2)} 押す前 ${kb}`);
    }

    // ③ ふつうに出て入り直す
    await goMarketTop(); await enter();
    const p3 = await page.evaluate(() => { const box = document.querySelector('[data-card-shop]'); return { top: box.scrollTop, tab: box.getAttribute('data-card-shop-tab') }; });
    check(`${vp.name}: ③ 出て入り直すと、いちばん上・パックのタブから`, p3.top === 0 && p3.tab === 'pack', JSON.stringify(p3));
    await page.close();
    await ctx.close();
    }
    check('④ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査が最後まで進む', false, e.message.slice(0, 400));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
