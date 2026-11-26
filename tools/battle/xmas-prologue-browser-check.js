#!/usr/bin/env node
// クリスマスのイベント「聖夜の名探偵」序章 ～雪の招待状～(xmas_story_00・台帳 r1126-013)を、時計をずらした実際のブラウザで確かめる。
//
//   node tools/battle/xmas-prologue-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、序章を読んでいる所(縦・横)と、読んだあとの一覧の写真を残す
//
//   ① 11/28 9:59 … 序章はまだ読めない(公開の印が偽・回想の並びに無い・HOME にイベントの入口が無い)
//   ② 11/28 10:05(開幕の前)… HOME の入口からイベントページを開き、物語タブの序章の「お話を読む」で読める
//   ③ 帯の行は帯(data-story-banner)で出る・ワトソンくんは顔なし(名前と吹き出しだけ)・助手の顔はクリスマス衣装(santa/face)
//   ④ 最後まで送ると、一覧の序章が「読んだ」になり、読んだ印(mh_xmas_story_v1 の cleared に xs00)が付く・実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8953;
const SHOT_DIR = process.env.SHOT_DIR || '';
const ID = 'xmas_story_00';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
// 時計をずらす(Date だけ。タイマーはそのまま進む)
const shiftClock = (iso) => ({ content: `(() => { const off = Date.parse(${JSON.stringify(iso)}) - Date.now(); const RD = Date;
  class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
  D.parse = RD.parse; D.UTC = RD.UTC; window.Date = D; })();` });
const CASES = [
  { label: '縦', viewport: { width: 390, height: 844 }, isMobile: true, shot: 'tate' },
  { label: '横', viewport: { width: 844, height: 390 }, isMobile: true, shot: 'yoko' },
];
(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const open = async (iso, vp) => {
    const ctx = await browser.newContext({ viewport: vp.viewport, hasTouch: true, isMobile: vp.isMobile, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(shiftClock(iso));
    await page.addInitScript(() => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
      put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
      put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
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
    return { ctx, page, errors };
  };
  try {
    // ① 公開の前
    {
      const { ctx, page, errors } = await open('2026-11-28T09:59:00+09:00', CASES[0]);
      await page.waitForTimeout(800);
      const st = await page.evaluate(() => ({ flag: EVENT_REPLAY_RELEASE_FLAGS.xmasStoryPrologue, listed: eventReplayList().some((e) => e.id === 'xmas_story_00'), all: eventReplayAllList().some((e) => e.id === 'xmas_story_00') }));
      check('① 11/28 9:59: 公開の印が偽で、回想の並びに無い(デバッグの一覧には有る)', st.flag === false && !st.listed && st.all, JSON.stringify(st));
      check('① 11/28 9:59: HOME にイベントの入口が無い', await page.locator('[data-home-xmas-entry]').count() === 0);
      check('① 実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
      await ctx.close();
    }
    // ② 〜 ④ 公開のあと・開幕の前
    for (const vp of CASES) {
      const { ctx, page, errors } = await open('2026-11-28T10:05:00+09:00', vp);
      const shot = async (name) => { if (!SHOT_DIR) return; fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.waitForTimeout(450); await page.screenshot({ path: path.join(SHOT_DIR, `${vp.shot}-${name}.jpg`), type: 'jpeg', quality: 82 }); };
      const flag = await page.evaluate(() => EVENT_REPLAY_RELEASE_FLAGS.xmasStoryPrologue === true && RELEASE_FLAGS.raidXmas === false);
      check(`② ${vp.label}: 11/28 10:05 は序章の公開の印が真(開幕の印はまだ偽)`, flag);
      const entry = page.locator('[data-home-xmas-entry]').first();
      await entry.waitFor({ timeout: 10000 }).catch(() => {});
      check(`② ${vp.label}: HOME にイベントの入口がある`, await entry.count() > 0);
      await entry.dispatchEvent('click').catch(() => {});
      const row = page.locator('[data-xmas-story-chapter="xs00"]');
      await row.waitFor({ timeout: 10000 }).catch(() => {});
      const rowText = await row.innerText().catch(() => '');
      check(`② ${vp.label}: 物語タブに序章「雪の招待状」が開いている`, /雪の招待状/.test(rowText) && (await row.getAttribute('data-status')) !== 'locked', rowText.replace(/\s+/g, ' '));
      const row1 = await page.locator('[data-xmas-story-chapter="xs01"]').getAttribute('data-status').catch(() => '');
      check(`② ${vp.label}: 第1話はまだ鍵`, row1 === 'locked', row1);
      await row.dispatchEvent('click');
      const read = page.locator('[data-xmas-story-read]');
      await read.waitFor({ timeout: 5000 }).catch(() => {});
      check(`② ${vp.label}: 「お話を読む」が出る`, await read.count() > 0);
      await read.dispatchEvent('click').catch(() => {});
      const story = page.locator(`[data-event-story="${ID}"]`);
      await story.waitFor({ timeout: 8000 }).catch(() => {});
      check(`② ${vp.label}: 序章のお話が開く`, await story.count() > 0);
      await page.waitForTimeout(1500);
      await page.locator('[data-story-opening-card]').dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(900);
      let bandSeen = 0, watsonOk = null, santaOk = null, last = -1;
      for (let i = 0; i < 200; i++) {
        if (await page.locator('[data-story-ending]').count() > 0 || await story.count() === 0) break;
        const step = Number(await story.getAttribute('data-story-step').catch(() => -1));
        if (step !== last) {
          last = step;
          const banner = await page.locator('[data-story-banner]').count();
          const t = await story.innerText().catch(() => '');
          if (banner > 0) bandSeen++;
          if (step === 0) await shot('1-band');
          if (watsonOk == null && /表を出しました/.test(t)) {
            // ワトソンくん: 顔の欄が無く、名前の札と吹き出しだけ
            watsonOk = await page.evaluate(() => !document.querySelector('[data-story-guest="watson"]') && !!document.querySelector('[data-story-guest-bubble]') && /ワトソンくん/.test(document.querySelector('[data-story-guest-bubble]').innerText));
            santaOk = await page.evaluate(() => [...document.querySelectorAll('[data-story-speaker] img')].some((im) => /assistant\/santa\/face\//.test(im.getAttribute('src') || '')));
            await shot('2-watson');
          }
          if (/封筒！？/.test(t)) await shot('3-mua');
          if (/招待状——/.test(t)) await shot('4-letter');
        }
        await page.waitForTimeout(80);
        await story.locator('button[aria-label="次へ"]').first().dispatchEvent('click').catch(() => {});
        // 帯の手紙の行(holdMs)は少し待つ
        await page.waitForTimeout(220);
        if (Number(await story.getAttribute('data-story-step').catch(() => -1)) === step) await page.waitForTimeout(1400);
      }
      check(`③ ${vp.label}: 帯の行が帯で出る`, bandSeen >= 6, `${bandSeen} 行`);
      check(`③ ${vp.label}: ワトソンくんは顔なし(名前と吹き出しだけ)`, watsonOk === true);
      check(`③ ${vp.label}: 助手の顔はクリスマス衣装`, santaOk === true);
      check(`④ ${vp.label}: 最後(${last + 1} 行目)まで送れた`, last + 1 === 42, `${last + 1}`);
      const ending = page.locator('[data-story-ending]');
      await ending.waitFor({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await page.locator('[data-story-ending-close]').dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(800);
      if (await story.count() > 0) { await story.locator('button[aria-label="次へ"]').first().dispatchEvent('click').catch(() => {}); await page.waitForTimeout(800); }
      const done = page.locator('[data-xmas-story-chapter="xs00"] [data-xmas-story-done]');
      await done.waitFor({ timeout: 5000 }).catch(() => {});
      check(`④ ${vp.label}: 読んだあと、一覧の序章が「読んだ」`, await done.count() > 0);
      const saved = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_xmas_story_v1') || 'null'); } catch (e) { return null; } });
      check(`④ ${vp.label}: 読んだ印(mh_xmas_story_v1)に xs00`, !!saved && Array.isArray(saved.cleared) && saved.cleared.includes('xs00'), JSON.stringify(saved));
      await shot('5-read');
      check(`④ ${vp.label}: 実行時エラーが無い`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `NG ${failed} 件` : 'OK: 序章の検査はすべて通りました');
  process.exit(failed ? 1 : 0);
})();
