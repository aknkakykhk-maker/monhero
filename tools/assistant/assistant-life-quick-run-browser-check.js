#!/usr/bin/env node
// 助手ライフを開いたまま、裏でクイック∞周回を回す(2026-11-08 社長「助手ライフ画面でも裏クイックほしい」)を実際のブラウザで確かめる。
//
//   node tools/assistant/assistant-life-quick-run-browser-check.js
//
// 見るもの(60-app.jsx 側。札の見た目は 56-assistant-life*.jsx・ナカヨシ8)
//   ① 助手ライフを開くと、AUTO設定のクイック周回がそろっていれば「始められる」(quickRun.canStart)。開いただけでは始まらない
//   ② 始めると、HOME(助手ライフの下)のまま周回が進む。バトル画面へ飛ばない
//   ③ 裏で回しているあいだ、バトルの効果音を鳴らさない(効果音の音量が0)
//   ④ 助手ライフを閉じると締まる: 報酬(ダイヤ・ブリーダー経験値)が入り、HOME に残り、周回(段階)が残らない
//   ⑤ 止める(onQuickRunStop)でも同じく締まり、助手ライフは開いたまま
//   ⑥ どこでも実行時エラーが出ない
// 札(ボタン)がまだ無くても動くよう、AssistantLifeScreen に渡る props を横から受け取って押す(札ができたらそのボタンでも同じ道を通る)
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8981;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const seed = () => {
  if (sessionStorage.getItem('__alqSeeded')) return;
  sessionStorage.setItem('__alqSeeded', '1');
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3); put('mh_quick_clears_Beginner', 3);
  put('mh_auto_settings_v1', { strategy: 'random', allies: [{ rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }],
    breakthroughReserve: { gold: 0, psyche: 0 }, quickRun: { heroRosterEntry: 'Suezo', distance: 2, difficulty: 'Beginner', autoStart: false } });
  put('mh_gold', 1000);
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.addInitScript(seed);
  await page.addInitScript(quiet.quietBootSeed());
  await page.addInitScript(quiet.updateNoticeSeed());
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  try {
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    const top = page.getByRole('button', { name: 'トップ画面へ進む' }), home = page.locator('button[aria-label="モンヒロバトル"]');
    const closePopups = () => page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで)$/.test((x.innerText || '').trim()) && !x.closest('[data-mh-screen]'));
      if (b) { b.click(); return true; }
      const fx = document.querySelector('[data-growth-fx-sheet]'); if (fx) { fx.click(); return true; }
      return false;
    });
    for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) {
      if (await top.isVisible().catch(() => false)) await top.dispatchEvent('pointerdown').catch(() => {});
      await closePopups();
      await page.waitForTimeout(500);
    }
    for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(300);
    // AssistantLifeScreen に渡る props を受け取る口・効果音の音量の控え
    await page.evaluate(() => {
      const orig = window.AssistantLifeScreen;
      window.AssistantLifeScreen = function (p) { window.__alq = p; return orig(p); };
      const set = Audio_.setSeVolume;
      Audio_.setSeVolume = (v) => { window.__seVol = v; return set(v); };
    });
    const state = () => page.evaluate(() => ({ q: window.__alq ? window.__alq.quickRun : undefined, se: window.__seVol,
      battle: !!document.querySelector('button[aria-label^="AUTO"]'), home: !!document.querySelector('button[aria-label="モンヒロバトル"]'),
      gold: JSON.parse(localStorage.getItem('mh_gold') || '0'), xp: JSON.parse(localStorage.getItem('mh_breeder_xp') || '0') }));
    const openLife = async () => { await page.evaluate(() => assistantLifeOpenScreen()); await page.waitForTimeout(1500); for (let i = 0; i < 4 && await closePopups(); i++) await page.waitForTimeout(300); };
    // ① 開くと始められる。開いただけでは始まらない
    await openLife();
    let s = await state();
    check('① 助手ライフを開くと、AUTO設定のクイック周回を始められる(開いただけでは始まらない)', !!s.q && s.q.canStart === true && s.q.live === false && s.q.loops === 0, JSON.stringify(s.q));
    // ② 始めると HOME のまま進む
    const before = await state();
    await page.evaluate(() => window.__alq.onQuickRunStart());
    let live = false, loopsSeen = 0, jumped = false;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(500);
      s = await state();
      if (s.battle) jumped = true;
      if (s.q && s.q.live) live = true;
      if (s.q) loopsSeen = Math.max(loopsSeen, s.q.loops || 0);
    }
    check('② 始めると、助手ライフの下(HOME)のまま周回が進む。バトル画面へ飛ばない', live && loopsSeen >= 1 && !jumped && s.home, JSON.stringify({ live, loopsSeen, jumped, q: s.q }));
    check('② 獲得の見込み(ダイヤ・経験値)が増えていく', !!s.q && (s.q.gold > 0 || s.q.xp > 0), JSON.stringify(s.q));
    // ③ 効果音は鳴らさない
    check('③ 裏で回しているあいだ、バトルの効果音は鳴らさない(効果音の音量0)', s.se === 0, String(s.se));
    // ④ 閉じると締まる
    await page.evaluate(() => ASSISTANT_LIFE_STORE.set({ open: false }));
    await page.waitForTimeout(3500);
    for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(400);
    const afterClose = await state();
    check('④ 閉じると締まり、報酬(ダイヤか経験値)が入る', afterClose.gold > before.gold || afterClose.xp > before.xp, JSON.stringify({ before: [before.gold, before.xp], after: [afterClose.gold, afterClose.xp] }));
    check('④ 閉じたあとも HOME のまま(バトル画面へ行かない)', afterClose.home && !afterClose.battle);
    await page.waitForTimeout(6000);
    check('④ 閉じたあと、しばらく待ってもバトルへ飛ばない(段階が残っていない)', !(await state()).battle && (await state()).home);
    check('④ 閉じたあとは効果音の音量が元に戻る', (await state()).se !== 0, String((await state()).se));
    await openLife();
    s = await state();
    check('④ 開き直すと、前の周回は残っておらず、新しく始められる', !!s.q && s.q.live === false && s.q.canStart === true && s.q.loops === 0, JSON.stringify(s.q));
    // ⑤ 止めるでも締まる(助手ライフは開いたまま)
    const before2 = await state();
    await page.evaluate(() => window.__alq.onQuickRunStart());
    await page.waitForTimeout(12000);
    for (let i = 0; i < 4 && await closePopups(); i++) await page.waitForTimeout(300);
    await page.evaluate(() => window.__alq.onQuickRunStop());
    await page.waitForTimeout(3000);
    s = await state();
    check('⑤ 止めると締まり、報酬が入る。助手ライフは開いたまま・HOME のまま', (s.gold > before2.gold || s.xp > before2.xp) && !!s.q && s.q.live === false && s.home && !s.battle
      && await page.evaluate(() => !!(ASSISTANT_LIFE_STORE.state && ASSISTANT_LIFE_STORE.state.open)), JSON.stringify({ q: s.q, gold: [before2.gold, s.gold] }));
    check('⑥ 実行時エラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } catch (e) {
    check('ブラウザで確認できた', false, String(e && e.stack || e).slice(0, 400));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
