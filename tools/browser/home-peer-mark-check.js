#!/usr/bin/env node
// HOME の「助手どうしの会話」(台帳 r1126-073 直し1・追記3)を、4つの大きさの本物の画面で確かめる。
//   ① 会話が始まっても窓は勝手に開かず、助手の顔の丸に💬の印が付く
//   ② 顔を押すと会話の窓が開く
//   ③ 窓は押した顔の近くに出て、下の入口(ドック)にかぶらず、画面の中にある
// 会話はふだんは4割の確率でしか始まらないので、Math.random を小さい値に固定して必ず始まるようにする(撮り方で💬が出ない回を除くため)
//   node tools/browser/home-peer-mark-check.js
const http = require('http'), path = require('path'), fs = require('fs');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8965;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const shiftClock = (iso) => ({ content: `(() => { const off = Date.parse(${JSON.stringify(iso)}) - Date.now(); const RD = Date;
  class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
  D.parse = RD.parse; D.UTC = RD.UTC; window.Date = D; })();` });
const VPS = [
  { tag: 'スマホ縦 390×844', viewport: { width: 390, height: 844 } },
  { tag: 'スマホ横 844×390', viewport: { width: 844, height: 390 } },
  { tag: 'タブレット縦 820×1180', viewport: { width: 820, height: 1180 } },
  { tag: 'タブレット横 1180×820', viewport: { width: 1180, height: 820 } },
];
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
(async () => {
  const { chromium } = (() => { try { return require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch (e) { return require('playwright'); } })();
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const shotDir = process.env.SHOT_DIR || '';
  if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
  for (const vp of VPS) {
    const ctx = await browser.newContext({ viewport: vp.viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    try {
      await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(shiftClock('2026-11-28T10:05:00+09:00'));
      await page.addInitScript(() => { Math.random = () => 0.05; });
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
        put('mh_rhythm_tutorial_seen_v1', true);
      });
      await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed()); await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
      for (let i = 0; i < 8; i++) {
        const btn = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK/ }).first();
        if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
        await btn.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250);
      }
      const mark = page.locator('[data-home-assistant-toggle="show"][data-home-peer-waiting], [data-home-peer-talk-mark]').first();
      await mark.waitFor({ timeout: 15000 }).catch(() => {});
      const st = await page.evaluate(() => ({ mark: !!document.querySelector('[data-home-peer-talk-mark]'), win: !!document.querySelector('[data-assistant-peer-talk]') }));
      check(`① ${vp.tag}: 会話が始まると顔に💬が付き、窓は勝手に開かない`, st.mark && !st.win, JSON.stringify(st));
      await mark.click({ timeout: 5000 }).catch(() => {});
      await page.locator('[data-assistant-peer-talk]').waitFor({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const r = await page.evaluate(() => {
        const R = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) }; };
        const win = document.querySelector('[data-assistant-peer-talk]');
        const box = document.querySelector('[data-assistant-peer-home-box]');
        const face = document.querySelector('.mh-home-assistant-fold, .mh-home-assistant');
        const dock = document.querySelector('.mh-home-dock');
        const area = win && win.parentElement ? R(win.parentElement) : null;
        return { win: R(win), area, inBox: !!(win && box && box.contains(win)), face: R(face), dock: R(dock), W: innerWidth, H: innerHeight };
      });
      if (shotDir) await page.screenshot({ path: path.join(shotDir, `peer-${vp.viewport.width}x${vp.viewport.height}.jpg`), type: 'jpeg', quality: 80 });
      check(`② ${vp.tag}: 顔を押すと会話の窓が開く`, !!r.win, JSON.stringify(r.win));
      if (r.win && r.area) {
        const near = r.face && (Math.abs(r.area.t - r.face.b) <= 24 || (r.area.l >= r.face.r - 4 && r.area.t <= r.face.b));
        check(`③ ${vp.tag}: 窓は顔の近くに出る`, r.inBox && near, `窓 ${JSON.stringify(r.area)} / 顔 ${JSON.stringify(r.face)}`);
        check(`③ ${vp.tag}: 窓は下の入口にかぶらず、画面の中にある`, r.dock && r.area.b <= r.dock.t + 1 && r.area.l >= 0 && r.area.r <= r.W && r.area.t >= 0, `窓 ${JSON.stringify(r.area)} / 入口の上端 ${r.dock && r.dock.t}`);
      }
    } catch (e) { check(`${vp.tag}: 最後まで確かめられる`, false, String(e).split('\n')[0]); }
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
