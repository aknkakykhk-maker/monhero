// 助手ライフの家具(段階B・2026-11-08 社長 GIFT-PLAN.md)を、実際に開いて確かめる。公開の印 assistantLifeFurniture はページの中でだけ立てる
//   node tools/assistant/assistant-life-furn-browser-check.js           検査
//   node tools/assistant/assistant-life-furn-browser-check.js --shots   止め絵も撮る(docs/progress/assistant-peer/gifts/stageB/)
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る(公開後の確かめ)
//   ① 印が偽なら、部屋の「🪑 部屋の家具」も交換所の「家具」タブも出ない
//   ② 印が真: 部屋のシートに「🪑 部屋の家具」→ 家具のシートが画面に収まる(縦 390×844・375×667・横 844×390)
//   ③ 贈ると: 持ち物が1つ減る・部屋の保存(mh_assistant_life_room_v1)に置く・ひとことが流れる・お知らせの帯に量
//   ④ 部屋の絵: 置いた家具が部屋の中に出て、名札・顔に重ならない(吹き出しは家具より前)。重なりの前後は顔・扉・灯りを消した膜より後ろ(z-index 2)
//   ⑤ 押し入れ・入れかえ・しまうのボタン/同じ家具は二度と贈れない(贈れる一覧から消える)
//   ⑥ 交換所: 「家具」タブに12種類、「アイテム」タブには家具が並ばない
//   ⑦ ページのエラーが出ない
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9233;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/gifts/stageB');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

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
  const open = async (w, h, furn) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${w}x${h}: ${e}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: null });
    await page.addInitScript((on) => {
      const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeFurniture = !!on; clearInterval(t); } } catch {} }, 2);
      if (localStorage.getItem('mh_check_furn') === null) { localStorage.setItem('mh_check_furn', '1'); const o = JSON.parse(localStorage.getItem('mh_owned_items') || '{}');
        Object.assign(o, { furn_sofa: 1, furn_trophy: 1, furn_lantern: 1, furn_record: 1, furn_heartmirror: 1, furn_bear: 2 }); localStorage.setItem('mh_owned_items', JSON.stringify(o)); }
    }, furn);
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page);
    return page;
  };
  const openHouse = async (page) => { await page.locator('[data-home-assistant-life]').click({ timeout: 20000 }); await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {}); await page.waitForTimeout(400); };
  const openRoomFurn = async (page, id) => { await page.locator(`[data-assistant-life-room="${id}"]`).click(); await page.waitForTimeout(250); await page.locator('[data-assistant-life-room-act="furn"]').click(); await page.waitForTimeout(300); };
  const inView = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return false; const r = el.getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }, sel);
  const give = async (page, id, key) => { await openRoomFurn(page, id); await page.locator(`[data-assistant-life-furn-give="${key}"]`).click(); await page.waitForTimeout(700); await finishTalk(page); await page.locator('[data-assistant-life-scene-back]').click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(300); };
  // 部屋の家具が、名札・顔・吹き出しに重ならず、部屋の中にあり、後ろ側(z-index 2 以下)にあるか
  const furnProblems = (page, id) => page.evaluate((rid) => {
    const ng = []; const room = document.querySelector(`[data-assistant-life-room="${rid}"]`); if (!room) return ['部屋が無い'];
    const rr = room.getBoundingClientRect();
    const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    for (const f of room.querySelectorAll('[data-assistant-life-room-furn]')) {
      const glyph = f.lastElementChild || f; const r = glyph.getBoundingClientRect();
      if (r.left < rr.left - 1 || r.right > rr.right + 1 || r.top < rr.top - 1 || r.bottom > rr.bottom + 1) ng.push(`部屋からはみ出す ${f.dataset.assistantLifeRoomFurn}`);
      if (Number(getComputedStyle(f).zIndex) > 3) ng.push(`前に出すぎ ${f.dataset.assistantLifeRoomFurn}`);
      for (const o of room.querySelectorAll('[data-assistant-life-room-furn]')) if (o !== f && hit(r, (o.lastElementChild || o).getBoundingClientRect())) ng.push(`家具どうしが重なる ${f.dataset.assistantLifeRoomFurn}`);
      // 吹き出しは家具より前に出る白い札(文字は読める)なので、重なってよい。前後が逆になっていないかだけ見る
      for (const b of room.querySelectorAll('[data-assistant-life-room-bub]')) if (Number(getComputedStyle(b).zIndex) <= Number(getComputedStyle(f).zIndex)) ng.push('吹き出しが家具より後ろ');
      for (const s of ['.pl', '.lv', '.pp > span']) for (const o of room.querySelectorAll(s)) if (o.getClientRects().length && hit(r, o.getBoundingClientRect())) ng.push(`${f.dataset.assistantLifeRoomFurn} が ${s} に重なる`);
    }
    return ng;
  }, id);
  try {
    // ① 印が偽
    {
      const page = await open(390, 844, false);
      await openHouse(page);
      await page.locator('[data-assistant-life-room="atsu"]').click(); await page.waitForTimeout(250);
      check('① 印が偽なら、部屋に「🪑 部屋の家具」が出ない', (await page.locator('[data-assistant-life-room-act="furn"]').count()) === 0);
      await page.close();
    }
    for (const [w, h, tag] of [[390, 844, '縦 390'], [375, 667, '縦 375'], [844, 390, '横 844']]) {
      const page = await open(w, h, true);
      await openHouse(page);
      await openRoomFurn(page, 'atsu');
      check(`② ${tag}: 家具のシートが開き、画面に収まる`, (await page.locator('[data-assistant-life-furn-sheet="atsu"]').count()) === 1 && await inView(page, '[data-assistant-life-furn-sheet] .mhl-sheet'));
      check(`② ${tag}: 贈れる家具の名前が切れない`, await page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-furn-row] p')].every(p => p.scrollWidth <= p.clientWidth + 1)));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `furn-${w}-1-sheet.png`) });
      await page.locator('[data-assistant-life-furn-close]').click().catch(() => {}); await page.waitForTimeout(200);
      await page.locator('[data-assistant-life-room-sheet] > button').first().click({ position: { x: 10, y: 10 } }).catch(() => {});
      await give(page, 'atsu', 'sofa');
      const owned = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_owned_items')));
      const room = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_assistant_life_room_v1')));
      check(`③ ${tag}: 贈ると持ち物が1つ減り、部屋の床に置く(新しいキー)`, owned.furn_sofa === 0 && room && room.atsu && room.atsu.put.floor === 'sofa');
      const note = await page.locator('[data-assistant-life-note]').first().innerText().catch(() => '');
      check(`③ ${tag}: お知らせの帯に、贈った家具と仲良し度の量(好きな家具 +120)`, /ふかふかソファ/.test(note) && /\+120/.test(note), note);
      for (const k of ['trophy', 'lantern', 'record']) await give(page, 'atsu', k);
      const ng = await furnProblems(page, 'atsu');
      if (process.env.FURN_DEBUG) console.log(tag, await page.evaluate(() => { const room = document.querySelector('[data-assistant-life-room="atsu"]'); const rr = room.getBoundingClientRect(); const g = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left - rr.left), Math.round(r.top - rr.top), Math.round(r.width), Math.round(r.height)]; };
        return JSON.stringify({ room: [Math.round(rr.width), Math.round(rr.height)], fu: g(room.querySelector('.fu')), pp: [...room.querySelectorAll('.pp > span')].map(g), bub: [...room.querySelectorAll('[data-assistant-life-room-bub]')].map(g), pl: g(room.querySelector('.pl')), furn: [...room.querySelectorAll('[data-assistant-life-room-furn]')].map(f => [f.dataset.assistantLifeRoomFurn, g(f.lastElementChild)]) }); }));
      check(`④ ${tag}: 置いた家具が部屋の中に出て、名札・顔に重ならない・吹き出しより後ろ(z-index 2)`, (await page.locator('[data-assistant-life-room="atsu"] [data-assistant-life-room-furn]').count()) === 3 && ng.length === 0, ng.join(' / '));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `furn-${w}-2-house.png`) });
      await openRoomFurn(page, 'atsu');
      check(`⑤ ${tag}: 置き場所がふさがった家具は押し入れ(「入れかえる」)・置いた家具は「しまう」・贈った家具は贈れる一覧から消える`,
        (await page.locator('[data-assistant-life-furn-put="record"]').count()) === 1 && (await page.locator('[data-assistant-life-furn-keep="sofa"]').count()) === 1 && (await page.locator('[data-assistant-life-furn-give="sofa"]').count()) === 0);
      await page.locator('[data-assistant-life-furn-put="record"]').click(); await page.waitForTimeout(300);
      const room2 = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_assistant_life_room_v1')));
      check(`⑤ ${tag}: 入れかえると、床はレコードプレーヤー・ソファは押し入れへ`, room2.atsu.put.floor === 'record' && room2.atsu.kept.includes('sofa'));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `furn-${w}-3-sheet-after.png`) });
      await page.close();
    }
    // ⑥ 交換所の「家具」タブ
    {
      const page = await open(390, 844, true);
      await page.locator('[data-home-market], .mh-home-facility.market').first().click({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
      await page.getByRole('button', { name: /ビートP交換所/ }).first().click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);
      await page.getByRole('tab', { name: '家具' }).first().click({ timeout: 5000 }).catch(async () => { await page.getByRole('button', { name: '家具' }).first().click({ timeout: 3000 }).catch(() => {}); });
      await page.waitForTimeout(400);
      const tab = await page.locator('[data-event-point-shop]').getAttribute('data-event-point-tab').catch(() => null);
      const furnN = await page.evaluate(() => { const g = document.querySelector('[data-event-point-shop]'); return g ? (g.innerText.match(/ふかふかソファ|くまのぬいぐるみ|観葉植物|レコードプレーヤー|ニャーのクッション|星空の絵|トロフィー棚|小さな本棚|ハートの鏡|星のランタン|ミラーボール|風鈴/g) || []).length : 0; });
      check('⑥ 交換所の「家具」タブに12種類が並ぶ', tab === 'furniture' && furnN >= 12, `${tab} ${furnN}`);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'furn-390-4-market.png') });
      await page.getByRole('tab', { name: 'アイテム' }).first().click({ timeout: 5000 }).catch(async () => { await page.getByRole('button', { name: 'アイテム' }).first().click({ timeout: 3000 }).catch(() => {}); });
      await page.waitForTimeout(300);
      const itemText = await page.locator('[data-event-point-shop]').innerText().catch(() => '');
      check('⑥ 「アイテム」タブには家具が並ばない', !/ふかふかソファ|ミラーボール/.test(itemText) && /おやつバスケット/.test(itemText));
      await page.close();
    }
    check('⑦ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
