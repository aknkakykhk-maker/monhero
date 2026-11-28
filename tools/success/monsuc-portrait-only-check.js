#!/usr/bin/env node
// モンサクを横にしたときの「縦向きにしてね」の案内の見張り(2026-11-20 r1119-026 社長: モンサクの横向きはいったん非対応)。
//
//   node tools/success/monsuc-portrait-only-check.js
//
//   ① スマホの縦(390×844・指)では案内を出さない
//   ② スマホを横にする(844×390・指)と案内が出て、モンサクの画面を覆う(下のボタンは押せない)
//   ③ 縦に戻すと案内が消え、同じ画面のまま続きを遊べる(画面の中身は作り直さない)
//   ④ PC(マウス・横長で背の低い窓)では出さない
//   ⑤ モンサクの外(HOME)には出さない
//   保存には触らない(案内は CSS だけで出し入れする)
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..'), PORT = 8977;
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const seed = () => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true);
  put('mh_update_notice_seen_v1', true); put('mh_rhythm_tutorial_seen_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true);
  const seen = {}; ['scn', 'prep', 'team', 'bring', 'turn', 'train', 'result', 'rest', 'shugyo', 'cup', 'rank', 'meal', 'match', 'rematch', 'event', 'awake', 'retire', 'open', 'firstend', 'start'].forEach((k) => { seen[k] = 1; }); put('mh_monsuc_beta_v1', { v: 1, seen }); };
// 案内が出ているか(見えていて、画面の真ん中を押すと案内に当たるか)
const look = (page) => page.evaluate(() => {
  const el = document.querySelector('[data-msx-portrait-only]');
  if (!el) return { exists: false, shown: false };
  const r = el.getBoundingClientRect();
  const shown = getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0;
  const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  return { exists: true, shown, covers: shown && !!hit && el.contains(hit), view: (document.querySelector('.msx[data-msx-view]') || {}).dataset?.msxView || null };
});
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const open = async ({ touch, vp }) => {
      const ctx = await browser.newContext({ viewport: vp, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.route(/supabase|functions\/v1/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));   // 本番へ書かない
      await page.addInitScript(seed);
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 40000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.waitForFunction(() => document.querySelector('.mh-home-assistant, .mh-home-assistant-fold'), { timeout: 40000 });
      for (let i = 0; i < 20; i++) {
        const did = await page.evaluate(() => { const l = [...document.querySelectorAll('button')].filter((b) => /^(スキップ|確認|閉じる|OK|受け取る|(?:分|わ)かった|はい|あとで読む|とじる)$/.test((b.innerText || '').replace(/\s+/g, ' ').trim()) && b.getBoundingClientRect().width > 0); if (!l.length) return false; l[0].click(); return true; });
        if (!did) break; await page.waitForTimeout(400);
      }
      return { ctx, page };
    };
    // スマホ
    {
      const { ctx, page } = await open({ touch: true, vp: { width: 390, height: 844 } });
      await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(400);
      const home = await look(page);
      ok('⑤ モンサクの外(HOME)では、横にしても案内を出さない', !home.exists || !home.shown, JSON.stringify(home));
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '') === 'モンヒロサクセス β'); if (b) b.click(); });
      await page.waitForSelector('.msx[data-msx-view]', { timeout: 20000 });
      await page.waitForTimeout(800);
      const tate = await look(page);
      ok('① スマホの縦では案内を出さない', tate.exists && !tate.shown, JSON.stringify(tate));
      await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(500);
      const yoko = await look(page);
      ok('② スマホを横にすると案内が出て、モンサクの画面を覆う', yoko.shown && yoko.covers, JSON.stringify(yoko));
      const txt = await page.evaluate(() => document.querySelector('[data-msx-portrait-only]').innerText);
      ok('② 案内に「縦向き」とスマホを回す絵がある', /縦向き/.test(txt) && /📱/.test(txt), txt.replace(/\s+/g, ' '));
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
      const back = await look(page);
      ok('③ 縦に戻すと案内が消え、同じ画面のまま', !back.shown && back.view === tate.view, JSON.stringify({ before: tate.view, after: back.view, shown: back.shown }));
      await ctx.close();
    }
    // PC(マウス)
    {
      const { ctx, page } = await open({ touch: false, vp: { width: 1280, height: 800 } });
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '') === 'モンヒロサクセス β'); if (b) b.click(); });
      await page.waitForSelector('.msx[data-msx-view]', { timeout: 20000 });
      await page.setViewportSize({ width: 900, height: 420 }); await page.waitForTimeout(500);
      const pc = await look(page);
      ok('④ PC(マウス)では、横長で背の低い窓でも案内を出さない', pc.exists && !pc.shown, JSON.stringify(pc));
      await ctx.close();
    }
  } catch (error) {
    ok('確認を最後まで進められる', false, String(error).split('\n')[0]);
  } finally {
    await browser?.close(); server.close();
  }
  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
  process.exit(failed === 0 ? 0 : 1);
})();
