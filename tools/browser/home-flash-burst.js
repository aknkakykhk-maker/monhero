#!/usr/bin/env node
// HOME を開いた瞬間に一瞬ちがう形が出る(台帳 r1126-103・追跡表 r1128-043)を、描くたびの記録と連写で突き止める道具。
// (撮影の準備は home-event-restore-shoot.js と同じ: 進んだデータ・iPhone 縦・切り欠きの余白)
//   社長の本番の画面(iPhone 縦・進んだデータ・10:00 の開幕直後)に近い形で撮る:
//   390x844・切り欠きの余白(上47・下34)・歩くマスモン5体・クリスマスのレイドのボス・裏クイックの札(周回中)
//   SHOT_DIR=<置き場> [TIMES=0955,1005] [SCALE=2] [SIZES=tate] node tools/browser/home-event-restore-shoot.js
//   置き場に home-<時刻>-<大きさ>.jpg と、部品の位置(boxes.json)を残す
const http = require('http'), path = require('path'), fs = require('fs');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { setSafeArea } = require(path.resolve(__dirname, 'stable-shot'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8974;
const SHOT_DIR = process.env.SHOT_DIR || path.join(ROOT, 'docs/progress/home-flash-r1126-103');
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
// 描くたびに HOME のようすを記録する(ページの中で動かす)
const recorder = () => {
  window.__homeLog = [];
  const t0 = performance.now();
  let last = '';
  const snap = () => {
    const sc = document.querySelector('.mh-home-scene');
    const img = document.querySelector('.mh-home-background img.mh-home-main');
    const bg = document.querySelector('.mh-home-background');
    const st = {
      home: sc ? (sc.classList.contains('mh-home-v2') ? 'V2' : 'V1') : '-',
      bg: img ? (img.getAttribute('src') || '').replace(/^.*\//, '').slice(0, 40) : '-',
      bgReady: bg ? bg.classList.contains('is-ready') : null,
      band: !!document.querySelector('.mh-home-band'), side: !!document.querySelector('.mh-home-side-stack'),
      xmas: !!document.querySelector('[data-home-xmas-entry]'), boss: !!document.querySelector('[data-home-raid-jack]'),
      say: !!document.querySelector('.mh-home-assistant'), fold: !!document.querySelector('.mh-home-assistant-fold'),
      theme: document.documentElement.getAttribute('data-mh-theme') || '', v2css: !!document.getElementById('mh-home-v2-css'),
      styles: [...document.querySelectorAll('head style[id]')].map((e) => e.id).filter((id) => /home|xmas|assistant|life|growth|tod/i.test(id)).join(','),
      screen: (document.querySelector('[data-mh-screen]') || { getAttribute: () => '' }).getAttribute('data-mh-screen'),
    };
    const key = JSON.stringify(st);
    if (key !== last) { window.__homeLog.push({ t: Math.round(performance.now() - t0), ...st }); last = key; }
    requestAnimationFrame(snap);
  };
  requestAnimationFrame(snap);
};
(async () => {
  const { chromium } = require('playwright');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const prefix = process.env.PREFIX || 'flash';
  const sz = ALL_SIZES.tate, iso = ALL_TIMES[process.env.TIME || '1201'];
  const ctx = await browser.newContext({ viewport: { width: sz.w, height: sz.h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await setSafeArea(ctx, page, sz.sa);
  page.on('pageerror', (e) => console.log('エラー', String(e).slice(0, 120)));
  await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await page.addInitScript(shiftClock(iso));
  await page.addInitScript(seed);
  // 前に HOME を見たことがある人(助手の吹き出しは既定のまま・ホームの絵はクリスマスを選んである)
  if (process.env.ART) await page.addInitScript((a) => { localStorage.setItem('mh_home_art', JSON.stringify(a)); }, process.env.ART);
  await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed()); await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
  await page.addInitScript(recorder);
  // 連写: CDP の画面の流し(描くたびに1枚・時刻つき)
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  let recording = false;
  cdp.on('Page.screencastFrame', async (f) => { if (recording) frames.push({ t: f.metadata.timestamp, data: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (_) {} });
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
  const top = page.getByRole('button', { name: 'トップ画面へ進む' }), home = page.locator('button[aria-label="モンヒロバトル"]');
  await top.waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);
  const burst = async (tag, act, ms = 4000) => {
    frames.length = 0; recording = true;
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, everyNthFrame: 1 });
    await page.evaluate(() => { window.__homeLogMark = window.__homeLog.length; window.__homeLogT = performance.now(); });
    await act();
    await page.waitForTimeout(ms);
    recording = false; await cdp.send('Page.stopScreencast');
    const log = await page.evaluate(() => window.__homeLog.slice(Math.max(0, window.__homeLogMark - 1)));
    const dir = path.join(SHOT_DIR, `${prefix}-${tag}`); fs.mkdirSync(dir, { recursive: true });
    const t0 = frames.length ? frames[0].t : 0;
    // 50〜100ms ごとに1枚ずつ残す
    let lastT = -1;
    for (const f of frames) { const ms2 = Math.round((f.t - t0) * 1000); if (ms2 - lastT < 60) continue; lastT = ms2; fs.writeFileSync(path.join(dir, `${String(ms2).padStart(5, '0')}.jpg`), Buffer.from(f.data, 'base64')); }
    fs.writeFileSync(path.join(dir, 'log.json'), JSON.stringify(log, null, 1));
    console.log(`== ${tag}: 連写 ${frames.length} 枚`); for (const l of log) console.log(JSON.stringify(l));
  };
  await burst('title-to-home', async () => { await top.dispatchEvent('pointerdown').catch(() => {}); await top.click({ timeout: 3000 }).catch(() => {}); });
  for (let i = 0; i < 8; i++) { const b = page.getByRole('button', { name: /^(確認|受け取る|閉じる|OK|あとで)$/ }).first(); if (!(await b.isVisible().catch(() => false))) break; await b.click().catch(() => {}); await page.waitForTimeout(300); }
  await page.waitForTimeout(2000);
  // 別の画面(マーケット)へ行って戻る
  await page.locator('button[aria-label="マーケット"]').first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await burst('back-to-home', async () => { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /HOME|ホーム|戻る|閉じる/.test((x.getAttribute('aria-label') || '') + (x.innerText || ''))); if (b) b.click(); }); });
  // 見た目の決まり(<head> へあとから入れる <style>)が入る前の1コマが、どう見えるかを撮る(決まりを外して撮り、戻す)
  const ids = ['mh-home-v2-css', 'mh-xmas-home-entry-css', 'mh-home-raid-jack-css', 'mh-home-event-badge-css'];
  await page.evaluate((list) => { window.__keptCss = list.map((id) => document.getElementById(id)).filter(Boolean); window.__keptCss.forEach((e) => e.remove()); }, ids);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOT_DIR, `${prefix}-without-css.jpg`), type: 'jpeg', quality: 82 });
  await page.evaluate(() => { window.__keptCss.forEach((e) => document.head.appendChild(e)); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOT_DIR, `${prefix}-with-css.jpg`), type: 'jpeg', quality: 82 });
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
