// MFバトルカード: 助手と対戦の相手えらびの並び(2026-10-27 社長の答え・ソランド部長。カード部ナガメくん)。実際のブラウザで確かめる。
//
//   node tools/card/card-foe-grid-browser-check.js
//
//   7人(ソラシドの印が立ったとき)は縦4列(4人＋3人)・横7列。ソラシドは7番目で、いまの6人の並びは変えない。
//   6人まで(印が立つ前)は、いまの縦3列・横6列のまま。
//   助手の一覧(ASSISTANTS)にソラシドがいないときは、読み込んだ data/assistants.js の後ろに仮のソラシド(顔はみゅあの絵)を足し、
//   印(RELEASE_FLAGS.assistantSorashido)は配信する JS の中で回ごとに偽・真に書き換える(公開のあとも両方を見る)。ファイルは書き換えない
//   ① 印が偽: 6人・縦3列・横6列。ソラシドの札が無い
//   ② 印が真: 7人・縦4列・横7列。はじめの6人の並びは印が偽のときと同じで、7番目がソラシド
//   ③ どちらも 320×568・390×844・568×320・844×390 で、名前と顔が札からはみ出さず、札が画面の横幅に収まる
//   ④ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { quietBootSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8951;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const SIZES = [[320, 568], [390, 844], [568, 320], [844, 390]];
const FAKE = "\n;if (!ASSISTANTS.some((a) => a.id === 'sorashido')) ASSISTANTS.push({ id: 'sorashido', name: 'ソラシド', role: '助手', imageDir: 'images/assistant', imagePrefix: 'myua', expressions: ASSISTANT_EXPRESSIONS, defaultExpression: ASSISTANT_DEFAULT_EXPRESSION, emoji: '🎵', accent: '#38bdf8', greeting: '' });\n";

(async () => {
  let playwright;
  try { playwright = require(path.join(root, 'tools', 'node_modules', 'playwright')); } catch { try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); } }
  const server = await serve();
  const errors = [];
  let browser;
  const orderOf = {};
  let lastPage = null;
  try {
    browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    for (const on of [false, true]) {
      const label = on ? '印が真' : '印が偽';
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      // 本物の Supabase へは書かない(読むだけは通す)
      await ctx.route(/supabase\.co\//, (r) => (r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })));
      // 一覧にいなければ仮のソラシドを後ろに足す(印が偽のときも足して、印で外れることを見る)
      await ctx.route(/\/data\/assistants\.js/, async (r) => {
        const body = fs.readFileSync(path.join(root, 'monster-hero', 'data', 'assistants.js'), 'utf8');
        await r.fulfill({ status: 200, contentType: 'text/javascript', body: body + FAKE });
      });
      // 印は、ファイルの値(公開の前は false・公開のあとは true)にかかわらず、配信する JS の中で回ごとに決める(2026-10-27 公開のあとも両方を確かめるため)
      await ctx.route(/game-system\.compiled\.js/, async (r) => {
        const body = fs.readFileSync(path.join(root, 'monster-hero', 'game-system.compiled.js'), 'utf8');
        const re = /assistantSorashido:\s*(?:true|false)/;
        if (!re.test(body)) check(`${label}: 配信する JS の中で印を決められる`, false);
        await r.fulfill({ status: 200, contentType: 'text/javascript', body: body.replace(re, `assistantSorashido: ${on}`) });
      });
      await ctx.addInitScript(() => {
        if (sessionStorage.getItem('__seeded')) return;
        sessionStorage.setItem('__seeded', '1');
        const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
        s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
        s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
        // あつの加入のお話を見た人(いまの6人がみな選べる)
        s('mh_rhythm_event_story_v1', ['atsu_join_2026_10_22']);
      });
      await ctx.addInitScript(quietBootSeed());
      const page = await ctx.newPage();
      lastPage = page;
      page.on('pageerror', (e) => errors.push(String(e)));
      const sleep = (ms) => page.waitForTimeout(ms);
      const dismiss = async () => {
        for (let i = 0; i < 8; i++) {
          const b = page.getByRole('button', { name: /^(受け取る|閉じる|はじめる|OK|スキップ|あとで読む)$/ }).first();
          if (await b.count() === 0 || !(await b.isVisible().catch(() => false))) break;
          await b.dispatchEvent('click').catch(() => {}); await sleep(250);
        }
      };
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = page.getByRole('button', { name: 'トップ画面へ進む' });
      const home = page.locator('[data-home-card-battle]');
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.click().catch(() => {}); await dismiss(); await sleep(500); }
      for (let i = 0; i < 4; i++) { await sleep(500); await dismiss(); }
      await home.click(); await page.locator('[data-card-top]').first().waitFor({ timeout: 20000 }); await sleep(800); await dismiss();
      // はじめてはスターター → 練習試合(飛ばす)。card-cpu-open-browser-check.js と同じ
      if (await page.locator('[data-card-top="starter"]').count()) {
        await page.locator('[data-card-kit="speed"]').click();
        await page.getByRole('button', { name: /にする$/ }).click();
        await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
        await page.locator('[data-card-quit]').click();
        await page.getByRole('button', { name: /^飛ばす$/ }).last().click();
        await page.locator('[data-card-top="result"]').waitFor({ timeout: 15000 });
        await page.getByRole('button', { name: /トップへ/ }).first().click();
        await page.locator('[data-card-top="top"]').waitFor({ timeout: 15000 });
        await sleep(500); await dismiss();
      }
      await page.locator('[data-card-cpu]').first().click(); await sleep(300);
      await page.locator('[data-card-mode-assistant]').click();
      await page.locator('[data-card-foe-grid]').waitFor({ timeout: 10000 });
      const ids = await page.locator('[data-card-foe]').evaluateAll((els) => els.map((e) => e.getAttribute('data-card-foe')));
      orderOf[on] = ids;
      check(`${label}: 相手は${on ? 7 : 6}人`, ids.length === (on ? 7 : 6), ids.join(','));
      check(`${label}: ソラシドの札${on ? 'は7番目' : 'が無い'}`, on ? ids[6] === 'sorashido' : !ids.includes('sorashido'), ids.join(','));
      for (const [w, h] of SIZES) {
        await page.setViewportSize({ width: w, height: h }); await sleep(400);
        const wide = w > h;
        const want = on ? (wide ? 7 : 4) : (wide ? 6 : 3);
        const m = await page.evaluate(() => {
          const grid = document.querySelector('[data-card-foe-grid]');
          const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
          const vw = document.documentElement.clientWidth;
          const bad = [];
          document.querySelectorAll('[data-card-foe]').forEach((b) => {
            const r = b.getBoundingClientRect();
            const name = b.querySelector('[data-card-foe-name]'); const img = b.querySelector('img');
            const ir = img.getBoundingClientRect();
            if (r.left < -0.5 || r.right > vw + 0.5) bad.push(`${b.dataset.cardFoe}: 札が画面の外`);
            if (name.scrollWidth > name.clientWidth + 1) bad.push(`${b.dataset.cardFoe}: 名前が切れる`);
            if (ir.left < r.left - 0.5 || ir.right > r.right + 0.5 || ir.width < 20) bad.push(`${b.dataset.cardFoe}: 顔がはみ出す(幅 ${Math.round(ir.width)})`);
          });
          const rows = new Set([...document.querySelectorAll('[data-card-foe]')].map((b) => Math.round(b.getBoundingClientRect().top))).size;
          const fonts = [...document.querySelectorAll('[data-card-foe-name]')].map((n) => parseFloat(getComputedStyle(n).fontSize));
          return { cols, bad, rows, minFont: Math.min(...fonts) };
        });
        // CARD_SHOT_DIR を渡すと、大きさごとの写真を残す(目で見るとき)
        if (process.env.CARD_SHOT_DIR) await page.screenshot({ path: path.join(process.env.CARD_SHOT_DIR, `foe-${on ? 7 : 6}-${w}x${h}.png`) });
        check(`${label} ${w}×${h}: ${want}列`, m.cols === want, `${m.cols}列・${m.rows}段・名前の字はいちばん小さくて ${m.minFont.toFixed(1)}px`);
        // 7列の名前の字は、いまの6列(568×320 で 7.6px)と同じくらいまでにする(5.9px は読めない)
        check(`${label} ${w}×${h}: 名前の字が 7px 以上`, m.minFont >= 7, `${m.minFont.toFixed(1)}px`);
        check(`${label} ${w}×${h}: 名前と顔が札に収まり、札が画面の横幅に収まる`, !m.bad.length, m.bad.join('・'));
      }
      await ctx.close();
    }
    check('② 印が真でも、はじめの6人の並びは印が偽のときと同じ', JSON.stringify((orderOf.true || []).slice(0, 6)) === JSON.stringify(orderOf.false || []), `${(orderOf.false || []).join(',')} / ${(orderOf.true || []).join(',')}`);
    check('④ 実行時エラーが無い', !errors.length, errors.slice(0, 3).join(' / '));
  } catch (e) {
    if (lastPage && process.env.CARD_SHOT) await lastPage.screenshot({ path: process.env.CARD_SHOT }).catch(() => {});
    check('検査が最後まで動く', false, String(e && e.stack || e).split('\n').slice(0, 3).join(' '));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  if (failed) { console.log(`✗ 相手えらびの並び: ${failed} 件`); process.exit(1); }
  console.log('✓ 相手えらびの並び: すべて OK');
})();
