#!/usr/bin/env node
// マルチの待合い(部屋を作ったホストの待ち画面)で、いちばん下の「ルームを出る」が切れず、メンバーの名前が折れないか(2026-11-08)。
//
//   node tools/ui/rhythm-multi-wait-bottom-check.js
//   SHOT_DIR=<フォルダ> を付けると、縦・小さい画面・横・🔄横で撮る
//
// 社長のスクショ(本番・iPhone 縦): 「ルームを出る」がホームバーの所で半分切れ、メンバーの札で「助手 えるびん」が「えるび/ん」と2行に折れていた。
// 上のメンバーの札と下の欄(画面の7割まで・縮まない)を足すと画面より高くなっていた。
//   ① 下の欄を中で送りきったとき、「ルームを出る」が画面(アプリの枠)の中に入る
//   ② 助手(CPU)の名前は1行で、札の幅からはみ出さない(「助手」の札は名前の上の行)
// 実際のブラウザで、Realtime を作り物にして部屋を作り、助手を3人呼んで確かめる
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
let chromium;
try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));
const PORT = 8965;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };
(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    for (const [w, h, rot, name] of [[390, 844, false, 'tate'], [375, 667, false, 'se'], [320, 568, false, 'small'], [844, 390, false, 'yoko'], [390, 844, true, 'rot']]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
      await page.addInitScript(() => { class FakeWS { constructor() { this.readyState = 0; setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 30); } send(raw) { let m = null; try { m = JSON.parse(raw); } catch (_) { return; } if (m.event === 'phx_join') setTimeout(() => this.onmessage && this.onmessage({ data: JSON.stringify({ topic: m.topic, event: 'phx_reply', ref: '1', payload: { status: 'ok' } }) }), 20); } close() { this.readyState = 3; setTimeout(() => this.onclose && this.onclose(), 0); } } window.WebSocket = FakeWS; });
      await page.addInitScript(() => { const put = (k, v) => localStorage.setItem(k, JSON.stringify(v)); put('mh_breeder_name', 'けんさ'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_rhythm_tutorial_seen_v1', true); });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), undefined, { timeout: 90000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.waitForTimeout(2500);
      for (let i = 0; i < 12; i++) { const hit = await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /^(スキップ|受け取る|閉じる|OK)$/.test((e.innerText || '').trim())); if (x) { x.click(); return true; } return false; }); if (!hit) break; await page.waitForTimeout(300); }
      await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /モンヒロビート/.test(e.innerText || '')); x && x.click(); });
      await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 30000 });
      await page.waitForTimeout(800);
      if (rot) await page.evaluate(() => { try { RHYTHM_VIEW_ROTATION.set(90); } catch (e) {} });
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-free]').click());
      await page.waitForTimeout(800);
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-free-create]').click());
      await page.waitForSelector('[data-rhythm-multi-step="matching"]', { timeout: 30000 });
      await page.waitForTimeout(2500);
      await page.evaluate(() => { for (const id of ['erubin', 'kiki', 'momosuke']) { const who = assistantById(id); RHYTHM_MULTI.summon({ masuId: `as:${id}`, assistantId: id, name: who ? who.name : id, level: 1, baseId: '', colors: null }); } });
      await page.waitForTimeout(2500);
      const m = await page.evaluate(() => {
        const panel = document.querySelector('[data-rhythm-multi-wait-panel]');
        if (panel) panel.scrollTop = 1e6;
        const main = document.querySelector('[data-rhythm-multi-step="matching"]');
        const leave = document.querySelector('[data-rhythm-multi-leave]');
        const box = (el) => { const r = el.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }; };
        const mb = main ? box(main) : null; const lb = leave ? box(leave) : null;
        // 回しているときは枠の中で比べる(枠ごと回るので、画面の上下左右のどれかが枠の下に当たる)
        const inMain = !!mb && !!lb && lb.t >= mb.t - 1 && lb.b <= mb.b + 1 && lb.l >= mb.l - 1 && lb.r <= mb.r + 1;
        const names = [...document.querySelectorAll('[data-rhythm-multi-member-name]')].filter((e) => e.parentElement && e.parentElement.querySelector('[data-rhythm-multi-assist-mark]'))
          .map((e) => { const lh = parseFloat(getComputedStyle(e).lineHeight) || 14; const card = e.closest('[data-rhythm-multi-member-open]') || e.parentElement; return { t: e.innerText, lines: Math.round(e.offsetHeight / lh), over: e.scrollWidth > (card ? card.clientWidth : e.clientWidth) + 1 }; });
        return { mb, lb, inMain, names };
      });
      check(`${name}: 下の欄を送りきると「ルームを出る」が画面の中に入る`, m.inMain, JSON.stringify({ main: m.mb, leave: m.lb }));
      check(`${name}: 助手の名前は1行で、札からはみ出さない`, m.names.length >= 3 && m.names.every((x) => x.lines <= 1 && !x.over), JSON.stringify(m.names));
      if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `wait-${name}.png`) }); }
      await page.close();
    }
    check('画面のエラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { check('最後まで通る', false, String(e && e.message || e).slice(0, 300)); }
  finally { await browser.close(); server.close(); }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
