#!/usr/bin/env node
// 助手ライフの見た目の点検用に、画面を一通り撮る(2026-11-20 ミハリ・助手ライフの総点検)。ゲーム本体は変えない・読むだけ。
//   node tools/browser/visual-life-shoot.js --out <置き場> [--sizes tate,pc] [--only <場面の名前の一部を , で>] [--2x]
// 偽のデータでページの中だけ(Supabase は偽物・フレンド2人の控えの家つき)。本番のサーバーへは何も送らない。デバッグの合言葉は使わない。
// 結果: <置き場>/<大きさ>-<場面>.png と <置き場>/shots.json(撮れた・撮れなかった、ページのエラー)
// 時刻は 15:00(午後)に固定。夜の場面だけ 23:00 で撮り直す(寝ている助手の部屋)。
// 次に API へ送るときは、この止め絵を tools/browser/visual-api-monsuc.js と同じ形(6場面×大きさで1本)で送る。
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const OUT = path.resolve(opt('--out', 'life-shots'));
const SIZES = { tate: { w: 390, h: 844 }, pc: { w: 1280, h: 800 }, yoko: { w: 844, h: 390 } };
const sizes = opt('--sizes', 'tate,pc').split(',').filter(s => SIZES[s]);
const only = (opt('--only', '') || '').split(',').filter(Boolean);
const PORT = 9283;
fs.mkdirSync(OUT, { recursive: true });

// 偽の Supabase(フレンド2人・控えの家2軒・自分あての置き手紙1通)。assistant-life-friend-browser-check.js を縮めて写した
const fresh = new Date(Date.now() - 3 * 3600000).toISOString();
const dayKey = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
const HOUSES = [
  { breeder_id: 'aoi-0001', open: true, updated_at: fresh, house: { v: 1, ids: ['mua', 'kiki', 'dra', 'momosuke', 'atsu', 'kyuko', 'sorashido', 'erubin'], r: { mua: { at: 'home', d: 'snack', m: 'happy', fu: { c: 'lantern', w: 'starpic', f: 'sofa' } }, kiki: { p: 'cardroom', at: 'out', d: 'walk', m: 'happy' }, dra: { fu: { f: 'bear', w: 'trophy' }, at: 'home', d: 'idle', m: 'happy' }, momosuke: { at: 'home', d: 'practice', m: 'happy' }, atsu: { at: 'home', d: 'idle', m: 'happy' }, kyuko: { at: 'home', d: 'read', m: 'happy' }, sorashido: { at: 'home', d: 'cards', m: 'happy' }, erubin: { at: 'home', d: 'idle', m: 'happy' } } } },
  { breeder_id: 'yuto-0001', open: true, updated_at: fresh, house: { v: 1, ids: ['momosuke', 'kyuko'], r: { momosuke: { at: 'home', d: 'snack', m: 'happy' }, kyuko: { at: 'home', d: 'idle', m: 'happy' } } } },
];
const route = async (r) => {
  const url = r.request().url(), method = r.request().method();
  const json = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: typeof body === 'string' ? body : JSON.stringify(body) });
  if (method !== 'GET' && !/rpc\//.test(url)) return json('', 201); // 書き込みはどれも受けたふりだけ
  if (/assistant_life_friend_switch/.test(url)) return json([{ mode: 'on' }]);
  if (/assistant_life_friend_house_more/.test(url)) return json([]);
  if (/assistant_life_friend_houses/.test(url)) return json(HOUSES);
  if (/assistant_life_friend_visits/.test(url)) {
    const self = (url.match(/host_id\.eq\.([^,)]+)/) || [])[1] || 'x';
    return json([{ id: 11, kind: 'player', visitor_id: 'aoi-0001', host_id: self, day: dayKey, assistants: ['dra'], word: 1, thanks: null, note: 'ソファふかふかでよかった！', note_to: null, created_at: new Date(Date.now() - 40 * 60000).toISOString() }]);
  }
  if (/friend_links/.test(url)) {
    const self = (url.match(/requester_id\.eq\.([^,)&]+)/) || url.match(/eq\.([0-9a-f-]{20,})/) || [])[1] || 'x';
    return json([{ requester_id: self, target_id: 'aoi-0001', status: 'accepted', blocked_by: null, created_at: fresh, updated_at: fresh }, { requester_id: 'yuto-0001', target_id: self, status: 'accepted', blocked_by: null, created_at: fresh, updated_at: fresh }]);
  }
  if (/friend_profiles|breeder_profiles/.test(url)) return json([{ breeder_id: 'aoi-0001', user_name: 'あおい', last_seen_at: fresh }, { breeder_id: 'yuto-0001', user_name: 'ゆうと', last_seen_at: fresh }]);
  if (/functions\/v1\/assistant-chat/.test(url)) return json({ ok: false, kind: 'tired' });
  return json([]);
};


// ---- 画面の部品を数字で測る(2026-11-20 窓口「社長が気付くことに気付けないなら意味がない」)。上に見えている物だけ ----
//   主ボタン(いちばん大事に見えるボタン)の大きさ・下の空きと途中の空き・字の大きさ・同じ数字/文の繰り返し
const MEASURE_RULE = { mainH: 44, mainW: 120, mainFont: 13, bottomGap: 0.2, midGap: 0.18, minFont: 10, fontSteps: 6, repeat: 2 };
const measurePage = (rule) => {
  const W = innerWidth, H = innerHeight;
  const onTop = (el, r) => { const x = Math.min(W - 1, Math.max(0, (r.left + r.right) / 2)), y = Math.min(H - 1, Math.max(0, (r.top + r.bottom) / 2)); const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t) || t.contains(el)); };
  const inView = (r) => r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
  const texts = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const raw = n.nodeValue.replace(/\s+/g, ' ').trim(); if (!raw) continue;
    const p = n.parentElement; if (!p || p.closest('script,style,[aria-hidden="true"]')) continue;
    const cs = getComputedStyle(p); if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect();
    if (!inView(r) || !onTop(p, r)) continue;
    texts.push({ s: raw, px: parseFloat(cs.fontSize) || 0, r, el: p });
  }
  const sat = (c) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c || ''); if (!m || (m[4] !== undefined && Number(m[4]) < 0.3)) return 0; const v = [m[1], m[2], m[3]].map(Number), mx = Math.max(...v), mn = Math.min(...v); return mx ? (mx - mn) / mx : 0; };
  const btns = [];
  for (const b of document.querySelectorAll('button,[role=button],a[href]')) {
    const r = b.getBoundingClientRect(); if (!inView(r) || !onTop(b, r) || b.disabled) continue;
    const cs = getComputedStyle(b); const grad = /gradient/.test(cs.backgroundImage);
    const color = Math.max(sat(cs.backgroundColor), grad ? 0.6 : 0);
    const label = (b.innerText || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!label) continue;
    btns.push({ label, w: Math.round(r.width), h: Math.round(r.height), font: parseFloat(cs.fontSize) || 0, score: r.width * r.height * (1 + 3 * color) * (/閉じる|戻る|←|✕|キャンセル/.test(label) ? 0.2 : 1), r });
  }
  btns.sort((a, b) => b.score - a.score);
  const main = btns[0] || null;
  // 空き: 字・ボタン・絵(img/svg/canvas・背景の絵)の縦の帯を重ね、帯の無い所を測る
  const bands = [...texts.map(t => t.r), ...btns.map(b => b.r)];
  for (const e of document.querySelectorAll('img,svg,canvas,[style*="background-image"]')) { const r = e.getBoundingClientRect(); if (inView(r) && r.width * r.height > 1600 && r.width * r.height < W * H * 0.85 && onTop(e, r)) bands.push(r); }
  const ys = bands.map(r => [Math.max(0, r.top), Math.min(H, r.bottom)]).sort((a, b) => a[0] - b[0]);
  let end = 0, midGap = 0, midAt = 0;
  for (const [a, b] of ys) { if (a - end > midGap && end > 0) { midGap = a - end; midAt = end; } end = Math.max(end, b); }
  const bottomGap = Math.max(0, H - end);
  // 字
  const chars = (t) => [...t.s.replace(/\s/g, '')].length;
  const tiny = texts.filter(t => t.px < rule.minFont), sizes = [...new Set(texts.map(t => Math.round(t.px * 2) / 2))].sort((a, b) => a - b);
  // 繰り返し: 同じ文(6字以上)と、同じ数字の入った言葉(「あと22」「×1.5」「16:00」など)
  const cnt = {};
  for (const t of texts) {
    if ([...t.s].length >= 6) cnt[t.s] = (cnt[t.s] || 0) + 1;
    for (const m of t.s.match(/(?:あと|×|x)?\s?\d+(?:[.:,]\d+)*\s?(?:回|個|件|人|体|日|時|P|pt|ポイント|倍|%)?/g) || []) { const k = m.replace(/\s/g, ''); if (/^\d$/.test(k)) continue; cnt[`#${k}`] = (cnt[`#${k}`] || 0) + 1; }
  }
  const rep = Object.entries(cnt).filter(([, n]) => n >= rule.repeat).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k.replace(/^#/, '数字「') + (k.startsWith('#') ? '」' : '')}×${n}`);
  const ng = [];
  if (main && (main.h < rule.mainH || main.w < rule.mainW)) ng.push(`いちばん大事に見えるボタン「${main.label}」が ${main.w}×${main.h}px(基準 ${rule.mainW}×${rule.mainH} 以上)`);
  if (main && main.font < rule.mainFont) ng.push(`いちばん大事に見えるボタン「${main.label}」の字が ${main.font}px(基準 ${rule.mainFont}px 以上)`);
  if (bottomGap > H * rule.bottomGap) ng.push(`下の空きが ${Math.round(bottomGap)}px(画面の ${Math.round(bottomGap / H * 100)}%・基準 ${rule.bottomGap * 100}% 以下)`);
  if (midGap > H * rule.midGap) ng.push(`途中の空きが ${Math.round(midGap)}px(${Math.round(midAt)}px の下・基準 画面の ${rule.midGap * 100}% 以下)`);
  if (tiny.length) ng.push(`${rule.minFont}px 未満の字が ${tiny.reduce((a, t) => a + chars(t), 0)}字(いちばん小さい ${Math.min(...tiny.map(t => t.px))}px。例「${tiny.slice(0, 2).map(t => t.s.slice(0, 10)).join('」「')}」)`);
  if (sizes.length > rule.fontSteps) ng.push(`字の大きさが ${sizes.length}段(${sizes.join('・')}px・基準 ${rule.fontSteps}段まで)`);
  if (rep.length) ng.push(`同じ数字・文が何度も出る: ${rep.join(' / ')}`);
  return { main: main ? { label: main.label, w: main.w, h: main.h, font: main.font } : null, bottomGap: Math.round(bottomGap), midGap: Math.round(midGap), minFont: texts.length ? Math.min(...texts.map(t => t.px)) : 0, tinyChars: tiny.reduce((a, t) => a + chars(t), 0), fontSteps: sizes.length, repeats: rep, ng };
};

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が無い'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(root, 'tools/boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(root, 'tools/assistant/life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const log = { shots: [], miss: [], errors: [], rule: MEASURE_RULE, metrics: {} };
  const MIX = { groups: [{ ids: ['mua', 'kiki'], doing: 'snack', place: 'cafe' }, { ids: ['dra', 'sorashido', 'erubin'], doing: 'cards', place: 'cardroom' }],
    solo: { momosuke: { doing: 'battle', place: 'battle' }, atsu: { doing: 'idle', place: 'home' }, kyuko: { doing: 'read', place: 'library' } } };

  const run = async (sizeId, { first = false, hour = 15, tag = '' } = {}) => {
    const v = SIZES[sizeId];
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: argv.includes('--2x') ? 2 : 1 });
    const page = await ctx.newPage();
    const jst = new Date(Date.now() + 9 * 3600000); jst.setUTCHours(hour, 0, 0, 0);
    await page.clock.setFixedTime(new Date(jst.getTime() - 9 * 3600000));
    page.on('pageerror', e => log.errors.push(`${sizeId}${tag}: ${String(e.message || e).slice(0, 160)}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = ['assistant_life_friend']; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); window.__mhKeepRoomFold = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: first, bondAll: null });
    await page.addInitScript(() => { const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeFriend = true; RELEASE_FLAGS.assistantLifeFriendApi = true; clearInterval(t); } } catch {} }, 2); });
    if (first) await page.addInitScript(() => { if (localStorage.getItem('mh_walk_first') !== null) return; localStorage.setItem('mh_walk_first', '1'); localStorage.setItem('mh_assistant_peer_bond_v1', '{}'); localStorage.removeItem('mh_assistant_life_play_v1'); });
    await page.route(/supabase|functions\/v1/, route);
    const want = (name) => !only.length || only.some(o => name.includes(o));
    const shot = async (name, settle = 600) => {
      if (!want(name)) return;
      await page.waitForTimeout(settle);
      const file = `${sizeId}${tag}-${name}.png`;
      await page.screenshot({ path: path.join(OUT, file) });
      log.shots.push(file);
      try { (log.metrics = log.metrics || {})[file] = await page.evaluate(measurePage, MEASURE_RULE); } catch (e) { (log.metrics = log.metrics || {})[file] = { error: String(e.message || e).slice(0, 80) }; }
    };
    const click = (s, o = {}) => page.locator(s).first().click({ timeout: 4000, ...o });
    const clickText = (re, scope = 'body') => page.locator(`${scope} button:visible, ${scope} [role=button]:visible`).filter({ hasText: re }).first().click({ timeout: 4000 });
    const guard = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('30秒で打ち切り')), 30000))]);
    const step = async (name, go, after) => {
      try { await guard((async () => { await go(); await shot(name); })()); } catch (e) { log.miss.push(`${sizeId}${tag}-${name}: ${String(e.message || e).split('\n')[0].slice(0, 120)}`); }
      try { if (after) await guard(after()); } catch {}
      await page.waitForTimeout(300);
    };
    const esc = async (n = 3) => { for (let i = 0; i < n; i++) { await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(150); } };
    const closeSheets = async () => { for (let i = 0; i < 4; i++) { const b = page.locator('[data-mhl-sheet-close]:visible, [data-assistant-peer-album-close]:visible, [data-assistant-masmon-close]:visible, [data-assistant-masmon-detail-close]:visible, [data-assistant-life-profile-close]:visible, [data-assistant-life-call-picker] button:visible:has-text("閉じる"), button:visible:text-is("閉じる")').last(); if (!(await b.count())) break; await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(300); } };
    const closeRoom = async () => { for (let i = 0; i < 3 && await page.locator('[data-assistant-life-roomview-close]:visible').count(); i++) { await click('[data-assistant-life-roomview-close]:visible').catch(() => {}); await page.waitForTimeout(350); } };
    const backHouse = async () => { for (let i = 0; i < 3; i++) { await finishTalk(page); const b = page.locator('button:visible').filter({ hasText: /家へ戻る|← 家へ|← 戻る/ }).last(); if (!(await b.count())) break; await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400); } };
    const back = async () => { for (let i = 0; i < 3; i++) { const b = page.locator('button:visible:not([data-assistant-life-close])').filter({ hasText: /^\s*(←\s*)?戻る\s*$/ }).first(); if (!(await b.count())) break; await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(350); } };
    const reset = async () => {
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page); await waitFaces(page); await finishTalk(page);
      await page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, moods: { atsu: 'lonely' }, watched: [] } }); }, MIX);
      await page.waitForTimeout(600); await finishTalk(page);
      await click('[data-home-assistant-life]', { timeout: 20000 });
      await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(500);
    };
    const group = async (fn) => { try { await guard(reset()); } catch (e) { log.miss.push(`${sizeId}${tag} 開き直し: ${String(e.message || e).slice(0, 80)}`); return; } await fn(); };
    const tab = async (k) => { await esc(1); await back(); await closeSheets(); await closeRoom(); if (!(await page.locator(`[data-assistant-life-icon="${k}"]:visible`).count())) await backHouse(); await click(`[data-assistant-life-icon="${k}"]:visible`); await page.waitForTimeout(500); };
    const scrollIn = async (sel, frac = 1) => page.evaluate(([s, f]) => { const els = [...document.querySelectorAll(s)].filter(e => e.offsetParent && e.scrollHeight > e.clientHeight + 4); const e = els[els.length - 1]; if (e) e.scrollTop = (e.scrollHeight - e.clientHeight) * f; return !!e; }, [sel, frac]);
    const scrollAny = async (frac = 1) => page.evaluate((f) => { const els = [...document.querySelectorAll('[data-assistant-life-screen] *')].filter(e => e.offsetParent && e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)); els.sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth); const e = els[0]; if (e) e.scrollTop = (e.scrollHeight - e.clientHeight) * f; return els.length; }, frac);
    const scrollTopmost = async (frac = 1) => page.evaluate((f) => { const els = [...document.querySelectorAll('body *')].filter(e => e.offsetParent && e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)); const e = els[els.length - 1]; if (e) e.scrollTop = (e.scrollHeight - e.clientHeight) * f; return !!e; }, frac);
    try {
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page); await waitFaces(page); await finishTalk(page);
      if (!first) { await page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, moods: { atsu: 'lonely' }, watched: [] } }); }, MIX); await page.waitForTimeout(800); await finishTalk(page); }
      await shot('00-home');
      if (await page.locator('button:visible').filter({ hasText: /「助手ライフ」を開く/ }).count()) await page.locator('button:visible').filter({ hasText: /「助手ライフ」を開く/ }).first().click({ timeout: 4000 });
      else await click('[data-home-assistant-life]', { timeout: 20000 });
      await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
      await shot('01-house-open', 900);
      if (first) {
        // 初めての人: 案内を閉じたあとの家・町・きずなまで
        for (let i = 0; i < 4; i++) { const b = page.locator('[data-assistant-life-item-intro-close]:visible, [data-assistant-life-screen] button:visible:text-matches("^(わかった！?|分かった！?|OK|はじめる|とじる)$")').first(); if (!(await b.count())) break; await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400); }
        await shot('02-house-after-guide');
        await step('03-town', () => tab('where'));
        await step('04-kizuna', () => tab('friends'));
        await step('05-friend-tab', () => tab('visit'));
        await ctx.close(); return;
      }
      if (hour >= 21) {
        await step('night-house', async () => {});
        await step('night-room-sleep', () => click('[data-assistant-life-room="dra"]'), closeRoom);
        await step('night-room-awake', () => click('[data-assistant-life-room="momosuke"]'), closeRoom);
        await step('night-town', () => tab('where'));
        await ctx.close(); return;
      }
      await step('02-house-scroll-mid', () => scrollAny(0.5), () => scrollAny(0));
      await step('03-house-scroll-end', () => scrollAny(1), () => scrollAny(0));
      await step('05-tier-help', () => click('[data-assistant-life-tier-help]'), esc);
      await step('06-diary', () => click('[data-assistant-life-board]'), closeSheets);
      await step('07-watch', () => click('[data-assistant-life-today-act="watch"]'));
      await group(async () => {
        await step('08-call', () => click('[data-assistant-life-today-act="call"]'));
      });
      await group(async () => {
        await step('09-give', () => click('[data-assistant-life-today-act="give"]'));
        await step('10-give-items', () => click('[data-assistant-life-gift-items-toggle]'));
      });
      const room = (id) => click(`[data-assistant-life-room="${id}"]`);
      const roomBtn = (re) => page.locator('button:visible').filter({ hasText: re }).last().click({ timeout: 4000 });
      await group(async () => {
        await step('11-room-alone', () => room('atsu'));
        await step('12-room-alone-scroll', () => scrollIn('[data-assistant-life-roomview-scroll]', 1).then(ok => { if (!ok) return scrollTopmost(1); }));
      });
      await group(async () => { await room('atsu'); await step('14-room-solo-gift', () => roomBtn(/あつに贈る/)); });
      await group(async () => { await room('atsu'); await step('14b-room-masmon-battle', () => roomBtn(/マスモンで対戦/)); });
      await group(async () => { await room('atsu'); await step('15-room-furn', () => roomBtn(/部屋の家具/)); });
      await group(async () => { await room('atsu'); await step('16-room-plan', () => roomBtn(/次の行き先を決める/)); });
      await group(async () => {
        await room('atsu');
        await step('17-room-masmon', () => roomBtn(/あつのマスモン/));
        const tabs = await page.locator('[data-assistant-masmon-tab-btn]:visible').evaluateAll(es => es.map(e => e.getAttribute('data-assistant-masmon-tab-btn'))).catch(() => []);
        for (const k of tabs) await step(`18-masmon-tab-${k}`, () => click(`[data-assistant-masmon-tab-btn="${k}"]:visible`));
        await step('20-masmon-detail', () => click('[data-assistant-masmon-row]:visible'));
      });
      await group(async () => { await step('17b-house-note', () => page.locator('button:visible').filter({ hasText: /育成ノート/ }).first().click({ timeout: 4000 })); await step('17c-house-note-scroll', () => scrollTopmost(1)); });
      await group(async () => { await step('21-room-away', () => room('dra')); });
      await group(async () => { await step('22-room-pair', () => room('mua')); });
      for (const pl of ['cardroom', 'battle', 'cafe', 'library', 'clinic', 'temple', 'market', 'ranch', 'studio', 'plaza']) {
        await group(async () => { await tab('where'); await step(`30-town-${pl}`, () => click(`[data-assistant-life-map-place="${pl}"]`)); if (pl === 'battle') { await step('33-place-battle-scroll', () => scrollTopmost(1)); await step('34-watch-train', () => page.locator('button:visible').filter({ hasText: /修行を見る/ }).first().click({ timeout: 4000 })); } });
      }
      await group(async () => { await step('30-town', () => tab('where')); await step('39-plan', () => page.locator('button:visible').filter({ hasText: /予定表/ }).first().click({ timeout: 4000 })); });
      await group(async () => {
        await step('40-kizuna', () => tab('friends'));
        await step('41-kizuna-mid', () => scrollAny(0.5));
        await step('42-kizuna-end', () => scrollAny(1));
      });
      await group(async () => { await tab('friends'); await step('43-album', async () => { await scrollAny(0.3); await page.locator('[data-assistant-life-screen] button:visible').filter({ hasText: /Lv5|名コンビ|みゅあ・きき|ドラ・みゅあ/ }).first().click({ timeout: 4000 }); }); });
      await group(async () => {
        await step('50-profile-list', () => tab('profile'));
        await step('51-profile-detail', () => page.locator('[data-assistant-life-screen] button:visible').filter({ hasText: /みゅあ/ }).first().click({ timeout: 4000 }));
        await step('52-profile-detail-scroll', () => scrollTopmost(1));
      });
      await group(async () => {
        await step('60-friend-tab', () => tab('visit'));
        await step('61-friend-tab-scroll', () => scrollAny(1));
        await step('62-friend-house', async () => { await scrollAny(0); await page.locator('[data-alf-house]:visible').first().click({ timeout: 4000 }); });
        await step('63-friend-house-room', () => page.locator('[data-alf-visit-room]:visible').first().click({ timeout: 4000 }));
        await step('64-friend-vtabs', async () => { const t = page.locator('[data-alf-vtab]:visible'); if (await t.count() > 1) await t.nth(1).click({ timeout: 3000 }); });
      });
      await group(async () => { await room('atsu'); await step('13-room-chat', () => roomBtn(/おしゃべりする/)); });
    } catch (e) { log.miss.push(`${sizeId}${tag}: 開けなかった ${String(e.message || e).split('\n')[0].slice(0, 120)}`); }
    await ctx.close();
  };
  for (const s of sizes) {
    await run(s, {});
    await run(s, { first: true, tag: '-first' });
    await run(s, { hour: 23, tag: '-night' });
  }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(log, null, 1));
  console.log(`撮った ${log.shots.length}枚 / 撮れなかった ${log.miss.length} / ページのエラー ${log.errors.length}`);
  for (const m of log.miss.slice(0, 40)) console.log('  撮れず: ' + m);
  for (const e of [...new Set(log.errors)].slice(0, 8)) console.log('  エラー: ' + e);
})().catch(e => { console.error(e); process.exit(1); });
