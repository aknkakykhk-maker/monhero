#!/usr/bin/env node
// 裏クイックを、クリスマスのイベントページと事件簿でも回す(台帳 r1126-072・社長「事件簿とイベントページで進める。事件簿をやってる間はたまりがはやくなる。
//   ただ放置時間が長いと通常に戻るとかできる？あと音とか表示は絶対出さないようにしてね」→「3倍・3分で戻す」)を、時計をずらしたブラウザで確かめる。
//
//   node tools/battle/quick-anywhere-xmas-novel-browser-check.js        (SHOT_DIR=… で止め絵も撮る)
//
//   ① 11/28 12:00(開催中): HOME で裏クイックが始まる → イベントページを開いても締まらず、進み続ける。帯・詳細・幕は出ない。裏のバトルの音は止めたまま
//   ② 事件簿を開いて触り続ける → 3倍。オートとスキップで勝手に進めたまま3分触らない → 1倍。また触る → 3倍
//   ③ 事件簿のあいだ、帯・詳細・リザルト・知らせ・演出が出ない。App が曲を替えない・勝ちのジングルを鳴らさない。事件簿の効果音は表の口(fgSe)で鳴る
//   ④ 3倍のあいだも1倍のあいだも周回は進み、境目で周回数・ダイヤが減らない(二重に入る・消える の見張り)
//   ⑤ 事件簿の中でメニュー・タイトルへ・エンドヒストリー・はじめから を行き来しても、上の①〜③が崩れない
//   ⑥ 画面の向きを変える・アプリを裏へ回して戻す、のあとも崩れない(実行時エラーなし)
//   ⑦ 開催期間の外(12/31 4:00 を過ぎた)へ時計が進んだら、事件簿を開いたままでも3倍にしない
//   ⑧ 事件簿を閉じる → イベントページでも帯は出ない → HOME へ戻ると、いつもどおり帯が見える(周回数は戻らない)
//   ⑨ イベントページからレイドへ挑む(バトルの編成へ)と、裏クイックを締めてから進む(ダイヤが減らない・ランが残らない)
//   ⑩ 事件簿を開いたまま裏クイックが負けても(Hell)、何も出さずに数秒で始め直す
//   ⑪ 11/28 9:00(開幕前): 3倍にならない(事件簿は開けない)
//   ⑬ フレンドへ送るいまの状態: イベントページ=xmasEvent・事件簿=xmasNovel(どちらも表の place は other・オート周回中)、HOME で印が消える、休む画面ではオート周回中を送らない(追記2)
//   ⑫ どこでも実行時エラーが出ない
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 8987);
const SHOT_DIR = process.env.SHOT_DIR ? path.resolve(process.env.SHOT_DIR) : '';
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

// 時計: 起動の時刻を iso にし、あとから window.__clockShift(ミリ秒)で進められるようにする
const clockSeed = (iso) => ({ content: `(() => { const off = Date.parse(${JSON.stringify(iso)}) - Date.now(); const RD = Date;
  window.__clockShift = 0;
  class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off + (window.__clockShift || 0)); else super(...a); } static now() { return RD.now() + off + (window.__clockShift || 0); } }
  D.parse = RD.parse; D.UTC = RD.UTC; window.Date = D; })();` });
const seedFor = (difficulty) => `(() => {
  if (sessionStorage.getItem('__qaSeeded')) return;
  sessionStorage.setItem('__qaSeeded', '1');
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_masu_migrated', true); put('mh_first_battle_done_v1', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3); for (const d of ['Beginner', 'Easy', 'Normal', 'Hard', 'Expert', 'Master', 'GrandMaster', 'Hell']) put('mh_quick_clears_' + d, 3);
  put('mh_auto_settings_v1', { strategy: 'random', allies: [{ rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }],
    breakthroughReserve: { gold: 0, psyche: 0 }, quickRun: { heroRosterEntry: 'Suezo', distance: 2, difficulty: '${difficulty}', autoStart: true } });
  put('mh_gold', 1000);
})();`;

const boot = async (browser, iso, { difficulty = 'Beginner', viewport = { width: 390, height: 844 } } = {}) => {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: SHOT_DIR ? 2 : 1 });
  const page = await ctx.newPage();
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.addInitScript(clockSeed(iso));
  await page.addInitScript(seedFor(difficulty));
  await page.addInitScript(quiet.quietBootSeed());
  await page.addInitScript(quiet.updateNoticeSeed());
  await page.addInitScript(quiet.loginBonusDoneSeed());
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  // フレンドへ送る「いまの状態」(friend_profiles)を控える(r1126-072 追記2)。表へは送らない(上の route が空の返事をする)
  const friendPosts = [];
  page.on('request', (req) => { if (req.method() === 'POST' && /friend_profiles/.test(req.url())) { try { const b = req.postDataJSON(); const row = Array.isArray(b) ? b[0] : b; friendPosts.push({ at: Date.now(), place: row.place, pl: row.records && row.records.pl || null, au: row.records && row.records.au || 0 }); } catch (e) { /* 読めない形は数えない */ } } });
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
  const top = page.getByRole('button', { name: 'トップ画面へ進む' }), home = page.locator('button[aria-label="モンヒロバトル"]');
  const closePopups = () => page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで)$/.test((x.innerText || '').trim()) && !x.closest('[data-mh-screen]') && !x.closest('[data-xmas-novel-host]') && !x.closest('[data-xmas-event]'));
    if (b) { b.click(); return true; }
    const fx = document.querySelector('[data-growth-fx-sheet]'); if (fx) { fx.click(); return true; }
    const n = document.querySelector('[data-xmas-event-notice-close]'); if (n) { n.click(); return true; }
    return false;
  });
  for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) {
    if (await top.isVisible().catch(() => false)) await top.dispatchEvent('pointerdown').catch(() => {});
    await closePopups();
    await page.waitForTimeout(500);
  }
  for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(300);
  // 音の見張り: 裏のバトルの効果音(se)が止める印なしに呼ばれたか・App が曲を替えたか・ジングル・表の効果音(fgSe)
  await page.evaluate(() => {
    window.__log = { seLoud: [], fg: [], bgm: [], jingle: [] };
    for (const k of Object.keys(Audio_.se)) { const f = Audio_.se[k]; Audio_.se[k] = (...a) => { if (!Audio_.isBackgroundSeQuiet()) window.__log.seLoud.push({ k, novel: !!document.querySelector('[data-xmas-novel-host]') }); return f(...a); }; }
    for (const k of Object.keys(Audio_.fgSe)) { const f = Audio_.fgSe[k]; Audio_.fgSe[k] = (...a) => { window.__log.fg.push({ k, novel: !!document.querySelector('[data-xmas-novel-host]') }); return f(...a); }; }
    const pb = Audio_.playBGM; Audio_.playBGM = (key) => { window.__log.bgm.push({ key, novel: !!document.querySelector('[data-xmas-novel-host]') }); return pb(key); };
    const pj = Audio_.playJingle; Audio_.playJingle = (key) => { window.__log.jingle.push({ key, novel: !!document.querySelector('[data-xmas-novel-host]') }); return pj(key); };
    // 表示の見張り: 裏クイックの帯・詳細・幕(文字つき)・演出・お祝いの札が、イベントページ・事件簿のあいだに一度でも出たか
    window.__shown = [];
    const SEL = '[data-quick-anywhere],[data-quick-anywhere-detail],[data-quick-anywhere-settling][role="status"],[data-battle-effect-overlay],[data-growth-fx-sheet],[data-growth-fx-small],[data-growth-fx-card]';
    const look = () => {
      const p = window.__mhQuickAnywhereProbe && window.__mhQuickAnywhereProbe();
      if (!p || !p.quiet) return;
      const el = document.querySelector(SEL);
      if (el && !window.__shown.length) window.__shown.push(el.outerHTML.slice(0, 160));
    };
    new MutationObserver(look).observe(document.body, { subtree: true, childList: true, attributes: true });
    setInterval(look, 200);
  });
  return { ctx, page, fatal, closePopups, friendPosts };
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { try { playwright = require(path.join(root, 'tools', 'node_modules', 'playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); } }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const { ctx, page, fatal, closePopups, friendPosts } = await boot(browser, '2026-11-28T12:00:00+09:00');
    const shot = async (name) => { if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) }); } };
    const probe = () => page.evaluate(() => ({ ...window.__mhQuickAnywhereProbe(), boost: window.__mhQuickAnywhereBoost(), seQuiet: Audio_.isBackgroundSeQuiet(),
      strip: (document.querySelector('[data-quick-anywhere]') || { getAttribute: () => null }).getAttribute('data-quick-anywhere'),
      novel: !!document.querySelector('[data-xmas-novel-host]'), event: !!document.querySelector('[data-xmas-event]'), gold: JSON.parse(localStorage.getItem('mh_gold') || '0') }));
    const count = (p) => (p.loops || 0) * 10 + (p.wave || 0); // 進み具合(周回×10+WAVE)
    const shift = (ms) => page.evaluate((d) => { window.__clockShift += d; }, ms);
    // いまの状態がフレンドへ送られるのを待つ(送り直しは15秒より短い間隔では送らない)。since より後のいちばん新しいもの
    const friendPostAfter = async (since, ms = 25000) => { for (let t = 0; t < ms; t += 500) { const x = friendPosts.filter((y) => y.at > since); if (x.length) { await page.waitForTimeout(1500); return friendPosts.filter((y) => y.at > since).pop(); } await page.waitForTimeout(500); } return null; };
    const friendSeen = { event: null, novel: null, home: null, rest: null };
    // ① HOME で始まる
    let p = null;
    for (let i = 0; i < 30; i++) { await page.waitForTimeout(500); p = await probe(); if (p.strip === 'live') break; }
    check('① 11/28 12:00: HOME で裏クイックが始まる(帯が出る)', p.strip === 'live' && p.screen === 'HOME', JSON.stringify(p));
    // イベントページを開く(HOME のイベントの札)
    let opened = false;
    for (let i = 0; i < 40 && !opened; i++) {
      opened = await page.evaluate(() => { const b = document.querySelector('[data-home-xmas-entry],[data-home-event-banner]'); if (b && b.offsetParent) { b.click(); return true; } return false; });
      if (!opened) await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1500);
    for (let i = 0; i < 4 && await closePopups(); i++) await page.waitForTimeout(300);
    const e0 = await probe();
    check('① HOME のイベントの札からイベントページが開く', opened && e0.event && e0.screen === 'RAID_JACK', JSON.stringify(e0));
    check('① イベントページを開いても締まらない(ランが残る)・帯は出ない・裏のバトルの音は止めたまま', e0.run && e0.strip === null && e0.seQuiet, JSON.stringify(e0));
    const tEvent = Date.now();
    await page.waitForTimeout(8000);
    friendSeen.event = await friendPostAfter(tEvent, 20000);
    const e1 = await probe();
    check('① イベントページのあいだも周回が進む・1倍', count(e1) > count(e0) && e1.boost === 1, JSON.stringify({ e0: [e0.loops, e0.wave], e1: [e1.loops, e1.wave, e1.boost] }));
    // ② 事件簿を開く
    await page.evaluate(() => { const b = document.querySelector('[data-xmas-novel-open]'); if (b) b.click(); });
    await page.waitForTimeout(1500);
    let n0 = await probe();
    check('② 物語のタブから事件簿が開く', n0.novel && n0.screen === 'RAID_JACK', JSON.stringify(n0));
    check('② 開いた直後は3倍', n0.boost === 3, JSON.stringify(n0));
    await shot('novel-tate');
    const tNovel = Date.now();
    // はじめから読み始める(題の画面のボタン)
    await page.locator('[data-xmas-novel-new]').click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.locator('[data-xmas-novel-new-ok]').click({ timeout: 1500 }).catch(() => {});
    // 触り続ける(画面を押して送る)。40秒ぶんの進み具合を測る
    const g3a = await probe();
    for (let t = 0; t < 40; t += 2) { await page.mouse.click(195, 640); await page.waitForTimeout(2000); }
    const g3b = await probe();
    friendSeen.novel = friendPosts.filter((y) => y.at > tNovel).pop() || null;
    check('② 触り続けているあいだは3倍のまま', g3b.boost === 3, JSON.stringify(g3b));
    // オートとスキップを入れて、3分ぶん時計を進める(人は触らない)
    await page.locator('[data-xmas-novel-auto]').click({ timeout: 5000 }).catch(() => {});
    await page.locator('[data-xmas-novel-skip]').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(3000);
    check('② オート・スキップを入れた直後(押したので)は3倍', (await probe()).boost === 3);
    await shift(3 * 60 * 1000 + 1000);
    await page.waitForTimeout(800);
    const g1a = await probe();
    check('② 最後に触れてから3分たつと1倍(オートで勝手に進んでいても数えない)', g1a.boost === 1, JSON.stringify(g1a));
    await page.waitForTimeout(40000);
    const g1b = await probe();
    const fast = count(g3b) - count(g3a), slow = count(g1b) - count(g1a);
    check('② 3倍のあいだは1倍のときより速く進む(同じ40秒で比べる)', fast > slow && fast >= Math.max(3, slow * 1.8), JSON.stringify({ fast, slow }));
    check('④ 3倍→1倍の境目で、周回数・ダイヤが減らない', (g1b.loops || 0) >= (g3b.loops || 0) && g1b.gold >= g3a.gold, JSON.stringify({ loops: [g3a.loops, g3b.loops, g1b.loops], gold: [g3a.gold, g1b.gold] }));
    // また触る → 3倍
    await page.keyboard.press('Shift');
    await page.waitForTimeout(300);
    check('② また触ると3倍へ戻る', (await probe()).boost === 3);
    // ⑤ メニュー → タイトルへ → エンドヒストリー → 戻る(はじめから)
    // 事件簿の画面の操作は DOM から押す(途中の札・問いの窓が上にあっても押せる。触れた数は下の Shift で別に数える)
    const nv = (sel) => page.evaluate((q) => { const b = document.querySelector(q); if (b && !b.disabled) { b.click(); return true; } return false; }, sel);
    await nv('[data-xmas-novel-auto]'); await nv('[data-xmas-novel-auto]');
    await nv('[data-xmas-novel-skip]');
    await nv('[data-xmas-novel-menu]'); await page.waitForTimeout(400);
    await nv('[data-xmas-novel-menu-title]'); await page.waitForTimeout(800);
    await nv('[data-xmas-novel-endings]'); await page.waitForTimeout(800);
    const endList = await page.evaluate(() => !!document.querySelector('[data-xmas-novel-ending-list]'));
    await page.keyboard.press('Shift');
    p = await probe();
    check('⑤ メニュー・タイトルへ・エンドヒストリーを開いても、事件簿のまま3倍・帯なし', endList && p.novel && p.boost === 3 && p.strip === null, JSON.stringify({ endList, p }));
    // ⑥ 向きを変える(横)・アプリを裏へ回して戻す
    await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(1500);
    await shot('novel-yoko');
    const setVis = (v) => page.evaluate((state) => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }, v);
    await setVis('hidden'); await page.waitForTimeout(2000); await setVis('visible'); await page.waitForTimeout(3000);
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(1500);
    p = await probe();
    check('⑥ 向きを変える・裏へ回して戻すあとも、事件簿のまま・帯なし', p.novel && p.strip === null && p.screen === 'RAID_JACK', JSON.stringify(p));
    // ③ 音と表示
    const log = await page.evaluate(() => ({ ...window.__log, shown: window.__shown }));
    check('③ イベントページ・事件簿のあいだ、裏クイックの帯・詳細・演出・お祝いの札が一度も出ない', log.shown.length === 0, JSON.stringify(log.shown));
    check('③ 事件簿のあいだ、裏のバトルの効果音が止める印なしで鳴らない', !log.seLoud.some((x) => x.novel && x.k !== 'tap'), JSON.stringify(log.seLoud.slice(0, 5)));
    check('③ 事件簿のあいだ、App が曲を替えない(事件簿の曲を邪魔しない)', !log.bgm.some((x) => x.novel), JSON.stringify(log.bgm.filter((x) => x.novel).slice(0, 5)));
    check('③ 事件簿のあいだ、勝ちのジングルを鳴らさない', !log.jingle.some((x) => x.novel), JSON.stringify(log.jingle.slice(0, 5)));
    check('③ 事件簿の効果音は表の口(fgSe)から鳴る', log.fg.some((x) => x.novel), JSON.stringify(log.fg.slice(0, 5)));
    // ⑦ 期間の外へ時計が進む(12/31 4:00 を過ぎる)
    const toAfter = Date.parse('2026-12-31T04:10:00+09:00') - (await page.evaluate(() => Date.now()));
    await shift(toAfter); await page.keyboard.press('Shift'); await page.waitForTimeout(300);
    p = await probe();
    check('⑦ 開催期間が終わったあとは、事件簿を開いたまま触っても3倍にしない', p.boost === 1, JSON.stringify(p));
    await shift(-toAfter); await page.keyboard.press('Shift'); await page.waitForTimeout(300);
    // ⑧ 閉じる → イベントページ(帯なし) → HOME(帯あり)
    const beforeClose = await probe();
    for (let i = 0; i < 6 && await page.evaluate(() => !!document.querySelector('[data-xmas-novel-host]')); i++) {
      await nv('[data-xmas-novel-menu-close]') || await nv('[data-xmas-novel-close]');
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(700);
    p = await probe();
    check('⑧ 事件簿を閉じるとイベントページに戻り、1倍・帯は出ない', !p.novel && p.event && p.boost === 1 && p.strip === null && p.run, JSON.stringify(p));
    const backed = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-xmas-event] button')].find((x) => /戻る|もどる|HOME|ホーム/.test((x.getAttribute('aria-label') || '') + (x.innerText || ''))); if (b) { b.click(); return true; } return false; });
    await page.waitForTimeout(2000);
    for (let i = 0; i < 4 && await closePopups(); i++) await page.waitForTimeout(300);
    p = await probe();
    await shot('home-after-novel');
    check('⑧ HOME へ戻ると、いつもどおり帯が見える(周回数は戻らない・ダイヤは減らない)', backed && p.screen === 'HOME' && p.strip === 'live' && (p.loops || 0) >= (beforeClose.loops || 0) && p.gold >= beforeClose.gold, JSON.stringify({ backed, p, before: [beforeClose.loops, beforeClose.gold] }));
    friendSeen.home = await friendPostAfter(Date.now() - 1000, 20000);
    // 休む画面(M/B管理)では「オート周回中」を送らない
    const tRest = Date.now();
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /M\/B管理/.test((x.getAttribute('aria-label') || '') + (x.innerText || ''))); if (b) b.click(); });
    friendSeen.rest = await friendPostAfter(tRest, 25000);
    const restProbe = await probe();
    if (!friendPosts.length) console.log('SKIP: フレンドへの送信が起きなかった(この環境ではフレンドが動いていない)');
    else {
      check('⑬ フレンドへ: イベントページでは place=other・pl=xmasEvent・オート周回中', !!friendSeen.event && friendSeen.event.place === 'other' && friendSeen.event.pl === 'xmasEvent' && friendSeen.event.au === 1, JSON.stringify(friendSeen.event));
      check('⑬ フレンドへ: 事件簿では pl=xmasNovel・オート周回中', !!friendSeen.novel && friendSeen.novel.pl === 'xmasNovel' && friendSeen.novel.au === 1, JSON.stringify(friendSeen.novel));
      check('⑬ フレンドへ: HOME へ戻ると事件簿の印が消える(place=home)', !!friendSeen.home && friendSeen.home.place === 'home' && !friendSeen.home.pl, JSON.stringify(friendSeen.home));
      check('⑬ フレンドへ: 休む画面(M/B管理)では「オート周回中」を送らない', restProbe.screen !== 'HOME' && !!friendSeen.rest && !friendSeen.rest.au, JSON.stringify({ screen: restProbe.screen, rest: friendSeen.rest }));
    }
    for (let i = 0; i < 4; i++) { if (await page.evaluate(() => !!document.querySelector('button[aria-label="モンヒロバトル"]'))) break; await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(← ?)?(HOME|ホーム)|HOMEへ|ホームへ|戻る/.test((x.getAttribute('aria-label') || '') + ' ' + (x.innerText || '').trim())); if (b) b.click(); }); await page.waitForTimeout(1200); }
    // ⑨ イベントページ → レイドのタブ → バトルで挑む(編成へ)。先に締める
    await page.evaluate(() => { const b = document.querySelector('[data-home-xmas-entry],[data-home-event-banner]'); if (b) b.click(); });
    for (let i = 0; i < 20 && !(await probe()).event; i++) { await page.waitForTimeout(500); await page.evaluate(() => { const b = document.querySelector('[data-home-xmas-entry],[data-home-event-banner]'); if (b && b.offsetParent) b.click(); }); }
    await page.waitForTimeout(1000);
    const r0 = await probe();
    await page.evaluate(() => { const t = [...document.querySelectorAll('[data-xmas-event] [role="tab"], [data-xmas-event] button')].find((x) => /レイド/.test(x.innerText || '')); if (t) t.click(); });
    await page.waitForTimeout(1000);
    const challengeState = await page.evaluate(() => [...document.querySelectorAll('[data-raid-ways] button, [data-raid-jack-challenge]')].map((x) => `${(x.innerText || '').trim().replace(/\s+/g, '')}${x.disabled ? '(押せない)' : ''}`).join(' / '));
    const challenged = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-raid-ways] button, [data-raid-jack-challenge]')].find((x) => !x.disabled && /バトル/.test(x.innerText || '')); if (b) { b.click(); return (b.innerText || '').trim().slice(0, 20); } return ''; });
    await page.waitForTimeout(3500);
    p = await probe();
    if (challenged) check('⑨ イベントページからレイドへ挑むと、裏クイックを締めてから進む(ランが残らない・ダイヤが減らない)', r0.run && !p.run && p.gold >= r0.gold && p.screen !== 'RAID_JACK', JSON.stringify({ challenged, r0: [r0.run, r0.gold], p }));
    else console.log(`SKIP: ⑨ レイドの挑むボタンが押せない(回数・段階の都合): ${challengeState}`);
    check('⑫ 実行時エラーが出ない(開催中)', fatal.length === 0, fatal.slice(0, 3).join(' / '));
    await ctx.close();

    // ⑩ 事件簿を開いたまま負ける(Hell)
    {
      const h = await boot(browser, '2026-11-28T12:00:00+09:00', { difficulty: 'Hell' });
      const hp = () => h.page.evaluate(() => ({ ...window.__mhQuickAnywhereProbe(), novel: !!document.querySelector('[data-xmas-novel-host]') }));
      for (let i = 0; i < 30; i++) { await h.page.waitForTimeout(500); if ((await hp()).run) break; }
      for (let i = 0; i < 40; i++) { const ok = await h.page.evaluate(() => { const b = document.querySelector('[data-home-xmas-entry],[data-home-event-banner]'); if (b && b.offsetParent) { b.click(); return true; } return false; }); if (ok) break; await h.page.waitForTimeout(500); }
      await h.page.waitForTimeout(1500);
      for (let i = 0; i < 4 && await h.closePopups(); i++) await h.page.waitForTimeout(300);
      await h.page.evaluate(() => { const b = document.querySelector('[data-xmas-novel-open]'); if (b) b.click(); });
      await h.page.waitForTimeout(1000);
      const seq = [];
      for (let t = 0; t < 90; t++) { await h.page.waitForTimeout(1000); const x = await hp(); const k = x.finished ? `負け:${x.reason}` : 'live'; if (seq[seq.length - 1] !== k) seq.push(k); if (seq.length >= 3) break; }
      const x = await hp();
      const log = await h.page.evaluate(() => ({ shown: window.__shown, seLoud: window.__log.seLoud.filter((y) => y.novel && y.k !== 'tap'), jingle: window.__log.jingle.filter((y) => y.novel) }));
      const lostAt = seq.findIndex((k) => /負け/.test(k));
      check('⑩ 事件簿を開いたまま負けても、数秒で始め直す', lostAt >= 0 && seq.slice(lostAt).includes('live') && x.novel, seq.join(' → '));
      check('⑩ 負けて始め直すあいだも、帯・知らせ・音を出さない', log.shown.length === 0 && log.seLoud.length === 0 && log.jingle.length === 0, JSON.stringify(log));
      check('⑫ 実行時エラーが出ない(Hell)', h.fatal.length === 0, h.fatal.slice(0, 3).join(' / '));
      await h.ctx.close();
    }
    // ⑪ 開幕前(11/28 9:00)
    {
      const b = await boot(browser, '2026-11-28T09:00:00+09:00');
      await b.page.waitForTimeout(3000);
      const x = await b.page.evaluate(() => ({ boost: window.__mhQuickAnywhereBoost(), opened: typeof xmasNovelPresence !== 'undefined' && xmasNovelPresence.open }));
      check('⑪ 開幕前は3倍にならない', x.boost === 1 && !x.opened, JSON.stringify(x));
      check('⑫ 実行時エラーが出ない(開幕前)', b.fatal.length === 0, b.fatal.slice(0, 3).join(' / '));
      await b.ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
