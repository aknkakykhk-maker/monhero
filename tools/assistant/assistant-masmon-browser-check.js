// 助手ライフ: 部屋の「🐾 マスモン」(56-assistant-life-masmon.jsx)を本物の画面で開いて確かめる。
//   node tools/assistant/assistant-masmon-browser-check.js          検査(縦 390×844・横 844×390・🔄横から戻った 390×844)
//   node tools/assistant/assistant-masmon-browser-check.js --shots  止め絵も撮る(docs/progress/assistant-peer/shots/masmon-<タブ>-<向き>.jpg)
//   MASMON_ALL=1 で8人ぶん・MASMON_WHO=dra でその1人(ふだんはききだけ)
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る(公開後の確かめ)
// 見るもの:
//   ① 部屋のシートに「🐾 マスモン」の1行があり、押すとシートが開く/4つのタブ(マスモン・編成・デッキ・好き苦手)が全部出る
//   ② マスモンは3体・先頭が1体・染めた絵が出ている(絵の読み込みに失敗していない)
//   ③ 枠の端にカードがくっつかない(パネルの左右から 6px 以上あける)・横にはみ出さない・名前が「…」で切れない
//   ④ 口: assistantLifeCardStyle・assistantLifeTasteOf が8人ぶん返る(印が偽なら null)
//   ⑤ 部屋にいるマスモン: 札・顔・吹き出し・扉・名札に重ならない/部屋からはみ出さない/一緒に出かけたマスモンは部屋に出ない/地図には出ない
//   ⑥ 画面のエラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9273;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/shots');
const BASE = process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const VIEWS = [{ id: 'p', name: '縦 390×844', w: 390, h: 844 }, { id: 'l', name: '横 844×390', w: 844, h: 390 }, { id: 'r', name: '🔄横から戻った 390×844', w: 390, h: 844, rot: true }];
const WHOS = process.env.MASMON_WHO ? [process.env.MASMON_WHO] : process.env.MASMON_ALL ? ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'] : ['kiki'];
const TABS = ['mons', 'team', 'deck', 'taste'];

const layoutProblems = (page) => page.evaluate(() => {
  const ng = [];
  const panel = document.querySelector('.mhm-panel');
  if (!panel) return ['パネルが無い'];
  const pr = panel.getBoundingClientRect();
  if (pr.left < -1 || pr.right > window.innerWidth + 1) ng.push(`パネルが画面からはみ出す(${Math.round(pr.left)}〜${Math.round(pr.right)})`);
  const body = panel.querySelector('.mhm-body');
  if (body && body.scrollWidth > body.clientWidth + 1) ng.push('中身が横にはみ出す');
  for (const c of panel.querySelectorAll('.mhm-card')) {
    const r = c.getBoundingClientRect();
    if (r.left - pr.left < 6 || pr.right - r.right < 6) ng.push(`カードが枠の端にくっつく(左${Math.round(r.left - pr.left)}・右${Math.round(pr.right - r.right)})`);
  }
  for (const t of panel.querySelectorAll('.truncate')) if (t.scrollWidth > t.clientWidth + 1) ng.push(`文字が切れる: ${t.textContent.slice(0, 18)}`);
  for (const t of panel.querySelectorAll('.mhm-tab')) if (t.scrollWidth > t.clientWidth + 1) ng.push(`タブの文字が切れる: ${t.textContent}`);
  for (const im of panel.querySelectorAll('img')) if (im.complete && im.naturalWidth === 0) ng.push(`絵が出ない: ${im.getAttribute('src') ? im.getAttribute('src').slice(0, 40) : im.alt}`);
  return [...new Set(ng)];
});

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const v of VIEWS) {
      const T0 = `[${v.name}] `; const T = T0;
      const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
      const errors = []; page.on('pageerror', e => errors.push(String(e)));
      await page.clock.setFixedTime(new Date('2026-11-08T03:40:00Z'));
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
      await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
      await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page);
      if (v.rot) {
        await page.locator('.mh-home-facility.rhythm').click({ timeout: 15000 }).catch(() => {});
        await page.getByRole('button', { name: '戻る' }).first().waitFor({ timeout: 15000 }).catch(() => {});
        await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(90)); await page.waitForTimeout(800);
        await page.getByRole('button', { name: '戻る' }).first().click({ timeout: 5000 }).catch(() => {});
        await page.locator('.mh-home-player').waitFor({ timeout: 15000 }).catch(() => {});
      }
      await finishTalk(page);
      await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
      await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 8000 });
      await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
      { // ⑤ 部屋にいるマスモン
        await page.waitForTimeout(1500);
        const r = await page.evaluate(() => {
          const ng = []; let n = 0, stay = 0;
          const life = assistantLifeCurrent();
          for (const room of document.querySelectorAll('[data-assistant-life-room]')) {
            const id = room.getAttribute('data-assistant-life-room');
            const pet = room.querySelector('[data-assistant-life-room-masmon-pet]');
            const where = assistantMasmonWhere(id, life).kind;
            if (where === 'out' && pet) ng.push(`${id}: 出かけたのに部屋にいる`);
            if (!pet || pet.style.visibility === 'hidden') continue;
            n++; if (where === 'stay') stay++;
            const a = pet.getBoundingClientRect(), mark = pet.querySelector('b'), m = mark ? mark.getBoundingClientRect() : null, rr = room.getBoundingClientRect();
            const boxes = [a, m].filter(Boolean);
            for (const b of boxes) if (b.left < rr.left - 1 || b.right > rr.right + 1 || b.top < rr.top - 1 || b.bottom > rr.bottom + 1) ng.push(`${id}: 部屋からはみ出す`);
            for (const o of room.querySelectorAll('.tag,.pp,.bb,.pl,.lv,[data-assistant-life-rel-door],[data-assistant-life-rel-mend],[data-assistant-life-rel-sit]')) {
              const q = o.getBoundingClientRect(); if (!q.width) continue;
              for (const b of boxes) if (Math.min(b.right, q.right) - Math.max(b.left, q.left) > 1 && Math.min(b.bottom, q.bottom) - Math.max(b.top, q.top) > 1) ng.push(`${id}: ${o.className || o.getAttribute('data-assistant-life-rel-door') || '部品'} に重なる`);
            }
          }
          return { ng: [...new Set(ng)], n, stay };
        });
        check(`${T}部屋のマスモン: 札・顔・吹き出し・扉・名札に重ならない・はみ出さない`, !r.ng.length, r.ng.slice(0, 4).join(' / '));
        check(`${T}部屋のマスモンが1体以上いる`, r.n >= 1, `${r.n}部屋(留守番${r.stay})`);
        if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-5-house-${v.id}.jpg`), type: 'jpeg', quality: 80 });
      }
      if (v.id === 'p') {
        const hooks = await page.evaluate(() => ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'].map(id => ({ id, s: assistantLifeCardStyle(id), t: assistantLifeTasteOf(id) })));
        check(`${T}口 assistantLifeCardStyle が8人ぶん attack/guard/normal`, hooks.every(h => ['attack', 'guard', 'normal'].includes(h.s)), hooks.map(h => `${h.id}:${h.s}`).join(' '));
        check(`${T}口 assistantLifeTasteOf が8人ぶん(好きは1つ以上・名前で)`, hooks.every(h => h.t && h.t.likes.length >= 1 && h.t.likes.every(n => typeof n === 'string' && n)), hooks.map(h => `${h.id}:${h.t ? h.t.likes.join('・') : 'null'}`).join(' / '));
      }
      for (const WHO of WHOS) {
      const T = `${T0}${WHO} `;
      const want = await page.evaluate((id) => { const p = ASSISTANT_MASMON_PLAN.find(a => a.id === id); return { deck: p.deck.name, colors: p.favColors.length, dis: p.dislikeMon.length }; }, WHO);
      await page.locator(`[data-assistant-life-room="${WHO}"]`).first().click({ timeout: 8000 });
        await page.locator('[data-assistant-life-room-sheet]').waitFor({ timeout: 5000 });
        const row = page.locator('[data-assistant-life-room-masmon]');
        check(`${T}部屋のシートに「🐾 マスモン」の1行`, (await row.count()) === 1, await row.innerText().catch(() => ''));
        if (SHOTS) { await row.scrollIntoViewIfNeeded().catch(() => {}); await page.screenshot({ path: path.join(shotDir, `masmon-0-room-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 }); }
        await row.click({ timeout: 5000 }).catch(() => {});
        await page.locator('[data-assistant-masmon-sheet]').waitFor({ timeout: 5000 }).catch(() => {});
        check(`${T}押すとマスモンのシートが開く`, (await page.locator(`[data-assistant-masmon-sheet="${WHO}"]`).count()) === 1);
        for (const tab of TABS) {
          await page.locator(`[data-assistant-masmon-tab-btn="${tab}"]`).click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(tab === 'mons' || tab === 'team' ? 1500 : 500); // 染めた絵ができるのを待つ
          check(`${T}タブ「${tab}」が開く`, (await page.locator(`[data-assistant-masmon-tab="${tab}"]`).count()) === 1);
          if (tab === 'mons') {
            const n = await page.locator('[data-assistant-masmon-row]').count();
            const leads = await page.locator('[data-assistant-masmon-row] .mhm-lead').count();
            check(`${T}マスモンは3体・先頭は1体`, n === 3 && leads === 1, `${n}体・先頭${leads}`);
          }
          if (tab === 'team') check(`${T}編成に3体`, (await page.locator('[data-assistant-masmon-team]').count()) === 3);
          if (tab === 'deck') check(`${T}デッキの型の名前「${want.deck}」`, (await page.locator('[data-assistant-masmon-deck]').innerText().catch(() => '')).includes(want.deck));
          if (tab === 'taste') check(`${T}好き・苦手・好きな色が出る`, (await page.locator('[data-assistant-masmon-taste^="like:"]').count()) >= 1 && ((await page.locator('[data-assistant-masmon-taste^="dislike:"]').count()) >= 1) === (want.dis > 0) && (await page.locator('[data-assistant-masmon-color]').count()) === want.colors);
          const ng = await layoutProblems(page);
          check(`${T}「${tab}」: 端にくっつかない・はみ出さない・切れない・絵が出る`, !ng.length, ng.slice(0, 4).join(' / '));
          if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-${TABS.indexOf(tab) + 1}-${tab}-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 });
        }
        await page.locator('[data-assistant-masmon-close]').click({ timeout: 3000 }).catch(() => {});
        check(`${T}閉じると部屋のシートに戻る`, (await page.locator('[data-assistant-masmon-sheet]').count()) === 0 && (await page.locator('[data-assistant-life-room-sheet]').count()) === 1);
      await page.evaluate(() => { const b = document.querySelector('[data-assistant-life-room-sheet] > button[aria-label="閉じる"]'); if (b) b.click(); });
        await page.locator('[data-assistant-life-room-sheet]').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
      }
      check(`${T}画面のエラーが無い`, !errors.length, errors.slice(0, 2).join(' / '));
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\nNG が ${failed} 件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
