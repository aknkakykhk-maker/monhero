// 助手ライフの「買って贈るを1回で」(2026-11-08 社長 止め絵 docs/progress/assistant-peer/gifts/buygive/)を、実際に開いて確かめる
//   node tools/assistant/assistant-life-buygive-browser-check.js           検査
//   node tools/assistant/assistant-life-buygive-browser-check.js --shots   止め絵も撮る(docs/progress/assistant-peer/gifts/buygive/built/)
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る(公開後の確かめ)
//   ① 贈るシートで持っていない道具を選ぶと「🛒 ◯P で買って贈る」と「持っていない道具も、ここで買って…(所持ビートP)」
//   ② 押すと確かめの窓(毎回): 品名・「ビートP ◯ で買って、そのまま ◯◯ に贈ります」・所持ビートP 前→後・上がる量/[やめる][🛒 買って贈る]
//   ③ 「やめる」ならビートPも持ち物も変わらない
//   ④ 買って贈ると、ビートPは値段ぶんだけ1回引かれ、持ち物は増えも減りもしない(買った1つを贈った)・その日の記録に残る
//   ⑤ 贈った道具をもう一度選ぶと「買って贈る」は出ない(買う前に贈れるか確かめる)
//   ⑥ ビートPが足りなければ「ビートPが足りません(あと◯P)」で押せない
//   ⑦ 1人に贈るシートでも買って贈れる
//   ⑧ 家具のシートに「まだ持っていない家具」。買って贈ると部屋に置かれ、ビートPが値段ぶん減る
//   ⑨ 道具タブの持っていない行に「🛒 ◯P で買って贈る」。押すとその道具を選んだ贈るシート
//   ⑩ 思い出アルバムの「2人にしてあげる」は10種類。持っていない道具から確かめの窓が開く
//   ⑪ 縦 390・横 844・🔄横 667 で、贈るシートと確かめの窓の字が切れない・ボタンが押せる
//   ⑫ ページのエラーが出ない
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9247;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/gifts/buygive/built');
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
const pressable = (page, sel) => page.evaluate((s) => { const b = document.querySelector(s); if (!b) return false; const r = b.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0 && b.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); }, sel);

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
  const open = async (w, h, points = 1240) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${w}x${h}: ${e}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: 130 });
    await page.addInitScript((pts) => {
      if (localStorage.getItem('mh_check_buygive') !== null) return;
      localStorage.setItem('mh_check_buygive', '1');
      const o = JSON.parse(localStorage.getItem('mh_owned_items') || '{}');
      // 持っているのは バスケット・ケーキ だけ。ほかは買って贈る
      for (const k of Object.keys(o)) if (/^(peer_|solo_|furn_)/.test(k)) delete o[k];
      Object.assign(o, { peer_gift: 2, peer_cake: 1 });
      localStorage.setItem('mh_owned_items', JSON.stringify(o));
      localStorage.setItem('mh_rhythm_event_points_v1', JSON.stringify(pts));
    }, points);
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page);
    return page;
  };
  const openHouse = async (page) => { for (let i = 0; i < 5; i++) { const pc = page.locator('[data-assistant-peer-close]'); if (await pc.count()) await pc.first().click({ timeout: 2000 }).catch(() => {}); try { await page.locator('[data-home-assistant-life]').click({ timeout: 4000 }); break; } catch (e) { if (i === 4) throw e; await page.waitForTimeout(800); } } await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {}); await page.waitForTimeout(400); };
  const groupRoom = (page) => page.evaluate(() => { try { const gs = (ASSISTANT_LIFE_STORE.state.life.groups || []).filter(g => g.ids.length === 2); const g = gs.find(x => !document.querySelector(`[data-assistant-life-room="${x.ids[0]}"] [data-assistant-life-rel]`)) || gs[0]; return g ? g.ids[0] : null; } catch { return null; } });
  const openPairSheet = async (page, id) => { await page.locator(`[data-assistant-life-room="${id}"]`).click(); await page.waitForTimeout(300); await page.locator('[data-assistant-life-room-act="give"]').click(); await page.waitForTimeout(400); };
  const points = (page) => page.evaluate(() => Number(JSON.parse(localStorage.getItem('mh_rhythm_event_points_v1') || '0')));
  const owned = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('mh_owned_items') || '{}'));
  const costOf = (page, itemId) => page.evaluate((i) => (RHYTHM_EVENT_POINT_SHOP_OFFERS.find(o => o.itemId === i) || {}).cost, itemId);
  try {
    // ①〜⑦ 縦 390
    {
      const page = await open(390, 844);
      await openHouse(page);
      const id = await groupRoom(page);
      check('一緒にいる組がいる', !!id);
      await openPairSheet(page, id);
      await page.locator('[data-assistant-life-give-kind="onigiri"]').click(); await page.waitForTimeout(250);
      const cost = await costOf(page, 'peer_onigiri');
      const label = await page.locator('[data-assistant-life-give-buy]').innerText().catch(() => '');
      const hint = await page.locator('[data-assistant-life-give-buy-hint]').innerText().catch(() => '');
      check('① 持っていない道具に「🛒 ◯P で買って贈る」', label.includes(`${cost}P で買って贈る`), label);
      check('① 「持っていない道具も、ここで買ってそのまま贈れます(所持ビートP)」', /買ってそのまま贈れます/.test(hint) && /1,240/.test(hint), hint);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'tate-1-sheet.png') });
      // ③ やめる
      await page.locator('[data-assistant-life-give-buy]').click(); await page.waitForTimeout(400);
      const conf = await page.locator('[data-assistant-life-buy-confirm]').innerText().catch(() => '');
      check('② 確かめの窓: 品名・「ビートP ◯ で買って、そのまま ◯◯ に贈ります」・所持ビートP 前→後・上がる量', /ほかほかおにぎり/.test(conf) && new RegExp(`ビートP ${cost} で買って、\\s*そのまま .+と.+ に贈ります`).test(conf) && conf.includes(`1,240 → ${(1240 - cost).toLocaleString()}`) && /仲良し度 \+/.test(conf) && /友情Lv \+/.test(conf), conf.replace(/\s+/g, ' ').slice(0, 140));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'tate-2-confirm.png') });
      const ownBefore = await owned(page);
      await page.locator('[data-assistant-life-buy-cancel]').click(); await page.waitForTimeout(250);
      check('③ 「やめる」ならビートPも持ち物も変わらない', (await points(page)) === 1240 && JSON.stringify(await owned(page)) === JSON.stringify(ownBefore));
      // ④ 買って贈る(窓は毎回出る)
      await page.locator('[data-assistant-life-give-buy]').click(); await page.waitForTimeout(400);
      check('② 確かめの窓は毎回出る', (await page.locator('[data-assistant-life-buy-confirm]').count()) === 1);
      await page.locator('[data-assistant-life-buy-go]').click(); await page.waitForTimeout(1200); await finishTalk(page);
      await page.locator('[data-assistant-life-scene-back]').click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(300);
      const p1 = await points(page), own1 = await owned(page);
      const day = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_assistant_life_gift_day_v1') || 'null'));
      check('④ ビートPは値段ぶんだけ1回引かれる', p1 === 1240 - cost, `${p1}`);
      check('④ 持ち物は増えも減りもしない(買った1つを贈った)', !(Number(own1.peer_onigiri) > 0) && own1.peer_gift === 2 && own1.peer_cake === 1, JSON.stringify({ o: own1.peer_onigiri }));
      check('④ その日の記録に残る', !!(day && day.used && day.used.onigiri), JSON.stringify(day));
      // ⑤ 同じ道具をもう一度
      await openPairSheet(page, id);
      await page.locator('[data-assistant-life-give-kind="onigiri"]').click(); await page.waitForTimeout(250);
      check('⑤ 贈った道具には「買って贈る」が出ず、理由が出る', (await page.locator('[data-assistant-life-give-buy]').count()) === 0 && /今日はもうこの道具/.test(await page.locator('[data-assistant-life-give-reason]').innerText().catch(() => '')));
      // ⑥ 足りない(家具より高い道具は無いので、ビートPを減らして確かめる)
      await page.evaluate(() => { localStorage.setItem('mh_rhythm_event_points_v1', '50'); });
      await page.locator('[data-assistant-life-give-kind="tea"]').click(); await page.waitForTimeout(250);
      await page.locator('[data-assistant-life-give-buy]').click(); await page.waitForTimeout(500);
      const short = await page.locator('[data-assistant-life-buy-short]').innerText().catch(() => '');
      const teaCost = await costOf(page, 'peer_tea');
      check('⑥ ビートPが足りなければ「ビートPが足りません(あと◯P)」で押せない', short.includes(`あと${teaCost - 50}P`) && await page.locator('[data-assistant-life-buy-go]').isDisabled(), short);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'tate-3-short.png') });
      await page.locator('[data-assistant-life-buy-cancel]').click(); await page.waitForTimeout(200);
      await page.locator('[data-assistant-life-give-cancel]').click(); await page.waitForTimeout(200);
      await page.evaluate(() => { localStorage.setItem('mh_rhythm_event_points_v1', '3000'); });
      // ⑦ 1人に
      await page.locator(`[data-assistant-life-room="${id}"]`).click(); await page.waitForTimeout(300);
      await page.locator('[data-assistant-life-room-act="give-solo"]').click(); await page.waitForTimeout(400);
      await page.locator('[data-assistant-life-give-kind="letter"]').click(); await page.waitForTimeout(250);
      await page.locator('[data-assistant-life-give-buy]').click(); await page.waitForTimeout(400);
      const conf2 = await page.locator('[data-assistant-life-buy-confirm]').innerText().catch(() => '');
      const letterCost = await costOf(page, 'solo_letter');
      check('⑦ 1人に贈るシートでも確かめの窓(友情Lv の行は無い)', /手書きの手紙/.test(conf2) && /仲良し度 \+/.test(conf2) && !/友情Lv/.test(conf2) && conf2.includes(`3,000 → ${(3000 - letterCost).toLocaleString()}`), conf2.replace(/\s+/g, ' ').slice(0, 120));
      await page.locator('[data-assistant-life-buy-go]').click(); await page.waitForTimeout(1200); await finishTalk(page);
      await page.locator('[data-assistant-life-scene-back]').click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(300);
      const solo = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_assistant_life_solo_gift_v1') || 'null'));
      check('⑦ 1人に買って贈ると、ビートPが減り1人の記録に残る', (await points(page)) === 3000 - letterCost && !!(solo && solo.used && solo.used.letter === id), JSON.stringify(solo));
      // ⑧ 家具
      const p2 = await points(page);
      await page.locator(`[data-assistant-life-room="${id}"]`).click(); await page.waitForTimeout(300);
      await page.locator('[data-assistant-life-room-act="furn"]').click(); await page.waitForTimeout(400);
      const toBuy = await page.locator('[data-assistant-life-furn-buy]').count();
      check('⑧ 家具のシートに「まだ持っていない家具」(12種類)', toBuy === 12, String(toBuy));
      if (SHOTS) { await page.locator('[data-assistant-life-furn-tobuy]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shotDir, 'tate-4-furn.png') }); }
      await page.locator('[data-assistant-life-furn-buy="plant"]').click(); await page.waitForTimeout(400);
      const conf3 = await page.locator('[data-assistant-life-buy-confirm]').innerText().catch(() => '');
      check('⑧ 家具の確かめの窓', /観葉植物/.test(conf3) && /そのまま .+ に贈ります/.test(conf3), conf3.replace(/\s+/g, ' ').slice(0, 100));
      await page.locator('[data-assistant-life-buy-go]').click(); await page.waitForTimeout(1200);
      const room = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_assistant_life_room_v1') || 'null'));
      const plantCost = await costOf(page, 'furn_plant');
      check('⑧ 家具を買って贈ると部屋に入り、ビートPが値段ぶん減る', !!(room && room[id] && room[id].got && room[id].got.plant) && (await points(page)) === p2 - plantCost && (await page.locator('[data-assistant-life-furn-buy="plant"]').count()) === 0, `${await points(page)}`);
      await page.locator('[data-assistant-life-furn-close]').click().catch(() => {}); await page.waitForTimeout(400);
      await finishTalk(page).catch(() => {}); await page.locator('[data-assistant-life-scene-back]').click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(300);
      await page.mouse.click(20, 60); await page.waitForTimeout(200);
      // ⑨ 道具タブ
      await page.locator('[data-assistant-life-icon="items"]').click(); await page.waitForTimeout(300);
      const rowBtn = page.locator('[data-assistant-life-item-buy="earphone"]');
      check('⑨ 道具タブの持っていない行に「🛒 ◯P で買って贈る」', (await rowBtn.count()) === 1 && /で買って贈る/.test(await rowBtn.innerText()));
      if (SHOTS) { await rowBtn.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shotDir, 'tate-5-items.png') }); }
      await rowBtn.click(); await page.waitForTimeout(400);
      check('⑨ 押すと、その道具を選んだ贈るシートが開く', (await page.locator('[data-assistant-life-give-sheet="earphone"]').count()) === 1 && (await page.locator('[data-assistant-life-give-buy]').count()) === 1);
      await page.locator('[data-assistant-life-give-cancel]').click(); await page.waitForTimeout(200);
      // ⑩ 思い出アルバム
      await page.locator('[data-assistant-life-icon="friends"]').click(); await page.waitForTimeout(400);
      const albumOpen = page.locator('[data-assistant-peer-row], [data-assistant-peer-daily]').first();
      if (await albumOpen.count()) {
        await albumOpen.click(); await page.waitForTimeout(400);
        const n = await page.locator('[data-assistant-peer-actions] [data-assistant-peer-use]').count();
        check('⑩ アルバムの「2人にしてあげる」は10種類', n === 10, String(n));
        const b = page.locator('[data-assistant-peer-buy]').first();
        if (SHOTS) { await page.locator('[data-assistant-peer-actions]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shotDir, 'tate-6-album.png') }); }
        await b.click(); await page.waitForTimeout(400);
        check('⑩ 持っていない道具から確かめの窓が開く', (await page.locator('[data-assistant-peer-album] [data-assistant-life-buy-confirm]').count()) === 1);
        const names = await page.evaluate(() => [...document.querySelectorAll('[data-assistant-peer-use] > span:first-child')].map(s => { const r = document.createRange(); r.selectNodeContents(s); const lines = new Set([...r.getClientRects()].map(x => Math.round(x.top))); return lines.size; }));
        check('⑩ 札の名前は言葉の区切りで折る(2行まで)', names.every(n => n <= 2), names.join(','));
        await page.locator('[data-assistant-life-buy-cancel]').click(); await page.waitForTimeout(200);
      } else check('⑩ アルバムを開ける', false);
      await page.close();
    }
    // ⑪ 見た目(縦 390・横 844・🔄横 667)
    for (const [w, h, tag, file] of [[390, 844, '縦 390', 'tate'], [844, 390, '横 844', 'yoko'], [667, 375, '🔄横 667', 'yoko667']]) {
      const page = await open(w, h);
      await openHouse(page);
      const id = await groupRoom(page);
      if (!id) { check(`⑪ ${tag}: 一緒にいる組がいる`, false); await page.close(); continue; }
      await openPairSheet(page, id);
      await page.locator('[data-assistant-life-give-kind="onigiri"]').click(); await page.waitForTimeout(250);
      const cut = await cutProblems(page, '[data-assistant-life-give-sheet] > div');
      check(`⑪ ${tag}: 贈るシートの字が切れない・はみ出さない`, cut.length === 0, cut.join(','));
      check(`⑪ ${tag}: 「買って贈る」がシートを送らずに押せる`, await pressable(page, '[data-assistant-life-give-buy]'));
      if (SHOTS && w !== 390) await page.screenshot({ path: path.join(shotDir, `${file}-1-sheet.png`) });
      await page.locator('[data-assistant-life-give-buy]').click(); await page.waitForTimeout(400);
      const cut2 = await cutProblems(page, '[data-assistant-life-buy-confirm] > div');
      check(`⑪ ${tag}: 確かめの窓の字が切れない・はみ出さない`, cut2.length === 0, cut2.join(','));
      check(`⑪ ${tag}: 確かめの窓の「買って贈る」が押せる`, await pressable(page, '[data-assistant-life-buy-go]'));
      if (SHOTS && w !== 390) await page.screenshot({ path: path.join(shotDir, `${file}-2-confirm.png`) });
      await page.close();
    }
    check('⑫ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { console.log('NG: 途中で止まった —', e.message.split('\n').slice(0, 3).join(' ')); failed++; }
  await browser.close(); server.close();
  console.log(failed ? `NG ${failed}件` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
