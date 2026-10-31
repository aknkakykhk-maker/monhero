// 「今」の動画: ゲームの本物の部品(CardPackOpen・CardKiraFx)をそのまま描いて録る
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = '/home/user/monhero';
const OUT = process.argv[2];
const PORT = 8971;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
(async () => {
  const { chromium } = require('playwright');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const prep = async (name) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: path.join(OUT, `raw-${name}`), size: { width: 390, height: 844 } } });
    const page = await ctx.newPage();
    await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(() => { localStorage.setItem('mh_onboarded', 'true'); });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof CardPackOpen === 'function' && typeof ReactDOM !== 'undefined' && typeof CARD_BATTLE_DATA !== 'undefined', null, { timeout: 90000 });
    return { ctx, page };
  };
  const mount = (page, kind) => page.evaluate((kind) => {
    const div = document.createElement('div');
    div.id = '__fx';
    div.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:#0f172a;color:#fff';
    document.body.appendChild(div);
    const root = ReactDOM.createRoot(div);
    if (kind === 'pack') {
      const cards = [
        { no: '001', slot: 'card', rarity: 'normal', point: 0, fresh: true }, { no: '013', slot: 'card', rarity: 'normal', point: 0, fresh: true },
        { no: 'F115', slot: 'card', rarity: 'normal', point: 0, fresh: true }, { no: '025', slot: 'card', rarity: 'normal', point: 0, fresh: true },
        { no: 'C-003S', slot: 'mon', rarity: 'kira', point: 0, fresh: true }, { no: 'C-001V', slot: 'mon', rarity: 'alt', point: 0, fresh: true },
      ];
      root.render(React.createElement(CardPackOpen, { db: CARD_BATTLE_DATA, result: { packId: 'p1', packs: [cards], dupPoint: 0, cost: 0, demo: true }, onDone: () => {} }));
    } else {
      // キラの光り方: ふつう・キラ・別絵キラの立ち絵を並べる(対戦の場・対戦開始の画面と同じ部品)
      const db = CARD_BATTLE_DATA;
      const cell = (no, kind) => {
        const m = cardMonsterOf(db, no);
        const img = React.createElement('img', { src: CARD_IMG(m.img), style: { width: 150, height: 210, objectFit: 'cover', borderRadius: 6 } });
        return React.createElement('div', { key: no, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 } },
          React.createElement('span', { className: 'relative flex justify-center', style: { isolation: 'isolate' } }, kind ? React.createElement(CardKiraFx, { kind }) : null, kind ? cardKiraWrap(kind, img) : img),
          React.createElement('b', { style: { fontSize: 13 } }, kind === 'rare' ? 'レアキラ(別絵キラ)' : kind === 'kira' ? 'キラ' : 'ふつう'));
      };
      root.render(React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, padding: 18, justifyItems: 'center' } },
        cell('C-003', null), cell('C-003S', 'kira'), cell('C-001V', 'rare'), cell('C-004V', 'rare')));
    }
  }, kind);
  // 今-パック
  { const { ctx, page } = await prep('pack'); await mount(page, 'pack'); await page.waitForTimeout(1200);
    await page.locator('#__fx [data-card-pack-tear]').click({ force: true }); await page.waitForTimeout(1800);
    await page.locator('#__fx [data-card-pack-flip-all]').click({ force: true }); await page.waitForTimeout(6500); await ctx.close(); }
  // 今-光り方
  { const { ctx, page } = await prep('shine'); await mount(page, 'shine'); await page.waitForTimeout(8000); await ctx.close(); }
  await browser.close(); server.close();
})();
