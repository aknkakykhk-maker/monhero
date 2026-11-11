#!/usr/bin/env node
// 裏クイック(どこでも回す)の小さな帯が、画面のほかのボタンと重ならないかを実際のブラウザで測る(2026-11-11)。
//
//   node tools/battle/quick-run-anywhere-strip-overlap-check.js        (SHOT_DIR=… で止め絵も撮る)
//
// テスターいちか「転生のすべて選択ボタンと被るから右下にしてほし〜」。帯は右下に置く。
// HOME・神殿・転生・マーケット・ミッション・ギフト・プロフィールを、縦(390×844)・横(844×390)・横小(667×375)で開き、
//   ① 帯が出ている ② 帯がほかの押せるもの(button・a・[role=button])と重ならない ③ 帯に WAVE が出ている(「◯周目 W◯/10」)
// を見る。モンヒロビート・助手ライフの上では帯を出さない(それぞれの帯がある)ことも見る。
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 8984);
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
const seed = () => {
  if (sessionStorage.getItem('__qsSeeded')) return;
  sessionStorage.setItem('__qsSeeded', '1');
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3); put('mh_quick_clears_Beginner', 3);
  put('mh_auto_settings_v1', { strategy: 'random', allies: [{ rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }],
    breakthroughReserve: { gold: 0, psyche: 0 }, quickRun: { heroRosterEntry: 'Suezo', distance: 2, difficulty: 'Beginner', autoStart: true } });
  put('mh_gold', 1000);
  // 転生の「すべて選択」などが出るよう、絆の高いマスモンを置く(テスターいちかが重なりを見つけた画面)
  put('mh_masu_mons', ['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Ham'].map((b, i) => ({ id: `m${i + 1}`, baseId: b, name: `テスト${i + 1}`, bondXp: 999999999, createdAt: i + 1 })));
};
(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const [w, h, tag] of [[390, 844, '縦'], [844, 390, '横'], [667, 375, '横小']]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const fatal = [];
      page.on('pageerror', (e) => fatal.push(e.message));
      await page.addInitScript(seed);
      await page.addInitScript(quiet.quietBootSeed());
      await page.addInitScript(quiet.updateNoticeSeed());
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
      await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = page.getByRole('button', { name: 'トップ画面へ進む' }), home = page.locator('button[aria-label="モンヒロバトル"]');
      const closePopups = () => page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで)$/.test((x.innerText || '').trim()) && !x.closest('[data-mh-screen]') && !x.closest('[data-quick-anywhere-detail]'));
        if (b) { b.click(); return true; }
        const fx = document.querySelector('[data-growth-fx-sheet]'); if (fx) { fx.click(); return true; }
        // 助手どうしのおしゃべりの札(下に出る)は閉じる(測るのは帯と画面のボタン)
        const x = [...document.querySelectorAll('button')].find((b2) => b2.offsetParent && (b2.getAttribute('aria-label') || '') === '閉じる'); if (x) { x.click(); return true; }
        return false;
      });
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) {
        if (await top.isVisible().catch(() => false)) await top.dispatchEvent('pointerdown').catch(() => {});
        await closePopups(); await page.waitForTimeout(500);
      }
      await page.waitForTimeout(5000);
      for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(300);
      const clickText = (re) => page.evaluate((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && r.test(((x.getAttribute('aria-label') || '') + ' ' + (x.innerText || '')).trim())); if (b) { b.click(); return true; } return false; }, re.source);
      const goHome = async () => { for (let i = 0; i < 4; i++) { if (await home.isVisible().catch(() => false)) return; if (!(await clickText(/^(← ?)?(HOME|ホーム)|HOMEへ|ホームへ|^戻る|← 戻る/))) await clickText(/戻る/); await page.waitForTimeout(800); await closePopups(); } };
      const measure = (name) => page.evaluate((nm) => {
        const el = document.querySelector('[data-quick-anywhere]');
        if (!el) return { name: nm, strip: null };
        const R = el.getBoundingClientRect();
        const hits = [];
        for (const o of document.querySelectorAll('button,a,[role=button]')) {
          if (o === el || el.contains(o) || o.contains(el) || o.closest('[data-quick-anywhere-detail]') || !o.getClientRects().length) continue;
          const cs = getComputedStyle(o); if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || Number(cs.opacity) === 0) continue;
          const r = o.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
          if (Math.min(R.right, r.right) - Math.max(R.left, r.left) > 1 && Math.min(R.bottom, r.bottom) - Math.max(R.top, r.top) > 1) hits.push(((o.getAttribute('aria-label') || o.innerText || o.tagName) + '').replace(/\s+/g, ' ').slice(0, 24));
        }
        const inView = R.left >= 0 && R.top >= 0 && R.right <= innerWidth && R.bottom <= innerHeight;
        return { name: nm, strip: el.innerText.replace(/\s+/g, ' '), rect: [Math.round(R.left), Math.round(R.top), Math.round(R.width), Math.round(R.height)], hits, inView };
      }, name);
      const results = [];
      const visit = async (name, steps) => {
        await goHome();
        for (const re of steps) { await clickText(re); await page.waitForTimeout(1200); for (let i = 0; i < 4 && await closePopups(); i++) await page.waitForTimeout(300); }
        const m = await measure(name); results.push(m);
        if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `${tag}-${name}.png`) }); }
      };
      await visit('HOME', []);
      await visit('神殿', [/神殿/]);
      await visit('転生', [/神殿/, /転生/]);
      await visit('マーケット', [/マーケット/]);
      await visit('ミッション', [/ミッション/]);
      await visit('ギフト', [/ギフト/]);
      for (const m of results) {
        check(`[${tag}] ${m.name}: 帯が出ていて、画面の中に収まる`, !!m.strip && m.inView, JSON.stringify(m));
        check(`[${tag}] ${m.name}: 帯がほかのボタンと重ならない`, !!m.strip && m.hits.length === 0, JSON.stringify({ rect: m.rect, hits: m.hits }));
        check(`[${tag}] ${m.name}: 帯に WAVE が出ている`, !!m.strip && /周目/.test(m.strip) && /W\d+\/10/.test(m.strip), m.strip || '');
      }
      // モンヒロビート・助手ライフの上では出さない(それぞれの帯がある)
      await goHome();
      await page.evaluate(() => { if (typeof assistantLifeOpenScreen === 'function') assistantLifeOpenScreen(); }); await page.waitForTimeout(1500);
      check(`[${tag}] 助手ライフの上では帯を出さない`, !(await page.evaluate(() => !!document.querySelector('[data-quick-anywhere]'))));
      if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `${tag}-助手ライフ.png`) });
      await page.evaluate(() => { if (typeof ASSISTANT_LIFE_STORE !== 'undefined') ASSISTANT_LIFE_STORE.set({ open: false }); }); await page.waitForTimeout(1200);
      await goHome(); await clickText(/モンヒロビート/); await page.waitForTimeout(2000); for (let i = 0; i < 4 && await closePopups(); i++) await page.waitForTimeout(300);
      check(`[${tag}] モンヒロビートの上では帯を出さない`, !(await page.evaluate(() => !!document.querySelector('[data-quick-anywhere]'))));
      if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `${tag}-ビート.png`) });
      check(`[${tag}] 実行時エラーが出ない`, fatal.length === 0, fatal.slice(0, 3).join(' / '));
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
