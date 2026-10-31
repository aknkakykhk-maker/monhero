// キラ・レアキラの立ち絵の光の動画(観戦の形で盤を出す。コンピューターは動かない)
// 使い方: node rec.js <作業場所> <出力の動画(.webm)> [秒]
const http = require('http'), path = require('path'), fs = require('fs');
const [ROOT, OUT, SEC] = [process.argv[2], process.argv[3], Number(process.argv[4] || 7)];
const PORT = 9061;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const { chromium } = require('playwright');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const dir = path.join(path.dirname(OUT), '_rec'); fs.rmSync(dir, { recursive: true, force: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, recordVideo: { dir, size: { width: 390, height: 844 } } });
  const page = await ctx.newPage();
  await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof CardBattleBoard === 'function' && typeof ReactDOM !== 'undefined', null, { timeout: 90000 });
  await page.evaluate(() => {
    const div = document.createElement('div');
    div.id = '__b'; div.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:#0f172a';
    document.body.appendChild(div);
    const db = CARD_BATTLE_DATA;
    const cards = Object.keys(db.cards).slice(0, 30);
    const st = cardCreateGame(db, { decks: [{ monsters: ['C-067S', 'C-009V', 'C-067'], cards }, { monsters: ['C-067V', 'C-003V', 'C-007S'], cards }], seed: 7, first: 0 });
    const game = { key: 'kira-rec', st, watch: { top: { name: 'エー', icon: '🙂' }, bottom: { name: 'ビー' }, attach: () => () => {} } };
    ReactDOM.createRoot(div).render(React.createElement(CardBattleBoard, { db, game, onFinish: () => {}, meProfile: { name: 'ビー' } }));
  });
  await page.waitForTimeout(1500);
  // 立ち絵が読めるまで待つ
  await page.waitForFunction(() => [...document.querySelectorAll('#__b img')].every((im) => im.complete), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(SEC * 1000);
  await page.screenshot({ path: OUT.replace(/\.webm$/, '.png') });
  const v = page.video();
  await ctx.close();
  fs.copyFileSync(await v.path(), OUT);
  await b.close(); server.close();
  console.log('ok', OUT);
})();
