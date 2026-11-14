// 🧸 モンスターのぬいぐるみ(r1115-035・好き・苦手の gift・color をオクリモノに付ける)を、実際に開いて確かめる
//   node tools/assistant/life-taste-gift-browser-check.js           検査
//   node tools/assistant/life-taste-gift-browser-check.js --shots   止め絵も撮る(docs/progress/assistant-peer/taste-change/gift-shots/)
//   ① 好き嫌いの印 assistantLifeTaste が偽なら、1人に贈る窓に 🧸 が並ばない
//   ② 印が真: 🧸 を選ぶと「どのモンスター・リボンの色」の小窓が出る。モンスターの一覧が開いて選べる。好きな色を選ぶと「もう少し好きになります」
//   ③ 贈ると: 持ち物が1つ減る・mh_assistant_life_taste_gift_v1 に選んだもの・mh_assistant_life_taste_v1 にそのモンスターの点が足される(gift + color)
//   ④ 縦 390・横 844・🔄横 667 で小窓の字が切れない・「贈る」がシートを送らずに押せる
//   ⑤ ページのエラーが出ない
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9251;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/taste-change/gift-shots');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const cutProblems = (page, sel) => page.evaluate((s) => {
  const ng = [];
  const box = document.querySelector(s); if (!box) return ['見つからない'];
  for (const el of box.querySelectorAll('p, span, b, button')) {
    if (!el.getClientRects().length || !el.textContent.trim()) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (r.left < -1 || r.right > innerWidth + 1) ng.push(`はみ出す「${el.textContent.trim().slice(0, 16)}」`);
    if (cs.overflow !== 'visible' && el.scrollWidth > el.clientWidth + 1 && !el.classList.contains('truncate')) ng.push(`切れる「${el.textContent.trim().slice(0, 16)}」`);
  }
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
  const open = async (w, h, on) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${w}x${h}: ${e}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: 130 });
    await page.addInitScript((flag) => {
      const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeSolo = true; RELEASE_FLAGS.assistantLifeTaste = !!flag; clearInterval(t); } } catch {} }, 2);
      if (localStorage.getItem('mh_check_plush') === null) { localStorage.setItem('mh_check_plush', '1'); const o = JSON.parse(localStorage.getItem('mh_owned_items') || '{}');
        Object.assign(o, { solo_monplush: 2, solo_candy: 1 }); localStorage.setItem('mh_owned_items', JSON.stringify(o)); }
    }, on);
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page);
    return page;
  };
  const openHouse = async (page) => { for (let i = 0; i < 5; i++) { const pc = page.locator('[data-assistant-peer-close]'); if (await pc.count()) await pc.first().click({ timeout: 2000 }).catch(() => {}); try { await page.locator('[data-home-assistant-life]').click({ timeout: 4000 }); break; } catch (e) { if (i === 4) throw e; await page.waitForTimeout(800); } } await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {}); await page.waitForTimeout(400); };
  const groupRoom = (page) => page.evaluate(() => { try { const gs = (ASSISTANT_LIFE_STORE.state.life.groups || []).filter(g => g.ids.length === 2); const g = gs.find(x => !document.querySelector(`[data-assistant-life-room="${x.ids[0]}"] [data-assistant-life-rel]`)) || gs[0]; return g ? g.ids[0] : null; } catch { return null; } });
  const openSolo = async (page) => {
    await openHouse(page);
    const id = await groupRoom(page);
    if (!id) return null;
    await page.locator(`[data-assistant-life-room="${id}"]`).click(); await page.waitForTimeout(300);
    await page.locator('[data-assistant-life-room-act="give-solo"]').click(); await page.waitForTimeout(400);
    return id;
  };
  try {
    // ⓪ 品の表(交換所の値段・印・道具の表・持ち物)
    {
      const page = await open(390, 844, true);
      const d = await page.evaluate(() => ({ offer: RHYTHM_EVENT_POINT_SHOP_OFFERS.find(o => o.itemId === 'solo_monplush') || null, def: ASSISTANT_LIFE_SOLO_GIFTS.find(g => g.key === 'monplush') || null, item: BREEDER_MARKET_ITEMS.find(x => x.id === 'solo_monplush') || null }));
      check('⓪ 交換所の「モンスターのぬいぐるみ」は 300P・好き嫌いの印 assistantLifeTaste の後ろ', !!d.offer && d.offer.cost === 300 && d.offer.releaseFlag === 'assistantLifeTaste' && d.offer.grantAmount === 1, JSON.stringify(d.offer));
      check('⓪ 1人用の道具の表と持ち物にある(仲良し度 +40)', !!d.def && d.def.itemId === 'solo_monplush' && d.def.player === 40 && !!d.item && d.item.shop === false);
      await page.close();
    }
    // ① 印が偽
    {
      const page = await open(390, 844, false);
      const id = await openSolo(page);
      check('① 印が偽なら、1人に贈る窓に 🧸 が並ばない', !!id && (await page.locator('[data-assistant-life-give-sheet]').count()) === 1 && (await page.locator('[data-assistant-life-give-kind="monplush"]').count()) === 0);
      await page.close();
    }
    // ②③ 縦 390 で通しで
    {
      const page = await open(390, 844, true);
      const id = await openSolo(page);
      check('② 一緒にいる組の助手に1人で贈る窓が開く', !!id);
      check('② 印が真なら 🧸 が並ぶ', (await page.locator('[data-assistant-life-give-kind="monplush"]').count()) === 1);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'tate-1-before.png') });
      await page.locator('[data-assistant-life-give-kind="monplush"]').click(); await page.waitForTimeout(250);
      check('② 🧸 を選ぶと、モンスター・リボンの色を選ぶ小窓が出る', (await page.locator(`[data-assistant-life-plush-picker="${id}"]`).count()) === 1 && (await page.locator('[data-assistant-life-plush-color-pick]').count()) >= 10);
      // 好きな色ではないモンスターの段がはっきりする子を選ぶ(その助手のマスモンの種類の先頭以外)
      const plan = await page.evaluate((aid) => ({ fav: atgFavColors(aid)[0], list: atgMonList(aid) }), id);
      await page.locator('[data-assistant-life-plush-open]').click(); await page.waitForTimeout(250);
      check('② モンスターの一覧が開く', (await page.locator('[data-assistant-life-plush-pick]').count()) >= 10);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'tate-2-pick-monster.png') });
      const mon = plan.list[plan.list.length - 1];
      await page.locator(`[data-assistant-life-plush-pick="${mon}"]`).click(); await page.waitForTimeout(200);
      check('② 選んだモンスターが小窓に出る・一覧は閉じる', (await page.locator(`[data-assistant-life-plush-mon="${mon}"]`).count()) === 1 && (await page.locator('[data-assistant-life-plush-list]').count()) === 0);
      await page.locator(`[data-assistant-life-plush-color-pick="${plan.fav}"]`).click(); await page.waitForTimeout(200);
      check('② 好きな色を選ぶと「もう少し好きになります」', (await page.locator('[data-assistant-life-plush-fav]').count()) === 1);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'tate-3-pick-color.png') });
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_owned_items') || '{}'));
      check('③ 「贈る」が押せる', !(await page.locator('[data-assistant-life-give-go]').isDisabled()));
      await page.locator('[data-assistant-life-give-go]').click(); await page.waitForTimeout(900);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'tate-4-after.png') });
      const talk = await page.locator('body').innerText();
      check('③ 助手のひとことに、選んだモンスターのぬいぐるみの名前が出る', talk.includes(`${await page.evaluate((m) => ALL_PLAYER_MONSTERS[m].name, mon)}のぬいぐるみ`));
      await finishTalk(page); await page.waitForTimeout(1200);
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_owned_items') || '{}'));
      const tg = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_assistant_life_taste_gift_v1') || 'null'));
      const ts = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_assistant_life_taste_v1') || 'null'));
      check('③ 持ち物が1つ減る', after.solo_monplush === before.solo_monplush - 1, `${before.solo_monplush}→${after.solo_monplush}`);
      check('③ 選んだもの(モンスター・色)が新しいキーに残る', !!tg && tg.last && tg.last[id] && tg.last[id].mon === mon && tg.last[id].color === plan.fav && tg.n[id] === 1, JSON.stringify(tg));
      const pts = ts && ts.by && ts.by[id] && ts.by[id].mon ? ts.by[id].mon[mon] : 0;
      const k = ts && ts.by && ts.by[id] && ts.by[id].day && ts.by[id].day.m[mon] ? ts.by[id].day.m[mon] : null;
      check('③ そのモンスターの好みの点が上がる(gift + 好きな色の color)', pts > 0 && !!k && k.up > 5, JSON.stringify({ pts, k }));
      await page.close();
    }
    // ④ 縦・横・🔄横
    for (const [w, h, tag, file] of [[390, 844, '縦 390', 'tate'], [844, 390, '横 844', 'yoko'], [667, 375, '🔄横 667', 'yoko667']]) {
      const page = await open(w, h, true);
      const id = await openSolo(page);
      if (!id) { check(`④ ${tag}: 1人に贈る窓が開く`, false); await page.close(); continue; }
      await page.locator('[data-assistant-life-give-kind="monplush"]').click(); await page.waitForTimeout(250);
      await page.locator('[data-assistant-life-plush-open]').click(); await page.waitForTimeout(250);
      const cut = await cutProblems(page, '[data-assistant-life-plush-picker]');
      check(`④ ${tag}: 小窓の字が切れない・はみ出さない`, cut.length === 0, cut.join(','));
      await page.locator('[data-assistant-life-plush-open]').click(); await page.waitForTimeout(200);
      const goInView = await page.evaluate(() => { const b = document.querySelector('[data-assistant-life-give-go]'); if (!b) return false; const r = b.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0; });
      check(`④ ${tag}: 「贈る」がシートを送らずに押せる`, goInView);
      if (SHOTS && w !== 390) await page.screenshot({ path: path.join(shotDir, `${file}-picker.png`) });
      await page.close();
    }
    check('⑤ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { console.log('NG: 途中で止まった —', e.message.split('\n').slice(0, 12).join(' ')); failed++; }
  await browser.close(); server.close();
  console.log(failed ? `NG ${failed}件` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
