#!/usr/bin/env node
// クリスマスのイベントページ「レイド」タブ > レイドバトルで、ボスの一覧が広く見えるか(台帳 r1126-097・社長「ボス選択画面幅が小さいからもっと表示をすっきりさせて」)を実際のブラウザで確かめる。
//
//   node tools/battle/xmas-raid-compact-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、画面の大きさごとの止め絵を残す
//
//   iPhone 縦(390×844)では、(Safari の帯を除いた 390×664 も)ボスの札が3枚ぶん以上、一覧の中に見える
//   iPhone の小さい縦(375×667)でも、ボスの札が3枚ぶん以上見える
//   どの大きさでも、看板・期間の帯・タブの段が「物語」「ボーナス」「レイド」で1pxも動かない(r1126-097 追記1)
//   まだ開いていない段階の名前は「？？？」(一覧・報酬一覧・ランキング。r1126-097 追記2)
//   どの大きさでも、挑戦のボタンが画面の中にあり、横にはみ出さない。実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8963;
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const shiftClock = (iso) => ({ content: `(() => { const off = Date.parse(${JSON.stringify(iso)}) - Date.now(); const RD = Date;
  class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
  D.parse = RD.parse; D.UTC = RD.UTC; window.Date = D; })();` });
const SIZES = [
  { id: 'iphone-390x844', w: 390, h: 844, minCards: 3 },
  { id: 'iphone-safari-390x664', w: 390, h: 664, minCards: 3 },   // 本番の iPhone の Safari(上下の帯を除いた見える高さ)
  { id: 'iphone-375x667', w: 375, h: 667, minCards: 3 },
  { id: 'tablet-820x1180', w: 820, h: 1180, minCards: 3 },
  { id: 'landscape-844x390', w: 844, h: 390, minCards: 0 },
];
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const c of SIZES) {
      const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, hasTouch: true, isMobile: true, deviceScaleFactor: SHOT_DIR ? 2 : 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(shiftClock('2026-11-28T15:00:00+09:00'));
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
        put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_event_points_v1', 817688);
      });
      await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed()); await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
      for (let i = 0; i < 8; i++) {
        const btn = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK/ }).first();
        if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
        await btn.dispatchEvent('click').catch(() => {});
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(800);
      await page.locator('[data-home-xmas-entry]').first().click({ timeout: 10000 });
      await page.waitForTimeout(1200);
      // 看板・期間の帯・タブの段は、どのタブでも同じ位置(台帳 r1126-097 追記1・社長「タブごとに位置が変わるのやだ」)
      const headPos = async () => page.evaluate(() => ['[data-xmas-event-poster]', '[data-xmas-event-period]', '[data-xmas-event-head] [role="tablist"], [data-xmas-event-head] [role="tab"]'].map((q) => {
        const el = document.querySelector(q); if (!el) return 'なし';
        const r = el.getBoundingClientRect(); return r.height ? `${Math.round(r.left * 2) / 2},${Math.round(r.top * 2) / 2},${Math.round(r.width * 2) / 2}x${Math.round(r.height * 2) / 2}` : '出さない';
      }).join(' / '));
      const pos = {};
      for (const [id, name] of [['story', '物語'], ['bonus', 'ボーナス'], ['raid', 'レイド']]) {
        await page.getByRole('tab', { name }).first().click({ timeout: 5000 });
        await page.waitForTimeout(900);
        const guide = page.locator('[data-raid-jack-guide-close]');
        if (await guide.count()) { await guide.first().click().catch(() => {}); await page.waitForTimeout(400); }
        pos[id] = await headPos();
        if (SHOT_DIR && id !== 'raid') { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `${id}-${c.id}.jpg`), type: 'jpeg', quality: 80 }); }
      }
      check(`${c.id}: 看板・期間の帯・タブの位置が3つのタブで同じ`, pos.story === pos.bonus && pos.bonus === pos.raid, JSON.stringify(pos));
            await page.locator('[data-raid-jack-tier]').first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(600);
      if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `raid-${c.id}.jpg`), type: 'jpeg', quality: 80 }); }
      const st = await page.evaluate(() => {
        const vh = window.innerHeight, vw = window.innerWidth;
        const cards = [...document.querySelectorAll('[data-raid-jack-tier]')];
        const list = cards[0] && cards[0].parentElement;
        const lr = list ? list.getBoundingClientRect() : null;
        const top = lr ? Math.max(0, lr.top) : 0, bottom = lr ? Math.min(vh, lr.bottom) : 0;
        let seen = 0;
        for (const el of cards) { const r = el.getBoundingClientRect(); const vis = Math.max(0, Math.min(bottom, r.bottom) - Math.max(top, r.top)); seen += vis / Math.max(1, r.height); }
        const foot = document.querySelector('[data-raid-jack-footer]');
        const fr = foot ? foot.getBoundingClientRect() : null;
        const buy = document.querySelector('[data-raid-jack-buy]');
        return { seen: Math.round(seen * 10) / 10, cardH: cards[0] ? Math.round(cards[0].getBoundingClientRect().height) : 0,
          footIn: !!fr && fr.bottom <= vh + 1 && fr.top >= 0, wide: document.documentElement.scrollWidth <= vw + 1,
          buyText: buy ? buy.innerText.replace(/\s+/g, ' ') : '' };
      });
      // まだ開いていない段階の名前は伏せる(r1126-097 追記2)。番号は残す。画面・報酬一覧・ランキングのどこにも出ない
      const HIDDEN = ['黒いサンタ・戒', '黒いサンタ・罰', '黒いサンタ・断罪', '黒いサンタ・煉獄'];
      const leak = (txt) => HIDDEN.filter((n) => txt.includes(n));
      const scr = await page.evaluate(() => document.body.innerText);
      check(`${c.id}: 未解放の段階の名前が一覧に出ない(「2. ？？？」)`, leak(scr).length === 0 && /2\.\s*？？？/.test(scr) && /1\.\s*黒いサンタ・咎/.test(scr), leak(scr).join(','));
      if (c.id === 'iphone-safari-390x664') {
        await page.locator('[data-raid-jack-reward-list-open-top]').click();
        await page.waitForTimeout(500);
        let txt = await page.evaluate(() => (document.querySelector('[data-raid-jack-reward-list]') || {}).innerText || '');
        if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `rewards-${c.id}.jpg`), type: 'jpeg', quality: 80 });
        check(`${c.id}: 報酬一覧に未解放の名前が出ない`, txt.includes('？？？') && leak(txt).length === 0, leak(txt).join(','));
        await page.locator('[data-raid-jack-reward-close]').click();
        await page.locator('[data-raid-jack-ranking-open]').click();
        await page.waitForTimeout(500);
        txt = await page.evaluate(() => (document.querySelector('[data-raid-jack-ranking-list]') || {}).innerText || '');
        await page.locator('[data-raid-jack-ranking-kind="max"]').click();
        await page.waitForTimeout(300);
        txt += await page.evaluate(() => (document.querySelector('[data-raid-jack-ranking-list]') || {}).innerText || '');
        if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `ranking-${c.id}.jpg`), type: 'jpeg', quality: 80 });
        check(`${c.id}: ランキングに未解放の名前が出ない`, txt.includes('？？？') && leak(txt).length === 0, leak(txt).join(','));
        await page.locator('[data-raid-jack-ranking-close]').click();
      }
      if (c.minCards) check(`${c.id}: ボスの札が${c.minCards}枚ぶん以上見える`, st.seen >= c.minCards, `${st.seen}枚ぶん(1枚 ${st.cardH}px)`);
      if (c.minCards) check(`${c.id}: 挑戦のボタンが画面の中にある`, st.footIn);
      check(`${c.id}: 横にはみ出さない`, st.wide);
      check(`${c.id}: 所持のビートPは3桁区切り`, /817,688/.test(st.buyText), st.buyText);
      check(`${c.id}: 実行時エラーが無い`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `NG ${failed} 件` : 'クリスマスのレイドの一覧の見え方の検査はすべて通りました');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
