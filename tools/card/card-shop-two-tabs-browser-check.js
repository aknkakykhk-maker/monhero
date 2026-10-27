// MFバトルカードの売り場を2つのタブで開き、ほぼ同時にパックを買ったとき、出たカードが必ず保存に入るかを確かめる
// (2026-10-27 カード巡回部: 後から書いた方が先の結果を上書きし、両方のタブにパックが出るのに保存は片方分だけだった)。
//
//   node tools/card/card-shop-two-tabs-browser-check.js
//
//   ① ビートPが1パック分しか無いとき、2つのタブで同時に「買う」を押すと、パックが出るのは片方だけ。もう片方は「足りません」で、
//      所持の表示も保存と同じ数に直る。ビートPはちょうど1パック分減り、持っている枚数はパックの中身(だぶりはビートPへ)と合う
//   ② 2パック分あれば、両方とも買えて、ちょうど2パック分減る(片方の結果がもう片方に上書きされない)
//   ③ 本物へは何も送らない(Supabase は全部偽物)。実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { quietBootSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8955;
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
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route(/supabase\.co\//, (r) => r.fulfill({ status: r.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' }));
    await ctx.addInitScript(() => {
      if (localStorage.getItem('mh_breeder_name')) return;
      const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
      s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
      s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
    });
    await ctx.addInitScript(quietBootSeed());
    // 2つのタブの「読んでから書くまで」が必ず重なるように、保存の書き込みを少し遅らせられる形にする(本体の window.storage の口。中身は localStorage のまま)。
    // 遅らせるのは「買う」を押す直前だけ(window.__mhSlowStore)。ふだんの起動は遅らせない
    await ctx.addInitScript(() => {
      const wait = () => (window.__mhSlowStore ? new Promise((r) => setTimeout(r, 120)) : Promise.resolve());
      window.storage = {
        get: async (k) => { const v = localStorage.getItem(k); return v === null ? null : { value: v }; },
        set: async (k, raw) => { await wait(); localStorage.setItem(k, raw); return { key: k }; },
        list: async (p) => ({ keys: Object.keys(localStorage).filter((k) => k.startsWith(p)) }),
      };
    });
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
        await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
        await page.locator('[data-card-quit]').click();
        await page.getByRole('button', { name: /^飛ばす$/ }).last().click();
        await page.locator('[data-card-top="result"]').waitFor({ timeout: 15000 });
        await page.getByRole('button', { name: /トップへ/ }).first().click();
        await page.locator('[data-card-top="top"]').waitFor({ timeout: 15000 });
      }
      return { page, sleep, dismiss };
    };
    const read = (page) => page.evaluate(() => {
      const g = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
      const col = g('mh_card_collection_v1') || {};
      return { pt: Number(g('mh_rhythm_event_points_v1')) || 0, total: Object.values(col).reduce((a, b) => a + (Number(b) || 0), 0) };
    });
    const A = await open();
    const toConfirm = async (t) => {
      await t.page.locator('[data-card-market-open]').click();
      await t.page.locator('[data-card-shop]').waitFor({ timeout: 15000 }); await t.sleep(600);
      await t.page.locator('[data-card-shop-buy$="-1"]').first().click(); await t.sleep(500);
    };
    const backTop = async (t) => {
      // パックの画面・売り場から、MFバトルカードのトップへ戻る(読み込み直して入り直す)
      await t.page.reload({ waitUntil: 'domcontentloaded' });
      await t.page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = t.page.getByRole('button', { name: 'トップ画面へ進む' });
      const home = t.page.locator('[data-home-card-battle]');
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.click().catch(() => {}); await t.dismiss(); await t.sleep(500); }
      for (let i = 0; i < 4; i++) { await t.sleep(500); await t.dismiss(); }
      await home.click();
      await t.page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
      await t.sleep(500); await t.dismiss();
    };
    const B = await open();
    const packShown = async (t) => (await t.page.locator('[data-card-pack-phase]').count()) > 0;
    const round = async (points) => {
      await A.page.evaluate((n) => localStorage.setItem('mh_rhythm_event_points_v1', String(n)), points);
      await backTop(A); await backTop(B);
      const before = await read(A.page);
      await toConfirm(A); await toConfirm(B);
      await Promise.all([A.page.evaluate(() => { window.__mhSlowStore = true; }), B.page.evaluate(() => { window.__mhSlowStore = true; })]);
      // 2つのページの中から同時に押す(Playwright の click は、ページごとに待ちが入って1秒ほどずれることがある)
      const press = (t) => t.page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(買う|購入する|はい|開ける|買って開ける)$/.test(x.textContent.trim())); if (b) b.click(); return !!b; });
      await Promise.all([press(A), press(B)]);
      await A.sleep(3000);
      const shown = [await packShown(A), await packShown(B)];
      const after = await read(A.page);
      return { before, after, shown };
    };
    // ① 1パック分だけ(3回)
    const price = await A.page.evaluate(() => (typeof CARD_PACKS !== 'undefined' && CARD_PACKS[0] ? CARD_PACKS[0].price : 300));
    for (let i = 0; i < 3; i++) {
      const r = await round(price);
      const other = r.shown[0] ? B : A;
      const otherText = await other.page.evaluate(() => document.body.innerText).catch(() => '');
      check(`① 1パック分のとき、パックが出るのは片方だけ(${i + 1}回目)`, r.shown.filter(Boolean).length === 1, JSON.stringify(r.shown));
      check(`① 出なかったタブは「足りません」で、所持の表示が保存と同じ(${i + 1}回目)`, /足りません/.test(otherText) && new RegExp(`${r.after.pt.toLocaleString()} 所持ビートP`).test(otherText.replace(/\s+/g, ' ')), otherText.replace(/\s+/g, ' ').slice(0, 80));
      check(`① ビートPはちょうど1パック分減る(だぶりのビートPは足される)(${i + 1}回目)`, r.after.pt < r.before.pt && r.after.pt >= 0 && r.after.total > r.before.total - 1, `${JSON.stringify(r.before)} → ${JSON.stringify(r.after)}`);
    }
    // ② 2パック分
    const r2 = await round(price * 2);
    check('② 2パック分あれば、両方とも買える', r2.shown.every(Boolean), JSON.stringify(r2.shown));
    check('② ちょうど2パック分減る(片方の結果が上書きされない)', r2.after.pt < price && r2.after.total > r2.before.total, `${JSON.stringify(r2.before)} → ${JSON.stringify(r2.after)}`);
    check('③ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査が最後まで進む', false, e.message.slice(0, 400));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
