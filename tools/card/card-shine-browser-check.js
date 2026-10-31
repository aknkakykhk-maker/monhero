#!/usr/bin/env node
// MFバトルカード: カードの絵のキラ・レアキラ・銀の光(84 の CardShine。2026-10-31 社長「光り方は案B」「ブリーダー・場のカードに銀の光」)を、
// 実際のブラウザの手持ちの一覧(図鑑 CardDex)で確かめる(2026-10-31 ルールくん)
//
//   node tools/card/card-shine-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、一覧の写真を残す
//
//   ① 光るのは キラ(ふちの色・星)・別絵キラ(オーロラ・光の帯・粒)・ブリーダーのカード 33枚(銀の光の帯)だけ。ほかの技カードは光らない
//   ② まだ持っていないカードは光らない
//   ③ 重さ: スマホくらいに遅くした(CPU 4倍遅く)ブラウザで、全部持っている一覧を出しても、光らせないときと比べて描ける回数が大きく落ちない
//   ④ 動きを減らす設定では、動く光の層を出さない(ふちの光だけ)
//   ⑤ 実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8963;
const SHOT = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const open = async (reduced) => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof CardDex === 'function' && typeof CardShine === 'function' && typeof ReactDOM !== 'undefined', null, { timeout: 90000 });
      return page;
    };
    // 図鑑を、全部持っている(have)/何も持っていない(none)で出す。tab … 弾の番号
    const mount = (page, have, mode = 'pack') => page.evaluate(([have, mode]) => {
      document.getElementById('__dex')?.remove();
      const div = document.createElement('div');
      div.id = '__dex';
      div.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:#0f172a;color:#fff';
      document.body.appendChild(div);
      const db = CARD_BATTLE_DATA;
      const all = [...Object.keys(db.cards), ...Object.keys(db.monsters)];
      const col = have ? Object.fromEntries(all.map((no) => [no, 1])) : {};
      ReactDOM.createRoot(div).render(React.createElement(CardDex, { db, collection: col, onBack: () => {} }));
    }, [have, mode]);
    const T = (page, sel) => page.locator(`#__dex ${sel}`);
    // 描ける回数(3秒で何回 requestAnimationFrame が回ったか)
    const fps = (page) => page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else r(n / 3); }; requestAnimationFrame(tick); }));

    // ① ② 光るカードの数え方(表から)
    const page = await open(false);
    const counts = await page.evaluate(() => {
      const db = CARD_BATTLE_DATA;
      const all = [...Object.keys(db.cards), ...Object.keys(db.monsters)];
      const k = { silver: 0, kira: 0, rare: 0, none: 0 };
      all.forEach((no) => { k[cardShineOf(db, no) || 'none'] += 1; });
      return k;
    });
    check('① 光るのは ブリーダーのカード33枚(銀)・キラ・別絵キラだけ(技カードは光らない)', counts.silver === 33 && counts.kira > 0 && counts.rare > 0, JSON.stringify(counts));
    check('① 技カード(右爪 001・ガリの金の枠 013・ゴーレムの銀の枠 025)は光らない', await page.evaluate(() => ['001', '013', '025'].every((no) => cardShineOf(CARD_BATTLE_DATA, no) === null)));
    await mount(page, false);
    await T(page, '[data-card-dex-tile]').first().waitFor({ timeout: 15000 });
    check('② まだ持っていないカードは光らない', (await T(page, '[data-card-shine]').count()) === 0);
    await mount(page, true);
    await T(page, '[data-card-dex-tile]').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
    const shown = await T(page, '[data-card-shine]').count();
    const kinds = await T(page, '[data-card-shine]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-card-shine')))].sort());
    check('① 全部持っている一覧では、キラ・別絵キラ・銀の光が出る', shown > 0 && ['kira', 'rare'].every((k) => kinds.includes(k)), `${shown}枚 ${kinds.join(',')}`);
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, 'dex.png') }); }
    // ③ 重さ
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const withShine = await fps(page);
    await page.addStyleTag({ content: '.mh-shine-l { display: none !important; }' });
    await page.waitForTimeout(300);
    const without = await fps(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    check(`③ スマホくらいに遅くしても、光らせないときの8割以上の回数で描ける(光あり ${withShine.toFixed(0)} / なし ${without.toFixed(0)} 回/秒)`, withShine >= without * 0.8, `${withShine.toFixed(1)} / ${without.toFixed(1)}`);
    // いちばん重いとき: 光るカードだけ(キラ・別絵キラ・銀の全部)を売り場の並べ方で1画面に並べる
    await page.evaluate(() => {
      document.getElementById('__dex')?.remove();
      const div = document.createElement('div');
      div.id = '__dex';
      div.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:auto;background:#0f172a;color:#fff';
      document.body.appendChild(div);
      const db = CARD_BATTLE_DATA;
      const rows = [...Object.keys(db.cards), ...Object.keys(db.monsters)].filter((no) => cardShineOf(db, no)).map((no) => ({ no }));
      ReactDOM.createRoot(div).render(React.createElement(CardShopGrid, { db, rows, collection: false, onTap: () => {} }));
    });
    await T(page, '[data-card-shine]').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
    const many = await T(page, '[data-card-shine]').count();
    if (SHOT) await page.screenshot({ path: path.join(SHOT, 'many.png') });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const manyOn = await fps(page);
    await page.addStyleTag({ content: '.mh-shine-l { display: none !important; }' });
    await page.waitForTimeout(300);
    const manyOff = await fps(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    check(`③ 光るカード ${many}枚を1画面に並べても、光らせないときの8割以上(光あり ${manyOn.toFixed(0)} / なし ${manyOff.toFixed(0)} 回/秒)`, many >= 60 && manyOn >= manyOff * 0.8, `${manyOn.toFixed(1)} / ${manyOff.toFixed(1)}`);
    await page.close();
    // ④ 動きを減らす設定
    const page2 = await open(true);
    await mount(page2, true);
    await T(page2, '[data-card-shine="rare"]').first().waitFor({ timeout: 15000 });
    const reduced = await page2.evaluate(() => {
      const el = document.querySelector('#__dex [data-card-shine="rare"]');
      const vis = (sel) => { const x = el.querySelector(sel); return x ? getComputedStyle(x).display !== 'none' : false; };
      return { aurora: vis('.mh-shine-aurora'), mote: vis('.mh-shine-mote'), rim: vis('.mh-shine-rare-rim') };
    });
    check('④ 動きを減らす設定では、オーロラ・粒を出さず、ふちの光だけ', !reduced.aurora && !reduced.mote && reduced.rim, JSON.stringify(reduced));
    await page2.close();
    check('⑤ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査が最後まで回る', false, String(e && e.message || e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  if (failed) { console.log(`NG: ${failed} 件`); process.exit(1); }
  console.log('OK: カードの光り方');
})();
