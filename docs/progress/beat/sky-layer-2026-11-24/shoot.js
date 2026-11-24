#!/usr/bin/env node
// r1119-165 の止め絵を撮る(資料用・ゲーム本体は変えない)。tools/mode/rhythm-listen-play-check.js の入り方を写したもの。
//   node docs/progress/beat/sky-layer-2026-11-24/shoot.js --song rebellion --diff HELL --from 214000 --shot 224000 --out a.jpg [--portrait] [--rot] [--look A|B|C] [--dump]
//   --rot … 縦の端末で曲選びの「🔄横」を押してから鑑賞する / --look … 案の見た目を、ページの中でだけ差し替えて撮る(look.js)
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../../../..');
const argv = process.argv.slice(2);
const arg = (name, fb = null) => { const i = argv.indexOf(`--${name}`); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fb; };
const SONG = arg('song', 'rebellion'), DIFF = arg('diff', 'HELL');
const FROM = Number(arg('from', 0)), SHOT = Number(arg('shot', 224000)), OUT = arg('out', 'shot.png');
const ROT = argv.includes('--rot'), PORTRAIT = argv.includes('--portrait') || ROT, GPU = false, LOOK = arg('look'), DUMP = argv.includes('--dump');
const MINIMAL = argv.includes('--minimal'), LIGHT = argv.includes('--light');
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
  const context = await browser.newContext({ viewport: PORTRAIT ? { width: 390, height: 844 } : { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
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
  if (MINIMAL || LIGHT) await context.addInitScript(([m, l]) => { try { const s = JSON.parse(localStorage.getItem('mh_rhythm_settings_v1') || '{}'); if (m) s.effectAmount = 'MINIMAL'; if (l) s.lightweightMode = true; localStorage.setItem('mh_rhythm_settings_v1', JSON.stringify(s)); } catch (_) {} }, [MINIMAL, LIGHT]);
  if (LOOK) await context.addInitScript({ content: `window.__skyLayerLook=${JSON.stringify(LOOK)};` + fs.readFileSync(path.join(__dirname, 'look.js'), 'utf8') });
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
  if (ROT) { await clickText('^(🔄\\s*)?横$'); await page.waitForTimeout(6500); }
  await page.evaluate(() => document.querySelector('[data-rhythm-song-art-zoom]')?.click()); await page.waitForTimeout(1000);
  const picked = await page.evaluate((d) => { const b = document.querySelector(`[data-rhythm-listen-diff="${d}"]`); if (!b) return false; b.click(); return true; }, DIFF);
  if (!picked) { const have = await page.evaluate(() => [...document.querySelectorAll('[data-rhythm-listen-diff]')].map(b => b.getAttribute('data-rhythm-listen-diff')).join(',') + ' / ' + (document.querySelector('[data-rhythm-listen-panel]')?.parentElement?.innerText || '').slice(0, 80)); throw new Error(`鑑賞の難易度 ${DIFF} を選べない(選べるのは ${have})`); }
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('[data-rhythm-listen-start]')?.click());
  await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks?.rhythmNotes?.(), null, { timeout: 30000, polling: 100 });
  await page.waitForFunction(() => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) > 0, null, { timeout: 30000, polling: 100 });
  while (FROM > 0) { const ms = await page.evaluate(() => window.__mhTestHooks.rhythmSongMs()); if (ms >= FROM - 10500) break;
    const ok = await page.evaluate(() => { const b = document.querySelector('button[aria-label="10秒送る"]'); if (b) b.click(); return !!b; }); if (!ok) break; await page.waitForTimeout(500); }
  await page.waitForFunction((t) => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) >= t, SHOT, { timeout: 600000, polling: 5 });
  await page.screenshot(/\.jpe?g$/i.test(OUT) ? { path: OUT, type: 'jpeg', quality: 82 } : { path: OUT });
  if (DUMP) console.log(await page.evaluate(() => { const a = document.querySelector('[data-rhythm-play-area]'); const out = [];
    const walk = (el, d) => { if (d > 0) return; for (const c of el.children) { const cs = getComputedStyle(c); const r = c.getBoundingClientRect();
      if (r.width > 50) out.push(`${'  '.repeat(d)}${c.tagName.toLowerCase()} ${[...c.attributes].filter(x => x.name.startsWith('data-')).map(x => x.name).join(' ')} z=${cs.zIndex} pos=${cs.position} ${Math.round(r.width)}x${Math.round(r.height)}`); walk(c, d + 1); } };
    walk(a, 0); return out.join('\n'); }));
  console.log(`撮った: ${OUT}(${SHOT}ms${LOOK ? '・案' + LOOK : ''}${ROT ? '・🔄横' : PORTRAIT ? '・縦' : '・横'})`);
  if (errors.length) console.log('ページのエラー:', errors.slice(0, 3).join(' / '));
  await context.close(); await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
