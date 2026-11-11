#!/usr/bin/env node
// 裏クイックを、ゲームのどこにいても回す(2026-11-11 社長)を実際のブラウザで確かめる。
//
//   node tools/battle/quick-run-anywhere-browser-check.js            (SHOT_DIR=… で止め絵も撮る)
//
// 決めごと(docs/progress/quick-run-anywhere/PLAN.md・社長 A/B/C):
//   ① AUTO設定の自動開始が入なら、ゲームを開くと(HOME で)裏クイックが始まる。HOME のまま進み、バトルの画面へ飛ばない
//   ② HOME・プロフィール・ミッションなど回す画面では周回が進み、どの画面からも帯が見える(帯は画面の高さを取らない)
//   ③ M/B管理・神殿では休む(進まない・バトルへ飛ばない)。出たら続きから(周回数が戻らない)
//   ④ HOME へ戻る(returnToHome)だけでは周回は終わらない
//   ⑤ ほかのバトルの入口を開くと締まる(ダイヤが入る・ランが残らない)。HOME へ戻ると自動で始め直す
//   ⑥ 帯の「止める」で締まる。止めたあとは HOME を行き来しても始め直さない
//   ⑦ 回しているあいだ、画面が揺れない・バトルの効果音を鳴らさない(ボタンの音は鳴る)
//   ⑧ 自動開始が切なら、開いても始まらない
//   ⑨ どこでも実行時エラーが出ない
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 8983);
const SHOT_DIR = process.env.SHOT_DIR || '';
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

const seedFor = (autoStart, difficulty = 'Beginner') => `(() => {
  if (sessionStorage.getItem('__qaSeeded')) return;
  sessionStorage.setItem('__qaSeeded', '1');
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3); for (const d of ['Beginner', 'Easy', 'Normal', 'Hard', 'Expert', 'Master', 'GrandMaster', 'Hell']) put('mh_quick_clears_' + d, 3);
  put('mh_auto_settings_v1', { strategy: 'random', allies: [{ rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }],
    breakthroughReserve: { gold: 0, psyche: 0 }, quickRun: { heroRosterEntry: 'Suezo', distance: 2, difficulty: '${difficulty}', autoStart: ${autoStart ? 'true' : 'false'} } });
  put('mh_gold', 1000);
})();`;

const boot = async (browser, autoStart, viewport = { width: 390, height: 844 }, difficulty = 'Beginner') => {
  const page = await browser.newPage({ viewport });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.addInitScript(seedFor(autoStart, difficulty));
  await page.addInitScript(quiet.quietBootSeed());
  await page.addInitScript(quiet.updateNoticeSeed());
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
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
  return { page, fatal, closePopups };
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const { page, fatal, closePopups } = await boot(browser, true);
    const shot = async (name) => { if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) }); } };
    await page.evaluate(() => {
      const set = Audio_.setSeVolume; Audio_.setSeVolume = (v) => { window.__seVol = v; return set(v); };
      window.__shakeSeen = false;
      new MutationObserver(() => { const el = document.querySelector('[class*="animate-shake"],[style*="shake"]'); if (el) window.__shakeSeen = true; }).observe(document.body, { subtree: true, attributes: true, childList: true });
    });
    const state = () => page.evaluate(() => {
      const el = document.querySelector('[data-quick-anywhere]');
      return { strip: el ? el.getAttribute('data-quick-anywhere') : null, wave: el ? Number(el.getAttribute('data-wave')) : null, loops: el ? Number(el.getAttribute('data-loops')) : null,
        screen: el ? el.getAttribute('data-screen') : null, text: el ? el.innerText : '', rect: el ? el.getBoundingClientRect().toJSON() : null,
        battle: !!document.querySelector('button[aria-label^="AUTO"]'), home: !!document.querySelector('button[aria-label="モンヒロバトル"]'),
        gold: JSON.parse(localStorage.getItem('mh_gold') || '0'), shake: window.__shakeSeen, se: Audio_.isBackgroundSeQuiet ? Audio_.isBackgroundSeQuiet() : undefined };
    });
    const clickText = async (re) => page.evaluate((src) => {
      const r = new RegExp(src);
      const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && r.test((x.getAttribute('aria-label') || '') + ' ' + (x.innerText || '').trim()));
      if (b) { b.click(); return true; } return false;
    }, re.source);
    const goHome = async () => { for (let i = 0; i < 4; i++) { if (await page.locator('button[aria-label="モンヒロバトル"]').isVisible().catch(() => false)) return true; if (!(await clickText(/^(← ?)?(HOME|ホーム)|HOMEへ|ホームへ|^戻る|← 戻る/))) await clickText(/戻る/); await page.waitForTimeout(800); await closePopups(); } return page.locator('button[aria-label="モンヒロバトル"]').isVisible().catch(() => false); };
    const watch = async (ms) => { let jumped = false, s = null, maxWave = 0, maxLoops = 0, minWave = 99; for (let t = 0; t < ms; t += 500) { await page.waitForTimeout(500); s = await state(); if (s.battle) jumped = true; if (s.wave) { maxWave = Math.max(maxWave, s.wave); minWave = Math.min(minWave, s.wave); } if (s.loops) maxLoops = Math.max(maxLoops, s.loops); } return { jumped, s, maxWave, minWave, maxLoops }; };

    // ① ゲームを開くと HOME で始まる
    let w = await watch(8000);
    check('① 自動開始が入なら、ゲームを開くと HOME で裏クイックが始まる', w.s.strip === 'live' && w.s.screen === 'HOME', JSON.stringify(w.s));
    check('① HOME のまま進み、バトルの画面へ飛ばない', !w.jumped && w.s.home && (w.maxWave >= 2 || w.maxLoops >= 2), JSON.stringify({ jumped: w.jumped, maxWave: w.maxWave, maxLoops: w.maxLoops }));
    await shot('1-home');
    // ⑦ 揺れない・裏のバトルの効果音は止める
    check('⑦ 回しているあいだ、画面が揺れない', !w.s.shake);
    // ② 帯は「モンヒロバトル」と重ならない
    const btn = await page.locator('button[aria-label="モンヒロバトル"]').boundingBox();
    const r = w.s.rect;
    const overlap = r && btn && !(r.right <= btn.x || r.left >= btn.x + btn.width || r.bottom <= btn.y || r.top >= btn.y + btn.height);
    check('② HOME の帯が「モンヒロバトル」のボタンと重ならない', !!r && !overlap, JSON.stringify({ r, btn }));
    // ② プロフィール・ミッションなど回す画面でも進み、帯が見える
    const runScreens = [[/ミッション/, 'MISSIONS'], [/ギフト/, 'GIFT_BOX'], [/マーケット/, 'BREEDER_MARKET'], [/設定/, 'SETTINGS']];
    for (const [re, name] of runScreens) {
      await goHome();
      const before = await state();
      await clickText(re); await page.waitForTimeout(800); await closePopups();
      // 進むまで最長30秒待つ(WAVE10 のボスは長い。進みが見えたらすぐ次へ)
      let jumpedAny = false;
      for (let k = 0; k < 6; k++) { w = await watch(5000); if (w.jumped) jumpedAny = true; if (w.s.loops !== before.loops || w.maxWave !== before.wave) break; }
      w.jumped = jumpedAny;
      await shot(`2-${name}`);
      const progressed = (w.s.loops > before.loops) || (w.s.loops === before.loops && w.maxWave > before.wave) || w.s.loops < before.loops;
      check(`② ${name} でも帯が見えて周回が進む・バトルへ飛ばない`, w.s.strip === 'live' && w.s.screen === name && progressed && !w.jumped, JSON.stringify({ before: [before.loops, before.wave], after: [w.s.loops, w.s.wave], screen: w.s.screen, strip: w.s.strip, jumped: w.jumped }));
    }
    // ④ HOME へ戻るだけでは終わらない
    const beforeHome = await state();
    await goHome(); await page.waitForTimeout(1500);
    let s = await state();
    check('④ ほかの画面から HOME へ戻っても周回は終わらない(周回数が戻らない)', s.strip === 'live' && s.loops >= beforeHome.loops, JSON.stringify({ before: beforeHome.loops, after: s.loops, strip: s.strip }));
    // ③ M/B管理・神殿では休む
    for (const [re, name] of [[/M\/B管理/, 'MB_MANAGEMENT'], [/神殿/, 'TEMPLE']]) {
      await goHome();
      await clickText(re); await page.waitForTimeout(1200); await closePopups();
      const a = await state();
      w = await watch(5000);
      await shot(`3-${name}`);
      check(`③ ${name} では休む(進まない・バトルへ飛ばない)`, w.s.strip === 'resting' && w.s.screen === name && w.s.loops === a.loops && w.s.wave === a.wave && !w.jumped, JSON.stringify({ a: [a.strip, a.loops, a.wave, a.screen], b: [w.s.strip, w.s.loops, w.s.wave], jumped: w.jumped }));
      await goHome();
      // 進むまで最長30秒待つ(WAVE10 のボスは長い)
      for (let k = 0; k < 6; k++) { w = await watch(5000); if (w.s.loops > a.loops || w.maxWave > a.wave) break; }
      check(`③ ${name} から出ると続きから進む`, w.s.strip === 'live' && w.s.loops >= a.loops && (w.maxWave > a.wave || w.s.loops > a.loops), JSON.stringify({ a: [a.loops, a.wave], b: [w.s.loops, w.maxWave] }));
    }
    // ⑥ 帯の詳細と「止める」
    await goHome();
    for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('[data-quick-anywhere]').click()); await page.waitForTimeout(400);
    await shot('6-detail');
    check('⑥ 帯を押すと詳細が開く', await page.locator('[data-quick-anywhere-detail]').isVisible());
    const goldBeforeStop = (await state()).gold;
    await page.evaluate(() => document.querySelector('[data-quick-anywhere-stop]').click()); await page.waitForTimeout(2500); await closePopups();
    s = await state();
    check('⑥ 「止める」で締まる(ダイヤが入り、帯が消える・HOME に残る)', s.strip === null && s.home && s.gold >= goldBeforeStop, JSON.stringify({ goldBeforeStop, s }));
    await clickText(/ミッション/); await page.waitForTimeout(800); await goHome(); await page.waitForTimeout(2000);
    s = await state();
    check('⑥ 止めたあとは、HOME を行き来しても始め直さない', s.strip === null, JSON.stringify(s));
    // ⑤ ほかのバトルの入口を開くと締まり、HOME へ戻ると始め直す(止めたあとでも、ほかのバトルから戻れば始まる)
    await clickText(/モンヒロバトル/); await page.waitForTimeout(1500); await closePopups();
    await goHome(); w = await watch(4000);
    check('⑤ ほかのバトルの入口から HOME へ戻ると、自動で始め直す', w.s.strip === 'live', JSON.stringify(w.s));
    const g0 = (await state()).gold;
    await clickText(/モンヒロバトル/); await page.waitForTimeout(2500); await closePopups();
    s = await state();
    await shot('5-battle-entry');
    check('⑤ ほかのバトルの入口を開くと締まる(帯が消える・バトルへ飛ばない)', s.strip === null && !s.battle, JSON.stringify(s));
    check('⑤ 締めたぶんのダイヤが入っている(減らない)', s.gold >= g0, JSON.stringify({ g0, g1: s.gold }));
    check('⑨ 実行時エラーが出ない', fatal.length === 0, fatal.slice(0, 3).join(' / '));
    await page.close();
    // ⑧ 自動開始が切なら始まらない
    const off = await boot(browser, false);
    await off.page.waitForTimeout(5000);
    const offStrip = await off.page.evaluate(() => !!document.querySelector('[data-quick-anywhere]'));
    check('⑧ 自動開始が切なら、ゲームを開いても始まらない', !offStrip);
    check('⑨ 実行時エラーが出ない(自動開始が切)', off.fatal.length === 0, off.fatal.slice(0, 3).join(' / '));
    // ⑩ 裏で負けたとき(Hell ですぐ負ける)。2026-11-11 社長「裏クイック中に死ぬと、バトルの効果音が鳴り続ける」
    //   HOME で回しているあいだ(負けて始め直すまでも)、裏のバトルの効果音は止めたまま(Audio_.se が呼ばれたとき、止める印が立っている)。
    //   助手ライフの上でも、負けたあと効果音の音量を戻さない。ガッツ切れで理由なしに止まらない(負け以外で止まらない)
    {
      await off.page.close().catch(() => {});
      const hell = await boot(browser, true, { width: 390, height: 844 }, 'Hell');
      await hell.page.evaluate(() => {
        window.__se = []; window.__vol = [];
        for (const k of Object.keys(Audio_.se)) { const f = Audio_.se[k]; Audio_.se[k] = (...a) => { const el = document.querySelector('[data-quick-anywhere]'); window.__se.push({ k, quiet: Audio_.isBackgroundSeQuiet(), strip: el ? el.getAttribute('data-quick-anywhere') : '' }); return f(...a); }; }
        const sv = Audio_.setSeVolume; Audio_.setSeVolume = (v) => { window.__vol.push({ v, life: !!document.querySelector('[data-life-quick-run]') }); return sv(v); };
      });
      const states = [];
      for (let t = 0; t < 70; t++) { await hell.page.waitForTimeout(1000); const st = await hell.page.evaluate(() => { const el = document.querySelector('[data-quick-anywhere]'); return el ? `${el.getAttribute('data-quick-anywhere')}:${el.textContent}` : 'none'; }); if (states[states.length - 1] !== st) states.push(st); }
      const se = await hell.page.evaluate(() => window.__se);
      const loud = se.filter(x => x.k !== 'tap' && !x.quiet);
      check('⑩ HOME で裏クイックが負けて始め直すあいだ、裏のバトルの効果音は鳴らさない', se.length > 0 && loud.length === 0, JSON.stringify({ calls: se.length, loud: loud.slice(0, 5) }));
      check('⑩ 負けたら「😢 負け」になり、数秒で始め直す', states.some(x => /負け/.test(x)) && states.slice(states.findIndex(x => /負け/.test(x))).some(x => /^live/.test(x)), states.join(' → '));
      check('⑩ ガッツ切れなどで、負け以外の理由で止まらない(「⏹ 停止」にならない)', !states.some(x => /停止/.test(x)), states.join(' → '));
      // 助手ライフの上で負けたとき、効果音の音量を戻さない
      await hell.page.evaluate(() => { window.__vol = []; assistantLifeOpenScreen(); });
      let lifeLost = false;
      for (let t = 0; t < 60 && !lifeLost; t++) { await hell.page.waitForTimeout(1000); lifeLost = await hell.page.evaluate(() => !!document.querySelector('[data-life-quick-run-lose]')); }
      await hell.page.waitForTimeout(1500);
      const vol = await hell.page.evaluate(() => window.__vol);
      check('⑩ 助手ライフの上で負けても、裏のバトルの効果音の音量を戻さない(負けた最後のターンの音を鳴らさない)', lifeLost && !vol.some(x => x.v > 0 && x.life), JSON.stringify({ lifeLost, vol: vol.slice(-6) }));
      check('⑨ 実行時エラーが出ない(Hell)', hell.fatal.length === 0, hell.fatal.slice(0, 3).join(' / '));
      await hell.page.close().catch(() => {});
    }
    // 横画面(止め絵を撮るときだけ): HOME の帯が「モンヒロバトル」と重ならない
    if (SHOT_DIR) {
      const yoko = await boot(browser, true, { width: 844, height: 390 });
      await yoko.page.waitForTimeout(6000);
      for (let i = 0; i < 6 && await yoko.closePopups(); i++) await yoko.page.waitForTimeout(300);
      await yoko.page.screenshot({ path: path.join(SHOT_DIR, 'yoko-home.png') });
      const yr = await yoko.page.evaluate(() => { const el = document.querySelector('[data-quick-anywhere]'); const b = document.querySelector('button[aria-label="モンヒロバトル"]'); return { r: el && el.getBoundingClientRect().toJSON(), b: b && b.getBoundingClientRect().toJSON() }; });
      const hit = yr.r && yr.b && !(yr.r.right <= yr.b.left || yr.r.left >= yr.b.right || yr.r.bottom <= yr.b.top || yr.r.top >= yr.b.bottom);
      check('② 横画面でも、HOME の帯が出て「モンヒロバトル」と重ならない', !!yr.r && !hit, JSON.stringify(yr));
      await yoko.page.evaluate(() => document.querySelector('[data-quick-anywhere]') && document.querySelector('[data-quick-anywhere]').click()); await yoko.page.waitForTimeout(400);
      await yoko.page.screenshot({ path: path.join(SHOT_DIR, 'yoko-detail.png') });
      check('⑨ 実行時エラーが出ない(横画面)', yoko.fatal.length === 0, yoko.fatal.slice(0, 3).join(' / '));
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
