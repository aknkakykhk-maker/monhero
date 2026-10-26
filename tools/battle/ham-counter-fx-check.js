#!/usr/bin/env node
// ハムのカウンターの演出(24-battle-fx.jsx の HamCounterFx)を、実際のブラウザで段ごとに出して確かめる
// (2026-10-22 社長「1回めがクロスカウンターで、数増えるごとにフルカウンター、リベンジカウンター」「演出も派手にしてほしい」
//  「フルからはカットイン付きでも良さそう」「滅多にないし演出が少し長くなっても良さそう」「タップで早送り」)。
//
//   node tools/battle/ham-counter-fx-check.js          幅390×844 と 320×568 で、3つの段を出す
//   SHOT_DIR=<フォルダ> を付けると、段ごとの写真を残す(演出の真ん中あたり)
//
//   ① フル・リベンジは技名と倍率が出る(フルカウンター ×4 / リベンジカウンター ×6)。クロスは拳の光だけ(技名は大きくしたポップアップ)
//   ② 技名・倍率の字が画面の幅に収まる(はみ出さない・1行)
//   ③ クロスは押せる場所を塞がない。フル・リベンジは画面を覆い、タップで飛ばせる(onSkip が呼ばれる)
//   ④ リベンジはフルより派手(画面全体の白い光・光の輪が多い・技名の字が大きい)
//   ⑤ 実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8933;
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const TIERS = [['cross', 'クロスカウンター', 2, 1], ['full', 'フルカウンター', 4, 2], ['revenge', 'リベンジカウンター', 6, 3]];
(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const [W, H] of [[390, 844], [320, 568]]) {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_masu_migrated', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
      });
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.waitForFunction(() => typeof HamCounterFx === 'function' && typeof HAM_COUNTER_FX_MS === 'object', null, { timeout: 30000 });
      const ms = await page.evaluate(() => ({ ...HAM_COUNTER_FX_MS }));
      const sizes = {};
      for (const [tier, name, mult, counter] of TIERS) {
        // 演出を止めた状態(真ん中あたり)で測るため、長さを10倍にして出す。タップで onSkip が呼ばれたかは window に控える
        await page.evaluate(({ tier, name, mult, counter }) => {
          window.__hamSkipped = 0;
          let host = document.getElementById('__ham_fx_host');
          if (!host) { host = document.createElement('div'); host.id = '__ham_fx_host'; document.body.appendChild(host); window.__hamRoot = ReactDOM.createRoot(host); }
          const ham = ALL_PLAYER_MONSTERS.Ham || {};
          window.__hamRoot.render(React.createElement(HamCounterFx, { fx: { key: Date.now(), tier, name, mult, counter, ms: HAM_COUNTER_FX_MS[tier] * 10,
            monId: 'Ham', imgUrl: ham.imgUrl, colors: null, monName: 'ハム' }, onSkip: () => { window.__hamSkipped += 1; } }));
        }, { tier, name, mult, counter });
        await page.waitForTimeout(Math.round(ms[tier] * 10 * 0.45));
        const m = await page.evaluate(() => {
          const el = document.querySelector('[data-ham-counter-fx]');
          if (!el) return null;
          const nameEl = el.querySelector('[data-ham-counter-name]'), multEl = el.querySelector('.ham-cfx__mult'), fist = el.querySelector('.ham-cfx__fist');
          if (!nameEl || !multEl) return { tier: el.dataset.hamCounterFx, onlyFist: !!fist && !nameEl && !multEl, pe: getComputedStyle(el).pointerEvents, skip: !!el.querySelector('.ham-cfx__skip') };
          const r = nameEl.getBoundingClientRect(), mr = multEl.getBoundingClientRect();
          return { tier: el.dataset.hamCounterFx, name: nameEl.textContent, mult: multEl.textContent, pe: getComputedStyle(el).pointerEvents,
            nameFits: r.left >= -1 && r.right <= innerWidth + 1 && r.height < parseFloat(getComputedStyle(nameEl).fontSize) * 1.8,
            multFits: mr.left >= -1 && mr.right <= innerWidth + 1, nameFs: parseFloat(getComputedStyle(nameEl).fontSize), nameOp: +getComputedStyle(nameEl).opacity,
            flash: !!el.querySelector('.ham-cfx__flash'), rings: el.querySelectorAll('.ham-cfx__ring').length, skip: !!el.querySelector('.ham-cfx__skip') };
        });
        if (tier === 'cross') {
          // クロスは拳の光だけ(技名は大きくしたポップアップ「🥊 クロスカウンター ×2!」が出す。二重に出さない)
          check(`① ${W}×${H} cross: 拳の光だけを出す(技名はポップアップ)`, !!m && m.tier === 'cross' && m.onlyFist);
          check(`③ ${W}×${H} cross: 押せる場所を塞がない(待たない)`, !!m && m.pe === 'none' && !m.skip);
          if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `ham-counter-${tier}-${W}.png`) }); }
          await page.evaluate(() => window.__hamRoot.render(null));
          continue;
        }
        check(`① ${W}×${H} ${tier}: 「${name} ×${mult}」が出る`, !!m && m.tier === tier && m.name === name && m.mult === `×${mult}` && m.nameOp > 0.5, m ? `${m.name} ${m.mult}・見え方 ${m.nameOp.toFixed(2)}` : '出ていない');
        if (!m) continue;
        check(`② ${W}×${H} ${tier}: 技名・倍率が画面の幅に収まり、1行`, m.nameFits && m.multFits, `字 ${m.nameFs}px`);
        sizes[tier] = m;
        if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `ham-counter-${tier}-${W}.png`) }); }
        await page.touchscreen.tap(Math.round(W / 2), Math.round(H * 0.8));
        await page.waitForTimeout(100);
        const skipped = await page.evaluate(() => window.__hamSkipped);
        check(`③ ${W}×${H} ${tier}: 画面を覆い、タップで飛ばせる`, m.pe === 'auto' && m.skip && skipped >= 1, `タップ ${skipped}回 届いた`);
        await page.evaluate(() => window.__hamRoot.render(null));
      }
      if (sizes.full && sizes.revenge) {
        check(`④ ${W}×${H}: リベンジはフルより派手(白い光・輪が多い・字が大きい)・長い`, sizes.revenge.flash && !sizes.full.flash && sizes.revenge.rings > sizes.full.rings
          && sizes.revenge.nameFs >= sizes.full.nameFs && ms.revenge > ms.full && ms.full >= 1500, `輪 ${sizes.full.rings}→${sizes.revenge.rings}・字 ${sizes.full.nameFs}→${sizes.revenge.nameFs}px・${ms.full}→${ms.revenge}ms`);
      }
      check(`⑤ ${W}×${H}: 実行時エラーなし`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
