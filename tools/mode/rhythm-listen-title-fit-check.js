#!/usr/bin/env node
// 曲鑑賞の画面の曲名が、全曲・縦(幅390・375・320)と横で、1〜2行に収まり、右上の ✕・札・コンボ数・判定・コンボの入/切と重ならないかを測る
// (2026-11-23 r1119-154 社長の写真: 縦で「♪ 全部必 / 殺技でつ( / `･ω･)」と3行に崩れていた)。
//   node tools/mode/rhythm-listen-title-fit-check.js
// 1曲だけ本当に鑑賞を始め、画面の大きさを替えながら置き場所の重なりを測る。全曲の曲名は、その大きさで実際に取れた曲名の幅に
// 同じ部品(RhythmListenSongTitle)を描いて、字の大きさ・行数を測る(「…」(clip)が0件・2行まで)。本物の Supabase へは送らない。
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const SONG = 'zenbu_hissatsuwaza', DIFF = 'HELL', GPU = false, SHOT = null;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail && !ok ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const { chromium } = (() => { try { return require(path.join(ROOT, 'tools/node_modules/playwright')); } catch { return require('playwright'); } })();
const { createFakeSupabase } = require(path.join(ROOT, 'tools/playbot/lib/fake-supabase.js'));
const { eventStorySeed } = require(path.join(ROOT, 'tools/boot/quiet-boot-seed.js'));
const mime = f => ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(f)] || 'application/octet-stream';
const seed = (songId) => `(() => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_rhythm_hell_story_seen_v1', true); put('mh_story_assistant_chat_seen_v1', true);
  put('mh_rhythm_owned_songs_v1', [${JSON.stringify(songId)}, ${JSON.stringify(songId.replace(/_short$/, ''))}]);   // 有料の曲も鑑賞できるように
  put('mh_rhythm_best_v1', { ${JSON.stringify(songId)}: Object.fromEntries(['EASY','NORMAL','HARD','EXPERT','MASTER'].map(d => [d, { bestScore: 900000, maxCombo: 10, played: true, clear: true }])) });
})()`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required', ...(GPU ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const sb = createFakeSupabase();
  await context.route('**/*', async (route) => {
    const req = route.request(), u = req.url();
    const m = u.match(/^https:\/\/sky\.test\/(.*)$/);
    if (m) {
      const f = path.join(ROOT, decodeURIComponent(m[1].split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': mime(f), 'access-control-allow-origin': '*' } });
    }
    if (/supabase\.co/.test(u)) return sb.handle(route);
    return route.abort();
  });
  await context.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await context.addInitScript(seed(SONG));
  if (GPU) await context.addInitScript(() => { try { localStorage.setItem('mh_rhythm_canvas_v1', 'webgl'); } catch (_) {} });
  await context.addInitScript(eventStorySeed());
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto('https://sky.test/monster-hero/index.html', { waitUntil: 'load', timeout: 90000 });
  const clickText = (re) => page.evaluate((p) => { const b = [...document.querySelectorAll('button,summary')].find(x => new RegExp(p).test(x.textContent)); if (b) b.click(); return !!b; }, re);
  const pointerDown = (sel) => page.evaluate((s) => { const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text)); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!b; }, sel);
  const closeDialogs = async (n) => { for (let i = 0; i < n; i++) { if (!(await clickText('^(確認|受け取る|受け取|閉じる|OK|スキップ|あとで読む|あとで|この案内を閉じる)$'))) break; await page.waitForTimeout(500); } };
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), null, { timeout: 90000 }).catch(() => {});
  await pointerDown({ text: 'TAP TO START' }); await page.waitForTimeout(2500);
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), null, { timeout: 40000 });
  await pointerDown({ aria: 'トップ画面へ進む' }); await page.waitForTimeout(2500);
  await closeDialogs(12);
  await page.evaluate(() => document.querySelector('[data-home-fac="rhythm"]')?.click()); await page.waitForTimeout(2500); await closeDialogs(6);
  await clickText('ソロライブ'); await page.waitForTimeout(2500); await closeDialogs(3);
  await page.evaluate((id) => {
    const head = typeof rhythmSongVersionHead === 'function' ? rhythmSongVersionHead(id) : id;
    (document.querySelector(`[data-rhythm-song-row="${id}"]`) || document.querySelector(`[data-rhythm-song-row="${head}"]`))?.click();
  }, SONG); await page.waitForTimeout(1200);
  await page.evaluate((id) => { const b = document.querySelector(`[data-rhythm-song-version="${id}"]`); if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); }, SONG); await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('[data-rhythm-song-art-zoom]')?.click()); await page.waitForTimeout(1000);
  const picked = await page.evaluate((d) => { const b = document.querySelector(`[data-rhythm-listen-diff="${d}"]`); if (!b) return false; b.click(); return true; }, DIFF);
  if (!picked) { const have = await page.evaluate(() => [...document.querySelectorAll('[data-rhythm-listen-diff]')].map(b => b.getAttribute('data-rhythm-listen-diff')).join(',') + ' / ' + (document.querySelector('[data-rhythm-listen-panel]')?.parentElement?.innerText || '').slice(0, 80)); throw new Error(`鑑賞の難易度 ${DIFF} を選べない(選べるのは ${have})`); }
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('[data-rhythm-listen-start]')?.click());
  await page.waitForFunction(() => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) > 0, null, { timeout: 40000, polling: 100 });
  const SIZES = [[390, 844, '縦390'], [375, 667, '縦375'], [320, 568, '縦320'], [844, 390, '横'], [667, 375, '小さい横']];
  for (const [w, h, lab] of SIZES) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(1200);
    // 大きさを替えて一時停止になったら、再開する
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^再開/.test(x.textContent.trim())); if (b) b.click(); });
    await page.waitForTimeout(900);
    const g = await page.evaluate(() => {
      const box = s => { const e = [...document.querySelectorAll(s)].find(x => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(x).visibility !== 'hidden'; }); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, el: e }; };
      const t = box('[data-rhythm-listen-songbox] [data-rhythm-hud-song]');
      const parts = { 曲名: t, 札: box('[data-rhythm-listen-badge]'), ジャケット: box('[data-rhythm-hud-art]'), '✕': box('[data-rhythm-listen-close]'), コンボ数: box('[data-rhythm-combo-box]'), '判定・コンボ': box('[data-rhythm-listen-hud]'), 下の帯: box('[data-rhythm-listen-bar]') };
      const hit = (a, b) => a && b && a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
      const names = Object.keys(parts), over = [];
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if (!(names[i] === '判定・コンボ' && names[j] === '下の帯') && hit(parts[names[i]], parts[names[j]])) over.push(`${names[i]}と${names[j]}`);
      const missing = ['曲名', '札', '✕'].filter(k => !parts[k]);
      return { over, missing, width: t ? t.el.clientWidth : 0, fit: t ? t.el.getAttribute('data-rhythm-listen-title-fit') : null, land: innerWidth > innerHeight, vw: innerWidth };
    });
    check(`${lab}(${w}×${h}): 曲名・札・✕ が出ている`, g.missing.length === 0, `無い: ${g.missing.join('・')}`);
    check(`${lab}: 曲名・札・ジャケット・✕・コンボ数・判定・コンボ・下の帯が重ならない`, g.over.length === 0, g.over.join(' / '));
    if (process.env.MH_SHOT_DIR) await page.screenshot({ path: path.join(process.env.MH_SHOT_DIR, `listen-title-${lab}.png`) });
    if (!g.width) continue;
    // 全曲の曲名を、いま取れた幅に同じ部品で描いて測る
    const r = await page.evaluate(async ({ width, land }) => {
      const host = document.createElement('div'); host.style.cssText = `position:fixed;left:0;top:0;width:${width}px;visibility:hidden;pointer-events:none;display:flex`;
      document.body.appendChild(host);
      const out = [];
      for (const song of RHYTHM_SONGS) {
        const root = ReactDOM.createRoot(host);
        ReactDOM.flushSync(() => root.render(React.createElement(RhythmListenSongTitle, { song, difficulty: { id: 'HELL' }, isLandscape: land })));
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const e = host.querySelector('[data-rhythm-hud-song]');
        out.push({ id: song.songId, name: rhythmSongFullName(song), fit: e && e.getAttribute('data-rhythm-listen-title-fit'), over: e ? e.scrollWidth > e.clientWidth + 1 : true });
        root.unmount();
      }
      host.remove(); return out;
    }, { width: g.width, land: g.land });
    const bad = r.filter(x => !x.fit || x.fit === 'clip' || x.over || !/\/[12]$/.test(x.fit));
    const two = r.filter(x => /\/2$/.test(x.fit)).length, small = Math.min(...r.map(x => parseFloat(x.fit) || 99));
    check(`${lab}: 全${r.length}曲の曲名が幅${g.width}pxに1〜2行で収まる(2行 ${two}曲・いちばん小さい字 ${small}px)`, r.length > 0 && bad.length === 0, bad.slice(0, 5).map(x => `${x.name}(${x.fit})`).join(' / '));
  }
  check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await context.close(); await browser.close();
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK'); process.exit(failed ? 1 : 0);
})().catch(e => { console.log('NG: 検査が途中で止まった — ' + String(e && e.message || e).slice(0, 300)); process.exit(1); });
