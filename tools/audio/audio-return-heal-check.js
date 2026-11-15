// ほかのアプリへ切り替えて戻ったら、音が消えたまま戻らない(2026-11-15 r1115-205 社長・本番の iPhone)を確かめる。
//
//   node tools/audio/audio-return-heal-check.js
//
// iOS は裏から戻ると、音の出口(AudioContext)が interrupted のまま起きない、または running なのに時計が止まって無音になり、
// resume() では戻らないことがある。前は作り直すのが設定の「音を鳴らし直す」だけで、自動では直らなかった。ブラウザの中でその状態をまねて、
//   ・戻ったあと時計が止まっていたら、自分で作り直して BGM を鳴らし直す
//   ・起こせない(interrupted のまま)ときは、次のタップで作り直して鳴らし直す
//   ・演奏中の曲があるあいだは作り直さない(譜面とずれる)
// を見る。外へはつながない(ローカルのサーバーだけ)
const http = require('http');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
let playwright;
try { playwright = require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch (_) {
  try { playwright = require('playwright'); } catch (e) { console.log('SKIP: playwright が無いので測れません'); process.exit(0); }
}
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0, () => resolve(server));
});
// 出口の時計を止める・interrupted のまま起きない、をまねる仕掛け(止めた出口だけに効く。作り直した新しい出口はふつうに動く)
const SPOIL = () => {
  const P = (window.AudioContext || window.webkitAudioContext).prototype;
  const find = (k) => { for (let o = P; o; o = Object.getPrototypeOf(o)) { const d = Object.getOwnPropertyDescriptor(o, k); if (d) return d; } return null; };
  const ct = find('currentTime'); const stt = find('state'); const res = P.resume;
  window.__spoiled = new WeakMap(); window.__ctxs = [];
  const Orig = window.AudioContext;
  window.AudioContext = function (...a) { const c = new Orig(...a); window.__ctxs.push(c); return c; };
  window.AudioContext.prototype = Orig.prototype;
  Object.defineProperty(P, 'currentTime', { configurable: true, get() { const m = window.__spoiled.get(this); return m && m.at != null ? m.at : ct.get.call(this); } });
  Object.defineProperty(P, 'state', { configurable: true, get() { const m = window.__spoiled.get(this); return m && m.state ? m.state : stt.get.call(this); } });
  P.resume = function () { const m = window.__spoiled.get(this); if (m && m.state === 'interrupted') return Promise.reject(new Error('interrupted')); return res.call(this); };
  // 裏へ回す・表へ戻す(本物と同じく visibilitychange を飛ばす)
  let vis = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => vis });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => vis === 'hidden' });
  window.__setVis = (v) => { vis = v; document.dispatchEvent(new Event('visibilitychange')); };
  window.__spoil = (kind) => { const c = window.__ctxs[window.__ctxs.length - 1]; window.__spoiled.set(c, kind === 'stall' ? { at: c.currentTime } : { state: 'interrupted' }); };
};
(async () => {
  const server = await serve();
  const PORT = server.address().port;
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.addInitScript(() => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'うみ'); put('mh_intro_done', true); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true);
      put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true);
    });
    await page.addInitScript(require('../boot/quiet-boot-seed').eventStorySeed());
    await page.addInitScript(SPOIL);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body && document.body.innerText.includes('TAP TO START'), null, { timeout: 60000 });
    await page.getByText('TAP TO START').click();
    const diag = () => page.evaluate(() => { const d = window.__mhAudioDiagnose(); return { ctx: d.ctxState, rebuilds: d.rebuilds, playing: (d.playing || []).length, n: window.__ctxs.length }; });
    const playingNow = async (ms) => { for (let t = 0; t < ms; t += 250) { const d = await diag(); if (d.playing > 0 && d.ctx === 'running') return d; await page.waitForTimeout(250); } return diag(); };
    const d0 = await playingNow(20000);
    check('起動して、BGM が鳴っている', d0.playing > 0 && d0.ctx === 'running', JSON.stringify(d0));
    // ---- ① 裏へ回して戻ると、時計が止まっていた(running なのに無音) ----
    await page.evaluate(() => { window.__setVis('hidden'); window.__spoil('stall'); });
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__setVis('visible'));
    await page.waitForTimeout(2500);
    const d1 = await playingNow(8000);
    check('戻ったあと時計が止まっていたら、タップしなくても出口を作り直して BGM を鳴らし直す', d1.rebuilds > d0.rebuilds && d1.playing > 0 && d1.ctx === 'running', JSON.stringify(d1));
    // ---- ② 裏へ回して戻ると、interrupted のまま起きない ----
    await page.evaluate(() => { window.__setVis('hidden'); window.__spoil('interrupted'); });
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__setVis('visible'));
    await page.waitForTimeout(2000);
    const d2a = await diag();
    // ボタンを押さないタップ(画面を移らない)。タップの合図は document で受けている
    await page.evaluate(() => document.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    const d2 = await playingNow(8000);
    check('起こせない(interrupted のまま)ときは、次のタップで作り直して BGM を鳴らし直す', d2.rebuilds > d2a.rebuilds && d2.playing > 0 && d2.ctx === 'running', JSON.stringify({ before: d2a, after: d2 }));
    // ---- ③ ふつうに戻ったとき(どこも壊れていない)は、作り直さない ----
    const d3a = await diag();
    await page.evaluate(() => window.__setVis('hidden'));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__setVis('visible'));
    await page.waitForTimeout(2500);
    const d3 = await playingNow(5000);
    check('どこも壊れていなければ、作り直さずに BGM を鳴らし直す', d3.rebuilds === d3a.rebuilds && d3.playing > 0, JSON.stringify(d3));
    check('画面のエラーが出ていない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    console.log('NG: 途中で止まった — ' + (e && e.message ? e.message.split('\n')[0] : e)); failed++;
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
