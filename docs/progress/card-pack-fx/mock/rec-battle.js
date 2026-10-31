// バトル中の立ち絵の光り方を録る: node rec-battle.js <配信のポート> <出力の名前> [CPU遅く(倍)]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const [port, name, thr] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const dir = path.join(__dirname, `raw-${name}`); fs.rmSync(dir, { recursive: true, force: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, recordVideo: name === 'none' ? undefined : { dir, size: { width: 390, height: 844 } } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(`http://localhost:${port}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof CardBattleBoard === 'function' && typeof CARD_BATTLE_DATA === 'object', null, { timeout: 90000 });
  await page.evaluate(() => {
    const db = CARD_BATTLE_DATA;
    const pol = cardAiPolicy('kyuko', 'normal');
    const d0 = cardAiBuildDeck(db, 'momosuke', 'master', cardAiSeededRand('w0:1')); d0.monsters = ['C-001V', 'C-006S', 'C-010'];
    const d1 = cardAiBuildDeck(db, 'kiki', 'master', cardAiSeededRand('w1:1')); d1.monsters = ['C-029S', 'C-008V', 'C-021S'];
    let st = cardCreateGame(db, { decks: [d0, d1], names: ['ビー', 'エー'], seed: 11, first: 0 });
    let seed = 123; const rand = () => { const n = cardRngNext(seed); seed = n.s; return n.v; };
    const W = window.__watch = { handler: null };
    W.push = () => {
      const act = cardAiChooseAction(db, st, pol, rand);
      const n = act && cardApplyAction(db, st, act);
      const fb = !n && (st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : st.phase === 'guts' ? { type: 'guts', hand: [] } : null);
      const n2 = n || (fb && cardApplyAction(db, st, fb));
      if (!n2) return false; st = n2; if (W.handler) W.handler.onState(st, false); return st.winner === null;
    };
    const game = { key: 'rec', st, watch: { top: { name: 'エー' }, bottom: { name: 'ビー' }, attach: (h) => { W.handler = h; return () => { if (W.handler === h) W.handler = null; }; } } };
    const host = document.createElement('div'); host.id = 'host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:#120d2a';
    document.body.appendChild(host);
    ReactDOM.createRoot(host).render(React.createElement(CardBattleBoard, { db, game, onFinish: () => {}, meProfile: { name: 'ビー' } }));
  });
  await page.waitForSelector('#host [data-card-head]', { timeout: 10000 });
  // 並べる所を早送り(場に3体ずつ出るまで)
  for (let i = 0; i < 30; i++) { const n = await page.locator('#host [data-card-art]').count(); if (n >= 6) break; await page.evaluate(() => window.__watch.push()); await page.waitForTimeout(150); }
  if (thr) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(thr) }); }
  await page.waitForTimeout(2500);
  let frames = 0;
  const fpsStart = () => page.evaluate(() => { window.__fr = 0; const t = () => { window.__fr++; if (!window.__stopFr) requestAnimationFrame(t); }; requestAnimationFrame(t); window.__t0 = performance.now(); });
  await fpsStart();
  for (let i = 0; i < 20; i++) { const go = await page.evaluate(() => window.__watch.push()); if (!go) break; await page.waitForTimeout(900); }
  const fps = await page.evaluate(() => { window.__stopFr = true; return window.__fr / ((performance.now() - window.__t0) / 1000); });
  const info = await page.evaluate(() => ({ sil: document.querySelectorAll('#host [data-card-kira-sil]').length, fx: document.querySelectorAll('#host [data-card-kira-fx]').length }));
  if (name === 'none') await page.screenshot({ path: path.join(__dirname, `still-${port}.png`) });
  console.log(JSON.stringify({ fps: +fps.toFixed(1), ...info, errors: errors.slice(0, 2) }));
  await ctx.close(); await b.close();
})();
