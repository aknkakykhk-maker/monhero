#!/usr/bin/env node
// クリスマスのレイドのお話「もうひとつの聖夜」の背景と全身の絵(r1126-090・追記1)を、回想から開いて止め絵に撮り、形を確かめる。
//   node tools/battle/raid-xmas-story-bg-shots.js            … 確かめるだけ(撮らない)
//   SHOT_DIR=<フォルダ> node tools/battle/raid-xmas-story-bg-shots.js … 止め絵も残す
//
//   見ること(縦 390×844・タブレット 820×1180・横 844×390):
//   ① 決めた行で、背景(data-story-bg)が表 docs/progress/raid-xmas-story-bg/BG-TABLE.md の絵になり、画面いっぱいに出ている(絵が読めている)
//   ② ハム・サンタが話す行で、まん中に全身の絵(data-story-figures)が出る。上の段(data-story-stage)は出ない。
//      下の窓の顔の枠(data-story-speaker)と顔の列には、全身の絵から切り出した顔アイコンを出す(追記2)
//   ③ 全身の絵と会話の窓が重ならない・窓が画面の中に収まる
//   共有の合計(Supabase)は空の返事にしてある(本番の表には触らない)
const http = require('http'), path = require('path'), fs = require('fs');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8977;
const SHOT_DIR = process.env.SHOT_DIR ? path.resolve(process.env.SHOT_DIR) : '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });

// [お話の題の一部, 行, 期待する背景の絵, 全身の絵が出るはずか, 名前]
const SHOTS = [
  ['～はじまり～', 6, 'xmas_hall_night', false, 'r0-hall'],
  ['～はじまり～', 17, 'xmas_hall_night', true, 'r0-ham'],
  ['～はじまり～', 27, 'xmas_hall_night', true, 'r0-santa'],
  ['～はじまり～', 57, 'xmas_hall_night', true, 'r0-kurosanta-storm'],
  ['～はじまり～', 64, 'xmas_hall_night', false, 'r0-candle'],
  ['第1話', 1, 'xmas_snowfield_cliff', true, 'r1-roof'],
  ['第1話', 31, 'xmas_mountain_road', true, 'r1-hill'],
  ['第3話', 1, 'xmas_snowfield_cliff', true, 'r3-lake'],
  ['第4話', 13, 'xmas_hall_night', false, 'r4-hall'],
  ['煉獄まで倒せた', 4, 'xmas_hall_day', true, 'ra-morning'],
  ['煉獄には届かなかった', 15, 'xmas_mountain_road', true, 'rb-hill'],
];
const VIEWS = [['phone', 390, 844], ['tablet', 820, 1180], ['land', 844, 390]];

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { try { ({ chromium } = require('playwright')); } catch (e2) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); } }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  if (SHOT_DIR) fs.mkdirSync(SHOT_DIR, { recursive: true });
  try {
    for (const [vname, w, h] of VIEWS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: vname !== 'tablet', deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.route(/supabase\.co|functions\/v1/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript({ content: `(() => { const off = Date.parse('2026-11-29T12:00:00+09:00') - Date.now(); const RD = Date;
        class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
        D.parse = RD.parse; D.UTC = RD.UTC; window.Date = D; })();` });
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
      });
      await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed());
      await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      for (let i = 0; i < 80; i++) {
        if (await page.locator('.mh-home-player').count()) break;
        await page.getByRole('button', { name: /TAP TO START|トップ画面へ進む/ }).first().click({ timeout: 800 }).catch(() => {});
        await page.waitForTimeout(500);
      }
      const closeAll = async () => { for (let i = 0; i < 12; i++) { const c = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(受け取る|閉じる|OK|(?:分|わ)かった！?)$/.test((x.innerText || '').trim()) && !x.closest('[data-event-story]')); if (b) { b.click(); return true; } return false; }); if (!c) break; await page.waitForTimeout(400); } };
      await closeAll();
      for (const [title, step, bg, fig, name] of SHOTS) {
        // 回想を開く(プロフィール → イベント回想 → クリスマスのまとまり → 話)
        await page.evaluate(() => document.querySelector('.mh-home-player')?.click());
        await page.waitForTimeout(900);
        await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /イベント回想/.test(b.textContent || ''))?.click());
        await page.waitForTimeout(700);
        let opened = false;
        // ジャンル → まとまり → 話。どのジャンル・まとまりにあるかは決め打ちしない(全部を見て、題に当たる話を押す)
        const genres = await page.evaluate(() => [...document.querySelectorAll('[data-event-replay-genre]')].map((b) => b.getAttribute('data-event-replay-genre')));
        for (const gen of (genres.length ? genres : [null])) {
          if (gen) { await page.evaluate((id) => document.querySelector(`[data-event-replay-genre="${id}"]`)?.click(), gen); await page.waitForTimeout(300); }
          const groups = await page.evaluate(() => [...document.querySelectorAll('[data-event-replay-group]')].map((b) => b.getAttribute('data-event-replay-group')));
          for (const g of groups) {
            await page.evaluate((id) => document.querySelector(`[data-event-replay-group="${id}"]`)?.click(), g);
            await page.waitForTimeout(250);
            opened = await page.evaluate((t) => { const b = [...document.querySelectorAll('[data-event-replay-episodes] button')].find((x) => /もうひとつの聖夜/.test(x.textContent || '') && (x.textContent || '').includes(t)); if (b) { b.click(); return true; } return false; }, title);
            if (opened) break;
            await page.evaluate(() => document.querySelector('[data-event-replay-back]')?.click());
            await page.waitForTimeout(200);
          }
          if (opened) break;
          await page.evaluate(() => document.querySelector('[data-event-replay-genre-back]')?.click());
          await page.waitForTimeout(250);
        }
        if (!opened) { check(`${vname} ${name}: 回想から開ける`, false, title); continue; }
        await page.waitForTimeout(700);
        // 幕開けを飛ばし、行まで進める
        for (let i = 0; i < 400; i++) {
          const cur = await page.evaluate(() => { const r = document.querySelector('[data-event-story]'); return r ? { step: Number(r.getAttribute('data-story-step')), opening: r.hasAttribute('data-story-opening') } : null; });
          if (!cur) break;
          if (!cur.opening && cur.step >= step) break;
          await page.evaluate(() => { const b = [...document.querySelectorAll('[data-event-story] [data-story-buttons] button')].find((x) => x.textContent.trim() === '次へ'); if (b) b.click(); else document.querySelector('[data-event-story] [data-story-sheet]')?.click(); });
          await page.waitForTimeout(60);
        }
        await page.waitForTimeout(1300);
        const st = await page.evaluate(() => {
          const r = document.querySelector('[data-event-story]'); if (!r) return null;
          const bgEl = r.querySelector('[data-story-bg]');
          const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, w: b.width, h: b.height }; };
          const bgUrl = bgEl ? getComputedStyle(bgEl).getPropertyValue('--story-bg') : '';
          const figs = [...r.querySelectorAll('[data-story-figures] img')];
          const figBox = figs.map((im) => ({ ...rect(im), ok: im.complete && im.naturalWidth > 0 }));
          // 絵の中身の下端(object-contain の余白を除く)
          const figInner = figs.map((im) => { const b = im.getBoundingClientRect(); const s = Math.min(b.width / im.naturalWidth, b.height / im.naturalHeight) || 0; const ih = im.naturalHeight * s; return { top: b.top + (b.height - ih) / 2, bottom: b.top + (b.height + ih) / 2 }; });
          return { step: Number(r.getAttribute('data-story-step')), bgUrl, bg: rect(bgEl), sheet: rect(r.querySelector('[data-story-sheet]')), figs: figBox, figInner,
            face: !!r.querySelector('[data-story-speaker]'),
            faceImg: (() => { const im = r.querySelector('[data-story-speaker] img'); return im ? { src: im.getAttribute('src') || '', ok: im.complete && im.naturalWidth > 0 } : null; })(),
            row: [...r.querySelectorAll('[data-story-cast-member]')].map((x) => x.getAttribute('data-story-cast-member')), stage: !!r.querySelector('[data-story-stage]'), banner: rect(r.querySelector('[data-story-banner]')) };
        });
        const label = `${vname} ${name}(${title} ${step}行目)`;
        if (!st) { check(`${label}: お話が開いている`, false); continue; }
        check(`${label}: 背景が ${bg}`, st.bgUrl.includes(`${bg}.jpg`), st.bgUrl.trim().slice(0, 80));
        check(`${label}: 背景が画面いっぱい`, !!st.bg && st.bg.w >= w - 1 && st.bg.h >= h - 1, JSON.stringify(st.bg));
        check(`${label}: 窓が画面の中`, !!st.sheet && st.sheet.b <= h + 1 && st.sheet.t >= 0, JSON.stringify(st.sheet));
        check(`${label}: 上の段に別の枠が出ない`, !st.stage);
        if (fig) {
          // 追記2(社長「ハムとかさんたの顔アイコンがない」): 下の窓にも顔アイコン(全身の絵を縮めた物ではない)。顔の列にも並ぶ
          check(`${label}: 下の窓に顔アイコン`, !!st.faceImg && st.faceImg.ok && /monster-icons\/face\//.test(st.faceImg.src), JSON.stringify(st.faceImg));
          check(`${label}: 顔の列にハム・サンタが並ぶ(サンタは1人ぶん)`, st.row.some((id) => /^(ham|xmas_santa|xmas_kurosanta)$/.test(id)) && !(st.row.includes('xmas_santa') && st.row.includes('xmas_kurosanta')), st.row.join(','));
          check(`${label}: まん中に全身の絵`, st.figs.length > 0 && st.figs.every((f) => f.ok), JSON.stringify(st.figs.map((f) => f.ok)));
          check(`${label}: 全身の絵が窓に重ならない`, st.figInner.every((f) => f.bottom <= st.sheet.t + 2 || vname === 'land'), JSON.stringify(st.figInner.map((f) => Math.round(f.bottom))) + ' / 窓 ' + Math.round(st.sheet.t));
          check(`${label}: 全身の絵が上で切れない`, st.figInner.every((f) => f.top >= -1), JSON.stringify(st.figInner.map((f) => Math.round(f.top))));
        }
        if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `${vname}-${name}.png`) });
        // 閉じる(スキップ → 終わりの札を閉じる)
        for (let i = 0; i < 20; i++) {
          const gone = await page.evaluate(() => { const r = document.querySelector('[data-event-story]'); if (!r) return true; const b = [...r.querySelectorAll('button')].find((x) => /^(スキップ|閉じる|とじる)$/.test(x.textContent.trim())); if (b) b.click(); else r.click(); return false; });
          if (gone) break;
          await page.waitForTimeout(500);
        }
        await page.waitForTimeout(400);
        await page.evaluate(() => { document.querySelector('[data-event-replay-back]')?.click(); });
        await page.waitForTimeout(200);
        await page.evaluate(() => { document.querySelector('[data-event-replay-genre-back]')?.click(); });
        await page.keyboard.press('Escape').catch(() => {});
        await closeAll();
        await page.waitForTimeout(300);
      }
      check(`${vname}: ページのエラーが無い`, errors.length === 0, errors.slice(0, 2).join(' | '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `NG ${failed} 件` : 'OK: レイドのお話の背景と全身の絵');
  process.exit(failed ? 1 : 0);
})();
