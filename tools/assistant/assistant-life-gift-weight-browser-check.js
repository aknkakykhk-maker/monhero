// 助手ライフの「友情Lv・仲良し度の説明と数字の重み」と「交換所へ飛べる入口」を、実際に開いて確かめる(2026-11-08 社長・遊ぶ人の提案)
//   node tools/assistant/assistant-life-gift-weight-browser-check.js           検査
//   node tools/assistant/assistant-life-gift-weight-browser-check.js --shots   止め絵も撮る(docs/progress/assistant-peer/gifts/weight/)
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る(公開後の確かめ)
//   ① 道具タブ: 一覧の上に「🤝 友情Lv=贈った2人の助手どうし」「💗 仲良し度=あなたとその助手」の説明・一覧の下に「🛒 交換所で手に入れる」
//   ② 贈るシート: 説明・2人それぞれの仲良し度と2人の友情Lv に、次の段まで(あと何点・段の何割)と上がると起きることが出る
//   ③ 縦 390×844・375×667・横 844×390・🔄横 667×375 で、説明と重みの文字が切れない・はみ出さない・ボタンに重ならない。「贈る」は送らずに押せる
//   ④ 道具タブの「🛒 交換所で手に入れる」→ ビートP交換所の「アイテム」タブが開き、2人に贈る道具が並ぶ → 戻ると助手ライフの道具タブ
//   ⑤ 家具のシートの「🛒 交換所の家具の棚へ」→「家具」タブ → 戻るとその助手の部屋と家具のシート
//   ⑥ ページのエラーが出ない
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9241;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, waitFaces } = require(path.resolve(__dirname, 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/gifts/weight');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 切れ・はみ出し・重なりを数える(sel の中の文字の入った要素)
const cutProblems = (page, sel) => page.evaluate((s) => {
  const ng = [];
  const box = document.querySelector(s); if (!box) return ['見つからない'];
  for (const el of box.querySelectorAll('p, span, b, button')) {
    if (!el.getClientRects().length || !el.textContent.trim()) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (r.left < -1 || r.right > innerWidth + 1) ng.push(`はみ出す「${el.textContent.trim().slice(0, 16)}」`);
    if (cs.overflow !== 'visible' && el.scrollWidth > el.clientWidth + 1 && !el.classList.contains('truncate')) ng.push(`切れる「${el.textContent.trim().slice(0, 16)}」`);
    if (/…$/.test(el.textContent.trim())) ng.push(`…で終わる「${el.textContent.trim().slice(0, 16)}」`);
  }
  // 重みの文と説明が、ボタンに重ならない(下に貼り付けた やめる・贈る の段は不透明で、その後ろを文が送られるだけなので除く)
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const texts = [...box.querySelectorAll('[data-assistant-life-give-weight] p, [data-assistant-life-gift-explain] p')];
  for (const t of texts) for (const b of box.querySelectorAll('button')) if (!b.closest('[data-assistant-life-give-actions]') && b.getClientRects().length && hit(t.getBoundingClientRect(), b.getBoundingClientRect())) ng.push(`ボタンに重なる「${t.textContent.slice(0, 12)}」`);
  return [...new Set(ng)];
}, sel);

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const open = async (w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${w}x${h}: ${e}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: 130 });
    await page.addInitScript(() => {
      const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeFurniture = true; clearInterval(t); } } catch {} }, 2);
      if (localStorage.getItem('mh_check_weight') === null) { localStorage.setItem('mh_check_weight', '1'); const o = JSON.parse(localStorage.getItem('mh_owned_items') || '{}');
        Object.assign(o, { peer_gift: 2, peer_cake: 1, furn_sofa: 1 }); delete o.peer_onigiri; localStorage.setItem('mh_owned_items', JSON.stringify(o)); }
    });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page);
    return page;
  };
  // HOME の助手どうしのおしゃべりの帯(タップで次へ・2026-11-08 社長)が出ていると押せないので、帯の「閉じる」を押してから押す
  const openHouse = async (page) => { for (let i = 0; i < 5; i++) { const pc = page.locator('[data-assistant-peer-close]'); if (await pc.count()) await pc.first().click({ timeout: 2000 }).catch(() => {}); try { await page.locator('[data-home-assistant-life]').click({ timeout: 4000 }); break; } catch (e) { if (i === 4) throw e; await page.waitForTimeout(800); } } await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {}); await page.waitForTimeout(400); };
  try {
    for (const [w, h, tag, file] of [[390, 844, '縦 390', 'tate'], [375, 667, '縦 375', 'tate375'], [844, 390, '横 844', 'yoko'], [667, 375, '🔄横 667', 'yoko667']]) {
      const page = await open(w, h);
      await openHouse(page);
      // ① 道具タブ
      await page.locator('[data-assistant-life-icon="items"]').click(); await page.waitForTimeout(300);
      const items = await page.locator('[data-assistant-life-items]').innerText().catch(() => '');
      check(`① ${tag}: 道具タブに友情Lv・仲良し度の説明と交換所の入口が出る`, /友情Lv=贈った2人の助手どうしの仲/.test(items) && /仲良し度=あなたとその助手の仲/.test(items) && (await page.locator('[data-assistant-life-items] [data-assistant-life-shop="item"]').count()) >= 2, items.replace(/\s+/g, ' ').slice(0, 80));
      // 右上の時計の札が右端で切れない(🔄横 667 の狭い欄・2026-11-08 ミハリ)
      const clockOk = await page.evaluate(() => { const c = [...document.querySelectorAll('[data-assistant-life-clock-box] [data-time-of-day-clock]')].find(x => x.getClientRects().length); if (!c) return true; const r = c.getBoundingClientRect(); let p = c.parentElement; while (p && getComputedStyle(p).overflow === 'visible') p = p.parentElement; const pr = p ? p.getBoundingClientRect() : { right: innerWidth }; return r.right <= Math.min(innerWidth, pr.right) + 1; });
      check(`③ ${tag}: 右上の時計の札が右端で切れない`, clockOk);
      const cutItems = await cutProblems(page, '[data-assistant-life-items]');
      check(`③ ${tag}: 道具タブの文字が切れない・はみ出さない`, cutItems.length === 0, cutItems.join(','));
      if (SHOTS) { await page.locator('[data-assistant-life-gift-explain]').first().scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shotDir, `${file}-1-items.png`) }); }
      // ② 贈るシート(家の「🎁 贈る」)
      await page.locator('[data-assistant-life-icon="house"]').click(); await page.waitForTimeout(300);
      await page.locator('[data-assistant-life-today-act="give"]').click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400);
      const sheetN = await page.locator('[data-assistant-life-give-sheet]').count();
      if (sheetN) {
        const sheet = await page.locator('[data-assistant-life-give-sheet]').innerText();
        const weights = await page.locator('[data-assistant-life-give-sheet] [data-assistant-life-give-weight]').count();
        check(`② ${tag}: 贈るシートに説明・2人の友情Lv・あなたとの仲良し度の重み(3行)が出る`, /友情Lv=贈った2人/.test(sheet) && /2人の友情Lv/.test(sheet) && /あなたとの仲良し度/.test(sheet) && weights === 3, `${weights}行 ${sheet.replace(/\s+/g, ' ').slice(0, 60)}`);
        check(`② ${tag}: 重みに「あと◯・段の◯%」か「この1回で LvN に！」と、次の段で起きることが出る`, /(あと\d+・\s*この1回で段の\d+(〜\d+)?%|この1回で Lv\d+ に！)/.test(sheet) && /Lv\d+: /.test(sheet), sheet.replace(/\s+/g, ' ').match(/Lv\d+→\d+[^／]*/)?.[0] || '');
        const cutSheet = await cutProblems(page, '[data-assistant-life-give-sheet] > div');
        check(`③ ${tag}: 贈るシートの文字が切れない・はみ出さない・ボタンに重ならない`, cutSheet.length === 0, cutSheet.join(','));
        // 横で説明と重みが増えても、やめる・贈るはシートを送らずに押せる(下に貼り付け)
        const goInView = await page.evaluate(() => { const b = document.querySelector('[data-assistant-life-give-go]'); if (!b) return false; const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return r.bottom <= innerHeight + 1 && r.top >= 0 && b.contains(document.elementFromPoint(x, y)); });
        check(`③ ${tag}: 「贈る」ボタンがシートを送らなくても画面の中で押せる`, goInView);
        // 重みの文で「LvN:」だけが行の終わりに残らない(ことばの途中で割れない)
        const split = await page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-give-weight] p span.inline-block')].filter(x => x.getClientRects().length > 1 && /^／ Lv\d+: /.test(x.textContent) && x.getBoundingClientRect().width < 60).length);
        check(`③ ${tag}: 重みの「LvN: 起きること」が「LvN:」だけ行末に残って割れない`, split === 0, String(split));
        if (SHOTS) await page.screenshot({ path: path.join(shotDir, `${file}-2-sheet.png`) });
        // 持っていない道具を選ぶと「🛒 交換所で手に入れる」
        await page.locator('[data-assistant-life-give-kind="onigiri"]').click().catch(() => {}); await page.waitForTimeout(200);
        check(`④ ${tag}: 持っていない道具を選ぶと、贈るシートに交換所の入口が出る`, (await page.locator('[data-assistant-life-give-sheet] [data-assistant-life-shop="item"]').count()) === 1);
        if (SHOTS) await page.screenshot({ path: path.join(shotDir, `${file}-3-sheet-none.png`) });
        await page.locator('[data-assistant-life-give-cancel]').click().catch(() => {}); await page.waitForTimeout(200);
      } else check(`② ${tag}: 贈るシートが開く`, false);
      // ④ 道具タブ → 交換所 → 戻る
      if (w === 390 || w === 844) {
        await page.locator('[data-assistant-life-icon="items"]').click(); await page.waitForTimeout(250);
        await page.locator('[data-assistant-life-items] [data-assistant-life-shop="item"]').last().click(); await page.waitForTimeout(900);
        const shopTab = await page.locator('[data-event-point-shop]').getAttribute('data-event-point-tab').catch(() => null);
        const shopText = await page.locator('[data-event-point-shop]').innerText().catch(() => '');
        check(`④ ${tag}: 交換所の「アイテム」タブが開き、2人に贈る道具が並ぶ(助手ライフは閉じている)`, shopTab === 'item' && /おやつバスケット/.test(shopText) && (await page.locator('[data-assistant-life-screen]').count()) === 0, `${shopTab}`);
        const giftInView = await page.evaluate(() => { const el = document.querySelector('[data-event-point-life-gift]'); if (!el) return false; const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; });
        check(`④ ${tag}: 交換所では、2人に贈る道具の札まで送られて見えている`, giftInView);
        if (SHOTS) await page.screenshot({ path: path.join(shotDir, `${file}-4-shop.png`) });
        await page.getByRole('button', { name: /戻る/ }).first().click(); await page.waitForTimeout(900);
        check(`④ ${tag}: 交換所から戻ると助手ライフの道具タブ`, (await page.locator('[data-assistant-life-icon="items"][aria-selected="true"]').count()) === 1);
        // ⑤ 家具のシート → 家具の棚 → 戻る
        await page.locator('[data-assistant-life-icon="house"]').click(); await page.waitForTimeout(250);
        await page.locator('[data-assistant-life-room="atsu"]').click(); await page.waitForTimeout(250);
        await page.locator('[data-assistant-life-room-act="furn"]').click(); await page.waitForTimeout(300);
        await page.locator('[data-assistant-life-furn-sheet] [data-assistant-life-shop="furniture"]').click(); await page.waitForTimeout(900);
        const furnTab = await page.locator('[data-event-point-shop]').getAttribute('data-event-point-tab').catch(() => null);
        check(`⑤ ${tag}: 家具のシートから交換所の「家具」タブが開く`, furnTab === 'furniture', String(furnTab));
        await page.getByRole('button', { name: /戻る/ }).first().click(); await page.waitForTimeout(900);
        check(`⑤ ${tag}: 戻るとその助手の部屋と家具のシート`, (await page.locator('[data-assistant-life-furn-sheet="atsu"]').count()) === 1);
      }
      await page.close();
    }
    check('⑥ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { console.log('NG: 途中で止まった —', e.message.split('\n').slice(0, 9).join(' ')); failed++; }
  await browser.close(); server.close();
  console.log(failed ? `NG ${failed}件` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
