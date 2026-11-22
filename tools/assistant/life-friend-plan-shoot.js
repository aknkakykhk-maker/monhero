#!/usr/bin/env node
// 助手ライフの作り直し 段10(友情を型に載せる)の案の止め絵を撮る。ゲーム本体は変えない・読むだけ。
//   node tools/assistant/life-friend-plan-shoot.js
//   出す物: docs/progress/assistant-life/step10-friendship/ の before-1.png・before-2.png(いまの友情タブ・本物の画面)・
//           pairs.json(見本に使う28組の友情Lv・あと◯・いる場所)・plan-a/b/c.png(案の見本 mock.html)
// 前は本物の画面(偽のデータ・15:00)。案は mock.html(本物の型の見た目 ALU_CSS・顔の絵・字の4段)を 390×844 で撮る。
// どちらも iPhone の切り欠きあり(上47px・下34px。2026-11-22 r1119-098)で撮る
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..');
const OUT = path.join(root, 'docs/progress/assistant-life/step10-friendship');
const PORT = 9293;
// 見本の友情ポイント(組ごとにばらつかせる。0 は「まだ会っていない」にならないよう 1 以上)
const BOND = {
  'kiki-mua': 1180, 'dra-sorashido': 860, 'erubin-sorashido': 640, 'dra-erubin': 520, 'momosuke-mua': 470, 'atsu-momosuke': 390, 'kiki-kyuko': 330,
  'atsu-dra': 260, 'kyuko-mua': 240, 'erubin-kiki': 200, 'atsu-kiki': 170, 'kiki-momosuke': 150, 'kyuko-sorashido': 120, 'atsu-mua': 110,
  'dra-mua': 95, 'erubin-mua': 80, 'kiki-sorashido': 70, 'dra-kiki': 60, 'atsu-kyuko': 50, 'atsu-erubin': 45, 'dra-momosuke': 40,
  'erubin-momosuke': 35, 'kyuko-momosuke': 30, 'mua-sorashido': 25, 'atsu-sorashido': 20, 'dra-kyuko': 15, 'erubin-kyuko': 12, 'momosuke-sorashido': 10,
};
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が無い'); process.exit(0); }
  fs.mkdirSync(OUT, { recursive: true });
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(root, 'tools/boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require('./life-browser-shared');
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const MIX = { groups: [{ ids: ['mua', 'kiki'], place: 'cafe', doing: 'cafe' }, { ids: ['dra', 'sorashido', 'erubin'], place: 'cardroom', doing: 'card' }],
    solo: { momosuke: { doing: 'battle', place: 'battle' }, atsu: { doing: 'idle', place: 'home' }, kyuko: { doing: 'read', place: 'library' } } };
  const errs = [];
  const notch = () => { const set = () => { const r = document.documentElement; r.style.setProperty('--mh-safe-top', '47px'); r.style.setProperty('--mh-safe-bottom', '34px'); r.style.setProperty('--mh-safe-left', '0px'); r.style.setProperty('--mh-safe-right', '0px'); }; if (document.documentElement) set(); document.addEventListener('DOMContentLoaded', set); };
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const jst = new Date(Date.now() + 9 * 3600000); jst.setUTCHours(15, 0, 0, 0);
    await page.clock.setFixedTime(new Date(jst.getTime() - 9 * 3600000));
    page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 160)));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = ['assistant_life_friend']; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.addInitScript((b) => { localStorage.setItem('mh_assistant_peer_bond_v1', JSON.stringify(b)); }, BOND);
    await page.addInitScript(notch);
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    try {
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page); await waitFaces(page); await finishTalk(page);
      await page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, watched: [] } }); }, MIX);
      await page.waitForTimeout(600); await finishTalk(page);
      await page.locator('[data-home-assistant-life]').first().click({ timeout: 20000 });
      await page.locator('[data-assistant-life-typed-house]').waitFor({ timeout: 15000 });
      await page.locator('[data-alu-tab="friends"], [data-assistant-life-tabs] button:has-text("友情"), button[role="tab"]:has-text("友情")').first().click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, 'before-1.png') });
      // 送った先(中身の続き)
      await page.evaluate(() => { const els = [...document.querySelectorAll('[data-assistant-life-screen] *')].filter(e => e.scrollHeight > e.clientHeight + 40 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)); const el = els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0]; if (el) el.scrollTop = Math.round(el.clientHeight * 0.9); });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, 'before-2.png') });
      const pairs = await page.evaluate(() => {
        const st = ASSISTANT_PEER_STORE.state;
        const ids = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
        const out = [];
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
          const k = [ids[i], ids[j]].sort().join('-');
          const pts = (st.bond || {})[k] || 0;
          const lv = assistantPeerLevelOf(pts);
          const next = typeof assistantPeerBondNext === 'function' ? assistantPeerBondNext(pts) : null;
          out.push({ pair: k, pts, lv, next });
        }
        return out.sort((a, b) => b.pts - a.pts);
      });
      const tallest = await page.evaluate(() => { const els = [...document.querySelectorAll('[data-assistant-life-screen] *')].filter(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY)); const el = els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0]; return el ? { scroll: el.scrollHeight, view: el.clientHeight } : null; });
      fs.writeFileSync(path.join(OUT, 'pairs.json'), JSON.stringify({ at: '15:00', groups: MIX.groups, solo: MIX.solo, pairs, beforeScroll: tallest }, null, 1) + '\n');
      console.log(`前: before-1.png・before-2.png(中身の高さ ${tallest ? `${tallest.scroll}px / 見える ${tallest.view}px` : '—'})`);
    } catch (e) { errs.push(`前: ${String(e.message || e).split('\n')[0].slice(0, 160)}`); }
    await ctx.close();
  }
  if (fs.existsSync(path.join(OUT, 'mock.html'))) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const p of ['a', 'b', 'c']) {
      await page.goto(`http://localhost:${PORT}/docs/progress/assistant-life/step10-friendship/mock.html?plan=${p}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `plan-${p}.png`) });
      const m = await page.evaluate(() => {
        const s = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el.getClientRects().length) continue; s.add(Math.round(parseFloat(getComputedStyle(el).fontSize))); }
        const go = document.querySelector('.alu-go'); const r = go ? go.getBoundingClientRect() : null;
        const tabs = document.querySelector('.alu-tabs'); const tr = tabs ? tabs.getBoundingClientRect() : null;
        return { sizes: [...s].sort((a, b) => a - b), go: r ? { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) } : null, tabsTop: tr ? Math.round(tr.top) : null, tabsBottom: tr ? Math.round(tr.bottom) : null };
      });
      const goOk = m.go && m.go.w >= 120 && m.go.h >= 44 && m.go.bottom <= (m.tabsTop || 844);
      console.log(`案${p.toUpperCase()}: plan-${p}.png 字 ${m.sizes.join('/')}px・主なボタン ${m.go ? `${m.go.w}×${m.go.h} 上${m.go.top}` : '無い'}${goOk ? '' : '(NG)'}・下のタブの下端 ${m.tabsBottom}(844-34=810 まで)`);
      if (!goOk) errs.push(`案${p}: 主なボタンが小さいか最初の画面に入っていない`);
      if (m.sizes.some(x => x < 11)) errs.push(`案${p}: 11px 未満の字`);
      if (m.tabsBottom > 810) errs.push(`案${p}: 下のタブが切り欠きに入る`);
    }
    await ctx.close();
  }
  await browser.close(); server.close();
  if (errs.length) { console.log(`NG: ${errs.join(' / ')}`); process.exit(1); }
  console.log('OK: 撮れた');
})();
