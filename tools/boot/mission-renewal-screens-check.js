#!/usr/bin/env node
// ミッションの作り直し(2026-11-08 社長「この文で」)を、遊ぶ人として縦・横・🔄横の3つの向きで触って確かめる。
//
//   node tools/boot/mission-renewal-screens-check.js            (MR_SHOT_DIR=<フォルダ> で止め絵も撮る)
//   MR_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る(公開後の確かめ。既定は手元の配信)
//
// 向き: 縦 390×844 / 横 844×390 / 🔄横(端末は縦のまま、モンヒロビートの「🔄 横」と同じ回し方)
// 触る所と見ること:
//   ① HOME の「ミッション」から開く。デイリー・ウィークリー・マンスリーの3タブを順に開き、下まで送る
//   ② 報酬の札(data-mission-reward-chip)が、札の中で2行に折れていない・行の枠からはみ出していない(PLAN.md「作るときの画面の決まり」)
//   ③ 行の頭の遊びの印と、コンプリートの数(6個のうち5個・9個のうち7個・12個のうち9個)が出る
//   ④ 持っている家具は「ビートPに替えて届きます」と出る
//   ⑤ デイリーで、助手がその日のミッションをひとことで教える(中継役が返した文/届かないときは決まった台詞)
//   ⑥ (縦だけ)「すべて受け取る」で受け取ると、ビートP・カードパック券が数どおりに増え、もう一度は受け取れない
//   どの画面も: 横にはみ出さない・実行時エラーが出ない
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, 'quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8979;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const SHOT = process.env.MR_SHOT_DIR || '';
if (SHOT) fs.mkdirSync(SHOT, { recursive: true });
const VIEWS = [
  { name: '縦', w: 390, h: 844 },
  { name: '横', w: 844, h: 390 },
  { name: '🔄横', w: 390, h: 844, rot: true },
];
const AI_LINE = '今日はいい日！{task}と、{reward}がもらえるってさ♪';

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    for (const vp of VIEWS) {
      const T = `[${vp.name}] `;
      const errors = [];
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: SHOT ? 2 : 1 });
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_masu_migrated', true);
        put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
        put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true);
        // いまの期間(朝4時区切り)。ゲームの missionDailyPeriod などと同じ式
        const now = Date.now(), d = new Date(now + 5 * 3600000);
        const day = d.toISOString().slice(0, 10), month = d.toISOString().slice(0, 7);
        const w = new Date(d); w.setUTCDate(w.getUTCDate() - ((w.getUTCDay() + 6) % 7)); const week = w.toISOString().slice(0, 10);
        // はじめての人の印(切り替えの数え方は検査 mission-renewal-check.js が見る。ここではふだんの画面を見る)
        put('mh_mission_renew_v1', { at: now, daily: '-', weekly: '-', monthly: '-' });
        put('mh_missions', { version: 2, dailyPeriod: day, weeklyPeriod: week, monthlyPeriod: month,
          daily: { login: 1, battles: 2, beatPlays: 1, challengeClears: 1, enhances: 1, assistantTouches: 1 },
          weekly: { battles: 14, beatPlays: 3, enhances: 10, quickClears: 2, challengeClears: 3, wins: 4, cardWins: 5, friendVisits: 1 },
          monthly: { battles: 23, wins: 90, cardWins: 6, beatClears: 0, dailyCompletes: 4, enhances: 12, quickRuns: 4 },
          sentDaily: [], sentWeekly: [], sentMonthly: [], weeklyLoginDays: [day], monthlyLoginDays: [day],
          monthlyDailyCompletePeriods: [], monthlyWeeklyCompletePeriods: [], weeklyAssistantDays: [day], monthlyAssistantDays: [day] });
        // 月替わりの家具を全部持っている(どの月に撮ってもビートPに替わる)
        put('mh_owned_items', { furn_sofa: 1, furn_bear: 1, furn_plant: 1, furn_record: 1, furn_nyacushion: 1, furn_starpic: 1, furn_trophy: 1, furn_bookshelf: 1, furn_heartmirror: 1, furn_lantern: 1, furn_mirrorball: 1, furn_windbell: 1 });
        put('mh_rhythm_event_points_v1', 1000);
      });
      await page.addInitScript(quietBootSeed());
      await page.addInitScript(updateNoticeSeed());
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      // 中継役: 縦は AI の文を返す/ほかは落ちている(決まった台詞になる)
      await page.route('**/functions/v1/mission-daily-line', (route) => (vp.name === '縦'
        ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, lines: { mua: AI_LINE } }) })
        : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
      await page.route('**/functions/v1/**', (route) => (/mission-daily-line/.test(route.request().url()) ? route.fallback() : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
      await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`${process.env.MR_BASE ? process.env.MR_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = page.getByRole('button', { name: 'トップ画面へ進む' }), home = page.locator('button[aria-label="モンヒロバトル"]');
      const closePopups = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで)$/.test((x.innerText || '').trim()) && !x.closest('[data-mh-screen]')); if (b) { b.click(); return true; } return false; });
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) {
        if (await top.isVisible().catch(() => false)) await top.dispatchEvent('pointerdown').catch(() => {});
        await closePopups();
        await page.waitForTimeout(500);
      }
      for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(300);
      const shot = async (name) => { if (SHOT) await page.screenshot({ path: path.join(SHOT, `${name}-${vp.name}.png`) }); };
      await page.locator('button.mh-home-mission').first().dispatchEvent('click');
      await page.locator('[data-mission-claim-all]').waitFor({ timeout: 20000 });
      await page.waitForTimeout(800);
      // 🔄横はミッション画面を開いてから回す(回した枠 data-mh-view-rotation の中に画面が入っていることも確かめる)
      if (vp.rot) {
        await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(RHYTHM_VIEW_ROTATION.preferredAngle()));
        await page.waitForTimeout(900);
        check(`${T}画面が回っている`, await page.evaluate(() => !!document.querySelector('[data-mh-view-rotation=true] [data-mission-claim-all]')));
      }
      // 札の折れ・はみ出し(回しても中に収まるかは、枠の箱と札の箱の重なりで見る)
      const chips = () => page.evaluate(() => {
        const out = { count: 0, wrapped: [], outside: [], overX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        document.querySelectorAll('[data-mission-reward-chip]').forEach((el) => {
          out.count++;
          const t = (el.innerText || '').trim();
          const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
          if (el.getClientRects().length > 1 || el.offsetHeight > lh * 1.9 || el.scrollWidth > el.clientWidth + 1) out.wrapped.push(t);
          const box = el.closest('article'); if (!box) return;
          const a = el.getBoundingClientRect(), b = box.getBoundingClientRect();
          if (a.left < b.left - 1 || a.right > b.right + 1 || a.top < b.top - 1 || a.bottom > b.bottom + 1) out.outside.push(t);
        });
        return out;
      });
      const scrollBottom = () => page.evaluate(() => { const list = [...document.querySelectorAll('[data-mh-screen] *')].find((x) => x.scrollHeight > x.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(x).overflowY)); if (list) list.scrollTop = list.scrollHeight; });
      const tabs = [['daily', 'デイリー', '①デイリー', '通常デイリー6個のうち5個を達成する'], ['weekly', 'ウィークリー', '②ウィークリー', '通常ウィークリー9個のうち7個を達成する'], ['monthly', 'マンスリー', '③マンスリー', '通常マンスリー12個のうち9個を達成する']];
      for (const [, label, name, completeText] of tabs) {
        await page.locator('[data-mh-screen] button').filter({ hasText: new RegExp(`^${label}`) }).first().dispatchEvent('click');
        await page.evaluate(() => { const list = [...document.querySelectorAll('[data-mh-screen] *')].find((x) => x.scrollHeight > x.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(x).overflowY)); if (list) list.scrollTop = 0; });
        await page.waitForTimeout(600);
        const c = await chips();
        check(`${T}${name}: 報酬の札が出て、札の中で折れていない・行の枠からはみ出していない`, c.count >= 8 && c.wrapped.length === 0 && c.outside.length === 0 && c.overX <= 1, JSON.stringify({ ...c, wrapped: c.wrapped.slice(0, 3), outside: c.outside.slice(0, 3) }));
        check(`${T}${name}: コンプリートの数が出る`, await page.getByText(completeText).count() === 1);
        await shot(`${name}`);
        await scrollBottom(); await page.waitForTimeout(500);
        await shot(`${name}-下まで送った所`);
      }
      // ③ 遊びの印・④ 家具の替え(マンスリーを開いている)
      check(`${T}行の頭に遊びの印が出る(🎵 または ⚔️ / 🃏 または ⚔️ / 🏡)`, await page.locator('[data-mission-tag]').filter({ hasText: '🎵 または ⚔️' }).count() >= 1
        && await page.locator('[data-mission-tag]').filter({ hasText: '🃏 または ⚔️' }).count() >= 1 && await page.locator('[data-mission-tag]').filter({ hasText: '🏡' }).count() >= 1);
      check(`${T}持っている家具は「ビートPに替えて届きます」と出る`, /は持っているので、ビートPに替えて届きます/.test(await page.locator('[data-mission-furniture-swap]').first().innerText().catch(() => '')));
      // ⑤ デイリーの助手のひとこと
      await page.locator('[data-mh-screen] button').filter({ hasText: /^デイリー/ }).first().dispatchEvent('click');
      await page.waitForTimeout(900);
      const lineText = await page.locator('[data-mission-daily-line]').innerText().catch(() => '');
      const want = vp.name === '縦' ? /今日はいい日！.+と、.+がもらえるってさ♪/ : /今日は.曜日！.+と、.+がもらえるよ♪/;
      check(`${T}デイリーで助手がその日のミッションを教える(${vp.name === '縦' ? '中継役の文に、やること・報酬をゲームが入れる' : '届かないときは決まった台詞'})`, want.test(lineText) && !/[{}]/.test(lineText), lineText.slice(0, 60));
      await shot('④助手の1行の案内');
      // ⑥ 受け取り(縦だけ。数が増え、二度目は受け取れない)
      if (vp.name === '縦') {
        const before = await page.evaluate(() => ({ beat: JSON.parse(localStorage.getItem('mh_rhythm_event_points_v1') || '0'), card: (JSON.parse(localStorage.getItem('mh_card_tactics_v1') || 'null') || {}).tickets || 0 }));
        const expect = await page.evaluate(() => {
          const st = normalizeMissions(JSON.parse(localStorage.getItem('mh_missions')));
          const owned = JSON.parse(localStorage.getItem('mh_owned_items') || '{}');
          let beat = 0, card = 0;
          ['daily', 'weekly', 'monthly'].forEach((t) => missionClaimableList(st, t).forEach((m) => missionRewardsFor(m.rewards, { ownedItems: owned }).forEach((r) => { if (r.type === 'beatPoint') beat += r.amount; if (r.type === 'cardPackTicket') card += r.amount; })));
          return { beat, card, n: missionClaimableCount(st) };
        });
        await page.locator('[data-mission-claim-all]').dispatchEvent('click');
        await page.waitForTimeout(1500);
        await shot('⑤コンプリートの受け取り');
        for (let i = 0; i < 4 && await closePopups(); i++) await page.waitForTimeout(400);
        const after = await page.evaluate(() => ({ beat: JSON.parse(localStorage.getItem('mh_rhythm_event_points_v1') || '0'), card: (JSON.parse(localStorage.getItem('mh_card_tactics_v1') || 'null') || {}).tickets || 0,
          left: missionClaimableCount(normalizeMissions(JSON.parse(localStorage.getItem('mh_missions')))) }));
        check(`${T}全て受け取る: ビートPとカードパック券が数どおりに増える`, expect.n > 0 && after.beat - before.beat === expect.beat && after.card - before.card === expect.card && expect.beat > 0 && expect.card > 0, JSON.stringify({ before, after, expect }));
        check(`${T}受け取ったあとは、同じものをもう一度受け取れない`, after.left === 0 && await page.locator('[data-mission-claim-all]').isDisabled());
      }
      check(`${T}実行時エラーが出ない`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }
  } catch (e) {
    check('ブラウザで確認できた', false, String(e && e.stack || e).slice(0, 400));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
