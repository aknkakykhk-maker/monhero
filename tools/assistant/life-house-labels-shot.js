// 家のトップ(4部屋×2段)の部屋の札の止め絵(r1115-136 社長「札の文が途中で切れる」)
//   node tools/assistant/life-house-labels-shot.js [置き場]   既定 docs/progress/assistant-life/report-1115/
//   縦390・縦320・横844 の3枚を撮り、札の字が札の外へ出ていない・「…」で切れていない・言葉の途中で折れていないかを数える(最後の行が OK/NG)
//   場面は社長の止め絵とそろえる: みゅあ・えるびんは仲直りしたてで一緒に出かけている/4人がモンヒロバトル/ドラはフレンドの家/きゅうこは図書室
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9283;
const outDir = path.resolve(root, process.argv[2] || 'docs/progress/assistant-life/report-1115');
const VIEWS = [{ id: 'v390', w: 390, h: 844 }, { id: 'v320', w: 320, h: 700 }, { id: 'h844', w: 844, h: 390 }, { id: 'h667', w: 667, h: 375 }];
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていない'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  fs.mkdirSync(outDir, { recursive: true });
  let bad = 0; const errors = [];
  for (const v of VIEWS) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2 });
    page.on('pageerror', e => errors.push(`${v.id}: ${e.message}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    await page.evaluate(() => {
      RELEASE_FLAGS.assistantLifeTopHouse = true; RELEASE_FLAGS.assistantLifeFriend = true;
      const l = ASSISTANT_LIFE_STORE.state.life;
      ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: [{ ids: ['kiki', 'momosuke', 'atsu', 'sorashido'], doing: 'battle', place: 'battle' }, { ids: ['mua', 'erubin'], doing: 'walk', place: 'garden' }],
        solo: { dra: { doing: 'idle', place: 'home' }, kyuko: { doing: 'read', place: 'library' } }, watched: [] } });
      const cur = assistantLifeCurrent();
      ASSISTANT_LIFE_REL_STORE.state = { ...ASSISTANT_LIFE_REL_STORE.state, loaded: true, mended: { 'erubin-mua': { abs: cur.abs } } };
      ALF_STORE.state = { ...ALF_STORE.state, st: { ...(ALF_STORE.state.st || {}), out: { ids: ['dra'], name: 'レオナ', abs: cur.abs } } };
    });
    await page.waitForTimeout(800); await finishTalk(page);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const top = document.querySelector('[data-assistant-life-top-house]') || document.querySelector('[data-assistant-life-house]');
      if (top) top.scrollIntoView({ block: 'start' });
      const rows = [];
      for (const tag of document.querySelectorAll('[data-assistant-life-room-away]')) {
        const room = tag.closest('[data-assistant-life-room]'), rr = room.getBoundingClientRect(), tr = tag.getBoundingClientRect();
        const lines = [...tag.querySelectorAll('small,b')].filter(x => getComputedStyle(x).display !== 'none' && x.textContent.trim());
        const cut = lines.filter(x => x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 1).map(x => x.textContent.trim());
        // 言葉の途中で折れていないか: 字の塊(data-assistant-life-chunk か whitespace-nowrap)以外で行が変わっていないか
        const broken = lines.filter(x => { const rg = document.createRange(); rg.selectNodeContents(x); const ys = [...rg.getClientRects()].map(q => Math.round(q.top)); const nLines = new Set(ys).size; return nLines > 1 && !x.querySelector('.whitespace-nowrap,[data-assistant-life-chunk]'); }).map(x => x.textContent.trim());
        const fs = lines.map(x => parseFloat(getComputedStyle(x).fontSize)); rows.push({ font: Math.min(...fs), h: Math.round(tr.bottom - rr.top), rw: Math.round(rr.width), id: room.getAttribute('data-assistant-life-room'), text: lines.map(x => x.textContent.trim()).join(' / '), cut, broken, outside: tr.right > rr.right + 1 || tr.left < rr.left - 1 || tr.bottom > rr.bottom });
      }
      return rows;
    });
    for (const x of r) { const ng = x.cut.length || x.broken.length || x.outside || /…/.test(x.text); if (ng) bad++; console.log(`${ng ? 'NG' : 'OK'} [${v.id}] ${x.id}(幅${x.rw} 字${x.font}px 下端${x.h}px): ${x.text}${x.cut.length ? ` 切れ:${x.cut.join('|')}` : ''}${x.broken.length ? ` 途中で折れ:${x.broken.join('|')}` : ''}${x.outside ? ' 札が部屋の外' : ''}`); }
    const house = page.locator('[data-assistant-life-top-house]').first();
    const file = path.join(outDir, `r1115-136-house-labels-${v.id}.png`);
    if (await house.count()) await house.screenshot({ path: file }); else await page.screenshot({ path: file });
    await page.close();
  }
  await browser.close(); server.close();
  for (const e of errors) console.log('ページのエラー:', e);
  console.log(bad || errors.length ? `NG: 札の切れ・はみ出し ${bad} 件 / エラー ${errors.length} 件` : 'OK: 札は全部収まっている');
  process.exit(bad || errors.length ? 1 : 0);
})();
