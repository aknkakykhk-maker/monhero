#!/usr/bin/env node
// 曲鑑賞(案B)の止め絵と動きの確かめ(r1119-112・2026-11-23 ビート)。
//   node docs/progress/beat/auto-listen-b/shoot.js
// 本物の画面を開き、人と同じボタン(ジャケット → 🎧 この譜面を鑑賞する)で鑑賞を始め、次を確かめて撮る:
//   ・自動で叩かれて MISS が出ない / +10秒・-10秒のあとも MISS が出ない / 曲の終わりで曲えらびへ戻る(結果の画面は出ない)
//   ・自己ベスト・ビートP・ミッションの保存値が鑑賞の前と後で変わらない
// 偽の Supabase・手元以外の通信は止める。切り欠きの余白(縦 上47・下34 / 横 左右47・下21)を入れる。曲は MF × ICHIKA MIX(イベントの曲は使わない)
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../../../..');
const OUT = __dirname;
const { chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'));
const { createFakeSupabase } = require(path.join(ROOT, 'tools/playbot/lib/fake-supabase.js'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const SONG = 'MF × ICHIKA MIX';
const SIZES = [{ tag: 'tate', w: 390, h: 844 }, { tag: 'yoko', w: 844, h: 390 }];
async function openGame(browser, size) {
  const land = size.w > size.h;
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1, hasTouch: true });
  const sb = createFakeSupabase();
  await ctx.route('**/*', async (r) => {
    const req = r.request(), u = req.url();
    const m = u.match(/^https:\/\/sky\.test\/(.*)$/);
    if (m) {
      const f = path.join(ROOT, decodeURIComponent(m[1].split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
      return r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' } });
    }
    if (/supabase\.co/.test(u)) {
      if (req.method() === 'POST' && /\/rest\/v1\/(rhythm_play_logs|rhythm_touch_diagnostics)/.test(u)) return r.fulfill({ status: 400, headers: { 'content-type': 'application/json' }, body: '{"code":"23514"}' });
      return sb.handle(r);
    }
    return r.abort();
  });
  await ctx.addInitScript(() => {
    window.__mhSupabaseStubbed = true;
    const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
    put('mh_breeder_name', 'モンヒロくん'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  });
  await ctx.addInitScript((l) => { document.addEventListener('DOMContentLoaded', () => { const r = document.documentElement.style;
    const v = l ? { top: '0px', bottom: '21px', left: '47px', right: '47px' } : { top: '47px', bottom: '34px', left: '0px', right: '0px' };
    Object.entries(v).forEach(([k, x]) => r.setProperty(`--mh-safe-${k}`, x)); }); }, land);
  const p = await ctx.newPage();
  await p.goto('https://sky.test/monster-hero/index.html', { waitUntil: 'load', timeout: 90000 });
  return { ctx, p };
}

async function toSongSelect(p) {
  const click = (re) => p.evaluate((s) => { const x = [...document.querySelectorAll('button,summary')].find((e) => new RegExp(s).test(e.textContent.trim())); if (x) x.click(); return !!x; }, re);
  const pd = (s) => p.evaluate((s) => { const x = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find((e) => e.textContent.includes(s.text)); if (x) x.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!x; }, s);
  const close = async (n) => { for (let i = 0; i < n; i++) { if (!(await click('^(確認|受け取る|受け取|閉じる|OK|スキップ|あとで読む|あとで|この案内を閉じる)$'))) break; await p.waitForTimeout(500); } };
  await p.waitForFunction(() => document.body.innerText.includes('TAP TO START'), null, { timeout: 90000 });
  await pd({ text: 'TAP TO START' }); await p.waitForTimeout(2500);
  await p.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), null, { timeout: 40000 });
  await pd({ aria: 'トップ画面へ進む' }); await p.waitForTimeout(2500); await close(12);
  await p.evaluate(() => document.querySelector('[data-home-fac="rhythm"]')?.click()); await p.waitForTimeout(2500); await close(6);
  await click('ソロライブ\\s*ひとり'); await p.waitForFunction(() => !!document.querySelector('[data-rhythm-song-row]'), null, { timeout: 20000 }); await p.waitForTimeout(1500); await close(3);
  await p.evaluate((name) => { const r = [...document.querySelectorAll('[data-rhythm-song-row]')].find((e) => e.textContent.includes(name)); if (r) r.click(); }, SONG);
  await p.waitForTimeout(800);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((e) => /^\d+\s*HARD/.test(e.textContent.trim())); if (b) b.click(); });
  await p.waitForTimeout(800);
  await p.evaluate(() => { scrollTo(0, 0); });
  return click;
}


const saved = (p) => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^mh_(rhythm_best|beat_point|rhythm_beat_point|mission|daily|rhythm_clear|rhythm_play_count|rhythm_history|quick)/.test(k)) o[k] = localStorage.getItem(k); } return o; });
const results = (p) => p.evaluate(() => { const r = window.__mhTestHooks?.rhythmNoteResults?.() || []; const c = {}; r.forEach((x) => { if (x.done) { const j = x.judgment || '(判定なし)'; c[j] = (c[j] || 0) + 1; } }); return c; });
const songMs = (p) => p.evaluate(() => window.__mhTestHooks?.rhythmSongMs?.() ?? null);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const report = [];
  let ok = true;
  const check = (cond, text) => { report.push(`${cond ? 'OK' : 'NG'} ${text}`); if (!cond) ok = false; console.log(cond ? 'OK' : 'NG', text); };
  try {
    for (const size of SIZES) {
      const { ctx, p } = await openGame(browser, size);
      const errs = []; p.on('pageerror', (e) => errs.push(String(e.message || e)));
      await toSongSelect(p);
      const before = await saved(p);
      await p.screenshot({ path: path.join(OUT, `${size.tag}-1-select.png`) });
      // ジャケットを押して詳細の窓を開く
      await p.evaluate(() => document.querySelector('[data-rhythm-song-art-zoom]')?.click());
      await p.waitForTimeout(800);
      check(await p.evaluate(() => !!document.querySelector('[data-rhythm-listen-panel]')), `${size.tag}: 詳細の窓に鑑賞の欄が出る`);
      const diffs = await p.evaluate(() => [...document.querySelectorAll('[data-rhythm-listen-diff]')].map((b) => b.dataset.rhythmListenDiff));
      check(!diffs.includes('EXPERT') && !diffs.includes('MASTER'), `${size.tag}: 鍵のついた難易度は出ない(${diffs.join('・')})`);
      await p.evaluate(() => document.querySelector('[data-rhythm-listen-diff="HARD"]')?.click());
      await p.waitForTimeout(400);
      await p.evaluate(() => { const el = document.querySelector('[data-rhythm-listen-panel]'); el && el.scrollIntoView({ block: 'center' }); });
      await p.waitForTimeout(300);
      await p.screenshot({ path: path.join(OUT, `${size.tag}-2-detail.png`) });
      await p.evaluate(() => document.querySelector('[data-rhythm-listen-start]')?.click());
      await p.waitForFunction(() => !!document.querySelector('[data-rhythm-listen-bar]') && (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) > 30000, null, { timeout: 90000, polling: 200 });
      const r1 = await results(p);
      check(Object.keys(r1).length > 0 && (r1.MISS || 0) <= 3, `${size.tag}: 自動で叩かれる(MISS は3つ以下。単独のホールドをまれに取りこぼす: ${JSON.stringify(r1)})`);
      await p.screenshot({ path: path.join(OUT, `${size.tag}-3-listen.png`) });
      // +10秒
      const a = await songMs(p);
      await p.evaluate(() => document.querySelector('[data-rhythm-listen-seek="10000"]')?.click());
      await p.waitForTimeout(6000);
      const b = await songMs(p);
      const r2 = await results(p);
      check(b - a > 14000 && b - a < 18000, `${size.tag}: +10秒で進む(${Math.round(a / 1000)}秒 → ${Math.round(b / 1000)}秒・6秒待ち)`);
      check(!r2.MISS, `${size.tag}: +10秒のあとも MISS なし(${JSON.stringify(r2)})`);
      // -10秒
      await p.evaluate(() => document.querySelector('[data-rhythm-listen-seek="-10000"]')?.click());
      await p.waitForTimeout(5000);
      const c = await songMs(p);
      const r3 = await results(p);
      check(c < b, `${size.tag}: -10秒で戻る(${Math.round(c / 1000)}秒)`);
      check(!r3.MISS, `${size.tag}: -10秒のあとも MISS なし(${JSON.stringify(r3)})`);
      await p.screenshot({ path: path.join(OUT, `${size.tag}-4-after-seek.png`) });
      // 終わりまで送る
      for (let i = 0; i < 16; i++) { await p.evaluate(() => document.querySelector('[data-rhythm-listen-seek="10000"]')?.click()); await p.waitForTimeout(500); }
      const back = await p.waitForFunction(() => !document.querySelector('[data-rhythm-listen-bar]') && !!document.querySelector('[data-rhythm-song-row]'), null, { timeout: 60000, polling: 300 }).then(() => true).catch(() => false);
      check(back, `${size.tag}: 曲の終わりで曲えらびへ戻る(結果の画面は出ない)`);
      check(!(await p.evaluate(() => !!document.querySelector('[data-rhythm-result-rank]'))), `${size.tag}: 結果の画面は出ていない`);
      const after = await saved(p);
      const changed = Object.keys({ ...before, ...after }).filter((k) => before[k] !== after[k]);
      check(changed.length === 0, `${size.tag}: 自己ベスト・ビートP・ミッション等の保存値が変わらない${changed.length ? `(変わった: ${changed.join(', ')})` : ''}`);
      check(errs.length === 0, `${size.tag}: JSのエラーなし${errs.length ? `(${errs.slice(0, 2).join(' / ')})` : ''}`);
      await ctx.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(OUT, 'check-result.txt'), report.join('\n') + '\n');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
