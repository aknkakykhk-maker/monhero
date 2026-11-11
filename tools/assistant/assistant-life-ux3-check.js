// 助手ライフの作り直し STEP3(2026-11-11 社長・docs/progress/assistant-peer/LIFE-UX-V3-PLAN.md)を、実際に開いて確かめる
//   node tools/assistant/assistant-life-ux3-check.js            検査
//   node tools/assistant/assistant-life-ux3-check.js --shots    止め絵も撮る(docs/progress/assistant-peer/lifeux/step3/)
//   ① 新UIのタブは4つ(家・町・きずな・フレンド)。道具のタブは無い
//   ② 家の上の「みんなの居場所」は出ない
//   ③ 「🎁 贈る」を押すと、だれに贈るか+持っている道具のシートが開く(道具は贈るの中)
//   ④ 町(地図)の下の一覧は無く、上の帯に同じ4つのタブ。タブで家へ戻れる
//   ⑤ 「きずな」に引き合わせるがあり、2人を選ぶと押せる
//   ⑥ タブ・シートは横にはみ出さず、押せる大きさ(高さ40px以上)
//   ⑦ 旧UI(保存が false)は今までどおり: タブ5つ・「みんなの居場所」・地図の下の一覧
//   ⑧ 保存が無い人は ASSISTANT_LIFE_UI_V2_DEFAULT のとおり・保存 mh_assistant_life_ui_v2 は開いただけでは書き換わらない
//   ⑨ ページのエラーが出ない
//   ⑫ 切替は設定の「助手ライフの画面」(助手ライフの上の帯には無い)
//   ⑩ 家の8部屋: 留守の札は字10.5px以上・家にいる助手の部屋に「会える」の印
//   ⑪ きずな: 組の行は高さ44px以上で、次の Lv まであといくつが出る
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9266;
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/lifeux/step3');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const MIX = { groups: [{ ids: ['mua', 'kiki'], doing: 'snack', place: 'cafe' }, { ids: ['dra', 'sorashido', 'erubin'], doing: 'cards', place: 'cardroom' }],
  solo: { momosuke: { doing: 'practice', place: 'studio' }, atsu: { doing: 'idle', place: 'home' }, kyuko: { doing: 'read', place: 'library' } } };

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const BASE = process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`;
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = [];
  // saved … 'true' | 'false' | null(保存なし)
  const open = async (v, saved) => {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${v.name}: ${e.message}`));
    await page.addInitScript((sv) => { window.__mhSupabaseStubbed = true; if (sv != null) localStorage.setItem('mh_assistant_life_ui_v2', sv); else window.__mhLifeUiNoSeed = true; }, saved);
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    await page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, watched: [] } }); }, MIX);
    await page.waitForTimeout(800); await finishTalk(page);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    return page;
  };
  const tabsOf = (page) => page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-icons] [data-assistant-life-icon]')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.getAttribute('data-assistant-life-icon')));
  const badBox = (page, sel) => page.evaluate((q) => [...document.querySelectorAll(q)].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1 || r.height < 40); }).map(b => (b.innerText || '').replace(/\s+/g, ' ').slice(0, 14)), sel);
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(shotDir, name) }); };
  const VIEWS = [{ id: 'tate', name: '縦 390×844', w: 390, h: 844 }, { id: 'yoko', name: '横 844×390', w: 844, h: 390 }, { id: 'yokosmall', name: '横小 667×375', w: 667, h: 375 }];
  for (const v of VIEWS) {
    const T = `[${v.name}] `;
    const page = await open(v, 'true');
    const want = await page.evaluate(() => assistantLifeUiV2Tabs().map(t => t[0]));
    const tabs = await tabsOf(page);
    check(`${T}① 新UIのタブは家・町・きずな(・フレンド)で、道具のタブは無い`, tabs.join() === want.join() && !tabs.includes('items') && tabs.slice(0, 3).join() === 'house,where,friends', tabs.join());
    check(`${T}② 家の上の「みんなの居場所」は出ない`, await page.locator('[data-assistant-life-find]').count() === 0);
    check(`${T}⑥ 家: タブは横にはみ出さず高さ40px以上`, (await badBox(page, '[data-assistant-life-icons] button')).length === 0, JSON.stringify(await badBox(page, '[data-assistant-life-icons] button')));
    { // ⑩ 家の8部屋: 留守の札は字10.5px以上で部屋からはみ出さない・家にいる助手の部屋に「会える」の印(部屋の中に収まる)
      const rm = await page.evaluate(() => { const inBox = (el, box) => { const a = el.getBoundingClientRect(), b = box.getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1; };
        const tags = [...document.querySelectorAll('[data-assistant-life-room-away]')];
        const meets = [...document.querySelectorAll('[data-assistant-life-room-meet]')];
        return { tags: tags.length, tiny: tags.flatMap(t => [...t.querySelectorAll('small,b')]).filter(e => e.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(e).fontSize) < 10.5).length, tagOut: tags.filter(t => !inBox(t, t.closest('[data-assistant-life-room]'))).length,
          meets: meets.map(m => m.getAttribute('data-assistant-life-room-meet')), meetOut: meets.filter(m => !inBox(m, m.closest('[data-assistant-life-room]'))).length }; });
      check(`${T}⑩ 家: 留守の札(${rm.tags}部屋)は字10.5px以上で部屋の中・「会える」の印はあつの部屋だけで部屋の中`, rm.tags === 7 && rm.tiny === 0 && rm.tagOut === 0 && rm.meets.join() === 'atsu' && rm.meetOut === 0, JSON.stringify(rm));
    }
    await shot(page, `${v.id}-1-house.png`);
    // ③ 贈る
    await page.locator('[data-assistant-life-today-act="give"]').click(); await page.waitForTimeout(500);
    let gift = await page.evaluate(() => { const s = document.querySelector('[data-assistant-life-gift-sheet]'); return s ? { who: !!s.querySelector('[data-assistant-life-give-who]'), pairs: s.querySelectorAll('[data-assistant-life-give-who-pair]').length, items: s.querySelectorAll('[data-assistant-life-item]').length } : null; });
    await shot(page, `${v.id}-2-gift.png`);
    await page.locator("[data-assistant-life-gift-items-toggle]").click(); await page.waitForTimeout(300); gift.items = await page.locator("[data-assistant-life-gift-sheet] [data-assistant-life-item]").count();
    check(`${T}③ 「🎁 贈る」でシートが開き、相手(${gift && gift.pairs}組)と、開くと道具の一覧(${gift && gift.items}種)が出る`, !!gift && gift.who && gift.pairs === 2 && gift.items >= 3, JSON.stringify(gift));
    check(`${T}⑥ 贈るシート: 相手のボタンは横にはみ出さず高さ40px以上`, (await badBox(page, '[data-assistant-life-give-who] button')).length === 0, JSON.stringify(await badBox(page, '[data-assistant-life-give-who] button')));
    await shot(page, `${v.id}-2b-gift-items.png`);
    await page.locator('[data-assistant-life-give-who-pair="mua-kiki"]').click(); await page.waitForTimeout(500);
    check(`${T}③ 相手を押すと、今までの「贈る」の確かめへ進む`, await page.locator('[data-assistant-life-gift-sheet]').count() === 0 && await page.locator('[data-assistant-life-give-sheet], [data-assistant-life-gift-confirm], [data-assistant-life-give]').count() > 0);
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => { const b = document.querySelector('[data-assistant-life-give-close], [data-assistant-life-give-sheet] [data-mhl-sheet-close]'); if (b) b.click(); }); await page.waitForTimeout(400);
    // ⑤ きずな
    await page.locator('[data-assistant-life-icon="friends"]').first().click(); await page.waitForTimeout(600);
    const goOff = await page.locator('[data-assistant-life-introduce-go]').isDisabled().catch(() => null);
    await page.locator('[data-assistant-life-pick="mua"]').click(); await page.locator('[data-assistant-life-pick="atsu"]').click(); await page.waitForTimeout(200);
    const goOn = await page.locator('[data-assistant-life-introduce-go]').isEnabled().catch(() => null);
    check(`${T}⑤ 「きずな」に引き合わせるがあり、2人を選ぶと押せる`, goOff === true && goOn === true, JSON.stringify({ goOff, goOn }));
    check(`${T}⑥ きずな: 引き合わせるのボタンは横にはみ出さず高さ40px以上`, (await badBox(page, '[data-assistant-life-introduce] button')).length === 0, JSON.stringify(await badBox(page, '[data-assistant-life-introduce] button')));
    { // ⑪ きずな: 組の行は高さ44px以上で、「あと◯で Lv◯」が出る
      const kz = await page.evaluate(() => { const rows = [...document.querySelectorAll('[data-assistant-peer-row-v2]')]; return { n: rows.length, low: rows.filter(r => r.getBoundingClientRect().height < 44).length, next: rows.filter(r => /あと\d+で Lv\d+/.test(r.innerText)).length }; });
      check(`${T}⑪ きずな: 組の行(${kz.n})は高さ44px以上で、次の Lv まであといくつが出る`, kz.n >= 4 && kz.low === 0 && kz.next === kz.n, JSON.stringify(kz));
    }
    await shot(page, `${v.id}-3-kizuna.png`);
    await page.locator('[data-assistant-life-introduce-go]').click(); await page.waitForTimeout(500);
    check(`${T}⑤ 引き合わせると、次の時間の予定が出る`, await page.locator('[data-assistant-life-introduce-done]').count() === 1 && await page.locator('[data-assistant-life-introduce-go]').isDisabled());
    // ④ 町
    await page.locator('[data-assistant-life-icon="where"]').first().click(); await page.waitForTimeout(1200);
    const town = await page.evaluate(() => ({ map: !!document.querySelector('[data-assistant-life-where]'), below: !!document.querySelector('[data-assistant-life-map-below]'), listBtn: !!document.querySelector('[data-assistant-life-map-list]'), nav: !!document.querySelector('[data-assistant-life-map-nav]'),
      scroll: (() => { const w = document.querySelector('[data-assistant-life-where]'); return w ? w.scrollHeight - w.clientHeight : -1; })() }));
    check(`${T}④ 町: 下の一覧は無く(スクロールもしない)、上の帯にタブ`, town.map && !town.below && !town.listBtn && town.nav && town.scroll <= 1, JSON.stringify(town));
    check(`${T}④ 町のタブも同じ並び`, (await tabsOf(page)).join() === want.join(), (await tabsOf(page)).join());
    check(`${T}⑥ 町: タブは横にはみ出さず高さ40px以上`, (await badBox(page, '[data-assistant-life-map-nav] button')).length === 0, JSON.stringify(await badBox(page, '[data-assistant-life-map-nav] button')));
    await shot(page, `${v.id}-4-town.png`);
    await page.locator('[data-assistant-life-map-nav] [data-assistant-life-icon="house"]').click(); await page.waitForTimeout(600);
    check(`${T}④ 町のタブ「家」で家へ戻る`, await page.locator('[data-assistant-life-where]').count() === 0 && await page.locator('[data-assistant-life-today]').count() > 0);
    await page.close();
    // ⑦ 旧UI
    const old = await open(v, 'false');
    const ot = await tabsOf(old);
    check(`${T}⑦ 旧UI(保存が false)は今までどおり: 道具のタブと「みんなの居場所」がある`, ot.includes('items') && await old.locator('[data-assistant-life-find]').count() === 1 && await old.locator('[data-assistant-life-gift-sheet]').count() === 0, ot.join());
    await old.locator('[data-assistant-life-find]').click(); await old.waitForTimeout(900);
    check(`${T}⑦ 旧UIの地図は下の一覧つき`, await old.locator('[data-assistant-life-map-below] [data-assistant-life-introduce]').count() === 1 && await old.locator('[data-assistant-life-map-back]').count() === 1);
    await old.close();
  }
  { // ⑧ 保存が無い人
    const page = await open(VIEWS[0], null);
    const r = await page.evaluate(() => ({ def: ASSISTANT_LIFE_UI_V2_DEFAULT, v2: !document.querySelector('[data-assistant-life-icon="items"]'), saved: localStorage.getItem('mh_assistant_life_ui_v2') }));
    check(`⑧ 保存が無い人は既定(${r.def ? '新UI' : '旧UI'})で開き、保存は書き換わらない`, r.v2 === r.def && r.saved === null, JSON.stringify(r));
    await page.close();
  }
  for (const v of VIEWS) { // ⑫ 切替は設定の中: 助手ライフの上の帯に切替は無く、設定の「助手ライフの画面」で前の画面を選ぶと、次に開いたとき前の画面
    const T = `[${v.name}] `;
    const page = await open(v, null);
    const noSwitch = await page.locator('[data-assistant-life-ui-switch]').count() === 0;
    await page.locator('[data-assistant-life-close]').first().click(); await page.waitForTimeout(500);
    await page.locator('.mh-home-settings').first().click({ timeout: 8000 }); await page.waitForTimeout(700);
    const row = page.locator('[data-assistant-life-ui-setting]');
    await row.scrollIntoViewIfNeeded().catch(() => {});
    const before = await page.evaluate(() => ({ newOn: (document.querySelector('[data-assistant-life-ui-setting-pick="new"]') || { getAttribute: () => null }).getAttribute('aria-pressed'), saved: localStorage.getItem('mh_assistant_life_ui_v2'),
      out: [...document.querySelectorAll('[data-assistant-life-ui-setting] button')].filter(b => { const r = b.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1 || r.height < 44; }).length }));
    check(`${T}⑫ 上の帯に切替は無く、設定に「助手ライフの画面」(はじめは新しい画面・見ただけでは保存しない・ボタンは44px以上)`, noSwitch && before.newOn === 'true' && before.saved === null && before.out === 0, JSON.stringify({ noSwitch, ...before }));
    if (SHOTS) await page.screenshot({ path: path.join(shotDir, `${v.id}-5-setting.png`) });
    await page.locator('[data-assistant-life-ui-setting-pick="old"]').click(); await page.waitForTimeout(300);
    const saved = await page.evaluate(() => localStorage.getItem('mh_assistant_life_ui_v2'));
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /HOMEへ戻る/.test(x.getAttribute('aria-label') || x.innerText || '')); if (b) b.click(); }); await page.waitForTimeout(700);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 }); await page.waitForTimeout(1500);
    const oldUi = await page.locator('[data-assistant-life-icon="items"]').count() > 0;
    check(`${T}⑫ 「前の画面」を選ぶと false が保存され、次に開くと前の画面`, saved === 'false' && oldUi, JSON.stringify({ saved, oldUi }));
    await page.close();
  }
  check('⑨ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
