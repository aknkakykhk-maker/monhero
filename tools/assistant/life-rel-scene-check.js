// けんか・仲直りの場面を見返す(2026-11-15 社長 r1115-137「この案で作る」・56-assistant-life-rel.jsx の assistantLifeRelViewOf)
//   ① 台本: けんか84本すべてが場面になる(本文+その後・3〜6行)・題は原因ごと/仲直りの台本も場面になる・題は仕方ごと
//   ② けんか中の部屋のシートに「💢 けんかの様子を見る」→ 会話の場面(題「💢 おやつのことで言い合い」・2人の掛け合い)
//   ③ 今日あったこと: tid のある行(けんか・仲直り)は「▶ 見る」で場面、tid の無い古い行は押せない札のまま
//   ④ 見返しは何も増やさない(けんかの記録・仲直りの記録・今日あったことの件数が変わらない)・ページのエラーが出ない
//   --shots [置き場]  縦390・縦320・横844 の止め絵(既定 docs/progress/assistant-life/report-1115/)
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9289;
const argv = process.argv.slice(2), si = argv.indexOf('--shots');
const SHOTS = si >= 0, shotDir = path.resolve(root, si >= 0 && argv[si + 1] && !argv[si + 1].startsWith('--') ? argv[si + 1] : 'docs/progress/assistant-life/report-1115');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const VIEWS = [{ id: 'v390', w: 390, h: 844 }, { id: 'v320', w: 320, h: 700 }, { id: 'h844', w: 844, h: 390 }];
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
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const errors = [];
  let first = true;
  for (const v of VIEWS) {
    const T = `[${v.id}] `;
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${v.id}: ${e.message}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    if (first) {
      first = false;
      const u = await page.evaluate(() => {
        const X = assistantLifeRelSet(), ng = [];
        const fights = X.quarrel.filter(t => t.kind === 'quarrel');
        for (const t of fights) { const v = assistantLifeRelViewOf(t.id); if (!v) { ng.push(`${t.id}: 場面にならない`); continue; } if (v.talk.lines.length < 3 || v.talk.lines.length > 6) ng.push(`${t.id}: ${v.talk.lines.length}行`); if (!/^💢 /.test(v.title) || v.title === ASSISTANT_LIFE_REL_FIGHT_TITLE_ANY) ng.push(`${t.id}: 題 ${v.title}`); }
        const mends = [...X.quarrel.filter(t => t.kind === 'makeup'), ...X.mend, ...X.mend3];
        for (const t of mends) { const v = assistantLifeRelViewOf(t.id, t.mediator ? null : t.how); if (!v) ng.push(`${t.id}: 仲直りが場面にならない`); else if (!/^🤝 /.test(v.title)) ng.push(`${t.id}: 題 ${v.title}`); }
        const titles = new Set([...fights.map(t => assistantLifeRelViewOf(t.id).title), ...['self', 'apology', 'gift', 'player', 'mediator:kiki'].map(assistantLifeRelMendTitle)]);
        return { ng, n: fights.length, m: mends.length, titles: [...titles], none: assistantLifeRelViewOf('no-such-id') };
      });
      check(`① けんか${u.n}本・仲直り${u.m}本がどれも場面になり、題が付く`, u.ng.length === 0 && u.n === 84 && u.none === null, u.ng.slice(0, 4).join(' / '));
      check('① 題: 原因6つ+仲直りの仕方', u.titles.length >= 11, u.titles.join(' '));
    }
    await page.evaluate(() => {
      RELEASE_FLAGS.assistantLifeTopHouse = true;
      const l = ASSISTANT_LIFE_STORE.state.life;
      ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: [], solo: { mua: { doing: 'idle', place: 'home' }, dra: { doing: 'snack', place: 'cafe' } }, watched: [] } });
      ASSISTANT_PEER_STORE.set({ quarrel: { pending: { id: 'rel-fight-dra-mua-1', pair: 'dra-mua', at: Date.now() }, done: ['rel-fight-dra-mua-1'] } });
      const day = assistantLifeDayKey(Date.now());
      ASSISTANT_LIFE_DIARY.state = { day, slots: [], items: [
        { t: '09:12', text: '👀 きき・あつの様子を見守った', ids: ['kiki', 'atsu'], kind: 'watch' },
        { t: '10:05', text: '🤝 きき・ソラシドが仲直り', ids: ['kiki', 'sorashido'], kind: 'makeup', tid: 'rel-fight-kiki-sorashido-1m', how: 'self' },
        { t: '11:30', text: '💢 みゅあ・ドラが喧嘩(おやつ)', ids: ['dra', 'mua'], kind: 'quarrel', tid: 'rel-fight-dra-mua-1' },
      ] };
      ASSISTANT_LIFE_DIARY.loaded = true; ASSISTANT_LIFE_DIARY.emit();
    });
    await page.waitForTimeout(600); await finishTalk(page);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const before = await page.evaluate(() => JSON.stringify({ q: ASSISTANT_PEER_STORE.state.quarrel, m: ASSISTANT_LIFE_REL_STORE.state.mended, d: ASSISTANT_LIFE_DIARY.state.items.length }));
    // ② けんか中の部屋のシート
    await page.locator('[data-assistant-life-room="mua"]').first().click({ timeout: 8000 });
    await page.waitForTimeout(700);
    const viewBtn = page.locator('[data-assistant-life-rel-view="rel-fight-dra-mua-1"]');
    const hasBtn = (await viewBtn.count()) === 1;
    check(`${T}② けんか中の部屋のシートに「💢 けんかの様子を見る」`, hasBtn);
    if (hasBtn) {
      await viewBtn.scrollIntoViewIfNeeded().catch(() => {});
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `r1115-137-quarrel-sheet-${v.id}.png`) });
      const bb = await viewBtn.boundingBox();
      check(`${T}② ボタンは44px以上・画面の中`, !!bb && bb.height >= 43.5 && bb.x >= 0 && bb.x + bb.width <= v.w + 1, JSON.stringify(bb));
      await viewBtn.click(); await page.waitForTimeout(1500);
      const sc = await page.evaluate(() => ({ title: (document.querySelector('[data-assistant-life-scene-rel-title]') || {}).textContent || '', talk: (document.querySelector('[data-assistant-peer-talk]') || {}).textContent || '' }));
      check(`${T}② 会話の場面: 題「💢 おやつのことで言い合い」・2人の掛け合いが出る`, sc.title === '💢 おやつのことで言い合い' && /プリン/.test(sc.talk), `${sc.title} / ${sc.talk.slice(0, 40)}`);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `r1115-137-quarrel-scene-${v.id}.png`) });
      for (let i = 0; i < 12 && (await page.locator('[data-assistant-peer-talk]').count()); i++) { await page.locator('[data-assistant-peer-talk]').first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(350); }
      await page.locator('[data-assistant-life-scene-back]').click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(600);
    }
    // ③ 今日あったこと
    const board = page.locator('[data-assistant-life-house] .mhl-board, [data-assistant-life-board]').first();
    await board.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(700);
    const d = await page.evaluate(() => ({ btns: [...document.querySelectorAll('[data-assistant-life-diary-scene]')].map(b => b.getAttribute('data-assistant-life-diary-scene')), text: (document.querySelector('[data-assistant-life-diary]') || {}).textContent || '',
      small: [...document.querySelectorAll('[data-assistant-life-diary-scene]')].filter(b => b.getBoundingClientRect().height < 43.5).length }));
    check(`${T}③ 今日あったこと: けんか・仲直りの行は「▶ 見る」、古い行は押せない札のまま`, d.btns.length === 2 && d.btns.includes('rel-fight-dra-mua-1') && d.btns.includes('rel-fight-kiki-sorashido-1m') && /きき・あつの様子を見守った/.test(d.text) && d.small === 0, JSON.stringify(d.btns));
    if (SHOTS) await page.screenshot({ path: path.join(shotDir, `r1115-137-diary-${v.id}.png`) });
    if (d.btns.includes('rel-fight-kiki-sorashido-1m')) {
      await page.locator('[data-assistant-life-diary-scene="rel-fight-kiki-sorashido-1m"]').click(); await page.waitForTimeout(1500);
      const sc = await page.evaluate(() => ({ title: (document.querySelector('[data-assistant-life-scene-rel-title]') || {}).textContent || '', talk: (document.querySelector('[data-assistant-peer-talk]') || {}).textContent || '' }));
      check(`${T}③ 仲直りの行 → 仲直りの場面(題「🤝 自分たちで仲直り」)`, sc.title === '🤝 自分たちで仲直り' && sc.talk.length > 0, sc.title);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `r1115-137-mend-scene-${v.id}.png`) });
      for (let i = 0; i < 12 && (await page.locator('[data-assistant-peer-talk]').count()); i++) { await page.locator('[data-assistant-peer-talk]').first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(350); }
      await page.locator('[data-assistant-life-scene-back]').click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(600);
    }
    const after = await page.evaluate(() => JSON.stringify({ q: ASSISTANT_PEER_STORE.state.quarrel, m: ASSISTANT_LIFE_REL_STORE.state.mended, d: ASSISTANT_LIFE_DIARY.state.items.length }));
    check(`${T}④ 見返しは何も増やさない(けんか・仲直りの記録・今日あったことの件数)`, before === after, `${before} → ${after}`);
    await page.close();
  }
  check('④ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `${failed} 件 NG` : 'OK: けんか・仲直りの場面');
  process.exit(failed ? 1 : 0);
})();
