// MFバトルカード: カードを2回続けてタップしても詳しい画面が出る(2026-10-26 社長「ダブルタップでも見られるように」)。
// デッキ編成はダブルタップにせず、各カードの小さな「i」で詳しい画面(社長「デッキ編成は詳細ボタンを作る」)。実際のブラウザで確かめる。
//
//   node tools/card/card-double-tap-browser-check.js
//
// 見るもの
//   ① 対戦の手札を2回続けてタップすると詳しい画面が出て、1回目で選んだ技は選ばれたまま残らない
//   ② 手札を1回タップすると、今までどおり技が選ばれるだけ(詳しい画面は出ない)
//   ③ 相手のモンスターを2回続けてタップすると詳しい画面が出る
//   ④ 技を選んで、狙える相手を1回タップすると、待たずに技が出る(1回目は待たない。2026-10-27 部長ソランドくん)
//   ⑤ デッキ編成のカードを続けて2回タップすると2枚入る(詳しい画面は出ない。「i」ボタンはデッキくんの card-deck 検査が見る)
//   ⑥ 押せるカードは touch-action: manipulation(iPhone の Safari がダブルタップで拡大しない)。実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { quietBootSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8948;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
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
  try { playwright = require(path.join(root, 'tools', 'node_modules', 'playwright')); } catch { try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); } }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route(/supabase\.co\//, (r) => (r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })));
    await ctx.addInitScript(() => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
      s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
      s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
      // 確かめの窓(使う？)は出さない。相手は考える時間を短く
      s('mh_card_settings_v1', { confirmUse: 'OFF', confirmEnd: 'OFF', think: 'fast' });
    });
    await ctx.addInitScript(quietBootSeed());
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
    const detailOpen = async () => (await page.locator('[data-card-detail]').count()) > 0;
    const closeDetail = async () => { if (await detailOpen()) { await page.locator('[data-card-detail]').click({ position: { x: 10, y: 10 } }).catch(() => {}); await sleep(250); } };
    // 2回続けてタップ(間 80ms)
    const doubleTap = async (loc) => { await loc.click({ timeout: 5000 }); await sleep(80); await loc.click({ timeout: 5000 }); await sleep(500); };

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

    // ⑤ デッキ編成
    await page.locator('[data-card-decks]').click();
    await page.locator('[data-card-deck-list]').waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /^組む$/ }).first().click();
    await page.locator('[data-card-deck-pick]').first().waitFor({ timeout: 10000 });
    // 1枚も入っていない、入れられるカードを探す(− が押せず ＋ が押せる)
    const pickNo = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[data-card-deck-pick]')].find((d) => d.querySelector('[data-card-deck-minus]:disabled') && d.querySelector('[data-card-deck-plus]:not(:disabled)'));
      return el ? el.getAttribute('data-card-deck-pick') : null;
    });
    if (!pickNo) {
      // スターターは50枚で一杯なので、先頭の入っているカードを2枚外してから試す
      const first = page.locator('[data-card-deck-minus]:not([disabled])').first();
      await first.click(); await sleep(150); await first.click(); await sleep(150);
    }
    const no5 = pickNo || await page.evaluate(() => { const el = [...document.querySelectorAll('[data-card-deck-pick]')].find((d) => d.querySelector('[data-card-deck-plus]:not(:disabled)')); return el ? el.getAttribute('data-card-deck-pick') : null; });
    const inOf = async () => Number((await page.locator(`[data-card-deck-in="${no5}"]`).innerText()).split('/')[0]);
    const in0 = await inOf();
    await doubleTap(page.locator(`[data-card-deck-pick="${no5}"] [data-card-deck-tile]`));
    const in1 = await inOf();
    check('⑤ デッキ編成のカードを続けて2回タップすると2枚入り、詳しい画面は出ない', in1 === Math.min(in0 + 2, Number((await page.locator(`[data-card-deck-in="${no5}"]`).innerText()).split('/')[1])) && !(await detailOpen()), `${in0} → ${in1}・詳しい画面 ${await detailOpen()}`);
    const ta = await page.evaluate(() => getComputedStyle(document.querySelector('[data-card-deck-tile]')).touchAction);
    check('⑥ 押せるカードは touch-action: manipulation', ta === 'manipulation', ta);
    await page.getByRole('button', { name: /^やめる$/ }).click().catch(() => {});
    await sleep(300);
    await page.getByRole('button', { name: /^保存せずに戻る$/ }).click().catch(() => {});
    await sleep(500);
    for (let i = 0; i < 3 && !(await page.locator('[data-card-top="top"]').count()); i++) { await page.locator('[data-mh-screen] header button').first().click().catch(() => {}); await sleep(600); }

    // ①〜④ 対戦
    await page.locator('[data-card-cpu]').first().click(); await sleep(300);
    await page.locator('[data-card-mode-assistant]').click();
    await page.locator('[data-card-foe="mua"]').click(); await sleep(200);
    await page.locator('[data-card-level="easy"]').click().catch(() => {});
    await page.locator('[data-card-start]').click();
    for (let i = 0; i < 40 && !(await page.locator('[data-card-battle]').count()); i++) { if (i > 6) await page.mouse.click(195, 420); await sleep(300); }
    const mode = () => page.locator('[data-card-battle]').getAttribute('data-card-mode').catch(() => null);
    // 自分の攻撃の番まで進める(始める前のガッツ・相手の番は待つ・守りは「守らない」)
    for (let i = 0; i < 120; i++) {
      const m = await mode();
      if (m === 'attack' && (await page.locator('[data-card-hand-card]:not(.opacity-45)').count())) break;
      if (m === 'setup') await page.locator('[data-card-footer] button').first().click().catch(() => {});
      else if (m === 'guard') await page.getByRole('button', { name: /^守らない$/ }).click().catch(() => {});
      else if (m === 'attack') await page.getByRole('button', { name: /攻撃おわり/ }).click().catch(() => {});
      else if (m === 'guts') await page.locator('[data-card-footer] button').first().click().catch(() => {});
      await sleep(400);
    }
    check('自分の攻撃の番(使える技がある)まで進む', (await mode()) === 'attack');
    const usable = page.locator('[data-card-hand-card]:not(.opacity-45)').first();
    const raised = () => page.evaluate(() => [...document.querySelectorAll('[data-card-hand-card] img')].some((im) => /outline-amber-300/.test(im.className)));
    await doubleTap(usable);
    check('① 手札を2回続けてタップすると、詳しい画面が出る', await detailOpen());
    await closeDetail();
    check('① 1回目で選んだ技は、選ばれたまま残らない', !(await raised()));
    await usable.click(); await sleep(600);
    check('② 手札を1回タップすると、技が選ばれるだけ(詳しい画面は出ない)', (await raised()) && !(await detailOpen()));
    // 狙える相手(赤い輪)。使う子を選ぶ段なら、黄色い輪の子を先に押す
    for (let i = 0; i < 3 && !(await page.locator('[data-card-mon^="1-"].ring-rose-400').count()); i++) {
      const u = page.locator('[data-card-mon^="0-"].ring-amber-300').first();
      if (await u.count()) { await u.click(); await sleep(600); } else break;
    }
    const target = page.locator('[data-card-mon^="1-"].ring-rose-400').first();
    await target.waitFor({ timeout: 3000 }).catch(() => {}); // 赤い輪は少し遅れて出ることがある
    const discard0 = await page.locator('[data-card-battle]').innerText();
    const hand0 = await page.locator('[data-card-hand-card]').count();
    if (await target.count()) {
      // 1回目のタップは待たずにすぐ効く(2026-10-27 部長ソランドくん)。狙える相手を押すと、その場で技が出る
      await target.click(); await sleep(1500);
      check('③④ 狙える相手を1回タップすると、待たずに技が出る(手札が減る)', (await page.locator('[data-card-hand-card]').count()) < hand0 || (await page.locator('[data-card-battle]').innerText()) !== discard0, `${hand0} → ${await page.locator('[data-card-hand-card]').count()}`);
    } else check('③ 狙える相手が出る', false, '赤い輪の相手が見つからない');
    const opp = page.locator('[data-card-mon^="1-"]').first();
    await doubleTap(opp);
    check('③ 相手のモンスターを2回続けてタップすると、詳しい画面が出る', await detailOpen());
    await closeDetail();
    check('⑥ 実行時エラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('途中で止まらずに最後まで進む', false, String(e && e.message || e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
