// バトルカードの見た目の点検: 画面をめぐって写真を撮り、はみ出し・小さい字・絵の欠けを数える
// node audit.js <worktree> <出力フォルダ> [画面の大きさの名前,...]
const path = require('path'), fs = require('fs'), http = require('http');
const W = path.resolve(process.argv[2]); const OUT = path.resolve(process.argv[3]);
const ONLY = (process.argv[4] || '').split(',').filter(Boolean);
const playwright = require(path.join(W, 'tools/node_modules/playwright'));
const { quietBootSeed } = require(path.join(W, 'tools/boot/quiet-boot-seed'));
const PORT = 8972 + Math.floor(Math.random() * 20);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(W, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(PORT);
const SIZES = { v320: [320, 640], v390: [390, 844], v430: [430, 932], short: [390, 600], land: [844, 390] };
const report = {};
const scan = (page) => page.evaluate(() => {
  const vw = innerWidth, vh = innerHeight;
  const root = document.getElementById('__cb');
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  const txt = (e) => (e.innerText || e.alt || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  const out = { clip: [], wide: [], tiny: [], img: [] };
  for (const e of root.querySelectorAll('*')) {
    if (!vis(e) || e.closest('[aria-hidden="true"]') || e.closest('.mhms-mark')) continue;
    const s = getComputedStyle(e);
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own) {
      const fs = parseFloat(s.fontSize);
      if (fs < 10) out.tiny.push(`${fs.toFixed(1)}px「${txt(e)}」`);
      if ((s.overflow !== 'visible' || s.textOverflow === 'ellipsis' || s.overflowX !== 'visible') && e.scrollWidth > e.clientWidth + 2) out.clip.push(`「${txt(e)}」${e.scrollWidth}>${e.clientWidth}`);
      const r = e.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) out.wide.push(`「${txt(e)}」${Math.round(r.left)}〜${Math.round(r.right)}`);
    }
    if (e.tagName === 'IMG' && e.complete && e.naturalWidth === 0) out.img.push(e.getAttribute('src'));
  }
  for (const k of Object.keys(out)) out[k] = [...new Set(out[k])].slice(0, 12);
  return out;
});
(async () => {
  const browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  for (const [sz, [w, h]] of Object.entries(SIZES)) {
    if (ONLY.length && !ONLY.includes(sz)) continue;
    const dir = path.join(OUT, sz); fs.mkdirSync(dir, { recursive: true });
    const rep = report[sz] = { errors: [], steps: {} };
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: false });
    await ctx.route(/supabase\.co\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await ctx.addInitScript(() => {
      const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
      s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
      s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
    });
    await ctx.addInitScript(quietBootSeed());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => rep.errors.push(String(e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') rep.errors.push('console: ' + m.text().slice(0, 160)); });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof CardBattleScreen === 'function' && window.ReactDOM, null, { timeout: 120000 });
    const mount = async () => page.evaluate(() => {
      if (window.__cbRoot) { window.__cbRoot.unmount(); document.getElementById('__cb').remove(); }
      const div = document.createElement('div'); div.id = '__cb';
      div.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:#0f172a;color:#fff';
      document.body.appendChild(div);
      const Wrap = () => { const [screen, setScreen] = React.useState('CARD_TOP'); return React.createElement(CardBattleScreen, { screen, onNavigate: setScreen, onExit: () => {}, debug: true, onBgm: () => {} }); };
      window.__cbRoot = ReactDOM.createRoot(div); window.__cbRoot.render(React.createElement(Wrap));
    });
    const T = (sel) => page.locator(`#__cb ${sel}`).first();
    const B = (name) => page.locator('#__cb').getByRole('button', { name }).first();
    const shot = async (name) => {
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(dir, `${name}.png`), style: 'div[style*="2147483647"] > span { display:none !important; }' });
      rep.steps[name] = await scan(page);
    };
    const step = async (name, fn) => { try { await fn(); } catch (e) { rep.steps[name] = { fail: String(e).split('\n')[0].slice(0, 160) }; await page.screenshot({ path: path.join(dir, `${name}-しっぱい.png`) }).catch(() => {}); } };
    const top = async () => { await mount(); await T('[data-card-top]').waitFor({ timeout: 30000 }); };
    await top();
    if (await T('[data-card-top="starter"]').count()) {
      await shot('00-starter');
      await T('[data-card-kit="speed"]').click();
      await B(/にする$/).click();
      await require(path.join(W, 'tools/card/lib/starter-open-pass.js'))(page);
      await T('[data-card-quit]').waitFor({ timeout: 20000 }); await T('[data-card-quit]').click();
      await page.locator('#__cb').getByRole('button', { name: /^飛ばす$/ }).last().click();
      await T('[data-card-top="result"]').waitFor({ timeout: 15000 });
      await page.locator('[data-player-rank-up-fx]').first().click({ force: true, timeout: 1500 }).catch(() => {});
      await B(/トップへ/).click();
    }
    await step('01-top', async () => { await T('[data-card-top="top"]').waitFor({ timeout: 20000 }); await shot('01-top'); });
    await step('02-mode', async () => { await T('[data-card-cpu]').click(); await T('[data-card-top="mode"]').waitFor(); await shot('02-mode'); });
    for (const who of ['kyuko', 'sorashido']) {
      await step(`03-foe-${who}`, async () => {
        await top(); await T('[data-card-cpu]').click(); await T('[data-card-mode-assistant]').click();
        await T('[data-card-top="foe"]').waitFor();
        await T(`[data-card-foe="${who}"]`).click(); await shot(`03-foe-${who}`);
      });
      await step(`04-vs-${who}`, async () => {
        await T('[data-card-start]').click();
        for (let i = 0; i < 40 && !(await T('[data-card-vs]').count()); i++) {
          const go = B(/^対戦へ$/);
          if (await go.count() && await go.isEnabled().catch(() => false)) { if (i === 0 || !rep.steps['09-deckpick']) await shot('09-deckpick').catch(() => {}); await go.click().catch(() => {}); }
          await page.waitForTimeout(500);
        }
        await T('[data-card-vs]').waitFor({ timeout: 30000 });
        await page.waitForFunction(() => !document.querySelector('#__cb [data-card-vs-loading]'), null, { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(1200); await shot(`04-vs-${who}`);
      });
      await step(`05-board-${who}`, async () => {
        for (let i = 0; i < 20 && !(await T('[data-card-hand-card]').count()); i++) { if (await T('[data-card-vs]').count()) await T('[data-card-vs]').click().catch(() => {}); await page.waitForTimeout(700); }
        await T('[data-card-hand-card="0"]').waitFor({ timeout: 20000 });
        await page.waitForTimeout(2500); await shot(`05-board-${who}`);
      });
      if (who === 'kyuko') {
        await step('06-detail-hand', async () => {
          const box = await T('[data-card-hand-card="0"]').boundingBox();
          await page.mouse.move(box.x + box.width / 2, box.y + Math.min(30, box.height / 2)); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
          await T('[data-card-detail]').waitFor({ timeout: 3000 }); await shot('06-detail-hand');
          await T('[data-card-detail]').click({ position: { x: 4, y: 4 } }); await page.waitForTimeout(300);
        });
        await step('07-detail-foe-mon', async () => {
          const box = await T('[data-card-mon^="1-"]').boundingBox();
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
          await T('[data-card-detail]').waitFor({ timeout: 3000 }); await shot('07-detail-foe-mon');
          await T('[data-card-detail]').click({ position: { x: 4, y: 4 } }); await page.waitForTimeout(300);
        });
        await step('08-result', async () => {
          await T('[data-card-quit]').click();
          await page.locator('#__cb').getByRole('button', { name: /^飛ばす$/ }).last().click();
          await T('[data-card-top="result"]').waitFor({ timeout: 15000 });
          await page.locator('[data-player-rank-up-fx]').first().click({ force: true, timeout: 1500 }).catch(() => {});
          await shot('08-result');
        });
      }
    }
    const simple = [['10-dex', '[data-card-dex-open]'], ['11-decks', '[data-card-decks]'], ['13-ranking', '[data-card-ranking-open]'], ['14-record', '[data-card-record-open]'], ['15-rules', '[data-card-rules-open]'], ['16-options', '[data-card-options-open]'], ['17-pack-open-demo', '[data-card-pack-open-demo]'], ['18-pack-art-demo', '[data-card-pack-art-demo]'], ];
    for (const [name, sel] of simple) {
      await step(name, async () => { await top(); await T(sel).scrollIntoViewIfNeeded(); await T(sel).click(); await page.waitForTimeout(1200); await shot(name); });
    }
    await step('19-result-demo', async () => {
      await top(); await T('[data-card-result-demo]').scrollIntoViewIfNeeded(); await T('[data-card-result-demo]').click();
      for (let i = 0; i < 12; i++) { await page.waitForTimeout(900); const fx = page.locator('[data-player-rank-up-fx]').first(); if (await fx.count()) await fx.click({ force: true }).catch(() => {}); else if (await page.getByText('押すと先へ').count()) await page.getByText('押すと先へ').first().click({ force: true }).catch(() => {}); else break; }
      await page.waitForTimeout(1500); await shot('19-result-demo');
    });
    await step('20-deck-edit', async () => { await top(); await T('[data-card-decks]').click(); await B(/^組む$/).click(); await page.waitForTimeout(1500); await shot('20-deck-edit'); });
    await step('21-dex-detail', async () => {
      await top(); await T('[data-card-dex-open]').click(); await page.waitForTimeout(800);
      const c = page.locator('#__cb').getByText('No.C-006', { exact: true }).first(); await c.click(); await page.waitForTimeout(900); await shot('21-dex-detail');
    });
    await step('22-dex-kira-detail', async () => {
      await page.keyboard.press('Escape').catch(() => {}); await top(); await T('[data-card-dex-open]').click(); await page.waitForTimeout(800);
      const c = page.locator('#__cb').getByText('No.C-008V', { exact: true }).first(); await c.click(); await page.waitForTimeout(900); await shot('22-dex-kira-detail');
    });
    await step('23-dex-kind', async () => { await top(); await T('[data-card-dex-open]').click(); await B(/^種類別$/).click(); await page.waitForTimeout(900); await shot('23-dex-kind'); });
    await ctx.close();
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
    console.log('済', sz);
  }
  await browser.close(); server.close();
})().catch((e) => { console.error(e); fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1)); process.exit(1); });
