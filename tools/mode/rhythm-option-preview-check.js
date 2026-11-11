#!/usr/bin/env node
// モンヒロビートのオプションの「▶ 見てみる」(2026-11-11 社長「モンビーのオプションで、現在の設定での画面が分からないから見れるようにしたい」・案A)を実際のブラウザで確かめる。
//
//   node tools/mode/rhythm-option-preview-check.js        (SHOT_DIR=… で止め絵も撮る)
//
// 見るもの(縦・横):
//   ① オプションの上に「▶ 見てみる」がある
//   ② 押すと本物の演奏画面で見本が流れ、自動で叩いて取れている(MISS が出ない)
//   ③ 見本は保存前の設定(下書き)で表示される(コンボ数を OFF にして押すと、見本でもコンボ数が出ない)
//   ④ 「設定へ戻る」でオプションへ戻り、下書き(未保存の変更)が残っている。保存はされていない
//   ⑤ 何も記録しない(自己ベスト・遊んだ記録が増えない)
//   ⑥ 実行時エラーが出ない
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 8988);
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
    breakthroughReserve: { gold: 0, psyche: 0 }, quickRun: { heroRosterEntry: 'Suezo', distance: 2, difficulty: 'Beginner', autoStart: false } });
  put('mh_gold', 1000);
  // 転生の「すべて選択」などが出るよう、絆の高いマスモンを置く(テスターいちかが重なりを見つけた画面)
  put('mh_masu_mons', ['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Ham'].map((b, i) => ({ id: `m${i + 1}`, baseId: b, name: `テスト${i + 1}`, bondXp: 999999999, createdAt: i + 1 })));
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const [w, h, tag] of [[390, 844, '縦'], [844, 390, '横']]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const fatal = [];
      page.on('pageerror', (e) => fatal.push(e.message));
      await page.addInitScript(seed); await page.addInitScript(quiet.quietBootSeed()); await page.addInitScript(quiet.updateNoticeSeed());
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
      await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = page.getByRole('button', { name: 'トップ画面へ進む' }), home = page.locator('button[aria-label="モンヒロバトル"]');
      const cp = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで)$/.test((x.innerText || '').trim()) && !x.closest('[data-mh-screen]')); if (b) { b.click(); return true; } return false; });
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.dispatchEvent('pointerdown').catch(() => {}); await cp(); await page.waitForTimeout(500); }
      const ct = (re) => page.evaluate((s) => { const r = new RegExp(s); const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && r.test(((x.getAttribute('aria-label') || '') + ' ' + (x.innerText || '')).trim())); if (b) { b.click(); return true; } return false; }, re.source);
      await ct(/モンヒロビート/); await page.waitForTimeout(2500); for (let i = 0; i < 4 && await cp(); i++) await page.waitForTimeout(300);
      await page.evaluate(() => document.querySelector('[data-rhythm-mode-options]')?.click()); await page.waitForTimeout(1500);
      const shot = async (name) => { if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `${tag}-${name}.png`) }); } };
      check(`[${tag}] ① オプションの上に「▶ 見てみる」がある`, await page.evaluate(() => { const b = document.querySelector('[data-rhythm-option-preview-open]'); return !!b && !!b.offsetParent; }));
      await shot('1-options');
      // 表示タブでコンボ数を OFF にする(保存しない)
      await page.evaluate(() => [...document.querySelectorAll('[data-rhythm-options-tab]')].find(b => /表示/.test(b.innerText))?.click()); await page.waitForTimeout(400);
      const comboOff = await page.evaluate(() => { const box = [...document.querySelectorAll('div')].find(d => d.children.length && /^コンボ数$/.test((d.firstElementChild && d.firstElementChild.innerText || '').trim())); const off = box && [...box.querySelectorAll('button,label,input')].find(b => /OFF/.test(b.innerText || b.value || b.getAttribute('aria-label') || '')); if (off) { off.click(); return true; } return false; });
      await page.waitForTimeout(300);
      const savedBefore = await page.evaluate(() => localStorage.getItem('mh_rhythm_settings_v1'));
      const bestBefore = await page.evaluate(() => localStorage.getItem('mh_rhythm_best_v1'));
      await page.evaluate(() => document.querySelector('[data-rhythm-option-preview-open]').click());
      await page.waitForSelector('[data-rhythm-play-area]', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(9000);
      await shot('2-preview');
      const r = await page.evaluate(() => { const rs = (window.__mhTestHooks && window.__mhTestHooks.rhythmNoteResults && window.__mhTestHooks.rhythmNoteResults()) || []; const done = rs.filter(x => x.done); return { n: rs.length, done: done.length, miss: done.filter(x => x.judgment === 'MISS' || x.judgment === 'BAD').map(x => x.index), panel: !!document.querySelector('[data-rhythm-option-preview-back]'), combo: (() => { const el = document.querySelector('[data-rhythm-combo]'); return el ? getComputedStyle(el).display !== 'none' && el.offsetParent !== null : false; })() }; });
      check(`[${tag}] ② 見本が流れ、自動で叩いて取れている(MISS・BAD が出ない)`, r.n > 0 && r.done >= 4 && r.miss.length === 0 && r.panel, JSON.stringify(r));
      check(`[${tag}] ③ 見本は保存前の設定で表示される(コンボ数を OFF にした下書きなら、見本にコンボ数が出ない)`, comboOff && r.combo === false, JSON.stringify({ comboOff, combo: r.combo }));
      await page.evaluate(() => document.querySelector('[data-rhythm-option-preview-back]')?.click()); await page.waitForTimeout(1500);
      const back = await page.evaluate(() => ({ options: !!document.querySelector('[data-rhythm-options]'), saved: localStorage.getItem('mh_rhythm_settings_v1') }));
      check(`[${tag}] ④ 「設定へ戻る」でオプションへ戻り、保存はされていない`, back.options && back.saved === savedBefore, JSON.stringify({ options: back.options, same: back.saved === savedBefore }));
      await page.evaluate(() => [...document.querySelectorAll('[data-rhythm-options-tab]')].find(b => /表示/.test(b.innerText))?.click()); await page.waitForTimeout(300);
      const stillOff = await page.evaluate(() => { const box = [...document.querySelectorAll('div')].find(d => d.children.length && /^コンボ数$/.test((d.firstElementChild && d.firstElementChild.innerText || '').trim())); if (!box) return null; const on = [...box.querySelectorAll('[aria-pressed="true"],[aria-checked="true"],input:checked')].map(x => (x.innerText || x.value || x.closest('label')?.innerText || '').trim()); return on.join(','); });
      check(`[${tag}] ④ 戻ったあとも下書き(コンボ数 OFF)が残っている`, /OFF/.test(String(stillOff)), String(stillOff));
      await shot('3-back');
      // ③ の裏返し: 下書きでコンボ数を ON に戻して見本を出すと、コンボ数が出る(目印の取り違えで ③ が通っていないこと)
      await page.evaluate(() => { const box = [...document.querySelectorAll('div')].find(d => d.children.length && /^コンボ数$/.test((d.firstElementChild && d.firstElementChild.innerText || '').trim())); const on = box && [...box.querySelectorAll('button,label,input')].find(b => /^ON$/.test((b.innerText || b.value || '').trim())); if (on) on.click(); });
      await page.waitForTimeout(300);
      await page.evaluate(() => document.querySelector('[data-rhythm-option-preview-open]').click());
      await page.waitForSelector('[data-rhythm-play-area]', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(9000);
      const comboOn = await page.evaluate(() => { const el = document.querySelector('[data-rhythm-combo]'); return el ? getComputedStyle(el).display !== 'none' && el.offsetParent !== null : false; });
      check(`[${tag}] ③ 下書きでコンボ数を ON にすると、見本にコンボ数が出る`, comboOn === true);
      await shot('4-preview-combo-on');
      await page.evaluate(() => document.querySelector('[data-rhythm-option-preview-back]')?.click()); await page.waitForTimeout(1200);
      check(`[${tag}] ⑤ 何も記録しない(自己ベストが変わらない)`, (await page.evaluate(() => localStorage.getItem('mh_rhythm_best_v1'))) === bestBefore);
      check(`[${tag}] ⑥ 実行時エラーが出ない`, fatal.length === 0, fatal.slice(0, 3).join(' / '));
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
