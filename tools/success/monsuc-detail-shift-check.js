// モンスターの詳細で、覚えた技と覚えていない技を押し分けても、窓・技の表・閉じるボタンの位置が動かないかを本物のブラウザで確かめる(2026-11-15 社長 r1115-150)
//   node tools/success/monsuc-detail-shift-check.js            … 幅 390・320 で確かめる
//   SHOT_DIR=<出力先> node tools/success/monsuc-detail-shift-check.js … 押し分けた2枚の止め絵も撮る(幅ごとに learned/notlearned)
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
let chromium;
try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));
const PORT = Number(process.env.SHOT_PORT) || 8978;
const SHOT_DIR = process.env.SHOT_DIR || '';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml' };
(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
  for (const W of [390, 320]) {
    const page = await browser.newPage({ viewport: { width: W, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
    await page.addInitScript(() => { try { localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Snegurochka'])); localStorage.setItem('mh_monsuc_beta_v1', JSON.stringify({ v: 1, seen: { open: 1, firstend: 1, prep: 1, turn: 1, train: 1, result: 1, rest: 1, shugyo: 1, cup: 1, match: 1, rematch: 1, event: 1, awake: 1, retire: 1 } })); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => typeof MonheroSuccessScreen === 'function' && typeof msxLoad === 'function', undefined, { timeout: 90000 });
    const open = async () => {
      await page.evaluate(() => { if (window.__msxRoot) { window.__msxRoot.unmount(); window.__msxRoot = null; } const el = document.getElementById('msx-shot') || Object.assign(document.createElement('div'), { id: 'msx-shot' }); document.body.appendChild(el); window.__msxRoot = ReactDOM.createRoot(el); window.__msxRoot.render(React.createElement(MonheroSuccessScreen, { onClose() {}, callNameOf: () => 'けんささん', bondLvOf: () => 4, debug: false })); });
      await page.waitForSelector('[data-msx-view="home"]', { timeout: 30000 });
      const go = async (fn, arg) => { const ok = await page.evaluate(fn, arg); await page.waitForTimeout(350); return ok; };
      await go(() => { const b = [...document.querySelectorAll('.msx button')].find((x) => /新しく育成を(?:始|はじ)める/.test(x.innerText)); if (b) b.click(); return !!b; });
      await go(() => { const b = [...document.querySelectorAll('.msx button')].find((x) => /▶$/.test(x.innerText)); if (b) b.click(); return !!b; });
      await go(() => { const d = document.querySelector('[data-msx-pick-mon="Snegurochka"]'); if (d) d.click(); return !!d; });
      return go(() => { const d = document.querySelector('[data-msx-detail-open]'); if (d) d.click(); return !!d; });
    };
    check(`${W}: 育てる子の詳細が開く`, await open());
    const rectOf = () => page.evaluate(() => { const q = (s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height)]; };
      return { sheet: q('[data-msx-detail-close]') && q('.msx-md'), grid: q('.msx-md-tg'), td: q('.msx-md-td'), close: q('[data-msx-detail-close]') }; });
    const clickKind = (got) => page.evaluate((g) => { const c = document.querySelector(`.msx-md-tg .tc${g ? '.got' : '.tg-not'}`); if (c) c.click(); return !!c; }, got);
    const okL = await clickKind(true); await page.waitForTimeout(350); const a = await rectOf();
    if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `${W}-learned.png`) }); }
    const okN = await clickKind(false); await page.waitForTimeout(350); const b = await rectOf();
    if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `${W}-notlearned.png`) });
    check(`${W}: 覚えた技・覚えていない技の両方を押せた`, okL && okN);
    const same = (k) => a[k] && b[k] && a[k][0] === b[k][0] && a[k][1] === b[k][1];
    check(`${W}: 押し分けても窓・技の表・右の欄・閉じるボタンの位置と高さが変わらない`, ['sheet', 'grid', 'td', 'close'].every(same), JSON.stringify({ a, b }));
    // r1115-156①: 技の欄の項目名は1行に収まる(「クリティカル/率」と折れない)・技の名前は言葉の途中で折らない設定
    const words = await page.evaluate(() => { const bs = [...document.querySelectorAll('.msx-md-td .msx-md-kv>b')]; const tn = document.querySelector('.msx-md-td .tn');
      return { bad: bs.filter((b) => b.getClientRects().length > 1 || b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().height > 18).map((b) => b.textContent), n: bs.length, tn: tn ? getComputedStyle(tn).wordBreak : '' }; });
    check(`${W}: 技の欄の項目名が1行に収まり、技の名前は言葉の途中で折らない`, words.n >= 5 && !words.bad.length && words.tn === 'keep-all', JSON.stringify(words));
    // r1115-156②: 使ったあとに間合いが動く技に「使ったあと …」の行(ドルフィンブロー 近→零 = 零へ移る・ホワイトストーム 近→遠 = 相手を遠へ飛ばす)
    const mv = {};
    for (const id of ['sk-0484', 'sk-0488']) { await page.evaluate((x) => { const c = document.querySelector(`.msx-md-tg [data-msx-tech="${x}"]`); if (c) c.click(); }, id); await page.waitForTimeout(250);
      mv[id] = await page.evaluate(() => { const el = document.querySelector('[data-msx-tech-move]'); return el ? el.textContent : ''; });
      if (SHOT_DIR && id === 'sk-0488') await page.screenshot({ path: path.join(SHOT_DIR, `${W}-move.png`) }); }
    check(`${W}: 間合いが動く技に「使ったあと」の行が出る`, /使ったあと零へ\u200b?移る/.test(mv['sk-0484'] || '') && /相手を\u200b?遠へ\u200b?飛ばす/.test(mv['sk-0488'] || ''), JSON.stringify(mv));
    await page.close();
  }
    check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  if (failed) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }
  console.log('\nすべてOK');
})();
