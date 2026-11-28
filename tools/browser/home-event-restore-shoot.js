#!/usr/bin/env node
// HOME の上のイベント表示を前の形に戻す直し(台帳 r1126-088・追跡表 r1128-013)の止め絵。
//   社長の本番の画面(iPhone 縦・進んだデータ・10:00 の開幕直後)に近い形で撮る:
//   390x844・切り欠きの余白(上47・下34)・歩くマスモン5体・クリスマスのレイドのボス・裏クイックの札(周回中)
//   SHOT_DIR=<置き場> [TIMES=0955,1005] [SCALE=2] [SIZES=tate] node tools/browser/home-event-restore-shoot.js
//   置き場に home-<時刻>-<大きさ>.jpg と、部品の位置(boxes.json)を残す
const http = require('http'), path = require('path'), fs = require('fs');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { setSafeArea } = require(path.resolve(__dirname, 'stable-shot'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8973;
const SHOT_DIR = process.env.SHOT_DIR || path.join(ROOT, 'docs/progress/home-event-restore-r1126-088');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const shiftClock = (iso) => ({ content: `(() => { const off = Date.parse(${JSON.stringify(iso)}) - Date.now(); const RD = Date;
  class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
  D.parse = RD.parse; D.UTC = RD.UTC; window.Date = D; })();` });
const ALL_SIZES = {
  tate: { w: 390, h: 844, sa: { top: 47, bottom: 34, left: 0, right: 0 } },
  se: { w: 375, h: 667, sa: { top: 20, bottom: 0, left: 0, right: 0 } },
  yoko: { w: 844, h: 390, sa: { top: 0, bottom: 21, left: 47, right: 47 } },
};
const ALL_TIMES = { '0955': '2026-11-28T09:55:00+09:00', '1005': '2026-11-28T10:05:00+09:00', '1201': '2026-12-01T12:00:00+09:00' };
// 進んだデータ: マスモン5体を放牧・裏クイックが自動で始まる AUTO 設定
const seed = () => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3); put('mh_quick_clears_Beginner', 3);
  put('mh_auto_settings_v1', { strategy: 'random', allies: [{ rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }],
    breakthroughReserve: { gold: 0, psyche: 0 }, quickRun: { heroRosterEntry: 'Suezo', distance: 2, difficulty: 'Beginner', autoStart: true } });
  put('mh_gold', 1234567);
  const bases = ['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie'];
  put('mh_masu_mons', bases.map((b, i) => ({ id: `m${i + 1}`, baseId: b, name: `検査${i + 1}`, bondXp: 300, createdAt: i + 1 })));
  put('mh_home_pasture_ids', bases.map((_, i) => `m${i + 1}`));
};
(async () => {
  const { chromium } = require('playwright');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const boxesFile = path.join(SHOT_DIR, 'boxes.json');
  const boxes = fs.existsSync(boxesFile) ? JSON.parse(fs.readFileSync(boxesFile, 'utf8')) : {};
  const times = (process.env.TIMES || '0955,1005').split(',');
  const sizes = (process.env.SIZES || 'tate').split(',');
  const prefix = process.env.PREFIX || 'home';
  for (const tk of times) for (const sk of sizes) {
    const sz = ALL_SIZES[sk], iso = ALL_TIMES[tk];
    const ctx = await browser.newContext({ viewport: { width: sz.w, height: sz.h }, hasTouch: true, isMobile: true, deviceScaleFactor: Number(process.env.SCALE || 2) });
    const page = await ctx.newPage();
    await setSafeArea(ctx, page, sz.sa);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    // レイドの共有HPは「まだ削られていない」(空の合計)で返す
    await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(shiftClock(iso));
    await page.addInitScript(seed);
    await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed()); await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    const top = page.getByRole('button', { name: 'トップ画面へ進む' }), home = page.locator('button[aria-label="モンヒロバトル"]');
    const closePopups = () => page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで|はじめる|始める)$/.test((x.innerText || '').trim()) && !x.closest('[data-quick-anywhere-detail]'));
      if (b) { b.click(); return true; }
      const fx = document.querySelector('[data-growth-fx-sheet]'); if (fx) { fx.click(); return true; }
      return false;
    });
    for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) {
      if (await top.isVisible().catch(() => false)) await top.dispatchEvent('pointerdown').catch(() => {});
      await closePopups(); await page.waitForTimeout(500);
    }
    // 裏クイックが始まり、札が置き場所を決めるまで待つ
    for (let i = 0; i < 30 && !(await page.locator('[data-quick-anywhere]').count()); i++) { await closePopups(); await page.waitForTimeout(500); }
    await page.waitForTimeout(4000);
    for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(300);
    await page.waitForTimeout(1500);
    const name = `${prefix}-${tk}-${sk}`;
    // 送る札(追記3)は、撮る前に1枚目へ合わせる(点を押すと20秒は自分で送らない)
    await page.evaluate(() => { const b = document.querySelector('[data-home-band-dots] button'); if (b) b.click(); });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(SHOT_DIR, `${name}.jpg`), type: 'jpeg', quality: 84 });
    // FLICK=1 … 札を指で左へ払った後も撮る(<名前>-flick.jpg)
    if (process.env.FLICK && await page.locator('[data-home-band-dots]').count()) {
      const v = await page.locator('.mh-home-band-view').boundingBox();
      const y = v.y + v.height / 2;
      await page.evaluate(({ x0, x1, y }) => { const el = document.querySelector('.mh-home-band-view');
        const ev = (t, x) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true }));
        ev('pointerdown', x0); ev('pointerup', x1); }, { x0: v.x + v.width * 0.8, x1: v.x + v.width * 0.2, y });
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(SHOT_DIR, `${name}-flick.jpg`), type: 'jpeg', quality: 84 });
    }
    boxes[name] = await page.evaluate(() => {
      const pick = { xmas: '[data-home-xmas-entry-strip]', event: '[data-home-event-strip]', band: '.mh-home-band', view: '.mh-home-band-view', shown: '.mh-home-band-slide[aria-hidden="false"]', boss: '[data-home-raid-jack]', bossImg: '[data-home-raid-boss]', quick: '[data-quick-anywhere]', dock: '.mh-home-dock', face: '.mh-home-assistant', top: '.mh-home-top, .mh-home-status', scene: '.mh-home-scene', bg: '.mh-home-background' };
      const out = {};
      for (const [k, q] of Object.entries(pick)) out[k] = [...document.querySelectorAll(q)].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; });
      out.masu = [...document.querySelectorAll('.mh-home-masumon-layer > *')].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; });
      out.vh = innerHeight; out.quickSpot = (document.querySelector('[data-quick-anywhere]') || { getAttribute: () => null }).getAttribute('data-quick-anywhere-spot');
      return out;
    });
    if (errors.length) console.log('エラー', name, errors.slice(0, 2));
    console.log('撮った', name, JSON.stringify(boxes[name]));
    await ctx.close();
  }
  fs.writeFileSync(boxesFile, JSON.stringify(boxes, null, 1));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
