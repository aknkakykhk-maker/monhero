// 助手ライフを開いた最初の家の場面とできごとの場面(2026-11-11 社長 案A・ナカヨシ20・docs/progress/assistant-life/top-scene/PLAN.md)を、実際に開いて確かめる
//   公開の印(assistantLifeTopHouse・assistantLifeDailyScene)はページの中だけで真にする。場面の台詞は本物(無いときだけ確かめ用の見本を入れる)
//   ① 家の断面図が得の帯より上にあり、4部屋×2段・下の家の絵と「みんなの今」の一覧は出ない ② 出かけ先の丸と1行・できごとに出る人の部屋に ❗
//   ③ 得の帯は「⏰ いま」だけで、「📅 今日・🌱 次のごほうび」は ▼ で開く ④ できごと: 見に行く → 掛け合い → 2択 → 返事。見た時間帯が mh_assistant_life_daily_v1 に入り、2人の 💗 が +4
//   ⑤ 印が偽なら今までどおり(家の絵は下・「聞く ▶」) ⑥ 押せる所は44px以上・横にはみ出さない ⑦ ページのエラーが出ない
//   --shots [置き場]  縦 390×844・横 844×390 の止め絵(既定 docs/progress/assistant-life/top-scene/real/)
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9277;
const argv = process.argv.slice(2), si = argv.indexOf('--shots');
const SHOTS = si >= 0, shotDir = path.resolve(root, si >= 0 && argv[si + 1] && !argv[si + 1].startsWith('--') ? argv[si + 1] : 'docs/progress/assistant-life/top-scene/real');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const MIX = { groups: [{ ids: ['atsu', 'erubin'], doing: 'walk', place: 'hill' }, { ids: ['dra', 'sorashido'], doing: 'cards', place: 'cardroom' }],
  solo: { mua: { doing: 'snack', place: 'cafe' }, kiki: { doing: 'read', place: 'home' }, momosuke: { doing: 'practice', place: 'studio' }, kyuko: { doing: 'cards', place: 'home' } } };
const VIEWS = [{ id: 'tate', name: '縦 390×844', w: 390, h: 844 }, { id: 'yoko', name: '横 844×390', w: 844, h: 390 }];
// 確かめ用の見本の台詞(全員・全時間帯に同じ形。本番の台詞ではない)
const SAMPLE = (() => {
  const ids = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'], slots = ['late', 'morning', 'noon', 'afternoon', 'evening', 'night'];
  const parts = {}; for (const id of ids) parts[id] = { open: { e: 'happy', t: '見本の台詞(はじめ)' }, back: { e: 'happy', t: '見本の台詞(受ける)' }, r1: { e: 'excited', t: '見本の返事1。{name}も一緒に' }, r2: { e: 'wink', t: '見本の返事2' } };
  return { scenes: slots.map(s => ({ id: `${s}-1`, slot: s, title: '見本の場面', choices: ['📸 一緒に撮る', '🌇 ふたりを撮る'], parts })), rares: [] };
})();
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
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = [];
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const open = async (v, on) => {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${v.name}: ${e.message}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    await page.evaluate(({ m, on, sample }) => {
      RELEASE_FLAGS.assistantLifeTopHouse = on; RELEASE_FLAGS.assistantLifeDailyScene = on;
      if (on && !ASSISTANT_LIFE_DAILY_TALKS.scenes.length) { ASSISTANT_LIFE_DAILY_TALKS.scenes.splice(0, ASSISTANT_LIFE_DAILY_TALKS.scenes.length, ...sample.scenes); }
      const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, watched: [] } });
    }, { m: MIX, on, sample: SAMPLE });
    await page.waitForTimeout(800); await finishTalk(page);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    return page;
  };
  const shot = async (page, v, name) => { if (SHOTS) await page.screenshot({ path: path.join(shotDir, `${name}-${v.id}.png`) }); };
  const layout = (page) => page.evaluate(() => {
    const el = document.querySelector('[data-assistant-life-screen]');
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
    const btns = [...el.querySelectorAll('[data-assistant-life-top-place],[data-assistant-life-benefit-fold],[data-assistant-life-daily-go],[data-assistant-life-daily-choice],[data-assistant-life-daily-scene-close],[data-assistant-life-daily-scene-back]')].filter(vis);
    return { small: btns.filter(b => b.getBoundingClientRect().height < 44).map(b => b.getAttribute('data-assistant-life-top-place') || b.textContent.trim().slice(0, 8)),
      over: [...el.querySelectorAll('[data-assistant-life-top-house],[data-assistant-life-top-strip],[data-assistant-life-benefit],[data-assistant-life-daily]')].filter(x => x.getBoundingClientRect().right > innerWidth + 1).length };
  });
  for (const v of VIEWS) {
    const T = `[${v.name}] `;
    const page = await open(v, true);
    const a = await page.evaluate(() => {
      const top = document.querySelector('[data-assistant-life-top-house]'), ben = document.querySelector('[data-assistant-life-benefit]');
      return { top: !!top, above: !!top && !!ben && top.getBoundingClientRect().top < ben.getBoundingClientRect().top,
        grid4: document.querySelectorAll('[data-assistant-life-grid4="1"]').length, houses: document.querySelectorAll('[data-assistant-life-house]').length,
        rooms: top ? top.querySelectorAll('[data-assistant-life-room]').length : 0, status: !!document.querySelector('[data-assistant-life-v2-status]'),
        places: [...document.querySelectorAll('[data-assistant-life-top-place]')].map(x => x.getAttribute('data-assistant-life-top-place')),
        sum: (document.querySelector('[data-assistant-life-top-sum]') || {}).textContent || '',
        ev: [...document.querySelectorAll('[data-assistant-life-room-ev]')].map(x => x.getAttribute('data-assistant-life-room-ev')),
        today: !!document.querySelector('[data-assistant-life-benefit-row="today"],[data-assistant-life-benefit-line="today"]'), fold: (document.querySelector('[data-assistant-life-benefit-fold]') || {}).getAttribute?.('data-assistant-life-benefit-fold') || '' };
    });
    check(`${T}① 家の断面図が得の帯より上・4部屋×2段・8部屋・家は1つ・「みんなの今」の一覧は出ない`, a.top && a.above && a.grid4 === (v.w < v.h ? 1 : 0) && a.houses === 1 && a.rooms === 8 && !a.status, JSON.stringify({ top: a.top, above: a.above, grid4: a.grid4, houses: a.houses, rooms: a.rooms, status: a.status }));
    check(`${T}② 出かけ先の丸(丘・カード部屋・おやつ屋さん・スタジオ)と1行・できごとの2人に ❗`, ['hill', 'cardroom', 'cafe', 'studio'].every(p => a.places.includes(p)) && /家に2人 ・ おでかけ6人/.test(a.sum) && a.ev.length === 2, JSON.stringify({ places: a.places, sum: a.sum, ev: a.ev }));
    check(`${T}③ 得の帯は「今日・次」をたたむ`, a.fold === 'closed', JSON.stringify({ fold: a.fold }));
    const l1 = await layout(page);
    check(`${T}⑥ 押せる所は44px以上・はみ出さない(トップ)`, l1.small.length === 0 && l1.over === 0, JSON.stringify(l1));
    await shot(page, v, '1-top');
    // ⑧ 見やすさ(2026-11-11 ミヤスサの点検 上位5): 家の最初の画面の長さ・下の札にかぶらない・横でも家が最初に見える
    const m = await page.evaluate(() => {
      const body = document.querySelector('[data-assistant-life-screen] .mhl-body'), bar = body && body.nextElementSibling, top = document.querySelector('[data-assistant-life-top-house]');
      if (!body || !bar || !top) return null;
      const screens = +(body.scrollHeight / body.clientHeight).toFixed(2);
      const topVis = top.getBoundingClientRect().top < body.getBoundingClientRect().bottom - 80;
      body.scrollTop = body.scrollHeight;
      const kids = [...body.querySelectorAll('[data-assistant-life-benefit],[data-assistant-life-daily],[data-assistant-life-top-strip]')];
      const lastBottom = Math.max(...kids.map(x => x.getBoundingClientRect().bottom));
      const br = bar.getBoundingClientRect(), bb = body.getBoundingClientRect();
      const barTop = br.top >= bb.bottom - 2 ? br.top : Infinity; // 横は下の札が右の列(横並び)なので、かぶりは見ない
      body.scrollTop = 0;
      return { screens, topVis, lastBottom: Math.round(lastBottom), barTop: Number.isFinite(barTop) ? Math.round(barTop) : 'side' };
    });
    check(`${T}⑧ 家の画面は2画面まで・いちばん下の札が下の固定の札にかぶらない・家が最初に見える`, !!m && m.screens <= 2 && (m.barTop === 'side' || m.lastBottom <= m.barTop + 1) && m.topVis, JSON.stringify(m));
    await page.locator('[data-assistant-life-benefit-fold]').click(); await page.waitForTimeout(300);
    check(`${T}③ ▼ で「今日・次のごほうび」が開く`, (await page.locator('[data-assistant-life-benefit-fold="open"]').count()) === 1);
    await page.locator('[data-assistant-life-benefit-fold]').click(); await page.waitForTimeout(300);
    // ④ できごと
    const bondBefore = await page.evaluate(() => Object.fromEntries(['atsu', 'erubin'].map(id => [id, (JSON.parse(localStorage.getItem(`mh_assistant_bond_${id}_v1`) || localStorage.getItem(`mh_assistant_bond_${id}`) || 'null') || {}).points || 0])));
    const go = page.locator('[data-assistant-life-daily-go]');
    check(`${T}④ できごとの札に「見に行く ▶」`, (await go.count()) === 1);
    if (await go.count()) {
      await go.scrollIntoViewIfNeeded(); await shot(page, v, '2-card');
      await go.click(); await page.waitForTimeout(700);
      await shot(page, v, '3-scene-talk');
      for (let i = 0; i < 4 && (await page.locator('[data-assistant-life-daily-phase="talk"]').count()); i++) { await page.locator('[data-assistant-life-daily-talk]').click(); await page.waitForTimeout(250); }
      check(`${T}④ 掛け合いのあと2択が出る`, (await page.locator('[data-assistant-life-daily-choice]').count()) === 2);
      await shot(page, v, '4-scene-choice');
      const l2 = await layout(page);
      check(`${T}⑥ 押せる所は44px以上(場面)`, l2.small.length === 0, JSON.stringify(l2));
      await page.locator('[data-assistant-life-daily-choice="0"]').click(); await page.waitForTimeout(900);
      const r = await page.evaluate(() => ({ phase: (document.querySelector('[data-assistant-life-daily-scene]') || {}).getAttribute?.('data-assistant-life-daily-phase'), res: (document.querySelector('[data-assistant-life-daily-result]') || {}).textContent || '',
        saved: JSON.parse(localStorage.getItem('mh_assistant_life_daily_v1') || 'null'), lines: document.querySelectorAll('[data-assistant-life-daily-line]').length }));
      check(`${T}④ 返事のあと: 結果の札・見た時間帯が保存に入る`, r.phase === 'done' && /ふれあい1回/.test(r.res) && /\+4/.test(r.res) && !!r.saved && Array.isArray(r.saved.heard) && r.saved.heard.length === 1 && r.lines === 3, JSON.stringify(r));
      await shot(page, v, '5-scene-done');
      const bondAfter = await page.evaluate(() => Object.fromEntries(['atsu', 'erubin'].map(id => [id, (JSON.parse(localStorage.getItem(`mh_assistant_bond_${id}_v1`) || localStorage.getItem(`mh_assistant_bond_${id}`) || 'null') || {}).points || 0])));
      check(`${T}④ 出てきた2人の 💗 が +4`, bondAfter.atsu - bondBefore.atsu === 4 && bondAfter.erubin - bondBefore.erubin === 4, JSON.stringify({ bondBefore, bondAfter }));
      await page.locator('[data-assistant-life-daily-scene-close]').click(); await page.waitForTimeout(500);
      const after = await page.evaluate(() => ({ scene: !!document.querySelector('[data-assistant-life-daily-scene]'), go: !!document.querySelector('[data-assistant-life-daily-go]'), ev: document.querySelectorAll('[data-assistant-life-room-ev]').length }));
      check(`${T}④ 閉じると札は「見ました」・❗ が消える`, !after.scene && !after.go && after.ev === 0, JSON.stringify(after));
    }
    await page.close();
    const old = await open(v, false);
    const o = await old.evaluate(() => { const h = document.querySelector('[data-assistant-life-house]'), b = document.querySelector('[data-assistant-life-benefit]');
      return { top: !!document.querySelector('[data-assistant-life-top-house],[data-assistant-life-top-strip],[data-assistant-life-benefit-fold]'), below: !!h && !!b && h.getBoundingClientRect().top > b.getBoundingClientRect().top, listen: !!document.querySelector('[data-assistant-life-daily-listen]') }; });
    check(`${T}⑤ 印が偽なら今までどおり(家の絵は下・「聞く ▶」)`, !o.top && o.below && o.listen, JSON.stringify(o));
    await old.close();
  }
  check('⑦ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
