#!/usr/bin/env node
// 助手ライフの作り直し 段11(フレンドを型に載せる)の止め絵を撮る。ゲーム本体は変えない・読むだけ。
//   node tools/assistant/life-visit-plan-shoot.js            前(いまのフレンドのタブ・本物の画面)と案の見本(mock.html があれば)
//   node tools/assistant/life-visit-plan-shoot.js --after    型に載せた後の本物の画面(縦・横)と、押したときの動き
//   出す物: docs/progress/assistant-life/step11-friend/
// どちらも iPhone の切り欠きあり(縦: 上47・下34 / 横: 左右47・下21。2026-11-22 r1119-098)で撮る。
// 偽のフレンド(あおい・ゆうと・みお)と置き手紙は tools/assistant/assistant-life-friend-browser-check.js と同じ中身
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..');
const OUT = path.join(root, 'docs/progress/assistant-life/step11-friend');
const PORT = 9294;
const AFTER = process.argv.includes('--after');
let presenceLife = false;
// 偽の Supabase(承認済みのフレンド2人・控え2軒・自分あての置き手紙2通)
const fresh = new Date(Date.now() - 3 * 3600000).toISOString();
const dayKey = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
const HOUSES = [
  { breeder_id: 'aoi-0001', open: true, updated_at: fresh, house: { v: 1, ids: ['mua', 'kiki', 'dra', 'momosuke', 'atsu', 'kyuko', 'sorashido', 'erubin'], r: { mua: { at: 'home', d: 'snack', m: 'happy', fu: { c: 'lantern', w: 'starpic', f: 'sofa' } }, kiki: { p: 'cardroom', at: 'out', d: 'walk', m: 'happy' }, dra: { fu: { f: 'bear', w: 'trophy' }, at: 'home', d: 'idle', m: 'happy' }, momosuke: { at: 'home', d: 'practice', m: 'eager' }, atsu: { at: 'home', d: 'cards', m: 'happy' }, kyuko: { at: 'out', d: 'read', m: 'happy' }, sorashido: { at: 'home', d: 'training', m: 'happy' }, erubin: { at: 'home', d: 'sleep', m: 'sleepy' } }, ac1: { k: 'beat', x: '「風がそよぐ」を遊んだ', at: Date.now() - 3600000 }, dy: [{ t: '10:10', x: '朝: みゅあ・ききが居間でおやつ' }, { t: '09:00', x: 'ドラ セッション → 🎵Lv2' }] } },
  { breeder_id: 'yuto-0001', open: true, updated_at: fresh, house: { v: 1, ids: ['momosuke', 'kyuko'], r: { momosuke: { at: 'home', d: 'snack', m: 'happy' }, kyuko: { at: 'home', d: 'idle', m: 'happy' } } } },
];
const route = (posted) => async (r) => {
  const url = r.request().url(); const method = r.request().method();
  const json = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: typeof body === 'string' ? body : JSON.stringify(body) });
  if (/assistant_life_friend_switch/.test(url)) return json([{ mode: 'on' }]);
  if (/assistant_life_friend_house_more/.test(url)) {
    if (method !== 'GET') { try { posted.push({ more: JSON.parse(r.request().postData()) }); } catch {} return json('', 201); }
    return json(/aoi-0001/.test(url) ? [{ more: { v: 1, bd: { mua: 2, kiki: 1, dra: 0 }, fv: { a: 'mua', s: 'テスト曲' }, fu: { mua: { p: { c: 'lantern', w: 'starpic', f: 'sofa' }, k: ['bear', 'plant'] }, dra: { p: { w: 'trophy', f: 'bear' }, k: [] } }, ms: { kiki: [{ mo: 'Mocchi', n: 'ごろちゃん', c: ['custom:120:40:85@70', null], l: 1 }, { mo: 'Pandora', n: 'のあ', c: [] }] }, mn: { kiki: 5 }, ac: [{ k: 'masmon', x: '新しいマスモン「ゴーレム」を迎えた', at: Date.now() - 1800000 }, { k: 'beat', x: '「風がそよぐ」を遊んだ', at: Date.now() - 3600000 }], dy: [{ t: '11:00', x: '昼: ももすけ・あつが練習スタジオで練習' }, { t: '10:10', x: '朝: みゅあ・ききが居間でおやつ' }, { t: '09:00', x: 'ドラ セッション → 🎵Lv2' }] }, updated_at: fresh }] : []);
  }
  if (/assistant_life_friend_houses/.test(url)) return method === 'GET' ? json(HOUSES) : json('', 201);
  if (/assistant_life_friend_visits/.test(url)) {
    if (method === 'POST') { try { posted.push(JSON.parse(r.request().postData())); } catch {} return json('', 201); }
    if (method === 'PATCH') return json('', 204);
    const self = (url.match(/host_id\.eq\.([^,)]+)/) || [])[1] || 'x';
    return json([
      { id: 11, kind: 'player', visitor_id: 'aoi-0001', host_id: self, day: dayKey, assistants: ['dra'], word: 1, thanks: null, note: 'ソファふかふかでよかった！', note_to: null, created_at: new Date(Date.now() - 40 * 60000).toISOString() },
      { id: 12, kind: 'go', visitor_id: 'yuto-0001', host_id: self, day: dayKey, assistants: ['momosuke'], word: 4, thanks: 0, created_at: new Date(Date.now() - 90 * 60000).toISOString() },
    ]);
  }
  if (/friend_links/.test(url)) {
    const self = (url.match(/requester_id\.eq\.([^,)&]+)/) || url.match(/eq\.([0-9a-f-]{20,})/) || [])[1] || 'x';
    return json([{ requester_id: self, target_id: 'aoi-0001', status: 'accepted', blocked_by: null, created_at: fresh, updated_at: fresh }, { requester_id: 'yuto-0001', target_id: self, status: 'accepted', blocked_by: null, created_at: fresh, updated_at: fresh }, { requester_id: self, target_id: 'mio-0001', status: 'accepted', blocked_by: null, created_at: fresh, updated_at: fresh }]);
  }
  // いまの状態(friend_profiles の place・records)。あおい=オート周回中(モンヒロビート)/ゆうと=演奏中/みお=ホームを開いたまま25分
  if (/friend_profiles/.test(url) && /select=breeder_id,place/.test(url)) {
    const at = new Date(Date.now() - 60000).toISOString();
    // ⑰ 助手ライフの中の場所(あおい=みゅあの部屋/ゆうと=フレンドの家/みお=みんなの居場所)
    if (presenceLife) return json([{ breeder_id: 'aoi-0001', place: 'other', updated_at: at, records: { pl: 'life', lv: 'h', la: 'mua' } }, { breeder_id: 'yuto-0001', place: 'other', updated_at: at, records: { pl: 'life', lv: 'v' } }, { breeder_id: 'mio-0001', place: 'other', updated_at: at, records: { pl: 'life', lv: 'w' } }]);
    return json([{ breeder_id: 'aoi-0001', place: 'rhythm', updated_at: at, records: { au: 1 } }, { breeder_id: 'yuto-0001', place: 'other', updated_at: at, records: { pl: 'rhythmPlay' } }, { breeder_id: 'mio-0001', place: 'home', updated_at: at, records: { im: 25 } }]);
  }
  if (/friend_profiles|breeder_profiles/.test(url)) return json([{ breeder_id: 'aoi-0001', user_name: 'あおい', last_seen_at: fresh }, { breeder_id: 'yuto-0001', user_name: 'ゆうと', last_seen_at: fresh }, { breeder_id: 'mio-0001', user_name: 'みお', last_seen_at: fresh }]);
  if (/functions\/v1\/assistant-chat/.test(url)) return json({ ok: false, kind: 'tired' });
  return json([]);
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
  const errs = [];
  const notchOf = (land) => land ? { top: 0, bottom: 21, left: 47, right: 47 } : { top: 47, bottom: 34, left: 0, right: 0 };
  // 測る: 字の大きさ・主なボタン・上の帯の「戻る」と時刻・下のタブ・折れ/切れ
  const measure = (page, n) => page.evaluate((n) => {
    const W = innerWidth, H = innerHeight; const out = { sizes: [], ng: [] };
    const s = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const scope = document.querySelector('[data-assistant-life-typed-visit]') || document.querySelector('[data-assistant-life-screen]');
    for (let t = w.nextNode(); t; t = w.nextNode()) { if (!t.textContent.trim()) continue; const el = t.parentElement; if (!scope || !scope.contains(el) || !el.getClientRects().length) continue; const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > H) continue; s.add(Math.round(parseFloat(getComputedStyle(el).fontSize) * 2) / 2); }
    out.sizes = [...s].sort((a, b) => a - b);
    const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const back = scope && [...scope.querySelectorAll('button')].find(b => /戻る/.test(b.textContent || ''));
    if (back) { const r = back.getBoundingClientRect(); out.back = Math.round(r.top); if (r.top < n.top - 1) out.ng.push(`「戻る」が上${n.top}pxの切り欠きの中(上${Math.round(r.top)})`); if (r.left < n.left - 1) out.ng.push('「戻る」が左の切り欠きの中'); }
    const tabs = scope && scope.querySelector('.alu-tabs'); if (tabs) { const r = tabs.getBoundingClientRect(); out.tabsBottom = Math.round(r.bottom); if (r.bottom > H - n.bottom + 1) out.ng.push(`下のタブが下${n.bottom}pxの切り欠きに入る(${Math.round(r.bottom)})`); }
    const go = scope && scope.querySelector('.alu-go'); if (go) { const r = go.getBoundingClientRect(); out.go = `${Math.round(r.width)}×${Math.round(r.height)} 上${Math.round(r.top)}`; if (r.width < 120 || r.height < 44) out.ng.push('主なボタンが 120×44 より小さい'); if (tabs && r.bottom > tabs.getBoundingClientRect().top + 1) out.ng.push('主なボタンが最初の画面に入らない'); }
    for (const el of (scope ? scope.querySelectorAll('.alu-nw,.whitespace-nowrap') : [])) { if (!el.offsetParent) continue; const rs = [...el.getClientRects()].filter(q => q.width > 0); if (new Set(rs.map(q => Math.round(q.top / 4))).size > 1) out.ng.push(`折れる: ${(el.textContent || '').trim().slice(0, 16)}`); }
    if (out.sizes.some(x => x < 11)) out.ng.push(`11px 未満の字 ${out.sizes.filter(x => x < 11).join('/')}`);
    return out;
  }, n);
  for (const v of [{ id: 'tate', w: 390, h: 844, land: false }, { id: 'yoko', w: 844, h: 390, land: true }]) {
    const n = notchOf(v.land);
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const jst = new Date(Date.now() + 9 * 3600000); jst.setUTCHours(15, 0, 0, 0);
    await page.clock.setFixedTime(new Date(jst.getTime() - 9 * 3600000));
    page.on('pageerror', e => errs.push(`${v.id}: ${String(e.message || e).slice(0, 160)}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = ['assistant_life_friend']; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false });
    await page.addInitScript(() => { const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeFriend = true; RELEASE_FLAGS.assistantLifeFriendApi = true; clearInterval(t); } } catch {} }, 2); });
    await page.addInitScript((n) => { const set = () => { const r = document.documentElement; r.style.setProperty('--mh-safe-top', `${n.top}px`); r.style.setProperty('--mh-safe-bottom', `${n.bottom}px`); r.style.setProperty('--mh-safe-left', `${n.left}px`); r.style.setProperty('--mh-safe-right', `${n.right}px`); }; if (document.documentElement) set(); document.addEventListener('DOMContentLoaded', set); }, n);
    await page.route(/supabase|functions\/v1/, route([]));
    const pre = AFTER ? 'after' : 'before';
    try {
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page); await waitFaces(page); await finishTalk(page);
      await page.locator('[data-home-assistant-life]').first().click({ timeout: 20000 });
      await page.locator('[data-assistant-life-typed-house]').waitFor({ timeout: 15000 });
      await page.locator('[data-alu-tab="visit"], .alu-tabs button:has-text("フレンド")').first().click({ timeout: 5000 });
      await page.locator('[data-alf-house], [data-assistant-life-typed-visit]').first().waitFor({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1500);
      // 切り欠きを黒い帯で描く(撮った絵で切り欠きの中に入った物が分かるように)
      await page.evaluate((n) => { for (const [k, s] of Object.entries({ top: `left:0;right:0;top:0;height:${n.top}px`, bottom: `left:0;right:0;bottom:0;height:${n.bottom}px`, left: `left:0;top:0;bottom:0;width:${n.left}px`, right: `right:0;top:0;bottom:0;width:${n.right}px` })) { if (!n[k]) continue; const d = document.createElement('div'); d.setAttribute('style', `position:fixed;${s};background:rgba(0,0,0,.82);z-index:2147483646;pointer-events:none`); document.body.appendChild(d); } }, n);
      const m = await measure(page, n);
      await page.screenshot({ path: path.join(OUT, `${pre}-${v.id}.png`) });
      console.log(`${pre}-${v.id}.png 字 ${m.sizes.join('/')}px・戻る 上${m.back ?? '—'}・主なボタン ${m.go || '無い'}・下のタブの下端 ${m.tabsBottom ?? '—'}${m.ng.length ? ` NG: ${[...new Set(m.ng)].slice(0, 6).join(' / ')}` : ''}`);
      if (AFTER && m.ng.length) errs.push(`${v.id}: ${[...new Set(m.ng)].slice(0, 4).join(' / ')}`);
      if (!AFTER && !v.land) {
        await page.evaluate(() => { const els = [...document.querySelectorAll('[data-assistant-life-screen] *')].filter(e => e.scrollHeight > e.clientHeight + 40 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)); const el = els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0]; if (el) el.scrollTop = Math.round(el.clientHeight * 0.9); });
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT, 'before-tate-2.png') });
      }
      if (AFTER && !v.land) {
        // 押したときの動き: 主なボタン(訪ねる)→ 家の窓 / 置き手紙・設定の窓
        for (const [sel, name, want] of [['.alu-go', 'go', '[data-alf-visit], [data-alf-vview]'], ['[data-assistant-life-visit-open="notes"]', 'notes', '.alu-sheet'], ['[data-assistant-life-visit-open="settings"]', 'settings', '.alu-sheet']]) {
          const b = page.locator(`[data-assistant-life-typed-visit] ${sel}`).first();
          if (!(await b.count())) { errs.push(`押す物が無い: ${name}`); continue; }
          await b.click({ timeout: 4000 }); await page.waitForTimeout(700);
          const ok = await page.locator(want).first().isVisible().catch(() => false);
          await page.screenshot({ path: path.join(OUT, `after-${name}.png`) });
          console.log(`押す ${name}: ${ok ? '開いた' : 'NG 開かない'}`); if (!ok) errs.push(`${name} が開かない`);
          await page.keyboard.press('Escape').catch(() => {});
          const x = page.locator('.alu-sheet .alu-x, [data-alf-visit-close], button:has-text("✕")').first(); if (await x.count()) await x.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(400);
        }
      }
    } catch (e) { errs.push(`${v.id}: ${String(e.message || e).split('\n')[0].slice(0, 160)}`); }
    await ctx.close();
  }
  if (!AFTER && fs.existsSync(path.join(OUT, 'mock.html'))) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const p of ['a', 'b', 'c']) {
      await page.goto(`http://localhost:${PORT}/docs/progress/assistant-life/step11-friend/mock.html?plan=${p}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `plan-${p}.png`) });
      const m = await page.evaluate(() => {
        const s = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el.getClientRects().length || el.closest('.notch-top')) continue; s.add(Math.round(parseFloat(getComputedStyle(el).fontSize))); }
        const go = document.querySelector('.alu-go'); const r = go ? go.getBoundingClientRect() : null; const tb = document.querySelector('.alu-tabs'); const t = tb ? tb.getBoundingClientRect() : null;
        return { sizes: [...s].sort((a, b) => a - b), go: r ? { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) } : null, tabsTop: t ? Math.round(t.top) : 844, tabsBottom: t ? Math.round(t.bottom) : null };
      });
      const goOk = m.go && m.go.w >= 120 && m.go.h >= 44 && m.go.bottom <= m.tabsTop;
      console.log(`案${p.toUpperCase()}: 字 ${m.sizes.join('/')}px・主なボタン ${m.go ? `${m.go.w}×${m.go.h} 上${m.go.top}` : '無い'}${goOk ? '' : '(NG)'}・下のタブの下端 ${m.tabsBottom}`);
      if (!goOk) errs.push(`案${p}: 主なボタン`); if (m.sizes.some(x => x < 11)) errs.push(`案${p}: 11px 未満の字`); if (m.tabsBottom > 810) errs.push(`案${p}: 下のタブが切り欠きに入る`);
    }
    await ctx.close();
  }
  await browser.close(); server.close();
  if (errs.length) { console.log(`NG: ${errs.join(' / ')}`); process.exit(1); }
  console.log('OK: 撮れた');
})();
