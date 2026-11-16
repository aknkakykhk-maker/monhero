#!/usr/bin/env node
// モンヒロサクセスの総合力ランキング画面の止め絵と、safe-area の効きを確かめる(2026-11-16 正式化)。
//   node tools/success/monsuc-rank-shot.js              … 止め絵3枚(全体・血統別・safe-area模擬)を撮って、測った値を出す
//   SHOT_DIR=<フォルダ> node tools/success/monsuc-rank-shot.js … 止め絵の置き場所(既定は OS の一時フォルダ)
// ランキングの読み取り(Supabase)は空で返し、「まだだれも載っていません」の空の状態で見る。
// safe-area 模擬: --mh-sa-top を 47px に差し替えて、上の「戻る」ボタンが時計帯ぶん下がるかを測る
//   (fixed inset-0 の画面は body の余白が効かないので、画面の根で var(--mh-sa-top) を足すのが決まり)。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = process.env.SHOT_DIR || path.join(os.tmpdir(), 'monsuc-rank-shots');
const PORT = Number(process.env.RANK_SHOT_PORT) || 19891;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const { chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'));
const { quietBootSeed, updateNoticeSeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => check('ページのエラーが出ない', false, String(e && e.message || e)));
  // ランキングの読み取りは空で返す(空の状態の文の並びを見るため)
  await page.route('**/rest/v1/monsuc_rank_*', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' }));
  await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
  await page.addInitScript(() => { try { localStorage.setItem('mh_monsuc_beta_v1', JSON.stringify({ v: 1, seen: { open: 1, firstend: 1, prep: 1, scn: 1 } })); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => typeof MonheroSuccessScreen === 'function' && typeof msxLoad === 'function', undefined, { timeout: 90000 });
  await page.evaluate(() => {
    const el = Object.assign(document.createElement('div'), { id: 'msx-shot' });
    document.body.appendChild(el);
    window.__msxRoot = ReactDOM.createRoot(el);
    window.__msxRoot.render(React.createElement(MonheroSuccessScreen, { onClose() {}, callNameOf: () => 'けんささん', bondLvOf: () => 4, debug: false }));
  });
  await page.waitForSelector('[data-msx-view="home"]', { timeout: 30000 });
  const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /ランキング/.test(x.innerText || '')); if (b) b.click(); return !!b; });
  check('ホームにランキングのボタンがある', clicked);
  await page.waitForFunction(() => document.body.innerText.includes('総合力ランキング'), undefined, { timeout: 15000 });
  await page.waitForTimeout(1200);
  const empty = await page.evaluate(() => document.body.innerText.includes('まだだれも載っていません'));
  check('空の状態の文が出る', empty);
  await page.screenshot({ path: path.join(OUT, 'rank-all.png') });
  // 血統別タブ
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '血統別'); if (b) b.click(); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'rank-lineage.png') });
  // safe-area 模擬: --mh-sa-top を 47px にして、戻るボタンの上が空くか測る
  const backTop = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('戻る')); const r = b.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  const before = await backTop();
  await page.evaluate(() => { document.documentElement.style.setProperty('--mh-sa-top', '47px'); document.documentElement.style.setProperty('--mh-sa-bottom', '34px'); });
  await page.waitForTimeout(400);
  const after = await backTop();
  console.log(`戻るボタンの上: safe-area 模擬の前 ${JSON.stringify(before)} → 後 ${JSON.stringify(after)}`);
  check('safe-area 模擬で戻るボタンが時計帯(47px)を避ける', after.top >= 47 && after.top - before.top >= 40, `前 ${before.top}px → 後 ${after.top}px`);
  await page.screenshot({ path: path.join(OUT, 'rank-safearea.png') });
  await browser.close(); server.close();
  console.log(`止め絵: ${OUT}/rank-all.png, rank-lineage.png, rank-safearea.png`);
  console.log(failed ? `NG ${failed}件` : 'OK: すべて');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
